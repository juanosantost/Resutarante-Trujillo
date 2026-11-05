/**
 * SISTEMA COLMENA RESTAURANTE - Módulo de Domicilios y Pedidos Para Llevar
 * Totalmente integrado con Pedidos, Cocina (KDS), Clientes, Caja, Inventario, WhatsApp y Auditoría.
 */

import React, { useState, useMemo } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Order,
  OrderType,
  DeliveryStatus,
  DeliveryPaymentStatus,
  PaymentMethod,
  Customer,
  MenuItem,
  OrderItem,
  Comanda,
  InventoryMovement,
} from '../../types';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { db, handleFirestoreError, OperationType } from '../../services/firebase';
import { doc, updateDoc, setDoc, collection } from 'firebase/firestore';
import { AddRoundModal } from '../modals/AddRoundModal';
import { NewOrderModal } from '../modals/NewOrderModal';
import {
  Bike,
  ShoppingBag,
  MapPin,
  Phone,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  Send,
  DollarSign,
  Truck,
  FileText,
  X,
  Filter,
  Check,
  MessageSquare,
  AlertTriangle,
  Calendar,
  Building2,
  Sparkles,
  ChevronDown,
  CheckCheck,
  Navigation,
  RefreshCw,
  Trash2,
} from 'lucide-react';

export interface DeliveryDriver {
  id: string;
  branchId: string;
  fullName: string;
  phone: string;
  vehicle: string; // Ej: Moto Honda 125, Bicicleta, etc.
  isActive: boolean;
}

export const DeliveryAndPickupView: React.FC = () => {
  const {
    orders,
    currentBranch,
    customers,
    menuItems,
    products,
    inventory,
    userRole,
    staffName,
    activeShift,
    logAuditAction,
    createCustomer,
    cancelOrder,
  } = useRestaurant();
  const { currentUser, branches } = useAuth();
  const { showToast } = useToast();

  const [deliveryOrderToCancel, setDeliveryOrderToCancel] = useState<Order | null>(null);
  const [cancelDeliveryReason, setCancelDeliveryReason] = useState<string>('Cancelación solicitada por cliente');
  const [isCancellingDelivery, setIsCancellingDelivery] = useState<boolean>(false);

  // Pestaña Activa
  const [activeTab, setActiveTab] = useState<'domicilios' | 'para_llevar' | 'repartidores'>('domicilios');

  // Filtros de Búsqueda
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [driverFilter, setDriverFilter] = useState<string>('todos');
  const [paymentFilter, setPaymentFilter] = useState<string>('todos');
  const [dateFilter, setDateFilter] = useState<'hoy' | 'todos'>('hoy');

  // Modal para Agregar Productos / Ronda a Pedido en Curso
  const [selectedOrderForRound, setSelectedOrderForRound] = useState<Order | null>(null);

  // Modal Nuevo Pedido (Integrado con el Kiosco del Home de Pedidos)
  const [showNewOrderModal, setShowNewOrderModal] = useState<boolean>(false);

  // Repartidores internos
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([
    {
      id: 'driver-1',
      branchId: 'sede-chapinero',
      fullName: 'Carlos Andrés Domicilios',
      phone: '3104589201',
      vehicle: 'Moto Yamaha FZ 150 (ABC-12)',
      isActive: true,
    },
    {
      id: 'driver-2',
      branchId: 'sede-chapinero',
      fullName: 'Esteban Pardo',
      phone: '3208124433',
      vehicle: 'Moto AKT NKD 125 (XYZ-89)',
      isActive: true,
    },
    {
      id: 'driver-3',
      branchId: 'sede-parque93',
      fullName: 'Mauricio Gómez',
      phone: '3157890022',
      vehicle: 'Bicicleta Eléctrica #04',
      isActive: true,
    },
  ]);

  // Modal para Registrar Novedad / Incidencia
  const [incidenceModalOrder, setIncidenceModalOrder] = useState<Order | null>(null);
  const [incidenceText, setIncidenceText] = useState<string>('');

  // 1. Filtrado Inteligente de Pedidos
  const deliveryOrders = useMemo(() => {
    return orders.filter((o) => {
      // Filtrar por sucursal si aplica
      if (currentBranch && o.branchId !== currentBranch.id) return false;

      // Filtrar por tipo según pestaña
      if (activeTab === 'domicilios' && o.type !== 'domicilio') return false;
      if (activeTab === 'para_llevar' && o.type !== 'para_llevar') return false;

      // Filtro por Fecha (Hoy)
      if (dateFilter === 'hoy') {
        const todayStr = new Date().toISOString().split('T')[0];
        const orderDateStr = new Date(o.createdAt).toISOString().split('T')[0];
        if (orderDateStr !== todayStr) return false;
      }

      // Filtro por Estado de Despacho
      if (statusFilter !== 'todos') {
        const currentDeliveryStatus = o.deliveryStatus || 'recibido';
        if (currentDeliveryStatus !== statusFilter) return false;
      }

      // Filtro por Domiciliario
      if (driverFilter !== 'todos') {
        if (o.deliveryDriverId !== driverFilter) return false;
      }

      // Filtro por Estado de Pago
      if (paymentFilter !== 'todos') {
        const currentPaymentStatus = o.paymentStatus || 'contraentrega';
        if (currentPaymentStatus !== paymentFilter) return false;
      }

      // Búsqueda en texto libre
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = o.orderNumber.toString().includes(q);
        const matchCust = (o.customerName || '').toLowerCase().includes(q);
        const matchPhone = (o.customerPhone || '').toLowerCase().includes(q);
        const matchAddr = (o.customerAddress || '').toLowerCase().includes(q);
        const matchNeigh = (o.neighborhood || '').toLowerCase().includes(q);
        if (!matchNum && !matchCust && !matchPhone && !matchAddr && !matchNeigh) return false;
      }

      return true;
    });
  }, [orders, currentBranch, activeTab, dateFilter, statusFilter, driverFilter, paymentFilter, searchQuery]);

  // Métricas del Tablero
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysDeliveryOrders = orders.filter(
      (o) =>
        o.type === 'domicilio' &&
        (!currentBranch || o.branchId === currentBranch.id) &&
        new Date(o.createdAt).toISOString().split('T')[0] === todayStr
    );

    const enPreparacion = todaysDeliveryOrders.filter((o) => o.deliveryStatus === 'en_preparacion').length;
    const listoDespacho = todaysDeliveryOrders.filter((o) => o.deliveryStatus === 'listo_despacho').length;
    const enCamino = todaysDeliveryOrders.filter((o) => o.deliveryStatus === 'en_camino').length;
    const entregados = todaysDeliveryOrders.filter((o) => o.deliveryStatus === 'entregado');
    const totalEntregadosCOP = entregados.reduce((sum, o) => sum + o.total, 0);

    // Dinero en mano de domiciliarios pendiente de conciliar en caja
    const pendingReconciliationCOP = todaysDeliveryOrders
      .filter(
        (o) =>
          o.deliveryStatus === 'entregado' &&
          (o.paymentStatus === 'contraentrega' || o.paymentStatus === 'pendiente') &&
          !o.reconciledInCash
      )
      .reduce((sum, o) => sum + o.total, 0);

    return {
      totalHoy: todaysDeliveryOrders.length,
      enPreparacion,
      listoDespacho,
      enCamino,
      entregadosCount: entregados.length,
      totalEntregadosCOP,
      pendingReconciliationCOP,
    };
  }, [orders, currentBranch]);

  // Mappings de Badge de Estado
  const getDeliveryStatusBadge = (status: DeliveryStatus = 'recibido') => {
    switch (status) {
      case 'recibido':
        return { label: 'Recibido', classes: 'bg-amber-950 text-amber-300 border-amber-700/60' };
      case 'en_preparacion':
        return { label: 'En Preparación (KDS)', classes: 'bg-blue-950 text-blue-300 border-blue-700/60 animate-pulse' };
      case 'listo_despacho':
        return { label: 'Listo para Despacho', classes: 'bg-purple-950 text-purple-300 border-purple-700/60 font-black' };
      case 'en_camino':
        return { label: '🚴 En Camino', classes: 'bg-orange-950 text-orange-300 border-orange-600/80 font-black' };
      case 'entregado':
        return { label: '✅ Entregado', classes: 'bg-emerald-950 text-emerald-300 border-emerald-700/60' };
      case 'cancelado':
        return { label: '❌ Cancelado / Devuelto', classes: 'bg-red-950 text-red-300 border-red-700/60' };
      default:
        return { label: status, classes: 'bg-zinc-800 text-zinc-300 border-zinc-700' };
    }
  };

  const getPaymentStatusBadge = (status: DeliveryPaymentStatus = 'contraentrega', isReconciled?: boolean) => {
    switch (status) {
      case 'pagado_anticipado':
        return { label: 'Pagado Anticipado', classes: 'bg-emerald-950/80 text-emerald-300 border-emerald-800' };
      case 'contraentrega':
        return {
          label: isReconciled ? 'Contraentrega (Conciliado)' : 'Pago Contraentrega',
          classes: isReconciled
            ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
            : 'bg-amber-950 text-amber-300 border-amber-800',
        };
      case 'pendiente':
        return { label: 'Pendiente de Cobro', classes: 'bg-red-950 text-red-300 border-red-800' };
      default:
        return { label: status, classes: 'bg-zinc-800 text-zinc-300 border-zinc-700' };
    }
  };

  // 2. Operación de Cambio de Estado con Auditoría
  const handleUpdateDeliveryStatus = async (
    order: Order,
    newStatus: DeliveryStatus,
    extraUpdates?: Partial<Order>
  ) => {
    try {
      // Regla de Negocio (Punto 7): Evitar marcar como entregado si no ha estado en camino, a menos que sea admin
      if (newStatus === 'entregado' && order.deliveryStatus !== 'en_camino') {
        if (currentUser?.role !== 'administrador') {
          showToast(
            'El pedido debe marcarse "En Camino" antes de confirmarse como "Entregado". Requieres rol de Administrador.',
            'error'
          );
          return;
        }
      }

      const now = new Date().toISOString();
      const updates: Partial<Order> = {
        deliveryStatus: newStatus,
        updatedAt: now,
        ...extraUpdates,
      };

      if (newStatus === 'en_camino' && !order.dispatchedAt) {
        updates.dispatchedAt = now;
      }
      if (newStatus === 'entregado' && !order.deliveredAt) {
        updates.deliveredAt = now;
      }

      await updateDoc(doc(db, 'orders', order.id), updates);

      // Auditoría
      await logAuditAction({
        entityType: 'pedidos',
        entityId: order.id,
        entityName: `Domicilio #${order.orderNumber}`,
        action: 'modificacion',
        details: `Estado cambiado de '${order.deliveryStatus || 'recibido'}' a '${newStatus}' por ${staffName} (${currentUser?.role})`,
      });

      showToast(`Pedido #${order.orderNumber} actualizado a: ${newStatus.replace('_', ' ')}`, 'success');
    } catch (err) {
      console.error('Error updating delivery status:', err);
      showToast('Error al actualizar el estado del domicilio', 'error');
    }
  };

  // 3. Asignar Domiciliario
  const handleAssignDriver = async (order: Order, driverId: string) => {
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver && driverId !== '') return;

    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'orders', order.id), {
        deliveryDriverId: driver ? driver.id : null,
        deliveryDriverName: driver ? driver.fullName : null,
        updatedAt: now,
      });

      await logAuditAction({
        entityType: 'pedidos',
        entityId: order.id,
        entityName: `Domicilio #${order.orderNumber}`,
        action: 'modificacion',
        details: driver
          ? `Asignado domiciliario '${driver.fullName}' (${driver.phone})`
          : 'Desasignado domiciliario',
      });

      showToast(
        driver ? `Domiciliario ${driver.fullName} asignado al pedido #${order.orderNumber}` : 'Domiciliario desasignado',
        'info'
      );
    } catch (err) {
      console.error('Error assigning driver:', err);
      showToast('Error al asignar domiciliario', 'error');
    }
  };

  // 4. Conciliación de Dinero en Caja (Punto 5)
  const handleReconcileCash = async (order: Order) => {
    try {
      if (!activeShift) {
        showToast('Debes tener un turno de caja abierto en esta sucursal para conciliar dinero', 'error');
        return;
      }

      const now = new Date().toISOString();
      await updateDoc(doc(db, 'orders', order.id), {
        reconciledInCash: true,
        updatedAt: now,
      });

      await logAuditAction({
        entityType: 'caja',
        entityId: order.id,
        entityName: `Conciliación Domicilio #${order.orderNumber}`,
        action: 'creacion',
        details: `Dinero cobrado por domiciliario ${order.deliveryDriverName || 'Asignado'} (${formatCOP(
          order.total
        )}) ingresado y verificado en caja por ${staffName}`,
      });

      showToast(`Dinero del Pedido #${order.orderNumber} (${formatCOP(order.total)}) conciliado en caja con éxito`, 'success');
    } catch (err) {
      console.error('Error reconciling cash:', err);
      showToast('Error al conciliar dinero en caja', 'error');
    }
  };

  // 5. Registrar Incidencia / Novedad
  const handleSaveIncidence = async () => {
    if (!incidenceModalOrder || !incidenceText.trim()) return;

    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'orders', incidenceModalOrder.id), {
        incidenceNote: incidenceText.trim(),
        updatedAt: now,
      });

      await logAuditAction({
        entityType: 'pedidos',
        entityId: incidenceModalOrder.id,
        entityName: `Incidencia Domicilio #${incidenceModalOrder.orderNumber}`,
        action: 'modificacion',
        details: `Novedad de reparto registrada por ${staffName}: ${incidenceText.trim()}`,
      });

      showToast(`Novedad registrada para el pedido #${incidenceModalOrder.orderNumber}`, 'warning');
      setIncidenceModalOrder(null);
      setIncidenceText('');
    } catch (err) {
      console.error('Error saving incidence:', err);
      showToast('Error al guardar la novedad del envío', 'error');
    }
  };

  // 6. Mensajería Oficial WhatsApp (Punto 6)
  const sendWhatsAppNotification = (
    order: Order,
    type: 'confirmado' | 'en_preparacion' | 'en_camino' | 'entregado'
  ) => {
    if (!order.customerPhone) {
      showToast('El cliente no registra número celular para WhatsApp', 'error');
      return;
    }

    const cleanPhone = order.customerPhone.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
    const name = order.customerName || 'Estimado cliente';
    const num = order.orderNumber;
    const totalStr = formatCOP(order.total);
    const driverStr = order.deliveryDriverName || 'nuestro domiciliario asignado';

    let message = '';
    switch (type) {
      case 'confirmado':
        message = `Hola ${name}, te saludamos de *Sistema Colmena Restaurante*. Tu pedido *#${num}* por un valor de *${totalStr}* ha sido confirmado con éxito. Dirección: ${
          order.customerAddress || 'En restaurante'
        }. ¡Muchas gracias por preferirnos!`;
        break;
      case 'en_preparacion':
        message = `Hola ${name}, te informamos que tu pedido *#${num}* ya se encuentra en preparación en nuestra cocina Colmena. 👨‍🍳🔥`;
        break;
      case 'en_camino':
        message = `Hola ${name}, ¡buenas noticias! Tu pedido *#${num}* va *EN CAMINO* 🚴💨 con ${driverStr}. Dirección de entrega: ${order.customerAddress}. ¡Estaremos allí en unos minutos!`;
        break;
      case 'entregado':
        message = `Hola ${name}, confirmamos que tu pedido *#${num}* ha sido *ENTREGADO*. 🎉 Esperamos que disfrutes tu comida. ¡Agradecemos tu calificación y preferencia! ⬡ Colmena`;
        break;
    }

    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };



  return (
    <div className="space-y-6">
      {/* Cabecera Principal Colmena */}
      <div className="rounded-3xl bg-[#181818] border border-[#333333] p-6 text-[#FFFDF5] shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#B77900] to-[#D6A21A] text-[#181818] flex items-center justify-center font-black shadow-lg shadow-[#B77900]/20">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#FFFDF5] via-[#D6A21A] to-[#B77900]">
                  Módulo de Domicilios & Despachos
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-[#292212] border border-[#B77900]/40 text-[#D6A21A] text-[10px] font-black uppercase tracking-widest">
                  Operación Colmena
                </span>
              </div>
              <p className="text-xs text-[#a8a29e] mt-0.5">
                Seguimiento en tiempo real de despacho, comandas a cocina KDS, asignación de repartidores, plantillas WhatsApp y conciliación de caja.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowNewOrderModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center gap-2 hover:brightness-110 shadow-lg cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Pedido</span>
            </button>
          </div>
        </div>

        {/* Tarjetas Resumen de Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-[#2d2d2d]">
          <div className="p-3 rounded-2xl bg-[#242424] border border-[#383838]">
            <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">Domicilios Hoy</span>
            <span className="text-lg font-black text-[#FFFDF5]">{stats.totalHoy}</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#242424] border border-[#383838]">
            <span className="text-[10px] uppercase font-bold text-blue-400 block">En Cocina KDS</span>
            <span className="text-lg font-black text-blue-300">{stats.enPreparacion}</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#242424] border border-[#383838]">
            <span className="text-[10px] uppercase font-bold text-purple-400 block">Listos Despacho</span>
            <span className="text-lg font-black text-purple-300">{stats.listoDespacho}</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#242424] border border-[#383838]">
            <span className="text-[10px] uppercase font-bold text-orange-400 block">En Camino</span>
            <span className="text-lg font-black text-orange-300">{stats.enCamino}</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#242424] border border-[#383838]">
            <span className="text-[10px] uppercase font-bold text-emerald-400 block">Entregados</span>
            <span className="text-lg font-black text-emerald-300">{stats.entregadosCount}</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#292212] border border-[#B77900]/40">
            <span className="text-[10px] uppercase font-bold text-[#D6A21A] block">Por Conciliar Caja</span>
            <span className="text-sm font-black text-[#D6A21A] truncate block">
              {formatCOP(stats.pendingReconciliationCOP)}
            </span>
          </div>
        </div>

        {/* Pestañas de Vista */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-[#2e2e2e]">
          <button
            type="button"
            onClick={() => setActiveTab('domicilios')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'domicilios'
                ? 'bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] shadow-md'
                : 'bg-[#242424] text-[#d6d3d1] border border-[#383838] hover:text-[#FFFDF5]'
            }`}
          >
            <Bike className="w-4 h-4" />
            <span>Panel de Domicilios ({orders.filter((o) => o.type === 'domicilio').length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('para_llevar')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'para_llevar'
                ? 'bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] shadow-md'
                : 'bg-[#242424] text-[#d6d3d1] border border-[#383838] hover:text-[#FFFDF5]'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Pedidos Para Llevar / Takeaway ({orders.filter((o) => o.type === 'para_llevar').length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('repartidores')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'repartidores'
                ? 'bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] shadow-md'
                : 'bg-[#242424] text-[#d6d3d1] border border-[#383838] hover:text-[#FFFDF5]'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Gestión de Domiciliarios ({drivers.length})</span>
          </button>
        </div>
      </div>

      {/* Contenido de la Vista */}
      {activeTab === 'repartidores' ? (
        /* Pestaña Repartidores Internos */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#181818]">Directorio de Domiciliarios / Repartidores</h3>
              <p className="text-xs text-[#78716c]">Asignación de envíos, vehículos y conciliación de dinero en caja.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const name = prompt('Nombre completo del domiciliario:');
                const phone = prompt('Número de celular:');
                const vehicle = prompt('Vehículo / Placa (ej: Moto Honda 125 XYZ-89):');
                if (name && phone) {
                  setDrivers([
                    ...drivers,
                    {
                      id: `driver-${Date.now()}`,
                      branchId: currentBranch?.id || 'sede-chapinero',
                      fullName: name,
                      phone,
                      vehicle: vehicle || 'Motocicleta',
                      isActive: true,
                    },
                  ]);
                  showToast('Domiciliario registrado con éxito', 'success');
                }
              }}
              className="px-4 py-2 rounded-xl bg-[#181818] text-[#FFFDF5] text-xs font-bold hover:bg-[#2e2e2e] cursor-pointer"
            >
              + Registrar Repartidor
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {drivers.map((drv) => {
              // Filtrar pedidos asignados a este repartidor
              const assignedOrders = orders.filter(
                (o) => o.deliveryDriverId === drv.id && o.type === 'domicilio'
              );
              const pendingMoney = assignedOrders
                .filter(
                  (o) =>
                    o.deliveryStatus === 'entregado' &&
                    (o.paymentStatus === 'contraentrega' || o.paymentStatus === 'pendiente') &&
                    !o.reconciledInCash
                )
                .reduce((sum, o) => sum + o.total, 0);

              return (
                <div
                  key={drv.id}
                  className="p-5 rounded-3xl bg-[#181818] border border-[#333333] text-[#FFFDF5] shadow-xl flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#242424] border border-[#383838] text-[#D6A21A] flex items-center justify-center font-bold">
                        <Truck className="w-5 h-5" />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                        Activo
                      </span>
                    </div>

                    <h4 className="font-bold text-base text-[#FFFDF5]">{drv.fullName}</h4>
                    <p className="text-xs text-[#a8a29e] flex items-center gap-1.5 mt-1">
                      <Phone className="w-3.5 h-3.5 text-[#D6A21A]" />
                      <span>{drv.phone}</span>
                    </p>
                    <p className="text-xs text-[#a8a29e] flex items-center gap-1.5 mt-1 font-mono">
                      <Bike className="w-3.5 h-3.5 text-[#D6A21A]" />
                      <span>{drv.vehicle}</span>
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#2e2e2e] space-y-2 text-xs">
                    <div className="flex justify-between text-[#a8a29e]">
                      <span>Envíos asignados hoy:</span>
                      <span className="font-bold text-[#FFFDF5]">{assignedOrders.length} domicilios</span>
                    </div>

                    <div className="flex justify-between items-center p-2 rounded-xl bg-[#242424] border border-[#383838]">
                      <span className="text-[#a8a29e] text-[11px]">Dinero por conciliar:</span>
                      <span className="font-black text-[#D6A21A] text-xs">{formatCOP(pendingMoney)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Tablero de Domicilios / Para Llevar */
        <div className="space-y-4">
          {/* Barra de Filtros (Punto 8) */}
          <div className="p-4 rounded-3xl bg-[#181818] border border-[#333333] text-[#FFFDF5] flex flex-wrap items-center justify-between gap-3 shadow-lg">
            {/* Buscador */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-[#a8a29e] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por cliente, celular, dirección, barrio o # pedido..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#242424] border border-[#383838] text-xs text-[#FFFDF5] placeholder-[#78716c] focus:outline-none focus:border-[#D6A21A]"
              />
            </div>

            {/* Filtros Dropdown */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Filtro Estado */}
              <select
                aria-label="Filtrar por Estado"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#242424] border border-[#383838] text-xs text-[#FFFDF5] focus:outline-none cursor-pointer"
              >
                <option value="todos">Todos los Estados</option>
                <option value="recibido">1. Recibido</option>
                <option value="en_preparacion">2. En Preparación</option>
                <option value="listo_despacho">3. Listo Despacho</option>
                <option value="en_camino">4. En Camino</option>
                <option value="entregado">5. Entregado</option>
                <option value="cancelado">6. Cancelado</option>
              </select>

              {/* Filtro Domiciliario */}
              <select
                aria-label="Filtrar por Domiciliario"
                value={driverFilter}
                onChange={(e) => setDriverFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#242424] border border-[#383838] text-xs text-[#FFFDF5] focus:outline-none cursor-pointer"
              >
                <option value="todos">Todos los Repartidores</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}
                  </option>
                ))}
              </select>

              {/* Filtro Pago */}
              <select
                aria-label="Filtrar por Pago"
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#242424] border border-[#383838] text-xs text-[#FFFDF5] focus:outline-none cursor-pointer"
              >
                <option value="todos">Todos los Pagos</option>
                <option value="contraentrega">Pago Contraentrega</option>
                <option value="pagado_anticipado">Pagado Anticipadamente</option>
                <option value="pendiente">Pendiente de Cobro</option>
              </select>

              {/* Filtro Fecha */}
              <button
                type="button"
                onClick={() => setDateFilter(dateFilter === 'hoy' ? 'todos' : 'hoy')}
                className={`px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  dateFilter === 'hoy'
                    ? 'bg-[#292212] border-[#B77900] text-[#D6A21A]'
                    : 'bg-[#242424] border-[#383838] text-[#a8a29e]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{dateFilter === 'hoy' ? 'Solo Hoy' : 'Histórico Total'}</span>
              </button>
            </div>
          </div>

          {/* Grilla de Tarjetas de Domicilio */}
          {deliveryOrders.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-[#181818] border border-[#333333] text-[#a8a29e] space-y-3 shadow-lg">
              <Bike className="w-12 h-12 mx-auto text-[#525252]" />
              <h3 className="text-base font-bold text-[#FFFDF5]">No hay pedidos que coincidan con el filtro</h3>
              <p className="text-xs text-[#a8a29e] max-w-md mx-auto">
                No existen domicilios o pedidos para llevar que correspondan a la búsqueda actual en esta sucursal.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deliveryOrders.map((order) => {
                const statusBadge = getDeliveryStatusBadge(order.deliveryStatus || 'recibido');
                const paymentBadge = getPaymentStatusBadge(order.paymentStatus || 'contraentrega', order.reconciledInCash);

                return (
                  <div
                    key={order.id}
                    className="p-5 rounded-3xl bg-[#181818] border border-[#333333] text-[#FFFDF5] shadow-xl flex flex-col justify-between space-y-4 hover:border-[#B77900]/50 transition-all"
                  >
                    <div>
                      {/* Encabezado Pedido + Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-base text-[#D6A21A]">
                            #{order.orderNumber}
                          </span>
                          <span className="text-[10px] font-bold text-[#a8a29e]">
                            {formatColombiaDateTime(order.createdAt).split(',')[1]}
                          </span>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge.classes}`}>
                          {statusBadge.label}
                        </span>
                      </div>

                      {/* Caja de Datos del Cliente (Punto 1) */}
                      <div className="p-3.5 rounded-2xl bg-[#242424] border border-[#383838] space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-[#FFFDF5]">
                            <User className="w-3.5 h-3.5 text-[#D6A21A]" />
                            <span className="truncate">{order.customerName || 'Cliente General'}</span>
                          </div>
                          {order.customerPhone && (
                            <span className="font-mono text-[#a8a29e] text-[11px]">{order.customerPhone}</span>
                          )}
                        </div>

                        {order.customerAddress && (
                          <div className="space-y-1 pt-1 border-t border-[#333333]">
                            <div className="flex items-start gap-1.5 text-[#d6d3d1]">
                              <MapPin className="w-3.5 h-3.5 text-[#D6A21A] shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold block">{order.customerAddress}</span>
                                {order.neighborhood && (
                                  <span className="text-[10px] text-[#D6A21A] font-bold block">
                                    Barrio: {order.neighborhood}
                                  </span>
                                )}
                                {order.addressReference && (
                                  <span className="text-[10px] text-[#a8a29e] italic block">
                                    Ref: {order.addressReference}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Resumen de Productos */}
                      <div className="mt-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-[#a8a29e] text-[10px] uppercase font-bold tracking-wider">
                          <span>Ítems del Pedido ({order.items.length})</span>
                          {order.deliveryFee ? <span>Envío: {formatCOP(order.deliveryFee)}</span> : null}
                        </div>
                        <div className="space-y-1 max-h-28 overflow-y-auto pr-1 no-scrollbar">
                          {order.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between items-center text-[11px] text-[#d6d3d1]">
                              <span className="truncate">
                                <strong className="text-[#D6A21A]">{it.quantity}x</strong> {it.name}
                              </span>
                              <span className="font-mono font-semibold shrink-0">
                                {formatCOP(it.price * it.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {order.deliveryStatus !== 'entregado' && order.deliveryStatus !== 'cancelado' && (
                          <button
                            type="button"
                            onClick={() => setSelectedOrderForRound(order)}
                            className="w-full mt-1.5 py-1 px-2 rounded-lg bg-[#242424] hover:bg-[#2d2d2d] text-[#D6A21A] border border-dashed border-[#B77900]/40 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            <span>+ Agregar productos a este pedido</span>
                          </button>
                        )}
                      </div>

                      {/* Observaciones o Novedad si existe */}
                      {order.notes && (
                        <div className="mt-2.5 p-2 rounded-xl bg-[#292212] border border-[#B77900]/30 text-[11px] text-[#D6A21A]">
                          <strong>Obs:</strong> {order.notes}
                        </div>
                      )}

                      {order.incidenceNote && (
                        <div className="mt-2.5 p-2 rounded-xl bg-red-950/60 border border-red-800 text-[11px] text-red-200 flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                          <div>
                            <strong>Novedad / Incidencia:</strong> {order.incidenceNote}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Zona Inferior de Acciones, WhatsApp & Asignación */}
                    <div className="pt-3 border-t border-[#2e2e2e] space-y-2.5">
                      {/* Asignar Domiciliario Dropdown (Punto 4) */}
                      {activeTab === 'domicilios' && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-[#a8a29e] text-[10px] uppercase font-bold shrink-0">Repartidor:</span>
                          <select
                            aria-label="Seleccionar Repartidor"
                            value={order.deliveryDriverId || ''}
                            onChange={(e) => handleAssignDriver(order, e.target.value)}
                            className="flex-1 px-2.5 py-1.5 rounded-xl bg-[#242424] border border-[#383838] text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A] cursor-pointer"
                          >
                            <option value="">(Sin Domiciliario Asignado)</option>
                            {drivers.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.fullName}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Botones Oficiales WhatsApp (Punto 6) */}
                      <div className="flex items-center justify-between gap-1 bg-[#242424] p-1.5 rounded-2xl border border-[#383838] text-[10px]">
                        <span className="text-[#a8a29e] font-bold px-1.5">Enviar WhatsApp:</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="Notificar Confirmado"
                            onClick={() => sendWhatsAppNotification(order, 'confirmado')}
                            className="px-2 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 font-bold cursor-pointer"
                          >
                            Confirmación
                          </button>
                          <button
                            type="button"
                            title="Notificar En Camino"
                            onClick={() => sendWhatsAppNotification(order, 'en_camino')}
                            className="px-2 py-1 rounded-lg bg-orange-950 hover:bg-orange-900 border border-orange-800 text-orange-300 font-bold cursor-pointer"
                          >
                            En Camino
                          </button>
                          <button
                            type="button"
                            title="Notificar Entregado"
                            onClick={() => sendWhatsAppNotification(order, 'entregado')}
                            className="px-2 py-1 rounded-lg bg-blue-950 hover:bg-blue-900 border border-blue-800 text-blue-300 font-bold cursor-pointer"
                          >
                            Entregado
                          </button>
                        </div>
                      </div>

                      {/* Fila de Valor, Estado de Pago & Cambios de Estado */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border block mb-1 ${paymentBadge.classes}`}>
                            {paymentBadge.label}
                          </span>
                          <span className="font-black text-base text-[#D6A21A] font-mono block">
                            {formatCOP(order.total)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {/* Botón Agregar Productos si el pedido está en curso */}
                          {order.deliveryStatus !== 'entregado' && order.deliveryStatus !== 'cancelado' && (
                            <button
                              type="button"
                              onClick={() => setSelectedOrderForRound(order)}
                              className="px-2.5 py-1.5 rounded-xl bg-[#292212] hover:bg-[#3d3119] border border-[#B77900]/60 text-[#D6A21A] text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm transition-all"
                              title="Agregar productos a este pedido en curso"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>+ Agregar Productos</span>
                            </button>
                          )}

                          {/* Botón Conciliar Caja si aplica */}
                          {(order.paymentStatus === 'contraentrega' || order.paymentStatus === 'pendiente') &&
                            order.deliveryStatus === 'entregado' &&
                            !order.reconciledInCash && (
                              <button
                                type="button"
                                onClick={() => handleReconcileCash(order)}
                                className="px-2.5 py-1.5 rounded-xl bg-cyan-950 text-cyan-200 border border-cyan-700 font-bold text-xs hover:bg-cyan-900 cursor-pointer flex items-center gap-1"
                                title="Conciliar dinero en caja"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                <span>Conciliar Caja</span>
                              </button>
                            )}

                          {/* Botón Registrar Incidencia */}
                          <button
                            type="button"
                            onClick={() => {
                              setIncidenceModalOrder(order);
                              setIncidenceText(order.incidenceNote || '');
                            }}
                            className="p-1.5 rounded-xl bg-[#242424] hover:bg-[#2d2d2d] text-[#a8a29e] hover:text-[#FFFDF5] border border-[#383838] cursor-pointer"
                            title="Registrar Incidencia / Novedad"
                          >
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          </button>

                          {/* Botones de Transición de Estado */}
                          {order.deliveryStatus === 'recibido' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateDeliveryStatus(order, 'en_preparacion')}
                              className="px-3 py-1.5 rounded-xl bg-blue-950 text-blue-300 border border-blue-800 text-xs font-bold hover:bg-blue-900 cursor-pointer"
                            >
                              Cocina KDS
                            </button>
                          )}

                          {order.deliveryStatus === 'en_preparacion' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateDeliveryStatus(order, 'listo_despacho')}
                              className="px-3 py-1.5 rounded-xl bg-purple-950 text-purple-300 border border-purple-800 text-xs font-bold hover:bg-purple-900 cursor-pointer"
                            >
                              Listo Despacho
                            </button>
                          )}

                          {order.deliveryStatus === 'listo_despacho' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateDeliveryStatus(order, 'en_camino')}
                              className="px-3 py-1.5 rounded-xl bg-orange-950 text-orange-300 border border-orange-800 text-xs font-bold hover:bg-orange-900 cursor-pointer"
                            >
                              🚴 Despachar
                            </button>
                          )}

                          {order.deliveryStatus === 'en_camino' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateDeliveryStatus(order, 'entregado')}
                              className="px-3 py-1.5 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-bold hover:bg-emerald-900 cursor-pointer"
                            >
                              ✅ Marcar Entregado
                            </button>
                          )}

                          {order.deliveryStatus !== 'entregado' && order.deliveryStatus !== 'cancelado' && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeliveryOrderToCancel(order);
                                setCancelDeliveryReason('Cancelación solicitada por cliente');
                              }}
                              className="p-1.5 rounded-xl bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-800/60 cursor-pointer"
                              title="Anular Pedido"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Crear Pedido (el mismo del Home de Pedidos con Domicilio preseleccionado) */}
      {showNewOrderModal && (
        <NewOrderModal
          initialOrderType="domicilio"
          onClose={() => setShowNewOrderModal(false)}
          onSuccess={(_orderId) => {
            setShowNewOrderModal(false);
            showToast('Pedido de domicilio registrado con éxito', 'success');
          }}
        />
      )}


      {/* MODAL 2: Registrar Novedad / Incidencia */}
      {incidenceModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#181818] border border-[#B77900] text-[#FFFDF5] rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2e2e2e]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="font-black text-sm text-[#FFFDF5]">
                  Registrar Novedad — Pedido #{incidenceModalOrder.orderNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIncidenceModalOrder(null)}
                className="p-1 rounded-lg text-[#a8a29e] hover:text-[#FFFDF5]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#a8a29e]">
              Registra imprevistos, entregas fallidas o cambios de dirección reportados por el domiciliario.
            </p>

            <textarea
              rows={3}
              value={incidenceText}
              onChange={(e) => setIncidenceText(e.target.value)}
              placeholder="Ej: Cliente no contesta teléfono en el predio, reprogramado para 15 minutos..."
              className="w-full p-3 rounded-xl bg-[#242424] border border-[#383838] text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIncidenceModalOrder(null)}
                className="px-3.5 py-2 rounded-xl bg-[#242424] text-xs font-bold text-[#a8a29e] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveIncidence}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs cursor-pointer shadow-lg"
              >
                Guardar Novedad
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Agregar Productos / Ronda a Pedido en Curso */}
      {selectedOrderForRound && (
        <AddRoundModal
          order={selectedOrderForRound}
          onClose={() => setSelectedOrderForRound(null)}
          onSuccess={() => {
            setSelectedOrderForRound(null);
            showToast('¡Productos agregados correctamente al pedido!', 'success');
          }}
        />
      )}

      {/* Modal Confirmación Anulación de Domicilio */}
      {deliveryOrderToCancel && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className="bg-[#1a1414] border border-red-700/60 rounded-3xl max-w-md w-full p-5 text-[#FFFDF5] shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-950/80 border border-red-600/60 flex items-center justify-center text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-red-300">¿Anular Domicilio #{deliveryOrderToCancel.orderNumber}?</h3>
                <p className="text-xs text-[#a8a29e]">
                  Cliente: {deliveryOrderToCancel.customerName || 'Cliente'} · Total: {formatCOP(deliveryOrderToCancel.total)}
                </p>
              </div>
            </div>

            <div className="text-xs text-[#d6d3d1] space-y-1 bg-[#261717] p-3 rounded-xl border border-red-900/50">
              <p>• El pedido pasará a estado <strong>Anulado</strong>.</p>
              <p>• Se notificará a cocina KDS la cancelación.</p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#a8a29e] uppercase mb-1">
                Motivo de anulación:
              </label>
              <input
                type="text"
                value={cancelDeliveryReason}
                onChange={(e) => setCancelDeliveryReason(e.target.value)}
                placeholder="Ej: Cliente canceló, dirección fuera de cobertura..."
                className="w-full bg-[#140f0f] border border-red-900/60 rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeliveryOrderToCancel(null)}
                disabled={isCancellingDelivery}
                className="flex-1 py-2 px-3 rounded-xl bg-[#242424] hover:bg-[#333] text-xs font-bold text-[#d6d3d1] cursor-pointer"
              >
                Regresar
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setIsCancellingDelivery(true);
                    await cancelOrder(deliveryOrderToCancel.id, cancelDeliveryReason);
                    showToast(`Domicilio #${deliveryOrderToCancel.orderNumber} anulado`, 'success');
                    setDeliveryOrderToCancel(null);
                  } catch (err: any) {
                    showToast(err.message || 'Error al anular domicilio', 'error');
                  } finally {
                    setIsCancellingDelivery(false);
                  }
                }}
                disabled={isCancellingDelivery}
                className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-red-950/60"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isCancellingDelivery ? 'Anulando...' : 'Confirmar Anulación'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
