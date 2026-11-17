import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CARTERA_PRODUCTS_PAGE_SIZE,
  resolveCarteraProductItems,
  sortCarteraProductsNewestFirst,
  paginateCarteraProducts,
  toggleCarteraItemPaidVisual,
  calculateCarteraAdditionAmounts,
} from './carteraProductsUtils';
import { CarteraProductItem, CarteraRecord, Order } from '../types';

function makeItem(id: string, addedAt: string, price = 15000, quantity = 1, paidChecked = false): CarteraProductItem {
  return {
    id,
    menuItemId: `menu-${id}`,
    name: `Producto ${id}`,
    price,
    quantity,
    addedAt,
    addedBy: 'Cajero Test',
    paidChecked,
  };
}

test('sortCarteraProductsNewestFirst - Sorts items strictly from newest to oldest', () => {
  const items: CarteraProductItem[] = [
    makeItem('oldest', '2026-05-01T10:00:00.000Z'),
    makeItem('newest', '2026-05-03T18:30:00.000Z'),
    makeItem('middle', '2026-05-02T14:15:00.000Z'),
  ];

  const sorted = sortCarteraProductsNewestFirst(items);
  assert.deepEqual(
    sorted.map((i) => i.id),
    ['newest', 'middle', 'oldest']
  );
});

test('paginateCarteraProducts - Enforces max 20 items per page sorted newest to oldest', () => {
  assert.equal(CARTERA_PRODUCTS_PAGE_SIZE, 20);

  const items: CarteraProductItem[] = [];
  const baseMs = new Date('2026-05-01T08:00:00.000Z').getTime();
  for (let i = 1; i <= 45; i++) {
    items.push(
      makeItem(`p-${i}`, new Date(baseMs + i * 60_000).toISOString())
    );
  }

  // Page 1: p-45 down to p-26 (20 items)
  const page1 = paginateCarteraProducts(items, 1);
  assert.equal(page1.totalItems, 45);
  assert.equal(page1.totalPages, 3);
  assert.equal(page1.currentPage, 1);
  assert.equal(page1.pageItems.length, 20);
  assert.equal(page1.startIndex, 1);
  assert.equal(page1.endIndex, 20);
  assert.equal(page1.pageItems[0].id, 'p-45');
  assert.equal(page1.pageItems[19].id, 'p-26');

  // Page 2: p-25 down to p-6 (20 items)
  const page2 = paginateCarteraProducts(items, 2);
  assert.equal(page2.currentPage, 2);
  assert.equal(page2.pageItems.length, 20);
  assert.equal(page2.startIndex, 21);
  assert.equal(page2.endIndex, 40);
  assert.equal(page2.pageItems[0].id, 'p-25');
  assert.equal(page2.pageItems[19].id, 'p-6');

  // Page 3: p-5 down to p-1 (5 items)
  const page3 = paginateCarteraProducts(items, 3);
  assert.equal(page3.currentPage, 3);
  assert.equal(page3.pageItems.length, 5);
  assert.equal(page3.startIndex, 41);
  assert.equal(page3.endIndex, 45);
  assert.equal(page3.pageItems[0].id, 'p-5');
  assert.equal(page3.pageItems[4].id, 'p-1');

  // Even if caller passes pageSize > 20, cap strictly at 20
  const capped = paginateCarteraProducts(items, 1, 50);
  assert.equal(capped.pageItems.length, 20);
});

test('toggleCarteraItemPaidVisual - Toggles visual strike-through without mutating prices or quantities', () => {
  const initial: CarteraProductItem[] = [
    makeItem('line-1', '2026-05-01T10:00:00.000Z', 25000, 2, false),
    makeItem('line-2', '2026-05-01T10:05:00.000Z', 12000, 1, false),
  ];

  const afterCheck = toggleCarteraItemPaidVisual(
    initial,
    'line-1',
    'María Cajera',
    undefined,
    '2026-05-02T12:00:00.000Z'
  );

  assert.equal(afterCheck[0].paidChecked, true);
  assert.equal(afterCheck[0].paidCheckedBy, 'María Cajera');
  assert.equal(afterCheck[0].paidCheckedAt, '2026-05-02T12:00:00.000Z');
  assert.equal(afterCheck[0].price, 25000);
  assert.equal(afterCheck[0].quantity, 2);
  assert.equal(afterCheck[1].paidChecked, false);

  // Sum of product values stays identical before and after strike-through
  const sumBefore = initial.reduce((s, it) => s + it.price * it.quantity, 0);
  const sumAfter = afterCheck.reduce((s, it) => s + it.price * it.quantity, 0);
  assert.equal(sumAfter, sumBefore);

  // Unchecking clears metadata cleanly
  const afterUncheck = toggleCarteraItemPaidVisual(afterCheck, 'line-1', 'María Cajera');
  assert.equal(afterUncheck[0].paidChecked, false);
  assert.equal(afterUncheck[0].paidCheckedAt, undefined);
  assert.equal(afterUncheck[0].paidCheckedBy, undefined);
});

test('resolveCarteraProductItems - Hydrates legacy CarteraRecord from linked Order excluding cancelled items', () => {
  const legacyRecord: CarteraRecord = {
    id: 'crd-legacy',
    code: 'CRD-501',
    saleId: 'ord-501',
    orderNumber: 501,
    branchId: 'sede-buga',
    customerId: 'cust-1',
    customerName: 'Pedro Díaz',
    customerPhone: '3001112233',
    customerDocument: '12345',
    totalAmount: 40000,
    initialPayment: 0,
    totalAbonado: 0,
    balanceDue: 40000,
    dueDate: '2026-12-31',
    status: 'vigente',
    createdAt: '2026-05-01T12:00:00.000Z',
    updatedAt: '2026-05-01T12:00:00.000Z',
    createdBy: 'Mesero',
  };

  const orders: Order[] = [
    {
      id: 'ord-501',
      branchId: 'sede-buga',
      orderNumber: 501,
      type: 'mesa',
      status: 'facturado',
      subtotal: 40000,
      tax: 0,
      tip: 0,
      total: 40000,
      currentRound: 2,
      waiterName: 'Carlos Mesero',
      createdAt: '2026-05-01T11:30:00.000Z',
      updatedAt: '2026-05-01T12:00:00.000Z',
      items: [
        {
          id: 'oi-1',
          menuItemId: 'm-1',
          name: 'Churrasco',
          price: 35000,
          quantity: 1,
          station: 'parrilla',
          roundNumber: 1,
          sentToKitchen: true,
        },
        {
          id: 'oi-2',
          menuItemId: 'm-2',
          name: 'Gaseosa Anulada',
          price: 5000,
          quantity: 1,
          station: 'bar_bebidas',
          roundNumber: 1,
          sentToKitchen: true,
          cancelled: true,
        },
        {
          id: 'oi-3',
          menuItemId: 'm-3',
          name: 'Limonada',
          price: 5000,
          quantity: 1,
          station: 'bar_bebidas',
          roundNumber: 2,
          sentToKitchen: true,
        },
      ],
    },
  ];

  const resolved = resolveCarteraProductItems(legacyRecord, orders);
  assert.equal(resolved.length, 2);
  assert.equal(resolved[0].name, 'Churrasco');
  assert.equal(resolved[1].name, 'Limonada');

  // Later item gets slightly newer timestamp so sorting newest-first puts Limonada first
  const sorted = sortCarteraProductsNewestFirst(resolved);
  assert.equal(sorted[0].name, 'Limonada');
  assert.equal(sorted[1].name, 'Churrasco');
});

test('calculateCarteraAdditionAmounts - Adds menu total + tax and reactivates paid account', () => {
  const res = calculateCarteraAdditionAmounts({
    newItems: [
      { price: 20000, quantity: 2 }, // 40000
      { price: 10000, quantity: 1 }, // 10000
    ],
    taxRate: 0.08,
    currentTotalAmount: 100000,
    currentBalanceDue: 0, // was previously pagada
    dueDate: '2029-12-31',
  });

  assert.equal(res.addedSubtotal, 50000);
  assert.equal(res.addedTax, 4000);
  assert.equal(res.addedTotal, 54000);
  assert.equal(res.newTotalAmount, 154000);
  assert.equal(res.newBalanceDue, 54000);
  assert.equal(res.nextStatus, 'vigente');
});
