"use client";

import { useCampaigns } from "@/hooks/use-campaigns";
import { MetricCard } from "@/components/dashboard/metric-card";
import { CampaignTable } from "@/components/dashboard/campaign-table";
import { RebalancePanel } from "@/components/dashboard/rebalance-panel";
import { CplChart } from "@/components/dashboard/charts/cpl-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Users,
  TrendingDown,
  BarChart3,
  Bot,
  AlertTriangle,
} from "lucide-react";

export default function AdsPage() {
  const {
    campaigns,
    summary,
    loading,
    dateRange,
    setDateRange,
    pauseCampaign,
    activateCampaign,
    updateBudget,
    executeRebalance,
    lastRebalance,
    rebalanceLoading,
  } = useCampaigns();

  const highCplCampaigns = campaigns.filter(
    (c) => c.cpl !== null && c.cpl > 30 && c.status === "ACTIVE"
  );

  // Build chart data from campaigns
  const chartData = campaigns
    .filter((c) => c.cpl !== null)
    .slice(0, 5)
    .reduce(
      (acc, c) => {
        const point = acc[0] || { date: "Hoy" };
        point[c.name] = c.cpl ?? 0;
        acc[0] = point;
        return acc;
      },
      [{ date: "Hoy" }] as Array<Record<string, string | number>>
    );
  const chartCampaignNames = campaigns
    .filter((c) => c.cpl !== null)
    .slice(0, 5)
    .map((c) => c.name);

  function cplColor(cpl: number) {
    if (cpl < 20) return "text-emerald-400";
    if (cpl <= 30) return "text-amber-400";
    return "text-red-400";
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Meta Ads Optimizer
          </h1>
          <p className="text-muted-foreground">
            Optimización automática de campañas con AI para reducir el CAC.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {summary && (
            <Badge
              variant="outline"
              className="border-gold/30 text-gold"
            >
              {summary.activeCampaigns} activas
            </Badge>
          )}
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
      </div>

      {/* Alert banner for high CPL */}
      {highCplCampaigns.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">
            <span className="font-semibold">
              {highCplCampaigns.length} campaña
              {highCplCampaigns.length > 1 ? "s" : ""}{" "}
            </span>
            con CPL superior a $30. Se recomienda ejecutar el rebalancer.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Gasto total"
          value={
            summary ? `$${summary.totalSpend.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "--"
          }
          icon={DollarSign}
          loading={loading}
        />
        <MetricCard
          title="Leads totales"
          value={summary ? String(summary.totalLeads) : "--"}
          icon={Users}
          loading={loading}
        />
        <MetricCard
          title="CPL promedio"
          value={
            summary
              ? `$${summary.averageCpl.toFixed(2)}`
              : "--"
          }
          icon={TrendingDown}
          loading={loading}
          change={
            summary && summary.averageCpl > 0
              ? summary.averageCpl < 20
                ? -15
                : summary.averageCpl > 30
                  ? 25
                  : 0
              : undefined
          }
          changeLabel={
            summary
              ? summary.averageCpl < 20
                ? "óptimo"
                : summary.averageCpl > 30
                  ? "alto"
                  : "aceptable"
              : undefined
          }
        />
        <MetricCard
          title="Campañas"
          value={
            summary
              ? `${summary.activeCampaigns} / ${summary.activeCampaigns + summary.pausedCampaigns + summary.pausedByAi}`
              : "--"
          }
          icon={BarChart3}
          loading={loading}
        />
        <MetricCard
          title="Pausadas por AI"
          value={summary ? String(summary.pausedByAi) : "--"}
          icon={Bot}
          loading={loading}
        />
      </div>

      {/* Rebalancer Panel */}
      <RebalancePanel
        lastRebalance={lastRebalance}
        onPreview={() => executeRebalance(true)}
        onExecute={() => executeRebalance(false)}
        isLoading={rebalanceLoading}
      />

      {/* Campaign Table */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Campañas</h2>
        <CampaignTable
          campaigns={campaigns}
          onPause={pauseCampaign}
          onActivate={activateCampaign}
          onUpdateBudget={updateBudget}
          loading={loading}
        />
      </div>

      {/* CPL Chart */}
      {campaigns.length > 0 && (
        <CplChart
          data={chartData}
          campaignNames={chartCampaignNames}
          threshold={30}
        />
      )}

      {/* Quick Stats */}
      {summary && summary.averageCpl > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Análisis rápido
          </h3>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <span className="text-muted-foreground">CPL promedio: </span>
              <span className={cplColor(summary.averageCpl)}>
                ${summary.averageCpl.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">
                Costo por contrato estimado:{" "}
              </span>
              <span className="text-red-400">
                $
                {summary.totalLeads > 0
                  ? (
                      (summary.totalSpend / summary.totalLeads) *
                      (100 / 0.47)
                    ).toFixed(0)
                  : "N/A"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">
                Conversión estimada:{" "}
              </span>
              <span className="text-amber-400">0.47%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
