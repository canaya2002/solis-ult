// SOLIS AI — Daily review sync cron (9am CT / 2pm UTC)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAllOfficeReviews } from "@/lib/social/google-business";
import { generateReviewResponse } from "@/lib/ai/claude";
import { sendTeamAlert } from "@/lib/comms/resend";
import { apiSuccess, apiError } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError("Unauthorized", 401);
  }

  try {
    const officeReviews = await getAllOfficeReviews();
    let newCount = 0;
    let negativeCount = 0;

    for (const [officeName, reviews] of Object.entries(officeReviews)) {
      for (const review of reviews) {
        const exists = await db.review.findFirst({
          where: { externalId: review.reviewId },
        });
        if (exists) continue;

        let responseDraft = "";
        try {
          responseDraft = await generateReviewResponse({
            rating: review.starRating,
            text: review.comment,
            officeName,
          });
        } catch { /* skip */ }

        await db.review.create({
          data: {
            source: "GOOGLE",
            externalId: review.reviewId,
            rating: review.starRating,
            text: review.comment,
            author: review.reviewer.displayName,
            officeName,
            responseDraft: responseDraft || null,
            responseStatus: "PENDING",
          },
        });
        newCount++;
        if (review.starRating <= 3) negativeCount++;
      }
    }

    if (negativeCount > 0) {
      await sendTeamAlert({
        subject: `${negativeCount} review(s) negativa(s) nueva(s)`,
        body: `<p>Se detectaron <strong>${negativeCount}</strong> reviews negativas hoy.</p><p><a href="${process.env.APP_URL}/reputation" style="color:#cda64e;">Revisar →</a></p>`,
        priority: "high",
      }).catch(() => {});
    }

    console.info(`[cron/review-sync] ${newCount} new, ${negativeCount} negative`);
    return apiSuccess({ newCount, negativeCount });
  } catch (error) {
    console.error("[cron/review-sync] failed:", error);
    return apiError("Cron failed", 500);
  }
}
