import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAbonoAmount,
  recalculateCarteraBalance,
  recalculateSeparadoBalance,
  voidAbonoRecord,
  calculateCustomerMetrics,
  isCarteraOverdue,
  COUNTRY_DIAL_CODES,
} from './creditAndLayawayUtils';
import { Abono, Separado, CarteraRecord, Order } from '../types';

test('validateAbonoAmount - Validates amount constraints properly', () => {
  // Reject zero or negative
  assert.equal(validateAbonoAmount(0, 50000).isValid, false);
  assert.equal(validateAbonoAmount(-1000, 50000).isValid, false);
  assert.equal(validateAbonoAmount(NaN, 50000).isValid, false);

  // Reject amount greater than pending balance
  const overResult = validateAbonoAmount(60000, 50000);
  assert.equal(overResult.isValid, false);
  assert.match(overResult.error || '', /no puede superar/);

  // Accept exact or partial amount within balance
  assert.equal(validateAbonoAmount(50000, 50000).isValid, true);
  assert.equal(validateAbonoAmount(25000, 50000).isValid, true);
  assert.equal(validateAbonoAmount(100, 50000).isValid, true);
});

test('recalculateCarteraBalance - Accurately sums active abonos and calculates pending balance', () => {
  const abonos: Abono[] = [
    {
      id: 'abn-1',
      parentId: 'crd-1',
      parentType: 'cartera',
      receiptNumber: 'ABN-001',
      branchId: 'sede-buga',
      customerId: 'cust-1',
      customerName: 'Carlos Gómez',
      amount: 30000,
      paymentMethod: 'efectivo',
      userId: 'user-1',
      userName: 'Admin',
      createdAt: new Date().toISOString(),
      status: 'activo',
    },
    {
      id: 'abn-2',
      parentId: 'crd-1',
      parentType: 'cartera',
      receiptNumber: 'ABN-002',
      branchId: 'sede-buga',
      customerId: 'cust-1',
      customerName: 'Carlos Gómez',
      amount: 20000,
      paymentMethod: 'transferencia',
      userId: 'user-1',
      userName: 'Admin',
      createdAt: new Date().toISOString(),
      status: 'anulado', // Should be ignored!
      voidReason: 'Digitación errónea de valor',
    },
    {
      id: 'abn-3',
      parentId: 'crd-1',
      parentType: 'cartera',
      receiptNumber: 'ABN-003',
      branchId: 'sede-buga',
      customerId: 'cust-1',
      customerName: 'Carlos Gómez',
      amount: 40000,
      paymentMethod: 'nequi_daviplata',
      userId: 'user-1',
      userName: 'Admin',
      createdAt: new Date().toISOString(),
      status: 'activo',
    },
  ];

  const totalAmount = 150000;
  const initialPayment = 20000;

  const result = recalculateCarteraBalance(totalAmount, initialPayment, abonos);
  // Active abonos: 30000 + 40000 = 70000
  assert.equal(result.totalAbonado, 70000);
  // Total paid: 20000 + 70000 = 90000
  // Balance due: 150000 - 90000 = 60000
  assert.equal(result.balanceDue, 60000);
  assert.equal(result.isFullyPaid, false);

  // If another active abono covers the remaining balance
  const finalAbono: Abono = {
    ...abonos[0],
    id: 'abn-4',
    amount: 60000,
  };
  const fullyPaidResult = recalculateCarteraBalance(totalAmount, initialPayment, [...abonos, finalAbono]);
  assert.equal(fullyPaidResult.balanceDue, 0);
  assert.equal(fullyPaidResult.isFullyPaid, true);
});

test('recalculateSeparadoBalance - Computes pending layaway balance ignoring voided records', () => {
  const abonos: Abono[] = [
    {
      id: 'abn-10',
      parentId: 'sep-1',
      parentType: 'separado',
      receiptNumber: 'ABN-010',
      branchId: 'sede-buga',
      customerId: 'cust-2',
      customerName: 'Mariana Pérez',
      amount: 50000,
      paymentMethod: 'efectivo',
      userId: 'user-1',
      userName: 'Admin',
      createdAt: new Date().toISOString(),
      status: 'activo',
    },
    {
      id: 'abn-11',
      parentId: 'sep-1',
      parentType: 'separado',
      receiptNumber: 'ABN-011',
      branchId: 'sede-buga',
      customerId: 'cust-2',
      customerName: 'Mariana Pérez',
      amount: 50000,
      paymentMethod: 'efectivo',
      userId: 'user-1',
      userName: 'Admin',
      createdAt: new Date().toISOString(),
      status: 'anulado',
      voidReason: 'Cliente pagó con cheque no autorizado',
    },
  ];

  const totalAmount = 200000;
  const initialDeposit = 50000;

  const result = recalculateSeparadoBalance(totalAmount, initialDeposit, abonos);
  // Total paid: 50000 (initial) + 50000 (active abono) = 100000
  // Pending: 200000 - 100000 = 100000
  assert.equal(result.totalAbonado, 50000);
  assert.equal(result.pendingBalance, 100000);
  assert.equal(result.isFullyPaid, false);
});

test('voidAbonoRecord - Safely voids an abono requiring a valid reason', () => {
  const originalAbono: Abono = {
    id: 'abn-99',
    parentId: 'crd-99',
    parentType: 'cartera',
    receiptNumber: 'ABN-099',
    branchId: 'sede-buga',
    customerId: 'cust-99',
    customerName: 'Empresa Alimentos SAS',
    amount: 120000,
    paymentMethod: 'tarjeta',
    userId: 'user-admin',
    userName: 'Administrador Colmena',
    createdAt: new Date().toISOString(),
    status: 'activo',
  };

  // Rejects empty or too short reason
  assert.throws(() => {
    voidAbonoRecord(originalAbono, 'err', 'Administrador');
  }, /mínimo 5 caracteres/);

  // Successfully voids
  const voided = voidAbonoRecord(originalAbono, 'Transacción duplicada en datáfono', 'Administrador Colmena');
  assert.equal(voided.status, 'anulado');
  assert.equal(voided.voidReason, 'Transacción duplicada en datáfono');
  assert.equal(voided.voidedBy, 'Administrador Colmena');
  assert.ok(voided.voidedAt);

  // Cannot re-void an already voided abono
  assert.throws(() => {
    voidAbonoRecord(voided, 'Otra razón', 'Admin');
  }, /ya se encuentra anulado/);
});

test('calculateCustomerMetrics - Computes all metrics across sales, cartera and layaways', () => {
  const customerId = 'cust-123';
  const customerName = 'Helena Ruiz';

  const orders: Order[] = [
    {
      id: 'ord-1',
      branchId: 'sede-buga',
      orderNumber: 101,
      type: 'mostrador',
      customerName: 'Helena Ruiz',
      status: 'facturado',
      items: [],
      subtotal: 50000,
      tax: 4000,
      tip: 0,
      total: 54000,
      currentRound: 1,
      createdAt: '2026-02-10T14:00:00Z',
      updatedAt: '2026-02-10T14:30:00Z',
    },
    {
      id: 'ord-2',
      branchId: 'sede-buga',
      orderNumber: 102,
      type: 'mesa',
      customerName: 'Helena Ruiz',
      status: 'facturado',
      items: [],
      subtotal: 70000,
      tax: 5600,
      tip: 7000,
      total: 82600,
      currentRound: 1,
      createdAt: '2026-03-01T19:00:00Z',
      updatedAt: '2026-03-01T20:00:00Z',
    },
    {
      id: 'ord-3',
      branchId: 'sede-buga',
      orderNumber: 103,
      type: 'mostrador',
      customerName: 'Helena Ruiz',
      status: 'cancelado', // Cancelled order should not count in sales total
      items: [],
      subtotal: 40000,
      tax: 3200,
      tip: 0,
      total: 43200,
      currentRound: 1,
      createdAt: '2026-03-02T10:00:00Z',
      updatedAt: '2026-03-02T10:10:00Z',
    },
  ];

  const separados: Separado[] = [
    {
      id: 'sep-1',
      code: 'SEP-101',
      branchId: 'sede-buga',
      customerId: 'cust-123',
      customerName: 'Helena Ruiz',
      customerPhone: '+57 3123456789',
      customerDocument: '1114567890',
      items: [],
      totalAmount: 180000,
      initialDeposit: 80000,
      totalAbonado: 0,
      pendingBalance: 100000,
      deliveryDate: '2026-04-15',
      reserveInventory: true,
      sentToKitchen: false,
      status: 'activo',
      deliveryStatus: 'pendiente',
      createdAt: '2026-03-05T12:00:00Z',
      updatedAt: '2026-03-05T12:00:00Z',
      createdBy: 'Admin',
    },
  ];

  const cartera: CarteraRecord[] = [
    {
      id: 'crd-1',
      code: 'CRD-201',
      saleId: 'ord-2',
      orderNumber: 102,
      branchId: 'sede-buga',
      customerId: 'cust-123',
      customerName: 'Helena Ruiz',
      customerPhone: '+57 3123456789',
      customerDocument: '1114567890',
      totalAmount: 82600,
      initialPayment: 32600,
      totalAbonado: 0,
      balanceDue: 50000,
      dueDate: '2026-03-20',
      status: 'vigente',
      createdAt: '2026-03-01T20:00:00Z',
      updatedAt: '2026-03-01T20:00:00Z',
      createdBy: 'Admin',
    },
  ];

  const metrics = calculateCustomerMetrics(customerId, customerName, orders, separados, cartera);
  assert.equal(metrics.totalPurchasesAmount, 54000 + 82600); // 136600
  assert.equal(metrics.totalPurchasesCount, 2);
  assert.equal(metrics.carteraBalance, 50000);
  assert.equal(metrics.separadosBalance, 100000);
  assert.equal(metrics.lastPurchaseDate, '2026-03-01T19:00:00Z');
});

test('COUNTRY_DIAL_CODES - Default contains Colombia +57 and international options', () => {
  assert.ok(COUNTRY_DIAL_CODES.length >= 5);
  const colombia = COUNTRY_DIAL_CODES.find((c) => c.code === '+57');
  assert.ok(colombia);
  assert.equal(colombia?.country, 'Colombia');
  assert.equal(colombia?.flag, '🇨🇴');
});
