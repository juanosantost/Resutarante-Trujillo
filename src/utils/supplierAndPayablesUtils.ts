/**
 * Utilidades puras de lógica de negocio para Proveedores, Anticipos y Cuentas por Pagar
 * Sistema Colmena Restaurante
 */

import {
  Supplier,
  Purchase,
  SupplierAdvance,
  PurchasePayment,
  PaymentMethod,
} from '../types';

/**
 * Valida un monto para registro de anticipo o abono
 */
export function validateFinancialAmount(amount: number, maxAllowed?: number): { isValid: boolean; error?: string } {
  if (isNaN(amount) || amount <= 0) {
    return { isValid: false, error: 'El valor debe ser un número mayor a cero (COP).' };
  }
  if (maxAllowed !== undefined && amount > maxAllowed) {
    return {
      isValid: false,
      error: `El valor no puede superar el saldo disponible de $ ${maxAllowed.toLocaleString('es-CO')} COP.`,
    };
  }
  return { isValid: true };
}

/**
 * Calcula el saldo disponible de un anticipo ignorando si está anulado
 */
export function calculateAdvanceAvailableBalance(
  originalAmount: number,
  appliedAmount: number,
  reintegratedAmount: number,
  status: string
): number {
  if (status === 'anulado') return 0;
  const balance = originalAmount - (appliedAmount || 0) - (reintegratedAmount || 0);
  return Math.max(0, Math.round(balance));
}

/**
 * Determina el estado dinámico de un anticipo a proveedor
 */
export function determineAdvanceStatus(
  originalAmount: number,
  appliedAmount: number,
  reintegratedAmount: number,
  isAnulado: boolean
): 'disponible' | 'parcialmente_aplicado' | 'aplicado_totalmente' | 'reintegrado' | 'anulado' {
  if (isAnulado) return 'anulado';
  const available = calculateAdvanceAvailableBalance(originalAmount, appliedAmount, reintegratedAmount, 'disponible');
  if (available <= 0) {
    if ((reintegratedAmount || 0) > 0 && (appliedAmount || 0) === 0) {
      return 'reintegrado';
    }
    return 'aplicado_totalmente';
  }
  if ((appliedAmount || 0) > 0 || (reintegratedAmount || 0) > 0) {
    return 'parcialmente_aplicado';
  }
  return 'disponible';
}

/**
 * Recalcula el saldo de una compra o cuenta por pagar considerando únicamente pagos activos
 */
export function recalculatePurchasePayableBalance(
  totalPurchaseAmount: number,
  payments: PurchasePayment[]
): {
  totalPaidReal: number;
  totalAdvancesApplied: number;
  totalCovered: number;
  balanceDue: number;
  paymentStatus: 'pagada' | 'parcial' | 'pendiente';
} {
  const activePayments = payments.filter((p) => p.status !== 'anulado');
  
  const totalPaidReal = activePayments
    .filter((p) => p.type !== 'aplicacion_anticipo')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalAdvancesApplied = activePayments
    .filter((p) => p.type === 'aplicacion_anticipo')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalCovered = totalPaidReal + totalAdvancesApplied;
  const balanceDue = Math.max(0, Math.round(totalPurchaseAmount - totalCovered));

  let paymentStatus: 'pagada' | 'parcial' | 'pendiente' = 'pendiente';
  if (balanceDue === 0 && totalPurchaseAmount > 0) {
    paymentStatus = 'pagada';
  } else if (totalCovered > 0) {
    paymentStatus = 'parcial';
  }

  return {
    totalPaidReal,
    totalAdvancesApplied,
    totalCovered,
    balanceDue,
    paymentStatus,
  };
}

/**
 * Anula un pago individual de una cuenta por pagar requiriendo motivo de auditoría
 */
export function voidPurchasePaymentRecord(
  payment: PurchasePayment,
  voidReason: string,
  voidedByName: string
): PurchasePayment {
  if (!voidReason || voidReason.trim().length < 5) {
    throw new Error('Debe especificar un motivo válido de anulación (mínimo 5 caracteres).');
  }
  return {
    ...payment,
    status: 'anulado',
    voidReason: voidReason.trim(),
    voidedBy: voidedByName,
    voidedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Anula un registro de anticipo
 */
export function voidSupplierAdvanceRecord(
  advance: SupplierAdvance,
  voidReason: string,
  voidedByName: string
): SupplierAdvance {
  if (!voidReason || voidReason.trim().length < 5) {
    throw new Error('Debe especificar un motivo válido de anulación de anticipo.');
  }
  if ((advance.appliedAmount || 0) > 0) {
    throw new Error(
      'No se puede anular un anticipo que ya ha sido aplicado a compras. Anule primero las aplicaciones correspondientes.'
    );
  }
  return {
    ...advance,
    status: 'anulado',
    availableBalance: 0,
    voidReason: voidReason.trim(),
    voidedBy: voidedByName,
    voidedAt: new Date().toISOString(),
  };
}

/**
 * Calcula las métricas resumidas para un proveedor específico
 */
export function calculateSupplierMetrics(
  supplierId: string,
  purchases: Purchase[],
  payments: PurchasePayment[],
  advances: SupplierAdvance[]
): {
  totalPurchasesAmount: number;
  purchasesCount: number;
  totalPaidReal: number;
  totalBalanceDue: number;
  totalAdvancesAvailable: number;
  lastPurchaseDate: string | null;
} {
  const supplierPurchases = purchases.filter((p) => p.supplierId === supplierId && p.status !== 'anulada');
  const supplierPayments = payments.filter((p) => p.supplierId === supplierId && p.status !== 'anulado');
  const supplierAdvances = advances.filter((a) => a.supplierId === supplierId && a.status !== 'anulado');

  const totalPurchasesAmount = supplierPurchases.reduce((sum, p) => sum + (p.total || 0), 0);
  const purchasesCount = supplierPurchases.length;

  const totalBalanceDue = supplierPurchases.reduce((sum, p) => {
    const pPayments = supplierPayments.filter((pay) => pay.purchaseId === p.id);
    const { balanceDue } = recalculatePurchasePayableBalance(p.total, pPayments);
    return sum + balanceDue;
  }, 0);

  const totalPaidReal = supplierPayments
    .filter((pay) => pay.type !== 'aplicacion_anticipo')
    .reduce((sum, pay) => sum + (pay.amount || 0), 0);

  const totalAdvancesAvailable = supplierAdvances.reduce((sum, a) => sum + (a.availableBalance || 0), 0);

  const dates = supplierPurchases.map((p) => p.date).sort();
  const lastPurchaseDate = dates.length > 0 ? dates[dates.length - 1] : null;

  return {
    totalPurchasesAmount,
    purchasesCount,
    totalPaidReal,
    totalBalanceDue,
    totalAdvancesAvailable,
    lastPurchaseDate,
  };
}
