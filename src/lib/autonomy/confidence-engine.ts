// SOLIS AI — Confidence-Based Auto-Approval Engine
// Compares new content with previously approved content for similarity.
// NEVER auto-approves: ad campaigns, boosts >$50, negative review responses, sensitive legal topics.
import { db } from "@/lib/db";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ApprovalType = "copy" | "comment_response" | "review_response" | "boost" | "content_schedule";

interface AutoApproveResult {
  autoApprove: boolean;
  confidence: number;
  reason: string;
}

// ─── Similarity Check (simple token overlap) ───────────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(t => t.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

// ─── Sensitive Content Check ───────────────────────────────────────────────────

const SENSITIVE_KEYWORDS = [
  "deportaci\u00f3n", "deportation", "detenci\u00f3n", "detention", "ice",
  "urgente", "emergencia", "corte", "juicio", "remoci\u00f3n",
  "negativa", "queja", "complaint", "demanda", "lawsuit",
];

function hasSensitiveContent(text: string): boolean {
  const lower = text.toLowerCase();
  return SENSITIVE_KEYWORDS.some(k => lower.includes(k));
}

// ─── Core Function ─────────────────────────────────────────────────────────────

export async function shouldAutoApprove(params: {
  type: ApprovalType;
  content: string;
  context?: Record<string, unknown>;
}): Promise<AutoApproveResult> {
  const { type, content, context } = params;

  // ─── Hard Rules: NEVER auto-approve ────────────────────────────────────
  if (type === "boost" && context?.budget && Number(context.budget) > 50) {
    return { autoApprove: false, confidence: 0, reason: "Boosts >$50 requieren aprobaci\u00f3n manual" };
  }

  if (type === "review_response" && context?.rating && Number(context.rating) <= 3) {
    return { autoApprove: false, confidence: 0, reason: "Respuestas a rese\u00f1as negativas requieren aprobaci\u00f3n manual" };
  }

  if (hasSensitiveContent(content)) {
    return { autoApprove: false, confidence: 0.2, reason: "Contenido sensible detectado — requiere revisi\u00f3n" };
  }

  // ─── Check approval history for similarity ─────────────────────────────
  const recentApproved = await db.approvalHistory.findMany({
    where: { type, approved: true },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { content: true },
  });

  if (recentApproved.length === 0) {
    return { autoApprove: false, confidence: 0.1, reason: "Sin historial de aprobaciones para este tipo — requiere primera aprobaci\u00f3n manual" };
  }

  // Find best similarity match
  const contentTokens = tokenize(content);
  let bestSimilarity = 0;

  for (const approved of recentApproved) {
    const sim = jaccardSimilarity(contentTokens, tokenize(approved.content));
    if (sim > bestSimilarity) bestSimilarity = sim;
  }

  const confidence = bestSimilarity;

  // Auto-approve threshold (default 0.92 = 92% similar)
  const threshold = 0.92;

  if (confidence >= threshold) {
    return {
      autoApprove: true,
      confidence,
      reason: `${(confidence * 100).toFixed(0)}% similar a contenido previamente aprobado`,
    };
  }

  return {
    autoApprove: false,
    confidence,
    reason: `Similaridad ${(confidence * 100).toFixed(0)}% — por debajo del umbral de ${(threshold * 100).toFixed(0)}%`,
  };
}

// ─── Record Approval ───────────────────────────────────────────────────────────

export async function recordApproval(params: {
  type: ApprovalType;
  content: string;
  approved: boolean;
  approvedBy?: string;
}) {
  await db.approvalHistory.create({
    data: {
      type: params.type,
      content: params.content,
      approved: params.approved,
      approvedBy: params.approvedBy,
    },
  });
}
