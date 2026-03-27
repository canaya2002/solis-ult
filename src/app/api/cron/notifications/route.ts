// SOLIS AI — Cron: Process notification reminders and expirations
// Runs every 30 minutes
import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/utils";
import { processReminders, getPendingSummary } from "@/lib/notifications/notification-engine";
import { sendEmail } from "@/lib/comms/resend";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return apiError("Unauthorized", 401);

  try {
    // Process reminders and expire old notifications
    const { reminded, expired } = await processReminders();

    // If there are pending actions, send a summary digest (only if reminders were sent)
    if (reminded > 0) {
      const summary = await getPendingSummary();
      if (summary) {
        try {
          await sendEmail({
            to: ["marketing@manuelsolis.com"],
            subject: "SOLIS AI — Acciones pendientes",
            html: `
              <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #12141d; padding: 24px; border-radius: 8px;">
                  <h2 style="color: #cda64e; margin: 0 0 16px 0;">SOLIS AI</h2>
                  <p style="color: #e0e0e0; line-height: 1.6;">${summary}</p>
                  <div style="text-align: center; margin: 24px 0;">
                    <a href="${process.env.APP_URL || "http://localhost:3000"}" style="
                      display: inline-block;
                      background: #cda64e;
                      color: #12141d;
                      padding: 12px 32px;
                      border-radius: 6px;
                      text-decoration: none;
                      font-weight: 600;
                    ">Ver dashboard</a>
                  </div>
                </div>
              </div>
            `,
          });
        } catch {
          // Non-critical, continue
        }
      }
    }

    console.info(`[cron/notifications] Processed: ${reminded} reminded, ${expired} expired`);
    return apiSuccess({ reminded, expired });
  } catch (error) {
    console.error("[cron/notifications] Failed:", error);
    return apiError("Error processing notifications", 500);
  }
}
