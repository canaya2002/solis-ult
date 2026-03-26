// SOLIS AI — Trend Analysis API
import { NextRequest } from "next/server";
import { getImmigrationTrends } from "@/lib/analytics/trends";
import { analyzeTrends } from "@/lib/ai/claude";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { apiSuccess, apiError } from "@/lib/utils";

const CACHE_KEY = "trends:daily";
const CACHE_TTL = 7200; // 2 hours

async function runTrendAnalysis() {
  const rawTrends = await getImmigrationTrends();

  const trendSummary = `
Trending keywords: ${rawTrends.trendingKeywords.join(", ")}
Rising queries: ${rawTrends.risingQueries.slice(0, 10).map((q) => `${q.query} (${q.value})`).join(", ")}
Top queries: ${rawTrends.topQueries.slice(0, 10).map((q) => `${q.query} (${q.value})`).join(", ")}
Fecha: ${new Date().toISOString().split("T")[0]}
  `.trim();

  const ideas = await analyzeTrends(trendSummary);

  // Save ideas to DB
  for (const idea of ideas) {
    await db.contentIdea.create({
      data: {
        topic: idea.topic,
        angle: idea.angle,
        hook: idea.hook,
        hashtags: idea.hashtags,
        platform: (idea.platform?.toUpperCase() === "INSTAGRAM"
          ? "INSTAGRAM"
          : idea.platform?.toUpperCase() === "TIKTOK"
            ? "TIKTOK"
            : idea.platform?.toUpperCase() === "YOUTUBE"
              ? "YOUTUBE"
              : idea.platform?.toUpperCase() === "BLOG"
                ? "BLOG"
                : "FACEBOOK") as "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "BLOG",
        trendSource: idea.trendSource || "Google Trends",
        used: false,
      },
    });
  }

  const now = new Date();
  const cachedUntil = new Date(now.getTime() + CACHE_TTL * 1000);

  return {
    ideas,
    rawTrends: {
      trendingKeywords: rawTrends.trendingKeywords,
      risingQueries: rawTrends.risingQueries.slice(0, 15),
      topQueries: rawTrends.topQueries.slice(0, 15),
    },
    generatedAt: now.toISOString(),
    cachedUntil: cachedUntil.toISOString(),
  };
}

export async function GET() {
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return apiSuccess(cached);

    const data = await runTrendAnalysis();
    await redis.set(CACHE_KEY, data, { ex: CACHE_TTL });
    console.info(`[trends] Generated ${data.ideas.length} ideas`);
    return apiSuccess(data);
  } catch (error) {
    console.error("[api/ai/analyze-trends] GET failed:", error);
    return apiError("Error al analizar tendencias", 500);
  }
}

export async function POST() {
  try {
    await redis.del(CACHE_KEY);
    const data = await runTrendAnalysis();
    await redis.set(CACHE_KEY, data, { ex: CACHE_TTL });
    console.info(`[trends] Force-refreshed ${data.ideas.length} ideas`);
    return apiSuccess(data);
  } catch (error) {
    console.error("[api/ai/analyze-trends] POST failed:", error);
    return apiError("Error al actualizar tendencias", 500);
  }
}
