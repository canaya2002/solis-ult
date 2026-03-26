// SOLIS AI — Semrush API wrapper
import { ratelimit, redis } from "@/lib/redis";
import type {
  DomainOverview,
  OrganicKeyword,
  KeywordDifficulty,
  CompetitorDomain,
  KeywordGapResult,
} from "@/types/analytics";

const BASE_URL = "https://api.semrush.com";
const CACHE_TTL = 21600; // 6 hours

function getApiKey(): string | null {
  return process.env.SEMRUSH_API_KEY || null;
}

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

async function semrushFetch(params: Record<string, string>): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error("API_KEY not configured: SEMRUSH_API_KEY");

  const { success } = await ratelimit.limit("semrush");
  if (!success) throw new Error("Rate limit exceeded for Semrush API");

  const searchParams = new URLSearchParams({ ...params, key });
  const response = await fetch(`${BASE_URL}/?${searchParams.toString()}`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Semrush API error ${response.status}: ${text}`);
  }

  return response.text();
}

function parseSemrushCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(";");
  return lines.slice(1).map((line) => {
    const values = line.split(";");
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || "";
    });
    return obj;
  });
}

export async function getDomainOverview(
  domain = "manuelsolis.com",
  database = "us"
): Promise<DomainOverview | null> {
  const cacheKey = `semrush:overview:${domain}:${database}`;
  const cached = await redis.get<DomainOverview>(cacheKey);
  if (cached) return cached;

  try {
    const raw = await withRetry(() =>
      semrushFetch({
        type: "domain_ranks",
        export_columns: "Dn,Rk,Or,Ot,Oc,Ad,At,Ac",
        domain,
        database,
      })
    );

    const rows = parseSemrushCSV(raw);
    if (!rows.length) return null;

    const r = rows[0];
    const overview: DomainOverview = {
      domain: r["Dn"] || domain,
      rank: parseInt(r["Rk"] || "0", 10),
      organicKeywords: parseInt(r["Or"] || "0", 10),
      organicTraffic: parseInt(r["Ot"] || "0", 10),
      organicCost: parseFloat(r["Oc"] || "0"),
      adKeywords: parseInt(r["Ad"] || "0", 10),
      adTraffic: parseInt(r["At"] || "0", 10),
      adCost: parseFloat(r["Ac"] || "0"),
    };

    await redis.set(cacheKey, overview, { ex: CACHE_TTL });
    console.info(
      `[semrush] getDomainOverview: ${domain}, rank ${overview.rank}`
    );
    return overview;
  } catch (error) {
    console.error("[semrush] getDomainOverview failed:", error);
    return null;
  }
}

export async function getOrganicKeywords(
  domain = "manuelsolis.com",
  limit = 50,
  database = "us"
): Promise<OrganicKeyword[]> {
  const cacheKey = `semrush:organic:${domain}:${database}:${limit}`;
  const cached = await redis.get<OrganicKeyword[]>(cacheKey);
  if (cached) return cached;

  try {
    const raw = await withRetry(() =>
      semrushFetch({
        type: "domain_organic",
        export_columns: "Ph,Po,Pp,Nq,Cp,Ur,Tr,Tc",
        domain,
        database,
        display_limit: String(limit),
      })
    );

    const rows = parseSemrushCSV(raw);
    const keywords: OrganicKeyword[] = rows.map((r) => ({
      keyword: r["Ph"] || "",
      position: parseInt(r["Po"] || "0", 10),
      previousPosition: parseInt(r["Pp"] || "0", 10),
      volume: parseInt(r["Nq"] || "0", 10),
      cpc: parseFloat(r["Cp"] || "0"),
      url: r["Ur"] || "",
      traffic: parseFloat(r["Tr"] || "0"),
      trafficPercent: parseFloat(r["Tc"] || "0"),
    }));

    await redis.set(cacheKey, keywords, { ex: CACHE_TTL });
    console.info(
      `[semrush] getOrganicKeywords: ${keywords.length} keywords for ${domain}`
    );
    return keywords;
  } catch (error) {
    console.error("[semrush] getOrganicKeywords failed:", error);
    return [];
  }
}

export async function getKeywordDifficulty(
  keywords: string[],
  database = "us"
): Promise<KeywordDifficulty[]> {
  const results: KeywordDifficulty[] = [];

  for (const keyword of keywords) {
    const cacheKey = `semrush:kd:${keyword}:${database}`;
    const cached = await redis.get<KeywordDifficulty>(cacheKey);
    if (cached) {
      results.push(cached);
      continue;
    }

    try {
      const raw = await withRetry(() =>
        semrushFetch({
          type: "phrase_all",
          export_columns: "Ph,Nq,Cp,Co,Nr",
          phrase: keyword,
          database,
        })
      );

      const rows = parseSemrushCSV(raw);
      if (!rows.length) continue;

      const r = rows[0];
      const kd: KeywordDifficulty = {
        keyword: r["Ph"] || keyword,
        difficulty: parseFloat(r["Co"] || "0"),
        volume: parseInt(r["Nq"] || "0", 10),
        cpc: parseFloat(r["Cp"] || "0"),
        results: parseInt(r["Nr"] || "0", 10),
      };

      await redis.set(cacheKey, kd, { ex: CACHE_TTL });
      results.push(kd);
    } catch (error) {
      console.error(
        `[semrush] getKeywordDifficulty "${keyword}" failed:`,
        error
      );
    }
  }

  console.info(
    `[semrush] getKeywordDifficulty: ${results.length}/${keywords.length} keywords`
  );
  return results;
}

export async function getCompetitorDomains(
  domain = "manuelsolis.com",
  database = "us"
): Promise<CompetitorDomain[]> {
  const cacheKey = `semrush:competitors:${domain}:${database}`;
  const cached = await redis.get<CompetitorDomain[]>(cacheKey);
  if (cached) return cached;

  try {
    const raw = await withRetry(() =>
      semrushFetch({
        type: "domain_organic_organic",
        export_columns: "Dn,Np,Or,Ot",
        domain,
        database,
        display_limit: "20",
      })
    );

    const rows = parseSemrushCSV(raw);
    const competitors: CompetitorDomain[] = rows.map((r) => ({
      domain: r["Dn"] || "",
      commonKeywords: parseInt(r["Np"] || "0", 10),
      organicKeywords: parseInt(r["Or"] || "0", 10),
      organicTraffic: parseInt(r["Ot"] || "0", 10),
    }));

    await redis.set(cacheKey, competitors, { ex: CACHE_TTL });
    console.info(
      `[semrush] getCompetitorDomains: ${competitors.length} competitors for ${domain}`
    );
    return competitors;
  } catch (error) {
    console.error("[semrush] getCompetitorDomains failed:", error);
    return [];
  }
}

export async function getKeywordGap(
  domain = "manuelsolis.com",
  competitors: string[] = [],
  database = "us"
): Promise<KeywordGapResult[]> {
  if (!competitors.length) {
    const autoCompetitors = await getCompetitorDomains(domain, database);
    competitors = autoCompetitors.slice(0, 3).map((c) => c.domain);
  }

  if (!competitors.length) return [];

  try {
    const ownKeywords = await getOrganicKeywords(domain, 200, database);
    const ownKeywordSet = new Set(ownKeywords.map((k) => k.keyword));

    const gapResults: KeywordGapResult[] = [];

    for (const competitor of competitors) {
      const compKeywords = await getOrganicKeywords(
        competitor,
        200,
        database
      );
      for (const ck of compKeywords) {
        if (!ownKeywordSet.has(ck.keyword) && ck.volume > 50) {
          const existing = gapResults.find(
            (g) => g.keyword === ck.keyword
          );
          if (existing) {
            existing.competitorPositions[competitor] = ck.position;
          } else {
            gapResults.push({
              keyword: ck.keyword,
              volume: ck.volume,
              difficulty: 0,
              competitorPositions: { [competitor]: ck.position },
            });
          }
        }
      }
    }

    const sorted = gapResults
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 50);
    console.info(
      `[semrush] getKeywordGap: ${sorted.length} gap keywords found`
    );
    return sorted;
  } catch (error) {
    console.error("[semrush] getKeywordGap failed:", error);
    return [];
  }
}
