"use client";

import { useEffect, useState } from "react";
import { readDirectory, getAllFilesInDirectory } from "@/actions/file-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FolderOpen, File, ChevronRight, Home } from "lucide-react";
import { toast } from "sonner";
import path from "path";

interface DirectoryBrowserProps {
  selectedFiles: string[];
  onSelectedFilesChange: (files: string[], rootDir?: string | null) => void;
}

export function DirectoryBrowser({
  selectedFiles,
  onSelectedFilesChange,
}: DirectoryBrowserProps) {
  const [currentPath, setCurrentPath] = useState(process.env.HOME || "/home");
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [skipPatterns, setSkipPatterns] = useState<string>("");
  const [entries, setEntries] = useState<
    Array<{ name: string; path: string; isDirectory: boolean }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingFolder, setLoadingFolder] = useState<string | null>(null);

  const getSkipPatterns = () =>
    skipPatterns
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, skipPatterns]);

  const loadDirectory = async (dirPath: string) => {
    setIsLoading(true);
    const result = await readDirectory(dirPath, getSkipPatterns());
    if (result.isSuccess) {
      setEntries(result.data);
    }
    setIsLoading(false);
  };

  const getRelativePath = (fullPath: string) => {
    if (!rootPath) return fullPath;
    return path.relative(rootPath, fullPath);
  };

  const handleFolderSelect = async (dirPath: string) => {
    setLoadingFolder(dirPath);
    try {
      const result = await getAllFilesInDirectory(dirPath, getSkipPatterns());
      if (result.isSuccess) {
        const folderFiles = result.data;
        const relativeFiles = folderFiles.map(getRelativePath);
        const allSelected = relativeFiles.every((file) =>
          selectedFiles.includes(file)
        );

        if (allSelected) {
          onSelectedFilesChange(
            selectedFiles.filter((file) => !relativeFiles.includes(file)),
            rootPath
          );
        } else {
          const newSelection = Array.from(
            new Set([...selectedFiles, ...relativeFiles])
          );
          onSelectedFilesChange(newSelection, rootPath);
        }
      } else {
        toast.error("Failed to load folder contents");
      }
    } catch (error) {
      toast.error("Failed to select folder");
    } finally {
      setLoadingFolder(null);
    }
  };

  const handleFileSelect = (filePath: string) => {
    const relativePath = getRelativePath(filePath);
    if (selectedFiles.includes(relativePath)) {
      onSelectedFilesChange(
        selectedFiles.filter((f) => f !== relativePath),
        rootPath
      );
    } else {
      onSelectedFilesChange([...selectedFiles, relativePath], rootPath);
    }
  };

  const handleSetRoot = (dirPath: string) => {
    setRootPath(dirPath);
    // Clear selections when changing root
    onSelectedFilesChange([], dirPath);
    toast.success("Root directory set");
  };

  const handleNavigateUp = () => {
    const parentPath = currentPath.split("/").slice(0, -1).join("/");
    if (parentPath) {
      setCurrentPath(parentPath);
    }
  };

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden max-w-3xl">
      <div className="bg-gray-900 p-4 border-b border-gray-800 space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleNavigateUp}
            disabled={currentPath === "/"}
          >
            Up
          </Button>
          <div className="text-sm text-gray-400 truncate flex-1">
            {rootPath ? (
              <>
                <span className="text-blue-400">Root: {rootPath}</span>
                <br />
              </>
            ) : null}
            Current: {currentPath}
          </div>
          {rootPath && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRootPath(null);
                onSelectedFilesChange([], null);
              }}
            >
              Clear Root
            </Button>
          )}
        </div>

        <div className="flex gap-2 items-center">
          <div className="text-sm text-gray-400">Skip patterns:</div>
          <Input
            value={skipPatterns}
            onChange={(e) => setSkipPatterns(e.target.value)}
            placeholder="e.g. *.txt,*.md,temp/*"
            className="flex-1 h-8 text-sm"
          />
        </div>
      </div>

      <div className="divide-y divide-gray-800">
        {entries.map((entry) => (
          <div
            key={entry.path}
            className="flex items-center gap-2 p-2 hover:bg-gray-900/50 pr-4"
          >
            <Checkbox
              checked={
                entry.isDirectory
                  ? loadingFolder === entry.path
                    ? undefined
                    : selectedFiles.some((file) =>
                        file.startsWith(getRelativePath(entry.path) + "/")
                      )
                  : selectedFiles.includes(getRelativePath(entry.path))
              }
              onCheckedChange={() =>
                entry.isDirectory
                  ? handleFolderSelect(entry.path)
                  : handleFileSelect(entry.path)
              }
              disabled={loadingFolder === entry.path}
              className="ml-2"
            />
            {entry.isDirectory ? (
              <FolderOpen className="w-4 h-4 text-blue-400 shrink-0" />
            ) : (
              <File className="w-4 h-4 text-gray-400 shrink-0" />
            )}
            <button
              onClick={() => entry.isDirectory && setCurrentPath(entry.path)}
              className="text-sm flex-1 truncate text-left hover:text-blue-400 transition-colors"
            >
              {entry.name}
            </button>
            {entry.isDirectory && (
              <div className="flex gap-1 shrink-0">
                {!rootPath && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetRoot(entry.path)}
                  >
                    <Home className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPath(entry.path)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        ))}

        {entries.length === 0 && (
          <div className="p-4 text-sm text-gray-500 text-center">
            No files found in this directory
          </div>
        )}
      </div>
    </div>
  );
}
