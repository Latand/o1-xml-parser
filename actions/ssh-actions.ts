"use server";

import { Client, SFTPWrapper } from "ssh2";
import type { FileEntry } from "ssh2-streams";
import { promises as fs } from "fs";
import { homedir } from "os";
import { ActionState } from "@/types";

interface SSHConfig {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

interface RemoteFileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifyTime: Date;
}

async function readPrivateKey(keyPath: string): Promise<string> {
  const expandedPath = keyPath.replace(/^~/, homedir());
  return await fs.readFile(expandedPath, "utf-8");
}

function createSSHClient(config: SSHConfig): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client();

    client
      .on("ready", () => {
        resolve(client);
      })
      .on("error", (err: Error) => {
        reject(err);
      })
      .connect({
        host: config.host,
        port: config.port || 22,
        username: config.username,
        password: config.password,
        privateKey: config.privateKey,
        passphrase: config.passphrase,
      });
  });
}

export async function readRemoteDirectory(
  config: SSHConfig,
  dirPath: string,
  identityFile?: string
): Promise<ActionState<RemoteFileEntry[]>> {
  try {
    let sshConfig = { ...config };

    if (identityFile) {
      try {
        sshConfig.privateKey = await readPrivateKey(identityFile);
      } catch (error) {
        return {
          isSuccess: false,
          message: `Failed to read identity file: ${(error as Error).message}`,
        };
      }
    }

    const client = await createSSHClient(sshConfig);

    return new Promise((resolve) => {
      client.sftp((err: Error | undefined, sftp: SFTPWrapper) => {
        if (err) {
          client.end();
          resolve({
            isSuccess: false,
            message: `Failed to initialize SFTP: ${err.message}`,
          });
          return;
        }

        sftp.readdir(dirPath, (err: Error | undefined, list: FileEntry[]) => {
          client.end();

          if (err) {
            resolve({
              isSuccess: false,
              message: `Failed to read directory: ${err.message}`,
            });
            return;
          }

          const entries: RemoteFileEntry[] = list.map((item: FileEntry) => ({
            name: item.filename,
            path: `${dirPath}/${item.filename}`,
            isDirectory: item.attrs.mode
              ? (item.attrs.mode & 0o40000) !== 0
              : false,
            size: item.attrs.size || 0,
            modifyTime: new Date((item.attrs.mtime || 0) * 1000),
          }));

          resolve({
            isSuccess: true,
            message: "Directory read successfully",
            data: entries,
          });
        });
      });
    });
  } catch (error) {
    return {
      isSuccess: false,
      message: `Failed to connect to SSH: ${(error as Error).message}`,
    };
  }
}

export async function getRemoteFileContent(
  config: SSHConfig,
  filePath: string,
  identityFile?: string
): Promise<ActionState<string>> {
  try {
    let sshConfig = { ...config };

    if (identityFile) {
      try {
        sshConfig.privateKey = await readPrivateKey(identityFile);
      } catch (error) {
        return {
          isSuccess: false,
          message: `Failed to read identity file: ${(error as Error).message}`,
        };
      }
    }

    const client = await createSSHClient(sshConfig);

    return new Promise((resolve) => {
      client.sftp((err: Error | undefined, sftp: SFTPWrapper) => {
        if (err) {
          client.end();
          resolve({
            isSuccess: false,
            message: `Failed to initialize SFTP: ${err.message}`,
          });
          return;
        }

        let content = "";
        const stream = sftp.createReadStream(filePath);

        stream.on("data", (data: Buffer) => {
          content += data.toString();
        });

        stream.on("end", () => {
          client.end();
          resolve({
            isSuccess: true,
            message: "File read successfully",
            data: content,
          });
        });

        stream.on("error", (err: Error) => {
          client.end();
          resolve({
            isSuccess: false,
            message: `Failed to read file: ${err.message}`,
          });
        });
      });
    });
  } catch (error) {
    return {
      isSuccess: false,
      message: `Failed to connect to SSH: ${(error as Error).message}`,
    };
  }
}
