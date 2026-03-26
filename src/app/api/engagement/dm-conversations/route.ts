// SOLIS AI — DM Conversations API
import { redis } from "@/lib/redis";
import { apiSuccess, apiError } from "@/lib/utils";

export async function GET() {
  try {
    // Scan Redis for active DM conversations
    const keys: string[] = [];
    let cursor: string | number = 0;
    do {
      const result = await redis.scan(cursor, { match: "dm:conversation:*", count: 100 });
      cursor = result[0] as string | number;
      keys.push(...result[1]);
    } while (cursor !== 0);

    const conversations: Array<{
      senderId: string;
      senderName: string;
      platform: string;
      currentState: string;
      lastMessageAt: string;
      startedAt: string;
    }> = [];

    for (const key of keys) {
      const data = await redis.get<{
        state: string;
        senderName: string;
        platform: string;
        startedAt: string;
        lastMessageAt: string;
      }>(key);
      if (data) {
        conversations.push({
          senderId: key.replace("dm:conversation:", ""),
          senderName: data.senderName,
          platform: data.platform,
          currentState: data.state,
          lastMessageAt: data.lastMessageAt,
          startedAt: data.startedAt,
        });
      }
    }

    conversations.sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    return apiSuccess({ conversations, total: conversations.length });
  } catch (error) {
    console.error("[api/engagement/dm-conversations] GET failed:", error);
    return apiError("Error al obtener conversaciones", 500);
  }
}
