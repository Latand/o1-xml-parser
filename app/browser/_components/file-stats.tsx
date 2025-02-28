"use client";

import { useCachedFileStats } from "@/lib/hooks";
import { X, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { SSHConfig } from "@/types";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface FileStatsProps {
  selectedFiles: string[];
  onRemoveFile: (file: string) => void;
  rootDir?: string | null;
  isRemote?: boolean;
  sshConfig?: SSHConfig | null;
}

export function FileStats({
  selectedFiles,
  onRemoveFile,
  rootDir,
  isRemote,
  sshConfig,
}: FileStatsProps) {
  const { stats, isLoading, refreshStats } = useCachedFileStats(
    selectedFiles,
    rootDir,
    isRemote,
    sshConfig
  );
  const [error, setError] = useState<string | null>(null);

  // Clear error when selection changes
  useEffect(() => {
    setError(null);
  }, [selectedFiles, isRemote, sshConfig]);

  const handleRefresh = async () => {
    try {
      setError(null);
      await refreshStats();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (
        errorMessage.includes("Failed to initialize SFTP") ||
        errorMessage.includes("Channel open failure")
      ) {
        setError(
          "SFTP connection failed. This could be due to server restrictions or network issues. Try reconnecting or using a different SSH server."
        );
        toast.error("SFTP connection failed");
      } else {
        setError(`Error refreshing stats: ${errorMessage}`);
        toast.error("Failed to refresh stats");
      }
    }
  };

  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const formatKiloChars = (chars: number) => {
    return (chars / 1000).toFixed(1) + "k";
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
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Selection Stats</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          title="Refresh stats"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-red-200">{error}</div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : stats ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <motion.div
              className="border border-gray-800 rounded p-2 bg-gray-900/50"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="text-xs text-gray-400">Files</div>
              <div className="text-lg font-medium">
                {formatNumber(stats.files)}
              </div>
            </motion.div>
            <motion.div
              className="border border-gray-800 rounded p-2 bg-gray-900/50"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.05 }}
            >
              <div className="text-xs text-gray-400">Lines</div>
              <div className="text-lg font-medium">
                {formatNumber(stats.lines)}
              </div>
            </motion.div>
            <motion.div
              className="border border-gray-800 rounded p-2 bg-gray-900/50"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
            >
              <div className="text-xs text-gray-400">Characters</div>
              <div className="text-lg font-medium">
                {formatNumber(stats.characters)}
              </div>
            </motion.div>
            <motion.div
              className="border border-gray-800 rounded p-2 bg-gray-900/50"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.15 }}
            >
              <div className="text-xs text-gray-400">Tokens</div>
              <div className="text-lg font-medium">
                {formatNumber(stats.tokens)}
              </div>
            </motion.div>
          </div>

          <motion.div
            className="border border-gray-800 rounded-lg p-3 bg-gray-900/50 space-y-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.2 }}
          >
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
          </motion.div>
        </div>
      ) : null}

      <div className="border-t border-gray-800 pt-4">
        <div className="text-base font-medium pb-2">Selected paths:</div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
          <AnimatePresence>
            {stats?.fileStats.map(({ path: file, characters }) => (
              <motion.div
                key={file}
                className="flex items-center gap-2 group hover:bg-gray-800/50 rounded p-2"
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div
                  className="text-base text-gray-100 break-all flex-1 leading-relaxed"
                  title={file}
                >
                  {file}
                  <span className="text-gray-400 ml-2">
                    ({formatKiloChars(characters)})
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={() => onRemoveFile(file)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
