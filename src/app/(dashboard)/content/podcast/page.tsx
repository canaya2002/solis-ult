"use client";

import { useState } from "react";
import { usePodcast } from "@/hooks/use-podcast";
import { AudioUpload } from "@/components/dashboard/audio-upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Mic,
  FileText,
  Loader2,
  Copy,
  RotateCcw,
  Save,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

export default function PodcastPage() {
  const {
    step,
    audioFile,
    transcription,
    article,
    transcribing,
    generatingBlog,
    uploadAudio,
    transcribe,
    generateBlog,
    reset,
  } = usePodcast();

  const [editedTranscription, setEditedTranscription] = useState("");
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState("");
  const [editedArticle, setEditedArticle] = useState("");

  // Sync transcription text when received
  const transcriptionText = editedTranscription || transcription?.text || "";

  const steps = [
    { key: "upload", label: "Subir audio", icon: Mic },
    { key: "transcribing", label: "Transcribir", icon: FileText },
    { key: "editing", label: "Editar", icon: FileText },
    { key: "generating", label: "Generar blog", icon: Loader2 },
    { key: "done", label: "Listo", icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  const copyToClipboard = async (text: string, format: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${format} copiado al portapapeles`);
    } catch {
      toast.error("Error al copiar");
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Podcast → Blog
        </h1>
        <p className="text-muted-foreground">
          Convierte episodios de &quot;Uniendo Familias con Manuel Solís&quot;
          en artículos de blog optimizados para SEO.
        </p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1 shrink-0">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                i <= currentStepIndex
                  ? "bg-gold/10 text-gold"
                  : "text-muted-foreground"
              )}
            >
              <s.icon
                className={cn(
                  "h-3.5 w-3.5",
                  (s.key === "transcribing" && transcribing) ||
                  (s.key === "generating" && generatingBlog)
                    ? "animate-spin"
                    : ""
                )}
              />
              {s.label}
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-px w-6",
                  i < currentStepIndex ? "bg-gold" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {(step === "upload" || (!audioFile && step !== "done")) && (
        <AudioUpload
          onFileSelect={(file) => {
            uploadAudio(file);
            setEditedTranscription("");
          }}
          uploading={false}
        />
      )}

      {/* Audio loaded - show transcribe button */}
      {audioFile && !transcription && !transcribing && step !== "done" && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Título del episodio (opcional)</Label>
                <Input
                  value={episodeTitle}
                  onChange={(e) => setEpisodeTitle(e.target.value)}
                  placeholder="Ej: Cambios en TPS 2025"
                />
              </div>
              <div className="space-y-2">
                <Label>Número de episodio (opcional)</Label>
                <Input
                  type="number"
                  value={episodeNumber}
                  onChange={(e) => setEpisodeNumber(e.target.value)}
                  placeholder="Ej: 42"
                />
              </div>
            </div>
            <Button
              className="w-full bg-gold text-background hover:bg-gold-light"
              size="lg"
              onClick={transcribe}
            >
              <Mic className="mr-2 h-4 w-4" />
              Transcribir Audio
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Transcribing */}
      {transcribing && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gold" />
            <p className="font-medium">Transcribiendo audio...</p>
            <p className="text-sm text-muted-foreground">
              Esto puede tomar unos minutos dependiendo de la duración
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 2/3: Transcription editing + Blog generation */}
      {transcription && !generatingBlog && step !== "done" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Transcripción</CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{transcription.language}</Badge>
                <span>{Math.round(transcription.duration)}s</span>
                <span>
                  {transcriptionText.split(/\s+/).length} palabras
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full min-h-[200px] rounded-lg border border-border bg-transparent p-3 text-sm focus:outline-none focus:ring-1 focus:ring-gold resize-y"
                value={transcriptionText}
                onChange={(e) => setEditedTranscription(e.target.value)}
                placeholder="La transcripción aparecerá aquí..."
              />
              <div className="mt-3 flex justify-end">
                <Button
                  className="bg-gold text-background hover:bg-gold-light"
                  onClick={() =>
                    generateBlog(transcriptionText, {
                      episodeTitle: episodeTitle || undefined,
                      episodeNumber: episodeNumber
                        ? parseInt(episodeNumber)
                        : undefined,
                    })
                  }
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Generar Artículo de Blog
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Generating */}
      {generatingBlog && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gold" />
            <p className="font-medium">Generando artículo de blog...</p>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Article result */}
      {article && step === "done" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Transcription (reference) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Transcripción (referencia)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-y-auto rounded-lg bg-surface-elevated p-3 text-sm text-muted-foreground">
                {transcriptionText}
              </div>
            </CardContent>
          </Card>

          {/* Generated article */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Artículo Generado</CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(article.content, "HTML")
                  }
                >
                  <Copy className="mr-1 h-3 w-3" /> HTML
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(article.content.replace(/<[^>]+>/g, ""), "Texto")}
                >
                  <Copy className="mr-1 h-3 w-3" /> Texto
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Título SEO</Label>
                <p className="font-semibold">{article.title}</p>
              </div>
              <div>
                <Label className="text-xs">Meta Description</Label>
                <p className="text-sm text-muted-foreground">
                  {article.metaDescription}
                </p>
              </div>
              <div>
                <Label className="text-xs">Keywords</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {article.keywords.map((kw) => (
                    <Badge
                      key={kw}
                      variant="outline"
                      className="text-[10px]"
                    >
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Contenido</Label>
                <div
                  className="mt-1 max-h-[300px] overflow-y-auto rounded-lg bg-surface-elevated p-3 text-sm prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: editedArticle || article.content,
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset}>
                  <RotateCcw className="mr-1.5 h-3 w-3" />
                  Nuevo episodio
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    generateBlog(transcriptionText, {
                      episodeTitle: episodeTitle || undefined,
                    })
                  }
                >
                  <RotateCcw className="mr-1.5 h-3 w-3" />
                  Regenerar
                </Button>
                <Button
                  size="sm"
                  className="bg-gold text-background hover:bg-gold-light"
                >
                  <Save className="mr-1.5 h-3 w-3" />
                  Guardar borrador
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
