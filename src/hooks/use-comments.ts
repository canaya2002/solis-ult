"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { redis } from "@/lib/redis";

interface Comment {
  id: string;
  platform: string;
  externalId: string;
  postExternalId: string;
  text: string;
  author: string;
  category: string | null;
  responseDraft: string | null;
  responseStatus: string;
  respondedAt: string | null;
  createdAt: string;
}

interface Counts {
  pending: number;
  approved: number;
  published: number;
  ignored: number;
  byCategory: Record<string, number>;
}

interface Filters {
  status?: string;
  category?: string;
  platform?: string;
  page?: number;
}

export function useComments(initialFilters?: Filters) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<Filters>(initialFilters || { status: "PENDING" });

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.category) params.set("category", filters.category);
      if (filters.platform) params.set("platform", filters.platform);
      if (filters.page) params.set("page", String(filters.page));

      const res = await fetch(`/api/social/comments?${params}`);
      const json = await res.json();
      if (json.success) {
        setComments(json.data.comments);
        setCounts(json.data.counts);
        setTotal(json.data.pagination.total);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => {
    fetchComments();
    const interval = setInterval(fetchComments, 30000);
    return () => clearInterval(interval);
  }, [fetchComments]);

  const doAction = async (commentId: string, action: string, editedResponse?: string) => {
    const res = await fetch("/api/social/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId, action, editedResponse }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  };

  const approveComment = async (commentId: string) => {
    try {
      await doAction(commentId, "approve");
      toast.success("Respuesta publicada");
      await fetchComments();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const editAndApprove = async (commentId: string, editedResponse: string) => {
    try {
      await doAction(commentId, "edit_and_approve", editedResponse);
      toast.success("Respuesta editada y publicada");
      await fetchComments();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const ignoreComment = async (commentId: string) => {
    try {
      await doAction(commentId, "ignore");
      toast.success("Comentario ignorado");
      await fetchComments();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const bulkApprove = async (commentIds: string[]) => {
    let success = 0;
    for (const id of commentIds) {
      try {
        await doAction(id, "approve");
        success++;
      } catch { /* continue */ }
    }
    toast.success(`${success} comentarios aprobados`);
    await fetchComments();
  };

  const bulkIgnore = async (commentIds: string[]) => {
    let success = 0;
    for (const id of commentIds) {
      try {
        await doAction(id, "ignore");
        success++;
      } catch { /* continue */ }
    }
    toast.success(`${success} comentarios ignorados`);
    await fetchComments();
  };

  const getAutoApproveSettings = async (): Promise<Record<string, boolean>> => {
    try {
      const res = await fetch("/api/social/comments?getSettings=1");
      return res.ok ? await res.json() : {};
    } catch {
      return {};
    }
  };

  return {
    comments,
    counts,
    loading,
    total,
    filters,
    setFilters,
    refetch: fetchComments,
    approveComment,
    editAndApprove,
    ignoreComment,
    bulkApprove,
    bulkIgnore,
    getAutoApproveSettings,
  };
}
