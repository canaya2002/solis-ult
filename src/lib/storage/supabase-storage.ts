// SOLIS AI — Supabase Storage helper
import { createClient } from "@supabase/supabase-js";

const BUCKET = "content-media";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function ensureBucket(client: ReturnType<typeof createClient>) {
  const { data } = await client.storage.getBucket(BUCKET);
  if (!data) {
    await client.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 104857600, // 100MB
      allowedMimeTypes: [
        "image/*",
        "video/*",
        "audio/*",
      ],
    });
    console.info(`[storage] Created bucket "${BUCKET}"`);
  }
}

export async function uploadMedia(
  file: File | Buffer,
  fileName: string,
  contentType: string
): Promise<{ url: string; path: string } | { error: string }> {
  const client = getClient();
  if (!client) {
    return { error: "Supabase not configured" };
  }

  try {
    await ensureBucket(client);

    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${timestamp}-${safeName}`;

    const body = file instanceof Buffer ? file : file;
    const { error } = await client.storage
      .from(BUCKET)
      .upload(path, body, { contentType, upsert: false });

    if (error) {
      console.error("[storage] Upload failed:", error.message);
      return { error: error.message };
    }

    const { data: urlData } = client.storage
      .from(BUCKET)
      .getPublicUrl(path);

    console.info(`[storage] Uploaded: ${path}`);
    return { url: urlData.publicUrl, path };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    console.error("[storage] uploadMedia error:", msg);
    return { error: msg };
  }
}

export async function deleteMedia(path: string): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    const { error } = await client.storage.from(BUCKET).remove([path]);
    if (error) {
      console.error("[storage] Delete failed:", error.message);
      return false;
    }
    console.info(`[storage] Deleted: ${path}`);
    return true;
  } catch {
    return false;
  }
}

export function getMediaUrl(path: string): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "";
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`;
}
