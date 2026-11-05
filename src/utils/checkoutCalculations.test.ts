import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSelectedItemsTotals,
  getInitialSelectedItemIds,
  markItemsAsPaid,
  isOrderFullyPaid,
  filterReceiptItems,
} from './checkoutCalculations';
import { OrderItem, Payment, Order } from '../types';

const mockItems: OrderItem[] = [
  {
    id: 'item-1',
    menuItemId: 'prod-1',
    name: 'Hamburguesa Colmena Especial',
    price: 35000,
    quantity: 2,
    station: 'cocina_caliente',
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
    name: 'Cerveza Club Colombia Dorada',
    price: 9000,
    quantity: 3,
    station: 'bar_bebidas',
    roundNumber: 1,
    sentToKitchen: true,
    paid: true, // ya pagado previamente
  },
];

test('calculateSelectedItemsTotals computes exact totals based only on selected items', () => {
  // Only item-1 selected: 2 x 35000 = 70000
  const result1 = calculateSelectedItemsTotals(mockItems, ['item-1'], false, undefined, 0.08);
  assert.equal(result1.subtotal, 70000);
  assert.equal(result1.tax, 5600); // 8% of 70000
  assert.equal(result1.tip, 0);
  assert.equal(result1.total, 75600);
  assert.equal(result1.selectedItems.length, 1);
  assert.equal(result1.unpaidItemsCount, 2);
  assert.equal(result1.paidItemsCount, 1);

  // item-1 and item-2 selected with 10% default tip:
  // subtotal = 70000 + 12000 = 82000
  // tax = 82000 * 0.08 = 6560
  // tip = 82000 * 0.10 = 8200
  // total = 82000 + 6560 + 8200 = 96760
  const result2 = calculateSelectedItemsTotals(mockItems, ['item-1', 'item-2'], true, undefined, 0.08);
  assert.equal(result2.subtotal, 82000);
  assert.equal(result2.tax, 6560);
  assert.equal(result2.tip, 8200);
  assert.equal(result2.total, 96760);
  assert.equal(result2.selectedItems.length, 2);

  // Custom tip test
  const result3 = calculateSelectedItemsTotals(mockItems, ['item-1'], true, 10000, 0.08);
  assert.equal(result3.tip, 10000);
  assert.equal(result3.total, 70000 + 5600 + 10000);

  // Empty selection yields 0 totals
  const resultEmpty = calculateSelectedItemsTotals(mockItems, [], false);
  assert.equal(resultEmpty.subtotal, 0);
  assert.equal(resultEmpty.tax, 0);
  assert.equal(resultEmpty.total, 0);
  assert.equal(resultEmpty.selectedItems.length, 0);

  // Sucursal con Impoconsumo desmarcado (taxRate = 0)
  // subtotal = 70000 + 12000 = 82000
  // tax = 0 (NO se totaliza impoconsumo)
  // tip = 8200 (10%)
  // total = 82000 + 0 + 8200 = 90200
  const resultZeroTax = calculateSelectedItemsTotals(mockItems, ['item-1', 'item-2'], true, undefined, 0);
  assert.equal(resultZeroTax.subtotal, 82000);
  assert.equal(resultZeroTax.tax, 0);
  assert.equal(resultZeroTax.tip, 8200);
  assert.equal(resultZeroTax.total, 90200);

  // Sucursal con Impoconsumo desmarcado (taxRate = 0) y sin propina
  const resultZeroTaxNoTip = calculateSelectedItemsTotals(mockItems, ['item-1', 'item-2'], false, undefined, 0);
  assert.equal(resultZeroTaxNoTip.subtotal, 82000);
  assert.equal(resultZeroTaxNoTip.tax, 0);
  assert.equal(resultZeroTaxNoTip.tip, 0);
  assert.equal(resultZeroTaxNoTip.total, 82000);
});

test('getInitialSelectedItemIds selects unpaid items by default', () => {
  const selected = getInitialSelectedItemIds(mockItems);
  assert.deepEqual(selected, ['item-1', 'item-2']);
  assert.equal(selected.includes('item-3'), false); // item-3 is paid, excluded from default

  // If all items are paid, returns all IDs
  const allPaidItems: OrderItem[] = [
    { ...mockItems[0], paid: true },
    { ...mockItems[1], paid: true },
  ];
  assert.deepEqual(getInitialSelectedItemIds(allPaidItems), ['item-1', 'item-2']);
});

test('markItemsAsPaid immutably sets paid flag and timestamps', () => {
  const updated = markItemsAsPaid(mockItems, ['item-1'], 'pay-123', '2026-10-29T12:00:00Z');
  
  const item1 = updated.find((it) => it.id === 'item-1')!;
  assert.equal(item1.paid, true);
  assert.equal(item1.paidPaymentId, 'pay-123');
  assert.equal(item1.paidAt, '2026-10-29T12:00:00Z');

  const item2 = updated.find((it) => it.id === 'item-2')!;
  assert.equal(item2.paid, undefined);

  // Original array remains untouched
  assert.equal(mockItems[0].paid, undefined);
});

test('isOrderFullyPaid determines completion state', () => {
  assert.equal(isOrderFullyPaid(mockItems), false);

  const fullyPaid: OrderItem[] = [
    { ...mockItems[0], paid: true },
    { ...mockItems[1], paid: true },
    { ...mockItems[2], paid: true },
  ];
  assert.equal(isOrderFullyPaid(fullyPaid), true);
  assert.equal(isOrderFullyPaid([]), true);
});

test('filterReceiptItems respects selected paid items in POS invoice', () => {
  const paymentWithItems: Partial<Payment> = {
    id: 'pay-001',
    items: [mockItems[0]],
  };
  const filtered1 = filterReceiptItems(paymentWithItems, { items: mockItems });
  assert.equal(filtered1.length, 1);
  assert.equal(filtered1[0].id, 'item-1');

  // Fallback to selectedItemIds if payment.items not stored directly
  const paymentWithIds: Partial<Payment> = {
    id: 'pay-002',
    selectedItemIds: ['item-2'],
  };
  const filtered2 = filterReceiptItems(paymentWithIds, { items: mockItems });
  assert.equal(filtered2.length, 1);
  assert.equal(filtered2[0].id, 'item-2');

  // Fallback to all order items if no specific selection stored
  const paymentLegacy: Partial<Payment> = { id: 'pay-003' };
  const filtered3 = filterReceiptItems(paymentLegacy, { items: mockItems });
  assert.equal(filtered3.length, 3);
});
