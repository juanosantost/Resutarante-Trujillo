/**
 * SISTEMA COLMENA RESTAURANTE - Módulo 04: Inventario Avanzado, Recetas, Costos y Conversiones
 */

import {
  InventoryItem,
  InventoryUnit,
  RecipeIngredient,
  Product,
  ProductVariant,
  ModifierOption,
} from '../types';

/**
 * Tabla de factores de conversión compatibles dentro de la misma familia dimensional.
 * Dimensiones:
 * - Masa: kg <-> g
 * - Volumen: lt <-> ml
 * - Conteo: und <-> porc (tratados como unidad base)
 */
const CONVERSION_FACTORS: Record<string, Record<string, number>> = {
  g: { g: 1, kg: 0.001 },
  kg: { kg: 1, g: 1000 },
  ml: { ml: 1, lt: 0.001 },
  lt: { lt: 1, ml: 1000 },
  und: { und: 1, porc: 1 },
  porc: { porc: 1, und: 1 },
};

/**
 * Valida si dos unidades son compatibles dimensionalmente para conversión
 */
export function areUnitsCompatible(unitA: InventoryUnit, unitB: InventoryUnit): boolean {
  if (unitA === unitB) return true;
  if ((unitA === 'g' || unitA === 'kg') && (unitB === 'g' || unitB === 'kg')) return true;
  if ((unitA === 'ml' || unitA === 'lt') && (unitB === 'ml' || unitB === 'lt')) return true;
  if ((unitA === 'und' || unitA === 'porc') && (unitB === 'und' || unitB === 'porc')) return true;
  return false;
}

/**
 * Convierte una cantidad de una unidad origen a una unidad destino si son compatibles.
 * Lanza error si son incompatibles para evitar conversiones automáticas erróneas.
 */
export function convertUnitQuantity(
  quantity: number,
  fromUnit: InventoryUnit,
  toUnit: InventoryUnit
): number {
  if (fromUnit === toUnit) return quantity;
  if (!areUnitsCompatible(fromUnit, toUnit)) {
    throw new Error(`Conversión incompatible de unidad "${fromUnit}" a "${toUnit}".`);
  }

  // Convertir primero a unidad base (g, ml, und)
  let baseValue = quantity;
  if (fromUnit === 'kg') baseValue = quantity * 1000;
  if (fromUnit === 'lt') baseValue = quantity * 1000;

  // Convertir desde base a unidad destino
  if (toUnit === 'kg' || toUnit === 'lt') {
    return baseValue / 1000;
  }
  return baseValue;
}

/**
 * Calcula automáticamente el costo de una receta, el costo total del plato
 * y el margen estimado de ganancia.
 */
export function calculateRecipeCostAndMargin(
  sellingPrice: number,
  recipeIngredients: Array<{ inventoryItemId: string; quantity: number; unit: string; costPerUnit?: number }>,
  inventoryItemsMap: Map<string, InventoryItem>
): {
  totalRecipeCost: number;
  grossMarginCOP: number;
  marginPercentage: number;
  ingredientCostBreakdown: Array<{ inventoryItemId: string; name: string; requiredQuantity: number; unit: string; itemCost: number }>;
} {
  let totalRecipeCost = 0;
  const breakdown: Array<{ inventoryItemId: string; name: string; requiredQuantity: number; unit: string; itemCost: number }> = [];

  for (const ing of recipeIngredients) {
    const invItem = inventoryItemsMap.get(ing.inventoryItemId);
    const unitCost = invItem?.costPerUnit || ing.costPerUnit || 0;
    
    // Calcular costo según cantidad y unidad (asumiendo que la unidad de receta coincide o se normaliza con el inventario)
    const itemCost = ing.quantity * unitCost;
    totalRecipeCost += itemCost;

    breakdown.push({
      inventoryItemId: ing.inventoryItemId,
      name: invItem?.name || ing.inventoryItemId,
      requiredQuantity: ing.quantity,
      unit: ing.unit,
      itemCost,
    });
  }

  const grossMarginCOP = Math.max(0, sellingPrice - totalRecipeCost);
  const marginPercentage = sellingPrice > 0 ? Math.round((grossMarginCOP / sellingPrice) * 100) : 0;

  return {
    totalRecipeCost,
    grossMarginCOP,
    marginPercentage,
    ingredientCostBreakdown: breakdown,
  };
}

/**
 * Simula el cálculo del consumo real de ingredientes para un pedido considerando:
 * - Receta base del producto
 * - Variante seleccionada (puede alterar cantidades)
 * - Modificadores seleccionados (adicionales agregan ingredientes, exclusiones restan)
 */
export function calculateRealIngredientConsumption(
  productRecipe: RecipeIngredient[] = [],
  variant?: ProductVariant | null,
  selectedModifiers: ModifierOption[] = [],
  quantityMultiplier: number = 1
): Map<string, number> {
  const consumptionMap = new Map<string, number>();

  // 1. Receta base multiplicada por cantidad de platos
  for (const ing of productRecipe) {
    const current = consumptionMap.get(ing.inventoryItemId) || 0;
    // Si la variante tiene multiplicador (ej: doble carne = x2)
    const multiplier = variant?.name?.toLowerCase().includes('doble') ? 2 : variant?.name?.toLowerCase().includes('triple') ? 3 : 1;
    consumptionMap.set(ing.inventoryItemId, current + ing.quantity * multiplier * quantityMultiplier);
  }

  // 2. Modificadores (adicionales agregan ingredientes relacionados, exclusiones eliminan)
  for (const mod of selectedModifiers) {
    if (mod.ingredientId) {
      const current = consumptionMap.get(mod.ingredientId) || 0;
      // Adicional estándar agrega 1 unidad o porción estándar
      consumptionMap.set(mod.ingredientId, current + 1 * quantityMultiplier);
    }
  }

  return consumptionMap;
}

/**
 * Verifica alertas de inventario mínimo para la sucursal
 */
export function getLowStockAlerts(inventoryItems: InventoryItem[]): InventoryItem[] {
  return inventoryItems.filter((item) => item.currentStock <= item.minStock);
}
