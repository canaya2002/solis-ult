"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "./star-rating";
import { Check, Pencil, X, RotateCcw, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface Review {
  id: string;
  rating: number;
  text: string;
  author: string;
  officeName: string;
  responseDraft: string | null;
  responseStatus: string;
  createdAt: string;
}

interface ReviewCardProps {
  review: Review;
  onApprove: () => void;
  onEdit: (response: string) => void;
  onIgnore: () => void;
  onRegenerate: () => void;
  showDraft: boolean;
}

export function ReviewCard({
  review,
  onApprove,
  onEdit,
  onIgnore,
  onRegenerate,
  showDraft,
}: ReviewCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review.responseDraft || "");
  const isNegative = review.rating <= 3;

  return (
    <Card className={isNegative ? "border-red-500/30" : ""}>
      <CardContent className="p-4 space-y-3">
        {isNegative && (
          <div className="flex items-center gap-2 rounded bg-red-500/10 px-3 py-1.5 text-xs text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Review negativa — responder con cuidado
          </div>
        )}

        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <StarRating rating={review.rating} size="sm" />
              <Badge variant="outline" className="text-[10px]">
                {review.officeName}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {review.author} ·{" "}
              {formatDistanceToNow(new Date(review.createdAt), {
                addSuffix: true,
                locale: es,
              })}
            </p>
          </div>
          <Badge
            variant="outline"
            className={
              review.responseStatus === "PUBLISHED"
                ? "border-emerald-500/30 text-emerald-400 text-[10px]"
                : review.responseStatus === "IGNORED"
                  ? "text-muted-foreground text-[10px]"
                  : "border-amber-500/30 text-amber-400 text-[10px]"
            }
          >
            {review.responseStatus === "PUBLISHED"
              ? "Respondida"
              : review.responseStatus === "IGNORED"
                ? "Ignorada"
                : "Pendiente"}
          </Badge>
        </div>

        <p className="text-sm leading-relaxed">{review.text}</p>

        {showDraft && review.responseStatus === "PENDING" && (
          <div className="space-y-2 rounded-lg border border-border bg-surface-elevated/50 p-3">
            <p className="text-[10px] font-medium text-muted-foreground">
              Respuesta AI:
            </p>
            {editing ? (
              <textarea
                className="w-full min-h-[80px] rounded border border-border bg-transparent p-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold resize-y"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{draft}</p>
            )}
            <div className="flex gap-1.5">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  if (editing) onEdit(draft);
                  else onApprove();
                }}
              >
                <Check className="mr-1 h-3 w-3" />
                {editing ? "Guardar y publicar" : "Publicar"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(!editing)}
              >
                <Pencil className="mr-1 h-3 w-3" />
                {editing ? "Cancelar" : "Editar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={onRegenerate}>
                <RotateCcw className="mr-1 h-3 w-3" />
                Regenerar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={onIgnore}
              >
                <X className="mr-1 h-3 w-3" />
                Ignorar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
