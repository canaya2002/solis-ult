// SOLIS AI — Comment processing engine
import { classifyComment } from "@/lib/ai/openai";
import { replyToComment } from "@/lib/social/meta";
import { sendTeamAlert } from "@/lib/comms/resend";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import type { CommentClassification } from "@/types/ai";

type Platform = "FACEBOOK" | "INSTAGRAM";

export interface ProcessedComment {
  id: string;
  category: string;
  responseDraft: string;
  autoApproved: boolean;
  published: boolean;
  alert: boolean;
}

async function getAutoApproveSettings(): Promise<Record<string, boolean>> {
  const cached = await redis.get<Record<string, boolean>>("settings:auto-approve");
  return cached || {
    POSITIVE: true,
    LEGAL_QUESTION: false,
    COMPLAINT: false,
    SPAM: true,
    PRICE_INQUIRY: false,
    OTHER: false,
  };
}

export async function processComment(params: {
  platform: Platform;
  commentId: string;
  postId: string;
  text: string;
  authorName: string;
  authorId: string;
  createdAt: Date;
}): Promise<ProcessedComment> {
  // Dedup
  const dedupeKey = `comment:${params.commentId}`;
  const exists = await redis.get(dedupeKey);
  if (exists) {
    return {
      id: "",
      category: "OTHER",
      responseDraft: "",
      autoApproved: false,
      published: false,
      alert: false,
    };
  }
  await redis.set(dedupeKey, "1", { ex: 86400 });

  // Classify
  let classification: CommentClassification;
  try {
    classification = await classifyComment(params.text);
  } catch {
    classification = { category: "OTHER", confidence: 0, suggestedResponse: "" };
  }

  const isSpam = classification.category === "SPAM";
  const isComplaint = classification.category === "COMPLAINT";

  // Save to DB
  const comment = await db.comment.create({
    data: {
      platform: params.platform,
      externalId: params.commentId,
      postExternalId: params.postId,
      text: params.text,
      author: params.authorName,
      category: classification.category as "LEGAL_QUESTION" | "POSITIVE" | "COMPLAINT" | "SPAM" | "PRICE_INQUIRY" | "OTHER",
      responseDraft: isSpam ? "" : classification.suggestedResponse,
      responseStatus: isSpam ? "IGNORED" : "PENDING",
    },
  });

  // Alert on complaints
  let alert = false;
  if (isComplaint) {
    alert = true;
    sendTeamAlert({
      subject: `Queja en ${params.platform}: ${params.authorName}`,
      body: `<p><strong>Queja detectada</strong> en un comentario de ${params.platform}.</p>
        <blockquote style="border-left:3px solid #ef4444;padding-left:12px;color:#aaa;">${params.text}</blockquote>
        <p>Autor: ${params.authorName}</p>
        <p><a href="${process.env.APP_URL || "http://localhost:3000"}/engagement" style="color:#cda64e;">Revisar en dashboard →</a></p>`,
      priority: "high",
    }).catch((e) => console.error("[comment-processor] Alert failed:", e));
  }

  // Auto-approve check
  const settings = await getAutoApproveSettings();
  const shouldAutoApprove = settings[classification.category] && !isComplaint && !isSpam;
  let published = false;

  if (shouldAutoApprove && classification.suggestedResponse) {
    try {
      const result = await replyToComment(params.commentId, classification.suggestedResponse);
      if ("id" in result) {
        await db.comment.update({
          where: { id: comment.id },
          data: { responseStatus: "PUBLISHED", respondedAt: new Date() },
        });
        published = true;
      }
    } catch (e) {
      console.error("[comment-processor] Auto-reply failed:", e);
    }
  }

  if (isSpam) {
    await db.comment.update({
      where: { id: comment.id },
      data: { responseStatus: "IGNORED" },
    });
  }

  console.info(
    `[comment-processor] ${params.platform} comment: ${classification.category} (${classification.confidence}) auto=${published}`
  );

  return {
    id: comment.id,
    category: classification.category,
    responseDraft: classification.suggestedResponse,
    autoApproved: shouldAutoApprove,
    published,
    alert,
  };
}
