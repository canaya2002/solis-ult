"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb } from "lucide-react";

interface InsightCardProps {
  insight: string;
  category: string;
  confidence: number;
  actionable: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  content_performance: "Rendimiento", best_times: "Horarios", hashtags: "Hashtags",
  content_length: "Longitud", platform_preference: "Plataforma", insufficient_data: "Datos",
};

export function InsightCard({ insight, category, confidence, actionable }: InsightCardProps) {
  return (
    <Card className="hover:border-gold/30 transition-colors">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start gap-2">
          <Lightbulb className="h-4 w-4 text-gold shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed">{insight}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[category] || category}</Badge>
          {actionable && <Badge className="bg-gold/20 text-gold border-gold/30 text-[10px]">Accionable</Badge>}
          <div className="flex items-center gap-1 ml-auto">
            <div className="h-1.5 w-16 rounded-full bg-surface-elevated overflow-hidden">
              <div className="h-full bg-gold rounded-full" style={{ width: `${confidence * 100}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground">{Math.round(confidence * 100)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
