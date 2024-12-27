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
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.trim())
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
  dirPath: string
): Promise<ActionState<string[]>> {
  try {
    const absolutePath = path.resolve(dirPath);
    const gitignorePath = await findRootGitignore(absolutePath);
    const rootDir = gitignorePath ? path.dirname(gitignorePath) : absolutePath;
    const gitignorePatterns = await readGitignore(absolutePath);
    const ig = ignore().add(gitignorePatterns);

    const files = await getAllFilesRecursively(
      absolutePath,
      gitignorePatterns,
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
  dirPath: string
): Promise<ActionState<FileEntry[]>> {
  try {
    const absolutePath = path.resolve(dirPath);
    const gitignorePath = await findRootGitignore(absolutePath);
    const rootDir = gitignorePath ? path.dirname(gitignorePath) : absolutePath;
    const gitignorePatterns = await readGitignore(rootDir);
    const ig = ignore().add(gitignorePatterns);

    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    const fileEntries: FileEntry[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;

      const fullPath = path.join(absolutePath, entry.name);
      const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

      // Skip files that match gitignore patterns
      if (gitignorePatterns.length > 0) {
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
    let combinedContent = "";

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
