import { test } from 'node:test';
import assert from 'node:assert';
import {
  validateFinancialAmount,
  calculateAdvanceAvailableBalance,
  determineAdvanceStatus,
  recalculatePurchasePayableBalance,
  voidPurchasePaymentRecord,
  voidSupplierAdvanceRecord,
  calculateSupplierMetrics,
} from './supplierAndPayablesUtils';
import { SupplierAdvance, PurchasePayment, Purchase } from '../types';

test('validateFinancialAmount - Validates positive numbers and max bounds', () => {
  assert.strictEqual(validateFinancialAmount(0).isValid, false);
  assert.strictEqual(validateFinancialAmount(-500).isValid, false);
  assert.strictEqual(validateFinancialAmount(100000).isValid, true);

  assert.strictEqual(validateFinancialAmount(150000, 100000).isValid, false);
  assert.strictEqual(validateFinancialAmount(80000, 100000).isValid, true);
});

test('calculateAdvanceAvailableBalance - Calculates available balance properly', () => {
  assert.strictEqual(calculateAdvanceAvailableBalance(300000, 100000, 50000, 'disponible'), 150000);
  assert.strictEqual(calculateAdvanceAvailableBalance(300000, 300000, 0, 'aplicado_totalmente'), 0);
  assert.strictEqual(calculateAdvanceAvailableBalance(300000, 100000, 0, 'anulado'), 0);
});

test('determineAdvanceStatus - Determines correct status transitions', () => {
  assert.strictEqual(determineAdvanceStatus(300000, 0, 0, false), 'disponible');
  assert.strictEqual(determineAdvanceStatus(300000, 100000, 0, false), 'parcialmente_aplicado');
  assert.strictEqual(determineAdvanceStatus(300000, 300000, 0, false), 'aplicado_totalmente');
  assert.strictEqual(determineAdvanceStatus(300000, 0, 300000, false), 'reintegrado');
  assert.strictEqual(determineAdvanceStatus(300000, 0, 0, true), 'anulado');
});

test('recalculatePurchasePayableBalance - Calculates balance and ignores voided payments', () => {
  const mockPayments: PurchasePayment[] = [
    {
      id: 'p1',
      branchId: 'b1',
      purchaseId: 'pur1',
      supplierId: 'sup1',
      supplierName: 'Distribuidora del Valle',
      amount: 200000,
      paymentMethod: 'efectivo',
      type: 'pago_real',
      status: 'activo',
      date: '2026-10-25',
      userId: 'u1',
      userName: 'Juan',
    },
    {
      id: 'p2',
      branchId: 'b1',
      purchaseId: 'pur1',
      supplierId: 'sup1',
      supplierName: 'Distribuidora del Valle',
      amount: 150000,
      paymentMethod: 'transferencia',
      type: 'pago_real',
      status: 'anulado', // Voided!
      date: '2026-10-25',
      userId: 'u1',
      userName: 'Juan',
    },
    {
      id: 'p3',
      branchId: 'b1',
      purchaseId: 'pur1',
      supplierId: 'sup1',
      supplierName: 'Distribuidora del Valle',
      amount: 100000,
      paymentMethod: 'efectivo',
      type: 'aplicacion_anticipo',
      status: 'activo',
      date: '2026-10-25',
      userId: 'u1',
      userName: 'Juan',
    },
  ];

  const result = recalculatePurchasePayableBalance(500000, mockPayments);
  assert.strictEqual(result.totalPaidReal, 200000);
  assert.strictEqual(result.totalAdvancesApplied, 100000);
  assert.strictEqual(result.totalCovered, 300000);
  assert.strictEqual(result.balanceDue, 200000);
  assert.strictEqual(result.paymentStatus, 'parcial');
});

test('voidPurchasePaymentRecord - Soft-voids payment with audit info', () => {
  const mockPay: PurchasePayment = {
    id: 'pay1',
    branchId: 'b1',
    purchaseId: 'pur1',
    supplierId: 'sup1',
    supplierName: 'Proveedor X',
    amount: 100000,
    paymentMethod: 'efectivo',
    type: 'pago_real',
    status: 'activo',
    date: '2026-10-25',
    userId: 'u1',
    userName: 'Juan',
  };

  assert.throws(() => voidPurchasePaymentRecord(mockPay, 'Abc', 'Admin'));
  const voided = voidPurchasePaymentRecord(mockPay, 'Error de transferencia bancaria', 'Juan Admin');
  assert.strictEqual(voided.status, 'anulado');
  assert.strictEqual(voided.voidReason, 'Error de transferencia bancaria');
  assert.strictEqual(voided.voidedBy, 'Juan Admin');
});

test('voidSupplierAdvanceRecord - Prevents voiding advance if already applied', () => {
  const mockAdv: SupplierAdvance = {
    id: 'adv1',
    branchId: 'b1',
    supplierId: 'sup1',
    supplierName: 'Proveedor Y',
    amount: 300000,
    originalAmount: 300000,
    appliedAmount: 100000,
    reintegratedAmount: 0,
    availableBalance: 200000,
    balance: 200000,
    status: 'parcialmente_aplicado',
    date: '2026-10-25',
    paymentMethod: 'transferencia',
    userId: 'u1',
    userName: 'Juan',
  };

  assert.throws(() => voidSupplierAdvanceRecord(mockAdv, 'Anulación requerida', 'Admin'));

  const cleanAdv = { ...mockAdv, appliedAmount: 0, status: 'disponible' as const };
  const voided = voidSupplierAdvanceRecord(cleanAdv, 'Solicitud del proveedor', 'Admin');
  assert.strictEqual(voided.status, 'anulado');
  assert.strictEqual(voided.availableBalance, 0);
});

test('calculateSupplierMetrics - Aggregates supplier metrics across purchases, payments and advances', () => {
  const mockPurchases: Purchase[] = [
    {
      id: 'pur1',
      branchId: 'b1',
      supplierId: 'sup1',
      supplierName: 'Carnes de Colombia',
      date: '2026-10-20',
      documentNumber: 'FAC-101',
      items: [],
      subtotal: 400000,
      tax: 0,
      total: 400000,
      paymentMethod: 'credito',
      paymentStatus: 'parcial',
      amountPaid: 100000,
      balanceDue: 300000,
      status: 'confirmada',
      userId: 'u1',
      userName: 'Juan',
      createdAt: '2026-10-20',
    },
  ];

  const mockPayments: PurchasePayment[] = [
    {
      id: 'pay1',
      branchId: 'b1',
      purchaseId: 'pur1',
      supplierId: 'sup1',
      supplierName: 'Carnes de Colombia',
      amount: 100000,
      paymentMethod: 'efectivo',
      type: 'pago_real',
      status: 'activo',
      date: '2026-10-20',
      userId: 'u1',
      userName: 'Juan',
    },
  ];

  const mockAdvances: SupplierAdvance[] = [
    {
      id: 'adv1',
      branchId: 'b1',
      supplierId: 'sup1',
      supplierName: 'Carnes de Colombia',
      amount: 150000,
      originalAmount: 150000,
      appliedAmount: 0,
      reintegratedAmount: 0,
      availableBalance: 150000,
      balance: 150000,
      status: 'disponible',
      date: '2026-10-22',
      paymentMethod: 'transferencia',
      userId: 'u1',
      userName: 'Juan',
    },
  ];

  const metrics = calculateSupplierMetrics('sup1', mockPurchases, mockPayments, mockAdvances);
  assert.strictEqual(metrics.totalPurchasesAmount, 400000);
  assert.strictEqual(metrics.purchasesCount, 1);
  assert.strictEqual(metrics.totalPaidReal, 100000);
  assert.strictEqual(metrics.totalBalanceDue, 300000);
  assert.strictEqual(metrics.totalAdvancesAvailable, 150000);
  assert.strictEqual(metrics.lastPurchaseDate, '2026-10-20');
});
