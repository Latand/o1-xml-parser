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

    // First check if the file exists
    sftp.stat(filePath, (err) => {
      if (err) {
        // Provide a more detailed error message
        const sshError = err as Error & { code?: number };
        if (sshError.code === 2) {
          // ENOENT
          reject(new Error(`No such file: ${filePath}`));
        } else if (sshError.code === 3) {
          // EACCES
          reject(new Error(`Permission denied: ${filePath}`));
        } else {
          reject(
            new Error(`Error accessing file ${filePath}: ${sshError.message}`)
          );
        }
        return;
      }

      // File exists, try to read it
      const stream = sftp.createReadStream(filePath);

      stream.on("data", (data: Buffer) => {
        content += data.toString();
      });

      stream.on("end", () => {
        resolve(content);
      });

      stream.on("error", (err: Error) => {
        reject(new Error(`Error reading file ${filePath}: ${err.message}`));
      });
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
  config: SSHConfig; // Store the config to check if it matches
  isValid: boolean; // Track if the connection is still valid
}

let connectionPool: PooledConnection[] = [];

async function getConnectionFromPool(config: SSHConfig): Promise<Client> {
  // Cleanup old connections (older than 5 minutes)
  const now = Date.now();
  connectionPool = connectionPool.filter((conn) => {
    const isOld = now - conn.lastUsed > 5 * 60 * 1000;
    if (isOld || !conn.isValid) {
      try {
        conn.client.end();
      } catch (error) {
        console.error("Error closing connection:", error);
      }
    }
    return !isOld && conn.isValid;
  });

  // Check for matching connection with same credentials
  const configKey = `${config.host}:${config.port || 22}:${config.username}`;

  // Find available connection with matching config
  let connection = connectionPool.find(
    (conn) =>
      !conn.inUse &&
      conn.isValid &&
      `${conn.config.host}:${conn.config.port || 22}:${
        conn.config.username
      }` === configKey
  );

  if (!connection && connectionPool.length < MAX_CONCURRENT_CONNECTIONS) {
    try {
      const client = await createSSHClient(config);
      connection = {
        client,
        lastUsed: now,
        inUse: true,
        config: { ...config },
        isValid: true,
      };
      connectionPool.push(connection);
    } catch (error) {
      throw new Error(`SSH connection failed: ${(error as Error).message}`);
    }
  } else if (connection) {
    // Test the connection before using it
    try {
      // Simple ping to check if connection is still responsive
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection test timeout"));
        }, 2000);

        connection!.client.exec("echo ping", (err) => {
          clearTimeout(timeout);
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      connection.lastUsed = now;
      connection.inUse = true;
    } catch (error) {
      // Connection is stale, remove it and create a new one
      try {
        connection.client.end();
      } catch (e) {
        // Ignore errors when closing
      }

      connection.isValid = false;
      connectionPool = connectionPool.filter((conn) => conn.isValid);

      // Create a new connection
      try {
        const client = await createSSHClient(config);
        connection = {
          client,
          lastUsed: now,
          inUse: true,
          config: { ...config },
          isValid: true,
        };
        connectionPool.push(connection);
      } catch (error) {
        throw new Error(`SSH connection failed: ${(error as Error).message}`);
      }
    }
  }

  if (!connection) {
    // If no connection available, create a new one
    try {
      const client = await createSSHClient(config);
      connection = {
        client,
        lastUsed: now,
        inUse: true,
        config: { ...config },
        isValid: true,
      };
      connectionPool.push(connection);
    } catch (error) {
      throw new Error(`SSH connection failed: ${(error as Error).message}`);
    }
  }

  return connection.client;
}

function releaseConnection(client: Client) {
  const connection = connectionPool.find((conn) => conn.client === client);
  if (connection) {
    connection.inUse = false;
    connection.lastUsed = Date.now();
  }
}

// Update readRemoteDirectory to use connection pool properly
export async function readRemoteDirectory(
  config: SSHConfig,
  dirPath: string,
  identityFile?: string,
  recursive = false,
  rootDir?: string | null
): Promise<ActionState<RemoteFileEntry[]>> {
  let client: Client | null = null;
  let retryCount = 0;
  const MAX_RETRIES = 2;

  while (retryCount <= MAX_RETRIES) {
    try {
      let sshConfig = { ...config };

      if (identityFile) {
        try {
          sshConfig.privateKey = await readPrivateKey(identityFile);
        } catch (error) {
          return {
            isSuccess: false,
            message: `Failed to read identity file: ${
              (error as Error).message
            }`,
          };
        }
      }

      // Get a fresh connection on retry
      if (retryCount > 0) {
        console.log(
          `Retrying SSH connection (attempt ${retryCount}/${MAX_RETRIES})...`
        );
        // Force a new connection by not using the pool
        client = await createSSHClient(sshConfig);
      } else {
        client = await getConnectionFromPool(sshConfig);
      }

      // Combine root directory with relative path if needed
      const fullPath =
        rootDir && !dirPath.startsWith("/") ? `${rootDir}/${dirPath}` : dirPath;

      console.log(`Reading directory: ${fullPath} (original: ${dirPath})`);

      const result = await new Promise<ActionState<RemoteFileEntry[]>>(
        (resolve) => {
          // Set a timeout for SFTP initialization
          const sftpTimeout = setTimeout(() => {
            resolve({
              isSuccess: false,
              message: "SFTP initialization timed out after 10 seconds",
            });
          }, 10000);

          client!.sftp(async (err: Error | undefined, sftp: SFTPWrapper) => {
            clearTimeout(sftpTimeout);

            if (err) {
              // Check for specific error messages that indicate we should retry
              const errorMsg = err.message || "";
              const shouldRetry =
                errorMsg.includes("Channel open failure") ||
                errorMsg.includes("open failed") ||
                errorMsg.includes("connection reset");

              if (shouldRetry && retryCount < MAX_RETRIES) {
                // Let the outer loop handle the retry
                resolve({
                  isSuccess: false,
                  message: `SFTP initialization failed (will retry): ${err.message}`,
                });
                return;
              }

              resolve({
                isSuccess: false,
                message: `Failed to initialize SFTP: ${err.message}`,
              });
              return;
            }

            try {
              const entries = recursive
                ? await readDirectoryRecursive(sftp, fullPath)
                : await new Promise<RemoteFileEntry[]>(
                    (resolveDir, rejectDir) => {
                      sftp.readdir(
                        fullPath,
                        (err: Error | undefined, list: FileEntry[]) => {
                          if (err) {
                            rejectDir(err);
                            return;
                          }

                          const entries = list.map((item: FileEntry) => ({
                            name: item.filename,
                            path: `${fullPath}/${item.filename}`,
                            isDirectory: item.attrs.mode
                              ? (item.attrs.mode & 0o40000) !== 0
                              : false,
                            size: item.attrs.size || 0,
                            modifyTime: new Date(
                              (item.attrs.mtime || 0) * 1000
                            ),
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
                message: `Failed to read directory: ${
                  (error as Error).message
                }`,
              });
            }
          });
        }
      );

      // If we need to retry, close this connection and try again
      if (
        !result.isSuccess &&
        retryCount < MAX_RETRIES &&
        (result.message.includes("will retry") ||
          result.message.includes("timed out"))
      ) {
        retryCount++;
        if (client) {
          try {
            client.end();
          } catch (e) {
            // Ignore errors when closing
          }
        }
        // Wait a bit before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
        continue;
      }

      return result;
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        // Wait a bit before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
        continue;
      }

      return {
        isSuccess: false,
        message: `Failed to connect to SSH: ${(error as Error).message}`,
      };
    } finally {
      if (client && retryCount >= MAX_RETRIES) {
        releaseConnection(client);
      }
    }
  }

  // This should never be reached, but TypeScript requires a return
  return {
    isSuccess: false,
    message: "Failed to connect after maximum retries",
  };
}

export async function getRemoteFileStats(
  config: SSHConfig,
  filePaths: string[],
  identityFile?: string,
  rootDir?: string | null
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
  let retryCount = 0;
  const MAX_RETRIES = 2;

  while (retryCount <= MAX_RETRIES) {
    try {
      let sshConfig = { ...config };

      if (identityFile) {
        try {
          sshConfig.privateKey = await readPrivateKey(identityFile);
        } catch (error) {
          return {
            isSuccess: false,
            message: `Failed to read identity file: ${
              (error as Error).message
            }`,
          };
        }
      }

      // Get a fresh connection on retry
      if (retryCount > 0) {
        console.log(
          `Retrying SSH connection (attempt ${retryCount}/${MAX_RETRIES})...`
        );
        // Force a new connection by not using the pool
        client = await createSSHClient(sshConfig);
      } else {
        client = await getConnectionFromPool(sshConfig);
      }

      const result = await new Promise<
        ActionState<{
          lines: number;
          characters: number;
          tokens: number;
          files: number;
          fileStats: Array<{ path: string; characters: number }>;
        }>
      >((resolve) => {
        // Set a timeout for SFTP initialization
        const sftpTimeout = setTimeout(() => {
          resolve({
            isSuccess: false,
            message: "SFTP initialization timed out after 10 seconds",
          });
        }, 10000);

        client!.sftp(async (err: Error | undefined, sftp: SFTPWrapper) => {
          clearTimeout(sftpTimeout);

          if (err) {
            // Check for specific error messages that indicate we should retry
            const errorMsg = err.message || "";
            const shouldRetry =
              errorMsg.includes("Channel open failure") ||
              errorMsg.includes("open failed") ||
              errorMsg.includes("connection reset");

            if (shouldRetry && retryCount < MAX_RETRIES) {
              // Let the outer loop handle the retry
              resolve({
                isSuccess: false,
                message: `SFTP initialization failed (will retry): ${err.message}`,
              });
              return;
            }

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
            const BATCH_SIZE = 5; // Reduced batch size for better reliability
            for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
              const batch = filePaths.slice(i, i + BATCH_SIZE);
              const filePromises = batch.map(async (filePath) => {
                try {
                  // Combine root directory with relative path if needed
                  const fullPath =
                    rootDir && !filePath.startsWith("/")
                      ? `${rootDir}/${filePath}`
                      : filePath;

                  console.log(
                    `Reading file stats for: ${fullPath} (original: ${filePath})`
                  );

                  const content = await readRemoteFileContent(sftp, fullPath);
                  const lines = content.split("\n").length;
                  const characters = content.length;
                  // Simple token estimation - using a basic regex instead of unicode one for better compatibility
                  const tokens = content
                    .split(/[\s.,;:!?()[\]{}'"<>\/\\`~@#$%^&*+=|_-]/)
                    .filter(Boolean).length;

                  return {
                    path: filePath, // Keep the original relative path for consistency
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

      // If we need to retry, close this connection and try again
      if (
        !result.isSuccess &&
        retryCount < MAX_RETRIES &&
        (result.message.includes("will retry") ||
          result.message.includes("timed out"))
      ) {
        retryCount++;
        if (client) {
          try {
            client.end();
          } catch (e) {
            // Ignore errors when closing
          }
        }
        // Wait a bit before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
        continue;
      }

      return result;
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        // Wait a bit before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
        continue;
      }

      return {
        isSuccess: false,
        message: `Failed to connect to SSH: ${(error as Error).message}`,
      };
    } finally {
      if (client && retryCount >= MAX_RETRIES) {
        releaseConnection(client);
      }
    }
  }

  // This should never be reached, but TypeScript requires a return
  return {
    isSuccess: false,
    message: "Failed to connect after maximum retries",
  };
}

// Export the readRemoteFileContent function for use in other files
export async function getRemoteFileContent(
  config: SSHConfig,
  filePath: string,
  identityFile?: string,
  rootDir?: string | null
): Promise<ActionState<string>> {
  let client: Client | null = null;
  let retryCount = 0;
  const MAX_RETRIES = 2;

  while (retryCount <= MAX_RETRIES) {
    try {
      let sshConfig = { ...config };

      if (identityFile) {
        try {
          sshConfig.privateKey = await readPrivateKey(identityFile);
        } catch (error) {
          return {
            isSuccess: false,
            message: `Failed to read identity file: ${
              (error as Error).message
            }`,
          };
        }
      }

      // Get a fresh connection on retry
      if (retryCount > 0) {
        console.log(
          `Retrying SSH connection (attempt ${retryCount}/${MAX_RETRIES})...`
        );
        // Force a new connection by not using the pool
        client = await createSSHClient(sshConfig);
      } else {
        client = await getConnectionFromPool(sshConfig);
      }

      // Combine root directory with relative path if needed
      const fullPath =
        rootDir && !filePath.startsWith("/")
          ? `${rootDir}/${filePath}`
          : filePath;

      console.log(
        `Reading remote file content: ${fullPath} (original: ${filePath})`
      );

      const result = await new Promise<ActionState<string>>((resolve) => {
        // Set a timeout for SFTP initialization
        const sftpTimeout = setTimeout(() => {
          resolve({
            isSuccess: false,
            message: "SFTP initialization timed out after 10 seconds",
          });
        }, 10000);

        client!.sftp(async (err: Error | undefined, sftp: SFTPWrapper) => {
          clearTimeout(sftpTimeout);

          if (err) {
            // Check for specific error messages that indicate we should retry
            const errorMsg = err.message || "";
            const shouldRetry =
              errorMsg.includes("Channel open failure") ||
              errorMsg.includes("open failed") ||
              errorMsg.includes("connection reset");

            if (shouldRetry && retryCount < MAX_RETRIES) {
              // Let the outer loop handle the retry
              resolve({
                isSuccess: false,
                message: `SFTP initialization failed (will retry): ${err.message}`,
              });
              return;
            }

            resolve({
              isSuccess: false,
              message: `Failed to initialize SFTP: ${err.message}`,
            });
            return;
          }

          try {
            const content = await readRemoteFileContent(sftp, fullPath);
            resolve({
              isSuccess: true,
              message: "File content read successfully",
              data: content,
            });
          } catch (error) {
            resolve({
              isSuccess: false,
              message: `Failed to read file content: ${
                (error as Error).message
              }`,
            });
          }
        });
      });

      // If we need to retry, close this connection and try again
      if (
        !result.isSuccess &&
        retryCount < MAX_RETRIES &&
        (result.message.includes("will retry") ||
          result.message.includes("timed out"))
      ) {
        retryCount++;
        if (client) {
          try {
            client.end();
          } catch (e) {
            // Ignore errors when closing
          }
        }
        // Wait a bit before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
        continue;
      }

      return result;
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        // Wait a bit before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
        continue;
      }

      return {
        isSuccess: false,
        message: `Failed to connect to SSH: ${(error as Error).message}`,
      };
    } finally {
      if (client && retryCount >= MAX_RETRIES) {
        releaseConnection(client);
      }
    }
  }

  // This should never be reached, but TypeScript requires a return
  return {
    isSuccess: false,
    message: "Failed to connect after maximum retries",
  };
}
