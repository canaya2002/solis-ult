// SOLIS AI — Google Analytics 4 Data API wrapper
import { ratelimit, redis } from "@/lib/redis";
import type {
  TrafficOverview,
  TrafficBySource,
  TopPage,
  ConversionData,
} from "@/types/analytics";

const BASE_URL = "https://analyticsdata.googleapis.com/v1beta";
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
  const cached = await redis.get<string>("ga4:access_token");
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
  await redis.set("ga4:access_token", data.access_token, {
    ex: data.expires_in - 60,
  });
  return data.access_token;
}

async function ga4Report<T>(
  propertyId: string,
  body: Record<string, unknown>
): Promise<T> {
  const { success } = await ratelimit.limit("ga4");
  if (!success) throw new Error("Rate limit exceeded for GA4 API");

  const token = await getAccessToken();
  const response = await fetch(
    `${BASE_URL}/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `GA4 API error ${response.status}: ${JSON.stringify(err)}`
    );
  }
  return response.json() as Promise<T>;
}

type GA4Row = {
  dimensionValues?: Array<{ value: string }>;
  metricValues: Array<{ value: string }>;
};
type GA4Response = { rows?: GA4Row[] };

export async function getTrafficOverview(
  propertyId?: string,
  dateRange?: { startDate: string; endDate: string }
): Promise<TrafficOverview> {
  const pid = propertyId || process.env.GA4_PROPERTY_ID;
  const empty: TrafficOverview = {
    totalSessions: 0,
    totalUsers: 0,
    pageviews: 0,
    bounceRate: 0,
    avgDuration: 0,
    dailyData: [],
  };
  if (!pid) return empty;

  const cacheKey = `ga4:overview:${pid}:${dateRange?.startDate || "30d"}`;
  const cached = await redis.get<TrafficOverview>(cacheKey);
  if (cached) return cached;

  const start = dateRange?.startDate || "30daysAgo";
  const end = dateRange?.endDate || "today";

  try {
    const data = await withRetry(() =>
      ga4Report<GA4Response>(pid, {
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "screenPageViews" },
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
        ],
      })
    );

    const rows = data.rows || [];
    let totalSessions = 0;
    let totalUsers = 0;
    let pageviews = 0;
    let bounceSum = 0;
    let durationSum = 0;

    const dailyData = rows.map((row) => {
      const sessions = parseInt(row.metricValues[0].value, 10);
      const users = parseInt(row.metricValues[1].value, 10);
      totalSessions += sessions;
      totalUsers += users;
      pageviews += parseInt(row.metricValues[2].value, 10);
      bounceSum += parseFloat(row.metricValues[3].value);
      durationSum += parseFloat(row.metricValues[4].value);
      return {
        date: row.dimensionValues?.[0].value || "",
        sessions,
        users,
      };
    });

    const count = rows.length || 1;
    const result: TrafficOverview = {
      totalSessions,
      totalUsers,
      pageviews,
      bounceRate: Math.round((bounceSum / count) * 10000) / 100,
      avgDuration: Math.round(durationSum / count),
      dailyData,
    };
    await redis.set(cacheKey, result, { ex: CACHE_TTL });
    console.info(
      `[ga4] getTrafficOverview: ${totalSessions} sessions, ${totalUsers} users`
    );
    return result;
  } catch (error) {
    console.error("[ga4] getTrafficOverview failed:", error);
    return empty;
  }
}

export async function getTrafficBySource(
  propertyId?: string,
  dateRange?: { startDate: string; endDate: string }
): Promise<TrafficBySource[]> {
  const pid = propertyId || process.env.GA4_PROPERTY_ID;
  if (!pid) return [];

  const cacheKey = `ga4:sources:${pid}:${dateRange?.startDate || "30d"}`;
  const cached = await redis.get<TrafficBySource[]>(cacheKey);
  if (cached) return cached;

  const start = dateRange?.startDate || "30daysAgo";
  const end = dateRange?.endDate || "today";

  try {
    const data = await withRetry(() =>
      ga4Report<GA4Response>(pid, {
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: [
          { name: "sessionSource" },
          { name: "sessionMedium" },
        ],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "bounceRate" },
        ],
        orderBys: [
          { metric: { metricName: "sessions" }, desc: true },
        ],
        limit: 20,
      })
    );

    const result: TrafficBySource[] = (data.rows || []).map((row) => ({
      source: row.dimensionValues?.[0].value || "(direct)",
      medium: row.dimensionValues?.[1].value || "(none)",
      sessions: parseInt(row.metricValues[0].value, 10),
      users: parseInt(row.metricValues[1].value, 10),
      bounceRate:
        Math.round(parseFloat(row.metricValues[2].value) * 10000) / 100,
    }));
    await redis.set(cacheKey, result, { ex: CACHE_TTL });
    console.info(`[ga4] getTrafficBySource: ${result.length} sources`);
    return result;
  } catch (error) {
    console.error("[ga4] getTrafficBySource failed:", error);
    return [];
  }
}

export async function getTopPages(
  propertyId?: string,
  limit = 20
): Promise<TopPage[]> {
  const pid = propertyId || process.env.GA4_PROPERTY_ID;
  if (!pid) return [];

  const cacheKey = `ga4:pages:${pid}`;
  const cached = await redis.get<TopPage[]>(cacheKey);
  if (cached) return cached;

  try {
    const data = await withRetry(() =>
      ga4Report<GA4Response>(pid, {
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "pagePath" }],
        metrics: [
          { name: "screenPageViews" },
          { name: "sessions" },
          { name: "bounceRate" },
        ],
        orderBys: [
          { metric: { metricName: "screenPageViews" }, desc: true },
        ],
        limit,
      })
    );

    const result: TopPage[] = (data.rows || []).map((row) => ({
      path: row.dimensionValues?.[0].value || "/",
      pageviews: parseInt(row.metricValues[0].value, 10),
      sessions: parseInt(row.metricValues[1].value, 10),
      bounceRate:
        Math.round(parseFloat(row.metricValues[2].value) * 10000) / 100,
    }));
    await redis.set(cacheKey, result, { ex: CACHE_TTL });
    console.info(`[ga4] getTopPages: ${result.length} pages`);
    return result;
  } catch (error) {
    console.error("[ga4] getTopPages failed:", error);
    return [];
  }
}

export async function getConversions(
  propertyId?: string,
  dateRange?: { startDate: string; endDate: string }
): Promise<ConversionData[]> {
  const pid = propertyId || process.env.GA4_PROPERTY_ID;
  if (!pid) return [];

  const start = dateRange?.startDate || "30daysAgo";
  const end = dateRange?.endDate || "today";

  try {
    const data = await withRetry(() =>
      ga4Report<GA4Response>(pid, {
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: [{ name: "eventName" }],
        metrics: [
          { name: "eventCount" },
          { name: "eventValue" },
        ],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            inListFilter: {
              values: [
                "generate_lead",
                "form_submit",
                "phone_call",
                "contact",
                "purchase",
              ],
            },
          },
        },
      })
    );

    const result: ConversionData[] = (data.rows || []).map((row) => ({
      eventName: row.dimensionValues?.[0].value || "",
      count: parseInt(row.metricValues[0].value, 10),
      value: parseFloat(row.metricValues[1].value),
    }));
    console.info(`[ga4] getConversions: ${result.length} events`);
    return result;
  } catch (error) {
    console.error("[ga4] getConversions failed:", error);
    return [];
  }
}
