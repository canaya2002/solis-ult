"use client";
import { useState, useEffect, useCallback } from "react";
import { useReports } from "@/hooks/use-reports";
import { ReportCard } from "@/components/dashboard/report-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { FileBarChart, Loader2, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface StrategyAction {
  title: string;
  reason: string;
  expectedImpact: string;
  urgency: "high" | "medium" | "low";
  type: string;
  actionUrl: string;
  actionLabel: string;
}

interface Strategy {
  id: string;
  weekOf: string;
  summary: string;
  actions: StrategyAction[];
  createdAt: string;
}

const URGENCY_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: "Alta", color: "text-red-400", bg: "border-red-500/20" },
  medium: { label: "Media", color: "text-yellow-400", bg: "border-yellow-500/20" },
  low: { label: "Baja", color: "text-emerald-400", bg: "border-emerald-500/20" },
};

const TYPE_LABELS: Record<string, string> = {
  ads: "Ads", content: "Contenido", seo: "SEO", engagement: "Engagement", reputation: "Reputaci\u00f3n",
};

export default function ReportsPage() {
  const { reports, loading, generating, latestReport, generateReport } = useReports();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [generatingStrategy, setGeneratingStrategy] = useState(false);

  const fetchStrategies = useCallback(async () => {
    try {
      const res = await fetch("/api/strategy");
      const json = await res.json();
      if (json.success) setStrategies(json.data.strategies);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchStrategies(); }, [fetchStrategies]);

  const handleGenerateStrategy = async () => {
    setGeneratingStrategy(true);
    try {
      const res = await fetch("/api/strategy", { method: "POST" });
      const json = await res.json();
      if (json.success) { toast.success("Estrategia generada"); fetchStrategies(); }
      else toast.error(json.error);
    } catch { toast.error("Error"); }
    finally { setGeneratingStrategy(false); }
  };

  const latestStrategy = strategies[0];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reportes y Estrategia</h1>
        <p className="text-muted-foreground">Reportes ejecutivos y estrategia semanal prescriptiva.</p>
      </div>

      <Tabs defaultValue="strategy">
        <TabsList>
          <TabsTrigger value="strategy" className="gap-2"><Sparkles className="h-3.5 w-3.5" /> Estrategia</TabsTrigger>
          <TabsTrigger value="reports" className="gap-2"><FileBarChart className="h-3.5 w-3.5" /> Reportes</TabsTrigger>
        </TabsList>

        {/* Strategy Tab */}
        <TabsContent value="strategy" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button className="bg-gold text-background hover:bg-gold/90" onClick={handleGenerateStrategy} disabled={generatingStrategy}>
              {generatingStrategy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
              Generar estrategia semanal
            </Button>
          </div>

          {latestStrategy ? (
            <div className="space-y-4">
              <Card className="border-gold/20">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-gold mb-1">Estrategia de la semana</p>
                  <p className="text-sm text-muted-foreground">{latestStrategy.summary}</p>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {(latestStrategy.actions as StrategyAction[]).map((action, i) => {
                  const urgency = URGENCY_STYLES[action.urgency] || URGENCY_STYLES.medium;
                  return (
                    <Card key={i} className={cn("transition-colors hover:bg-muted/30", urgency.bg)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={cn("text-[10px]", urgency.color)}>
                                {urgency.label}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {TYPE_LABELS[action.type] || action.type}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium">{action.title}</p>
                            <p className="text-xs text-muted-foreground">{action.reason}</p>
                            <p className="text-xs text-emerald-400/80">Impacto: {action.expectedImpact}</p>
                          </div>
                          <Link href={action.actionUrl}>
                            <Button size="sm" variant="outline" className="shrink-0 gap-1.5 text-xs">
                              {action.actionLabel} <ArrowRight className="h-3 w-3" />
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* History */}
              {strategies.length > 1 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 mt-4">Estrategias anteriores</h3>
                  {strategies.slice(1).map(s => (
                    <Card key={s.id} className="mb-2">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">{new Date(s.weekOf).toLocaleDateString("es")}</p>
                          <Badge variant="outline" className="text-[10px]">{(s.actions as StrategyAction[]).length} acciones</Badge>
                        </div>
                        <p className="text-xs mt-1">{s.summary}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Card><CardContent className="py-8 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Genera la primera estrategia semanal para recibir acciones priorizadas.</p>
            </CardContent></Card>
          )}
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button className="bg-gold text-background hover:bg-gold/90" onClick={() => generateReport()} disabled={generating}>
              {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileBarChart className="mr-1.5 h-4 w-4" />}
              Generar reporte ahora
            </Button>
          </div>

          {loading ? (
            <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <FileBarChart className="h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">No hay reportes a\u00fan</p>
              <p className="text-muted-foreground">Genera el primer reporte semanal o espera al viernes.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {latestReport && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-2">Reporte m\u00e1s reciente</h2>
                  <ReportCard report={latestReport} expanded />
                </div>
              )}
              {reports.length > 1 && (
                <div>
                  <h2 className="text-lg font-semibold mb-2">Historial</h2>
                  <div className="space-y-2">
                    {reports.slice(1).map(r => <ReportCard key={r.id} report={r} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
