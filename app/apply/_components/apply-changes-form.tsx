"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { applyChangesAction } from "@/actions/apply-changes-actions";

interface ApplyChangesFormProps {
  projectDirectory: string;
}

export function ApplyChangesForm({ projectDirectory }: ApplyChangesFormProps) {
  const [xml, setXml] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

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
    if (!projectDirectory.trim()) {
      setErrorMessage("Please select a project directory.");
      return;
    }

    try {
      await applyChangesAction(xml, projectDirectory.trim());
      setXml("");
      setSuccessMessage("Changes applied successfully");
    } catch (error: any) {
      setErrorMessage("An error occurred while applying changes.");
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

      <Button
        onClick={handleApply}
        disabled={!xml.trim() || !projectDirectory.trim()}
        className="w-full"
      >
        Apply Changes
      </Button>
    </div>
  );
}
