/**
 * User-loaded samples. Pure module: no DOM, no Web Audio.
 *
 * Mirrors the LOAD / CLEAR buttons of gcd8.sampler~ (glima31/gcd8-pd,
 * GPL-3.0). A loaded file is stored inside the project JSON as base64, so
 * SAVE / LOAD carries it, and joins the sample catalog under a numeric id at
 * or above USER_SAMPLE_BASE. The kit WAVs keep their ids, so cell.sample
 * stays a number and resolveCatalogSample works unchanged.
 *
 *   song.userSamples[] = { id, name, mime, data, role, fallback }
 *     data      base64 of the original file
 *     role      the drum role of the channel it was loaded for
 *     fallback  the kit sample the channel used before the load (0 for none).
 *               CLEAR puts it back.
 */

export const USER_SAMPLE_BASE = 1000;
export const MAX_USER_SAMPLE_BYTES = 8 * 1024 * 1024;

export function isUserSampleId(id) {
  const n = Number(id);
  return Number.isInteger(n) && n >= USER_SAMPLE_BASE;
}

export function userSampleUrl(entry) {
  return `data:${entry.mime || "audio/wav"};base64,${entry.data}`;
}

export function userSampleName(fileName) {
  const base = String(fileName || "sample").replace(/\.[^.]+$/, "").replace(/[^\w .()+-]+/g, "_").trim();
  return (base || "sample").slice(0, 40);
}

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Keep only well-formed entries with unique ids. */
export function normalizeUserSamples(list) {
  const out = [];
  const seen = new Set();
  for (const item of Array.isArray(list) ? list : []) {
    const id = Number(item?.id);
    if (!isUserSampleId(id) || seen.has(id)) continue;
    if (typeof item.data !== "string" || !item.data) continue;
    seen.add(id);
    out.push({
      id,
      name: userSampleName(item.name),
      mime: typeof item.mime === "string" && item.mime.startsWith("audio/") ? item.mime : "audio/wav",
      data: item.data,
      role: typeof item.role === "string" ? item.role : "other",
      fallback: Number.isFinite(Number(item.fallback)) ? Math.max(0, Number(item.fallback)) : 0,
    });
  }
  return out;
}

export function nextUserSampleId(catalog, userSamples) {
  let max = USER_SAMPLE_BASE - 1;
  for (const s of catalog || []) if (isUserSampleId(s?.id)) max = Math.max(max, Number(s.id));
  for (const s of userSamples || []) if (isUserSampleId(s?.id)) max = Math.max(max, Number(s.id));
  return max + 1;
}

/** Catalog row for a stored entry. file is null: there is no WAV on the server. */
export function catalogEntryFor(entry) {
  return {
    id: entry.id,
    name: entry.name,
    role: entry.role,
    file: null,
    user: true,
    url: userSampleUrl(entry),
  };
}

/** The catalog without any user rows, plus a row for every stored entry. */
export function mergeUserSamples(catalog, userSamples) {
  const kit = (catalog || []).filter((s) => !s?.user);
  return [...kit, ...normalizeUserSamples(userSamples).map(catalogEntryFor)];
}

/** Count the cells in a song that point at a sample id. */
export function countSampleRefs(song, id) {
  let n = 0;
  for (const pat of song?.patterns || []) {
    for (const column of pat?.data || []) {
      for (const cell of column || []) if (Number(cell?.sample) === Number(id)) n += 1;
    }
  }
  return n;
}
