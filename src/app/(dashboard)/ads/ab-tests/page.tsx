"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FlaskConical, CheckCircle, Trophy, XCircle, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface ABTest {
  id: string;
  name: string;
  variants: Array<{ name: string; mediaUrl: string; copy: string }>;
  dailyBudget: number;
  testDuration: number;
  status: string;
  winnerId: string | null;
  results: { winner?: { name: string; cpl: number; ctr: number; leads: number }; losers?: Array<{ name: string; cpl: number; ctr: number; leads: number }>; recommendation?: string; confidence?: string } | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pendiente", color: "text-yellow-400" },
  APPROVED: { label: "Aprobado", color: "text-blue-400" },
  RUNNING: { label: "Corriendo", color: "text-emerald-400" },
  ANALYZING: { label: "Analizando", color: "text-purple-400" },
  COMPLETED: { label: "Completado", color: "text-gold" },
  CANCELLED: { label: "Cancelado", color: "text-muted-foreground" },
};

export default function ABTestsPage() {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([""]);
  const [copies, setCopies] = useState<string[]>([]);
  const [budgetPerVariant, setBudgetPerVariant] = useState(10);
  const [testDuration, setTestDuration] = useState(48);

  const fetchTests = useCallback(async () => {
    try {
      const res = await fetch("/api/ads/ab-test");
      const json = await res.json();
      if (json.success) setTests(json.data.tests);
    } catch { /* retry */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTests(); }, [fetchTests]);

  const handleCreate = async () => {
    if (!name.trim() || !mediaUrls.filter(u => u.trim()).length) return;
    setCreating(true);
    try {
      const res = await fetch("/api/ads/ab-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          campaignName: name,
          mediaUrls: mediaUrls.filter(u => u.trim()),
          copies: copies.filter(c => c.trim()).length ? copies.filter(c => c.trim()) : undefined,
          dailyBudgetPerVariant: budgetPerVariant,
          testDuration,
        }),
      });
      const json = await res.json();
      if (json.success) { toast.success("A/B Test creado"); setShowForm(false); fetchTests(); }
      else toast.error(json.error);
    } catch { toast.error("Error de red"); }
    finally { setCreating(false); }
  };

  const handleApprove = async (testId: string) => {
    setApproving(testId);
    try {
      const res = await fetch("/api/ads/ab-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", testId }),
      });
      const json = await res.json();
      if (json.success) { toast.success("Test aprobado y ejecut\u00e1ndose"); fetchTests(); }
      else toast.error(json.error);
    } catch { toast.error("Error"); }
    finally { setApproving(null); }
  };

  const pending = tests.filter(t => t.status === "PENDING");
  const running = tests.filter(t => t.status === "RUNNING" || t.status === "ANALYZING");
  const completed = tests.filter(t => t.status === "COMPLETED");

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;

  return (
    <div className="animate-fade-in space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-gold" /> A/B Tests
          </h1>
          <p className="text-muted-foreground">Prueba variantes de creativos para encontrar el ganador.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-gold text-background hover:bg-gold/90">
          <Plus className="mr-1.5 h-4 w-4" /> Nuevo test
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Crear A/B Test</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Test creativos TPS Marzo" />
            </div>
            <div className="space-y-2">
              <Label>URLs de creativos (im\u00e1genes)</Label>
              {mediaUrls.map((url, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={url} onChange={e => { const u = [...mediaUrls]; u[i] = e.target.value; setMediaUrls(u); }} placeholder="https://..." className="flex-1" />
                  {mediaUrls.length > 1 && <Button variant="ghost" size="icon" onClick={() => setMediaUrls(mediaUrls.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setMediaUrls([...mediaUrls, ""])}>+ Agregar</Button>
            </div>
            <div className="space-y-2">
              <Label>Copies (opcional — AI genera si se deja vac\u00edo)</Label>
              <Textarea value={copies.join("\n---\n")} onChange={e => setCopies(e.target.value.split("\n---\n"))} placeholder="Copy 1\n---\nCopy 2\n---\nCopy 3" rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Budget/variante ($)</Label>
                <Input type="number" value={budgetPerVariant} onChange={e => setBudgetPerVariant(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Duraci\u00f3n (horas)</Label>
                <Input type="number" value={testDuration} onChange={e => setTestDuration(Number(e.target.value))} />
              </div>
            </div>
            <Button className="w-full bg-gold text-background hover:bg-gold/90" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
              Crear test
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Pendientes de aprobaci\u00f3n</h2>
          <div className="space-y-3">
            {pending.map(t => (
              <Card key={t.id} className="border-yellow-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{t.name}</p>
                    <Badge variant="outline" className="text-[10px] text-yellow-400">Pendiente</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{t.variants.length} variantes, ${Number(t.dailyBudget)}/d\u00eda, {t.testDuration}h</p>
                  <div className="grid gap-2 sm:grid-cols-3 mb-3">
                    {t.variants.map((v, i) => (
                      <div key={i} className="rounded border border-border p-2 text-xs">
                        <p className="font-medium">{v.name}</p>
                        <p className="text-muted-foreground mt-1 line-clamp-2">{v.copy}</p>
                      </div>
                    ))}
                  </div>
                  <Button className="w-full bg-gold text-background hover:bg-gold/90" size="sm" onClick={() => handleApprove(t.id)} disabled={approving === t.id}>
                    {approving === t.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="mr-1.5 h-3.5 w-3.5" />}
                    Aprobar y ejecutar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Running */}
      {running.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Tests en curso</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {running.map(t => (
              <Card key={t.id} className="border-emerald-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-sm">{t.name}</p>
                    <Badge variant="outline" className="text-[10px] text-emerald-400">Corriendo</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.variants.length} variantes, ${Number(t.dailyBudget)}/d\u00eda</p>
                  {t.startedAt && <p className="text-[10px] text-muted-foreground mt-1">Iniciado: {new Date(t.startedAt).toLocaleString("es")}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Tests completados</h2>
          <div className="space-y-3">
            {completed.map(t => (
              <Card key={t.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium">{t.name}</p>
                    <Badge variant="outline" className="text-[10px] text-gold">Completado</Badge>
                  </div>
                  {t.results?.winner && (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Trophy className="h-4 w-4 text-emerald-400" />
                        <p className="text-sm font-semibold text-emerald-400">Ganador: {t.results.winner.name}</p>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>CPL: ${t.results.winner.cpl.toFixed(2)}</span>
                        <span>CTR: {t.results.winner.ctr.toFixed(2)}%</span>
                        <span>Leads: {t.results.winner.leads}</span>
                      </div>
                    </div>
                  )}
                  {t.results?.recommendation && (
                    <p className="text-xs text-muted-foreground">{t.results.recommendation}</p>
                  )}
                  {t.results?.losers && t.results.losers.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {t.results.losers.map((l, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <XCircle className="h-3 w-3 text-red-400" />
                          <span>{l.name}: CPL ${l.cpl.toFixed(2)}, CTR {l.ctr.toFixed(2)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tests.length === 0 && !showForm && (
        <Card><CardContent className="py-8 text-center">
          <FlaskConical className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No hay A/B tests a\u00fan. Crea uno para optimizar tus creativos.</p>
        </CardContent></Card>
      )}
    </div>
  );
}
