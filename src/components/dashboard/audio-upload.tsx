"use client";

import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Upload, FileAudio, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioUploadProps {
  onFileSelect: (file: File) => void;
  uploading: boolean;
  progress?: number;
  accept?: string;
}

const ACCEPTED = ".mp3,.m4a,.wav,.mp4,.webm";
const MAX_SIZE = 100 * 1024 * 1024;

export function AudioUpload({
  onFileSelect,
  uploading,
  progress = 0,
  accept = ACCEPTED,
}: AudioUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File) => {
    setError(null);
    if (file.size > MAX_SIZE) {
      setError("El archivo excede 100MB");
      return;
    }
    setSelectedFile(file);
    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (selectedFile && !error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-gold/10 p-3">
              <FileAudio className="h-6 w-6 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatSize(selectedFile.size)}
              </p>
              {uploading && (
                <div className="mt-2 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                  <div
                    className="h-full bg-gold rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
            {!uploading && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSelectedFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 border-dashed transition-colors cursor-pointer",
        dragOver
          ? "border-gold bg-gold/5"
          : "border-border hover:border-gold/50"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      <div className="flex flex-col items-center gap-3 py-12">
        <div className="rounded-full bg-gold/10 p-4">
          {dragOver ? (
            <Upload className="h-8 w-8 text-gold" />
          ) : (
            <Mic className="h-8 w-8 text-gold" />
          )}
        </div>
        <div className="text-center">
          <p className="font-medium">
            {dragOver
              ? "Suelta el archivo aquí"
              : "Arrastra un archivo de audio o haz click para seleccionar"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            MP3, M4A, WAV, MP4 — Máximo 100MB
          </p>
        </div>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  );
}
