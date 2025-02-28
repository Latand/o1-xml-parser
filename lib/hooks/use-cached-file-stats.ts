"use client";

import { useState, useEffect, useCallback } from "react";
import { getFileStats } from "@/actions/file-actions";
import { getRemoteFileStats } from "@/actions/ssh-actions";
import { toast } from "sonner";
import { FileStats, SSHConfig, FileCache } from "@/types";

// Define file size thresholds
const LARGE_FILE_SIZE = 500000; // 500KB
const BINARY_FILE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".ico",
  ".webp",
  ".mp4",
  ".webm",
  ".mov",
  ".avi",
  ".mp3",
  ".wav",
  ".ogg",
  ".pdf",
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".dat",
  ".db",
  ".sqlite",
  ".class",
];

// Check if a file is likely binary based on extension
function isBinaryFile(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();
  return BINARY_FILE_EXTENSIONS.some((ext) => lowerPath.endsWith(ext));
}

interface CachedFileStats {
  stats: FileStats | null;
  isLoading: boolean;
  addFile: (filePath: string) => void;
  removeFile: (filePath: string) => void;
  refreshStats: () => Promise<void>;
  loadSingleFile: (filePath: string) => Promise<void>;
}

export function useCachedFileStats(
  selectedFiles: string[],
  rootDir?: string | null,
  isRemote?: boolean,
  sshConfig?: SSHConfig | null
): CachedFileStats {
  const [stats, setStats] = useState<FileStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fileCache, setFileCache] = useState<FileCache>({});
  const [lastSelectedFiles, setLastSelectedFiles] = useState<string[]>([]);
  const [lastError, setLastError] = useState<Error | null>(null);

  // Calculate stats from cache
  const calculateStatsFromCache = useCallback(() => {
    if (Object.keys(fileCache).length === 0 || selectedFiles.length === 0) {
      setStats(null);
      return;
    }

    let totalLines = 0;
    let totalCharacters = 0;
    let totalTokens = 0;
    const fileStats: Array<{ path: string; characters: number }> = [];

    // Only process files that are in the selectedFiles array
    for (const filePath of selectedFiles) {
      const cachedFile = fileCache[filePath];
      if (cachedFile) {
        totalLines += cachedFile.lines;
        totalCharacters += cachedFile.characters;
        totalTokens += cachedFile.tokens;

        fileStats.push({
          path: filePath,
          characters: cachedFile.characters,
        });

        // Show warning for large files
        if (cachedFile.characters > LARGE_FILE_SIZE) {
          toast.warning(
            `Large file detected: ${filePath} (${Math.round(
              cachedFile.characters / 1024
            )}KB)`,
            {
              description: "Consider removing this file or optimizing it",
              duration: 5000,
              id: `large-file-${filePath}`, // Prevent duplicate toasts
            }
          );
        }
      }
    }

    setStats({
      lines: totalLines,
      characters: totalCharacters,
      tokens: totalTokens,
      files: fileStats.length,
      fileStats: fileStats.sort((a, b) => b.characters - a.characters),
    });
  }, [fileCache, selectedFiles]);

  // Filter out binary files from the list
  const filterBinaryFiles = useCallback((files: string[]): string[] => {
    const filteredFiles = files.filter((file) => !isBinaryFile(file));

    // Notify about skipped binary files if any were filtered out
    const skippedCount = files.length - filteredFiles.length;
    if (skippedCount > 0) {
      toast.info(
        `Skipped ${skippedCount} binary file${skippedCount > 1 ? "s" : ""}`,
        {
          description: "Binary files like images and videos are not processed",
          duration: 3000,
        }
      );
    }

    return filteredFiles;
  }, []);

  // Load stats for all files
  const loadAllStats = useCallback(async () => {
    if (selectedFiles.length === 0) {
      setStats(null);
      return;
    }

    setIsLoading(true);
    setLastError(null);

    try {
      // Filter out binary files
      const filteredFiles = filterBinaryFiles(selectedFiles);

      // Determine which files need to be loaded (not in cache)
      const filesToLoad = filteredFiles.filter((file) => !fileCache[file]);

      if (filesToLoad.length === 0) {
        // All files are in cache, just recalculate
        calculateStatsFromCache();
        setIsLoading(false);
        return;
      }

      let result;
      if (isRemote && sshConfig) {
        result = await getRemoteFileStats(
          sshConfig,
          filesToLoad,
          sshConfig.identityFile,
          rootDir
        );
      } else {
        result = await getFileStats(filesToLoad, rootDir);
      }

      if (result.isSuccess) {
        // Update cache with new files
        const newCache = { ...fileCache };

        for (let i = 0; i < filesToLoad.length; i++) {
          const filePath = filesToLoad[i];
          const fileInfo = result.data.fileStats.find(
            (f) => f.path === filePath
          );

          if (fileInfo) {
            // Estimate lines and tokens based on characters
            // This is an approximation - in a real implementation, you'd want to get exact values
            const characters = fileInfo.characters;
            const estimatedLines = Math.ceil(characters / 80); // Rough estimate
            const estimatedTokens = Math.ceil(characters / 4); // Rough estimate

            newCache[filePath] = {
              characters,
              lines: estimatedLines,
              tokens: estimatedTokens,
            };
          }
        }

        setFileCache(newCache);
        setLastSelectedFiles(selectedFiles);

        // Recalculate stats with the updated cache
        calculateStatsFromCache();
      } else {
        // Propagate the error message
        const errorMessage = result.message || "Failed to load file stats";
        const error = new Error(errorMessage);
        setLastError(error);
        throw error;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const formattedError = new Error(errorMessage);
      setLastError(formattedError);
      throw formattedError;
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedFiles,
    rootDir,
    isRemote,
    sshConfig,
    fileCache,
    calculateStatsFromCache,
    filterBinaryFiles,
  ]);

  // Effect to load stats when selectedFiles changes
  useEffect(() => {
    // Check if we just need to recalculate from cache
    const allFilesInCache = selectedFiles.every((file) => fileCache[file]);
    const filesChanged =
      selectedFiles.length !== lastSelectedFiles.length ||
      selectedFiles.some((file) => !lastSelectedFiles.includes(file)) ||
      lastSelectedFiles.some((file) => !selectedFiles.includes(file));

    if (filesChanged) {
      if (allFilesInCache) {
        // All files are in cache, just recalculate
        calculateStatsFromCache();
      } else {
        // Need to load some new files
        loadAllStats().catch((error) => {
          // Error is already set in state by loadAllStats
          console.error("Error loading stats:", error);
        });
      }
    }
  }, [
    selectedFiles,
    lastSelectedFiles,
    fileCache,
    calculateStatsFromCache,
    loadAllStats,
  ]);

  // Load a single file's stats
  const loadSingleFile = useCallback(
    async (filePath: string) => {
      // Skip binary files
      if (isBinaryFile(filePath)) {
        toast.info(`Skipped binary file: ${filePath}`, {
          description: "Binary files like images and videos are not processed",
          duration: 3000,
        });
        return;
      }

      if (fileCache[filePath]) {
        // File is already in cache
        return;
      }

      setIsLoading(true);
      setLastError(null);

      try {
        let result;
        if (isRemote && sshConfig) {
          result = await getRemoteFileStats(
            sshConfig,
            [filePath],
            sshConfig.identityFile,
            rootDir
          );
        } else {
          result = await getFileStats([filePath], rootDir);
        }

        if (result.isSuccess) {
          // Update cache with the new file
          const newCache = { ...fileCache };
          const fileInfo = result.data.fileStats.find(
            (f) => f.path === filePath
          );

          if (fileInfo) {
            // Estimate lines and tokens based on characters
            const characters = fileInfo.characters;
            const estimatedLines = Math.ceil(characters / 80); // Rough estimate
            const estimatedTokens = Math.ceil(characters / 4); // Rough estimate

            newCache[filePath] = {
              characters,
              lines: estimatedLines,
              tokens: estimatedTokens,
            };

            setFileCache(newCache);

            // Show warning for large files
            if (characters > LARGE_FILE_SIZE) {
              toast.warning(
                `Large file detected: ${filePath} (${Math.round(
                  characters / 1024
                )}KB)`,
                {
                  description: "Consider removing this file or optimizing it",
                  duration: 5000,
                  id: `large-file-${filePath}`, // Prevent duplicate toasts
                }
              );
            }

            // Recalculate stats if this file is in the selected files
            if (selectedFiles.includes(filePath)) {
              calculateStatsFromCache();
            }
          }
        } else {
          // Propagate the error message
          const errorMessage =
            result.message || `Failed to load stats for ${filePath}`;
          const error = new Error(errorMessage);
          setLastError(error);
          throw error;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const formattedError = new Error(errorMessage);
        setLastError(formattedError);
        throw formattedError;
      } finally {
        setIsLoading(false);
      }
    },
    [
      isRemote,
      sshConfig,
      rootDir,
      fileCache,
      selectedFiles,
      calculateStatsFromCache,
    ]
  );

  // Add a single file to the stats
  const addFile = useCallback(
    (filePath: string) => {
      // Skip binary files
      if (isBinaryFile(filePath)) {
        return;
      }

      if (!fileCache[filePath]) {
        // Load the file stats if not in cache
        loadSingleFile(filePath).catch((error) => {
          // Error is already set in state by loadSingleFile
          console.error(`Error loading stats for ${filePath}:`, error);
        });
      }
    },
    [fileCache, loadSingleFile]
  );

  // Remove a single file from the stats
  const removeFile = useCallback((filePath: string) => {
    // This is handled by the parent component updating the selectedFiles array
    // The effect will recalculate stats from cache
  }, []);

  // Force refresh all stats
  const refreshStats = useCallback(async () => {
    // Clear cache and reload all stats
    setFileCache({});
    return loadAllStats();
  }, [loadAllStats]);

  return {
    stats,
    isLoading,
    addFile,
    removeFile,
    refreshStats,
    loadSingleFile,
  };
}
