/**
 * Pruebas unitarias para reportes y estadísticas (Módulo 13)
 */

import test from 'node:test';
import assert from 'node:assert';
import { calculateSalesReport } from './reportsUtils';
import { Order, Payment, Purchase, CashMovement } from '../types';

test('calculateSalesReport computes sales summary, ticket average and top products correctly', () => {
  const today = new Date().toISOString().split('T')[0];
  const orders: Order[] = [
    {
      id: 'o1',
      branchId: 'sede-chapinero',
      orderNumber: 1,
      type: 'mesa',
      status: 'facturado',
      items: [
        { id: 'i1', menuItemId: 'm1', name: 'Hamburguesa Clásica', price: 25000, quantity: 2, station: 'parrilla', roundNumber: 1, sentToKitchen: true },
      ],
      subtotal: 50000,
      tax: 4000,
      tip: 5000,
      total: 59000,
      currentRound: 1,
      createdAt: `${today}T12:00:00Z`,
      updatedAt: `${today}T12:30:00Z`,
    },
  ];

  const payments: Payment[] = [];
  const purchases: Purchase[] = [];
  const cashMovements: CashMovement[] = [];

  const report = calculateSalesReport(orders, payments, purchases, cashMovements, 'sede-chapinero');
  assert.strictEqual(report.orderCount, 1);
  assert.strictEqual(report.dailySales, 59000);
  assert.strictEqual(report.averageTicket, 59000);
  assert.strictEqual(report.topProducts.length, 1);
  assert.strictEqual(report.topProducts[0].name, 'Hamburguesa Clásica');
  assert.strictEqual(report.topProducts[0].quantity, 2);
});
