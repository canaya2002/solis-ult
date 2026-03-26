"use client";

import { useState } from "react";
import { useScheduler } from "@/hooks/use-scheduler";
import { ContentCalendar } from "@/components/dashboard/content-calendar";
import { ScheduleModal } from "@/components/dashboard/schedule-modal";
import { PlatformBadge } from "@/components/dashboard/platform-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays,
  List,
  Plus,
  Send,
  Trash2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BEST_TIMES = [
  { platform: "Facebook", times: ["9:00 AM", "1:00 PM", "3:00 PM"], tz: "CT" },
  { platform: "Instagram", times: ["11:00 AM", "2:00 PM", "7:00 PM"], tz: "CT" },
  { platform: "TikTok", times: ["7:00 AM", "12:00 PM", "7:00 PM"], tz: "CT" },
  { platform: "YouTube", times: ["2:00 PM", "5:00 PM"], tz: "CT" },
];

export default function SchedulerPage() {
  const {
    scheduled,
    published,
    failed,
    loading,
    cancelSchedule,
    publishNow,
  } = useScheduler();
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [modalOpen, setModalOpen] = useState(false);

  const calendarEvents = [
    ...scheduled.map((c) => ({
      id: c.id,
      date: c.scheduledAt || "",
      platform: c.platform,
      title: c.title,
      status: c.status,
    })),
    ...published.map((c) => ({
      id: c.id,
      date: c.publishedAt || "",
      platform: c.platform,
      title: c.title,
      status: c.status,
    })),
    ...failed.map((c) => ({
      id: c.id,
      date: c.scheduledAt || "",
      platform: c.platform,
      title: c.title,
      status: c.status,
    })),
  ];

  const allContent = [...scheduled, ...published, ...failed].sort(
    (a, b) =>
      new Date(b.scheduledAt || b.publishedAt || 0).getTime() -
      new Date(a.scheduledAt || a.publishedAt || 0).getTime()
  );

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Content Calendar
          </h1>
          <p className="text-muted-foreground">
            Programa y publica contenido automáticamente en todas las
            plataformas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border">
            <Button
              variant="ghost"
              size="sm"
              className={
                view === "calendar" ? "bg-gold/10 text-gold" : "text-muted-foreground"
              }
              onClick={() => setView("calendar")}
            >
              <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
              Calendario
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={
                view === "list" ? "bg-gold/10 text-gold" : "text-muted-foreground"
              }
              onClick={() => setView("list")}
            >
              <List className="mr-1.5 h-3.5 w-3.5" />
              Lista
            </Button>
          </div>
          <Button
            size="sm"
            className="bg-gold text-background hover:bg-gold-light"
            onClick={() => setModalOpen(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Programar
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Main content area */}
        <div className="lg:col-span-3">
          {loading ? (
            <Skeleton className="h-[400px]" />
          ) : view === "calendar" ? (
            <ContentCalendar
              events={calendarEvents}
              onDayClick={setSelectedDate}
              onEventClick={() => {}}
              selectedDate={selectedDate}
            />
          ) : (
            /* List view */
            <Card>
              <CardContent className="p-0">
                {allContent.length === 0 ? (
                  <div className="flex items-center justify-center py-16">
                    <p className="text-muted-foreground">
                      No hay contenido programado. Crea uno desde el Copy
                      Generator.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {allContent.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-4 p-4 hover:bg-surface-elevated/30 transition-colors"
                      >
                        <div className="text-center shrink-0 w-16">
                          <p className="text-xs text-muted-foreground">
                            {new Date(
                              c.scheduledAt || c.publishedAt || ""
                            ).toLocaleDateString("es-MX", {
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(
                              c.scheduledAt || c.publishedAt || ""
                            ).toLocaleTimeString("es-MX", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <PlatformBadge
                          platform={c.platform as "facebook"}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm">{c.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {c.body.slice(0, 80)}...
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-[10px]",
                            c.status === "PUBLISHED"
                              ? "border-emerald-500/30 text-emerald-400"
                              : c.status === "FAILED"
                                ? "border-red-500/30 text-red-400"
                                : "border-amber-500/30 text-amber-400"
                          )}
                        >
                          {c.status === "PUBLISHED"
                            ? "Publicado"
                            : c.status === "FAILED"
                              ? "Falló"
                              : "Programado"}
                        </Badge>
                        {c.status === "SCHEDULED" && (
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => publishNow(c.id)}
                              title="Publicar ahora"
                            >
                              <Send className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-400"
                              onClick={() => cancelSchedule(c.id)}
                              title="Cancelar"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stats bar */}
          <div className="flex gap-4 text-sm text-muted-foreground mt-3">
            <span>
              Programados:{" "}
              <span className="text-amber-400 font-medium">
                {scheduled.length}
              </span>
            </span>
            <span>
              Publicados (7d):{" "}
              <span className="text-emerald-400 font-medium">
                {published.length}
              </span>
            </span>
            {failed.length > 0 && (
              <span>
                Fallidos:{" "}
                <span className="text-red-400 font-medium">
                  {failed.length}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Best times sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-gold" />
                Mejores Horarios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {BEST_TIMES.map((bt) => (
                <div key={bt.platform}>
                  <p className="text-xs font-medium mb-1">{bt.platform}</p>
                  <div className="flex flex-wrap gap-1">
                    {bt.times.map((t) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className="text-[10px]"
                      >
                        {t} {bt.tz}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground italic">
                Estos horarios se optimizarán automáticamente con datos reales
                en Fase 4.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Schedule modal */}
      <ScheduleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSchedule={() => setModalOpen(false)}
        onPublishNow={() => setModalOpen(false)}
      />
    </div>
  );
}
