"use client";
import { useState } from "react";
import { useAnalytics } from "@/hooks/use-analytics";
import { MetricCard } from "@/components/dashboard/metric-card";
import { FunnelChart } from "@/components/dashboard/charts/funnel-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Users, TrendingUp, DollarSign, BarChart3, FileBarChart, Search, Eye } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AnalyticsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState("30d");
  const { data, loading } = useAnalytics(period);

  const funnelSteps = [
    { label: "Impresiones", value: data?.web?.sessions ? data.web.sessions * 5 : 0, color: "#6b7280" },
    { label: "Sesiones", value: data?.web?.sessions || 0, color: "#3b82f6" },
    { label: "Leads", value: data?.leads?.total || 0, color: "#cda64e" },
    { label: "Calificados", value: Math.round((data?.leads?.total || 0) * 0.3), color: "#f59e0b" },
    { label: "Convertidos", value: data?.leads?.converted || 0, color: "#22c55e" },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Métricas consolidadas de todas las plataformas.</p></div>
        <div className="flex rounded-lg border border-border">
          {["7d", "30d", "90d"].map(p => (
            <Button key={p} variant="ghost" size="sm" className={period === p ? "bg-gold/10 text-gold" : "text-muted-foreground"} onClick={() => setPeriod(p)}>{p}</Button>))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Sesiones web" value={data?.web ? data.web.sessions.toLocaleString() : "--"} icon={Globe} loading={loading} disconnected={!loading && !data?.web} />
        <MetricCard title="Leads totales" value={data?.leads ? String(data.leads.total) : "--"} icon={Users} loading={loading} />
        <MetricCard title="Tasa de conversión" value={data?.leads ? `${data.leads.conversionRate}%` : "--"} icon={TrendingUp} loading={loading} />
        <MetricCard title="Gasto en Ads" value={data?.ads ? `$${data.ads.totalSpend.toLocaleString()}` : "--"} icon={DollarSign} loading={loading} disconnected={!loading && !data?.ads} />
      </div>

      {loading ? <Skeleton className="h-64" /> : <FunnelChart steps={funnelSteps.filter(s => s.value > 0)} />}

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "ROI por Canal", href: "/analytics/roi", icon: DollarSign },
          { label: "Reportes Semanales", href: "/analytics/reports", icon: FileBarChart },
          { label: "SEO Advisor", href: "/seo", icon: Search },
          { label: "Competitor Watch", href: "/seo/competitors", icon: Eye },
        ].map(link => (
          <Button key={link.href} variant="outline" className="h-auto justify-start gap-3 p-4" onClick={() => router.push(link.href)}>
            <link.icon className="h-4 w-4 shrink-0 text-gold" /><span className="text-sm">{link.label}</span>
          </Button>))}
      </div>
    </div>
  );
}
