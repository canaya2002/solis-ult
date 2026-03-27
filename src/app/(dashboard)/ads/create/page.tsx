"use client";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CampaignPlannerForm } from "@/components/dashboard/campaign-planner-form";
import { CampaignPreview } from "@/components/dashboard/campaign-preview";
import { useCampaignCreator } from "@/hooks/use-campaign-creator";
import {
  Sparkles,
  PenTool,
  CheckCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Zap,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Manual Wizard Types ────────────────────────────────────────────────────────

const OBJECTIVES = [
  { value: "OUTCOME_LEADS", label: "Generaci\u00f3n de Leads" },
  { value: "OUTCOME_TRAFFIC", label: "Tr\u00e1fico Web" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engagement" },
];

const CTA_TYPES = [
  { value: "LEARN_MORE", label: "Conocer m\u00e1s" },
  { value: "CONTACT_US", label: "Cont\u00e1ctanos" },
  { value: "GET_QUOTE", label: "Obtener consulta" },
  { value: "BOOK_NOW", label: "Reservar ahora" },
  { value: "SIGN_UP", label: "Registrarse" },
];

const CITIES_MANUAL = [
  { value: "Dallas", label: "Dallas, TX", key: "2418956" },
  { value: "Chicago", label: "Chicago, IL", key: "2379574" },
  { value: "Los Angeles", label: "Los Angeles, CA", key: "2420379" },
  { value: "Memphis", label: "Memphis, TN", key: "2425539" },
];

export default function AdsCreatePage() {
  const creator = useCampaignCreator();

  // Manual wizard state
  const [manualStep, setManualStep] = useState(1);
  const [manualCampaign, setManualCampaign] = useState({
    name: "",
    objective: "OUTCOME_LEADS",
    dailyBudget: 50,
  });
  const [manualCities, setManualCities] = useState<string[]>([]);
  const [manualLocales, setManualLocales] = useState<number[]>([24]); // Spanish
  const [manualAds, setManualAds] = useState([{ name: "Ad 1", copy: "", cta: "LEARN_MORE" }]);

  const toggleManualCity = (key: string) => {
    setManualCities(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    );
  };

  const addManualAd = () => {
    setManualAds(prev => [...prev, { name: `Ad ${prev.length + 1}`, copy: "", cta: "LEARN_MORE" }]);
  };

  const handleManualSubmit = async () => {
    const cityObjects = manualCities.map(key => {
      const city = CITIES_MANUAL.find(c => c.key === key);
      return { key, name: city?.value || key };
    });

    await creator.planManualCampaign({
      campaign: {
        name: manualCampaign.name,
        objective: manualCampaign.objective,
        dailyBudget: manualCampaign.dailyBudget,
        specialAdCategories: ["HOUSING"],
      },
      adSets: [{
        name: `${manualCampaign.name} — Audiencia`,
        targeting: {
          geoLocations: { cities: cityObjects },
          locales: manualLocales,
        },
        dailyBudget: manualCampaign.dailyBudget,
      }],
      ads: manualAds.filter(a => a.copy.trim()),
    });
  };

  const handleApprove = async (modifications?: Record<string, unknown>) => {
    const result = await creator.approvePlan(undefined, modifications);
    if (result) {
      toast.success("Campa\u00f1a creada en Meta (PAUSADA). Revisa y activa cuando est\u00e9s listo.");
    }
  };

  const handleActivate = async () => {
    if (!creator.campaignId) return;
    const result = await creator.activateCampaign();
    if (result) {
      toast.success("Campa\u00f1a ACTIVA. Monitoreando rendimiento.");
    }
  };

  const handleReject = () => {
    creator.reset();
    toast("Plan rechazado");
  };

  return (
    <div className="animate-fade-in space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Crear Campa\u00f1a</h1>
        <p className="text-muted-foreground">
          Crea campa\u00f1as de Meta Ads con AI o manualmente. Todo se crea pausado hasta que apruebes.
        </p>
      </div>

      {/* Success States */}
      {creator.step === "approved" && creator.campaignId && (
        <Card className="border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-400">
                  Campa\u00f1a creada en Meta (PAUSADA)
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  La campa\u00f1a est\u00e1 lista pero pausada. Revisa en Meta Ads Manager y activa cuando est\u00e9s listo.
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    className="bg-gold text-background hover:bg-gold/90"
                    onClick={handleActivate}
                    disabled={creator.isActivating}
                  >
                    {creator.isActivating ? (
                      <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Activando...</>
                    ) : (
                      <><Zap className="mr-1.5 h-3 w-3" /> Activar ahora</>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={creator.reset}>
                    Crear otra campa\u00f1a
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {creator.step === "activated" && (
        <Card className="border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-400">Campa\u00f1a ACTIVA</p>
                <p className="text-xs text-muted-foreground mt-1">
                  La campa\u00f1a est\u00e1 corriendo. El sistema monitorear\u00e1 el rendimiento autom\u00e1ticamente.
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={creator.reset}>
                  Crear otra campa\u00f1a
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {creator.error && (
        <Card className="border-red-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-400">Error</p>
              <p className="text-xs text-muted-foreground mt-1">{creator.error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={creator.reset}>
                Intentar de nuevo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview (shown after plan is generated) */}
      {creator.step === "planned" && creator.plan && (
        <CampaignPreview
          plan={creator.plan}
          onApprove={handleApprove}
          onReject={handleReject}
          approving={creator.isApproving}
        />
      )}

      {/* Main Form (shown when idle or error) */}
      {(creator.step === "idle" || creator.step === "error") && (
        <Tabs defaultValue="ai">
          <TabsList className="w-full">
            <TabsTrigger value="ai" className="flex-1 gap-2">
              <Sparkles className="h-3.5 w-3.5" /> AI Planner
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex-1 gap-2">
              <PenTool className="h-3.5 w-3.5" /> Manual
            </TabsTrigger>
          </TabsList>

          {/* ─── AI Planner Tab ─────────────────────────────────────────────── */}
          <TabsContent value="ai" className="mt-4">
            <CampaignPlannerForm
              onSubmit={params => creator.planCampaign(params)}
              loading={creator.isPlanning}
            />
          </TabsContent>

          {/* ─── Manual Tab ─────────────────────────────────────────────────── */}
          <TabsContent value="manual" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PenTool className="h-4 w-4" />
                  Crear manualmente — Paso {manualStep} de 4
                </CardTitle>
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3, 4].map(s => (
                    <div
                      key={s}
                      className={`h-1 flex-1 rounded-full ${s <= manualStep ? "bg-gold" : "bg-muted"}`}
                    />
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Step 1: Objective */}
                {manualStep === 1 && (
                  <>
                    <div className="space-y-2">
                      <Label>Nombre de la campa\u00f1a</Label>
                      <Input
                        value={manualCampaign.name}
                        onChange={e => setManualCampaign(p => ({ ...p, name: e.target.value }))}
                        placeholder="Ej: TPS Dallas Marzo 2026"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Objetivo</Label>
                      <Select
                        value={manualCampaign.objective}
                        onValueChange={v => setManualCampaign(p => ({ ...p, objective: v }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {OBJECTIVES.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Presupuesto diario ($)</Label>
                      <Input
                        type="number"
                        value={manualCampaign.dailyBudget}
                        onChange={e => setManualCampaign(p => ({ ...p, dailyBudget: Number(e.target.value) }))}
                      />
                    </div>
                    <Button
                      onClick={() => setManualStep(2)}
                      disabled={!manualCampaign.name.trim()}
                      className="w-full"
                    >
                      Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                )}

                {/* Step 2: Targeting */}
                {manualStep === 2 && (
                  <>
                    <div className="space-y-2">
                      <Label>Ciudades</Label>
                      <div className="flex flex-wrap gap-2">
                        {CITIES_MANUAL.map(c => (
                          <button
                            key={c.key}
                            onClick={() => toggleManualCity(c.key)}
                            className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                              manualCities.includes(c.key)
                                ? "border-gold bg-gold/10 text-gold"
                                : "border-border text-muted-foreground hover:border-gold/50"
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Idioma</Label>
                      <div className="flex gap-2">
                        {[{ v: 24, l: "Espa\u00f1ol" }, { v: 6, l: "English" }].map(lang => (
                          <button
                            key={lang.v}
                            onClick={() => {
                              setManualLocales(prev =>
                                prev.includes(lang.v) ? prev.filter(l => l !== lang.v) : [...prev, lang.v]
                              );
                            }}
                            className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                              manualLocales.includes(lang.v)
                                ? "border-gold bg-gold/10 text-gold"
                                : "border-border text-muted-foreground hover:border-gold/50"
                            }`}
                          >
                            {lang.l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Card className="border-yellow-500/20">
                      <CardContent className="p-3 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-yellow-400/80">
                          Categor\u00eda Housing aplicada autom\u00e1ticamente. No se puede segmentar por edad, g\u00e9nero ni c\u00f3digo postal.
                        </p>
                      </CardContent>
                    </Card>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setManualStep(1)}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Atr\u00e1s
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => setManualStep(3)}
                        disabled={manualCities.length === 0}
                      >
                        Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}

                {/* Step 3: Ads */}
                {manualStep === 3 && (
                  <>
                    {manualAds.map((ad, idx) => (
                      <div key={idx} className="space-y-2 rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium">{ad.name}</Label>
                          <Select
                            value={ad.cta}
                            onValueChange={v => {
                              const updated = [...manualAds];
                              updated[idx] = { ...updated[idx], cta: v };
                              setManualAds(updated);
                            }}
                          >
                            <SelectTrigger className="w-40 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CTA_TYPES.map(ct => (
                                <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Textarea
                          value={ad.copy}
                          onChange={e => {
                            const updated = [...manualAds];
                            updated[idx] = { ...updated[idx], copy: e.target.value };
                            setManualAds(updated);
                          }}
                          placeholder="Texto del anuncio..."
                          rows={4}
                          className="resize-none text-xs"
                        />
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addManualAd}>
                      + Agregar otro ad
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setManualStep(2)}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Atr\u00e1s
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => setManualStep(4)}
                        disabled={!manualAds.some(a => a.copy.trim())}
                      >
                        Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}

                {/* Step 4: Review */}
                {manualStep === 4 && (
                  <>
                    <div className="space-y-3">
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-[10px] text-muted-foreground mb-1">Campa\u00f1a</p>
                        <p className="text-sm font-medium">{manualCampaign.name}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">
                            {OBJECTIVES.find(o => o.value === manualCampaign.objective)?.label}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            ${manualCampaign.dailyBudget}/d\u00eda
                          </Badge>
                          <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-400">
                            Housing
                          </Badge>
                        </div>
                      </div>
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-[10px] text-muted-foreground mb-1">Audiencia</p>
                        <div className="flex flex-wrap gap-1">
                          {manualCities.map(key => {
                            const city = CITIES_MANUAL.find(c => c.key === key);
                            return <Badge key={key} variant="outline" className="text-[10px]">{city?.label || key}</Badge>;
                          })}
                          {manualLocales.map(l => (
                            <Badge key={l} variant="outline" className="text-[10px]">
                              {l === 24 ? "Espa\u00f1ol" : "English"}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-[10px] text-muted-foreground mb-1">
                          Ads ({manualAds.filter(a => a.copy.trim()).length})
                        </p>
                        {manualAds.filter(a => a.copy.trim()).map((ad, idx) => (
                          <div key={idx} className="mt-2 text-xs">
                            <p className="font-medium">{ad.name} — {CTA_TYPES.find(c => c.value === ad.cta)?.label}</p>
                            <p className="text-muted-foreground mt-0.5 line-clamp-2">{ad.copy}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setManualStep(3)}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Atr\u00e1s
                      </Button>
                      <Button
                        className="flex-1 bg-gold text-background hover:bg-gold/90"
                        onClick={handleManualSubmit}
                        disabled={creator.isPlanning}
                      >
                        {creator.isPlanning ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando plan...</>
                        ) : (
                          <><CheckCircle className="mr-2 h-4 w-4" /> Confirmar y crear plan</>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
