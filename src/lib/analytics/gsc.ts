// SOLIS AI — Google Search Console API wrapper
import { ratelimit, redis } from "@/lib/redis";
import type {
  SearchPerformanceRow,
  OptimizationOpportunity,
} from "@/types/analytics";

const BASE_URL = "https://www.googleapis.com/webmasters/v3";
const OAUTH_URL = "https://oauth2.googleapis.com/token";
const CACHE_TTL = 3600;

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

async function getAccessToken(): Promise<string> {
  const cached = await redis.get<string>("gsc:access_token");
  if (cached) return cached;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "API_KEY not configured: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN"
    );
  }

  const response = await fetch(OAUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) throw new Error("Failed to refresh Google access token");
  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  await redis.set("gsc:access_token", data.access_token, {
    ex: data.expires_in - 60,
  });
  return data.access_token;
}

type GSCRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};
type GSCResponse = { rows?: GSCRow[] };

export async function getSearchPerformance(
  site?: string,
  params?: {
    startDate: string;
    endDate: string;
    dimensions?: string[];
    rowLimit?: number;
  }
): Promise<SearchPerformanceRow[]> {
  const siteUrl = site || process.env.GOOGLE_SEARCH_CONSOLE_SITE;
  if (!siteUrl) return [];

  const startDate = params?.startDate || "2024-01-01";
  const endDate = params?.endDate || new Date().toISOString().split("T")[0];
  const dimensions = params?.dimensions || ["query"];
  const rowLimit = params?.rowLimit || 100;

  const cacheKey = `gsc:perf:${siteUrl}:${dimensions.join(",")}:${startDate}`;
  const cached = await redis.get<SearchPerformanceRow[]>(cacheKey);
  if (cached) return cached;

  try {
    const { success } = await ratelimit.limit("gsc");
    if (!success) throw new Error("Rate limit exceeded for GSC API");

    const token = await getAccessToken();
    const encodedSite = encodeURIComponent(siteUrl);

    const response = await fetch(
      `${BASE_URL}/sites/${encodedSite}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions,
          rowLimit,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        `GSC API error ${response.status}: ${JSON.stringify(err)}`
      );
    }

    const data = (await response.json()) as GSCResponse;
    const rows: SearchPerformanceRow[] = (data.rows || []).map((r) => ({
      keys: r.keys,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: Math.round(r.ctr * 10000) / 100,
      position: Math.round(r.position * 10) / 10,
    }));

    await redis.set(cacheKey, rows, { ex: CACHE_TTL });
    console.info(`[gsc] getSearchPerformance: ${rows.length} rows`);
    return rows;
  } catch (error) {
    console.error("[gsc] getSearchPerformance failed:", error);
    return [];
  }
}

export async function getTopQueries(
  site?: string,
  dateRange?: { startDate: string; endDate: string },
  limit = 50
): Promise<SearchPerformanceRow[]> {
  const startDate = dateRange?.startDate || "2024-01-01";
  const endDate =
    dateRange?.endDate || new Date().toISOString().split("T")[0];

  const rows = await getSearchPerformance(site, {
    startDate,
    endDate,
    dimensions: ["query"],
    rowLimit: limit,
  });

  return rows.sort((a, b) => b.impressions - a.impressions);
}

export async function getTopPages(
  site?: string,
  dateRange?: { startDate: string; endDate: string },
  limit = 50
): Promise<SearchPerformanceRow[]> {
  const startDate = dateRange?.startDate || "2024-01-01";
  const endDate =
    dateRange?.endDate || new Date().toISOString().split("T")[0];

  const rows = await getSearchPerformance(site, {
    startDate,
    endDate,
    dimensions: ["page"],
    rowLimit: limit,
  });

  return rows.sort((a, b) => b.impressions - a.impressions);
}

export async function getPagesNeedingOptimization(
  site?: string
): Promise<OptimizationOpportunity[]> {
  try {
    const rows = await getSearchPerformance(site, {
      startDate: new Date(Date.now() - 28 * 86400000)
        .toISOString()
        .split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      dimensions: ["query", "page"],
      rowLimit: 500,
    });

    const opportunities: OptimizationOpportunity[] = rows
      .filter(
        (r) =>
          r.impressions > 100 && (r.ctr < 2 || (r.position >= 4 && r.position <= 20))
      )
      .map((r) => {
        let suggestion = "";
        if (r.position >= 4 && r.position <= 10) {
          suggestion =
            "Casi en top 3 — optimizar title tag y meta description para CTR";
        } else if (r.position > 10 && r.position <= 20) {
          suggestion =
            "Casi en page 1 — agregar contenido relevante y internal links";
        } else if (r.ctr < 2) {
          suggestion =
            "CTR bajo — reescribir title tag y meta description para ser más atractivo";
        }
        return {
          page: r.keys[1] || "",
          query: r.keys[0] || "",
          impressions: r.impressions,
          clicks: r.clicks,
          ctr: r.ctr,
          position: r.position,
          suggestion,
        };
      })
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 20);

    console.info(
      `[gsc] getPagesNeedingOptimization: ${opportunities.length} opportunities`
    );
    return opportunities;
  } catch (error) {
    console.error("[gsc] getPagesNeedingOptimization failed:", error);
    return [];
  }
}

export async function getQueryGaps(
  site?: string
): Promise<SearchPerformanceRow[]> {
  try {
    const rows = await getSearchPerformance(site, {
      startDate: new Date(Date.now() - 28 * 86400000)
        .toISOString()
        .split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      dimensions: ["query"],
      rowLimit: 500,
    });

    const gaps = rows
      .filter((r) => r.impressions > 50 && r.ctr < 1)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 30);

    console.info(`[gsc] getQueryGaps: ${gaps.length} query gaps`);
    return gaps;
  } catch (error) {
    console.error("[gsc] getQueryGaps failed:", error);
    return [];
  }
}
