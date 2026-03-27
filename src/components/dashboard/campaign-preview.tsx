"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  CheckCircle,
  Target,
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Edit3,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface CampaignPlan {
  id: string;
  recommendation: string;
  campaign: {
    name: string;
    objective: string;
    dailyBudget: number;
    estimatedDailyLeads: number;
    estimatedCPL: number;
    specialAdCategories: string[];
  };
  adSets: Array<{
    name: string;
    targeting: Record<string, unknown>;
    dailyBudget: number;
    rationale: string;
  }>;
  ads: Array<{
    name: string;
    copy: string;
    cta: string;
    rationale: string;
  }>;
  estimatedResults: {
    dailyLeads: number;
    weeklyCost: number;
    estimatedCPL: number;
    confidence: "high" | "medium" | "low";
    reasoning: string;
  };
}

const CONFIDENCE_STYLES = {
  high: { label: "Alta", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30" },
  medium: { label: "Media", color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30" },
  low: { label: "Baja", color: "text-red-400", bg: "bg-red-400/10 border-red-400/30" },
};

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_LEADS: "Generaci\u00f3n de Leads",
  OUTCOME_TRAFFIC: "Tr\u00e1fico Web",
  OUTCOME_ENGAGEMENT: "Engagement",
  OUTCOME_CONVERSIONS: "Conversiones",
};

interface CampaignPreviewProps {
  plan: CampaignPlan;
  onApprove: (modifications?: Record<string, unknown>) => void;
  onReject: () => void;
  approving: boolean;
}

export function CampaignPreview({ plan, onApprove, onReject, approving }: CampaignPreviewProps) {
  const [editing, setEditing] = useState(false);
  const [editedAds, setEditedAds] = useState(plan.ads);
  const [expandedAdSets, setExpandedAdSets] = useState<number[]>([0]);
  const confidence = CONFIDENCE_STYLES[plan.estimatedResults.confidence];

  const toggleAdSet = (idx: number) => {
    setExpandedAdSets(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleApprove = () => {
    if (editing) {
      onApprove({ ads: editedAds });
    } else {
      onApprove();
    }
  };

  return (
    <div className="space-y-4">
      {/* AI Recommendation */}
      <Card className="border-gold/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-gold shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gold mb-1">Recomendaci\u00f3n de AI</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{plan.recommendation}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Overview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-gold" />
              {plan.campaign.name}
            </CardTitle>
            {plan.campaign.specialAdCategories.includes("HOUSING") && (
              <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-400">
                Housing Category
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground mb-1">Objetivo</p>
              <p className="text-sm font-medium">{OBJECTIVE_LABELS[plan.campaign.objective] || plan.campaign.objective}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                <DollarSign className="h-3 w-3" /> Presupuesto
              </div>
              <p className="text-sm font-medium">${plan.campaign.dailyBudget}/d\u00eda</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                <TrendingUp className="h-3 w-3" /> Leads estimados
              </div>
              <p className="text-sm font-medium">{plan.campaign.estimatedDailyLeads}/d\u00eda</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                <DollarSign className="h-3 w-3" /> CPL estimado
              </div>
              <p className="text-sm font-medium">${plan.campaign.estimatedCPL.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estimated Results */}
      <Card className={`border ${confidence.bg}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">Estimaciones</p>
            <Badge variant="outline" className={`text-[10px] ${confidence.color}`}>
              Confianza: {confidence.label}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <p className="text-[10px] text-muted-foreground">Leads/d\u00eda</p>
              <p className="text-lg font-bold">{plan.estimatedResults.dailyLeads}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Costo/semana</p>
              <p className="text-lg font-bold">${plan.estimatedResults.weeklyCost.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">CPL</p>
              <p className="text-lg font-bold">${plan.estimatedResults.estimatedCPL.toFixed(2)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{plan.estimatedResults.reasoning}</p>
        </CardContent>
      </Card>

      {/* Ad Sets */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" /> Ad Sets ({plan.adSets.length})
        </h3>
        {plan.adSets.map((adSet, idx) => (
          <Card key={idx}>
            <CardContent className="p-3">
              <button
                onClick={() => toggleAdSet(idx)}
                className="flex w-full items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{adSet.name}</span>
                  <span className="text-xs text-muted-foreground">${adSet.dailyBudget}/d\u00eda</span>
                </div>
                {expandedAdSets.includes(idx)
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expandedAdSets.includes(idx) && (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground">{adSet.rationale}</p>
                  <div className="text-[11px]">
                    <p className="font-medium mb-1">Targeting:</p>
                    <pre className="bg-muted/30 rounded p-2 overflow-x-auto text-[10px]">
                      {JSON.stringify(adSet.targeting, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ads */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Ads ({plan.ads.length})</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setEditing(!editing)}
          >
            <Edit3 className="h-3 w-3" />
            {editing ? "Ver preview" : "Modificar"}
          </Button>
        </div>
        {(editing ? editedAds : plan.ads).map((ad, idx) => (
          <Card key={idx}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{ad.name}</span>
                <Badge variant="outline" className="text-[10px]">{ad.cta}</Badge>
              </div>
              {editing ? (
                <Textarea
                  value={editedAds[idx]?.copy || ad.copy}
                  onChange={e => {
                    const updated = [...editedAds];
                    updated[idx] = { ...updated[idx], copy: e.target.value };
                    setEditedAds(updated);
                  }}
                  rows={4}
                  className="text-xs resize-none"
                />
              ) : (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{ad.copy}</p>
              )}
              {ad.rationale && (
                <p className="text-[10px] text-muted-foreground mt-2 italic">{ad.rationale}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Housing Category Warning */}
      {plan.campaign.specialAdCategories.includes("HOUSING") && (
        <Card className="border-yellow-500/20">
          <CardContent className="p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-400/80 leading-relaxed">
              Esta campa\u00f1a usa la categor\u00eda &quot;Housing&quot; (requerida para servicios de inmigraci\u00f3n).
              El targeting NO puede segmentar por edad, g\u00e9nero, ni c\u00f3digo postal.
              Solo se permite segmentar por ubicaci\u00f3n (ciudad/estado), idioma e intereses.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          className="flex-1 bg-gold text-background hover:bg-gold/90"
          size="lg"
          onClick={handleApprove}
          disabled={approving}
        >
          {approving ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando en Meta...</>
          ) : (
            <><CheckCircle className="mr-2 h-4 w-4" /> Aprobar y crear en Meta (pausada)</>
          )}
        </Button>
        <Button variant="outline" size="lg" onClick={onReject} disabled={approving}>
          Rechazar
        </Button>
      </div>
    </div>
  );
}
