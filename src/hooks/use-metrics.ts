"use client";

import { useState, useEffect, useCallback } from "react";

interface OverviewData {
  period: string;
  leads: {
    total: number;
    converted: number;
    conversionRate: number;
    bySource: Array<{
      source: string;
      count: number;
      converted: number;
      conversionRate: number;
    }>;
    trend: Array<{ date: string; count: number }>;
  } | null;
  ads: {
    totalSpend: number;
    totalLeads: number;
    averageCpl: number;
    activeCampaigns: number;
    bestCampaign: { name: string; cpl: number } | null;
    worstCampaign: { name: string; cpl: number } | null;
  } | null;
  web: {
    sessions: number;
    users: number;
    pageviews: number;
    bounceRate: number;
    topPages: Array<{ path: string; views: number }>;
    trend: Array<{ date: string; sessions: number }>;
  } | null;
  seo: {
    totalClicks: number;
    totalImpressions: number;
    averageCtr: number;
    averagePosition: number;
    topQueries: Array<{
      query: string;
      clicks: number;
      impressions: number;
      position: number;
    }>;
  } | null;
  social: null;
  connectedApis: string[];
  disconnectedApis: string[];
}

export function useMetrics(period = "30d") {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/analytics/overview?period=${period}`
      );
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error);
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchMetrics();
    // Refresh every 5 minutes
    const interval = setInterval(fetchMetrics, 300000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return { data, loading, error, refetch: fetchMetrics };
}
