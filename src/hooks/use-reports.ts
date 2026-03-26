"use client";
import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

interface WeeklyReport {
  id: string;
  periodStart: string;
  periodEnd: string;
  content: Record<string, unknown>;
  highlights: string[];
  createdAt: string;
}

export function useReports() {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchReports = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/reports?page=${page}&limit=10`);
      const json = await res.json();
      if (json.success) { setReports(json.data.reports); setTotal(json.data.pagination.total); }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const generateReport = async (periodStart?: string, periodEnd?: string) => {
    setGenerating(true);
    try {
      const now = new Date();
      const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); monday.setHours(0, 0, 0, 0);
      const res = await fetch("/api/analytics/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodStart: periodStart || monday.toISOString(), periodEnd: periodEnd || now.toISOString() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success("Reporte generado");
      await fetchReports();
      return json.data;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
    finally { setGenerating(false); }
  };

  return { reports, loading, generating, total, latestReport: reports[0] || null, fetchReports, generateReport };
}
