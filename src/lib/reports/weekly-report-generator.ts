// SOLIS AI — Weekly Report Generator
import { db } from "@/lib/db";
import { generateWeeklyReport as claudeReport } from "@/lib/ai/claude";
import { getAccountSpend } from "@/lib/social/meta-ads";
import { getTrafficOverview } from "@/lib/analytics/ga4";
import { getTopQueries } from "@/lib/analytics/gsc";

function change(current: number, previous: number) {
  if (previous === 0) return { value: current, percent: current > 0 ? 100 : 0, direction: "up" as const };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { value: current, percent: Math.abs(pct), direction: pct >= 0 ? "up" as const : "down" as const };
}

export interface WeeklyReportResult {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  summary: string;
  wins: Array<{ title: string; detail: string; metric?: string }>;
  problems: Array<{ title: string; detail: string; metric?: string }>;
  actions: Array<{ title: string; detail: string; priority: "high" | "medium" | "low" }>;
  highlight: string;
  metrics: {
    leads: { total: number; change: number; bySource: Record<string, number> };
    revenue: { total: number; change: number; contracts: number };
    ads: { spend: number; cpl: number; change: number; saved: number };
    web: { sessions: number; change: number; bounceRate: number } | null;
    seo: { clicks: number; impressions: number; ctr: number; change: number } | null;
    content: { published: number; engagement: number; topPost: string } | null;
    reviews: { new: number; avgRating: number; pending: number };
    engagement: { commentsProcessed: number; dmsQualified: number; leadsFromDms: number };
  };
  generatedAt: Date;
}

export async function generateFullWeeklyReport(
  periodStart: Date,
  periodEnd: Date
): Promise<WeeklyReportResult> {
  const prevStart = new Date(periodStart.getTime() - 7 * 86400000);
  const prevEnd = new Date(periodEnd.getTime() - 7 * 86400000);
  const dateFilter = { createdAt: { gte: periodStart, lte: periodEnd } };
  const prevFilter = { createdAt: { gte: prevStart, lte: prevEnd } };

  // Parallel data collection
  const [
    leadsRes, prevLeadsRes, convertedRes, prevConvertedRes,
    revenueRes, contentRes, reviewsRes, commentsRes, dmsRes,
    adsRes, webRes, seoRes, pausedRes
  ] = await Promise.allSettled([
    db.lead.count({ where: dateFilter }),
    db.lead.count({ where: prevFilter }),
    db.lead.count({ where: { ...dateFilter, status: "CONVERTED" } }),
    db.lead.count({ where: { ...prevFilter, status: "CONVERTED" } }),
    db.lead.findMany({ where: { ...dateFilter, status: "CONVERTED", contractValue: { not: null } }, select: { contractValue: true } }),
    db.content.findMany({ where: { publishedAt: { gte: periodStart, lte: periodEnd }, status: "PUBLISHED" }, include: { performance: true }, orderBy: { publishedAt: "desc" } }),
    db.review.findMany({ where: dateFilter, select: { rating: true, responseStatus: true } }),
    db.comment.count({ where: { ...dateFilter, responseStatus: "PUBLISHED" } }),
    db.lead.count({ where: { ...dateFilter, source: { in: ["DM_FACEBOOK", "DM_INSTAGRAM"] } } }),
    getAccountSpend(undefined, { since: periodStart.toISOString().split("T")[0], until: periodEnd.toISOString().split("T")[0] }).catch(() => null),
    getTrafficOverview(undefined, { startDate: periodStart.toISOString().split("T")[0], endDate: periodEnd.toISOString().split("T")[0] }).catch(() => null),
    getTopQueries(undefined, { startDate: periodStart.toISOString().split("T")[0], endDate: periodEnd.toISOString().split("T")[0] }, 20).catch(() => null),
    db.campaignLog.count({ where: { ...dateFilter, action: "paused_by_ai" } }),
  ]);

  const leads = leadsRes.status === "fulfilled" ? leadsRes.value : 0;
  const prevLeads = prevLeadsRes.status === "fulfilled" ? prevLeadsRes.value : 0;
  const converted = convertedRes.status === "fulfilled" ? convertedRes.value : 0;
  const prevConverted = prevConvertedRes.status === "fulfilled" ? prevConvertedRes.value : 0;
  const revenueData = revenueRes.status === "fulfilled" ? revenueRes.value : [];
  const totalRevenue = revenueData.reduce((s, l) => s + Number(l.contractValue || 0), 0);
  const contentData = contentRes.status === "fulfilled" ? contentRes.value : [];
  const reviewsData = reviewsRes.status === "fulfilled" ? reviewsRes.value : [];
  const commentsProcessed = commentsRes.status === "fulfilled" ? commentsRes.value : 0;
  const dmsQualified = dmsRes.status === "fulfilled" ? dmsRes.value : 0;
  const ads = adsRes.status === "fulfilled" ? adsRes.value : null;
  const web = webRes.status === "fulfilled" ? webRes.value : null;
  const seo = seoRes.status === "fulfilled" ? seoRes.value : null;
  const paused = pausedRes.status === "fulfilled" ? pausedRes.value : 0;

  // Source breakdown
  const sourceCounts = await db.lead.groupBy({ by: ["source"], where: dateFilter, _count: { id: true } });
  const bySource: Record<string, number> = {};
  for (const r of sourceCounts) bySource[r.source] = r._count.id;

  // Content metrics
  const totalEngagement = contentData.reduce((s, c) => s + (c.performance?.engagement || 0), 0);
  const topPost = contentData.sort((a, b) => (b.performance?.engagement || 0) - (a.performance?.engagement || 0))[0];

  // Reviews
  const avgRating = reviewsData.length > 0 ? reviewsData.reduce((s, r) => s + r.rating, 0) / reviewsData.length : 0;
  const pendingReviews = reviewsData.filter(r => r.responseStatus === "PENDING").length;

  const metrics = {
    leads: { total: leads, change: change(leads, prevLeads).percent * (change(leads, prevLeads).direction === "down" ? -1 : 1), bySource },
    revenue: { total: totalRevenue, change: change(converted, prevConverted).percent, contracts: converted },
    ads: { spend: ads?.spend || 0, cpl: ads?.cpl || 0, change: 0, saved: paused * 50 },
    web: web ? { sessions: web.totalSessions, change: 0, bounceRate: web.bounceRate } : null,
    seo: seo ? { clicks: seo.reduce((s, q) => s + q.clicks, 0), impressions: seo.reduce((s, q) => s + q.impressions, 0), ctr: 0, change: 0 } : null,
    content: contentData.length > 0 ? { published: contentData.length, engagement: totalEngagement, topPost: topPost?.title || "" } : null,
    reviews: { new: reviewsData.length, avgRating: Math.round(avgRating * 10) / 10, pending: pendingReviews },
    engagement: { commentsProcessed, dmsQualified, leadsFromDms: dmsQualified },
  };

  // AI report
  const metricsStr = JSON.stringify(metrics, null, 2);
  const aiReport = await claudeReport(`Período: ${periodStart.toISOString().split("T")[0]} a ${periodEnd.toISOString().split("T")[0]}\n${metricsStr}`);

  const report = await db.weeklyReport.create({
    data: {
      periodStart,
      periodEnd,
      content: { ...aiReport, metrics },
      highlights: [...aiReport.wins, ...aiReport.actions],
    },
  });

  return {
    id: report.id,
    periodStart,
    periodEnd,
    summary: aiReport.summary,
    wins: aiReport.wins.map(w => ({ title: w, detail: w })),
    problems: aiReport.problems.map(p => ({ title: p, detail: p })),
    actions: aiReport.actions.map((a, i) => ({ title: a, detail: a, priority: (i === 0 ? "high" : i === 1 ? "medium" : "low") as "high" | "medium" | "low" })),
    highlight: aiReport.wins[0] || "",
    metrics,
    generatedAt: new Date(),
  };
}
