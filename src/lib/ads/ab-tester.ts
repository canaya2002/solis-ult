// SOLIS AI — Creative A/B Testing Engine
// Creates multi-variant tests, monitors results, identifies winners.
import { db } from "@/lib/db";
import { metaAdsRatelimit } from "@/lib/redis";
import { analyzeContent } from "@/lib/ai/claude";
import { generateCopy } from "@/lib/ai/openai";
import { sendNotification } from "@/lib/notifications/notification-engine";
import { createCampaign, createAdSet, createAd, uploadAdImage, type CampaignObjective } from "./campaign-creator";

const BASE_URL = "https://graph.facebook.com/v21.0";

function getToken(): string {
  const t = process.env.META_ACCESS_TOKEN;
  if (!t) throw new Error("META_ACCESS_TOKEN not configured");
  return t;
}

async function adsFetch<T>(endpoint: string): Promise<T> {
  const token = getToken();
  const { success } = await metaAdsRatelimit.limit("meta-ads-ab");
  if (!success) throw new Error("Rate limit exceeded");
  const sep = endpoint.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE_URL}${endpoint}${sep}access_token=${token}`);
  if (!res.ok) throw new Error(`Meta API ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ABTestVariant {
  name: string;
  mediaUrl: string;
  copy: string;
  imageHash?: string;
  adSetId?: string;
  adId?: string;
}

export interface ABTestPlan {
  id: string;
  name: string;
  variants: ABTestVariant[];
  totalDailyBudget: number;
  testDuration: number;
  status: "pending_approval" | "running" | "analyzing" | "completed";
}

export interface ABTestResults {
  testId: string;
  winner: { variantIndex: number; name: string; cpl: number; ctr: number; leads: number };
  losers: Array<{ variantIndex: number; name: string; cpl: number; ctr: number; leads: number }>;
  recommendation: string;
  confidence: "high" | "medium" | "low";
  actions: { scaleWinner: { newBudget: number }; pauseLosers: string[] };
}

// ─── City keys for targeting ───────────────────────────────────────────────────

const DEFAULT_CITIES = [
  { key: "2418956", radius: 25, distance_unit: "mile" },
  { key: "2379574", radius: 25, distance_unit: "mile" },
  { key: "2420379", radius: 25, distance_unit: "mile" },
  { key: "2425539", radius: 25, distance_unit: "mile" },
];

// ─── Create A/B Test Plan ──────────────────────────────────────────────────────

export async function createABTest(params: {
  campaignName: string;
  mediaUrls: string[];
  copies?: string[];
  dailyBudgetPerVariant: number;
  testDuration: number;
  cities?: string[];
}): Promise<ABTestPlan> {
  const { campaignName, mediaUrls, dailyBudgetPerVariant, testDuration } = params;

  // Generate copies if not provided
  let copies = params.copies || [];
  if (!copies.length) {
    try {
      const result = await generateCopy({
        topic: campaignName,
        platform: "facebook",
        tone: "professional",
        language: "es",
      });
      copies = result.map(v => v.caption);
    } catch {
      copies = [`Consulta gratuita disponible. Llama ahora. manuelsolis.com`];
    }
  }

  // Create variant matrix: media x copy (limit to manageable number)
  const variants: ABTestVariant[] = [];
  const maxVariants = 6;
  let idx = 0;

  for (const mediaUrl of mediaUrls) {
    for (const copy of copies) {
      if (idx >= maxVariants) break;
      variants.push({
        name: `V${idx + 1} — Media${mediaUrls.indexOf(mediaUrl) + 1} + Copy${copies.indexOf(copy) + 1}`,
        mediaUrl,
        copy,
      });
      idx++;
    }
    if (idx >= maxVariants) break;
  }

  const totalDailyBudget = dailyBudgetPerVariant * variants.length;
  const planId = `abtest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const plan: ABTestPlan = {
    id: planId,
    name: campaignName,
    variants,
    totalDailyBudget,
    testDuration,
    status: "pending_approval",
  };

  // Save to DB
  const dbTest = await db.aBTest.create({
    data: {
      name: campaignName,
      variants: JSON.parse(JSON.stringify(variants)),
      dailyBudget: totalDailyBudget,
      testDuration,
    },
  });

  // Notification
  await sendNotification({
    type: "strategy_recommendation",
    title: `A/B Test listo: ${variants.length} variantes`,
    message: `${campaignName}\n${variants.length} variantes, $${totalDailyBudget}/d\u00eda total, ${testDuration}h de duraci\u00f3n.\n\u00bfAprobamos?`,
    actionUrl: `/ads/ab-tests?testId=${dbTest.id}`,
    actionLabel: "Revisar y aprobar test",
    priority: "medium",
    data: { testId: dbTest.id },
    remindAfterMinutes: [240, 1440],
  });

  console.info(`[ab-tester] Created test plan: ${dbTest.id}, ${variants.length} variants`);
  return { ...plan, id: dbTest.id };
}

// ─── Execute Approved Test ─────────────────────────────────────────────────────

export async function executeABTest(testId: string): Promise<{ campaignId: string }> {
  const test = await db.aBTest.findUnique({ where: { id: testId } });
  if (!test) throw new Error("Test not found");
  if (test.status !== "PENDING") throw new Error(`Test already ${test.status}`);

  const variants = test.variants as unknown as ABTestVariant[];
  const budgetPerVariant = Math.round((Number(test.dailyBudget) / variants.length) * 100); // cents

  // Create campaign
  const { campaignId } = await createCampaign({
    name: `A/B Test — ${test.name}`,
    objective: "OUTCOME_LEADS" as CampaignObjective,
    dailyBudget: Math.round(Number(test.dailyBudget) * 100),
    specialAdCategories: ["HOUSING"],
    status: "PAUSED",
  });

  // Create one ad set + ad per variant
  const updatedVariants: ABTestVariant[] = [];
  for (const variant of variants) {
    // Upload image
    let imageHash: string | undefined;
    try {
      const upload = await uploadAdImage(variant.mediaUrl);
      imageHash = upload.imageHash;
    } catch { /* skip if upload fails */ }

    const { adSetId } = await createAdSet({
      campaignId,
      name: variant.name,
      dailyBudget: budgetPerVariant,
      targeting: {
        geoLocations: { cities: DEFAULT_CITIES.map(c => ({ key: c.key, name: c.key })) },
        locales: [24, 6],
      },
      optimizationGoal: "LEAD_GENERATION",
      billingEvent: "IMPRESSIONS",
      isHousingCategory: true,
      status: "PAUSED",
    });

    const { adId } = await createAd({
      adSetId,
      name: variant.name,
      creative: {
        message: variant.copy,
        imageHash,
        callToAction: { type: "CONTACT_US", link: "https://manuelsolis.com" },
      },
      status: "PAUSED",
    });

    updatedVariants.push({ ...variant, imageHash, adSetId, adId });
  }

  await db.aBTest.update({
    where: { id: testId },
    data: {
      status: "RUNNING",
      metaCampaignId: campaignId,
      variants: JSON.parse(JSON.stringify(updatedVariants)),
      startedAt: new Date(),
    },
  });

  console.info(`[ab-tester] Test ${testId} executing: campaign=${campaignId}, ${updatedVariants.length} variants`);
  return { campaignId };
}

// ─── Analyze Results ───────────────────────────────────────────────────────────

export async function analyzeABTest(testId: string): Promise<ABTestResults> {
  const test = await db.aBTest.findUnique({ where: { id: testId } });
  if (!test) throw new Error("Test not found");

  const variants = test.variants as unknown as ABTestVariant[];
  const variantMetrics: Array<{ idx: number; name: string; spend: number; impressions: number; clicks: number; leads: number; cpl: number; ctr: number }> = [];

  // Fetch insights for each variant's ad set
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    if (!v.adSetId) continue;

    try {
      const data = await adsFetch<{ data: Array<{ spend: string; impressions: string; clicks: string; actions?: Array<{ action_type: string; value: string }> }> }>(
        `/${v.adSetId}/insights?fields=spend,impressions,clicks,actions`
      );

      const row = data.data?.[0];
      if (!row) { variantMetrics.push({ idx: i, name: v.name, spend: 0, impressions: 0, clicks: 0, leads: 0, cpl: 999, ctr: 0 }); continue; }

      const spend = parseFloat(row.spend || "0");
      const impressions = parseInt(row.impressions || "0", 10);
      const clicks = parseInt(row.clicks || "0", 10);
      const leads = row.actions?.filter(a => a.action_type === "lead" || a.action_type === "offsite_conversion.fb_pixel_lead").reduce((s, a) => s + parseInt(a.value, 10), 0) || 0;

      variantMetrics.push({
        idx: i, name: v.name, spend, impressions, clicks, leads,
        cpl: leads > 0 ? spend / leads : 999,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      });
    } catch {
      variantMetrics.push({ idx: i, name: v.name, spend: 0, impressions: 0, clicks: 0, leads: 0, cpl: 999, ctr: 0 });
    }
  }

  // Sort by CPL (lower is better)
  variantMetrics.sort((a, b) => a.cpl - b.cpl);

  const winner = variantMetrics[0];
  const losers = variantMetrics.slice(1);
  const totalImpressions = variantMetrics.reduce((s, v) => s + v.impressions, 0);
  const confidence: "high" | "medium" | "low" = totalImpressions > 1000 ? "high" : totalImpressions > 300 ? "medium" : "low";

  // AI recommendation
  const prompt = `Resultados del A/B test "${test.name}":\n${variantMetrics.map(v =>
    `${v.name}: CPL=$${v.cpl.toFixed(2)}, CTR=${v.ctr.toFixed(2)}%, Leads=${v.leads}, Spend=$${v.spend.toFixed(2)}`
  ).join("\n")}\n\nConfianza: ${confidence}. Genera una recomendaci\u00f3n concisa (2-3 oraciones) sobre qu\u00e9 hacer.`;

  let recommendation = `Variante ganadora: ${winner.name} con CPL de $${winner.cpl.toFixed(2)}.`;
  try {
    recommendation = await analyzeContent(prompt, "Eres un analista de Meta Ads. S\u00e9 directo y conciso.");
  } catch { /* use default */ }

  const results: ABTestResults = {
    testId,
    winner: { variantIndex: winner.idx, name: winner.name, cpl: winner.cpl, ctr: winner.ctr, leads: winner.leads },
    losers: losers.map(l => ({ variantIndex: l.idx, name: l.name, cpl: l.cpl, ctr: l.ctr, leads: l.leads })),
    recommendation,
    confidence,
    actions: {
      scaleWinner: { newBudget: Math.round(Number(test.dailyBudget) * 1.5) },
      pauseLosers: losers.map(l => variants[l.idx]?.adSetId || "").filter(Boolean),
    },
  };

  // Update DB
  await db.aBTest.update({
    where: { id: testId },
    data: {
      status: "COMPLETED",
      winnerId: winner.name,
      results: JSON.parse(JSON.stringify(results)),
      completedAt: new Date(),
    },
  });

  // Notification
  await sendNotification({
    type: "strategy_recommendation",
    title: `A/B Test completado: ${winner.name} gana`,
    message: `CPL ganador: $${winner.cpl.toFixed(2)}\n${recommendation}\n\u00bfEscalar ganador y pausar perdedores?`,
    actionUrl: `/ads/ab-tests?testId=${testId}`,
    actionLabel: "Aplicar resultados",
    priority: "high",
    data: { testId, results },
    remindAfterMinutes: [120, 480],
  });

  return results;
}
