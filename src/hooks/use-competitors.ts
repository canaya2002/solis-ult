"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

interface Competitor {
  id: string;
  name: string;
  domain: string;
  city: string;
  notes: string | null;
  analyses: Array<{
    id: string;
    data: Record<string, unknown>;
    insights: string;
    weekOf: string;
    createdAt: string;
  }>;
}

interface AnalysisResult {
  own: { overview: Record<string, unknown> | null; topKeywords: Array<Record<string, unknown>> };
  competitors: Array<{
    name: string;
    domain: string;
    overview: Record<string, unknown> | null;
    topKeywords: Array<Record<string, unknown>>;
  }>;
  keywordGaps: Array<{
    keyword: string;
    volume: number;
    difficulty: number;
    competitorPositions: Record<string, number>;
  }>;
  aiInsights: string;
  analyzedAt: string;
}

export function useCompetitors() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchCompetitors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/seo/competitors");
      const json = await res.json();
      if (json.success) setCompetitors(json.data.competitors);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchCompetitors();
  }, [fetchCompetitors]);

  const addCompetitor = async (name: string, domain: string, city: string) => {
    try {
      const res = await fetch("/api/seo/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, domain, city }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success("Competidor agregado");
      await fetchCompetitors();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const removeCompetitor = async (id: string) => {
    try {
      const res = await fetch("/api/seo/competitors", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorId: id }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success("Competidor eliminado");
      await fetchCompetitors();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const analyzeCompetitors = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/seo/competitors/analyze", {
        method: "POST",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setAnalysis(json.data);
      toast.success("Análisis completado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al analizar");
    } finally {
      setAnalyzing(false);
    }
  };

  return {
    competitors,
    analysis,
    loading,
    analyzing,
    addCompetitor,
    removeCompetitor,
    analyzeCompetitors,
    refetch: fetchCompetitors,
  };
}
