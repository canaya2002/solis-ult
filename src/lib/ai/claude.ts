// SOLIS AI — Anthropic Claude API wrapper
import Anthropic from "@anthropic-ai/sdk";
import { aiRatelimit, redis } from "@/lib/redis";
import {
  TREND_ANALYSIS_PROMPT,
  SEO_ADVISOR_PROMPT,
  REVIEW_RESPONSE_PROMPT,
  WEEKLY_REPORT_PROMPT,
} from "./prompts/copy-generation";
import type { ContentIdea, SEOBriefData, WeeklyReportData } from "@/types/ai";

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 4096;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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
  if (!success) throw new Error("Rate limit exceeded for Claude API");
}

async function complete(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const client = getClient();
  if (!client) {
    throw new Error("API_KEY not configured: ANTHROPIC_API_KEY");
  }

  await checkRate("claude");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt || "You are a helpful assistant.",
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return block.text;
}

export async function analyzeContent(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  try {
    const result = await withRetry(() => complete(prompt, systemPrompt));
    console.info("[claude] analyzeContent completed");
    return result;
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Unknown error in analyzeContent";
    console.error("[claude] analyzeContent failed:", msg);
    return JSON.stringify({ error: msg });
  }
}

export async function analyzeTrends(
  trendData: string
): Promise<ContentIdea[]> {
  try {
    const raw = await withRetry(() =>
      complete(
        `Analiza estas tendencias y genera ideas de contenido en JSON array:\n\n${trendData}`,
        TREND_ANALYSIS_PROMPT
      )
    );
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("[claude] analyzeTrends: no JSON array in response");
      return [];
    }
    const ideas: ContentIdea[] = JSON.parse(jsonMatch[0]);
    console.info(`[claude] analyzeTrends generated ${ideas.length} ideas`);
    return ideas;
  } catch (error) {
    console.error("[claude] analyzeTrends failed:", error);
    return [];
  }
}

export async function generateSEOBrief(
  gscData: string,
  semrushData: string
): Promise<SEOBriefData> {
  const empty: SEOBriefData = {
    opportunities: [],
    quickWins: [],
    contentSuggestions: [],
    technicalIssues: [],
  };
  try {
    const raw = await withRetry(() =>
      complete(
        `Datos de Search Console:\n${gscData}\n\nDatos de Semrush:\n${semrushData}\n\nGenera el brief SEO semanal en JSON.`,
        SEO_ADVISOR_PROMPT
      )
    );
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return empty;
    const brief: SEOBriefData = JSON.parse(jsonMatch[0]);
    console.info("[claude] generateSEOBrief completed");
    return brief;
  } catch (error) {
    console.error("[claude] generateSEOBrief failed:", error);
    return empty;
  }
}

export async function generateReviewResponse(review: {
  rating: number;
  text: string;
  officeName: string;
}): Promise<string> {
  try {
    const result = await withRetry(() =>
      complete(
        `Reseña de la oficina de ${review.officeName}:\nRating: ${review.rating}/5\nTexto: "${review.text}"\n\nGenera la respuesta.`,
        REVIEW_RESPONSE_PROMPT
      )
    );
    console.info("[claude] generateReviewResponse completed");
    return result;
  } catch (error) {
    console.error("[claude] generateReviewResponse failed:", error);
    return "";
  }
}

export async function generateWeeklyReport(
  metricsData: string
): Promise<WeeklyReportData> {
  const empty: WeeklyReportData = {
    summary: "",
    wins: [],
    problems: [],
    actions: [],
    metrics: {},
  };
  try {
    const raw = await withRetry(() =>
      complete(
        `Datos de la semana:\n${metricsData}\n\nGenera el reporte semanal en JSON.`,
        WEEKLY_REPORT_PROMPT
      )
    );
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return empty;
    const report: WeeklyReportData = JSON.parse(jsonMatch[0]);
    console.info("[claude] generateWeeklyReport completed");
    return report;
  } catch (error) {
    console.error("[claude] generateWeeklyReport failed:", error);
    return empty;
  }
}
