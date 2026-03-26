"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import type { ContentIdea } from "@/types/ai";
import type { RelatedQuery } from "@/types/analytics";

interface TrendsData {
  ideas: ContentIdea[];
  rawTrends: {
    trendingKeywords: string[];
    risingQueries: RelatedQuery[];
    topQueries: RelatedQuery[];
  };
  generatedAt: string;
  cachedUntil: string;
}

export function useTrends() {
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTrends = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/analyze-trends");
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error);
    } catch {
      setError("Error al cargar tendencias");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  const refreshTrends = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/ai/analyze-trends", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        toast.success("Tendencias actualizadas");
      } else {
        toast.error(json.error || "Error al actualizar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setRefreshing(false);
    }
  };

  const useIdea = async (ideaId: string) => {
    try {
      await fetch("/api/ai/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "", ideaId }),
      });
    } catch { /* handled by copy generator */ }
  };

  const dismissIdea = async (ideaId: string) => {
    try {
      // Mark as used without generating copy
      if (data) {
        setData({
          ...data,
          ideas: data.ideas.filter((i) => i.topic !== ideaId),
        });
      }
      toast.success("Idea descartada");
    } catch { /* ignore */ }
  };

  return {
    ideas: data?.ideas || [],
    rawTrends: data?.rawTrends || null,
    generatedAt: data?.generatedAt || null,
    loading,
    error,
    refreshing,
    refreshTrends,
    useIdea,
    dismissIdea,
    refetch: fetchTrends,
  };
}
