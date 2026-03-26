// SOLIS AI — Content Publishing API
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { publishToFacebook, publishToInstagram } from "@/lib/social/meta";
import { apiSuccess, apiError } from "@/lib/utils";

const schema = z.union([
  z.object({ contentId: z.string().min(1) }),
  z.object({ contentIds: z.array(z.string().min(1)).min(1) }),
]);

async function publishOne(contentId: string): Promise<{
  contentId: string;
  success: boolean;
  externalId?: string;
  error?: string;
}> {
  const content = await db.content.findUnique({
    where: { id: contentId },
  });
  if (!content) return { contentId, success: false, error: "Not found" };

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
          return {
            contentId,
            success: false,
            error: "Instagram requiere imagen o video",
          };
        }
        break;
      case "TIKTOK":
        // TikTok publishing requires video URL
        if (!content.mediaUrl) {
          return {
            contentId,
            success: false,
            error: "TikTok requiere video",
          };
        }
        // Dynamic import to avoid loading if not needed
        const { publishVideo } = await import("@/lib/social/tiktok");
        const tiktokResult = await publishVideo({
          videoUrl: content.mediaUrl,
          title: text.slice(0, 150),
        });
        result = "error" in tiktokResult
          ? tiktokResult
          : { id: tiktokResult.publishId };
        break;
      case "YOUTUBE":
        // YouTube only updates metadata of existing videos
        return {
          contentId,
          success: false,
          error:
            "YouTube: sube el video manualmente y usa el dashboard para actualizar metadata",
        };
      case "BLOG":
        // Blog posts are managed externally
        await db.content.update({
          where: { id: contentId },
          data: { status: "PUBLISHED", publishedAt: new Date() },
        });
        return { contentId, success: true };
      default:
        return {
          contentId,
          success: false,
          error: `Plataforma no soportada: ${content.platform}`,
        };
    }

    if (result && "id" in result) {
      await db.content.update({
        where: { id: contentId },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          externalId: result.id,
        },
      });
      await db.auditLog.create({
        data: {
          action: "content_published",
          entity: "Content",
          entityId: contentId,
          details: {
            platform: content.platform,
            externalId: result.id,
          },
        },
      });
      return { contentId, success: true, externalId: result.id };
    }

    const errorMsg =
      result && "error" in result ? result.error : "Publicación falló";
    await db.content.update({
      where: { id: contentId },
      data: { status: "FAILED" },
    });
    return { contentId, success: false, error: errorMsg };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    await db.content.update({
      where: { id: contentId },
      data: { status: "FAILED" },
    });
    return { contentId, success: false, error: msg };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    const ids =
      "contentIds" in parsed.data
        ? parsed.data.contentIds
        : [parsed.data.contentId];

    const results = await Promise.all(ids.map(publishOne));
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.info(
      `[publish] ${succeeded} published, ${failed} failed out of ${ids.length}`
    );
    return apiSuccess({ results, succeeded, failed });
  } catch (error) {
    console.error("[api/social/publish] POST failed:", error);
    return apiError("Error al publicar contenido", 500);
  }
}
