// SOLIS AI — Performance Monitor
// Runs periodically to detect viral posts and generate boost recommendations.
// Checks FB/IG and TikTok. YouTube skipped (no direct boost API).
import { db } from "@/lib/db";
import { getPagePosts } from "@/lib/social/meta";
import { getVideos } from "@/lib/social/tiktok";
import { sendNotification } from "@/lib/notifications/notification-engine";
import {
  analyzePostPerformance,
  isMetaAdsConfigured,
  type BoostRecommendation,
} from "./boost-engine";
import type { Platform } from "@prisma/client";

// ─── Historical Averages ───────────────────────────────────────────────────────

async function getPlatformAverages(platform: Platform): Promise<{
  avgLikes: number;
  avgComments: number;
  avgShares: number;
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const result = await db.contentPerformance.aggregate({
    where: {
      content: {
        platform,
        publishedAt: { gte: thirtyDaysAgo },
      },
    },
    _avg: {
      engagement: true,  // likes approximation
      comments: true,
      shares: true,
    },
  });

  return {
    avgLikes: result._avg.engagement || 10,    // fallback to reasonable minimums
    avgComments: result._avg.comments || 3,
    avgShares: result._avg.shares || 2,
  };
}

// ─── Get Recently Published Posts ──────────────────────────────────────────────

async function getRecentPublishedContent() {
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  return db.content.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { gte: fortyEightHoursAgo },
      externalId: { not: null },
      platform: { in: ["FACEBOOK", "INSTAGRAM", "TIKTOK"] },
    },
    include: {
      boosts: {
        where: {
          status: { in: ["PENDING", "ACTIVE"] },
        },
      },
    },
  });
}

// ─── Check if a boost proposal already exists for this post ────────────────────

async function hasExistingBoostOrProposal(contentId: string): Promise<boolean> {
  const existing = await db.boost.findFirst({
    where: {
      contentId,
      status: { in: ["PENDING", "ACTIVE"] },
    },
  });
  return !!existing;
}

// ─── Fetch Live Metrics from Platforms ─────────────────────────────────────────

async function fetchMetaMetrics(): Promise<
  Map<string, { likes: number; comments: number; shares: number }>
> {
  const map = new Map<string, { likes: number; comments: number; shares: number }>();
  try {
    const posts = await getPagePosts(undefined, 50);
    for (const post of posts) {
      map.set(post.id, {
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
      });
    }
  } catch (error) {
    console.error("[performance-monitor] Failed to fetch Meta posts:", error);
  }
  return map;
}

async function fetchTikTokMetrics(): Promise<
  Map<string, { views: number; likes: number; comments: number; shares: number }>
> {
  const map = new Map<string, { views: number; likes: number; comments: number; shares: number }>();
  try {
    const result = await getVideos(undefined, 20);
    for (const video of result.videos) {
      map.set(video.id, {
        views: video.viewCount,
        likes: video.likeCount,
        comments: video.commentCount,
        shares: video.shareCount,
      });
    }
  } catch (error) {
    console.error("[performance-monitor] Failed to fetch TikTok videos:", error);
  }
  return map;
}

// ─── Main Monitor Function ─────────────────────────────────────────────────────

export async function checkAllPlatformPerformance(): Promise<BoostRecommendation[]> {
  const recommendations: BoostRecommendation[] = [];

  // 1. Get recently published content
  const recentContent = await getRecentPublishedContent();
  if (!recentContent.length) {
    console.info("[performance-monitor] No recent published content to check");
    return [];
  }

  // 2. Fetch live metrics from platforms
  const metaPosts = recentContent.some(c => c.platform === "FACEBOOK" || c.platform === "INSTAGRAM")
    ? await fetchMetaMetrics()
    : new Map();

  const tiktokVideos = recentContent.some(c => c.platform === "TIKTOK")
    ? await fetchTikTokMetrics()
    : new Map();

  // 3. Get platform averages (cached per platform)
  const avgCache = new Map<Platform, { avgLikes: number; avgComments: number; avgShares: number }>();

  async function getAvg(platform: Platform) {
    if (!avgCache.has(platform)) {
      avgCache.set(platform, await getPlatformAverages(platform));
    }
    return avgCache.get(platform)!;
  }

  // 4. Analyze each post
  for (const content of recentContent) {
    // Skip if already has a pending/active boost
    if (content.boosts.length > 0) continue;
    if (await hasExistingBoostOrProposal(content.id)) continue;

    const externalId = content.externalId!;
    let metrics: { views?: number; likes: number; comments: number; shares: number } | null = null;

    if (content.platform === "FACEBOOK" || content.platform === "INSTAGRAM") {
      const metaMetrics = metaPosts.get(externalId);
      if (metaMetrics) {
        metrics = metaMetrics;
      }
    } else if (content.platform === "TIKTOK") {
      const ttMetrics = tiktokVideos.get(externalId);
      if (ttMetrics) {
        metrics = ttMetrics;
      }
    }

    if (!metrics) continue;

    const averages = await getAvg(content.platform);

    const recommendation = analyzePostPerformance({
      platform: content.platform,
      postId: content.id,
      externalPostId: externalId,
      metrics,
      publishedAt: content.publishedAt || content.createdAt,
      averages,
      title: content.title,
    });

    if (recommendation) {
      recommendations.push(recommendation);
    }
  }

  // 5. Create notifications and DB records for each recommendation
  const metaConfigured = isMetaAdsConfigured();

  for (const rec of recommendations) {
    // Save as pending boost in DB
    const boost = await db.boost.create({
      data: {
        contentId: rec.postId,
        platform: rec.platform,
        externalPostId: rec.externalPostId,
        viralityScore: rec.viralityScore,
        budget: rec.suggestedBudget,
        duration: rec.suggestedDuration,
        status: "PENDING",
      },
    });

    // Notification message
    const platformLabel = rec.platform === "FACEBOOK" ? "Facebook" : rec.platform === "INSTAGRAM" ? "Instagram" : "TikTok";
    const metaNote = metaConfigured ? "" : "\n\nConecta Meta Ads para poder boostear posts autom\u00e1ticamente.";

    const notificationId = await sendNotification({
      type: "boost_ready",
      title: `Post viral detectado en ${platformLabel}`,
      message: `${rec.reason}\n\nBudget: $${rec.suggestedBudget}/d\u00eda \u00d7 ${rec.suggestedDuration} d\u00edas = $${rec.suggestedBudget * rec.suggestedDuration} total.\nAlcance estimado: +${rec.estimatedAdditionalReach.toLocaleString()} personas.${metaNote}`,
      actionUrl: `/ads/boosts?approve=${boost.id}`,
      actionLabel: metaConfigured ? `Aprobar boost $${rec.suggestedBudget}/d\u00eda` : "Ver detalles",
      priority: rec.priority === "urgent" ? "high" : rec.priority === "high" ? "high" : "medium",
      data: {
        boostId: boost.id,
        viralityScore: rec.viralityScore,
        suggestedBudget: rec.suggestedBudget,
        suggestedDuration: rec.suggestedDuration,
        metrics: rec.currentMetrics,
      },
      expiresAt: rec.expiresAt,
      // Boosts are time-sensitive: remind at 2hrs and 6hrs
      remindAfterMinutes: [120, 360],
    });

    // Update boost with notification reference
    await db.boost.update({
      where: { id: boost.id },
      data: { notificationId },
    });

    console.info(
      `[performance-monitor] Boost recommendation: ${platformLabel} post ${rec.externalPostId}, ` +
      `virality=${rec.viralityScore}, budget=$${rec.suggestedBudget}/day, priority=${rec.priority}`
    );
  }

  console.info(
    `[performance-monitor] Checked ${recentContent.length} posts. ${recommendations.length} boost recommendations generated.`
  );

  return recommendations;
}
