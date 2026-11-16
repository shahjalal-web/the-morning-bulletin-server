import type { Types } from "mongoose";
import type { Locale, Localized } from "../../shared/constants.js";
import { pick } from "../../shared/localize.js";

export interface LeanCategory {
  _id: Types.ObjectId;
  name: Localized;
  slug: Localized;
  description?: Localized;
  parent?: Types.ObjectId | null;
  order?: number;
  showInMenu?: boolean;
}

export function serializeCategory(c: LeanCategory, locale: Locale) {
  return {
    id: String(c._id),
    name: pick(c.name, locale),
    slug: pick(c.slug, locale),
    description: pick(c.description, locale),
    parentId: c.parent ? String(c.parent) : null,
    inMenu: c.showInMenu !== false,
    alternates: { bn: c.slug.bn ?? null, en: c.slug.en ?? null },
  };
}
