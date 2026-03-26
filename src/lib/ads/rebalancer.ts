// SOLIS AI — Meta Ads Budget Rebalancer
import {
  getCampaigns,
  getCampaignInsights,
  pauseCampaign,
  updateCampaignBudget,
} from "@/lib/social/meta-ads";
import { analyzeContent } from "@/lib/ai/claude";
import { sendTeamAlert } from "@/lib/comms/resend";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { CPL_THRESHOLD } from "@/lib/constants";

export interface RebalanceResult {
  paused: Array<{
    campaignId: string;
    name: string;
    cpl: number;
    budgetFreed: number;
  }>;
  scaled: Array<{
    campaignId: string;
    name: string;
    cpl: number;
    previousBudget: number;
    newBudget: number;
  }>;
  maintained: Array<{ campaignId: string; name: string; cpl: number }>;
  totalBudgetFreed: number;
  totalBudgetRedistributed: number;
  summary: string;
  executedAt: Date;
  dryRun: boolean;
}

export async function executeRebalance(options?: {
  dryRun?: boolean;
  cplThreshold?: number;
}): Promise<RebalanceResult> {
  const dryRun = options?.dryRun ?? false;
  const threshold = options?.cplThreshold ?? CPL_THRESHOLD;
  const scaleThreshold = threshold / 2;

  const result: RebalanceResult = {
    paused: [],
    scaled: [],
    maintained: [],
    totalBudgetFreed: 0,
    totalBudgetRedistributed: 0,
    summary: "",
    executedAt: new Date(),
    dryRun,
  };

  try {
    // 1. Get all campaigns
    const campaigns = await getCampaigns();
    if (!campaigns.length) {
      result.summary = "No se encontraron campañas en la cuenta de Meta Ads.";
      return result;
    }

    const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE");
    if (!activeCampaigns.length) {
      result.summary = "No hay campañas activas para rebalancear.";
      return result;
    }

    // 2. Get insights for each active campaign (last 24h)
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 3600000);
    const dateRange = {
      since: yesterday.toISOString().split("T")[0],
      until: now.toISOString().split("T")[0],
    };

    type CampaignWithInsights = {
      id: string;
      metaId: string;
      name: string;
      dailyBudget: number;
      spend: number;
      leads: number;
      cpl: number;
      ctr: number;
      impressions: number;
    };

    const campaignsWithData: CampaignWithInsights[] = [];

    for (const campaign of activeCampaigns) {
      const insights = await getCampaignInsights(campaign.id, dateRange);
      const spend = insights?.spend ?? 0;
      const leads = insights?.leads ?? 0;
      const cpl = leads > 0 ? spend / leads : spend > 0 ? Infinity : 0;

      campaignsWithData.push({
        id: campaign.id,
        metaId: campaign.id,
        name: campaign.name,
        dailyBudget: campaign.dailyBudget,
        spend,
        leads,
        cpl: cpl === Infinity ? 9999 : cpl,
        ctr: insights?.ctr ?? 0,
        impressions: insights?.impressions ?? 0,
      });
    }

    // 3. Classify campaigns
    const toPause = campaignsWithData.filter(
      (c) => c.cpl > threshold && c.spend > 0
    );
    const toScale = campaignsWithData.filter(
      (c) => c.cpl > 0 && c.cpl < scaleThreshold && c.leads > 0
    );
    const toMaintain = campaignsWithData.filter(
      (c) =>
        !toPause.includes(c) && !toScale.includes(c)
    );

    // 4. Pause expensive campaigns
    for (const campaign of toPause) {
      if (!dryRun) {
        const paused = await pauseCampaign(campaign.metaId);
        if (paused) {
          await db.campaign.updateMany({
            where: { metaCampaignId: campaign.metaId },
            data: { status: "PAUSED_BY_AI" },
          });

          const dbCampaign = await db.campaign.findUnique({
            where: { metaCampaignId: campaign.metaId },
          });
          if (dbCampaign) {
            await db.campaignLog.create({
              data: {
                campaignId: dbCampaign.id,
                action: "paused_by_ai",
                details: {
                  reason: `CPL $${campaign.cpl.toFixed(2)} exceeds threshold $${threshold}`,
                  cpl: campaign.cpl,
                  threshold,
                  spend: campaign.spend,
                  leads: campaign.leads,
                },
              },
            });
          }
        }
      }
      result.paused.push({
        campaignId: campaign.metaId,
        name: campaign.name,
        cpl: campaign.cpl,
        budgetFreed: campaign.dailyBudget,
      });
      result.totalBudgetFreed += campaign.dailyBudget;
    }

    // 5. Redistribute freed budget to scaling campaigns
    if (toScale.length > 0 && result.totalBudgetFreed > 0) {
      const totalScaleCpl = toScale.reduce((s, c) => s + (1 / c.cpl), 0);

      for (const campaign of toScale) {
        const weight = (1 / campaign.cpl) / totalScaleCpl;
        const budgetIncrease = result.totalBudgetFreed * weight;
        const newBudget = campaign.dailyBudget + budgetIncrease;

        if (!dryRun) {
          const updated = await updateCampaignBudget(
            campaign.metaId,
            newBudget
          );
          if (updated) {
            await db.campaign.updateMany({
              where: { metaCampaignId: campaign.metaId },
              data: { lastRebalancedAt: new Date() },
            });

            const dbCampaign = await db.campaign.findUnique({
              where: { metaCampaignId: campaign.metaId },
            });
            if (dbCampaign) {
              await db.campaignLog.create({
                data: {
                  campaignId: dbCampaign.id,
                  action: "budget_increased",
                  details: {
                    reason: `Low CPL $${campaign.cpl.toFixed(2)} - scaling up`,
                    previousBudget: campaign.dailyBudget,
                    newBudget,
                    budgetIncrease,
                  },
                },
              });
            }
          }
        }

        result.scaled.push({
          campaignId: campaign.metaId,
          name: campaign.name,
          cpl: campaign.cpl,
          previousBudget: campaign.dailyBudget,
          newBudget,
        });
        result.totalBudgetRedistributed += budgetIncrease;
      }
    }

    // 6. Record maintained campaigns
    for (const campaign of toMaintain) {
      result.maintained.push({
        campaignId: campaign.metaId,
        name: campaign.name,
        cpl: campaign.cpl,
      });
    }

    // 7. Generate summary with AI
    const summaryData = `
Rebalanceo ${dryRun ? "(PREVIEW)" : ""} — ${result.executedAt.toISOString()}
Threshold CPL: $${threshold}
Campañas pausadas: ${result.paused.length} (${result.paused.map((c) => `${c.name}: CPL $${c.cpl.toFixed(2)}`).join(", ") || "ninguna"})
Campañas escaladas: ${result.scaled.length} (${result.scaled.map((c) => `${c.name}: CPL $${c.cpl.toFixed(2)}, budget $${c.previousBudget.toFixed(0)}→$${c.newBudget.toFixed(0)}`).join(", ") || "ninguna"})
Campañas mantenidas: ${result.maintained.length}
Budget liberado: $${result.totalBudgetFreed.toFixed(2)}
Budget redistribuido: $${result.totalBudgetRedistributed.toFixed(2)}`;

    try {
      result.summary = await analyzeContent(
        summaryData,
        "Resume este rebalanceo de campañas de Meta Ads para el equipo de marketing de Manuel Solís Law Office. Sé conciso y directo. Incluye cuánto se ahorró y qué acciones se tomaron. Máximo 5 oraciones. En español."
      );
    } catch {
      result.summary = `Se pausaron ${result.paused.length} campañas (liberando $${result.totalBudgetFreed.toFixed(2)}/día) y se escalaron ${result.scaled.length} campañas con bajo CPL.`;
    }

    // 8. Send email alert (only on real execution)
    if (!dryRun && (result.paused.length > 0 || result.scaled.length > 0)) {
      try {
        await sendTeamAlert({
          subject: `Rebalanceo Meta Ads: ${result.paused.length} pausadas, ${result.scaled.length} escaladas`,
          body: result.summary,
          priority: result.paused.length > 0 ? "high" : "medium",
        });
      } catch (e) {
        console.error("[rebalancer] Failed to send email alert:", e);
      }
    }

    // 9. Invalidate cache
    await redis.del("ads:campaigns");

    console.info(
      `[rebalancer] ${dryRun ? "PREVIEW" : "EXECUTED"}: paused=${result.paused.length}, scaled=${result.scaled.length}, freed=$${result.totalBudgetFreed.toFixed(2)}`
    );
  } catch (error) {
    console.error("[rebalancer] executeRebalance failed:", error);
    result.summary =
      error instanceof Error ? error.message : "Error ejecutando rebalanceo";
  }

  return result;
}
