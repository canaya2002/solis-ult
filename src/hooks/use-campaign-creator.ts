"use client";
import { useState, useCallback } from "react";

interface CampaignPlan {
  id: string;
  recommendation: string;
  campaign: {
    name: string;
    objective: string;
    dailyBudget: number;
    estimatedDailyLeads: number;
    estimatedCPL: number;
    specialAdCategories: string[];
  };
  adSets: Array<{
    name: string;
    targeting: Record<string, unknown>;
    dailyBudget: number;
    rationale: string;
  }>;
  ads: Array<{
    name: string;
    copy: string;
    cta: string;
    rationale: string;
  }>;
  estimatedResults: {
    dailyLeads: number;
    weeklyCost: number;
    estimatedCPL: number;
    confidence: "high" | "medium" | "low";
    reasoning: string;
  };
  status: string;
  createdAt: string;
  expiresAt: string;
}

type Step = "idle" | "planning" | "planned" | "approving" | "approved" | "activating" | "activated" | "error";

export function useCampaignCreator() {
  const [step, setStep] = useState<Step>("idle");
  const [plan, setPlan] = useState<CampaignPlan | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const planCampaign = useCallback(async (params: {
    goal: string;
    budget: number;
    cities: string[];
    caseType?: string;
    mediaUrls?: string[];
  }) => {
    setStep("planning");
    setError(null);
    try {
      const res = await fetch("/api/ads/create-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "ai", ...params }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setPlan(json.data.plan);
      setPlanId(json.data.planId);
      setStep("planned");
      return json.data.plan as CampaignPlan;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al planificar");
      setStep("error");
      return null;
    }
  }, []);

  const planManualCampaign = useCallback(async (params: {
    campaign: Record<string, unknown>;
    adSets: Array<Record<string, unknown>>;
    ads: Array<Record<string, unknown>>;
  }) => {
    setStep("planning");
    setError(null);
    try {
      const res = await fetch("/api/ads/create-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "manual", ...params }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setPlan(json.data.plan);
      setPlanId(json.data.planId);
      setStep("planned");
      return json.data.plan as CampaignPlan;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear plan");
      setStep("error");
      return null;
    }
  }, []);

  const approvePlan = useCallback(async (id?: string, modifications?: Record<string, unknown>) => {
    const targetId = id || planId;
    if (!targetId) return null;

    setStep("approving");
    setError(null);
    try {
      const res = await fetch("/api/ads/create-campaign/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: targetId, modifications }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setCampaignId(json.data.campaignId);
      setStep("approved");
      return json.data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al aprobar");
      setStep("error");
      return null;
    }
  }, [planId]);

  const activateCampaign = useCallback(async (id?: string) => {
    const targetId = id || campaignId;
    if (!targetId) return null;

    setStep("activating");
    setError(null);
    try {
      const res = await fetch("/api/ads/create-campaign/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: targetId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setStep("activated");
      return json.data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al activar");
      setStep("error");
      return null;
    }
  }, [campaignId]);

  const reset = useCallback(() => {
    setStep("idle");
    setPlan(null);
    setPlanId(null);
    setCampaignId(null);
    setError(null);
  }, []);

  return {
    step,
    plan,
    planId,
    campaignId,
    error,
    isPlanning: step === "planning",
    isApproving: step === "approving",
    isActivating: step === "activating",
    planCampaign,
    planManualCampaign,
    approvePlan,
    activateCampaign,
    reset,
  };
}
