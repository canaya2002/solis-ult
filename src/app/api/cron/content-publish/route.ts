// SOLIS AI — Auto-publish scheduled content (every 5 minutes)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { publishToFacebook, publishToInstagram } from "@/lib/social/meta";
import { sendTeamAlert } from "@/lib/comms/resend";
import { apiSuccess, apiError } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError("Unauthorized", 401);
  }

  try {
    const now = new Date();
    const dueContent = await db.content.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: now },
      },
    });

    if (!dueContent.length) {
      return apiSuccess({ published: 0, failed: 0 });
    }

    let published = 0;
    let failed = 0;
    const failures: string[] = [];

    for (const content of dueContent) {
      const text =
        content.body +
        (content.hashtags.length
          ? "\n\n" + content.hashtags.map((h) => `#${h}`).join(" ")
          : "");

      try {
        let result: { id: string } | { error: string } | null = null;

        switch (content.platform) {
          case "FACEBOOK":
            result = await publishToFacebook({
              message: text,
              mediaUrl: content.mediaUrl || undefined,
            });
            break;
          case "INSTAGRAM":
            if (content.mediaUrl) {
              result = await publishToInstagram({
                caption: text,
                mediaUrl: content.mediaUrl,
                mediaType: "IMAGE",
              });
            } else {
              result = { error: "Instagram requiere media" };
            }
            break;
          case "TIKTOK":
            if (content.mediaUrl) {
              const { publishVideo } = await import("@/lib/social/tiktok");
              const ttResult = await publishVideo({
                videoUrl: content.mediaUrl,
                title: text.slice(0, 150),
              });
              result = "publishId" in ttResult
                ? { id: ttResult.publishId }
                : ttResult;
            } else {
              result = { error: "TikTok requiere video" };
            }
            break;
          case "BLOG":
            result = { id: "blog-" + content.id };
            break;
          default:
            result = { error: `Plataforma ${content.platform} no auto-publish` };
        }

        if (result && "id" in result) {
          await db.content.update({
            where: { id: content.id },
            data: {
              status: "PUBLISHED",
              publishedAt: now,
              externalId: result.id,
            },
          });
          published++;
        } else {
          const err = result && "error" in result ? result.error : "Unknown";
          await db.content.update({
            where: { id: content.id },
            data: { status: "FAILED" },
          });
          failures.push(`${content.title} (${content.platform}): ${err}`);
          failed++;
        }
      } catch (e) {
        await db.content.update({
          where: { id: content.id },
          data: { status: "FAILED" },
        });
        failures.push(
          `${content.title}: ${e instanceof Error ? e.message : "Error"}`
        );
        failed++;
      }
    }

    // Alert team on failures
    if (failures.length > 0) {
      sendTeamAlert({
        subject: `Auto-publish: ${failed} publicaciones fallaron`,
        body: `<p>${published} publicadas, ${failed} fallaron:</p><ul>${failures.map((f) => `<li>${f}</li>`).join("")}</ul>`,
        priority: "high",
      }).catch((e) =>
        console.error("[cron/content-publish] Alert failed:", e)
      );
    }

    console.info(
      `[cron/content-publish] ${published} published, ${failed} failed`
    );
    return apiSuccess({ published, failed });
  } catch (error) {
    console.error("[cron/content-publish] failed:", error);
    return apiError("Cron job failed", 500);
  }
}
