"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Pause, Play, DollarSign, Bot, ArrowUpDown } from "lucide-react";

export interface CampaignRow {
  id: string;
  metaCampaignId: string;
  name: string;
  status: string;
  dailyBudget: number;
  spent: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number | null;
  ctr: number;
  lastRebalancedAt: string | null;
}

interface CampaignTableProps {
  campaigns: CampaignRow[];
  onPause: (metaCampaignId: string) => Promise<void>;
  onActivate: (metaCampaignId: string) => Promise<void>;
  onUpdateBudget: (metaCampaignId: string, amount: number) => Promise<void>;
  loading?: boolean;
}

type SortKey = "name" | "spent" | "leads" | "cpl" | "ctr" | "dailyBudget";
type SortDir = "asc" | "desc";

function statusBadge(status: string) {
  switch (status) {
    case "ACTIVE":
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Activa</Badge>;
    case "PAUSED":
      return <Badge variant="secondary">Pausada</Badge>;
    case "PAUSED_BY_AI":
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
          <Bot className="mr-1 h-3 w-3" /> Pausada AI
        </Badge>
      );
    case "COMPLETED":
      return <Badge variant="outline">Completada</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function cplColor(cpl: number | null) {
  if (cpl === null) return "text-muted-foreground";
  if (cpl < 20) return "text-emerald-400";
  if (cpl <= 30) return "text-amber-400";
  return "text-red-400";
}

export function CampaignTable({
  campaigns,
  onPause,
  onActivate,
  onUpdateBudget,
  loading,
}: CampaignTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("cpl");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignRow | null>(null);
  const [newBudgetValue, setNewBudgetValue] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = [...campaigns].sort((a, b) => {
    const av = a[sortKey] ?? 9999;
    const bv = b[sortKey] ?? 9999;
    const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const handleAction = async (
    id: string,
    fn: (id: string) => Promise<void>
  ) => {
    setActionLoading(id);
    try {
      await fn(id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBudgetSubmit = async () => {
    if (!selectedCampaign || !newBudgetValue) return;
    setActionLoading(selectedCampaign.metaCampaignId);
    try {
      await onUpdateBudget(
        selectedCampaign.metaCampaignId,
        parseFloat(newBudgetValue)
      );
    } finally {
      setActionLoading(null);
      setBudgetDialogOpen(false);
      setNewBudgetValue("");
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (!campaigns.length) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-16">
        <p className="text-muted-foreground">
          Conecta tu cuenta de Meta Ads en{" "}
          <a href="/settings" className="text-gold hover:underline">
            Configuración
          </a>{" "}
          para ver tus campañas.
        </p>
      </div>
    );
  }

  const SortHeader = ({
    label,
    sortField,
  }: {
    label: string;
    sortField: SortKey;
  }) => (
    <button
      className="flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground hover:text-foreground"
      onClick={() => handleSort(sortField)}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-elevated/50">
            <tr>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Nombre" sortField="name" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-right">
                <SortHeader label="Budget/día" sortField="dailyBudget" />
              </th>
              <th className="px-4 py-3 text-right">
                <SortHeader label="Gasto" sortField="spent" />
              </th>
              <th className="px-4 py-3 text-right">
                <SortHeader label="Leads" sortField="leads" />
              </th>
              <th className="px-4 py-3 text-right">
                <SortHeader label="CPL" sortField="cpl" />
              </th>
              <th className="px-4 py-3 text-right">
                <SortHeader label="CTR" sortField="ctr" />
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr
                key={c.metaCampaignId}
                className="border-b border-border/50 hover:bg-surface-elevated/30 transition-colors"
              >
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">{statusBadge(c.status)}</td>
                <td className="px-4 py-3 text-right">
                  ${c.dailyBudget.toFixed(0)}
                </td>
                <td className="px-4 py-3 text-right">
                  ${c.spent.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">{c.leads}</td>
                <td
                  className={cn(
                    "px-4 py-3 text-right font-mono font-semibold",
                    cplColor(c.cpl)
                  )}
                >
                  {c.cpl !== null ? `$${c.cpl.toFixed(2)}` : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {c.ctr.toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {c.status === "ACTIVE" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={actionLoading === c.metaCampaignId}
                        onClick={() =>
                          handleAction(c.metaCampaignId, onPause)
                        }
                        title="Pausar"
                      >
                        <Pause className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={actionLoading === c.metaCampaignId}
                        onClick={() =>
                          handleAction(c.metaCampaignId, onActivate)
                        }
                        title="Activar"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setSelectedCampaign(c);
                        setNewBudgetValue(c.dailyBudget.toString());
                        setBudgetDialogOpen(true);
                      }}
                      title="Editar budget"
                    >
                      <DollarSign className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Budget Diario</DialogTitle>
            <DialogDescription>
              {selectedCampaign?.name} — Budget actual: $
              {selectedCampaign?.dailyBudget.toFixed(0)}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">$</span>
              <Input
                type="number"
                value={newBudgetValue}
                onChange={(e) => setNewBudgetValue(e.target.value)}
                placeholder="Nuevo budget diario"
                min="1"
                step="1"
              />
              <span className="text-muted-foreground">/día</span>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBudgetDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-gold text-background hover:bg-gold-light"
              onClick={handleBudgetSubmit}
              disabled={
                !newBudgetValue ||
                actionLoading === selectedCampaign?.metaCampaignId
              }
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
