"use client";

import { useState } from "react";
import { downloadSelectedFiles, getFileStats } from "@/actions/file-actions";
import { DirectoryBrowser } from "./_components/directory-browser";
import { FileStats } from "./_components/file-stats";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function BrowserPage() {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [rootDir, setRootDir] = useState<string | null>(null);

  const handleDownload = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select files to download");
      return;
    }

    const result = await downloadSelectedFiles(selectedFiles, rootDir);

    if (result.isSuccess) {
      // Download file
      const blob = new Blob([result.data.content], { type: "text/plain" });
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
        await navigator.clipboard.writeText(result.data.content);
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
    setSelectedFiles(files);
    setRootDir(newRootDir ?? null);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">File Browser</h1>
        <div className="space-x-2">
          <Button
            variant="outline"
            onClick={() => setSelectedFiles([])}
            disabled={selectedFiles.length === 0}
          >
            Clear Selection
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
          <DirectoryBrowser
            selectedFiles={selectedFiles}
            onSelectedFilesChange={handleSelectedFilesChange}
          />
        </div>
        <div className="w-80">
          <FileStats
            selectedFiles={selectedFiles}
            onRemoveFile={handleRemoveFile}
            rootDir={rootDir}
          />
        </div>
      </div>
    </div>
  );
}
