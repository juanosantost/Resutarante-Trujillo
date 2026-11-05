import React, { useState, useMemo } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { Payment, Abono, OtherIncome, Order, Separado, CarteraRecord } from '../../types';
import { IncomeReceiptModal, IncomeReceiptData } from './IncomeReceiptModal';
import {
  TrendingUp,
  Plus,
  ShoppingBag,
  Wallet,
  Calendar,
  Search,
  Download,
  Printer,
  FileSpreadsheet,
  FileText,
  Eye,
  Edit2,
  XCircle,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  CreditCard,
  Building,
  User,
  X,
  Info,
} from 'lucide-react';

interface IncomesViewProps {
  onNavigateToView: (view: string) => void;
}

export type UnifiedIncomeType = 'venta' | 'separado' | 'cartera' | 'otro_ingreso';

export interface UnifiedIncomeRow {
  id: string;
  consecutivo: string;
  type: UnifiedIncomeType;
  date: string;
  concept: string;
  thirdParty: string;
  documentRef?: string;
  paymentMethod: string;
  amount: number;
  status: 'activo' | 'anulado';
  userName: string;
  observations?: string;
  originalRef: Payment | Abono | OtherIncome;
}

export const IncomesView: React.FC<IncomesViewProps> = ({ onNavigateToView }) => {
  const {
    payments,
    abonos,
    otherIncomes,
    orders,
    separados,
    cartera,
    currentBranch,
    editAbono,
    voidAbono,
    updateOtherIncome,
    voidOtherIncome,
    voidPayment,
    actionLoading,
  } = useRestaurant();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const isAdmin = currentUser?.role === 'administrador';

  // Configuración de Fechas por defecto en Colombia
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState<string>(isAdmin ? `${todayStr.substring(0, 8)}01` : todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Filtros adicionales
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'todos' | UnifiedIncomeType>('todos');
  const [onlyActive, setOnlyActive] = useState<boolean>(true);

  // Paginación (20 registros por página según estándar Colmena)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  // Menú de acciones abierto
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);

  // Modales de Gestión
  const [selectedReceipt, setSelectedReceipt] = useState<IncomeReceiptData | null>(null);
  const [itemToEdit, setItemToEdit] = useState<UnifiedIncomeRow | null>(null);
  const [itemToVoid, setItemToVoid] = useState<UnifiedIncomeRow | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');
  const [itemOriginDoc, setItemOriginDoc] = useState<UnifiedIncomeRow | null>(null);

  // Consolidar todos los ingresos de la sucursal
  const allIncomes: UnifiedIncomeRow[] = useMemo(() => {
    const list: UnifiedIncomeRow[] = [];

    // 1. Pagos de Ventas (provenientes de mesas, pedidos, domicilios)
    payments
      .filter((p) => p.branchId === currentBranch?.id || !p.branchId)
      .forEach((p) => {
        // Encontrar la orden correspondiente para enriquecer datos
        const ord = orders.find((o) => o.id === p.orderId);
        const isOrderCancelled = ord?.status === 'cancelado';
        const isPaymentVoided = p.status === 'anulado';

        list.push({
          id: p.id,
          consecutivo: `PED-${p.orderNumber}`,
          type: 'venta',
          date: p.createdAt,
          concept: `Pago de venta #${p.orderNumber} (${ord?.type || 'comercial'})`,
          thirdParty: p.customerName || ord?.customerName || 'Consumidor Final',
          documentRef: `Pedido #${p.orderNumber}`,
          paymentMethod: p.method,
          amount: p.amountPaid, // Dinero real efectivamente recibido
          status: isOrderCancelled || isPaymentVoided ? 'anulado' : 'activo',
          userName: p.cashierName || 'Caja',
          originalRef: p,
        });
      });

    // 2. Abonos de Separados
    abonos
      .filter((a) => (a.branchId === currentBranch?.id || !a.branchId) && a.parentType === 'separado')
      .forEach((a) => {
        const sep = separados.find((s) => s.id === a.parentId);
        list.push({
          id: a.id,
          consecutivo: a.receiptNumber || a.id.substring(0, 8),
          type: 'separado',
          date: a.createdAt,
          concept: `Abono a Separado ${sep?.code || ''}`,
          thirdParty: a.customerName || 'Cliente',
          documentRef: sep ? `Separado ${sep.code}` : undefined,
          paymentMethod: a.paymentMethod,
          amount: a.amount,
          status: a.status,
          userName: a.userName,
          observations: a.notes,
          originalRef: a,
        });
      });

    // 3. Abonos de Cartera / Cuentas por Cobrar
    abonos
      .filter((a) => (a.branchId === currentBranch?.id || !a.branchId) && a.parentType === 'cartera')
      .forEach((a) => {
        const crd = cartera.find((c) => c.id === a.parentId);
        list.push({
          id: a.id,
          consecutivo: a.receiptNumber || a.id.substring(0, 8),
          type: 'cartera',
          date: a.createdAt,
          concept: `Abono a Crédito / Factura ${crd?.code || (crd ? `#${crd.orderNumber}` : '')}`,
          thirdParty: a.customerName || 'Cliente',
          documentRef: crd ? `Crédito ${crd.code || '#' + crd.orderNumber}` : undefined,
          paymentMethod: a.paymentMethod,
          amount: a.amount,
          status: a.status,
          userName: a.userName,
          observations: a.notes,
          originalRef: a,
        });
      });

    // 4. Otros Ingresos
    otherIncomes
      .filter((i) => i.branchId === currentBranch?.id || !i.branchId)
      .forEach((i) => {
        list.push({
          id: i.id,
          consecutivo: i.consecutivo,
          type: 'otro_ingreso',
          date: i.date || i.createdAt,
          concept: i.concept,
          thirdParty: i.thirdParty || 'General',
          documentRef: i.consecutivo,
          paymentMethod: i.paymentMethod,
          amount: i.amount,
          status: i.status,
          userName: i.userName,
          observations: i.observations,
          originalRef: i,
        });
      });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, abonos, otherIncomes, orders, separados, cartera, currentBranch?.id]);

  // Filtrado por fecha, tipo y búsqueda
  const filteredIncomes = useMemo(() => {
    return allIncomes.filter((item) => {
      // Filtro de estado
      if (onlyActive && item.status !== 'activo') return false;

      // Filtro de tipo
      if (typeFilter !== 'todos' && item.type !== typeFilter) return false;

      // Filtro de fechas (ISO YYYY-MM-DD)
      const itemDateOnly = item.date.split('T')[0];
      if (startDate && itemDateOnly < startDate) return false;
      if (endDate && itemDateOnly > endDate) return false;

      // Búsqueda en texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDoc = item.consecutivo.toLowerCase().includes(q);
        const matchConcept = item.concept.toLowerCase().includes(q);
        const matchThird = item.thirdParty.toLowerCase().includes(q);
        const matchMethod = item.paymentMethod.toLowerCase().includes(q);
        if (!matchDoc && !matchConcept && !matchThird && !matchMethod) return false;
      }

      return true;
    });
  }, [allIncomes, startDate, endDate, typeFilter, onlyActive, searchQuery]);

  // Cálculos de Totales (Dinero real efectivamente recibido sin contar anulados)
  const activeIncomesList = filteredIncomes.filter((i) => i.status === 'activo');
  const totalReceivedActive = activeIncomesList.reduce((sum, i) => sum + i.amount, 0);
  const totalCountActive = activeIncomesList.length;

  const totalCash = activeIncomesList
    .filter((i) => i.paymentMethod.toLowerCase().includes('efectivo'))
    .reduce((sum, i) => sum + i.amount, 0);

  const totalDigital = activeIncomesList
    .filter((i) => !i.paymentMethod.toLowerCase().includes('efectivo'))
    .reduce((sum, i) => sum + i.amount, 0);

  // Paginación
  const totalPages = Math.ceil(filteredIncomes.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredIncomes.slice(start, start + pageSize);
  }, [filteredIncomes, currentPage, pageSize]);

  // Exportar a Excel (CSV con formato formal UTF-8)
  const handleExportExcel = () => {
    try {
      const headers = ['Fecha y Hora', 'Tipo', 'Documento', 'Detalle / Concepto', 'Tercero / Cliente', 'Medio de Pago', 'Valor (COP)', 'Estado', 'Usuario', 'Sucursal'];
      const rows = filteredIncomes.map((r) => [
        `"${formatColombiaDateTime(r.date)}"`,
        `"${r.type.toUpperCase()}"`,
        `"${r.consecutivo}"`,
        `"${r.concept.replace(/"/g, '""')}"`,
        `"${r.thirdParty.replace(/"/g, '""')}"`,
        `"${r.paymentMethod}"`,
        r.amount,
        `"${r.status.toUpperCase()}"`,
        `"${r.userName}"`,
        `"${currentBranch?.name || 'Sede'}"`,
      ]);

      const summaryRows = [
        [],
        ['RESUMEN DE INGRESOS EFECTIVOS'],
        ['Sucursal', `"${currentBranch?.name || 'Sede Principal'}"`],
        ['Período', `"${startDate} hasta ${endDate}"`],
        ['Cantidad de Ingresos Activos', totalCountActive],
        ['Total Recaudado Efectivo', totalCash],
        ['Total Canales Digitales', totalDigital],
        ['TOTAL INGRESOS ACTIVOS', totalReceivedActive],
      ];

      const csvContent =
        '\uFEFF' +
        [headers.join(','), ...rows.map((e) => e.join(',')), ...summaryRows.map((e) => e.join(','))].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Ingresos_${currentBranch?.name || 'Sucursal'}_${startDate}_a_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Reporte Excel descargado correctamente', 'success');
    } catch (err: any) {
      showToast('Error al exportar archivo Excel', 'error');
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleOpenReceipt = (row: UnifiedIncomeRow) => {
    setSelectedReceipt({
      consecutivo: row.consecutivo,
      type: row.type,
      date: row.date,
      concept: row.concept,
      thirdParty: row.thirdParty,
      documentRef: row.documentRef,
      paymentMethod: row.paymentMethod,
      amount: row.amount,
      observations: row.observations,
      userName: row.userName,
      status: row.status,
    });
  };

  const handleConfirmVoid = async () => {
    if (!itemToVoid) return;
    if (!voidReason.trim() || voidReason.trim().length < 4) {
      showToast('Debe ingresar un motivo de anulación válido (mínimo 4 caracteres)', 'error');
      return;
    }

    try {
      if (itemToVoid.type === 'otro_ingreso') {
        await voidOtherIncome(itemToVoid.id, voidReason.trim());
      } else if (itemToVoid.type === 'venta') {
        await voidPayment(itemToVoid.id, voidReason.trim());
      } else if (itemToVoid.type === 'cartera' || itemToVoid.type === 'separado') {
        await voidAbono(itemToVoid.id, voidReason.trim());
      }

      showToast(`Ingreso #${itemToVoid.consecutivo} anulado correctamente. Saldos y caja recalculados.`, 'info');
      setItemToVoid(null);
      setVoidReason('');
    } catch (err: any) {
      showToast(err.message || 'Error al anular el ingreso', 'error');
    }
  };

  const getTypeBadge = (type: UnifiedIncomeType) => {
    switch (type) {
      case 'venta':
        return { label: 'Venta', bg: 'bg-emerald-950 text-emerald-300 border-emerald-800' };
      case 'separado':
        return { label: 'Separado', bg: 'bg-purple-950 text-purple-300 border-purple-800' };
      case 'cartera':
        return { label: 'Cartera', bg: 'bg-amber-950 text-amber-300 border-amber-800' };
      case 'otro_ingreso':
        return { label: 'Otro Ingreso', bg: 'bg-cyan-950 text-cyan-300 border-cyan-800' };
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Cabecera Principal y Accesos Rápidos */}
      <div className="bg-[#181818] p-6 rounded-3xl border border-[#333333] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[#FFFDF5] tracking-wide flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#D6A21A]" />
            <span>INGRESOS</span>
          </h2>
          <p className="text-xs text-[#d6d3d1] mt-0.5">
            Ventas, abonos y otros ingresos de la sucursal <strong className="text-[#D6A21A]">{currentBranch?.name}</strong> en un solo espacio.
          </p>
        </div>

        {/* Dos Botones Grandes Principales */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigateToView('pedidos')}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center gap-2 hover:brightness-110 shadow-lg cursor-pointer transition-all"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Registrar venta</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToView('otros-ingresos')}
            className="px-5 py-3 rounded-2xl bg-[#242424] hover:bg-[#2e2e2e] text-[#D6A21A] border border-[#383838] font-bold text-xs inline-flex items-center gap-2 shadow cursor-pointer transition-all"
          >
            <Wallet className="w-4 h-4" />
            <span>Otros ingresos</span>
          </button>
        </div>
      </div>

      {/* 2. Filtros de Fecha & Botones de Exportación */}
      <div className="bg-[#181818] border border-[#333333] p-5 rounded-3xl space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Fechas */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs">
              <Calendar className="w-4 h-4 text-[#D6A21A]" />
              <span className="text-[#a8a29e] font-bold text-[10px] uppercase">Desde:</span>
              <input
                type="date"
                value={startDate}
                disabled={!isAdmin}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-[#FFFDF5] outline-none cursor-pointer disabled:opacity-60"
              />
            </div>

            <div className="flex items-center gap-2 bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs">
              <Calendar className="w-4 h-4 text-[#D6A21A]" />
              <span className="text-[#a8a29e] font-bold text-[10px] uppercase">Hasta:</span>
              <input
                type="date"
                value={endDate}
                disabled={!isAdmin}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-[#FFFDF5] outline-none cursor-pointer disabled:opacity-60"
              />
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              className="px-4 py-2 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] border border-[#383838] text-xs font-bold text-[#D6A21A] cursor-pointer"
            >
              Consultar
            </button>

            {!isAdmin && (
              <span className="text-[10px] text-[#78716c] flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-amber-500" />
                Consulta del día actual para rol Asesor.
              </span>
            )}
          </div>

          {/* Botones Excel y PDF */}
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-4 py-2 rounded-xl bg-[#1e2a1e] hover:bg-[#253525] border border-emerald-800 text-emerald-300 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              className="px-4 py-2 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] border border-[#383838] text-xs font-bold text-[#FFFDF5] inline-flex items-center gap-1.5 cursor-pointer shadow transition-all"
            >
              <FileText className="w-4 h-4 text-[#D6A21A]" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* Buscador y Filtros por Tipo */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-[#292929]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-[#a8a29e]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por documento, concepto, cliente o medio de pago..."
              className="w-full bg-[#242424] border border-[#383838] focus:border-[#D6A21A] rounded-xl pl-10 pr-4 py-2 text-xs text-[#FFFDF5] outline-none"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'venta', label: 'Ventas' },
              { id: 'separado', label: 'Separados' },
              { id: 'cartera', label: 'Cartera' },
              { id: 'otro_ingreso', label: 'Otros Ingresos' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTypeFilter(t.id as any);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  typeFilter === t.id
                    ? 'bg-[#B77900] text-[#181818]'
                    : 'bg-[#242424] text-[#a8a29e] hover:text-[#FFFDF5]'
                }`}
              >
                {t.label}
              </button>
            ))}

            <label className="flex items-center gap-1.5 text-xs font-bold text-[#a8a29e] cursor-pointer ml-2 whitespace-nowrap">
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => {
                  setOnlyActive(e.target.checked);
                  setCurrentPage(1);
                }}
                className="w-3.5 h-3.5 accent-[#D6A21A]"
              />
              <span>Solo activos</span>
            </label>
          </div>
        </div>
      </div>

      {/* 3. Tarjetas de Resumen Financiero Real */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#181818] p-4 rounded-2xl border border-[#333333]">
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Período Consultado</span>
          <span className="text-xs font-black text-[#D6A21A] mt-1 block truncate">
            {startDate} a {endDate}
          </span>
          <span className="text-[10px] text-[#78716c]">{totalCountActive} ingresos activos</span>
        </div>

        <div className="bg-[#181818] p-4 rounded-2xl border border-[#333333]">
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Total Recibido (Activo)</span>
          <span className="text-lg sm:text-xl font-black text-emerald-400 mt-1 block">
            {formatCOP(totalReceivedActive)}
          </span>
          <span className="text-[10px] text-emerald-400/70">efectivamente ingresado</span>
        </div>

        <div className="bg-[#181818] p-4 rounded-2xl border border-[#333333]">
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Recaudado en Efectivo</span>
          <span className="text-lg sm:text-xl font-black text-[#FFFDF5] mt-1 block">
            {formatCOP(totalCash)}
          </span>
          <span className="text-[10px] text-[#78716c]">ingresos en caja física</span>
        </div>

        <div className="bg-[#181818] p-4 rounded-2xl border border-[#333333]">
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Canales Digitales</span>
          <span className="text-lg sm:text-xl font-black text-cyan-400 mt-1 block">
            {formatCOP(totalDigital)}
          </span>
          <span className="text-[10px] text-cyan-400/70">bancos, nequi & tarjetas</span>
        </div>
      </div>

      {/* 4. Historial Unificado de Ingresos */}
      <div className="bg-[#181818] border border-[#333333] rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-4 sm:p-5 border-b border-[#2d2d2d] flex items-center justify-between">
          <h3 className="text-base font-black text-[#FFFDF5] flex items-center gap-2">
            <span>Historial de Ingresos</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#242424] text-[#D6A21A] border border-[#383838]">
              {filteredIncomes.length} registros
            </span>
          </h3>

          <span className="text-xs text-[#78716c]">
            Orden: Más reciente al más antiguo
          </span>
        </div>

        {paginatedRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#FFFDF5]">
              <thead className="bg-[#121214] text-[#a8a29e] uppercase text-[10px] font-bold border-b border-[#2d2d2d]">
                <tr>
                  <th className="p-3.5">Fecha y Hora</th>
                  <th className="p-3.5">Tipo</th>
                  <th className="p-3.5">Documento</th>
                  <th className="p-3.5">Detalle / Concepto</th>
                  <th className="p-3.5">Cliente / Tercero</th>
                  <th className="p-3.5">Medio de Pago</th>
                  <th className="p-3.5 text-right">Valor Recibido</th>
                  <th className="p-3.5 text-center">Estado</th>
                  <th className="p-3.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242424]">
                {paginatedRows.map((row) => {
                  const typeBadge = getTypeBadge(row.type);
                  const isMenuOpen = actionMenuOpenId === row.id;

                  return (
                    <tr key={row.id} className="hover:bg-[#1f1e24] transition-colors">
                      <td className="p-3.5 text-[#d6d3d1] whitespace-nowrap">
                        {formatColombiaDateTime(row.date)}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeBadge.bg}`}>
                          {typeBadge.label}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-[#D6A21A] whitespace-nowrap">
                        #{row.consecutivo}
                      </td>
                      <td className="p-3.5 max-w-[220px] truncate" title={row.concept}>
                        <span className="font-bold">{row.concept}</span>
                        {row.observations && (
                          <span className="text-[10px] text-[#78716c] block truncate">
                            {row.observations}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 max-w-[150px] truncate text-[#a8a29e]">
                        {row.thirdParty}
                      </td>
                      <td className="p-3.5 capitalize text-[#d6d3d1] whitespace-nowrap">
                        {row.paymentMethod}
                      </td>
                      <td className="p-3.5 text-right font-black font-mono text-emerald-400 whitespace-nowrap">
                        {formatCOP(row.amount)}
                      </td>
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                            row.status === 'activo'
                              ? 'bg-emerald-950 text-emerald-400'
                              : 'bg-red-950 text-red-400 line-through'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-center relative whitespace-nowrap">
                        {/* Menú de Acciones Dropdown */}
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionMenuOpenId(isMenuOpen ? null : row.id);
                            }}
                            className="p-1.5 rounded-lg bg-[#242424] hover:bg-[#333] border border-[#383838] text-[#D6A21A] cursor-pointer"
                            title="Opciones del ingreso"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {isMenuOpen && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 mt-1 w-48 bg-[#181818] border border-amber-600/50 rounded-2xl shadow-2xl z-40 py-2 text-xs divide-y divide-[#262626]"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActionMenuOpenId(null);
                                  handleOpenReceipt(row);
                                }}
                                className="w-full text-left px-3.5 py-2 hover:bg-[#242424] text-[#FFFDF5] flex items-center gap-2 cursor-pointer font-bold"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#D6A21A]" />
                                <span>Ver comprobante</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActionMenuOpenId(null);
                                  handleOpenReceipt(row);
                                }}
                                className="w-full text-left px-3.5 py-2 hover:bg-[#242424] text-[#FFFDF5] flex items-center gap-2 cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5 text-cyan-400" />
                                <span>Imprimir comprobante</span>
                              </button>

                              {row.documentRef && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionMenuOpenId(null);
                                    setItemOriginDoc(row);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-[#242424] text-[#FFFDF5] flex items-center gap-2 cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Ver doc. origen</span>
                                </button>
                              )}

                              {/* Editar (autorizado para admin) */}
                              {row.status === 'activo' && isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionMenuOpenId(null);
                                    setItemToEdit(row);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-[#242424] text-[#FFFDF5] flex items-center gap-2 cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-[#D6A21A]" />
                                  <span>Editar registro</span>
                                </button>
                              )}

                              {/* Anular individualmente */}
                              {row.status === 'activo' && isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionMenuOpenId(null);
                                    setItemToVoid(row);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-red-950/40 text-red-300 flex items-center gap-2 cursor-pointer font-bold"
                                >
                                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                                  <span>Anular registro</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-[#a8a29e] space-y-2">
            <TrendingUp className="w-12 h-12 mx-auto text-[#B77900] opacity-50 mb-2" />
            <p className="text-base font-bold text-[#FFFDF5]">No se registraron ingresos en el período consultado</p>
            <p className="text-xs text-[#78716c]">
              Utilice los botones superiores para registrar nuevas ventas u otros ingresos.
            </p>
          </div>
        )}

        {/* Paginación (20 registros por página) */}
        {filteredIncomes.length > pageSize && (
          <div className="p-4 border-t border-[#2d2d2d] flex items-center justify-between bg-[#121214] text-xs">
            <span className="text-[#a8a29e]">
              Página <strong className="text-[#FFFDF5]">{currentPage}</strong> de <strong className="text-[#FFFDF5]">{totalPages}</strong> ({filteredIncomes.length} movimientos)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-[#2e2e2e] disabled:opacity-40 text-[#FFFDF5] font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-[#2e2e2e] disabled:opacity-40 text-[#FFFDF5] font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: COMPROBANTE DE INGRESO (IMPRESIÓN TÉRMICA 58mm/80mm) */}
      <IncomeReceiptModal
        isOpen={Boolean(selectedReceipt)}
        onClose={() => setSelectedReceipt(null)}
        data={selectedReceipt}
      />

      {/* MODAL 2: CONFIRMAR ANULACIÓN INDIVIDUAL DE REGISTRO */}
      {itemToVoid && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-red-500/60 rounded-3xl w-full max-w-md p-6 text-[#FFFDF5] shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-950/70 border border-red-600 text-red-400 flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-[#FFFDF5]">
                ¿Anular Registro #{itemToVoid.consecutivo}?
              </h3>
              <p className="text-xs text-[#a8a29e]">
                {itemToVoid.concept} • Monto: <strong className="text-emerald-400">{formatCOP(itemToVoid.amount)}</strong>
              </p>
            </div>

            <div className="bg-[#121214] border border-[#2e2e2e] p-3 rounded-2xl text-[11px] text-[#a8a29e] space-y-1">
              <p className="font-bold text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Efecto de la anulación individual:</span>
              </p>
              <p>
                • Este ingreso de {formatCOP(itemToVoid.amount)} se revertirá en Caja y dejará de sumar a los ingresos activos.
              </p>
              {itemToVoid.type === 'cartera' || itemToVoid.type === 'separado' ? (
                <p>
                  • La venta o separado original seguirá activo, y su saldo pendiente se recalculará automáticamente.
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#d6d3d1] block">
                Motivo obligatorio de anulación <span className="text-red-400">*</span>:
              </label>
              <textarea
                rows={3}
                required
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Ej: Error al digitar medio de pago, abono duplicado..."
                className="w-full bg-[#121212] border border-[#2e2e2e] focus:border-red-500 rounded-xl p-3 text-xs text-[#FFFDF5] outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2e2e2e]">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => {
                  setItemToVoid(null);
                  setVoidReason('');
                }}
                className="px-4 py-2.5 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] text-xs font-bold text-[#a8a29e] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={actionLoading || voidReason.trim().length < 4}
                onClick={handleConfirmVoid}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-red-600 hover:brightness-110 text-white font-black text-xs cursor-pointer shadow-lg inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>{actionLoading ? 'Anulando...' : 'Confirmar Anulación'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EDITAR REGISTRO AUTORIZADO */}
      {itemToEdit && (
        <EditIncomeModal
          item={itemToEdit}
          onClose={() => setItemToEdit(null)}
          onSuccess={() => {
            setItemToEdit(null);
            showToast('Registro de ingreso actualizado con éxito', 'success');
          }}
        />
      )}

      {/* MODAL 4: VER DOCUMENTO DE ORIGEN */}
      {itemOriginDoc && (
        <OriginDocumentModal
          item={itemOriginDoc}
          onClose={() => setItemOriginDoc(null)}
          onNavigateToView={onNavigateToView}
        />
      )}

    </div>
  );
};

// Subcomponente: Modal para Editar Registro Autorizado
interface EditIncomeModalProps {
  item: UnifiedIncomeRow;
  onClose: () => void;
  onSuccess: () => void;
}

const EditIncomeModal: React.FC<EditIncomeModalProps> = ({ item, onClose, onSuccess }) => {
  const { updateOtherIncome, editAbono, paymentMethods, actionLoading } = useRestaurant();
  const { showToast } = useToast();

  const [concept, setConcept] = useState<string>(item.concept);
  const [thirdParty, setThirdParty] = useState<string>(item.thirdParty);
  const [paymentMethod, setPaymentMethod] = useState<string>(item.paymentMethod);
  const [amount, setAmount] = useState<number>(item.amount);
  const [observations, setObservations] = useState<string>(item.observations || '');
  const [date, setDate] = useState<string>(item.date ? item.date.slice(0, 16) : '');

  const activeMethods = paymentMethods.filter((p) => p.isActive);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (item.type === 'otro_ingreso') {
        await updateOtherIncome(item.id, {
          concept: concept.trim(),
          thirdParty: thirdParty.trim() || undefined,
          paymentMethod,
          amount,
          observations: observations.trim() || undefined,
          date: date ? new Date(date).toISOString() : undefined,
        });
      } else if (item.type === 'cartera' || item.type === 'separado') {
        await editAbono(item.id, {
          paymentMethod,
          notes: observations.trim(),
        });
      } else {
        showToast('Para modificar pagos de ventas, realice el cambio desde el pedido comercial correspondiente', 'info');
      }
      onSuccess();
    } catch (err: any) {
      showToast(err.message || 'Error al actualizar el registro', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#181818] border border-amber-600/60 rounded-3xl w-full max-w-lg p-6 text-[#FFFDF5] shadow-2xl space-y-4 my-6">
        <div className="flex items-center justify-between border-b border-[#333] pb-3">
          <div className="flex items-center gap-2.5">
            <Edit2 className="w-5 h-5 text-[#D6A21A]" />
            <h3 className="text-base font-black text-[#FFFDF5]">
              Editar Registro #{item.consecutivo}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-[#2b2b2b] rounded-lg text-[#a8a29e]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {item.type === 'otro_ingreso' ? (
            <>
              <div>
                <label className="block text-[#a8a29e] font-bold mb-1">Concepto:</label>
                <input
                  type="text"
                  required
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-[#FFFDF5] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#a8a29e] font-bold mb-1">Tercero / Referencia:</label>
                <input
                  type="text"
                  value={thirdParty}
                  onChange={(e) => setThirdParty(e.target.value)}
                  className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-[#FFFDF5] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#a8a29e] font-bold mb-1">Fecha y Hora:</label>
                  <input
                    type="datetime-local"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-[#FFFDF5] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[#a8a29e] font-bold mb-1">Valor ($ COP):</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-emerald-400 font-bold outline-none font-mono"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="bg-[#121214] p-3 rounded-xl border border-[#2e2e2e] space-y-1">
              <p className="font-bold text-[#D6A21A]">Abono #{item.consecutivo}</p>
              <p className="text-[#a8a29e]">
                Monto: <strong>{formatCOP(item.amount)}</strong> · Cliente: <strong>{item.thirdParty}</strong>
              </p>
            </div>
          )}

          <div>
            <label className="block text-[#a8a29e] font-bold mb-1">Medio de Pago:</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-[#FFFDF5] outline-none"
            >
              {activeMethods.length > 0 ? (
                activeMethods.map((pm) => (
                  <option key={pm.id} value={pm.name.toLowerCase().replace(/\s+/g, '_')}>
                    {pm.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="nequi">Nequi</option>
                  <option value="daviplata">Daviplata</option>
                  <option value="tarjeta">Tarjeta</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-[#a8a29e] font-bold mb-1">Observaciones:</label>
            <textarea
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="w-full bg-[#242424] border border-[#383838] rounded-xl p-3 text-[#FFFDF5] outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2e2e2e]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#242424] text-[#a8a29e] font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black cursor-pointer shadow-lg"
            >
              {actionLoading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Subcomponente: Modal para Consultar Documento de Origen
interface OriginDocumentModalProps {
  item: UnifiedIncomeRow;
  onClose: () => void;
  onNavigateToView: (view: string) => void;
}

const OriginDocumentModal: React.FC<OriginDocumentModalProps> = ({ item, onClose, onNavigateToView }) => {
  const { orders, separados, cartera } = useRestaurant();

  let title = 'Documento de Origen';
  let detailsContent: React.ReactNode = null;

  if (item.type === 'venta') {
    const p = item.originalRef as Payment;
    const ord = orders.find((o) => o.id === p.orderId);
    title = `Detalle de Pedido Comercial #${p.orderNumber}`;
    detailsContent = ord ? (
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-2 bg-[#121214] p-3 rounded-xl border border-[#2e2e2e]">
          <div>
            <span className="text-[#a8a29e] block text-[10px]">Tipo de Venta:</span>
            <span className="font-bold text-[#FFFDF5] capitalize">{ord.type}</span>
          </div>
          <div>
            <span className="text-[#a8a29e] block text-[10px]">Mesa / Destino:</span>
            <span className="font-bold text-[#D6A21A]">{ord.tableName || 'Mostrador'}</span>
          </div>
          <div>
            <span className="text-[#a8a29e] block text-[10px]">Total de la Venta:</span>
            <span className="font-bold text-[#FFFDF5]">{formatCOP(ord.total)}</span>
          </div>
          <div>
            <span className="text-[#a8a29e] block text-[10px]">Pago Recibido:</span>
            <span className="font-bold text-emerald-400">{formatCOP(p.amountPaid)}</span>
          </div>
        </div>

        <div>
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold block mb-1">Ítems del Pedido:</span>
          <div className="divide-y divide-[#262626] border border-[#2e2e2e] rounded-xl overflow-hidden max-h-40 overflow-y-auto">
            {ord.items.map((it, idx) => (
              <div key={idx} className="p-2.5 bg-[#121214] flex justify-between">
                <span>{it.quantity}x {it.name}</span>
                <span className="font-mono font-bold">{formatCOP(it.price * it.quantity)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ) : (
      <p className="text-xs text-[#a8a29e]">El pedido #{p.orderNumber} no se encuentra en memoria activa.</p>
    );
  } else if (item.type === 'separado') {
    const a = item.originalRef as Abono;
    const sep = separados.find((s) => s.id === a.parentId);
    title = `Detalle de Sistema Separado ${sep?.code || ''}`;
    detailsContent = sep ? (
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-2 bg-[#121214] p-3 rounded-xl border border-[#2e2e2e]">
          <div>
            <span className="text-[#a8a29e] block text-[10px]">Código Separado:</span>
            <span className="font-bold text-[#D6A21A]">{sep.code}</span>
          </div>
          <div>
            <span className="text-[#a8a29e] block text-[10px]">Cliente:</span>
            <span className="font-bold text-[#FFFDF5]">{sep.customerName}</span>
          </div>
          <div>
            <span className="text-[#a8a29e] block text-[10px]">Total Separado:</span>
            <span className="font-bold text-[#FFFDF5]">{formatCOP(sep.totalAmount)}</span>
          </div>
          <div>
            <span className="text-[#a8a29e] block text-[10px]">Saldo Pendiente:</span>
            <span className="font-bold text-amber-400">{formatCOP(sep.pendingBalance)}</span>
          </div>
        </div>
        <p className="text-[11px] text-[#a8a29e]">Fecha prometida de entrega: {sep.deliveryDate}</p>
      </div>
    ) : null;
  } else if (item.type === 'cartera') {
    const a = item.originalRef as Abono;
    const crd = cartera.find((c) => c.id === a.parentId);
    title = `Detalle de Cuenta por Cobrar ${crd?.code || ''}`;
    detailsContent = crd ? (
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-2 bg-[#121214] p-3 rounded-xl border border-[#2e2e2e]">
          <div>
            <span className="text-[#a8a29e] block text-[10px]">Factura / Crédito:</span>
            <span className="font-bold text-[#D6A21A]">{crd.code || `#${crd.orderNumber}`}</span>
          </div>
          <div>
            <span className="text-[#a8a29e] block text-[10px]">Cliente:</span>
            <span className="font-bold text-[#FFFDF5]">{crd.customerName}</span>
          </div>
          <div>
            <span className="text-[#a8a29e] block text-[10px]">Monto Original:</span>
            <span className="font-bold text-[#FFFDF5]">{formatCOP(crd.totalAmount)}</span>
          </div>
          <div>
            <span className="text-[#a8a29e] block text-[10px]">Saldo Pendiente:</span>
            <span className="font-bold text-amber-400">{formatCOP(crd.balanceDue)}</span>
          </div>
        </div>
        <p className="text-[11px] text-[#a8a29e]">Vencimiento: {crd.dueDate}</p>
      </div>
    ) : null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#181818] border border-amber-600/60 rounded-3xl w-full max-w-md p-6 text-[#FFFDF5] shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#333] pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#D6A21A]" />
            <h3 className="text-sm font-black text-[#FFFDF5]">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-[#2b2b2b] rounded-lg text-[#a8a29e]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {detailsContent}

        <div className="pt-3 border-t border-[#2e2e2e] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#242424] text-[#d6d3d1] text-xs font-bold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
