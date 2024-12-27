"use client";

import { useEffect, useState } from "react";
import { getFileStats } from "@/actions/file-actions";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileStatsProps {
  selectedFiles: string[];
  onRemoveFile?: (file: string) => void;
  rootDir?: string | null;
}

interface Stats {
  lines: number;
  characters: number;
  tokens: number;
  files: number;
}

export function FileStats({
  selectedFiles,
  onRemoveFile,
  rootDir,
}: FileStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      if (selectedFiles.length === 0) {
        setStats(null);
        return;
      }

      setIsLoading(true);
      try {
        const result = await getFileStats(selectedFiles, rootDir);
        if (result.isSuccess) {
          setStats(result.data);
        }
      } catch (error) {
        console.error("Failed to load stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [selectedFiles, rootDir]);

  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  if (selectedFiles.length === 0) {
    return (
      <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/50">
        <h2 className="text-lg font-semibold mb-4">Selection Stats</h2>
        <p className="text-gray-400 text-sm">No files selected</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/50 flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Selection Stats</h2>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : stats ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="border border-gray-800 rounded p-2 bg-gray-900/50">
              <div className="text-xs text-gray-400">Files</div>
              <div className="text-lg font-medium">
                {formatNumber(stats.files)}
              </div>
            </div>
            <div className="border border-gray-800 rounded p-2 bg-gray-900/50">
              <div className="text-xs text-gray-400">Lines</div>
              <div className="text-lg font-medium">
                {formatNumber(stats.lines)}
              </div>
            </div>
            <div className="border border-gray-800 rounded p-2 bg-gray-900/50">
              <div className="text-xs text-gray-400">Characters</div>
              <div className="text-lg font-medium">
                {formatNumber(stats.characters)}
              </div>
            </div>
            <div className="border border-gray-800 rounded p-2 bg-gray-900/50">
              <div className="text-xs text-gray-400">Tokens</div>
              <div className="text-lg font-medium">
                {formatNumber(stats.tokens)}
              </div>
            </div>
          </div>

          <div className="border border-gray-800 rounded-lg p-3 bg-gray-900/50 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Selected files:</span>
              <span className="font-medium">
                {formatNumber(selectedFiles.length)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Total lines:</span>
              <span className="font-medium">{formatNumber(stats.lines)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Total characters:</span>
              <span className="font-medium">
                {formatNumber(stats.characters)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Total tokens:</span>
              <span className="font-medium">{formatNumber(stats.tokens)}</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="border-t border-gray-800 pt-4">
        <div className="text-base font-medium pb-2">Selected paths:</div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
          {selectedFiles.map((file) => (
            <div
              key={file}
              className="flex items-center gap-2 group hover:bg-gray-800/50 rounded p-2"
            >
              <div
                className="text-base text-gray-100 break-all flex-1 leading-relaxed"
                title={file}
              >
                {file}
              </div>
              {onRemoveFile && (
                <Button
                  variant="outline"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={() => onRemoveFile(file)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
