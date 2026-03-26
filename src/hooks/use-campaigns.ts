"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import type { CampaignRow } from "@/components/dashboard/campaign-table";
import type { RebalanceResult } from "@/lib/ads/rebalancer";

interface CampaignsSummary {
  totalSpend: number;
  totalLeads: number;
  averageCpl: number;
  activeCampaigns: number;
  pausedCampaigns: number;
  pausedByAi: number;
}

interface UseCampaignsReturn {
  campaigns: CampaignRow[];
  summary: CampaignsSummary | null;
  loading: boolean;
  error: string | null;
  dateRange: string;
  setDateRange: (range: string) => void;
  refetch: () => Promise<void>;
  pauseCampaign: (metaCampaignId: string) => Promise<void>;
  activateCampaign: (metaCampaignId: string) => Promise<void>;
  updateBudget: (metaCampaignId: string, amount: number) => Promise<void>;
  executeRebalance: (dryRun: boolean) => Promise<RebalanceResult>;
  lastRebalance: RebalanceResult | null;
  rebalanceLoading: boolean;
}

export function useCampaigns(): UseCampaignsReturn {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [summary, setSummary] = useState<CampaignsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("7d");
  const [lastRebalance, setLastRebalance] = useState<RebalanceResult | null>(null);
  const [rebalanceLoading, setRebalanceLoading] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ads/campaigns?dateRange=${dateRange}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Error al cargar campañas");
        return;
      }
      setCampaigns(json.data.campaigns);
      setSummary(json.data.summary);
    } catch {
      setError("Error de conexión al cargar campañas");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const postAction = async (
    metaCampaignId: string,
    action: string,
    newBudget?: number
  ) => {
    const res = await fetch("/api/ads/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, campaignId: metaCampaignId, newBudget }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Acción falló");
    return json.data;
  };

  const pauseCampaign = async (metaCampaignId: string) => {
    try {
      await postAction(metaCampaignId, "pause");
      toast.success("Campaña pausada");
      await fetchCampaigns();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al pausar campaña");
    }
  };

  const activateCampaign = async (metaCampaignId: string) => {
    try {
      await postAction(metaCampaignId, "activate");
      toast.success("Campaña activada");
      await fetchCampaigns();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al activar campaña");
    }
  };

  const updateBudget = async (metaCampaignId: string, amount: number) => {
    try {
      await postAction(metaCampaignId, "update_budget", amount);
      toast.success(`Budget actualizado a $${amount}/día`);
      await fetchCampaigns();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error al actualizar budget"
      );
    }
  };

  const executeRebalance = async (
    dryRun: boolean
  ): Promise<RebalanceResult> => {
    setRebalanceLoading(true);
    try {
      const res = await fetch("/api/ads/rebalance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      const result = json.data as RebalanceResult;
      if (!dryRun) {
        setLastRebalance(result);
        toast.success(
          `Rebalanceo completado: ${result.paused.length} pausadas, ${result.scaled.length} escaladas`
        );
        await fetchCampaigns();
      }
      return result;
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Error en rebalanceo";
      toast.error(msg);
      throw e;
    } finally {
      setRebalanceLoading(false);
    }
  };

  return {
    campaigns,
    summary,
    loading,
    error,
    dateRange,
    setDateRange,
    refetch: fetchCampaigns,
    pauseCampaign,
    activateCampaign,
    updateBudget,
    executeRebalance,
    lastRebalance,
    rebalanceLoading,
  };
}
