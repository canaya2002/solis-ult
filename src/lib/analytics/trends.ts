// SOLIS AI — Google Trends wrapper
// NOTE: Uses google-trends-api npm package. Install: npm install google-trends-api
// There are no official type definitions, so we use dynamic imports.
import { redis } from "@/lib/redis";
import type { TrendData, RelatedQuery, TrendReport } from "@/types/analytics";

const CACHE_TTL_SHORT = 300; // 5 min for daily trends
const CACHE_TTL_LONG = 3600; // 1 hour for interest over time

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((r) => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  throw new Error("Max retries reached");
}

async function loadTrendsApi(): Promise<{
  interestOverTime: (params: {
    keyword: string | string[];
    geo?: string;
    startTime?: Date;
  }) => Promise<string>;
  relatedQueries: (params: {
    keyword: string;
    geo?: string;
  }) => Promise<string>;
  dailyTrends: (params: { geo?: string }) => Promise<string>;
}> {
  try {
    const mod = await import("google-trends-api");
    return mod.default || mod;
  } catch {
    throw new Error(
      "google-trends-api not installed. Run: npm install google-trends-api"
    );
  }
}

export async function getInterestOverTime(
  keywords: string[],
  geo = "US",
  timeRange?: string
): Promise<TrendData[]> {
  const cacheKey = `trends:iot:${keywords.join(",")}:${geo}`;
  const cached = await redis.get<TrendData[]>(cacheKey);
  if (cached) return cached;

  try {
    const googleTrends = await loadTrendsApi();
    const startTime = timeRange
      ? new Date(timeRange)
      : new Date(Date.now() - 90 * 86400000);

    const results: TrendData[] = [];

    for (const keyword of keywords) {
      const raw = await withRetry(() =>
        googleTrends.interestOverTime({
          keyword,
          geo,
          startTime,
        })
      );
      const parsed = JSON.parse(raw) as {
        default?: {
          timelineData?: Array<{
            formattedTime: string;
            value: number[];
          }>;
        };
      };

      const timeline = parsed.default?.timelineData || [];
      const timelineData = timeline.map((d) => ({
        date: d.formattedTime,
        value: d.value[0] || 0,
      }));
      const avg =
        timelineData.length > 0
          ? timelineData.reduce((s, d) => s + d.value, 0) /
            timelineData.length
          : 0;

      results.push({
        keyword,
        timelineData,
        averageInterest: Math.round(avg),
      });
    }

    await redis.set(cacheKey, results, { ex: CACHE_TTL_LONG });
    console.info(
      `[trends] getInterestOverTime: ${results.length} keywords analyzed`
    );
    return results;
  } catch (error) {
    console.error("[trends] getInterestOverTime failed:", error);
    return [];
  }
}

export async function getRelatedQueries(
  keyword: string,
  geo = "US"
): Promise<RelatedQuery[]> {
  const cacheKey = `trends:rq:${keyword}:${geo}`;
  const cached = await redis.get<RelatedQuery[]>(cacheKey);
  if (cached) return cached;

  try {
    const googleTrends = await loadTrendsApi();

    const raw = await withRetry(() =>
      googleTrends.relatedQueries({ keyword, geo })
    );
    const parsed = JSON.parse(raw) as {
      default?: {
        rankedList?: Array<{
          rankedKeyword: Array<{
            query: string;
            value: number;
          }>;
        }>;
      };
    };

    const lists = parsed.default?.rankedList || [];
    const results: RelatedQuery[] = [];

    if (lists[0]) {
      for (const item of lists[0].rankedKeyword) {
        results.push({ query: item.query, value: item.value, type: "top" });
      }
    }
    if (lists[1]) {
      for (const item of lists[1].rankedKeyword) {
        results.push({
          query: item.query,
          value: item.value,
          type: "rising",
        });
      }
    }

    await redis.set(cacheKey, results, { ex: CACHE_TTL_LONG });
    console.info(
      `[trends] getRelatedQueries "${keyword}": ${results.length} queries`
    );
    return results;
  } catch (error) {
    console.error("[trends] getRelatedQueries failed:", error);
    return [];
  }
}

export async function getDailyTrends(geo = "US"): Promise<string[]> {
  const cacheKey = `trends:daily:${geo}`;
  const cached = await redis.get<string[]>(cacheKey);
  if (cached) return cached;

  try {
    const googleTrends = await loadTrendsApi();

    const raw = await withRetry(() => googleTrends.dailyTrends({ geo }));
    const parsed = JSON.parse(raw) as {
      default?: {
        trendingSearchesDays?: Array<{
          trendingSearches: Array<{
            title: { query: string };
          }>;
        }>;
      };
    };

    const days = parsed.default?.trendingSearchesDays || [];
    const trends: string[] = [];
    for (const day of days) {
      for (const search of day.trendingSearches) {
        trends.push(search.title.query);
      }
    }

    const unique = [...new Set(trends)].slice(0, 20);
    await redis.set(cacheKey, unique, { ex: CACHE_TTL_SHORT });
    console.info(`[trends] getDailyTrends: ${unique.length} trends`);
    return unique;
  } catch (error) {
    console.error("[trends] getDailyTrends failed:", error);
    return [];
  }
}

const IMMIGRATION_KEYWORDS = [
  "immigration",
  "inmigración",
  "USCIS",
  "TPS",
  "asylum",
  "green card",
  "visa de trabajo",
  "deportation defense",
  "DACA",
  "parole humanitario",
];

export async function getImmigrationTrends(): Promise<TrendReport> {
  const empty: TrendReport = {
    trendingKeywords: [],
    risingQueries: [],
    topQueries: [],
    timestamp: new Date(),
  };

  try {
    const interestData = await getInterestOverTime(IMMIGRATION_KEYWORDS, "US");

    const trendingKeywords = interestData
      .filter((d) => d.averageInterest > 30)
      .sort((a, b) => b.averageInterest - a.averageInterest)
      .map((d) => d.keyword);

    const allRelated: RelatedQuery[] = [];
    for (const keyword of IMMIGRATION_KEYWORDS.slice(0, 5)) {
      const related = await getRelatedQueries(keyword, "US");
      allRelated.push(...related);
    }

    const risingQueries = allRelated
      .filter((q) => q.type === "rising")
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
    const topQueries = allRelated
      .filter((q) => q.type === "top")
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);

    const report: TrendReport = {
      trendingKeywords,
      risingQueries,
      topQueries,
      timestamp: new Date(),
    };
    console.info(
      `[trends] getImmigrationTrends: ${trendingKeywords.length} trending, ${risingQueries.length} rising`
    );
    return report;
  } catch (error) {
    console.error("[trends] getImmigrationTrends failed:", error);
    return empty;
  }
}
