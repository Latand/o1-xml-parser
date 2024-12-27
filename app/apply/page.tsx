"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { getSimilarPaths } from "@/actions/file-actions";
import { cn } from "@/lib/utils";
import { ApplyChangesForm } from "./_components/apply-changes-form";

export default function ApplyPage() {
  const [path, setPath] = useState<string>("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const pathInputRef = useRef<HTMLInputElement>(null);

  const handlePathChange = async (value: string) => {
    setPath(value);
    setSelectedIndex(-1);
    if (value.trim()) {
      const result = await getSimilarPaths(value);
      if (result.isSuccess) {
        setSuggestions(result.data);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0) {
          setPath(suggestions[selectedIndex]);
          setSuggestions([]);
          setSelectedIndex(-1);
        }
        break;
      case "Escape":
        setSuggestions([]);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-4">
      <div className="flex flex-col gap-2">
        <label className="font-bold text-gray-100">Project Directory:</label>
        <div className="relative">
          <Input
            ref={pathInputRef}
            placeholder="Enter project directory path..."
            value={path}
            onChange={(e) => handlePathChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full"
          />
          {suggestions.length > 0 && (
            <div className="absolute w-full mt-1 py-1 bg-gray-900 border border-gray-800 rounded-md shadow-lg max-h-60 overflow-auto z-50">
              {suggestions.map((suggestion, index) => (
                <div
                  key={suggestion}
                  className={cn(
                    "px-3 py-2 text-sm cursor-pointer",
                    index === selectedIndex
                      ? "bg-gray-800 text-gray-100"
                      : "text-gray-300 hover:bg-gray-800/50"
                  )}
                  onClick={() => {
                    setPath(suggestion);
                    setSuggestions([]);
                    setSelectedIndex(-1);
                  }}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ApplyChangesForm projectDirectory={path} />
    </div>
  );
}
