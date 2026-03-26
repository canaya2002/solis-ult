// SOLIS AI — Ads Rebalance Cron Job (Vercel Cron)
import { NextRequest } from "next/server";
import { executeRebalance } from "@/lib/ads/rebalancer";
import { apiSuccess, apiError } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError("Unauthorized", 401);
  }

  try {
    const result = await executeRebalance({ dryRun: false });

    console.info(
      `[cron/ads-rebalance] Completed: paused=${result.paused.length}, scaled=${result.scaled.length}`
    );

    return apiSuccess({
      paused: result.paused.length,
      scaled: result.scaled.length,
      totalBudgetFreed: result.totalBudgetFreed,
      summary: result.summary,
    });
  } catch (error) {
    console.error("[cron/ads-rebalance] failed:", error);
    return apiError("Cron job failed", 500);
  }
}
