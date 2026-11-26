import React, { useState, useMemo } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import {
  resolveActivePaymentMethods,
  getLastClosureTimestamp,
  buildCurrentPeriodIncomes,
  buildCurrentPeriodDisbursements,
  summarizeByPaymentMethod,
  validateCashClosureInputs,
  isLastCashClosure,
  getDifferenceStatus,
} from '../../utils/cashReconciliationUtils';
import { CashClosure, CashFlowEntry, CashFlowEntryKind } from '../../types';
import { CashClosureReportModal } from './CashClosureReportModal';
import { CashClosureEditModal } from './CashClosureEditModal';
import {
  DollarSign,
  Coins,
  Banknote,
  CreditCard,
  Smartphone,
  Building2,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ClipboardCheck,
  Eye,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Search,
  Clock,
  Loader2,
  AlertCircle,
  X,
  Plus,
} from 'lucide-react';

type CashTab = 'ingresos' | 'desembolsos' | 'cierres';

const KIND_LABELS: Record<CashFlowEntryKind, string> = {
  venta: 'Venta',
  abono_separado: 'Abono Separado',
  abono_cartera: 'Abono Cartera',
  otro_ingreso: 'Otro Ingreso',
  reintegro_proveedor: 'Reintegro',
  caja_menor_ingreso: 'Caja Menor (+)',
  gasto: 'Gasto',
  pago_proveedor: 'Pago Proveedor',
  anticipo_proveedor: 'Anticipo Proveedor',
  caja_menor_egreso: 'Caja Menor (-)',
};

export const CashView: React.FC = () => {
  const {
    activeShift,
    addCashBase,
    updateCashBase,
    deleteCashBase,
    cashMovements,
    cashClosures,
    registerCashClosure,
    updateCashClosureValues,
    deleteLastCashClosure,
    paymentMethods,
    payments,
    orders,
    abonos,
    otherIncomes,
    supplierAdvanceReintegros,
    expenses,
    purchasePayments,
    supplierAdvances,
    currentBranch,
    actionLoading,
  } = useRestaurant();
  const { showToast } = useToast();

  // 1. Registro de Base (campo SIEMPRE vacío por defecto, sin número precargado)
  const [baseAmountInput, setBaseAmountInput] = useState<string>('');
  const [baseReasonInput, setBaseReasonInput] = useState<string>('');
  const [baseError, setBaseError] = useState<string>('');
  const [isSavingBase, setIsSavingBase] = useState<boolean>(false);

  // Editar / Borrar base registrada (sin window.confirm)
  const [editingBaseId, setEditingBaseId] = useState<string | null>(null);
  const [editBaseAmountInput, setEditBaseAmountInput] = useState<string>('');
  const [editBaseReasonInput, setEditBaseReasonInput] = useState<string>('');
  const [baseIdPendingDelete, setBaseIdPendingDelete] = useState<string | null>(null);

  // 2. Registro de Cuadre por Medios de Pago Activos (inputs vacíos por defecto; solo Efectivo obligatorio)
  const [closureInputs, setClosureInputs] = useState<Record<string, string>>({});
  const [closureNotes, setClosureNotes] = useState<string>('');
  const [closureError, setClosureError] = useState<string>('');
  const [isRegisteringClosure, setIsRegisteringClosure] = useState<boolean>(false);

  // 3. Navegación en 3 pestañas inferiores
  const [activeTab, setActiveTab] = useState<CashTab>('ingresos');
  const [incomeMethodFilter, setIncomeMethodFilter] = useState<string>('todos');
  const [disbursementMethodFilter, setDisbursementMethodFilter] = useState<string>('todos');
  const [incomeSearch, setIncomeSearch] = useState<string>('');
  const [disbursementSearch, setDisbursementSearch] = useState<string>('');

  // Modales de Cierres (Consultar, Editar, Confirmar Borrado del último cierre)
  const [closureToConsult, setClosureToConsult] = useState<CashClosure | null>(null);
  const [closureToEdit, setClosureToEdit] = useState<CashClosure | null>(null);
  const [closureToDelete, setClosureToDelete] = useState<CashClosure | null>(null);
  const [isUpdatingClosure, setIsUpdatingClosure] = useState<boolean>(false);
  const [isDeletingClosure, setIsDeletingClosure] = useState<boolean>(false);

  // Medios de pago activos (Efectivo primero)
  const activePaymentMethods = useMemo(
    () => resolveActivePaymentMethods(paymentMethods),
    [paymentMethods]
  );

  // Marca temporal del último cierre de caja
  const lastClosureTimestamp = useMemo(
    () => getLastClosureTimestamp(cashClosures),
    [cashClosures]
  );

  // Ingresos del período abierto (desde último cierre hasta el momento)
  const periodIncomes = useMemo(
    () =>
      buildCurrentPeriodIncomes({
        sinceIso: lastClosureTimestamp,
        activeMethods: activePaymentMethods,
        payments,
        orders,
        abonos,
        otherIncomes,
        supplierAdvanceReintegros,
        cashMovements,
        branchId: currentBranch?.id,
      }),
    [
      lastClosureTimestamp,
      activePaymentMethods,
      payments,
      orders,
      abonos,
      otherIncomes,
      supplierAdvanceReintegros,
      cashMovements,
      currentBranch?.id,
    ]
  );

  // Desembolsos del período abierto (desde último cierre hasta el momento)
  const periodDisbursements = useMemo(
    () =>
      buildCurrentPeriodDisbursements({
        sinceIso: lastClosureTimestamp,
        activeMethods: activePaymentMethods,
        expenses,
        purchasePayments,
        supplierAdvances,
        cashMovements,
        branchId: currentBranch?.id,
      }),
    [
      lastClosureTimestamp,
      activePaymentMethods,
      expenses,
      purchasePayments,
      supplierAdvances,
      cashMovements,
      currentBranch?.id,
    ]
  );

  // Resúmenes por medio de pago
  const incomeSummary = useMemo(
    () => summarizeByPaymentMethod(periodIncomes, activePaymentMethods),
    [periodIncomes, activePaymentMethods]
  );
  const disbursementSummary = useMemo(
    () => summarizeByPaymentMethod(periodDisbursements, activePaymentMethods),
    [periodDisbursements, activePaymentMethods]
  );

  // Filas filtradas en pestaña Ingresos
  const filteredIncomes = useMemo(() => {
    const q = incomeSearch.trim().toLowerCase();
    return periodIncomes.filter((item) => {
      if (incomeMethodFilter !== 'todos' && item.paymentMethodId !== incomeMethodFilter) {
        return false;
      }
      if (q) {
        const hay = `${item.consecutivo} ${item.concept} ${item.thirdParty} ${item.paymentMethodName} ${item.userName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [periodIncomes, incomeMethodFilter, incomeSearch]);

  // Filas filtradas en pestaña Desembolsos
  const filteredDisbursements = useMemo(() => {
    const q = disbursementSearch.trim().toLowerCase();
    return periodDisbursements.filter((item) => {
      if (
        disbursementMethodFilter !== 'todos' &&
        item.paymentMethodId !== disbursementMethodFilter
      ) {
        return false;
      }
      if (q) {
        const hay = `${item.consecutivo} ${item.concept} ${item.thirdParty} ${item.paymentMethodName} ${item.userName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [periodDisbursements, disbursementMethodFilter, disbursementSearch]);

  const currentBaseTotal = activeShift?.initialCash || 0;
  const currentBaseEntries = activeShift?.baseEntries || [];

  // Handlers de Base
  const handleRegisterBase = async (e: React.FormEvent) => {
    e.preventDefault();
    setBaseError('');
    const trimmed = baseAmountInput.trim();
    if (!trimmed) {
      setBaseError('Ingresa el valor de la base para registrarla.');
      return;
    }
    const parsed = Number(trimmed.replace(/[$,\s]/g, ''));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setBaseError('Ingresa un monto numérico mayor a 0.');
      return;
    }

    setIsSavingBase(true);
    try {
      await addCashBase(Math.round(parsed), baseReasonInput.trim() || 'Base de caja');
      setBaseAmountInput('');
      setBaseReasonInput('');
      showToast(`Base de ${formatCOP(Math.round(parsed))} registrada correctamente`, 'success');
    } catch (err: any) {
      setBaseError(err?.message || 'Error al registrar la base.');
      showToast('No se pudo registrar la base', 'error');
    } finally {
      setIsSavingBase(false);
    }
  };

  const handleUpdateBaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBaseId) return;
    const parsed = Number(editBaseAmountInput.trim().replace(/[$,\s]/g, ''));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showToast('El monto de la base debe ser mayor a 0', 'error');
      return;
    }
    try {
      await updateCashBase(
        editingBaseId,
        Math.round(parsed),
        editBaseReasonInput.trim() || 'Base de caja'
      );
      setEditingBaseId(null);
      showToast('Base actualizada correctamente', 'success');
    } catch {
      showToast('Error al actualizar la base', 'error');
    }
  };

  const handleConfirmDeleteBase = async (baseId: string) => {
    try {
      await deleteCashBase(baseId);
      setBaseIdPendingDelete(null);
      showToast('Registro de base eliminado', 'info');
    } catch {
      showToast('Error al eliminar la base', 'error');
    }
  };

  // Handler de Registro de Cuadre
  const handleRegisterCuadre = async (e: React.FormEvent) => {
    e.preventDefault();
    setClosureError('');

    const validation = validateCashClosureInputs(closureInputs, activePaymentMethods);
    if (!validation.isValid) {
      setClosureError(validation.error || 'Verifica los valores ingresados.');
      return;
    }

    setIsRegisteringClosure(true);
    try {
      const created = await registerCashClosure({
        rawValuesByMethodId: closureInputs,
        notes: closureNotes,
      });
      setClosureInputs({});
      setClosureNotes('');
      setIncomeMethodFilter('todos');
      setDisbursementMethodFilter('todos');
      setActiveTab('cierres');
      setClosureToConsult(created);
      showToast(`Cuadre ${created.consecutivo} registrado exitosamente`, 'success');
    } catch (err: any) {
      const msg = err?.message || 'No se pudo registrar el cuadre de caja.';
      setClosureError(msg);
      showToast(msg, 'error');
    } finally {
      setIsRegisteringClosure(false);
    }
  };

  // Handler de Edición de Cierre
  const handleSaveEditedClosure = async (
    rawValuesByMethodId: Record<string, string>,
    notes: string
  ) => {
    if (!closureToEdit) return;
    setIsUpdatingClosure(true);
    try {
      const updated = await updateCashClosureValues(
        closureToEdit.id,
        rawValuesByMethodId,
        notes
      );
      setClosureToEdit(null);
      if (closureToConsult?.id === updated.id) {
        setClosureToConsult(updated);
      }
      showToast(`Cierre ${updated.consecutivo} actualizado correctamente`, 'success');
    } finally {
      setIsUpdatingClosure(false);
    }
  };

  // Handler de Borrado del Último Cierre
  const handleConfirmDeleteLastClosure = async () => {
    if (!closureToDelete) return;
    setIsDeletingClosure(true);
    try {
      const code = closureToDelete.consecutivo;
      await deleteLastCashClosure(closureToDelete.id);
      if (closureToConsult?.id === closureToDelete.id) {
        setClosureToConsult(null);
      }
      setClosureToDelete(null);
      showToast(`Último cierre (${code}) eliminado sin afectar cierres anteriores`, 'info');
    } catch (err: any) {
      showToast(err?.message || 'No se pudo borrar el cierre', 'error');
    } finally {
      setIsDeletingClosure(false);
    }
  };

  const getMethodIcon = (category: string, isCash: boolean) => {
    if (isCash || category === 'efectivo') return Banknote;
    if (category === 'tarjeta') return CreditCard;
    if (category === 'billetera_digital') return Smartphone;
    if (category === 'transferencia') return Building2;
    return Wallet;
  };

  const renderFlowTable = (rows: CashFlowEntry[], flow: 'ingreso' | 'desembolso') => {
    if (rows.length === 0) {
      return (
        <div className="p-8 rounded-2xl border border-dashed border-[#383124] bg-[#18171f] text-center text-xs text-[#a8a29e]">
          {flow === 'ingreso'
            ? 'No hay ingresos registrados con este filtro desde el último cierre de caja.'
            : 'No hay desembolsos registrados con este filtro desde el último cierre de caja.'}
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-[#2d281e] overflow-hidden bg-[#18171f]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1a1922] text-[10px] uppercase text-[#a8a29e] border-b border-[#2d281e]">
              <tr>
                <th className="px-4 py-3">Fecha / Hora</th>
                <th className="px-3 py-3">Tipo</th>
                <th className="px-3 py-3">Ref.</th>
                <th className="px-3 py-3">Concepto</th>
                <th className="px-3 py-3">Tercero</th>
                <th className="px-3 py-3">Medio de Pago</th>
                <th className="px-3 py-3">Usuario</th>
                <th className="px-4 py-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d281e]">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-[#2b2416]/30 transition-colors">
                  <td className="px-4 py-2.5 text-[11px] text-[#a8a29e] whitespace-nowrap">
                    {formatColombiaDateTime(row.date)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        flow === 'ingreso'
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                          : 'bg-red-950/60 text-red-300 border-red-700/50'
                      }`}
                    >
                      {KIND_LABELS[row.kind] || row.kind}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] font-bold text-[#d4af37] whitespace-nowrap">
                    {row.consecutivo}
                  </td>
                  <td className="px-3 py-2.5 text-[#fef3c7] font-medium max-w-xs truncate">
                    {row.concept}
                  </td>
                  <td className="px-3 py-2.5 text-[#a8a29e] whitespace-nowrap">
                    {row.thirdParty}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#2b2416] text-[#fef3c7] border border-[#d4af37]/30 text-[10px] font-bold">
                      {row.paymentMethodName}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[#a8a29e] whitespace-nowrap">{row.userName}</td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono font-black whitespace-nowrap ${
                      flow === 'ingreso' ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {flow === 'ingreso' ? '+' : '-'}
                    {formatCOP(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* CABECERA */}
      <div className="bg-[#14131a] p-5 rounded-3xl border border-[#2d281e] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#735812] flex items-center justify-center text-[#0e0e12] shadow-lg shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#fef3c7] tracking-tight">
              Cuadre y Cierre de Caja
            </h2>
            <p className="text-xs text-[#a8a29e] flex flex-wrap items-center gap-2 mt-0.5">
              <span>{currentBranch?.name || 'Sede Principal'}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#d4af37]" />
                {lastClosureTimestamp
                  ? `Movimientos desde último cierre: ${formatColombiaDateTime(lastClosureTimestamp)}`
                  : 'Primer período activo (sin cierres previos)'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-3.5 py-2 rounded-2xl bg-[#18171f] border border-[#2d281e] text-xs">
            <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">Base Actual</span>
            <span className="text-sm font-black font-mono text-[#d4af37]">
              {formatCOP(currentBaseTotal)}
            </span>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-[#18171f] border border-[#2d281e] text-xs">
            <span className="text-[10px] uppercase font-bold text-emerald-400 block">
              Ingresos Período
            </span>
            <span className="text-sm font-black font-mono text-emerald-400">
              {formatCOP(incomeSummary.grandTotal)}
            </span>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-[#18171f] border border-[#2d281e] text-xs">
            <span className="text-[10px] uppercase font-bold text-red-400 block">
              Desembolsos Período
            </span>
            <span className="text-sm font-black font-mono text-red-400">
              {formatCOP(disbursementSummary.grandTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 1. REGISTRO DE LA BASE (CAMPO VACÍO POR DEFECTO)             */}
      {/* ============================================================ */}
      <div className="bg-[#14131a] p-5 rounded-3xl border border-[#2d281e] shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#2d281e]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2b2416] border border-[#d4af37]/50 flex items-center justify-center text-[#d4af37]">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#fef3c7]">1. Registro de Base de Caja</h3>
              <p className="text-[11px] text-[#a8a29e]">
                Ingresa el efectivo base del turno actual. Puedes registrar una o varias bases antes del cierre.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-xl bg-[#2b2416] border border-[#d4af37]/40 text-xs font-black text-[#fef3c7]">
            Base acumulada: <strong className="font-mono text-[#d4af37]">{formatCOP(currentBaseTotal)}</strong>
          </span>
        </div>

        <form onSubmit={handleRegisterBase} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-4">
            <label
              htmlFor="cash-base-amount"
              className="block text-xs font-bold text-[#fef3c7] mb-1"
            >
              Valor de la base (COP)
            </label>
            <input
              id="cash-base-amount"
              type="number"
              min={1}
              step="1"
              value={baseAmountInput}
              onChange={(e) => {
                setBaseAmountInput(e.target.value);
                if (baseError) setBaseError('');
              }}
              placeholder="Ingresa el valor de la base..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#18171f] border border-[#383124] focus:border-[#d4af37] text-sm font-black font-mono text-[#fef3c7] placeholder-[#78716c] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-5">
            <label
              htmlFor="cash-base-reason"
              className="block text-xs font-bold text-[#a8a29e] mb-1"
            >
              Concepto (opcional)
            </label>
            <input
              id="cash-base-reason"
              type="text"
              value={baseReasonInput}
              onChange={(e) => setBaseReasonInput(e.target.value)}
              placeholder="Ej. Base inicial del día, cambio adicional..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#18171f] border border-[#383124] focus:border-[#d4af37] text-xs text-[#fef3c7] placeholder-[#78716c] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={isSavingBase || actionLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center justify-center gap-2 hover:brightness-110 shadow-lg cursor-pointer disabled:opacity-50"
            >
              {isSavingBase ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 stroke-[3]" />}
              <span>{isSavingBase ? 'Registrando...' : 'Registrar base'}</span>
            </button>
          </div>
        </form>

        {baseError && (
          <div className="px-3.5 py-2 rounded-xl bg-red-950/70 border border-red-600/60 text-red-200 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{baseError}</span>
          </div>
        )}

        {/* Listado de bases registradas en el período abierto */}
        {currentBaseEntries.length > 0 && (
          <div className="pt-2 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#a8a29e] block">
              Bases registradas en este período ({currentBaseEntries.length})
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {currentBaseEntries.map((base) => (
                <div
                  key={base.id}
                  className="p-3 rounded-2xl bg-[#18171f] border border-[#2d281e] flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black font-mono text-sm text-[#d4af37]">
                        {formatCOP(base.amount)}
                      </span>
                      <span className="text-xs font-bold text-[#fef3c7] truncate">
                        {base.reason}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#a8a29e] block mt-0.5">
                      {formatColombiaDateTime(base.createdAt)} · {base.userName}
                    </span>
                  </div>

                  {baseIdPendingDelete === base.id ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleConfirmDeleteBase(base.id)}
                        className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-black cursor-pointer"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setBaseIdPendingDelete(null)}
                        className="px-2 py-1 rounded-lg bg-[#14131a] border border-[#383124] text-[11px] font-bold text-[#a8a29e] cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBaseId(base.id);
                          setEditBaseAmountInput(String(base.amount));
                          setEditBaseReasonInput(base.reason);
                        }}
                        className="p-1.5 rounded-lg bg-[#2b2416] border border-[#d4af37]/40 text-[#d4af37] hover:brightness-110 cursor-pointer"
                        aria-label={`Editar base ${base.reason}`}
                        title="Editar base"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setBaseIdPendingDelete(base.id)}
                        className="p-1.5 rounded-lg bg-red-950/60 border border-red-700/50 text-red-300 hover:bg-red-900/70 cursor-pointer"
                        aria-label={`Borrar base ${base.reason}`}
                        title="Borrar base"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. REGISTRO DE CUADRE POR MEDIOS DE PAGO ACTIVOS             */}
      {/* ============================================================ */}
      <form
        onSubmit={handleRegisterCuadre}
        className="bg-[#14131a] p-5 rounded-3xl border border-[#2d281e] shadow-xl space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#2d281e]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-600/60 flex items-center justify-center text-emerald-300">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#fef3c7]">
                2. Registro de Cuadre por Medios de Pago Activos
              </h3>
              <p className="text-[11px] text-[#a8a29e]">
                Ingresa el valor contado o verificado en cada medio de pago. Solo <strong className="text-emerald-400">Efectivo</strong> es obligatorio; los demás pueden quedar vacíos (se mostrarán como "Sin registrar").
              </p>
            </div>
          </div>
        </div>

        {/* Campos de Medios de Pago Activos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {activePaymentMethods.map((pm) => {
            const Icon = getMethodIcon(pm.category, pm.isCash);
            const val = closureInputs[pm.id] ?? '';

            return (
              <div
                key={pm.id}
                className={`p-4 rounded-2xl border space-y-2.5 transition-all ${
                  pm.isCash
                    ? 'bg-[#2b2416] border-[#d4af37]/70 ring-1 ring-[#d4af37]/30'
                    : 'bg-[#18171f] border-[#2d281e]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor={`cuadre-method-${pm.id}`}
                    className="text-xs font-black text-[#fef3c7] flex items-center gap-2"
                  >
                    <Icon
                      className={`w-4 h-4 ${pm.isCash ? 'text-emerald-400' : 'text-[#d4af37]'}`}
                    />
                    <span>{pm.name}</span>
                  </label>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                      pm.isCash
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60'
                        : 'bg-[#14131a] text-[#a8a29e] border-[#383124]'
                    }`}
                  >
                    {pm.isCash ? 'Obligatorio' : 'Opcional'}
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-[#a8a29e]">
                    $
                  </span>
                  <input
                    id={`cuadre-method-${pm.id}`}
                    type="number"
                    min={0}
                    step="1"
                    value={val}
                    onChange={(e) => {
                      setClosureInputs((prev) => ({ ...prev, [pm.id]: e.target.value }));
                      if (closureError) setClosureError('');
                    }}
                    placeholder={pm.isCash ? 'Efectivo contado...' : 'Opcional (sin registrar)'}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-[#121117] border border-[#383124] focus:border-[#d4af37] text-sm font-black font-mono text-[#fef3c7] placeholder-[#78716c] focus:outline-none"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Observaciones y Botón Registrar Cuadre */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 pt-1">
          <div className="flex-1">
            <label
              htmlFor="cuadre-notes"
              className="block text-[11px] font-bold text-[#a8a29e] mb-1"
            >
              Observaciones del cuadre (opcional)
            </label>
            <input
              id="cuadre-notes"
              type="text"
              value={closureNotes}
              onChange={(e) => setClosureNotes(e.target.value)}
              placeholder="Ej. Cierre turno noche, novedad de billete o datáfono..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#18171f] border border-[#383124] focus:border-[#d4af37] text-xs text-[#fef3c7] placeholder-[#78716c] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isRegisteringClosure || actionLoading}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 text-white font-black text-xs inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/25 cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isRegisteringClosure ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ClipboardCheck className="w-4 h-4" />
            )}
            <span>{isRegisteringClosure ? 'Registrando cuadre...' : 'Registrar cuadre'}</span>
          </button>
        </div>

        {closureError && (
          <div className="px-3.5 py-2.5 rounded-xl bg-red-950/70 border border-red-600/60 text-red-200 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{closureError}</span>
          </div>
        )}
      </form>

      {/* ============================================================ */}
      {/* 3. NAVEGACIÓN EN 3 PESTAÑAS: INGRESOS / DESEMBOLSOS / CIERRES */}
      {/* ============================================================ */}
      <div className="bg-[#14131a] rounded-3xl border border-[#2d281e] shadow-xl overflow-hidden">
        {/* Barra de 3 pestañas */}
        <div
          role="tablist"
          aria-label="Secciones del cuadre de caja"
          className="p-3 border-b border-[#2d281e] bg-[#1a1922] grid grid-cols-3 gap-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ingresos'}
            onClick={() => setActiveTab('ingresos')}
            className={`py-2.5 px-3 rounded-2xl text-xs font-black inline-flex items-center justify-center gap-2 border transition-all cursor-pointer ${
              activeTab === 'ingresos'
                ? 'bg-[#2b2416] text-[#fef3c7] border-[#d4af37] shadow-md'
                : 'bg-[#14131a] text-[#a8a29e] border-[#2d281e] hover:border-[#d4af37]/50 hover:text-[#fef3c7]'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Ingresos</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/70 text-emerald-300 border border-emerald-700/50">
              {periodIncomes.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'desembolsos'}
            onClick={() => setActiveTab('desembolsos')}
            className={`py-2.5 px-3 rounded-2xl text-xs font-black inline-flex items-center justify-center gap-2 border transition-all cursor-pointer ${
              activeTab === 'desembolsos'
                ? 'bg-[#2b2416] text-[#fef3c7] border-[#d4af37] shadow-md'
                : 'bg-[#14131a] text-[#a8a29e] border-[#2d281e] hover:border-[#d4af37]/50 hover:text-[#fef3c7]'
            }`}
          >
            <ArrowDownRight className="w-4 h-4 text-red-400 shrink-0" />
            <span>Desembolsos</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-red-950/70 text-red-300 border border-red-700/50">
              {periodDisbursements.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'cierres'}
            onClick={() => setActiveTab('cierres')}
            className={`py-2.5 px-3 rounded-2xl text-xs font-black inline-flex items-center justify-center gap-2 border transition-all cursor-pointer ${
              activeTab === 'cierres'
                ? 'bg-[#2b2416] text-[#fef3c7] border-[#d4af37] shadow-md'
                : 'bg-[#14131a] text-[#a8a29e] border-[#2d281e] hover:border-[#d4af37]/50 hover:text-[#fef3c7]'
            }`}
          >
            <ClipboardCheck className="w-4 h-4 text-[#d4af37] shrink-0" />
            <span>Cierres</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#2b2416] text-[#d4af37] border border-[#d4af37]/40">
              {cashClosures.length}
            </span>
          </button>
        </div>

        {/* Contenido de la pestaña activa */}
        <div className="p-5 space-y-4">
          {/* PESTAÑA 1: INGRESOS */}
          {activeTab === 'ingresos' && (
            <>
              {/* Totales por cada medio de pago */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <div className="p-3 rounded-2xl bg-emerald-950/50 border border-emerald-700/60">
                  <span className="text-[10px] uppercase font-black text-emerald-300 block">
                    Total Ingresos
                  </span>
                  <span className="text-base font-black font-mono text-[#fef3c7] mt-1 block">
                    {formatCOP(incomeSummary.grandTotal)}
                  </span>
                  <span className="text-[10px] text-emerald-300/80">
                    {periodIncomes.length} registros
                  </span>
                </div>

                {incomeSummary.byMethod.map((item) => (
                  <div
                    key={item.methodId}
                    className="p-3 rounded-2xl bg-[#18171f] border border-[#2d281e]"
                  >
                    <span className="text-[10px] uppercase font-bold text-[#a8a29e] block truncate">
                      {item.methodName}
                    </span>
                    <span className="text-sm font-black font-mono text-emerald-400 mt-1 block">
                      {formatCOP(item.total)}
                    </span>
                    <span className="text-[10px] text-[#78716c]">
                      {item.count} {item.count === 1 ? 'registro' : 'registros'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Botones de filtro por medio de pago + buscador */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIncomeMethodFilter('todos')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer transition-all ${
                      incomeMethodFilter === 'todos'
                        ? 'bg-[#d4af37] text-[#121117] border-[#d4af37]'
                        : 'bg-[#18171f] text-[#fef3c7] border-[#2d281e] hover:border-[#d4af37]/60'
                    }`}
                  >
                    Todos ({periodIncomes.length})
                  </button>
                  {incomeSummary.byMethod.map((m) => (
                    <button
                      key={m.methodId}
                      type="button"
                      onClick={() => setIncomeMethodFilter(m.methodId)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                        incomeMethodFilter === m.methodId
                          ? 'bg-[#d4af37] text-[#121117] border-[#d4af37]'
                          : 'bg-[#18171f] text-[#fef3c7] border-[#2d281e] hover:border-[#d4af37]/60'
                      }`}
                    >
                      {m.methodName} ({m.count})
                    </button>
                  ))}
                </div>

                <div className="relative w-full lg:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a29e]" />
                  <input
                    type="text"
                    value={incomeSearch}
                    onChange={(e) => setIncomeSearch(e.target.value)}
                    placeholder="Buscar ingreso..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#18171f] border border-[#2d281e] text-xs text-[#fef3c7] placeholder-[#78716c] focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              {renderFlowTable(filteredIncomes, 'ingreso')}
            </>
          )}

          {/* PESTAÑA 2: DESEMBOLSOS */}
          {activeTab === 'desembolsos' && (
            <>
              {/* Totales por cada medio de pago */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <div className="p-3 rounded-2xl bg-red-950/50 border border-red-700/60">
                  <span className="text-[10px] uppercase font-black text-red-300 block">
                    Total Desembolsos
                  </span>
                  <span className="text-base font-black font-mono text-[#fef3c7] mt-1 block">
                    {formatCOP(disbursementSummary.grandTotal)}
                  </span>
                  <span className="text-[10px] text-red-300/80">
                    {periodDisbursements.length} registros
                  </span>
                </div>

                {disbursementSummary.byMethod.map((item) => (
                  <div
                    key={item.methodId}
                    className="p-3 rounded-2xl bg-[#18171f] border border-[#2d281e]"
                  >
                    <span className="text-[10px] uppercase font-bold text-[#a8a29e] block truncate">
                      {item.methodName}
                    </span>
                    <span className="text-sm font-black font-mono text-red-400 mt-1 block">
                      {formatCOP(item.total)}
                    </span>
                    <span className="text-[10px] text-[#78716c]">
                      {item.count} {item.count === 1 ? 'registro' : 'registros'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Botones de filtro por medio de pago + buscador */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDisbursementMethodFilter('todos')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer transition-all ${
                      disbursementMethodFilter === 'todos'
                        ? 'bg-[#d4af37] text-[#121117] border-[#d4af37]'
                        : 'bg-[#18171f] text-[#fef3c7] border-[#2d281e] hover:border-[#d4af37]/60'
                    }`}
                  >
                    Todos ({periodDisbursements.length})
                  </button>
                  {disbursementSummary.byMethod.map((m) => (
                    <button
                      key={m.methodId}
                      type="button"
                      onClick={() => setDisbursementMethodFilter(m.methodId)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                        disbursementMethodFilter === m.methodId
                          ? 'bg-[#d4af37] text-[#121117] border-[#d4af37]'
                          : 'bg-[#18171f] text-[#fef3c7] border-[#2d281e] hover:border-[#d4af37]/60'
                      }`}
                    >
                      {m.methodName} ({m.count})
                    </button>
                  ))}
                </div>

                <div className="relative w-full lg:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a29e]" />
                  <input
                    type="text"
                    value={disbursementSearch}
                    onChange={(e) => setDisbursementSearch(e.target.value)}
                    placeholder="Buscar desembolso..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#18171f] border border-[#2d281e] text-xs text-[#fef3c7] placeholder-[#78716c] focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              {renderFlowTable(filteredDisbursements, 'desembolso')}
            </>
          )}

          {/* PESTAÑA 3: CIERRES */}
          {activeTab === 'cierres' && (
            <>
              {cashClosures.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-[#383124] bg-[#18171f] text-center text-xs text-[#a8a29e]">
                  Aún no se han generado cierres de caja. Completa el campo de Efectivo arriba y presiona <strong className="text-[#fef3c7]">Registrar cuadre</strong> para generar el primer cierre.
                </div>
              ) : (
                <div className="space-y-3">
                  {cashClosures.map((closure) => {
                    const isLatest = isLastCashClosure(closure.id, cashClosures);
                    const status = getDifferenceStatus(
                      closure.cashRegistered,
                      closure.cashDifference
                    );

                    return (
                      <div
                        key={closure.id}
                        className="p-4 rounded-2xl bg-[#18171f] border border-[#2d281e] flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-black text-sm text-[#d4af37]">
                              {closure.consecutivo}
                            </span>
                            {isLatest && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#2b2416] text-[#d4af37] border border-[#d4af37]/50">
                                Último cierre
                              </span>
                            )}
                            {status === 'cuadrado' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-950/70 text-emerald-300 border border-emerald-600/60">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Efectivo Cuadrado</span>
                              </span>
                            ) : status === 'sobrante' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-950/70 text-sky-300 border border-sky-600/60">
                                <TrendingUp className="w-3 h-3" />
                                <span>Sobrante +{formatCOP(closure.cashDifference)}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-950/70 text-red-300 border border-red-600/60">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Faltante {formatCOP(closure.cashDifference)}</span>
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-[#a8a29e]">
                            Cerrado: <strong className="text-[#fef3c7]">{formatColombiaDateTime(closure.closedAt)}</strong> · Responsable: {closure.userName}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 text-xs pt-0.5">
                            <span className="text-[#a8a29e]">
                              Base: <strong className="font-mono text-[#fef3c7]">{formatCOP(closure.baseTotal)}</strong>
                            </span>
                            <span className="text-emerald-400">
                              Ingresos: <strong className="font-mono">{formatCOP(closure.totalIncomes)}</strong>
                            </span>
                            <span className="text-red-400">
                              Desembolsos: <strong className="font-mono">{formatCOP(closure.totalDisbursements)}</strong>
                            </span>
                            <span className="text-[#d4af37]">
                              Efectivo reg.: <strong className="font-mono">{formatCOP(closure.cashRegistered)}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setClosureToConsult(closure)}
                            className="px-3.5 py-2 rounded-xl bg-[#2b2416] hover:bg-[#3d321d] border border-[#d4af37]/60 text-[#fef3c7] text-xs font-black inline-flex items-center gap-1.5 cursor-pointer transition-all"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#d4af37]" />
                            <span>Consultar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setClosureToEdit(closure)}
                            className="px-3.5 py-2 rounded-xl bg-[#14131a] hover:bg-[#2b2416] border border-[#383124] hover:border-[#d4af37]/60 text-[#fef3c7] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-[#d4af37]" />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            disabled={!isLatest}
                            onClick={() => isLatest && setClosureToDelete(closure)}
                            title={
                              isLatest
                                ? 'Borrar el último cierre generado'
                                : 'Solo se puede borrar el último cierre para no afectar los anteriores'
                            }
                            className={`px-3.5 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-all ${
                              isLatest
                                ? 'bg-red-950/70 hover:bg-red-900/80 border-red-700/60 text-red-300 cursor-pointer'
                                : 'bg-[#14131a] border-[#2d281e] text-[#78716c] opacity-45 cursor-not-allowed'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Borrar</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MODAL: Editar Base Registrada */}
      {editingBaseId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121117] border border-[#3f3521] rounded-3xl w-full max-w-md p-5 text-[#faf5ee] shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-base text-[#fef3c7]">Editar Registro de Base</h3>
              <button
                type="button"
                onClick={() => setEditingBaseId(null)}
                className="p-1.5 rounded-xl bg-[#18171f] border border-[#2d281e] text-[#a8a29e] hover:text-[#fef3c7] cursor-pointer"
                aria-label="Cerrar edición de base"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateBaseSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#a8a29e] mb-1">
                  Monto de la Base (COP)
                </label>
                <input
                  type="number"
                  min={1}
                  value={editBaseAmountInput}
                  onChange={(e) => setEditBaseAmountInput(e.target.value)}
                  className="w-full bg-[#18171f] border border-[#383124] focus:border-[#d4af37] rounded-xl px-3 py-2 text-sm font-black font-mono text-[#fef3c7] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#a8a29e] mb-1">
                  Concepto
                </label>
                <input
                  type="text"
                  value={editBaseReasonInput}
                  onChange={(e) => setEditBaseReasonInput(e.target.value)}
                  className="w-full bg-[#18171f] border border-[#383124] focus:border-[#d4af37] rounded-xl px-3 py-2 text-xs text-[#fef3c7] focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBaseId(null)}
                  className="px-4 py-2 rounded-xl border border-[#383124] text-xs font-bold text-[#a8a29e] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs hover:brightness-110 cursor-pointer"
                >
                  Actualizar Base
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Consultar Informe Completo del Cierre */}
      {closureToConsult && (
        <CashClosureReportModal
          closure={closureToConsult}
          onClose={() => setClosureToConsult(null)}
        />
      )}

      {/* MODAL: Editar Valores Registrados en un Cierre */}
      {closureToEdit && (
        <CashClosureEditModal
          closure={closureToEdit}
          isSaving={isUpdatingClosure}
          onSave={handleSaveEditedClosure}
          onClose={() => setClosureToEdit(null)}
        />
      )}

      {/* MODAL: Confirmar Borrado del Último Cierre */}
      {closureToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121117] border border-red-600/60 rounded-3xl w-full max-w-md p-6 text-[#faf5ee] shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-950/70 border border-red-600/60 text-red-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-black text-[#fef3c7]">
                ¿Borrar el último cierre ({closureToDelete.consecutivo})?
              </h3>
              <p className="text-xs text-[#a8a29e]">
                Al eliminar este último cierre, sus movimientos y bases volverán al período abierto actual sin afectar ninguno de los cierres anteriores.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2d281e]">
              <button
                type="button"
                disabled={isDeletingClosure}
                onClick={() => setClosureToDelete(null)}
                className="px-4 py-2 rounded-xl bg-[#18171f] border border-[#383124] text-xs font-bold text-[#a8a29e] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingClosure}
                onClick={handleConfirmDeleteLastClosure}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeletingClosure && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeletingClosure ? 'Eliminando...' : 'Sí, borrar último cierre'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
