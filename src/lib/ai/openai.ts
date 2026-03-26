// SOLIS AI — OpenAI GPT-4o-mini + Whisper wrapper
import OpenAI from "openai";
import { aiRatelimit } from "@/lib/redis";
import {
  COPY_SYSTEM_PROMPT,
  COMMENT_CLASSIFIER_PROMPT,
  LEAD_QUALIFIER_PROMPT,
  PODCAST_TO_BLOG_PROMPT,
} from "./prompts/copy-generation";
import type {
  CopyVariant,
  CommentClassification,
  LeadQualification,
  TranscriptionResult,
  BlogArticle,
} from "@/types/ai";

const TEXT_MODEL = "gpt-4o-mini";

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((r) => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  throw new Error("Max retries reached");
}

async function checkRate(identifier: string): Promise<void> {
  const { success } = await aiRatelimit.limit(identifier);
  if (!success) throw new Error("Rate limit exceeded for OpenAI API");
}

async function chatComplete(
  userPrompt: string,
  systemPrompt: string
): Promise<string> {
  const client = getClient();
  if (!client) throw new Error("API_KEY not configured: OPENAI_API_KEY");

  await checkRate("openai-text");

  const response = await client.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || "";
}

export async function generateCopy(params: {
  topic: string;
  platform: "facebook" | "instagram" | "tiktok" | "youtube";
  tone?: string;
  language?: "es" | "en";
}): Promise<CopyVariant[]> {
  try {
    const { topic, platform, tone = "empathetic", language = "es" } = params;

    const platformInstructions: Record<string, string> = {
      facebook:
        "Genera un caption para Facebook con emojis moderados y 30 hashtags relevantes de inmigración.",
      instagram:
        "Genera un caption para Instagram con emojis, 30 hashtags relevantes y un CTA en la bio.",
      tiktok:
        "Genera un script para TikTok: hook en los primeros 3 segundos, texto corto y directo, hashtags trending.",
      youtube:
        "Genera un título SEO, descripción con timestamps y tags para YouTube.",
    };

    const prompt = `Tema: ${topic}
Plataforma: ${platform}
Tono: ${tone}
Idioma: ${language === "es" ? "Español" : "English"}

${platformInstructions[platform]}

Genera 3 variantes diferentes. Retorna JSON array: [{ "variant": 1, "caption": "", "hashtags": [], "platform": "${platform}", "cta": "" }]`;

    const raw = await withRetry(() => chatComplete(prompt, COPY_SYSTEM_PROMPT));
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("[openai] generateCopy: no JSON array in response");
      return [];
    }
    const variants: CopyVariant[] = JSON.parse(jsonMatch[0]);
    console.info(
      `[openai] generateCopy generated ${variants.length} variants for ${platform}`
    );
    return variants;
  } catch (error) {
    console.error("[openai] generateCopy failed:", error);
    return [];
  }
}

export async function classifyComment(
  comment: string
): Promise<CommentClassification> {
  const fallback: CommentClassification = {
    category: "OTHER",
    confidence: 0,
    suggestedResponse: "",
  };
  try {
    const raw = await withRetry(() =>
      chatComplete(
        `Comentario: "${comment}"`,
        COMMENT_CLASSIFIER_PROMPT
      )
    );
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;
    const result: CommentClassification = JSON.parse(jsonMatch[0]);
    console.info(
      `[openai] classifyComment: ${result.category} (${result.confidence})`
    );
    return result;
  } catch (error) {
    console.error("[openai] classifyComment failed:", error);
    return fallback;
  }
}

export async function qualifyLead(
  messages: string[]
): Promise<LeadQualification> {
  const fallback: LeadQualification = {
    caseType: "other",
    city: "",
    urgency: 1,
    language: "es",
    summary: "",
  };
  try {
    const raw = await withRetry(() =>
      chatComplete(
        `Mensajes del lead:\n${messages.map((m, i) => `${i + 1}. ${m}`).join("\n")}`,
        LEAD_QUALIFIER_PROMPT
      )
    );
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;
    const result: LeadQualification = JSON.parse(jsonMatch[0]);
    console.info(
      `[openai] qualifyLead: ${result.caseType}, urgency ${result.urgency}`
    );
    return result;
  } catch (error) {
    console.error("[openai] qualifyLead failed:", error);
    return fallback;
  }
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  language = "es"
): Promise<TranscriptionResult> {
  const empty: TranscriptionResult = {
    text: "",
    segments: [],
    language: "",
    duration: 0,
  };
  try {
    const client = getClient();
    if (!client) {
      console.error("[openai] API_KEY not configured: OPENAI_API_KEY");
      return empty;
    }

    const { success } = await aiRatelimit.limit("openai-audio");
    if (!success) {
      console.error("[openai] Rate limit exceeded for audio transcription");
      return empty;
    }

    const file = new File([audioBuffer], "audio.mp3", { type: "audio/mpeg" });

    const response = await withRetry(() =>
      client.audio.transcriptions.create({
        model: "whisper-1",
        file,
        language,
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      })
    );

    const result: TranscriptionResult = {
      text: response.text,
      segments: (
        (response as unknown as { segments?: Array<{ start: number; end: number; text: string }> })
          .segments || []
      ).map((s) => ({
        start: s.start,
        end: s.end,
        text: s.text,
      })),
      language: (response as unknown as { language?: string }).language || language,
      duration: (response as unknown as { duration?: number }).duration || 0,
    };

    console.info(
      `[openai] transcribeAudio: ${result.duration}s, ${result.segments.length} segments`
    );
    return result;
  } catch (error) {
    console.error("[openai] transcribeAudio failed:", error);
    return empty;
  }
}

export async function podcastToBlog(
  transcription: string
): Promise<BlogArticle> {
  const empty: BlogArticle = {
    title: "",
    slug: "",
    content: "",
    metaDescription: "",
    keywords: [],
  };
  try {
    const raw = await withRetry(() =>
      chatComplete(
        `Transcripción del podcast:\n\n${transcription}`,
        PODCAST_TO_BLOG_PROMPT
      )
    );
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return empty;
    const article: BlogArticle = JSON.parse(jsonMatch[0]);
    console.info(`[openai] podcastToBlog: "${article.title}"`);
    return article;
  } catch (error) {
    console.error("[openai] podcastToBlog failed:", error);
    return empty;
  }
}
