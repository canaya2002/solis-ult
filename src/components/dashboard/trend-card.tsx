"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendCardProps {
  keyword: string;
  volume: number;
  change: "rising" | "stable" | "declining";
  relatedQueries?: string[];
}

export function TrendCard({
  keyword,
  volume,
  change,
  relatedQueries,
}: TrendCardProps) {
  const ChangeIcon =
    change === "rising"
      ? TrendingUp
      : change === "declining"
        ? TrendingDown
        : Minus;

  const changeColor =
    change === "rising"
      ? "text-red-400"
      : change === "declining"
        ? "text-blue-400"
        : "text-muted-foreground";

  return (
    <Card className="hover:border-gold/30 transition-colors">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-sm">{keyword}</h3>
          <ChangeIcon className={cn("h-4 w-4 shrink-0", changeColor)} />
        </div>

        {/* Volume bar */}
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                change === "rising"
                  ? "bg-red-400"
                  : change === "declining"
                    ? "bg-blue-400"
                    : "bg-muted-foreground"
              )}
              style={{ width: `${Math.min(volume, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Interés relativo: {volume}/100
          </p>
        </div>

        {relatedQueries && relatedQueries.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {relatedQueries.slice(0, 4).map((q) => (
              <span
                key={q}
                className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {q}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
