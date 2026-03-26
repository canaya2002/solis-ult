"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";

interface ApiConnectionCardProps {
  name: string;
  description: string;
  connected: boolean;
  envVar: string;
  onVerify: () => void;
  verifying: boolean;
  lastVerified?: Date;
  error?: string;
}

export function ApiConnectionCard({ name, description, connected, envVar, onVerify, verifying, error }: ApiConnectionCardProps) {
  return (
    <Card className={connected ? "border-emerald-500/20" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            {connected ? <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
            <div>
              <p className="text-sm font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
              {!connected && <p className="text-[10px] text-muted-foreground mt-1 font-mono">{envVar}</p>}
              {error && <p className="text-[10px] text-red-400 mt-1">{error}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className={connected ? "border-emerald-500/30 text-emerald-400 text-[10px]" : "text-muted-foreground text-[10px]"}>
              {connected ? "Conectada" : "No configurada"}
            </Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onVerify} disabled={verifying}>
              {verifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
