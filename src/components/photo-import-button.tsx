"use client";

import { useRef, ChangeEvent, useState } from "react";
import { Button } from "@/components/ui/button";

type PhotoImportButtonProps = {
  onImport: () => void;
  setProcessingRecipeId: (id: number | null) => void;
};

export function PhotoImportButton({
  onImport,
  setProcessingRecipeId,
}: PhotoImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [statusMessage, setStatusMessage] = useState("Import from Photo");
  const [isImporting, setIsImporting] = useState(false);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setStatusMessage("Uploading...");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/recipes/import-photo", {
        method: "POST",
        body: formData,
      });

      if (!response.ok || !response.body) {
        throw new Error("Upload failed with no response body.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const eventData = JSON.parse(chunk);

        if (eventData.status) {
          setStatusMessage(eventData.status);
        }

        if (eventData.status === "done") {
          console.log("Parsed recipe data:", eventData.data);
          // Integration with dialog comes next
        }

        if (eventData.status === "error") {
          console.error("Error from backend:", eventData.error);
          setStatusMessage("Import Failed");
          // Proper error handling will be added in a later task.
        }
      }
    } catch (error) {
      console.error("An error occurred during upload:", error);
      setStatusMessage("Import Failed");
    } finally {
      setIsImporting(false);
      // Reset button text after a delay if it wasn't a success
      if (statusMessage !== "done") {
        setTimeout(() => setStatusMessage("Import from Photo"), 3000);
      }
    }
  };

  return (
    <>
      <Button onClick={handleClick} disabled={isImporting}>
        {isImporting ? statusMessage : "Import from Photo"}
      </Button>
      <input
        type="file"
        ref={inputRef}
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleFileChange}
        disabled={isImporting}
      />
    </>
  );
} 