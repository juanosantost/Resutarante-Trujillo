import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import { Table, Order, TableStatus } from '../../types';
import { formatCOP } from '../../utils/calculations';
import {
  formatOccupancyDuration,
  getTableStatusConfig,
} from '../../utils/tableOperations';
import { TableDetailModal } from '../modals/TableDetailModal';
import { NewOrderModal } from '../modals/NewOrderModal';
import { AddRoundModal } from '../modals/AddRoundModal';
import { CheckoutModal } from '../modals/CheckoutModal';
import { ReceiptModal } from '../modals/ReceiptModal';
import { RestaurantConfigView } from '../config/RestaurantConfigView';
import {
  Users,
  Clock,
  Plus,
  Receipt,
  Utensils,
  Sparkles,
  AlertCircle,
  Eye,
  CheckCircle2,
  Layers,
  Settings,
  Sliders,
  Search,
  User,
  Coffee,
  RotateCcw,
} from 'lucide-react';

export const TablesView: React.FC = () => {
  const { tables, areas, orders, currentBranch } = useRestaurant();
  const { currentUser } = useAuth();

  // Vista activa: Mapa gráfico vs Configuración de Salones y Mesas
  const [activeSubView, setActiveSubView] = useState<'mapa' | 'configuracion'>('mapa');

  // Filtros
  const [selectedAreaId, setSelectedAreaId] = useState<string>('todos');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [detailTable, setDetailTable] = useState<Table | null>(null);
  const [newOrderTable, setNewOrderTable] = useState<Table | null>(null);
  const [addRoundOrder, setAddRoundOrder] = useState<Order | null>(null);
  const [checkoutOrder, setCheckoutOrder] = useState<Order | null>(null);
  const [lastPayment, setLastPayment] = useState<any | null>(null);

  // Áreas disponibles
  const activeAreas = areas.length > 0 ? areas : [];

  // Filtrado de mesas
  const filteredTables = tables.filter((t) => {
    // Solo mesas activas en el mapa operativo
    if (t.isActive === false) return false;

    // Filtro por Área / Salón
    if (selectedAreaId !== 'todos') {
      if (t.areaId !== selectedAreaId && t.zone !== selectedAreaId) return false;
    }

    // Filtro por Estado
    if (selectedStatusFilter !== 'todos') {
      if (selectedStatusFilter === 'con_cuenta') {
        const hasTab = Boolean(t.hasOpenTab || t.currentOrderId);
        if (!hasTab) return false;
      } else if (t.status !== selectedStatusFilter) {
        return false;
      }
    }

    // Filtro por Búsqueda
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchNum = t.number.toString().includes(q);
      const matchName = t.name ? t.name.toLowerCase().includes(q) : false;
      const matchWaiter = t.assignedWaiterName ? t.assignedWaiterName.toLowerCase().includes(q) : false;
      if (!matchNum && !matchName && !matchWaiter) return false;
    }

    return true;
  });

  // Métricas de salón
  const totalTables = tables.filter((t) => t.isActive !== false).length;
  const occupiedTables = tables.filter(
    (t) => t.isActive !== false && (t.status === 'ocupada' || t.status === 'cuenta_solicitada')
  );
  const cleaningTables = tables.filter((t) => t.isActive !== false && t.status === 'limpieza');
  const freeTables = tables.filter((t) => t.isActive !== false && t.status === 'libre');
  const reservedTables = tables.filter((t) => t.isActive !== false && t.status === 'reservada');
  const maintenanceTables = tables.filter((t) => t.isActive !== false && t.status === 'mantenimiento');

  const occupancyRate = totalTables > 0 ? Math.round((occupiedTables.length / totalTables) * 100) : 0;

  // Consumo activo total en salón
  const activeRoomSales = orders
    .filter((o) => o.status === 'abierto' && o.type === 'mesa')
    .reduce((sum, o) => sum + o.total, 0);

  const getTableOrder = (table: Table): Order | undefined => {
    if (!table.currentOrderId) return undefined;
    return orders.find((o) => o.id === table.currentOrderId && o.status === 'abierto');
  };

  const isAdmin = currentUser?.role === 'administrador';

  // Si está en subvista configuración, mostrar RestaurantConfigView
  if (activeSubView === 'configuracion') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-[#14131a] p-3 rounded-2xl border border-[#2d281e]">
          <span className="text-xs text-[#a8a29e]">
            Estás en el panel de administración de espacios y mesas.
          </span>
          <button
            type="button"
            onClick={() => setActiveSubView('mapa')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs hover:brightness-110 flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Layers className="w-4 h-4" />
            <span>Volver al Mapa Gráfico</span>
          </button>
        </div>
        <RestaurantConfigView />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barra superior de métricas de sala */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="bg-[#181818] p-3.5 rounded-2xl border border-[#2d281e] shadow-md">
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider">
            Ocupación Sala
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-[#FFFDF5]">{occupancyRate}%</span>
            <span className="text-xs text-[#D6A21A] font-semibold">
              {occupiedTables.length}/{totalTables} mesas
            </span>
          </div>
        </div>

        <div className="bg-[#181818] p-3.5 rounded-2xl border border-[#2d281e] shadow-md">
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider">
            Consumo Activo
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-[#D6A21A]">{formatCOP(activeRoomSales)}</span>
          </div>
        </div>

        <div className="bg-[#181818] p-3.5 rounded-2xl border border-[#2d281e] shadow-md">
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider">
            Mesas Libres
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-400">{freeTables.length}</span>
            <span className="text-xs text-[#a8a29e]">Disponibles</span>
          </div>
        </div>

        <div className="bg-[#181818] p-3.5 rounded-2xl border border-[#2d281e] shadow-md">
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider">
            Aseo / Limpieza
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-sky-400">{cleaningTables.length}</span>
            <span className="text-xs text-[#a8a29e]">Pendientes</span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-4 lg:col-span-1 bg-[#181818] p-3.5 rounded-2xl border border-[#B77900]/40 flex items-center justify-between shadow-md">
          <div>
            <span className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider">
              {isAdmin ? 'Configuración' : 'Nuevo Pedido'}
            </span>
            <p className="text-xs text-[#FFFDF5] font-semibold mt-0.5">
              {isAdmin ? 'Salones & Mesas' : 'Comanda directa'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveSubView('configuracion')}
                className="w-9 h-9 rounded-xl bg-[#292212] border border-[#B77900]/50 text-[#D6A21A] flex items-center justify-center font-bold hover:brightness-110 cursor-pointer shadow-md"
                title="Configuración de Salones y Mesas"
                aria-label="Configurar salones y mesas"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setNewOrderTable(null)}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#B77900] to-[#D6A21A] text-[#181818] flex items-center justify-center font-black shadow-lg shadow-[#B77900]/20 hover:brightness-110 cursor-pointer"
              title="Abrir nuevo pedido comercial"
              aria-label="Abrir nuevo pedido"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Selector de Salones / Áreas (Pestañas horizontales) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-b border-[#2d281e]">
        <button
          type="button"
          onClick={() => setSelectedAreaId('todos')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            selectedAreaId === 'todos'
              ? 'bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] shadow-md'
              : 'bg-[#181818] text-[#a8a29e] border border-[#2d281e] hover:bg-[#222]'
          }`}
        >
          Todos los Salones ({tables.filter((t) => t.isActive !== false).length})
        </button>

        {activeAreas.map((area) => {
          const areaCount = tables.filter(
            (t) => t.isActive !== false && (t.areaId === area.id || t.zone === area.name)
          ).length;

          return (
            <button
              key={area.id}
              type="button"
              onClick={() => setSelectedAreaId(area.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                selectedAreaId === area.id
                  ? 'bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] shadow-md'
                  : 'bg-[#181818] text-[#a8a29e] border border-[#2d281e] hover:bg-[#222]'
              }`}
            >
              <span>{area.name}</span>
              <span className="text-[10px] opacity-80">({areaCount})</span>
            </button>
          );
        })}
      </div>

      {/* Barra de Filtros por Estado y Búsqueda */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-3.5 rounded-2xl bg-[#181818] border border-[#2d281e]">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 no-scrollbar">
          {[
            { id: 'todos', label: 'Todas' },
            { id: 'libre', label: `Libres (${freeTables.length})` },
            { id: 'ocupada', label: `Ocupadas (${occupiedTables.length})` },
            { id: 'con_cuenta', label: 'Con Cuenta' },
            { id: 'limpieza', label: `Limpieza (${cleaningTables.length})` },
            { id: 'reservada', label: `Reservadas (${reservedTables.length})` },
            { id: 'mantenimiento', label: `Fuera Serv. (${maintenanceTables.length})` },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setSelectedStatusFilter(pill.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedStatusFilter === pill.id
                  ? 'bg-[#292212] border border-[#D6A21A] text-[#D6A21A]'
                  : 'bg-[#14131a] text-[#a8a29e] border border-transparent hover:border-[#333]'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-64 bg-[#14131a] border border-[#333] px-3 py-1.5 rounded-xl">
          <Search className="w-3.5 h-3.5 text-[#a8a29e]" />
          <input
            type="text"
            placeholder="Buscar mesa o mesero..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-[#FFFDF5] placeholder-[#a8a29e] focus:outline-none w-full"
          />
        </div>
      </div>

      {/* MAPA GRÁFICO: Cuadrícula de Tarjetas Grandes de Mesas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTables.map((table) => {
          const order = getTableOrder(table);
          const statusMeta = getTableStatusConfig(table.status);
          const isOccupied = table.status === 'ocupada' || table.status === 'cuenta_solicitada';
          const hasOpenTab = Boolean(table.hasOpenTab || order);
          const billAmount = order ? order.total : table.currentBillAmount || 0;

          return (
            <div
              key={table.id}
              onClick={() => setDetailTable(table)}
              className={`p-4 rounded-3xl border transition-all flex flex-col justify-between cursor-pointer hover:scale-[1.01] duration-150 relative overflow-hidden shadow-xl ${
                statusMeta.cardBg
              } ${statusMeta.cardBorder}`}
            >
              {/* Franja superior de acento */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: statusMeta.accentColor }}
              />

              {/* Encabezado de la Tarjeta */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-12 h-12 rounded-2xl bg-[#292212] border border-[#B77900]/50 flex items-center justify-center font-black text-xl text-[#D6A21A] shadow-md">
                      {table.number}
                    </span>
                    <div>
                      <h3 className="font-black text-sm text-[#FFFDF5] leading-snug">
                        {table.name || `Mesa #${table.number}`}
                      </h3>
                      <span className="text-[11px] text-[#a8a29e] block">
                        {table.zone || 'Salón Principal'}
                      </span>
                    </div>
                  </div>

                  {/* Badge de Estado Operativo */}
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border tracking-wide shadow-sm ${statusMeta.badgeClass}`}
                  >
                    {statusMeta.label}
                  </span>
                </div>

                {/* Distinción Explícita: Ocupación Física vs Cuenta Abierta */}
                <div className="my-2.5">
                  {hasOpenTab ? (
                    <div className="p-2.5 rounded-xl bg-[#292212]/90 border border-[#B77900]/40 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-[#D6A21A] font-bold">
                        <Receipt className="w-3.5 h-3.5 shrink-0" />
                        <span>Cuenta Abierta</span>
                      </div>
                      <span className="text-xs font-black text-[#FFFDF5] font-mono">
                        {formatCOP(billAmount)}
                      </span>
                    </div>
                  ) : isOccupied ? (
                    <div className="p-2 rounded-xl bg-rose-950/40 border border-rose-600/30 flex items-center gap-1.5 text-[11px] text-rose-300 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping inline-block shrink-0" />
                      <span>Ocupada (Sin comanda abierta)</span>
                    </div>
                  ) : table.status === 'limpieza' ? (
                    <div className="p-2 rounded-xl bg-sky-950/40 border border-sky-600/30 flex items-center gap-1.5 text-[11px] text-sky-300 font-semibold">
                      <RotateCcw className="w-3 h-3 text-sky-400 shrink-0" />
                      <span>Por favor limpiar para recibir comensales</span>
                    </div>
                  ) : table.status === 'reservada' ? (
                    <div className="p-2 rounded-xl bg-purple-950/40 border border-purple-600/30 flex items-center gap-1.5 text-[11px] text-purple-300 font-semibold">
                      <Clock className="w-3 h-3 text-purple-400 shrink-0" />
                      <span>Mesa separada para reserva</span>
                    </div>
                  ) : (
                    <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-600/20 text-[11px] text-emerald-400 font-medium">
                      ✓ Disponible para asignar clientes
                    </div>
                  )}
                </div>

                {/* Ficha de datos: Comensales, Mesero y Cronómetro */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#2d281e]/80">
                  <div className="flex items-center gap-1.5 text-[#d6d3d1]">
                    <Users className="w-3.5 h-3.5 text-[#D6A21A] shrink-0" />
                    <span>
                      {table.partySize ? `${table.partySize} comensales` : `Cap. ${table.capacity} pers.`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[#d6d3d1] truncate">
                    <User className="w-3.5 h-3.5 text-[#D6A21A] shrink-0" />
                    <span className="truncate">
                      {table.assignedWaiterName || (order?.waiterName ?? 'Sin mesero')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pie de tarjeta con tiempo de ocupación y botón rápido */}
              <div className="mt-3.5 pt-2.5 border-t border-[#2d281e] flex items-center justify-between">
                {table.occupiedSince ? (
                  <div className="flex items-center gap-1 text-[11px] text-[#D6A21A] font-semibold">
                    <Clock className="w-3 h-3" />
                    <span>{formatOccupancyDuration(table.occupiedSince)}</span>
                  </div>
                ) : (
                  <span className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider">
                    Toque para detalle
                  </span>
                )}

                {order ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAddRoundOrder(order);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] text-[11px] font-black flex items-center gap-1 hover:brightness-110 shadow cursor-pointer transition-all"
                      title="Agregar productos a este pedido en curso"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Agregar Productos</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailTable(table);
                      }}
                      className="px-2 py-1 rounded-lg bg-[#292212] hover:bg-[#3d3119] border border-[#B77900]/40 text-[#D6A21A] text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Ver detalles de la mesa"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                  </div>
                ) : table.status === 'libre' ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewOrderTable(table);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#292212] hover:bg-[#3d3119] border border-[#B77900]/50 text-[#D6A21A] text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Abrir nuevo pedido comercial en esta mesa"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nuevo Pedido</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailTable(table);
                      }}
                      className="px-2 py-1 rounded-lg bg-[#242424] hover:bg-[#333] text-[#a8a29e] text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      title="Ver detalles de la mesa"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailTable(table);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#292212] hover:bg-[#3d3119] border border-[#B77900]/40 text-[#D6A21A] text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Gestionar</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredTables.length === 0 && (
        <div className="text-center py-16 bg-[#181818] rounded-3xl border border-[#2d281e] text-[#a8a29e] p-6">
          <Layers className="w-12 h-12 mx-auto text-[#B77900] mb-3 opacity-60" />
          <h3 className="text-base font-black text-[#FFFDF5] mb-1">
            No hay mesas con los filtros seleccionados
          </h3>
          <p className="text-xs text-[#d6d3d1] max-w-md mx-auto mb-4">
            Ajusta los filtros de salón o estado, o accede a la configuración para registrar nuevas mesas en esta sucursal.
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveSubView('configuracion')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs hover:brightness-110 cursor-pointer shadow-md inline-flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              <span>Abrir Configuración de Mesas</span>
            </button>
          )}
        </div>
      )}

      {/* Modal Detalle Interactivo de Mesa */}
      {detailTable && (
        <TableDetailModal
          table={detailTable}
          onClose={() => setDetailTable(null)}
          onOpenNewOrder={(t) => {
            setDetailTable(null);
            setNewOrderTable(t);
          }}
          onAddRound={(ord) => {
            setDetailTable(null);
            setAddRoundOrder(ord);
          }}
          onCheckout={(ord) => {
            setDetailTable(null);
            setCheckoutOrder(ord);
          }}
        />
      )}

      {/* Modales de Flujo de Pedidos Existentes */}
      {newOrderTable !== undefined && newOrderTable !== null && (
        <NewOrderModal
          initialTable={newOrderTable}
          onClose={() => setNewOrderTable(null)}
          onSuccess={(orderId) => {
            console.log('Order created:', orderId);
          }}
        />
      )}

      {addRoundOrder && (
        <AddRoundModal
          order={addRoundOrder}
          onClose={() => setAddRoundOrder(null)}
          onSuccess={() => {
            console.log('Round added successfully');
          }}
        />
      )}

      {checkoutOrder && (
        <CheckoutModal
          order={checkoutOrder}
          onClose={() => setCheckoutOrder(null)}
          onPaymentComplete={(payment) => {
            setLastPayment(payment);
            setCheckoutOrder(null);
          }}
        />
      )}

      {lastPayment && (
        <ReceiptModal
          payment={lastPayment}
          order={orders.find((o) => o.id === lastPayment.orderId)}
          onClose={() => setLastPayment(null)}
        />
      )}
    </div>
  );
};
