"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

interface Review {
  id: string;
  source: string;
  externalId: string | null;
  rating: number;
  text: string;
  author: string;
  officeName: string;
  responseDraft: string | null;
  responseStatus: string;
  respondedAt: string | null;
  createdAt: string;
}

interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  byOffice: Record<string, { count: number; avgRating: number }>;
  byRating: Record<number, number>;
  thisMonth: number;
  respondedPercent: number;
}

interface Filters {
  source?: string;
  office?: string;
  rating?: string;
  responseStatus?: string;
  page?: number;
}

export function useReviews(initialFilters?: Filters) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<Filters>(initialFilters || {});

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.source) params.set("source", filters.source);
      if (filters.office) params.set("office", filters.office);
      if (filters.rating) params.set("rating", filters.rating);
      if (filters.responseStatus) params.set("responseStatus", filters.responseStatus);
      if (filters.page) params.set("page", String(filters.page));

      const res = await fetch(`/api/reviews?${params}`);
      const json = await res.json();
      if (json.success) {
        setReviews(json.data.reviews);
        setStats(json.data.stats);
        setTotal(json.data.pagination.total);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => {
    fetchReviews();
    const interval = setInterval(fetchReviews, 300000);
    return () => clearInterval(interval);
  }, [fetchReviews]);

  const syncReviews = async () => {
    try {
      const res = await fetch("/api/reviews/sync", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast.success(`${json.data.newReviews} reviews nuevas sincronizadas`);
        await fetchReviews();
      } else {
        toast.error(json.error || "Error al sincronizar");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const respondToReview = async (
    reviewId: string,
    action: "approve" | "edit_and_approve" | "ignore" | "regenerate",
    editedResponse?: string
  ) => {
    try {
      const res = await fetch("/api/reviews/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, action, editedResponse }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(
        action === "approve" ? "Respuesta publicada" :
        action === "regenerate" ? "Respuesta regenerada" :
        action === "ignore" ? "Review ignorada" :
        "Respuesta actualizada"
      );
      await fetchReviews();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return {
    reviews,
    stats,
    loading,
    total,
    filters,
    setFilters,
    refetch: fetchReviews,
    syncReviews,
    respondToReview,
  };
}
