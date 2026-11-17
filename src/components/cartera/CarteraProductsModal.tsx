import React, { useState, useMemo, useEffect } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import { CarteraRecord } from '../../types';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import {
  CARTERA_PRODUCTS_PAGE_SIZE,
  resolveCarteraProductItems,
  paginateCarteraProducts,
} from '../../utils/carteraProductsUtils';
import { formatModifiersDisplaySummary } from '../../utils/orderModifierUtils';
import { AddCarteraProductsModal } from './AddCarteraProductsModal';
import {
  X,
  Plus,
  ShoppingBag,
  Check,
  ChevronLeft,
  ChevronRight,
  ChefHat,
  Info,
  Clock,
  User,
} from 'lucide-react';

interface CarteraProductsModalProps {
  carteraRecord: CarteraRecord;
  onClose: () => void;
}

export const CarteraProductsModal: React.FC<CarteraProductsModalProps> = ({
  carteraRecord,
  onClose,
}) => {
  const {
    cartera,
    orders,
    toggleCarteraItemPaidChecked,
  } = useRestaurant();
  const { showToast } = useToast();

  const liveRecord = useMemo(
    () => cartera.find((c) => c.id === carteraRecord.id) || carteraRecord,
    [cartera, carteraRecord]
  );

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null);
  const [showAddProductsModal, setShowAddProductsModal] = useState<boolean>(false);

  const resolvedItems = useMemo(
    () => resolveCarteraProductItems(liveRecord, orders),
    [liveRecord, orders]
  );

  const paginated = useMemo(
    () => paginateCarteraProducts(resolvedItems, currentPage, CARTERA_PRODUCTS_PAGE_SIZE),
    [resolvedItems, currentPage]
  );

  useEffect(() => {
    if (currentPage > paginated.totalPages) {
      setCurrentPage(paginated.totalPages);
    }
  }, [currentPage, paginated.totalPages]);

  const handleToggleItem = async (itemId: string) => {
    if (togglingItemId) return;
    setTogglingItemId(itemId);
    try {
      await toggleCarteraItemPaidChecked(liveRecord.id, itemId);
    } catch (err: any) {
      showToast(err.message || 'Error al actualizar estado visual del producto', 'error');
    } finally {
      setTogglingItemId(null);
    }
  };

  const isCancelled = liveRecord.status === 'anulada';

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div className="relative bg-[#181818] border border-[#B77900]/40 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
          {/* Encabezado */}
          <div className="p-4 sm:p-5 border-b border-[#333333] flex items-center justify-between gap-3 bg-gradient-to-r from-[#181818] to-[#242424] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#2a2213] border border-[#D6A21A]/40 flex items-center justify-center text-[#D6A21A] shrink-0">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-black text-[#FFFDF5] truncate">
                    Productos de la Cuenta — {liveRecord.code}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-amber-950 text-amber-300 border border-amber-800">
                    {liveRecord.status}
                  </span>
                </div>
                <p className="text-xs text-[#a8a29e] truncate">
                  {liveRecord.customerName} · Venta Origen #{liveRecord.orderNumber || liveRecord.saleId}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-[#242424] text-[#a8a29e] hover:text-[#FFFDF5] cursor-pointer shrink-0"
              aria-label="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Resumen Financiero + Aviso de Tachado Informativo */}
          <div className="px-4 sm:px-5 py-3 bg-[#121214] border-b border-[#2d281e] space-y-2.5 shrink-0">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="p-2.5 rounded-2xl bg-[#181818] border border-[#242424]">
                <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">
                  Total Crédito
                </span>
                <span className="font-mono tabular-nums font-black text-xs sm:text-sm text-[#FFFDF5]">
                  {formatCOP(liveRecord.totalAmount)}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-[#181818] border border-[#242424]">
                <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">
                  Total Abonado
                </span>
                <span className="font-mono tabular-nums font-black text-xs sm:text-sm text-emerald-400">
                  {formatCOP(liveRecord.totalAbonado)}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-[#181818] border border-[#2d281e]">
                <span className="text-[10px] uppercase font-bold text-amber-400 block">
                  Saldo Pendiente
                </span>
                <span className="font-mono tabular-nums font-black text-xs sm:text-sm text-amber-400">
                  {formatCOP(liveRecord.balanceDue)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] text-[#a8a29e]">
                <Info className="w-3.5 h-3.5 text-[#D6A21A] shrink-0" />
                <span>
                  <strong className="text-[#FFFDF5]">
                    {paginated.checkedCount} de {paginated.totalItems}
                  </strong>{' '}
                  líneas tachadas · Tachar solo marca hasta dónde ha pagado el cliente, no altera el saldo.
                </span>
              </div>

              {!isCancelled && (
                <button
                  type="button"
                  onClick={() => setShowAddProductsModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] text-xs font-black inline-flex items-center gap-1.5 hover:brightness-110 shadow cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Agregar Productos</span>
                </button>
              )}
            </div>
          </div>

          {/* Lista Paginada (Máximo 20 por página, más reciente -> más antiguo) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2">
            {paginated.pageItems.length > 0 ? (
              paginated.pageItems.map((item) => {
                const isChecked = Boolean(item.paidChecked);
                const isUpdating = togglingItemId === item.id;
                const modifiersSummary = formatModifiersDisplaySummary(item.selectedModifiers);
                const lineTotal = (item.price || 0) * (item.quantity || 1);

                return (
                  <button
                    key={item.id}
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    onClick={() => handleToggleItem(item.id)}
                    disabled={isUpdating}
                    className={`w-full text-left p-3 sm:p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 cursor-pointer ${
                      isChecked
                        ? 'bg-[#121214]/70 border-emerald-900/50 opacity-75 hover:opacity-95'
                        : 'bg-[#121214] border-[#2d281e] hover:border-[#B77900]/60'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span
                        className={`mt-0.5 w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'bg-[#181818] border-[#555555]'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs sm:text-sm font-black ${
                              isChecked ? 'line-through text-[#8c8270]' : 'text-[#FFFDF5]'
                            }`}
                          >
                            <span className={isChecked ? 'text-emerald-400/70' : 'text-[#D6A21A]'}>
                              {item.quantity}x
                            </span>{' '}
                            {item.name}
                          </span>

                          {item.sentToKitchen && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-[#24222e] text-[#d6d3d1] border border-[#383838] inline-flex items-center gap-1">
                              <ChefHat className="w-2.5 h-2.5 text-[#D6A21A]" />
                              Cocina
                            </span>
                          )}

                          {isChecked && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                              Tachado
                            </span>
                          )}
                        </div>

                        {modifiersSummary && (
                          <p
                            className={`text-[11px] mt-0.5 ${
                              isChecked ? 'line-through text-[#78716c]' : 'text-[#a8a29e]'
                            }`}
                          >
                            {modifiersSummary}
                          </p>
                        )}

                        {item.notes && (
                          <p
                            className={`text-[11px] italic mt-0.5 ${
                              isChecked ? 'line-through text-[#78716c]' : 'text-amber-300/90'
                            }`}
                          >
                            Nota: {item.notes}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-[#a8a29e] mt-1">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatColombiaDateTime(item.addedAt)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {item.addedBy}
                          </span>
                          {isChecked && item.paidCheckedAt && (
                            <span className="text-emerald-400/90">
                              · Marcado por {item.paidCheckedBy || 'Usuario'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`font-mono tabular-nums text-xs sm:text-sm font-black block ${
                          isChecked ? 'line-through text-[#8c8270]' : 'text-[#D6A21A]'
                        }`}
                      >
                        {formatCOP(lineTotal)}
                      </span>
                      {item.quantity > 1 && (
                        <span className="font-mono tabular-nums text-[10px] text-[#a8a29e]">
                          {formatCOP(item.price)} c/u
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-center py-10 text-[#a8a29e] bg-[#121214] rounded-2xl border border-dashed border-[#2d281e]">
                <ShoppingBag className="w-9 h-9 mx-auto text-[#B77900] mb-2 opacity-50" />
                <p className="text-xs font-bold text-[#FFFDF5]">
                  Esta cuenta aún no tiene productos detallados
                </p>
                <p className="text-[11px] text-[#a8a29e] mt-1">
                  Usa el botón "Agregar Productos" para sumar consumos del menú a esta cuenta.
                </p>
              </div>
            )}
          </div>

          {/* Footer y Paginación (máximo 20 por página) */}
          <div className="px-4 sm:px-5 py-3.5 border-t border-[#333333] bg-[#181818] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="text-[11px] text-[#a8a29e]">
              {paginated.totalItems > 0 ? (
                <span>
                  Mostrando <strong className="text-[#FFFDF5] font-mono">{paginated.startIndex}–{paginated.endIndex}</strong> de{' '}
                  <strong className="text-[#FFFDF5] font-mono">{paginated.totalItems}</strong> productos (más recientes primero · máx. {CARTERA_PRODUCTS_PAGE_SIZE}/pág.)
                </span>
              ) : (
                <span>0 productos registrados</span>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {paginated.totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={paginated.currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1.5 rounded-xl bg-[#242424] hover:bg-[#2d2d2d] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>

                  <span className="px-2.5 py-1 text-xs font-mono font-bold text-[#D6A21A]">
                    Pág. {paginated.currentPage} / {paginated.totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={paginated.currentPage >= paginated.totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(paginated.totalPages, p + 1))}
                    className="px-2.5 py-1.5 rounded-xl bg-[#242424] hover:bg-[#2d2d2d] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl bg-[#242424] hover:bg-[#2d2d2d] text-[#d6d3d1] text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>

      {showAddProductsModal && (
        <AddCarteraProductsModal
          carteraRecord={liveRecord}
          onClose={() => setShowAddProductsModal(false)}
          onSuccess={() => setCurrentPage(1)}
        />
      )}
    </>
  );
};
