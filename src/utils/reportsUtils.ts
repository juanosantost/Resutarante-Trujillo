/**
 * Utilidades de cálculo y agregación para Reportes y Estadísticas (Módulo 13)
 */

import { Order, Payment, Purchase, InventoryMovement, CashMovement, Product } from '../types';

export interface SalesReportSummary {
  dailySales: number;
  monthlySales: number;
  orderCount: number;
  averageTicket: number;
  grossProfit: number;
  expenses: number;
  topProducts: Array<{ name: string; quantity: number; total: number }>;
}

export function calculateSalesReport(
  orders: Order[],
  payments: Payment[],
  purchases: Purchase[],
  cashMovements: CashMovement[],
  branchId: string,
  startDate?: string,
  endDate?: string
): SalesReportSummary {
  // Filtrar por sucursal
  const branchOrders = orders.filter((o) => branchId === 'all' || o.branchId === branchId);
  const branchPayments = payments.filter((p) => branchId === 'all' || p.branchId === branchId);
  const branchPurchases = purchases.filter((p) => (branchId === 'all' || p.branchId === branchId) && p.status === 'confirmada');
  const branchCashMovs = cashMovements.filter((m) => branchId === 'all' || m.branchId === branchId);

  // Filtrar por fechas si se proveen
  const filteredOrders = branchOrders.filter((o) => {
    if (!startDate && !endDate) return true;
    const oDate = o.createdAt.split('T')[0];
    if (startDate && oDate < startDate) return false;
    if (endDate && oDate > endDate) return false;
    return true;
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7); // YYYY-MM

  const dailySales = filteredOrders
    .filter((o) => o.createdAt.startsWith(todayStr) && o.status === 'facturado')
    .reduce((sum, o) => sum + o.total, 0);

  const monthlySales = filteredOrders
    .filter((o) => o.createdAt.startsWith(currentMonthStr) && o.status === 'facturado')
    .reduce((sum, o) => sum + o.total, 0);

  const billedOrders = filteredOrders.filter((o) => o.status === 'facturado');
  const orderCount = billedOrders.length;
  const totalRevenue = billedOrders.reduce((sum, o) => sum + o.total, 0);
  const averageTicket = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;

  // Gastos (egresos de caja + compras pagadas)
  const expensesFromCash = branchCashMovs
    .filter((m) => m.type === 'egreso')
    .reduce((sum, m) => sum + m.amount, 0);
  const expensesFromPurchases = branchPurchases.reduce((sum, p) => sum + p.amountPaid, 0);
  const expenses = expensesFromCash + expensesFromPurchases;

  // Utilidad bruta estimada (Ventas - Costo estimado de insumos 30% como aproximación estándar de restaurante si receta no disponible)
  const estimatedCostOfGoods = Math.round(totalRevenue * 0.3);
  const grossProfit = totalRevenue - estimatedCostOfGoods;

  // Productos más vendidos
  const productMap: Record<string, { name: string; quantity: number; total: number }> = {};
  for (const o of billedOrders) {
    for (const item of o.items) {
      if (!productMap[item.menuItemId]) {
        productMap[item.menuItemId] = { name: item.name, quantity: 0, total: 0 };
      }
      productMap[item.menuItemId].quantity += item.quantity;
      productMap[item.menuItemId].total += item.price * item.quantity;
    }
  }

  const topProducts = Object.values(productMap).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

  return {
    dailySales,
    monthlySales,
    orderCount,
    averageTicket,
    grossProfit,
    expenses,
    topProducts,
  };
}
