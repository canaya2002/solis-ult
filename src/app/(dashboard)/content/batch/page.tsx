"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, CheckCircle, Calendar, Image, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: "Facebook", INSTAGRAM: "Instagram", TIKTOK: "TikTok", YOUTUBE: "YouTube", BLOG: "Blog",
};

interface BatchItem {
  mediaUrl: string;
  suggestedPlatform: string;
  suggestedCopy: string;
  suggestedHashtags: string[];
  suggestedSchedule: string;
  rationale: string;
}

interface Batch {
  id: string;
  items: BatchItem[];
  status: string;
  createdAt: string;
}

export default function ContentBatchPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<string[]>([""]);
  const [currentBatch, setCurrentBatch] = useState<Batch | null>(null);
  const [editedItems, setEditedItems] = useState<Map<number, Partial<BatchItem>>>(new Map());

  const fetchBatches = useCallback(async () => {
    try {
      const res = await fetch("/api/content/batch");
      const json = await res.json();
      if (json.success) setBatches(json.data.batches);
    } catch { /* retry */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const handleProcess = async () => {
    const urls = mediaUrls.filter(u => u.trim());
    if (!urls.length) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/content/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process", mediaUrls: urls }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`${json.data.items.length} posts generados`);
        setCurrentBatch({ id: json.data.id, items: json.data.items, status: json.data.status, createdAt: new Date().toISOString() });
        setMediaUrls([""]);
        fetchBatches();
      } else toast.error(json.error);
    } catch { toast.error("Error de red"); }
    finally { setProcessing(false); }
  };

  const handleApproveAll = async () => {
    if (!currentBatch) return;
    setApproving(true);
    try {
      const items = currentBatch.items.map((item, i) => {
        const edits = editedItems.get(i);
        return {
          index: i,
          platform: edits?.suggestedPlatform || item.suggestedPlatform,
          copy: edits?.suggestedCopy || item.suggestedCopy,
          scheduledAt: edits?.suggestedSchedule || item.suggestedSchedule,
        };
      });
      const res = await fetch("/api/content/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", batchId: currentBatch.id, approvedItems: items }),
      });
      const json = await res.json();
      if (json.success) { toast.success(`${json.data.created} posts programados`); setCurrentBatch(null); setEditedItems(new Map()); fetchBatches(); }
      else toast.error(json.error);
    } catch { toast.error("Error"); }
    finally { setApproving(false); }
  };

  const updateItem = (index: number, field: string, value: string) => {
    setEditedItems(prev => {
      const next = new Map(prev);
      const existing = next.get(index) || {};
      next.set(index, { ...existing, [field]: value });
      return next;
    });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;

  return (
    <div className="animate-fade-in space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Upload className="h-6 w-6 text-gold" /> Batch Upload
        </h1>
        <p className="text-muted-foreground">Sube m\u00faltiples creativos y la AI genera copies, plataformas y horarios.</p>
      </div>

      {/* Upload Zone */}
      {!currentBatch && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Image className="h-4 w-4" /> URLs de creativos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {mediaUrls.map((url, i) => (
              <div key={i} className="flex gap-2">
                <Input value={url} onChange={e => { const u = [...mediaUrls]; u[i] = e.target.value; setMediaUrls(u); }} placeholder="https://..." className="flex-1" />
                {mediaUrls.length > 1 && <Button variant="ghost" size="icon" onClick={() => setMediaUrls(mediaUrls.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setMediaUrls([...mediaUrls, ""])}><Plus className="mr-1.5 h-3.5 w-3.5" /> Agregar URL</Button>
            <Button className="w-full bg-gold text-background hover:bg-gold/90" size="lg" onClick={handleProcess} disabled={processing || !mediaUrls.some(u => u.trim())}>
              {processing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando con AI...</> : <><Upload className="mr-2 h-4 w-4" /> Procesar batch</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Preview Generated Content */}
      {currentBatch && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{currentBatch.items.length} posts generados</h2>
            <div className="flex gap-2">
              <Button className="bg-gold text-background hover:bg-gold/90" onClick={handleApproveAll} disabled={approving}>
                {approving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1.5 h-4 w-4" />}
                Aprobar todo
              </Button>
              <Button variant="outline" onClick={() => setCurrentBatch(null)}>Cancelar</Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {currentBatch.items.map((item, i) => {
              const edits = editedItems.get(i);
              const platform = edits?.suggestedPlatform || item.suggestedPlatform;
              const copy = edits?.suggestedCopy || item.suggestedCopy;
              const schedule = edits?.suggestedSchedule || item.suggestedSchedule;

              return (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px]">Post {i + 1}</Badge>
                      <Select value={platform} onValueChange={v => updateItem(i, "suggestedPlatform", v)}>
                        <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{item.rationale}</p>
                    <Textarea value={copy} onChange={e => updateItem(i, "suggestedCopy", e.target.value)} rows={3} className="text-xs resize-none" />
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <Input type="datetime-local" value={new Date(schedule).toISOString().slice(0, 16)} onChange={e => updateItem(i, "suggestedSchedule", new Date(e.target.value).toISOString())} className="h-7 text-xs flex-1" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* History */}
      {batches.length > 0 && !currentBatch && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Batches anteriores</h2>
          <div className="space-y-2">
            {batches.map(b => (
              <Card key={b.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm">{(b.items as BatchItem[]).length} posts</p>
                    <p className="text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleString("es")}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{b.status.replace("_", " ")}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
