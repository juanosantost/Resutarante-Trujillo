/**
 * SISTEMA COLMENA RESTAURANTE - Utilidades y Cálculos de Productos (Módulo 03)
 */

import {
  Product,
  ProductVariant,
  ModifierGroup,
  ModifierOption,
  ComboConfig,
  ComboComponentRule,
  Category,
  CustomizedItemSelection,
  ProductAdjustment,
  SelectedModifierDetail,
  RecipeIngredient,
  InventoryUnit,
} from '../types';

export interface PriceBreakdown {
  basePrice: number;
  variantAdjustment: number;
  modifiersSurcharge: number;
  omissionDiscounts: number;
  swapsSurcharge: number;
  discountsAmount: number;
  surchargesAmount: number;
  subtotalBeforeAdjustments: number;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

/**
 * Calcula el precio unitario y total de un producto considerando:
 * - Precio base
 * - Variante seleccionada
 * - Adicionales y modificadores elegidos
 * - Descuentos por no seleccionar categorías del Menú del día (omissionDiscountsTotal)
 * - Posibles recargos por cambio de componentes en combo
 * - Descuentos y recargos comerciales fijos o porcentuales
 */
export function calculateCustomizedProductPrice(
  basePrice: number,
  variant?: ProductVariant | null,
  selectedModifiers: Array<SelectedModifierDetail | ModifierOption> = [],
  swapSurcharges: number[] = [],
  quantity: number = 1,
  adjustments: ProductAdjustment[] = [],
  omissionDiscountsTotal: number = 0
): PriceBreakdown {
  const safeQty = Math.max(1, Math.floor(quantity || 1));
  const variantAdj = variant?.priceAdjustment || 0;
  const modTotal = selectedModifiers.reduce((acc, m) => {
    const surcharge = m.priceSurcharge || 0;
    const qty = 'quantity' in m && typeof m.quantity === 'number' ? m.quantity : 1;
    return acc + surcharge * qty;
  }, 0);
  const swapTotal = swapSurcharges.reduce((acc, s) => acc + (s || 0), 0);
  const safeOmissionDiscount = Math.max(0, omissionDiscountsTotal || 0);

  const subtotalBase = Math.max(0, basePrice + variantAdj + modTotal + swapTotal - safeOmissionDiscount);

  let discountsAmount = 0;
  let surchargesAmount = 0;

  for (const adj of adjustments) {
    if (adj.type === 'descuento') {
      const calc = adj.modality === 'porcentaje' ? Math.round(subtotalBase * (adj.value / 100)) : adj.value;
      discountsAmount += calc;
    } else if (adj.type === 'recargo') {
      const calc = adj.modality === 'porcentaje' ? Math.round(subtotalBase * (adj.value / 100)) : adj.value;
      surchargesAmount += calc;
    }
  }

  const unitPrice = Math.max(0, subtotalBase - discountsAmount + surchargesAmount);
  const totalPrice = unitPrice * safeQty;

  return {
    basePrice,
    variantAdjustment: variantAdj,
    modifiersSurcharge: modTotal,
    omissionDiscounts: safeOmissionDiscount,
    swapsSurcharge: swapTotal,
    discountsAmount,
    surchargesAmount,
    subtotalBeforeAdjustments: subtotalBase,
    unitPrice,
    quantity: safeQty,
    totalPrice,
  };
}

/**
 * Calcula la composición efectiva de inventario aplicando adiciones y remociones de ingredientes de las opciones.
 * Soporta múltiples vinculaciones por opción tanto con Insumos de Inventario como con Productos Comerciales.
 */
export function calculateEffectiveRecipe(
  baseRecipe: RecipeIngredient[] = [],
  selectedModifiers: SelectedModifierDetail[] = [],
  productsList: Product[] = []
): RecipeIngredient[] {
  const recipeMap: Record<string, { name: string; quantity: number; unit: InventoryUnit }> = {};

  for (const item of baseRecipe) {
    recipeMap[item.inventoryItemId] = {
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
    };
  }

  const productMap = new Map(productsList.map((p) => [p.id, p]));

  const applySingleIngredient = (
    ingItem: {
      ingredientType?: 'inventory' | 'product';
      ingredientId?: string;
      ingredientQuantity?: number;
      ingredientAction?: 'add' | 'remove';
    },
    modQty: number,
    optName: string
  ) => {
    if (!ingItem.ingredientId) return;
    const factor = (ingItem.ingredientQuantity || 1) * modQty;
    const action = ingItem.ingredientAction || 'add';

    if (ingItem.ingredientType === 'product') {
      const linkedProduct = productMap.get(ingItem.ingredientId);
      if (linkedProduct) {
        if (linkedProduct.recipe && linkedProduct.recipe.length > 0) {
          for (const ing of linkedProduct.recipe) {
            const qty = ing.quantity * factor;
            if (action === 'remove') {
              if (recipeMap[ing.inventoryItemId]) {
                recipeMap[ing.inventoryItemId].quantity = Math.max(0, recipeMap[ing.inventoryItemId].quantity - qty);
              }
            } else {
              if (recipeMap[ing.inventoryItemId]) {
                recipeMap[ing.inventoryItemId].quantity += qty;
              } else {
                recipeMap[ing.inventoryItemId] = {
                  name: ing.name,
                  quantity: qty,
                  unit: ing.unit,
                };
              }
            }
          }
        } else if (linkedProduct.linkedInventoryItemId) {
          const invId = linkedProduct.linkedInventoryItemId;
          if (action === 'remove') {
            if (recipeMap[invId]) {
              recipeMap[invId].quantity = Math.max(0, recipeMap[invId].quantity - factor);
            }
          } else {
            if (recipeMap[invId]) {
              recipeMap[invId].quantity += factor;
            } else {
              recipeMap[invId] = {
                name: linkedProduct.name,
                quantity: factor,
                unit: 'und',
              };
            }
          }
        }
      }
    } else {
      // Insumo directo de inventario
      const invId = ingItem.ingredientId;
      if (action === 'remove') {
        if (recipeMap[invId]) {
          recipeMap[invId].quantity = Math.max(0, recipeMap[invId].quantity - factor);
        }
      } else {
        if (recipeMap[invId]) {
          recipeMap[invId].quantity += factor;
        } else {
          recipeMap[invId] = {
            name: optName,
            quantity: factor,
            unit: 'und',
          };
        }
      }
    }
  };

  for (const mod of selectedModifiers) {
    const modQty = mod.quantity || 1;
    if (mod.ingredients && mod.ingredients.length > 0) {
      for (const ingItem of mod.ingredients) {
        applySingleIngredient(ingItem, modQty, mod.optionName);
      }
    } else if (mod.ingredientId) {
      applySingleIngredient(
        {
          ingredientType: mod.ingredientType,
          ingredientId: mod.ingredientId,
          ingredientQuantity: mod.ingredientQuantity,
          ingredientAction: mod.ingredientAction,
        },
        modQty,
        mod.optionName
      );
    }
  }

  return Object.entries(recipeMap)
    .filter(([_, val]) => val.quantity > 0)
    .map(([id, val]) => ({
      inventoryItemId: id,
      name: val.name,
      quantity: val.quantity,
      unit: val.unit,
    }));
}

/**
 * Valida si las elecciones de modificadores en un grupo cumplen con las reglas de negocio:
 * - Obligatoriedad (isRequired)
 * - Mínimo de elecciones (minSelections)
 * - Máximo de elecciones (maxSelections)
 * - Modo de selección única vs múltiple
 */
export function validateModifierGroupSelection(
  group: ModifierGroup,
  selectedOptionIds: string[]
): { isValid: boolean; errorMessage?: string } {
  const count = selectedOptionIds.length;

  if (group.isRequired && count === 0) {
    return {
      isValid: false,
      errorMessage: `Debes seleccionar al menos una opción en "${group.name}".`,
    };
  }

  if (count < group.minSelections) {
    return {
      isValid: false,
      errorMessage: `En "${group.name}" debes elegir mínimo ${group.minSelections} ${
        group.minSelections === 1 ? 'opción' : 'opciones'
      }.`,
    };
  }

  if (group.selectionType === 'single' && count > 1) {
    return {
      isValid: false,
      errorMessage: `En "${group.name}" solo puedes seleccionar una única opción.`,
    };
  }

  if (count > group.maxSelections) {
    return {
      isValid: false,
      errorMessage: `En "${group.name}" el máximo permitido es de ${group.maxSelections} ${
        group.maxSelections === 1 ? 'opción' : 'opciones'
      }.`,
    };
  }

  return { isValid: true };
}

/**
 * Comprueba todas las selecciones de modificadores de un producto frente a sus grupos configurados
 */
export function validateAllModifierGroups(
  groups: ModifierGroup[],
  selectionsByGroupId: Record<string, string[]>
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const group of groups) {
    if (!group.isActive) continue;
    const selected = selectionsByGroupId[group.id] || [];
    const res = validateModifierGroupSelection(group, selected);
    if (!res.isValid && res.errorMessage) {
      errors.push(res.errorMessage);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Calcula los ahorros y desglose económico de un combo comercial:
 * - Precio comercial del combo
 * - Suma individual de los ítems que lo componen
 * - Ahorro en COP
 * - Porcentaje de ahorro comercial
 */
export function calculateComboSavings(
  commercialPrice: number,
  componentProducts: Array<{ price: number; name?: string }>
): {
  commercialPrice: number;
  individualItemsSum: number;
  savingsCOP: number;
  savingsPercentage: number;
} {
  const individualItemsSum = componentProducts.reduce((acc, p) => acc + (p.price || 0), 0);
  const savingsCOP = Math.max(0, individualItemsSum - commercialPrice);
  const savingsPercentage =
    individualItemsSum > 0 ? Math.round((savingsCOP / individualItemsSum) * 100) : 0;

  return {
    commercialPrice,
    individualItemsSum,
    savingsCOP,
    savingsPercentage,
  };
}

export interface ProductFilterCriteria {
  searchTerm?: string;
  categoryId?: string;
  branchId?: string;
  status?: string;
  availableForSaleOnly?: boolean;
  availableForDeliveryOnly?: boolean;
  visibleOnly?: boolean;
}

/**
 * Filtra la lista de productos por criterios múltiples:
 * - Búsqueda por texto (Nombre, SKU, Descripción)
 * - Categoría
 * - Sucursal autorizada (coincidencia con branchId o 'all')
 * - Estado operativo
 * - Filtros de disponibilidad
 */
export function filterProducts(
  products: Product[],
  criteria: ProductFilterCriteria
): Product[] {
  return products.filter((p) => {
    // Filtro por sucursal
    if (criteria.branchId && criteria.branchId !== 'all') {
      if (p.branchId && p.branchId !== 'all' && p.branchId !== criteria.branchId) {
        return false;
      }
    }

    // Filtro por categoría
    if (criteria.categoryId && criteria.categoryId !== 'todos') {
      if (p.categoryId !== criteria.categoryId) return false;
    }

    // Filtro por estado
    if (criteria.status && criteria.status !== 'todos') {
      if (p.status !== criteria.status) return false;
    }

    // Disponibilidad
    if (criteria.availableForSaleOnly && !p.isAvailableForSale) return false;
    if (criteria.availableForDeliveryOnly && !p.isAvailableForDelivery) return false;
    if (criteria.visibleOnly && !p.isVisibleInMenu) return false;

    // Búsqueda por término (nombre, sku, descripción)
    if (criteria.searchTerm && criteria.searchTerm.trim() !== '') {
      const q = criteria.searchTerm.toLowerCase().trim();
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchSku = (p.sku || '').toLowerCase().includes(q);
      const matchDesc = (p.description || '').toLowerCase().includes(q);
      if (!matchName && !matchSku && !matchDesc) return false;
    }

    return true;
  });
}

/**
 * Ordena las categorías por su propiedad `order` ascendente
 */
export function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Formato estándar de moneda COP para catálogo gastronómico
 */
export function formatProductPrice(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

/**
 * Coloca el Menú del Día como el primer producto si no se ha definido orden explícito,
 * y respeta displayOrder / globalOrder definidos por el usuario.
 */
export function sortProductsWithDailyFirst<
  T extends { id: string; isDailyMenu?: boolean; displayOrder?: number; globalOrder?: number; name?: string }
>(items: T[], mode: 'category' | 'global' = 'category'): T[] {
  const result = [...items];
  result.sort((a, b) => {
    const orderA = mode === 'global' ? (a.globalOrder ?? a.displayOrder) : (a.displayOrder ?? a.globalOrder);
    const orderB = mode === 'global' ? (b.globalOrder ?? b.displayOrder) : (b.displayOrder ?? b.globalOrder);

    if (typeof orderA === 'number' && typeof orderB === 'number' && orderA !== orderB) {
      return orderA - orderB;
    }
    if (typeof orderA === 'number' && typeof orderB !== 'number') return -1;
    if (typeof orderA !== 'number' && typeof orderB === 'number') return 1;

    const aDaily = a.id === 'prod-almuerzo-del-dia' || Boolean(a.isDailyMenu);
    const bDaily = b.id === 'prod-almuerzo-del-dia' || Boolean(b.isDailyMenu);
    if (aDaily && !bDaily) return -1;
    if (!aDaily && bDaily) return 1;

    return (a.name || '').localeCompare(b.name || '', 'es');
  });
  return result;
}

export function getCatalogGroupByCategoryPreference(): boolean {
  try {
    const saved = localStorage.getItem('colmena_catalog_group_by_category');
    return saved !== null ? saved === 'true' : true;
  } catch {
    return true;
  }
}

export interface GenericCategoryGroup<T> {
  categoryId: string;
  categoryName: string;
  categoryOrder: number;
  isUncategorized: boolean;
  products: T[];
}

export type ProductCategoryGroup = GenericCategoryGroup<Product>;

/**
 * Agrupa cualquier lista de productos o MenuItems por categoría respetando:
 * 1. El orden de las categorías (1°, 2°, 3°...)
 * 2. El orden de los productos dentro de cada categoría (displayOrder: 1°, 2°, 3°...)
 * 3. Un bloque final para productos sin categoría asignada (también ordenados 1°, 2°, 3°...)
 */
export function groupProductsByCategories<
  T extends {
    id: string;
    categoryId?: string;
    isDailyMenu?: boolean;
    displayOrder?: number;
    globalOrder?: number;
    name?: string;
  },
  C extends { id: string; name: string; order?: number }
>(items: T[], categories: C[]): GenericCategoryGroup<T>[] {
  const sortedCats = [...categories].sort((a, b) => (a.order || 0) - (b.order || 0));
  const catMap = new Map<string, C>();
  sortedCats.forEach((c) => catMap.set(c.id, c));

  const groupedMap = new Map<string, T[]>();
  const uncategorized: T[] = [];

  for (const item of items) {
    if (item.categoryId && catMap.has(item.categoryId)) {
      const list = groupedMap.get(item.categoryId) || [];
      list.push(item);
      groupedMap.set(item.categoryId, list);
    } else {
      uncategorized.push(item);
    }
  }

  const groups: GenericCategoryGroup<T>[] = [];

  sortedCats.forEach((cat, idx) => {
    const prods = groupedMap.get(cat.id) || [];
    if (prods.length > 0) {
      groups.push({
        categoryId: cat.id,
        categoryName: cat.name,
        categoryOrder: cat.order || idx + 1,
        isUncategorized: false,
        products: sortProductsWithDailyFirst(prods, 'category'),
      });
    }
  });

  if (uncategorized.length > 0) {
    groups.push({
      categoryId: 'sin-categoria',
      categoryName: 'Sin Categoría Asignada',
      categoryOrder: sortedCats.length + 1,
      isUncategorized: true,
      products: sortProductsWithDailyFirst(uncategorized, 'category'),
    });
  }

  return groups;
}

/**
 * Ordena una lista de productos o MenuItems según la configuración activa del Catálogo:
 * - Si se filtra por una categoría específica (selectedCategory !== 'todos'): usa displayOrder (1°, 2°, 3° dentro de la categoría).
 * - Si está en 'todos' y la configuración del catálogo es Agrupar por Categoría: ordena primero por el orden de la categoría (1ª, 2ª, 3ª...) y dentro de cada categoría por displayOrder (1°, 2°, 3°...).
 * - Si está en 'todos' y la configuración del catálogo es Sin Agrupar (Lista General): usa globalOrder (1°, 2°, 3°...).
 */
export function sortOrderItemsByCatalogConfig<
  T extends {
    id: string;
    categoryId?: string;
    isDailyMenu?: boolean;
    displayOrder?: number;
    globalOrder?: number;
    name?: string;
  },
  C extends { id: string; name: string; order?: number }
>(
  items: T[],
  categories: C[],
  groupByCategory: boolean,
  selectedCategory: string = 'todos'
): T[] {
  if (selectedCategory !== 'todos') {
    return sortProductsWithDailyFirst(items, 'category');
  }
  if (!groupByCategory) {
    return sortProductsWithDailyFirst(items, 'global');
  }
  const groups = groupProductsByCategories(items, categories);
  return groups.flatMap((g) => g.products);
}

/**
 * Construye un item de pedido con los valores por defecto del Menú del Día:
 * asigna las opciones por defecto de cada categoría (Sopa, Principio, Carne, Acompañamientos 1, 2 y 3)
 * y calcula el precio base unitario.
 */
export function buildDefaultDailyMenuItem(
  product: Product,
  allProducts: Product[] = []
): CustomizedItemSelection {
  const groups: ModifierGroup[] =
    product.featureGroups && product.featureGroups.length > 0 ? product.featureGroups : [];

  const defaultModifiers: SelectedModifierDetail[] = [];
  let modifiersSurcharge = 0;

  for (const group of groups) {
    const activeOptions = (group.options || []).filter((o) => o.isActive !== false);
    if (activeOptions.length === 0) continue;
    const chosen = activeOptions.find((o) => o.isDefault) || activeOptions[0];
    const surcharge = chosen.priceSurcharge || 0;
    modifiersSurcharge += surcharge;
    defaultModifiers.push({
      groupId: group.id,
      groupName: group.name,
      optionId: chosen.id,
      optionName: chosen.name,
      priceSurcharge: surcharge,
      quantity: 1,
      isDefault: true,
    });
  }

  const basePrice = product.price || 0;
  const unitPrice = Math.max(0, basePrice + modifiersSurcharge);
  const effectiveRecipe = calculateEffectiveRecipe(
    product.recipe || [],
    defaultModifiers,
    allProducts
  );

  return {
    lineItemId: `line-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    productId: product.id,
    productName: product.name || 'Menú del Día',
    basePrice,
    variant: null,
    selectedModifiers: defaultModifiers,
    comboSwaps: [],
    quantity: 1,
    adjustments: [],
    notes: '',
    unitPrice,
    totalPrice: unitPrice,
    prepStationId: product.prepStationId || 'st-cocina-caliente',
    effectiveRecipe,
  };
}

/**
 * Verifica si una categoría de productos puede ser eliminada.
 * La categoría 'Menú del Día' está protegida por el sistema y no puede eliminarse.
 */
export function canDeleteCategory(
  category: Category,
  products: Product[] = []
): { canDelete: boolean; isProtected: boolean; assignedCount: number; reason?: string } {
  const isProtected =
    category.id === 'cat-menu-del-dia' ||
    category.name.trim().toLowerCase() === 'menú del día' ||
    category.name.trim().toLowerCase() === 'almuerzo del día';

  if (isProtected) {
    return {
      canDelete: false,
      isProtected: true,
      assignedCount: products.filter((p) => p.categoryId === category.id).length,
      reason: 'La categoría "Menú del Día" está protegida por el sistema y no puede ser eliminada.',
    };
  }

  const assignedCount = products.filter(
    (p) => p.categoryId === category.id
  ).length;

  return {
    canDelete: true,
    isProtected: false,
    assignedCount,
    reason:
      assignedCount > 0
        ? `Esta categoría tiene ${assignedCount} producto(s) asignado(s).`
        : undefined,
  };
}

export interface ExcelProductRowParsed {
  categoryName: string;
  name: string;
  price: number;
  priceStatus: string;
  description: string;
  status: 'activo' | 'agotado' | 'inactivo';
}

export function normalizeTextKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Normaliza el nombre de un plato o producto para detectar duplicados sin importar mayúsculas, tildes o espacios extra.
 */
export function normalizeProductNameForDedup(name: string): string {
  return normalizeTextKey(name);
}

/**
 * Convierte valores de celda de Excel para "Precio (COP)" a número entero en pesos colombianos.
 */
export function parseExcelCOPPrice(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
  }
  const str = String(raw ?? '').trim();
  if (!str) return 0;

  // Quitar símbolos de moneda, letras y espacios
  const cleaned = str.replace(/[$a-zA-Z\s]/g, '');
  if (!cleaned) return 0;

  // Formato colombiano con puntos de miles: ej. "25.000" o "1.250.000" o "25.000,00"
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    const withoutThousandDots = cleaned.replace(/\./g, '').replace(',', '.');
    const num = Number(withoutThousandDots);
    return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0;
  }

  // Formato con comas de miles: ej. "25,000" o "25,000.00"
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    const withoutThousandCommas = cleaned.replace(/,/g, '');
    const num = Number(withoutThousandCommas);
    return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0;
  }

  const digitsOnly = cleaned.replace(/[^\d.-]/g, '');
  const parsed = Number(digitsOnly);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

/**
 * Encuentra la fila de encabezados dentro de una matriz 2D de Excel (por si hay filas de título arriba)
 * y devuelve objetos clave-valor por cada fila de datos.
 */
export function extractObjectsFromSheetMatrix(matrix: unknown[][]): Array<Record<string, unknown>> {
  if (!Array.isArray(matrix) || matrix.length === 0) return [];

  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    const normalizedCells = row.map((c) => normalizeTextKey(c));
    const hasPlatoOrCat = normalizedCells.some(
      (c) =>
        c.includes('plato') ||
        c.includes('producto') ||
        c.includes('categor')
    );
    if (hasPlatoOrCat) {
      headerRowIndex = i;
      break;
    }
  }

  const headers = (matrix[headerRowIndex] || []).map((h, idx) => {
    const clean = String(h ?? '').trim();
    return clean || `__col_${idx}`;
  });

  const result: Array<Record<string, unknown>> = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!Array.isArray(row)) continue;
    const isCompletelyEmpty = row.every((cell) => String(cell ?? '').trim() === '');
    if (isCompletelyEmpty) continue;

    const obj: Record<string, unknown> = {};
    headers.forEach((h, colIdx) => {
      obj[h] = row[colIdx] ?? '';
    });
    result.push(obj);
  }

  return result;
}

/**
 * Procesa las filas del Excel con encabezados:
 * Categoría | Plato o producto | Precio (COP) | Estado del precio | Descripción / ingredientes
 * Ignora automáticamente cualquier producto cuyo nombre ya exista en el catálogo o esté repetido en el mismo archivo.
 */
export function parseExcelProductRows(
  rawRows: Array<Record<string, unknown>>,
  existingProductNames: string[] = []
): {
  toCreate: ExcelProductRowParsed[];
  skippedDuplicates: string[];
  skippedEmpty: number;
} {
  const seenNames = new Set<string>(
    existingProductNames.map((n) => normalizeProductNameForDedup(n)).filter(Boolean)
  );

  const toCreate: ExcelProductRowParsed[] = [];
  const skippedDuplicates: string[] = [];
  let skippedEmpty = 0;

  for (const row of rawRows) {
    if (!row || typeof row !== 'object') continue;

    let categoryVal: unknown = '';
    let nameVal: unknown = '';
    let priceVal: unknown = '';
    let priceStatusVal: unknown = '';
    let descriptionVal: unknown = '';

    const entries = Object.entries(row);
    for (const [key, val] of entries) {
      const k = normalizeTextKey(key);
      if (k.includes('categor') || k === 'cat') {
        categoryVal = val;
      } else if (k.includes('plato') || k.includes('producto') || k === 'nombre') {
        nameVal = val;
      } else if (k.includes('estado')) {
        priceStatusVal = val;
      } else if (k.includes('precio') || k.includes('valor') || k.includes('cop')) {
        priceVal = val;
      } else if (k.includes('descrip') || k.includes('ingred') || k.includes('detalle')) {
        descriptionVal = val;
      }
    }

    const cleanName = String(nameVal ?? '').trim();
    if (!cleanName) {
      skippedEmpty++;
      continue;
    }

    const normalizedName = normalizeProductNameForDedup(cleanName);
    if (seenNames.has(normalizedName)) {
      skippedDuplicates.push(cleanName);
      continue;
    }

    seenNames.add(normalizedName);

    const cleanCategory = String(categoryVal ?? '').trim() || 'General';
    const parsedPrice = parseExcelCOPPrice(priceVal);
    const cleanPriceStatus = String(priceStatusVal ?? '').trim() || 'Definido';
    const cleanDescription = String(descriptionVal ?? '').trim();

    const normStatus = normalizeTextKey(cleanPriceStatus);
    let status: 'activo' | 'agotado' | 'inactivo' = 'activo';
    if (normStatus.includes('inactivo') || normStatus.includes('suspendido')) {
      status = 'inactivo';
    } else if (normStatus.includes('agotado')) {
      status = 'agotado';
    }

    toCreate.push({
      categoryName: cleanCategory,
      name: cleanName,
      price: parsedPrice,
      priceStatus: cleanPriceStatus,
      description: cleanDescription,
      status,
    });
  }

  return {
    toCreate,
    skippedDuplicates,
    skippedEmpty,
  };
}

