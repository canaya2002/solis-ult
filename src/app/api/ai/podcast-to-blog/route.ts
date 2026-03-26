// SOLIS AI — Podcast to Blog API
import { NextRequest } from "next/server";
import { z } from "zod";
import { podcastToBlog } from "@/lib/ai/openai";
import { db } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/utils";

const schema = z.object({
  transcription: z.string().min(50, "La transcripción es muy corta"),
  episodeTitle: z.string().optional(),
  episodeNumber: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    const { transcription, episodeTitle, episodeNumber } = parsed.data;

    const enrichedTranscription = episodeTitle
      ? `Título del episodio: ${episodeTitle}${episodeNumber ? ` (#${episodeNumber})` : ""}\n\n${transcription}`
      : transcription;

    const article = await podcastToBlog(enrichedTranscription);

    if (!article.title || !article.content) {
      return apiError("No se pudo generar el artículo");
    }

    const content = await db.content.create({
      data: {
        title: article.title,
        body: article.content,
        platform: "BLOG",
        contentType: "PODCAST_BLOG",
        status: "DRAFT",
        hashtags: article.keywords,
        aiGenerated: true,
      },
    });

    console.info(
      `[podcast-to-blog] Generated "${article.title}" → Content ${content.id}`
    );
    return apiSuccess({
      contentId: content.id,
      article,
    });
  } catch (error) {
    console.error("[api/ai/podcast-to-blog] POST failed:", error);
    return apiError("Error al generar artículo de blog", 500);
  }
}
