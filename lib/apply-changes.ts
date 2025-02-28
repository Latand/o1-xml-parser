import { promises as fs } from "fs";
import * as fsSync from "fs";
import { dirname, join } from "path";
import { SSHConfig } from "@/types";
import { Client, SFTPWrapper, Stats } from "ssh2";
import path from "path";

interface FileChange {
  file_summary: string;
  file_operation: string;
  file_path: string;
  file_code?: string;
}

export async function applyFileChanges(
  change: FileChange,
  projectDirectory: string
) {
  const { file_operation, file_path, file_code } = change;
  const fullPath = join(projectDirectory, file_path);

  switch (file_operation.toUpperCase()) {
    case "CREATE":
      if (!file_code) {
        throw new Error(
          `No file_code provided for CREATE operation on ${file_path}`
        );
      }
      await ensureDirectoryExists(dirname(fullPath));
      await fs.writeFile(fullPath, file_code, "utf-8");
      break;

    case "UPDATE":
      if (!file_code) {
        throw new Error(
          `No file_code provided for UPDATE operation on ${file_path}`
        );
      }
      await ensureDirectoryExists(dirname(fullPath));
      await fs.writeFile(fullPath, file_code, "utf-8");
      break;

    case "DELETE":
      await fs.rm(fullPath, { force: true });
      break;

    default:
      console.warn(
        `Unknown file_operation: ${file_operation} for file: ${file_path}`
      );
      break;
  }
}

export async function applyRemoteFileChanges(
  change: FileChange,
  projectDirectory: string,
  sshConfig: SSHConfig
) {
  const { file_operation, file_path, file_code } = change;
  const fullPath = path.posix.join(projectDirectory, file_path);

  return new Promise<void>((resolve, reject) => {
    const client = new Client();

    client.on("ready", () => {
      client.sftp((err, sftp) => {
        if (err) {
          client.end();
          return reject(new Error(`SFTP error: ${err.message}`));
        }

        const handleOperation = async () => {
          try {
            switch (file_operation.toUpperCase()) {
              case "CREATE":
              case "UPDATE":
                if (!file_code) {
                  throw new Error(
                    `No file_code provided for ${file_operation} operation on ${file_path}`
                  );
                }

                // Ensure directory exists
                const dirPath = path.posix.dirname(fullPath);
                await ensureRemoteDirectoryExists(sftp, dirPath);

                // Write file using a promise-based approach
                await new Promise<void>((resolveWrite, rejectWrite) => {
                  const writeStream = sftp.createWriteStream(fullPath);
                  let hasError = false;

                  writeStream.on("error", (err: Error) => {
                    hasError = true;
                    rejectWrite(
                      new Error(`Error writing to ${fullPath}: ${err.message}`)
                    );
                  });

                  writeStream.on("close", () => {
                    if (!hasError) {
                      console.log(`Successfully wrote to ${fullPath}`);
                      resolveWrite();
                    }
                  });

                  writeStream.end(file_code, "utf8");
                });

                resolve();
                break;

              case "DELETE":
                sftp.unlink(fullPath, (err) => {
                  if (err) {
                    // Check for ENOENT error (file not found)
                    if (
                      err.message.includes("No such file") ||
                      err.message.includes("ENOENT")
                    ) {
                      console.warn(
                        `File ${fullPath} does not exist, skipping delete`
                      );
                      resolve();
                    } else {
                      reject(
                        new Error(`Error deleting ${fullPath}: ${err.message}`)
                      );
                    }
                  } else {
                    console.log(`Successfully deleted ${fullPath}`);
                    resolve();
                  }
                });
                break;

              default:
                console.warn(
                  `Unknown file_operation: ${file_operation} for file: ${file_path}`
                );
                resolve();
                break;
            }
          } catch (error) {
            reject(error);
          } finally {
            // Don't close the client here, as it might be closed before the async operations complete
          }
        };

        handleOperation()
          .catch(reject)
          .finally(() => {
            // Close the client after all operations are done
            client.end();
          });
      });
    });

    client.on("error", (err) => {
      reject(new Error(`SSH connection error: ${err.message}`));
    });

    const connectionConfig: any = {
      host: sshConfig.host,
      port: sshConfig.port || 22,
      username: sshConfig.username,
      // Add a reasonable timeout to prevent hanging connections
      readyTimeout: 10000,
      keepaliveInterval: 5000,
    };

    if (sshConfig.password) {
      connectionConfig.password = sshConfig.password;
    } else if (sshConfig.identityFile) {
      try {
        // Use synchronous fs to read the identity file
        const privateKey = fsSync.readFileSync(sshConfig.identityFile);
        connectionConfig.privateKey = privateKey;

        if (sshConfig.passphrase) {
          connectionConfig.passphrase = sshConfig.passphrase;
        }
      } catch (error: any) {
        reject(new Error(`Error reading identity file: ${error.message}`));
        return;
      }
    } else {
      reject(new Error("No authentication method provided"));
      return;
    }

    client.connect(connectionConfig);
  });
}

async function ensureDirectoryExists(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error: any) {
    if (error.code !== "EEXIST") {
      console.error(`Error creating directory ${dir}:`, error);
      throw error;
    }
  }
}

async function ensureRemoteDirectoryExists(sftp: SFTPWrapper, dirPath: string) {
  return new Promise<void>((resolve, reject) => {
    sftp.stat(dirPath, (err, stats) => {
      if (err) {
        // Check for ENOENT error (directory not found)
        if (
          err.message.includes("No such file") ||
          err.message.includes("ENOENT")
        ) {
          // Directory doesn't exist, create parent first
          const parentDir = path.posix.dirname(dirPath);
          if (parentDir === dirPath || parentDir === "." || parentDir === "/") {
            // Base case: can't go up further
            reject(new Error(`Cannot create directory ${dirPath}`));
            return;
          }

          ensureRemoteDirectoryExists(sftp, parentDir)
            .then(() => {
              // Now create the directory
              sftp.mkdir(dirPath, (err) => {
                if (err) {
                  reject(
                    new Error(
                      `Error creating directory ${dirPath}: ${err.message}`
                    )
                  );
                } else {
                  console.log(`Created directory ${dirPath}`);
                  resolve();
                }
              });
            })
            .catch(reject);
        } else {
          reject(
            new Error(`Error checking directory ${dirPath}: ${err.message}`)
          );
        }
      } else {
        // Directory exists
        resolve();
      }
    });
  });
}
