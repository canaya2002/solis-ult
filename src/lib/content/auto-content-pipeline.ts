// SOLIS AI — Auto Content Pipeline
// Batch media processing: upload N files → AI analyzes → generates copies → schedules
import { db } from "@/lib/db";
import { generateCopy } from "@/lib/ai/openai";
import { sendNotification } from "@/lib/notifications/notification-engine";
import type { Platform } from "@prisma/client";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ContentBatchItem {
  mediaUrl: string;
  suggestedPlatform: Platform;
  suggestedCopy: string;
  suggestedHashtags: string[];
  suggestedSchedule: Date;
  rationale: string;
}

export interface ContentBatchResult {
  id: string;
  items: ContentBatchItem[];
  status: "pending_approval" | "partially_approved" | "approved" | "scheduled";
}

// ─── Default Posting Schedule ──────────────────────────────────────────────────

const DEFAULT_TIMES: Record<string, number[]> = {
  FACEBOOK: [10, 14, 18],   // 10am, 2pm, 6pm CT
  INSTAGRAM: [9, 12, 17],
  TIKTOK: [11, 15, 19],
  YOUTUBE: [14],
};

function getNextScheduleSlot(platform: Platform, index: number): Date {
  const times = DEFAULT_TIMES[platform] || [12];
  const now = new Date();
  const dayOffset = Math.floor(index / times.length) + 1; // start tomorrow
  const timeIdx = index % times.length;
  const hour = times[timeIdx];

  const date = new Date(now);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);
  return date;
}

// ─── Platform Detection ────────────────────────────────────────────────────────

function detectPlatform(mediaUrl: string, index: number): { platform: Platform; rationale: string } {
  const url = mediaUrl.toLowerCase();
  const isVideo = url.includes(".mp4") || url.includes(".mov") || url.includes(".webm") || url.includes("video");
  const isVertical = url.includes("vertical") || url.includes("reel") || url.includes("story");

  if (isVideo && isVertical) {
    return { platform: "TIKTOK", rationale: "Video vertical detectado \u2192 ideal para TikTok/Reels" };
  }
  if (isVideo) {
    return { platform: "FACEBOOK", rationale: "Video horizontal \u2192 mejor rendimiento en Facebook" };
  }

  // Distribute images across platforms
  const platforms: Array<{ platform: Platform; rationale: string }> = [
    { platform: "INSTAGRAM", rationale: "Imagen \u2192 distribuida a Instagram para m\u00e1ximo alcance visual" },
    { platform: "FACEBOOK", rationale: "Imagen \u2192 distribuida a Facebook para engagement" },
    { platform: "TIKTOK", rationale: "Imagen \u2192 puede usarse como slideshow en TikTok" },
  ];

  return platforms[index % platforms.length];
}

// ─── Process Media Batch ───────────────────────────────────────────────────────

export async function processMediaBatch(mediaUrls: string[]): Promise<ContentBatchResult> {
  const items: ContentBatchItem[] = [];

  for (let i = 0; i < mediaUrls.length; i++) {
    const mediaUrl = mediaUrls[i];
    const { platform, rationale } = detectPlatform(mediaUrl, i);

    // Generate copy for this platform
    let suggestedCopy = "";
    let suggestedHashtags: string[] = [];

    try {
      const platformLower = platform.toLowerCase() as "facebook" | "instagram" | "tiktok" | "youtube";
      const copies = await generateCopy({
        topic: "Contenido de inmigraci\u00f3n para la comunidad hispana",
        platform: platformLower,
        tone: "professional",
        language: "es",
      });

      if (copies.length > 0) {
        suggestedCopy = copies[0].caption;
        suggestedHashtags = copies[0].hashtags || [];
      }
    } catch {
      suggestedCopy = "Conoce tus derechos. Consulta gratuita: manuelsolis.com";
      suggestedHashtags = ["#inmigraci\u00f3n", "#abogado", "#ManuelSolis"];
    }

    const suggestedSchedule = getNextScheduleSlot(platform, i);

    items.push({
      mediaUrl,
      suggestedPlatform: platform,
      suggestedCopy,
      suggestedHashtags,
      suggestedSchedule,
      rationale,
    });
  }

  // Save batch to DB
  const batch = await db.contentBatch.create({
    data: {
      items: JSON.parse(JSON.stringify(items)),
    },
  });

  // Notification
  await sendNotification({
    type: "content_ready",
    title: `${items.length} posts listos para publicar`,
    message: `Batch de contenido procesado. ${items.length} posts generados con copies y horarios sugeridos. Revisa y aprueba.`,
    actionUrl: `/content/batch?batchId=${batch.id}`,
    actionLabel: "Revisar y aprobar batch",
    priority: "medium",
    data: { batchId: batch.id, itemCount: items.length },
    remindAfterMinutes: [240, 1440],
  });

  return { id: batch.id, items, status: "pending_approval" };
}

// ─── Approve Batch ─────────────────────────────────────────────────────────────

export async function approveBatch(batchId: string, approvedItems?: Array<{
  index: number;
  platform?: Platform;
  copy?: string;
  hashtags?: string[];
  scheduledAt?: Date;
}>): Promise<{ created: number }> {
  const batch = await db.contentBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error("Batch no encontrado");

  const items = batch.items as unknown as ContentBatchItem[];
  const defaultApprovals = items.map((_, i) => ({ index: i, platform: undefined as Platform | undefined, copy: undefined as string | undefined, hashtags: undefined as string[] | undefined, scheduledAt: undefined as Date | undefined }));
  const toApprove = approvedItems || defaultApprovals;
  let created = 0;

  for (const approval of toApprove) {
    const item = items[approval.index];
    if (!item) continue;

    const platform = approval.platform || item.suggestedPlatform;
    const copy = approval.copy || item.suggestedCopy;
    const hashtags = approval.hashtags || item.suggestedHashtags;
    const scheduledAt = approval.scheduledAt || item.suggestedSchedule;

    await db.content.create({
      data: {
        title: copy.substring(0, 60) + (copy.length > 60 ? "..." : ""),
        body: copy,
        platform,
        contentType: "TIP_LEGAL",
        status: "SCHEDULED",
        scheduledAt: new Date(scheduledAt),
        mediaUrl: item.mediaUrl,
        hashtags,
        aiGenerated: true,
      },
    });

    created++;
  }

  const newStatus = toApprove.length === items.length ? "APPROVED" : "PARTIALLY_APPROVED";
  await db.contentBatch.update({
    where: { id: batchId },
    data: { status: newStatus, approvedAt: new Date() },
  });

  console.info(`[auto-content] Batch ${batchId}: ${created} posts created and scheduled`);
  return { created };
}
