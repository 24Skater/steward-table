import { pupusaSaleTemplate } from "./pupusa-sale";
import { bakeSaleTemplate } from "./bake-sale";
import { coffeeHourTemplate } from "./coffee-hour";
import { fundraiserDinnerTemplate } from "./fundraiser-dinner";

export type { CatalogTemplate, CatalogTemplateItem, CatalogTemplateModifierGroup } from "./types";

export {
  pupusaSaleTemplate,
  bakeSaleTemplate,
  coffeeHourTemplate,
  fundraiserDinnerTemplate,
};

export const CATALOG_TEMPLATES = [
  pupusaSaleTemplate,
  bakeSaleTemplate,
  coffeeHourTemplate,
  fundraiserDinnerTemplate,
];

export const CATALOG_TEMPLATE_MAP: Record<string, (typeof CATALOG_TEMPLATES)[number]> =
  Object.fromEntries(CATALOG_TEMPLATES.map((t) => [t.key, t]));
