"use client";

import { useState } from "react";
import { useReviews } from "@/hooks/use-reviews";
import { ReviewCard } from "@/components/dashboard/review-card";
import { StarRating } from "@/components/dashboard/star-rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";

export default function ResponsesPage() {
  const { reviews, loading, respondToReview } = useReviews({
    responseStatus: "PENDING",
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = reviews.find((r) => r.id === selectedId);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Response Queue</h1>
        <p className="text-muted-foreground">
          Reviews pendientes de respuesta — workflow tipo inbox.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Inbox className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">Inbox vacío</p>
          <p className="text-muted-foreground">
            Todas las reviews han sido respondidas.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {/* List */}
          <div className="lg:col-span-2 space-y-2 max-h-[600px] overflow-y-auto">
            {reviews.map((review) => (
              <button
                key={review.id}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  selectedId === review.id
                    ? "border-gold bg-gold/5"
                    : "border-border hover:border-gold/30"
                }`}
                onClick={() => setSelectedId(review.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <StarRating rating={review.rating} size="sm" />
                  <Badge variant="outline" className="text-[10px]">
                    {review.officeName}
                  </Badge>
                </div>
                <p className="text-sm font-medium truncate">{review.author}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {review.text}
                </p>
              </button>
            ))}
          </div>

          {/* Detail */}
          <div className="lg:col-span-3">
            {selected ? (
              <ReviewCard
                review={selected}
                onApprove={() => {
                  respondToReview(selected.id, "approve");
                  setSelectedId(null);
                }}
                onEdit={(text) => {
                  respondToReview(selected.id, "edit_and_approve", text);
                  setSelectedId(null);
                }}
                onIgnore={() => {
                  respondToReview(selected.id, "ignore");
                  setSelectedId(null);
                }}
                onRegenerate={() =>
                  respondToReview(selected.id, "regenerate")
                }
                showDraft
              />
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-20">
                <p className="text-muted-foreground">
                  Selecciona una review de la lista para responder
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        {reviews.length} review{reviews.length !== 1 ? "s" : ""} pendiente
        {reviews.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
