"use client";
import { useReports } from "@/hooks/use-reports";
import { ReportCard } from "@/components/dashboard/report-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileBarChart, Loader2 } from "lucide-react";

export default function ReportsPage() {
  const { reports, loading, generating, latestReport, generateReport } = useReports();

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes Semanales AI</h1>
          <p className="text-muted-foreground">Reportes ejecutivos generados automáticamente cada viernes.</p>
        </div>
        <Button className="bg-gold text-background hover:bg-gold-light" onClick={() => generateReport()} disabled={generating}>
          {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileBarChart className="mr-1.5 h-4 w-4" />}
          {generating ? "Generando..." : "Generar reporte ahora"}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <FileBarChart className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">No hay reportes aún</p>
          <p className="text-muted-foreground">Genera el primer reporte semanal o espera al viernes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {latestReport && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Reporte más reciente</h2>
              <ReportCard report={latestReport} expanded />
            </div>
          )}
          {reports.length > 1 && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Historial</h2>
              <div className="space-y-2">
                {reports.slice(1).map(r => <ReportCard key={r.id} report={r} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
