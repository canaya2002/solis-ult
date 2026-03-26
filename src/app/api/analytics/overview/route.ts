// SOLIS AI — Unified Overview Analytics API
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getAccountSpend } from "@/lib/social/meta-ads";
import { getTrafficOverview } from "@/lib/analytics/ga4";
import { getTopQueries } from "@/lib/analytics/gsc";
import { apiSuccess, apiError } from "@/lib/utils";

const periodSchema = z.enum(["7d", "30d", "90d"]).default("30d");

function daysFromPeriod(p: string): number {
  return p === "7d" ? 7 : p === "90d" ? 90 : 30;
}

function hasEnv(...keys: string[]): boolean {
  return keys.every((k) => !!process.env[k]);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = periodSchema.safeParse(searchParams.get("period") || "30d");
    const period = parsed.success ? parsed.data : "30d";

    const cacheKey = `analytics:overview:${period}`;
    const cached = await redis.get(cacheKey);
    if (cached) return apiSuccess(cached);

    const days = daysFromPeriod(period);
    const since = new Date(Date.now() - days * 86400000);
    const sinceStr = since.toISOString().split("T")[0];
    const untilStr = new Date().toISOString().split("T")[0];

    // Track connected / disconnected APIs
    const connectedApis: string[] = [];
    const disconnectedApis: string[] = [];

    const apiChecks: Array<[string, string[]]> = [
      ["Meta Ads", ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"]],
      ["GA4", ["GOOGLE_CLIENT_ID", "GA4_PROPERTY_ID"]],
      ["Search Console", ["GOOGLE_CLIENT_ID", "GOOGLE_SEARCH_CONSOLE_SITE"]],
      ["Semrush", ["SEMRUSH_API_KEY"]],
      ["TikTok", ["TIKTOK_ACCESS_TOKEN"]],
      ["YouTube", ["GOOGLE_CLIENT_ID", "YOUTUBE_CHANNEL_ID"]],
      ["Twilio", ["TWILIO_ACCOUNT_SID"]],
      ["Claude AI", ["ANTHROPIC_API_KEY"]],
    ];
    for (const [name, keys] of apiChecks) {
      (hasEnv(...keys) ? connectedApis : disconnectedApis).push(name);
    }

    // Parallel data fetching — use allSettled so one failure doesn't break all
    const [leadsResult, adsResult, webResult, seoResult] =
      await Promise.allSettled([
        // 1. Leads from DB
        (async () => {
          const dateFilter = { createdAt: { gte: since } };
          const [total, converted, dailyRaw] = await Promise.all([
            db.lead.count({ where: dateFilter }),
            db.lead.count({ where: { ...dateFilter, status: "CONVERTED" } }),
            db.lead.findMany({
              where: dateFilter,
              select: { createdAt: true, source: true },
              orderBy: { createdAt: "asc" },
            }),
          ]);

          const sourceCounts = await db.lead.groupBy({
            by: ["source"],
            where: dateFilter,
            _count: { id: true },
          });
          const sourceConverted = await db.lead.groupBy({
            by: ["source"],
            where: { ...dateFilter, status: "CONVERTED" },
            _count: { id: true },
          });
          const scMap: Record<string, number> = {};
          for (const r of sourceConverted) scMap[r.source] = r._count.id;

          const trendMap = new Map<string, number>();
          for (const l of dailyRaw) {
            const d = l.createdAt.toISOString().split("T")[0];
            trendMap.set(d, (trendMap.get(d) || 0) + 1);
          }

          return {
            total,
            converted,
            conversionRate:
              total > 0 ? Math.round((converted / total) * 10000) / 100 : 0,
            bySource: sourceCounts.map((r) => ({
              source: r.source,
              count: r._count.id,
              converted: scMap[r.source] || 0,
              conversionRate:
                r._count.id > 0
                  ? Math.round(
                      ((scMap[r.source] || 0) / r._count.id) * 10000
                    ) / 100
                  : 0,
            })),
            trend: Array.from(trendMap.entries()).map(([date, count]) => ({
              date,
              count,
            })),
          };
        })(),

        // 2. Meta Ads
        (async () => {
          if (!hasEnv("META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID")) return null;
          const spend = await getAccountSpend(undefined, {
            since: sinceStr,
            until: untilStr,
          });

          // Best/worst from DB
          const campaigns = await db.campaign.findMany({
            where: { status: "ACTIVE" },
            orderBy: { cpl: "asc" },
          });
          const best = campaigns[0];
          const worst = campaigns[campaigns.length - 1];

          return {
            totalSpend: spend.spend,
            totalLeads: spend.leads,
            averageCpl: spend.cpl,
            activeCampaigns: campaigns.length,
            bestCampaign: best
              ? { name: best.name, cpl: Number(best.cpl) || 0 }
              : null,
            worstCampaign:
              worst && worst.id !== best?.id
                ? { name: worst.name, cpl: Number(worst.cpl) || 0 }
                : null,
          };
        })(),

        // 3. Web traffic (GA4)
        (async () => {
          if (!hasEnv("GOOGLE_CLIENT_ID", "GA4_PROPERTY_ID")) return null;
          const overview = await getTrafficOverview(undefined, {
            startDate: sinceStr,
            endDate: untilStr,
          });
          return {
            sessions: overview.totalSessions,
            users: overview.totalUsers,
            pageviews: overview.pageviews,
            bounceRate: overview.bounceRate,
            topPages: [] as Array<{ path: string; views: number }>,
            trend: overview.dailyData.map((d) => ({
              date: d.date,
              sessions: d.sessions,
            })),
          };
        })(),

        // 4. SEO (GSC)
        (async () => {
          if (!hasEnv("GOOGLE_CLIENT_ID", "GOOGLE_SEARCH_CONSOLE_SITE"))
            return null;
          const queries = await getTopQueries(undefined, {
            startDate: sinceStr,
            endDate: untilStr,
          }, 10);
          const totalClicks = queries.reduce((s, q) => s + q.clicks, 0);
          const totalImpressions = queries.reduce(
            (s, q) => s + q.impressions,
            0
          );
          return {
            totalClicks,
            totalImpressions,
            averageCtr:
              totalImpressions > 0
                ? Math.round((totalClicks / totalImpressions) * 10000) / 100
                : 0,
            averagePosition:
              queries.length > 0
                ? Math.round(
                    (queries.reduce((s, q) => s + q.position, 0) /
                      queries.length) *
                      10
                  ) / 10
                : 0,
            topQueries: queries.slice(0, 10).map((q) => ({
              query: q.keys[0] || "",
              clicks: q.clicks,
              impressions: q.impressions,
              position: q.position,
            })),
          };
        })(),
      ]);

    const data = {
      period,
      leads:
        leadsResult.status === "fulfilled" ? leadsResult.value : null,
      ads: adsResult.status === "fulfilled" ? adsResult.value : null,
      web: webResult.status === "fulfilled" ? webResult.value : null,
      seo: seoResult.status === "fulfilled" ? seoResult.value : null,
      social: null,
      connectedApis,
      disconnectedApis,
    };

    await redis.set(cacheKey, data, { ex: 300 });
    return apiSuccess(data);
  } catch (error) {
    console.error("[api/analytics/overview] GET failed:", error);
    return apiError("Error al obtener overview", 500);
  }
}
