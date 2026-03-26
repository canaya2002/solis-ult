"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface Lead {
  id: string;
  name: string;
  source: string;
  status: string;
  caseType: string | null;
  city: string | null;
  createdAt: string;
}

interface RecentLeadsProps {
  leads: Lead[];
  loading: boolean;
}

const SOURCE_COLORS: Record<string, string> = {
  META_AD: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ORGANIC_WEB: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  TIKTOK: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  YOUTUBE: "bg-red-500/20 text-red-400 border-red-500/30",
  DM_FACEBOOK: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  DM_INSTAGRAM: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  WHATSAPP: "bg-green-500/20 text-green-400 border-green-500/30",
  REFERRAL: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const SOURCE_LABELS: Record<string, string> = {
  META_AD: "Meta",
  ORGANIC_WEB: "Orgánico",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  DM_FACEBOOK: "DM FB",
  DM_INSTAGRAM: "DM IG",
  WHATSAPP: "WhatsApp",
  REFERRAL: "Referido",
  PODCAST: "Podcast",
  OTHER: "Otro",
};

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-500/20 text-blue-400",
  CONTACTED: "bg-amber-500/20 text-amber-400",
  QUALIFIED: "bg-emerald-500/20 text-emerald-400",
  CONVERTED: "bg-gold/20 text-gold",
  LOST: "bg-red-500/20 text-red-400",
};

export function RecentLeads({ leads, loading }: RecentLeadsProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads Recientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Leads Recientes</CardTitle>
        <a
          href="/leads"
          className="text-xs text-gold hover:underline"
        >
          Ver todos →
        </a>
      </CardHeader>
      <CardContent>
        {leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No hay leads registrados aún.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-elevated/50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/10 text-sm font-semibold text-gold">
                  {lead.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {lead.name}
                    </p>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[10px] px-1.5 py-0 ${SOURCE_COLORS[lead.source] || ""}`}
                    >
                      {SOURCE_LABELS[lead.source] || lead.source}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {lead.caseType && <span>{lead.caseType}</span>}
                    {lead.city && <span>· {lead.city}</span>}
                    <span>
                      ·{" "}
                      {formatDistanceToNow(new Date(lead.createdAt), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </span>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={`shrink-0 text-[10px] ${STATUS_COLORS[lead.status] || ""}`}
                >
                  {lead.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
