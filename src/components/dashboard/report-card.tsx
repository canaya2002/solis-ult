"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, CheckCircle, XCircle, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportCardProps {
  report: {
    id: string; periodStart: string; periodEnd: string; content: Record<string, unknown>; highlights: string[]; createdAt: string;
  };
  expanded?: boolean;
  onToggle?: () => void;
}

export function ReportCard({ report, expanded: controlledExpanded, onToggle }: ReportCardProps) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = controlledExpanded ?? localExpanded;
  const toggle = onToggle ?? (() => setLocalExpanded(!localExpanded));
  const c = report.content as Record<string, unknown>;
  const summary = (c.summary as string) || "";
  const wins = (c.wins as string[]) || [];
  const problems = (c.problems as string[]) || [];
  const actions = (c.actions as string[]) || [];

  return (
    <Card className="cursor-pointer" onClick={toggle}>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <CardTitle className="text-sm">
            Semana {new Date(report.periodStart).toLocaleDateString("es-MX", { day: "numeric", month: "short" })} — {new Date(report.periodEnd).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
          </CardTitle>
        </div>
        <span className="text-xs text-muted-foreground">{new Date(report.createdAt).toLocaleDateString("es-MX")}</span>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4 pt-0" onClick={(e) => e.stopPropagation()}>
          {summary && <p className="text-sm leading-relaxed border-l-2 border-gold pl-3">{summary}</p>}
          {wins.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-emerald-400 mb-1 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Wins</h4>
              <ul className="space-y-1">{wins.map((w, i) => <li key={i} className="text-sm text-muted-foreground">• {w}</li>)}</ul>
            </div>
          )}
          {problems.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-red-400 mb-1 flex items-center gap-1"><XCircle className="h-3 w-3" /> Problemas</h4>
              <ul className="space-y-1">{problems.map((p, i) => <li key={i} className="text-sm text-muted-foreground">• {p}</li>)}</ul>
            </div>
          )}
          {actions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gold mb-1 flex items-center gap-1"><ArrowRight className="h-3 w-3" /> Acciones</h4>
              <ol className="space-y-1">{actions.map((a, i) => <li key={i} className="text-sm text-muted-foreground">{i + 1}. {a}</li>)}</ol>
            </div>
          )}
          {report.highlights.length > 0 && (
            <div className="rounded-lg bg-gold/5 border border-gold/10 p-3">
              <p className="text-xs font-medium text-gold flex items-center gap-1"><Sparkles className="h-3 w-3" /> Highlights</p>
              <p className="text-sm mt-1">{report.highlights[0]}</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
