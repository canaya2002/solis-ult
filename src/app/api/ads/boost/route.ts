// SOLIS AI — Boost API
// GET: list boosts (active, pending, completed)
// POST: approve a boost → execute in Meta Ads (goes ACTIVE immediately)
// DELETE: cancel an active boost
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/utils";
import { db } from "@/lib/db";
import { executeBoost, cancelBoost, isMetaAdsConfigured } from "@/lib/ads/boost-engine";
import { sendNotification, markAsActed } from "@/lib/notifications/notification-engine";

// ─── GET: List boosts ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const boosts = await db.boost.findMany({
      where,
      include: {
        content: {
          select: {
            id: true,
            title: true,
            platform: true,
            mediaUrl: true,
            externalId: true,
            publishedAt: true,
            performance: {
              select: {
                impressions: true,
                engagement: true,
                clicks: true,
                shares: true,
                comments: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Stats
    const activeBoosts = await db.boost.count({ where: { status: "ACTIVE" } });
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const monthlyStats = await db.boost.aggregate({
      where: {
        status: { in: ["ACTIVE", "COMPLETED"] },
        approvedAt: { gte: thisMonth },
      },
      _sum: { spent: true, additionalLeads: true },
    });

    return apiSuccess({
      boosts,
      stats: {
        activeCount: activeBoosts,
        monthlySpent: Number(monthlyStats._sum.spent || 0),
        monthlyLeads: monthlyStats._sum.additionalLeads || 0,
      },
    });
  } catch (error) {
    console.error("[api/ads/boost] GET failed:", error);
    return apiError("Error al obtener boosts", 500);
  }
}

// ─── POST: Approve a boost ─────────────────────────────────────────────────────

const approveSchema = z.object({
  boostId: z.string().min(1),
  modifications: z.object({
    budget: z.number().min(5).max(200).optional(),
    duration: z.number().min(1).max(14).optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = approveSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    const { boostId, modifications } = parsed.data;

    // Load boost
    const boost = await db.boost.findUnique({
      where: { id: boostId },
      include: { content: { select: { title: true, platform: true } } },
    });

    if (!boost) return apiError("Boost no encontrado", 404);
    if (boost.status !== "PENDING") return apiError(`Boost ya ${boost.status.toLowerCase()}`);

    // Check Meta Ads configuration
    if (!isMetaAdsConfigured()) {
      return apiError("Meta Ads no est\u00e1 configurado. Configura META_ACCESS_TOKEN y META_AD_ACCOUNT_ID en .env");
    }

    // Apply modifications
    const finalBudget = modifications?.budget || Number(boost.budget);
    const finalDuration = modifications?.duration || boost.duration;

    // Execute boost in Meta (goes ACTIVE immediately — already approved)
    const result = await executeBoost({
      platform: boost.platform,
      postId: boost.contentId,
      externalPostId: boost.externalPostId,
      budget: finalBudget,
      duration: finalDuration,
    });

    // Update boost in DB
    await db.boost.update({
      where: { id: boostId },
      data: {
        status: "ACTIVE",
        metaCampaignId: result.campaignId,
        metaAdId: result.adId,
        budget: finalBudget,
        duration: finalDuration,
        approvedAt: new Date(),
      },
    });

    // Mark notification as acted
    if (boost.notificationId) {
      try { await markAsActed(boost.notificationId); } catch { /* non-critical */ }
    }

    // Log
    await db.auditLog.create({
      data: {
        action: "BOOST_APPROVED",
        entity: "Boost",
        entityId: boostId,
        details: {
          metaCampaignId: result.campaignId,
          budget: finalBudget,
          duration: finalDuration,
          platform: boost.platform,
        },
      },
    });

    // Confirmation notification
    const platformLabel = boost.platform === "FACEBOOK" ? "Facebook" : boost.platform === "INSTAGRAM" ? "Instagram" : "TikTok";
    await sendNotification({
      type: "campaign_activated",
      title: `Boost activado: ${boost.content.title || "Post"} en ${platformLabel}`,
      message: `Boost activado. $${finalBudget}/d\u00eda \u00d7 ${finalDuration} d\u00edas = $${finalBudget * finalDuration} total.\nMonitoreando rendimiento.`,
      actionUrl: "/ads/boosts",
      actionLabel: "Ver boosts activos",
      priority: "low",
      data: { boostId, campaignId: result.campaignId },
    });

    return apiSuccess({
      boostId,
      campaignId: result.campaignId,
      adId: result.adId,
      budget: finalBudget,
      duration: finalDuration,
      status: "ACTIVE",
    });
  } catch (error) {
    console.error("[api/ads/boost] POST failed:", error);
    const msg = error instanceof Error ? error.message : "Error al aprobar boost";
    return apiError(msg, 500);
  }
}

// ─── DELETE: Cancel a boost ────────────────────────────────────────────────────

const cancelSchema = z.object({
  boostId: z.string().min(1),
});

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = cancelSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    const { boostId } = parsed.data;

    const boost = await db.boost.findUnique({ where: { id: boostId } });
    if (!boost) return apiError("Boost no encontrado", 404);

    // Cancel in Meta if active
    if (boost.metaCampaignId && boost.status === "ACTIVE") {
      await cancelBoost(boost.metaCampaignId);
    }

    await db.boost.update({
      where: { id: boostId },
      data: { status: "CANCELLED", completedAt: new Date() },
    });

    // If pending, mark notification as dismissed
    if (boost.notificationId && boost.status === "PENDING") {
      try {
        const { dismiss } = await import("@/lib/notifications/notification-engine");
        await dismiss(boost.notificationId);
      } catch { /* non-critical */ }
    }

    await db.auditLog.create({
      data: {
        action: "BOOST_CANCELLED",
        entity: "Boost",
        entityId: boostId,
        details: { metaCampaignId: boost.metaCampaignId },
      },
    });

    return apiSuccess({ boostId, status: "CANCELLED" });
  } catch (error) {
    console.error("[api/ads/boost] DELETE failed:", error);
    return apiError("Error al cancelar boost", 500);
  }
}
