// SOLIS AI — Central Notification Engine
// All modules use this to notify the team of pending actions.
// Notifications are persistent (DB), emailed, and shown in dashboard.
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/comms/resend";
import type { NotificationStatus } from "@prisma/client";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type NotificationType =
  | "campaign_ready"
  | "boost_ready"
  | "review_response_ready"
  | "comment_response_ready"
  | "budget_alert"
  | "strategy_recommendation"
  | "content_ready"
  | "campaign_activated"
  | "reminder";

export type NotificationPriority = "high" | "medium" | "low";

export interface SendNotificationParams {
  type: NotificationType;
  title: string;
  message: string;
  actionUrl: string;
  actionLabel: string;
  priority?: NotificationPriority;
  data?: unknown;
  expiresAt?: Date;
  remindAfterMinutes?: number[];
  userId?: string;
}

// ─── Email Templates ───────────────────────────────────────────────────────────

function getEmailSubject(priority: NotificationPriority, title: string): string {
  switch (priority) {
    case "high": return `SOLIS AI — ${title}`;
    case "medium": return `SOLIS AI — ${title}`;
    default: return `SOLIS AI — ${title}`;
  }
}

function getNotificationEmailHtml(params: {
  title: string;
  message: string;
  actionUrl: string;
  actionLabel: string;
  priority: NotificationPriority;
}): string {
  const priorityColor = params.priority === "high" ? "#ef4444" : params.priority === "medium" ? "#eab308" : "#22c55e";
  const priorityLabel = params.priority === "high" ? "URGENTE" : params.priority === "medium" ? "IMPORTANTE" : "INFO";
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const fullActionUrl = params.actionUrl.startsWith("http") ? params.actionUrl : `${appUrl}${params.actionUrl}`;

  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #12141d; padding: 24px; border-radius: 8px; border-top: 3px solid ${priorityColor};">
        <div style="display: flex; align-items: center; margin-bottom: 16px;">
          <span style="color: #cda64e; font-size: 20px; font-weight: bold;">SOLIS AI</span>
          <span style="background: ${priorityColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 12px; font-weight: 600;">${priorityLabel}</span>
        </div>
        <h2 style="color: #f0f0f0; margin: 0 0 12px 0; font-size: 18px;">${params.title}</h2>
        <div style="color: #d0d0d0; line-height: 1.6; font-size: 14px; margin-bottom: 24px;">
          ${params.message.replace(/\n/g, "<br/>")}
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${fullActionUrl}" style="
            display: inline-block;
            background: #cda64e;
            color: #12141d;
            padding: 12px 32px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            font-size: 15px;
          ">${params.actionLabel}</a>
        </div>
        <hr style="border: 1px solid #2a2d3a; margin: 20px 0;" />
        <p style="color: #666; font-size: 11px; text-align: center;">
          Este es un mensaje autom&aacute;tico de SOLIS AI Dashboard. No respondas a este correo.
        </p>
      </div>
    </div>
  `;
}

// ─── Core Functions ────────────────────────────────────────────────────────────

export async function sendNotification(params: SendNotificationParams): Promise<string> {
  const priority = params.priority || "medium";

  // Calculate first reminder time
  const firstRemindMinutes = params.remindAfterMinutes?.[0];
  const nextRemindAt = firstRemindMinutes
    ? new Date(Date.now() + firstRemindMinutes * 60 * 1000)
    : null;

  // Create in database
  const notification = await db.notification.create({
    data: {
      type: params.type,
      title: params.title,
      message: params.message,
      actionUrl: params.actionUrl,
      actionLabel: params.actionLabel,
      priority,
      data: params.data ? JSON.parse(JSON.stringify(params.data)) : undefined,
      expiresAt: params.expiresAt || null,
      nextRemindAt,
      userId: params.userId || null,
    },
  });

  // Send email notification
  try {
    const teamEmails = ["marketing@manuelsolis.com"];
    await sendEmail({
      to: teamEmails,
      subject: getEmailSubject(priority, params.title),
      html: getNotificationEmailHtml({
        title: params.title,
        message: params.message,
        actionUrl: params.actionUrl,
        actionLabel: params.actionLabel,
        priority,
      }),
    });
    console.info(`[notifications] Sent email for: ${params.title}`);
  } catch (error) {
    console.error("[notifications] Failed to send email:", error);
  }

  console.info(`[notifications] Created notification ${notification.id}: ${params.title}`);
  return notification.id;
}

export async function getNotifications(filters?: {
  userId?: string;
  status?: NotificationStatus;
  type?: string;
  limit?: number;
}) {
  const where: Record<string, unknown> = {};
  if (filters?.userId) where.userId = filters.userId;
  if (filters?.status) where.status = filters.status;
  if (filters?.type) where.type = filters.type;

  return db.notification.findMany({
    where,
    orderBy: [
      { priority: "asc" }, // high first (alphabetically: high < low < medium)
      { createdAt: "desc" },
    ],
    take: filters?.limit || 50,
  });
}

export async function getPendingCount(userId?: string): Promise<number> {
  const where: Record<string, unknown> = { status: "PENDING" };
  if (userId) where.userId = userId;
  return db.notification.count({ where });
}

export async function markAsSeen(notificationId: string): Promise<void> {
  await db.notification.update({
    where: { id: notificationId },
    data: { status: "SEEN" },
  });
}

export async function markAsActed(notificationId: string): Promise<void> {
  await db.notification.update({
    where: { id: notificationId },
    data: { status: "ACTED", actedAt: new Date() },
  });
}

export async function dismiss(notificationId: string): Promise<void> {
  await db.notification.update({
    where: { id: notificationId },
    data: { status: "DISMISSED" },
  });
}

// ─── Reminder Processing (called by cron) ──────────────────────────────────────

export async function processReminders(): Promise<{ reminded: number; expired: number }> {
  const now = new Date();
  let reminded = 0;
  let expired = 0;

  // 1. Expire old notifications
  const expiredResult = await db.notification.updateMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: now },
    },
    data: { status: "EXPIRED" },
  });
  expired = expiredResult.count;

  // 2. Process pending reminders
  const dueReminders = await db.notification.findMany({
    where: {
      status: { in: ["PENDING", "SEEN"] },
      nextRemindAt: { lte: now },
    },
  });

  for (const notification of dueReminders) {
    const reminderNumber = notification.reminders + 1;
    let reminderMessage = notification.message;

    if (reminderNumber === 1) {
      reminderMessage = `Recordatorio: ${notification.message}`;
    } else if (reminderNumber >= 2) {
      reminderMessage = `Segundo recordatorio — Oportunidad perdiendo relevancia.\n\n${notification.message}`;
    }

    // Send reminder email
    try {
      await sendEmail({
        to: ["marketing@manuelsolis.com"],
        subject: `Recordatorio: ${notification.title}`,
        html: getNotificationEmailHtml({
          title: `Recordatorio: ${notification.title}`,
          message: reminderMessage,
          actionUrl: notification.actionUrl,
          actionLabel: notification.actionLabel,
          priority: notification.priority as NotificationPriority,
        }),
      });
    } catch (error) {
      console.error(`[notifications] Reminder email failed for ${notification.id}:`, error);
    }

    // Schedule next reminder or stop
    // Standard schedule: [240, 1440] = 4hrs, 24hrs
    const schedules = [240, 1440]; // minutes
    const nextScheduleIdx = reminderNumber; // 0-indexed: after 1st reminder, look at index 1
    const nextMinutes = schedules[nextScheduleIdx];
    const nextRemindAt = nextMinutes
      ? new Date(now.getTime() + nextMinutes * 60 * 1000)
      : null;

    await db.notification.update({
      where: { id: notification.id },
      data: {
        reminders: reminderNumber,
        nextRemindAt,
      },
    });

    reminded++;
  }

  console.info(`[notifications] Processed reminders: ${reminded} reminded, ${expired} expired`);
  return { reminded, expired };
}

// ─── Bulk Summary ──────────────────────────────────────────────────────────────

export async function getPendingSummary(): Promise<string> {
  const pending = await db.notification.findMany({
    where: { status: { in: ["PENDING", "SEEN"] } },
    orderBy: { createdAt: "desc" },
  });

  if (!pending.length) return "";

  const highPriority = pending.filter(n => n.priority === "high");
  const mostUrgent = highPriority[0] || pending[0];

  return `Tienes ${pending.length} acciones pendientes en SOLIS AI. La m\u00e1s urgente: ${mostUrgent.title}.`;
}
