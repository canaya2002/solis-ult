"use client";
import { useState, useEffect } from "react";
import { ApiConnectionCard } from "@/components/dashboard/api-connection-card";
import { InsightCard } from "@/components/dashboard/insight-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Brain, CheckCircle, XCircle, ExternalLink, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

const APIS = [
  {
    key: "meta", name: "Meta Ads / Graph", description: "Campañas, posts, comentarios, DMs",
    envVars: ["META_ACCESS_TOKEN", "META_APP_ID", "META_APP_SECRET", "META_AD_ACCOUNT_ID", "META_PAGE_ID"],
    link: "https://developers.facebook.com/apps/",
    guide: "Crea una app en Meta Developers, genera un token de larga duración con ads_management y pages_manage_posts.",
  },
  {
    key: "ga4", name: "Google Analytics 4", description: "Tráfico web, conversiones",
    envVars: ["GA4_PROPERTY_ID", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"],
    link: "https://console.cloud.google.com/apis/credentials",
    guide: "Habilita Analytics Data API en GCP, crea OAuth credentials y genera un refresh token con scope analytics.readonly.",
  },
  {
    key: "gsc", name: "Search Console", description: "Keywords, posiciones SEO",
    envVars: ["GOOGLE_SEARCH_CONSOLE_SITE", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"],
    link: "https://search.google.com/search-console",
    guide: "Verifica tu sitio en GSC. Usa las mismas credenciales de Google OAuth con scope webmasters.readonly.",
  },
  {
    key: "gbp", name: "Google Business", description: "Reseñas por oficina",
    envVars: ["GOOGLE_BUSINESS_ACCOUNT_ID", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"],
    link: "https://console.cloud.google.com/apis/library/mybusinessaccountmanagement.googleapis.com",
    guide: "Habilita My Business Account Management API en GCP. Agrega el account ID de tu perfil de negocio.",
  },
  {
    key: "semrush", name: "Semrush", description: "Análisis de competencia",
    envVars: ["SEMRUSH_API_KEY"],
    link: "https://www.semrush.com/accounts/api/",
    guide: "Copia tu API key desde Semrush > My Account > API. Requiere plan con acceso API.",
  },
  {
    key: "tiktok", name: "TikTok", description: "Publicación, métricas",
    envVars: ["TIKTOK_ACCESS_TOKEN", "TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    link: "https://developers.tiktok.com/apps/",
    guide: "Crea una app en TikTok for Developers, solicita scopes user.info.basic y video.list, genera access token.",
  },
  {
    key: "youtube", name: "YouTube", description: "Canal, videos, analytics",
    envVars: ["YOUTUBE_CHANNEL_ID", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"],
    link: "https://console.cloud.google.com/apis/library/youtube.googleapis.com",
    guide: "Habilita YouTube Data API v3 en GCP. El refresh token necesita scope youtube.readonly.",
  },
  {
    key: "twilio", name: "Twilio", description: "SMS y WhatsApp follow-up",
    envVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
    link: "https://console.twilio.com/",
    guide: "Copia Account SID y Auth Token desde el dashboard de Twilio. Configura un número de teléfono.",
  },
  {
    key: "claude", name: "Claude AI", description: "Análisis, reportes, SEO briefs",
    envVars: ["ANTHROPIC_API_KEY"],
    link: "https://console.anthropic.com/settings/keys",
    guide: "Genera una API key en console.anthropic.com. Asegúrate de tener créditos en tu cuenta.",
  },
  {
    key: "openai", name: "OpenAI", description: "Copy generation, transcripción",
    envVars: ["OPENAI_API_KEY"],
    link: "https://platform.openai.com/api-keys",
    guide: "Genera una API key en platform.openai.com. Asegúrate de tener créditos en tu cuenta.",
  },
  {
    key: "resend", name: "Resend", description: "Email alerts y reportes",
    envVars: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
    link: "https://resend.com/api-keys",
    guide: "Genera una API key en resend.com. Verifica tu dominio de envío primero.",
  },
];

interface ApiStatus {
  connected: boolean;
  error?: string;
  latency?: number;
  verified: boolean;
}

interface Insight { category: string; insight: string; data: unknown; appliedTo: string[]; createdAt: string }

export default function SettingsPage() {
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});
  const [verifyingAll, setVerifyingAll] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, ApiStatus>>({});
  const [insights, setInsights] = useState<Insight[]>([]);
  const [learningLoading, setLearningLoading] = useState(false);

  useEffect(() => {
    fetch("/api/analytics/learning").then(r => r.json()).then(json => {
      if (json.success) setInsights(json.data.insights.slice(0, 10));
    }).catch(() => {});
  }, []);

  const verifyApi = async (apiKey: string) => {
    setVerifying(prev => ({ ...prev, [apiKey]: true }));
    try {
      const res = await fetch("/api/settings/verify-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api: apiKey }),
      });
      const json = await res.json();
      if (json.success) {
        setStatuses(prev => ({
          ...prev,
          [apiKey]: {
            connected: json.data.connected,
            error: json.data.error,
            latency: json.data.latency,
            verified: true,
          },
        }));
        return json.data as { connected: boolean; error?: string };
      }
      return { connected: false, error: json.error || "Error desconocido" };
    } catch {
      return { connected: false, error: "Error de red" };
    } finally {
      setVerifying(prev => ({ ...prev, [apiKey]: false }));
    }
  };

  const verifyAll = async () => {
    setVerifyingAll(true);
    // Get unique API keys
    const uniqueKeys = [...new Set(APIS.map(a => a.key))];

    // Run all in parallel
    const results = await Promise.allSettled(
      uniqueKeys.map(async (key) => {
        const result = await verifyApi(key);
        return { key, ...result };
      })
    );

    const passed = results.filter(r => r.status === "fulfilled" && r.value.connected).length;
    const failed = uniqueKeys.length - passed;

    if (failed === 0) {
      toast.success(`${passed}/${uniqueKeys.length} APIs conectadas correctamente`);
    } else {
      toast.error(`${passed} conectadas, ${failed} con errores`);
    }
    setVerifyingAll(false);
  };

  const runLearning = async () => {
    setLearningLoading(true);
    try {
      const res = await fetch("/api/analytics/learning", { method: "POST" });
      const json = await res.json();
      if (json.success) toast.success(`${json.data.insights.length} insights generados`);
      else toast.error(json.error);
    } catch { toast.error("Error"); }
    finally { setLearningLoading(false); }
  };

  const connectedCount = Object.values(statuses).filter(s => s.connected).length;
  const verifiedCount = Object.values(statuses).filter(s => s.verified).length;
  const disconnectedApis = APIS.filter(a => {
    const status = statuses[a.key];
    return status?.verified && !status.connected;
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuraci&oacute;n</h1>
        <p className="text-muted-foreground">APIs, equipo y configuraci&oacute;n del dashboard.</p>
      </div>

      {/* API Connections */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">APIs Conectadas</h2>
            {verifiedCount > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {connectedCount}/{verifiedCount} verificadas correctamente
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={verifyAll}
            disabled={verifyingAll}
          >
            {verifyingAll ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            )}
            Verificar TODAS
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {APIS.map(api => (
            <ApiConnectionCard
              key={api.key + api.name}
              name={api.name}
              description={api.description}
              connected={statuses[api.key]?.connected ?? false}
              envVar={api.envVars[0]}
              onVerify={() => verifyApi(api.key)}
              verifying={!!verifying[api.key]}
              error={statuses[api.key]?.error}
              latency={statuses[api.key]?.latency}
              verified={statuses[api.key]?.verified ?? false}
            />
          ))}
        </div>

        {/* Summary after verify all */}
        {verifiedCount > 0 && verifiedCount === new Set(APIS.map(a => a.key)).size && (
          <Card className="mt-3">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                {connectedCount === verifiedCount ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                    <p className="text-sm text-emerald-400 font-medium">Todas las APIs est&aacute;n conectadas y funcionando.</p>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-400" />
                    <p className="text-sm">
                      <span className="text-emerald-400 font-medium">{connectedCount} conectadas</span>
                      {" / "}
                      <span className="text-red-400 font-medium">{verifiedCount - connectedCount} con errores</span>
                      {" — revisa la gu\u00eda abajo."}
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Configuration Guide — only shows for disconnected APIs */}
      {disconnectedApis.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Gu&iacute;a de Configuraci&oacute;n</h2>
          <div className="space-y-3">
            {disconnectedApis.map(api => (
              <Card key={api.key + "-guide"} className="border-red-500/10">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                        <p className="text-sm font-medium">{api.name}</p>
                      </div>

                      {/* Error message */}
                      {statuses[api.key]?.error && (
                        <p className="text-xs text-red-400 ml-6">
                          {statuses[api.key].error}
                        </p>
                      )}

                      {/* Required env vars */}
                      <div className="ml-6">
                        <p className="text-[11px] text-muted-foreground mb-1">Variables requeridas:</p>
                        <div className="flex flex-wrap gap-1">
                          {api.envVars.map(v => (
                            <code key={v} className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{v}</code>
                          ))}
                        </div>
                      </div>

                      {/* 1-line instruction */}
                      <p className="text-xs text-muted-foreground ml-6">{api.guide}</p>
                    </div>

                    {/* Link to get keys */}
                    <a
                      href={api.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                    >
                      <Button variant="outline" size="sm" className="text-xs gap-1.5">
                        <ExternalLink className="h-3 w-3" />
                        Obtener keys
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* AI Learning */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-gold" /> AI Learning
          </h2>
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
        <CardContent><p className="text-sm text-muted-foreground">Gesti&oacute;n de usuarios disponible pr&oacute;ximamente. Por ahora, gestiona usuarios directamente en Supabase Auth.</p></CardContent></Card>

      {/* Offices */}
      <Card><CardHeader><CardTitle className="text-base">Oficinas</CardTitle></CardHeader>
        <CardContent><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {["Dallas, TX", "Chicago, IL", "Los \u00c1ngeles, CA", "Memphis, TN"].map(office => (
            <div key={office} className="rounded-lg border border-border p-3"><p className="text-sm font-medium">{office}</p><p className="text-xs text-muted-foreground">Google Business configurado en .env</p></div>
          ))}</div></CardContent></Card>
    </div>
  );
}
