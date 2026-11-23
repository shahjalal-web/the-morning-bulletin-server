import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { checkPopular } from "../src/modules/article/article.popular-watch.js";
import { Article } from "../src/shared/models.js";
import { seedDatabase } from "../src/seed/run.js";
import { useTestApp } from "./helpers.js";

describe("most-read webhook", () => {
  const ctx = useTestApp();
  beforeEach(async () => {
    await seedDatabase();
  });

  it("refreshes the site only when the most-read stories or their order change", async () => {
    const calls: string[][] = [];
    const revalidate = async (tags: string[]) => void calls.push(tags);
    const at = (minutes: number) => new Date(Date.now() + minutes * 60_000);
    const interval = 15 * 60_000;
    const view = (id: unknown, n: number) =>
      Promise.all(Array.from({ length: n }, () => request(ctx.app).post(`/api/v1/articles/${id}/view`).send({}).expect(204)));
    const [a, b] = await Article.find({ locale: "en" }).limit(2);

    // First check records the lists and refreshes once.
    expect(await checkPopular(revalidate, interval, at(0))).toEqual(["bn", "en"]);
    expect(calls).toEqual([["popular"]]);

    // More views that do not change the order: no refresh.
    await view(a!._id, 3);
    expect(await checkPopular(revalidate, interval, at(16))).toEqual(["en"]);
    await view(a!._id, 2);
    expect(await checkPopular(revalidate, interval, at(32))).toEqual([]);
    expect(calls).toHaveLength(2);

    // Checked again too soon (e.g. by another server instance): skipped.
    await view(b!._id, 10);
    expect(await checkPopular(revalidate, interval, at(33))).toEqual([]);

    // The order changed: one refresh of the "popular" tag only.
    expect(await checkPopular(revalidate, interval, at(48))).toEqual(["en"]);
    expect(calls).toEqual([["popular"], ["popular"], ["popular"]]);
  });
});
