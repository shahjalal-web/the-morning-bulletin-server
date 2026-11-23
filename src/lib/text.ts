/**
 * Unicode-aware slug: keeps letters, combining marks (needed for Bangla
 * conjuncts and vowel signs) and digits; everything else becomes a hyphen.
 */
/**
 * Longest slug in UTF-8 bytes. The site stores each prebuilt page in a file named after its
 * slug, and Linux (Vercel) allows 255 bytes per file name. A Bangla letter takes 3 bytes, so
 * 120 letters would overflow; 180 bytes (about 60 Bangla letters) leaves room for "-2" and
 * the file extensions.
 */
export const SLUG_MAX_BYTES = 180;

export function slugify(input: string): string {
  const full = input
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\u200c\u200d]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
  if (Buffer.byteLength(full) <= SLUG_MAX_BYTES) return full;
  // Too long: keep the whole words that fit (a word is cut only when the first one is too long).
  let out = "";
  let bytes = 0;
  for (const ch of full) {
    const size = Buffer.byteLength(ch);
    if (bytes + size > SLUG_MAX_BYTES) break;
    out += ch;
    bytes += size;
  }
  const lastDash = out.lastIndexOf("-");
  if (lastDash > 0) out = out.slice(0, lastDash);
  return out.replace(/-+$/g, "");
}

export const SLUG_PATTERN = /^[\p{Ll}\p{Lo}\p{M}\p{N}]+(?:-[\p{Ll}\p{Lo}\p{M}\p{N}]+)*$/u;

export function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|h[1-6]|li|blockquote|figcaption)>/gi, "$&\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

export function countWords(text: string): number {
  return text.split(/\s+/u).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Reading time in whole minutes (minimum 1). Bangla readers average fewer words per minute. */
export function readingMinutes(text: string, locale: "bn" | "en"): number {
  const wpm = locale === "bn" ? 160 : 220;
  return Math.max(1, Math.round(countWords(text) / wpm));
}

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
