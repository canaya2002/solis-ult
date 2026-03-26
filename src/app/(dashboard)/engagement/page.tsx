"use client";

import { useComments } from "@/hooks/use-comments";
import { CommentQueue } from "@/components/dashboard/comment-queue";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Check, Clock, XCircle } from "lucide-react";

export default function EngagementPage() {
  const {
    comments,
    counts,
    loading,
    filters,
    setFilters,
    approveComment,
    editAndApprove,
    ignoreComment,
  } = useComments();

  const statuses = [
    { value: "PENDING", label: "Pendientes" },
    { value: "PUBLISHED", label: "Publicados" },
    { value: "IGNORED", label: "Ignorados" },
  ];

  const categories = [
    { value: "", label: "Todas" },
    { value: "LEGAL_QUESTION", label: "Legal" },
    { value: "POSITIVE", label: "Positivo" },
    { value: "COMPLAINT", label: "Quejas" },
    { value: "PRICE_INQUIRY", label: "Precio" },
    { value: "SPAM", label: "Spam" },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Engagement Center
        </h1>
        <p className="text-muted-foreground">
          Gestiona comentarios y DMs de todas las plataformas con respuestas AI.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          title="Pendientes"
          value={String(counts?.pending || 0)}
          icon={Clock}
          loading={loading}
          status={counts && counts.pending > 10 ? "danger" : undefined}
        />
        <MetricCard
          title="Publicados hoy"
          value={String(counts?.published || 0)}
          icon={Check}
          loading={loading}
        />
        <MetricCard
          title="Ignorados"
          value={String(counts?.ignored || 0)}
          icon={XCircle}
          loading={loading}
        />
        <MetricCard
          title="Total"
          value={String(
            (counts?.pending || 0) +
              (counts?.published || 0) +
              (counts?.ignored || 0)
          )}
          icon={MessageCircle}
          loading={loading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex rounded-lg border border-border">
          {statuses.map((s) => (
            <Button
              key={s.value}
              variant="ghost"
              size="sm"
              className={
                filters.status === s.value
                  ? "bg-gold/10 text-gold"
                  : "text-muted-foreground"
              }
              onClick={() => setFilters({ ...filters, status: s.value })}
            >
              {s.label}
              {counts && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {s.value === "PENDING"
                    ? counts.pending
                    : s.value === "PUBLISHED"
                      ? counts.published
                      : counts.ignored}
                </Badge>
              )}
            </Button>
          ))}
        </div>
        <div className="flex rounded-lg border border-border">
          {categories.map((c) => (
            <Button
              key={c.value}
              variant="ghost"
              size="sm"
              className={
                (filters.category || "") === c.value
                  ? "bg-gold/10 text-gold"
                  : "text-muted-foreground"
              }
              onClick={() =>
                setFilters({ ...filters, category: c.value || undefined })
              }
            >
              {c.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Comment Queue */}
      <CommentQueue
        comments={comments}
        onApprove={approveComment}
        onEditApprove={editAndApprove}
        onIgnore={ignoreComment}
        loading={loading}
      />
    </div>
  );
}
