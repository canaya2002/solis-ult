// SOLIS AI — Review response actions
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { replyToReview } from "@/lib/social/google-business";
import { generateReviewResponse } from "@/lib/ai/claude";
import { apiSuccess, apiError } from "@/lib/utils";

const schema = z.object({
  reviewId: z.string().min(1),
  action: z.enum(["approve", "edit_and_approve", "ignore", "regenerate"]),
  editedResponse: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    const { reviewId, action, editedResponse } = parsed.data;
    const review = await db.review.findUnique({ where: { id: reviewId } });
    if (!review) return apiError("Review no encontrada", 404);

    const accountId = process.env.GOOGLE_BUSINESS_ACCOUNT_ID || "";

    switch (action) {
      case "approve": {
        if (!review.responseDraft) return apiError("No hay respuesta draft");
        const locationMap: Record<string, string | undefined> = {
          Dallas: process.env.GOOGLE_BUSINESS_LOCATION_DALLAS,
          Chicago: process.env.GOOGLE_BUSINESS_LOCATION_CHICAGO,
          "Los Angeles": process.env.GOOGLE_BUSINESS_LOCATION_LA,
          Memphis: process.env.GOOGLE_BUSINESS_LOCATION_MEMPHIS,
        };
        const locationId = locationMap[review.officeName];
        if (accountId && locationId) {
          await replyToReview(
            `${accountId}/${locationId}/reviews/${review.externalId || review.id}`,
            review.responseDraft
          );
        }
        await db.review.update({
          where: { id: reviewId },
          data: { responseStatus: "PUBLISHED", respondedAt: new Date() },
        });
        break;
      }
      case "edit_and_approve": {
        if (!editedResponse) return apiError("Se requiere editedResponse");
        await db.review.update({
          where: { id: reviewId },
          data: {
            responseDraft: editedResponse,
            responseStatus: "PUBLISHED",
            respondedAt: new Date(),
          },
        });
        break;
      }
      case "ignore":
        await db.review.update({
          where: { id: reviewId },
          data: { responseStatus: "IGNORED" },
        });
        break;
      case "regenerate": {
        const newDraft = await generateReviewResponse({
          rating: review.rating,
          text: review.text,
          officeName: review.officeName,
        });
        await db.review.update({
          where: { id: reviewId },
          data: { responseDraft: newDraft, responseStatus: "PENDING" },
        });
        const updated = await db.review.findUnique({ where: { id: reviewId } });
        return apiSuccess(updated);
      }
    }

    await db.auditLog.create({
      data: {
        action: `review_${action}`,
        entity: "Review",
        entityId: reviewId,
        details: { action, officeName: review.officeName },
      },
    });

    const updated = await db.review.findUnique({ where: { id: reviewId } });
    return apiSuccess(updated);
  } catch (error) {
    console.error("[api/reviews/respond] POST failed:", error);
    return apiError("Error al responder review", 500);
  }
}
