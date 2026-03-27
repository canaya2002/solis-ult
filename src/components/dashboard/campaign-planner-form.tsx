"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";

const CITIES = [
  { value: "Dallas", label: "Dallas, TX" },
  { value: "Chicago", label: "Chicago, IL" },
  { value: "Los Angeles", label: "Los Angeles, CA" },
  { value: "Memphis", label: "Memphis, TN" },
  { value: "Todo Texas", label: "Todo Texas" },
  { value: "Nacional", label: "Nacional (USA)" },
];

const CASE_TYPES = [
  { value: "", label: "Todos los tipos" },
  { value: "Asilo", label: "Asilo" },
  { value: "TPS", label: "TPS" },
  { value: "Residencia", label: "Residencia (Green Card)" },
  { value: "Ciudadania", label: "Ciudadan\u00eda" },
  { value: "Visa de Trabajo", label: "Visa de Trabajo" },
  { value: "Defensa de Deportacion", label: "Defensa de Deportaci\u00f3n" },
];

interface CampaignPlannerFormProps {
  onSubmit: (params: {
    goal: string;
    budget: number;
    cities: string[];
    caseType?: string;
    mediaUrls?: string[];
  }) => void;
  loading: boolean;
}

export function CampaignPlannerForm({ onSubmit, loading }: CampaignPlannerFormProps) {
  const [goal, setGoal] = useState("");
  const [budget, setBudget] = useState(50);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [caseType, setCaseType] = useState("");

  const toggleCity = (city: string) => {
    setSelectedCities(prev =>
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };

  const handleSubmit = () => {
    if (!goal.trim() || selectedCities.length === 0) return;
    onSubmit({
      goal: goal.trim(),
      budget,
      cities: selectedCities,
      caseType: caseType || undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-gold" />
          AI Campaign Planner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Goal */}
        <div className="space-y-2">
          <Label htmlFor="goal">Objetivo de la campa\u00f1a</Label>
          <Textarea
            id="goal"
            placeholder="Ej: Generar leads para TPS en Dallas y Chicago, Promover el podcast a nivel nacional, M\u00e1s consultas de asilo en Los \u00c1ngeles..."
            value={goal}
            onChange={e => setGoal(e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Budget Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Presupuesto diario</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                value={budget}
                onChange={e => setBudget(Math.max(10, Math.min(500, Number(e.target.value))))}
                className="w-20 h-7 text-sm text-right"
              />
              <span className="text-xs text-muted-foreground">/d\u00eda</span>
            </div>
          </div>
          <Slider
            value={[budget]}
            onValueChange={v => setBudget(v[0])}
            min={10}
            max={500}
            step={5}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>$10</span>
            <span className="text-gold font-medium">${budget}/d\u00eda = ${(budget * 7).toLocaleString()}/semana</span>
            <span>$500</span>
          </div>
        </div>

        {/* Cities */}
        <div className="space-y-2">
          <Label>Ciudades objetivo</Label>
          <div className="flex flex-wrap gap-2">
            {CITIES.map(city => (
              <button
                key={city.value}
                onClick={() => toggleCity(city.value)}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  selectedCities.includes(city.value)
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-border text-muted-foreground hover:border-gold/50"
                }`}
              >
                {city.label}
              </button>
            ))}
          </div>
        </div>

        {/* Case Type */}
        <div className="space-y-2">
          <Label>Tipo de caso (opcional)</Label>
          <Select value={caseType} onValueChange={setCaseType}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar tipo de caso" />
            </SelectTrigger>
            <SelectContent>
              {CASE_TYPES.map(ct => (
                <SelectItem key={ct.value} value={ct.value || "all"}>
                  {ct.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Submit */}
        <Button
          className="w-full bg-gold text-background hover:bg-gold/90"
          size="lg"
          onClick={handleSubmit}
          disabled={loading || !goal.trim() || selectedCities.length === 0}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analizando datos hist\u00f3ricos, tendencias, y generando estrategia...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Planificar con AI
            </>
          )}
        </Button>

        {/* Immigration notice */}
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Las campa\u00f1as de servicios de inmigraci\u00f3n requieren la categor\u00eda especial &quot;Housing&quot; en Meta,
          lo cual limita el targeting (sin segmentaci\u00f3n por edad, g\u00e9nero o c\u00f3digo postal).
          El sistema aplica esto autom\u00e1ticamente.
        </p>
      </CardContent>
    </Card>
  );
}
