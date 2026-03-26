// SOLIS AI — SEO Advisor
import { db } from "@/lib/db";
import { generateSEOBrief as claudeSEO } from "@/lib/ai/claude";
import { getTopQueries, getTopPages as gscTopPages, getPagesNeedingOptimization } from "@/lib/analytics/gsc";
import { getDomainOverview, getOrganicKeywords, getKeywordGap } from "@/lib/analytics/semrush";

export interface SEOBriefResult {
  id: string;
  weekOf: Date;
  opportunities: Array<{ keyword: string; currentPosition: number | null; volume: number; difficulty: string; action: string; page?: string }>;
  quickWins: Array<{ page: string; currentTitle: string; suggestedTitle: string; reason: string; estimatedCtrImprovement: string }>;
  contentSuggestions: Array<{ topic: string; targetKeyword: string; estimatedVolume: number; difficulty: string; outline: string }>;
  technicalIssues: Array<{ issue: string; severity: "high" | "medium" | "low"; fix: string; page?: string }>;
  generatedAt: Date;
}

export async function generateSEOBriefFull(): Promise<SEOBriefResult> {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 28 * 86400000);
  const dateRange = { startDate: monthAgo.toISOString().split("T")[0], endDate: now.toISOString().split("T")[0] };

  // Gather data from all sources
  const [gscQueries, gscPages, optimizationOps, domainOv, organicKw, gaps] = await Promise.allSettled([
    getTopQueries(undefined, dateRange, 50),
    gscTopPages(undefined, dateRange, 30),
    getPagesNeedingOptimization(),
    getDomainOverview(),
    getOrganicKeywords("manuelsolis.com", 30),
    getKeywordGap(),
  ]);

  const queries = gscQueries.status === "fulfilled" ? gscQueries.value : [];
  const pages = gscPages.status === "fulfilled" ? gscPages.value : [];
  const optOps = optimizationOps.status === "fulfilled" ? optimizationOps.value : [];
  const domain = domainOv.status === "fulfilled" ? domainOv.value : null;
  const keywords = organicKw.status === "fulfilled" ? organicKw.value : [];
  const keywordGaps = gaps.status === "fulfilled" ? gaps.value : [];

  const gscData = `Top Queries (28d):\n${queries.slice(0, 20).map(q => `${q.keys[0]}: ${q.clicks} clicks, ${q.impressions} impr, CTR ${q.ctr}%, pos ${q.position}`).join("\n")}
\nPages needing optimization:\n${optOps.slice(0, 10).map(o => `${o.page} — "${o.query}" pos ${o.position}, CTR ${o.ctr}%`).join("\n")}`;

  const semrushData = `Domain: ${domain?.domain || "manuelsolis.com"}, Rank: ${domain?.rank || "N/A"}, Organic Keywords: ${domain?.organicKeywords || "N/A"}, Traffic: ${domain?.organicTraffic || "N/A"}
\nTop Keywords:\n${keywords.slice(0, 15).map(k => `${k.keyword}: #${k.position} (vol ${k.volume})`).join("\n")}
\nKeyword Gaps:\n${keywordGaps.slice(0, 10).map(g => `${g.keyword}: vol ${g.volume}`).join("\n")}`;

  const brief = await claudeSEO(gscData, semrushData);

  const saved = await db.sEOBrief.create({
    data: {
      opportunities: brief.opportunities,
      quickWins: brief.quickWins,
      contentSuggestions: brief.contentSuggestions,
      technicalIssues: brief.technicalIssues || [],
      weekOf: now,
    },
  });

  return {
    id: saved.id,
    weekOf: now,
    opportunities: brief.opportunities.map(o => ({ keyword: o.keyword, currentPosition: o.position, volume: o.volume, difficulty: "medium", action: o.action, page: undefined })),
    quickWins: brief.quickWins.map(q => ({ page: q.page, currentTitle: q.currentTitle, suggestedTitle: q.suggestedTitle, reason: q.reason, estimatedCtrImprovement: "+15%" })),
    contentSuggestions: brief.contentSuggestions.map(c => ({ topic: c.topic, targetKeyword: c.keyword, estimatedVolume: c.estimatedVolume, difficulty: c.difficulty, outline: "" })),
    technicalIssues: brief.technicalIssues.map(t => ({ issue: t.issue, severity: t.severity, fix: t.fix })),
    generatedAt: now,
  };
}
