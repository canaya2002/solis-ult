// SOLIS AI — Audience Builder API
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/utils";
import {
  analyzeClientProfile,
  generateAudienceStrategy,
  createCustomAudience,
  createLookalikeAudience,
} from "@/lib/ads/audience-builder";

const schema = z.object({
  action: z.enum(["analyze", "plan", "create_custom", "create_lookalike"]),
  params: z.any().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    switch (parsed.data.action) {
      case "analyze":
        return apiSuccess(await analyzeClientProfile());

      case "plan":
        return apiSuccess(await generateAudienceStrategy());

      case "create_custom": {
        const p = parsed.data.params as { name: string; source: "email" | "phone"; description: string };
        if (!p?.name || !p?.source) return apiError("name y source requeridos");
        return apiSuccess(await createCustomAudience(p));
      }

      case "create_lookalike": {
        const p = parsed.data.params as { sourceAudienceId: string; country: string; ratio: number; name: string };
        if (!p?.sourceAudienceId || !p?.name) return apiError("sourceAudienceId y name requeridos");
        return apiSuccess(await createLookalikeAudience({ ...p, country: p.country || "US", ratio: p.ratio || 0.01 }));
      }

      default:
        return apiError("Acci\u00f3n no v\u00e1lida");
    }
  } catch (error) {
    console.error("[api/ads/audiences/build] POST failed:", error);
    const msg = error instanceof Error ? error.message : "Error";
    return apiError(msg, 500);
  }
}
