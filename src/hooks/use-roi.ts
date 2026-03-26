"use client";
import { useState, useEffect, useCallback } from "react";
import type { ROIReport } from "@/lib/analytics/roi-calculator";

export function useROI(period = "30d") {
  const [data, setData] = useState<ROIReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchROI = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/analytics/roi?period=${period}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { fetchROI(); }, [fetchROI]);

  return { data, loading, error, refetch: fetchROI };
}
