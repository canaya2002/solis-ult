// SOLIS AI — Cron: A/B Test Analyzer
// Runs every 6 hours. Analyzes tests that have completed their test duration.
import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/utils";
import { db } from "@/lib/db";
import { analyzeABTest } from "@/lib/ads/ab-tester";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return apiError("Unauthorized", 401);

  try {
    const now = new Date();

    // Find running tests whose duration has elapsed
    const runningTests = await db.aBTest.findMany({
      where: { status: "RUNNING" },
    });

    let analyzed = 0;
    for (const test of runningTests) {
      if (!test.startedAt) continue;
      const elapsed = (now.getTime() - test.startedAt.getTime()) / (1000 * 60 * 60);
      if (elapsed >= test.testDuration) {
        try {
          await analyzeABTest(test.id);
          analyzed++;
        } catch (error) {
          console.error(`[cron/ab-test-analyzer] Failed to analyze ${test.id}:`, error);
        }
      }
    }

    console.info(`[cron/ab-test-analyzer] Checked ${runningTests.length} tests, analyzed ${analyzed}`);
    return apiSuccess({ checked: runningTests.length, analyzed });
  } catch (error) {
    console.error("[cron/ab-test-analyzer] Failed:", error);
    return apiError("Error analyzing tests", 500);
  }
}
