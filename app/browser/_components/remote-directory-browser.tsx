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
import {
  FolderOpen,
  File,
  ChevronRight,
  Server,
  Home,
  Star,
  StarOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import path from "path";
import { DirectorySkeleton } from "./directory-skeleton";
import {
  getFavoriteServers,
  getRecentFavoriteServers,
  addFavoriteServer,
  removeFavoriteServer,
  isFavoriteServer,
  updateServerLastUsed,
  renameFavoriteServer,
  FavoriteServer,
} from "@/lib/favorites";

interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  passphrase?: string;
  identityFile?: string;
}

interface RemoteDirectoryBrowserProps {
  selectedFiles: string[];
  onSelectedFilesChange: (files: string[], rootDir?: string | null) => void;
  onSSHConfigChange?: (config: SSHConfig | null) => void;
}

interface SSHConnectionForm {
  host: string;
  port: string;
  username: string;
  password: string;
  passphrase: string;
  connectionName?: string;
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
  onSSHConfigChange,
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
    connectionName: "",
  });
  const [favoriteServers, setFavoriteServers] = useState<FavoriteServer[]>([]);
  const [editingServer, setEditingServer] = useState<string | null>(null);
  const [newServerName, setNewServerName] = useState<string>("");

  useEffect(() => {
    loadSSHConfig();
    setFavoriteServers(getRecentFavoriteServers());
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
      connectionName: "",
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
      const config = {
        host: connectionForm.host,
        port: parseInt(connectionForm.port),
        username: connectionForm.username,
        password: connectionForm.password || undefined,
        passphrase: connectionForm.passphrase || undefined,
      };

      // Limit the display of the loading indicator to at least 300ms
      // to avoid flickering for fast operations
      const minLoadingTime = 300;
      const startTime = Date.now();

      const result = await readRemoteDirectory(
        config,
        dirPath,
        host?.identityFile,
        true, // recursive
        rootPath // Pass the rootPath parameter
      );

      if (result.isSuccess) {
        const folderFiles = result.data.map((entry) => entry.path);
        const relativeFiles = folderFiles.map(getRelativePath);
        const allSelected = relativeFiles.every((file) =>
          selectedFiles.includes(file)
        );

        // Ensure loading indicator shows for at least minLoadingTime
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime < minLoadingTime) {
          await new Promise((resolve) =>
            setTimeout(resolve, minLoadingTime - elapsedTime)
          );
        }

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
        selectedFiles.filter((f: string) => f !== relativePath),
        rootPath
      );
    } else {
      onSelectedFilesChange([...selectedFiles, relativePath], rootPath);
    }
  };

  const handleSetRoot = (dirPath: string) => {
    // When setting the root directory, we just need to update the rootPath
    // and clear the selected files. We should NOT update the SSH identity file.
    setRootPath(dirPath);

    // Pass the new root directory but don't modify SSH config
    onSelectedFilesChange([], dirPath);

    toast.success("Root directory set");
  };

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const host = configHosts.find((h) => h.name === selectedHost);

      // Create the config without identityFile here (will be handled by the server action)
      const config = {
        host: connectionForm.host,
        port: parseInt(connectionForm.port),
        username: connectionForm.username,
        password: connectionForm.password || undefined,
        passphrase: connectionForm.passphrase || undefined,
        identityFile: host?.identityFile, // Pass the identity file path, not the root directory
      };

      const initialPath = `/home/${connectionForm.username}`;
      // Try the home directory first
      const result = await readRemoteDirectory(
        config,
        initialPath,
        host?.identityFile,
        false, // not recursive
        rootPath // Pass the rootPath parameter
      );

      if (result.isSuccess) {
        setEntries(result.data);
        setCurrentPath(initialPath);
        setIsConnected(true);
        onSSHConfigChange?.(config);
        toast.success("Connected to remote server");

        // If connecting to a favorite server, update its last used timestamp
        const isFavorite = favoriteServers.some(
          (s) =>
            s.host === connectionForm.host &&
            s.username === connectionForm.username
        );

        if (isFavorite) {
          const serverName = favoriteServers.find(
            (s) =>
              s.host === connectionForm.host &&
              s.username === connectionForm.username
          )?.name;

          if (serverName) {
            updateServerLastUsed(serverName);
            setFavoriteServers(getRecentFavoriteServers());
          }
        }
      } else {
        // Check if the error is related to the home directory not existing or permission issues
        if (
          result.message.includes("no such file") ||
          result.message.includes("permission denied")
        ) {
          // Try fallback to root if home directory doesn't exist
          const rootResult = await readRemoteDirectory(
            config,
            "/",
            host?.identityFile,
            false, // not recursive
            rootPath // Pass the rootPath parameter
          );

          if (rootResult.isSuccess) {
            setEntries(rootResult.data);
            setCurrentPath("/");
            setIsConnected(true);
            onSSHConfigChange?.(config);
            toast.success(
              "Connected to remote server (fallback to root directory)"
            );
          } else {
            toast.error(rootResult.message);
          }
        } else if (result.message.includes("identity file")) {
          // If the error is related to the identity file, show a more specific message
          toast.error(
            "Invalid identity file. Please check your SSH configuration."
          );
        } else {
          toast.error(result.message);
        }
      }
    } catch (error) {
      toast.error("Failed to connect to remote server");
    } finally {
      setIsLoading(false);
    }
  };

  const loadDirectory = async (dirPath: string) => {
    setIsLoading(true);

    // Ensure we show loading state for at least 300ms to avoid flickering
    const minLoadingTime = 300;
    const startTime = Date.now();

    try {
      const host = configHosts.find((h) => h.name === selectedHost);
      const config = {
        host: connectionForm.host,
        port: parseInt(connectionForm.port),
        username: connectionForm.username,
        password: connectionForm.password || undefined,
        passphrase: connectionForm.passphrase || undefined,
      };

      const result = await readRemoteDirectory(
        config,
        dirPath,
        host?.identityFile,
        false, // not recursive
        rootPath // Pass the rootPath parameter
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
      // Ensure loading indicator shows for at least minLoadingTime
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < minLoadingTime) {
        await new Promise((resolve) =>
          setTimeout(resolve, minLoadingTime - elapsedTime)
        );
      }
      setIsLoading(false);
    }
  };

  const handleNavigateUp = () => {
    const parentPath = currentPath.split("/").slice(0, -1).join("/") || "/";
    loadDirectory(parentPath);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setEntries([]);
    setCurrentPath("/");
    onSelectedFilesChange([]);
    onSSHConfigChange?.(null);
  };

  const handleAddToFavorites = () => {
    const serverName =
      connectionForm.connectionName ||
      `${connectionForm.username}@${connectionForm.host}`;

    addFavoriteServer({
      name: serverName,
      host: connectionForm.host,
      port: connectionForm.port,
      username: connectionForm.username,
      password: connectionForm.password || undefined,
      identityFile: configHosts.find((h) => h.name === selectedHost)
        ?.identityFile,
    });
    setFavoriteServers(getRecentFavoriteServers());
    toast.success("Connection saved");

    setConnectionForm({
      ...connectionForm,
      connectionName: "",
    });
  };

  const handleRemoveFromFavorites = (name: string) => {
    removeFavoriteServer(name);
    setFavoriteServers(getRecentFavoriteServers());
    toast.success("Removed from favorites");
  };

  const handleFavoriteSelect = (server: FavoriteServer) => {
    // Update last used timestamp
    updateServerLastUsed(server.name);
    setFavoriteServers(getRecentFavoriteServers());

    // Find matching SSH config if exists
    const matchingHost = configHosts.find(
      (h) => h.hostname === server.host || h.name === server.host
    );

    if (matchingHost) {
      setSelectedHost(matchingHost.name);
      setConnectionForm({
        host: server.host,
        port: server.port,
        username: server.username,
        password: server.password || "",
        passphrase: "",
        connectionName: "",
      });

      // Check if key needs passphrase
      if (matchingHost.identityFile) {
        checkKeyNeedsPassphrase(matchingHost.identityFile).then((result) => {
          if (result.isSuccess) {
            setNeedsPassphrase(result.data);
          }
        });
      }
    } else {
      setSelectedHost("");
      setConnectionForm({
        host: server.host,
        port: server.port,
        username: server.username,
        password: server.password || "",
        passphrase: "",
        connectionName: "",
      });
      setNeedsPassphrase(false);
    }
  };

  const handleEditServerName = (server: FavoriteServer) => {
    setEditingServer(server.name);
    setNewServerName(server.name);
  };

  const handleSaveServerName = () => {
    if (editingServer && newServerName.trim()) {
      const success = renameFavoriteServer(editingServer, newServerName.trim());
      if (success) {
        toast.success("Connection renamed");
        setFavoriteServers(getRecentFavoriteServers());
      } else {
        toast.error("A connection with this name already exists");
      }
    }
    setEditingServer(null);
  };

  const handleCancelEdit = () => {
    setEditingServer(null);
  };

  const handleSelectAll = () => {
    const allFiles = entries
      .filter((entry) => !entry.isDirectory)
      .map((entry) => getRelativePath(entry.path));
    onSelectedFilesChange([...selectedFiles, ...allFiles], rootPath);
  };

  const handleSelectNone = () => {
    onSelectedFilesChange([], rootPath);
  };

  const handleFileClick = (entry: {
    name: string;
    path: string;
    isDirectory: boolean;
  }) => {
    if (entry.isDirectory) {
      loadDirectory(entry.path);
    } else {
      handleFileSelect(entry.path);
    }
  };

  if (!isConnected) {
    return (
      <div className="border border-gray-800 rounded-lg p-4 space-y-4">
        {favoriteServers.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Saved Connections</label>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {favoriteServers.map((server) => (
                <div
                  key={server.name}
                  className="flex items-center gap-2 p-2 border border-gray-800 rounded-lg hover:bg-gray-900/50"
                >
                  {editingServer === server.name ? (
                    <>
                      <Input
                        value={newServerName}
                        onChange={(e) => setNewServerName(e.target.value)}
                        className="flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveServerName();
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSaveServerName}
                      >
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFavoriteSelect(server)}
                        className="flex-1 justify-start"
                      >
                        <Server className="w-4 h-4 mr-2" />
                        {server.name}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditServerName(server)}
                        title="Rename connection"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-4 h-4"
                        >
                          <path d="M12 20h9"></path>
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveFromFavorites(server.name)}
                        title="Remove connection"
                      >
                        <StarOff className="w-4 h-4 text-yellow-500" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
          <label className="text-sm text-gray-400">Connection Details</label>
          <Input
            placeholder="Connection Name (optional)"
            value={connectionForm.connectionName || ""}
            onChange={(e) =>
              setConnectionForm({
                ...connectionForm,
                connectionName: e.target.value,
              })
            }
          />
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
        <div className="flex justify-between">
          <Button
            onClick={handleConnect}
            disabled={
              !connectionForm.host ||
              !connectionForm.username ||
              (!connectionForm.password &&
                !configHosts.find((h) => h.name === selectedHost)?.identityFile)
            }
          >
            Connect
          </Button>

          <Button
            variant="outline"
            onClick={handleAddToFavorites}
            disabled={
              !connectionForm.host ||
              !connectionForm.username ||
              (!connectionForm.password &&
                !configHosts.find((h) => h.name === selectedHost)?.identityFile)
            }
          >
            Save Connection
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="border border-gray-800 rounded-lg overflow-hidden">
        <div className="bg-gray-900 p-4 border-b border-gray-800 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-12 h-8 bg-gray-700/20 rounded animate-pulse" />
            <div className="flex-1 h-4 bg-gray-700/20 rounded animate-pulse" />
            <div className="w-24 h-8 bg-gray-700/20 rounded animate-pulse" />
          </div>
        </div>
        <DirectorySkeleton />
      </div>
    );
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
          <Button variant="outline" size="sm" onClick={handleDisconnect}>
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
                <FolderOpen
                  className="w-4 h-4 text-blue-400 shrink-0"
                  onClick={() => loadDirectory(entry.path)}
                  style={{ cursor: "pointer" }}
                />
              ) : (
                <File className="w-4 h-4 text-gray-400 shrink-0" />
              )}
              <button
                onClick={() => entry.isDirectory && loadDirectory(entry.path)}
                className="text-sm flex-1 truncate text-left hover:text-blue-400 transition-colors"
                disabled={loadingFolder === entry.path}
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
