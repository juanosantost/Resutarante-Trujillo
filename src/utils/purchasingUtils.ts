/**
 * Utilidades de cálculo y validación para Compras, Proveedores y Abastecimiento (Módulo 11)
 */

import { InventoryItem, InventoryUnit, PurchaseItem, PurchasePaymentStatus } from '../types';

/**
 * Calcula el nuevo costo promedio ponderado (Moving Average Cost) al recibir una compra de insumos.
 * Fórmula: ((stockActual * costoActual) + (cantidadComprada * costoUnitarioComprado)) / (stockActual + cantidadComprada)
 */
export function calculateNewAverageCost(
  currentStock: number,
  currentCost: number,
  purchasedQty: number,
  purchasedUnitCost: number
): number {
  const totalQty = currentStock + purchasedQty;
  if (totalQty <= 0) return purchasedUnitCost;
  
  if (currentStock <= 0) return purchasedUnitCost;

  const totalValue = (currentStock * currentCost) + (purchasedQty * purchasedUnitCost);
  return Math.round((totalValue / totalQty) * 100) / 100;
}

/**
 * Calcula el estado de pago de una compra basado en el total y el monto abonado.
 */
export function determinePurchasePaymentStatus(total: number, amountPaid: number): PurchasePaymentStatus {
  if (amountPaid <= 0) return 'pendiente';
  if (amountPaid >= total) return 'pagada';
  return 'parcial';
}

/**
 * Genera propuestas de abastecimiento y alertas basadas en stock mínimo y existencias actuales.
 */
export interface ReplenishmentProposal {
  itemId: string;
  itemName: string;
  currentStock: number;
  minStock: number;
  unit: InventoryUnit;
  costPerUnit: number;
  deficit: number;
  recommendedQty: number;
  estimatedCost: number;
  isCritical: boolean;
}

export function generateReplenishmentProposals(inventory: InventoryItem[]): ReplenishmentProposal[] {
  return inventory.map((item) => {
    const isCritical = item.currentStock <= item.minStock;
    const deficit = Math.max(0, item.minStock - item.currentStock);
    const recommendedQty = isCritical ? Math.max(item.minStock * 1.5, deficit * 2, item.minStock) : 0;
    const estimatedCost = Math.round(recommendedQty * (item.costPerUnit || 0));

    return {
      itemId: item.id,
      itemName: item.name,
      currentStock: item.currentStock,
      minStock: item.minStock,
      unit: item.unit,
      costPerUnit: item.costPerUnit || 0,
      deficit,
      recommendedQty: Math.round(recommendedQty * 100) / 100,
      estimatedCost,
      isCritical,
    };
  }).filter((p) => p.isCritical || p.currentStock <= p.minStock * 1.2);
}

/**
 * Valida si se puede anular una compra verificando si hay suficiente stock actual para descontar los ítems comprados.
 */
export function validatePurchaseCancellation(
  purchaseItems: PurchaseItem[],
  inventory: InventoryItem[]
): { canCancel: boolean; error?: string; affectedItems: Array<{ name: string; required: number; available: number }> } {
  const affectedItems: Array<{ name: string; required: number; available: number }> = [];
  let canCancel = true;

  for (const pItem of purchaseItems) {
    const inv = inventory.find((i) => i.id === pItem.ingredientId);
    const available = inv ? inv.currentStock : 0;
    if (available < pItem.quantity) {
      canCancel = false;
    }
    affectedItems.push({
      name: pItem.ingredientName,
      required: pItem.quantity,
      available,
    });
  }

  return {
    canCancel,
    error: canCancel ? undefined : 'No es posible anular completamente la compra porque algunos insumos ya han sido consumidos en el inventario (el stock actual es menor a la cantidad comprada).',
    affectedItems,
  };
}
