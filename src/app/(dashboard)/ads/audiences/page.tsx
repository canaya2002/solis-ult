"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, TrendingUp, Brain, Loader2, Sparkles, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface AudienceRow {
  adSetId: string;
  adSetName: string;
  campaignName: string;
  targeting: {
    ageMin?: number;
    ageMax?: number;
    genders?: number[];
    geoLocations?: Record<string, unknown>;
    interests?: Array<{ id: string; name: string }>;
  };
  spend: number;
  leads: number;
  cpl: number;
}

export default function AudiencesPage() {
  const [audiences, setAudiences] = useState<AudienceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [clientProfile, setClientProfile] = useState<{ totalClients: number; topCities: Array<{ city: string; count: number }>; topCaseTypes: Array<{ caseType: string; count: number }>; avgContractValue: number } | null>(null);
  const [strategy, setStrategy] = useState<{ customAudiences: Array<{ name: string; source: string; size: number; rationale: string }>; lookalikes: Array<{ name: string; ratio: number; rationale: string }>; recommendation: string } | null>(null);

  const analyzeClients = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/ads/audiences/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "analyze" }) });
      const json = await res.json();
      if (json.success) { setClientProfile(json.data); toast.success("An\u00e1lisis completado"); }
      else toast.error(json.error);
    } catch { toast.error("Error"); }
    finally { setAnalyzing(false); }
  };

  const generatePlan = async () => {
    setPlanning(true);
    try {
      const res = await fetch("/api/ads/audiences/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "plan" }) });
      const json = await res.json();
      if (json.success) { setStrategy(json.data); toast.success("Plan generado"); }
      else toast.error(json.error);
    } catch { toast.error("Error"); }
    finally { setPlanning(false); }
  };

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/ads/audiences");
        const json = await res.json();
        if (json.success) {
          setAudiences(json.data.audiences);
        } else {
          setError(json.error);
        }
      } catch {
        setError("Error al cargar audiencias");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const bestAudience = [...audiences]
    .filter((a) => a.cpl > 0)
    .sort((a, b) => a.cpl - b.cpl)[0];

  const genderLabel = (genders?: number[]) => {
    if (!genders || !genders.length) return "Todos";
    return genders
      .map((g) => (g === 1 ? "Hombres" : g === 2 ? "Mujeres" : "Otro"))
      .join(", ");
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Audiences</h1>
        <p className="text-muted-foreground">
          Análisis de rendimiento por audiencia y segmentación de Meta Ads.
        </p>
      </div>

      {/* AI Audience Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4 text-gold" /> AI Audience Builder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={analyzeClients} disabled={analyzing}>
              {analyzing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Users className="mr-1.5 h-3.5 w-3.5" />}
              Analizar clientes
            </Button>
            <Button size="sm" className="bg-gold text-background hover:bg-gold/90" onClick={generatePlan} disabled={planning}>
              {planning ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
              Generar plan de audiencias con AI
            </Button>
          </div>

          {clientProfile && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded border border-border p-2 text-xs">
                <p className="text-muted-foreground">Clientes</p>
                <p className="text-lg font-bold">{clientProfile.totalClients}</p>
              </div>
              <div className="rounded border border-border p-2 text-xs">
                <p className="text-muted-foreground">Top ciudad</p>
                <p className="font-medium">{clientProfile.topCities[0]?.city || "N/A"}</p>
              </div>
              <div className="rounded border border-border p-2 text-xs">
                <p className="text-muted-foreground">Top caso</p>
                <p className="font-medium">{clientProfile.topCaseTypes[0]?.caseType || "N/A"}</p>
              </div>
              <div className="rounded border border-border p-2 text-xs">
                <p className="text-muted-foreground">Valor promedio</p>
                <p className="font-medium">${clientProfile.avgContractValue.toLocaleString()}</p>
              </div>
            </div>
          )}

          {strategy && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{strategy.recommendation}</p>
              <div className="space-y-2">
                {strategy.customAudiences.map((a, i) => (
                  <div key={i} className="rounded border border-border p-2 flex items-center justify-between">
                    <div className="text-xs"><p className="font-medium">{a.name}</p><p className="text-muted-foreground">{a.rationale}</p></div>
                    <Badge variant="outline" className="text-[10px]">Custom</Badge>
                  </div>
                ))}
                {strategy.lookalikes.map((a, i) => (
                  <div key={i} className="rounded border border-border p-2 flex items-center justify-between">
                    <div className="text-xs"><p className="font-medium">{a.name} ({(a.ratio * 100).toFixed(0)}%)</p><p className="text-muted-foreground">{a.rationale}</p></div>
                    <Badge variant="outline" className="text-[10px] text-gold">Lookalike</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Best audience insight */}
      {bestAudience && (
        <Card className="border-gold/20 bg-gold/5">
          <CardContent className="flex items-center gap-3 p-4">
            <TrendingUp className="h-5 w-5 text-gold" />
            <p className="text-sm">
              <span className="font-medium text-gold">Mejor audiencia:</span>{" "}
              {bestAudience.adSetName} en{" "}
              <span className="font-medium">{bestAudience.campaignName}</span>{" "}
              con CPL de{" "}
              <span className="font-semibold text-emerald-400">
                ${bestAudience.cpl.toFixed(2)}
              </span>
              . Considera escalar esta audiencia.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Audiences table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      ) : audiences.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center space-y-2">
              <Users className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">
                Conecta Meta Ads para ver el análisis de audiencias.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-elevated/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                  Audiencia
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                  Campaña
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                  Gasto
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                  Leads
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                  CPL
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                  Edad
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                  Género
                </th>
              </tr>
            </thead>
            <tbody>
              {audiences
                .sort((a, b) => (a.cpl || 9999) - (b.cpl || 9999))
                .map((a) => (
                  <tr
                    key={a.adSetId}
                    className="border-b border-border/50 hover:bg-surface-elevated/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">{a.adSetName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.campaignName}
                    </td>
                    <td className="px-4 py-3 text-right">
                      ${a.spend.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-right">{a.leads}</td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-mono font-semibold",
                        a.cpl > 0 && a.cpl < 20
                          ? "text-emerald-400"
                          : a.cpl <= 30
                            ? "text-amber-400"
                            : a.cpl > 30
                              ? "text-red-400"
                              : "text-muted-foreground"
                      )}
                    >
                      {a.cpl > 0 ? `$${a.cpl.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {a.targeting.ageMin && a.targeting.ageMax
                        ? `${a.targeting.ageMin}–${a.targeting.ageMax}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {genderLabel(a.targeting.genders)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
