// SOLIS AI — Approve Campaign Plan → Create in Meta (PAUSED)
// This is the first human approval: creates the campaign in Meta but keeps it PAUSED.
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/utils";
import { db } from "@/lib/db";
import { createCampaign, createAdSet, createAd, type CampaignObjective } from "@/lib/ads/campaign-creator";
import { sendNotification, markAsActed } from "@/lib/notifications/notification-engine";

const schema = z.object({
  planId: z.string().min(1),
  modifications: z.any().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    const { planId, modifications } = parsed.data;

    // Load plan
    const dbPlan = await db.campaignPlan.findUnique({ where: { id: planId } });
    if (!dbPlan) return apiError("Plan no encontrado", 404);
    if (dbPlan.status !== "PENDING_APPROVAL") return apiError(`Plan ya ${dbPlan.status.toLowerCase()}`);

    const plan = dbPlan.plan as Record<string, unknown>;

    // Apply modifications if any
    const finalPlan = modifications ? { ...plan, ...modifications } : plan;
    const campaign = finalPlan.campaign as {
      name: string;
      objective: CampaignObjective;
      dailyBudget: number;
      specialAdCategories: string[];
    };
    const adSets = (finalPlan.adSets || []) as Array<{
      name: string;
      targeting: Record<string, unknown>;
      dailyBudget: number;
    }>;
    const ads = (finalPlan.ads || []) as Array<{
      name: string;
      copy: string;
      cta: string;
    }>;

    // ─── Create in Meta API (all PAUSED) ────────────────────────────────────

    // 1. Create campaign
    const { campaignId } = await createCampaign({
      name: campaign.name,
      objective: campaign.objective,
      dailyBudget: Math.round(campaign.dailyBudget * 100), // dollars to cents
      specialAdCategories: campaign.specialAdCategories,
      status: "PAUSED",
    });

    // 2. Create ad sets
    const createdAdSets: Array<{ name: string; adSetId: string }> = [];
    const isHousing = campaign.specialAdCategories?.includes("HOUSING");

    for (const adSet of adSets) {
      const targeting = adSet.targeting as {
        geoLocations?: { cities?: Array<{ key: string; name: string }>; regions?: Array<{ key: string }>; countries?: string[] };
        locales?: number[];
        interests?: Array<{ id: string; name: string }>;
        ageMin?: number;
        ageMax?: number;
      };

      const { adSetId } = await createAdSet({
        campaignId,
        name: adSet.name,
        dailyBudget: Math.round(adSet.dailyBudget * 100),
        targeting: {
          geoLocations: targeting.geoLocations || { countries: ["US"] },
          locales: targeting.locales,
          interests: targeting.interests,
          ageMin: targeting.ageMin,
          ageMax: targeting.ageMax,
        },
        optimizationGoal: "LEAD_GENERATION",
        billingEvent: "IMPRESSIONS",
        isHousingCategory: isHousing,
        status: "PAUSED",
      });
      createdAdSets.push({ name: adSet.name, adSetId });
    }

    // 3. Create ads (one per ad set, or distribute)
    const createdAds: Array<{ name: string; adId: string }> = [];
    for (let i = 0; i < ads.length; i++) {
      const ad = ads[i];
      const targetAdSet = createdAdSets[i % createdAdSets.length]; // distribute ads across ad sets

      const { adId } = await createAd({
        adSetId: targetAdSet.adSetId,
        name: ad.name,
        creative: {
          message: ad.copy,
          callToAction: {
            type: (ad.cta as "LEARN_MORE") || "LEARN_MORE",
            link: process.env.APP_URL || "https://manuelsolis.com",
          },
        },
        status: "PAUSED",
      });
      createdAds.push({ name: ad.name, adId });
    }

    // ─── Update DB ──────────────────────────────────────────────────────────

    await db.campaignPlan.update({
      where: { id: planId },
      data: {
        status: "APPROVED",
        metaCampaignId: campaignId,
        approvedAt: new Date(),
      },
    });

    // Mark original notification as acted
    if (dbPlan.notificationId) {
      try { await markAsActed(dbPlan.notificationId); } catch { /* non-critical */ }
    }

    // Log in campaign table
    await db.campaign.create({
      data: {
        metaCampaignId: campaignId,
        name: campaign.name,
        platform: "FACEBOOK",
        budget: campaign.dailyBudget,
        status: "PAUSED",
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        action: "CAMPAIGN_APPROVED",
        entity: "CampaignPlan",
        entityId: planId,
        details: {
          metaCampaignId: campaignId,
          adSets: createdAdSets,
          ads: createdAds,
        },
      },
    });

    // Send notification: campaign created but paused
    await sendNotification({
      type: "campaign_ready",
      title: `Campa\u00f1a creada en Meta (PAUSADA): ${campaign.name}`,
      message: `La campa\u00f1a se cre\u00f3 exitosamente en Meta Ads.\n${createdAdSets.length} ad sets, ${createdAds.length} ads.\nTodo est\u00e1 PAUSADO. \u00bfActivar?`,
      actionUrl: `/ads/create?activate=${campaignId}`,
      actionLabel: "Activar campa\u00f1a",
      priority: "high",
      data: { campaignId, planId },
      remindAfterMinutes: [240, 1440],
    });

    return apiSuccess({
      campaignId,
      adSets: createdAdSets,
      ads: createdAds,
      status: "PAUSED",
    });
  } catch (error) {
    console.error("[api/ads/create-campaign/approve] POST failed:", error);
    const msg = error instanceof Error ? error.message : "Error al aprobar campa\u00f1a";
    return apiError(msg, 500);
  }
}
