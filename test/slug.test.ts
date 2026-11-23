import { describe, expect, it } from "vitest";
import { SLUG_MAX_BYTES, slugify } from "../src/lib/text.js";

describe("slugify", () => {
  it("keeps long Bangla slugs within the file-name limit, ending on a whole word", () => {
    const title = "অগ্নিসংযোগ ও হত্যার রাজনীতি কোন ভাবেই বরদাশত করা হবে না: গণপূর্ত প্রতিমন্ত্রী আহম্মদ সোহেল মনজুর";
    const slug = slugify(title);
    expect(Buffer.byteLength(slug)).toBeLessThanOrEqual(SLUG_MAX_BYTES);
    expect(slug.startsWith("অগ্নিসংযোগ-ও-হত্যার-রাজনীতি")).toBe(true);
    expect(slug.replace(/-/g, " ")).toBe(title.replace(/:/g, "").split(" ").slice(0, slug.split("-").length).join(" "));
  });

  it("leaves short slugs and English slugs unchanged", () => {
    expect(slugify("বৃষ্টির সম্ভাবনা ৬০ শতাংশ")).toBe("বৃষ্টির-সম্ভাবনা-৬০-শতাংশ");
    expect(slugify("The week in pictures: mountains, sea")).toBe("the-week-in-pictures-mountains-sea");
  });
});
