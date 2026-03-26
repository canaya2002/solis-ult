// SOLIS AI — ROI by Channel API
import { NextRequest } from "next/server";
import { z } from "zod";
import { calculateROI } from "@/lib/analytics/roi-calculator";
import { redis } from "@/lib/redis";
import { apiSuccess, apiError } from "@/lib/utils";

const periodSchema = z.enum(["30d", "90d", "12m", "all"]).default("30d");

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = periodSchema.safeParse(searchParams.get("period") || "30d");
    const period = parsed.success ? parsed.data : "30d";

    const cacheKey = `analytics:roi:${period}`;
    const cached = await redis.get(cacheKey);
    if (cached) return apiSuccess(cached);

    const report = await calculateROI(period);
    await redis.set(cacheKey, report, { ex: 1800 });
    return apiSuccess(report);
  } catch (error) {
    console.error("[api/analytics/roi] GET failed:", error);
    return apiError("Error al calcular ROI", 500);
  }
}
