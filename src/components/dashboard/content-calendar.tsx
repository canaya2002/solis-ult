"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  date: string;
  platform: string;
  title: string;
  status: string;
}

interface ContentCalendarProps {
  events: CalendarEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (eventId: string) => void;
  selectedDate?: Date;
}

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const PLATFORM_DOT: Record<string, string> = {
  FACEBOOK: "bg-[#1877f2]",
  INSTAGRAM: "bg-[#e4405f]",
  TIKTOK: "bg-[#00f2ea]",
  YOUTUBE: "bg-[#ff0000]",
  BLOG: "bg-[#4ade80]",
};

const STATUS_RING: Record<string, string> = {
  PUBLISHED: "ring-emerald-400",
  SCHEDULED: "ring-amber-400",
  FAILED: "ring-red-400",
};

export function ContentCalendar({
  events,
  onDayClick,
  onEventClick,
  selectedDate,
}: ContentCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const days: Array<{ date: Date; inMonth: boolean }> = [];

    // Previous month fill
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, inMonth: false });
    }

    // Current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), inMonth: true });
    }

    // Next month fill
    while (days.length < 42) {
      const d = new Date(year, month + 1, days.length - lastDay.getDate() - startDay + 1);
      days.push({ date: d, inMonth: false });
    }

    return days;
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = event.date.split("T")[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return map;
  }, [events]);

  const today = new Date().toISOString().split("T")[0];
  const selectedKey = selectedDate?.toISOString().split("T")[0];

  const prevMonth = () =>
    setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () =>
    setCurrentMonth(new Date(year, month + 1, 1));

  const monthName = currentMonth.toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base capitalize">{monthName}</CardTitle>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-medium text-muted-foreground py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map(({ date, inMonth }, i) => {
            const key = date.toISOString().split("T")[0];
            const dayEvents = eventsByDate.get(key) || [];
            const isToday = key === today;
            const isSelected = key === selectedKey;

            return (
              <button
                key={i}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-lg p-1.5 text-xs transition-colors min-h-[52px]",
                  inMonth ? "text-foreground" : "text-muted-foreground/40",
                  isToday && "bg-gold/10",
                  isSelected && "ring-1 ring-gold",
                  "hover:bg-surface-elevated/50"
                )}
                onClick={() => onDayClick(date)}
              >
                <span
                  className={cn(
                    "font-medium",
                    isToday && "text-gold"
                  )}
                >
                  {date.getDate()}
                </span>
                {dayEvents.length > 0 && (
                  <div className="flex gap-0.5 flex-wrap justify-center">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <button
                        key={ev.id}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full ring-1",
                          PLATFORM_DOT[ev.platform] || "bg-gray-400",
                          STATUS_RING[ev.status] || "ring-transparent"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(ev.id);
                        }}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[8px] text-muted-foreground">
                        +{dayEvents.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground border-t border-border pt-2">
          {Object.entries(PLATFORM_DOT).map(([platform, color]) => (
            <div key={platform} className="flex items-center gap-1">
              <div className={cn("h-2 w-2 rounded-full", color)} />
              <span>{platform.charAt(0) + platform.slice(1).toLowerCase()}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
