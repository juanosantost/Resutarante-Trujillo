import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { Purchase, CashMovement } from '../../types';
import {
  DollarSign,
  Truck,
  ShoppingBag,
  FileText,
  CreditCard,
  Plus,
  Search,
  Calendar,
  Download,
  Printer,
  Eye,
  Edit2,
  XCircle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Building,
  X,
} from 'lucide-react';

interface DisbursementsViewProps {
  onNavigateToView: (view: string) => void;
}

export const DisbursementsView: React.FC<DisbursementsViewProps> = ({ onNavigateToView }) => {
  const {
    purchases,
    cashMovements,
    currentBranch,
    cancelPurchase,
    actionLoading,
  } = useRestaurant();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const isAdmin = currentUser?.role === 'administrador';

  const [selectedDetailItem, setSelectedDetailItem] = useState<DisbursementItem | null>(null);

  // Filtros por defecto (hoy en Colombia para Asesor, o mes actual para Administrador)
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState<string>(isAdmin ? todayStr.substring(0, 8) + '01' : todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'todos' | 'compras' | 'gastos' | 'reintegros'>('todos');

  // Filtrar registros de la sucursal actual
  const branchPurchases = purchases.filter((p) => p.branchId === currentBranch?.id || !p.branchId);
  const branchMovements = cashMovements.filter((m) => m.branchId === currentBranch?.id || !m.branchId);

  // Gastos (egresos de caja menor o gastos operativos)
  const expenseMovements = branchMovements.filter((m) => m.type === 'egreso');
  // Reintegros (ingresos de caja por devoluciones / reintegros)
  const refundMovements = branchMovements.filter((m) => m.type === 'ingreso' && m.reason.toLowerCase().includes('reintegro'));

  // Unificar en lista de desembolsos
  interface DisbursementItem {
    id: string;
    type: 'compra' | 'gasto' | 'reintegro';
    consecutivo: string;
    date: string;
    detail: string;
    thirdParty: string;
    paymentMethod: string;
    commercialValue: number;
    paidValue: number;
    pendingValue: number;
    observations: string;
    status: 'activo' | 'anulado';
    originalRef: Purchase | CashMovement;
  }

  const allItems: DisbursementItem[] = [
    ...branchPurchases.map((p) => ({
      id: p.id,
      type: 'compra' as const,
      consecutivo: p.documentNumber || p.id.substring(0, 8),
      date: p.date || p.createdAt,
      detail: `Compra de insumos (${p.items?.length || 0} ítems)`,
      thirdParty: p.supplierName,
      paymentMethod: p.paymentMethod,
      commercialValue: p.total,
      paidValue: p.amountPaid,
      pendingValue: Math.max(0, p.total - p.amountPaid),
      observations: p.observations || 'Sin observaciones',
      status: p.status === 'anulada' ? ('anulado' as const) : ('activo' as const),
      originalRef: p,
    })),
    ...expenseMovements.map((m) => ({
      id: m.id,
      type: 'gasto' as const,
      consecutivo: m.id.substring(0, 8),
      date: m.createdAt,
      detail: m.reason,
      thirdParty: m.userName || 'Gasto Operativo',
      paymentMethod: 'Efectivo / Caja',
      commercialValue: m.amount,
      paidValue: m.amount,
      pendingValue: 0,
      observations: m.reason,
      status: 'activo' as const,
      originalRef: m,
    })),
    ...refundMovements.map((r) => ({
      id: r.id,
      type: 'reintegro' as const,
      consecutivo: r.id.substring(0, 8),
      date: r.createdAt,
      detail: r.reason,
      thirdParty: r.userName || 'Cliente / Proveedor',
      paymentMethod: 'Efectivo',
      commercialValue: r.amount,
      paidValue: r.amount,
      pendingValue: 0,
      observations: r.reason,
      status: 'activo' as const,
      originalRef: r,
    })),
  ];

  // Filtrar por fecha, tipo y búsqueda
  const filteredItems = allItems.filter((item) => {
    const itemDate = item.date.split('T')[0];
    if (startDate && itemDate < startDate) return false;
    if (endDate && itemDate > endDate) return false;
    if (typeFilter !== 'todos' && item.type !== (typeFilter === 'compras' ? 'compra' : typeFilter === 'gastos' ? 'gasto' : 'reintegro')) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDetail = item.detail.toLowerCase().includes(q);
      const matchThird = item.thirdParty.toLowerCase().includes(q);
      const matchDoc = item.consecutivo.toLowerCase().includes(q);
      if (!matchDetail && !matchThird && !matchDoc) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Totales y estadísticas
  const activeItems = filteredItems.filter((i) => i.status === 'activo');
  const totalActiveValue = activeItems.reduce((acc, i) => acc + (i.type === 'reintegro' ? -i.commercialValue : i.commercialValue), 0);
  const totalPaidValue = activeItems.reduce((acc, i) => acc + i.paidValue, 0);
  const totalPendingValue = activeItems.reduce((acc, i) => acc + i.pendingValue, 0);

  const countPurchases = activeItems.filter((i) => i.type === 'compra').length;
  const countExpenses = activeItems.filter((i) => i.type === 'gasto').length;
  const countRefunds = activeItems.filter((i) => i.type === 'reintegro').length;

  const handleExportExcel = () => {
    showToast('Generando reporte Excel de Desembolsos...', 'success');
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Cabecera y Botones de Registro */}
      <div className="bg-[#181818] p-6 rounded-3xl border border-[#333333] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[#FFFDF5] tracking-wide">
            DESEMBOLSOS
          </h2>
          <p className="text-xs text-[#d6d3d1] mt-0.5">
            Compras y gastos de la sucursal <strong className="text-[#D6A21A]">{currentBranch?.name}</strong> en un solo espacio.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigateToView('registrar-compra')}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs flex items-center gap-2 hover:brightness-110 shadow-lg cursor-pointer"
          >
            <Truck className="w-4 h-4" />
            <span>Registrar Compra</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToView('registrar-gasto')}
            className="px-4 py-2.5 rounded-xl bg-[#242424] text-[#D6A21A] border border-[#383838] hover:bg-[#2e2e2e] font-bold text-xs flex items-center gap-2 shadow cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Gasto</span>
          </button>
        </div>
      </div>

      {/* 2. Tarjetas de Resumen & Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-[#181818] p-4 rounded-2xl border border-[#333333]">
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Total Desembolsos Activos</span>
          <span className="text-lg font-black text-[#D6A21A] mt-1 block">{formatCOP(totalActiveValue)}</span>
          <span className="text-[10px] text-[#78716c]">Valor comercial neto</span>
        </div>

        <div className="bg-[#181818] p-4 rounded-2xl border border-[#333333]">
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Pagos Efectivos</span>
          <span className="text-lg font-black text-emerald-400 mt-1 block">{formatCOP(totalPaidValue)}</span>
          <span className="text-[10px] text-[#78716c]">Efectivamente desembolsado</span>
        </div>

        <div className="bg-[#181818] p-4 rounded-2xl border border-[#333333]">
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Saldo Pendiente (Crédito)</span>
          <span className="text-lg font-black text-amber-300 mt-1 block">{formatCOP(totalPendingValue)}</span>
          <span className="text-[10px] text-[#78716c]">Obligaciones por pagar</span>
        </div>

        <div className="bg-[#181818] p-4 rounded-2xl border border-[#333333]">
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Registros del Período</span>
          <span className="text-lg font-black text-[#FFFDF5] mt-1 block">{activeItems.length} registros</span>
          <span className="text-[10px] text-[#78716c]">{countPurchases} compras · {countExpenses} gastos · {countRefunds} reintegros</span>
        </div>

        <div className="bg-[#181818] p-4 rounded-2xl border border-[#333333]">
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Sucursal Activa</span>
          <span className="text-sm font-black text-[#D6A21A] mt-1 block truncate">{currentBranch?.name}</span>
          <span className="text-[10px] text-[#78716c]">NIT: {currentBranch?.nit}</span>
        </div>
      </div>

      {/* 3. Filtros y Acciones de Reporte */}
      <div className="bg-[#181818] p-4 rounded-2xl border border-[#333333] flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#a8a29e] font-semibold">Desde:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#a8a29e] font-semibold">Hasta:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
            />
          </div>

          <select
            aria-label="Filtrar por tipo de desembolso"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
          >
            <option value="todos">Todos los Tipos</option>
            <option value="compras">Solo Compras</option>
            <option value="gastos">Solo Gastos</option>
            <option value="reintegros">Solo Reintegros</option>
          </select>

          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#a8a29e]" />
            <input
              type="text"
              placeholder="Buscar por detalle o tercero..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#242424] border border-[#383838] rounded-xl pl-9 pr-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] border border-[#383838] text-xs font-bold text-[#FFFDF5] flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="px-3.5 py-2 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] border border-[#383838] text-xs font-bold text-[#FFFDF5] flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#D6A21A]" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* 4. Tabla Histórico de Desembolsos */}
      <div className="bg-[#181818] rounded-2xl border border-[#333333] overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#333333] flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#FFFDF5] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#D6A21A]" />
            <span>Historial Unificado de Desembolsos ({filteredItems.length})</span>
          </h3>
          <span className="text-xs text-[#a8a29e]">
            Zona Horaria: America/Bogota
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-[#78716c] text-xs italic">
            No se encontraron desembolsos ni compras en el período consultado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#242424] text-[#a8a29e] uppercase text-[10px] tracking-wider border-b border-[#333333]">
                <tr>
                  <th className="p-3">Fecha y Hora</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Consecutivo</th>
                  <th className="p-3">Detalle / Concepto</th>
                  <th className="p-3">Tercero / Proveedor</th>
                  <th className="p-3">Medio Pago</th>
                  <th className="p-3 text-right">Valor Comercial</th>
                  <th className="p-3 text-right">Pagado</th>
                  <th className="p-3 text-center">Estado</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#282828] text-[#FFFDF5]">
                {filteredItems.map((item) => (
                  <tr key={`${item.type}-${item.id}`} className="hover:bg-[#212121] transition-colors">
                    <td className="p-3 whitespace-nowrap text-[#a8a29e]">
                      {formatColombiaDateTime(item.date)}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                          item.type === 'compra'
                            ? 'bg-amber-950 text-amber-300 border-amber-700'
                            : item.type === 'gasto'
                            ? 'bg-red-950 text-red-300 border-red-700'
                            : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                        }`}
                      >
                        {item.type}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-[#D6A21A]">
                      #{item.consecutivo}
                    </td>
                    <td className="p-3 font-medium">
                      {item.detail}
                    </td>
                    <td className="p-3 text-[#d6d3d1]">
                      {item.thirdParty}
                    </td>
                    <td className="p-3 uppercase text-[10px] text-[#a8a29e]">
                      {item.paymentMethod}
                    </td>
                    <td className="p-3 text-right font-black text-[#D6A21A]">
                      {formatCOP(item.commercialValue)}
                    </td>
                    <td className="p-3 text-right font-bold text-emerald-400">
                      {formatCOP(item.paidValue)}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          item.status === 'activo'
                            ? 'bg-emerald-950 text-emerald-400'
                            : 'bg-red-950 text-red-400 line-through'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedDetailItem(item)}
                        className="px-2.5 py-1 rounded-lg bg-[#242424] hover:bg-[#333333] border border-[#383838] text-[#D6A21A] font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-all"
                        title="Ver detalle o gestionar"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Detalle</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE DETALLE DEL DESEMBOLSO / COMPROBANTE */}
      {selectedDetailItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative bg-[#181818] border border-amber-600/60 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-6 text-[#FFFDF5]">
            
            {/* Cabecera del Comprobante */}
            <div className="p-5 border-b border-[#333333] flex items-center justify-between bg-gradient-to-r from-[#181818] to-[#242424]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-600/60 text-[#D6A21A] flex items-center justify-center">
                  {selectedDetailItem.type === 'compra' ? (
                    <Truck className="w-5 h-5" />
                  ) : (
                    <DollarSign className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-[#FFFDF5] uppercase">
                      Detalle de {selectedDetailItem.type}
                    </h3>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        selectedDetailItem.status === 'activo'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-red-950 text-red-400 border border-red-800 line-through'
                      }`}
                    >
                      {selectedDetailItem.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#a8a29e]">
                    Documento / Factura: <strong className="text-[#D6A21A]">#{selectedDetailItem.consecutivo}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDetailItem(null)}
                className="p-1.5 text-[#a8a29e] hover:text-[#FFFDF5] rounded-xl hover:bg-[#2d2d2d] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Información General */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-[#121214] border border-[#2d281e] p-4 rounded-2xl">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">Fecha y Hora</span>
                  <span className="font-bold text-[#FFFDF5] mt-0.5 block">{formatColombiaDateTime(selectedDetailItem.date)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">Tercero / Proveedor</span>
                  <span className="font-bold text-[#FFFDF5] mt-0.5 block truncate">{selectedDetailItem.thirdParty}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">Medio de Pago</span>
                  <span className="font-bold text-[#D6A21A] mt-0.5 block capitalize">{selectedDetailItem.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">Sucursal</span>
                  <span className="font-bold text-[#FFFDF5] mt-0.5 block">{currentBranch?.name || 'Sede Principal'}</span>
                </div>
              </div>

              {/* Detalle de Insumos (Si es compra) */}
              {selectedDetailItem.type === 'compra' &&
                'items' in selectedDetailItem.originalRef &&
                Array.isArray((selectedDetailItem.originalRef as Purchase).items) && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-[#a8a29e] uppercase">
                      Artículos / Insumos Comprados ({(selectedDetailItem.originalRef as Purchase).items.length})
                    </h4>
                    <div className="border border-[#2e2e2e] rounded-2xl overflow-hidden bg-[#121214]">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#1c1c1f] text-[#a8a29e] uppercase text-[10px] border-b border-[#2e2e2e]">
                          <tr>
                            <th className="p-3">Artículo</th>
                            <th className="p-3 text-center">Cantidad</th>
                            <th className="p-3 text-right">Costo Unit.</th>
                            <th className="p-3 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#242424]">
                          {(selectedDetailItem.originalRef as Purchase).items.map((it, idx) => (
                            <tr key={idx} className="hover:bg-[#1a1a1c]">
                              <td className="p-3 font-bold text-[#FFFDF5]">{it.ingredientName}</td>
                              <td className="p-3 text-center font-mono">
                                {it.quantity} <span className="text-[10px] text-[#a8a29e]">{it.unit}</span>
                              </td>
                              <td className="p-3 text-right font-mono text-[#a8a29e]">{formatCOP(it.unitCost)}</td>
                              <td className="p-3 text-right font-mono font-bold text-[#D6A21A]">
                                {formatCOP(it.quantity * it.unitCost)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {/* Concepto / Motivo */}
              <div className="bg-[#121214] border border-[#2d281e] p-3.5 rounded-2xl text-xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">Concepto / Detalle</span>
                <p className="font-bold text-[#FFFDF5]">{selectedDetailItem.detail}</p>
                {selectedDetailItem.observations && (
                  <p className="text-[11px] text-[#a8a29e] italic mt-1">
                    Obs: {selectedDetailItem.observations}
                  </p>
                )}
              </div>

              {/* Valores Financieros */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#121214] border border-[#2d281e] p-3.5 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-[#a8a29e]">Valor Comercial Total</span>
                  <p className="text-base font-black text-[#FFFDF5] mt-1">{formatCOP(selectedDetailItem.commercialValue)}</p>
                </div>

                <div className="bg-[#121214] border border-[#2d281e] p-3.5 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-[#a8a29e]">Efectivamente Pagado</span>
                  <p className="text-base font-black text-emerald-400 mt-1">{formatCOP(selectedDetailItem.paidValue)}</p>
                </div>

                <div className="bg-[#121214] border border-[#2d281e] p-3.5 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-[#a8a29e]">Saldo Pendiente</span>
                  <p className={`text-base font-black mt-1 ${selectedDetailItem.pendingValue > 0 ? 'text-amber-400' : 'text-[#a8a29e]'}`}>
                    {formatCOP(selectedDetailItem.pendingValue)}
                  </p>
                </div>
              </div>
            </div>

            {/* Acciones del Comprobante */}
            <div className="p-4 border-t border-[#333333] flex flex-wrap items-center justify-between gap-3 bg-[#121214]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] border border-[#383838] text-xs font-bold text-[#FFFDF5] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-[#D6A21A]" />
                  <span>Imprimir Comprobante</span>
                </button>

                {selectedDetailItem.type === 'compra' &&
                  selectedDetailItem.status === 'activo' &&
                  isAdmin && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          window.confirm(
                            `¿Está seguro de anular la compra #${selectedDetailItem.consecutivo}? Las existencias de inventario se descontarán y el movimiento se anulará.`
                          )
                        ) {
                          try {
                            await cancelPurchase(selectedDetailItem.id);
                            showToast(`Compra #${selectedDetailItem.consecutivo} anulada correctamente`, 'info');
                            setSelectedDetailItem(null);
                          } catch (err: any) {
                            showToast(err.message || 'Error al anular compra', 'error');
                          }
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-700/60 text-xs font-bold text-red-300 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Anular Compra</span>
                    </button>
                  )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedDetailItem(null)}
                className="px-5 py-2 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] text-xs font-bold text-[#d6d3d1] cursor-pointer"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
