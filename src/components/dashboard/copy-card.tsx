"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlatformBadge } from "./platform-badge";
import { Copy, Calendar, Pencil, Save } from "lucide-react";
import type { CopyVariant } from "@/types/ai";

const CHAR_LIMITS: Record<string, number> = {
  facebook: 63206,
  instagram: 2200,
  tiktok: 2200,
  youtube: 5000,
};

interface CopyCardProps {
  variant: CopyVariant;
  platform: string;
  onCopy: () => void;
  onSchedule: () => void;
  onEdit?: (text: string) => void;
  onSave?: () => void;
  editable?: boolean;
}

export function CopyCard({
  variant,
  platform,
  onCopy,
  onSchedule,
  onEdit,
  onSave,
  editable = false,
}: CopyCardProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(variant.caption);
  const charLimit = CHAR_LIMITS[platform.toLowerCase()] || 5000;

  return (
    <Card className="hover:border-gold/20 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Variante {variant.variant}
            </span>
            <PlatformBadge platform={platform as "facebook"} size="sm" />
          </div>
          <span
            className={`text-[10px] ${text.length > charLimit ? "text-red-400" : "text-muted-foreground"}`}
          >
            {text.length}/{charLimit}
          </span>
        </div>

        {editing ? (
          <textarea
            className="w-full min-h-[120px] rounded-lg border border-border bg-transparent p-3 text-sm focus:outline-none focus:ring-1 focus:ring-gold resize-y"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onEdit?.(e.target.value);
            }}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {text}
          </p>
        )}

        {/* Hashtags */}
        {variant.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {variant.hashtags.slice(0, 10).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
            {variant.hashtags.length > 10 && (
              <span className="text-[10px] text-muted-foreground">
                +{variant.hashtags.length - 10}
              </span>
            )}
          </div>
        )}

        {/* CTA */}
        {variant.cta && (
          <div className="rounded bg-gold/5 border border-gold/10 px-3 py-2">
            <p className="text-xs text-gold">CTA: {variant.cta}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCopy}>
            <Copy className="mr-1.5 h-3 w-3" /> Copiar
          </Button>
          <Button variant="outline" size="sm" onClick={onSchedule}>
            <Calendar className="mr-1.5 h-3 w-3" /> Programar
          </Button>
          {editable && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(!editing)}
              >
                <Pencil className="mr-1.5 h-3 w-3" />
                {editing ? "Vista previa" : "Editar"}
              </Button>
              {editing && onSave && (
                <Button variant="ghost" size="sm" onClick={onSave}>
                  <Save className="mr-1.5 h-3 w-3" /> Guardar
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
