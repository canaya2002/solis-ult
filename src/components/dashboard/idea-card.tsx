"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlatformBadge } from "./platform-badge";
import { Wand2, X, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContentIdea } from "@/types/ai";

interface IdeaCardProps {
  idea: ContentIdea;
  onUse: () => void;
  onDismiss: () => void;
  used?: boolean;
}

export function IdeaCard({ idea, onUse, onDismiss, used }: IdeaCardProps) {
  return (
    <Card
      className={cn(
        "transition-all hover:border-gold/30",
        used && "opacity-50"
      )}
    >
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1">
            <h3 className="font-semibold leading-tight">{idea.topic}</h3>
            <p className="text-sm text-muted-foreground">{idea.angle}</p>
          </div>
          <PlatformBadge
            platform={idea.platform as "facebook" | "instagram" | "tiktok" | "youtube" | "blog"}
            size="sm"
          />
        </div>

        {/* Hook */}
        <div className="flex gap-2 rounded-lg bg-gold/5 border border-gold/10 p-3">
          <Quote className="h-4 w-4 shrink-0 text-gold mt-0.5" />
          <p className="text-sm italic text-gold/90">{idea.hook}</p>
        </div>

        {/* Hashtags */}
        <div className="flex flex-wrap gap-1">
          {idea.hashtags.slice(0, 6).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
          {idea.hashtags.length > 6 && (
            <span className="text-[10px] text-muted-foreground">
              +{idea.hashtags.length - 6} más
            </span>
          )}
        </div>

        {/* Source */}
        <p className="text-[10px] text-muted-foreground">
          Fuente: {idea.trendSource}
        </p>

        {/* Actions */}
        {!used && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 bg-gold text-background hover:bg-gold-light"
              onClick={onUse}
            >
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              Usar esta idea
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={onDismiss}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
