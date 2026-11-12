import { OrderItem, Payment, Order } from '../types';
import { getEffectiveTaxRate } from './calculations';

export { getEffectiveTaxRate };

export interface CheckoutTotalsResult {
  selectedItems: OrderItem[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  unpaidItemsCount: number;
  paidItemsCount: number;
}

/**
 * Calcula subtotal, impoconsumo (8%), propina y total basados exclusivamente
 * en los elementos seleccionados para el cobro.
 * Si taxRate es 0 (por ejemplo cuando se desmarca el impoconsumo en la sucursal),
 * no se totaliza impuesto en el cobro (tax = 0).
 */
export function calculateSelectedItemsTotals(
  items: OrderItem[],
  selectedItemIds: string[],
  includeTip: boolean = false,
  customTipAmount?: number,
  taxRate: number = 0.08
): CheckoutTotalsResult {
  const selectedSet = new Set(selectedItemIds);
  const selectedItems = items.filter((item) => selectedSet.has(item.id));

  const subtotal = selectedItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const effectiveTaxRate = typeof taxRate === 'number' ? taxRate : 0.08;
  const tax = Math.round(subtotal * effectiveTaxRate);

  let tip = 0;
  if (includeTip) {
    if (customTipAmount !== undefined && customTipAmount !== null && customTipAmount >= 0) {
      tip = customTipAmount;
    } else {
      tip = Math.round(subtotal * 0.10);
    }
  }

  const total = subtotal + tax + tip;
  const unpaidItemsCount = items.filter((it) => !it.paid).length;
  const paidItemsCount = items.filter((it) => it.paid).length;

  return {
    selectedItems,
    subtotal,
    tax,
    tip,
    total,
    unpaidItemsCount,
    paidItemsCount,
  };
}

/**
 * Devuelve la lista inicial de IDs seleccionados:
 * Por defecto, todos los ítems NO pagados están seleccionados.
 * Si todos estuvieran pagados (caso de consulta posterior), devuelve todos los IDs.
 */
export function getInitialSelectedItemIds(items: OrderItem[]): string[] {
  if (!items || items.length === 0) return [];
  const unpaid = items.filter((it) => !it.paid).map((it) => it.id);
  if (unpaid.length > 0) return unpaid;
  return items.map((it) => it.id);
}

/**
 * Marca los ítems especificados como pagados, preservando su inmutabilidad.
 */
export function markItemsAsPaid(
  items: OrderItem[],
  paidItemIds: string[],
  paymentId?: string,
  paidAt?: string
): OrderItem[] {
  const paidSet = new Set(paidItemIds);
  const timestamp = paidAt || new Date().toISOString();

  return items.map((item) => {
    if (paidSet.has(item.id)) {
      return {
        ...item,
        paid: true,
        paidAt: item.paidAt || timestamp,
        paidPaymentId: paymentId || item.paidPaymentId,
      };
    }
    return item;
  });
}

/**
 * Verifica si todos los productos de la orden ya fueron completamente pagados.
 */
export function isOrderFullyPaid(items: OrderItem[]): boolean {
  if (!items || items.length === 0) return true;
  return items.every((item) => Boolean(item.paid));
}

/**
 * Retorna los ítems específicos que deben figurar en la factura POS:
 * Prioriza los ítems grabados en la transacción de pago, o los filtrados por selectedItemIds.
 */
export function filterReceiptItems(
  payment: Partial<Payment> & { items?: OrderItem[]; selectedItemIds?: string[] },
  order?: Partial<Order> | null
): OrderItem[] {
  if (payment.items && payment.items.length > 0) {
    return payment.items;
  }

  if (payment.selectedItemIds && payment.selectedItemIds.length > 0 && order?.items) {
    const selectedSet = new Set(payment.selectedItemIds);
    const filtered = order.items.filter((it) => selectedSet.has(it.id));
    if (filtered.length > 0) return filtered;
  }

  return order?.items || [];
}

/**
 * Desagrupa cualquier ítem con quantity > 1 en unidades individuales (quantity = 1)
 * copiando íntegramente su descripción (selectedModifiers, adjustments y notes) en cada unidad
 * para que al momento de cobrar cada plato/producto salga por separado con todo su detalle.
 */
export function expandOrderItemsToSingleUnits(items: OrderItem[]): OrderItem[] {
  if (!items || items.length === 0) return [];
  const expanded: OrderItem[] = [];

  for (const item of items) {
    const qty = Math.max(1, Math.round(item.quantity || 1));
    const clonedModifiers = item.selectedModifiers
      ? item.selectedModifiers.map((m) => ({ ...m }))
      : undefined;
    const clonedAdjustments = item.adjustments
      ? item.adjustments.map((a) => ({ ...a }))
      : undefined;

    if (qty <= 1) {
      expanded.push({
        ...item,
        quantity: 1,
        selectedModifiers: clonedModifiers,
        adjustments: clonedAdjustments,
        notes: item.notes,
      });
    } else {
      for (let i = 0; i < qty; i++) {
        expanded.push({
          ...item,
          id: i === 0 ? item.id : `${item.id}-u${i + 1}`,
          quantity: 1,
          selectedModifiers: clonedModifiers ? clonedModifiers.map((m) => ({ ...m })) : undefined,
          adjustments: clonedAdjustments ? clonedAdjustments.map((a) => ({ ...a })) : undefined,
          notes: item.notes,
        });
      }
    }
  }

  return expanded;
}

import { formatModifiersDisplaySummary } from './orderModifierUtils';

/**
 * Formatea en texto claro las opciones seleccionadas del plato (ej: Sopa de verduras, Carne asada, Frijoles)
 * - Sin nombres de categorías (Sopa, Carne, Principio, Acompañamiento #).
 * - Oculta los acompañamientos que sean los predeterminados y solo muestra los que hayan sido cambiados.
 */
export function formatOrderItemModifiersSummary(item: OrderItem): string {
  if (!item.selectedModifiers || item.selectedModifiers.length === 0) return '';
  return formatModifiersDisplaySummary(item.selectedModifiers);
}




