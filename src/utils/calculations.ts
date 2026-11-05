import { OrderItem, RecipeIngredient } from '../types';

/**
 * Formatea un número en pesos colombianos (COP).
 * Ejemplo: 45000 -> "$ 45.000 COP"
 */
export function formatCOP(amount: number | null | undefined): string {
  const safeAmount = Math.round(amount || 0);
  const formatted = safeAmount.toLocaleString('es-CO');
  return `$ ${formatted} COP`;
}

/**
 * Formatea fecha y hora en zona horaria America/Bogota (Colombia).
 */
export function formatColombiaDateTime(dateInput: string | Date | number | null | undefined): string {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Determina la tasa de impoconsumo efectiva para una sucursal.
 * Si showTax está desmarcado (false) en la configuración del comprobante o la tasa es 0,
 * retorna 0 para que no se cobre ni totalice impoconsumo en el pedido.
 */
export function getEffectiveTaxRate(
  branch: { taxRate?: number; receiptConfig?: { showTax?: boolean } } | null | undefined
): number {
  if (!branch) return 0.08;
  if (branch.receiptConfig && branch.receiptConfig.showTax === false) {
    return 0;
  }
  if (typeof branch.taxRate === 'number') {
    return branch.taxRate;
  }
  return 0.08;
}

/**
 * Calcula subtotal, impuesto (por defecto Impoconsumo 8% en restaurantes Colombia) y propina voluntaria (10%).
 * Si taxRate es 0 (por ejemplo cuando se desmarca el impoconsumo en la sucursal), el impuesto resultante es 0.
 */
export function calculateOrderTotals(
  items: Array<{ price: number; quantity: number }>,
  taxRate: number = 0.08,
  includeTip: boolean = true,
  tipRate: number = 0.10
) {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const effectiveTaxRate = typeof taxRate === 'number' ? taxRate : 0.08;
  const tax = Math.round(subtotal * effectiveTaxRate);
  const tip = includeTip ? Math.round(subtotal * tipRate) : 0;
  const total = subtotal + tax + tip;

  return {
    subtotal,
    tax,
    tip,
    total,
  };
}

/**
 * Filtra los productos de una orden que aún NO se han enviado a la cocina.
 * Evita duplicar comandas de platos ya enviados en rondas anteriores.
 */
export function getNewItemsForKitchen(items: OrderItem[]): OrderItem[] {
  return items.filter(item => !item.sentToKitchen && item.quantity > 0);
}

/**
 * Calcula el total de ingredientes que deben descontarse de inventario según las recetas y cantidades.
 */
export function calculateRecipeDeductions(
  orderedProducts: Array<{ recipe?: RecipeIngredient[]; quantity: number }>
): Record<string, { name: string; quantity: number; unit: string }> {
  const deductions: Record<string, { name: string; quantity: number; unit: string }> = {};

  for (const prod of orderedProducts) {
    if (!prod.recipe || !Array.isArray(prod.recipe)) continue;
    for (const ing of prod.recipe) {
      if (!deductions[ing.inventoryItemId]) {
        deductions[ing.inventoryItemId] = {
          name: ing.name,
          quantity: 0,
          unit: ing.unit,
        };
      }
      deductions[ing.inventoryItemId].quantity += ing.quantity * prod.quantity;
    }
  }

  return deductions;
}

/**
 * Cuadre de caja y cálculo de arqueo:
 * Esperado en efectivo = Base inicial + Ventas en efectivo + Ingresos adicionales - Egresos
 * Diferencia = Efectivo contado real - Esperado
 */
export function calculateCashBalance(
  initialCash: number,
  cashSales: number,
  inflows: number,
  outflows: number,
  actualCount?: number | null
) {
  const expectedCash = (initialCash || 0) + (cashSales || 0) + (inflows || 0) - (outflows || 0);
  const difference = actualCount !== undefined && actualCount !== null ? actualCount - expectedCash : null;

  return {
    expectedCash,
    difference,
    hasDifference: difference !== null && Math.abs(difference) > 0,
    isSurplus: (difference || 0) > 0,
    isShortage: (difference || 0) < 0,
  };
}

/**
 * Divide la cuenta en partes iguales con redondeo exacto.
 */
export function splitBillEqually(total: number, peopleCount: number): number[] {
  if (peopleCount <= 1) return [total];
  const base = Math.floor(total / peopleCount);
  const remainder = total % peopleCount;
  const splits = new Array(peopleCount).fill(base);
  for (let i = 0; i < remainder; i++) {
    splits[i] += 1;
  }
  return splits;
}
