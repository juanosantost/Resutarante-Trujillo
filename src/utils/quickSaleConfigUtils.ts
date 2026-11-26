import { QuickSaleVisibilityConfig } from '../types';

export const DEFAULT_QUICK_SALE_CONFIG: QuickSaleVisibilityConfig = {
  hiddenCategoryIds: [],
  hiddenProductIds: [],
};

/**
 * Normaliza y deduplica la configuración de visibilidad de Venta Rápida
 * proveniente de Firestore o estado local.
 */
export function normalizeQuickSaleConfig(
  raw: Partial<QuickSaleVisibilityConfig> | null | undefined
): QuickSaleVisibilityConfig {
  const hiddenCategoryIds = Array.isArray(raw?.hiddenCategoryIds)
    ? Array.from(
        new Set(
          raw.hiddenCategoryIds
            .filter((id): id is string => typeof id === 'string')
            .map((id) => id.trim())
            .filter(Boolean)
        )
      )
    : [];

  const hiddenProductIds = Array.isArray(raw?.hiddenProductIds)
    ? Array.from(
        new Set(
          raw.hiddenProductIds
            .filter((id): id is string => typeof id === 'string')
            .map((id) => id.trim())
            .filter(Boolean)
        )
      )
    : [];

  return {
    hiddenCategoryIds,
    hiddenProductIds,
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : undefined,
    updatedBy: typeof raw?.updatedBy === 'string' ? raw.updatedBy : undefined,
  };
}

/**
 * Indica si una categoría está visible en el espacio de Venta Rápida.
 */
export function isCategoryVisibleInQuickSale(
  categoryId: string,
  config: QuickSaleVisibilityConfig
): boolean {
  if (!categoryId) return true;
  return !config.hiddenCategoryIds.includes(categoryId);
}

/**
 * Indica si un producto está visible en el espacio de Venta Rápida.
 * Un producto está oculto si su categoría está oculta o si el producto fue ocultado individualmente.
 */
export function isProductVisibleInQuickSale(
  product: { id: string; categoryId?: string },
  config: QuickSaleVisibilityConfig
): boolean {
  if (!product?.id) return false;
  if (product.categoryId && config.hiddenCategoryIds.includes(product.categoryId)) {
    return false;
  }
  if (config.hiddenProductIds.includes(product.id)) {
    return false;
  }
  return true;
}

/**
 * Filtra las categorías visibles en Venta Rápida.
 */
export function filterQuickSaleCategories<T extends { id: string }>(
  categories: T[],
  config: QuickSaleVisibilityConfig
): T[] {
  return categories.filter((c) => isCategoryVisibleInQuickSale(c.id, config));
}

/**
 * Filtra los productos visibles en Venta Rápida.
 */
export function filterQuickSaleProducts<T extends { id: string; categoryId?: string }>(
  products: T[],
  config: QuickSaleVisibilityConfig
): T[] {
  return products.filter((p) => isProductVisibleInQuickSale(p, config));
}

/**
 * Alterna la visibilidad de una categoría completa en Venta Rápida.
 * - Si está visible (con al menos un producto visible), oculta la categoría completa.
 * - Si está oculta (o todos sus productos estaban ocultos), muestra la categoría y todos sus productos.
 */
export function toggleQuickSaleCategory(
  config: QuickSaleVisibilityConfig,
  categoryId: string,
  categoryProductIds: string[]
): QuickSaleVisibilityConfig {
  const normalized = normalizeQuickSaleConfig(config);
  const catHidden = normalized.hiddenCategoryIds.includes(categoryId);
  const allProductsIndividuallyHidden =
    categoryProductIds.length > 0 &&
    categoryProductIds.every((pid) => normalized.hiddenProductIds.includes(pid));

  const shouldShow = catHidden || allProductsIndividuallyHidden;

  if (shouldShow) {
    const productSet = new Set(categoryProductIds);
    return {
      ...normalized,
      hiddenCategoryIds: normalized.hiddenCategoryIds.filter((id) => id !== categoryId),
      hiddenProductIds: normalized.hiddenProductIds.filter((id) => !productSet.has(id)),
    };
  }

  return {
    ...normalized,
    hiddenCategoryIds: [...normalized.hiddenCategoryIds, categoryId],
  };
}

/**
 * Alterna la visibilidad de un producto individual en Venta Rápida.
 * - Si está visible, lo oculta individualmente.
 * - Si está oculto porque su categoría estaba oculta, activa la categoría manteniendo
 *   ocultos los demás productos de esa categoría y dejando visible solo este producto.
 * - Si estaba oculto individualmente, simplemente lo vuelve a mostrar.
 */
export function toggleQuickSaleProduct(
  config: QuickSaleVisibilityConfig,
  productId: string,
  categoryId: string | undefined,
  siblingProductIds: string[]
): QuickSaleVisibilityConfig {
  const normalized = normalizeQuickSaleConfig(config);
  const currentlyVisible = isProductVisibleInQuickSale({ id: productId, categoryId }, normalized);

  if (currentlyVisible) {
    return {
      ...normalized,
      hiddenProductIds: Array.from(new Set([...normalized.hiddenProductIds, productId])),
    };
  }

  // Actualmente oculto -> hacerlo visible
  const catWasHidden = Boolean(categoryId && normalized.hiddenCategoryIds.includes(categoryId));

  if (catWasHidden && categoryId) {
    const otherSiblings = siblingProductIds.filter((id) => id !== productId);
    const nextHiddenProducts = Array.from(
      new Set([
        ...normalized.hiddenProductIds.filter((id) => id !== productId),
        ...otherSiblings,
      ])
    );
    return {
      ...normalized,
      hiddenCategoryIds: normalized.hiddenCategoryIds.filter((id) => id !== categoryId),
      hiddenProductIds: nextHiddenProducts,
    };
  }

  return {
    ...normalized,
    hiddenProductIds: normalized.hiddenProductIds.filter((id) => id !== productId),
  };
}

/**
 * Muestra todos los productos y categorías, u oculta todas las categorías y productos actuales.
 */
export function setAllQuickSaleVisibility(
  allCategoryIds: string[],
  allUncategorizedProductIds: string[],
  visible: boolean
): QuickSaleVisibilityConfig {
  if (visible) {
    return {
      hiddenCategoryIds: [],
      hiddenProductIds: [],
    };
  }

  return {
    hiddenCategoryIds: Array.from(new Set(allCategoryIds)),
    hiddenProductIds: Array.from(new Set(allUncategorizedProductIds)),
  };
}
