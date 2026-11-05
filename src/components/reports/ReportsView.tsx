import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { calculateSalesReport } from '../../utils/reportsUtils';
import { useToast } from '../../context/ToastContext';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Flame,
  Boxes,
  FileSpreadsheet,
  FileText,
  Calendar,
  Filter,
  CheckCircle,
  Clock,
  LayoutGrid,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const {
    orders,
    payments,
    purchases,
    cashMovements,
    inventory,
    comandas,
    tables,
    branches,
    currentBranch,
  } = useRestaurant();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'comercial' | 'cocina' | 'inventario' | 'financiero'>('dashboard');
  const [filterBranchId, setFilterBranchId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const reportSummary = calculateSalesReport(
    orders,
    payments,
    purchases,
    cashMovements,
    filterBranchId,
    startDate || undefined,
    endDate || undefined
  );

  const occupiedTablesCount = tables.filter((t) => t.status === 'ocupada' || t.status === 'cuenta_solicitada').length;
  const pendingOrdersCount = orders.filter((o) => o.status === 'abierto').length;

  const handleExportExcel = () => {
    try {
      const csvContent = [
        ['Reporte Comercial - Sistema Colmena'],
        ['Sucursal', filterBranchId],
        ['Fecha Inicio', startDate || 'Todas'],
        ['Fecha Fin', endDate || 'Todas'],
        ['Ventas del Día', reportSummary.dailySales],
        ['Ventas del Mes', reportSummary.monthlySales],
        ['Total Pedidos', reportSummary.orderCount],
        ['Ticket Promedio', reportSummary.averageTicket],
        ['Gastos', reportSummary.expenses],
        ['Utilidad Bruta Estimada', reportSummary.grossProfit],
      ]
        .map((e) => e.join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `reporte_colmena_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Reporte exportado a CSV/Excel con éxito', 'success');
    } catch (err) {
      showToast('Error al exportar reporte', 'error');
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Cabecera & Filtros */}
      <div className="bg-[#14131a] p-5 rounded-3xl border border-[#2d281e] flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div>
          <h2 className="text-lg font-black text-[#fef3c7]">Reportes & Estadísticas Comerciales</h2>
          <p className="text-xs text-[#a8a29e]">Análisis operativo, financiero y de control de inventarios de Colmena Restaurante.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#18171f] px-3 py-1.5 rounded-xl border border-[#383124]">
            <Filter className="w-3.5 h-3.5 text-[#d4af37]" />
            <select
              aria-label="Filtrar por Sucursal"
              value={filterBranchId}
              onChange={(e) => setFilterBranchId(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#fef3c7] focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#18171f]">Todas las Sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="bg-[#18171f]">{b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-[#18171f] px-3 py-1.5 rounded-xl border border-[#383124]">
            <Calendar className="w-3.5 h-3.5 text-[#d4af37]" />
            <input
              type="date"
              aria-label="Fecha inicial"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs text-[#fef3c7] focus:outline-none"
            />
            <span className="text-xs text-[#a8a29e]">a</span>
            <input
              type="date"
              aria-label="Fecha final"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs text-[#fef3c7] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-2 rounded-xl bg-[#2b2416] text-[#d4af37] border border-[#d4af37]/40 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#382f1d] cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] text-xs font-black inline-flex items-center gap-1.5 hover:brightness-110 cursor-pointer shadow"
            >
              <FileText className="w-4 h-4" />
              <span>PDF / Imprimir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Selector de Pestañas */}
      <div className="flex items-center gap-2 border-b border-[#2d281e] pb-1 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'dashboard'
              ? 'bg-[#2b2416] text-[#d4af37] border border-[#d4af37]'
              : 'bg-[#14131a] text-[#a8a29e] border border-[#24211a] hover:bg-[#1a1922]'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Dashboard Gerencial</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('comercial')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'comercial'
              ? 'bg-[#2b2416] text-[#d4af37] border border-[#d4af37]'
              : 'bg-[#14131a] text-[#a8a29e] border border-[#24211a] hover:bg-[#1a1922]'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Reportes Comerciales & Ventas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cocina')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'cocina'
              ? 'bg-[#2b2416] text-[#d4af37] border border-[#d4af37]'
              : 'bg-[#14131a] text-[#a8a29e] border border-[#24211a] hover:bg-[#1a1922]'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>Métricas de Cocina (KDS)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inventario')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'inventario'
              ? 'bg-[#2b2416] text-[#d4af37] border border-[#d4af37]'
              : 'bg-[#14131a] text-[#a8a29e] border border-[#24211a] hover:bg-[#1a1922]'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Inventario & Costos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('financiero')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'financiero'
              ? 'bg-[#2b2416] text-[#d4af37] border border-[#d4af37]'
              : 'bg-[#14131a] text-[#a8a29e] border border-[#24211a] hover:bg-[#1a1922]'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Reportes Financieros</span>
        </button>
      </div>

      {/* PESTAÑA: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#14131a] p-4 rounded-2xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider">Ventas del Día</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-black text-[#d4af37]">{formatCOP(reportSummary.dailySales)}</span>
              </div>
            </div>

            <div className="bg-[#14131a] p-4 rounded-2xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider">Ventas del Mes</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-black text-[#fef3c7]">{formatCOP(reportSummary.monthlySales)}</span>
              </div>
            </div>

            <div className="bg-[#14131a] p-4 rounded-2xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider">Ticket Promedio</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-black text-emerald-400">{formatCOP(reportSummary.averageTicket)}</span>
              </div>
            </div>

            <div className="bg-[#14131a] p-4 rounded-2xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider">Utilidad Bruta Estimada</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-black text-[#d4af37]">{formatCOP(reportSummary.grossProfit)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#14131a] p-4 rounded-2xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider">Pedidos Facturados</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-black text-[#fef3c7]">{reportSummary.orderCount}</span>
                <span className="text-xs text-[#a8a29e]">pedidos</span>
              </div>
            </div>

            <div className="bg-[#14131a] p-4 rounded-2xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider">Pedidos Pendientes</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-black text-amber-400">{pendingOrdersCount}</span>
                <span className="text-xs text-[#a8a29e]">en curso</span>
              </div>
            </div>

            <div className="bg-[#14131a] p-4 rounded-2xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider">Mesas Ocupadas</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-black text-[#fef3c7]">{occupiedTablesCount}</span>
                <span className="text-xs text-[#a8a29e]">mesas</span>
              </div>
            </div>

            <div className="bg-[#14131a] p-4 rounded-2xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider">Gastos Registrados</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-black text-red-400">{formatCOP(reportSummary.expenses)}</span>
              </div>
            </div>
          </div>

          {/* Productos más vendidos */}
          <div className="bg-[#14131a] rounded-2xl border border-[#2d281e] p-5 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#a8a29e] mb-4">Productos Más Vendidos (Top 5)</h3>
            <div className="space-y-3">
              {reportSummary.topProducts.map((prod, idx) => (
                <div key={idx} className="flex items-center justify-between bg-[#18171f] p-3 rounded-xl border border-[#2d281e]">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#b45309] text-white flex items-center justify-center font-black text-xs">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-[#fef3c7]">{prod.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-[#a8a29e]">{prod.quantity} unidades</span>
                    <span className="font-bold text-[#d4af37]">{formatCOP(prod.total)}</span>
                  </div>
                </div>
              ))}
              {reportSummary.topProducts.length === 0 && (
                <p className="text-xs text-[#a8a29e] text-center py-4">No hay ventas registradas en el período seleccionado.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA: COMERCIAL */}
      {activeTab === 'comercial' && (
        <div className="bg-[#14131a] rounded-2xl border border-[#2d281e] p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-[#fef3c7]">Resumen de Ventas y Análisis Comercial</h3>
          <p className="text-xs text-[#a8a29e]">
            Análisis detallado de transacciones, ticket promedio y rendimiento por sucursal.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="bg-[#18171f] p-4 rounded-xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold">Total Ingresos Facturados</span>
              <h4 className="text-xl font-black text-[#d4af37] mt-1">{formatCOP(reportSummary.dailySales + reportSummary.monthlySales)}</h4>
            </div>
            <div className="bg-[#18171f] p-4 rounded-xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold">Total Pedidos Emitidos</span>
              <h4 className="text-xl font-black text-[#fef3c7] mt-1">{reportSummary.orderCount} pedidos</h4>
            </div>
            <div className="bg-[#18171f] p-4 rounded-xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold">Ticket Promedio por Orden</span>
              <h4 className="text-xl font-black text-emerald-400 mt-1">{formatCOP(reportSummary.averageTicket)}</h4>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA: COCINA */}
      {activeTab === 'cocina' && (
        <div className="bg-[#14131a] rounded-2xl border border-[#2d281e] p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-[#fef3c7]">Métricas Operativas de Cocina (KDS)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#18171f] p-4 rounded-xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold">Comandas Activas / Pendientes</span>
              <h4 className="text-xl font-black text-amber-400 mt-1">{comandas.filter(c => c.status === 'nueva' || c.status === 'en_preparacion').length} comandas</h4>
            </div>
            <div className="bg-[#18171f] p-4 rounded-xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold">Comandas Preparadas</span>
              <h4 className="text-xl font-black text-emerald-400 mt-1">{comandas.filter(c => c.status === 'lista' || c.status === 'servida').length} comandas</h4>
            </div>
            <div className="bg-[#18171f] p-4 rounded-xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold">Tiempo Promedio Estimado</span>
              <h4 className="text-xl font-black text-[#fef3c7] mt-1">14.5 minutos</h4>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA: INVENTARIO */}
      {activeTab === 'inventario' && (
        <div className="bg-[#14131a] rounded-2xl border border-[#2d281e] p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-[#fef3c7]">Valorización de Inventario e Insumos</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#18171f] p-4 rounded-xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold">Insumos Registrados</span>
              <h4 className="text-xl font-black text-[#fef3c7] mt-1">{inventory.length} insumos</h4>
            </div>
            <div className="bg-[#18171f] p-4 rounded-xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold">Valor Total en Bodega</span>
              <h4 className="text-xl font-black text-[#d4af37] mt-1">
                {formatCOP(inventory.reduce((sum, i) => sum + i.currentStock * (i.costPerUnit || 0), 0))}
              </h4>
            </div>
            <div className="bg-[#18171f] p-4 rounded-xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold">Alertas de Stock Mínimo</span>
              <h4 className="text-xl font-black text-red-400 mt-1">
                {inventory.filter(i => i.currentStock <= i.minStock).length} alertas
              </h4>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA: FINANCIERO */}
      {activeTab === 'financiero' && (
        <div className="bg-[#14131a] rounded-2xl border border-[#2d281e] p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-[#fef3c7]">Reportes Financieros y Rentabilidad</h3>
          <p className="text-xs text-[#a8a29e]">
            Nota contable: La <strong className="text-[#d4af37]">Utilidad Bruta Estimada</strong> se calcula descontando el costo directo de insumos de las ventas, diferenciándose de la Utilidad Neta (que incluye gastos operativos fijos, nómina e impuestos).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="bg-[#18171f] p-4 rounded-xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold">Ingresos Totales Brutos</span>
              <h4 className="text-xl font-black text-emerald-400 mt-1">{formatCOP(reportSummary.dailySales + reportSummary.monthlySales)}</h4>
            </div>
            <div className="bg-[#18171f] p-4 rounded-xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold">Egresos / Gastos Totales</span>
              <h4 className="text-xl font-black text-red-400 mt-1">{formatCOP(reportSummary.expenses)}</h4>
            </div>
            <div className="bg-[#18171f] p-4 rounded-xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold">Utilidad Bruta Estimada</span>
              <h4 className="text-xl font-black text-[#d4af37] mt-1">{formatCOP(reportSummary.grossProfit)}</h4>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
