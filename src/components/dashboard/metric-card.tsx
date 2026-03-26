"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: { value: number; label: string } | number;
  changeLabel?: string;
  icon: LucideIcon;
  loading?: boolean;
  href?: string;
  sparklineData?: number[];
  status?: "success" | "warning" | "danger";
  subtitle?: string;
  disconnected?: boolean;
}

function Sparkline({ data }: { data: number[] }) {
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 60;
  const h = 20;
  const points = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`
    )
    .join(" ");

  return (
    <svg width={w} height={h} className="text-gold/60">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  loading,
  href,
  sparklineData,
  status,
  subtitle,
  disconnected,
}: MetricCardProps) {
  if (loading) {
    return (
      <Card className="border-t-2 border-t-gold/30">
        <CardContent className="p-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const changeValue =
    typeof change === "number" ? change : change?.value;
  const changeLabelText =
    typeof change === "number"
      ? changeLabel
      : change?.label || changeLabel;

  const statusColor =
    status === "success"
      ? "text-emerald-400"
      : status === "warning"
        ? "text-amber-400"
        : status === "danger"
          ? "text-red-400"
          : "";

  const Wrapper = href ? "a" : "div";
  const wrapperProps = href
    ? { href, className: "block transition-transform hover:scale-[1.02]" }
    : {};

  return (
    <Wrapper {...wrapperProps}>
      <Card className="border-t-2 border-t-gold/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{title}</p>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 flex items-end justify-between">
            <div>
              {disconnected ? (
                <div>
                  <p className="text-2xl font-bold text-muted-foreground">—</p>
                  <a
                    href="/settings"
                    className="text-xs text-gold hover:underline"
                  >
                    Conectar en Settings
                  </a>
                </div>
              ) : (
                <p className={cn("text-2xl font-bold", statusColor)}>
                  {value}
                </p>
              )}
              {subtitle && !disconnected && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
            {sparklineData && sparklineData.length > 1 && !disconnected && (
              <Sparkline data={sparklineData} />
            )}
          </div>
          {changeValue !== undefined && !disconnected && (
            <p
              className={cn(
                "mt-1 text-xs",
                changeValue >= 0 ? "text-emerald-400" : "text-red-400"
              )}
            >
              {changeValue >= 0 ? "+" : ""}
              {changeValue}%{changeLabelText && ` ${changeLabelText}`}
            </p>
          )}
        </CardContent>
      </Card>
    </Wrapper>
  );
}
