import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import {
  CarteraRecord,
  Abono,
  Customer,
  PaymentMethod,
} from '../../types';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { validateAbonoAmount, isCarteraOverdue } from '../../utils/creditAndLayawayUtils';
import { CustomerSelectInput } from '../common/CustomerSelectInput';
import { AbonoReceiptModal } from '../modals/AbonoReceiptModal';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  Calendar,
  DollarSign,
  Receipt,
  CheckCircle,
  Clock,
  Printer,
  ShieldAlert,
  MessageCircle,
  AlertCircle,
  FileText,
  User,
  Phone,
  X,
} from 'lucide-react';

export const CarteraView: React.FC = () => {
  const {
    cartera,
    abonos,
    currentBranch,
    createCarteraRecord,
    registerCarteraAbono,
    editAbono,
    voidAbono,
    actionLoading,
  } = useRestaurant();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'pendientes' | 'todas' | 'vencidas' | 'pagadas'>('pendientes');

  // Modal Nueva Cartera
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [initialPayment, setInitialPayment] = useState<number>(0);
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0]
  );
  const [saleOrderNumber, setSaleOrderNumber] = useState<number>(101);
  const [carteraNotes, setCarteraNotes] = useState<string>('');

  // Modal Registrar Abono
  const [showAbonoModal, setShowAbonoModal] = useState<boolean>(false);
  const [selectedCarteraForAbono, setSelectedCarteraForAbono] = useState<CarteraRecord | null>(null);
  const [abonoAmount, setAbonoAmount] = useState<number>(0);
  const [abonoMethod, setAbonoMethod] = useState<PaymentMethod>('efectivo');
  const [abonoNotes, setAbonoNotes] = useState<string>('');

  // Modal Historial de Abonos
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [selectedCarteraForHistory, setSelectedCarteraForHistory] = useState<CarteraRecord | null>(null);

  // Modal Anular Abono
  const [showVoidAbonoModal, setShowVoidAbonoModal] = useState<boolean>(false);
  const [selectedAbonoForVoid, setSelectedAbonoForVoid] = useState<Abono | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');

  // Modal Comprobante Térmico
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [receiptAbono, setReceiptAbono] = useState<Abono | null>(null);
  const [receiptTotal, setReceiptTotal] = useState<number | undefined>(undefined);
  const [receiptRemaining, setReceiptRemaining] = useState<number | undefined>(undefined);

  // Métricas
  const pendingCartera = cartera.filter((c) => c.status !== 'pagada' && c.status !== 'anulada');
  const totalBalanceDue = pendingCartera.reduce((acc, c) => acc + (c.balanceDue || 0), 0);
  const totalOverdue = pendingCartera
    .filter((c) => isCarteraOverdue(c.dueDate))
    .reduce((acc, c) => acc + (c.balanceDue || 0), 0);
  const totalRecaudado = cartera.reduce((acc, c) => acc + (c.totalAbonado || 0), 0);
  const fullyPaidCount = cartera.filter((c) => c.status === 'pagada').length;

  // Filtrado
  const filteredCartera = cartera.filter((c) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      c.code.toLowerCase().includes(term) ||
      c.customerName.toLowerCase().includes(term) ||
      c.customerPhone.includes(term) ||
      c.customerDocument.includes(term) ||
      (c.orderNumber && c.orderNumber.toString().includes(term));

    if (!matchesSearch) return false;
    if (statusFilter === 'pendientes') return c.status !== 'pagada' && c.status !== 'anulada';
    if (statusFilter === 'vencidas') return isCarteraOverdue(c.dueDate) && c.balanceDue > 0;
    if (statusFilter === 'pagadas') return c.status === 'pagada';
    return true;
  });

  const handleCreateCarteraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      showToast('Seleccione un cliente para la cuenta de cartera', 'error');
      return;
    }
    if (totalAmount <= 0) {
      showToast('El valor total debe ser mayor a cero', 'error');
      return;
    }
    if (initialPayment > totalAmount) {
      showToast('El pago inicial no puede ser mayor al valor total', 'error');
      return;
    }

    try {
      const { carteraId, receiptAbono: createdAbono } = await createCarteraRecord({
        saleId: `manual-sale-${Date.now()}`,
        orderNumber: saleOrderNumber || 101,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerPhone: selectedCustomer.phone,
        customerDocument: selectedCustomer.documentNumber,
        customerAddress: selectedCustomer.address,
        totalAmount,
        initialPayment: initialPayment || 0,
        dueDate,
        notes: carteraNotes,
        paymentMethod: initialPaymentMethod,
      });

      showToast('Cuenta de cartera creada exitosamente', 'success');
      setShowNewModal(false);
      setSelectedCustomer(null);
      setTotalAmount(0);
      setInitialPayment(0);
      setCarteraNotes('');

      if (createdAbono) {
        setReceiptAbono(createdAbono);
        setReceiptTotal(totalAmount);
        setReceiptRemaining(Math.max(0, totalAmount - initialPayment));
        setShowReceiptModal(true);
      }
    } catch (err: any) {
      showToast(err.message || 'Error al crear la cuenta de cartera', 'error');
    }
  };

  const handleRegisterAbonoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCarteraForAbono) return;

    const validation = validateAbonoAmount(abonoAmount, selectedCarteraForAbono.balanceDue);
    if (!validation.isValid) {
      showToast(validation.error || 'Valor de abono inválido', 'error');
      return;
    }

    try {
      const newAbono = await registerCarteraAbono({
        carteraId: selectedCarteraForAbono.id,
        amount: abonoAmount,
        paymentMethod: abonoMethod,
        notes: abonoNotes,
      });

      showToast('Abono a cartera registrado correctamente en caja', 'success');
      setShowAbonoModal(false);

      // Mostrar comprobante térmico
      setReceiptAbono(newAbono);
      setReceiptTotal(selectedCarteraForAbono.totalAmount);
      setReceiptRemaining(Math.max(0, selectedCarteraForAbono.balanceDue - abonoAmount));
      setShowReceiptModal(true);

      setSelectedCarteraForAbono(null);
      setAbonoAmount(0);
      setAbonoNotes('');
    } catch (err: any) {
      showToast(err.message || 'Error al registrar abono a cartera', 'error');
    }
  };

  const handleVoidAbonoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAbonoForVoid) return;
    if (voidReason.trim().length < 5) {
      showToast('Escriba el motivo de anulación del comprobante', 'error');
      return;
    }
    try {
      await voidAbono(selectedAbonoForVoid.id, voidReason);
      showToast(`Comprobante #${selectedAbonoForVoid.receiptNumber} anulado y saldo de cartera recalculado`, 'success');
      setShowVoidAbonoModal(false);
      setSelectedAbonoForVoid(null);
      setVoidReason('');
    } catch (err: any) {
      showToast(err.message || 'Error al anular abono', 'error');
    }
  };

  const openWhatsApp = (phone: string, customerName: string, crdCode: string, balance: number, due: string) => {
    const clean = phone.replace(/[^0-9]/g, '');
    const msg = `Hola ${customerName} 👋 Te saludamos de Sistema Colmena Restaurante. Te recordamos tu cuenta de crédito #${crdCode} con saldo pendiente de ${formatCOP(balance)} con fecha límite ${due}. ¿Deseas realizar un abono o necesitas información de nuestras cuentas de transferencia?`;
    window.open(`https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Métricas de Cartera */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#a8a29e] tracking-wider">
            Total Cartera por Cobrar
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-amber-400">{formatCOP(totalBalanceDue)}</span>
            <span className="text-xs text-[#a8a29e]">({pendingCartera.length} cuentas)</span>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#a8a29e] tracking-wider">
            Cartera Vencida
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-red-400">{formatCOP(totalOverdue)}</span>
            <span className="text-xs text-red-400 font-bold">atención</span>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#a8a29e] tracking-wider">
            Total Recaudado en Abonos
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-emerald-400">{formatCOP(totalRecaudado)}</span>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#a8a29e] tracking-wider">
            Cuentas Pagadas
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-[#FFFDF5]">{fullyPaidCount}</span>
            <span className="text-xs text-[#a8a29e]">al día</span>
          </div>
        </div>
      </div>

      {/* 2. Barra de Control y Búsqueda */}
      <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Filtros de Estado */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {(['pendientes', 'vencidas', 'todas', 'pagadas'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === key
                  ? 'bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] shadow-md'
                  : 'bg-[#242424] text-[#d6d3d1] hover:bg-[#2d2d2d]'
              }`}
            >
              {key === 'pendientes' ? 'Con Saldo Pendiente' : key === 'vencidas' ? 'Cartera Vencida' : key}
            </button>
          ))}
        </div>

        {/* Búsqueda y Botón Nueva Cartera */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#a8a29e]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar crédito, cliente, NIT o cédula..."
              className="w-full bg-[#121214] border border-[#333333] rounded-xl pl-9 pr-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] text-xs font-black inline-flex items-center gap-1.5 hover:brightness-110 shadow-lg cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Venta a Crédito</span>
          </button>
        </div>
      </div>

      {/* 3. Tabla / Cards de Cartera */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCartera.length > 0 ? (
          filteredCartera.map((crd) => {
            const isPaid = crd.status === 'pagada' || crd.balanceDue <= 0;
            const isOverdue = !isPaid && isCarteraOverdue(crd.dueDate);
            const percentPaid = Math.min(100, Math.round((crd.totalAbonado / (crd.totalAmount || 1)) * 100));
            const crdAbonosList = abonos.filter((a) => a.parentId === crd.id);

            return (
              <div
                key={crd.id}
                className={`bg-[#181818] border rounded-3xl p-5 flex flex-col justify-between shadow-md transition-all ${
                  isOverdue
                    ? 'border-red-900/60 hover:border-red-500'
                    : isPaid
                    ? 'border-emerald-900/40 hover:border-emerald-600'
                    : 'border-[#2d281e] hover:border-[#B77900]/50'
                }`}
              >
                <div>
                  {/* Encabezado Card */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-[#D6A21A] tracking-wider">
                          {crd.code}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isPaid
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : isOverdue
                              ? 'bg-red-950 text-red-300 border border-red-800 animate-pulse'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {isPaid ? 'Pagada' : isOverdue ? 'Vencida' : 'Vigente'}
                        </span>
                      </div>
                      <h4 className="font-black text-[#FFFDF5] text-sm mt-1 leading-snug">
                        {crd.customerName}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-[#a8a29e] mt-0.5">
                        <span>Doc: {crd.customerDocument}</span>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={() => openWhatsApp(crd.customerPhone, crd.customerName, crd.code, crd.balanceDue, crd.dueDate)}
                          className="hover:text-emerald-400 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <MessageCircle className="w-3 h-3 text-emerald-500" />
                          <span>{crd.customerPhone}</span>
                        </button>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-neutral-400 block">Venta Origen</span>
                      <span className="text-xs font-mono font-bold text-[#FFFDF5]">
                        #{crd.orderNumber || crd.saleId}
                      </span>
                    </div>
                  </div>

                  {/* Resumen Financiero */}
                  <div className="p-3.5 bg-[#121214] rounded-2xl border border-[#242424] mb-3 space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-[#a8a29e]">Valor Venta:</span>
                      <span className="font-mono font-bold text-[#FFFDF5]">{formatCOP(crd.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="text-[#a8a29e]">Total Abonado:</span>
                      <span className="font-mono text-emerald-400 font-bold">{formatCOP(crd.totalAbonado)}</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-1.5 border-t border-[#242424]">
                      <span className="text-xs font-bold text-amber-400">Saldo Pendiente:</span>
                      <span className="font-mono font-black text-base text-amber-400">
                        {formatCOP(crd.balanceDue)}
                      </span>
                    </div>
                  </div>

                  {/* Barra de Progreso */}
                  <div className="space-y-1 mb-3">
                    <div className="w-full bg-[#242424] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-[#B77900] to-emerald-400 h-full rounded-full transition-all"
                        style={{ width: `${percentPaid}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#a8a29e]">
                      <span>{percentPaid}% cubierto</span>
                      <span>Fecha Límite: <strong className={isOverdue ? 'text-red-400 font-bold' : 'text-[#FFFDF5]'}>{crd.dueDate}</strong></span>
                    </div>
                  </div>

                  {crd.notes && (
                    <p className="text-[11px] text-[#a8a29e] italic mb-3">
                      "{crd.notes}"
                    </p>
                  )}
                </div>

                {/* Acciones */}
                <div className="pt-3 border-t border-[#2d281e] grid grid-cols-2 gap-2">
                  {!isPaid && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCarteraForAbono(crd);
                        setAbonoAmount(crd.balanceDue);
                        setShowAbonoModal(true);
                      }}
                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center justify-center gap-1 hover:brightness-110 shadow cursor-pointer"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Registrar Abono</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCarteraForHistory(crd);
                      setShowHistoryModal(true);
                    }}
                    className={`px-3 py-2 rounded-xl bg-[#242424] hover:bg-[#2d2d2d] text-[#FFFDF5] font-bold text-xs inline-flex items-center justify-center gap-1 border border-[#383838] cursor-pointer ${
                      isPaid ? 'col-span-2' : ''
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5 text-[#D6A21A]" />
                    <span>Abonos ({crdAbonosList.length})</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-[#181818] border border-[#2d281e] rounded-3xl p-12 text-center text-[#a8a29e]">
            <CreditCard className="w-12 h-12 mx-auto text-[#B77900] mb-3 opacity-60" />
            <p className="text-base font-bold text-[#FFFDF5]">No hay cuentas de cartera en esta vista</p>
            <p className="text-xs text-[#a8a29e] mt-1">
              Las ventas a crédito y con saldo pendiente se sincronizan automáticamente aquí.
            </p>
          </div>
        )}
      </div>

      {/* 4. MODAL: NUEVA CUENTA DE CARTERA */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative bg-[#181818] border border-[#B77900]/40 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden my-6">
            <div className="p-5 border-b border-[#333333] flex items-center justify-between bg-gradient-to-r from-[#181818] to-[#242424]">
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-6 h-6 text-[#D6A21A]" />
                <div>
                  <h3 className="text-base font-black text-[#FFFDF5]">
                    Registrar Cuenta por Cobrar / Cartera
                  </h3>
                  <p className="text-xs text-[#a8a29e]">
                    Ventas a crédito institucional y cuentas por cobrar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="p-1.5 text-[#a8a29e] hover:text-[#FFFDF5] rounded-xl hover:bg-[#2d2d2d]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCarteraSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              {/* Selector de Cliente con Creación Inline */}
              <CustomerSelectInput
                selectedCustomer={selectedCustomer}
                onSelectCustomer={setSelectedCustomer}
                label="Cliente Deudor"
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                    Valor Total del Crédito (COP) <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                    placeholder="350000"
                    required
                    className="w-full bg-[#121214] border border-[#333333] rounded-xl p-3 text-sm font-mono text-[#FFFDF5] font-black focus:outline-none focus:border-[#B77900]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                    No. Venta / Consecutivo
                  </label>
                  <input
                    type="number"
                    value={saleOrderNumber}
                    onChange={(e) => setSaleOrderNumber(parseInt(e.target.value) || 101)}
                    className="w-full bg-[#121214] border border-[#333333] rounded-xl p-3 text-sm font-mono text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
                  />
                </div>
              </div>

              {/* Cuota Inicial */}
              <div className="p-4 bg-[#121214] rounded-2xl border border-[#2d281e] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                      Pago Inicial / Cuota Inicial
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={totalAmount}
                      value={initialPayment}
                      onChange={(e) => setInitialPayment(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-[#181818] border border-[#333333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] font-mono focus:outline-none focus:border-[#B77900]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                      Medio de Pago Cuota Inicial
                    </label>
                    <select
                      value={initialPaymentMethod}
                      onChange={(e) => setInitialPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full bg-[#181818] border border-[#333333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
                    >
                      <option value="efectivo">Efectivo en Caja</option>
                      <option value="transferencia">Transferencia Bancaria</option>
                      <option value="nequi_daviplata">Nequi / Daviplata</option>
                      <option value="tarjeta">Datáfono / Tarjeta</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-between items-baseline pt-1 border-t border-[#242424] text-xs">
                  <span className="text-[#a8a29e]">Saldo Inicial de Cartera:</span>
                  <span className="font-mono font-black text-amber-400 text-sm">
                    {formatCOP(Math.max(0, totalAmount - initialPayment))}
                  </span>
                </div>
              </div>

              {/* Fecha Límite */}
              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                  Fecha Límite de Pago <span className="text-amber-500">*</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="w-full bg-[#121214] border border-[#333333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
                />
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                  Concepto / Observaciones
                </label>
                <textarea
                  rows={2}
                  value={carteraNotes}
                  onChange={(e) => setCarteraNotes(e.target.value)}
                  placeholder="Ej: Factura de evento corporativo crédito 30 días..."
                  className="w-full bg-[#121214] border border-[#333333] rounded-xl p-3 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900] resize-none"
                />
              </div>

              <div className="pt-4 border-t border-[#333333] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#444444] text-[#d6d3d1] text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || totalAmount <= 0 || !selectedCustomer}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center gap-1.5 hover:brightness-110 shadow-lg cursor-pointer disabled:opacity-50"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Crear Registro de Cartera</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: REGISTRAR ABONO A CARTERA */}
      {showAbonoModal && selectedCarteraForAbono && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-[#181818] border border-[#B77900]/40 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-[#333333] flex items-center justify-between bg-gradient-to-r from-[#181818] to-[#242424]">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#D6A21A]" />
                <h3 className="text-sm font-black text-[#FFFDF5]">
                  Registrar Abono a Cartera #{selectedCarteraForAbono.code}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAbonoModal(false)}
                className="p-1 text-[#a8a29e] hover:text-[#FFFDF5]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterAbonoSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-[#121214] rounded-2xl border border-[#2d281e] space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[#a8a29e]">Cliente:</span>
                  <span className="font-bold text-[#FFFDF5]">{selectedCarteraForAbono.customerName}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#a8a29e]">Total Deuda:</span>
                  <span className="font-mono text-[#d6d3d1]">{formatCOP(selectedCarteraForAbono.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-amber-400 pt-1 border-t border-[#242424]">
                  <span>Saldo Pendiente Actual:</span>
                  <span className="font-mono text-sm">{formatCOP(selectedCarteraForAbono.balanceDue)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5">
                  Valor a Abonar (COP) <span className="text-amber-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedCarteraForAbono.balanceDue}
                  value={abonoAmount}
                  onChange={(e) => setAbonoAmount(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full bg-[#121214] border border-[#333333] rounded-xl p-3 text-sm font-mono text-[#FFFDF5] font-black focus:outline-none focus:border-[#B77900]"
                />
                <p className="text-[10px] text-[#a8a29e] mt-1">
                  Nuevo saldo tras este abono: <strong className="text-emerald-400 font-mono">{formatCOP(Math.max(0, selectedCarteraForAbono.balanceDue - abonoAmount))}</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5">
                  Medio de Pago <span className="text-amber-500">*</span>
                </label>
                <select
                  value={abonoMethod}
                  onChange={(e) => setAbonoMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-[#121214] border border-[#333333] rounded-xl px-3 py-2.5 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
                >
                  <option value="efectivo">Efectivo en Caja</option>
                  <option value="tarjeta">Datáfono / Tarjeta</option>
                  <option value="nequi_daviplata">Nequi / Daviplata</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5">
                  Concepto / Observaciones
                </label>
                <input
                  type="text"
                  value={abonoNotes}
                  onChange={(e) => setAbonoNotes(e.target.value)}
                  placeholder="Ej: Pago de factura por transferencia Bancolombia..."
                  className="w-full bg-[#121214] border border-[#333333] rounded-xl px-3.5 py-2.5 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
                />
              </div>

              <div className="pt-3 border-t border-[#333333] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAbonoModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#444444] text-[#d6d3d1] text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || abonoAmount <= 0}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center gap-1.5 hover:brightness-110 shadow-lg"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Guardar e Imprimir</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: HISTORIAL DE ABONOS DE CARTERA */}
      {showHistoryModal && selectedCarteraForHistory && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-[#181818] border border-[#B77900]/40 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-[#333333] flex items-center justify-between bg-gradient-to-r from-[#181818] to-[#242424]">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#D6A21A]" />
                <div>
                  <h3 className="text-sm font-black text-[#FFFDF5]">
                    Historial de Abonos — Cartera #{selectedCarteraForHistory.code}
                  </h3>
                  <p className="text-xs text-[#a8a29e]">{selectedCarteraForHistory.customerName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1 text-[#a8a29e] hover:text-[#FFFDF5]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {abonos.filter((a) => a.parentId === selectedCarteraForHistory.id).length > 0 ? (
                abonos
                  .filter((a) => a.parentId === selectedCarteraForHistory.id)
                  .map((ab) => {
                    const isVoided = ab.status === 'anulado';
                    return (
                      <div
                        key={ab.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isVoided
                            ? 'bg-red-950/20 border-red-900/50 opacity-60'
                            : 'bg-[#121214] border-[#2d281e]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-[#D6A21A]">
                                {ab.receiptNumber}
                              </span>
                              <span
                                className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                  isVoided
                                    ? 'bg-red-900 text-red-200'
                                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                }`}
                              >
                                {ab.status}
                              </span>
                              <span className="text-[10px] text-[#a8a29e] capitalize">
                                {ab.paymentMethod}
                              </span>
                            </div>
                            <span className="text-base font-black font-mono text-[#FFFDF5] block mt-1">
                              {formatCOP(ab.amount)}
                            </span>
                            <p className="text-[10px] text-[#a8a29e] mt-0.5">
                              {formatColombiaDateTime(ab.createdAt)} · Atendido por {ab.userName}
                            </p>
                            {ab.notes && (
                              <p className="text-[11px] text-[#d6d3d1] italic mt-1 bg-[#181818] p-1.5 rounded">
                                {ab.notes}
                              </p>
                            )}
                            {isVoided && ab.voidReason && (
                              <div className="mt-1 text-[10px] text-red-300 bg-red-950/60 p-1.5 rounded border border-red-800">
                                <strong>Motivo Anulación:</strong> {ab.voidReason} ({ab.voidedBy})
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setReceiptAbono(ab);
                                setReceiptTotal(selectedCarteraForHistory.totalAmount);
                                setReceiptRemaining(selectedCarteraForHistory.balanceDue);
                                setShowReceiptModal(true);
                              }}
                              className="p-1.5 rounded-lg bg-[#242424] text-[#D6A21A] hover:bg-[#B77900] hover:text-[#181818] transition-colors cursor-pointer"
                              title="Reimprimir Comprobante Térmico"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            {!isVoided && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAbonoForVoid(ab);
                                  setShowVoidAbonoModal(true);
                                }}
                                className="p-1.5 rounded-lg bg-red-950 text-red-400 hover:bg-red-900 hover:text-white transition-colors cursor-pointer"
                                title="Anular registro de abono"
                              >
                                <ShieldAlert className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="text-center py-8 text-[#a8a29e]">
                  <Receipt className="w-8 h-8 mx-auto text-[#B77900] mb-2 opacity-50" />
                  <p className="text-xs">No hay abonos registrados en esta cuenta</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#333333] flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl bg-[#242424] text-[#d6d3d1] text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: ANULAR REGISTRO DE ABONO */}
      {showVoidAbonoModal && selectedAbonoForVoid && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-[#181818] border border-red-500/50 rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-950 border border-red-700 flex items-center justify-center text-red-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#FFFDF5]">
                  Anular Registro de Abono #{selectedAbonoForVoid.receiptNumber}
                </h3>
                <p className="text-xs text-red-400">
                  Valor a revertir: {formatCOP(selectedAbonoForVoid.amount)}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#d6d3d1] leading-relaxed">
              Esta acción marcará el abono como <strong>ANULADO</strong>, restaurará el saldo pendiente de la cartera del cliente y generará el egreso correspondiente en caja sin alterar la venta original.
            </p>

            <form onSubmit={handleVoidAbonoSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                  Motivo de Anulación <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={2}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Ej: Error en valor consignado, duplicación de recibo..."
                  required
                  className="w-full bg-[#121214] border border-[#333333] rounded-xl p-3 text-xs text-[#FFFDF5] focus:outline-none focus:border-red-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVoidAbonoModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#444444] text-[#d6d3d1] text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || voidReason.trim().length < 5}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow"
                >
                  Confirmar Anulación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL: IMPRESIÓN COMPROBANTE TÉRMICO */}
      <AbonoReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        abono={receiptAbono}
        parentTotalAmount={receiptTotal}
        remainingBalance={receiptRemaining}
        branch={currentBranch}
      />
    </div>
  );
};
