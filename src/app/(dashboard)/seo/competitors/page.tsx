"use client";

import { useState } from "react";
import { useCompetitors } from "@/hooks/use-competitors";
import { CompetitorTable } from "@/components/dashboard/competitor-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Search, Loader2, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CompetitorsPage() {
  const {
    competitors,
    analysis,
    loading,
    analyzing,
    addCompetitor,
    removeCompetitor,
    analyzeCompetitors,
  } = useCompetitors();

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [city, setCity] = useState("Dallas");

  const handleAdd = async () => {
    await addCompetitor(name, domain, city);
    setAddOpen(false);
    setName("");
    setDomain("");
  };

  const ownData = analysis?.own?.overview as Record<string, number> | null;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Competitor Watch
          </h1>
          <p className="text-muted-foreground">
            Monitoreo SEO de la competencia en inmigración.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={analyzeCompetitors}
            disabled={analyzing || !competitors.length}
          >
            {analyzing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="mr-1.5 h-3.5 w-3.5" />
            )}
            {analyzing ? "Analizando..." : "Analizar ahora"}
          </Button>
          <Button
            size="sm"
            className="bg-gold text-background hover:bg-gold-light"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Agregar
          </Button>
        </div>
      </div>

      {/* Competitor comparison table */}
      {loading ? (
        <Skeleton className="h-48" />
      ) : competitors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Search className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">
              No hay competidores configurados.
            </p>
            <Button
              className="bg-gold text-background hover:bg-gold-light"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Agregar competidor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <CompetitorTable
          manuelsolis={{
            name: "Manuel Solís Law Office",
            domain: "manuelsolis.com",
            organicKeywords: (ownData?.organicKeywords as number) || 0,
            traffic: (ownData?.organicTraffic as number) || 0,
          }}
          competitors={competitors.map((c) => {
            const latestAnalysis = c.analyses[0]?.data as Record<string, Record<string, number>> | undefined;
            const overview = latestAnalysis?.overview;
            return {
              id: c.id,
              name: c.name,
              domain: c.domain,
              organicKeywords: overview?.organicKeywords || 0,
              traffic: overview?.organicTraffic || 0,
            };
          })}
          onRemove={removeCompetitor}
          loading={loading}
        />
      )}

      {/* Keyword Gaps */}
      {analysis && analysis.keywordGaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Keyword Gaps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Keyword
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Volumen
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Dificultad
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Competidor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.keywordGaps.slice(0, 15).map((gap) => (
                    <tr
                      key={gap.keyword}
                      className="border-b border-border/50"
                    >
                      <td className="px-3 py-2 font-medium">{gap.keyword}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {gap.volume.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            gap.difficulty < 30
                              ? "border-emerald-500/30 text-emerald-400"
                              : gap.difficulty < 60
                                ? "border-amber-500/30 text-amber-400"
                                : "border-red-500/30 text-red-400"
                          )}
                        >
                          {gap.difficulty}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                        {Object.entries(gap.competitorPositions)
                          .map(([d, p]) => `${d.split(".")[0]} #${p}`)
                          .join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Insights */}
      {analysis?.aiInsights && (
        <Card className="border-gold/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4 text-gold" />
              Análisis AI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-sm">
              {analysis.aiInsights}
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground">
              Analizado: {new Date(analysis.analyzedAt).toLocaleString("es-MX")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Add competitor dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Competidor</DialogTitle>
            <DialogDescription>
              Agrega un bufete de inmigración competidor para monitorear su SEO.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: García Immigration Law"
              />
            </div>
            <div className="space-y-2">
              <Label>Dominio</Label>
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="Ej: garciaimmigration.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Dallas"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-gold text-background hover:bg-gold-light"
              onClick={handleAdd}
              disabled={!name || !domain}
            >
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
