import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { seedDatabase } from "../src/seed/run.js";
import { Category, Media } from "../src/shared/models.js";
import { staff, useTestApp } from "./helpers.js";

describe("photo gallery stories", () => {
  const ctx = useTestApp();
  beforeEach(async () => {
    await seedDatabase();
  });

  it("publishes several photos, each with its own description, in the chosen order", async () => {
    const editor = await staff("editor");
    const photos = await Media.find().limit(3).lean();
    expect(photos.length).toBe(3);
    const cat = await Category.findOne({ "slug.en": "national" });
    const base = {
      locale: "bn",
      format: "gallery",
      title: "আজকের ছবি: রাজধানীর এক দিন",
      summary: "রাজধানীর নানা প্রান্তের কয়েকটি মুহূর্ত, ক্যামেরায় ধরা।",
      body: "",
      category: String(cat!._id),
    };

    // One photo is not a gallery yet.
    const one = await request(ctx.app)
      .post("/api/v1/admin/articles")
      .set(editor.auth)
      .send({ ...base, gallery: [{ media: String(photos[0]!._id), caption: "কমলাপুর মেট্রো স্টেশন", credit: "মেহেদী হাসান" }] });
    expect(one.status).toBe(201);
    const blocked = await request(ctx.app).post(`/api/v1/admin/articles/${one.body.data.id}/transition`).set(editor.auth).send({ action: "publish", version: one.body.data.version });
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.details.checklist).toContain("gallery");

    // Three photos, no body text: publishes, and the captions are plain text.
    const order = [photos[2]!, photos[0]!, photos[1]!];
    const saved = await request(ctx.app)
      .patch(`/api/v1/admin/articles/${one.body.data.id}`)
      .set(editor.auth)
      .send({
        version: one.body.data.version,
        gallery: order.map((p, i) => ({ media: String(p._id), caption: i === 0 ? "<b>কমলাপুর</b> মেট্রো স্টেশন" : `ছবি ${i + 1}`, credit: i === 0 ? "রাশেদ সুমন" : "" })),
      });
    expect(saved.status).toBe(200);
    const pub = await request(ctx.app).post(`/api/v1/admin/articles/${one.body.data.id}/transition`).set(editor.auth).send({ action: "publish", version: saved.body.data.version });
    expect(pub.status).toBe(200);

    const story = (await request(ctx.app).get(`/api/v1/articles/by-slug/${encodeURIComponent(pub.body.data.slug)}?locale=bn`)).body.data;
    expect(story.format).toBe("gallery");
    expect(story.gallery.map((g: { id: string }) => g.id)).toEqual(order.map((p) => String(p._id)));
    expect(story.gallery[0]).toMatchObject({ caption: "কমলাপুর মেট্রো স্টেশন", credit: "রাশেদ সুমন" });
    expect(story.gallery[1].caption).toBe("ছবি 2");

    // A photo used in a gallery counts as in use in the media library.
    const lib = await request(ctx.app).get("/api/v1/admin/media?limit=50").set(editor.auth);
    const used = lib.body.data.find((m: { id: string }) => m.id === String(order[1]!._id));
    expect(used.usageCount).toBeGreaterThan(0);
  });

  it("rejects an unknown photo in a gallery", async () => {
    const editor = await staff("editor");
    const res = await request(ctx.app)
      .post("/api/v1/admin/articles")
      .set(editor.auth)
      .send({ locale: "en", format: "gallery", title: "Gallery", gallery: [{ media: "0123456789abcdef01234567", caption: "x" }] });
    expect(res.status).toBe(422);
  });
});
