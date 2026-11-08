/**
 * Menoska outbox helper. If metadata.project is missing, this returns null.
 * It must not default to menoska or to another brand.
 */

export type ProductBrand = "proposalyze" | "menoska" | "astoha";

const BRANDS = new Set<ProductBrand>(["proposalyze", "menoska", "astoha"]);

export function resolveProductBrand(candidates: Array<string | null | undefined>): ProductBrand | null {
  for (const raw of candidates) {
    const key = (raw ?? "").trim().toLowerCase();
    if (BRANDS.has(key as ProductBrand)) return key as ProductBrand;
  }
  return null;
}
