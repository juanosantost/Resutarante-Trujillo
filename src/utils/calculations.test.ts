import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCOP,
  calculateOrderTotals,
  getEffectiveTaxRate,
  getNewItemsForKitchen,
  calculateRecipeDeductions,
  calculateCashBalance,
  splitBillEqually,
} from './calculations';
import { OrderItem } from '../types';

test('formatCOP formats currency in Colombian Pesos correctly', () => {
  assert.equal(formatCOP(0), '$ 0 COP');
  assert.equal(formatCOP(25000), '$ 25.000 COP');
  assert.equal(formatCOP(1500000), '$ 1.500.000 COP');
});

test('getEffectiveTaxRate respects branch settings and disabled impoconsumo', () => {
  // Caso 1: Sucursal nula o sin config -> 8% estándar Colombia
  assert.equal(getEffectiveTaxRate(null), 0.08);
  assert.equal(getEffectiveTaxRate(undefined), 0.08);

  // Caso 2: Sucursal con showTax desmarcado (false) -> 0%
  assert.equal(getEffectiveTaxRate({ receiptConfig: { showTax: false } }), 0);
  assert.equal(getEffectiveTaxRate({ taxRate: 0.08, receiptConfig: { showTax: false } }), 0);

  // Caso 3: Sucursal con taxRate explícito en 0 -> 0%
  assert.equal(getEffectiveTaxRate({ taxRate: 0, receiptConfig: { showTax: true } }), 0);

  // Caso 4: Sucursal con impoconsumo marcado y 8% -> 0.08
  assert.equal(getEffectiveTaxRate({ taxRate: 0.08, receiptConfig: { showTax: true } }), 0.08);

  // Caso 5: Sucursal con tarifa personalizada (ej. 0.05) y showTax activo
  assert.equal(getEffectiveTaxRate({ taxRate: 0.05, receiptConfig: { showTax: true } }), 0.05);
});

test('calculateOrderTotals computes subtotal, 8% impoconsumo and 10% tip correctly', () => {
  const items = [
    { price: 20000, quantity: 2 }, // 40000
    { price: 10000, quantity: 1 }, // 10000
  ];
  // Subtotal = 50000
  // Tax (8%) = 4000
  // Tip (10%) = 5000
  // Total = 59000
  const totals = calculateOrderTotals(items, 0.08, true, 0.10);
  assert.equal(totals.subtotal, 50000);
  assert.equal(totals.tax, 4000);
  assert.equal(totals.tip, 5000);
  assert.equal(totals.total, 59000);

  // Without tip
  const noTipTotals = calculateOrderTotals(items, 0.08, false, 0.10);
  assert.equal(noTipTotals.subtotal, 50000);
  assert.equal(noTipTotals.tax, 4000);
  assert.equal(noTipTotals.tip, 0);
  assert.equal(noTipTotals.total, 54000);
});

test('calculateOrderTotals does NOT total impoconsumo when taxRate is 0 (desmarcado en sucursal)', () => {
  const items = [
    { price: 20000, quantity: 2 }, // 40000
    { price: 10000, quantity: 1 }, // 10000
  ];
  // Subtotal = 50000
  // Tax = 0 (impoconsumo desmarcado)
  // Tip (10%) = 5000
  // Total = 55000 (sin impoconsumo)
  const totals = calculateOrderTotals(items, 0, true, 0.10);
  assert.equal(totals.subtotal, 50000);
  assert.equal(totals.tax, 0);
  assert.equal(totals.tip, 5000);
  assert.equal(totals.total, 55000);

  // Without tip: total equals exact subtotal
  const noTipTotals = calculateOrderTotals(items, 0, false, 0.10);
  assert.equal(noTipTotals.subtotal, 50000);
  assert.equal(noTipTotals.tax, 0);
  assert.equal(noTipTotals.tip, 0);
  assert.equal(noTipTotals.total, 50000);
});

test('getNewItemsForKitchen isolates items in new rounds without duplicating sent items', () => {
  const items: OrderItem[] = [
    {
      id: 'item-1',
      menuItemId: 'prod-1',
      name: 'Hamburguesa Colmena',
      price: 32000,
      quantity: 2,
      station: 'parrilla',
      roundNumber: 1,
      sentToKitchen: true,
    },
    {
      id: 'item-2',
      menuItemId: 'prod-2',
      name: 'Papas Rústicas',
      price: 12000,
      quantity: 1,
      station: 'cocina_caliente',
      roundNumber: 1,
      sentToKitchen: true,
    },
    {
      id: 'item-3',
      menuItemId: 'prod-3',
      name: 'Cerveza Artesanal Dorada',
      price: 14000,
      quantity: 3,
      station: 'bar_bebidas',
      roundNumber: 2,
      sentToKitchen: false,
    },
  ];

  const forKitchen = getNewItemsForKitchen(items);
  assert.equal(forKitchen.length, 1);
  assert.equal(forKitchen[0].id, 'item-3');
  assert.equal(forKitchen[0].name, 'Cerveza Artesanal Dorada');
});

test('calculateRecipeDeductions multiplies ingredients by total ordered dish portions', () => {
  const ordered = [
    {
      quantity: 2,
      recipe: [
        { inventoryItemId: 'inv-carne', name: 'Carne Angus', quantity: 200, unit: 'g' as any },
        { inventoryItemId: 'inv-pan', name: 'Pan Brioche', quantity: 1, unit: 'und' as any },
        { inventoryItemId: 'inv-queso', name: 'Queso Cheddar', quantity: 40, unit: 'g' as any },
      ],
    },
    {
      quantity: 3,
      recipe: [
        { inventoryItemId: 'inv-queso', name: 'Queso Cheddar', quantity: 30, unit: 'g' as any },
      ],
    },
  ];

  const deductions = calculateRecipeDeductions(ordered);
  assert.equal(deductions['inv-carne'].quantity, 400); // 2 * 200
  assert.equal(deductions['inv-pan'].quantity, 2);     // 2 * 1
  assert.equal(deductions['inv-queso'].quantity, 170); // (2 * 40) + (3 * 30) = 80 + 90 = 170
});

test('calculateCashBalance verifies cash shift balancing and detects differences', () => {
  // Base 200,000 + Ventas 500,000 + Ingreso 50,000 - Egresos 30,000 = Esperado 720,000
  const balance = calculateCashBalance(200000, 500000, 50000, 30000, 720000);
  assert.equal(balance.expectedCash, 720000);
  assert.equal(balance.difference, 0);
  assert.equal(balance.hasDifference, false);

  // Shortage: Contado 700,000 (Faltante de -20,000)
  const shortage = calculateCashBalance(200000, 500000, 50000, 30000, 700000);
  assert.equal(shortage.difference, -20000);
  assert.equal(shortage.isShortage, true);
});

test('splitBillEqually distributes totals evenly with correct integer sum', () => {
  const splits = splitBillEqually(100000, 3);
  assert.equal(splits.length, 3);
  assert.equal(splits.reduce((a, b) => a + b, 0), 100000);
});
