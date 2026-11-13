import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import { Order, OrderType, OrderStatus } from '../../types';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { AddRoundModal } from '../modals/AddRoundModal';
import { CheckoutModal } from '../modals/CheckoutModal';
import { ReceiptModal } from '../modals/ReceiptModal';
import { NewOrderModal } from '../modals/NewOrderModal';
import { KitchenTicketModal } from '../modals/KitchenTicketModal';
import { formatModifiersDisplaySummary } from '../../utils/orderModifierUtils';
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
  CheckCircle,
  Eye,
  Filter,
  Trash2,
  AlertTriangle,
  X,
  Printer,
  ChefHat,
  RotateCcw,
} from 'lucide-react';

export const OrdersView: React.FC = () => {
  const { orders, currentBranch, cancelOrder, toggleOrderItemCancelled } = useRestaurant();
  const { showToast } = useToast();

  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [showNewOrderModal, setShowNewOrderModal] = useState<boolean>(false);
  const [selectedOrderForRound, setSelectedOrderForRound] = useState<Order | null>(null);
  const [selectedOrderForCheckout, setSelectedOrderForCheckout] = useState<Order | null>(null);
  const [selectedOrderForKitchenPrint, setSelectedOrderForKitchenPrint] = useState<Order | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<any | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Cancelación solicitada por cliente');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  const handleConfirmCancel = async () => {
    if (!orderToCancel) return;
    try {
      setIsCancelling(true);
      await cancelOrder(orderToCancel.id, cancelReason);
      showToast(`Pedido #${orderToCancel.orderNumber} anulado con éxito`, 'success');
      setOrderToCancel(null);
    } catch (err: any) {
      showToast(err.message || 'Error al anular el pedido', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (typeFilter !== 'todos' && o.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = o.orderNumber.toString().includes(q);
      const matchCust = (o.customerName || '').toLowerCase().includes(q);
      const matchTable = (o.tableName || '').toLowerCase().includes(q);
      if (!matchNum && !matchCust && !matchTable) return false;
    }
    return true;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'abierto':
        return {
          label: 'Abierto · Por Cobrar',
          classes: 'bg-[#3b2a12] text-[#d4af37] border border-[#d4af37]/40',
        };
      case 'facturado':
        return {
          label: 'Facturado · Cobrado',
          classes: 'bg-[#13261a] text-emerald-400 border border-emerald-600/40',
        };
      case 'cancelado':
        return {
          label: 'Anulado',
          classes: 'bg-red-950/80 text-red-300 border border-red-700/50',
        };
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Barra de Búsqueda, Filtros y Botón Nuevo Pedido */}
      <div className="bg-[#14131a] p-4 rounded-2xl border border-[#2d281e] flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Input de Búsqueda */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#a8a29e] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por # de pedido, mesa o cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#18171f] border border-[#383124] rounded-xl pl-9 pr-3 py-2 text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
          />
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            aria-label="Filtrar por Estado"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#18171f] border border-[#383124] rounded-xl px-3 py-2 text-xs text-[#fef3c7] font-semibold focus:outline-none focus:border-[#d4af37]"
          >
            <option value="todos">Todos los Estados</option>
            <option value="abierto">Abiertos (Por Cobrar)</option>
            <option value="facturado">Facturados (Cobrados)</option>
            <option value="cancelado">Anulados</option>
          </select>

          <select
            aria-label="Filtrar por Tipo"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-[#18171f] border border-[#383124] rounded-xl px-3 py-2 text-xs text-[#fef3c7] font-semibold focus:outline-none focus:border-[#d4af37]"
          >
            <option value="todos">Todos los Tipos</option>
            <option value="mesa">Mesa</option>
            <option value="mostrador">Mostrador</option>
            <option value="para_llevar">Para Llevar</option>
            <option value="domicilio">Domicilio</option>
          </select>

          <button
            type="button"
            onClick={() => setShowNewOrderModal(true)}
            className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs flex items-center gap-1.5 hover:brightness-110 shadow cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Pedido</span>
          </button>
        </div>

      </div>

      {/* Lista de Pedidos */}
      {filteredOrders.length === 0 ? (
        <div className="bg-[#14131a] border border-dashed border-[#383124] rounded-2xl p-12 text-center text-[#78716c]">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 text-[#4d3d19]" />
          <h3 className="text-sm font-bold text-[#fef3c7] mb-1">No se encontraron pedidos</h3>
          <p className="text-xs text-[#a8a29e]">
            Ajusta los filtros o presiona "Crear Pedido" para registrar una nueva orden comercial.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const statusBadge = getStatusBadge(order.status);
            const isAbierto = order.status === 'abierto';

            // Agrupar items por ronda
            const roundsMap: Record<number, typeof order.items> = {};
            order.items.forEach((it) => {
              const r = it.roundNumber || 1;
              if (!roundsMap[r]) roundsMap[r] = [];
              roundsMap[r].push(it);
            });

            return (
              <div
                key={order.id}
                className="bg-[#14131a] border border-[#2d281e] hover:border-[#3f3521] rounded-2xl p-4 flex flex-col justify-between transition-all shadow-md"
              >
                <div>
                  {/* Encabezado del Pedido */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-base text-[#fef3c7]">
                          #{order.orderNumber}
                        </span>
                        <span className="text-xs font-bold text-[#d4af37]">
                          {order.tableName || order.customerName}
                        </span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-[#a8a29e] tracking-wider">
                        Tipo: {order.type.replace('_', ' ')} · Atendido por {order.waiterName || 'Staff'}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 whitespace-nowrap ${statusBadge.classes}`}
                    >
                      {statusBadge.label}
                    </span>
                  </div>

                  {/* Datos de contacto para domicilios */}
                  {order.type === 'domicilio' && (
                    <div className="my-2 p-2 rounded-lg bg-[#18171f] border border-[#2d281e] text-[11px] space-y-0.5 text-[#d6d3d1]">
                      {order.customerPhone && (
                        <div className="flex items-center gap-1.5 text-[#a8a29e]">
                          <Phone className="w-3 h-3 text-[#d4af37]" />
                          <span>{order.customerPhone}</span>
                        </div>
                      )}
                      {order.customerAddress && (
                        <div className="flex items-center gap-1.5 text-[#a8a29e]">
                          <MapPin className="w-3 h-3 text-[#d4af37]" />
                          <span>{order.customerAddress}</span>
                        </div>
                      )}
                    </div>
                  )}

                    {/* Rondas y Productos */}
                    <div className="my-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                      {Object.entries(roundsMap).map(([roundNum, items]) => (
                        <div key={roundNum} className="p-2 rounded-lg bg-[#18171f] border border-[#24211a]">
                          <div className="flex items-center justify-between text-[10px] font-bold text-[#d4af37] mb-1">
                            <span className="flex items-center gap-1">
                              <Layers className="w-3 h-3" />
                              Ronda #{roundNum}
                            </span>
                            <span className="text-[#a8a29e]">{items.length} productos</span>
                          </div>
                          <div className="space-y-1.5 text-xs">
                            {items.map((it) => {
                              const modSummary = formatModifiersDisplaySummary(it.selectedModifiers);
                              const isCancelled = Boolean(it.cancelled);
                              const isPaid = Boolean(it.paid);

                              return (
                                <div
                                  key={it.id}
                                  className={`border-b border-[#24211a] pb-1.5 last:border-0 ${
                                    isCancelled ? 'opacity-65' : ''
                                  }`}
                                >
                                  <div className="flex justify-between items-center gap-2 text-[#d6d3d1]">
                                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                      <span className={`font-semibold ${isCancelled ? 'line-through text-red-400/90' : ''}`}>
                                        {it.quantity}x {it.name}
                                      </span>
                                      {isCancelled && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-red-950 text-red-300 border border-red-700/60">
                                          Anulado
                                        </span>
                                      )}
                                      {isPaid && !isCancelled && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-[#2b2416] text-[#d4af37]">
                                          ✓ Pagado
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className={`font-semibold shrink-0 ${isCancelled ? 'line-through text-red-400/70' : 'text-[#fef3c7]'}`}>
                                        {formatCOP(it.price * it.quantity)}
                                      </span>
                                      {isAbierto && !isPaid && (
                                        isCancelled ? (
                                          <button
                                            type="button"
                                            onClick={() => toggleOrderItemCancelled(order.id, it.id, false)}
                                            className="px-1.5 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                                            title="Restaurar este producto al pedido"
                                          >
                                            <RotateCcw className="w-3 h-3" />
                                            <span>Restaurar</span>
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => toggleOrderItemCancelled(order.id, it.id, true)}
                                            className="p-1 rounded bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/50 cursor-pointer"
                                            title="Anular producto (queda tachado sin borrarse)"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )
                                      )}
                                    </div>
                                  </div>
                                  {modSummary && (
                                    <div className={`text-[10px] leading-snug pl-3 mt-0.5 whitespace-normal break-words ${isCancelled ? 'line-through text-[#78716c]' : 'text-[#a8a29e]'}`}>
                                      • {modSummary}
                                    </div>
                                  )}
                                  {it.adjustments && it.adjustments.length > 0 && (
                                    <div className="text-[10px] text-emerald-400 pl-3 font-semibold">
                                      {it.adjustments.map((a) => a.concept).join(' · ')}
                                    </div>
                                  )}
                                  {it.notes && (
                                    <div className={`text-[10px] italic pl-3 whitespace-normal break-words ${isCancelled ? 'line-through text-[#78716c]' : 'text-[#d4af37]'}`}>
                                      ↳ Obs: {it.notes}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {isAbierto && (
                        <button
                          type="button"
                          onClick={() => setSelectedOrderForRound(order)}
                          className="w-full py-1.5 px-2 rounded-lg bg-[#1e1b12] hover:bg-[#2b2416] text-[#d4af37] border border-dashed border-[#d4af37]/50 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Agregar más productos a esta orden</span>
                        </button>
                      )}
                    </div>

                    {/* Desglose Financiero */}
                    <div className="p-2.5 rounded-xl bg-[#18171f] border border-[#2d281e] space-y-1 text-xs">
                      <div className="flex justify-between text-[#a8a29e]">
                        <span>Subtotal:</span>
                        <span>{formatCOP(order.subtotal)}</span>
                      </div>
                      {order.tax > 0 ? (
                        <div className="flex justify-between text-[#a8a29e]">
                          <span>Impoconsumo ({order.subtotal > 0 ? Math.round((order.tax / order.subtotal) * 100) : 8}%):</span>
                          <span>{formatCOP(order.tax)}</span>
                        </div>
                      ) : (
                        <div className="flex justify-between text-[#78716c]">
                          <span>Impoconsumo:</span>
                          <span className="font-mono text-[#a8a29e]">$0</span>
                        </div>
                      )}
                      {order.tip > 0 && (
                        <div className="flex justify-between text-[#d4af37]">
                          <span>Propina (10%):</span>
                          <span>{formatCOP(order.tip)}</span>
                        </div>
                      )}
                      <div className="pt-1.5 border-t border-[#2d281e] flex justify-between font-black text-sm">
                        <span className="text-[#fef3c7]">Total Comercial:</span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#fef3c7] via-[#d4af37] to-[#e6ca65]">
                          {formatCOP(order.total)}
                        </span>
                      </div>
                      {(order.advanceAmount || 0) > 0 && (
                        <div className="pt-1 border-t border-[#2d281e] space-y-0.5">
                          <div className="flex justify-between text-emerald-400 font-bold text-[11px]">
                            <span>Abono Anticipado ({order.fromSeparadoCode || 'Separado'}):</span>
                            <span className="font-mono">-{formatCOP(order.advanceAmount || 0)}</span>
                          </div>
                          <div className="flex justify-between text-amber-300 font-black text-xs">
                            <span>Saldo por Cobrar:</span>
                            <span className="font-mono">{formatCOP(Math.max(0, order.total - (order.advanceAmount || 0)))}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-[#78716c] flex items-center gap-1 mt-2">
                      <Clock className="w-3 h-3 text-[#d4af37]" />
                      <span>Creado: {formatColombiaDateTime(order.createdAt)}</span>
                    </div>
                  </div>

                  {/* Acciones del Pedido */}
                  <div className="mt-4 pt-3 border-t border-[#2d281e] flex items-center gap-2 flex-wrap">
                    {isAbierto ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setSelectedOrderForKitchenPrint(order)}
                          className="py-2 px-2.5 rounded-xl bg-[#292212] hover:bg-[#3d3219] text-[#d4af37] border border-[#d4af37]/60 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm shrink-0"
                          title="Imprimir comanda POS para cocina (Letra Grande)"
                        >
                          <Printer className="w-4 h-4 text-[#d4af37]" />
                          <span>POS Cocina</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedOrderForCheckout(order)}
                          className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-700/50 hover:bg-emerald-900 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all min-w-[90px]"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Cobrar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setOrderToCancel(order);
                            setCancelReason('Cancelación solicitada por el cliente');
                          }}
                          className="py-2 px-2.5 rounded-xl bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-800/60 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all shrink-0"
                          title="Anular este pedido"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Anular</span>
                        </button>
                      </>
                    ) : order.status === 'cancelado' ? (
                      <div className="w-full text-center py-1.5 text-xs text-red-300 font-bold bg-[#261515] rounded-lg border border-red-900/50">
                        ✕ Pedido Anulado {order.cancellationReason ? `· ${order.cancellationReason}` : ''}
                      </div>
                    ) : (
                      <div className="w-full flex items-center gap-2">
                        <div className="flex-1 text-center py-1.5 text-xs text-emerald-400 font-bold bg-[#13261a] rounded-lg border border-emerald-800/40">
                          ✓ Pedido Completado y Facturado
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedOrderForKitchenPrint(order)}
                          className="py-1.5 px-3 rounded-lg bg-[#292212] hover:bg-[#3d3219] text-[#d4af37] border border-[#d4af37]/50 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0"
                          title="Reimprimir comanda POS de cocina para este pedido"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>POS Cocina</span>
                        </button>
                      </div>
                    )}
                  </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showNewOrderModal && (
        <NewOrderModal
          onClose={() => setShowNewOrderModal(false)}
          onSuccess={(orderId) => {
            setShowNewOrderModal(false);
          }}
        />
      )}

      {selectedOrderForRound && (
        <AddRoundModal
          order={selectedOrderForRound}
          onClose={() => setSelectedOrderForRound(null)}
          onSuccess={() => setSelectedOrderForRound(null)}
        />
      )}

      {selectedOrderForCheckout && (
        <CheckoutModal
          order={selectedOrderForCheckout}
          onClose={() => setSelectedOrderForCheckout(null)}
          onPaymentComplete={(payment) => {
            setReceiptPayment(payment);
            setSelectedOrderForCheckout(null);
          }}
        />
      )}

      {receiptPayment && (
        <ReceiptModal
          payment={receiptPayment}
          order={orders.find((o) => o.id === receiptPayment.orderId)}
          onClose={() => setReceiptPayment(null)}
        />
      )}

      {/* Modal de Impresión POS Cocina con Letra Grande */}
      {selectedOrderForKitchenPrint && (
        <KitchenTicketModal
          order={selectedOrderForKitchenPrint}
          onClose={() => setSelectedOrderForKitchenPrint(null)}
        />
      )}

      {/* Modal de Confirmación de Anulación */}
      {orderToCancel && (
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
                <h3 className="font-black text-base text-red-300">¿Anular Pedido #{orderToCancel.orderNumber}?</h3>
                <p className="text-xs text-[#a8a29e]">
                  {orderToCancel.tableName || orderToCancel.customerName || 'Pedido'} · Total: {formatCOP(orderToCancel.total)}
                </p>
              </div>
            </div>

            <div className="text-xs text-[#d6d3d1] space-y-1 bg-[#261717] p-3 rounded-xl border border-red-900/50">
              <p>• El pedido pasará permanentemente a estado <strong>Anulado</strong>.</p>
              {orderToCancel.tableId && <p>• La mesa {orderToCancel.tableName || ''} quedará Libre de inmediato.</p>}
              <p>• Se notifica la cancelación a Cocina KDS y se guarda en Auditoría.</p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#a8a29e] uppercase mb-1">
                Motivo de la anulación:
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ej: Cliente canceló, digitación equivocada..."
                className="w-full bg-[#140f0f] border border-red-900/60 rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-red-500"
              />
              <div className="flex gap-1.5 flex-wrap mt-2">
                {['Cliente canceló', 'Error de digitación', 'Demora en preparación', 'Cambio de orden'].map((r) => (
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
                onClick={() => setOrderToCancel(null)}
                disabled={isCancelling}
                className="flex-1 py-2 px-3 rounded-xl bg-[#242424] hover:bg-[#333] text-xs font-bold text-[#d6d3d1] cursor-pointer"
              >
                Regresar
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-red-950/60"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isCancelling ? 'Anulando...' : 'Confirmar Anulación'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
