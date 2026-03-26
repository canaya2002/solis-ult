// SOLIS AI — Reviews API
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const source = searchParams.get("source");
    const office = searchParams.get("office");
    const ratingMin = searchParams.get("ratingMin");
    const ratingMax = searchParams.get("ratingMax");
    const rating = searchParams.get("rating");
    const responseStatus = searchParams.get("responseStatus");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

    const where: Record<string, unknown> = {};
    if (source) where.source = source;
    if (office) where.officeName = office;
    if (responseStatus) where.responseStatus = responseStatus;
    if (rating) {
      where.rating = parseInt(rating, 10);
    } else if (ratingMin || ratingMax) {
      where.rating = {
        ...(ratingMin ? { gte: parseInt(ratingMin, 10) } : {}),
        ...(ratingMax ? { lte: parseInt(ratingMax, 10) } : {}),
      };
    }

    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.review.count({ where }),
    ]);

    // Stats
    const allReviews = await db.review.findMany({
      select: { rating: true, officeName: true, source: true, responseStatus: true, createdAt: true },
    });

    const totalReviews = allReviews.length;
    const averageRating = totalReviews > 0
      ? Math.round((allReviews.reduce((s, r) => s + r.rating, 0) / totalReviews) * 10) / 10
      : 0;

    const byOffice: Record<string, { count: number; avgRating: number }> = {};
    const byRating: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const thisMonth = new Date();
    thisMonth.setDate(1);
    let monthCount = 0;
    let responded = 0;

    for (const r of allReviews) {
      byRating[r.rating] = (byRating[r.rating] || 0) + 1;
      if (!byOffice[r.officeName]) byOffice[r.officeName] = { count: 0, avgRating: 0 };
      byOffice[r.officeName].count++;
      if (r.createdAt >= thisMonth) monthCount++;
      if (r.responseStatus === "PUBLISHED") responded++;
    }
    for (const [name, data] of Object.entries(byOffice)) {
      const officeReviews = allReviews.filter((r) => r.officeName === name);
      data.avgRating = Math.round((officeReviews.reduce((s, r) => s + r.rating, 0) / officeReviews.length) * 10) / 10;
    }

    return apiSuccess({
      reviews,
      pagination: { page, limit, total },
      stats: {
        averageRating,
        totalReviews,
        byOffice,
        byRating,
        thisMonth: monthCount,
        respondedPercent: totalReviews > 0 ? Math.round((responded / totalReviews) * 100) : 0,
      },
    });
  } catch (error) {
    console.error("[api/reviews] GET failed:", error);
    return apiError("Error al obtener reviews", 500);
  }
}
