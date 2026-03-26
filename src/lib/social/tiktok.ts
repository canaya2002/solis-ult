// SOLIS AI — TikTok API wrapper
import { ratelimit } from "@/lib/redis";
import type {
  TikTokUser,
  TikTokVideo,
  TikTokVideoInsights,
} from "@/types/social";

const BASE_URL = "https://open.tiktokapis.com/v2";

function getAccessToken(): string | null {
  return process.env.TIKTOK_ACCESS_TOKEN || null;
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

async function tiktokFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new Error("API_KEY not configured: TIKTOK_ACCESS_TOKEN");

  const { success } = await ratelimit.limit("tiktok");
  if (!success) throw new Error("Rate limit exceeded for TikTok API");

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
      `TikTok API error ${response.status}: ${JSON.stringify(err)}`
    );
  }

  return response.json() as Promise<T>;
}

export async function getUserInfo(): Promise<TikTokUser | null> {
  try {
    type TikTokUserResponse = {
      data: {
        user: {
          open_id: string;
          display_name: string;
          avatar_url: string;
          follower_count: number;
          following_count: number;
          likes_count: number;
          video_count: number;
        };
      };
    };

    const data = await withRetry(() =>
      tiktokFetch<TikTokUserResponse>(
        "/user/info/?fields=open_id,display_name,avatar_url,follower_count,following_count,likes_count,video_count"
      )
    );

    const u = data.data.user;
    const user: TikTokUser = {
      openId: u.open_id,
      displayName: u.display_name,
      avatarUrl: u.avatar_url,
      followerCount: u.follower_count,
      followingCount: u.following_count,
      likesCount: u.likes_count,
      videoCount: u.video_count,
    };
    console.info(`[tiktok] getUserInfo: ${user.displayName}`);
    return user;
  } catch (error) {
    console.error("[tiktok] getUserInfo failed:", error);
    return null;
  }
}

export async function getVideos(
  cursor?: number,
  maxCount = 20
): Promise<{
  videos: TikTokVideo[];
  cursor: number;
  hasMore: boolean;
}> {
  const fallback = { videos: [], cursor: 0, hasMore: false };
  try {
    type TikTokVideosResponse = {
      data: {
        videos: Array<{
          id: string;
          title: string;
          create_time: number;
          cover_image_url: string;
          view_count: number;
          like_count: number;
          comment_count: number;
          share_count: number;
        }>;
        cursor: number;
        has_more: boolean;
      };
    };

    const body: Record<string, number> = { max_count: maxCount };
    if (cursor) body.cursor = cursor;

    const data = await withRetry(() =>
      tiktokFetch<TikTokVideosResponse>(
        "/video/list/?fields=id,title,create_time,cover_image_url,view_count,like_count,comment_count,share_count",
        { method: "POST", body: JSON.stringify(body) }
      )
    );

    const videos: TikTokVideo[] = data.data.videos.map((v) => ({
      id: v.id,
      title: v.title,
      createTime: v.create_time,
      coverImageUrl: v.cover_image_url,
      viewCount: v.view_count,
      likeCount: v.like_count,
      commentCount: v.comment_count,
      shareCount: v.share_count,
    }));
    console.info(`[tiktok] getVideos: ${videos.length} videos`);
    return {
      videos,
      cursor: data.data.cursor,
      hasMore: data.data.has_more,
    };
  } catch (error) {
    console.error("[tiktok] getVideos failed:", error);
    return fallback;
  }
}

export async function getVideoInsights(
  videoId: string
): Promise<TikTokVideoInsights | null> {
  try {
    type InsightsResponse = {
      data: {
        videos: Array<{
          view_count: number;
          like_count: number;
          comment_count: number;
          share_count: number;
          avg_watch_time: number;
        }>;
      };
    };

    const data = await withRetry(() =>
      tiktokFetch<InsightsResponse>(
        "/video/query/?fields=view_count,like_count,comment_count,share_count,avg_watch_time",
        {
          method: "POST",
          body: JSON.stringify({ filters: { video_ids: [videoId] } }),
        }
      )
    );

    if (!data.data.videos.length) return null;

    const v = data.data.videos[0];
    const insights: TikTokVideoInsights = {
      viewCount: v.view_count,
      likeCount: v.like_count,
      commentCount: v.comment_count,
      shareCount: v.share_count,
      avgWatchTime: v.avg_watch_time,
    };
    console.info(`[tiktok] getVideoInsights: ${videoId}`);
    return insights;
  } catch (error) {
    console.error("[tiktok] getVideoInsights failed:", error);
    return null;
  }
}

export async function publishVideo(params: {
  videoUrl: string;
  title: string;
  privacyLevel?: string;
}): Promise<{ publishId: string } | { error: string }> {
  try {
    type InitResponse = {
      data: { publish_id: string; upload_url: string };
    };

    const initData = await withRetry(() =>
      tiktokFetch<InitResponse>("/post/publish/video/init/", {
        method: "POST",
        body: JSON.stringify({
          post_info: {
            title: params.title,
            privacy_level:
              params.privacyLevel || "MUTUAL_FOLLOW_FRIENDS",
          },
          source_info: {
            source: "PULL_FROM_URL",
            video_url: params.videoUrl,
          },
        }),
      })
    );

    console.info(
      `[tiktok] publishVideo initiated: ${initData.data.publish_id}`
    );
    return { publishId: initData.data.publish_id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[tiktok] publishVideo failed:", msg);
    return { error: msg };
  }
}

export async function getTrendingHashtags(
  _count = 20
): Promise<string[]> {
  console.info(
    "[tiktok] getTrendingHashtags: TikTok Trends API not publicly available, returning empty"
  );
  return [];
}
