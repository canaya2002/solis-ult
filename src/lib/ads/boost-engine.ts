// SOLIS AI — Organic Boost Engine
// Detects viral posts and proposes boosting them with ad budget.
// RULE: System DETECTS and PROPOSES. Human APPROVES with one click.
import { metaAdsRatelimit } from "@/lib/redis";
import type { Platform } from "@prisma/client";

const BASE_URL = "https://graph.facebook.com/v21.0";

function getToken(): string {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN not configured");
  return token;
}

function getAdAccountId(): string {
  const id = process.env.META_AD_ACCOUNT_ID;
  if (!id) throw new Error("META_AD_ACCOUNT_ID not configured");
  return id;
}

async function adsFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const { success } = await metaAdsRatelimit.limit("meta-ads-boost");
  if (!success) throw new Error("Rate limit exceeded for Meta Ads API");

  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${endpoint}${separator}access_token=${token}`;

  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } }).error?.message || response.statusText;
    throw new Error(`Meta Ads API ${response.status}: ${msg}`);
  }

  return response.json() as Promise<T>;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PostMetrics {
  views?: number;
  likes: number;
  comments: number;
  shares: number;
  saves?: number;
}

export interface PostAverages {
  avgLikes: number;
  avgComments: number;
  avgShares: number;
}

export interface BoostRecommendation {
  postId: string;           // internal Content ID
  platform: Platform;
  externalPostId: string;
  viralityScore: number;
  currentMetrics: PostMetrics;
  suggestedBudget: number;  // dollars per day
  suggestedDuration: number; // days
  estimatedAdditionalReach: number;
  estimatedAdditionalLeads: number;
  reason: string;
  priority: "urgent" | "high" | "medium";
  expiresAt: Date;
}

// ─── Virality Analysis ─────────────────────────────────────────────────────────

export function analyzePostPerformance(params: {
  platform: Platform;
  postId: string;
  externalPostId: string;
  metrics: PostMetrics;
  publishedAt: Date;
  averages: PostAverages;
  title?: string;
}): BoostRecommendation | null {
  const { platform, postId, externalPostId, metrics, publishedAt, averages, title } = params;

  // Avoid division by zero — need minimums to compute ratios
  const avgLikes = Math.max(averages.avgLikes, 1);
  const avgComments = Math.max(averages.avgComments, 1);
  const avgShares = Math.max(averages.avgShares, 1);

  // Virality score: how far above average
  const likeRatio = metrics.likes / avgLikes;
  const commentRatio = metrics.comments / avgComments;
  const shareRatio = metrics.shares / avgShares;
  const viralityScore = parseFloat(((likeRatio + commentRatio + shareRatio) / 3).toFixed(2));

  // How old is this post?
  const hoursOld = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);

  // ─── Decision Logic ────────────────────────────────────────────────────────

  let priority: "urgent" | "high" | "medium" | null = null;

  if (viralityScore >= 3.0) {
    // Exceptional performance at any age
    priority = "urgent";
  } else if (viralityScore >= 2.0 && hoursOld <= 2) {
    // Great performance in first 2 hours
    priority = "high";
  } else if (viralityScore >= 1.5 && hoursOld <= 4) {
    // Good performance in first 4 hours
    priority = "medium";
  } else if (viralityScore >= 2.0 && hoursOld <= 6) {
    // Still good within 6 hours
    priority = "medium";
  }

  if (!priority) return null;

  // ─── Budget Calculation ────────────────────────────────────────────────────

  let suggestedBudget: number;
  let suggestedDuration: number;

  if (viralityScore >= 3.0) {
    suggestedBudget = Math.min(50 + Math.round((viralityScore - 3) * 25), 100);
    suggestedDuration = 3;
  } else if (viralityScore >= 2.0) {
    suggestedBudget = 30 + Math.round((viralityScore - 2) * 20);
    suggestedDuration = 3;
  } else {
    suggestedBudget = 20 + Math.round((viralityScore - 1.5) * 20);
    suggestedDuration = 2;
  }

  // ─── Reach Estimation ──────────────────────────────────────────────────────
  // Estimated CPM for legal niche: ~$15-25. We use $20 as baseline.
  const estimatedCPM = 20;
  const totalBudget = suggestedBudget * suggestedDuration;
  const estimatedAdditionalReach = Math.round((totalBudget / estimatedCPM) * 1000);
  // Legal lead conversion from impressions: ~0.1-0.3%
  const estimatedAdditionalLeads = Math.max(1, Math.round(estimatedAdditionalReach * 0.002));

  // ─── Boost Expiration ──────────────────────────────────────────────────────
  // Boosts lose value over time — expire proposal based on virality level
  const expirationHours = priority === "urgent" ? 6 : priority === "high" ? 12 : 24;
  const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

  // ─── Reason Generation ─────────────────────────────────────────────────────

  const postLabel = title ? `"${title}"` : "Este post";
  const viewsInfo = metrics.views ? ` con ${metrics.views.toLocaleString()} views` : "";
  const multiplier = viralityScore.toFixed(1);

  let reason: string;
  if (priority === "urgent") {
    reason = `${postLabel}${viewsInfo} tiene ${multiplier}x m\u00e1s engagement que tu promedio. Rendimiento excepcional. Recomiendo boost de $${suggestedBudget}/d\u00eda por ${suggestedDuration} d\u00edas para maximizar alcance.`;
  } else if (priority === "high") {
    reason = `${postLabel} lleva ${metrics.likes} likes y ${metrics.comments} comentarios en ${Math.round(hoursOld)}h (${multiplier}x tu promedio). Si lo boosteas ahora con $${suggestedBudget}/d\u00eda podr\u00edas alcanzar ${estimatedAdditionalReach.toLocaleString()} personas m\u00e1s.`;
  } else {
    reason = `${postLabel} tiene buen rendimiento (${multiplier}x promedio). Un boost de $${suggestedBudget}/d\u00eda por ${suggestedDuration} d\u00edas podr\u00eda generar ~${estimatedAdditionalLeads} leads adicionales.`;
  }

  return {
    postId,
    platform,
    externalPostId,
    viralityScore,
    currentMetrics: metrics,
    suggestedBudget,
    suggestedDuration,
    estimatedAdditionalReach,
    estimatedAdditionalLeads,
    reason,
    priority,
    expiresAt,
  };
}

// ─── Execute Boost via Meta Ads API ────────────────────────────────────────────
// Creates an ENGAGEMENT campaign using the existing post as creative.
// For FB/IG: uses the post ID as "existing_post" in the creative object_story_id.
// Status: ACTIVE immediately (boost was already approved by human).

export async function executeBoost(params: {
  platform: Platform;
  postId: string;
  externalPostId: string;
  budget: number;        // dollars per day
  duration: number;      // days
  targeting?: {
    cities?: Array<{ key: string; name: string }>;
    locales?: number[];
  };
}): Promise<{ campaignId: string; adSetId: string; adId: string }> {
  const { externalPostId, budget, duration, targeting } = params;
  const accountId = getAdAccountId();

  const endDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);

  // 1. Create campaign (POST_ENGAGEMENT objective)
  const campaign = await adsFetch<{ id: string }>(`/${accountId}/campaigns`, {
    method: "POST",
    body: JSON.stringify({
      name: `Boost — ${externalPostId.substring(0, 20)} — ${new Date().toISOString().split("T")[0]}`,
      objective: "OUTCOME_ENGAGEMENT",
      daily_budget: Math.round(budget * 100), // cents
      status: "ACTIVE", // Boost already approved — go live
      end_time: endDate.toISOString(),
      special_ad_categories: [], // boosts are engagement, not lead gen
    }),
  });

  // 2. Create ad set with default firm targeting
  const defaultCities = [
    { key: "2418956", radius: 25, distance_unit: "mile" }, // Dallas
    { key: "2379574", radius: 25, distance_unit: "mile" }, // Chicago
    { key: "2420379", radius: 25, distance_unit: "mile" }, // LA
    { key: "2425539", radius: 25, distance_unit: "mile" }, // Memphis
  ];

  const metaTargeting: Record<string, unknown> = {
    geo_locations: {
      cities: targeting?.cities?.map(c => ({ key: c.key, radius: 25, distance_unit: "mile" })) || defaultCities,
    },
    locales: targeting?.locales || [24, 6], // Spanish + English
  };

  const adSet = await adsFetch<{ id: string }>(`/${accountId}/adsets`, {
    method: "POST",
    body: JSON.stringify({
      campaign_id: campaign.id,
      name: `Boost AdSet — ${externalPostId.substring(0, 20)}`,
      daily_budget: Math.round(budget * 100),
      targeting: metaTargeting,
      optimization_goal: "POST_ENGAGEMENT",
      billing_event: "IMPRESSIONS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      status: "ACTIVE",
      end_time: endDate.toISOString(),
    }),
  });

  // 3. Create ad using existing post as creative (object_story_id)
  // The object_story_id is the page_post_id format: {page_id}_{post_id}
  const ad = await adsFetch<{ id: string }>(`/${accountId}/ads`, {
    method: "POST",
    body: JSON.stringify({
      name: `Boost Ad — ${externalPostId.substring(0, 20)}`,
      adset_id: adSet.id,
      creative: {
        object_story_id: externalPostId,
      },
      status: "ACTIVE",
    }),
  });

  console.info(`[boost-engine] Boost executed: campaign=${campaign.id}, ad=${ad.id}, $${budget}/day x ${duration} days`);

  return {
    campaignId: campaign.id,
    adSetId: adSet.id,
    adId: ad.id,
  };
}

// ─── Cancel Boost ──────────────────────────────────────────────────────────────

export async function cancelBoost(campaignId: string): Promise<boolean> {
  try {
    await adsFetch(`/${campaignId}`, {
      method: "POST",
      body: JSON.stringify({ status: "PAUSED" }),
    });
    console.info(`[boost-engine] Boost cancelled: ${campaignId}`);
    return true;
  } catch (error) {
    console.error(`[boost-engine] Failed to cancel boost ${campaignId}:`, error);
    return false;
  }
}

// ─── Check if Meta Ads is configured ───────────────────────────────────────────

export function isMetaAdsConfigured(): boolean {
  return !!(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}
