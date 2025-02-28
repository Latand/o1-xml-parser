"use server";

import { applyFileChanges, applyRemoteFileChanges } from "@/lib/apply-changes";
import { parseXmlString } from "@/lib/xml-parser";
import { SSHConfig } from "@/types";

export async function applyChangesAction(
  xml: string,
  projectDirectory: string,
  isRemote: boolean = false,
  sshConfig: SSHConfig | null = null
) {
  const changes = await parseXmlString(xml);

  if (!changes || !Array.isArray(changes)) {
    throw new Error("Invalid XML format. Could not find changed_files.");
  }

  let finalDirectory =
    projectDirectory && projectDirectory.trim() !== ""
      ? projectDirectory.trim()
      : process.env.PROJECT_DIRECTORY;

  if (!finalDirectory) {
    throw new Error(
      "No project directory provided and no fallback found in environment."
    );
  }

  if (isRemote && !sshConfig) {
    throw new Error(
      "SSH configuration is required for remote file operations."
    );
  }

  for (const file of changes) {
    if (isRemote && sshConfig) {
      await applyRemoteFileChanges(file, finalDirectory, sshConfig);
    } else {
      await applyFileChanges(file, finalDirectory);
    }
  }
}
