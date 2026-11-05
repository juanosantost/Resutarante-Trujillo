import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import {
  Separado,
  SeparadoItem,
  Abono,
  Customer,
  PaymentMethod,
} from '../../types';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { validateAbonoAmount } from '../../utils/creditAndLayawayUtils';
import { CustomerSelectInput } from '../common/CustomerSelectInput';
import { AbonoReceiptModal } from '../modals/AbonoReceiptModal';
import {
  BookmarkCheck,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  DollarSign,
  Receipt,
  Flame,
  CheckCircle,
  XCircle,
  Printer,
  ChevronDown,
  Trash2,
  Edit2,
  AlertTriangle,
  MessageCircle,
  Layers,
  ArrowRight,
  ShieldAlert,
  X,
} from 'lucide-react';

export const SeparadosView: React.FC = () => {
  const {
    separados,
    abonos,
    menuItems,
    currentBranch,
    createSeparado,
    registerSeparadoAbono,
    sendSeparadoToKitchen,
    finalizeSeparado,
    cancelSeparado,
    editAbono,
    voidAbono,
    actionLoading,
  } = useRestaurant();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'activos' | 'completados' | 'cancelados'>('activos');

  // Modal Nuevo Separado
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cartItems, setCartItems] = useState<SeparadoItem[]>([]);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemNotes, setItemNotes] = useState<string>('');
  const [initialDeposit, setInitialDeposit] = useState<number>(0);
  const [depositPaymentMethod, setDepositPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [deliveryDate, setDeliveryDate] = useState<string>(
    new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]
  );
  const [deliveryTime, setDeliveryTime] = useState<string>('13:00');
  const [reserveInventory, setReserveInventory] = useState<boolean>(true);
  const [separadoNotes, setSeparadoNotes] = useState<string>('');

  // Modal Registrar Abono
  const [showAbonoModal, setShowAbonoModal] = useState<boolean>(false);
  const [selectedSeparadoForAbono, setSelectedSeparadoForAbono] = useState<Separado | null>(null);
  const [abonoAmount, setAbonoAmount] = useState<number>(0);
  const [abonoMethod, setAbonoMethod] = useState<PaymentMethod>('efectivo');
  const [abonoNotes, setAbonoNotes] = useState<string>('');

  // Modal Historial de Abonos
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [selectedSeparadoForHistory, setSelectedSeparadoForHistory] = useState<Separado | null>(null);

  // Modal Cancelar Separado
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [selectedSeparadoForCancel, setSelectedSeparadoForCancel] = useState<Separado | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [refundAmount, setRefundAmount] = useState<number>(0);

  // Modal Anular Abono
  const [showVoidAbonoModal, setShowVoidAbonoModal] = useState<boolean>(false);
  const [selectedAbonoForVoid, setSelectedAbonoForVoid] = useState<Abono | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');

  // Modal Imprimir Comprobante de Abono
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [receiptAbono, setReceiptAbono] = useState<Abono | null>(null);
  const [receiptTotal, setReceiptTotal] = useState<number | undefined>(undefined);
  const [receiptRemaining, setReceiptRemaining] = useState<number | undefined>(undefined);

  // Cálculo de totales del carrito nuevo
  const cartSubtotal = cartItems.reduce((acc, it) => acc + it.totalPrice, 0);

  // Métricas
  const activeSeparados = separados.filter((s) => s.status === 'activo');
  const totalPendingBalance = activeSeparados.reduce((acc, s) => acc + (s.pendingBalance || 0), 0);
  const totalRecaudado = separados.reduce((acc, s) => acc + (s.totalAbonado || 0), 0);
  const completedSeparados = separados.filter((s) => s.status === 'completado').length;

  // Filtrado
  const filteredSeparados = separados.filter((s) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      s.code.toLowerCase().includes(term) ||
      s.customerName.toLowerCase().includes(term) ||
      s.customerPhone.includes(term) ||
      s.customerDocument.includes(term);

    if (!matchesSearch) return false;
    if (statusFilter === 'activos') return s.status === 'activo';
    if (statusFilter === 'completados') return s.status === 'completado';
    if (statusFilter === 'cancelados') return s.status === 'cancelado';
    return true;
  });

  const handleAddItemToCart = () => {
    if (!selectedMenuItemId) return;
    const mi = menuItems.find((m) => m.id === selectedMenuItemId);
    if (!mi) return;

    const newItem: SeparadoItem = {
      id: `item-${Date.now()}`,
      menuItemId: mi.id,
      name: mi.name,
      quantity: Math.max(1, itemQuantity),
      unitPrice: mi.price,
      totalPrice: mi.price * Math.max(1, itemQuantity),
      notes: itemNotes.trim() || undefined,
      recipe: mi.recipe || [],
    };

    setCartItems([...cartItems, newItem]);
    setSelectedMenuItemId('');
    setItemQuantity(1);
    setItemNotes('');
  };

  const handleRemoveCartItem = (index: number) => {
    setCartItems(cartItems.filter((_, idx) => idx !== index));
  };

  const handleCreateSeparadoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      showToast('Debe seleccionar o registrar un cliente', 'error');
      return;
    }
    if (cartItems.length === 0) {
      showToast('Agregue al menos un producto a la reserva del separado', 'error');
      return;
    }
    if (initialDeposit > cartSubtotal) {
      showToast('El anticipo no puede ser mayor al valor total del pedido', 'error');
      return;
    }

    try {
      const { separadoId, receiptAbono: createdAbono } = await createSeparado({
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerPhone: selectedCustomer.phone,
        customerDocument: selectedCustomer.documentNumber,
        customerAddress: selectedCustomer.address,
        items: cartItems,
        initialDeposit: initialDeposit || 0,
        deliveryDate,
        deliveryTime,
        reserveInventory,
        notes: separadoNotes,
        paymentMethod: depositPaymentMethod,
      });

      showToast('Separado creado exitosamente', 'success');
      setShowNewModal(false);
      setCartItems([]);
      setSelectedCustomer(null);
      setInitialDeposit(0);
      setSeparadoNotes('');

      if (createdAbono) {
        setReceiptAbono(createdAbono);
        setReceiptTotal(cartSubtotal);
        setReceiptRemaining(Math.max(0, cartSubtotal - initialDeposit));
        setShowReceiptModal(true);
      }
    } catch (err: any) {
      showToast(err.message || 'Error al crear el separado', 'error');
    }
  };

  const handleRegisterAbonoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeparadoForAbono) return;

    const validation = validateAbonoAmount(abonoAmount, selectedSeparadoForAbono.pendingBalance);
    if (!validation.isValid) {
      showToast(validation.error || 'Valor de abono inválido', 'error');
      return;
    }

    try {
      const newAbono = await registerSeparadoAbono({
        separadoId: selectedSeparadoForAbono.id,
        amount: abonoAmount,
        paymentMethod: abonoMethod,
        notes: abonoNotes,
      });

      showToast('Abono registrado correctamente en caja', 'success');
      setShowAbonoModal(false);

      // Abrir modal de comprobante de impresión
      setReceiptAbono(newAbono);
      setReceiptTotal(selectedSeparadoForAbono.totalAmount);
      setReceiptRemaining(Math.max(0, selectedSeparadoForAbono.pendingBalance - abonoAmount));
      setShowReceiptModal(true);

      setSelectedSeparadoForAbono(null);
      setAbonoAmount(0);
      setAbonoNotes('');
    } catch (err: any) {
      showToast(err.message || 'Error al registrar el abono', 'error');
    }
  };

  const handleSendToKitchen = async (sep: Separado) => {
    if (confirm(`¿Enviar el pedido de Separado #${sep.code} a cocina (KDS) para preparación?`)) {
      try {
        await sendSeparadoToKitchen(sep.id);
        showToast(`Separado #${sep.code} enviado a comanda de cocina`, 'success');
      } catch (err: any) {
        showToast(err.message || 'Error al enviar a cocina', 'error');
      }
    }
  };

  const handleFinalize = async (sep: Separado) => {
    if (sep.pendingBalance > 0) {
      showToast(`No se puede finalizar. Pendiente por cobrar: ${formatCOP(sep.pendingBalance)}`, 'error');
      return;
    }
    if (confirm(`¿Confirmar entrega y finalización del Separado #${sep.code} para ${sep.customerName}? Se descontarán los ingredientes del inventario.`)) {
      try {
        await finalizeSeparado(sep.id);
        showToast(`Separado #${sep.code} completado y entregado`, 'success');
      } catch (err: any) {
        showToast(err.message || 'Error al finalizar', 'error');
      }
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeparadoForCancel) return;
    if (cancelReason.trim().length < 5) {
      showToast('Escriba un motivo de cancelación detallado', 'error');
      return;
    }
    try {
      await cancelSeparado(selectedSeparadoForCancel.id, cancelReason, refundAmount);
      showToast(`Separado #${selectedSeparadoForCancel.code} cancelado`, 'info');
      setShowCancelModal(false);
      setSelectedSeparadoForCancel(null);
      setCancelReason('');
      setRefundAmount(0);
    } catch (err: any) {
      showToast(err.message || 'Error al cancelar', 'error');
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
      showToast(`Comprobante #${selectedAbonoForVoid.receiptNumber} anulado y saldo restablecido`, 'success');
      setShowVoidAbonoModal(false);
      setSelectedAbonoForVoid(null);
      setVoidReason('');
    } catch (err: any) {
      showToast(err.message || 'Error al anular abono', 'error');
    }
  };

  const openWhatsApp = (phone: string, customerName: string, sepCode: string, balance: number) => {
    const clean = phone.replace(/[^0-9]/g, '');
    const msg = `Hola ${customerName} 👋 Te saludamos de Sistema Colmena Restaurante. Te escribimos respecto a tu separado #${sepCode}. Saldo pendiente: ${formatCOP(balance)}. ¿Deseas coordinar tu entrega o realizar un abono?`;
    window.open(`https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Métricas Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#a8a29e] tracking-wider">
            Separados Activos
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-[#D6A21A]">{activeSeparados.length}</span>
            <span className="text-xs text-[#a8a29e]">en proceso</span>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#a8a29e] tracking-wider">
            Saldo Pendiente por Cobrar
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-amber-400">{formatCOP(totalPendingBalance)}</span>
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
            Separados Entregados
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-[#FFFDF5]">{completedSeparados}</span>
            <span className="text-xs text-[#a8a29e]">finalizados</span>
          </div>
        </div>
      </div>

      {/* 2. Barra de Control y Búsqueda */}
      <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Filtros de Estado */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {(['activos', 'todos', 'completados', 'cancelados'] as const).map((filterKey) => (
            <button
              key={filterKey}
              type="button"
              onClick={() => setStatusFilter(filterKey)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === filterKey
                  ? 'bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] shadow-md'
                  : 'bg-[#242424] text-[#d6d3d1] hover:bg-[#2d2d2d]'
              }`}
            >
              {filterKey === 'activos' ? 'Activos / Con Saldo' : filterKey}
            </button>
          ))}
        </div>

        {/* Búsqueda y Botón Nuevo Separado */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#a8a29e]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar separado o cliente..."
              className="w-full bg-[#121214] border border-[#333333] rounded-xl pl-9 pr-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] text-xs font-black inline-flex items-center gap-1.5 hover:brightness-110 shadow-lg cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Separado</span>
          </button>
        </div>
      </div>

      {/* 3. Listado de Separados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSeparados.length > 0 ? (
          filteredSeparados.map((sep) => {
            const isCompleted = sep.status === 'completado';
            const isCancelled = sep.status === 'cancelado';
            const percentPaid = Math.min(100, Math.round((sep.totalAbonado / (sep.totalAmount || 1)) * 100));
            const sepAbonosList = abonos.filter((a) => a.parentId === sep.id);

            return (
              <div
                key={sep.id}
                className="bg-[#181818] border border-[#2d281e] hover:border-[#B77900]/50 rounded-3xl p-5 flex flex-col justify-between shadow-md transition-all group"
              >
                <div>
                  {/* Encabezado Card */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-[#D6A21A] tracking-wider">
                          {sep.code}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isCompleted
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : isCancelled
                              ? 'bg-red-950 text-red-300 border border-red-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {sep.status}
                        </span>
                      </div>
                      <h4 className="font-black text-[#FFFDF5] text-sm mt-1 leading-snug">
                        {sep.customerName}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-[#a8a29e] mt-0.5">
                        <span>Doc: {sep.customerDocument}</span>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={() => openWhatsApp(sep.customerPhone, sep.customerName, sep.code, sep.pendingBalance)}
                          className="hover:text-emerald-400 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <MessageCircle className="w-3 h-3 text-emerald-500" />
                          <span>{sep.customerPhone}</span>
                        </button>
                      </div>
                    </div>

                    {/* Badge de Cocina */}
                    {sep.sentToKitchen && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-red-950/80 text-red-300 border border-red-800/60 inline-flex items-center gap-1">
                        <Flame className="w-3 h-3 text-red-400" />
                        <span>En Cocina</span>
                      </span>
                    )}
                  </div>

                  {/* Detalle de Artículos */}
                  <div className="bg-[#121214] p-3 rounded-2xl border border-[#242424] mb-3 space-y-1">
                    <span className="text-[10px] font-bold text-[#a8a29e] uppercase block mb-1">
                      Productos Reservados ({sep.items.length})
                    </span>
                    {sep.items.slice(0, 3).map((it, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-[#d6d3d1]">
                        <span className="truncate pr-2">
                          <strong className="text-[#D6A21A]">{it.quantity}x</strong> {it.name}
                        </span>
                        <span className="font-mono text-neutral-400 flex-shrink-0">
                          {formatCOP(it.totalPrice)}
                        </span>
                      </div>
                    ))}
                    {sep.items.length > 3 && (
                      <span className="text-[10px] text-neutral-500 italic block pt-0.5">
                        + {sep.items.length - 3} artículos más...
                      </span>
                    )}
                  </div>

                  {/* Barra de Progreso Financiero */}
                  <div className="space-y-1.5 mb-3">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-[#a8a29e]">Abonado: <strong className="text-emerald-400">{formatCOP(sep.totalAbonado)}</strong></span>
                      <span className="text-[#a8a29e]">Saldo: <strong className={sep.pendingBalance > 0 ? 'text-amber-400' : 'text-neutral-400'}>{formatCOP(sep.pendingBalance)}</strong></span>
                    </div>
                    <div className="w-full bg-[#242424] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-[#B77900] to-emerald-400 h-full rounded-full transition-all"
                        style={{ width: `${percentPaid}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#a8a29e]">
                      <span>Total: {formatCOP(sep.totalAmount)}</span>
                      <span>{percentPaid}% cubierto</span>
                    </div>
                  </div>

                  {/* Fecha de Entrega */}
                  <div className="flex items-center gap-2 text-xs text-[#a8a29e] mb-3">
                    <Calendar className="w-3.5 h-3.5 text-[#D6A21A]" />
                    <span>Entrega: <strong className="text-[#FFFDF5]">{sep.deliveryDate}</strong> {sep.deliveryTime && `(${sep.deliveryTime})`}</span>
                  </div>
                </div>

                {/* Acciones del Separado */}
                <div className="pt-3 border-t border-[#2d281e] space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Botón Abonar */}
                    {!isCompleted && !isCancelled && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSeparadoForAbono(sep);
                          setAbonoAmount(sep.pendingBalance);
                          setShowAbonoModal(true);
                        }}
                        className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center justify-center gap-1 hover:brightness-110 shadow cursor-pointer"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Abonar</span>
                      </button>
                    )}

                    {/* Botón Historial de Abonos */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSeparadoForHistory(sep);
                        setShowHistoryModal(true);
                      }}
                      className={`px-3 py-2 rounded-xl bg-[#242424] hover:bg-[#2d2d2d] text-[#FFFDF5] font-bold text-xs inline-flex items-center justify-center gap-1 border border-[#383838] cursor-pointer ${
                        isCompleted || isCancelled ? 'col-span-2' : ''
                      }`}
                    >
                      <Receipt className="w-3.5 h-3.5 text-[#D6A21A]" />
                      <span>Abonos ({sepAbonosList.length})</span>
                    </button>
                  </div>

                  {/* Acciones Secundarias Operativas */}
                  {!isCompleted && !isCancelled && (
                    <div className="flex items-center justify-between gap-1 pt-1">
                      {/* Enviar a Cocina */}
                      {!sep.sentToKitchen ? (
                        <button
                          type="button"
                          onClick={() => handleSendToKitchen(sep)}
                          className="text-[11px] text-amber-400 hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Flame className="w-3 h-3" />
                          <span>Enviar a Cocina</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-neutral-400 inline-flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                          Comanda activa
                        </span>
                      )}

                      {/* Finalizar o Cancelar */}
                      <div className="flex items-center gap-2">
                        {sep.pendingBalance <= 0 ? (
                          <button
                            type="button"
                            onClick={() => handleFinalize(sep)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold inline-flex items-center gap-1 hover:bg-emerald-500 cursor-pointer"
                          >
                            <CheckCircle className="w-3 h-3" />
                            <span>Entregar</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSeparadoForCancel(sep);
                              setRefundAmount(sep.totalAbonado);
                              setShowCancelModal(true);
                            }}
                            className="text-[11px] text-red-400 hover:underline font-medium cursor-pointer"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-[#181818] border border-[#2d281e] rounded-3xl p-12 text-center text-[#a8a29e]">
            <BookmarkCheck className="w-12 h-12 mx-auto text-[#B77900] mb-3 opacity-60" />
            <p className="text-base font-bold text-[#FFFDF5]">No se encontraron separados</p>
            <p className="text-xs text-[#a8a29e] mt-1">
              Crea un nuevo separado para reservas programadas o pedidos especiales de eventos.
            </p>
          </div>
        )}
      </div>

      {/* 4. MODAL: NUEVO SEPARADO */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative bg-[#181818] border border-[#B77900]/40 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-6">
            <div className="p-5 border-b border-[#333333] flex items-center justify-between bg-gradient-to-r from-[#181818] to-[#242424]">
              <div className="flex items-center gap-2.5">
                <BookmarkCheck className="w-6 h-6 text-[#D6A21A]" />
                <div>
                  <h3 className="text-base font-black text-[#FFFDF5]">
                    Crear Separado / Pedido Programado
                  </h3>
                  <p className="text-xs text-[#a8a29e]">
                    Reserva comercial, anticipos y programación de entrega
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

            <form onSubmit={handleCreateSeparadoSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              {/* Selector de Cliente con Creación Inline */}
              <CustomerSelectInput
                selectedCustomer={selectedCustomer}
                onSelectCustomer={setSelectedCustomer}
                label="Cliente para la Reserva / Separado"
                required
              />

              {/* Agregar Productos al Separado */}
              <div className="p-4 bg-[#121214] rounded-2xl border border-[#2d281e] space-y-3">
                <span className="text-xs font-bold text-[#FFFDF5] block">
                  Agregar Productos al Separado
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-7">
                    <select
                      value={selectedMenuItemId}
                      onChange={(e) => setSelectedMenuItemId(e.target.value)}
                      className="w-full bg-[#181818] border border-[#333333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
                    >
                      <option value="">Seleccione un producto...</option>
                      {menuItems.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} — {formatCOP(m.price)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      min={1}
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                      className="w-full bg-[#181818] border border-[#333333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] text-center"
                      placeholder="Cant."
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <button
                      type="button"
                      onClick={handleAddItemToCart}
                      disabled={!selectedMenuItemId}
                      className="w-full h-full px-3 py-2 rounded-xl bg-[#292212] border border-[#B77900]/40 text-[#D6A21A] hover:bg-[#B77900] hover:text-[#181818] font-bold text-xs transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      + Agregar
                    </button>
                  </div>
                </div>

                {/* Lista de Productos en el Carrito */}
                {cartItems.length > 0 && (
                  <div className="mt-3 border-t border-[#242424] pt-2 space-y-1.5">
                    {cartItems.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-xl bg-[#181818] border border-[#242424] text-xs"
                      >
                        <div>
                          <span className="font-bold text-[#FFFDF5]">
                            {it.quantity}x {it.name}
                          </span>
                          <span className="text-[10px] text-[#a8a29e] block font-mono">
                            {formatCOP(it.unitPrice)} c/u
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#D6A21A]">
                            {formatCOP(it.totalPrice)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCartItem(idx)}
                            className="p-1 text-red-400 hover:text-red-300 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-baseline pt-2 px-1">
                      <span className="text-xs font-bold text-[#a8a29e]">Total del Separado:</span>
                      <span className="text-base font-black font-mono text-[#D6A21A]">
                        {formatCOP(cartSubtotal)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Anticipo Inicial y Medio de Pago */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-[#121214] rounded-2xl border border-[#2d281e]">
                <div>
                  <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                    Anticipo Inicial (Opcional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={cartSubtotal}
                    value={initialDeposit}
                    onChange={(e) => setInitialDeposit(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-[#181818] border border-[#333333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] font-mono focus:outline-none focus:border-[#B77900]"
                  />
                  <p className="text-[10px] text-[#a8a29e] mt-1">
                    Saldo restante: <strong className="text-amber-400 font-mono">{formatCOP(Math.max(0, cartSubtotal - initialDeposit))}</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                    Medio de Pago del Anticipo
                  </label>
                  <select
                    value={depositPaymentMethod}
                    onChange={(e) => setDepositPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full bg-[#181818] border border-[#333333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
                  >
                    <option value="efectivo">Efectivo en Caja</option>
                    <option value="transferencia">Transferencia Bancolombia/Davivienda</option>
                    <option value="nequi_daviplata">Nequi / Daviplata</option>
                    <option value="tarjeta">Datáfono / Tarjeta</option>
                  </select>
                </div>
              </div>

              {/* Fecha y Hora de Entrega */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                    Fecha de Entrega / Evento <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    required
                    className="w-full bg-[#121214] border border-[#333333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                    Hora Estimada
                  </label>
                  <input
                    type="time"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    className="w-full bg-[#121214] border border-[#333333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
                  />
                </div>
              </div>

              {/* Switch de Reserva de Inventario */}
              <div className="p-3 bg-[#121214] rounded-2xl border border-[#2d281e] flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#FFFDF5]">Reservar insumos en inventario</span>
                  <p className="text-[10px] text-[#a8a29e]">
                    Separa físicamente los insumos de las recetas para garantizar stock del pedido
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReserveInventory(!reserveInventory)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    reserveInventory ? 'bg-[#B77900]' : 'bg-[#333333]'
                  }`}
                >
                  <div
                    className={`bg-[#181818] w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      reserveInventory ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                  Observaciones / Instrucciones Especiales
                </label>
                <textarea
                  rows={2}
                  value={separadoNotes}
                  onChange={(e) => setSeparadoNotes(e.target.value)}
                  placeholder="Detalles sobre empaques, evento, contacto o instrucciones de entrega..."
                  className="w-full bg-[#121214] border border-[#333333] rounded-xl p-3 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900] resize-none"
                />
              </div>

              {/* Botones */}
              <div className="pt-4 border-t border-[#333333] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#444444] text-[#d6d3d1] hover:bg-[#2d2d2d] text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || cartItems.length === 0 || !selectedCustomer}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center gap-1.5 hover:brightness-110 shadow-lg cursor-pointer disabled:opacity-50"
                >
                  <BookmarkCheck className="w-4 h-4" />
                  <span>Crear Separado</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: REGISTRAR ABONO A SEPARADO */}
      {showAbonoModal && selectedSeparadoForAbono && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-[#181818] border border-[#B77900]/40 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-[#333333] flex items-center justify-between bg-gradient-to-r from-[#181818] to-[#242424]">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#D6A21A]" />
                <h3 className="text-sm font-black text-[#FFFDF5]">
                  Registrar Abono a Separado #{selectedSeparadoForAbono.code}
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
                  <span className="font-bold text-[#FFFDF5]">{selectedSeparadoForAbono.customerName}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#a8a29e]">Total Separado:</span>
                  <span className="font-mono text-[#d6d3d1]">{formatCOP(selectedSeparadoForAbono.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-amber-400 pt-1 border-t border-[#242424]">
                  <span>Saldo Pendiente Actual:</span>
                  <span className="font-mono text-sm">{formatCOP(selectedSeparadoForAbono.pendingBalance)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5">
                  Valor a Abonar (COP) <span className="text-amber-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedSeparadoForAbono.pendingBalance}
                  value={abonoAmount}
                  onChange={(e) => setAbonoAmount(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full bg-[#121214] border border-[#333333] rounded-xl p-3 text-sm font-mono text-[#FFFDF5] font-black focus:outline-none focus:border-[#B77900]"
                />
                <p className="text-[10px] text-[#a8a29e] mt-1">
                  Nuevo saldo tras este abono: <strong className="text-emerald-400 font-mono">{formatCOP(Math.max(0, selectedSeparadoForAbono.pendingBalance - abonoAmount))}</strong>
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
                  placeholder="Ej: Segundo abono por transferencia..."
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

      {/* 6. MODAL: HISTORIAL DE ABONOS (Con Anulación y Edición) */}
      {showHistoryModal && selectedSeparadoForHistory && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-[#181818] border border-[#B77900]/40 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-[#333333] flex items-center justify-between bg-gradient-to-r from-[#181818] to-[#242424]">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#D6A21A]" />
                <div>
                  <h3 className="text-sm font-black text-[#FFFDF5]">
                    Historial de Abonos — Separado #{selectedSeparadoForHistory.code}
                  </h3>
                  <p className="text-xs text-[#a8a29e]">{selectedSeparadoForHistory.customerName}</p>
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
              {abonos.filter((a) => a.parentId === selectedSeparadoForHistory.id).length > 0 ? (
                abonos
                  .filter((a) => a.parentId === selectedSeparadoForHistory.id)
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

                          {/* Acciones del Comprobante Individual */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setReceiptAbono(ab);
                                setReceiptTotal(selectedSeparadoForHistory.totalAmount);
                                setReceiptRemaining(selectedSeparadoForHistory.pendingBalance);
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
                                title="Anular este registro de abono"
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
                  <p className="text-xs">No hay abonos registrados para este separado</p>
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
              Esta acción marcará el comprobante como <strong>ANULADO</strong>, restaurará el saldo pendiente del cliente en el separado y registrará el egreso correspondiente en caja sin anular el pedido comercial.
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
                  placeholder="Ej: Error de digitación en el datáfono, transacción rechazada..."
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

      {/* 8. MODAL: CANCELAR SEPARADO */}
      {showCancelModal && selectedSeparadoForCancel && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-[#181818] border border-red-500/50 rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-950 border border-red-700 flex items-center justify-center text-red-400">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#FFFDF5]">
                  Cancelar Separado #{selectedSeparadoForCancel.code}
                </h3>
                <p className="text-xs text-[#a8a29e]">{selectedSeparadoForCancel.customerName}</p>
              </div>
            </div>

            <form onSubmit={handleCancelSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                  Motivo de Cancelación <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ej: Desistimiento voluntario del cliente por cambio de fecha del evento..."
                  required
                  className="w-full bg-[#121214] border border-[#333333] rounded-xl p-3 text-xs text-[#FFFDF5] focus:outline-none focus:border-red-500 resize-none"
                />
              </div>

              {selectedSeparadoForCancel.totalAbonado > 0 && (
                <div>
                  <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                    Valor a Devolver al Cliente en Efectivo (COP)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={selectedSeparadoForCancel.totalAbonado}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#121214] border border-[#333333] rounded-xl p-2.5 text-xs font-mono text-[#FFFDF5]"
                  />
                  <p className="text-[10px] text-[#a8a29e] mt-1">
                    Total abonado histórico: {formatCOP(selectedSeparadoForCancel.totalAbonado)}. Si devuelve dinero, se descontará de caja.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#444444] text-[#d6d3d1] text-xs font-bold"
                >
                  Regresar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || cancelReason.trim().length < 5}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
                >
                  Confirmar Cancelación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. MODAL: IMPRESIÓN COMPROBANTE TÉRMICO */}
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
