import {
  Abono,
  CashClosure,
  CashClosureBaseEntry,
  CashClosureMethodBalance,
  CashFlowEntry,
  CashMovement,
  Expense,
  Order,
  OtherIncome,
  Payment,
  PaymentMethodCategory,
  PaymentMethodItem,
  PurchasePayment,
  SupplierAdvance,
  SupplierAdvanceReintegro,
} from '../types';

export interface ActivePaymentMethodInfo {
  id: string;
  name: string;
  category: PaymentMethodCategory;
  isCash: boolean;
}

export interface PaymentMethodSummary {
  methodId: string;
  methodName: string;
  isCash: boolean;
  total: number;
  count: number;
}

const FALLBACK_ACTIVE_METHODS: ActivePaymentMethodInfo[] = [
  { id: 'efectivo', name: 'Efectivo', category: 'efectivo', isCash: true },
  { id: 'transferencia', name: 'Transferencia Bancaria', category: 'transferencia', isCash: false },
  { id: 'nequi', name: 'Nequi', category: 'billetera_digital', isCash: false },
  { id: 'daviplata', name: 'Daviplata', category: 'billetera_digital', isCash: false },
  { id: 'tarjeta', name: 'Tarjeta Débito / Crédito', category: 'tarjeta', isCash: false },
];

function normalizeKey(value: string | undefined | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function isCashPaymentMethod(pm: {
  id?: string;
  name?: string;
  category?: string;
  isCashType?: boolean;
}): boolean {
  if (pm.isCashType) return true;
  if (pm.category === 'efectivo') return true;
  const key = normalizeKey(pm.name || pm.id);
  return key === 'efectivo' || key.includes('efectivo') || key === 'cash' || key === 'caja';
}

/**
 * Resuelve los medios de pago activos ordenando siempre Efectivo primero.
 */
export function resolveActivePaymentMethods(
  paymentMethods: PaymentMethodItem[]
): ActivePaymentMethodInfo[] {
  const active = (paymentMethods || [])
    .filter((pm) => pm.isActive)
    .map((pm) => ({
      id: pm.id,
      name: pm.name,
      category: pm.category,
      isCash: isCashPaymentMethod(pm),
    }));

  const list = active.length > 0 ? active : [...FALLBACK_ACTIVE_METHODS];

  return [...list].sort((a, b) => {
    if (a.isCash && !b.isCash) return -1;
    if (!a.isCash && b.isCash) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Mapea cualquier valor textual o ID de medio de pago (ej: 'efectivo', 'Nequi', 'nequi_daviplata', ID de Firestore)
 * al medio de pago activo correspondiente, o devuelve un descriptor legible si es un medio histórico/otro.
 */
export function matchPaymentMethod(
  rawMethod: string | undefined | null,
  activeMethods: ActivePaymentMethodInfo[]
): { methodId: string; methodName: string; isCash: boolean; category: PaymentMethodCategory } {
  const raw = (rawMethod || '').trim();
  const key = normalizeKey(raw);

  if (!key) {
    const cashMethod = activeMethods.find((m) => m.isCash) || FALLBACK_ACTIVE_METHODS[0];
    return {
      methodId: cashMethod.id,
      methodName: cashMethod.name,
      isCash: true,
      category: 'efectivo',
    };
  }

  // 1. Coincidencia exacta por ID o nombre normalizado
  const exact = activeMethods.find(
    (m) => normalizeKey(m.id) === key || normalizeKey(m.name) === key
  );
  if (exact) {
    return {
      methodId: exact.id,
      methodName: exact.name,
      isCash: exact.isCash,
      category: exact.category,
    };
  }

  // 2. Coincidencia por efectivo
  if (key.includes('efectivo') || key === 'cash' || key.includes('caja')) {
    const cashMethod = activeMethods.find((m) => m.isCash);
    if (cashMethod) {
      return {
        methodId: cashMethod.id,
        methodName: cashMethod.name,
        isCash: true,
        category: cashMethod.category,
      };
    }
  }

  // 3. Coincidencia parcial por nombre (ej. 'nequi' dentro de 'nequi_daviplata', 'tarjeta' dentro de 'Tarjeta Débito / Crédito')
  const partial = activeMethods.find((m) => {
    const mKey = normalizeKey(m.name);
    return (
      (mKey && key.includes(mKey)) ||
      (key && mKey.includes(key)) ||
      (key === 'tarjeta' && m.category === 'tarjeta') ||
      (key === 'transferencia' && m.category === 'transferencia') ||
      (key === 'nequi_daviplata' && m.category === 'billetera_digital')
    );
  });
  if (partial) {
    return {
      methodId: partial.id,
      methodName: partial.name,
      isCash: partial.isCash,
      category: partial.category,
    };
  }

  // 4. Fallback legible para métodos históricos o personalizados no activos
  const prettyName = raw.replace(/_/g, ' ');
  return {
    methodId: `other:${key}`,
    methodName: prettyName.charAt(0).toUpperCase() + prettyName.slice(1),
    isCash: false,
    category: 'otro',
  };
}

function isAfterTimestamp(isoDate: string | undefined | null, sinceIso: string | null): boolean {
  if (!sinceIso) return true;
  if (!isoDate) return false;
  const t = new Date(isoDate).getTime();
  const since = new Date(sinceIso).getTime();
  if (Number.isNaN(t) || Number.isNaN(since)) return true;
  return t > since;
}

/**
 * Obtiene la fecha de cierre del último cierre de caja (o null si no existe ninguno).
 */
export function getLastClosureTimestamp(closures: CashClosure[]): string | null {
  if (!closures || closures.length === 0) return null;
  const sorted = sortClosuresNewestFirst(closures);
  return sorted[0]?.closedAt || null;
}

export function sortClosuresNewestFirst(closures: CashClosure[]): CashClosure[] {
  return [...(closures || [])].sort(
    (a, b) => new Date(b.closedAt || b.createdAt).getTime() - new Date(a.closedAt || a.createdAt).getTime()
  );
}

/**
 * Verifica si un cierre corresponde estrictamente al ÚLTIMO cierre generado (único permitido para borrar).
 */
export function isLastCashClosure(closureId: string, closures: CashClosure[]): boolean {
  if (!closureId || !closures || closures.length === 0) return false;
  const sorted = sortClosuresNewestFirst(closures);
  return sorted[0]?.id === closureId;
}

/**
 * Construye todos los ingresos del período abierto (desde el último cierre de caja hasta el momento),
 * expandiendo pagos mixtos por medio de pago y evitando doble contabilización con movimientos de caja menor.
 */
export function buildCurrentPeriodIncomes(params: {
  sinceIso: string | null;
  activeMethods: ActivePaymentMethodInfo[];
  payments: Payment[];
  orders: Order[];
  abonos: Abono[];
  otherIncomes: OtherIncome[];
  supplierAdvanceReintegros: SupplierAdvanceReintegro[];
  cashMovements: CashMovement[];
  branchId?: string;
}): CashFlowEntry[] {
  const {
    sinceIso,
    activeMethods,
    payments,
    orders,
    abonos,
    otherIncomes,
    supplierAdvanceReintegros,
    cashMovements,
    branchId,
  } = params;

  const entries: CashFlowEntry[] = [];
  const inBranch = (itemBranchId?: string) => !branchId || !itemBranchId || itemBranchId === branchId;

  // 1. Pagos de Ventas
  for (const p of payments || []) {
    if (!inBranch(p.branchId)) continue;
    if (p.status === 'anulado') continue;
    const ord = (orders || []).find((o) => o.id === p.orderId);
    if (ord?.status === 'cancelado') continue;
    if (!isAfterTimestamp(p.createdAt, sinceIso)) continue;

    if (p.method === 'mixto' && p.splits && p.splits.length > 0) {
      p.splits.forEach((split, idx) => {
        if (!split || split.amount <= 0) return;
        const matched = matchPaymentMethod(split.method, activeMethods);
        entries.push({
          id: `${p.id}-split-${idx}`,
          flow: 'ingreso',
          kind: 'venta',
          consecutivo: `PED-${p.orderNumber}`,
          date: p.createdAt,
          concept: `Venta #${p.orderNumber} (Pago mixto)`,
          thirdParty: p.customerName || ord?.customerName || 'Cliente General',
          paymentMethodId: matched.methodId,
          paymentMethodName: matched.methodName,
          amount: split.amount,
          userName: p.cashierName || 'Caja',
        });
      });
    } else {
      const netAmount = typeof p.total === 'number' ? p.total : Math.max(0, (p.amountPaid || 0) - (p.change || 0));
      if (netAmount <= 0) continue;
      const matched = matchPaymentMethod(p.method, activeMethods);
      entries.push({
        id: p.id,
        flow: 'ingreso',
        kind: 'venta',
        consecutivo: `PED-${p.orderNumber}`,
        date: p.createdAt,
        concept: `Pago de venta #${p.orderNumber}`,
        thirdParty: p.customerName || ord?.customerName || 'Cliente General',
        paymentMethodId: matched.methodId,
        paymentMethodName: matched.methodName,
        amount: netAmount,
        userName: p.cashierName || 'Caja',
      });
    }
  }

  // 2. Abonos (Separados y Cartera)
  for (const a of abonos || []) {
    if (!inBranch(a.branchId)) continue;
    if (a.status !== 'activo') continue;
    if (!isAfterTimestamp(a.createdAt, sinceIso)) continue;
    if (!a.amount || a.amount <= 0) continue;

    const matched = matchPaymentMethod(a.paymentMethod, activeMethods);
    entries.push({
      id: `abn-${a.id}`,
      flow: 'ingreso',
      kind: a.parentType === 'separado' ? 'abono_separado' : 'abono_cartera',
      consecutivo: a.receiptNumber || a.id.substring(0, 8),
      date: a.createdAt,
      concept: a.parentType === 'separado' ? 'Abono a Separado' : 'Abono a Cartera',
      thirdParty: a.customerName || 'Cliente',
      paymentMethodId: matched.methodId,
      paymentMethodName: matched.methodName,
      amount: a.amount,
      userName: a.userName || 'Caja',
      observations: a.notes,
    });
  }

  // 3. Otros Ingresos
  for (const inc of otherIncomes || []) {
    if (!inBranch(inc.branchId)) continue;
    if (inc.status !== 'activo') continue;
    const incDate = inc.createdAt || inc.date;
    if (!isAfterTimestamp(incDate, sinceIso)) continue;
    if (!inc.amount || inc.amount <= 0) continue;

    const matched = matchPaymentMethod(inc.paymentMethod, activeMethods);
    entries.push({
      id: `inc-${inc.id}`,
      flow: 'ingreso',
      kind: 'otro_ingreso',
      consecutivo: inc.consecutivo || inc.id.substring(0, 8),
      date: incDate,
      concept: inc.concept,
      thirdParty: inc.thirdParty || 'General',
      paymentMethodId: matched.methodId,
      paymentMethodName: matched.methodName,
      amount: inc.amount,
      userName: inc.userName || 'Caja',
      observations: inc.observations,
    });
  }

  // 4. Reintegros de Anticipos a Proveedores
  for (const r of supplierAdvanceReintegros || []) {
    if (!inBranch(r.branchId)) continue;
    const rDate = r.createdAt || r.date;
    if (!isAfterTimestamp(rDate, sinceIso)) continue;
    if (!r.amount || r.amount <= 0) continue;

    const matched = matchPaymentMethod(r.paymentMethod, activeMethods);
    entries.push({
      id: `rei-${r.id}`,
      flow: 'ingreso',
      kind: 'reintegro_proveedor',
      consecutivo: r.receiptNumber || r.id.substring(0, 8),
      date: rDate,
      concept: 'Reintegro de anticipo de proveedor',
      thirdParty: r.supplierName || 'Proveedor',
      paymentMethodId: matched.methodId,
      paymentMethodName: matched.methodName,
      amount: r.amount,
      userName: r.userName || 'Caja',
      observations: r.observations,
    });
  }

  // 5. Ingresos manuales de Caja Menor (evitar duplicados ya registrados en Otros Ingresos o Abonos)
  for (const mov of cashMovements || []) {
    if (!inBranch(mov.branchId)) continue;
    if (mov.type !== 'ingreso') continue;
    if (!isAfterTimestamp(mov.createdAt, sinceIso)) continue;
    if (!mov.amount || mov.amount <= 0) continue;

    const reasonLower = (mov.reason || '').toLowerCase();
    if (
      reasonLower.startsWith('otro ingreso #') ||
      reasonLower.startsWith('abono ') ||
      reasonLower.startsWith('abono #')
    ) {
      continue;
    }

    const matched = matchPaymentMethod('efectivo', activeMethods);
    entries.push({
      id: `cmov-in-${mov.id}`,
      flow: 'ingreso',
      kind: 'caja_menor_ingreso',
      consecutivo: mov.id.substring(0, 10),
      date: mov.createdAt,
      concept: mov.reason || 'Ingreso de caja menor',
      thirdParty: mov.userName || 'Caja Menor',
      paymentMethodId: matched.methodId,
      paymentMethodName: matched.methodName,
      amount: mov.amount,
      userName: mov.userName || 'Caja',
    });
  }

  return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Construye todos los desembolsos del período abierto (desde el último cierre de caja hasta el momento),
 * evitando doble contabilización entre Gastos y Caja Menor, y omitiendo aplicaciones contables de anticipos.
 */
export function buildCurrentPeriodDisbursements(params: {
  sinceIso: string | null;
  activeMethods: ActivePaymentMethodInfo[];
  expenses: Expense[];
  purchasePayments: PurchasePayment[];
  supplierAdvances: SupplierAdvance[];
  cashMovements: CashMovement[];
  branchId?: string;
}): CashFlowEntry[] {
  const {
    sinceIso,
    activeMethods,
    expenses,
    purchasePayments,
    supplierAdvances,
    cashMovements,
    branchId,
  } = params;

  const entries: CashFlowEntry[] = [];
  const inBranch = (itemBranchId?: string) => !branchId || !itemBranchId || itemBranchId === branchId;

  // 1. Gastos registrados
  for (const exp of expenses || []) {
    if (!inBranch(exp.branchId)) continue;
    if (exp.status !== 'activo') continue;
    if (!isAfterTimestamp(exp.createdAt, sinceIso)) continue;
    if (!exp.amount || exp.amount <= 0) continue;

    const matched = matchPaymentMethod(exp.paymentMethod, activeMethods);
    entries.push({
      id: `exp-${exp.id}`,
      flow: 'desembolso',
      kind: 'gasto',
      consecutivo: exp.consecutivo || exp.id.substring(0, 8),
      date: exp.createdAt,
      concept: `${exp.category ? `[${exp.category}] ` : ''}${exp.concept}`,
      thirdParty: exp.thirdParty || 'Gasto Operativo',
      paymentMethodId: matched.methodId,
      paymentMethodName: matched.methodName,
      amount: exp.amount,
      userName: exp.userName || 'Caja',
      observations: exp.observations,
    });
  }

  // 2. Pagos reales a proveedores (excluyendo aplicaciones de anticipos ya pagados)
  for (const pp of purchasePayments || []) {
    if (!inBranch(pp.branchId)) continue;
    if (pp.status === 'anulado') continue;
    if (pp.type === 'aplicacion_anticipo') continue;
    const ppDate = pp.createdAt || pp.date;
    if (!isAfterTimestamp(ppDate, sinceIso)) continue;
    if (!pp.amount || pp.amount <= 0) continue;

    const matched = matchPaymentMethod(pp.paymentMethod, activeMethods);
    entries.push({
      id: `pp-${pp.id}`,
      flow: 'desembolso',
      kind: 'pago_proveedor',
      consecutivo: pp.receiptNumber || pp.id.substring(0, 8),
      date: ppDate,
      concept: pp.notes ? `Pago compra: ${pp.notes}` : 'Pago a proveedor por compra',
      thirdParty: pp.supplierName || 'Proveedor',
      paymentMethodId: matched.methodId,
      paymentMethodName: matched.methodName,
      amount: pp.amount,
      userName: pp.userName || 'Caja',
      observations: pp.notes,
    });
  }

  // 3. Anticipos entregados a proveedores
  for (const adv of supplierAdvances || []) {
    if (!inBranch(adv.branchId)) continue;
    if (adv.status === 'anulado') continue;
    const advDate = adv.createdAt || adv.date;
    if (!isAfterTimestamp(advDate, sinceIso)) continue;
    const amt = adv.originalAmount ?? adv.amount ?? 0;
    if (amt <= 0) continue;

    const matched = matchPaymentMethod(adv.paymentMethod, activeMethods);
    entries.push({
      id: `adv-${adv.id}`,
      flow: 'desembolso',
      kind: 'anticipo_proveedor',
      consecutivo: adv.receiptNumber || adv.id.substring(0, 8),
      date: advDate,
      concept: 'Anticipo entregado a proveedor',
      thirdParty: adv.supplierName || 'Proveedor',
      paymentMethodId: matched.methodId,
      paymentMethodName: matched.methodName,
      amount: amt,
      userName: adv.userName || 'Caja',
      observations: adv.observations,
    });
  }

  // 4. Egresos manuales de Caja Menor (excluir los generados automáticamente por Gastos #EXP)
  for (const mov of cashMovements || []) {
    if (!inBranch(mov.branchId)) continue;
    if (mov.type !== 'egreso') continue;
    if (!isAfterTimestamp(mov.createdAt, sinceIso)) continue;
    if (!mov.amount || mov.amount <= 0) continue;

    const reasonLower = (mov.reason || '').toLowerCase();
    if (reasonLower.startsWith('gasto #')) {
      continue;
    }

    const matched = matchPaymentMethod('efectivo', activeMethods);
    entries.push({
      id: `cmov-out-${mov.id}`,
      flow: 'desembolso',
      kind: 'caja_menor_egreso',
      consecutivo: mov.id.substring(0, 10),
      date: mov.createdAt,
      concept: mov.reason || 'Egreso de caja menor',
      thirdParty: mov.userName || 'Caja Menor',
      paymentMethodId: matched.methodId,
      paymentMethodName: matched.methodName,
      amount: mov.amount,
      userName: mov.userName || 'Caja',
    });
  }

  return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Calcula los totales y cantidad de registros por cada medio de pago activo (más cualquier medio adicional presente en movimientos).
 */
export function summarizeByPaymentMethod(
  entries: CashFlowEntry[],
  activeMethods: ActivePaymentMethodInfo[]
): { byMethod: PaymentMethodSummary[]; grandTotal: number } {
  const map = new Map<string, PaymentMethodSummary>();

  for (const pm of activeMethods) {
    map.set(pm.id, {
      methodId: pm.id,
      methodName: pm.name,
      isCash: pm.isCash,
      total: 0,
      count: 0,
    });
  }

  let grandTotal = 0;
  for (const entry of entries || []) {
    grandTotal += entry.amount;
    const existing = map.get(entry.paymentMethodId);
    if (existing) {
      existing.total += entry.amount;
      existing.count += 1;
    } else {
      map.set(entry.paymentMethodId, {
        methodId: entry.paymentMethodId,
        methodName: entry.paymentMethodName,
        isCash: false,
        total: entry.amount,
        count: 1,
      });
    }
  }

  return {
    byMethod: Array.from(map.values()),
    grandTotal,
  };
}

/**
 * Parsea un campo numérico de entrada del formulario de cuadre.
 * Cadena vacía => null ("Sin registrar").
 */
export function parseOptionalCurrencyInput(rawValue: string | undefined | null): {
  value: number | null;
  isValid: boolean;
} {
  if (rawValue === undefined || rawValue === null) {
    return { value: null, isValid: true };
  }
  const trimmed = String(rawValue).trim();
  if (trimmed === '') {
    return { value: null, isValid: true };
  }
  const cleaned = trimmed.replace(/[$,\s]/g, '');
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) {
    return { value: null, isValid: false };
  }
  return { value: Math.round(num), isValid: true };
}

/**
 * Valida el formulario de registro/edición de cuadre:
 * - ÚNICAMENTE el campo de Efectivo es obligatorio (puede ser 0, pero no vacío ni negativo).
 * - Los demás medios de pago activos son opcionales (vacío => null => "Sin registrar").
 */
export function validateCashClosureInputs(
  rawValuesByMethodId: Record<string, string>,
  methods: Array<{ id: string; name: string; isCash: boolean }>
): {
  isValid: boolean;
  error?: string;
  parsedValues: Record<string, number | null>;
} {
  const parsedValues: Record<string, number | null> = {};
  const cashMethod = methods.find((m) => m.isCash);

  if (!cashMethod) {
    return {
      isValid: false,
      error: 'No hay un medio de pago de Efectivo activo configurado.',
      parsedValues,
    };
  }

  for (const method of methods) {
    const raw = rawValuesByMethodId[method.id];
    const parsed = parseOptionalCurrencyInput(raw);
    if (!parsed.isValid) {
      return {
        isValid: false,
        error: `Ingresa un valor numérico válido (mayor o igual a 0) para ${method.name}.`,
        parsedValues,
      };
    }

    if (method.isCash && parsed.value === null) {
      return {
        isValid: false,
        error: `El campo de ${method.name} es obligatorio para registrar el cuadre.`,
        parsedValues,
      };
    }

    parsedValues[method.id] = parsed.value;
  }

  return { isValid: true, parsedValues };
}

/**
 * Construye un registro completo de Cierre de Caja (CashClosure) con balance detallado por medio de pago.
 */
export function buildCashClosureRecord(params: {
  id: string;
  consecutivo: string;
  branchId: string;
  periodStart: string | null;
  closedAt: string;
  userId: string;
  userName: string;
  notes?: string;
  baseTotal: number;
  baseEntries: CashClosureBaseEntry[];
  activeMethods: ActivePaymentMethodInfo[];
  parsedRegisteredValues: Record<string, number | null>;
  incomes: CashFlowEntry[];
  disbursements: CashFlowEntry[];
  closedShiftId?: string | null;
}): CashClosure {
  const {
    id,
    consecutivo,
    branchId,
    periodStart,
    closedAt,
    userId,
    userName,
    notes,
    baseTotal,
    baseEntries,
    activeMethods,
    parsedRegisteredValues,
    incomes,
    disbursements,
    closedShiftId,
  } = params;

  const incomeSummary = summarizeByPaymentMethod(incomes, activeMethods);
  const disbursementSummary = summarizeByPaymentMethod(disbursements, activeMethods);

  // Combinar todos los medios activos + cualquier medio adicional que haya tenido movimientos
  const methodMap = new Map<
    string,
    { id: string; name: string; category: PaymentMethodCategory; isCash: boolean }
  >();
  for (const m of activeMethods) {
    methodMap.set(m.id, m);
  }
  for (const entry of [...incomes, ...disbursements]) {
    if (!methodMap.has(entry.paymentMethodId)) {
      methodMap.set(entry.paymentMethodId, {
        id: entry.paymentMethodId,
        name: entry.paymentMethodName,
        category: 'otro',
        isCash: false,
      });
    }
  }

  const orderedMethods = Array.from(methodMap.values()).sort((a, b) => {
    if (a.isCash && !b.isCash) return -1;
    if (!a.isCash && b.isCash) return 1;
    return a.name.localeCompare(b.name);
  });

  const methodBalances: CashClosureMethodBalance[] = orderedMethods.map((m) => {
    const inc = incomeSummary.byMethod.find((x) => x.methodId === m.id)?.total || 0;
    const disb = disbursementSummary.byMethod.find((x) => x.methodId === m.id)?.total || 0;
    const baseAmt = m.isCash ? baseTotal : 0;
    const expectedAmount = baseAmt + inc - disb;
    const regVal =
      parsedRegisteredValues[m.id] !== undefined ? parsedRegisteredValues[m.id] : null;
    const difference = regVal !== null ? regVal - expectedAmount : null;

    return {
      methodId: m.id,
      methodName: m.name,
      category: m.category,
      isCash: m.isCash,
      baseAmount: baseAmt,
      incomesTotal: inc,
      disbursementsTotal: disb,
      expectedAmount,
      registeredAmount: regVal,
      difference,
    };
  });

  const cashRow = methodBalances.find((mb) => mb.isCash);
  const cashExpected = cashRow ? cashRow.expectedAmount : baseTotal;
  const cashRegistered = cashRow && cashRow.registeredAmount !== null ? cashRow.registeredAmount : 0;
  const cashDifference = cashRegistered - cashExpected;

  return {
    id,
    consecutivo,
    branchId,
    periodStart,
    closedAt,
    createdAt: closedAt,
    userId,
    userName,
    notes: notes?.trim() || undefined,
    baseTotal,
    baseEntries,
    methodBalances,
    totalIncomes: incomeSummary.grandTotal,
    totalDisbursements: disbursementSummary.grandTotal,
    cashExpected,
    cashRegistered,
    cashDifference,
    incomes,
    disbursements,
    closedShiftId: closedShiftId || null,
  };
}

/**
 * Recalcula un cierre existente cuando el usuario edita los valores registrados en los medios de pago.
 */
export function recalculateClosureWithEditedValues(
  closure: CashClosure,
  rawValuesByMethodId: Record<string, string>,
  notes?: string
): { isValid: boolean; error?: string; updatedClosure?: CashClosure } {
  const methodsForValidation = closure.methodBalances.map((mb) => ({
    id: mb.methodId,
    name: mb.methodName,
    isCash: mb.isCash,
  }));

  const validation = validateCashClosureInputs(rawValuesByMethodId, methodsForValidation);
  if (!validation.isValid) {
    return { isValid: false, error: validation.error };
  }

  const updatedMethodBalances: CashClosureMethodBalance[] = closure.methodBalances.map((mb) => {
    const nextReg =
      validation.parsedValues[mb.methodId] !== undefined
        ? validation.parsedValues[mb.methodId]
        : null;
    return {
      ...mb,
      registeredAmount: nextReg,
      difference: nextReg !== null ? nextReg - mb.expectedAmount : null,
    };
  });

  const cashRow = updatedMethodBalances.find((mb) => mb.isCash);
  const cashExpected = cashRow ? cashRow.expectedAmount : closure.cashExpected;
  const cashRegistered = cashRow && cashRow.registeredAmount !== null ? cashRow.registeredAmount : 0;
  const cashDifference = cashRegistered - cashExpected;

  return {
    isValid: true,
    updatedClosure: {
      ...closure,
      methodBalances: updatedMethodBalances,
      cashExpected,
      cashRegistered,
      cashDifference,
      notes: notes !== undefined ? notes.trim() || undefined : closure.notes,
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Formatea el estado de diferencia (Cuadrado / Sobrante / Faltante / Sin registrar).
 */
export function getDifferenceStatus(
  registeredAmount: number | null,
  difference: number | null
): 'sin_registrar' | 'cuadrado' | 'sobrante' | 'faltante' {
  if (registeredAmount === null || difference === null) return 'sin_registrar';
  if (difference === 0) return 'cuadrado';
  return difference > 0 ? 'sobrante' : 'faltante';
}
