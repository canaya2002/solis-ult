// SOLIS AI — Sync reviews from Google Business Profile
import { db } from "@/lib/db";
import { getAllOfficeReviews } from "@/lib/social/google-business";
import { generateReviewResponse } from "@/lib/ai/claude";
import { sendTeamAlert } from "@/lib/comms/resend";
import { apiSuccess, apiError } from "@/lib/utils";

export async function POST() {
  try {
    const officeReviews = await getAllOfficeReviews();
    let newCount = 0;
    let negativeCount = 0;

    for (const [officeName, reviews] of Object.entries(officeReviews)) {
      for (const review of reviews) {
        const exists = await db.review.findFirst({
          where: {
            OR: [
              { externalId: review.reviewId },
              {
                source: "GOOGLE",
                officeName,
                author: review.reviewer.displayName,
                text: review.comment,
              },
            ],
          },
        });
        if (exists) continue;

        // Generate response draft
        let responseDraft = "";
        try {
          responseDraft = await generateReviewResponse({
            rating: review.starRating,
            text: review.comment,
            officeName,
          });
        } catch { /* AI not available */ }

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

    // Alert on negative reviews
    if (negativeCount > 0) {
      sendTeamAlert({
        subject: `${negativeCount} review(s) negativa(s) detectada(s)`,
        body: `<p>Se encontraron <strong>${negativeCount} reviews negativas</strong> (≤3 estrellas) durante la sincronización.</p>
          <p><a href="${process.env.APP_URL || "http://localhost:3000"}/reputation" style="color:#cda64e;">Revisar y responder →</a></p>`,
        priority: "high",
      }).catch((e) => console.error("[reviews/sync] Alert failed:", e));
    }

    console.info(`[reviews/sync] ${newCount} new reviews, ${negativeCount} negative`);
    return apiSuccess({ newReviews: newCount, negativeReviews: negativeCount });
  } catch (error) {
    console.error("[api/reviews/sync] POST failed:", error);
    return apiError("Error al sincronizar reviews", 500);
  }
}
