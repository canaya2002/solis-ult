// SOLIS AI — Lead Statistics API
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { apiSuccess, apiError } from "@/lib/utils";

const periodSchema = z.enum(["7d", "30d", "90d", "all"]).default("30d");

function periodToDate(period: string): Date | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  return new Date(Date.now() - days * 86400000);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = periodSchema.safeParse(searchParams.get("period") || "30d");
    const period = parsed.success ? parsed.data : "30d";

    const cacheKey = `leads:stats:${period}`;
    const cached = await redis.get(cacheKey);
    if (cached) return apiSuccess(cached);

    const since = periodToDate(period);
    const dateFilter = since ? { createdAt: { gte: since } } : {};

    // Basic counts
    const [totalLeads, periodLeads] = await Promise.all([
      db.lead.count(),
      db.lead.count({ where: dateFilter }),
    ]);

    const statusCounts = await db.lead.groupBy({
      by: ["status"],
      where: dateFilter,
      _count: { id: true },
    });
    const statusMap: Record<string, number> = {};
    for (const row of statusCounts) {
      statusMap[row.status] = row._count.id;
    }

    // Revenue
    const convertedLeads = await db.lead.findMany({
      where: {
        ...dateFilter,
        status: "CONVERTED",
        contractValue: { not: null },
      },
      select: { contractValue: true },
    });
    const totalRevenue = convertedLeads.reduce(
      (sum, l) => sum + Number(l.contractValue || 0),
      0
    );
    const avgContractValue =
      convertedLeads.length > 0 ? totalRevenue / convertedLeads.length : 0;

    // By source
    const sourceCounts = await db.lead.groupBy({
      by: ["source"],
      where: dateFilter,
      _count: { id: true },
    });
    const sourceConverted = await db.lead.groupBy({
      by: ["source"],
      where: { ...dateFilter, status: "CONVERTED" },
      _count: { id: true },
    });
    const sourceConvertedMap: Record<string, number> = {};
    for (const row of sourceConverted) {
      sourceConvertedMap[row.source] = row._count.id;
    }

    const bySource = sourceCounts.map((row) => {
      const converted = sourceConvertedMap[row.source] || 0;
      return {
        source: row.source,
        count: row._count.id,
        converted,
        conversionRate:
          row._count.id > 0
            ? Math.round((converted / row._count.id) * 10000) / 100
            : 0,
        avgContractValue: 0,
      };
    });

    // By city
    const cityCounts = await db.lead.groupBy({
      by: ["city"],
      where: { ...dateFilter, city: { not: null } },
      _count: { id: true },
    });
    const cityConverted = await db.lead.groupBy({
      by: ["city"],
      where: { ...dateFilter, status: "CONVERTED", city: { not: null } },
      _count: { id: true },
    });
    const cityConvertedMap: Record<string, number> = {};
    for (const row of cityConverted) {
      if (row.city) cityConvertedMap[row.city] = row._count.id;
    }
    const byCity = cityCounts
      .filter((r) => r.city)
      .map((row) => ({
        city: row.city!,
        count: row._count.id,
        converted: cityConvertedMap[row.city!] || 0,
      }));

    // By case type
    const caseTypeCounts = await db.lead.groupBy({
      by: ["caseType"],
      where: { ...dateFilter, caseType: { not: null } },
      _count: { id: true },
    });
    const byCaseType = caseTypeCounts
      .filter((r) => r.caseType)
      .map((row) => ({
        caseType: row.caseType!,
        count: row._count.id,
        converted: 0,
        avgContractValue: 0,
      }));

    // Daily leads for chart
    const recentLeads = await db.lead.findMany({
      where: dateFilter,
      select: { createdAt: true, source: true },
      orderBy: { createdAt: "asc" },
    });
    const dailyMap = new Map<string, { count: number; source: string }[]>();
    for (const lead of recentLeads) {
      const date = lead.createdAt.toISOString().split("T")[0];
      if (!dailyMap.has(date)) dailyMap.set(date, []);
      dailyMap.get(date)!.push({ count: 1, source: lead.source });
    }
    const dailyLeads = Array.from(dailyMap.entries()).map(
      ([date, entries]) => ({
        date,
        count: entries.length,
        source: entries[0]?.source || "OTHER",
      })
    );

    const converted = statusMap["CONVERTED"] || 0;
    const data = {
      totalLeads,
      newThisPeriod: statusMap["NEW"] || 0,
      contactedThisPeriod: statusMap["CONTACTED"] || 0,
      qualifiedThisPeriod: statusMap["QUALIFIED"] || 0,
      convertedThisPeriod: converted,
      conversionRate:
        periodLeads > 0
          ? Math.round((converted / periodLeads) * 10000) / 100
          : 0,
      averageContractValue: Math.round(avgContractValue),
      totalRevenue: Math.round(totalRevenue),
      bySource,
      byCity,
      byCaseType,
      dailyLeads,
      responseTime: { average: 0, median: 0 },
    };

    await redis.set(cacheKey, data, { ex: 300 });
    return apiSuccess(data);
  } catch (error) {
    console.error("[api/leads/stats] GET failed:", error);
    return apiError("Error al obtener estadísticas", 500);
  }
}
