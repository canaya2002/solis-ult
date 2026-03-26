"use client";

import { useRouter } from "next/navigation";
import { useTrends } from "@/hooks/use-trends";
import { TrendCard } from "@/components/dashboard/trend-card";
import { IdeaCard } from "@/components/dashboard/idea-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Lightbulb } from "lucide-react";

export default function ContentPage() {
  const router = useRouter();
  const {
    ideas,
    rawTrends,
    generatedAt,
    loading,
    refreshing,
    refreshTrends,
  } = useTrends();

  const handleUseIdea = (idea: (typeof ideas)[0]) => {
    router.push(
      `/content/create?topic=${encodeURIComponent(idea.topic)}&angle=${encodeURIComponent(idea.angle)}&platform=${idea.platform}`
    );
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Content Intelligence
          </h1>
          <p className="text-muted-foreground">
            Tendencias de inmigración y sugerencias de contenido generadas por
            AI.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {generatedAt && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Actualizado:{" "}
              {new Date(generatedAt).toLocaleString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refreshTrends}
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>
      </div>

      {/* Trending Topics */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Trending en Inmigración</h2>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : rawTrends ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rawTrends.trendingKeywords.slice(0, 4).map((keyword, i) => (
              <TrendCard
                key={keyword}
                keyword={keyword}
                volume={Math.max(20, 100 - i * 20)}
                change={i < 2 ? "rising" : "stable"}
                relatedQueries={rawTrends.risingQueries
                  .slice(i * 2, i * 2 + 3)
                  .map((q) => q.query)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">
                Haz click en &quot;Actualizar&quot; para detectar tendencias.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Ideas del día */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-gold" />
            Ideas de Contenido del Día
          </h2>
        </div>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-52" />
            ))}
          </div>
        ) : ideas.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ideas.map((idea, i) => (
              <IdeaCard
                key={`${idea.topic}-${i}`}
                idea={idea}
                onUse={() => handleUseIdea(idea)}
                onDismiss={() => {}}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
              <Lightbulb className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">
                No hay ideas generadas aún.
              </p>
              <Button
                className="bg-gold text-background hover:bg-gold-light"
                onClick={refreshTrends}
                disabled={refreshing}
              >
                Generar ideas ahora
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Rising queries */}
      {rawTrends && rawTrends.risingQueries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Queries en Aumento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {rawTrends.risingQueries.map((q) => (
                <Badge
                  key={q.query}
                  variant="outline"
                  className="border-red-500/30 text-red-400"
                >
                  {q.query}{" "}
                  <span className="ml-1 text-[10px]">↑{q.value}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
