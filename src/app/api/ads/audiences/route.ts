// SOLIS AI — Audiences API route
import { getCampaigns, getAdSets } from "@/lib/social/meta-ads";
import { redis } from "@/lib/redis";
import { apiSuccess, apiError } from "@/lib/utils";

export async function GET() {
  try {
    const cacheKey = "ads:audiences";
    const cached = await redis.get(cacheKey);
    if (cached) return apiSuccess(cached);

    const campaigns = await getCampaigns();
    const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE");

    type AudienceRow = {
      adSetId: string;
      adSetName: string;
      campaignName: string;
      targeting: {
        ageMin?: number;
        ageMax?: number;
        genders?: number[];
        geoLocations?: Record<string, unknown>;
        interests?: Array<{ id: string; name: string }>;
      };
      spend: number;
      leads: number;
      cpl: number;
    };

    const audiences: AudienceRow[] = [];

    for (const campaign of activeCampaigns) {
      const adSets = await getAdSets(campaign.id);
      for (const adSet of adSets) {
        const targeting = adSet.targeting as Record<string, unknown>;
        audiences.push({
          adSetId: adSet.id,
          adSetName: adSet.name,
          campaignName: campaign.name,
          targeting: {
            ageMin: targeting.age_min as number | undefined,
            ageMax: targeting.age_max as number | undefined,
            genders: targeting.genders as number[] | undefined,
            geoLocations: targeting.geo_locations as
              | Record<string, unknown>
              | undefined,
            interests: targeting.flexible_spec
              ? ((targeting.flexible_spec as Array<{ interests?: Array<{ id: string; name: string }> }>)[0]
                  ?.interests ?? [])
              : [],
          },
          spend: adSet.dailyBudget,
          leads: 0,
          cpl: 0,
        });
      }
    }

    const data = { audiences };
    await redis.set(cacheKey, data, { ex: 300 });
    return apiSuccess(data);
  } catch (error) {
    console.error("[api/ads/audiences] GET failed:", error);
    return apiError("Error al obtener audiencias", 500);
  }
}
