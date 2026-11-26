import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveActivePaymentMethods,
  buildCurrentPeriodIncomes,
  buildCurrentPeriodDisbursements,
  summarizeByPaymentMethod,
  validateCashClosureInputs,
  buildCashClosureRecord,
  recalculateClosureWithEditedValues,
  isLastCashClosure,
  getDifferenceStatus,
} from './cashReconciliationUtils';
import { PaymentMethodItem, Payment, Order, Expense, CashMovement, CashClosure } from '../types';

const samplePaymentMethods: PaymentMethodItem[] = [
  { id: 'pm-nequi', name: 'Nequi', category: 'billetera_digital', isActive: true, createdAt: '2026-01-01' },
  { id: 'pm-efectivo', name: 'Efectivo', category: 'efectivo', isActive: true, isCashType: true, createdAt: '2026-01-01' },
  { id: 'pm-tarjeta', name: 'Tarjeta Débito / Crédito', category: 'tarjeta', isActive: true, createdAt: '2026-01-01' },
  { id: 'pm-inactivo', name: 'Bono Viejo', category: 'bono', isActive: false, createdAt: '2026-01-01' },
];

test('resolveActivePaymentMethods returns only active methods with Efectivo first', () => {
  const active = resolveActivePaymentMethods(samplePaymentMethods);
  assert.equal(active.length, 3);
  assert.equal(active[0].id, 'pm-efectivo');
  assert.equal(active[0].isCash, true);
  assert.equal(active.some((m) => m.id === 'pm-inactivo'), false);
});

test('validateCashClosureInputs requires ONLY Efectivo and allows optional methods empty (null)', () => {
  const active = resolveActivePaymentMethods(samplePaymentMethods);

  // Empty efectivo -> invalid
  const missingCash = validateCashClosureInputs({ 'pm-efectivo': '', 'pm-nequi': '50000' }, active);
  assert.equal(missingCash.isValid, false);

  // Only efectivo filled (even 0) -> valid, others null ("Sin registrar")
  const onlyCashZero = validateCashClosureInputs({ 'pm-efectivo': '0', 'pm-nequi': '', 'pm-tarjeta': '' }, active);
  assert.equal(onlyCashZero.isValid, true);
  assert.equal(onlyCashZero.parsedValues['pm-efectivo'], 0);
  assert.equal(onlyCashZero.parsedValues['pm-nequi'], null);
  assert.equal(onlyCashZero.parsedValues['pm-tarjeta'], null);

  // Negative value -> invalid
  const negativeVal = validateCashClosureInputs({ 'pm-efectivo': '10000', 'pm-nequi': '-500' }, active);
  assert.equal(negativeVal.isValid, false);
});

test('buildCurrentPeriodIncomes filters strictly after last closure and expands mixed splits without double counting', () => {
  const active = resolveActivePaymentMethods(samplePaymentMethods);
  const orders: Order[] = [
    { id: 'o1', branchId: 'b1', orderNumber: 101, type: 'mostrador', status: 'facturado', items: [], subtotal: 50000, tax: 0, tip: 0, total: 50000, currentRound: 1, createdAt: '2026-11-26T10:00:00Z', updatedAt: '2026-11-26T10:00:00Z' },
    { id: 'o2', branchId: 'b1', orderNumber: 102, type: 'mesa', status: 'facturado', items: [], subtotal: 40000, tax: 0, tip: 0, total: 40000, currentRound: 1, createdAt: '2026-11-26T14:00:00Z', updatedAt: '2026-11-26T14:00:00Z' },
  ];

  const payments: Payment[] = [
    // Before last closure -> excluded
    { id: 'p1', branchId: 'b1', orderId: 'o1', orderNumber: 101, shiftId: 's1', method: 'efectivo', amountPaid: 50000, subtotal: 50000, tax: 0, tipAmount: 0, total: 50000, change: 0, cashierId: 'u1', cashierName: 'Ana', createdAt: '2026-11-26T10:00:00Z' },
    // After last closure, mixed split -> expanded into 2 entries
    { id: 'p2', branchId: 'b1', orderId: 'o2', orderNumber: 102, shiftId: 's2', method: 'mixto', splits: [{ method: 'efectivo', amount: 25000 }, { method: 'Nequi', amount: 15000 }], amountPaid: 40000, subtotal: 40000, tax: 0, tipAmount: 0, total: 40000, change: 0, cashierId: 'u1', cashierName: 'Ana', createdAt: '2026-11-26T14:05:00Z' },
  ];

  const cashMovements: CashMovement[] = [
    // Auto-generated from OtherIncome -> must NOT duplicate
    { id: 'cm1', branchId: 'b1', shiftId: 's2', type: 'ingreso', amount: 10000, reason: 'Otro Ingreso #ING-0001: Venta cartón', userId: 'u1', userName: 'Ana', createdAt: '2026-11-26T14:10:00Z' },
    // Manual cash inflow -> included
    { id: 'cm2', branchId: 'b1', shiftId: 's2', type: 'ingreso', amount: 5000, reason: 'Ajuste de caja menor', userId: 'u1', userName: 'Ana', createdAt: '2026-11-26T14:15:00Z' },
  ];

  const incomes = buildCurrentPeriodIncomes({
    sinceIso: '2026-11-26T12:00:00Z',
    activeMethods: active,
    payments,
    orders,
    abonos: [],
    otherIncomes: [
      { id: 'oi1', consecutivo: 'ING-0001', branchId: 'b1', date: '2026-11-26T14:10:00Z', concept: 'Venta cartón', paymentMethod: 'efectivo', amount: 10000, status: 'activo', userId: 'u1', userName: 'Ana', createdAt: '2026-11-26T14:10:00Z' },
    ],
    supplierAdvanceReintegros: [],
    cashMovements,
    branchId: 'b1',
  });

  const summary = summarizeByPaymentMethod(incomes, active);
  assert.equal(summary.grandTotal, 55000); // 25k + 15k + 10k + 5k (no duplicate 10k)
  assert.equal(summary.byMethod.find((m) => m.methodId === 'pm-efectivo')?.total, 40000);
  assert.equal(summary.byMethod.find((m) => m.methodId === 'pm-nequi')?.total, 15000);
});

test('buildCurrentPeriodDisbursements filters after last closure and avoids Gasto # double counting', () => {
  const active = resolveActivePaymentMethods(samplePaymentMethods);
  const expenses: Expense[] = [
    { id: 'e1', branchId: 'b1', category: 'Insumos', concept: 'Hielo', thirdParty: 'Tienda', paymentMethod: 'efectivo', amount: 12000, observations: '', createdAt: '2026-11-26T15:00:00Z', userId: 'u1', userName: 'Ana', status: 'activo', consecutivo: 'EXP-1001' },
    { id: 'e2', branchId: 'b1', category: 'Servicios', concept: 'Internet', thirdParty: 'Claro', paymentMethod: 'Nequi', amount: 30000, observations: '', createdAt: '2026-11-26T15:10:00Z', userId: 'u1', userName: 'Ana', status: 'activo', consecutivo: 'EXP-1002' },
  ];
  const cashMovements: CashMovement[] = [
    // Duplicate created by createExpense -> skipped
    { id: 'cm-exp', branchId: 'b1', shiftId: 's2', type: 'egreso', amount: 12000, reason: 'Gasto #EXP-1001 (Hielo) - Tienda', userId: 'u1', userName: 'Ana', createdAt: '2026-11-26T15:00:01Z' },
    // Manual egreso -> included
    { id: 'cm-man', branchId: 'b1', shiftId: 's2', type: 'egreso', amount: 8000, reason: 'Domiciliario externo', userId: 'u1', userName: 'Ana', createdAt: '2026-11-26T15:20:00Z' },
  ];

  const disbursements = buildCurrentPeriodDisbursements({
    sinceIso: '2026-11-26T12:00:00Z',
    activeMethods: active,
    expenses,
    purchasePayments: [],
    supplierAdvances: [],
    cashMovements,
    branchId: 'b1',
  });

  const summary = summarizeByPaymentMethod(disbursements, active);
  assert.equal(summary.grandTotal, 50000); // 12k + 30k + 8k
  assert.equal(summary.byMethod.find((m) => m.methodId === 'pm-efectivo')?.total, 20000);
  assert.equal(summary.byMethod.find((m) => m.methodId === 'pm-nequi')?.total, 30000);
});

test('buildCashClosureRecord calculates base + ingresos - desembolsos, sobrante/faltante, and sin_registrar', () => {
  const active = resolveActivePaymentMethods(samplePaymentMethods);
  const closure = buildCashClosureRecord({
    id: 'cie-1',
    consecutivo: 'CIE-0001',
    branchId: 'b1',
    periodStart: null,
    closedAt: '2026-11-26T18:00:00Z',
    userId: 'u1',
    userName: 'Juan',
    baseTotal: 100000,
    baseEntries: [{ id: 'b1', amount: 100000, reason: 'Base inicial', createdAt: '2026-11-26T08:00:00Z', userName: 'Juan' }],
    activeMethods: active,
    parsedRegisteredValues: { 'pm-efectivo': 135000, 'pm-nequi': null, 'pm-tarjeta': 0 },
    incomes: [
      { id: 'i1', flow: 'ingreso', kind: 'venta', consecutivo: 'PED-1', date: '2026-11-26T14:00:00Z', concept: 'Venta', thirdParty: 'Cliente', paymentMethodId: 'pm-efectivo', paymentMethodName: 'Efectivo', amount: 50000, userName: 'Juan' },
      { id: 'i2', flow: 'ingreso', kind: 'venta', consecutivo: 'PED-2', date: '2026-11-26T14:30:00Z', concept: 'Venta', thirdParty: 'Cliente', paymentMethodId: 'pm-nequi', paymentMethodName: 'Nequi', amount: 20000, userName: 'Juan' },
    ],
    disbursements: [
      { id: 'd1', flow: 'desembolso', kind: 'gasto', consecutivo: 'EXP-1', date: '2026-11-26T15:00:00Z', concept: 'Hielo', thirdParty: 'Tienda', paymentMethodId: 'pm-efectivo', paymentMethodName: 'Efectivo', amount: 20000, userName: 'Juan' },
    ],
  });

  // Efectivo esperado = 100k (base) + 50k (ingresos) - 20k (desembolsos) = 130k
  // Efectivo registrado = 135k -> sobrante +5k
  assert.equal(closure.cashExpected, 130000);
  assert.equal(closure.cashRegistered, 135000);
  assert.equal(closure.cashDifference, 5000);

  const nequiRow = closure.methodBalances.find((m) => m.methodId === 'pm-nequi')!;
  assert.equal(nequiRow.registeredAmount, null);
  assert.equal(nequiRow.difference, null);
  assert.equal(getDifferenceStatus(nequiRow.registeredAmount, nequiRow.difference), 'sin_registrar');

  // Edit closure values: fix efectivo to 128000 (faltante -2000) and register Nequi 20000 (cuadrado)
  const edited = recalculateClosureWithEditedValues(closure, {
    'pm-efectivo': '128000',
    'pm-nequi': '20000',
    'pm-tarjeta': '',
  });
  assert.equal(edited.isValid, true);
  assert.equal(edited.updatedClosure?.cashDifference, -2000);
  assert.equal(getDifferenceStatus(edited.updatedClosure!.cashRegistered, edited.updatedClosure!.cashDifference), 'faltante');

  const editedNequi = edited.updatedClosure!.methodBalances.find((m) => m.methodId === 'pm-nequi')!;
  assert.equal(editedNequi.registeredAmount, 20000);
  assert.equal(editedNequi.difference, 0);
  assert.equal(getDifferenceStatus(editedNequi.registeredAmount, editedNequi.difference), 'cuadrado');
});

test('isLastCashClosure allows deleting ONLY the most recent closure', () => {
  const c1 = { id: 'cie-1', closedAt: '2026-11-25T22:00:00Z', createdAt: '2026-11-25T22:00:00Z' } as CashClosure;
  const c2 = { id: 'cie-2', closedAt: '2026-11-26T22:00:00Z', createdAt: '2026-11-26T22:00:00Z' } as CashClosure;
  const closures = [c1, c2];

  assert.equal(isLastCashClosure('cie-2', closures), true);
  assert.equal(isLastCashClosure('cie-1', closures), false);
  assert.equal(isLastCashClosure('non-existent', closures), false);
});
