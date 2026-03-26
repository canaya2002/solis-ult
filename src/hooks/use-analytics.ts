"use client";
import { useState, useEffect, useCallback } from "react";

interface AnalyticsData {
  leads: { total: number; converted: number; conversionRate: number } | null;
  web: { sessions: number; users: number; bounceRate: number } | null;
  ads: { totalSpend: number; averageCpl: number } | null;
  seo: { totalClicks: number; totalImpressions: number } | null;
  connectedApis: string[];
}

export function useAnalytics(period = "30d") {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/overview?period=${period}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, refetch: fetchData };
}
