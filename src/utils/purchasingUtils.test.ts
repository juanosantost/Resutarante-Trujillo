/**
 * Pruebas unitarias para utilidades de compras, costos promedio y abastecimiento (Módulo 11)
 */

import test from 'node:test';
import assert from 'node:assert';
import {
  calculateNewAverageCost,
  determinePurchasePaymentStatus,
  generateReplenishmentProposals,
  validatePurchaseCancellation,
} from './purchasingUtils';
import { InventoryItem, PurchaseItem } from '../types';

test('calculateNewAverageCost computes moving average correctly', () => {
  // Stock actual: 1000g a $10/g. Compra: 2000g a $13/g
  const newCost = calculateNewAverageCost(1000, 10, 2000, 13);
  // Total valor = (1000*10) + (2000*13) = 10000 + 26000 = 36000. Total qty = 3000. Promedio = 12.
  assert.strictEqual(newCost, 12);
});

test('determinePurchasePaymentStatus identifies pagada, parcial and pendiente', () => {
  assert.strictEqual(determinePurchasePaymentStatus(100000, 100000), 'pagada');
  assert.strictEqual(determinePurchasePaymentStatus(100000, 40000), 'parcial');
  assert.strictEqual(determinePurchasePaymentStatus(100000, 0), 'pendiente');
});

test('generateReplenishmentProposals identifies critical stock and deficits', () => {
  const inventory: InventoryItem[] = [
    {
      id: 'i1',
      branchId: 'b1',
      name: 'Carne de Res',
      unit: 'g',
      currentStock: 500,
      minStock: 2000,
      costPerUnit: 25,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'i2',
      branchId: 'b1',
      name: 'Pan Hamburguesa',
      unit: 'und',
      currentStock: 50,
      minStock: 40,
      costPerUnit: 1200,
      updatedAt: new Date().toISOString(),
    },
  ];

  const proposals = generateReplenishmentProposals(inventory);
  // Carne de Res está en stock crítico (500 <= 2000)
  const carne = proposals.find((p) => p.itemId === 'i1');
  assert.ok(carne);
  assert.strictEqual(carne?.isCritical, true);
  assert.strictEqual(carne?.deficit, 1500);
});

test('validatePurchaseCancellation verifies if stock is sufficient for cancellation', () => {
  const purchaseItems: PurchaseItem[] = [
    {
      ingredientId: 'i1',
      ingredientName: 'Carne de Res',
      quantity: 1000,
      unit: 'g',
      unitCost: 20,
      total: 20000,
    },
  ];

  const sufficientInventory: InventoryItem[] = [
    {
      id: 'i1',
      branchId: 'b1',
      name: 'Carne de Res',
      unit: 'g',
      currentStock: 2500,
      minStock: 1000,
      costPerUnit: 20,
      updatedAt: new Date().toISOString(),
    },
  ];

  const lowInventory: InventoryItem[] = [
    {
      id: 'i1',
      branchId: 'b1',
      name: 'Carne de Res',
      unit: 'g',
      currentStock: 500,
      minStock: 1000,
      costPerUnit: 20,
      updatedAt: new Date().toISOString(),
    },
  ];

  const res1 = validatePurchaseCancellation(purchaseItems, sufficientInventory);
  assert.strictEqual(res1.canCancel, true);

  const res2 = validatePurchaseCancellation(purchaseItems, lowInventory);
  assert.strictEqual(res2.canCancel, false);
});
