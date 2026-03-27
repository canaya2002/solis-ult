"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Zap,
  TrendingUp,
  DollarSign,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BoostContent {
  id: string;
  title: string;
  platform: string;
  mediaUrl: string | null;
  externalId: string | null;
  publishedAt: string | null;
  performance: {
    impressions: number;
    engagement: number;
    clicks: number;
    shares: number;
    comments: number;
  } | null;
}

interface Boost {
  id: string;
  contentId: string;
  platform: string;
  externalPostId: string;
  metaCampaignId: string | null;
  viralityScore: number;
  budget: number;
  duration: number;
  spent: number;
  additionalReach: number;
  additionalLeads: number;
  status: string;
  notificationId: string | null;
  approvedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  content: BoostContent;
}

interface BoostStats {
  activeCount: number;
  monthlySpent: number;
  monthlyLeads: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
};

const PLATFORM_COLORS: Record<string, string> = {
  FACEBOOK: "text-blue-400",
  INSTAGRAM: "text-pink-400",
  TIKTOK: "text-white",
};

function viralityColor(score: number): string {
  if (score >= 3.0) return "text-emerald-400";
  if (score >= 2.0) return "text-green-400";
  if (score >= 1.5) return "text-yellow-400";
  return "text-red-400";
}

function viralityBarColor(score: number): string {
  if (score >= 3.0) return "bg-emerald-400";
  if (score >= 2.0) return "bg-green-400";
  if (score >= 1.5) return "bg-yellow-400";
  return "bg-red-400";
}

function viralityLabel(score: number): string {
  if (score >= 3.0) return "Excepcional";
  if (score >= 2.0) return "Viral";
  if (score >= 1.5) return "Bueno";
  return "Normal";
}

function timeRemaining(expiresAt: string | null): string {
  if (!expiresAt) return "";
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expirada";
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

// ─── Page Component ────────────────────────────────────────────────────────────

export default function BoostsPage() {
  const [boosts, setBoosts] = useState<Boost[]>([]);
  const [stats, setStats] = useState<BoostStats>({ activeCount: 0, monthlySpent: 0, monthlyLeads: 0 });
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [editingBudget, setEditingBudget] = useState<Record<string, { budget: number; duration: number }>>({});

  const fetchBoosts = useCallback(async () => {
    try {
      const res = await fetch("/api/ads/boost");
      const json = await res.json();
      if (json.success) {
        setBoosts(json.data.boosts);
        setStats(json.data.stats);
      }
    } catch { /* retry next time */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchBoosts();
    const interval = setInterval(fetchBoosts, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [fetchBoosts]);

  const handleApprove = async (boostId: string) => {
    setApproving(boostId);
    try {
      const mods = editingBudget[boostId];
      const res = await fetch("/api/ads/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boostId,
          modifications: mods ? { budget: mods.budget, duration: mods.duration } : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Boost activado exitosamente");
        fetchBoosts();
      } else {
        toast.error(json.error || "Error al aprobar");
      }
    } catch { toast.error("Error de red"); }
    finally { setApproving(null); }
  };

  const handleCancel = async (boostId: string) => {
    setCancelling(boostId);
    try {
      const res = await fetch("/api/ads/boost", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boostId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Boost cancelado");
        fetchBoosts();
      } else {
        toast.error(json.error || "Error al cancelar");
      }
    } catch { toast.error("Error de red"); }
    finally { setCancelling(null); }
  };

  const toggleEdit = (boostId: string, budget: number, duration: number) => {
    setEditingBudget(prev => {
      if (prev[boostId]) {
        const next = { ...prev };
        delete next[boostId];
        return next;
      }
      return { ...prev, [boostId]: { budget, duration } };
    });
  };

  // Categorize boosts
  const pendingBoosts = boosts.filter(b => b.status === "PENDING");
  const activeBoosts = boosts.filter(b => b.status === "ACTIVE");
  const historyBoosts = boosts.filter(b => b.status === "COMPLETED" || b.status === "CANCELLED");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Zap className="h-6 w-6 text-gold" /> Boost Engine
        </h1>
        <p className="text-muted-foreground">
          Detecta posts con alto rendimiento y boost\u00e9alos para maximizar alcance.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Zap className="h-3.5 w-3.5" /> Boosts activos
            </div>
            <p className="text-2xl font-bold">{stats.activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="h-3.5 w-3.5" /> Gastado este mes
            </div>
            <p className="text-2xl font-bold">${stats.monthlySpent.toFixed(0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="h-3.5 w-3.5" /> Leads de boosts
            </div>
            <p className="text-2xl font-bold">{stats.monthlyLeads}</p>
          </CardContent>
        </Card>
      </div>

      {/* Section 1: Pending Proposals */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-gold" />
          Propuestas pendientes
          {pendingBoosts.length > 0 && (
            <Badge className="bg-gold/10 text-gold border-gold/30">{pendingBoosts.length}</Badge>
          )}
        </h2>

        {pendingBoosts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No hay propuestas de boost pendientes. El monitor revisa tus posts cada hora.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingBoosts.map(boost => {
              const editing = editingBudget[boost.id];
              return (
                <Card key={boost.id} className="border-gold/20">
                  <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                      {/* Post Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className={cn("text-[10px]", PLATFORM_COLORS[boost.platform])}>
                            {PLATFORM_LABELS[boost.platform] || boost.platform}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Publicado {boost.content.publishedAt ? timeAgo(boost.content.publishedAt) : ""}
                          </span>
                        </div>

                        <p className="text-sm font-medium mb-2">
                          {boost.content.title || `Post ${boost.externalPostId.substring(0, 15)}...`}
                        </p>

                        {/* Virality Score Bar */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] text-muted-foreground">Virality Score</span>
                            <span className={cn("text-sm font-bold", viralityColor(Number(boost.viralityScore)))}>
                              {Number(boost.viralityScore).toFixed(1)}x — {viralityLabel(Number(boost.viralityScore))}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all", viralityBarColor(Number(boost.viralityScore)))}
                              style={{ width: `${Math.min(100, (Number(boost.viralityScore) / 5) * 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Current Metrics */}
                        {boost.content.performance && (
                          <div className="flex gap-3 text-xs text-muted-foreground mb-3">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" /> {boost.content.performance.impressions.toLocaleString()} imp
                            </span>
                            <span>{boost.content.performance.engagement} likes</span>
                            <span>{boost.content.performance.comments} comentarios</span>
                            <span>{boost.content.performance.shares} compartidos</span>
                          </div>
                        )}

                        {/* Estimates */}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded border border-border p-2">
                            <p className="text-muted-foreground">Budget</p>
                            <p className="font-semibold">${Number(boost.budget)}/d\u00eda \u00d7 {boost.duration}d</p>
                          </div>
                          <div className="rounded border border-border p-2">
                            <p className="text-muted-foreground">Total</p>
                            <p className="font-semibold">${Number(boost.budget) * boost.duration}</p>
                          </div>
                          <div className="rounded border border-border p-2">
                            <p className="text-muted-foreground">Alcance est.</p>
                            <p className="font-semibold">+{boost.additionalReach.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 lg:w-48 shrink-0">
                        {/* Timer */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Expira en {timeRemaining(boost.createdAt)}</span>
                        </div>

                        {/* Edit mode */}
                        {editing ? (
                          <div className="space-y-2">
                            <div>
                              <Label className="text-[10px]">Budget/d\u00eda ($)</Label>
                              <Input
                                type="number"
                                value={editing.budget}
                                onChange={e => setEditingBudget(prev => ({
                                  ...prev,
                                  [boost.id]: { ...prev[boost.id], budget: Number(e.target.value) },
                                }))}
                                className="h-7 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px]">D\u00edas</Label>
                              <Input
                                type="number"
                                value={editing.duration}
                                onChange={e => setEditingBudget(prev => ({
                                  ...prev,
                                  [boost.id]: { ...prev[boost.id], duration: Number(e.target.value) },
                                }))}
                                className="h-7 text-xs"
                              />
                            </div>
                          </div>
                        ) : null}

                        <Button
                          className="bg-gold text-background hover:bg-gold/90 w-full"
                          size="sm"
                          onClick={() => handleApprove(boost.id)}
                          disabled={approving === boost.id}
                        >
                          {approving === boost.id ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Aprobar ${editing?.budget || Number(boost.budget)}/d\u00eda
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => toggleEdit(boost.id, Number(boost.budget), boost.duration)}
                        >
                          {editing ? "Cancelar edici\u00f3n" : "Modificar"}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs text-muted-foreground"
                          onClick={() => handleCancel(boost.id)}
                          disabled={cancelling === boost.id}
                        >
                          Rechazar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Active Boosts */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Zap className="h-5 w-5 text-emerald-400" />
          Boosts activos
          {activeBoosts.length > 0 && (
            <Badge className="bg-emerald-400/10 text-emerald-400 border-emerald-400/30">{activeBoosts.length}</Badge>
          )}
        </h2>

        {activeBoosts.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-sm text-muted-foreground">No hay boosts activos</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {activeBoosts.map(boost => {
              const totalBudget = Number(boost.budget) * boost.duration;
              const spentPercent = totalBudget > 0 ? Math.min(100, (Number(boost.spent) / totalBudget) * 100) : 0;

              return (
                <Card key={boost.id} className="border-emerald-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-[10px]", PLATFORM_COLORS[boost.platform])}>
                          {PLATFORM_LABELS[boost.platform]}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                          Activo
                        </Badge>
                      </div>
                      <span className={cn("text-xs font-medium", viralityColor(Number(boost.viralityScore)))}>
                        {Number(boost.viralityScore).toFixed(1)}x
                      </span>
                    </div>

                    <p className="text-sm font-medium mb-3">
                      {boost.content.title || `Post ${boost.externalPostId.substring(0, 15)}...`}
                    </p>

                    {/* Budget progress */}
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-muted-foreground">Gastado</span>
                        <span>${Number(boost.spent).toFixed(0)} / ${totalBudget}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 rounded-full transition-all"
                          style={{ width: `${spentPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                      <div>
                        <p className="text-muted-foreground">Alcance</p>
                        <p className="font-medium">+{boost.additionalReach.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Leads</p>
                        <p className="font-medium">+{boost.additionalLeads}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Duraci\u00f3n</p>
                        <p className="font-medium">{boost.duration} d\u00edas</p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => handleCancel(boost.id)}
                      disabled={cancelling === boost.id}
                    >
                      {cancelling === boost.id ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : (
                        <XCircle className="mr-1.5 h-3 w-3" />
                      )}
                      Cancelar boost
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 3: History */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Historial
        </h2>

        {historyBoosts.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-sm text-muted-foreground">No hay boosts completados a\u00fan</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left p-3 font-medium">Post</th>
                      <th className="text-left p-3 font-medium">Plataforma</th>
                      <th className="text-right p-3 font-medium">Viralidad</th>
                      <th className="text-right p-3 font-medium">Gastado</th>
                      <th className="text-right p-3 font-medium">Alcance</th>
                      <th className="text-right p-3 font-medium">Leads</th>
                      <th className="text-right p-3 font-medium">ROI</th>
                      <th className="text-center p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyBoosts.map(boost => {
                      const spent = Number(boost.spent);
                      // Approximate lead value: $500 per legal lead
                      const leadValue = boost.additionalLeads * 500;
                      const roi = spent > 0 ? ((leadValue - spent) / spent * 100).toFixed(0) : "0";

                      return (
                        <tr key={boost.id} className="border-b border-border hover:bg-muted/30">
                          <td className="p-3 max-w-[200px] truncate">
                            {boost.content.title || boost.externalPostId.substring(0, 20)}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className={cn("text-[10px]", PLATFORM_COLORS[boost.platform])}>
                              {PLATFORM_LABELS[boost.platform]}
                            </Badge>
                          </td>
                          <td className={cn("p-3 text-right font-medium", viralityColor(Number(boost.viralityScore)))}>
                            {Number(boost.viralityScore).toFixed(1)}x
                          </td>
                          <td className="p-3 text-right">${spent.toFixed(0)}</td>
                          <td className="p-3 text-right">+{boost.additionalReach.toLocaleString()}</td>
                          <td className="p-3 text-right">+{boost.additionalLeads}</td>
                          <td className={cn("p-3 text-right font-medium", Number(roi) > 0 ? "text-emerald-400" : "text-red-400")}>
                            {roi}%
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className={cn(
                              "text-[10px]",
                              boost.status === "COMPLETED" ? "text-emerald-400 border-emerald-400/30" : "text-muted-foreground"
                            )}>
                              {boost.status === "COMPLETED" ? "Completado" : "Cancelado"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Meta Ads Warning */}
      {boosts.length === 0 && (
        <Card className="border-yellow-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-400">Informaci\u00f3n</p>
              <p className="text-xs text-muted-foreground mt-1">
                El Boost Engine monitorea tus posts publicados cada hora. Cuando detecta un post con rendimiento
                por encima del promedio, te propondr\u00e1 boostearlo aqu\u00ed y por email.
                Necesitas Meta Ads configurado (META_ACCESS_TOKEN y META_AD_ACCOUNT_ID) para poder ejecutar boosts.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
