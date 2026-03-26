"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import type { TranscriptionResult, BlogArticle } from "@/types/ai";

type Step = "upload" | "transcribing" | "editing" | "generating" | "done";

export function usePodcast() {
  const [step, setStep] = useState<Step>("upload");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);
  const [article, setArticle] = useState<BlogArticle | null>(null);
  const [contentId, setContentId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [generatingBlog, setGeneratingBlog] = useState(false);

  const uploadAudio = (file: File) => {
    setAudioFile(file);
    setStep("editing");
  };

  const transcribe = async () => {
    if (!audioFile) return;
    setTranscribing(true);
    setStep("transcribing");
    try {
      const formData = new FormData();
      formData.append("file", audioFile);

      const res = await fetch("/api/ai/transcribe", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setTranscription(json.data);
      setStep("editing");
      toast.success("Transcripción completada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al transcribir");
      setStep("upload");
    } finally {
      setTranscribing(false);
    }
  };

  const generateBlog = async (
    editedTranscription?: string,
    metadata?: { episodeTitle?: string; episodeNumber?: number }
  ) => {
    const text = editedTranscription || transcription?.text;
    if (!text) return;
    setGeneratingBlog(true);
    setStep("generating");
    try {
      const res = await fetch("/api/ai/podcast-to-blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcription: text,
          ...metadata,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setArticle(json.data.article);
      setContentId(json.data.contentId);
      setStep("done");
      toast.success("Artículo generado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al generar");
      setStep("editing");
    } finally {
      setGeneratingBlog(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setAudioFile(null);
    setTranscription(null);
    setArticle(null);
    setContentId(null);
  };

  return {
    step,
    audioFile,
    transcription,
    article,
    contentId,
    uploading,
    transcribing,
    generatingBlog,
    uploadAudio,
    transcribe,
    generateBlog,
    reset,
    setStep,
  };
}
