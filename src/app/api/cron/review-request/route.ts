// SOLIS AI — Review Request Cron (daily 10am CT / 3pm UTC)
// Sends review requests to clients who converted 7+ days ago and haven't been asked yet
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sendReviewRequest } from "@/lib/comms/twilio";
import { REVIEW_REQUEST_DELAY_DAYS, MAX_REVIEW_REMINDERS } from "@/lib/constants";
import { apiSuccess, apiError } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError("Unauthorized", 401);
  }

  try {
    const cutoffDate = new Date(
      Date.now() - REVIEW_REQUEST_DELAY_DAYS * 86400000
    );

    // Find converted leads who haven't been asked for a review yet
    const eligibleLeads = await db.lead.findMany({
      where: {
        status: "CONVERTED",
        convertedAt: { lte: cutoffDate },
        reviewRequested: false,
        reviewLeft: false,
        phone: { not: null },
      },
      take: 10, // Process max 10 per run to avoid rate limits
    });

    let sent = 0;
    let failed = 0;

    const reviewLinks: Record<string, string> = {
      Dallas: "https://g.page/r/manuelsolis-dallas/review",
      Chicago: "https://g.page/r/manuelsolis-chicago/review",
      "Los Angeles": "https://g.page/r/manuelsolis-la/review",
      Memphis: "https://g.page/r/manuelsolis-memphis/review",
    };

    for (const lead of eligibleLeads) {
      if (!lead.phone) continue;

      const officeName = lead.city || "Dallas";
      const reviewLink =
        reviewLinks[officeName] || reviewLinks["Dallas"];

      const result = await sendReviewRequest({
        name: lead.name,
        phone: lead.phone,
        officeName,
        googleReviewLink: reviewLink,
      });

      if (result.success) {
        await db.lead.update({
          where: { id: lead.id },
          data: { reviewRequested: true },
        });
        sent++;
      } else {
        failed++;
      }
    }

    console.info(
      `[cron/review-request] Sent ${sent}, failed ${failed} out of ${eligibleLeads.length}`
    );
    return apiSuccess({ sent, failed, eligible: eligibleLeads.length });
  } catch (error) {
    console.error("[cron/review-request] failed:", error);
    return apiError("Cron job failed", 500);
  }
}
