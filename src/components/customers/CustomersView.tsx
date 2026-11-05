import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import {
  Customer,
  DocumentType,
  CustomerStatus,
  Separado,
  CarteraRecord,
  Abono,
  Order,
} from '../../types';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { calculateCustomerMetrics } from '../../utils/creditAndLayawayUtils';
import { generateWhatsAppMessage, DEFAULT_LOYALTY_CONFIG } from '../../utils/loyaltyUtils';
import { CustomerModal } from './CustomerModal';
import { AbonoReceiptModal } from '../modals/AbonoReceiptModal';
import {
  Users,
  Search,
  Plus,
  Phone,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  History,
  Award,
  Settings,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  CreditCard,
  BookmarkCheck,
  DollarSign,
  Calendar,
  ChevronRight,
  ArrowLeft,
  Edit2,
  Receipt,
  UserCheck,
  UserX,
  Building,
  User,
  MapPin,
  Clock,
  Sparkles,
} from 'lucide-react';

interface CustomersViewProps {
  onNavigateToView?: (view: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({ onNavigateToView }) => {
  const {
    customers,
    orders,
    separados,
    cartera,
    abonos,
    loyaltyTransactions,
    currentBranch,
    updateCustomer,
    toggleCustomerStatus,
    actionLoading,
  } = useRestaurant();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeCustomerTab, setActiveCustomerTab] = useState<'compras' | 'separados' | 'cartera' | 'movimientos' | 'datos'>('compras');

  // Modal Crear/Editar Cliente
  const [showCustomerModal, setShowCustomerModal] = useState<boolean>(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);

  // Modal Comprobante Térmico de Abono
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [receiptAbono, setReceiptAbono] = useState<Abono | null>(null);

  // Filtrado de clientes
  const filteredCustomers = customers.filter((c) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(query) ||
      c.documentNumber.includes(query) ||
      c.phone.includes(query) ||
      (c.observations && c.observations.toLowerCase().includes(query)) ||
      (c.address && c.address.toLowerCase().includes(query)) ||
      (c.neighborhood && c.neighborhood.toLowerCase().includes(query));

    if (!matchesSearch) return false;
    if (statusFilter === 'activos') return c.status === 'activo';
    if (statusFilter === 'inactivos') return c.status === 'inactivo' || c.status === 'vetado';
    return true;
  });

  // Métricas globales
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter((c) => c.status === 'activo').length;
  const totalCarteraGlobal = cartera
    .filter((c) => c.status !== 'pagada' && c.status !== 'anulada')
    .reduce((acc, c) => acc + (c.balanceDue || 0), 0);
  const totalSeparadosGlobal = separados
    .filter((s) => s.status === 'activo')
    .reduce((acc, s) => acc + (s.pendingBalance || 0), 0);

  // Métricas del cliente seleccionado
  const customerMetrics = selectedCustomer
    ? calculateCustomerMetrics(selectedCustomer.id, selectedCustomer.name, orders, separados, cartera)
    : null;

  // Documentos del cliente seleccionado
  const customerOrders = selectedCustomer
    ? orders.filter(
        (o) =>
          o.status === 'facturado' &&
          ((o.customerName && o.customerName.toLowerCase() === selectedCustomer.name.toLowerCase()) ||
            (o as any).customerId === selectedCustomer.id)
      )
    : [];

  const customerSeparados = selectedCustomer
    ? separados.filter((s) => s.customerId === selectedCustomer.id)
    : [];

  const customerCartera = selectedCustomer
    ? cartera.filter((c) => c.customerId === selectedCustomer.id)
    : [];

  const customerAbonos = selectedCustomer
    ? abonos.filter((a) => a.customerId === selectedCustomer.id)
    : [];

  const handleOpenWhatsApp = (customer: Customer, templateType: 'bienvenida' | 'promocion' | 'fidelizacion') => {
    const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
    const message = generateWhatsAppMessage(templateType, customer.name, { points: customer.loyaltyPoints });
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleToggleStatus = async (customer: Customer) => {
    const newStatus: CustomerStatus = customer.status === 'activo' ? 'inactivo' : 'activo';
    try {
      await toggleCustomerStatus(customer.id, newStatus);
      showToast(
        `Cliente marcado como ${newStatus === 'activo' ? 'Activo' : 'Inactivo'}`,
        'info'
      );
      if (selectedCustomer && selectedCustomer.id === customer.id) {
        setSelectedCustomer({ ...selectedCustomer, status: newStatus });
      }
    } catch (err: any) {
      showToast('Error al cambiar estado del cliente', 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Tarjetas de Resumen Global */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#a8a29e] tracking-wider">
            Total Clientes Registrados
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-[#FFFDF5]">{totalCustomers}</span>
            <span className="text-xs text-[#a8a29e]">({activeCustomers} activos)</span>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#a8a29e] tracking-wider">
            Saldo Total en Cartera
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-amber-400">{formatCOP(totalCarteraGlobal)}</span>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#a8a29e] tracking-wider">
            Saldo Total en Separados
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-[#D6A21A]">{formatCOP(totalSeparadosGlobal)}</span>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#a8a29e] tracking-wider">
            Autorizados Habeas Data
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-400">
              {customers.filter((c) => c.consent?.dataProcessingAuthorized).length}
            </span>
            <span className="text-xs text-[#a8a29e]">Ley 1581</span>
          </div>
        </div>
      </div>

      {/* 2. Vista Principal: Directorio o Ficha de Cliente Detallada */}
      {!selectedCustomer ? (
        <div className="space-y-4">
          
          {/* Barra de Búsqueda y Filtros */}
          <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Filtros de Estado */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
              {(['todos', 'activos', 'inactivos'] as const).map((key) => (
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
                  {key === 'todos' ? 'Todos los Clientes' : key === 'activos' ? 'Activos' : 'Inactivos'}
                </button>
              ))}
            </div>

            {/* Búsqueda y Botón Nuevo Cliente */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#a8a29e]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre, cédula, NIT, celular o barrio..."
                  className="w-full bg-[#121214] border border-[#333333] rounded-xl pl-9 pr-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setCustomerToEdit(null);
                  setShowCustomerModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] text-xs font-black inline-flex items-center gap-1.5 hover:brightness-110 shadow-lg cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Cliente</span>
              </button>
            </div>
          </div>

          {/* Listado de Clientes en Cuadrícula */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((cust) => {
                const isActive = cust.status === 'activo';
                const isCompany = cust.documentType === 'NIT';

                return (
                  <div
                    key={cust.id}
                    className="bg-[#181818] border border-[#2d281e] hover:border-[#B77900]/50 rounded-3xl p-5 flex flex-col justify-between shadow-md transition-all group cursor-pointer"
                    onClick={() => setSelectedCustomer(cust)}
                  >
                    <div>
                      {/* Cabecera Tarjeta */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-[#292212] border border-[#B77900]/40 flex items-center justify-center text-[#D6A21A] flex-shrink-0 group-hover:scale-105 transition-transform">
                            {isCompany ? <Building className="w-5 h-5" /> : <User className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#242424] text-[#D6A21A] border border-[#383838]">
                                {cust.documentType} {cust.documentNumber}
                              </span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                                  isActive
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : 'bg-neutral-800 text-neutral-400'
                                }`}
                              >
                                {cust.status}
                              </span>
                            </div>
                            <h4 className="font-black text-[#FFFDF5] text-sm mt-1 leading-snug group-hover:text-[#D6A21A] transition-colors">
                              {cust.name}
                            </h4>
                          </div>
                        </div>
                      </div>

                      {/* Datos de Contacto y Ubicación */}
                      <div className="space-y-1.5 text-xs text-[#a8a29e] mb-3">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-[#D6A21A]" />
                          <span className="text-[#FFFDF5] font-mono">{cust.phone}</span>
                        </div>
                        {cust.address && (
                          <div className="flex items-center gap-1.5 truncate">
                            <MapPin className="w-3.5 h-3.5 text-[#a8a29e]" />
                            <span className="truncate">
                              {cust.address} {cust.neighborhood && `· ${cust.neighborhood}`}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Puntos y Métricas */}
                      <div className="grid grid-cols-2 gap-2 p-2.5 bg-[#121214] rounded-2xl border border-[#242424] text-xs">
                        <div>
                          <span className="text-[10px] text-[#a8a29e] block">Puntos Colmena:</span>
                          <span className="font-black text-[#D6A21A] flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-[#D6A21A]" />
                            {cust.loyaltyPoints || 0} pts
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#a8a29e] block">Visitas:</span>
                          <span className="font-bold text-[#FFFDF5]">
                            {cust.visitsCount || 0} visitas
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Acciones Rápidas */}
                    <div className="pt-3 border-t border-[#2d281e] flex items-center justify-between gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenWhatsApp(cust, 'bienvenida')}
                        className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 hover:bg-emerald-900 transition-colors cursor-pointer"
                        title="Abrir WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCustomerToEdit(cust);
                          setShowCustomerModal(true);
                        }}
                        className="p-2 rounded-xl bg-[#242424] text-[#d6d3d1] hover:text-[#FFFDF5] hover:bg-[#2d2d2d] transition-colors cursor-pointer"
                        title="Editar Datos"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedCustomer(cust)}
                        className="px-3 py-1.5 rounded-xl bg-[#292212] border border-[#B77900]/40 text-[#D6A21A] hover:bg-[#B77900] hover:text-[#181818] text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-all ml-auto"
                      >
                        <span>Ver Historial</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full bg-[#181818] border border-[#2d281e] rounded-3xl p-12 text-center text-[#a8a29e]">
                <Users className="w-12 h-12 mx-auto text-[#B77900] mb-3 opacity-60" />
                <p className="text-base font-bold text-[#FFFDF5]">No se encontraron clientes</p>
                <p className="text-xs text-[#a8a29e] mt-1">
                  Ajusta los términos de búsqueda o registra un nuevo cliente en el sistema.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        // 3. VISTA DE DETALLE: FICHA COMPLETA E HISTORIAL DEL CLIENTE
        <div className="space-y-6">
          
          {/* Botón Volver y Barra Superior de la Ficha */}
          <div className="bg-[#181818] border border-[#2d281e] p-5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="p-2 rounded-2xl bg-[#242424] hover:bg-[#2d2d2d] text-[#D6A21A] border border-[#383838] transition-colors cursor-pointer"
                title="Volver al directorio"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#292212] border border-[#B77900]/40 flex items-center justify-center text-[#D6A21A]">
                  {selectedCustomer.documentType === 'NIT' ? <Building className="w-6 h-6" /> : <User className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-[#FFFDF5]">
                      {selectedCustomer.name}
                    </h2>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        selectedCustomer.status === 'activo'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {selectedCustomer.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#a8a29e] mt-0.5">
                    <span>{selectedCustomer.documentType}: <strong className="text-[#FFFDF5]">{selectedCustomer.documentNumber}</strong></span>
                    <span>·</span>
                    <span>Celular: <strong className="text-[#FFFDF5] font-mono">{selectedCustomer.phone}</strong></span>
                    {selectedCustomer.neighborhood && <span>· Barrio: {selectedCustomer.neighborhood}</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Acciones Rápidas del Cliente */}
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => handleOpenWhatsApp(selectedCustomer, 'fidelizacion')}
                className="px-3.5 py-2 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-300 hover:bg-emerald-900 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCustomerToEdit(selectedCustomer);
                  setShowCustomerModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-[#242424] hover:bg-[#2d2d2d] text-[#FFFDF5] font-bold text-xs inline-flex items-center gap-1.5 border border-[#383838] cursor-pointer whitespace-nowrap"
              >
                <Edit2 className="w-4 h-4 text-[#D6A21A]" />
                <span>Editar Cliente</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleStatus(selectedCustomer)}
                className="px-3 py-2 rounded-xl border border-[#444444] text-[#a8a29e] hover:text-[#FFFDF5] hover:bg-[#242424] text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                {selectedCustomer.status === 'activo' ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>

          {/* 5 Tarjetas de Métricas del Historial */}
          {customerMetrics && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl">
                <span className="text-[10px] uppercase font-bold text-[#a8a29e]">Total Compras</span>
                <span className="text-lg font-black font-mono text-emerald-400 block mt-1">
                  {formatCOP(customerMetrics.totalPurchasesAmount)}
                </span>
                <span className="text-[10px] text-[#a8a29e]">acumulado facturado</span>
              </div>

              <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl">
                <span className="text-[10px] uppercase font-bold text-[#a8a29e]">Cantidad de Compras</span>
                <span className="text-xl font-black text-[#FFFDF5] block mt-1">
                  {customerMetrics.totalPurchasesCount}
                </span>
                <span className="text-[10px] text-[#a8a29e]">pedidos completados</span>
              </div>

              <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl">
                <span className="text-[10px] uppercase font-bold text-[#a8a29e]">Saldo en Cartera</span>
                <span className="text-lg font-black font-mono text-amber-400 block mt-1">
                  {formatCOP(customerMetrics.carteraBalance)}
                </span>
                <span className="text-[10px] text-amber-400/80">créditos pendientes</span>
              </div>

              <div className="bg-[#181818] border border-[#2d281e] p-4 rounded-3xl">
                <span className="text-[10px] uppercase font-bold text-[#a8a29e]">Saldo en Separados</span>
                <span className="text-lg font-black font-mono text-[#D6A21A] block mt-1">
                  {formatCOP(customerMetrics.separadosBalance)}
                </span>
                <span className="text-[10px] text-[#a8a29e]">reservas activas</span>
              </div>

              <div className="col-span-2 lg:col-span-1 bg-[#181818] border border-[#2d281e] p-4 rounded-3xl">
                <span className="text-[10px] uppercase font-bold text-[#a8a29e]">Última Compra</span>
                <span className="text-xs font-bold text-[#FFFDF5] block mt-1 truncate">
                  {customerMetrics.lastPurchaseDate
                    ? formatColombiaDateTime(customerMetrics.lastPurchaseDate)
                    : 'Sin compras previas'}
                </span>
                <span className="text-[10px] text-[#a8a29e]">fecha de visita</span>
              </div>
            </div>
          )}

          {/* 5 Pestañas de Detalle */}
          <div className="bg-[#181818] border border-[#2d281e] rounded-3xl overflow-hidden shadow-md">
            
            {/* Navegación entre pestañas */}
            <div className="border-b border-[#2d281e] flex items-center gap-2 px-4 overflow-x-auto no-scrollbar bg-[#141318]">
              {[
                { id: 'compras', label: 'Compras & Pedidos', count: customerOrders.length, icon: ShoppingBag },
                { id: 'separados', label: 'Separados & Reservas', count: customerSeparados.length, icon: BookmarkCheck },
                { id: 'cartera', label: 'Cartera & Créditos', count: customerCartera.length, icon: CreditCard },
                { id: 'movimientos', label: 'Movimientos & Abonos', count: customerAbonos.length, icon: Receipt },
                { id: 'datos', label: 'Datos & Ficha Técnica', icon: Settings },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeCustomerTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveCustomerTab(tab.id as any)}
                    className={`flex items-center gap-2 py-4 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'border-[#B77900] text-[#D6A21A]'
                        : 'border-transparent text-[#a8a29e] hover:text-[#FFFDF5]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#242424] text-[#d6d3d1]">
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Contenido de la Pestaña Activa */}
            <div className="p-6">
              
              {/* TAB 1: COMPRAS */}
              {activeCustomerTab === 'compras' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-black text-[#FFFDF5]">
                      Historial de Ventas y Facturas
                    </h3>
                  </div>

                  {customerOrders.length > 0 ? (
                    <div className="divide-y divide-[#242424]">
                      {customerOrders.map((ord) => (
                        <div key={ord.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[#D6A21A]">
                                Pedido #{ord.orderNumber}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 uppercase font-bold">
                                {ord.status}
                              </span>
                              <span className="text-[11px] text-[#a8a29e] capitalize">
                                {ord.type}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#a8a29e] block mt-0.5">
                              {formatColombiaDateTime(ord.createdAt)} · {ord.items.length} productos
                            </span>
                          </div>
                          <span className="font-mono font-black text-sm text-[#FFFDF5]">
                            {formatCOP(ord.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#a8a29e] py-8 text-center">
                      No hay compras facturadas para este cliente
                    </p>
                  )}
                </div>
              )}

              {/* TAB 2: SEPARADOS */}
              {activeCustomerTab === 'separados' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-black text-[#FFFDF5]">
                      Separados y Pedidos Programados
                    </h3>
                  </div>

                  {customerSeparados.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {customerSeparados.map((sep) => (
                        <div key={sep.id} className="p-4 rounded-2xl bg-[#121214] border border-[#242424] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs text-[#D6A21A]">{sep.code}</span>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300">
                              {sep.status}
                            </span>
                          </div>
                          <div className="text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-[#a8a29e]">Valor Total:</span>
                              <span className="font-mono text-[#FFFDF5] font-bold">{formatCOP(sep.totalAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#a8a29e]">Total Abonado:</span>
                              <span className="font-mono text-emerald-400">{formatCOP(sep.totalAbonado)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-amber-400 pt-1 border-t border-[#242424]">
                              <span>Saldo Pendiente:</span>
                              <span className="font-mono">{formatCOP(sep.pendingBalance)}</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-[#a8a29e]">
                            Fecha Entrega: <strong className="text-[#FFFDF5]">{sep.deliveryDate}</strong> {sep.deliveryTime}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#a8a29e] py-8 text-center">
                      Este cliente no tiene registros de separados
                    </p>
                  )}
                </div>
              )}

              {/* TAB 3: CARTERA */}
              {activeCustomerTab === 'cartera' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-black text-[#FFFDF5]">
                      Cuentas de Cartera y Ventas a Crédito
                    </h3>
                  </div>

                  {customerCartera.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {customerCartera.map((crd) => (
                        <div key={crd.id} className="p-4 rounded-2xl bg-[#121214] border border-[#242424] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs text-[#D6A21A]">{crd.code}</span>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300">
                              {crd.status}
                            </span>
                          </div>
                          <div className="text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-[#a8a29e]">Valor Original:</span>
                              <span className="font-mono text-[#FFFDF5] font-bold">{formatCOP(crd.totalAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#a8a29e]">Total Abonado:</span>
                              <span className="font-mono text-emerald-400">{formatCOP(crd.totalAbonado)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-amber-400 pt-1 border-t border-[#242424]">
                              <span>Saldo por Cobrar:</span>
                              <span className="font-mono">{formatCOP(crd.balanceDue)}</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-[#a8a29e]">
                            Vence: <strong className="text-[#FFFDF5]">{crd.dueDate}</strong>
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#a8a29e] py-8 text-center">
                      No hay cuentas de cartera para este cliente
                    </p>
                  )}
                </div>
              )}

              {/* TAB 4: MOVIMIENTOS Y ABONOS */}
              {activeCustomerTab === 'movimientos' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-black text-[#FFFDF5]">
                      Movimientos Financieros y Abonos Registrados
                    </h3>
                  </div>

                  {customerAbonos.length > 0 ? (
                    <div className="divide-y divide-[#242424]">
                      {customerAbonos.map((ab) => (
                        <div key={ab.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[#D6A21A]">
                                {ab.receiptNumber}
                              </span>
                              <span
                                className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                  ab.status === 'anulado'
                                    ? 'bg-red-900 text-red-200'
                                    : 'bg-emerald-950 text-emerald-300'
                                }`}
                              >
                                {ab.status}
                              </span>
                              <span className="text-[10px] text-[#a8a29e]">
                                {ab.parentType === 'separado' ? 'Abono Separado' : 'Abono Cartera'}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#a8a29e] block mt-0.5">
                              {formatColombiaDateTime(ab.createdAt)} · {ab.paymentMethod}
                            </span>
                            {ab.notes && <p className="text-[10px] text-neutral-400 italic">{ab.notes}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-[#FFFDF5]">
                              {formatCOP(ab.amount)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setReceiptAbono(ab);
                                setShowReceiptModal(true);
                              }}
                              className="p-1.5 rounded-lg bg-[#242424] text-[#D6A21A] hover:bg-[#B77900] hover:text-[#181818] cursor-pointer"
                              title="Reimprimir Comprobante"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#a8a29e] py-8 text-center">
                      No se han registrado abonos financieros para este cliente
                    </p>
                  )}
                </div>
              )}

              {/* TAB 5: DATOS Y FICHA TÉCNICA */}
              {activeCustomerTab === 'datos' && (
                <div className="space-y-4 max-w-xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-[#FFFDF5]">
                      Información Comercial del Cliente
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerToEdit(selectedCustomer);
                        setShowCustomerModal(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#292212] border border-[#B77900]/40 text-[#D6A21A] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Modificar Datos</span>
                    </button>
                  </div>

                  <div className="bg-[#121214] p-4 rounded-2xl border border-[#242424] space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-[#242424]">
                      <span className="text-[#a8a29e]">Tipo de Documento:</span>
                      <span className="font-bold text-[#FFFDF5]">{selectedCustomer.documentType}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#242424]">
                      <span className="text-[#a8a29e]">Número de Documento:</span>
                      <span className="font-mono font-bold text-[#FFFDF5]">{selectedCustomer.documentNumber}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#242424]">
                      <span className="text-[#a8a29e]">Nombre / Razón Social:</span>
                      <span className="font-bold text-[#FFFDF5]">{selectedCustomer.name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#242424]">
                      <span className="text-[#a8a29e]">Celular con Indicativo:</span>
                      <span className="font-mono text-[#FFFDF5]">{selectedCustomer.phone}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#242424]">
                      <span className="text-[#a8a29e]">Dirección:</span>
                      <span className="text-[#FFFDF5]">{selectedCustomer.address || 'No registrada'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#242424]">
                      <span className="text-[#a8a29e]">Barrio / Zona:</span>
                      <span className="text-[#FFFDF5]">{selectedCustomer.neighborhood || 'No registrado'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#242424]">
                      <span className="text-[#a8a29e]">Estado en Sistema:</span>
                      <span className="capitalize font-bold text-[#D6A21A]">{selectedCustomer.status}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-[#a8a29e]">Fecha de Creación:</span>
                      <span className="text-[#a8a29e]">{formatColombiaDateTime(selectedCustomer.createdAt)}</span>
                    </div>
                  </div>

                  {selectedCustomer.observations && (
                    <div className="p-3 bg-[#121214] rounded-2xl border border-[#242424] text-xs">
                      <span className="font-bold text-[#a8a29e] block mb-1">Observaciones:</span>
                      <p className="text-[#FFFDF5] italic">{selectedCustomer.observations}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL CREAR / EDITAR CLIENTE */}
      <CustomerModal
        isOpen={showCustomerModal}
        onClose={() => {
          setShowCustomerModal(false);
          setCustomerToEdit(null);
        }}
        editingCustomer={customerToEdit}
      />

      {/* 5. MODAL REIMPRESIÓN COMPROBANTE TÉRMICO */}
      <AbonoReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        abono={receiptAbono}
        branch={currentBranch}
      />
    </div>
  );
};
