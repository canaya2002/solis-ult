"use client";
import { useState, useEffect } from "react";
import { ApiConnectionCard } from "@/components/dashboard/api-connection-card";
import { InsightCard } from "@/components/dashboard/insight-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Brain } from "lucide-react";
import toast from "react-hot-toast";

const APIS = [
  { key: "meta", name: "Meta Ads", description: "Campañas, audiencias, publicación", envVar: "META_ACCESS_TOKEN" },
  { key: "meta", name: "Meta Graph", description: "Posts, comentarios, DMs", envVar: "META_PAGE_ID" },
  { key: "ga4", name: "Google Analytics 4", description: "Tráfico web, conversiones", envVar: "GA4_PROPERTY_ID" },
  { key: "gsc", name: "Search Console", description: "Keywords, posiciones SEO", envVar: "GOOGLE_SEARCH_CONSOLE_SITE" },
  { key: "gbp", name: "Google Business", description: "Reseñas por oficina", envVar: "GOOGLE_BUSINESS_ACCOUNT_ID" },
  { key: "semrush", name: "Semrush", description: "Análisis de competencia", envVar: "SEMRUSH_API_KEY" },
  { key: "tiktok", name: "TikTok", description: "Publicación, métricas", envVar: "TIKTOK_ACCESS_TOKEN" },
  { key: "youtube", name: "YouTube", description: "Canal, videos, analytics", envVar: "YOUTUBE_CHANNEL_ID" },
  { key: "twilio", name: "Twilio", description: "SMS y WhatsApp follow-up", envVar: "TWILIO_ACCOUNT_SID" },
  { key: "claude", name: "Claude AI", description: "Análisis, reportes, SEO briefs", envVar: "ANTHROPIC_API_KEY" },
  { key: "openai", name: "OpenAI", description: "Copy generation, transcripción", envVar: "OPENAI_API_KEY" },
  { key: "resend", name: "Resend", description: "Email alerts y reportes", envVar: "RESEND_API_KEY" },
];

interface Insight { category: string; insight: string; data: unknown; appliedTo: string[]; createdAt: string }

export default function SettingsPage() {
  const [verifying, setVerifying] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, { connected: boolean; error?: string }>>({});
  const [insights, setInsights] = useState<Insight[]>([]);
  const [learningLoading, setLearningLoading] = useState(false);

  useEffect(() => {
    fetch("/api/analytics/learning").then(r => r.json()).then(json => {
      if (json.success) setInsights(json.data.insights.slice(0, 10));
    }).catch(() => {});
  }, []);

  const verifyApi = async (apiKey: string) => {
    setVerifying(apiKey);
    try {
      const res = await fetch("/api/settings/verify-api", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api: apiKey }),
      });
      const json = await res.json();
      if (json.success) {
        setStatuses(prev => ({ ...prev, [apiKey]: { connected: json.data.connected, error: json.data.error } }));
        toast.success(json.data.connected ? `${apiKey} conectada` : `${apiKey}: ${json.data.error}`);
      }
    } catch { toast.error("Error al verificar"); }
    finally { setVerifying(null); }
  };

  const runLearning = async () => {
    setLearningLoading(true);
    try {
      const res = await fetch("/api/analytics/learning", { method: "POST" });
      const json = await res.json();
      if (json.success) { toast.success(`${json.data.insights.length} insights generados`); }
      else toast.error(json.error);
    } catch { toast.error("Error"); }
    finally { setLearningLoading(false); }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">APIs, equipo y configuración del dashboard.</p></div>

      {/* API Connections */}
      <div>
        <h2 className="text-lg font-semibold mb-3">APIs Conectadas</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {APIS.map(api => (
            <ApiConnectionCard key={api.name} name={api.name} description={api.description}
              connected={statuses[api.key]?.connected ?? false} envVar={api.envVar}
              onVerify={() => verifyApi(api.key)} verifying={verifying === api.key}
              error={statuses[api.key]?.error} />
          ))}
        </div>
        <Button variant="outline" className="mt-3" onClick={() => APIS.forEach(a => verifyApi(a.key))}>
          Verificar todas
        </Button>
      </div>

      {/* AI Learning */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Brain className="h-5 w-5 text-gold" /> AI Learning</h2>
          <Button variant="outline" size="sm" onClick={runLearning} disabled={learningLoading}>
            {learningLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Brain className="mr-1.5 h-3.5 w-3.5" />}
            Ejecutar ciclo
          </Button>
        </div>
        {insights.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">{insights.map((i, idx) => (
            <InsightCard key={idx} insight={i.insight} category={i.category} confidence={0.7} actionable={true} />
          ))}</div>
        ) : (
          <Card><CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Ejecuta un ciclo de aprendizaje para generar insights basados en el rendimiento de tu contenido.</p>
          </CardContent></Card>
        )}
      </div>

      {/* Team placeholder */}
      <Card><CardHeader><CardTitle className="text-base">Equipo</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Gestión de usuarios disponible próximamente. Por ahora, gestiona usuarios directamente en Supabase Auth.</p></CardContent></Card>

      {/* Offices */}
      <Card><CardHeader><CardTitle className="text-base">Oficinas</CardTitle></CardHeader>
        <CardContent><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {["Dallas, TX", "Chicago, IL", "Los Ángeles, CA", "Memphis, TN"].map(office => (
            <div key={office} className="rounded-lg border border-border p-3"><p className="text-sm font-medium">{office}</p><p className="text-xs text-muted-foreground">Google Business configurado en .env</p></div>
          ))}</div></CardContent></Card>
    </div>
  );
}
