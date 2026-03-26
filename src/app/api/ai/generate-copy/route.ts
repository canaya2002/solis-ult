// SOLIS AI — Copy Generation API
import { NextRequest } from "next/server";
import { z } from "zod";
import { generateCopy } from "@/lib/ai/openai";
import { db } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/utils";

const PLATFORMS = ["facebook", "instagram", "tiktok", "youtube"] as const;

const schema = z.object({
  topic: z.string().min(3).max(500),
  platform: z.union([
    z.enum(PLATFORMS),
    z.array(z.enum(PLATFORMS)).min(1),
  ]),
  tone: z.string().optional(),
  language: z.enum(["es", "en"]).default("es"),
  ideaId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    const { topic, platform, tone, language, ideaId } = parsed.data;
    const platforms = Array.isArray(platform) ? platform : [platform];

    // Mark idea as used
    if (ideaId) {
      await db.contentIdea.updateMany({
        where: { id: ideaId },
        data: { used: true },
      });
    }

    const results: Array<{
      id: string;
      platform: string;
      variants: Awaited<ReturnType<typeof generateCopy>>;
      generatedAt: string;
    }> = [];

    for (const p of platforms) {
      const variants = await generateCopy({
        topic,
        platform: p,
        tone,
        language,
      });

      // Save first variant as draft in DB
      if (variants.length > 0) {
        const content = await db.content.create({
          data: {
            title: topic.slice(0, 100),
            body: variants[0].caption,
            platform: p.toUpperCase() as "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "BLOG",
            contentType: "OTHER",
            status: "DRAFT",
            hashtags: variants[0].hashtags,
            aiGenerated: true,
          },
        });

        results.push({
          id: content.id,
          platform: p,
          variants,
          generatedAt: new Date().toISOString(),
        });
      }
    }

    console.info(
      `[generate-copy] Generated copies for ${platforms.join(", ")}`
    );
    return apiSuccess({ copies: results });
  } catch (error) {
    console.error("[api/ai/generate-copy] POST failed:", error);
    return apiError("Error al generar copies", 500);
  }
}
