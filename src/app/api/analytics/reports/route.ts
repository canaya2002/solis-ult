// SOLIS AI — Weekly Reports API
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateFullWeeklyReport } from "@/lib/reports/weekly-report-generator";
import { apiSuccess, apiError } from "@/lib/utils";

const createSchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");

    if (id) {
      const report = await db.weeklyReport.findUnique({ where: { id } });
      if (!report) return apiError("Reporte no encontrado", 404);
      return apiSuccess(report);
    }

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);

    const [reports, total] = await Promise.all([
      db.weeklyReport.findMany({
        orderBy: { periodEnd: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.weeklyReport.count(),
    ]);

    return apiSuccess({ reports, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("[api/analytics/reports] GET failed:", error);
    return apiError("Error al obtener reportes", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    const report = await generateFullWeeklyReport(
      new Date(parsed.data.periodStart),
      new Date(parsed.data.periodEnd)
    );

    return apiSuccess(report);
  } catch (error) {
    console.error("[api/analytics/reports] POST failed:", error);
    return apiError("Error al generar reporte", 500);
  }
}
