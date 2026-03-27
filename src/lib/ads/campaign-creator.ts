// SOLIS AI — Meta Marketing API: Campaign Creation
// RULE: Everything is created as PAUSED. Human approval required to activate.
// Immigration ads REQUIRE specialAdCategories: ['HOUSING'] which limits targeting.
import { metaAdsRatelimit } from "@/lib/redis";

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

function getPageId(): string {
  const id = process.env.META_PAGE_ID;
  if (!id) throw new Error("META_PAGE_ID not configured");
  return id;
}

async function adsFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const { success } = await metaAdsRatelimit.limit("meta-ads-create");
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

// ─── Immigration Ad Rules ──────────────────────────────────────────────────────
// Meta requires specialAdCategories: ['HOUSING'] for immigration services.
// This DISABLES targeting by: age, gender, zip code, detailed demographics.

export function isImmigrationCampaign(objective: string, name: string): boolean {
  const keywords = ["inmigra", "asilo", "tps", "visa", "deporta", "residencia", "ciudadan", "uscis", "green card"];
  const lower = (objective + " " + name).toLowerCase();
  return keywords.some(k => lower.includes(k));
}

function sanitizeTargetingForHousing(targeting: AdSetTargeting): AdSetTargeting {
  // Housing category restrictions: no age, gender, zip code targeting
  return {
    ...targeting,
    ageMin: undefined,
    ageMax: undefined,
    genders: undefined,
    geoLocations: {
      ...targeting.geoLocations,
      // Cities are OK, but radius must be >= 15 miles (Meta enforces this)
    },
  };
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CampaignObjective = "OUTCOME_LEADS" | "OUTCOME_TRAFFIC" | "OUTCOME_ENGAGEMENT" | "OUTCOME_CONVERSIONS";

export interface CreateCampaignParams {
  name: string;
  objective: CampaignObjective;
  dailyBudget: number; // in cents
  startDate?: Date;
  endDate?: Date;
  specialAdCategories?: string[];
  status?: "PAUSED"; // ALWAYS paused
}

export interface AdSetTargeting {
  ageMin?: number;
  ageMax?: number;
  genders?: number[];
  geoLocations: {
    cities?: Array<{ key: string; name: string; radius?: number; distanceUnit?: string }>;
    regions?: Array<{ key: string }>;
    countries?: string[];
  };
  locales?: number[];
  interests?: Array<{ id: string; name: string }>;
  customAudiences?: Array<{ id: string }>;
  excludedCustomAudiences?: Array<{ id: string }>;
}

export interface CreateAdSetParams {
  campaignId: string;
  name: string;
  dailyBudget: number; // in cents
  targeting: AdSetTargeting;
  optimizationGoal: "LEAD_GENERATION" | "LINK_CLICKS" | "IMPRESSIONS";
  billingEvent: "IMPRESSIONS";
  bidStrategy?: "LOWEST_COST_WITHOUT_CAP" | "COST_CAP";
  costCap?: number;
  placements?: "automatic" | { platforms: string[]; positions: string[] };
  status?: "PAUSED";
  isHousingCategory?: boolean;
}

export interface CreateAdParams {
  adSetId: string;
  name: string;
  creative: {
    pageId?: string;
    message: string;
    link?: string;
    imageHash?: string;
    videoId?: string;
    callToAction: {
      type: "LEARN_MORE" | "SIGN_UP" | "CONTACT_US" | "BOOK_NOW" | "GET_QUOTE";
      link: string;
    };
  };
  status?: "PAUSED";
}

// ─── Campaign Creation ─────────────────────────────────────────────────────────

export async function createCampaign(params: CreateCampaignParams): Promise<{ campaignId: string }> {
  const accountId = getAdAccountId();
  const isImmigration = isImmigrationCampaign(params.objective, params.name);
  const specialCategories = params.specialAdCategories || (isImmigration ? ["HOUSING"] : []);

  const body: Record<string, unknown> = {
    name: params.name,
    objective: params.objective,
    daily_budget: params.dailyBudget,
    status: "PAUSED", // ALWAYS PAUSED — human activates
    special_ad_categories: specialCategories,
  };

  if (params.startDate) body.start_time = params.startDate.toISOString();
  if (params.endDate) body.end_time = params.endDate.toISOString();

  const result = await adsFetch<{ id: string }>(`/${accountId}/campaigns`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  console.info(`[campaign-creator] Created campaign ${result.id} (PAUSED): ${params.name}`);
  return { campaignId: result.id };
}

// ─── Ad Set Creation ───────────────────────────────────────────────────────────

export async function createAdSet(params: CreateAdSetParams): Promise<{ adSetId: string }> {
  const accountId = getAdAccountId();

  // Apply housing category targeting restrictions if needed
  const targeting = params.isHousingCategory
    ? sanitizeTargetingForHousing(params.targeting)
    : params.targeting;

  // Build Meta API targeting object
  const metaTargeting: Record<string, unknown> = {
    geo_locations: {
      ...(targeting.geoLocations.cities?.length
        ? { cities: targeting.geoLocations.cities.map(c => ({ key: c.key, radius: c.radius || 25, distance_unit: c.distanceUnit || "mile" })) }
        : {}),
      ...(targeting.geoLocations.regions?.length
        ? { regions: targeting.geoLocations.regions }
        : {}),
      ...(targeting.geoLocations.countries?.length
        ? { countries: targeting.geoLocations.countries }
        : {}),
    },
  };

  if (targeting.ageMin) metaTargeting.age_min = targeting.ageMin;
  if (targeting.ageMax) metaTargeting.age_max = targeting.ageMax;
  if (targeting.genders?.length) metaTargeting.genders = targeting.genders;
  if (targeting.locales?.length) metaTargeting.locales = targeting.locales;
  if (targeting.interests?.length) {
    metaTargeting.flexible_spec = [{ interests: targeting.interests }];
  }
  if (targeting.customAudiences?.length) {
    metaTargeting.custom_audiences = targeting.customAudiences;
  }
  if (targeting.excludedCustomAudiences?.length) {
    metaTargeting.excluded_custom_audiences = targeting.excludedCustomAudiences;
  }

  const body: Record<string, unknown> = {
    campaign_id: params.campaignId,
    name: params.name,
    daily_budget: params.dailyBudget,
    targeting: metaTargeting,
    optimization_goal: params.optimizationGoal,
    billing_event: params.billingEvent || "IMPRESSIONS",
    bid_strategy: params.bidStrategy || "LOWEST_COST_WITHOUT_CAP",
    status: "PAUSED",
  };

  if (params.costCap) body.bid_amount = params.costCap;

  // Automatic placements by default
  if (params.placements && params.placements !== "automatic") {
    body.targeting = {
      ...metaTargeting,
      publisher_platforms: params.placements.platforms,
      facebook_positions: params.placements.positions.filter(p => p.startsWith("facebook_")),
      instagram_positions: params.placements.positions.filter(p => p.startsWith("instagram_")),
    };
  }

  const result = await adsFetch<{ id: string }>(`/${accountId}/adsets`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  console.info(`[campaign-creator] Created ad set ${result.id} (PAUSED): ${params.name}`);
  return { adSetId: result.id };
}

// ─── Ad Creation ───────────────────────────────────────────────────────────────

export async function createAd(params: CreateAdParams): Promise<{ adId: string }> {
  const accountId = getAdAccountId();
  const pageId = params.creative.pageId || getPageId();

  // Build creative object
  const objectStorySpec: Record<string, unknown> = {
    page_id: pageId,
  };

  if (params.creative.imageHash) {
    objectStorySpec.link_data = {
      message: params.creative.message,
      link: params.creative.callToAction.link,
      image_hash: params.creative.imageHash,
      call_to_action: {
        type: params.creative.callToAction.type,
        value: { link: params.creative.callToAction.link },
      },
    };
  } else if (params.creative.videoId) {
    objectStorySpec.video_data = {
      video_id: params.creative.videoId,
      message: params.creative.message,
      call_to_action: {
        type: params.creative.callToAction.type,
        value: { link: params.creative.callToAction.link },
      },
    };
  } else {
    // Text-only or link ad
    objectStorySpec.link_data = {
      message: params.creative.message,
      link: params.creative.link || params.creative.callToAction.link,
      call_to_action: {
        type: params.creative.callToAction.type,
        value: { link: params.creative.callToAction.link },
      },
    };
  }

  // First create the ad creative
  const creative = await adsFetch<{ id: string }>(`/${accountId}/adcreatives`, {
    method: "POST",
    body: JSON.stringify({
      name: `Creative — ${params.name}`,
      object_story_spec: objectStorySpec,
    }),
  });

  // Then create the ad referencing the creative
  const result = await adsFetch<{ id: string }>(`/${accountId}/ads`, {
    method: "POST",
    body: JSON.stringify({
      name: params.name,
      adset_id: params.adSetId,
      creative: { creative_id: creative.id },
      status: "PAUSED",
    }),
  });

  console.info(`[campaign-creator] Created ad ${result.id} (PAUSED): ${params.name}`);
  return { adId: result.id };
}

// ─── Media Upload ──────────────────────────────────────────────────────────────

export async function uploadAdImage(imageUrl: string): Promise<{ imageHash: string }> {
  const accountId = getAdAccountId();
  const token = getToken();

  const { success } = await metaAdsRatelimit.limit("meta-ads-upload");
  if (!success) throw new Error("Rate limit exceeded");

  // Meta accepts image URL directly
  const formData = new URLSearchParams();
  formData.append("url", imageUrl);
  formData.append("access_token", token);

  const response = await fetch(`${BASE_URL}/${accountId}/adimages`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Image upload failed: ${(err as { error?: { message?: string } }).error?.message || response.statusText}`);
  }

  const data = await response.json() as { images: Record<string, { hash: string }> };
  const imageHash = Object.values(data.images)[0]?.hash;
  if (!imageHash) throw new Error("Image upload returned no hash");

  console.info(`[campaign-creator] Uploaded image: ${imageHash}`);
  return { imageHash };
}

export async function uploadAdVideo(videoUrl: string): Promise<{ videoId: string }> {
  const accountId = getAdAccountId();
  const token = getToken();

  const { success } = await metaAdsRatelimit.limit("meta-ads-upload");
  if (!success) throw new Error("Rate limit exceeded");

  const formData = new URLSearchParams();
  formData.append("file_url", videoUrl);
  formData.append("access_token", token);

  const response = await fetch(`${BASE_URL}/${accountId}/advideos`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Video upload failed: ${(err as { error?: { message?: string } }).error?.message || response.statusText}`);
  }

  const data = await response.json() as { id: string };
  console.info(`[campaign-creator] Uploaded video: ${data.id}`);
  return { videoId: data.id };
}

// ─── Activate Campaign (requires separate human approval) ──────────────────────

export async function activateFullCampaign(campaignId: string): Promise<boolean> {
  try {
    await adsFetch(`/${campaignId}`, {
      method: "POST",
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    console.info(`[campaign-creator] Activated campaign ${campaignId}`);
    return true;
  } catch (error) {
    console.error(`[campaign-creator] Failed to activate ${campaignId}:`, error);
    return false;
  }
}
