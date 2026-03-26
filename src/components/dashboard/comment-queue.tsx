"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformBadge } from "./platform-badge";
import { Check, X, Pencil, AlertTriangle, MessageCircle } from "lucide-react";

interface Comment {
  id: string;
  platform: string;
  text: string;
  author: string;
  category: string | null;
  responseDraft: string | null;
  responseStatus: string;
  createdAt: string;
}

interface CommentQueueProps {
  comments: Comment[];
  onApprove: (id: string) => void;
  onEditApprove: (id: string, text: string) => void;
  onIgnore: (id: string) => void;
  loading: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  LEGAL_QUESTION: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  POSITIVE: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  COMPLAINT: "bg-red-500/20 text-red-400 border-red-500/30",
  SPAM: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  PRICE_INQUIRY: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  OTHER: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const CATEGORY_LABELS: Record<string, string> = {
  LEGAL_QUESTION: "Pregunta legal",
  POSITIVE: "Positivo",
  COMPLAINT: "Queja",
  SPAM: "Spam",
  PRICE_INQUIRY: "Precio",
  OTHER: "Otro",
};

export function CommentQueue({
  comments,
  onApprove,
  onEditApprove,
  onIgnore,
  loading,
}: CommentQueueProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (!comments.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-2">
          <MessageCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">No hay comentarios pendientes</p>
        </CardContent>
      </Card>
    );
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <div className="space-y-3">
      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/5 p-2">
          <span className="text-sm text-gold">{selected.size} seleccionados</span>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => {
              selected.forEach((id) => onApprove(id));
              setSelected(new Set());
            }}
          >
            Aprobar todos
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              selected.forEach((id) => onIgnore(id));
              setSelected(new Set());
            }}
          >
            Ignorar todos
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Cancelar
          </Button>
        </div>
      )}

      {comments.map((comment) => {
        const isComplaint = comment.category === "COMPLAINT";
        const isEditing = editingId === comment.id;

        return (
          <Card key={comment.id} className={isComplaint ? "border-red-500/30" : ""}>
            <CardContent className="p-4 space-y-2">
              {isComplaint && (
                <div className="flex items-center gap-2 rounded bg-red-500/10 px-3 py-1.5 text-xs text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Queja detectada — revisa antes de responder
                </div>
              )}

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(comment.id)}
                  onChange={() => toggleSelect(comment.id)}
                  className="mt-1 shrink-0"
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PlatformBadge platform={comment.platform as "facebook"} size="sm" />
                    <span className="text-sm font-medium">{comment.author}</span>
                    {comment.category && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${CATEGORY_COLORS[comment.category] || ""}`}
                      >
                        {CATEGORY_LABELS[comment.category] || comment.category}
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm">{comment.text}</p>

                  {/* Draft response */}
                  {comment.responseDraft && (
                    <div className="rounded border border-border bg-surface-elevated/50 p-2">
                      <p className="text-[10px] text-muted-foreground mb-1">Respuesta AI:</p>
                      {isEditing ? (
                        <textarea
                          className="w-full min-h-[60px] rounded border border-border bg-transparent p-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold resize-y"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">{comment.responseDraft}</p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => {
                        if (isEditing) {
                          onEditApprove(comment.id, editText);
                          setEditingId(null);
                        } else {
                          onApprove(comment.id);
                        }
                      }}
                    >
                      <Check className="mr-1 h-3 w-3" />
                      {isEditing ? "Guardar y publicar" : "Aprobar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (isEditing) {
                          setEditingId(null);
                        } else {
                          setEditingId(comment.id);
                          setEditText(comment.responseDraft || "");
                        }
                      }}
                    >
                      <Pencil className="mr-1 h-3 w-3" />
                      {isEditing ? "Cancelar" : "Editar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => onIgnore(comment.id)}
                    >
                      <X className="mr-1 h-3 w-3" />
                      Ignorar
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
