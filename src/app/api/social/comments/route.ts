// SOLIS AI — Comments management API
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { replyToComment } from "@/lib/social/meta";
import { apiSuccess, apiError } from "@/lib/utils";

const actionSchema = z.object({
  commentId: z.string().min(1),
  action: z.enum(["approve", "edit_and_approve", "ignore", "edit_draft"]),
  editedResponse: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const platform = searchParams.get("platform");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

    const where: Record<string, unknown> = {};
    if (status) where.responseStatus = status;
    if (category) where.category = category;
    if (platform) where.platform = platform;

    const [comments, total] = await Promise.all([
      db.comment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.comment.count({ where }),
    ]);

    const [pending, approved, published, ignored] = await Promise.all([
      db.comment.count({ where: { responseStatus: "PENDING" } }),
      db.comment.count({ where: { responseStatus: "APPROVED" } }),
      db.comment.count({ where: { responseStatus: "PUBLISHED" } }),
      db.comment.count({ where: { responseStatus: "IGNORED" } }),
    ]);

    const categoryCounts = await db.comment.groupBy({
      by: ["category"],
      _count: { id: true },
    });
    const byCategory: Record<string, number> = {};
    for (const row of categoryCounts) {
      if (row.category) byCategory[row.category] = row._count.id;
    }

    return apiSuccess({
      comments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      counts: { pending, approved, published, ignored, byCategory },
    });
  } catch (error) {
    console.error("[api/social/comments] GET failed:", error);
    return apiError("Error al obtener comentarios", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    const { commentId, action, editedResponse } = parsed.data;
    const comment = await db.comment.findUnique({ where: { id: commentId } });
    if (!comment) return apiError("Comentario no encontrado", 404);

    switch (action) {
      case "approve": {
        if (!comment.responseDraft) return apiError("No hay respuesta draft");
        const result = await replyToComment(comment.externalId, comment.responseDraft);
        if ("error" in result) return apiError(result.error);
        await db.comment.update({
          where: { id: commentId },
          data: { responseStatus: "PUBLISHED", respondedAt: new Date() },
        });
        break;
      }
      case "edit_and_approve": {
        if (!editedResponse) return apiError("Se requiere editedResponse");
        const result = await replyToComment(comment.externalId, editedResponse);
        if ("error" in result) return apiError(result.error);
        await db.comment.update({
          where: { id: commentId },
          data: { responseDraft: editedResponse, responseStatus: "PUBLISHED", respondedAt: new Date() },
        });
        break;
      }
      case "ignore":
        await db.comment.update({
          where: { id: commentId },
          data: { responseStatus: "IGNORED" },
        });
        break;
      case "edit_draft":
        if (!editedResponse) return apiError("Se requiere editedResponse");
        await db.comment.update({
          where: { id: commentId },
          data: { responseDraft: editedResponse },
        });
        break;
    }

    await db.auditLog.create({
      data: {
        action: `comment_${action}`,
        entity: "Comment",
        entityId: commentId,
        details: { action, platform: comment.platform },
      },
    });

    const updated = await db.comment.findUnique({ where: { id: commentId } });
    return apiSuccess(updated);
  } catch (error) {
    console.error("[api/social/comments] POST failed:", error);
    return apiError("Error al procesar comentario", 500);
  }
}
