import React, { useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Order, OrderItem, Comanda, PaperWidth } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import { formatColombiaDateTime } from '../../utils/calculations';
import { BranchReceiptHeader } from '../common/BranchReceiptHeader';
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
    <div className="colmena-ticket-print-portal fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:static print:p-0 print:bg-white print:overflow-visible">
      <div className="bg-[#121117] border border-[#3f3521] rounded-2xl w-full max-w-md shadow-2xl text-[#faf5ee] overflow-hidden flex flex-col max-h-[92vh] print:static print:border-none print:shadow-none print:bg-white print:max-w-none print:max-h-none print:w-full print:overflow-visible">
        
        {/* Cabecera modal (oculta en impresión, idéntica a Ticket de cobro al cliente) */}
        <div className="p-4 border-b border-[#2d281e] flex items-center justify-between bg-[#17161f] print:hidden">
          <div className="flex items-center gap-2 text-[#d4af37] font-bold text-sm">
            <ChefHat className="w-4 h-4" />
            <span>Ticket POS de Cocina</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#a8a29e] hover:text-[#fef3c7] cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tirilla POS Imprimible (Únicamente el ticket) */}
        <div className="flex justify-center p-4 bg-[#0a0a0c] overflow-y-auto print:block print:bg-white print:p-0 print:overflow-visible">
          <div
            id="printable-kitchen-pos-ticket"
            data-testid="kitchen-pos-ticket"
            className={`colmena-printable-ticket p-5 bg-white text-black font-mono shadow-inner select-all rounded-sm transition-all print:shadow-none print:border-none print:m-0 print:p-0 print:text-black print:bg-white ${
              is58mm ? 'w-full max-w-[270px]' : 'w-full max-w-[360px]'
            }`}
          >
            {/* ENCABEZADO DINÁMICO DE SUCURSAL */}
            <div className="pb-2 border-b-2 border-dashed border-black">
              <BranchReceiptHeader
                branch={branch}
                snapshot={order?.branchSnapshot}
                paperWidth={selectedWidth}
                showDianResolution={false}
              />
            </div>

            {/* TÍTULO DE COMANDA DE COCINA (Limpio, sin bloques negros pesados) */}
            <div className="my-2 py-1.5 px-2 border-2 border-black font-black tracking-widest text-center uppercase bg-white text-black">
              <span className={typographyClasses.headerBadge}>*** COMANDA DE COCINA ***</span>
            </div>

            {/* DESTINO: MESA O MODALIDAD (Fondo blanco nítido con borde negro visible) */}
            <div className="my-2.5 py-2 px-2 border-2 border-black text-center bg-white">
              <div className="text-[11px] font-black uppercase text-black tracking-wider">DESTINO / ENTREGA</div>
              <div className={`${typographyClasses.destination} text-black uppercase leading-tight font-black`}>
                {tableName}
              </div>
              {order?.customerName && orderType !== 'mesa' && (
                <div className="text-xs font-black text-black mt-1 border-t border-black pt-1 uppercase">
                  CLIENTE: {order.customerName}
                </div>
              )}
            </div>

            {/* METADATOS DEL PEDIDO (NÚMERO, HORA, MESERO) */}
            <div className={`py-1.5 border-b-2 border-dashed border-black ${typographyClasses.orderMeta} text-black space-y-0.5`}>
              <div className="flex justify-between items-center">
                <span className="font-black">ORDEN / PEDIDO:</span>
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
                <div className="flex justify-between items-center font-black border border-black bg-white px-1.5 py-0.5 mt-1">
                  <span>RONDA EN PREPARACIÓN:</span>
                  <span>RONDA #{selectedRound}</span>
                </div>
              )}
            </div>

            {/* NOTA GENERAL DEL PEDIDO (SI EXISTE) */}
            {generalNotes && (
              <div className="my-2 p-2 border-2 border-black bg-white">
                <div className="text-[10px] font-black uppercase tracking-wider text-black flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-black" />
                  <span>NOTA GENERAL DEL CLIENTE:</span>
                </div>
                <div className="text-xs sm:text-sm font-black text-black mt-0.5 leading-snug">
                  "{generalNotes}"
                </div>
              </div>
            )}

            {/* LISTA DE PLATOS Y PRODUCTOS */}
            <div className="py-2 space-y-3">
              <div className="text-center font-black text-xs uppercase tracking-widest border-b-2 border-black pb-1">
                -- PLATOS A PREPARAR --
              </div>

              {Object.entries(groupedByRound).map(([roundNum, items]) => (
                <div key={roundNum} className="space-y-2.5">
                  {/* Indicador de Ronda si se imprimen todas */}
                  {selectedRound === 'all' && availableRounds.length > 1 && (
                    <div className={`pt-1 pb-1 border-b-2 border-black flex items-center justify-between ${typographyClasses.roundHeader}`}>
                      <span className="border-2 border-black bg-white text-black px-2 py-0.5 font-black">
                        RONDA #{roundNum}
                      </span>
                      <span className="text-[11px] font-black text-black">
                        {items.length} {items.length === 1 ? 'plato' : 'platos'}
                      </span>
                    </div>
                  )}

                  {/* Ítems individuales con cantidad destacada y nombre legible */}
                  {items.map((it, idx) => (
                    <div
                      key={it.id || idx}
                      className="pb-2.5 border-b border-dashed border-black last:border-b-0 space-y-1"
                    >
                      {/* Fila principal: Cantidad prominente con marco limpio + Nombre del plato */}
                      <div className="flex items-start gap-2">
                        {/* Cuadro de cantidad grande sin relleno oscuro para no quemar el cabezal térmico */}
                        <div
                          className={`${typographyClasses.qtyBadge} border-2 border-black bg-white text-black text-center shrink-0 flex items-center justify-center font-black`}
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

                      {/* Modificadores o acompañamientos seleccionados */}
                      {it.selectedModifiers && it.selectedModifiers.length > 0 && (
                        <div className={`pl-9 space-y-0.5 ${typographyClasses.modifiers} text-black`}>
                          {it.selectedModifiers.map((mod, mIdx) => (
                            <div key={mIdx} className="flex items-center gap-1 font-bold">
                              <span className="font-black text-black">›</span>
                              <span>{mod.optionName || mod.textValue || (mod as any).name || 'Modificador'}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Observaciones o Notas de cocina destacadas */}
                      {it.notes && it.notes.trim() && (
                        <div className="pl-8 pt-0.5">
                          <div className={`${typographyClasses.notesBox} border-2 border-black bg-white text-black`}>
                            <span className="block text-[10px] font-black uppercase tracking-wider text-black">
                              ¡OJO COCINA!:
                            </span>
                            <span className="block text-black uppercase font-black">
                              {it.notes}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Estación de cocina si aplica */}
                      {it.station && it.station !== 'cocina_caliente' && (
                        <div className="pl-9 text-[10px] font-black uppercase text-black">
                          Estación: [{it.station.replace('_', ' ')}]
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* RESUMEN Y PIE DE COMANDA */}
            <div className="pt-2 border-t-2 border-black space-y-1">
              <div className="flex justify-between items-center text-xs font-black text-black">
                <span>TOTAL PLATOS / ITEMS:</span>
                <span className="text-base font-black px-2.5 py-0.5 border-2 border-black bg-white text-black">
                  {totalItemCount}
                </span>
              </div>

              <div className="text-center pt-2 text-[10px] font-black text-black uppercase">
                *** VERIFICAR ANTES DE DESPACHAR ***
              </div>

              <div className="text-center text-[9px] font-mono font-bold text-black pt-0.5">
                Colmena POS · Impreso: {new Date().toLocaleTimeString('es-CO')}
              </div>
            </div>
          </div>
        </div>

        {/* Botones de pie (ocultos al imprimir, idénticos a Ticket de cobro al cliente) */}
        <div className="p-4 border-t border-[#2d281e] flex items-center justify-between bg-[#17161f] print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#383124] text-xs font-semibold text-[#a8a29e] hover:bg-[#201e28] cursor-pointer"
          >
            Listo / Continuar
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-bold text-xs flex items-center gap-1.5 hover:brightness-110 shadow-lg cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Tirilla POS</span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};

