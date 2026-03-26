// SOLIS AI — Weekly Report Cron (Fridays 5pm CT / 10pm UTC)
import { NextRequest } from "next/server";
import { generateFullWeeklyReport } from "@/lib/reports/weekly-report-generator";
import { sendWeeklyReport } from "@/lib/comms/resend";
import { apiSuccess, apiError } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError("Unauthorized", 401);
  }

  try {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const report = await generateFullWeeklyReport(monday, now);

    const metricsHtml = Object.entries(report.metrics)
      .filter(([, v]) => v !== null)
      .map(([key, val]) => {
        if (!val || typeof val !== "object") return "";
        const entries = Object.entries(val).filter(([k]) => k !== "bySource").slice(0, 3);
        return `<tr><td style="padding:6px 12px;border-bottom:1px solid #2a2d3a;color:#cda64e;font-weight:600;">${key}</td>${entries.map(([k, v]) => `<td style="padding:6px 12px;border-bottom:1px solid #2a2d3a;">${k}: ${typeof v === "number" ? (k.includes("rate") || k.includes("ctr") ? v + "%" : k.includes("spend") || k.includes("revenue") || k.includes("cpl") ? "$" + v.toLocaleString() : v.toLocaleString()) : v}</td>`).join("")}</tr>`;
      })
      .join("");

    const reportHtml = `
      <h2 style="color:#cda64e;">Resumen Ejecutivo</h2>
      <p style="font-size:16px;line-height:1.6;">${report.summary}</p>
      <h2 style="color:#22c55e;">✓ Wins</h2>
      <ul>${report.wins.map(w => `<li>${w.title}</li>`).join("")}</ul>
      <h2 style="color:#ef4444;">✕ Problemas</h2>
      <ul>${report.problems.map(p => `<li>${p.title}</li>`).join("")}</ul>
      <h2 style="color:#cda64e;">→ Acciones</h2>
      <ol>${report.actions.map(a => `<li><strong>[${a.priority}]</strong> ${a.title}</li>`).join("")}</ol>
      ${report.highlight ? `<div style="background:#cda64e20;padding:16px;border-radius:8px;margin:16px 0;border-left:3px solid #cda64e;"><strong>Highlight:</strong> ${report.highlight}</div>` : ""}
      <h2>Métricas</h2>
      <table style="width:100%;border-collapse:collapse;">${metricsHtml}</table>
    `;

    await sendWeeklyReport({
      to: ["marketing@manuelsolis.com"],
      reportHtml,
      periodStart: monday.toISOString().split("T")[0],
      periodEnd: now.toISOString().split("T")[0],
    }).catch(e => console.error("[cron/weekly-report] Email failed:", e));

    console.info(`[cron/weekly-report] Report generated: ${report.id}`);
    return apiSuccess({ reportId: report.id, summary: report.summary });
  } catch (error) {
    console.error("[cron/weekly-report] failed:", error);
    return apiError("Cron failed", 500);
  }
}
