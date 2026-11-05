import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { formatCOP, formatColombiaDateTime, calculateCashBalance } from '../../utils/calculations';
import { CheckoutModal } from '../modals/CheckoutModal';
import { ReceiptModal } from '../modals/ReceiptModal';
import { Order, Payment } from '../../types';
import {
  DollarSign,
  Receipt,
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  Smartphone,
  Banknote,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  PlusCircle,
  Lock,
  Unlock,
  Layers,
  Coins,
  Edit2,
  Trash2,
} from 'lucide-react';

export const CashView: React.FC = () => {
  const {
    activeShift,
    openCashShift,
    addCashBase,
    updateCashBase,
    deleteCashBase,
    closeCashShift,
    addCashMovement,
    cashMovements,
    activeOrders,
    currentBranch,
    orders,
    actionLoading,
  } = useRestaurant();

  // Modals state
  const [selectedOrderForPay, setSelectedOrderForPay] = useState<Order | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);

  // Estados para abrir turno
  const [openShiftBase, setOpenShiftBase] = useState<number>(350000);
  const [openShiftNotes, setOpenShiftNotes] = useState<string>('Apertura de turno de caja');

  // Estados para registrar base adicional (múltiples bases)
  const [showBaseModal, setShowBaseModal] = useState<boolean>(false);
  const [baseAmount, setBaseAmount] = useState<number>(100000);
  const [baseReason, setBaseReason] = useState<string>('Adición de base de caja');

  // Estados para editar base
  const [editingBaseId, setEditingBaseId] = useState<string | null>(null);
  const [editBaseAmount, setEditBaseAmount] = useState<number>(0);
  const [editBaseReason, setEditBaseReason] = useState<string>('');

  // Estados para arqueo y cierre
  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [actualCashCount, setActualCashCount] = useState<number>(0);
  const [closeShiftNotes, setCloseShiftNotes] = useState<string>('');

  // Estados para movimiento de caja menor
  const [showMovementModal, setShowMovementModal] = useState<boolean>(false);
  const [movementType, setMovementType] = useState<'ingreso' | 'egreso'>('egreso');
  const [movementAmount, setMovementAmount] = useState<number>(20000);
  const [movementReason, setMovementReason] = useState<string>('');

  // Cálculo de arqueo en tiempo real si el turno está abierto
  const balance = activeShift
    ? calculateCashBalance(
        activeShift.initialCash,
        activeShift.salesCash,
        activeShift.inflowCash,
        activeShift.outflowCash,
        showCloseModal ? actualCashCount : undefined
      )
    : null;

  const handleOpenShift = async () => {
    if (actionLoading) return;
    await openCashShift(openShiftBase, openShiftNotes);
  };

  const handleAddBaseSubmit = async () => {
    if (actionLoading || !activeShift || baseAmount <= 0 || !baseReason.trim()) return;
    await addCashBase(baseAmount, baseReason.trim());
    setShowBaseModal(false);
    setBaseReason('Adición de base de caja');
  };

  const handleUpdateBaseSubmit = async () => {
    if (actionLoading || !activeShift || !editingBaseId || editBaseAmount <= 0 || !editBaseReason.trim()) return;
    await updateCashBase(editingBaseId, editBaseAmount, editBaseReason.trim());
    setEditingBaseId(null);
  };

  const handleDeleteBase = async (baseId: string) => {
    if (actionLoading || !activeShift) return;
    if (window.confirm('¿Estás seguro de eliminar este registro de base de caja?')) {
      await deleteCashBase(baseId);
    }
  };

  const handleCloseShift = async () => {
    if (actionLoading || !activeShift) return;
    await closeCashShift(actualCashCount, closeShiftNotes);
    setShowCloseModal(false);
  };

  const handleAddMovement = async () => {
    if (actionLoading || !activeShift || !movementReason.trim()) return;
    await addCashMovement(movementType, movementAmount, movementReason.trim());
    setShowMovementModal(false);
    setMovementReason('');
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Panel Principal del Turno de Caja & Bases */}
      <div className="bg-[#14131a] p-5 rounded-2xl border border-[#2d281e] shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#2d281e] gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#735812] flex items-center justify-center text-[#0e0e12] font-black shadow-lg">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#fef3c7]">
                  Control de Caja, Bases & Cierre de Turno (Arqueo)
                </h2>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    activeShift
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-600/50'
                      : 'bg-red-950 text-red-300 border border-red-700/50'
                  }`}
                >
                  {activeShift ? 'Turno Abierto' : 'Caja Cerrada'}
                </span>
              </div>
              <p className="text-xs text-[#a8a29e]">
                {currentBranch?.name} · {activeShift ? `Cajero: ${activeShift.cashierName} (Desde: ${formatColombiaDateTime(activeShift.openedAt)})` : 'Inicia un turno para registrar bases y cobros'}
              </p>
            </div>
          </div>

          {/* Botones de control del turno y bases */}
          <div className="flex flex-wrap items-center gap-2">
            {activeShift ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowBaseModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-[#2b2416] text-[#fef3c7] border border-[#d4af37]/50 hover:bg-[#3d321d] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Coins className="w-4 h-4 text-[#d4af37]" />
                  <span>Registrar Base Adicional</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowMovementModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-[#252016] text-[#d4af37] border border-[#d4af37]/40 hover:bg-[#352c1b] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Movimiento Caja Menor</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActualCashCount(balance?.expectedCash || 0);
                    setShowCloseModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-red-950 text-red-300 border border-red-700/50 hover:bg-red-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Lock className="w-4 h-4" />
                  <span>Cerrar Turno (Arqueo)</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  aria-label="Base inicial en pesos"
                  value={openShiftBase}
                  onChange={(e) => setOpenShiftBase(parseInt(e.target.value) || 0)}
                  placeholder="Base inicial ($ COP)"
                  className="w-36 bg-[#18171f] border border-[#383124] rounded-xl px-3 py-2 text-xs font-bold text-[#fef3c7]"
                />
                <button
                  type="button"
                  onClick={handleOpenShift}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs flex items-center gap-1.5 hover:brightness-110 shadow cursor-pointer"
                >
                  <Unlock className="w-4 h-4" />
                  <span>Abrir Turno con Base</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Métricas del Turno Abierto (Incluyendo todos los medios de pago y múltiples bases) */}
        {activeShift && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
            
            {/* Base Inicial y Adicionales */}
            <div className="bg-[#18171f] p-3 rounded-xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Base Total</span>
              <span className="text-sm font-black text-[#fef3c7] mt-1 block">
                {formatCOP(activeShift.initialCash)}
              </span>
              <span className="text-[10px] text-[#78716c]">
                {activeShift.baseEntries?.length ? `${activeShift.baseEntries.length} entradas de base` : 'Base inicial'}
              </span>
            </div>

            {/* Ventas Efectivo */}
            <div className="bg-[#18171f] p-3 rounded-xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Ventas Efectivo</span>
              <span className="text-sm font-black text-emerald-400 mt-1 block">
                {formatCOP(activeShift.salesCash)}
              </span>
              <span className="text-[10px] text-[#78716c]">Cobrado en caja</span>
            </div>

            {/* Ventas Datáfono */}
            <div className="bg-[#18171f] p-3 rounded-xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Tarjetas / Datáfono</span>
              <span className="text-sm font-black text-cyan-300 mt-1 block">
                {formatCOP(activeShift.salesCard)}
              </span>
              <span className="text-[10px] text-[#78716c]">Vouchers bancarios</span>
            </div>

            {/* Ventas Nequi / Daviplata / Transferencia */}
            <div className="bg-[#18171f] p-3 rounded-xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Nequi / Daviplata</span>
              <span className="text-sm font-black text-purple-300 mt-1 block">
                {formatCOP(activeShift.salesTransfer)}
              </span>
              <span className="text-[10px] text-[#78716c]">Transferencias activas</span>
            </div>

            {/* Movimientos menores (Ingresos / Egresos) */}
            <div className="bg-[#18171f] p-3 rounded-xl border border-[#2d281e]">
              <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Caja Menor (+ / -)</span>
              <div className="text-xs font-bold mt-1 space-y-0.5">
                <span className="text-emerald-400 block">+{formatCOP(activeShift.inflowCash)}</span>
                <span className="text-red-400 block">-{formatCOP(activeShift.outflowCash)}</span>
              </div>
            </div>

            {/* Efectivo Esperado en Cajón */}
            <div className="bg-gradient-to-br from-[#241e14] to-[#17161f] p-3 rounded-xl border border-[#5c491c] ring-1 ring-[#d4af37]/30">
              <span className="text-[10px] text-[#d4af37] uppercase font-black block">Efectivo Esperado</span>
              <span className="text-base font-black text-[#fef3c7] mt-1 block">
                {formatCOP(balance?.expectedCash || 0)}
              </span>
              <span className="text-[10px] text-[#a8a29e]">Debe haber en cajón</span>
            </div>

          </div>
        )}
      </div>

      {/* 2. Sección: Listado de Bases Registradas en el Turno */}
      {activeShift && activeShift.baseEntries && activeShift.baseEntries.length > 0 && (
        <div className="bg-[#14131a] p-5 rounded-2xl border border-[#2d281e] shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-[#2d281e] mb-3">
            <h3 className="font-bold text-sm text-[#fef3c7] flex items-center gap-2">
              <Coins className="w-4 h-4 text-[#d4af37]" />
              <span>Bases Registradas en el Turno ({activeShift.baseEntries.length})</span>
            </h3>
            <span className="text-xs text-[#a8a29e]">
              Suma Total de Bases: {formatCOP(activeShift.initialCash)}
            </span>
          </div>

          <div className="space-y-2">
            {activeShift.baseEntries.map((base) => (
              <div
                key={base.id}
                className="bg-[#18171f] p-3 rounded-xl border border-[#2d281e] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-[#fef3c7]">{formatCOP(base.amount)}</span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#2b2416] text-[#d4af37] border border-[#d4af37]/30">
                      {base.reason}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#a8a29e] mt-1 block">
                    Registrado el {formatColombiaDateTime(base.createdAt)} · Por {base.userName}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBaseId(base.id);
                      setEditBaseAmount(base.amount);
                      setEditBaseReason(base.reason);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#252016] text-[#d4af37] border border-[#d4af37]/40 hover:bg-[#352c1b] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteBase(base.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-red-950 text-red-300 border border-red-700/50 hover:bg-red-900 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Borrar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Sección: Pedidos Abiertos Pendientes de Cobro */}
      <div className="bg-[#14131a] p-5 rounded-2xl border border-[#2d281e] shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#2d281e] mb-4">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#d4af37]" />
            <h3 className="font-bold text-sm text-[#fef3c7]">
              Pedidos Comerciales Pendientes de Cobro ({activeOrders.length})
            </h3>
          </div>
          <span className="text-xs text-[#a8a29e]">
            Total por Facturar: {formatCOP(activeOrders.reduce((acc, o) => acc + o.total, 0))}
          </span>
        </div>

        {activeOrders.length === 0 ? (
          <div className="p-8 border border-dashed border-[#383124] rounded-xl text-center text-[#78716c] text-xs">
            No hay pedidos pendientes de cobro en este momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeOrders.map((order) => (
              <div
                key={order.id}
                className="bg-[#18171f] p-3.5 rounded-xl border border-[#2d281e] flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-mono font-bold text-xs text-[#d4af37]">
                        #{order.orderNumber}
                      </span>
                      <h4 className="font-bold text-sm text-[#fef3c7]">
                        {order.tableName || order.customerName}
                      </h4>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#2b2416] text-[#d4af37] border border-[#d4af37]/40">
                      {order.type.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="text-xs text-[#a8a29e] mb-2">
                    {order.items.length} productos · {order.currentRound || 1} rondas
                  </div>

                  <div className="p-2 rounded bg-[#121117] border border-[#2d281e] flex justify-between items-center text-xs">
                    <span className="text-[#a8a29e]">Total a Cobrar:</span>
                    <span className="font-black text-[#d4af37] text-sm">{formatCOP(order.total)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedOrderForPay(order)}
                  className="mt-3 w-full py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs flex items-center justify-center gap-1.5 hover:brightness-110 shadow cursor-pointer"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Cobrar Pedido</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Sección: Historial de Movimientos de Caja Menor */}
      <div className="bg-[#14131a] p-5 rounded-2xl border border-[#2d281e] shadow-xl">
        <h3 className="font-bold text-sm text-[#fef3c7] mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#d4af37]" />
          <span>Trazabilidad de Movimientos de Caja Menor ({cashMovements.length})</span>
        </h3>

        {cashMovements.length === 0 ? (
          <p className="text-xs text-[#78716c] italic">No hay egresos ni ingresos registrados en el turno.</p>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {cashMovements.map((mov) => (
              <div
                key={mov.id}
                className="bg-[#18171f] p-3 rounded-xl border border-[#2d281e] flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      mov.type === 'ingreso'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/50'
                        : 'bg-red-950 text-red-400 border border-red-700/50'
                    }`}
                  >
                    {mov.type === 'ingreso' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className="font-bold text-[#fef3c7] block">{mov.reason}</span>
                    <span className="text-[10px] text-[#a8a29e]">
                      {formatColombiaDateTime(mov.createdAt)} · Registrado por {mov.userName}
                    </span>
                  </div>
                </div>

                <span
                  className={`font-black text-sm ${
                    mov.type === 'ingreso' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {mov.type === 'ingreso' ? '+' : '-'} {formatCOP(mov.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: Registrar Base Adicional */}
      {showBaseModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121117] border border-[#3f3521] rounded-2xl w-full max-w-md p-5 text-[#faf5ee] shadow-2xl">
            <h3 className="font-bold text-base text-[#fef3c7] mb-1">
              Registrar Base Adicional de Caja
            </h3>
            <p className="text-xs text-[#a8a29e] mb-4">
              Permite inyectar o sumar una nueva base de efectivo al turno actual.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#a8a29e] mb-1">Monto de la Base (COP)</label>
                <input
                  type="number"
                  value={baseAmount}
                  onChange={(e) => setBaseAmount(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#18171f] border border-[#383124] rounded-lg px-3 py-2 text-sm font-bold text-[#fef3c7]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a8a29e] mb-1">Motivo / Concepto</label>
                <input
                  type="text"
                  placeholder="Ej: Adición de cambio, fondo adicional"
                  value={baseReason}
                  onChange={(e) => setBaseReason(e.target.value)}
                  className="w-full bg-[#18171f] border border-[#383124] rounded-lg px-3 py-2 text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBaseModal(false)}
                className="px-4 py-2 rounded-xl border border-[#383124] text-xs font-semibold text-[#a8a29e]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddBaseSubmit}
                disabled={baseAmount <= 0 || !baseReason.trim()}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs hover:brightness-110 disabled:opacity-50"
              >
                Guardar Base
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Editar Base */}
      {editingBaseId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121117] border border-[#3f3521] rounded-2xl w-full max-w-md p-5 text-[#faf5ee] shadow-2xl">
            <h3 className="font-bold text-base text-[#fef3c7] mb-1">
              Editar Registro de Base
            </h3>
            <p className="text-xs text-[#a8a29e] mb-4">
              Modifica el valor o el concepto de esta entrada de base.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#a8a29e] mb-1">Monto de la Base (COP)</label>
                <input
                  type="number"
                  value={editBaseAmount}
                  onChange={(e) => setEditBaseAmount(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#18171f] border border-[#383124] rounded-lg px-3 py-2 text-sm font-bold text-[#fef3c7]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a8a29e] mb-1">Motivo / Concepto</label>
                <input
                  type="text"
                  value={editBaseReason}
                  onChange={(e) => setEditBaseReason(e.target.value)}
                  className="w-full bg-[#18171f] border border-[#383124] rounded-lg px-3 py-2 text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingBaseId(null)}
                className="px-4 py-2 rounded-xl border border-[#383124] text-xs font-semibold text-[#a8a29e]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUpdateBaseSubmit}
                disabled={editBaseAmount <= 0 || !editBaseReason.trim()}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs hover:brightness-110 disabled:opacity-50"
              >
                Actualizar Base
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Movimiento de Caja Menor (Ingreso / Egreso) */}
      {showMovementModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121117] border border-[#3f3521] rounded-2xl w-full max-w-md p-5 text-[#faf5ee] shadow-2xl">
            <h3 className="font-bold text-base text-[#fef3c7] mb-1">
              Registrar Movimiento de Caja Menor
            </h3>
            <p className="text-xs text-[#a8a29e] mb-4">
              Afecta el saldo esperado en efectivo del turno actual.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#a8a29e] mb-1">Tipo de Movimiento</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMovementType('egreso')}
                    className={`py-2 text-xs font-bold rounded-lg border ${
                      movementType === 'egreso'
                        ? 'bg-red-950 text-red-300 border-red-700'
                        : 'bg-[#18171f] text-[#a8a29e] border-[#2d281e]'
                    }`}
                  >
                    Egreso / Salida
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('ingreso')}
                    className={`py-2 text-xs font-bold rounded-lg border ${
                      movementType === 'ingreso'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                        : 'bg-[#18171f] text-[#a8a29e] border-[#2d281e]'
                    }`}
                  >
                    Ingreso Adicional
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a8a29e] mb-1">Monto en Pesos (COP)</label>
                <input
                  type="number"
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#18171f] border border-[#383124] rounded-lg px-3 py-2 text-sm font-bold text-[#fef3c7]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a8a29e] mb-1">Motivo / Justificación</label>
                <input
                  type="text"
                  placeholder="Ej: Compra de hielo urgente, propinas retiradas"
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  className="w-full bg-[#18171f] border border-[#383124] rounded-lg px-3 py-2 text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowMovementModal(false)}
                className="px-4 py-2 rounded-xl border border-[#383124] text-xs font-semibold text-[#a8a29e]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddMovement}
                disabled={!movementReason.trim() || movementAmount <= 0}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs hover:brightness-110 disabled:opacity-50"
              >
                Guardar Movimiento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Cierre de Turno y Arqueo Ciego */}
      {showCloseModal && activeShift && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121117] border border-[#3f3521] rounded-2xl w-full max-w-lg p-5 text-[#faf5ee] shadow-2xl">
            <h3 className="font-bold text-base text-[#fef3c7] mb-1">
              Arqueo de Caja y Cierre de Turno
            </h3>
            <p className="text-xs text-[#a8a29e] mb-4">
              Cálculo desde apertura ({formatColombiaDateTime(activeShift.openedAt)}) hasta el momento actual. Incluye todos los medios de pago.
            </p>

            <div className="space-y-4">
              <div className="bg-[#18171f] p-3 rounded-xl border border-[#2d281e] space-y-1.5 text-xs">
                <div className="flex justify-between text-[#a8a29e]">
                  <span>Base Total Registrada:</span>
                  <span>{formatCOP(activeShift.initialCash)}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Ventas en Efectivo:</span>
                  <span>+{formatCOP(activeShift.salesCash)}</span>
                </div>
                <div className="flex justify-between text-cyan-300">
                  <span>Tarjetas / Datáfono:</span>
                  <span>+{formatCOP(activeShift.salesCard)}</span>
                </div>
                <div className="flex justify-between text-purple-300">
                  <span>Nequi / Daviplata:</span>
                  <span>+{formatCOP(activeShift.salesTransfer)}</span>
                </div>
                <div className="flex justify-between text-[#a8a29e]">
                  <span>Caja Menor Neta:</span>
                  <span>{formatCOP((activeShift.inflowCash || 0) - (activeShift.outflowCash || 0))}</span>
                </div>
                <div className="pt-2 border-t border-[#2d281e] flex justify-between font-bold text-[#d4af37]">
                  <span>Efectivo Teórico Esperado:</span>
                  <span>{formatCOP(balance?.expectedCash || 0)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#fef3c7] mb-1">
                  Efectivo Físico Contado en Caja (COP):
                </label>
                <input
                  type="number"
                  value={actualCashCount}
                  onChange={(e) => setActualCashCount(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#18171f] border border-[#383124] rounded-lg px-3 py-2 text-base font-bold text-[#fef3c7] focus:border-[#d4af37]"
                />
              </div>

              {/* Resultado del Cuadre */}
              <div className="p-3 rounded-xl bg-[#18171f] border border-[#2d281e]">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#a8a29e]">Diferencia de Caja:</span>
                  <span
                    className={`font-black text-sm ${
                      (balance?.difference || 0) === 0
                        ? 'text-emerald-400'
                        : (balance?.difference || 0) > 0
                        ? 'text-cyan-300'
                        : 'text-red-400'
                    }`}
                  >
                    {(balance?.difference || 0) === 0
                      ? '✓ Caja Cuadrada Exacta'
                      : (balance?.difference || 0) > 0
                      ? `+ Sobrante: ${formatCOP(balance?.difference)}`
                      : `- Faltante: ${formatCOP(balance?.difference)}`}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a8a29e] mb-1">Observaciones de Cierre</label>
                <textarea
                  rows={2}
                  placeholder="Detalles del cuadre o notas del cajero..."
                  value={closeShiftNotes}
                  onChange={(e) => setCloseShiftNotes(e.target.value)}
                  className="w-full bg-[#18171f] border border-[#383124] rounded-lg p-2 text-xs text-[#fef3c7]"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 rounded-xl border border-[#383124] text-xs font-semibold text-[#a8a29e]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCloseShift}
                className="px-5 py-2 rounded-xl bg-red-950 text-red-200 border border-red-700 hover:bg-red-900 font-black text-xs"
              >
                Confirmar y Cerrar Turno
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS de Cobro y Factura */}
      {selectedOrderForPay && (
        <CheckoutModal
          order={selectedOrderForPay}
          onClose={() => setSelectedOrderForPay(null)}
          onPaymentComplete={(payment) => {
            setReceiptPayment(payment);
            setSelectedOrderForPay(null);
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

    </div>
  );
};
