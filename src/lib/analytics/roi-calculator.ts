// SOLIS AI — ROI Calculator by Channel
import { db } from "@/lib/db";
import { getAccountSpend } from "@/lib/social/meta-ads";
import { analyzeContent } from "@/lib/ai/claude";

const SOURCE_DISPLAY: Record<string, { name: string; color: string }> = {
  META_AD: { name: "Meta Ads", color: "#3b82f6" },
  ORGANIC_WEB: { name: "Orgánico Web", color: "#22c55e" },
  TIKTOK: { name: "TikTok", color: "#06b6d4" },
  YOUTUBE: { name: "YouTube", color: "#ef4444" },
  DM_FACEBOOK: { name: "DM Facebook", color: "#8b5cf6" },
  DM_INSTAGRAM: { name: "DM Instagram", color: "#ec4899" },
  WHATSAPP: { name: "WhatsApp", color: "#25d366" },
  REFERRAL: { name: "Referidos", color: "#f59e0b" },
  PODCAST: { name: "Podcast", color: "#cda64e" },
  OTHER: { name: "Otro", color: "#6b7280" },
};

export interface ROIReport {
  period: string;
  channels: Array<{
    source: string; displayName: string; color: string;
    leads: number; conversions: number; conversionRate: number;
    revenue: number; cost: number; cac: number; roi: number | null;
    avgContractValue: number;
  }>;
  totals: {
    leads: number; conversions: number; overallConversionRate: number;
    totalRevenue: number; totalCost: number; overallRoi: number;
  };
  insights: string[];
  projections: string[];
  generatedAt: Date;
}

function periodToDate(period: string): Date | null {
  if (period === "all") return null;
  const days = period === "30d" ? 30 : period === "90d" ? 90 : 365;
  return new Date(Date.now() - days * 86400000);
}

export async function calculateROI(period: "30d" | "90d" | "12m" | "all"): Promise<ROIReport> {
  const since = periodToDate(period);
  const dateFilter = since ? { createdAt: { gte: since } } : {};

  // All leads by source
  const sourceCounts = await db.lead.groupBy({ by: ["source"], where: dateFilter, _count: { id: true } });
  const sourceConverted = await db.lead.groupBy({ by: ["source"], where: { ...dateFilter, status: "CONVERTED" }, _count: { id: true } });
  const scMap: Record<string, number> = {};
  for (const r of sourceConverted) scMap[r.source] = r._count.id;

  // Revenue by source
  const convertedLeads = await db.lead.findMany({
    where: { ...dateFilter, status: "CONVERTED", contractValue: { not: null } },
    select: { source: true, contractValue: true },
  });
  const revenueBySource: Record<string, number> = {};
  for (const l of convertedLeads) {
    revenueBySource[l.source] = (revenueBySource[l.source] || 0) + Number(l.contractValue);
  }

  // Meta Ads cost
  let metaCost = 0;
  try {
    const sinceStr = since?.toISOString().split("T")[0] || "2020-01-01";
    const ads = await getAccountSpend(undefined, { since: sinceStr, until: new Date().toISOString().split("T")[0] });
    metaCost = ads.spend;
  } catch { /* no ads */ }

  const channels = sourceCounts.map(row => {
    const source = row.source;
    const display = SOURCE_DISPLAY[source] || SOURCE_DISPLAY.OTHER;
    const leads = row._count.id;
    const conversions = scMap[source] || 0;
    const revenue = revenueBySource[source] || 0;
    const cost = source === "META_AD" ? metaCost : 0;
    const cac = conversions > 0 ? cost / conversions : 0;
    const roi = cost > 0 ? Math.round(((revenue - cost) / cost) * 100) : null;
    const avgCV = conversions > 0 ? Math.round(revenue / conversions) : 0;
    return {
      source, displayName: display.name, color: display.color,
      leads, conversions, conversionRate: leads > 0 ? Math.round((conversions / leads) * 10000) / 100 : 0,
      revenue, cost, cac: Math.round(cac), roi, avgContractValue: avgCV,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const totals = {
    leads: channels.reduce((s, c) => s + c.leads, 0),
    conversions: channels.reduce((s, c) => s + c.conversions, 0),
    overallConversionRate: 0,
    totalRevenue: channels.reduce((s, c) => s + c.revenue, 0),
    totalCost: channels.reduce((s, c) => s + c.cost, 0),
    overallRoi: 0,
  };
  totals.overallConversionRate = totals.leads > 0 ? Math.round((totals.conversions / totals.leads) * 10000) / 100 : 0;
  totals.overallRoi = totals.totalCost > 0 ? Math.round(((totals.totalRevenue - totals.totalCost) / totals.totalCost) * 100) : 0;

  // AI insights
  let insights: string[] = [];
  let projections: string[] = [];
  try {
    const dataStr = channels.map(c => `${c.displayName}: ${c.leads} leads, ${c.conversions} conv (${c.conversionRate}%), revenue $${c.revenue}, cost $${c.cost}, CAC $${c.cac}`).join("\n");
    const aiText = await analyzeContent(
      `Datos de ROI por canal (${period}):\n${dataStr}\n\nGenera 3 insights accionables y 2 proyecciones. Sé específico con números. En español. Formato JSON: { "insights": [...], "projections": [...] }`,
      "Eres analista de marketing de un bufete de inmigración. Analiza ROI por canal."
    );
    const parsed = JSON.parse(aiText.match(/\{[\s\S]*\}/)?.[0] || "{}");
    insights = parsed.insights || [];
    projections = parsed.projections || [];
  } catch {
    insights = [`El canal orgánico convierte ${((scMap.ORGANIC_WEB || 0) / (sourceCounts.find(s => s.source === "ORGANIC_WEB")?._count.id || 1) * 100).toFixed(1)}% vs Meta Ads ${((scMap.META_AD || 0) / (sourceCounts.find(s => s.source === "META_AD")?._count.id || 1) * 100).toFixed(1)}%`];
  }

  return { period, channels, totals, insights, projections, generatedAt: new Date() };
}
