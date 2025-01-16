"use server";

import { promises as fs } from "fs";
import path from "path";
import { ActionState } from "@/types";
import ignore from "ignore";

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface FileStats {
  lines: number;
  characters: number;
  tokens: number;
  files: number;
  fileStats: Array<{
    path: string;
    characters: number;
  }>;
}

// Simple token estimation function
function estimateTokens(text: string): number {
  // Split on whitespace and punctuation
  const words = text.split(/[\s\p{P}]+/u).filter(Boolean);
  // Add extra tokens for code-specific elements (roughly matching GPT tokenization)
  const extraTokens =
    text.length - text.replace(/[{}\[\]()=+\-*/<>!&|^%]/g, "").length;
  return words.length + extraTokens;
}

async function findRootGitignore(startPath: string): Promise<string | null> {
  let currentPath = startPath;

  while (currentPath !== path.parse(currentPath).root) {
    try {
      const gitignorePath = path.join(currentPath, ".gitignore");
      await fs.access(gitignorePath);
      console.log("Found .gitignore at:", gitignorePath);
      return gitignorePath;
    } catch {
      currentPath = path.dirname(currentPath);
    }
  }
  return null;
}

async function readGitignore(dirPath: string): Promise<string[]> {
  try {
    const gitignorePath = await findRootGitignore(dirPath);
    if (!gitignorePath) {
      console.log("No .gitignore found");
      return [];
    }

    const content = await fs.readFile(gitignorePath, "utf-8");
    const patterns = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      // Add **/ prefix to make patterns match in subdirectories
      .map((pattern) => {
        if (pattern.startsWith("/")) {
          return pattern.slice(1);
        }
        if (!pattern.startsWith("**/") && !pattern.startsWith("!")) {
          return `**/${pattern}`;
        }
        return pattern;
      });

    console.log("Gitignore patterns:", patterns);
    return patterns;
  } catch (error) {
    console.error("Error reading .gitignore:", error);
    return [];
  }
}

async function getAllFilesRecursively(
  dirPath: string,
  gitignorePatterns: string[],
  ig: ReturnType<typeof ignore>,
  rootDir: string
): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

    // Skip files that match gitignore patterns
    if (gitignorePatterns.length > 0) {
      const shouldIgnore = ig.ignores(relativePath);
      if (shouldIgnore) {
        console.log("Ignoring path:", relativePath);
        continue;
      }
    }

    if (entry.isDirectory()) {
      files.push(
        ...(await getAllFilesRecursively(
          fullPath,
          gitignorePatterns,
          ig,
          rootDir
        ))
      );
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

export async function getAllFilesInDirectory(
  dirPath: string,
  additionalPatterns: string[] = []
): Promise<ActionState<string[]>> {
  try {
    const absolutePath = path.resolve(dirPath);
    const gitignorePath = await findRootGitignore(absolutePath);
    const rootDir = gitignorePath ? path.dirname(gitignorePath) : absolutePath;
    const gitignorePatterns = await readGitignore(absolutePath);
    const allPatterns = [
      ...gitignorePatterns,
      ...additionalPatterns.map((pattern) =>
        pattern.startsWith("**/") || pattern.startsWith("!")
          ? pattern
          : `**/${pattern}`
      ),
    ];
    const ig = ignore().add(allPatterns);

    const files = await getAllFilesRecursively(
      absolutePath,
      allPatterns,
      ig,
      rootDir
    );

    return {
      isSuccess: true,
      message: "Files retrieved successfully",
      data: files,
    };
  } catch (error) {
    return {
      isSuccess: false,
      message: `Failed to get directory files: ${(error as Error).message}`,
    };
  }
}

export async function readDirectory(
  dirPath: string,
  additionalPatterns: string[] = []
): Promise<ActionState<FileEntry[]>> {
  try {
    const absolutePath = path.resolve(dirPath);
    const gitignorePath = await findRootGitignore(absolutePath);
    const rootDir = gitignorePath ? path.dirname(gitignorePath) : absolutePath;
    const gitignorePatterns = await readGitignore(rootDir);
    const allPatterns = [
      ...gitignorePatterns,
      ...additionalPatterns.map((pattern) =>
        pattern.startsWith("**/") || pattern.startsWith("!")
          ? pattern
          : `**/${pattern}`
      ),
    ];
    const ig = ignore().add(allPatterns);

    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    const fileEntries: FileEntry[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;

      const fullPath = path.join(absolutePath, entry.name);
      const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

      // Skip files that match gitignore patterns
      if (allPatterns.length > 0) {
        const shouldIgnore = ig.ignores(relativePath);
        if (shouldIgnore) {
          console.log("Ignoring path:", relativePath);
          continue;
        }
      }

      fileEntries.push({
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory(),
      });
    }

    return {
      isSuccess: true,
      message: "Directory read successfully",
      data: fileEntries,
    };
  } catch (error) {
    return {
      isSuccess: false,
      message: `Failed to read directory: ${(error as Error).message}`,
    };
  }
}

export async function getFileStats(
  filePaths: string[],
  rootDir?: string | null
): Promise<ActionState<FileStats>> {
  try {
    let totalLines = 0;
    let totalCharacters = 0;
    let totalTokens = 0;
    const fileStats: Array<{ path: string; characters: number }> = [];

    for (const filePath of filePaths) {
      try {
        // If we have a root directory, use it to resolve the path
        const absolutePath = rootDir
          ? path.join(rootDir, filePath)
          : path.resolve(filePath);

        const content = await fs.readFile(absolutePath, "utf-8");
        totalLines += content.split("\n").length;
        totalCharacters += content.length;
        totalTokens += estimateTokens(content);

        fileStats.push({
          path: filePath,
          characters: content.length,
        });
      } catch (error) {
        console.error(`Failed to read file ${filePath}:`, error);
        // Continue with other files even if one fails
        continue;
      }
    }

    return {
      isSuccess: true,
      message: "File stats calculated successfully",
      data: {
        lines: totalLines,
        characters: totalCharacters,
        tokens: totalTokens,
        files: filePaths.length,
        fileStats: fileStats.sort((a, b) => b.characters - a.characters),
      },
    };
  } catch (error) {
    return {
      isSuccess: false,
      message: `Failed to calculate file stats: ${(error as Error).message}`,
    };
  }
}

export async function downloadSelectedFiles(
  filePaths: string[],
  rootDir?: string | null
): Promise<ActionState<{ content: string; filename: string }>> {
  try {
    let combinedContent = `
You are an expert programming assistant.
Your primary goal is to generate or modify code that is of the highest quality, adhering to best programming principles and maintaining consistency with the user's existing code style.

You are tasked with following my instructions.

Use the included project instructions as a general guide.

You will respond with 3 sections: A code analysis and approach selection, then an XML section, and then a summary section.

## Code Analysis and Approach Selection

In the code analysis section, please follow these steps:

1. Analyze the existing code to understand the current style, conventions, and patterns used.
2. Carefully consider the user's request and how it fits into the existing codebase.
3. Plan your approach, keeping in mind best programming principles such as readability, maintainability, efficiency, and adherence to SOLID principles where applicable.
4. Draft your code suggestion, ensuring it aligns with the existing code style and fulfills the user's request.
5. Review your draft for any potential improvements or optimizations.
6. Finalize your code suggestion.


Wrap your thought process for each step inside <code_analysis> tags. This will help ensure that your code suggestion is well-considered and of the highest quality. Include the following in your analysis:

1. Identify and list key features of the existing code style (numbering each feature)
2. List the main requirements from the user's request (numbering each requirement)
3. Outline potential approaches to fulfill the request (numbering each approach)
4. Consider pros and cons of each approach (listing them for each approach)

Remember to count and number the items in each part of your analysis. This process will help you thoroughly consider all aspects before making your final code suggestion. Write at least a couple of sections for each item, and a conclusion paragraph about your final selected approach.

Remember, the goal is to provide the absolute best code possible, so take your time to think through each step carefully.

## XML Section

Here are some notes on how you should respond in the XML section:

- Include all of the changed files
- Specify each file operation with CREATE, UPDATE, or DELETE
- If it is a CREATE or UPDATE include the full file code. Do not get lazy.
- Each file should include a brief change summary.
- Include the full file path
- I am going to copy/paste that entire XML section into a parser to automatically apply the changes you made, so put the XML block inside a markdown codeblock.
- Make sure to enclose the code with ![CDATA[__CODE HERE__]]
- Write file code fully without skipping any parts, don’t be lazy

Here is how you should structure the XML:

<code_changes>
<changed_files>
<file>
<file_summary>**BRIEF CHANGE SUMMARY HERE**</file_summary>
<file_operation>**FILE OPERATION HERE**</file_operation>
<file_path>**FILE PATH HERE**</file_path>
<file_code><![CDATA[
__FULL FILE CODE HERE__
]]></file_code>
</file>
**REMAINING FILES HERE**
</changed_files>
</code_changes>

So the XML section will be:

\`\`\`xml
__XML HERE__
\`\`\`

## Summary Section

Here are some notes on how you should respond in the summary section:

- Provide a brief overall summary
- Provide a 1-sentence summary for each file changed and why.
- Provide a 1-sentence summary for each file deleted and why.
- Format this section as markdown.


## Code Context

`;

    for (const filePath of filePaths) {
      try {
        // If we have a root directory, use it to resolve the path
        const absolutePath = rootDir
          ? path.join(rootDir, filePath)
          : path.resolve(filePath);

        const content = await fs.readFile(absolutePath, "utf-8");
        combinedContent += `# ${filePath}\n\n${content}\n\n---\n\n`;
      } catch (error) {
        console.error(`Failed to read file ${filePath}:`, error);
        // Continue with other files even if one fails
        continue;
      }
    }

    return {
      isSuccess: true,
      message: "Files combined successfully",
      data: {
        content: combinedContent,
        filename: "combined_files.txt",
      },
    };
  } catch (error) {
    return {
      isSuccess: false,
      message: `Failed to combine files: ${(error as Error).message}`,
    };
  }
}

async function findSimilarPaths(
  basePath: string,
  searchTerm: string
): Promise<string[]> {
  try {
    const parentDir = path.dirname(searchTerm);
    let searchDir = parentDir === "." ? basePath : parentDir;

    if (!path.isAbsolute(searchDir)) {
      searchDir = path.join(basePath, searchDir);
    }

    try {
      await fs.access(searchDir);
    } catch {
      return [];
    }

    const entries = await fs.readdir(searchDir, { withFileTypes: true });
    const searchName = path.basename(searchTerm).toLowerCase();

    return entries
      .filter((entry) => {
        // Ignore files and directories that start with a dot
        if (entry.name.startsWith(".")) return false;

        const name = entry.name.toLowerCase();
        return name.includes(searchName) || searchName.includes(name);
      })
      .map((entry) => {
        const fullPath = path.join(searchDir, entry.name);
        return fullPath;
      })
      .slice(0, 5); // Limit to 5 suggestions
  } catch (error) {
    console.error("Error finding similar paths:", error);
    return [];
  }
}

export async function getSimilarPaths(
  searchPath: string
): Promise<ActionState<string[]>> {
  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE || "/";
    const suggestions = await findSimilarPaths(homeDir, searchPath);

    return {
      isSuccess: true,
      message: "Found similar paths",
      data: suggestions,
    };
  } catch (error) {
    return {
      isSuccess: false,
      message: `Failed to get similar paths: ${(error as Error).message}`,
    };
  }
}
