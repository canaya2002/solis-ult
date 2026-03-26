// SOLIS AI — Meta Marketing API wrapper
import { metaAdsRatelimit } from "@/lib/redis";
import type {
  MetaCampaign,
  CampaignInsights,
  MetaAdSet,
  MetaAd,
} from "@/types/ads";

const BASE_URL = "https://graph.facebook.com/v21.0";

function getToken(): string | null {
  return process.env.META_ACCESS_TOKEN || null;
}

function getAdAccountId(): string | null {
  return process.env.META_AD_ACCOUNT_ID || null;
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((r) => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  throw new Error("Max retries reached");
}

async function adsFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  if (!token) throw new Error("API_KEY not configured: META_ACCESS_TOKEN");

  const { success } = await metaAdsRatelimit.limit("meta-ads");
  if (!success) throw new Error("Rate limit exceeded for Meta Ads API");

  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${endpoint}${separator}access_token=${token}`;

  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `Meta Ads API error ${response.status}: ${(err as { error?: { message?: string } }).error?.message || response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

export async function getCampaigns(
  adAccountId?: string
): Promise<MetaCampaign[]> {
  const accountId = adAccountId || getAdAccountId();
  if (!accountId) return [];
  try {
    const data = await withRetry(() =>
      adsFetch<{
        data: Array<{
          id: string;
          name: string;
          status: string;
          daily_budget?: string;
          lifetime_budget?: string;
          objective: string;
          start_time?: string;
          stop_time?: string;
        }>;
      }>(
        `/${accountId}/campaigns?fields=id,name,status,daily_budget,lifetime_budget,objective,start_time,stop_time`
      )
    );
    const campaigns: MetaCampaign[] = data.data.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      dailyBudget: parseInt(c.daily_budget || "0", 10) / 100,
      lifetimeBudget: parseInt(c.lifetime_budget || "0", 10) / 100,
      objective: c.objective,
      startTime: c.start_time || "",
      stopTime: c.stop_time || null,
    }));
    console.info(`[meta-ads] getCampaigns: ${campaigns.length} campaigns`);
    return campaigns;
  } catch (error) {
    console.error("[meta-ads] getCampaigns failed:", error);
    return [];
  }
}

export async function getCampaignInsights(
  campaignId: string,
  dateRange: { since: string; until: string }
): Promise<CampaignInsights | null> {
  try {
    type InsightsResponse = {
      data: Array<{
        spend: string;
        impressions: string;
        clicks: string;
        cpc: string;
        cpm: string;
        ctr: string;
        actions?: Array<{ action_type: string; value: string }>;
        cost_per_action_type?: Array<{
          action_type: string;
          value: string;
        }>;
      }>;
    };

    const data = await withRetry(() =>
      adsFetch<InsightsResponse>(
        `/${campaignId}/insights?fields=spend,impressions,clicks,cpc,cpm,ctr,actions,cost_per_action_type&time_range={"since":"${dateRange.since}","until":"${dateRange.until}"}`
      )
    );

    if (!data.data.length) return null;

    const row = data.data[0];
    const leadActions = row.actions?.filter(
      (a) =>
        a.action_type === "lead" ||
        a.action_type === "offsite_conversion.fb_pixel_lead"
    );
    const leads = leadActions?.reduce(
      (sum, a) => sum + parseInt(a.value, 10),
      0
    ) || 0;
    const spend = parseFloat(row.spend);

    const insights: CampaignInsights = {
      spend,
      impressions: parseInt(row.impressions, 10),
      clicks: parseInt(row.clicks, 10),
      cpc: parseFloat(row.cpc || "0"),
      cpm: parseFloat(row.cpm || "0"),
      ctr: parseFloat(row.ctr || "0"),
      leads,
      costPerLead: leads > 0 ? spend / leads : 0,
      dateRange,
    };
    console.info(
      `[meta-ads] getCampaignInsights: $${insights.spend} spend, ${insights.leads} leads`
    );
    return insights;
  } catch (error) {
    console.error("[meta-ads] getCampaignInsights failed:", error);
    return null;
  }
}

export async function getAdSets(campaignId: string): Promise<MetaAdSet[]> {
  try {
    const data = await withRetry(() =>
      adsFetch<{
        data: Array<{
          id: string;
          name: string;
          status: string;
          daily_budget?: string;
          targeting: Record<string, unknown>;
          optimization_goal: string;
        }>;
      }>(
        `/${campaignId}/adsets?fields=id,name,status,daily_budget,targeting,optimization_goal`
      )
    );
    const adSets: MetaAdSet[] = data.data.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      dailyBudget: parseInt(a.daily_budget || "0", 10) / 100,
      targeting: a.targeting,
      optimizationGoal: a.optimization_goal,
    }));
    console.info(`[meta-ads] getAdSets: ${adSets.length} ad sets`);
    return adSets;
  } catch (error) {
    console.error("[meta-ads] getAdSets failed:", error);
    return [];
  }
}

export async function getAds(adSetId: string): Promise<MetaAd[]> {
  try {
    const data = await withRetry(() =>
      adsFetch<{
        data: Array<{
          id: string;
          name: string;
          status: string;
          creative: Record<string, unknown>;
          insights?: {
            data: Array<{
              spend: string;
              impressions: string;
              clicks: string;
              actions?: Array<{ action_type: string; value: string }>;
            }>;
          };
        }>;
      }>(
        `/${adSetId}/ads?fields=id,name,status,creative,insights{spend,impressions,clicks,actions}`
      )
    );
    const ads: MetaAd[] = data.data.map((a) => {
      const insightRow = a.insights?.data?.[0];
      return {
        id: a.id,
        name: a.name,
        status: a.status,
        creative: a.creative,
        insights: insightRow
          ? {
              spend: parseFloat(insightRow.spend),
              impressions: parseInt(insightRow.impressions, 10),
              clicks: parseInt(insightRow.clicks, 10),
              actions: (insightRow.actions || []).map((act) => ({
                actionType: act.action_type,
                value: parseInt(act.value, 10),
              })),
            }
          : null,
      };
    });
    console.info(`[meta-ads] getAds: ${ads.length} ads`);
    return ads;
  } catch (error) {
    console.error("[meta-ads] getAds failed:", error);
    return [];
  }
}

export async function updateCampaignBudget(
  campaignId: string,
  newDailyBudget: number
): Promise<boolean> {
  try {
    await withRetry(() =>
      adsFetch(`/${campaignId}`, {
        method: "POST",
        body: JSON.stringify({ daily_budget: Math.round(newDailyBudget * 100) }),
      })
    );
    console.info(
      `[meta-ads] updateCampaignBudget: ${campaignId} → $${newDailyBudget}`
    );
    return true;
  } catch (error) {
    console.error("[meta-ads] updateCampaignBudget failed:", error);
    return false;
  }
}

export async function pauseCampaign(campaignId: string): Promise<boolean> {
  try {
    await withRetry(() =>
      adsFetch(`/${campaignId}`, {
        method: "POST",
        body: JSON.stringify({ status: "PAUSED" }),
      })
    );
    console.info(`[meta-ads] pauseCampaign: ${campaignId}`);
    return true;
  } catch (error) {
    console.error("[meta-ads] pauseCampaign failed:", error);
    return false;
  }
}

export async function activateCampaign(campaignId: string): Promise<boolean> {
  try {
    await withRetry(() =>
      adsFetch(`/${campaignId}`, {
        method: "POST",
        body: JSON.stringify({ status: "ACTIVE" }),
      })
    );
    console.info(`[meta-ads] activateCampaign: ${campaignId}`);
    return true;
  } catch (error) {
    console.error("[meta-ads] activateCampaign failed:", error);
    return false;
  }
}

export async function getAccountSpend(
  adAccountId?: string,
  dateRange?: { since: string; until: string }
): Promise<{
  spend: number;
  impressions: number;
  leads: number;
  cpl: number;
}> {
  const accountId = adAccountId || getAdAccountId();
  const fallback = { spend: 0, impressions: 0, leads: 0, cpl: 0 };
  if (!accountId) return fallback;

  const since =
    dateRange?.since ||
    new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const until =
    dateRange?.until || new Date().toISOString().split("T")[0];

  try {
    type Row = {
      spend: string;
      impressions: string;
      actions?: Array<{ action_type: string; value: string }>;
    };
    const data = await withRetry(() =>
      adsFetch<{ data: Row[] }>(
        `/${accountId}/insights?fields=spend,impressions,actions&time_range={"since":"${since}","until":"${until}"}`
      )
    );
    if (!data.data.length) return fallback;

    const row = data.data[0];
    const spend = parseFloat(row.spend);
    const impressions = parseInt(row.impressions, 10);
    const leads =
      row.actions
        ?.filter(
          (a) =>
            a.action_type === "lead" ||
            a.action_type === "offsite_conversion.fb_pixel_lead"
        )
        .reduce((s, a) => s + parseInt(a.value, 10), 0) || 0;

    const result = {
      spend,
      impressions,
      leads,
      cpl: leads > 0 ? spend / leads : 0,
    };
    console.info(
      `[meta-ads] getAccountSpend: $${result.spend}, ${result.leads} leads, CPL $${result.cpl.toFixed(2)}`
    );
    return result;
  } catch (error) {
    console.error("[meta-ads] getAccountSpend failed:", error);
    return fallback;
  }
}
