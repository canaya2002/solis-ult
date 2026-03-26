// SOLIS AI — Meta Graph API (Facebook + Instagram) wrapper
import { metaAdsRatelimit } from "@/lib/redis";
import type { MetaPost, MetaComment, MetaInsight } from "@/types/social";

const BASE_URL = "https://graph.facebook.com/v21.0";

function getToken(): string | null {
  return process.env.META_ACCESS_TOKEN || null;
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

async function metaFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  if (!token) throw new Error("API_KEY not configured: META_ACCESS_TOKEN");

  const { success } = await metaAdsRatelimit.limit("meta-graph");
  if (!success) throw new Error("Rate limit exceeded for Meta Graph API");

  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${endpoint}${separator}access_token=${token}`;

  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `Meta API error ${response.status}: ${(err as { error?: { message?: string } }).error?.message || response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

export async function getPagePosts(
  pageId?: string,
  limit = 25
): Promise<MetaPost[]> {
  const id = pageId || process.env.META_PAGE_ID;
  if (!id) return [];
  try {
    const data = await withRetry(() =>
      metaFetch<{
        data: Array<{
          id: string;
          message?: string;
          created_time: string;
          shares?: { count: number };
          likes?: { summary: { total_count: number } };
          comments?: { summary: { total_count: number } };
        }>;
      }>(
        `/${id}/posts?fields=id,message,created_time,shares,likes.summary(true),comments.summary(true)&limit=${limit}`
      )
    );
    const posts: MetaPost[] = data.data.map((p) => ({
      id: p.id,
      message: p.message || "",
      createdTime: p.created_time,
      shares: p.shares?.count || 0,
      likes: p.likes?.summary?.total_count || 0,
      comments: p.comments?.summary?.total_count || 0,
    }));
    console.info(`[meta] getPagePosts: ${posts.length} posts`);
    return posts;
  } catch (error) {
    console.error("[meta] getPagePosts failed:", error);
    return [];
  }
}

export async function publishToFacebook(params: {
  pageId?: string;
  message: string;
  link?: string;
  mediaUrl?: string;
  scheduledTime?: Date;
}): Promise<{ id: string } | { error: string }> {
  const id = params.pageId || process.env.META_PAGE_ID;
  if (!id) return { error: "META_PAGE_ID not configured" };
  try {
    const body: Record<string, string | number | boolean> = {
      message: params.message,
    };
    if (params.link) body.link = params.link;
    if (params.scheduledTime) {
      body.scheduled_publish_time = Math.floor(
        params.scheduledTime.getTime() / 1000
      );
      body.published = false;
    }

    const endpoint = params.mediaUrl ? `/${id}/photos` : `/${id}/feed`;
    if (params.mediaUrl) body.url = params.mediaUrl;

    const result = await withRetry(() =>
      metaFetch<{ id: string }>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      })
    );
    console.info(`[meta] publishToFacebook: ${result.id}`);
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[meta] publishToFacebook failed:", msg);
    return { error: msg };
  }
}

export async function publishToInstagram(params: {
  accountId?: string;
  caption: string;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL";
  scheduledTime?: Date;
}): Promise<{ id: string } | { error: string }> {
  const accountId =
    params.accountId || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (!accountId)
    return { error: "INSTAGRAM_BUSINESS_ACCOUNT_ID not configured" };
  try {
    const containerBody: Record<string, string> = {
      caption: params.caption,
    };
    if (params.mediaType === "VIDEO") {
      containerBody.video_url = params.mediaUrl;
      containerBody.media_type = "VIDEO";
    } else {
      containerBody.image_url = params.mediaUrl;
    }

    const container = await withRetry(() =>
      metaFetch<{ id: string }>(`/${accountId}/media`, {
        method: "POST",
        body: JSON.stringify(containerBody),
      })
    );

    const result = await withRetry(() =>
      metaFetch<{ id: string }>(`/${accountId}/media_publish`, {
        method: "POST",
        body: JSON.stringify({ creation_id: container.id }),
      })
    );

    console.info(`[meta] publishToInstagram: ${result.id}`);
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[meta] publishToInstagram failed:", msg);
    return { error: msg };
  }
}

export async function getComments(postId: string): Promise<MetaComment[]> {
  try {
    const data = await withRetry(() =>
      metaFetch<{
        data: Array<{
          id: string;
          message: string;
          from: { id: string; name: string };
          created_time: string;
        }>;
      }>(`/${postId}/comments?fields=id,message,from,created_time`)
    );
    const comments: MetaComment[] = data.data.map((c) => ({
      id: c.id,
      message: c.message,
      from: c.from,
      createdTime: c.created_time,
    }));
    console.info(`[meta] getComments: ${comments.length} comments`);
    return comments;
  } catch (error) {
    console.error("[meta] getComments failed:", error);
    return [];
  }
}

export async function replyToComment(
  commentId: string,
  message: string
): Promise<{ id: string } | { error: string }> {
  try {
    const result = await withRetry(() =>
      metaFetch<{ id: string }>(`/${commentId}/comments`, {
        method: "POST",
        body: JSON.stringify({ message }),
      })
    );
    console.info(`[meta] replyToComment: ${result.id}`);
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[meta] replyToComment failed:", msg);
    return { error: msg };
  }
}

export async function getPageInsights(
  pageId?: string,
  period: "day" | "week" | "month" = "day",
  metrics: string[] = [
    "page_impressions",
    "page_engaged_users",
    "page_fans",
    "page_views_total",
  ]
): Promise<MetaInsight[]> {
  const id = pageId || process.env.META_PAGE_ID;
  if (!id) return [];
  try {
    const data = await withRetry(() =>
      metaFetch<{
        data: Array<{
          name: string;
          period: string;
          values: Array<{ value: number; end_time: string }>;
        }>;
      }>(
        `/${id}/insights?metric=${metrics.join(",")}&period=${period}`
      )
    );
    const insights: MetaInsight[] = data.data.map((i) => ({
      name: i.name,
      period: i.period,
      values: i.values.map((v) => ({ value: v.value, endTime: v.end_time })),
    }));
    console.info(`[meta] getPageInsights: ${insights.length} metrics`);
    return insights;
  } catch (error) {
    console.error("[meta] getPageInsights failed:", error);
    return [];
  }
}

export async function getInstagramInsights(
  accountId?: string,
  period: "day" | "week" | "month" = "day"
): Promise<MetaInsight[]> {
  const id = accountId || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (!id) return [];
  try {
    const metrics = "impressions,reach,profile_views,follower_count";
    const data = await withRetry(() =>
      metaFetch<{
        data: Array<{
          name: string;
          period: string;
          values: Array<{ value: number; end_time: string }>;
        }>;
      }>(`/${id}/insights?metric=${metrics}&period=${period}`)
    );
    const insights: MetaInsight[] = data.data.map((i) => ({
      name: i.name,
      period: i.period,
      values: i.values.map((v) => ({ value: v.value, endTime: v.end_time })),
    }));
    console.info(`[meta] getInstagramInsights: ${insights.length} metrics`);
    return insights;
  } catch (error) {
    console.error("[meta] getInstagramInsights failed:", error);
    return [];
  }
}

export async function sendMessage(
  pageId: string | undefined,
  recipientId: string,
  message: string
): Promise<void> {
  const id = pageId || process.env.META_PAGE_ID;
  if (!id) {
    console.error("[meta] sendMessage: META_PAGE_ID not configured");
    return;
  }
  try {
    await withRetry(() =>
      metaFetch("/me/messages", {
        method: "POST",
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: message },
        }),
      })
    );
    console.info(`[meta] sendMessage to ${recipientId}`);
  } catch (error) {
    console.error("[meta] sendMessage failed:", error);
  }
}
