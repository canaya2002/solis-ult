// SOLIS AI — Ads platform types

export type CampaignStatusType =
  | "ACTIVE"
  | "PAUSED"
  | "PAUSED_BY_AI"
  | "COMPLETED";

export type CampaignSummary = {
  id: string;
  metaCampaignId: string;
  name: string;
  platform: string;
  budget: number;
  spent: number;
  leadsGenerated: number;
  cpl: number | null;
  status: CampaignStatusType;
  lastRebalancedAt: Date | null;
};

export type AdSetMetrics = {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number;
  ctr: number;
};

export type RebalanceAction = {
  campaignId: string;
  action: "PAUSE" | "INCREASE_BUDGET" | "DECREASE_BUDGET" | "REACTIVATE";
  reason: string;
  previousBudget?: number;
  newBudget?: number;
};

export type AudienceSegment = {
  id: string;
  name: string;
  description: string;
  size: number;
  platform: string;
  criteria: Record<string, unknown>;
};

// ─── Meta Ads API ─────────────────────────────────────────────────────────────

export type MetaCampaign = {
  id: string;
  name: string;
  status: string;
  dailyBudget: number;
  lifetimeBudget: number;
  objective: string;
  startTime: string;
  stopTime: string | null;
};

export type CampaignInsights = {
  spend: number;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  ctr: number;
  leads: number;
  costPerLead: number;
  dateRange: { since: string; until: string };
};

export type MetaAdSet = {
  id: string;
  name: string;
  status: string;
  dailyBudget: number;
  targeting: Record<string, unknown>;
  optimizationGoal: string;
};

export type MetaAd = {
  id: string;
  name: string;
  status: string;
  creative: Record<string, unknown>;
  insights: {
    spend: number;
    impressions: number;
    clicks: number;
    actions: Array<{ actionType: string; value: number }>;
  } | null;
};
