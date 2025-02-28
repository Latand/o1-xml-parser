"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { applyChangesAction } from "@/actions/apply-changes-actions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { SSHConfig } from "@/types";

interface ApplyChangesFormProps {
  projectDirectory: string;
  rootDir?: string | null;
  isRemote?: boolean;
  sshConfig?: SSHConfig | null;
}

export function ApplyChangesForm({
  projectDirectory,
  rootDir,
  isRemote = false,
  sshConfig,
}: ApplyChangesFormProps) {
  const [xml, setXml] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (successMessage) {
      timer = setTimeout(() => {
        setSuccessMessage("");
      }, 2000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [successMessage]);

  const handleApply = async () => {
    setErrorMessage("");
    if (!xml.trim()) {
      setErrorMessage("Please paste XML before applying changes.");
      return;
    }

    // Use rootDir if available, otherwise use projectDirectory
    const targetDirectory = rootDir || projectDirectory.trim();

    if (!targetDirectory) {
      setErrorMessage("Please select a directory.");
      return;
    }

    setIsApplying(true);
    toast.info("Applying changes...");

    try {
      await applyChangesAction(xml, targetDirectory, isRemote, sshConfig);
      setXml("");
      setSuccessMessage("Changes applied successfully");
      toast.success("Changes applied successfully");
    } catch (error: any) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "An error occurred while applying changes.";
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="max-w-xl w-full mx-auto flex flex-col gap-4">
      {errorMessage && (
        <div className="text-red-400 bg-red-950/50 p-4 rounded-md">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="text-green-400 bg-green-950/50 p-4 rounded-md">
          {successMessage}
        </div>
      )}

      <div className="flex flex-col">
        <label className="mb-2 font-bold text-gray-100">Paste XML here:</label>
        <textarea
          className="border border-gray-800 bg-gray-900/50 text-gray-100 p-4 h-64 w-full rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={xml}
          onChange={(e) => setXml(e.target.value)}
          placeholder="Paste the <code_changes>...</code_changes> XML here"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-sm text-gray-400">
          {isRemote
            ? `Changes will be applied to remote directory: ${
                rootDir || "Not selected"
              }`
            : `Changes will be applied to local directory: ${
                rootDir || projectDirectory || "Not selected"
              }`}
        </div>

        <Button
          onClick={handleApply}
          disabled={
            !xml.trim() || (!rootDir && !projectDirectory.trim()) || isApplying
          }
          className="w-full"
        >
          {isApplying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Applying Changes...
            </>
          ) : (
            "Apply Changes"
          )}
        </Button>
      </div>
    </div>
  );
}
