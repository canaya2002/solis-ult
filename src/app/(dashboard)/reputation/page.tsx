"use client";

import { useReviews } from "@/hooks/use-reviews";
import { ReviewCard } from "@/components/dashboard/review-card";
import { StarRating } from "@/components/dashboard/star-rating";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Star,
  MessageSquare,
  Clock,
  CheckCircle,
  RefreshCw,
} from "lucide-react";

export default function ReputationPage() {
  const {
    reviews,
    stats,
    loading,
    filters,
    setFilters,
    syncReviews,
    respondToReview,
  } = useReviews();

  const pendingReviews = reviews.filter(
    (r) => r.responseStatus === "PENDING"
  );
  const negativeReviews = pendingReviews.filter((r) => r.rating <= 3);
  const positiveReviews = pendingReviews.filter((r) => r.rating >= 4);

  const offices = ["Dallas", "Chicago", "Los Angeles", "Memphis"];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Reputation Manager
          </h1>
          <p className="text-muted-foreground">
            Monitorea y responde reseñas de todas las oficinas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats && (
            <div className="flex items-center gap-1">
              <StarRating rating={stats.averageRating} size="md" showNumber />
            </div>
          )}
          <Button variant="outline" size="sm" onClick={syncReviews}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Sincronizar
          </Button>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Rating promedio"
          value={stats ? stats.averageRating.toFixed(1) : "--"}
          icon={Star}
          loading={loading}
          status={
            stats
              ? stats.averageRating >= 4.5
                ? "success"
                : stats.averageRating >= 3.5
                  ? "warning"
                  : "danger"
              : undefined
          }
        />
        <MetricCard
          title="Total reviews"
          value={stats ? String(stats.totalReviews) : "--"}
          icon={MessageSquare}
          loading={loading}
          subtitle={stats ? `+${stats.thisMonth} este mes` : undefined}
        />
        <MetricCard
          title="Pendientes"
          value={String(pendingReviews.length)}
          icon={Clock}
          loading={loading}
          status={pendingReviews.length > 5 ? "danger" : undefined}
        />
        <MetricCard
          title="Tasa de respuesta"
          value={stats ? `${stats.respondedPercent}%` : "--"}
          icon={CheckCircle}
          loading={loading}
        />
      </div>

      {/* Office breakdown */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {offices.map((office) => {
            const data = stats.byOffice[office];
            return (
              <Card
                key={office}
                className="cursor-pointer hover:border-gold/30 transition-colors"
                onClick={() => setFilters({ ...filters, office })}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{office}</span>
                    {data && (
                      <StarRating rating={data.avgRating} size="sm" showNumber />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data ? `${data.count} reviews` : "Sin datos"}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Negative reviews (priority) */}
      {negativeReviews.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-red-400">
            Requieren atención ({negativeReviews.length})
          </h2>
          <div className="space-y-3">
            {negativeReviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onApprove={() => respondToReview(review.id, "approve")}
                onEdit={(text) =>
                  respondToReview(review.id, "edit_and_approve", text)
                }
                onIgnore={() => respondToReview(review.id, "ignore")}
                onRegenerate={() => respondToReview(review.id, "regenerate")}
                showDraft
              />
            ))}
          </div>
        </div>
      )}

      {/* Positive pending reviews */}
      {positiveReviews.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">
            Reviews positivas pendientes ({positiveReviews.length})
          </h2>
          <div className="space-y-3">
            {positiveReviews.slice(0, 5).map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onApprove={() => respondToReview(review.id, "approve")}
                onEdit={(text) =>
                  respondToReview(review.id, "edit_and_approve", text)
                }
                onIgnore={() => respondToReview(review.id, "ignore")}
                onRegenerate={() => respondToReview(review.id, "regenerate")}
                showDraft
              />
            ))}
          </div>
        </div>
      )}

      {/* All reviews */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-2">
            <Star className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">
              No hay reviews. Sincroniza desde Google Business Profile.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
