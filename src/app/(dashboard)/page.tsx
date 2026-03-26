"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMetrics } from "@/hooks/use-metrics";
import { MetricCard } from "@/components/dashboard/metric-card";
import { LeadsChart } from "@/components/dashboard/charts/leads-chart";
import { TrafficChart } from "@/components/dashboard/charts/traffic-chart";
import { RecentLeads } from "@/components/dashboard/recent-leads";
import { ApiStatusGrid } from "@/components/dashboard/api-status-grid";
import { OnboardingHero } from "@/components/dashboard/onboarding-hero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  FileCheck,
  DollarSign,
  Globe,
  Lightbulb,
  BarChart3,
  ClipboardList,
  Settings,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function OverviewPage() {
  const router = useRouter();
  const [period, setPeriod] = useState("30d");
  const { data, loading } = useMetrics(period);

  const totalApis =
    (data?.connectedApis.length || 0) + (data?.disconnectedApis.length || 0);
  const connectedCount = data?.connectedApis.length || 0;

  // Show onboarding if no APIs connected
  if (!loading && data && connectedCount === 0) {
    return (
      <OnboardingHero
        connectedCount={0}
        totalApis={totalApis}
        onGoToSettings={() => router.push("/settings")}
      />
    );
  }

  // Build chart data from leads trend
  const leadsChartData = (data?.leads?.trend || []).map((d) => ({
    date: d.date.slice(5),
    meta: 0,
    organic: 0,
    tiktok: 0,
    youtube: 0,
    other: d.count,
  }));

  // Populate by source from bySource data
  if (data?.leads?.bySource) {
    for (const s of data.leads.bySource) {
      const key =
        s.source === "META_AD"
          ? "meta"
          : s.source === "ORGANIC_WEB"
            ? "organic"
            : s.source === "TIKTOK"
              ? "tiktok"
              : s.source === "YOUTUBE"
                ? "youtube"
                : "other";
      // Spread across chart points (simplified)
      if (leadsChartData.length > 0 && key !== "other") {
        leadsChartData[leadsChartData.length - 1][key] = s.count;
        if (leadsChartData[leadsChartData.length - 1].other >= s.count) {
          leadsChartData[leadsChartData.length - 1].other -= s.count;
        }
      }
    }
  }

  const webChartData = (data?.web?.trend || []).map((d) => ({
    date: d.date.slice(5),
    sessions: d.sessions,
  }));

  // Sparkline data from leads trend
  const leadsSparkline = (data?.leads?.trend || []).map((d) => d.count);
  const webSparkline = (data?.web?.trend || []).map((d) => d.sessions);

  const cplStatus: "success" | "warning" | "danger" | undefined = data?.ads
    ? data.ads.averageCpl < 20
      ? "success"
      : data.ads.averageCpl <= 30
        ? "warning"
        : "danger"
    : undefined;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
          <p className="text-muted-foreground">
            Vista general del rendimiento de marketing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              connectedCount === totalApis
                ? "border-emerald-500/30 text-emerald-400"
                : connectedCount > 0
                  ? "border-amber-500/30 text-amber-400"
                  : "border-red-500/30 text-red-400"
            )}
          >
            {connectedCount} de {totalApis} APIs
          </Badge>
          <div className="flex rounded-lg border border-border">
            {(["7d", "30d", "90d"] as const).map((p) => (
              <Button
                key={p}
                variant="ghost"
                size="sm"
                className={
                  period === p
                    ? "bg-gold/10 text-gold"
                    : "text-muted-foreground"
                }
                onClick={() => setPeriod(p)}
              >
                {p}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Leads este mes"
          value={data?.leads ? String(data.leads.total) : "--"}
          icon={Users}
          loading={loading}
          sparklineData={leadsSparkline}
          subtitle={
            data?.leads
              ? `${data.leads.converted} convertidos`
              : undefined
          }
          disconnected={!loading && !data?.leads}
        />
        <MetricCard
          title="Contratos cerrados"
          value={
            data?.leads ? String(data.leads.converted) : "--"
          }
          icon={FileCheck}
          loading={loading}
          subtitle={
            data?.leads
              ? `${data.leads.conversionRate}% tasa de conversión`
              : undefined
          }
          disconnected={!loading && !data?.leads}
        />
        <MetricCard
          title="Gasto Meta Ads"
          value={
            data?.ads
              ? `$${data.ads.totalSpend.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
              : "--"
          }
          icon={DollarSign}
          loading={loading}
          status={cplStatus}
          subtitle={
            data?.ads
              ? `CPL $${data.ads.averageCpl.toFixed(2)}`
              : undefined
          }
          disconnected={!loading && !data?.ads}
        />
        <MetricCard
          title="Tráfico web"
          value={
            data?.web
              ? data.web.sessions.toLocaleString()
              : "--"
          }
          icon={Globe}
          loading={loading}
          sparklineData={webSparkline}
          subtitle={
            data?.web
              ? `${data.web.users.toLocaleString()} usuarios · ${data.web.bounceRate}% rebote`
              : undefined
          }
          disconnected={!loading && !data?.web}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <LeadsChart data={leadsChartData} period={period} />
        <TrafficChart data={webChartData} period={period} />
      </div>

      {/* Panels row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent leads */}
        {loading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        ) : (
          <RecentLeads leads={[]} loading={false} />
        )}

        {/* Active campaigns mini-table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Campañas Activas</CardTitle>
            <a href="/ads" className="text-xs text-gold hover:underline">
              Ver todas →
            </a>
          </CardHeader>
          <CardContent>
            {!data?.ads ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">
                  Conecta Meta Ads en{" "}
                  <a href="/settings" className="text-gold hover:underline">
                    Settings
                  </a>
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {data.ads.activeCampaigns} campañas activas · CPL promedio{" "}
                    <span
                      className={
                        data.ads.averageCpl < 20
                          ? "text-emerald-400"
                          : data.ads.averageCpl <= 30
                            ? "text-amber-400"
                            : "text-red-400"
                      }
                    >
                      ${data.ads.averageCpl.toFixed(2)}
                    </span>
                  </span>
                </div>
                {data.ads.bestCampaign && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs">
                    <span className="text-emerald-400">Mejor:</span>{" "}
                    {data.ads.bestCampaign.name} — CPL $
                    {data.ads.bestCampaign.cpl.toFixed(2)}
                  </div>
                )}
                {data.ads.worstCampaign && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-xs">
                    <span className="text-red-400">Peor:</span>{" "}
                    {data.ads.worstCampaign.name} — CPL $
                    {data.ads.worstCampaign.cpl.toFixed(2)}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Generar ideas de contenido",
                href: "/content",
                icon: Lightbulb,
              },
              {
                label: "Ejecutar rebalanceo",
                href: "/ads",
                icon: Bot,
              },
              {
                label: "Ver reporte semanal",
                href: "/analytics/reports",
                icon: ClipboardList,
              },
              {
                label: "Configurar APIs",
                href: "/settings",
                icon: Settings,
              },
            ].map((action) => (
              <Button
                key={action.href}
                variant="outline"
                className="h-auto justify-start gap-3 p-4"
                onClick={() => router.push(action.href)}
              >
                <action.icon className="h-4 w-4 shrink-0 text-gold" />
                <span className="text-sm">{action.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* API Status */}
      {data && (
        <ApiStatusGrid
          connected={data.connectedApis}
          disconnected={data.disconnectedApis}
        />
      )}
    </div>
  );
}
