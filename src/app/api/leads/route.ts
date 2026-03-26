// SOLIS AI — Leads CRUD API
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { sendLeadFollowUp } from "@/lib/comms/twilio";
import { apiSuccess, apiError } from "@/lib/utils";
import type { LeadSource, LeadStatus } from "@prisma/client";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  source: z.string(),
  caseType: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
  sendFollowUp: z.boolean().optional(),
});

const patchSchema = z.object({
  leadId: z.string().min(1),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"]).optional(),
  notes: z.string().optional(),
  contractValue: z.number().positive().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const source = searchParams.get("source") as LeadSource | null;
    const status = searchParams.get("status") as LeadStatus | null;
    const city = searchParams.get("city");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

    const cacheKey = `leads:${source || "all"}:${status || "all"}:${page}:${search || ""}`;
    const cached = await redis.get(cacheKey);
    if (cached) return apiSuccess(cached);

    const where: Record<string, unknown> = {};
    if (source) where.source = source;
    if (status) where.status = status;
    if (city) where.city = city;
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }

    const [leads, total] = await Promise.all([
      db.lead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.lead.count({ where }),
    ]);

    // Counts for filters
    const [
      totalAll,
      newCount,
      contactedCount,
      qualifiedCount,
      convertedCount,
      lostCount,
    ] = await Promise.all([
      db.lead.count(),
      db.lead.count({ where: { status: "NEW" } }),
      db.lead.count({ where: { status: "CONTACTED" } }),
      db.lead.count({ where: { status: "QUALIFIED" } }),
      db.lead.count({ where: { status: "CONVERTED" } }),
      db.lead.count({ where: { status: "LOST" } }),
    ]);

    const sourceCountsRaw = await db.lead.groupBy({
      by: ["source"],
      _count: { id: true },
    });
    const bySource: Record<string, number> = {};
    for (const row of sourceCountsRaw) {
      bySource[row.source] = row._count.id;
    }

    const data = {
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      counts: {
        total: totalAll,
        new: newCount,
        contacted: contactedCount,
        qualified: qualifiedCount,
        converted: convertedCount,
        lost: lostCount,
        bySource,
      },
    };

    await redis.set(cacheKey, data, { ex: 60 });
    return apiSuccess(data);
  } catch (error) {
    console.error("[api/leads] GET failed:", error);
    return apiError("Error al obtener leads", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    const { name, email, phone, source, caseType, city, notes, sendFollowUp } =
      parsed.data;

    const lead = await db.lead.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        source: source as LeadSource,
        caseType: caseType || null,
        city: city || null,
        notes: notes || null,
      },
    });

    if (sendFollowUp && phone) {
      sendLeadFollowUp({ name, phone, caseType }).catch((e) =>
        console.error("[api/leads] Follow-up failed:", e)
      );
      await db.lead.update({
        where: { id: lead.id },
        data: { status: "CONTACTED" },
      });
    }

    // Invalidate cache
    const keys = await redis.keys("leads:*");
    if (keys.length) await redis.del(...keys);

    return apiSuccess(lead);
  } catch (error) {
    console.error("[api/leads] POST failed:", error);
    return apiError("Error al crear lead", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    const { leadId, status, notes, contractValue } = parsed.data;

    const existing = await db.lead.findUnique({ where: { id: leadId } });
    if (!existing) return apiError("Lead no encontrado", 404);

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (notes !== undefined) {
      updateData.notes = existing.notes
        ? `${existing.notes}\n[${new Date().toISOString()}] ${notes}`
        : notes;
    }

    if (status === "CONVERTED") {
      updateData.convertedAt = new Date();
      if (contractValue) updateData.contractValue = contractValue;
    }

    const updated = await db.lead.update({
      where: { id: leadId },
      data: updateData,
    });

    // Audit log
    await db.auditLog.create({
      data: {
        action: "lead_status_updated",
        entity: "Lead",
        entityId: leadId,
        details: {
          previousStatus: existing.status,
          newStatus: status,
          contractValue,
        },
      },
    });

    // Invalidate cache
    const keys = await redis.keys("leads:*");
    if (keys.length) await redis.del(...keys);

    return apiSuccess(updated);
  } catch (error) {
    console.error("[api/leads] PATCH failed:", error);
    return apiError("Error al actualizar lead", 500);
  }
}
