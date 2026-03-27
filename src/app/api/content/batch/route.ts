// SOLIS AI — Content Batch API
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/utils";
import { db } from "@/lib/db";
import { processMediaBatch, approveBatch } from "@/lib/content/auto-content-pipeline";

export async function GET() {
  try {
    const batches = await db.contentBatch.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
    return apiSuccess({ batches });
  } catch (error) {
    console.error("[api/content/batch] GET failed:", error);
    return apiError("Error", 500);
  }
}

const createSchema = z.object({
  action: z.enum(["process", "approve"]),
  mediaUrls: z.array(z.string()).optional(),
  batchId: z.string().optional(),
  approvedItems: z.array(z.object({
    index: z.number(),
    platform: z.string().optional(),
    copy: z.string().optional(),
    hashtags: z.array(z.string()).optional(),
    scheduledAt: z.string().optional(),
  })).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    if (parsed.data.action === "process") {
      if (!parsed.data.mediaUrls?.length) return apiError("mediaUrls requeridos");
      const result = await processMediaBatch(parsed.data.mediaUrls);
      return apiSuccess(result);
    }

    if (parsed.data.action === "approve") {
      if (!parsed.data.batchId) return apiError("batchId requerido");
      const items = parsed.data.approvedItems?.map(i => ({
        ...i,
        platform: i.platform as "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "BLOG" | undefined,
        scheduledAt: i.scheduledAt ? new Date(i.scheduledAt) : undefined,
      }));
      const result = await approveBatch(parsed.data.batchId, items);
      return apiSuccess(result);
    }

    return apiError("Acci\u00f3n no v\u00e1lida");
  } catch (error) {
    console.error("[api/content/batch] POST failed:", error);
    const msg = error instanceof Error ? error.message : "Error";
    return apiError(msg, 500);
  }
}
