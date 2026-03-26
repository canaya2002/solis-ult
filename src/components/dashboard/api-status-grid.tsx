"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Activity,
  Search,
  Hash,
  Video,
  Youtube,
  Phone,
  Bot,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ApiStatusGridProps {
  connected: string[];
  disconnected: string[];
}

const API_ICONS: Record<string, LucideIcon> = {
  "Meta Ads": BarChart3,
  GA4: Activity,
  "Search Console": Search,
  Semrush: Hash,
  TikTok: Video,
  YouTube: Youtube,
  Twilio: Phone,
  "Claude AI": Bot,
};

export function ApiStatusGrid({
  connected,
  disconnected,
}: ApiStatusGridProps) {
  const all = [
    ...connected.map((name) => ({ name, connected: true })),
    ...disconnected.map((name) => ({ name, connected: false })),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">APIs Conectadas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {all.map((api) => {
            const Icon = API_ICONS[api.name] || Activity;
            return (
              <a
                key={api.name}
                href="/settings"
                className="flex items-center gap-2 rounded-lg border border-border p-3 transition-colors hover:bg-surface-elevated/50"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{api.name}</p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    api.connected
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0"
                      : "text-muted-foreground text-[10px] px-1.5 py-0"
                  }
                >
                  {api.connected ? "✓" : "—"}
                </Badge>
              </a>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
