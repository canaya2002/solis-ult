// SOLIS AI — SEO Brief API
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { generateSEOBriefFull } from "@/lib/seo/seo-advisor";
import { apiSuccess, apiError } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const latest = searchParams.get("latest");
    const id = searchParams.get("id");

    if (id) {
      const brief = await db.sEOBrief.findUnique({ where: { id } });
      if (!brief) return apiError("Brief no encontrado", 404);
      return apiSuccess(brief);
    }

    if (latest === "true") {
      const brief = await db.sEOBrief.findFirst({ orderBy: { createdAt: "desc" } });
      return apiSuccess(brief);
    }

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);

    const [briefs, total] = await Promise.all([
      db.sEOBrief.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      db.sEOBrief.count(),
    ]);

    return apiSuccess({ briefs, pagination: { page, limit, total } });
  } catch (error) {
    console.error("[api/seo/brief] GET failed:", error);
    return apiError("Error al obtener SEO brief", 500);
  }
}

export async function POST() {
  try {
    const brief = await generateSEOBriefFull();
    return apiSuccess(brief);
  } catch (error) {
    console.error("[api/seo/brief] POST failed:", error);
    return apiError("Error al generar SEO brief", 500);
  }
}
