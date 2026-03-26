"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useCopyGenerator } from "@/hooks/use-copy-generator";
import { CopyCard } from "@/components/dashboard/copy-card";
import { ScheduleModal } from "@/components/dashboard/schedule-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Loader2 } from "lucide-react";
import { PlatformBadge } from "@/components/dashboard/platform-badge";

const PLATFORMS = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
];

const TONES = [
  { value: "informative", label: "Informativo" },
  { value: "empathetic", label: "Emotivo" },
  { value: "urgent", label: "Urgente" },
  { value: "educational", label: "Educativo" },
  { value: "inspiring", label: "Inspirador" },
];

export default function CopyGeneratorPage() {
  const searchParams = useSearchParams();
  const { copies, generating, generateCopies, copyToClipboard } =
    useCopyGenerator();

  const [topic, setTopic] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    "facebook",
  ]);
  const [tone, setTone] = useState("empathetic");
  const [language, setLanguage] = useState<"es" | "en">("es");
  const [scheduleModal, setScheduleModal] = useState<{
    open: boolean;
    text: string;
    platform: string;
    contentId?: string;
  }>({ open: false, text: "", platform: "" });

  // Pre-fill from query params (from Trend Radar)
  useEffect(() => {
    const t = searchParams.get("topic");
    const angle = searchParams.get("angle");
    const p = searchParams.get("platform");
    if (t) setTopic(angle ? `${t} — ${angle}` : t);
    if (p) {
      const lower = p.toLowerCase();
      if (PLATFORMS.some((pl) => pl.value === lower)) {
        setSelectedPlatforms([lower]);
      }
    }
  }, [searchParams]);

  const togglePlatform = (value: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(value)
        ? prev.filter((p) => p !== value)
        : [...prev, value]
    );
  };

  const handleGenerate = () => {
    if (!topic.trim() || !selectedPlatforms.length) return;
    generateCopies({
      topic,
      platform: selectedPlatforms,
      tone,
      language,
      ideaId: searchParams.get("ideaId") || undefined,
    });
  };

  const activeTab = copies.length > 0 ? copies[0].platform : "";

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Copy Generator</h1>
        <p className="text-muted-foreground">
          Genera copies, captions, hashtags y scripts con AI para todas las
          plataformas.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Form panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuración</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Topic */}
              <div className="space-y-2">
                <Label>Tema o idea</Label>
                <textarea
                  className="w-full min-h-[100px] rounded-lg border border-border bg-transparent p-3 text-sm focus:outline-none focus:ring-1 focus:ring-gold resize-y"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ej: Nuevo proceso de asilo en EE.UU., cambios en TPS, preparación para entrevista de green card..."
                />
              </div>

              {/* Platforms */}
              <div className="space-y-2">
                <Label>Plataformas</Label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.value}
                      className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                        selectedPlatforms.includes(p.value)
                          ? "border-gold bg-gold/10"
                          : "border-border hover:border-gold/30"
                      }`}
                      onClick={() => togglePlatform(p.value)}
                    >
                      <PlatformBadge
                        platform={p.value as "facebook"}
                        size="sm"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone */}
              <div className="space-y-2">
                <Label>Tono</Label>
                <div className="flex flex-wrap gap-2">
                  {TONES.map((t) => (
                    <button
                      key={t.value}
                      className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                        tone === t.value
                          ? "border-gold bg-gold/10 text-gold"
                          : "border-border text-muted-foreground hover:border-gold/30"
                      }`}
                      onClick={() => setTone(t.value)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div className="space-y-2">
                <Label>Idioma</Label>
                <div className="flex gap-2">
                  {[
                    { value: "es" as const, label: "Español" },
                    { value: "en" as const, label: "English" },
                  ].map((l) => (
                    <button
                      key={l.value}
                      className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                        language === l.value
                          ? "border-gold bg-gold/10 text-gold"
                          : "border-border text-muted-foreground"
                      }`}
                      onClick={() => setLanguage(l.value)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate button */}
              <Button
                className="w-full bg-gold text-background hover:bg-gold-light"
                size="lg"
                onClick={handleGenerate}
                disabled={generating || !topic.trim() || !selectedPlatforms.length}
              >
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {generating ? "Generando..." : "Generar copies"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results panel */}
        <div className="lg:col-span-3 space-y-4">
          {generating ? (
            <Card>
              <CardContent className="space-y-4 py-12">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-gold" />
                  <p className="text-muted-foreground">
                    Generando copies con AI...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Esto puede tomar 10-15 segundos por plataforma
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : copies.length > 0 ? (
            <>
              {/* Platform tabs */}
              {copies.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {copies.map((c) => (
                    <Badge
                      key={c.platform}
                      variant="outline"
                      className="cursor-pointer border-gold/30 text-gold shrink-0"
                    >
                      <PlatformBadge
                        platform={c.platform as "facebook"}
                        size="sm"
                      />
                    </Badge>
                  ))}
                </div>
              )}

              {/* Copy variants */}
              {copies.map((copy) => (
                <div key={copy.platform} className="space-y-3">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <PlatformBadge
                      platform={copy.platform as "facebook"}
                      size="md"
                    />
                    — {copy.variants.length} variantes
                  </h3>
                  {copy.variants.map((variant) => (
                    <CopyCard
                      key={`${copy.platform}-${variant.variant}`}
                      variant={variant}
                      platform={copy.platform}
                      onCopy={() => copyToClipboard(variant.caption)}
                      onSchedule={() =>
                        setScheduleModal({
                          open: true,
                          text: variant.caption +
                            (variant.hashtags.length
                              ? "\n\n" + variant.hashtags.map((h) => `#${h}`).join(" ")
                              : ""),
                          platform: copy.platform,
                          contentId: copy.id,
                        })
                      }
                      editable
                    />
                  ))}
                </div>
              ))}
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                <Sparkles className="h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Configura el tema y plataformas, luego haz click en
                  &quot;Generar copies&quot;.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Schedule modal */}
      <ScheduleModal
        open={scheduleModal.open}
        onClose={() =>
          setScheduleModal({ open: false, text: "", platform: "" })
        }
        initialContent={
          scheduleModal.open
            ? {
                text: scheduleModal.text,
                platform: scheduleModal.platform,
                hashtags: [],
                contentId: scheduleModal.contentId,
              }
            : undefined
        }
        onSchedule={() => {}}
        onPublishNow={() => {}}
      />
    </div>
  );
}
