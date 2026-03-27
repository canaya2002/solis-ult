"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-red-400",
  medium: "text-yellow-400",
  low: "text-muted-foreground",
};

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-400",
  medium: "bg-yellow-400",
  low: "bg-emerald-400",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export function NotificationBell() {
  const { notifications, pendingCount, markSeen, dismiss } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const pending = notifications.filter(n => n.status === "PENDING" || n.status === "SEEN");
  const recent = pending.slice(0, 10);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8"
        onClick={() => setOpen(!open)}
      >
        <Bell className="h-4 w-4" />
        {pendingCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold">Notificaciones</p>
            {pendingCount > 0 && (
              <span className="text-xs text-muted-foreground">{pendingCount} pendientes</span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {recent.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">Sin notificaciones pendientes</p>
              </div>
            ) : (
              recent.map(n => (
                <div
                  key={n.id}
                  className={cn(
                    "border-b border-border px-4 py-3 transition-colors hover:bg-muted/50",
                    n.status === "PENDING" && "bg-muted/20"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", PRIORITY_DOT[n.priority] || PRIORITY_DOT.low)} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-medium leading-snug", PRIORITY_COLORS[n.priority] || "")}>
                        {n.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Link
                          href={n.actionUrl}
                          onClick={() => { markSeen(n.id); setOpen(false); }}
                          className="text-[11px] font-medium text-gold hover:underline"
                        >
                          {n.actionLabel}
                        </Link>
                        <span className="text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => dismiss(n.id)}
                      className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {pending.length > 10 && (
            <div className="border-t border-border px-4 py-2 text-center">
              <Link
                href="/settings"
                className="text-xs text-gold hover:underline"
                onClick={() => setOpen(false)}
              >
                Ver todas ({pending.length})
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
