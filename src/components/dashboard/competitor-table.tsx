"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompetitorRow {
  id?: string;
  name: string;
  domain: string;
  organicKeywords: number;
  traffic: number;
  isOwn?: boolean;
}

interface CompetitorTableProps {
  competitors: CompetitorRow[];
  manuelsolis: CompetitorRow;
  onRemove?: (id: string) => void;
  loading?: boolean;
}

function cell(ours: number, theirs: number) {
  if (ours > theirs) return "text-emerald-400";
  if (ours < theirs) return "text-red-400";
  return "";
}

export function CompetitorTable({
  competitors,
  manuelsolis,
  onRemove,
  loading,
}: CompetitorTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const allRows = [{ ...manuelsolis, isOwn: true }, ...competitors];

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-surface-elevated/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
              Dominio
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
              Keywords Orgánicas
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
              Tráfico Orgánico
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {allRows.map((row) => (
            <tr
              key={row.domain}
              className={cn(
                "border-b border-border/50 transition-colors",
                row.isOwn
                  ? "bg-gold/5 border-l-2 border-l-gold"
                  : "hover:bg-surface-elevated/30"
              )}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={row.isOwn ? "font-semibold text-gold" : "font-medium"}>
                    {row.name}
                  </span>
                  {row.isOwn && (
                    <Badge className="bg-gold/20 text-gold border-gold/30 text-[10px]">
                      Nosotros
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{row.domain}</p>
              </td>
              <td
                className={cn(
                  "px-4 py-3 text-right font-mono",
                  !row.isOwn && cell(manuelsolis.organicKeywords, row.organicKeywords)
                )}
              >
                {row.organicKeywords.toLocaleString()}
              </td>
              <td
                className={cn(
                  "px-4 py-3 text-right font-mono",
                  !row.isOwn && cell(manuelsolis.traffic, row.traffic)
                )}
              >
                {row.traffic.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right">
                {!row.isOwn && row.id && onRemove && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-400"
                    onClick={() => onRemove(row.id!)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
