// SOLIS AI — Activate Campaign (second human approval)
// This is the FINAL step that starts spending money.
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/utils";
import { db } from "@/lib/db";
import { activateFullCampaign } from "@/lib/ads/campaign-creator";
import { sendNotification } from "@/lib/notifications/notification-engine";

const schema = z.object({
  campaignId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    const { campaignId } = parsed.data;

    // Verify campaign exists in our DB
    const campaign = await db.campaign.findFirst({
      where: { metaCampaignId: campaignId },
    });
    if (!campaign) return apiError("Campa\u00f1a no encontrada", 404);
    if (campaign.status === "ACTIVE") return apiError("La campa\u00f1a ya est\u00e1 activa");

    // Activate in Meta
    const activated = await activateFullCampaign(campaignId);
    if (!activated) return apiError("Error al activar en Meta Ads", 500);

    // Update our DB
    await db.campaign.update({
      where: { id: campaign.id },
      data: { status: "ACTIVE" },
    });

    // Update campaign plan if exists
    await db.campaignPlan.updateMany({
      where: { metaCampaignId: campaignId },
      data: { status: "ACTIVATED", activatedAt: new Date() },
    });

    // Log
    await db.auditLog.create({
      data: {
        action: "CAMPAIGN_ACTIVATED",
        entity: "Campaign",
        entityId: campaign.id,
        details: {
          metaCampaignId: campaignId,
          name: campaign.name,
          dailyBudget: Number(campaign.budget),
        },
      },
    });

    // Notification
    await sendNotification({
      type: "campaign_activated",
      title: `Campa\u00f1a ACTIVA: ${campaign.name}`,
      message: `La campa\u00f1a "${campaign.name}" est\u00e1 activa.\nPresupuesto: $${Number(campaign.budget)}/d\u00eda.\nMonitoreando rendimiento autom\u00e1ticamente.`,
      actionUrl: "/ads",
      actionLabel: "Ver dashboard de Ads",
      priority: "medium",
      data: { campaignId, name: campaign.name },
    });

    return apiSuccess({ campaignId, status: "ACTIVE", name: campaign.name });
  } catch (error) {
    console.error("[api/ads/create-campaign/activate] POST failed:", error);
    const msg = error instanceof Error ? error.message : "Error al activar campa\u00f1a";
    return apiError(msg, 500);
  }
}
