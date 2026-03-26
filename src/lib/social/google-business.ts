// SOLIS AI — Google Business Profile API wrapper
import { ratelimit, redis } from "@/lib/redis";
import type { GoogleReview, LocationMetrics } from "@/types/social";

const BASE_URL = "https://mybusiness.googleapis.com/v4";
const OAUTH_URL = "https://oauth2.googleapis.com/token";

const OFFICE_LOCATIONS: Record<string, string | undefined> = {
  Dallas: process.env.GOOGLE_BUSINESS_LOCATION_DALLAS,
  Chicago: process.env.GOOGLE_BUSINESS_LOCATION_CHICAGO,
  "Los Angeles": process.env.GOOGLE_BUSINESS_LOCATION_LA,
  Memphis: process.env.GOOGLE_BUSINESS_LOCATION_MEMPHIS,
};

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
  const cached = await redis.get<string>("gbp:access_token");
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
  await redis.set("gbp:access_token", data.access_token, {
    ex: data.expires_in - 60,
  });
  return data.access_token;
}

async function gbpFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { success } = await ratelimit.limit("gbp");
  if (!success) throw new Error("Rate limit exceeded for GBP API");

  const token = await getAccessToken();
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `GBP API error ${response.status}: ${JSON.stringify(err)}`
    );
  }
  return response.json() as Promise<T>;
}

export async function getReviews(
  locationName: string
): Promise<GoogleReview[]> {
  try {
    type ReviewsResponse = {
      reviews?: Array<{
        name: string;
        reviewer: { displayName: string };
        starRating: string;
        comment?: string;
        createTime: string;
        reviewReply?: { comment: string; updateTime: string };
      }>;
    };

    const data = await withRetry(() =>
      gbpFetch<ReviewsResponse>(`/${locationName}/reviews`)
    );

    const ratingMap: Record<string, number> = {
      ONE: 1,
      TWO: 2,
      THREE: 3,
      FOUR: 4,
      FIVE: 5,
    };

    const reviews: GoogleReview[] = (data.reviews || []).map((r) => ({
      reviewId: r.name.split("/").pop() || r.name,
      reviewer: { displayName: r.reviewer.displayName },
      starRating: ratingMap[r.starRating] || 0,
      comment: r.comment || "",
      createTime: r.createTime,
      reviewReply: r.reviewReply
        ? {
            comment: r.reviewReply.comment,
            updateTime: r.reviewReply.updateTime,
          }
        : undefined,
    }));
    console.info(`[gbp] getReviews: ${reviews.length} reviews`);
    return reviews;
  } catch (error) {
    console.error("[gbp] getReviews failed:", error);
    return [];
  }
}

export async function replyToReview(
  reviewName: string,
  comment: string
): Promise<boolean> {
  try {
    await withRetry(() =>
      gbpFetch(`/${reviewName}/reply`, {
        method: "PUT",
        body: JSON.stringify({ comment }),
      })
    );
    console.info(`[gbp] replyToReview: ${reviewName}`);
    return true;
  } catch (error) {
    console.error("[gbp] replyToReview failed:", error);
    return false;
  }
}

export async function getLocationMetrics(
  locationName: string,
  dateRange: { startDate: string; endDate: string }
): Promise<LocationMetrics> {
  const fallback: LocationMetrics = {
    totalReviews: 0,
    averageRating: 0,
    reviewsThisPeriod: 0,
  };
  try {
    const reviews = await getReviews(locationName);
    const total = reviews.length;
    const avg =
      total > 0
        ? reviews.reduce((s, r) => s + r.starRating, 0) / total
        : 0;
    const periodReviews = reviews.filter((r) => {
      const created = new Date(r.createTime);
      return (
        created >= new Date(dateRange.startDate) &&
        created <= new Date(dateRange.endDate)
      );
    }).length;

    const metrics: LocationMetrics = {
      totalReviews: total,
      averageRating: Math.round(avg * 10) / 10,
      reviewsThisPeriod: periodReviews,
    };
    console.info(
      `[gbp] getLocationMetrics: ${total} reviews, ${metrics.averageRating} avg`
    );
    return metrics;
  } catch (error) {
    console.error("[gbp] getLocationMetrics failed:", error);
    return fallback;
  }
}

export async function getAllOfficeReviews(): Promise<
  Record<string, GoogleReview[]>
> {
  const result: Record<string, GoogleReview[]> = {};
  const accountId = process.env.GOOGLE_BUSINESS_ACCOUNT_ID;
  if (!accountId) {
    console.error("[gbp] GOOGLE_BUSINESS_ACCOUNT_ID not configured");
    return result;
  }

  for (const [office, locationId] of Object.entries(OFFICE_LOCATIONS)) {
    if (!locationId) {
      console.info(`[gbp] No location ID for ${office}, skipping`);
      result[office] = [];
      continue;
    }
    const locationName = `${accountId}/${locationId}`;
    result[office] = await getReviews(locationName);
  }

  const total = Object.values(result).reduce(
    (s, reviews) => s + reviews.length,
    0
  );
  console.info(
    `[gbp] getAllOfficeReviews: ${total} total across ${Object.keys(result).length} offices`
  );
  return result;
}
