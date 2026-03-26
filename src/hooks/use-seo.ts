"use client";
import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

interface SEOBrief {
  id: string;
  opportunities: unknown;
  quickWins: unknown;
  contentSuggestions: unknown;
  technicalIssues: unknown;
  weekOf: string;
  createdAt: string;
}

export function useSEO() {
  const [brief, setBrief] = useState<SEOBrief | null>(null);
  const [briefs, setBriefs] = useState<SEOBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchLatest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/seo/brief?latest=true");
      const json = await res.json();
      if (json.success && json.data) setBrief(json.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/seo/brief?page=1&limit=10");
      const json = await res.json();
      if (json.success) setBriefs(json.data.briefs);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchLatest(); fetchAll(); }, [fetchLatest, fetchAll]);

  const generateBrief = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/seo/brief", { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setBrief(json.data);
      toast.success("SEO brief generado");
      await fetchAll();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
    finally { setGenerating(false); }
  };

  return { brief, briefs, loading, generating, generateBrief, refetch: fetchLatest };
}
