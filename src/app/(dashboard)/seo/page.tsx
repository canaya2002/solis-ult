"use client";
import { useRouter } from "next/navigation";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Loader2, Copy, Wand2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

export default function SEOPage() {
  const router = useRouter();
  const { brief, loading, generating, generateBrief } = useSEO();
  const ops = (brief?.opportunities || []) as Array<{ keyword: string; currentPosition?: number; volume: number; difficulty: string; action: string }>;
  const wins = (brief?.quickWins || []) as Array<{ page: string; currentTitle: string; suggestedTitle: string; reason: string }>;
  const suggestions = (brief?.contentSuggestions || []) as Array<{ topic: string; targetKeyword: string; estimatedVolume: number; difficulty: string }>;
  const issues = (brief?.technicalIssues || []) as Array<{ issue: string; severity: string; fix: string }>;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SEO Advisor</h1>
          <p className="text-muted-foreground">Recomendaciones SEO semanales basadas en datos reales.</p>
        </div>
        <div className="flex items-center gap-2">
          {brief && <Badge variant="outline" className="text-xs">{new Date(brief.weekOf).toLocaleDateString("es-MX")}</Badge>}
          <Button variant="outline" size="sm" onClick={generateBrief} disabled={generating}>
            {generating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}
            {generating ? "Generando..." : "Generar brief"}
          </Button>
        </div>
      </div>

      {loading ? <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div> : !brief ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <Search className="h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">Conecta Search Console y Semrush en Settings para obtener recomendaciones basadas en datos reales.</p>
          <Button className="bg-gold text-background hover:bg-gold-light" onClick={generateBrief}>Generar brief ahora</Button>
        </CardContent></Card>
      ) : (
        <>
          {/* Opportunities */}
          {ops.length > 0 && (
            <Card><CardHeader><CardTitle className="text-base">Oportunidades de Keywords</CardTitle></CardHeader>
              <CardContent><div className="overflow-x-auto"><table className="w-full text-sm">
                <thead className="border-b border-border"><tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Keyword</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Posición</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Volumen</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Dificultad</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Acción</th>
                </tr></thead>
                <tbody>{ops.map((o, i) => (
                  <tr key={i} className="border-b border-border/50"><td className="px-3 py-2 font-medium">{o.keyword}</td>
                    <td className="px-3 py-2 text-right font-mono">{o.currentPosition || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{o.volume?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right"><Badge variant="outline" className={cn("text-[10px]", o.difficulty === "easy" ? "text-emerald-400 border-emerald-500/30" : o.difficulty === "hard" ? "text-red-400 border-red-500/30" : "text-amber-400 border-amber-500/30")}>{o.difficulty}</Badge></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{o.action}</td></tr>
                ))}</tbody></table></div></CardContent></Card>
          )}

          {/* Quick Wins */}
          {wins.length > 0 && (
            <div><h2 className="text-lg font-semibold mb-3">Quick Wins</h2>
              <div className="grid gap-3 md:grid-cols-2">{wins.map((w, i) => (
                <Card key={i}><CardContent className="p-4 space-y-2">
                  <p className="text-xs text-muted-foreground truncate">{w.page}</p>
                  <div className="space-y-1"><p className="text-sm line-through text-red-400/70">{w.currentTitle}</p><p className="text-sm text-emerald-400">{w.suggestedTitle}</p></div>
                  <p className="text-xs text-muted-foreground">{w.reason}</p>
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(w.suggestedTitle); toast.success("Título copiado"); }}>
                    <Copy className="mr-1 h-3 w-3" /> Copiar título
                  </Button>
                </CardContent></Card>
              ))}</div></div>
          )}

          {/* Content Suggestions */}
          {suggestions.length > 0 && (
            <div><h2 className="text-lg font-semibold mb-3">Contenido Sugerido</h2>
              <div className="grid gap-3 md:grid-cols-3">{suggestions.map((s, i) => (
                <Card key={i} className="hover:border-gold/30 transition-colors"><CardContent className="p-4 space-y-2">
                  <h3 className="font-medium text-sm">{s.topic}</h3>
                  <p className="text-xs text-muted-foreground">Keyword: {s.targetKeyword} · Vol: {s.estimatedVolume}</p>
                  <Button size="sm" className="bg-gold text-background hover:bg-gold-light w-full" onClick={() => router.push(`/content/create?topic=${encodeURIComponent(s.topic)}`)}>
                    <Wand2 className="mr-1.5 h-3 w-3" /> Generar copy
                  </Button>
                </CardContent></Card>
              ))}</div></div>
          )}

          {/* Technical Issues */}
          {issues.length > 0 && (
            <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" /> Problemas Técnicos</CardTitle></CardHeader>
              <CardContent><div className="space-y-2">{issues.map((t, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <Badge variant="outline" className={cn("text-[10px] shrink-0", t.severity === "high" ? "text-red-400 border-red-500/30" : t.severity === "medium" ? "text-amber-400 border-amber-500/30" : "text-muted-foreground")}>{t.severity}</Badge>
                  <div><p className="text-sm font-medium">{t.issue}</p><p className="text-xs text-muted-foreground">{t.fix}</p></div>
                </div>
              ))}</div></CardContent></Card>
          )}
        </>
      )}
    </div>
  );
}
