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
 * - Posibles recargos por cambio de componentes en combo
 * - Descuentos y recargos comerciales fijos o porcentuales
 */
export function calculateCustomizedProductPrice(
  basePrice: number,
  variant?: ProductVariant | null,
  selectedModifiers: Array<SelectedModifierDetail | ModifierOption> = [],
  swapSurcharges: number[] = [],
  quantity: number = 1,
  adjustments: ProductAdjustment[] = []
): PriceBreakdown {
  const safeQty = Math.max(1, Math.floor(quantity || 1));
  const variantAdj = variant?.priceAdjustment || 0;
  const modTotal = selectedModifiers.reduce((acc, m) => {
    const surcharge = m.priceSurcharge || 0;
    const qty = 'quantity' in m && typeof m.quantity === 'number' ? m.quantity : 1;
    return acc + surcharge * qty;
  }, 0);
  const swapTotal = swapSurcharges.reduce((acc, s) => acc + (s || 0), 0);

  const subtotalBase = Math.max(0, basePrice + variantAdj + modTotal + swapTotal);

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
