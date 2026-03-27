// SOLIS AI — Notifications API
// GET: list notifications with filters
// POST: mark notification as seen/acted/dismissed
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/utils";
import {
  getNotifications,
  getPendingCount,
  markAsSeen,
  markAsActed,
  dismiss,
} from "@/lib/notifications/notification-engine";
import type { NotificationStatus } from "@prisma/client";

const actionSchema = z.object({
  notificationId: z.string().min(1),
  action: z.enum(["seen", "acted", "dismissed"]),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as NotificationStatus | null;
    const type = searchParams.get("type") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const countOnly = searchParams.get("countOnly") === "true";

    if (countOnly) {
      const count = await getPendingCount();
      return apiSuccess({ count });
    }

    const notifications = await getNotifications({
      status: status || undefined,
      type,
      limit,
    });

    const pendingCount = await getPendingCount();

    return apiSuccess({ notifications, pendingCount });
  } catch (error) {
    console.error("[api/notifications] GET failed:", error);
    return apiError("Error al obtener notificaciones", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    const { notificationId, action } = parsed.data;

    switch (action) {
      case "seen":
        await markAsSeen(notificationId);
        break;
      case "acted":
        await markAsActed(notificationId);
        break;
      case "dismissed":
        await dismiss(notificationId);
        break;
    }

    return apiSuccess({ notificationId, action });
  } catch (error) {
    console.error("[api/notifications] POST failed:", error);
    return apiError("Error al actualizar notificación", 500);
  }
}
