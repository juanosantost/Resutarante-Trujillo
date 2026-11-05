import React, { useState } from 'react';
import { SupplierAdvance, Supplier, PaymentMethod, DEFAULT_BRANCH_PRINT_CONFIG } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { calculateAdvanceAvailableBalance, validateFinancialAmount } from '../../utils/supplierAndPayablesUtils';
import { SupplierSelectInput } from '../common/SupplierSelectInput';
import { SupplierVoucherModal, SupplierVoucherData } from '../modals/SupplierVoucherModal';
import { useToast } from '../../context/ToastContext';
import {
  DollarSign,
  Plus,
  Search,
  Printer,
  RotateCcw,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Clock,
  Building,
  X,
  FileText,
} from 'lucide-react';

export const SupplierAdvancesView: React.FC = () => {
  const {
    supplierAdvances,
    branches,
    currentBranch,
    createSupplierAdvance,
    registerSupplierAdvanceReintegro,
    voidSupplierAdvance,
  } = useRestaurant();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'disponible' | 'aplicado' | 'reintegrado' | 'anulado'>('disponible');

  // Modales
  const [showNewAdvanceModal, setShowNewAdvanceModal] = useState<boolean>(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transferencia');
  const [observations, setObservations] = useState<string>('');

  // Modal de Reintegro
  const [showReintegroModal, setShowReintegroModal] = useState<boolean>(false);
  const [selectedAdvanceForReintegro, setSelectedAdvanceForReintegro] = useState<SupplierAdvance | null>(null);
  const [reintegroAmount, setReintegroAmount] = useState<number>(0);
  const [reintegroPaymentMethod, setReintegroPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [reintegroNotes, setReintegroNotes] = useState<string>('');

  // Modal de Anulación
  const [showVoidModal, setShowVoidModal] = useState<boolean>(false);
  const [selectedAdvanceForVoid, setSelectedAdvanceForVoid] = useState<SupplierAdvance | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');

  // Modal de Comprobante Térmico POS
  const [showVoucherModal, setShowVoucherModal] = useState<boolean>(false);
  const [voucherData, setVoucherData] = useState<SupplierVoucherData | null>(null);

  // Filtrado de anticipos
  const filteredAdvances = supplierAdvances.filter((a) => {
    const st = a.status || 'disponible';
    if (statusFilter === 'disponible' && (st === 'anulado' || st === 'aplicado_totalmente' || st === 'reintegrado')) return false;
    if (statusFilter === 'aplicado' && st !== 'aplicado_totalmente' && st !== 'parcialmente_aplicado') return false;
    if (statusFilter === 'reintegrado' && st !== 'reintegrado') return false;
    if (statusFilter === 'anulado' && st !== 'anulado') return false;

    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase();
    return (
      a.supplierName.toLowerCase().includes(term) ||
      (a.receiptNumber && a.receiptNumber.toLowerCase().includes(term)) ||
      (a.observations && a.observations.toLowerCase().includes(term))
    );
  });

  // Totales
  const totalAdvancesOriginal = supplierAdvances.filter((a) => a.status !== 'anulado').reduce((sum, a) => sum + (a.originalAmount || a.amount), 0);
  const totalApplied = supplierAdvances.filter((a) => a.status !== 'anulado').reduce((sum, a) => sum + (a.appliedAmount || 0), 0);
  const totalReintegrated = supplierAdvances.filter((a) => a.status !== 'anulado').reduce((sum, a) => sum + (a.reintegratedAmount || 0), 0);
  const totalAvailable = supplierAdvances.filter((a) => a.status !== 'anulado').reduce((sum, a) => sum + (a.availableBalance !== undefined ? a.availableBalance : a.balance), 0);

  // Guardar Nuevo Anticipo
  const handleCreateAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) {
      showToast('Seleccione un proveedor para el anticipo', 'error');
      return;
    }
    const val = validateFinancialAmount(advanceAmount);
    if (!val.isValid) {
      showToast(val.error || 'Monto inválido', 'error');
      return;
    }

    try {
      const advId = await createSupplierAdvance({
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        amount: advanceAmount,
        paymentMethod,
        observations: observations.trim(),
      });

      showToast(`Anticipo registrado con éxito por ${formatCOP(advanceAmount)}`, 'success');
      setShowNewAdvanceModal(false);

      // Preparar tirilla térmica
      setVoucherData({
        voucherType: 'anticipo',
        voucherNumber: `ANT-${1000 + supplierAdvances.length + 1}`,
        date: new Date().toISOString(),
        supplierName: selectedSupplier.name,
        supplierDocument: selectedSupplier.document,
        supplierPhone: selectedSupplier.phone,
        amount: advanceAmount,
        paymentMethod,
        observations,
        userName: 'Usuario',
        advanceAvailableBalance: advanceAmount,
        branchSnapshot: {
          id: currentBranch?.id || 'sede-1',
          branchId: currentBranch?.id || 'sede-1',
          name: currentBranch?.name || 'Sede Principal',
          nit: currentBranch?.nit || '',
          address: currentBranch?.address || '',
          phone: currentBranch?.phone || '',
          printConfig: currentBranch?.printConfig || DEFAULT_BRANCH_PRINT_CONFIG,
        },
      });
      setShowVoucherModal(true);

      // Reset
      setSelectedSupplier(null);
      setAdvanceAmount(0);
      setObservations('');
    } catch (err: any) {
      showToast(err.message || 'Error al registrar anticipo', 'error');
    }
  };

  // Guardar Reintegro
  const handleReintegroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdvanceForReintegro) return;

    try {
      await registerSupplierAdvanceReintegro({
        advanceId: selectedAdvanceForReintegro.id,
        amount: reintegroAmount,
        paymentMethod: reintegroPaymentMethod,
        observations: reintegroNotes.trim(),
      });

      showToast(`Reintegro de $ ${formatCOP(reintegroAmount)} ingresado a caja`, 'success');
      setShowReintegroModal(false);

      // Tirilla comprobante de reintegro
      setVoucherData({
        voucherType: 'reintegro',
        voucherNumber: `REI-${Math.floor(Math.random() * 900) + 100}`,
        date: new Date().toISOString(),
        supplierName: selectedAdvanceForReintegro.supplierName,
        amount: reintegroAmount,
        paymentMethod: reintegroPaymentMethod,
        observations: reintegroNotes,
        userName: 'Usuario',
      });
      setShowVoucherModal(true);

      setSelectedAdvanceForReintegro(null);
      setReintegroAmount(0);
      setReintegroNotes('');
    } catch (err: any) {
      showToast(err.message || 'Error al registrar reintegro', 'error');
    }
  };

  // Confirmar Anulación de Anticipo
  const handleVoidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdvanceForVoid) return;

    try {
      await voidSupplierAdvance(selectedAdvanceForVoid.id, voidReason);
      showToast(`Anticipo #${selectedAdvanceForVoid.receiptNumber || selectedAdvanceForVoid.id} anulado`, 'success');
      setShowVoidModal(false);
      setSelectedAdvanceForVoid(null);
      setVoidReason('');
    } catch (err: any) {
      showToast(err.message || 'Error al anular anticipo', 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Métricas de Anticipos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#a8a29e] tracking-wider">
            Total Anticipos Entregados
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-[#FFFDF5]">{formatCOP(totalAdvancesOriginal)}</span>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#a8a29e] tracking-wider">
            Aplicados a Compras
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-amber-400">{formatCOP(totalApplied)}</span>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#a8a29e] tracking-wider">
            Reintegrados a Caja
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-emerald-400">{formatCOP(totalReintegrated)}</span>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#a8a29e] tracking-wider">
            Saldo Disponible Global
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-cyan-400">{formatCOP(totalAvailable)}</span>
          </div>
        </div>
      </div>

      {/* 2. Barra de Herramientas y Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#181818] border border-[#2d281e] p-4 rounded-3xl">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'disponible', label: 'Disponibles' },
            { id: 'aplicado', label: 'Aplicados' },
            { id: 'reintegrado', label: 'Reintegrados' },
            { id: 'todos', label: 'Todos' },
            { id: 'anulado', label: 'Anulados' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#B77900] text-[#181818]'
                  : 'bg-[#121214] text-[#a8a29e] hover:text-[#FFFDF5]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#a8a29e]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por proveedor o comprobante..."
              className="w-full bg-[#121214] border border-[#333333] rounded-xl pl-9 pr-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowNewAdvanceModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center gap-1.5 hover:brightness-110 shadow cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Anticipo</span>
          </button>
        </div>
      </div>

      {/* 3. Tabla / Lista de Anticipos */}
      {filteredAdvances.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAdvances.map((adv) => {
            const isAnulado = adv.status === 'anulado';
            const available = adv.availableBalance !== undefined ? adv.availableBalance : adv.balance;
            const original = adv.originalAmount || adv.amount;

            return (
              <div
                key={adv.id}
                className={`bg-[#181818] border rounded-3xl p-5 shadow-lg flex flex-col justify-between transition-all ${
                  isAnulado ? 'border-red-900/40 opacity-70' : 'border-[#2d281e] hover:border-[#B77900]/50'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-cyan-400 font-mono">
                          {adv.receiptNumber || adv.id}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            isAnulado
                              ? 'bg-red-950 text-red-300 border border-red-800'
                              : available > 0
                              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                              : 'bg-stone-800 text-stone-300'
                          }`}
                        >
                          {adv.status || 'disponible'}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-[#FFFDF5] mt-1">
                        {adv.supplierName}
                      </h4>
                    </div>
                  </div>

                  {/* Resumen de Montos */}
                  <div className="p-3 bg-[#121214] rounded-2xl border border-[#242424] mb-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#a8a29e]">Valor Original:</span>
                      <span className="font-mono font-bold text-[#FFFDF5]">{formatCOP(original)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#a8a29e]">Aplicado a Compras:</span>
                      <span className="font-mono text-amber-400 font-bold">{formatCOP(adv.appliedAmount || 0)}</span>
                    </div>
                    {(adv.reintegratedAmount || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#a8a29e]">Reintegrado a Caja:</span>
                        <span className="font-mono text-emerald-400 font-bold">{formatCOP(adv.reintegratedAmount || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1.5 border-t border-[#242424] font-bold">
                      <span className="text-cyan-400">Saldo Disponible:</span>
                      <span className="font-mono text-cyan-400 text-sm font-black">{formatCOP(available)}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#a8a29e] flex items-center gap-1 mb-2">
                    <Clock className="w-3 h-3 text-[#D6A21A]" />
                    <span>Fecha: {adv.date} · Pago: {adv.paymentMethod}</span>
                  </p>

                  {adv.observations && (
                    <p className="text-[11px] text-[#a8a29e] italic mb-3">
                      "{adv.observations}"
                    </p>
                  )}
                </div>

                {/* Acciones */}
                <div className="pt-3 border-t border-[#2d281e] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVoucherData({
                        voucherType: 'anticipo',
                        voucherNumber: adv.receiptNumber || adv.id,
                        date: adv.date,
                        supplierName: adv.supplierName,
                        amount: original,
                        paymentMethod: adv.paymentMethod,
                        observations: adv.observations,
                        userName: adv.userName || 'Usuario',
                        advanceAvailableBalance: available,
                        status: adv.status,
                        voidReason: adv.voidReason,
                        branchSnapshot: adv.branchSnapshot,
                      });
                      setShowVoucherModal(true);
                    }}
                    className="p-2 rounded-xl bg-[#121214] text-[#a8a29e] hover:text-[#FFFDF5] transition-colors cursor-pointer"
                    title="Imprimir comprobante POS"
                  >
                    <Printer className="w-4 h-4" />
                  </button>

                  {!isAnulado && available > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAdvanceForReintegro(adv);
                        setReintegroAmount(available);
                        setShowReintegroModal(true);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-[#292212] border border-[#B77900]/40 text-[#D6A21A] hover:bg-[#B77900] hover:text-[#181818] font-bold text-xs transition-all cursor-pointer inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reintegrar</span>
                    </button>
                  )}

                  {!isAnulado && (adv.appliedAmount || 0) === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAdvanceForVoid(adv);
                        setShowVoidModal(true);
                      }}
                      className="px-2.5 py-1.5 rounded-xl border border-red-900/50 text-red-400 hover:bg-red-950 font-bold text-xs transition-all cursor-pointer"
                    >
                      Anular
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#181818] border border-[#2d281e] rounded-3xl p-12 text-center text-[#a8a29e]">
          <DollarSign className="w-12 h-12 mx-auto text-[#B77900] mb-3 opacity-60" />
          <p className="text-base font-bold text-[#FFFDF5]">No hay anticipos registrados en esta vista</p>
        </div>
      )}

      {/* MODAL: REGISTRAR NUEVO ANTICIPO */}
      {showNewAdvanceModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative bg-[#181818] border border-[#B77900]/40 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden my-6">
            <div className="p-5 border-b border-[#333333] flex items-center justify-between bg-gradient-to-r from-[#181818] to-[#242424]">
              <div className="flex items-center gap-2.5">
                <DollarSign className="w-6 h-6 text-[#D6A21A]" />
                <div>
                  <h3 className="text-base font-black text-[#FFFDF5]">
                    Registrar Anticipo a Proveedor
                  </h3>
                  <p className="text-xs text-[#a8a29e]">
                    Desembolso real de dinero antes de recibir insumos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewAdvanceModal(false)}
                className="p-1.5 text-[#a8a29e] hover:text-[#FFFDF5] rounded-xl hover:bg-[#2d2d2d] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdvanceSubmit} className="p-6 space-y-4">
              <SupplierSelectInput
                selectedSupplier={selectedSupplier}
                onSelectSupplier={setSelectedSupplier}
                label="Proveedor"
                required
              />

              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                  Valor del Anticipo (COP) <span className="text-amber-500">*</span>
                </label>
                <input
                  type="number"
                  min={1000}
                  value={advanceAmount || ''}
                  onChange={(e) => setAdvanceAmount(parseFloat(e.target.value) || 0)}
                  placeholder="Ej: 300000"
                  required
                  className="w-full bg-[#121214] border border-[#333333] rounded-xl p-3 text-sm font-mono text-[#FFFDF5] font-black focus:outline-none focus:border-[#B77900]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                  Medio de Pago <span className="text-amber-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-[#121214] border border-[#333333] rounded-xl p-3 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
                >
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="efectivo">Efectivo en Caja (Genera Egreso)</option>
                  <option value="nequi_daviplata">Nequi / Daviplata</option>
                  <option value="tarjeta">Datáfono / Tarjeta</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                  Observaciones / Concepto
                </label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  rows={2}
                  placeholder="Ej: Adelanto para reserva de lote semanal de pechuga..."
                  className="w-full bg-[#121214] border border-[#333333] rounded-xl p-3 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
                />
              </div>

              <div className="pt-3 border-t border-[#333333] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewAdvanceModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#444444] text-[#d6d3d1] text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!selectedSupplier || advanceAmount <= 0}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs hover:brightness-110 disabled:opacity-50 cursor-pointer"
                >
                  Guardar e Imprimir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR REINTEGRO */}
      {showReintegroModal && selectedAdvanceForReintegro && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative bg-[#181818] border border-[#B77900]/40 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-[#333333] flex items-center justify-between">
              <h3 className="text-base font-black text-[#FFFDF5]">
                Registrar Reintegro de Anticipo
              </h3>
              <button
                type="button"
                onClick={() => setShowReintegroModal(false)}
                className="p-1.5 text-[#a8a29e] hover:text-[#FFFDF5]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReintegroSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-[#121214] rounded-2xl border border-[#2d281e] text-xs space-y-1">
                <p><strong>Proveedor:</strong> {selectedAdvanceForReintegro.supplierName}</p>
                <p><strong>Anticipo:</strong> {selectedAdvanceForReintegro.receiptNumber || selectedAdvanceForReintegro.id}</p>
                <p><strong>Saldo Disponible Actual:</strong> {formatCOP(selectedAdvanceForReintegro.availableBalance || selectedAdvanceForReintegro.balance)}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                  Valor Reintegrado por Proveedor (COP) *
                </label>
                <input
                  type="number"
                  min={1000}
                  max={selectedAdvanceForReintegro.availableBalance || selectedAdvanceForReintegro.balance}
                  value={reintegroAmount || ''}
                  onChange={(e) => setReintegroAmount(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full bg-[#121214] border border-[#333333] rounded-xl p-3 text-sm font-mono text-[#FFFDF5] font-black focus:outline-none focus:border-[#B77900]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                  Medio de Recibo (Ingreso a Caja) *
                </label>
                <select
                  value={reintegroPaymentMethod}
                  onChange={(e) => setReintegroPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-[#121214] border border-[#333333] rounded-xl p-3 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
                >
                  <option value="efectivo">Efectivo en Caja (Genera Ingreso)</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="nequi_daviplata">Nequi / Daviplata</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                  Observaciones
                </label>
                <input
                  type="text"
                  value={reintegroNotes}
                  onChange={(e) => setReintegroNotes(e.target.value)}
                  placeholder="Ej: Devolución de excedente no consumido..."
                  className="w-full bg-[#121214] border border-[#333333] rounded-xl p-3 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
                />
              </div>

              <div className="pt-3 border-t border-[#333333] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowReintegroModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#444444] text-[#d6d3d1] text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={reintegroAmount <= 0}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs hover:brightness-110 disabled:opacity-50"
                >
                  Confirmar Reintegro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ANULAR ANTICIPO */}
      {showVoidModal && selectedAdvanceForVoid && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative bg-[#181818] border border-red-900/60 rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-black text-[#FFFDF5]">
              Anular Anticipo #{selectedAdvanceForVoid.receiptNumber || selectedAdvanceForVoid.id}
            </h3>
            <p className="text-xs text-[#a8a29e]">
              Esta acción marcará el anticipo como ANULADO y restablecerá el dinero en caja si fue registrado en efectivo.
            </p>

            <div>
              <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                Motivo de Anulación *
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={2}
                placeholder="Ej: Error de digitación, transacción duplicada..."
                className="w-full bg-[#121214] border border-[#333333] rounded-xl p-3 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
              />
            </div>

            <div className="pt-3 border-t border-[#333333] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowVoidModal(false)}
                className="px-4 py-2.5 rounded-xl border border-[#444444] text-[#d6d3d1] text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleVoidSubmit}
                disabled={voidReason.trim().length < 5}
                className="px-6 py-2.5 rounded-xl bg-red-600 text-white font-black text-xs hover:bg-red-700 disabled:opacity-50"
              >
                Confirmar Anulación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Comprobante Térmico POS */}
      <SupplierVoucherModal
        isOpen={showVoucherModal}
        onClose={() => setShowVoucherModal(false)}
        voucher={voucherData}
        branch={currentBranch}
      />

    </div>
  );
};
