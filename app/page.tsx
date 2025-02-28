"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { downloadSelectedFiles, getSimilarPaths } from "@/actions/file-actions";
import { DirectoryBrowser } from "./browser/_components/directory-browser";
import { RemoteDirectoryBrowser } from "./browser/_components/remote-directory-browser";
import { FileStats } from "./browser/_components/file-stats";
import { ApplyChangesForm } from "./apply/_components/apply-changes-form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  passphrase?: string;
  identityFile?: string;
}

export default function HomePage() {
  // Browser tab state
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [rootDir, setRootDir] = useState<string | null>(null);
  const [taskPrompt, setTaskPrompt] = useState<string>("");
  const [browserTab, setBrowserTab] = useState<"local" | "remote">("local");
  const [sshConfig, setSSHConfig] = useState<SSHConfig | null>(null);

  // Apply tab state
  const [projectDirectory, setProjectDirectory] = useState<string>("");

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
      try {
        const content =
          result.data.content +
          (taskPrompt ? `\n\n## Tasks\n${taskPrompt}` : "");
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "combined_files.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Files downloaded successfully");
      } catch (error) {
        toast.error("Failed to download files");
      }
    } else {
      toast.error(result.message);
    }
  };

  const handleRemoveFile = (file: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f !== file));
  };

  const handleSelectedFilesChange = (
    files: string[],
    newRootDir?: string | null
  ) => {
    setSelectedFiles(files);
    if (newRootDir !== undefined) {
      setRootDir(newRootDir);
    }
  };

  const handleSSHConfigChange = (config: SSHConfig | null) => {
    setSSHConfig(config);
  };

  const handleBrowserTabChange = (value: string) => {
    setBrowserTab(value as "local" | "remote");
  };

  const handlePathChange = async (value: string) => {
    setProjectDirectory(value);

    // You can add additional logic here if needed, similar to the original ApplyPage
    if (value.trim()) {
      const result = await getSimilarPaths(value);
      if (result.isSuccess) {
        // Handle suggestions if needed
      }
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.3,
        when: "beforeChildren",
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.3 },
    },
  };

  return (
    <motion.div
      className="container mx-auto py-6 px-4"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.div
        className="flex justify-between items-center mb-6"
        variants={itemVariants}
      >
        <h1 className="text-3xl font-bold text-gray-100">O1 XML Parser</h1>
        <div className="text-sm text-gray-400">
          Secure connection management enabled
        </div>
      </motion.div>

      <Tabs defaultValue="browser" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="browser">File Browser</TabsTrigger>
          <TabsTrigger value="apply">Apply Changes</TabsTrigger>
        </TabsList>

        <TabsContent value="browser" className="space-y-6">
          <motion.div variants={itemVariants} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Tabs
                  value={browserTab}
                  onValueChange={handleBrowserTabChange}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="local">Local Files</TabsTrigger>
                    <TabsTrigger value="remote">Remote Files</TabsTrigger>
                  </TabsList>

                  <TabsContent value="local" className="pt-4">
                    <DirectoryBrowser
                      selectedFiles={selectedFiles}
                      onSelectedFilesChange={handleSelectedFilesChange}
                    />
                  </TabsContent>

                  <TabsContent value="remote" className="pt-4">
                    <RemoteDirectoryBrowser
                      selectedFiles={selectedFiles}
                      onSelectedFilesChange={handleSelectedFilesChange}
                      onSSHConfigChange={handleSSHConfigChange}
                    />
                  </TabsContent>
                </Tabs>
              </div>

              <div className="space-y-4">
                <div className="p-4 border border-gray-800 rounded-lg bg-gray-900/50">
                  <h2 className="text-xl font-semibold mb-3 text-gray-100">
                    Selected Files
                  </h2>
                  <FileStats
                    selectedFiles={selectedFiles}
                    rootDir={rootDir}
                    onRemoveFile={handleRemoveFile}
                  />
                </div>

                <div className="p-4 border border-gray-800 rounded-lg bg-gray-900/50">
                  <h2 className="text-xl font-semibold mb-3 text-gray-100">
                    Task Description (Optional)
                  </h2>
                  <Textarea
                    placeholder="Describe the task you want to accomplish with these files..."
                    className="min-h-[100px]"
                    value={taskPrompt}
                    onChange={(e) => setTaskPrompt(e.target.value)}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleCopy}
                    className="flex-1"
                    disabled={selectedFiles.length === 0}
                  >
                    Copy to Clipboard
                  </Button>
                  <Button
                    onClick={handleDownload}
                    variant="outline"
                    className="flex-1"
                    disabled={selectedFiles.length === 0}
                  >
                    Download as Text
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="apply" className="space-y-6">
          <motion.div variants={itemVariants}>
            <ApplyChangesForm projectDirectory={projectDirectory} />
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
