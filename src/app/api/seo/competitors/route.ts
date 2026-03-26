// SOLIS AI — Competitors management API
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/utils";

const createSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(3),
  city: z.string().min(1),
  notes: z.string().optional(),
});

const deleteSchema = z.object({
  competitorId: z.string().min(1),
});

export async function GET() {
  try {
    const competitors = await db.competitor.findMany({
      include: {
        analyses: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    return apiSuccess({ competitors });
  } catch (error) {
    console.error("[api/seo/competitors] GET failed:", error);
    return apiError("Error al obtener competidores", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    const competitor = await db.competitor.create({
      data: parsed.data,
    });
    return apiSuccess(competitor);
  } catch (error) {
    console.error("[api/seo/competitors] POST failed:", error);
    return apiError("Error al crear competidor", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    await db.competitor.delete({ where: { id: parsed.data.competitorId } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("[api/seo/competitors] DELETE failed:", error);
    return apiError("Error al eliminar competidor", 500);
  }
}
