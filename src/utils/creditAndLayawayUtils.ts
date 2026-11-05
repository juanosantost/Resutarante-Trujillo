/**
 * SISTEMA COLMENA RESTAURANTE
 * Utilidades de cálculo, validación y reglas de negocio para
 * CLIENTES, SEPARADOS (Layaway / Reservas) y CARTERA (Cuentas por Cobrar).
 */

import { Abono, Separado, CarteraRecord, Order, Customer } from '../types';

/**
 * Indicativos telefónicos con bandera para el selector internacional
 */
export interface CountryDialCode {
  country: string;
  code: string;
  flag: string;
  maskExample: string;
}

export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { country: 'Colombia', code: '+57', flag: '🇨🇴', maskExample: '315 123 4567' },
  { country: 'Estados Unidos', code: '+1', flag: '🇺🇸', maskExample: '202 555 0123' },
  { country: 'España', code: '+34', flag: '🇪🇸', maskExample: '612 345 678' },
  { country: 'México', code: '+52', flag: '🇲🇽', maskExample: '55 1234 5678' },
  { country: 'Panamá', code: '+507', flag: '🇵🇦', maskExample: '6123 4567' },
  { country: 'Ecuador', code: '+593', flag: '🇪🇨', maskExample: '99 123 4567' },
  { country: 'Perú', code: '+51', flag: '🇵🇪', maskExample: '912 345 678' },
  { country: 'Venezuela', code: '+58', flag: '🇻🇪', maskExample: '412 123 4567' },
  { country: 'Chile', code: '+56', flag: '🇨🇱', maskExample: '9 1234 5678' },
  { country: 'Argentina', code: '+54', flag: '🇦🇷', maskExample: '9 11 1234 5678' },
];

/**
 * Valida un monto de abono propuesto contra el saldo pendiente.
 * Regla: El abono inicial debe ser >= 0 y no debe superar el saldo pendiente actual.
 */
export function validateAbonoAmount(
  amount: number,
  pendingBalance: number
): { isValid: boolean; error?: string } {
  if (isNaN(amount) || amount <= 0) {
    return { isValid: false, error: 'El valor del abono debe ser mayor a cero ($0).' };
  }
  // Redondeo a 2 decimales para evitar problemas de precisión en punto flotante
  const roundedAmount = Math.round(amount * 100) / 100;
  const roundedBalance = Math.round(pendingBalance * 100) / 100;

  if (roundedAmount > roundedBalance) {
    return {
      isValid: false,
      error: `El abono ($${roundedAmount.toLocaleString('es-CO')}) no puede superar el saldo pendiente ($${roundedBalance.toLocaleString('es-CO')}).`,
    };
  }

  return { isValid: true };
}

/**
 * Recalcula el saldo pendiente de una Cartera a partir de los abonos activos.
 * Ignora totalmente los abonos con estado 'anulado'.
 */
export function recalculateCarteraBalance(
  totalAmount: number,
  initialPayment: number,
  abonos: Abono[]
): {
  totalAbonado: number;
  balanceDue: number;
  isFullyPaid: boolean;
} {
  const activeAbonos = abonos.filter((a) => a.status === 'activo');
  const sumAbonos = activeAbonos.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalPaid = Math.round(((initialPayment || 0) + sumAbonos) * 100) / 100;
  const balanceDue = Math.max(0, Math.round(((totalAmount || 0) - totalPaid) * 100) / 100);

  return {
    totalAbonado: sumAbonos,
    balanceDue,
    isFullyPaid: balanceDue <= 0,
  };
}

/**
 * Recalcula el saldo pendiente de un Separado a partir de los abonos activos.
 * Ignora totalmente los abonos con estado 'anulado'.
 */
export function recalculateSeparadoBalance(
  totalAmount: number,
  initialDeposit: number,
  abonos: Abono[]
): {
  totalAbonado: number;
  pendingBalance: number;
  isFullyPaid: boolean;
} {
  const activeAbonos = abonos.filter((a) => a.status === 'activo');
  const sumAbonos = activeAbonos.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalPaid = Math.round(((initialDeposit || 0) + sumAbonos) * 100) / 100;
  const pendingBalance = Math.max(0, Math.round(((totalAmount || 0) - totalPaid) * 100) / 100);

  return {
    totalAbonado: sumAbonos,
    pendingBalance,
    isFullyPaid: pendingBalance <= 0,
  };
}

/**
 * Anula un registro de abono específico sin anular la venta ni el separado principal.
 * Requiere motivo de anulación y datos de auditoría.
 */
export function voidAbonoRecord(
  abono: Abono,
  voidReason: string,
  voidedBy: string
): Abono {
  if (!voidReason || voidReason.trim().length < 5) {
    throw new Error('Debe proporcionar un motivo de anulación detallado (mínimo 5 caracteres).');
  }
  if (abono.status === 'anulado') {
    throw new Error('Este abono ya se encuentra anulado.');
  }

  return {
    ...abono,
    status: 'anulado',
    voidReason: voidReason.trim(),
    voidedAt: new Date().toISOString(),
    voidedBy,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Calcula las métricas financieras e históricas de un cliente específico:
 * - Total de compras completadas
 * - Cantidad de compras
 * - Saldo total de cartera pendiente
 * - Saldo pendiente en separados activos
 * - Fecha de última compra
 */
export function calculateCustomerMetrics(
  customerId: string,
  customerName: string,
  orders: Order[],
  separados: Separado[],
  cartera: CarteraRecord[]
): {
  totalPurchasesAmount: number;
  totalPurchasesCount: number;
  carteraBalance: number;
  separadosBalance: number;
  lastPurchaseDate: string | null;
} {
  // Coincidencia por customerId o por nombre
  const customerOrders = orders.filter(
    (o) =>
      o.status === 'facturado' &&
      ((o.customerName && o.customerName.toLowerCase() === customerName.toLowerCase()) ||
        (o as any).customerId === customerId)
  );

  const totalPurchasesAmount = customerOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalPurchasesCount = customerOrders.length;

  const sortedOrders = [...customerOrders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const lastPurchaseDate = sortedOrders.length > 0 ? sortedOrders[0].createdAt : null;

  // Cartera del cliente
  const customerCartera = cartera.filter(
    (c) => c.customerId === customerId && c.status !== 'anulada'
  );
  const carteraBalance = customerCartera.reduce((sum, c) => sum + (c.balanceDue || 0), 0);

  // Separados del cliente
  const customerSeparados = separados.filter(
    (s) => s.customerId === customerId && s.status === 'activo'
  );
  const separadosBalance = customerSeparados.reduce((sum, s) => sum + (s.pendingBalance || 0), 0);

  return {
    totalPurchasesAmount,
    totalPurchasesCount,
    carteraBalance: Math.round(carteraBalance * 100) / 100,
    separadosBalance: Math.round(separadosBalance * 100) / 100,
    lastPurchaseDate,
  };
}

/**
 * Determina si una cuenta de cartera está vencida según su fecha límite.
 */
export function isCarteraOverdue(dueDate: string): boolean {
  if (!dueDate) return false;
  const now = new Date();
  const due = new Date(dueDate);
  // Se considera vencida si la fecha límite es anterior al inicio del día de hoy
  return due.getTime() < now.getTime();
}
