"use client";
import Link from "next/link";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";

export function NotificationToast() {
  const { notifications, dismiss } = useNotifications();

  // Only show high-priority pending notifications
  const highPriority = notifications.filter(
    n => n.priority === "high" && (n.status === "PENDING" || n.status === "SEEN")
  );

  if (highPriority.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-96 max-w-[calc(100vw-2rem)]">
      {highPriority.slice(0, 3).map(n => (
        <div
          key={n.id}
          className="rounded-lg border border-red-500/30 bg-surface p-4 shadow-lg animate-fade-in"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-400">{n.title}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
              <div className="flex items-center gap-2 mt-3">
                <Link href={n.actionUrl}>
                  <Button size="sm" className="h-7 text-xs bg-gold text-background hover:bg-gold/90">
                    {n.actionLabel}
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => dismiss(n.id)}
                >
                  Descartar
                </Button>
              </div>
            </div>
            <button
              onClick={() => dismiss(n.id)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
