"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ArrowUpDown, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface KeywordRow { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<KeywordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"clicks" | "impressions" | "position">("clicks");

  useEffect(() => {
    fetch("/api/seo/brief?latest=true").then(r => r.json()).then(json => {
      // Also try GSC data from overview
      fetch("/api/analytics/overview?period=30d").then(r => r.json()).then(ov => {
        if (ov.success && ov.data?.seo?.topQueries) {
          setKeywords(ov.data.seo.topQueries.map((q: { query: string; clicks: number; impressions: number; position: number }) => ({
            keys: [q.query], clicks: q.clicks, impressions: q.impressions, ctr: q.impressions > 0 ? Math.round((q.clicks / q.impressions) * 10000) / 100 : 0, position: q.position,
          })));
        }
      }).catch(() => {});
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = keywords.filter(k => !search || k.keys[0]?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortBy === "position" ? a.position - b.position : (b[sortBy] as number) - (a[sortBy] as number));

  return (
    <div className="animate-fade-in space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Keyword Tracker</h1>
        <p className="text-muted-foreground">Seguimiento de keywords en Google Search Console.</p></div>

      <div className="flex gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar keywords..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <div className="flex rounded-lg border border-border">
          {(["clicks", "impressions", "position"] as const).map(s => (
            <Button key={s} variant="ghost" size="sm" className={sortBy === s ? "bg-gold/10 text-gold" : "text-muted-foreground"} onClick={() => setSortBy(s)}>
              {s === "clicks" ? "Clicks" : s === "impressions" ? "Impresiones" : "Posición"}
            </Button>))}
        </div>
      </div>

      {loading ? <Skeleton className="h-64" /> : keywords.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-2">
          <Hash className="h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">Conecta Google Search Console para ver keywords.</p></CardContent></Card>
      ) : (
        <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-elevated/50"><tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Query</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Clicks</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Impressions</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">CTR</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Posición</th>
          </tr></thead>
          <tbody>{filtered.map((k, i) => (
            <tr key={i} className={cn("border-b border-border/50 transition-colors hover:bg-surface-elevated/30", k.position >= 4 && k.position <= 10 && "bg-gold/5")}>
              <td className="px-4 py-3 font-medium">{k.keys[0]}
                {k.position >= 4 && k.position <= 10 && <Badge className="ml-2 bg-gold/20 text-gold border-gold/30 text-[10px]">Oportunidad</Badge>}</td>
              <td className="px-4 py-3 text-right font-mono">{k.clicks.toLocaleString()}</td>
              <td className="px-4 py-3 text-right font-mono">{k.impressions.toLocaleString()}</td>
              <td className={cn("px-4 py-3 text-right font-mono", k.ctr < 2 ? "text-red-400" : "text-emerald-400")}>{k.ctr}%</td>
              <td className="px-4 py-3 text-right font-mono">{k.position.toFixed(1)}</td>
            </tr>
          ))}</tbody></table></div></CardContent></Card>
      )}
    </div>
  );
}
