// SOLIS AI — Rebalance API route
import { NextRequest } from "next/server";
import { z } from "zod";
import { executeRebalance } from "@/lib/ads/rebalancer";
import { apiSuccess, apiError } from "@/lib/utils";

const rebalanceSchema = z.object({
  dryRun: z.boolean().default(false),
  cplThreshold: z.number().positive().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = rebalanceSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message);
    }

    const result = await executeRebalance({
      dryRun: parsed.data.dryRun,
      cplThreshold: parsed.data.cplThreshold,
    });

    return apiSuccess(result);
  } catch (error) {
    console.error("[api/ads/rebalance] POST failed:", error);
    return apiError("Error al ejecutar rebalanceo", 500);
  }
}
