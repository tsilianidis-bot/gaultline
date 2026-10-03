/**
 * PLATO chat-model guard.
 *
 * The previous policy matched the live catalog with an exact id lookup and,
 * when nothing matched, took the first three catalog ids. Gemini's catalog
 * returns `models/`-prefixed ids, so nothing matched and the first three ids
 * on the production key were `gemini-2.5-flash`, `gemini-2.5-pro` and
 * `gemini-2.5-flash-preview-tts`: a text-to-speech model could be sent PLATO
 * chat traffic. That catalog-guess path is removed. PLATO models now come
 * only from the explicit chain in `server/plato/config.ts`, and every id in
 * that chain passes through the guard below.
 */

/** Gemini list endpoints prefix ids with `models/`. Chat calls expect the bare id. */
export function canonicalChatModelId(id: string): string {
  return id.trim().replace(/^models\//, "");
}

const NON_CHAT_MODEL =
  /embed|imagen|image-generation|text-to-speech|transcribe|(?:^|[^a-z])tts(?:[^a-z]|$)|(?:^|[^a-z])aqa(?:[^a-z]|$)|(?:^|[^a-z])veo(?:[^a-z]|$)|lyria|native-audio|(?:^|[^a-z])live(?:[^a-z]|$)/i;

/** True for TTS, embedding, image, video, audio and transcription models. They never serve PLATO chat. */
export function isKnownNonChatModel(id: string): boolean {
  return NON_CHAT_MODEL.test(canonicalChatModelId(id));
}
