import React, { useState } from 'react';
import { Table, TableStatus, Order } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  formatOccupancyDuration,
  getTableStatusConfig,
  validateTableStatusTransition,
} from '../../utils/tableOperations';
import { formatCOP } from '../../utils/calculations';
import {
  X,
  Users,
  Clock,
  User,
  Receipt,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Plus,
  RefreshCw,
  Trash2,
  Layers,
} from 'lucide-react';

interface TableDetailModalProps {
  table: Table;
  onClose: () => void;
  onOpenNewOrder: (table: Table) => void;
  onAddRound?: (order: Order) => void;
  onCheckout?: (order: Order) => void;
}

export const TableDetailModal: React.FC<TableDetailModalProps> = ({
  table,
  onClose,
  onOpenNewOrder,
  onAddRound,
  onCheckout,
}) => {
  const { setTableStatus, liberateTable, orders, staffName, userRole, cancelOrder } = useRestaurant();
  const { allUsers } = useAuth();
  const { showToast } = useToast();

  const [selectedStatus, setSelectedStatus] = useState<TableStatus>(table.status);
  const [partySize, setPartySize] = useState<number>(table.partySize || table.capacity || 2);
  const [assignedWaiterName, setAssignedWaiterName] = useState<string>(
    table.assignedWaiterName || (userRole === 'asesor' || userRole === 'mesero' ? staffName : '')
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('Cancelación por el cliente');

  // Buscar comanda / pedido abierto si existe
  const activeOrder = table.currentOrderId
    ? orders.find((o) => o.id === table.currentOrderId && o.status === 'abierto')
    : undefined;

  const hasOpenTab = Boolean(table.hasOpenTab || activeOrder);
  const statusMeta = getTableStatusConfig(table.status);

  // Lista de camareros disponibles para asignar
  const waiters = allUsers.filter((u) => u.isActive && (u.role === 'mesero' || u.role === 'supervisor' || u.role === 'administrador'));

  const handleStatusChange = async (newStatus: TableStatus) => {
    setValidationError(null);
    const check = validateTableStatusTransition(table.status, newStatus, hasOpenTab);
    if (!check.isValid) {
      setValidationError(check.error || 'Transición no permitida.');
      return;
    }

    try {
      setIsSubmitting(true);
      await setTableStatus(table.id, newStatus, {
        waiterName: assignedWaiterName || undefined,
        partySize,
      });
      setSelectedStatus(newStatus);
      showToast(`Estado de ${table.name || `Mesa ${table.number}`} cambiado a "${newStatus}"`, 'success');
    } catch (err: any) {
      setValidationError(err.message || 'Error al cambiar estado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDetails = async () => {
    try {
      setIsSubmitting(true);
      await setTableStatus(table.id, selectedStatus, {
        waiterName: assignedWaiterName || undefined,
        partySize,
      });
      showToast('Detalles de mesa actualizados', 'success');
      onClose();
    } catch (err: any) {
      setValidationError(err.message || 'Error al actualizar detalles.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLiberate = async (toCleaning: boolean) => {
    if (hasOpenTab) {
      setValidationError('No se puede liberar una mesa con cuenta activa. Primero debe facturar o cancelar el pedido.');
      return;
    }
    try {
      setIsSubmitting(true);
      await liberateTable(table.id, toCleaning);
      showToast(
        toCleaning
          ? `${table.name || `Mesa ${table.number}`} enviada a Limpieza`
          : `${table.name || `Mesa ${table.number}`} marcada como Libre`,
        'success'
      );
      onClose();
    } catch (err: any) {
      setValidationError(err.message || 'Error al liberar mesa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!activeOrder) return;
    try {
      setIsSubmitting(true);
      await cancelOrder(activeOrder.id, cancelReason);
      showToast(`Pedido #${activeOrder.orderNumber} anulado y mesa ${table.name || table.number} liberada`, 'success');
      setShowCancelModal(false);
      onClose();
    } catch (err: any) {
      setValidationError(err.message || 'Error al anular pedido');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#181818] border border-[#B77900]/40 rounded-3xl max-w-lg w-full p-5 sm:p-6 text-[#FFFDF5] shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="flex items-start justify-between pb-4 border-b border-[#2d281e]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#D6A21A] bg-[#292212] px-2.5 py-0.5 rounded-full border border-[#B77900]/30">
                {table.zone || 'Salón Principal'}
              </span>
              <span className="text-xs text-[#a8a29e]">· Capacidad: {table.capacity} personas</span>
            </div>
            <h2 className="text-2xl font-black text-[#FFFDF5] flex items-center gap-2">
              {table.name || `Mesa #${table.number}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#242424] hover:bg-[#333] text-[#d6d3d1] hover:text-[#FFFDF5] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje de validación / error si existe */}
        {validationError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/60 border border-rose-600/50 text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Resumen del Estado Actual */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className={`p-3.5 rounded-2xl border ${statusMeta.cardBg} ${statusMeta.cardBorder}`}>
            <span className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider">
              Estado Operativo
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full`}
                style={{ backgroundColor: statusMeta.accentColor }}
              />
              <span className="font-bold text-sm text-[#FFFDF5]">{statusMeta.label}</span>
            </div>
            <p className="text-[11px] text-[#d6d3d1] mt-1">{statusMeta.description}</p>
          </div>

          <div className="p-3.5 rounded-2xl border border-[#2d281e] bg-[#14131a]">
            <span className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider">
              Ocupación & Cuenta
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              {hasOpenTab ? (
                <span className="text-xs font-bold text-[#D6A21A] bg-[#292212] px-2 py-0.5 rounded-lg border border-[#B77900]/40">
                  Cuenta Abierta
                </span>
              ) : table.status === 'ocupada' ? (
                <span className="text-xs font-semibold text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded-lg border border-rose-600/40">
                  Mesa Ocupada (Sin comanda)
                </span>
              ) : (
                <span className="text-xs text-[#a8a29e]">Sin comensales</span>
              )}
            </div>
            {table.occupiedSince && (
              <div className="flex items-center gap-1 text-[11px] text-[#D6A21A] mt-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Tiempo: {formatOccupancyDuration(table.occupiedSince)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Selector de Cambios de Estado Rápido */}
        <div className="mt-4">
          <label className="block text-[11px] font-bold text-[#a8a29e] uppercase tracking-wider mb-2">
            Cambiar Estado de la Mesa
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(
              [
                { id: 'libre', label: 'Libre', color: 'border-emerald-600 text-emerald-400' },
                { id: 'ocupada', label: 'Ocupada', color: 'border-rose-600 text-rose-300' },
                { id: 'reservada', label: 'Reservada', color: 'border-purple-600 text-purple-300' },
                { id: 'limpieza', label: 'Limpieza', color: 'border-sky-600 text-sky-300' },
                { id: 'mantenimiento', label: 'Fuera Serv.', color: 'border-stone-600 text-stone-300' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                disabled={isSubmitting}
                onClick={() => handleStatusChange(st.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                  table.status === st.id
                    ? 'bg-[#292212] border-[#D6A21A] text-[#D6A21A] shadow-md'
                    : 'bg-[#14131a] border-[#2d281e] text-[#d6d3d1] hover:border-[#3d382e]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Asignación de Mesero y Comensales */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#14131a] border border-[#2d281e]">
          <div>
            <label className="block text-[10px] font-bold text-[#a8a29e] uppercase tracking-wider mb-1">
              Mesero Asignado
            </label>
            <select
              value={assignedWaiterName}
              onChange={(e) => setAssignedWaiterName(e.target.value)}
              className="w-full bg-[#1c1b24] border border-[#333] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
            >
              <option value="">(Sin mesero asignado)</option>
              {waiters.map((w) => (
                <option key={w.id} value={w.fullName}>
                  {w.fullName}
                </option>
              ))}
              {staffName && !waiters.some((w) => w.fullName === staffName) && (
                <option value={staffName}>{staffName}</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#a8a29e] uppercase tracking-wider mb-1">
              Comensales en Mesa
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="20"
                value={partySize}
                onChange={(e) => setPartySize(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-[#1c1b24] border border-[#333] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
              />
              <span className="text-[11px] text-[#a8a29e] whitespace-nowrap">personas</span>
            </div>
          </div>
        </div>

        {/* Sección de Cuenta / Pedido Activo */}
        <div className="mt-4 p-4 rounded-2xl bg-[#14131a] border border-[#2d281e]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[#a8a29e] uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-[#D6A21A]" />
              Consumo de la Mesa
            </span>
            {activeOrder && (
              <span className="text-xs font-black text-[#D6A21A]">
                Total: {formatCOP(activeOrder.total)}
              </span>
            )}
          </div>

          {activeOrder ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[#d6d3d1]">
                <span>Pedido #{activeOrder.orderNumber}</span>
                <span className="text-[#a8a29e]">{activeOrder.items.length} productos solicitados</span>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1 text-xs">
                {activeOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] text-[#a8a29e] border-b border-[#24211a] pb-1">
                    <span>
                      {item.quantity}x {item.name}
                    </span>
                    <span className="font-mono text-[#d6d3d1]">{formatCOP(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                {onAddRound && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onAddRound(activeOrder);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#292212] border border-[#B77900]/60 text-[#D6A21A] text-xs font-bold hover:brightness-110 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>+ Agregar Productos</span>
                  </button>
                )}
                {onCheckout && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onCheckout(activeOrder);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] text-xs font-black hover:brightness-110 flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Cobrar Cuenta</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="py-2 px-3 rounded-xl bg-red-950/70 hover:bg-red-900 border border-red-700/60 text-red-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  title="Anular este pedido y liberar la mesa"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Anular Pedido</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-3">
              <p className="text-xs text-[#a8a29e] mb-3">
                No hay pedidos ni comandas abiertas registradas en esta mesa.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenNewOrder(table);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] text-xs font-black hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Abrir Pedido / Comanda en Mesa</span>
              </button>
            </div>
          )}
        </div>

        {/* Acciones de Liberación y Guardado */}
        <div className="mt-5 pt-3 border-t border-[#2d281e] flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isSubmitting || hasOpenTab}
              onClick={() => handleLiberate(true)}
              className="px-3 py-2 rounded-xl bg-sky-950/40 border border-sky-600/40 text-sky-300 text-xs font-bold hover:bg-sky-950/80 disabled:opacity-40 cursor-pointer"
              title="Libera la mesa y la pasa a estado Limpieza"
            >
              Pasar a Limpieza
            </button>
            <button
              type="button"
              disabled={isSubmitting || hasOpenTab}
              onClick={() => handleLiberate(false)}
              className="px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-600/40 text-emerald-300 text-xs font-bold hover:bg-emerald-950/80 disabled:opacity-40 cursor-pointer"
              title="Marca la mesa como totalmente lista y Libre"
            >
              Marcar Libre
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#242424] hover:bg-[#333] text-[#d6d3d1] text-xs font-bold cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSaveDetails}
              className="px-4 py-2 rounded-xl bg-[#B77900] text-[#181818] font-black text-xs hover:bg-[#D6A21A] cursor-pointer"
            >
              Guardar Cambios
            </button>
          </div>
        </div>

        {/* Modal de Confirmación de Anulación */}
        {showCancelModal && activeOrder && (
          <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div
              className="bg-[#1a1414] border border-red-700/60 rounded-3xl max-w-md w-full p-5 text-[#FFFDF5] shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-950/80 border border-red-600/60 flex items-center justify-center text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-red-300">¿Anular Pedido #{activeOrder.orderNumber}?</h3>
                  <p className="text-xs text-[#a8a29e]">
                    Mesa: {table.name || table.number} · Total: {formatCOP(activeOrder.total)}
                  </p>
                </div>
              </div>

              <div className="text-xs text-[#d6d3d1] space-y-1 bg-[#261717] p-3 rounded-xl border border-red-900/50">
                <p>• El pedido pasará a estado <strong>Anulado</strong>.</p>
                <p>• La mesa se liberará automáticamente para nuevos clientes.</p>
                <p>• Las comandas pendientes en Cocina KDS se cancelarán.</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#a8a29e] uppercase mb-1">
                  Motivo de anulación:
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ej: Cliente se retiró, error al ordenar..."
                  className="w-full bg-[#140f0f] border border-red-900/60 rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-red-500"
                />
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {['Cliente se retiró', 'Error de digitación', 'Demora en cocina', 'Cambio de mesa'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setCancelReason(r)}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-[#2a1717] border border-red-900/40 text-red-300 hover:bg-red-950 cursor-pointer"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#242424] hover:bg-[#333] text-xs font-bold text-[#d6d3d1] cursor-pointer"
                >
                  Regresar
                </button>
                <button
                  type="button"
                  onClick={handleCancelOrder}
                  disabled={isSubmitting}
                  className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-red-950/60"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'Anulando...' : 'Confirmar Anulación'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
