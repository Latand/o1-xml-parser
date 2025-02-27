"use client";

import { useState } from "react";
import { downloadSelectedFiles } from "@/actions/file-actions";
import { DirectoryBrowser } from "./_components/directory-browser";
import { RemoteDirectoryBrowser } from "./_components/remote-directory-browser";
import { FileStats } from "./_components/file-stats";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  passphrase?: string;
  identityFile?: string;
}

export default function BrowserPage() {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [rootDir, setRootDir] = useState<string | null>(null);
  const [taskPrompt, setTaskPrompt] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"local" | "remote">("local");
  const [sshConfig, setSSHConfig] = useState<SSHConfig | null>(null);

  const handleCopy = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select files to copy");
      return;
    }

    const result = await downloadSelectedFiles(selectedFiles, rootDir);

    if (result.isSuccess) {
      try {
        const content =
          result.data.content +
          (taskPrompt ? `\n\n## Tasks\n${taskPrompt}` : "");
        await navigator.clipboard.writeText(content);
        toast.success("Files copied to clipboard");
      } catch (error) {
        toast.error("Failed to copy to clipboard");
      }
    } else {
      toast.error(result.message);
    }
  };

  const handleDownload = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select files to download");
      return;
    }

    const result = await downloadSelectedFiles(selectedFiles, rootDir);

    if (result.isSuccess) {
      const content =
        result.data.content + (taskPrompt ? `\n\n## Tasks\n${taskPrompt}` : "");
      // Download file
      const blob = new Blob([content], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(content);
        toast.success("Files downloaded and copied to clipboard");
      } catch (error) {
        toast.success("Files downloaded");
        toast.error("Failed to copy to clipboard");
      }
    } else {
      toast.error(result.message);
    }
  };

  const handleRemoveFile = (file: string) => {
    setSelectedFiles(selectedFiles.filter((f) => f !== file));
  };

  const handleSelectedFilesChange = (
    files: string[],
    newRootDir?: string | null
  ) => {
    // Skip unnecessary updates
    if (
      files.length === selectedFiles.length &&
      files.every((f) => selectedFiles.includes(f)) &&
      newRootDir === rootDir
    ) {
      return;
    }

    setSelectedFiles(files);

    if (newRootDir !== undefined) {
      setRootDir(newRootDir);

      // Don't update identityFile when root dir changes
      // The identityFile should only be set during connection
    }
  };

  const handleSSHConfigChange = (config: SSHConfig | null) => {
    setSSHConfig(config);

    // Reset selection when connection changes
    if (config === null) {
      setSelectedFiles([]);
      setRootDir(null);
    }
  };

  const handleTabChange = (value: string) => {
    if (value === activeTab) return;

    setActiveTab(value as "local" | "remote");
    setSelectedFiles([]);
    setRootDir(null);
    setSSHConfig(null);
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">File Browser</h1>
        <div className="space-x-2">
          <Button
            variant="outline"
            onClick={() => {
              setSelectedFiles([]);
              setTaskPrompt("");
            }}
            disabled={selectedFiles.length === 0}
          >
            Clear Selection
          </Button>
          <Button
            variant="outline"
            onClick={handleCopy}
            disabled={selectedFiles.length === 0}
          >
            Copy Selected
          </Button>
          <Button
            onClick={handleDownload}
            disabled={selectedFiles.length === 0}
          >
            Download Selected
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="mb-4">
              <TabsTrigger value="local">Local Files</TabsTrigger>
              <TabsTrigger value="remote">Remote Files</TabsTrigger>
            </TabsList>
            <TabsContent value="local">
              <DirectoryBrowser
                selectedFiles={selectedFiles}
                onSelectedFilesChange={handleSelectedFilesChange}
              />
            </TabsContent>
            <TabsContent value="remote">
              <RemoteDirectoryBrowser
                selectedFiles={selectedFiles}
                onSelectedFilesChange={handleSelectedFilesChange}
                onSSHConfigChange={handleSSHConfigChange}
              />
            </TabsContent>
          </Tabs>
        </div>
        <div className="w-80">
          <FileStats
            selectedFiles={selectedFiles}
            onRemoveFile={handleRemoveFile}
            rootDir={rootDir}
            isRemote={activeTab === "remote"}
            sshConfig={sshConfig}
          />
        </div>
      </div>

      <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/50">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Task Description</div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTaskPrompt("")}
            disabled={!taskPrompt}
          >
            Clear Task
          </Button>
        </div>
        <Textarea
          value={taskPrompt}
          onChange={(e) => setTaskPrompt(e.target.value)}
          placeholder="Describe the task you want to perform with these files..."
          className="min-h-[150px] resize-y bg-background"
        />
      </div>
    </div>
  );
}
