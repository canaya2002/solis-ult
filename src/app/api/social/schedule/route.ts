// SOLIS AI — Content Scheduling API
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/utils";

const scheduleSchema = z.object({
  contentId: z.string().min(1),
  platform: z.string().optional(),
  scheduledAt: z.string().refine((s) => new Date(s) > new Date(), {
    message: "La fecha debe ser en el futuro",
  }),
  mediaUrl: z.string().url().optional(),
});

const deleteSchema = z.object({
  contentId: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const platform = searchParams.get("platform");

    const where: Record<string, unknown> = {};
    if (platform) where.platform = platform.toUpperCase();

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);

    const [scheduled, published, failed] = await Promise.all([
      db.content.findMany({
        where: {
          ...where,
          status: "SCHEDULED",
          ...(from || to
            ? {
                scheduledAt: {
                  ...(from ? { gte: new Date(from) } : {}),
                  ...(to ? { lte: new Date(to) } : {}),
                },
              }
            : {}),
        },
        orderBy: { scheduledAt: "asc" },
      }),
      db.content.findMany({
        where: {
          ...where,
          status: "PUBLISHED",
          publishedAt: { gte: weekAgo },
        },
        orderBy: { publishedAt: "desc" },
        take: 50,
      }),
      db.content.findMany({
        where: {
          ...where,
          status: "FAILED",
          updatedAt: { gte: weekAgo },
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ]);

    return apiSuccess({ scheduled, published, failed });
  } catch (error) {
    console.error("[api/social/schedule] GET failed:", error);
    return apiError("Error al obtener calendario", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = scheduleSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    const content = await db.content.findUnique({
      where: { id: parsed.data.contentId },
    });
    if (!content) return apiError("Contenido no encontrado", 404);

    const updated = await db.content.update({
      where: { id: parsed.data.contentId },
      data: {
        status: "SCHEDULED",
        scheduledAt: new Date(parsed.data.scheduledAt),
        mediaUrl: parsed.data.mediaUrl || content.mediaUrl,
      },
    });

    console.info(
      `[schedule] Content ${updated.id} scheduled for ${parsed.data.scheduledAt}`
    );
    return apiSuccess(updated);
  } catch (error) {
    console.error("[api/social/schedule] POST failed:", error);
    return apiError("Error al programar contenido", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    const updated = await db.content.update({
      where: { id: parsed.data.contentId },
      data: {
        status: "DRAFT",
        scheduledAt: null,
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    console.error("[api/social/schedule] DELETE failed:", error);
    return apiError("Error al cancelar programación", 500);
  }
}
