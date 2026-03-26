// SOLIS AI — Campaigns API route
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getCampaigns,
  getCampaignInsights,
  pauseCampaign as metaPause,
  activateCampaign as metaActivate,
  updateCampaignBudget as metaUpdateBudget,
} from "@/lib/social/meta-ads";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { apiSuccess, apiError } from "@/lib/utils";

const dateRangeSchema = z.enum(["7d", "30d", "90d"]).default("7d");

const actionSchema = z.object({
  action: z.enum(["pause", "activate", "update_budget"]),
  campaignId: z.string().min(1),
  newBudget: z.number().positive().optional(),
});

function getDaysFromRange(range: string): number {
  switch (range) {
    case "30d": return 30;
    case "90d": return 90;
    default: return 7;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const rangeParsed = dateRangeSchema.safeParse(
      searchParams.get("dateRange") || "7d"
    );
    const range = rangeParsed.success ? rangeParsed.data : "7d";
    const days = getDaysFromRange(range);

    // Check cache
    const cacheKey = `ads:campaigns:${range}`;
    const cached = await redis.get(cacheKey);
    if (cached) return apiSuccess(cached);

    // Fetch from Meta
    const metaCampaigns = await getCampaigns();
    if (!metaCampaigns.length) {
      return apiSuccess({
        campaigns: [],
        summary: {
          totalSpend: 0,
          totalLeads: 0,
          averageCpl: 0,
          activeCampaigns: 0,
          pausedCampaigns: 0,
          pausedByAi: 0,
        },
      });
    }

    const now = new Date();
    const start = new Date(now.getTime() - days * 86400000);
    const dateRange = {
      since: start.toISOString().split("T")[0],
      until: now.toISOString().split("T")[0],
    };

    type CampaignRow = {
      id: string;
      metaCampaignId: string;
      name: string;
      status: string;
      dailyBudget: number;
      spent: number;
      impressions: number;
      clicks: number;
      leads: number;
      cpl: number | null;
      ctr: number;
      lastRebalancedAt: string | null;
    };

    const campaigns: CampaignRow[] = [];
    let totalSpend = 0;
    let totalLeads = 0;

    for (const mc of metaCampaigns) {
      const insights = await getCampaignInsights(mc.id, dateRange);
      const spend = insights?.spend ?? 0;
      const leads = insights?.leads ?? 0;
      const cpl = leads > 0 ? spend / leads : null;

      totalSpend += spend;
      totalLeads += leads;

      // Sync with DB
      const existing = await db.campaign.findUnique({
        where: { metaCampaignId: mc.id },
      });

      if (existing) {
        await db.campaign.update({
          where: { metaCampaignId: mc.id },
          data: {
            name: mc.name,
            spent: spend,
            leadsGenerated: leads,
            cpl: cpl ?? undefined,
            status:
              mc.status === "ACTIVE"
                ? "ACTIVE"
                : mc.status === "PAUSED"
                  ? existing.status === "PAUSED_BY_AI"
                    ? "PAUSED_BY_AI"
                    : "PAUSED"
                  : "COMPLETED",
          },
        });
      } else {
        await db.campaign.create({
          data: {
            metaCampaignId: mc.id,
            name: mc.name,
            platform: "FACEBOOK",
            budget: mc.dailyBudget,
            spent: spend,
            leadsGenerated: leads,
            cpl: cpl ?? undefined,
            status: mc.status === "ACTIVE" ? "ACTIVE" : "PAUSED",
          },
        });
      }

      const dbCampaign = await db.campaign.findUnique({
        where: { metaCampaignId: mc.id },
      });

      campaigns.push({
        id: dbCampaign?.id ?? mc.id,
        metaCampaignId: mc.id,
        name: mc.name,
        status: dbCampaign?.status ?? mc.status,
        dailyBudget: mc.dailyBudget,
        spent: spend,
        impressions: insights?.impressions ?? 0,
        clicks: insights?.clicks ?? 0,
        leads,
        cpl,
        ctr: insights?.ctr ?? 0,
        lastRebalancedAt: dbCampaign?.lastRebalancedAt?.toISOString() ?? null,
      });
    }

    campaigns.sort((a, b) => (a.cpl ?? 9999) - (b.cpl ?? 9999));

    const dbCampaigns = await db.campaign.findMany();
    const summary = {
      totalSpend,
      totalLeads,
      averageCpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
      activeCampaigns: dbCampaigns.filter((c) => c.status === "ACTIVE").length,
      pausedCampaigns: dbCampaigns.filter((c) => c.status === "PAUSED").length,
      pausedByAi: dbCampaigns.filter((c) => c.status === "PAUSED_BY_AI").length,
    };

    const responseData = { campaigns, summary };
    await redis.set(cacheKey, responseData, { ex: 300 });

    return apiSuccess(responseData);
  } catch (error) {
    console.error("[api/ads/campaigns] GET failed:", error);
    return apiError("Error al obtener campañas", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message);
    }

    const { action, campaignId, newBudget } = parsed.data;

    let actionResult = false;
    let logAction = "";
    const details: Record<string, unknown> = {};

    switch (action) {
      case "pause":
        actionResult = await metaPause(campaignId);
        logAction = "paused_manual";
        details.reason = "Paused manually by user";
        if (actionResult) {
          await db.campaign.updateMany({
            where: { metaCampaignId: campaignId },
            data: { status: "PAUSED" },
          });
        }
        break;

      case "activate":
        actionResult = await metaActivate(campaignId);
        logAction = "activated_manual";
        details.reason = "Activated manually by user";
        if (actionResult) {
          await db.campaign.updateMany({
            where: { metaCampaignId: campaignId },
            data: { status: "ACTIVE" },
          });
        }
        break;

      case "update_budget":
        if (!newBudget) return apiError("newBudget is required for update_budget");
        actionResult = await metaUpdateBudget(campaignId, newBudget);
        logAction = "budget_updated";
        details.newBudget = newBudget;
        details.reason = "Budget updated manually by user";
        if (actionResult) {
          await db.campaign.updateMany({
            where: { metaCampaignId: campaignId },
            data: { budget: newBudget },
          });
        }
        break;
    }

    if (actionResult) {
      const dbCampaign = await db.campaign.findUnique({
        where: { metaCampaignId: campaignId },
      });
      if (dbCampaign) {
        await db.campaignLog.create({
          data: {
            campaignId: dbCampaign.id,
            action: logAction,
            details: details as Record<string, string | number | boolean>,
          },
        });
      }
    }

    // Invalidate cache
    await redis.del("ads:campaigns:7d");
    await redis.del("ads:campaigns:30d");
    await redis.del("ads:campaigns:90d");

    return apiSuccess({
      success: actionResult,
      action,
      campaignId,
    });
  } catch (error) {
    console.error("[api/ads/campaigns] POST failed:", error);
    return apiError("Error al ejecutar acción", 500);
  }
}
