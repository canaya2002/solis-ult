// SOLIS AI — Learning System API
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { runLearningCycle } from "@/lib/analytics/learning-engine";
import { apiSuccess, apiError } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const category = searchParams.get("category");

    const where = category ? { category } : {};
    const insights = await db.aILearning.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return apiSuccess({ insights });
  } catch (error) {
    console.error("[api/analytics/learning] GET failed:", error);
    return apiError("Error al obtener insights", 500);
  }
}

export async function POST() {
  try {
    const result = await runLearningCycle();
    return apiSuccess(result);
  } catch (error) {
    console.error("[api/analytics/learning] POST failed:", error);
    return apiError("Error al ejecutar ciclo de aprendizaje", 500);
  }
}
