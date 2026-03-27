// SOLIS AI — Knowledge Base CRUD API
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/utils";
import { getKnowledgeEntries, upsertKnowledge, deleteKnowledge } from "@/lib/knowledge/immigration-kb";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;
    const entries = await getKnowledgeEntries(category);
    return apiSuccess({ entries });
  } catch (error) {
    console.error("[api/knowledge] GET failed:", error);
    return apiError("Error", 500);
  }
}

const upsertSchema = z.object({ category: z.string().min(1), key: z.string().min(1), value: z.string().min(1) });
const deleteSchema = z.object({ id: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);
    const entry = await upsertKnowledge(parsed.data.category, parsed.data.key, parsed.data.value);
    return apiSuccess(entry);
  } catch (error) {
    console.error("[api/knowledge] POST failed:", error);
    return apiError("Error", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);
    await deleteKnowledge(parsed.data.id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("[api/knowledge] DELETE failed:", error);
    return apiError("Error", 500);
  }
}
