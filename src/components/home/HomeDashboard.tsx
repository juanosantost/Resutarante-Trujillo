/**
 * SISTEMA COLMENA RESTAURANTE — Tablero Principal de Pedidos Activos
 * Guadalajara de Buga (Valle del Cauca, Colombia)
 * 
 * Centro de mando operativo:
 * - Muestra en tiempo real todos los pedidos activos (Mesas, Domicilios, Para Llevar, Mostrador).
 * - Agregar nuevos productos o rondas con un solo clic.
 * - Cambiar estados operativos (Cocina KDS, Listo, En Camino, Servido).
 * - Generar cobros y pagos inmediatos por cualquier medio (Efectivo con devuelta, Nequi, Daviplata, Tarjetas, Mixto).
 * - Herramienta para limpiar datos de prueba y dejar el sistema listo para operar con datos reales en Buga.
 */

import React, { useState, useMemo } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Order, OrderType, OrderStatus, DeliveryStatus, Payment } from '../../types';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { db } from '../../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';

// Modales integrados del sistema
import { AddRoundModal } from '../modals/AddRoundModal';
import { CheckoutModal } from '../modals/CheckoutModal';
import { ReceiptModal } from '../modals/ReceiptModal';
import { NewOrderModal } from '../modals/NewOrderModal';

import {
  ClipboardList,
  Search,
  Plus,
  Receipt,
  Layers,
  Clock,
  User,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Bike,
  ShoppingBag,
  LayoutGrid,
  DollarSign,
  Send,
  Sparkles,
  Trash2,
  Filter,
  Flame,
  CheckCheck,
  ChevronDown,
  RefreshCw,
  UtensilsCrossed,
  MessageSquare,
  Building2,
  XCircle,
  BookmarkCheck,
  CreditCard,
} from 'lucide-react';

interface HomeDashboardProps {
  onNavigate?: (module: string) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onNavigate }) => {
  const {
    orders,
    tables,
    activeShift,
    currentBranch,
    clearAllTransactionalRecords,
    logAuditAction,
    staffName,
    actionLoading,
  } = useRestaurant();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  // Estados de Filtros
  const [filterType, setFilterType] = useState<string>('todos'); // 'todos', 'mesa', 'domicilio', 'para_llevar', 'cocina', 'listo'
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modales interactivos
  const [showNewOrderModal, setShowNewOrderModal] = useState<boolean>(false);
  const [selectedOrderForRound, setSelectedOrderForRound] = useState<Order | null>(null);
  const [selectedOrderForCheckout, setSelectedOrderForCheckout] = useState<Order | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  // Modal para anular pedido sin usar prompt()
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCanceling, setIsCanceling] = useState<boolean>(false);

  // 1. Filtrar únicamente pedidos en curso / abiertos
  const activeOrders = useMemo(() => {
    return orders.filter((o) => o.status === 'abierto');
  }, [orders]);

  // 2. Métricas y estadísticas rápidas del día
  const metrics = useMemo(() => {
    const totalActivos = activeOrders.length;
    const mesasActivas = activeOrders.filter((o) => o.type === 'mesa').length;
    const domiciliosActivos = activeOrders.filter((o) => o.type === 'domicilio').length;
    const paraLlevarActivos = activeOrders.filter((o) => o.type === 'para_llevar' || o.type === 'mostrador').length;
    const enCocina = activeOrders.filter((o) => o.deliveryStatus === 'en_preparacion').length;
    const listosDespacho = activeOrders.filter(
      (o) => o.deliveryStatus === 'listo_despacho' || o.deliveryStatus === 'en_camino'
    ).length;
    const totalPorCobrarCOP = activeOrders.reduce((sum, o) => sum + o.total, 0);

    return {
      totalActivos,
      mesasActivas,
      domiciliosActivos,
      paraLlevarActivos,
      enCocina,
      listosDespacho,
      totalPorCobrarCOP,
    };
  }, [activeOrders]);

  // 3. Aplicar filtros y búsqueda
  const filteredOrders = useMemo(() => {
    return activeOrders.filter((o) => {
      // Filtros rápidos
      if (filterType === 'mesa' && o.type !== 'mesa') return false;
      if (filterType === 'domicilio' && o.type !== 'domicilio') return false;
      if (filterType === 'para_llevar' && o.type !== 'para_llevar' && o.type !== 'mostrador') return false;
      if (filterType === 'cocina' && o.deliveryStatus !== 'en_preparacion') return false;
      if (filterType === 'listo' && o.deliveryStatus !== 'listo_despacho' && o.deliveryStatus !== 'en_camino') return false;

      // Búsqueda en texto libre
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = o.orderNumber.toString().includes(q);
        const matchCust = (o.customerName || '').toLowerCase().includes(q);
        const matchTable = (o.tableName || '').toLowerCase().includes(q);
        const matchPhone = (o.customerPhone || '').toLowerCase().includes(q);
        const matchAddr = (o.customerAddress || '').toLowerCase().includes(q);
        const matchNeigh = (o.neighborhood || '').toLowerCase().includes(q);
        if (!matchNum && !matchCust && !matchTable && !matchPhone && !matchAddr && !matchNeigh) return false;
      }

      return true;
    });
  }, [activeOrders, filterType, searchQuery]);

  // Función para cambiar de estado operativo rápido
  const handleQuickStatusChange = async (order: Order, newDeliveryStatus: DeliveryStatus) => {
    try {
      const now = new Date().toISOString();
      const updates: Partial<Order> = {
        deliveryStatus: newDeliveryStatus,
        updatedAt: now,
      };

      if (newDeliveryStatus === 'en_camino' && !order.dispatchedAt) {
        updates.dispatchedAt = now;
      }
      if (newDeliveryStatus === 'entregado' && !order.deliveredAt) {
        updates.deliveredAt = now;
      }

      await updateDoc(doc(db, 'orders', order.id), updates);

      // Registrar auditoría
      await logAuditAction({
        entityType: 'pedidos',
        entityId: order.id,
        entityName: `Pedido #${order.orderNumber}`,
        action: 'modificacion',
        details: `Estado cambiado a '${newDeliveryStatus.replace('_', ' ')}' desde el Tablero Principal por ${staffName}`,
      });

      showToast(`Pedido #${order.orderNumber} actualizado a: ${newDeliveryStatus.replace('_', ' ')}`, 'success');
    } catch (err) {
      console.error('Error changing order status:', err);
      showToast('Error al actualizar el estado del pedido', 'error');
    }
  };

  // Abrir modal de anulación
  const handleCancelOrder = (order: Order) => {
    setOrderToCancel(order);
    setCancelReason('Solicitud del cliente o cambio de orden');
  };

  // Ejecutar anulación
  const handleConfirmCancelOrder = async () => {
    if (!orderToCancel) return;
    setIsCanceling(true);
    try {
      const now = new Date().toISOString();
      const order = orderToCancel;
      const reason = cancelReason.trim() || 'Cancelado por el operador';

      await updateDoc(doc(db, 'orders', order.id), {
        status: 'cancelado',
        deliveryStatus: 'cancelado',
        notes: `${order.notes || ''} | Anulado: ${reason}`,
        updatedAt: now,
      });

      // Liberar mesa si aplica
      if (order.tableId) {
        await updateDoc(doc(db, 'tables', order.tableId), {
          status: 'libre',
          currentOrderId: null,
          hasOpenTab: false,
          currentBillAmount: 0,
          assignedWaiterName: null,
          openedAt: null,
          updatedAt: now,
        }).catch(() => {});
      }

      await logAuditAction({
        entityType: 'pedidos',
        entityId: order.id,
        entityName: `Anulación Pedido #${order.orderNumber}`,
        action: 'modificacion',
        details: `Pedido #${order.orderNumber} anulado por ${staffName}. Motivo: ${reason}`,
      });

      showToast(`Pedido #${order.orderNumber} anulado correctamente`, 'info');
      setOrderToCancel(null);
      setCancelReason('');
    } catch (err) {
      console.error('Error canceling order:', err);
      showToast('Error al anular el pedido', 'error');
    } finally {
      setIsCanceling(false);
    }
  };

  // Botón WhatsApp directo para domicilios
  const handleOpenWhatsApp = (phone: string = '', customerName: string = '', orderNum: number, total: number) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
    const text = encodeURIComponent(
      `Hola ${customerName || 'Estimado cliente'}, te saludamos de Sistema Colmena Restaurante (Guadalajara de Buga). Tu pedido #${orderNum} por ${formatCOP(
        total
      )} está en proceso y pronto llegará a tu dirección. ¡Muchas gracias por preferirnos!`
    );
    const link = document.createElement('a');
    link.href = `https://wa.me/${fullPhone}?text=${text}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Banner Principal de Bienvenida y Ubicación en Guadalajara de Buga */}
      <div className="rounded-3xl bg-[#181818] border border-[#333333] p-6 text-[#FFFDF5] shadow-xl relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-[#B77900]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-0.5 rounded-full bg-[#292212] border border-[#B77900]/40 text-[#D6A21A] text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#D6A21A]" />
                <span>Guadalajara de Buga · Sede Única</span>
              </span>
              <span className="text-xs text-[#a8a29e]">Valle del Cauca · Pesos Colombianos (COP)</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-[#FFFDF5] tracking-tight">
              Tablero de Pedidos en Curso
            </h1>
            <p className="text-xs sm:text-sm text-[#d6d3d1] mt-1 max-w-2xl leading-relaxed">
              Control en vivo de mesas, domicilios y pedidos para llevar. Agrega productos, despacha a cocina o procesa pagos de forma inmediata.
            </p>
          </div>

          {/* Botones de Acción Rápida en Cabecera */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowNewOrderModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center gap-2 hover:brightness-110 shadow-lg shadow-[#B77900]/25 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Nuevo Pedido</span>
            </button>

            {onNavigate && currentUser?.role === 'administrador' && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('separados')}
                  className="px-3.5 py-2.5 rounded-xl bg-[#242424] hover:bg-[#2d2d2d] border border-[#383838] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <BookmarkCheck className="w-4 h-4 text-[#D6A21A]" />
                  <span>Separados</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('cartera')}
                  className="px-3.5 py-2.5 rounded-xl bg-[#242424] hover:bg-[#2d2d2d] border border-[#383838] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CreditCard className="w-4 h-4 text-[#D6A21A]" />
                  <span>Cartera</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 2. Tarjetas de Resumen Numérico */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-[#2d2d2d]">
          <div className="p-3 rounded-2xl bg-[#242424] border border-[#383838]">
            <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">Pedidos Activos</span>
            <span className="text-xl font-black text-[#FFFDF5]">{metrics.totalActivos}</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#242424] border border-[#383838]">
            <span className="text-[10px] uppercase font-bold text-amber-400 block">Mesas Abiertas</span>
            <span className="text-xl font-black text-amber-300">{metrics.mesasActivas}</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#242424] border border-[#383838]">
            <span className="text-[10px] uppercase font-bold text-blue-400 block">Domicilios</span>
            <span className="text-xl font-black text-blue-300">{metrics.domiciliosActivos}</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#242424] border border-[#383838]">
            <span className="text-[10px] uppercase font-bold text-orange-400 block">En Cocina KDS</span>
            <span className="text-xl font-black text-orange-300">{metrics.enCocina}</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#242424] border border-[#383838]">
            <span className="text-[10px] uppercase font-bold text-purple-400 block">Listos / Despacho</span>
            <span className="text-xl font-black text-purple-300">{metrics.listosDespacho}</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#292212] border border-[#B77900]/40">
            <span className="text-[10px] uppercase font-bold text-[#D6A21A] block">Total por Cobrar</span>
            <span className="text-base font-black text-[#D6A21A] truncate block font-mono">
              {formatCOP(metrics.totalPorCobrarCOP)}
            </span>
          </div>
        </div>

      </div>

      {/* 3. Barra de Búsqueda y Pestañas de Filtro */}
      <div className="bg-[#181818] p-4 rounded-3xl border border-[#333333] text-[#FFFDF5] flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
        
        {/* Buscador de pedidos */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#a8a29e] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por # de pedido, mesa, cliente, celular o dirección..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#242424] border border-[#383838] text-xs text-[#FFFDF5] placeholder-[#78716c] focus:outline-none focus:border-[#D6A21A]"
          />
        </div>

        {/* Pestañas de Filtro de Pedidos */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setFilterType('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterType === 'todos'
                ? 'bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] shadow'
                : 'bg-[#242424] text-[#a8a29e] border border-[#383838] hover:text-[#FFFDF5]'
            }`}
          >
            Todos ({metrics.totalActivos})
          </button>

          <button
            type="button"
            onClick={() => setFilterType('mesa')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              filterType === 'mesa'
                ? 'bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] shadow'
                : 'bg-[#242424] text-[#a8a29e] border border-[#383838] hover:text-[#FFFDF5]'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Mesas ({metrics.mesasActivas})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('domicilio')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              filterType === 'domicilio'
                ? 'bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] shadow'
                : 'bg-[#242424] text-[#a8a29e] border border-[#383838] hover:text-[#FFFDF5]'
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            <span>Domicilios ({metrics.domiciliosActivos})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('para_llevar')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              filterType === 'para_llevar'
                ? 'bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] shadow'
                : 'bg-[#242424] text-[#a8a29e] border border-[#383838] hover:text-[#FFFDF5]'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Para Llevar ({metrics.paraLlevarActivos})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('cocina')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              filterType === 'cocina'
                ? 'bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] shadow'
                : 'bg-[#242424] text-[#a8a29e] border border-[#383838] hover:text-[#FFFDF5]'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>En Cocina ({metrics.enCocina})</span>
          </button>
        </div>

      </div>

      {/* 4. Lista y Cuadrícula de Pedidos Activos */}
      {filteredOrders.length === 0 ? (
        <div className="bg-[#181818] border border-[#333333] rounded-3xl p-12 text-center text-[#a8a29e] space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-[#242424] border border-[#383838] text-[#D6A21A] flex items-center justify-center mx-auto shadow-inner">
            <ClipboardList className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-[#FFFDF5] mb-1">
              No hay pedidos activos {filterType !== 'todos' ? `en la categoría '${filterType}'` : 'en este momento'}
            </h3>
            <p className="text-xs text-[#a8a29e] leading-relaxed">
              El restaurante en Guadalajara de Buga se encuentra al día. Haz clic en el botón a continuación para abrir una nueva mesa o registrar un pedido de domicilio.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewOrderModal(true)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center gap-2 hover:brightness-110 shadow-lg cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Crear Pedido Ahora</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const isDelivery = order.type === 'domicilio';
            const isMesa = order.type === 'mesa';
            const deliveryStatus = order.deliveryStatus || 'recibido';

            // Agrupar productos por ronda
            const roundsMap: Record<number, typeof order.items> = {};
            order.items.forEach((it) => {
              const r = it.roundNumber || 1;
              if (!roundsMap[r]) roundsMap[r] = [];
              roundsMap[r].push(it);
            });
            const roundKeys = Object.keys(roundsMap).map(Number).sort((a, b) => a - b);

            return (
              <div
                key={order.id}
                className="rounded-3xl bg-[#181818] border border-[#333333] hover:border-[#B77900]/60 p-5 text-[#FFFDF5] shadow-xl flex flex-col justify-between space-y-4 transition-all"
              >
                <div>
                  {/* Encabezado de la Tarjeta */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#2d2d2d]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-lg text-[#D6A21A]">
                          #{order.orderNumber}
                        </span>
                        
                        {/* Tipo de Pedido Badge */}
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#242424] border border-[#383838] text-[#FFFDF5] flex items-center gap-1">
                          {isMesa && <LayoutGrid className="w-3 h-3 text-[#D6A21A]" />}
                          {isDelivery && <Bike className="w-3 h-3 text-orange-400" />}
                          {!isMesa && !isDelivery && <ShoppingBag className="w-3 h-3 text-blue-400" />}
                          <span>{order.tableName || order.type}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-[#a8a29e] mt-1">
                        <Clock className="w-3 h-3 text-[#D6A21A]" />
                        <span>{formatColombiaDateTime(order.createdAt).split(',')[1]}</span>
                        {order.currentRound > 1 && (
                          <span className="text-[#D6A21A] font-bold">· Ronda {order.currentRound}</span>
                        )}
                      </div>
                    </div>

                    {/* Estado de Preparación / Despacho */}
                    <div className="text-right">
                      {isDelivery ? (
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-block ${
                            deliveryStatus === 'en_camino'
                              ? 'bg-orange-950 text-orange-300 border-orange-700 animate-pulse'
                              : deliveryStatus === 'listo_despacho'
                              ? 'bg-purple-950 text-purple-300 border-purple-700'
                              : deliveryStatus === 'en_preparacion'
                              ? 'bg-blue-950 text-blue-300 border-blue-700'
                              : 'bg-amber-950 text-amber-300 border-amber-700'
                          }`}
                        >
                          {deliveryStatus === 'en_camino'
                            ? '🚴 En Camino'
                            : deliveryStatus === 'listo_despacho'
                            ? 'Listo Despacho'
                            : deliveryStatus === 'en_preparacion'
                            ? 'En Cocina KDS'
                            : 'Recibido'}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border bg-amber-950 text-amber-300 border-amber-700">
                          Cuenta Abierta
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Datos del Cliente y Ubicación (para domicilios y clientes registrados) */}
                  <div className="p-3 rounded-2xl bg-[#242424] border border-[#383838] my-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-[#FFFDF5]">
                        <User className="w-3.5 h-3.5 text-[#D6A21A]" />
                        <span className="truncate">{order.customerName || 'Cliente General'}</span>
                      </div>
                      {order.customerPhone && (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[#a8a29e] text-[11px]">{order.customerPhone}</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenWhatsApp(order.customerPhone, order.customerName, order.orderNumber, order.total)
                            }
                            className="p-1 rounded bg-emerald-950 text-emerald-300 hover:bg-emerald-900 text-[10px] font-bold"
                            title="Enviar WhatsApp"
                          >
                            <MessageSquare className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {isDelivery && order.customerAddress && (
                      <div className="pt-1 border-t border-[#333333] flex items-start gap-1.5 text-[#a8a29e]">
                        <MapPin className="w-3.5 h-3.5 text-[#D6A21A] shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-[#FFFDF5] block">{order.customerAddress}</span>
                          {order.neighborhood && (
                            <span className="text-[10px] text-[#D6A21A]">Barrio: {order.neighborhood}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lista de Productos Agrupados */}
                  <div className="space-y-2 text-xs">
                    <span className="text-[10px] uppercase font-bold text-[#a8a29e] tracking-wider block">
                      Productos Ordenados ({order.items.length}):
                    </span>
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1 no-scrollbar">
                      {roundKeys.map((roundNum) => (
                        <div key={roundNum} className="space-y-1">
                          {roundKeys.length > 1 && (
                            <div className="text-[9px] uppercase font-bold text-[#D6A21A] bg-[#292212] px-2 py-0.5 rounded-md inline-block">
                              Ronda {roundNum}
                            </div>
                          )}
                          {roundsMap[roundNum].map((it, idx) => (
                            <div key={idx} className="flex justify-between items-start text-[11px] text-[#d6d3d1]">
                              <div className="pr-2">
                                <span className="font-bold text-[#FFFDF5]">{it.quantity}x</span> {it.name}
                                {it.notes && (
                                  <span className="text-[10px] text-[#D6A21A] block italic pl-3">
                                    ↳ {it.notes}
                                  </span>
                                )}
                              </div>
                              <span className="font-mono font-semibold shrink-0">
                                {formatCOP(it.price * it.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedOrderForRound(order)}
                      className="w-full mt-2 py-1.5 px-2 rounded-lg bg-[#1f1b14] hover:bg-[#2b2416] text-[#D6A21A] border border-dashed border-[#B77900]/50 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar más productos a este pedido</span>
                    </button>
                  </div>

                  {/* Total de la Orden */}
                  <div className="pt-3 mt-3 border-t border-[#2d2d2d] flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Total a Cobrar</span>
                      <span className="text-lg font-black text-[#D6A21A] font-mono">
                        {formatCOP(order.total)}
                      </span>
                    </div>

                    <div className="text-right text-[10px] text-[#a8a29e]">
                      <span>Sub: {formatCOP(order.subtotal)}</span>
                      {order.tip > 0 && <span className="block text-emerald-400">Propina: +{formatCOP(order.tip)}</span>}
                    </div>
                  </div>
                </div>

                {/* 5. Barra de Acciones Directas Requeridas */}
                <div className="pt-3 border-t border-[#2e2e2e] space-y-2">
                  
                  {/* Fila 1: Botón Agregar Productos & Botón Cobrar/Pagar */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedOrderForRound(order)}
                      className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#292212] to-[#3a2f16] hover:bg-[#D6A21A] text-[#fef3c7] hover:text-[#181818] border border-[#D6A21A]/60 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                      title="Agregar productos o nueva ronda a este pedido en curso"
                    >
                      <Plus className="w-4 h-4 text-[#D6A21A]" />
                      <span>Agregar Productos</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedOrderForCheckout(order)}
                      className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow cursor-pointer transition-all"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Cobrar / Pagar</span>
                    </button>
                  </div>

                  {/* Fila 2: Selector Rápido de Estado y Anulación */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    {/* Selector de avance de estado */}
                    {isDelivery ? (
                      <div className="flex items-center gap-1 flex-1">
                        {deliveryStatus === 'recibido' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusChange(order, 'en_preparacion')}
                            className="w-full py-1.5 px-2 rounded-lg bg-blue-950 text-blue-300 border border-blue-800 text-[11px] font-bold hover:bg-blue-900 cursor-pointer text-center"
                          >
                            Enviar a Cocina
                          </button>
                        )}
                        {deliveryStatus === 'en_preparacion' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusChange(order, 'listo_despacho')}
                            className="w-full py-1.5 px-2 rounded-lg bg-purple-950 text-purple-300 border border-purple-800 text-[11px] font-bold hover:bg-purple-900 cursor-pointer text-center"
                          >
                            Marcar Listo Despacho
                          </button>
                        )}
                        {deliveryStatus === 'listo_despacho' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusChange(order, 'en_camino')}
                            className="w-full py-1.5 px-2 rounded-lg bg-orange-950 text-orange-300 border border-orange-800 text-[11px] font-bold hover:bg-orange-900 cursor-pointer text-center"
                          >
                            🚴 Salida (En Camino)
                          </button>
                        )}
                        {deliveryStatus === 'en_camino' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusChange(order, 'entregado')}
                            className="w-full py-1.5 px-2 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800 text-[11px] font-bold hover:bg-emerald-900 cursor-pointer text-center"
                          >
                            ✅ Marcar Entregado
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#a8a29e] flex items-center gap-1">
                        <UtensilsCrossed className="w-3 h-3 text-[#D6A21A]" />
                        <span>Servicio en Sala Buga</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCancelOrder(order)}
                      className="p-1.5 rounded-lg text-[#78716c] hover:text-red-400 hover:bg-red-950/40 text-[11px] transition-colors cursor-pointer"
                      title="Anular Pedido"
                    >
                      Anular
                    </button>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Agregar Nuevos Productos / Rondas al Pedido */}
      {selectedOrderForRound && (
        <AddRoundModal
          order={selectedOrderForRound}
          onClose={() => setSelectedOrderForRound(null)}
          onSuccess={() => {
            setSelectedOrderForRound(null);
            showToast('¡Nuevos productos agregados al pedido y comanda enviada a cocina!', 'success');
          }}
        />
      )}

      {/* MODAL 2: Cobro y Facturación por Múltiples Medios de Pago */}
      {selectedOrderForCheckout && (
        <CheckoutModal
          order={selectedOrderForCheckout}
          onClose={() => setSelectedOrderForCheckout(null)}
          onPaymentComplete={(payment) => {
            const paidOrder = selectedOrderForCheckout;
            setSelectedOrderForCheckout(null);
            setReceiptPayment(payment);
            setReceiptOrder(paidOrder);
            showToast(`¡Pago de ${formatCOP(payment.total)} recibido con éxito!`, 'success');
          }}
        />
      )}

      {/* MODAL 3: Tirilla / Recibo POS con Resolución DIAN Buga */}
      {receiptPayment && (
        <ReceiptModal
          payment={receiptPayment}
          order={receiptOrder}
          onClose={() => {
            setReceiptPayment(null);
            setReceiptOrder(null);
          }}
        />
      )}

      {/* MODAL 4: Crear Nuevo Pedido Rápido */}
      {showNewOrderModal && (
        <NewOrderModal
          onClose={() => setShowNewOrderModal(false)}
          onSuccess={(orderId) => {
            setShowNewOrderModal(false);
            showToast(`¡Pedido creado exitosamente con comanda a cocina!`, 'success');
          }}
        />
      )}



      {/* MODAL 6: Anulación de Pedido */}
      {orderToCancel && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-red-500/50 rounded-3xl w-full max-w-md p-6 text-[#FFFDF5] shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-600 text-red-400 flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-[#FFFDF5]">
                Anular Pedido #{orderToCancel.orderNumber}
              </h3>
              <p className="text-xs text-[#a8a29e]">
                {orderToCancel.type === 'mesa' ? `Mesa: ${orderToCancel.tableName}` : `Cliente: ${orderToCancel.customerName || 'Consumidor Final'}`} • Total: {formatCOP(orderToCancel.total)}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#d6d3d1]">
                Motivo de la anulación:
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="Ej. Cambio de mesa, cliente se retiró, error al digitar..."
                className="w-full bg-[#121212] border border-[#2e2e2e] focus:border-red-500 rounded-xl p-3 text-xs text-[#FFFDF5] outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2e2e2e]">
              <button
                type="button"
                disabled={isCanceling}
                onClick={() => {
                  setOrderToCancel(null);
                  setCancelReason('');
                }}
                className="px-4 py-2.5 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] text-xs font-bold text-[#a8a29e] cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                disabled={isCanceling}
                onClick={handleConfirmCancelOrder}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs cursor-pointer shadow-lg inline-flex items-center gap-2"
              >
                {isCanceling && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isCanceling ? 'Anulando...' : 'Confirmar Anulación'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
