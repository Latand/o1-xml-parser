"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";
import { DirectoryBrowser } from "@/app/browser/_components/directory-browser";

export function ApplyChangesForm() {
  const [path, setPath] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const directoryInputRef = useRef<HTMLInputElement>(null);

  const handleDirectorySelect = () => {
    directoryInputRef.current?.click();
  };

  const handleDirectoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const directory = e.target.files?.[0];
    if (directory) {
      setPath(directory.path);
    }
  };

  const handleApplyChanges = async () => {
    if (selectedFiles.length === 0) return;
    // Add your apply changes logic here
  };

  return (
    <div className="container mx-auto py-8 space-y-4">
      <div className="flex gap-4 items-center">
        <input
          type="file"
          ref={directoryInputRef}
          onChange={handleDirectoryChange}
          webkitdirectory=""
          directory=""
          className="hidden"
        />
        <Button onClick={handleDirectorySelect} className="flex gap-2">
          <FolderOpen className="w-4 h-4" />
          Select Directory
        </Button>
        {path && (
          <span className="text-sm text-muted-foreground">
            Selected: {path}
          </span>
        )}
      </div>

      <DirectoryBrowser
        path={path}
        selectedFiles={selectedFiles}
        onSelectFiles={setSelectedFiles}
      />

      <div className="flex justify-end">
        <Button
          onClick={handleApplyChanges}
          disabled={selectedFiles.length === 0}
        >
          Apply Changes
        </Button>
      </div>
    </div>
  );
}
