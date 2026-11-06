import React, { useState, useMemo } from 'react';
import { Order, OrderItem, Comanda, PaperWidth } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import { formatColombiaDateTime } from '../../utils/calculations';
import { BranchReceiptHeader } from '../common/BranchReceiptHeader';
import {
  Printer,
  X,
  UtensilsCrossed,
  Layers,
  Clock,
  User,
  ZoomIn,
  ChefHat,
  AlertCircle,
  Check,
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

  // Resolución de sucursal
  const originBranchId = order?.branchId || comanda?.branchId || currentBranch?.id;
  const branch = branches.find((b) => b.id === originBranchId) || currentBranch;

  // Estados de configuración de visualización para el personal de cocina tomados de la configuración de sucursal
  const branchPrintConfig = branch?.printConfig;
  const [fontSize, setFontSize] = useState<KitchenFontSize>(
    branchPrintConfig?.kitchenFontSize || 'grande'
  );
  const [selectedWidth, setSelectedWidth] = useState<PaperWidth>(
    order?.branchSnapshot?.printConfig?.paperWidth || branchPrintConfig?.paperWidth || '80mm'
  );
  const [selectedRound, setSelectedRound] = useState<number | 'all'>(initialRound);
  const [includePrices, setIncludePrices] = useState<boolean>(
    branchPrintConfig?.includeKitchenPrices ?? false
  );

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

  // Clases dinámicas según el tamaño de fuente elegido
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

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="bg-[#14131a] border border-[#d4af37]/40 rounded-3xl w-full max-w-4xl shadow-2xl text-[#fef3c7] overflow-hidden flex flex-col max-h-[92vh] print:border-none print:shadow-none print:bg-white print:max-w-none print:max-h-none print:w-full">
        
        {/* CABECERA DEL MODAL (OCULTA AL IMPRIMIR) */}
        <div className="p-4 sm:p-5 border-b border-[#2d281e] flex items-center justify-between bg-[#18171f] print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#292212] border border-[#d4af37]/50 flex items-center justify-center text-[#d4af37]">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#fef3c7] flex items-center gap-2">
                <span>Impresión POS Cocina</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-[#d4af37] border border-[#d4af37]/40">
                  Letra Grande para Cocineros
                </span>
              </h2>
              <p className="text-xs text-[#a8a29e]">
                Ticket optimizado con tipografía de alto contraste y legibilidad para personal de cocina
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="py-2 px-4 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] hover:brightness-110 text-[#0e0e12] font-black text-xs flex items-center gap-1.5 shadow-lg cursor-pointer transition-transform active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Ticket</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#a8a29e] hover:text-[#fef3c7] hover:bg-[#201e28] cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* VISTA PREVIA DEL TICKET TÉRMICO (LO QUE SE IMPRIME) */}
        <div className="p-4 sm:p-6 flex flex-col items-center justify-start overflow-y-auto print:block print:p-0 print:overflow-visible">
            
            <div className="w-full flex justify-between items-center mb-2 px-2 print:hidden">
              <span className="text-xs font-black text-[#d4af37] flex items-center gap-1.5">
                <ChefHat className="w-4 h-4" />
                Vista Previa del Ticket POS de Cocina (Configurado en Administración)
              </span>
              <span className="text-[11px] text-[#a8a29e] font-mono">
                {is58mm ? '58 mm (~48 mm imprimible)' : '80 mm (~72 mm imprimible)'}
              </span>
            </div>

            {/* Tirilla POS Imprimible */}
            <div
              id="printable-kitchen-pos-ticket"
              data-testid="kitchen-pos-ticket"
              className={`bg-[#fffdfa] text-[#0a0a0a] font-mono shadow-2xl rounded-sm p-4 sm:p-6 border-t-8 border-b-8 border-dashed border-[#d6d3d1] transition-all select-all print:shadow-none print:border-none print:m-0 print:p-0 print:text-black print:bg-white ${
                is58mm ? 'w-full max-w-[290px]' : 'w-full max-w-[390px]'
              }`}
            >
              {/* ENCABEZADO DINÁMICO DE SUCURSAL (CONFIGURADO EN CONFIGURACIÓN) */}
              <div className="pb-2 border-b border-dashed border-[#a8a29e]">
                <BranchReceiptHeader
                  branch={branch}
                  snapshot={order?.branchSnapshot}
                  paperWidth={selectedWidth}
                  showDianResolution={false}
                />
              </div>

              {/* TÍTULO DE COMANDA DE COCINA */}
              <div className="my-2 py-1.5 px-2 bg-black text-white font-black tracking-widest text-center uppercase rounded-xs">
                <span className={typographyClasses.headerBadge}>*** COMANDA DE COCINA ***</span>
              </div>

              {/* DESTINO GIGANTE: MESA O MODALIDAD */}
              <div className="my-2.5 py-2 px-2 border-2 border-black rounded-xs text-center bg-neutral-100">
                <div className="text-[11px] font-black uppercase text-neutral-700">DESTINO / ENTREGA</div>
                <div className={`${typographyClasses.destination} text-black uppercase leading-tight`}>
                  {tableName}
                </div>
                {order?.customerName && orderType !== 'mesa' && (
                  <div className="text-xs font-black text-black mt-0.5">
                    Cliente: {order.customerName}
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
                  <span>HORA:</span>
                  <span>{formatColombiaDateTime(createdAt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>MESERO / RESPONSABLE:</span>
                  <span className="font-bold">{waiterName}</span>
                </div>
                {selectedRound !== 'all' && (
                  <div className="flex justify-between items-center font-black bg-neutral-200 px-1 py-0.5 mt-1 rounded-xs">
                    <span>RONDA EN PREPARACIÓN:</span>
                    <span>RONDA #{selectedRound}</span>
                  </div>
                )}
              </div>

              {/* NOTA GENERAL DEL PEDIDO (SI EXISTE) */}
              {generalNotes && (
                <div className="my-2 p-2 border-2 border-black bg-amber-50 rounded-xs">
                  <div className="text-[10px] font-black uppercase tracking-wider text-black flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-black" />
                    <span>NOTA GENERAL DEL CLIENTE:</span>
                  </div>
                  <div className="text-xs sm:text-sm font-black text-black mt-0.5 leading-snug">
                    "{generalNotes}"
                  </div>
                </div>
              )}

              {/* LISTA DE PLATOS Y PRODUCTOS */}
              <div className="py-2 space-y-3">
                <div className="text-center font-black text-xs uppercase tracking-widest border-b border-black pb-1">
                  -- PLATOS A PREPARAR --
                </div>

                {Object.entries(groupedByRound).map(([roundNum, items]) => (
                  <div key={roundNum} className="space-y-2.5">
                    {/* Indicador de Ronda si se imprimen todas */}
                    {selectedRound === 'all' && availableRounds.length > 1 && (
                      <div className={`pt-1 pb-0.5 border-b-2 border-black flex items-center justify-between ${typographyClasses.roundHeader}`}>
                        <span className="bg-black text-white px-2 py-0.5 rounded-xs">
                          RONDA #{roundNum}
                        </span>
                        <span className="text-[11px] font-bold text-neutral-700">
                          {items.length} {items.length === 1 ? 'plato' : 'platos'}
                        </span>
                      </div>
                    )}

                    {/* Ítems individuales con cantidad y nombre enorme */}
                    {items.map((it, idx) => (
                      <div
                        key={it.id || idx}
                        className="pb-2.5 border-b border-dashed border-neutral-400 last:border-b-0 space-y-1"
                      >
                        {/* Fila principal: Cantidad prominente + Nombre del plato */}
                        <div className="flex items-start gap-2">
                          {/* Cuadro de cantidad gigante */}
                          <div
                            className={`${typographyClasses.qtyBadge} bg-black text-white text-center rounded-xs shrink-0 flex items-center justify-center`}
                          >
                            {it.quantity}X
                          </div>

                          {/* Nombre del plato */}
                          <div className="flex-1">
                            <div className={`${typographyClasses.itemName} text-black uppercase`}>
                              {it.name}
                            </div>
                            {includePrices && it.price > 0 && (
                              <div className="text-[10px] font-mono text-neutral-600">
                                ${(it.price * it.quantity).toLocaleString('es-CO')}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Modificadores o acompañamientos seleccionados */}
                        {it.selectedModifiers && it.selectedModifiers.length > 0 && (
                          <div className={`pl-9 space-y-0.5 ${typographyClasses.modifiers} text-neutral-800`}>
                            {it.selectedModifiers.map((mod, mIdx) => (
                              <div key={mIdx} className="flex items-center gap-1">
                                <span className="font-black text-black">›</span>
                                <span>{mod.optionName || mod.textValue || (mod as any).name || 'Modificador'}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Observaciones o Notas de cocina destacadas */}
                        {it.notes && it.notes.trim() && (
                          <div className="pl-8 pt-0.5">
                            <div className={`${typographyClasses.notesBox} border-black bg-neutral-100 rounded-xs text-black`}>
                              <span className="block text-[10px] font-black uppercase tracking-wider text-black">
                                ¡OJO COCINA!:
                              </span>
                              <span className="block text-black uppercase">
                                {it.notes}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Estación de cocina si aplica */}
                        {it.station && it.station !== 'cocina_caliente' && (
                          <div className="pl-9 text-[10px] font-black uppercase text-neutral-600">
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
                  <span className="text-base font-black px-2 py-0.5 bg-black text-white rounded-xs">
                    {totalItemCount}
                  </span>
                </div>

                <div className="text-center pt-2 text-[10px] font-bold text-neutral-700 uppercase">
                  *** VERIFICAR ANTES DE DESPACHAR ***
                </div>

                <div className="text-center text-[9px] font-mono text-neutral-500 pt-0.5">
                  Colmena POS · Impreso: {new Date().toLocaleTimeString('es-CO')}
                </div>
            </div>

          </div>

        </div>

        {/* PIE DEL MODAL (OCULTO AL IMPRIMIR) */}
        <div className="p-4 border-t border-[#2d281e] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#18171f] print:hidden">
          <div className="flex items-center gap-2 text-xs text-[#a8a29e]">
            <UtensilsCrossed className="w-4 h-4 text-[#d4af37]" />
            <span>
              Tip: Al imprimir en impresora térmica POS de 80mm o 58mm se ajustará automáticamente a los márgenes del rollo.
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl border border-[#383124] text-xs font-bold text-[#a8a29e] hover:bg-[#201e28] cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs flex items-center gap-2 hover:brightness-110 shadow-lg cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Ticket de Cocina</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
