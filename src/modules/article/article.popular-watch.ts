import { Schema, model } from "mongoose";
import { logger } from "../../lib/logger.js";
import { type Revalidator } from "../../lib/revalidate.js";
import { LOCALES, type Locale } from "../../shared/constants.js";
import { popularArticles } from "./article.service.js";

/**
 * Keeps the site's "Most read" list fresh without rebuilding pages on every view.
 * Once an hour (POPULAR_CHECK_MS) it compares the current top stories with the last ones it saw and,
 * only when the stories or their order changed, asks the site to refresh the "popular" tag.
 * The snapshot lives in the database because serverless instances share no memory.
 */

/** The site shows the top five. */
const WATCHED = 5;

interface PopularSnapshotDoc {
  locale: Locale;
  ids: string;
  checkedAt: Date;
}

const popularSnapshotSchema = new Schema<PopularSnapshotDoc>(
  {
    locale: { type: String, enum: LOCALES, required: true, unique: true },
    ids: { type: String, default: "" },
    checkedAt: { type: Date, required: true },
  },
  { versionKey: false },
);

export const PopularSnapshot = model<PopularSnapshotDoc>("PopularSnapshot", popularSnapshotSchema);

/** Returns the locales whose list changed (and refreshes the site when any did). */
export async function checkPopular(revalidate: Revalidator, intervalMs: number, now = new Date()): Promise<Locale[]> {
  const changed: Locale[] = [];
  for (const locale of LOCALES) {
    // Another instance may have checked moments ago.
    const last = await PopularSnapshot.findOne({ locale }).lean();
    if (last && now.getTime() - last.checkedAt.getTime() < intervalMs) continue;
    const ids = (await popularArticles(locale, WATCHED)).map((a) => a.id).join(",");
    await PopularSnapshot.updateOne({ locale }, { $set: { ids, checkedAt: now } }, { upsert: true });
    if (!last || last.ids !== ids) changed.push(locale);
  }
  if (changed.length) await revalidate(["popular"]);
  return changed;
}

/** Serverless: runs on incoming requests, at most once per interval in each instance. */
export function createThrottledPopularCheck(revalidate: Revalidator, intervalMs: number): () => Promise<void> {
  let nextRun = 0;
  return async () => {
    if (Date.now() < nextRun) return;
    nextRun = Date.now() + intervalMs;
    try {
      const changed = await checkPopular(revalidate, intervalMs);
      if (changed.length) logger.info({ changed }, "most-read list changed; site refreshed");
    } catch (err) {
      logger.error({ err }, "most-read check failed");
    }
  };
}

/** Long-running server: checks on a timer. */
export function startPopularWatch(revalidate: Revalidator, intervalMs: number): () => void {
  const run = createThrottledPopularCheck(revalidate, intervalMs);
  const timer = setInterval(() => void run(), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
