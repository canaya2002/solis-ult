"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, ArrowRight, CheckCircle, Circle } from "lucide-react";

interface OnboardingHeroProps {
  connectedCount: number;
  totalApis: number;
  onGoToSettings: () => void;
}

const PRIORITY_APIS = [
  { name: "Meta Ads", description: "Campañas y optimización de presupuesto", priority: true },
  { name: "Google Analytics", description: "Tráfico web y conversiones", priority: true },
  { name: "Claude AI", description: "Análisis y generación de contenido", priority: true },
  { name: "Twilio", description: "Follow-up automático por WhatsApp/SMS", priority: false },
  { name: "Search Console", description: "Rendimiento SEO", priority: false },
  { name: "YouTube", description: "Métricas del canal", priority: false },
];

export function OnboardingHero({
  connectedCount,
  totalApis,
  onGoToSettings,
}: OnboardingHeroProps) {
  const progress = totalApis > 0 ? (connectedCount / totalApis) * 100 : 0;

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-2xl border-gold/20">
        <CardContent className="space-y-8 p-8 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-gold/10 p-4">
              <Zap className="h-12 w-12 text-gold" />
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Bienvenido a <span className="text-gold">SOLIS AI</span>
            </h1>
            <p className="mt-2 text-muted-foreground">
              Configura tus APIs para activar el Command Center y empezar a
              optimizar el marketing de Manuel Solís Law Office.
            </p>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progreso de configuración</span>
              <span className="font-medium text-gold">
                {connectedCount} de {totalApis} APIs
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-elevated">
              <div
                className="h-full rounded-full bg-gold transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Priority APIs */}
          <div className="space-y-2 text-left">
            {PRIORITY_APIS.map((api) => (
              <div
                key={api.name}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                {connectedCount > 0 ? (
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {api.name}
                    {api.priority && (
                      <span className="ml-2 text-[10px] text-gold">
                        PRIORITARIA
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {api.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <Button
            size="lg"
            className="bg-gold text-background hover:bg-gold-light"
            onClick={onGoToSettings}
          >
            Ir a Configuración
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
