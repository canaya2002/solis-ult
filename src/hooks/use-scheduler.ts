"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

interface ScheduledContent {
  id: string;
  title: string;
  body: string;
  platform: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  mediaUrl: string | null;
  hashtags: string[];
}

export function useScheduler() {
  const [scheduled, setScheduled] = useState<ScheduledContent[]>([]);
  const [published, setPublished] = useState<ScheduledContent[]>([]);
  const [failed, setFailed] = useState<ScheduledContent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContent = useCallback(async (from?: string, to?: string, platform?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (platform) params.set("platform", platform);

      const res = await fetch(`/api/social/schedule?${params}`);
      const json = await res.json();
      if (json.success) {
        setScheduled(json.data.scheduled);
        setPublished(json.data.published);
        setFailed(json.data.failed);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchContent();
    const interval = setInterval(() => fetchContent(), 60000);
    return () => clearInterval(interval);
  }, [fetchContent]);

  const scheduleContent = async (
    contentId: string,
    scheduledAt: string,
    mediaUrl?: string
  ) => {
    try {
      const res = await fetch("/api/social/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, scheduledAt, mediaUrl }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success("Contenido programado");
      await fetchContent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const cancelSchedule = async (contentId: string) => {
    try {
      const res = await fetch("/api/social/schedule", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success("Programación cancelada");
      await fetchContent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const publishNow = async (contentId: string) => {
    try {
      const res = await fetch("/api/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const r = json.data.results[0];
      if (r?.success) {
        toast.success("Publicado exitosamente");
      } else {
        toast.error(r?.error || "Error al publicar");
      }
      await fetchContent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return {
    scheduled,
    published,
    failed,
    loading,
    fetchContent,
    scheduleContent,
    cancelSchedule,
    publishNow,
  };
}
