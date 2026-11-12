import React, { useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Order, OrderItem, Comanda, PaperWidth } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import { formatColombiaDateTime } from '../../utils/calculations';
import { BranchReceiptHeader } from '../common/BranchReceiptHeader';
import { getVisibleOrderModifiers } from '../../utils/orderModifierUtils';
import {
  Printer,
  X,
  ChefHat,
  AlertCircle,
} from 'lucide-react';

export type KitchenFontSize = 'grande' | 'extragrande' | 'compacto';

interface KitchenTicketModalProps {
  order?: Order | null;
  comanda?: Comanda | null;
  onClose: () => void;
  initialRound?: number | 'all';
}

export const KitchenTicketModal: React.FC<KitchenTicketModalProps> = ({
  order,
  comanda,
  onClose,
  initialRound = 'all',
}) => {
  const { currentBranch } = useRestaurant();
  const { branches } = useAuth();

  useEffect(() => {
    document.body.classList.add('printing-pos-ticket');
    return () => {
      if (document.querySelectorAll('.colmena-ticket-print-portal').length <= 1) {
        document.body.classList.remove('printing-pos-ticket');
      }
    };
  }, []);

  // Resolución de sucursal
  const originBranchId = order?.branchId || comanda?.branchId || currentBranch?.id;
  const branch = branches.find((b) => b.id === originBranchId) || currentBranch;

  // Preferencias tomadas directamente de la configuración de la sucursal en Administración
  const branchPrintConfig = branch?.printConfig;
  const fontSize: KitchenFontSize = branchPrintConfig?.kitchenFontSize || 'grande';
  const selectedWidth: PaperWidth =
    order?.branchSnapshot?.printConfig?.paperWidth || branchPrintConfig?.paperWidth || '80mm';
  const selectedRound: number | 'all' = initialRound;
  const includePrices: boolean = branchPrintConfig?.includeKitchenPrices ?? false;

  // Normalizar ítems a imprimir
  const orderNumber = order?.orderNumber ?? comanda?.orderNumber ?? 0;
  const tableName = order?.tableName ?? comanda?.tableName ?? (order?.type === 'mesa' ? 'Mesa' : 'Mostrador');
  const orderType = order?.type ?? comanda?.orderType ?? 'mesa';
  const waiterName = order?.waiterName ?? comanda?.waiterName ?? 'Staff';
  const createdAt = order?.createdAt ?? comanda?.createdAt ?? new Date().toISOString();
  const generalNotes = order?.notes;

  // Extraer lista de ítems según fuente
  const rawItems: OrderItem[] = useMemo(() => {
    if (order?.items) return order.items;
    if (comanda?.items) {
      return comanda.items.map((ci) => ({
        id: ci.orderItemId,
        menuItemId: ci.orderItemId,
        name: ci.name,
        price: 0,
        quantity: ci.quantity,
        station: 'cocina_caliente',
        notes: ci.notes,
        roundNumber: comanda.roundNumber || 1,
        sentToKitchen: true,
      }));
    }
    return [];
  }, [order, comanda]);

  // Obtener rondas disponibles
  const availableRounds = useMemo(() => {
    const set = new Set<number>();
    rawItems.forEach((it) => set.add(it.roundNumber || 1));
    return Array.from(set).sort((a, b) => a - b);
  }, [rawItems]);

  // Filtrar ítems por ronda seleccionada
  const filteredItems = useMemo(() => {
    if (selectedRound === 'all') return rawItems;
    return rawItems.filter((it) => (it.roundNumber || 1) === selectedRound);
  }, [rawItems, selectedRound]);

  // Agrupar ítems filtrados por ronda si se imprimen todas
  const groupedByRound = useMemo(() => {
    const groups: Record<number, OrderItem[]> = {};
    filteredItems.forEach((it) => {
      const r = it.roundNumber || 1;
      if (!groups[r]) groups[r] = [];
      groups[r].push(it);
    });
    return groups;
  }, [filteredItems]);

  const totalItemCount = filteredItems.reduce((acc, it) => acc + (it.quantity || 1), 0);

  const handlePrint = () => {
    window.print();
  };

  // Clases dinámicas según el tamaño de fuente configurado en Administración
  const typographyClasses = {
    compacto: {
      headerBadge: 'text-sm font-bold',
      destination: 'text-lg font-black',
      orderMeta: 'text-[11px] font-semibold',
      roundHeader: 'text-xs font-black',
      qtyBadge: 'text-sm font-black px-1.5 py-0.5 min-w-[28px]',
      itemName: 'text-xs font-black',
      modifiers: 'text-[10px] font-semibold',
      notesBox: 'text-[11px] font-bold p-1 border',
      footerText: 'text-[10px]',
    },
    grande: {
      headerBadge: 'text-base font-black',
      destination: 'text-2xl sm:text-3xl font-black tracking-wide',
      orderMeta: 'text-xs sm:text-sm font-bold',
      roundHeader: 'text-sm sm:text-base font-black',
      qtyBadge: 'text-xl sm:text-2xl font-black px-2.5 py-1 min-w-[40px]',
      itemName: 'text-base sm:text-lg font-black leading-tight',
      modifiers: 'text-xs sm:text-sm font-bold',
      notesBox: 'text-xs sm:text-sm font-black p-2 border-2',
      footerText: 'text-xs font-bold',
    },
    extragrande: {
      headerBadge: 'text-lg font-black',
      destination: 'text-3xl sm:text-4xl font-black tracking-wider',
      orderMeta: 'text-sm sm:text-base font-bold',
      roundHeader: 'text-base sm:text-lg font-black',
      qtyBadge: 'text-2xl sm:text-3xl font-black px-3 py-1.5 min-w-[48px]',
      itemName: 'text-lg sm:text-xl font-black leading-snug',
      modifiers: 'text-sm sm:text-base font-bold',
      notesBox: 'text-sm sm:text-base font-black p-2.5 border-2',
      footerText: 'text-sm font-black',
    },
  }[fontSize];

  const is58mm = selectedWidth === '58mm';

  return createPortal(
    <div className="colmena-ticket-print-portal fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:static print:p-0 print:bg-white print:overflow-visible">
      <div className="bg-white rounded-2xl w-full max-w-[390px] shadow-2xl text-black overflow-hidden flex flex-col border border-neutral-200 max-h-[92vh] print:static print:border-none print:shadow-none print:bg-white print:max-w-none print:max-h-none print:w-full print:overflow-visible">
        
        {/* Cabecera modal (oculta en impresión) */}
        <div className="px-4 py-2.5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50 print:hidden">
          <div className="flex items-center gap-2 text-neutral-800 font-bold text-xs uppercase tracking-wider">
            <ChefHat className="w-4 h-4 text-[#D6A21A]" />
            <span>Ticket POS de Cocina</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-black hover:bg-neutral-800 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Imprimir Tirilla POS"
            >
              <Printer className="w-3.5 h-3.5 text-[#D6A21A]" />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-black hover:bg-neutral-200 transition-colors cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tirilla POS Imprimible (Únicamente el ticket de texto) */}
        <div className="flex justify-center p-4 sm:p-5 bg-white overflow-y-auto max-h-[80vh] print:max-h-none print:block print:bg-white print:p-0 print:overflow-visible">
          <div
            id="printable-kitchen-pos-ticket"
            data-testid="kitchen-pos-ticket"
            className={`colmena-printable-ticket bg-white text-black font-mono select-all transition-all print:shadow-none print:border-none print:m-0 print:p-0 print:text-black print:bg-white ${
              is58mm ? 'w-full max-w-[270px]' : 'w-full max-w-[360px]'
            }`}
          >
            {/* ENCABEZADO DINÁMICO DE SUCURSAL */}
            <div className="pb-2 border-b border-dotted border-gray-300 print:border-gray-300">
              <BranchReceiptHeader
                branch={branch}
                snapshot={order?.branchSnapshot}
                paperWidth={selectedWidth}
                showDianResolution={false}
              />
            </div>

            {/* TÍTULO DE COMANDA DE COCINA */}
            <div className="my-1.5 py-1 font-black tracking-widest text-center uppercase text-black text-sm sm:text-base">
              <span className={typographyClasses.headerBadge}>*** COMANDA DE COCINA ***</span>
            </div>

            {/* DESTINO: MESA O MODALIDAD */}
            <div className="my-2 py-1 text-center">
              <div className="text-[11px] font-bold uppercase text-black tracking-wider">DESTINO / ENTREGA</div>
              <div className={`${typographyClasses.destination} text-black uppercase leading-tight font-black`}>
                {tableName}
              </div>
              {order?.customerName && orderType !== 'mesa' && (
                <div className="text-xs font-bold text-black mt-0.5 uppercase">
                  CLIENTE: {order.customerName}
                </div>
              )}
            </div>

            {/* METADATOS DEL PEDIDO (NÚMERO, HORA, MESERO) */}
            <div className={`py-1.5 border-b border-dotted border-gray-300 print:border-gray-300 ${typographyClasses.orderMeta} text-black space-y-0.5`}>
              <div className="flex justify-between items-center">
                <span className="font-bold">ORDEN / PEDIDO:</span>
                <span className="font-black text-base sm:text-lg">#{orderNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold">HORA:</span>
                <span className="font-bold">{formatColombiaDateTime(createdAt)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold">MESERO / RESPONSABLE:</span>
                <span className="font-bold">{waiterName}</span>
              </div>
              {selectedRound !== 'all' && (
                <div className="flex justify-between items-center font-bold text-black mt-0.5">
                  <span>RONDA EN PREPARACIÓN:</span>
                  <span className="font-black">RONDA #{selectedRound}</span>
                </div>
              )}
            </div>

            {/* NOTA GENERAL DEL PEDIDO (SI EXISTE) */}
            {generalNotes && (
              <div className="my-2 py-1 px-2 border border-dotted border-gray-300 text-black">
                <div className="text-[10px] font-black uppercase tracking-wider text-black flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-black" />
                  <span>NOTA DEL CLIENTE:</span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-black mt-0.5 leading-snug">
                  "{generalNotes}"
                </div>
              </div>
            )}

            {/* LISTA DE PLATOS Y PRODUCTOS */}
            <div className="py-2 space-y-2.5">
              <div className="text-center font-black text-xs uppercase tracking-widest border-b border-dotted border-gray-300 print:border-gray-300 pb-1">
                -- PLATOS A PREPARAR --
              </div>

              {Object.entries(groupedByRound).map(([roundNum, items]) => (
                <div key={roundNum} className="space-y-2">
                  {/* Indicador de Ronda si se imprimen todas */}
                  {selectedRound === 'all' && availableRounds.length > 1 && (
                    <div className={`pt-1 pb-1 border-b border-dotted border-gray-300 print:border-gray-300 flex items-center justify-between ${typographyClasses.roundHeader}`}>
                      <span className="font-black text-black">
                        RONDA #{roundNum}
                      </span>
                      <span className="text-[11px] font-bold text-black">
                        {items.length} {items.length === 1 ? 'plato' : 'platos'}
                      </span>
                    </div>
                  )}

                  {/* Ítems individuales con cantidad destacada y nombre legible */}
                  {items.map((it, idx) => (
                    <div
                      key={it.id || idx}
                      className="pb-2 border-b border-dotted border-gray-300 print:border-gray-300 last:border-b-0 space-y-1"
                    >
                      {/* Fila principal: Cantidad prominente + Nombre del plato */}
                      <div className="flex items-start gap-2">
                        {/* Cantidad bien marcada sin relleno ni marco oscuro */}
                        <div
                          className={`${typographyClasses.qtyBadge} font-black text-black text-center shrink-0`}
                        >
                          {it.quantity}X
                        </div>

                        {/* Nombre del plato */}
                        <div className="flex-1">
                          <div className={`${typographyClasses.itemName} text-black uppercase font-black`}>
                            {it.name}
                          </div>
                          {includePrices && it.price > 0 && (
                            <div className="text-[10px] font-mono text-black font-bold">
                              ${(it.price * it.quantity).toLocaleString('es-CO')}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Modificadores o acompañamientos seleccionados (limpios sin categoría y ocultando acompañamientos por defecto) */}
                      {(() => {
                        const visibleMods = getVisibleOrderModifiers(it.selectedModifiers);
                        if (visibleMods.length === 0) return null;
                        return (
                          <div className={`pl-8 space-y-0.5 ${typographyClasses.modifiers} text-black`}>
                            {visibleMods.map((modItem, mIdx) => (
                              <div key={mIdx} className="flex items-center gap-1 font-bold">
                                <span className="font-black text-black">›</span>
                                <span>{modItem.cleanName}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Observaciones o Notas de cocina destacadas */}
                      {it.notes && it.notes.trim() && (
                        <div className="pl-7 pt-0.5">
                          <div className={`${typographyClasses.notesBox} border border-dotted border-gray-300 text-black`}>
                            <span className="block text-[10px] font-black uppercase tracking-wider text-black">
                              ¡OJO COCINA!:
                            </span>
                            <span className="block text-black uppercase font-bold">
                              {it.notes}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Estación de cocina si aplica */}
                      {it.station && it.station !== 'cocina_caliente' && (
                        <div className="pl-8 text-[10px] font-bold uppercase text-black">
                          Estación: [{it.station.replace('_', ' ')}]
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* RESUMEN Y PIE DE COMANDA */}
            <div className="pt-2 border-t border-dotted border-gray-300 print:border-gray-300 space-y-1">
              <div className="flex justify-between items-center text-xs font-bold text-black">
                <span>TOTAL PLATOS / ITEMS:</span>
                <span className="text-base font-black text-black">
                  {totalItemCount}
                </span>
              </div>

              <div className="text-center pt-2 text-[10px] font-black text-black uppercase">
                *** VERIFICAR ANTES DE DESPACHAR ***
              </div>

              <div className="text-center text-[9px] font-mono font-bold text-black pt-0.5">
                Colmena POS · Impreso: {new Date().toLocaleTimeString('es-CO')}
              </div>

              <div className="text-center text-[10px] font-bold text-black pt-1 uppercase">
                *** FIN COMANDA DE COCINA ***
              </div>
            </div>

            {/* Margen de avance de papel para permitir corte limpio sin cortar el texto */}
            <div className="h-8 print:h-12" aria-hidden="true" />

          </div>
        </div>

        {/* Botones de pie (ocultos al imprimir) */}
        <div className="px-4 py-3 border-t border-neutral-200 flex items-center justify-between bg-neutral-50 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#D6A21A]" />
            <span>Imprimir Tirilla POS</span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};

