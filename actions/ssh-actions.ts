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
  content?: string;
}

async function readPrivateKey(keyPath: string): Promise<string> {
  try {
    // Expand home directory
    const expandedPath = keyPath.replace(/^~/, homedir());

    // Validate that the path is an actual file and not a directory
    const stats = await fs.stat(expandedPath);
    if (!stats.isFile()) {
      throw new Error(`Identity file path is not a file: ${expandedPath}`);
    }

    return await fs.readFile(expandedPath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Identity file not found: ${keyPath}`);
    } else if ((error as NodeJS.ErrnoException).code === "EISDIR") {
      throw new Error(`Identity file path is a directory: ${keyPath}`);
    }
    throw error;
  }
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

async function readRemoteFileContent(
  sftp: SFTPWrapper,
  filePath: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    let content = "";
    const stream = sftp.createReadStream(filePath);

    stream.on("data", (data: Buffer) => {
      content += data.toString();
    });

    stream.on("end", () => {
      resolve(content);
    });

    stream.on("error", (err: Error) => {
      reject(err);
    });
  });
}

async function readDirectoryRecursive(
  sftp: SFTPWrapper,
  dirPath: string,
  includeContent = false
): Promise<RemoteFileEntry[]> {
  return new Promise((resolve, reject) => {
    sftp.readdir(dirPath, async (err: Error | undefined, list: FileEntry[]) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        const entries: RemoteFileEntry[] = [];
        const directoryPromises: Promise<RemoteFileEntry[]>[] = [];
        const filePromises: Promise<RemoteFileEntry>[] = [];

        for (const item of list) {
          const fullPath = `${dirPath}/${item.filename}`;
          const isDirectory = item.attrs.mode
            ? (item.attrs.mode & 0o40000) !== 0
            : false;

          if (isDirectory) {
            directoryPromises.push(
              readDirectoryRecursive(sftp, fullPath, includeContent)
            );
          } else {
            const filePromise = (async () => {
              let content: string | undefined;
              if (includeContent) {
                try {
                  content = await readRemoteFileContent(sftp, fullPath);
                } catch (error) {
                  console.error(
                    `Failed to read content for ${fullPath}:`,
                    error
                  );
                }
              }

              return {
                name: item.filename,
                path: fullPath,
                isDirectory: false,
                size: item.attrs.size || 0,
                modifyTime: new Date((item.attrs.mtime || 0) * 1000),
                content,
              };
            })();

            filePromises.push(filePromise);
          }
        }

        // Process directories and files in parallel
        const [directoryResults, fileResults] = await Promise.all([
          Promise.all(directoryPromises).then((results) => results.flat()),
          Promise.all(filePromises),
        ]);

        entries.push(...directoryResults, ...fileResults);
        resolve(entries);
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Update the connection pool implementation
const MAX_CONCURRENT_CONNECTIONS = 5;
interface PooledConnection {
  client: Client;
  lastUsed: number;
  inUse: boolean;
}

let connectionPool: PooledConnection[] = [];

async function getConnectionFromPool(config: SSHConfig): Promise<Client> {
  // Cleanup old connections (older than 5 minutes)
  const now = Date.now();
  connectionPool = connectionPool.filter((conn) => {
    const isOld = now - conn.lastUsed > 5 * 60 * 1000;
    if (isOld) {
      try {
        conn.client.end();
      } catch (error) {
        console.error("Error closing connection:", error);
      }
    }
    return !isOld;
  });

  // Find available connection
  let connection = connectionPool.find((conn) => !conn.inUse);

  if (!connection && connectionPool.length < MAX_CONCURRENT_CONNECTIONS) {
    const client = await createSSHClient(config);
    connection = {
      client,
      lastUsed: now,
      inUse: true,
    };
    connectionPool.push(connection);
  } else if (connection) {
    connection.lastUsed = now;
    connection.inUse = true;
  }

  if (!connection) {
    // If no connection available, wait for one to become available
    connection = connectionPool[0];
    connection.lastUsed = now;
    connection.inUse = true;
  }

  return connection.client;
}

function releaseConnection(client: Client) {
  const connection = connectionPool.find((conn) => conn.client === client);
  if (connection) {
    connection.inUse = false;
  }
}

// Update readRemoteDirectory to use connection pool properly
export async function readRemoteDirectory(
  config: SSHConfig,
  dirPath: string,
  identityFile?: string,
  recursive = false
): Promise<ActionState<RemoteFileEntry[]>> {
  let client: Client | null = null;
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

    client = await getConnectionFromPool(sshConfig);

    const result = await new Promise<ActionState<RemoteFileEntry[]>>(
      (resolve) => {
        client!.sftp(async (err: Error | undefined, sftp: SFTPWrapper) => {
          if (err) {
            resolve({
              isSuccess: false,
              message: `Failed to initialize SFTP: ${err.message}`,
            });
            return;
          }

          try {
            const entries = recursive
              ? await readDirectoryRecursive(sftp, dirPath)
              : await new Promise<RemoteFileEntry[]>(
                  (resolveDir, rejectDir) => {
                    sftp.readdir(
                      dirPath,
                      (err: Error | undefined, list: FileEntry[]) => {
                        if (err) {
                          rejectDir(err);
                          return;
                        }

                        const entries = list.map((item: FileEntry) => ({
                          name: item.filename,
                          path: `${dirPath}/${item.filename}`,
                          isDirectory: item.attrs.mode
                            ? (item.attrs.mode & 0o40000) !== 0
                            : false,
                          size: item.attrs.size || 0,
                          modifyTime: new Date((item.attrs.mtime || 0) * 1000),
                        }));
                        resolveDir(entries);
                      }
                    );
                  }
                );

            resolve({
              isSuccess: true,
              message: "Directory read successfully",
              data: entries,
            });
          } catch (error) {
            resolve({
              isSuccess: false,
              message: `Failed to read directory: ${(error as Error).message}`,
            });
          }
        });
      }
    );

    return result;
  } catch (error) {
    return {
      isSuccess: false,
      message: `Failed to connect to SSH: ${(error as Error).message}`,
    };
  } finally {
    if (client) {
      releaseConnection(client);
    }
  }
}

export async function getRemoteFileStats(
  config: SSHConfig,
  filePaths: string[],
  identityFile?: string
): Promise<
  ActionState<{
    lines: number;
    characters: number;
    tokens: number;
    files: number;
    fileStats: Array<{ path: string; characters: number }>;
  }>
> {
  let client: Client | null = null;
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

    client = await getConnectionFromPool(sshConfig);

    const result = await new Promise<
      ActionState<{
        lines: number;
        characters: number;
        tokens: number;
        files: number;
        fileStats: Array<{ path: string; characters: number }>;
      }>
    >((resolve) => {
      client!.sftp(async (err: Error | undefined, sftp: SFTPWrapper) => {
        if (err) {
          resolve({
            isSuccess: false,
            message: `Failed to initialize SFTP: ${err.message}`,
          });
          return;
        }

        try {
          let totalLines = 0;
          let totalCharacters = 0;
          let totalTokens = 0;
          const fileStats: Array<{ path: string; characters: number }> = [];

          // Process files in batches to avoid memory issues
          const BATCH_SIZE = 10;
          for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
            const batch = filePaths.slice(i, i + BATCH_SIZE);
            const filePromises = batch.map(async (filePath) => {
              try {
                const content = await readRemoteFileContent(sftp, filePath);
                const lines = content.split("\n").length;
                const characters = content.length;
                // Simple token estimation - using a basic regex instead of unicode one for better compatibility
                const tokens = content
                  .split(/[\s.,;:!?()[\]{}'"<>\/\\`~@#$%^&*+=|_-]/)
                  .filter(Boolean).length;

                return {
                  path: filePath,
                  lines,
                  characters,
                  tokens,
                };
              } catch (error) {
                console.error(`Failed to read file ${filePath}:`, error);
                return null;
              }
            });

            const results = await Promise.all(filePromises);
            for (const result of results) {
              if (result) {
                totalLines += result.lines;
                totalCharacters += result.characters;
                totalTokens += result.tokens;
                fileStats.push({
                  path: result.path,
                  characters: result.characters,
                });
              }
            }
          }

          resolve({
            isSuccess: true,
            message: "File stats calculated successfully",
            data: {
              lines: totalLines,
              characters: totalCharacters,
              tokens: totalTokens,
              files: fileStats.length,
              fileStats,
            },
          });
        } catch (error) {
          resolve({
            isSuccess: false,
            message: `Failed to get file stats: ${(error as Error).message}`,
          });
        }
      });
    });

    return result;
  } catch (error) {
    return {
      isSuccess: false,
      message: `Failed to connect to SSH: ${(error as Error).message}`,
    };
  } finally {
    if (client) {
      releaseConnection(client);
    }
  }
}
