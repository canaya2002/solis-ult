// SOLIS AI — Immigration Knowledge Base
// Enriches ALL AI prompts with up-to-date immigration context.
// Editable by the legal team via /settings/knowledge.
import { db } from "@/lib/db";

// ─── Default Knowledge (seeded if DB is empty) ────────────────────────────────

const DEFAULTS: Array<{ category: string; key: string; value: string }> = [
  {
    category: "visa_types",
    key: "asylum",
    value: "Asilo: Protecci\u00f3n para personas perseguidas por raza, religi\u00f3n, nacionalidad, opini\u00f3n pol\u00edtica o grupo social. Plazo: 1 a\u00f1o desde llegada a EEUU. Proceso: formulario I-589, entrevista con oficial de asilo.",
  },
  {
    category: "visa_types",
    key: "tps",
    value: "TPS (Estatus de Protecci\u00f3n Temporal): Para nacionales de pa\u00edses con condiciones peligrosas. Pa\u00edses actuales incluyen: Venezuela, El Salvador, Honduras, Guatemala, Haiti, Nicaragua, entre otros. Se renueva peri\u00f3dicamente.",
  },
  {
    category: "visa_types",
    key: "greencard",
    value: "Residencia Permanente (Green Card): V\u00eda familiar (esposo/a, hijos, padres ciudadanos), laboral, o asilo concedido. Tiempos var\u00edan de 1 a 20+ a\u00f1os seg\u00fan categor\u00eda y pa\u00eds de origen.",
  },
  {
    category: "visa_types",
    key: "citizenship",
    value: "Ciudadan\u00eda (Naturalizaci\u00f3n): Requiere 5 a\u00f1os como residente permanente (3 si por matrimonio con ciudadano). Examen de ingl\u00e9s y c\u00edvica. Formulario N-400.",
  },
  {
    category: "visa_types",
    key: "work_visa",
    value: "Visas de Trabajo: H-1B (profesionales), H-2A (agr\u00edcola), H-2B (temporal no agr\u00edcola), L-1 (transferencia intracompa\u00f1\u00eda), O-1 (habilidades extraordinarias).",
  },
  {
    category: "visa_types",
    key: "deportation",
    value: "Defensa de Deportaci\u00f3n: Opciones incluyen cancelaci\u00f3n de remoci\u00f3n (10 a\u00f1os de presencia), asilo defensivo, ajuste de estatus, salida voluntaria. Crucial actuar r\u00e1pido.",
  },
  {
    category: "terminology",
    key: "common_terms",
    value: "USCIS = Servicio de Ciudadan\u00eda e Inmigraci\u00f3n. ICE = Servicio de Inmigraci\u00f3n y Control de Aduanas. NTA = Notice to Appear (Aviso de comparecencia). EAD = Employment Authorization Document (Permiso de trabajo). RFE = Request for Evidence.",
  },
  {
    category: "demographics",
    key: "dallas",
    value: "Dallas-Fort Worth: ~1.5M hispanos, comunidades grandes de mexicanos, salvadore\u00f1os, guatemaltecos. Alta demanda de TPS y asilo.",
  },
  {
    category: "demographics",
    key: "chicago",
    value: "Chicago: ~800K hispanos, comunidad mexicana grande, creciente poblaci\u00f3n centroamericana y venezolana.",
  },
  {
    category: "demographics",
    key: "la",
    value: "Los \u00c1ngeles: >4.5M hispanos, la mayor concentraci\u00f3n del pa\u00eds. Alta competencia de abogados de inmigraci\u00f3n.",
  },
  {
    category: "demographics",
    key: "memphis",
    value: "Memphis: Comunidad hispana creciente (~60K), menos competencia legal, oportunidad de mercado.",
  },
];

// ─── Core Functions ────────────────────────────────────────────────────────────

export async function getImmigrationContext(): Promise<string> {
  // Ensure defaults exist
  for (const d of DEFAULTS) {
    await db.knowledgeBase.upsert({
      where: { category_key: { category: d.category, key: d.key } },
      update: {},
      create: d,
    });
  }

  const entries = await db.knowledgeBase.findMany({
    orderBy: [{ category: "asc" }, { key: "asc" }],
  });

  const grouped = new Map<string, string[]>();
  for (const e of entries) {
    if (!grouped.has(e.category)) grouped.set(e.category, []);
    grouped.get(e.category)!.push(`${e.key}: ${e.value}`);
  }

  const sections: string[] = [];
  const labels: Record<string, string> = {
    visa_types: "TIPOS DE CASO",
    terminology: "TERMINOLOG\u00cdA",
    demographics: "DEMOGRAF\u00cdA POR CIUDAD",
    uscis_dates: "FECHAS IMPORTANTES USCIS",
    law_changes: "CAMBIOS RECIENTES DE LEY",
  };

  for (const [cat, items] of grouped) {
    sections.push(`\n${labels[cat] || cat.toUpperCase()}:\n${items.join("\n")}`);
  }

  return sections.join("\n");
}

export async function getKnowledgeEntries(category?: string) {
  const where = category ? { category } : {};
  return db.knowledgeBase.findMany({ where, orderBy: [{ category: "asc" }, { key: "asc" }] });
}

export async function upsertKnowledge(category: string, key: string, value: string) {
  return db.knowledgeBase.upsert({
    where: { category_key: { category, key } },
    update: { value },
    create: { category, key, value },
  });
}

export async function deleteKnowledge(id: string) {
  return db.knowledgeBase.delete({ where: { id } });
}
