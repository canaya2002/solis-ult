"use client";
import { useState } from "react";
import { useROI } from "@/hooks/use-roi";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RoiChart } from "@/components/dashboard/charts/roi-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, FileCheck, TrendingUp, Award, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ROIPage() {
  const [period, setPeriod] = useState<"30d" | "90d" | "12m" | "all">("30d");
  const { data, loading } = useROI(period);

  const bestChannel = data?.channels.sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0))[0];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">ROI por Canal</h1>
          <p className="text-muted-foreground">Retorno de inversión desglosado por fuente de leads.</p></div>
        <div className="flex rounded-lg border border-border">
          {(["30d", "90d", "12m", "all"] as const).map(p => (
            <Button key={p} variant="ghost" size="sm" className={period === p ? "bg-gold/10 text-gold" : "text-muted-foreground"} onClick={() => setPeriod(p)}>
              {p === "all" ? "Todo" : p}
            </Button>))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Revenue total" value={data ? `$${data.totals.totalRevenue.toLocaleString()}` : "--"} icon={DollarSign} loading={loading} />
        <MetricCard title="Contratos" value={data ? String(data.totals.conversions) : "--"} icon={FileCheck} loading={loading} subtitle={data ? `${data.totals.overallConversionRate}% conv.` : undefined} />
        <MetricCard title="ROI general" value={data ? `${data.totals.overallRoi}%` : "--"} icon={TrendingUp} loading={loading} status={data ? (data.totals.overallRoi > 100 ? "success" : data.totals.overallRoi > 0 ? "warning" : "danger") : undefined} />
        <MetricCard title="Mejor canal" value={bestChannel?.displayName || "--"} icon={Award} loading={loading} subtitle={bestChannel ? `ROI: ${bestChannel.roi !== null ? bestChannel.roi + "%" : "∞"}` : undefined} />
      </div>

      {loading ? <Skeleton className="h-64" /> : data && (
        <>
          {/* ROI Table */}
          <Card><CardHeader><CardTitle className="text-base">Desglose por Canal</CardTitle></CardHeader>
            <CardContent><div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="border-b border-border"><tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Canal</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Leads</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Conv.</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Tasa</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Revenue</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Costo</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">CAC</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">ROI</th>
              </tr></thead>
              <tbody>
                {data.channels.map(c => (
                  <tr key={c.source} className="border-b border-border/50">
                    <td className="px-3 py-2"><div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} /><span className="font-medium">{c.displayName}</span></div></td>
                    <td className="px-3 py-2 text-right font-mono">{c.leads}</td>
                    <td className="px-3 py-2 text-right font-mono">{c.conversions}</td>
                    <td className="px-3 py-2 text-right">{c.conversionRate}%</td>
                    <td className="px-3 py-2 text-right font-mono">${c.revenue.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono">{c.cost > 0 ? `$${c.cost.toLocaleString()}` : "—"}</td>
                    <td className={cn("px-3 py-2 text-right font-mono", c.cac > 4000 ? "text-red-400" : c.cac > 2000 ? "text-amber-400" : "text-emerald-400")}>{c.cac > 0 ? `$${c.cac.toLocaleString()}` : "$0"}</td>
                    <td className={cn("px-3 py-2 text-right font-semibold", c.roi === null ? "text-emerald-400" : c.roi > 100 ? "text-emerald-400" : c.roi > 0 ? "text-amber-400" : "text-red-400")}>{c.roi !== null ? `${c.roi}%` : "∞"}</td>
                  </tr>
                ))}
                <tr className="font-bold border-t-2 border-border">
                  <td className="px-3 py-2">TOTAL</td><td className="px-3 py-2 text-right">{data.totals.leads}</td><td className="px-3 py-2 text-right">{data.totals.conversions}</td>
                  <td className="px-3 py-2 text-right">{data.totals.overallConversionRate}%</td><td className="px-3 py-2 text-right">${data.totals.totalRevenue.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">${data.totals.totalCost.toLocaleString()}</td><td className="px-3 py-2 text-right">—</td><td className="px-3 py-2 text-right text-gold">{data.totals.overallRoi}%</td>
                </tr>
              </tbody></table></div></CardContent></Card>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <RoiChart data={data.channels.filter(c => c.revenue > 0).map(c => ({ name: c.displayName, value: c.revenue, color: c.color }))} centerLabel={`$${data.totals.totalRevenue.toLocaleString()}`} />
            <Card><CardHeader><CardTitle className="text-base">Leads vs Conversiones</CardTitle></CardHeader>
              <CardContent><div className="space-y-2">{data.channels.filter(c => c.leads > 0).map(c => (
                <div key={c.source} className="flex items-center gap-3"><span className="w-24 text-xs text-right text-muted-foreground truncate">{c.displayName}</span>
                  <div className="flex-1 flex gap-1"><div className="h-5 rounded" style={{ width: `${(c.leads / Math.max(...data.channels.map(x => x.leads))) * 100}%`, backgroundColor: c.color + "44" }} />
                    <div className="h-5 rounded" style={{ width: `${(c.conversions / Math.max(...data.channels.map(x => x.leads))) * 100}%`, backgroundColor: c.color }} /></div>
                  <span className="text-xs text-muted-foreground w-16 text-right">{c.leads}/{c.conversions}</span></div>
              ))}</div></CardContent></Card>
          </div>

          {/* AI Insights */}
          {data.insights.length > 0 && (
            <Card className="border-gold/20"><CardHeader><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4 text-gold" /> Insights AI</CardTitle></CardHeader>
              <CardContent><ul className="space-y-2">{data.insights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2 text-sm"><span className="text-gold mt-0.5">•</span><span>{insight}</span></li>
              ))}</ul>
                {data.projections.length > 0 && (
                  <div className="mt-4 rounded-lg bg-gold/5 border border-gold/10 p-3"><p className="text-xs font-medium text-gold mb-1">Proyecciones</p>
                    {data.projections.map((p, i) => <p key={i} className="text-sm text-muted-foreground">→ {p}</p>)}</div>
                )}
              </CardContent></Card>
          )}
        </>
      )}
    </div>
  );
}
