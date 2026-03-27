// SOLIS AI — A/B Test API
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/utils";
import { db } from "@/lib/db";
import { createABTest, executeABTest, analyzeABTest } from "@/lib/ads/ab-tester";

export async function GET() {
  try {
    const tests = await db.aBTest.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
    return apiSuccess({ tests });
  } catch (error) {
    console.error("[api/ads/ab-test] GET failed:", error);
    return apiError("Error al obtener tests", 500);
  }
}

const createSchema = z.object({
  action: z.enum(["create", "approve", "apply_results"]),
  campaignName: z.string().optional(),
  mediaUrls: z.array(z.string()).optional(),
  copies: z.array(z.string()).optional(),
  dailyBudgetPerVariant: z.number().optional(),
  testDuration: z.number().optional(),
  testId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    const { action } = parsed.data;

    if (action === "create") {
      if (!parsed.data.campaignName || !parsed.data.mediaUrls?.length) {
        return apiError("campaignName y mediaUrls requeridos");
      }
      const plan = await createABTest({
        campaignName: parsed.data.campaignName,
        mediaUrls: parsed.data.mediaUrls,
        copies: parsed.data.copies,
        dailyBudgetPerVariant: parsed.data.dailyBudgetPerVariant || 10,
        testDuration: parsed.data.testDuration || 48,
      });
      return apiSuccess(plan);
    }

    if (action === "approve") {
      if (!parsed.data.testId) return apiError("testId requerido");
      const result = await executeABTest(parsed.data.testId);
      return apiSuccess(result);
    }

    if (action === "apply_results") {
      if (!parsed.data.testId) return apiError("testId requerido");
      const results = await analyzeABTest(parsed.data.testId);
      return apiSuccess(results);
    }

    return apiError("Acci\u00f3n no v\u00e1lida");
  } catch (error) {
    console.error("[api/ads/ab-test] POST failed:", error);
    const msg = error instanceof Error ? error.message : "Error";
    return apiError(msg, 500);
  }
}
