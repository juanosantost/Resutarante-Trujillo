import React, { useState } from 'react';
import { Purchase, PurchasePayment, Supplier, PaymentMethod, SupplierAdvance, DEFAULT_BRANCH_PRINT_CONFIG } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { validateFinancialAmount, recalculatePurchasePayableBalance } from '../../utils/supplierAndPayablesUtils';
import { SupplierVoucherModal, SupplierVoucherData } from '../modals/SupplierVoucherModal';
import { useToast } from '../../context/ToastContext';
import {
  CreditCard,
  Search,
  DollarSign,
  Printer,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  FileText,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';

export const AccountsPayableDirectoryView: React.FC = () => {
  const {
    purchases,
    purchasePayments,
    supplierAdvances,
    branches,
    currentBranch,
    addPurchasePayment,
    editPurchasePayment,
    voidPurchasePayment,
  } = useRestaurant();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'pendientes' | 'vencidas' | 'pagadas' | 'todas'>('pendientes');

  // Modales
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState<Purchase | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transferencia');
  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // Modal Historial de Pagos de la Cuenta
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [selectedPurchaseForHistory, setSelectedPurchaseForHistory] = useState<Purchase | null>(null);

  // Modal Anular Pago Individual
  const [showVoidPaymentModal, setShowVoidPaymentModal] = useState<boolean>(false);
  const [selectedPaymentForVoid, setSelectedPaymentForVoid] = useState<PurchasePayment | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');

  // Modal Comprobante POS
  const [showVoucherModal, setShowVoucherModal] = useState<boolean>(false);
  const [voucherData, setVoucherData] = useState<SupplierVoucherData | null>(null);

  // Cuentas con saldo pendiente o activas
  const confirmedPurchases = purchases.filter((p) => p.status !== 'anulada');

  const filteredPurchases = confirmedPurchases.filter((p) => {
    const isPaid = p.balanceDue === 0 && p.total > 0;
    if (statusFilter === 'pendientes' && isPaid) return false;
    if (statusFilter === 'pagadas' && !isPaid) return false;

    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase();
    return (
      p.supplierName.toLowerCase().includes(term) ||
      p.documentNumber.toLowerCase().includes(term) ||
      (p.observations && p.observations.toLowerCase().includes(term))
    );
  });

  // Métricas
  const totalBalanceDue = confirmedPurchases.reduce((sum, p) => sum + (p.balanceDue || 0), 0);
  const pendingCount = confirmedPurchases.filter((p) => p.balanceDue > 0).length;
  const totalPaidRealAll = purchasePayments.filter((p) => p.status !== 'anulado' && p.type !== 'aplicacion_anticipo').reduce((sum, p) => sum + p.amount, 0);
  const paidCount = confirmedPurchases.filter((p) => p.balanceDue === 0 && p.total > 0).length;

  // Registrar Pago / Abono
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPurchaseForPayment) return;

    const val = validateFinancialAmount(paymentAmount, selectedPurchaseForPayment.balanceDue);
    if (!val.isValid) {
      showToast(val.error || 'Monto de pago inválido', 'error');
      return;
    }

    try {
      await addPurchasePayment({
        purchaseId: selectedPurchaseForPayment.id,
        amount: paymentAmount,
        paymentMethod,
        advanceId: selectedAdvanceId || undefined,
        notes: paymentNotes.trim(),
      });

      const newBalance = Math.max(0, selectedPurchaseForPayment.balanceDue - paymentAmount);
      showToast(`Pago de ${formatCOP(paymentAmount)} registrado con éxito`, 'success');
      setShowPaymentModal(false);

      // Tirilla POS de Pago
      setVoucherData({
        voucherType: selectedAdvanceId ? 'aplicacion_anticipo' : 'pago',
        voucherNumber: `PAG-${1000 + purchasePayments.length + 1}`,
        date: new Date().toISOString(),
        supplierName: selectedPurchaseForPayment.supplierName,
        amount: paymentAmount,
        paymentMethod,
        relatedDocumentNumber: selectedPurchaseForPayment.documentNumber,
        observations: paymentNotes,
        userName: 'Usuario',
        totalPurchaseAmount: selectedPurchaseForPayment.total,
        remainingBalanceDue: newBalance,
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

      setSelectedPurchaseForPayment(null);
      setPaymentAmount(0);
      setSelectedAdvanceId('');
      setPaymentNotes('');
    } catch (err: any) {
      showToast(err.message || 'Error al registrar pago', 'error');
    }
  };

  // Confirmar Anulación de Pago Individual
  const handleVoidPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentForVoid) return;

    try {
      await voidPurchasePayment(selectedPaymentForVoid.id, voidReason);
      showToast(`Comprobante #${selectedPaymentForVoid.receiptNumber || selectedPaymentForVoid.id} anulado`, 'success');
      setShowVoidPaymentModal(false);
      setSelectedPaymentForVoid(null);
      setVoidReason('');
    } catch (err: any) {
      showToast(err.message || 'Error al anular pago', 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Métricas de Cuentas por Pagar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#a8a29e] tracking-wider">
            Total Cuentas por Pagar
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-amber-400">{formatCOP(totalBalanceDue)}</span>
            <span className="text-xs text-[#a8a29e]">({pendingCount} compras)</span>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#a8a29e] tracking-wider">
            Total Desembolsado en Pagos
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-emerald-400">{formatCOP(totalPaidRealAll)}</span>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#a8a29e] tracking-wider">
            Facturas Totalmente Pagadas
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-[#FFFDF5]">{paidCount}</span>
            <span className="text-xs text-emerald-400 font-bold">al día</span>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#a8a29e] tracking-wider">
            Compras Totales Registradas
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-[#FFFDF5]">{confirmedPurchases.length}</span>
          </div>
        </div>
      </div>

      {/* 2. Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#181818] border border-[#2d281e] p-4 rounded-3xl">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'pendientes', label: 'Con Saldo Pendiente' },
            { id: 'todas', label: 'Todas' },
            { id: 'pagadas', label: 'Totalmente Pagadas' },
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

        <div className="relative flex-1 sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#a8a29e]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por proveedor o factura..."
            className="w-full bg-[#121214] border border-[#333333] rounded-xl pl-9 pr-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
          />
        </div>
      </div>

      {/* 3. Lista de Obligaciones */}
      {filteredPurchases.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPurchases.map((pur) => {
            const isPaid = pur.balanceDue === 0;
            const purPayments = purchasePayments.filter((p) => p.purchaseId === pur.id);
            const activePayments = purPayments.filter((p) => p.status !== 'anulado');

            return (
              <div
                key={pur.id}
                className="bg-[#181818] border border-[#2d281e] hover:border-[#B77900]/50 rounded-3xl p-5 shadow-lg flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#FFFDF5] font-mono">
                          Factura #{pur.documentNumber}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            isPaid
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {isPaid ? 'PAGADA' : 'PENDIENTE'}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-[#FFFDF5] mt-1">
                        {pur.supplierName}
                      </h4>
                    </div>
                  </div>

                  {/* Detalle Financiero */}
                  <div className="p-3 bg-[#121214] rounded-2xl border border-[#242424] mb-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#a8a29e]">Total Compra:</span>
                      <span className="font-mono font-bold text-[#FFFDF5]">{formatCOP(pur.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#a8a29e]">Total Cubierto:</span>
                      <span className="font-mono text-emerald-400 font-bold">{formatCOP(pur.amountPaid)}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-[#242424] font-bold">
                      <span className="text-amber-400">Saldo Pendiente:</span>
                      <span className="font-mono text-amber-400 text-sm font-black">{formatCOP(pur.balanceDue)}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#a8a29e] flex items-center gap-1 mb-3">
                    <Clock className="w-3 h-3 text-[#D6A21A]" />
                    <span>Fecha Compra: {pur.date} · {pur.items.length} ítems</span>
                  </p>
                </div>

                {/* Acciones */}
                <div className="pt-3 border-t border-[#2d281e] flex items-center justify-between gap-2">
                  {!isPaid && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPurchaseForPayment(pur);
                        setPaymentAmount(pur.balanceDue);
                        setShowPaymentModal(true);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center gap-1 hover:brightness-110 shadow cursor-pointer"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>Registrar Pago</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPurchaseForHistory(pur);
                      setShowHistoryModal(true);
                    }}
                    className="px-3 py-2 rounded-xl bg-[#242424] text-[#a8a29e] hover:text-[#FFFDF5] font-bold text-xs cursor-pointer ml-auto"
                  >
                    Historial Pagos ({activePayments.length})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#181818] border border-[#2d281e] rounded-3xl p-12 text-center text-[#a8a29e]">
          <CreditCard className="w-12 h-12 mx-auto text-[#B77900] mb-3 opacity-60" />
          <p className="text-base font-bold text-[#FFFDF5]">No hay cuentas por pagar en esta vista</p>
        </div>
      )}

      {/* MODAL: REGISTRAR PAGO A CUENTA POR PAGAR */}
      {showPaymentModal && selectedPurchaseForPayment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative bg-[#181818] border border-[#B77900]/40 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden my-6">
            <div className="p-5 border-b border-[#333333] flex items-center justify-between bg-gradient-to-r from-[#181818] to-[#242424]">
              <div>
                <h3 className="text-base font-black text-[#FFFDF5]">
                  Registrar Pago / Abono a Proveedor
                </h3>
                <p className="text-xs text-[#a8a29e]">
                  Factura #{selectedPurchaseForPayment.documentNumber} ({selectedPurchaseForPayment.supplierName})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="p-1.5 text-[#a8a29e] hover:text-[#FFFDF5] rounded-xl hover:bg-[#2d2d2d]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
              <div className="p-3.5 bg-[#121214] rounded-2xl border border-[#242424] text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#a8a29e]">Total Factura:</span>
                  <span className="font-bold text-[#FFFDF5]">{formatCOP(selectedPurchaseForPayment.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a8a29e]">Total Abonado Anterior:</span>
                  <span className="font-bold text-emerald-400">{formatCOP(selectedPurchaseForPayment.amountPaid)}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-[#242424]">
                  <span className="text-amber-400">Saldo Pendiente Actual:</span>
                  <span className="text-amber-400 font-mono text-sm">{formatCOP(selectedPurchaseForPayment.balanceDue)}</span>
                </div>
              </div>

              {/* Selector de Anticipo Disponible si existe */}
              {(() => {
                const supplierAdv = supplierAdvances.filter(
                  (a) =>
                    a.supplierId === selectedPurchaseForPayment.supplierId &&
                    (a.availableBalance !== undefined ? a.availableBalance : a.balance) > 0 &&
                    a.status !== 'anulado'
                );

                if (supplierAdv.length === 0) return null;

                return (
                  <div className="p-3 bg-[#292212]/60 border border-[#B77900]/40 rounded-2xl space-y-2">
                    <span className="text-xs font-bold text-[#D6A21A] block">
                      ¡Anticipos Disponibles para este Proveedor!
                    </span>
                    <select
                      value={selectedAdvanceId}
                      onChange={(e) => {
                        setSelectedAdvanceId(e.target.value);
                        if (e.target.value) {
                          const adv = supplierAdv.find((a) => a.id === e.target.value);
                          const avail = adv ? (adv.availableBalance !== undefined ? adv.availableBalance : adv.balance) : 0;
                          setPaymentAmount(Math.min(selectedPurchaseForPayment.balanceDue, avail));
                        }
                      }}
                      className="w-full bg-[#121214] border border-[#333333] rounded-xl p-2.5 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
                    >
                      <option value="">-- No aplicar anticipo (Pago Real) --</option>
                      {supplierAdv.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.receiptNumber || a.id} - Saldo disponible: {formatCOP(a.availableBalance !== undefined ? a.availableBalance : a.balance)}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                  Monto a Pagar (COP) *
                </label>
                <input
                  type="number"
                  min={1000}
                  max={selectedPurchaseForPayment.balanceDue}
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full bg-[#121214] border border-[#333333] rounded-xl p-3 text-sm font-mono text-[#FFFDF5] font-black focus:outline-none focus:border-[#B77900]"
                />
              </div>

              {!selectedAdvanceId && (
                <div>
                  <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                    Medio de Pago *
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
              )}

              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                  Observaciones / Notas
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Ej: Transferencia desde cuenta Bancolombia empresarial..."
                  className="w-full bg-[#121214] border border-[#333333] rounded-xl p-3 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
                />
              </div>

              <div className="pt-3 border-t border-[#333333] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#444444] text-[#d6d3d1] text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={paymentAmount <= 0}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs hover:brightness-110 disabled:opacity-50"
                >
                  Guardar e Imprimir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HISTORIAL DE PAGOS DE LA COMPRA */}
      {showHistoryModal && selectedPurchaseForHistory && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative bg-[#181818] border border-[#B77900]/40 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden my-6">
            <div className="p-5 border-b border-[#333333] flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-[#FFFDF5]">
                  Historial de Pagos — Factura #{selectedPurchaseForHistory.documentNumber}
                </h3>
                <p className="text-xs text-[#a8a29e]">
                  {selectedPurchaseForHistory.supplierName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 text-[#a8a29e] hover:text-[#FFFDF5]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {(() => {
                const pPayments = purchasePayments.filter((p) => p.purchaseId === selectedPurchaseForHistory.id);

                if (pPayments.length === 0) {
                  return <p className="text-center text-[#a8a29e] text-xs py-6">Sin abonos o pagos registrados aún.</p>;
                }

                return pPayments.map((pay) => {
                  const isAnulado = pay.status === 'anulado';

                  return (
                    <div
                      key={pay.id}
                      className={`p-4 rounded-2xl border text-xs space-y-2 ${
                        isAnulado ? 'bg-red-950/20 border-red-900/40 opacity-70' : 'bg-[#121214] border-[#2d281e]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-[#FFFDF5]">{pay.receiptNumber || pay.id}</span>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                              isAnulado
                                ? 'bg-red-950 text-red-300 border border-red-800'
                                : pay.type === 'aplicacion_anticipo'
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}
                          >
                            {isAnulado ? 'ANULADO' : pay.type === 'aplicacion_anticipo' ? 'ANTICIPO APLICADO' : 'PAGO REAL'}
                          </span>
                        </div>
                        <span className="font-mono font-black text-sm text-[#FFFDF5]">{formatCOP(pay.amount)}</span>
                      </div>

                      <p className="text-[11px] text-[#a8a29e]">
                        Fecha: {formatColombiaDateTime(pay.date)} · Medio: {pay.paymentMethod} · Por: {pay.userName}
                      </p>

                      {pay.notes && <p className="text-[11px] text-[#a8a29e] italic">"{pay.notes}"</p>}

                      {isAnulado && pay.voidReason && (
                        <p className="text-[10px] text-red-400">
                          Motivo anulación: {pay.voidReason} ({pay.voidedBy})
                        </p>
                      )}

                      <div className="pt-2 border-t border-[#242424] flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setVoucherData({
                              voucherType: pay.type === 'aplicacion_anticipo' ? 'aplicacion_anticipo' : 'pago',
                              voucherNumber: pay.receiptNumber || pay.id,
                              date: pay.date,
                              supplierName: pay.supplierName,
                              amount: pay.amount,
                              paymentMethod: pay.paymentMethod,
                              relatedDocumentNumber: selectedPurchaseForHistory.documentNumber,
                              observations: pay.notes,
                              userName: pay.userName,
                              status: pay.status,
                              voidReason: pay.voidReason,
                              branchSnapshot: pay.branchSnapshot,
                            });
                            setShowVoucherModal(true);
                          }}
                          className="text-[11px] font-bold text-[#D6A21A] hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Reimprimir Comprobante Térmico</span>
                        </button>

                        {!isAnulado && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPaymentForVoid(pay);
                              setShowVoidPaymentModal(true);
                            }}
                            className="text-[11px] font-bold text-red-400 hover:underline cursor-pointer"
                          >
                            Anular este registro de pago
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ANULAR PAGO INDIVIDUAL */}
      {showVoidPaymentModal && selectedPaymentForVoid && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative bg-[#181818] border border-red-900/60 rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-black text-[#FFFDF5]">
              Anular Pago #{selectedPaymentForVoid.receiptNumber || selectedPaymentForVoid.id}
            </h3>
            <p className="text-xs text-[#a8a29e]">
              Esta acción anulará exclusivamente este comprobante de pago por <strong>{formatCOP(selectedPaymentForVoid.amount)}</strong>, recalculará el saldo pendiente de la compra y registrará la reversión financiera sin anular la factura comercial completa.
            </p>

            <div>
              <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                Motivo de Anulación *
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={2}
                placeholder="Ej: Error de digitación en la transferencia, valor devuelto..."
                className="w-full bg-[#121214] border border-[#333333] rounded-xl p-3 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
              />
            </div>

            <div className="pt-3 border-t border-[#333333] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowVoidPaymentModal(false)}
                className="px-4 py-2.5 rounded-xl border border-[#444444] text-[#d6d3d1] text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleVoidPaymentSubmit}
                disabled={voidReason.trim().length < 5}
                className="px-6 py-2.5 rounded-xl bg-red-600 text-white font-black text-xs hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                Confirmar Anulación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Comprobante Térmico POS */}
      <SupplierVoucherModal
        isOpen={showVoucherModal}
        onClose={() => setShowVoucherModal(false)}
        voucher={voucherData}
        branch={currentBranch}
      />

    </div>
  );
};
