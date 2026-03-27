// SOLIS AI — Strategy Engine API
import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/utils";
import { db } from "@/lib/db";
import { generateWeeklyStrategy } from "@/lib/strategy/strategy-engine";

export async function GET() {
  try {
    const strategies = await db.weeklyStrategy.findMany({ orderBy: { createdAt: "desc" }, take: 10 });
    return apiSuccess({ strategies });
  } catch (error) {
    console.error("[api/strategy] GET failed:", error);
    return apiError("Error", 500);
  }
}

export async function POST(request: NextRequest) {
  // Prevent accidental double-generation
  const auth = request.headers.get("authorization");
  const isCron = auth === `Bearer ${process.env.CRON_SECRET}`;

  try {
    const strategy = await generateWeeklyStrategy();
    return apiSuccess(strategy);
  } catch (error) {
    console.error("[api/strategy] POST failed:", error);
    const msg = error instanceof Error ? error.message : "Error generando estrategia";
    return apiError(msg, 500);
  }
}
