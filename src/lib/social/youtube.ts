// SOLIS AI — YouTube Data API v3 wrapper
import { ratelimit, redis } from "@/lib/redis";
import type {
  YouTubeChannelStats,
  YouTubeVideo,
  YouTubeVideoStats,
  YouTubeSearchResult,
} from "@/types/social";

const BASE_URL = "https://www.googleapis.com/youtube/v3";
const OAUTH_URL = "https://oauth2.googleapis.com/token";

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
  const cached = await redis.get<string>("youtube:access_token");
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
  await redis.set("youtube:access_token", data.access_token, {
    ex: data.expires_in - 60,
  });
  return data.access_token;
}

async function ytFetch<T>(endpoint: string): Promise<T> {
  const { success } = await ratelimit.limit("youtube");
  if (!success) throw new Error("Rate limit exceeded for YouTube API");

  const token = await getAccessToken();
  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${endpoint}${separator}access_token=${token}`;

  const response = await fetch(url);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `YouTube API error ${response.status}: ${JSON.stringify(err)}`
    );
  }
  return response.json() as Promise<T>;
}

async function ytFetchWrite<T>(
  endpoint: string,
  options: RequestInit
): Promise<T> {
  const { success } = await ratelimit.limit("youtube-write");
  if (!success) throw new Error("Rate limit exceeded for YouTube API");

  const token = await getAccessToken();
  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${endpoint}${separator}access_token=${token}`;

  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `YouTube API error ${response.status}: ${JSON.stringify(err)}`
    );
  }
  return response.json() as Promise<T>;
}

export async function getChannelStats(
  channelId?: string
): Promise<YouTubeChannelStats | null> {
  const id = channelId || process.env.YOUTUBE_CHANNEL_ID;
  if (!id) return null;

  const cacheKey = `yt:channel:${id}`;
  const cached = await redis.get<YouTubeChannelStats>(cacheKey);
  if (cached) return cached;

  try {
    type ChannelResponse = {
      items: Array<{
        snippet: { title: string };
        statistics: {
          subscriberCount: string;
          viewCount: string;
          videoCount: string;
        };
      }>;
    };

    const data = await withRetry(() =>
      ytFetch<ChannelResponse>(
        `/channels?part=statistics,snippet&id=${id}`
      )
    );

    if (!data.items.length) return null;

    const item = data.items[0];
    const stats: YouTubeChannelStats = {
      subscriberCount: parseInt(item.statistics.subscriberCount, 10),
      viewCount: parseInt(item.statistics.viewCount, 10),
      videoCount: parseInt(item.statistics.videoCount, 10),
      channelTitle: item.snippet.title,
    };
    await redis.set(cacheKey, stats, { ex: 3600 });
    console.info(`[youtube] getChannelStats: ${stats.channelTitle}`);
    return stats;
  } catch (error) {
    console.error("[youtube] getChannelStats failed:", error);
    return null;
  }
}

export async function getVideos(
  channelId?: string,
  maxResults = 10
): Promise<YouTubeVideo[]> {
  const id = channelId || process.env.YOUTUBE_CHANNEL_ID;
  if (!id) return [];
  try {
    type SearchResponse = {
      items: Array<{ id: { videoId: string } }>;
    };
    type VideoResponse = {
      items: Array<{
        id: string;
        snippet: {
          title: string;
          description: string;
          publishedAt: string;
          thumbnails: { high?: { url: string } };
        };
        statistics: {
          viewCount: string;
          likeCount: string;
          commentCount: string;
        };
      }>;
    };

    const search = await withRetry(() =>
      ytFetch<SearchResponse>(
        `/search?channelId=${id}&type=video&order=date&part=snippet&maxResults=${maxResults}`
      )
    );

    const videoIds = search.items.map((i) => i.id.videoId).join(",");
    if (!videoIds) return [];

    const details = await withRetry(() =>
      ytFetch<VideoResponse>(
        `/videos?part=statistics,snippet&id=${videoIds}`
      )
    );

    const videos: YouTubeVideo[] = details.items.map((v) => ({
      id: v.id,
      title: v.snippet.title,
      description: v.snippet.description,
      publishedAt: v.snippet.publishedAt,
      thumbnailUrl: v.snippet.thumbnails.high?.url || "",
      viewCount: parseInt(v.statistics.viewCount || "0", 10),
      likeCount: parseInt(v.statistics.likeCount || "0", 10),
      commentCount: parseInt(v.statistics.commentCount || "0", 10),
    }));
    console.info(`[youtube] getVideos: ${videos.length} videos`);
    return videos;
  } catch (error) {
    console.error("[youtube] getVideos failed:", error);
    return [];
  }
}

export async function getVideoAnalytics(
  videoId: string
): Promise<YouTubeVideoStats | null> {
  const cacheKey = `yt:video:${videoId}`;
  const cached = await redis.get<YouTubeVideoStats>(cacheKey);
  if (cached) return cached;
  try {
    type VideoResponse = {
      items: Array<{
        statistics: {
          viewCount: string;
          likeCount: string;
          commentCount: string;
          favoriteCount: string;
        };
      }>;
    };

    const data = await withRetry(() =>
      ytFetch<VideoResponse>(
        `/videos?part=statistics&id=${videoId}`
      )
    );
    if (!data.items.length) return null;
    const s = data.items[0].statistics;
    const stats: YouTubeVideoStats = {
      viewCount: parseInt(s.viewCount || "0", 10),
      likeCount: parseInt(s.likeCount || "0", 10),
      commentCount: parseInt(s.commentCount || "0", 10),
      favoriteCount: parseInt(s.favoriteCount || "0", 10),
    };
    await redis.set(cacheKey, stats, { ex: 1800 });
    console.info(`[youtube] getVideoAnalytics: ${videoId}`);
    return stats;
  } catch (error) {
    console.error("[youtube] getVideoAnalytics failed:", error);
    return null;
  }
}

export async function updateVideoMetadata(
  videoId: string,
  params: { title?: string; description?: string; tags?: string[] }
): Promise<boolean> {
  try {
    type VideoResponse = {
      items: Array<{
        snippet: {
          title: string;
          description: string;
          tags: string[];
          categoryId: string;
        };
      }>;
    };
    const current = await withRetry(() =>
      ytFetch<VideoResponse>(
        `/videos?part=snippet&id=${videoId}`
      )
    );
    if (!current.items.length) return false;

    const snippet = current.items[0].snippet;
    await withRetry(() =>
      ytFetchWrite(`/videos?part=snippet`, {
        method: "PUT",
        body: JSON.stringify({
          id: videoId,
          snippet: {
            title: params.title || snippet.title,
            description: params.description || snippet.description,
            tags: params.tags || snippet.tags,
            categoryId: snippet.categoryId,
          },
        }),
      })
    );
    console.info(`[youtube] updateVideoMetadata: ${videoId}`);
    return true;
  } catch (error) {
    console.error("[youtube] updateVideoMetadata failed:", error);
    return false;
  }
}

export async function searchKeywords(
  query: string,
  maxResults = 10
): Promise<YouTubeSearchResult[]> {
  try {
    type SearchResponse = {
      items: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          description: string;
          channelTitle: string;
          publishedAt: string;
        };
      }>;
    };

    const data = await withRetry(() =>
      ytFetch<SearchResponse>(
        `/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}`
      )
    );

    const results: YouTubeSearchResult[] = data.items.map((i) => ({
      videoId: i.id.videoId,
      title: i.snippet.title,
      description: i.snippet.description,
      channelTitle: i.snippet.channelTitle,
      publishedAt: i.snippet.publishedAt,
    }));
    console.info(`[youtube] searchKeywords "${query}": ${results.length} results`);
    return results;
  } catch (error) {
    console.error("[youtube] searchKeywords failed:", error);
    return [];
  }
}
