"use server";

import { promises as fs } from "fs";
import { homedir } from "os";
import path from "path";
import { ActionState } from "@/types";

interface SSHConfigHost {
  name: string;
  hostname?: string;
  user?: string;
  port?: string;
  identityFile?: string;
}

export async function parseSSHConfig(): Promise<ActionState<SSHConfigHost[]>> {
  try {
    const configPath = path.join(homedir(), ".ssh", "config");
    let content: string;

    try {
      content = await fs.readFile(configPath, "utf-8");
    } catch (error) {
      return {
        isSuccess: false,
        message: "SSH config file not found",
      };
    }

    const hosts: SSHConfigHost[] = [];
    let currentHost: SSHConfigHost | null = null;

    const lines = content.split("\n");
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith("#")) continue;

      const [key, ...valueParts] = trimmedLine.split(/\s+/);
      const value = valueParts.join(" ");

      if (key.toLowerCase() === "host") {
        if (currentHost) {
          hosts.push(currentHost);
        }
        currentHost = {
          name: value,
        };
      } else if (currentHost) {
        switch (key.toLowerCase()) {
          case "hostname":
            currentHost.hostname = value;
            break;
          case "user":
            currentHost.user = value;
            break;
          case "port":
            currentHost.port = value;
            break;
          case "identityfile":
            currentHost.identityFile = value;
            break;
        }
      }
    }

    if (currentHost) {
      hosts.push(currentHost);
    }

    // Check if each host has an identity file and if it exists
    for (const host of hosts) {
      if (host.identityFile) {
        const expandedPath = host.identityFile.replace(/^~/, homedir());
        try {
          await fs.access(expandedPath);
        } catch {
          // If the identity file doesn't exist, remove it from the config
          delete host.identityFile;
        }
      }
    }

    return {
      isSuccess: true,
      message: "SSH config parsed successfully",
      data: hosts,
    };
  } catch (error) {
    return {
      isSuccess: false,
      message: `Failed to parse SSH config: ${(error as Error).message}`,
    };
  }
}

export async function checkKeyNeedsPassphrase(
  keyPath: string
): Promise<ActionState<boolean>> {
  try {
    const expandedPath = keyPath.replace(/^~/, homedir());
    const content = await fs.readFile(expandedPath, "utf-8");

    // Check if the key is encrypted (contains "ENCRYPTED" in the header)
    const needsPassphrase = content.includes("ENCRYPTED");

    return {
      isSuccess: true,
      message: "Key checked successfully",
      data: needsPassphrase,
    };
  } catch (error) {
    return {
      isSuccess: false,
      message: `Failed to check key: ${(error as Error).message}`,
    };
  }
}
