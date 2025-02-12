"use client";

import { useEffect, useState } from "react";
import { readRemoteDirectory } from "@/actions/ssh-actions";
import {
  parseSSHConfig,
  checkKeyNeedsPassphrase,
} from "@/actions/ssh-config-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FolderOpen, File, ChevronRight, Server, Home } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import path from "path";

interface RemoteDirectoryBrowserProps {
  selectedFiles: string[];
  onSelectedFilesChange: (files: string[], rootDir?: string | null) => void;
}

interface SSHConnectionForm {
  host: string;
  port: string;
  username: string;
  password: string;
  passphrase: string;
}

interface SSHConfigHost {
  name: string;
  hostname?: string;
  user?: string;
  port?: string;
  identityFile?: string;
}

export function RemoteDirectoryBrowser({
  selectedFiles,
  onSelectedFilesChange,
}: RemoteDirectoryBrowserProps) {
  const [currentPath, setCurrentPath] = useState("/");
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<
    Array<{
      name: string;
      path: string;
      isDirectory: boolean;
      size: number;
      modifyTime: Date;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [configHosts, setConfigHosts] = useState<SSHConfigHost[]>([]);
  const [selectedHost, setSelectedHost] = useState<string>("");
  const [needsPassphrase, setNeedsPassphrase] = useState(false);
  const [loadingFolder, setLoadingFolder] = useState<string | null>(null);
  const [connectionForm, setConnectionForm] = useState<SSHConnectionForm>({
    host: "",
    port: "22",
    username: "",
    password: "",
    passphrase: "",
  });

  useEffect(() => {
    loadSSHConfig();
  }, []);

  const loadSSHConfig = async () => {
    const result = await parseSSHConfig();
    if (result.isSuccess) {
      setConfigHosts(result.data);
    } else {
      toast.error("Failed to load SSH config");
    }
  };

  const handleHostSelect = async (hostName: string) => {
    const host = configHosts.find((h) => h.name === hostName);
    if (!host) return;

    setSelectedHost(hostName);
    setConnectionForm({
      host: host.hostname || host.name,
      port: host.port || "22",
      username: host.user || "",
      password: "",
      passphrase: "",
    });

    if (host.identityFile) {
      const result = await checkKeyNeedsPassphrase(host.identityFile);
      if (result.isSuccess) {
        setNeedsPassphrase(result.data);
      }
    } else {
      setNeedsPassphrase(false);
    }
  };

  const getRelativePath = (fullPath: string) => {
    if (!rootPath) return fullPath;
    return path.posix.relative(rootPath, fullPath);
  };

  const handleFolderSelect = async (dirPath: string) => {
    setLoadingFolder(dirPath);
    try {
      const host = configHosts.find((h) => h.name === selectedHost);
      const result = await readRemoteDirectory(
        {
          host: connectionForm.host,
          port: parseInt(connectionForm.port),
          username: connectionForm.username,
          password: connectionForm.password || undefined,
          passphrase: connectionForm.passphrase || undefined,
        },
        dirPath,
        host?.identityFile
      );

      if (result.isSuccess) {
        const folderFiles = result.data
          .filter((entry) => !entry.isDirectory)
          .map((entry) => entry.path);
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
    onSelectedFilesChange([], dirPath);
    toast.success("Root directory set");
  };

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const host = configHosts.find((h) => h.name === selectedHost);
      const result = await readRemoteDirectory(
        {
          host: connectionForm.host,
          port: parseInt(connectionForm.port),
          username: connectionForm.username,
          password: connectionForm.password || undefined,
          passphrase: connectionForm.passphrase || undefined,
        },
        "/",
        host?.identityFile
      );

      if (result.isSuccess) {
        setEntries(result.data);
        setIsConnected(true);
        toast.success("Connected to remote server");
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to connect to remote server");
    } finally {
      setIsLoading(false);
    }
  };

  const loadDirectory = async (dirPath: string) => {
    setIsLoading(true);
    try {
      const host = configHosts.find((h) => h.name === selectedHost);
      const result = await readRemoteDirectory(
        {
          host: connectionForm.host,
          port: parseInt(connectionForm.port),
          username: connectionForm.username,
          password: connectionForm.password || undefined,
          passphrase: connectionForm.passphrase || undefined,
        },
        dirPath,
        host?.identityFile
      );

      if (result.isSuccess) {
        setEntries(result.data);
        setCurrentPath(dirPath);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to read directory");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigateUp = () => {
    const parentPath = currentPath.split("/").slice(0, -1).join("/") || "/";
    loadDirectory(parentPath);
  };

  if (!isConnected) {
    return (
      <div className="border border-gray-800 rounded-lg p-4 space-y-4">
        {configHosts.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Saved Connections</label>
            <Select value={selectedHost} onValueChange={handleHostSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select a saved connection" />
              </SelectTrigger>
              <SelectContent>
                {configHosts.map((host) => (
                  <SelectItem key={host.name} value={host.name}>
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4" />
                      <span>{host.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Input
            placeholder="Host"
            value={connectionForm.host}
            onChange={(e) =>
              setConnectionForm({ ...connectionForm, host: e.target.value })
            }
          />
          <Input
            placeholder="Port"
            value={connectionForm.port}
            onChange={(e) =>
              setConnectionForm({ ...connectionForm, port: e.target.value })
            }
          />
          <Input
            placeholder="Username"
            value={connectionForm.username}
            onChange={(e) =>
              setConnectionForm({ ...connectionForm, username: e.target.value })
            }
          />
          {(!selectedHost ||
            !configHosts.find((h) => h.name === selectedHost)
              ?.identityFile) && (
            <Input
              type="password"
              placeholder="Password"
              value={connectionForm.password}
              onChange={(e) =>
                setConnectionForm({
                  ...connectionForm,
                  password: e.target.value,
                })
              }
            />
          )}
          {needsPassphrase && (
            <Input
              type="password"
              placeholder="Key Passphrase"
              value={connectionForm.passphrase}
              onChange={(e) =>
                setConnectionForm({
                  ...connectionForm,
                  passphrase: e.target.value,
                })
              }
            />
          )}
        </div>
        <Button onClick={handleConnect} disabled={isLoading} className="w-full">
          {isLoading ? "Connecting..." : "Connect"}
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsConnected(false);
              setEntries([]);
              setCurrentPath("/");
              onSelectedFilesChange([]);
            }}
          >
            Disconnect
          </Button>
        </div>
      </div>

      <div className="divide-y divide-gray-800">
        {entries
          .sort((a, b) => {
            if (a.isDirectory === b.isDirectory) {
              return a.name.localeCompare(b.name);
            }
            return a.isDirectory ? -1 : 1;
          })
          .map((entry) => (
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
                onClick={() => entry.isDirectory && loadDirectory(entry.path)}
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
                    onClick={() => loadDirectory(entry.path)}
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
