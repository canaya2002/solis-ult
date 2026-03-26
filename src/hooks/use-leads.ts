"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  sourceDetail: string | null;
  status: string;
  caseType: string | null;
  city: string | null;
  notes: string | null;
  contractValue: number | null;
  reviewRequested: boolean;
  reviewLeft: boolean;
  createdAt: string;
  updatedAt: string;
  convertedAt: string | null;
}

interface LeadStats {
  totalLeads: number;
  newThisPeriod: number;
  contactedThisPeriod: number;
  qualifiedThisPeriod: number;
  convertedThisPeriod: number;
  conversionRate: number;
  averageContractValue: number;
  totalRevenue: number;
  bySource: Array<{
    source: string;
    count: number;
    converted: number;
    conversionRate: number;
  }>;
  byCity: Array<{ city: string; count: number; converted: number }>;
  byCaseType: Array<{ caseType: string; count: number }>;
  dailyLeads: Array<{ date: string; count: number; source: string }>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Counts {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  converted: number;
  lost: number;
  bySource: Record<string, number>;
}

interface Filters {
  source?: string;
  status?: string;
  city?: string;
  search?: string;
  page?: number;
}

export function useLeads(initialFilters?: Filters) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters || {});

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.source) params.set("source", filters.source);
      if (filters.status) params.set("status", filters.status);
      if (filters.city) params.set("city", filters.city);
      if (filters.search) params.set("search", filters.search);
      if (filters.page) params.set("page", String(filters.page));

      const res = await fetch(`/api/leads?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setLeads(json.data.leads);
        setPagination(json.data.pagination);
        setCounts(json.data.counts);
      } else {
        setError(json.error);
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchStats = useCallback(async (period = "30d") => {
    setStatsLoading(true);
    try {
      const res = await fetch(`/api/leads/stats?period=${period}`);
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch { /* ignore */ }
    finally { setStatsLoading(false); }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchStats();
  }, [fetchLeads, fetchStats]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchLeads, 30000);
    return () => clearInterval(interval);
  }, [fetchLeads]);

  const createLead = async (data: {
    name: string;
    email?: string;
    phone?: string;
    source: string;
    caseType?: string;
    city?: string;
    sendFollowUp?: boolean;
  }) => {
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success("Lead creado");
      await fetchLeads();
      return json.data;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear lead");
      throw e;
    }
  };

  const updateLeadStatus = async (
    leadId: string,
    status: string,
    notes?: string
  ) => {
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, status, notes }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(`Lead actualizado a ${status}`);
      await fetchLeads();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error al actualizar lead"
      );
    }
  };

  const convertLead = async (leadId: string, contractValue: number) => {
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          status: "CONVERTED",
          contractValue,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(
        `Lead convertido — $${contractValue.toLocaleString()}`
      );
      await fetchLeads();
      await fetchStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al convertir lead");
    }
  };

  return {
    leads,
    pagination,
    counts,
    stats,
    loading,
    statsLoading,
    error,
    filters,
    setFilters,
    refetch: fetchLeads,
    fetchStats,
    createLead,
    updateLeadStatus,
    convertLead,
  };
}
