"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FunnelStep { label: string; value: number; color: string }
interface FunnelChartProps { steps: FunnelStep[] }

export function FunnelChart({ steps }: FunnelChartProps) {
  if (!steps.length) return null;
  const max = Math.max(...steps.map(s => s.value), 1);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Embudo de Conversión</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step, i) => {
          const width = Math.max((step.value / max) * 100, 10);
          const convRate = i > 0 && steps[i - 1].value > 0 ? Math.round((step.value / steps[i - 1].value) * 100) : null;
          return (
            <div key={step.label}>
              {convRate !== null && (
                <div className="flex justify-center"><span className="text-[10px] text-muted-foreground">↓ {convRate}%</span></div>
              )}
              <div className="flex items-center gap-3">
                <span className="w-24 text-right text-xs text-muted-foreground shrink-0">{step.label}</span>
                <div className="flex-1">
                  <div className="h-8 rounded-md flex items-center px-3 transition-all" style={{ width: `${width}%`, backgroundColor: step.color + "33", borderLeft: `3px solid ${step.color}` }}>
                    <span className="text-xs font-semibold" style={{ color: step.color }}>{step.value.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
