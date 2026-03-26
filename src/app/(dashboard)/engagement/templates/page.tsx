"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";

interface Template {
  category: string;
  text: string;
  active: boolean;
}

const DEFAULT_TEMPLATES: Template[] = [
  {
    category: "POSITIVE",
    text: "¡Gracias por tu comentario, {nombre}! Nos alegra saber que nuestra información es útil. Si necesitas ayuda con un caso de inmigración, estamos aquí para ti. Visita manuelsolis.com 🙏",
    active: true,
  },
  {
    category: "LEGAL_QUESTION",
    text: "Hola {nombre}, gracias por tu pregunta. Para darte una respuesta precisa sobre tu caso, te recomendamos agendar una consulta con uno de nuestros abogados. Llama al (214) 414-4414 o visita manuelsolis.com. ¡Estamos para ayudarte!",
    active: true,
  },
  {
    category: "PRICE_INQUIRY",
    text: "Hola {nombre}, los costos varían según el tipo de caso y su complejidad. Te invitamos a una consulta para evaluar tu situación específica. Contacta al (214) 414-4414 o visita manuelsolis.com",
    active: true,
  },
  {
    category: "COMPLAINT",
    text: "Hola {nombre}, lamentamos mucho tu experiencia. Nos tomamos muy en serio cada comentario. Por favor contacta directamente a nuestro equipo al (214) 414-4414 para que podamos resolver tu situación.",
    active: true,
  },
  {
    category: "OTHER",
    text: "¡Gracias por tu comentario! Si tienes alguna pregunta sobre inmigración, no dudes en contactarnos al (214) 414-4414 o visita manuelsolis.com",
    active: true,
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  POSITIVE: "Comentarios positivos",
  LEGAL_QUESTION: "Preguntas legales",
  PRICE_INQUIRY: "Consultas de precio",
  COMPLAINT: "Quejas",
  OTHER: "Otros",
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/social/comments?getSettings=templates")
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.templates) setTemplates(json.data.templates);
      })
      .catch(() => {});
  }, []);

  const updateTemplate = (index: number, text: string) => {
    const updated = [...templates];
    updated[index] = { ...updated[index], text };
    setTemplates(updated);
  };

  const toggleActive = (index: number) => {
    const updated = [...templates];
    updated[index] = { ...updated[index], active: !updated[index].active };
    setTemplates(updated);
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      // Save to localStorage as fallback (Redis would be server-side)
      localStorage.setItem("solis:response-templates", JSON.stringify(templates));
      toast.success("Templates guardados");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Response Templates
          </h1>
          <p className="text-muted-foreground">
            Plantillas de respuesta automática por categoría de comentario.
          </p>
        </div>
        <Button
          className="bg-gold text-background hover:bg-gold-light"
          onClick={saveAll}
          disabled={saving}
        >
          <Save className="mr-1.5 h-4 w-4" />
          Guardar todo
        </Button>
      </div>

      <div className="space-y-4">
        {templates.map((template, i) => (
          <Card key={template.category}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">
                  {CATEGORY_LABELS[template.category] || template.category}
                </CardTitle>
                <Badge
                  variant="outline"
                  className={
                    template.active
                      ? "border-emerald-500/30 text-emerald-400 text-[10px]"
                      : "text-muted-foreground text-[10px]"
                  }
                >
                  {template.active ? "Activo" : "Inactivo"}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleActive(i)}
              >
                {template.active ? "Desactivar" : "Activar"}
              </Button>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full min-h-[80px] rounded-lg border border-border bg-transparent p-3 text-sm focus:outline-none focus:ring-1 focus:ring-gold resize-y"
                value={template.text}
                onChange={(e) => updateTemplate(i, e.target.value)}
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Variables disponibles: {"{nombre}"}, {"{telefono}"}, {"{plataforma}"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
