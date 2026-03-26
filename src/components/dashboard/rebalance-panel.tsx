"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Play, Eye, CheckCircle, AlertTriangle } from "lucide-react";
import type { RebalanceResult } from "@/lib/ads/rebalancer";

interface RebalancePanelProps {
  lastRebalance: RebalanceResult | null;
  onPreview: () => Promise<RebalanceResult>;
  onExecute: () => Promise<RebalanceResult>;
  isLoading: boolean;
}

export function RebalancePanel({
  lastRebalance,
  onPreview,
  onExecute,
  isLoading,
}: RebalancePanelProps) {
  const [preview, setPreview] = useState<RebalanceResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const result = await onPreview();
      setPreview(result);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExecute = async () => {
    setConfirmOpen(false);
    await onExecute();
    setPreview(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-gold" />
          <CardTitle className="text-base">Budget Rebalancer AI</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={previewLoading || isLoading}
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Preview
          </Button>
          <Button
            size="sm"
            className="bg-gold text-background hover:bg-gold-light"
            onClick={() => setConfirmOpen(true)}
            disabled={isLoading}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Ejecutar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Last rebalance info */}
        {lastRebalance && !preview && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              Último rebalanceo:{" "}
              {new Date(lastRebalance.executedAt).toLocaleString("es-MX")}
            </div>
            <p className="text-sm">{lastRebalance.summary}</p>
            <div className="flex gap-4 text-sm">
              <span>
                Pausadas:{" "}
                <span className="font-semibold text-red-400">
                  {lastRebalance.paused.length}
                </span>
              </span>
              <span>
                Escaladas:{" "}
                <span className="font-semibold text-emerald-400">
                  {lastRebalance.scaled.length}
                </span>
              </span>
              <span>
                Budget liberado:{" "}
                <span className="font-semibold text-gold">
                  ${lastRebalance.totalBudgetFreed.toFixed(0)}/día
                </span>
              </span>
            </div>
          </div>
        )}

        {/* Preview results */}
        {(preview || previewLoading) && (
          <div className="rounded-lg border border-gold/20 bg-gold/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gold">
              <Eye className="h-4 w-4" />
              Preview del rebalanceo
            </div>
            {previewLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : preview ? (
              <div className="space-y-2 text-sm">
                {preview.paused.length > 0 && (
                  <div>
                    <span className="font-medium text-red-400">
                      Se pausarían {preview.paused.length} campañas:
                    </span>
                    <ul className="ml-4 mt-1 list-disc text-muted-foreground">
                      {preview.paused.map((c) => (
                        <li key={c.campaignId}>
                          {c.name} — CPL ${c.cpl.toFixed(2)} (libera $
                          {c.budgetFreed.toFixed(0)}/día)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {preview.scaled.length > 0 && (
                  <div>
                    <span className="font-medium text-emerald-400">
                      Se escalarían {preview.scaled.length} campañas:
                    </span>
                    <ul className="ml-4 mt-1 list-disc text-muted-foreground">
                      {preview.scaled.map((c) => (
                        <li key={c.campaignId}>
                          {c.name} — CPL ${c.cpl.toFixed(2)} ($
                          {c.previousBudget.toFixed(0)} → $
                          {c.newBudget.toFixed(0)}/día)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {preview.paused.length === 0 &&
                  preview.scaled.length === 0 && (
                    <p className="text-muted-foreground">
                      No hay cambios necesarios. Todas las campañas están
                      dentro de los rangos óptimos.
                    </p>
                  )}
                <div className="flex gap-4 pt-2">
                  <Badge variant="outline" className="border-gold/30 text-gold">
                    Budget liberado: ${preview.totalBudgetFreed.toFixed(0)}/día
                  </Badge>
                  <Badge variant="outline" className="border-gold/30 text-gold">
                    Redistribuido: ${preview.totalBudgetRedistributed.toFixed(0)}/día
                  </Badge>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {!lastRebalance && !preview && !previewLoading && (
          <p className="text-sm text-muted-foreground">
            El rebalancer analiza tus campañas y redistribuye el presupuesto
            automáticamente. Usa &quot;Preview&quot; para ver qué cambios haría
            antes de ejecutar.
          </p>
        )}
      </CardContent>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Confirmar Rebalanceo
            </DialogTitle>
            <DialogDescription>
              Esta acción pausará campañas con CPL alto y redistribuirá su
              presupuesto a campañas de mejor rendimiento. Los cambios se
              aplicarán directamente en Meta Ads.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-gold text-background hover:bg-gold-light"
              onClick={handleExecute}
              disabled={isLoading}
            >
              Ejecutar Rebalanceo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
