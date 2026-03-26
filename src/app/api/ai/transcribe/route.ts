// SOLIS AI — Audio Transcription API
import { NextRequest } from "next/server";
import { transcribeAudio } from "@/lib/ai/openai";
import { uploadMedia, deleteMedia } from "@/lib/storage/supabase-storage";
import { apiSuccess, apiError } from "@/lib/utils";

const MAX_SIZE = 100 * 1024 * 1024; // 100MB
const ACCEPTED = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/webm",
  "video/mp4",
];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) return apiError("No se proporcionó archivo de audio");

    if (file.size > MAX_SIZE) {
      return apiError("El archivo excede el límite de 100MB");
    }

    if (!ACCEPTED.includes(file.type)) {
      return apiError(
        `Formato no soportado: ${file.type}. Usa MP3, M4A, WAV, MP4 o WebM.`
      );
    }

    // Upload to temp storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await uploadMedia(
      buffer,
      `temp-${file.name}`,
      file.type
    );

    if ("error" in uploadResult) {
      return apiError(`Error al subir archivo: ${uploadResult.error}`);
    }

    // Transcribe
    const language =
      (formData.get("language") as string) || "es";
    const result = await transcribeAudio(buffer, language);

    // Clean up temp file
    deleteMedia(uploadResult.path).catch(() => {});

    if (!result.text) {
      return apiError("No se pudo transcribir el audio");
    }

    console.info(
      `[transcribe] ${result.duration}s audio, ${result.segments.length} segments`
    );
    return apiSuccess(result);
  } catch (error) {
    console.error("[api/ai/transcribe] POST failed:", error);
    return apiError("Error al transcribir audio", 500);
  }
}
