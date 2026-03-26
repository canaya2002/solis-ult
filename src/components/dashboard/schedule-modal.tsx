"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlatformBadge } from "./platform-badge";
import { Calendar, Send, Upload } from "lucide-react";

interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  initialContent?: {
    text: string;
    platform: string;
    hashtags: string[];
    contentId?: string;
  };
  onSchedule: (data: {
    contentId?: string;
    text: string;
    platform: string;
    scheduledAt: string;
    mediaUrl?: string;
  }) => void;
  onPublishNow: (data: {
    contentId?: string;
    text: string;
    platform: string;
  }) => void;
}

const PLATFORMS = [
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "YOUTUBE", label: "YouTube" },
  { value: "BLOG", label: "Blog" },
];

export function ScheduleModal({
  open,
  onClose,
  initialContent,
  onSchedule,
  onPublishNow,
}: ScheduleModalProps) {
  const [text, setText] = useState(initialContent?.text || "");
  const [platform, setPlatform] = useState(
    initialContent?.platform || "FACEBOOK"
  );
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");

  const handleSchedule = () => {
    if (!date || !time) return;
    const scheduledAt = new Date(`${date}T${time}`).toISOString();
    onSchedule({
      contentId: initialContent?.contentId,
      text,
      platform,
      scheduledAt,
      mediaUrl: mediaUrl || undefined,
    });
    onClose();
  };

  const handlePublishNow = () => {
    onPublishNow({
      contentId: initialContent?.contentId,
      text,
      platform,
    });
    onClose();
  };

  // Min date = now
  const minDate = new Date().toISOString().split("T")[0];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Programar Publicación</DialogTitle>
          <DialogDescription>
            Programa o publica contenido en redes sociales.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Platform */}
          <div className="space-y-2">
            <Label>Plataforma</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    platform === p.value
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-border text-muted-foreground hover:border-gold/30"
                  }`}
                  onClick={() => setPlatform(p.value)}
                >
                  <PlatformBadge platform={p.value as "FACEBOOK"} size="sm" />
                </button>
              ))}
            </div>
          </div>

          {/* Text */}
          <div className="space-y-2">
            <Label>Texto</Label>
            <textarea
              className="w-full min-h-[100px] rounded-lg border border-border bg-transparent p-3 text-sm focus:outline-none focus:ring-1 focus:ring-gold resize-y"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Texto del post..."
            />
          </div>

          {/* Media URL */}
          <div className="space-y-2">
            <Label>Media (URL)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://... o sube a Supabase Storage"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
              />
              <Button variant="outline" size="icon" disabled>
                <Upload className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={minDate}
              />
            </div>
            <div className="space-y-2">
              <Label>Hora (CT)</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={handlePublishNow}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Publicar ahora
          </Button>
          <Button
            className="bg-gold text-background hover:bg-gold-light"
            onClick={handleSchedule}
            disabled={!date || !time}
          >
            <Calendar className="mr-1.5 h-3.5 w-3.5" />
            Programar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
