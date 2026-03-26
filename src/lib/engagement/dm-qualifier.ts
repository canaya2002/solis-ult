// SOLIS AI — DM Lead Qualifier conversational state machine
import { qualifyLead } from "@/lib/ai/openai";
import { sendLeadFollowUp } from "@/lib/comms/twilio";
import { sendLeadAlert } from "@/lib/comms/resend";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

type ConversationState =
  | "INITIAL"
  | "AWAITING_INTENT"
  | "AWAITING_CASE_TYPE"
  | "AWAITING_CITY"
  | "AWAITING_PHONE"
  | "AWAITING_QUESTION"
  | "CLOSED";

interface ConversationData {
  state: ConversationState;
  senderName: string;
  platform: "facebook" | "instagram";
  caseType?: string;
  city?: string;
  phone?: string;
  startedAt: string;
  lastMessageAt: string;
}

export interface DMResponse {
  message: string;
  createLead: boolean;
  leadData?: {
    name: string;
    phone?: string;
    source: string;
    caseType?: string;
    city?: string;
  };
  conversationClosed: boolean;
}

const PHONE = "(214) 414-4414";
const WEBSITE = "manuelsolis.com";
const TTL = 86400; // 24h

function convoKey(senderId: string) {
  return `dm:conversation:${senderId}`;
}

async function getConversation(senderId: string): Promise<ConversationData | null> {
  return redis.get<ConversationData>(convoKey(senderId));
}

async function setConversation(senderId: string, data: ConversationData) {
  await redis.set(convoKey(senderId), data, { ex: TTL });
}

function extractPhone(text: string): string | null {
  const cleaned = text.replace(/[\s\-().]/g, "");
  const match = cleaned.match(/\+?1?\d{10,11}/);
  return match ? match[0] : null;
}

const CASE_KEYWORDS: Record<string, string[]> = {
  asylum: ["asilo", "asylum", "persecución", "miedo", "país"],
  tps: ["tps", "status temporal", "protección temporal"],
  greencard: ["residencia", "green card", "tarjeta verde", "permanente"],
  citizenship: ["ciudadanía", "citizenship", "naturalización", "pasaporte"],
  work_visa: ["visa de trabajo", "work visa", "permiso de trabajo", "h1b", "h-1b"],
  deportation_defense: ["deportación", "deportation", "removal", "ice", "detención"],
  daca: ["daca", "dreamers", "acción diferida"],
};

function detectCaseType(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [type, keywords] of Object.entries(CASE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return type;
  }
  return null;
}

const CITIES = ["dallas", "chicago", "los angeles", "la", "memphis", "texas"];

function detectCity(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("dallas")) return "Dallas";
  if (lower.includes("chicago")) return "Chicago";
  if (lower.includes("los angeles") || lower === "la") return "Los Angeles";
  if (lower.includes("memphis")) return "Memphis";
  if (lower.includes("texas") || lower.includes("houston") || lower.includes("austin") || lower.includes("san antonio")) return "Texas (otra ciudad)";
  return null;
}

export async function handleDMMessage(params: {
  platform: "facebook" | "instagram";
  senderId: string;
  senderName: string;
  message: string;
}): Promise<DMResponse> {
  const { platform, senderId, senderName, message } = params;
  let convo = await getConversation(senderId);

  // New conversation
  if (!convo) {
    convo = {
      state: "AWAITING_INTENT",
      senderName,
      platform,
      startedAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
    };
    await setConversation(senderId, convo);

    return {
      message: `¡Hola ${senderName}! Gracias por contactar a Manuel Solís Law Office. ¿En qué te podemos ayudar?\n\n1️⃣ Caso de inmigración nuevo\n2️⃣ Seguimiento de caso existente\n3️⃣ Información general`,
      createLead: false,
      conversationClosed: false,
    };
  }

  convo.lastMessageAt = new Date().toISOString();
  const lower = message.toLowerCase().trim();

  switch (convo.state) {
    case "AWAITING_INTENT": {
      if (lower.includes("1") || lower.includes("nuevo") || lower.includes("caso") || lower.includes("ayuda")) {
        convo.state = "AWAITING_CASE_TYPE";
        await setConversation(senderId, convo);
        return {
          message: `¿Qué tipo de caso necesitas?\n\n• Asilo político\n• TPS (protección temporal)\n• Residencia / Green Card\n• Ciudadanía\n• Visa de trabajo\n• Defensa de deportación\n• DACA\n• Otro`,
          createLead: false,
          conversationClosed: false,
        };
      }
      if (lower.includes("2") || lower.includes("seguimiento") || lower.includes("existente")) {
        convo.state = "CLOSED";
        await setConversation(senderId, convo);
        return {
          message: `Para seguimiento de tu caso, contacta directamente a tu abogado asignado al ${PHONE}. Si no tienes el contacto, escríbenos a info@manuelsolis.com y te conectamos.`,
          createLead: false,
          conversationClosed: true,
        };
      }
      if (lower.includes("3") || lower.includes("información") || lower.includes("info")) {
        convo.state = "AWAITING_QUESTION";
        await setConversation(senderId, convo);
        return {
          message: `Visita ${WEBSITE} para información general sobre nuestros servicios. Si tienes una pregunta específica, escríbela aquí y te orientamos.`,
          createLead: false,
          conversationClosed: false,
        };
      }
      // Default: try to detect intent from free text
      const detectedCase = detectCaseType(lower);
      if (detectedCase) {
        convo.state = "AWAITING_CITY";
        convo.caseType = detectedCase;
        await setConversation(senderId, convo);
        return {
          message: `Entendido. ¿En qué ciudad estás?\n\n• Dallas, TX\n• Chicago, IL\n• Los Ángeles, CA\n• Memphis, TN\n• Otra ciudad en Texas\n• Otra`,
          createLead: false,
          conversationClosed: false,
        };
      }
      convo.state = "AWAITING_CASE_TYPE";
      await setConversation(senderId, convo);
      return {
        message: `Para orientarte mejor, ¿qué tipo de caso necesitas?\n\n• Asilo\n• TPS\n• Residencia / Green Card\n• Ciudadanía\n• Visa de trabajo\n• Defensa de deportación\n• Otro`,
        createLead: false,
        conversationClosed: false,
      };
    }

    case "AWAITING_CASE_TYPE": {
      const detected = detectCaseType(lower);
      convo.caseType = detected || "other";
      convo.state = "AWAITING_CITY";
      await setConversation(senderId, convo);
      return {
        message: `¿En qué ciudad estás?\n\n• Dallas, TX\n• Chicago, IL\n• Los Ángeles, CA\n• Memphis, TN\n• Otra ciudad en Texas\n• Otra`,
        createLead: false,
        conversationClosed: false,
      };
    }

    case "AWAITING_CITY": {
      const city = detectCity(lower) || message.trim();
      convo.city = city;
      convo.state = "AWAITING_PHONE";
      await setConversation(senderId, convo);
      const caseLabel = convo.caseType || "inmigración";
      return {
        message: `Perfecto. Un especialista en ${caseLabel} de nuestra oficina más cercana te contactará pronto. ¿Cuál es tu número de teléfono para darte seguimiento más rápido?`,
        createLead: false,
        conversationClosed: false,
      };
    }

    case "AWAITING_PHONE": {
      const phone = extractPhone(message);
      convo.phone = phone || message.trim();
      convo.state = "CLOSED";
      await setConversation(senderId, convo);

      const source = platform === "facebook" ? "DM_FACEBOOK" : "DM_INSTAGRAM";

      // Create lead
      const lead = await db.lead.create({
        data: {
          name: senderName,
          phone: convo.phone || null,
          source: source as "DM_FACEBOOK" | "DM_INSTAGRAM",
          sourceDetail: `DM ${platform}`,
          status: "NEW",
          caseType: convo.caseType || null,
          city: convo.city || null,
        },
      });

      // Follow-up and alert (async)
      if (convo.phone) {
        sendLeadFollowUp({
          name: senderName,
          phone: convo.phone,
          caseType: convo.caseType,
        }).then(() =>
          db.lead.update({ where: { id: lead.id }, data: { status: "CONTACTED" } })
        ).catch((e) => console.error("[dm-qualifier] Follow-up failed:", e));
      }

      sendLeadAlert({
        name: senderName,
        source: `DM ${platform}`,
        caseType: convo.caseType,
        city: convo.city,
      }).catch((e) => console.error("[dm-qualifier] Alert failed:", e));

      return {
        message: `¡Listo, ${senderName}! Te hemos enviado un mensaje de confirmación. Un abogado te contactará en los próximos minutos.\n\nSi es urgente, llama al ${PHONE}.\n\nGracias por confiar en Manuel Solís Law Office. 🙏`,
        createLead: true,
        leadData: {
          name: senderName,
          phone: convo.phone,
          source,
          caseType: convo.caseType,
          city: convo.city,
        },
        conversationClosed: true,
      };
    }

    case "AWAITING_QUESTION": {
      // Use AI to analyze question
      try {
        const qualification = await qualifyLead([message]);
        if (qualification.urgency >= 3 || qualification.caseType !== "other") {
          convo.caseType = qualification.caseType;
          convo.state = "AWAITING_CITY";
          await setConversation(senderId, convo);
          return {
            message: `Parece que podrías necesitar ayuda con un caso de ${qualification.caseType}. Para conectarte con un especialista, ¿en qué ciudad estás?\n\n• Dallas\n• Chicago\n• Los Ángeles\n• Memphis\n• Otra`,
            createLead: false,
            conversationClosed: false,
          };
        }
      } catch { /* fallback below */ }

      convo.state = "CLOSED";
      await setConversation(senderId, convo);
      return {
        message: `Gracias por tu pregunta. Para darte una respuesta precisa, te recomendamos agendar una consulta con uno de nuestros abogados. Llama al ${PHONE} o visita ${WEBSITE}.\n\n¿Necesitas algo más?`,
        createLead: false,
        conversationClosed: true,
      };
    }

    default: {
      // Conversation was closed, start fresh
      await redis.del(convoKey(senderId));
      return handleDMMessage(params);
    }
  }
}
