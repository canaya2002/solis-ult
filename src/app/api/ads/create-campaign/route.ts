// SOLIS AI — Campaign Creation API
// POST: Create a campaign plan (AI or manual) — does NOT create in Meta yet
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/utils";
import { db } from "@/lib/db";
import { planCampaign } from "@/lib/ads/campaign-planner";
import { sendNotification } from "@/lib/notifications/notification-engine";

const aiSchema = z.object({
  mode: z.literal("ai"),
  goal: z.string().min(5),
  budget: z.number().min(5).max(1000),
  cities: z.array(z.string()).min(1),
  caseType: z.string().optional(),
  mediaUrls: z.array(z.string()).optional(),
});

const manualSchema = z.object({
  mode: z.literal("manual"),
  campaign: z.object({
    name: z.string().min(1),
    objective: z.string(),
    dailyBudget: z.number().min(5),
    specialAdCategories: z.array(z.string()).optional(),
  }),
  adSets: z.array(z.object({
    name: z.string(),
    targeting: z.any(),
    dailyBudget: z.number(),
    rationale: z.string().optional(),
  })),
  ads: z.array(z.object({
    name: z.string(),
    copy: z.string(),
    cta: z.string(),
    rationale: z.string().optional(),
  })),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.mode === "ai") {
      // ─── AI-Planned Campaign ───────────────────────────────────────────────
      const parsed = aiSchema.safeParse(body);
      if (!parsed.success) return apiError(parsed.error.errors[0].message);

      const { goal, budget, cities, caseType, mediaUrls } = parsed.data;

      // Generate plan with AI
      const plan = await planCampaign({ goal, budget, cities, caseType, mediaUrls });

      // Save plan to DB
      const dbPlan = await db.campaignPlan.create({
        data: {
          goal,
          plan: JSON.parse(JSON.stringify(plan)),
          estimatedCPL: plan.estimatedResults.estimatedCPL,
          estimatedLeads: plan.estimatedResults.dailyLeads,
          dailyBudget: budget,
          expiresAt: plan.expiresAt,
        },
      });

      // Create notification
      const notificationId = await sendNotification({
        type: "campaign_ready",
        title: `Campa\u00f1a lista: ${plan.campaign.name}`,
        message: `Presupuesto: $${budget}/d\u00eda\nCPL estimado: $${plan.estimatedResults.estimatedCPL.toFixed(2)}\nLeads estimados: ${plan.estimatedResults.dailyLeads}/d\u00eda\n\n${plan.recommendation}`,
        actionUrl: `/ads/create?planId=${dbPlan.id}`,
        actionLabel: "Revisar y aprobar campa\u00f1a",
        priority: "high",
        data: { planId: dbPlan.id },
        expiresAt: plan.expiresAt,
        remindAfterMinutes: [240, 1440], // 4hrs, 24hrs
      });

      // Update plan with notification reference
      await db.campaignPlan.update({
        where: { id: dbPlan.id },
        data: { notificationId },
      });

      return apiSuccess({ plan, planId: dbPlan.id });
    } else if (body.mode === "manual") {
      // ─── Manual Campaign ───────────────────────────────────────────────────
      const parsed = manualSchema.safeParse(body);
      if (!parsed.success) return apiError(parsed.error.errors[0].message);

      const { campaign, adSets, ads } = parsed.data;
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const manualPlan = {
        id: `manual_${Date.now()}`,
        recommendation: "Campa\u00f1a creada manualmente por el equipo.",
        campaign: {
          ...campaign,
          estimatedDailyLeads: 0,
          estimatedCPL: 0,
          specialAdCategories: campaign.specialAdCategories || [],
        },
        adSets,
        ads,
        estimatedResults: {
          dailyLeads: 0,
          weeklyCost: campaign.dailyBudget * 7,
          estimatedCPL: 0,
          confidence: "low" as const,
          reasoning: "Campa\u00f1a manual — sin estimaciones de AI.",
        },
        status: "pending_approval" as const,
        createdAt: new Date(),
        expiresAt,
      };

      const dbPlan = await db.campaignPlan.create({
        data: {
          goal: `Manual: ${campaign.name}`,
          plan: JSON.parse(JSON.stringify(manualPlan)),
          dailyBudget: campaign.dailyBudget,
          expiresAt,
        },
      });

      await sendNotification({
        type: "campaign_ready",
        title: `Campa\u00f1a manual lista: ${campaign.name}`,
        message: `Presupuesto: $${campaign.dailyBudget}/d\u00eda\nAd sets: ${adSets.length}\nAds: ${ads.length}`,
        actionUrl: `/ads/create?planId=${dbPlan.id}`,
        actionLabel: "Revisar y aprobar campa\u00f1a",
        priority: "high",
        data: { planId: dbPlan.id },
        expiresAt,
        remindAfterMinutes: [240, 1440],
      });

      return apiSuccess({ plan: manualPlan, planId: dbPlan.id });
    }

    return apiError("mode debe ser 'ai' o 'manual'");
  } catch (error) {
    console.error("[api/ads/create-campaign] POST failed:", error);
    const msg = error instanceof Error ? error.message : "Error al crear plan de campa\u00f1a";
    return apiError(msg, 500);
  }
}
