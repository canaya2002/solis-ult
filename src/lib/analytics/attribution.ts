// SOLIS AI — Ad Attribution Engine
// Tracks which specific ads generate which leads and conversions.
import { db } from "@/lib/db";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AdAttributionRow {
  metaAdId: string;
  adName: string;
  campaignName: string;
  leads: number;
  conversions: number;
  revenue: number;
  cost: number;
  roi: number;
}

export interface AdAttributionReport {
  period: string;
  rows: AdAttributionRow[];
  totals: { leads: number; conversions: number; revenue: number; cost: number; roi: number };
}

// ─── Track Conversion ──────────────────────────────────────────────────────────

export async function trackConversion(params: {
  leadId: string;
  source: string;
  sourceDetail?: string;
  metaCampaignId?: string;
  metaAdSetId?: string;
  metaAdId?: string;
}) {
  await db.lead.update({
    where: { id: params.leadId },
    data: {
      sourceDetail: params.sourceDetail || undefined,
      metaCampaignId: params.metaCampaignId || undefined,
      metaAdSetId: params.metaAdSetId || undefined,
      metaAdId: params.metaAdId || undefined,
    },
  });
}

// ─── Attribution Report ────────────────────────────────────────────────────────

export async function getAdAttribution(days: number = 30): Promise<AdAttributionReport> {
  const since = new Date(Date.now() - days * 86400000);

  // Get leads with ad attribution
  const leads = await db.lead.findMany({
    where: {
      createdAt: { gte: since },
      metaAdId: { not: null },
    },
    select: {
      metaAdId: true,
      metaCampaignId: true,
      metaAdSetId: true,
      status: true,
      contractValue: true,
      sourceDetail: true,
    },
  });

  // Group by ad
  const adMap = new Map<string, {
    adName: string; campaignName: string;
    leads: number; conversions: number; revenue: number;
  }>();

  for (const l of leads) {
    const adId = l.metaAdId!;
    if (!adMap.has(adId)) {
      adMap.set(adId, {
        adName: l.sourceDetail || adId,
        campaignName: l.metaCampaignId || "Unknown",
        leads: 0, conversions: 0, revenue: 0,
      });
    }
    const entry = adMap.get(adId)!;
    entry.leads++;
    if (l.status === "CONVERTED") {
      entry.conversions++;
      entry.revenue += Number(l.contractValue || 0);
    }
  }

  // Get campaign spend data from our DB
  const campaigns = await db.campaign.findMany({
    where: { createdAt: { gte: since } },
    select: { metaCampaignId: true, spent: true, name: true },
  });
  const spendMap = new Map<string, { spent: number; name: string }>();
  for (const c of campaigns) {
    spendMap.set(c.metaCampaignId, { spent: Number(c.spent), name: c.name });
  }

  // Build rows
  const rows: AdAttributionRow[] = [];
  let totalLeads = 0, totalConversions = 0, totalRevenue = 0, totalCost = 0;

  for (const [adId, data] of adMap) {
    const campaign = spendMap.get(data.campaignName);
    const cost = campaign ? campaign.spent / Math.max(1, adMap.size) : 0; // approximate
    const roi = cost > 0 ? ((data.revenue - cost) / cost) * 100 : 0;

    rows.push({
      metaAdId: adId,
      adName: data.adName,
      campaignName: campaign?.name || data.campaignName,
      leads: data.leads,
      conversions: data.conversions,
      revenue: data.revenue,
      cost,
      roi,
    });

    totalLeads += data.leads;
    totalConversions += data.conversions;
    totalRevenue += data.revenue;
    totalCost += cost;
  }

  rows.sort((a, b) => b.roi - a.roi);

  return {
    period: `${days}d`,
    rows,
    totals: {
      leads: totalLeads,
      conversions: totalConversions,
      revenue: totalRevenue,
      cost: totalCost,
      roi: totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0,
    },
  };
}
