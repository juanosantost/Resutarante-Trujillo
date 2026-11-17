import {
  CarteraProductItem,
  CarteraRecord,
  CarteraStatus,
  Order,
} from '../types';
import { isCarteraOverdue } from './creditAndLayawayUtils';

export const CARTERA_PRODUCTS_PAGE_SIZE = 20;

/**
 * Resuelve la lista de productos de una cuenta de cartera.
 * Si el registro ya tiene `items`, los devuelve; de lo contrario, hidrata desde la orden origen (legacy).
 */
export function resolveCarteraProductItems(
  record: CarteraRecord,
  orders: Order[] = []
): CarteraProductItem[] {
  if (Array.isArray(record.items) && record.items.length > 0) {
    return record.items.map((item) => ({ ...item }));
  }

  if (!record.saleId) return [];

  const linkedOrder = orders.find((o) => o.id === record.saleId);
  if (!linkedOrder || !Array.isArray(linkedOrder.items) || linkedOrder.items.length === 0) {
    return [];
  }

  const activeItems = linkedOrder.items.filter((it) => !it.cancelled && !it.paid);
  const sourceItems =
    activeItems.length > 0
      ? activeItems
      : linkedOrder.items.filter((it) => !it.cancelled);

  const baseTimestamp = new Date(
    linkedOrder.createdAt || record.createdAt || Date.now()
  ).getTime();
  const safeBaseMs = isNaN(baseTimestamp) ? Date.now() : baseTimestamp;

  return sourceItems.map((it, idx) => ({
    id: it.id || `legacy-ci-${record.id}-${idx}`,
    menuItemId: it.menuItemId,
    name: it.name,
    price: it.price,
    quantity: it.quantity,
    station: it.station,
    notes: it.notes || '',
    selectedModifiers: it.selectedModifiers || [],
    adjustments: it.adjustments || [],
    effectiveRecipe: it.effectiveRecipe || [],
    // Incremento de 1ms por orden original para preservar estabilidad al ordenar descendente
    addedAt: new Date(safeBaseMs + idx).toISOString(),
    addedBy: linkedOrder.waiterName || record.createdBy || 'Sistema',
    paidChecked: false,
    sentToKitchen: Boolean(it.sentToKitchen),
  }));
}

/**
 * Ordena las líneas de producto de una cuenta de cartera del más reciente al más antiguo.
 */
export function sortCarteraProductsNewestFirst(
  items: CarteraProductItem[]
): CarteraProductItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const timeA = a.item.addedAt ? new Date(a.item.addedAt).getTime() : NaN;
      const timeB = b.item.addedAt ? new Date(b.item.addedAt).getTime() : NaN;
      const validA = !isNaN(timeA);
      const validB = !isNaN(timeB);

      if (validA && validB && timeA !== timeB) {
        return timeB - timeA;
      }
      if (validA && !validB) return -1;
      if (!validA && validB) return 1;

      // Desempate estable: elementos más adelante en el arreglo original primero
      return b.index - a.index;
    })
    .map(({ item }) => item);
}

export interface PaginatedCarteraProductsResult {
  pageItems: CarteraProductItem[];
  sortedItems: CarteraProductItem[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  startIndex: number; // 1-indexed para mostrar "Mostrando X-Y de Z"
  endIndex: number;
  checkedCount: number;
}

/**
 * Ordena del más reciente al más antiguo y pagina con un máximo estricto de 20 productos por página.
 */
export function paginateCarteraProducts(
  items: CarteraProductItem[],
  page: number = 1,
  pageSize: number = CARTERA_PRODUCTS_PAGE_SIZE
): PaginatedCarteraProductsResult {
  const effectivePageSize = Math.min(
    CARTERA_PRODUCTS_PAGE_SIZE,
    Math.max(1, Math.floor(pageSize || CARTERA_PRODUCTS_PAGE_SIZE))
  );
  const sortedItems = sortCarteraProductsNewestFirst(items);
  const totalItems = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));
  const currentPage = Math.min(Math.max(1, Math.floor(page || 1)), totalPages);

  const offset = (currentPage - 1) * effectivePageSize;
  const pageItems = sortedItems.slice(offset, offset + effectivePageSize);

  const startIndex = totalItems === 0 ? 0 : offset + 1;
  const endIndex = totalItems === 0 ? 0 : Math.min(offset + pageItems.length, totalItems);
  const checkedCount = sortedItems.filter((it) => Boolean(it.paidChecked)).length;

  return {
    pageItems,
    sortedItems,
    currentPage,
    totalPages,
    totalItems,
    pageSize: effectivePageSize,
    startIndex,
    endIndex,
    checkedCount,
  };
}

/**
 * Alterna el tachado visual de una línea completa de producto.
 * Regla estricta: NO modifica precios, cantidades, totales ni saldos de la cuenta.
 */
export function toggleCarteraItemPaidVisual(
  items: CarteraProductItem[],
  itemId: string,
  staffName: string,
  forcedChecked?: boolean,
  nowIso: string = new Date().toISOString()
): CarteraProductItem[] {
  return items.map((item) => {
    if (item.id !== itemId) return item;
    const nextChecked =
      forcedChecked !== undefined ? Boolean(forcedChecked) : !Boolean(item.paidChecked);

    return {
      ...item,
      paidChecked: nextChecked,
      paidCheckedAt: nextChecked ? nowIso : undefined,
      paidCheckedBy: nextChecked ? staffName : undefined,
    };
  });
}

/**
 * Calcula los nuevos montos financieros de una cuenta de cartera al agregar nuevos productos.
 */
export function calculateCarteraAdditionAmounts(params: {
  newItems: Array<{ price: number; quantity: number }>;
  taxRate: number;
  currentTotalAmount: number;
  currentBalanceDue: number;
  dueDate: string;
}): {
  addedSubtotal: number;
  addedTax: number;
  addedTotal: number;
  newTotalAmount: number;
  newBalanceDue: number;
  nextStatus: CarteraStatus;
} {
  const addedSubtotal = params.newItems.reduce(
    (sum, it) => sum + (it.price || 0) * (it.quantity || 0),
    0
  );
  const effectiveTaxRate = typeof params.taxRate === 'number' ? params.taxRate : 0;
  const addedTax = Math.round(addedSubtotal * effectiveTaxRate);
  const addedTotal = Math.round((addedSubtotal + addedTax) * 100) / 100;

  const newTotalAmount =
    Math.round(((params.currentTotalAmount || 0) + addedTotal) * 100) / 100;
  const newBalanceDue = Math.max(
    0,
    Math.round(((params.currentBalanceDue || 0) + addedTotal) * 100) / 100
  );

  const nextStatus: CarteraStatus =
    newBalanceDue <= 0
      ? 'pagada'
      : isCarteraOverdue(params.dueDate)
      ? 'vencida'
      : 'vigente';

  return {
    addedSubtotal,
    addedTax,
    addedTotal,
    newTotalAmount,
    newBalanceDue,
    nextStatus,
  };
}
