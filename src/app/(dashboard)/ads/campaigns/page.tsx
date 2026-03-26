"use client";

import { useState } from "react";
import { useCampaigns } from "@/hooks/use-campaigns";
import { CampaignTable } from "@/components/dashboard/campaign-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter } from "lucide-react";

export default function CampaignsPage() {
  const {
    campaigns,
    loading,
    dateRange,
    setDateRange,
    pauseCampaign,
    activateCampaign,
    updateBudget,
  } = useCampaigns();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = campaigns.filter((c) => {
    const matchesSearch =
      !search || c.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statuses = ["all", "ACTIVE", "PAUSED", "PAUSED_BY_AI", "COMPLETED"];
  const statusLabels: Record<string, string> = {
    all: "Todas",
    ACTIVE: "Activas",
    PAUSED: "Pausadas",
    PAUSED_BY_AI: "Pausadas AI",
    COMPLETED: "Completadas",
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Gestión de Campañas
          </h1>
          <p className="text-muted-foreground">
            Vista detallada de todas las campañas de Meta Ads con filtros y
            acciones.
          </p>
        </div>
        <div className="flex rounded-lg border border-border">
          {["7d", "30d", "90d"].map((range) => (
            <Button
              key={range}
              variant="ghost"
              size="sm"
              className={
                dateRange === range
                  ? "bg-gold/10 text-gold"
                  : "text-muted-foreground"
              }
              onClick={() => setDateRange(range)}
            >
              {range}
            </Button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar campañas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {statuses.map((s) => (
            <Button
              key={s}
              variant="ghost"
              size="sm"
              className={
                statusFilter === s
                  ? "bg-gold/10 text-gold"
                  : "text-muted-foreground"
              }
              onClick={() => setStatusFilter(s)}
            >
              {statusLabels[s]}
              {s !== "all" && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
                  {campaigns.filter((c) =>
                    s === "all" ? true : c.status === s
                  ).length}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      {!loading && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>
            Mostrando{" "}
            <span className="font-medium text-foreground">
              {filtered.length}
            </span>{" "}
            de {campaigns.length} campañas
          </span>
          <span>
            Gasto total:{" "}
            <span className="font-medium text-foreground">
              $
              {filtered
                .reduce((s, c) => s + c.spent, 0)
                .toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          </span>
          <span>
            Leads:{" "}
            <span className="font-medium text-foreground">
              {filtered.reduce((s, c) => s + c.leads, 0)}
            </span>
          </span>
        </div>
      )}

      {/* Campaign Table */}
      <CampaignTable
        campaigns={filtered}
        onPause={pauseCampaign}
        onActivate={activateCampaign}
        onUpdateBudget={updateBudget}
        loading={loading}
      />

      {/* Campaign details panel - expandable rows will be added in future iteration */}
      {loading && (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
