import React, { useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Order, OrderItem, Comanda, PaperWidth } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import { formatColombiaDateTime } from '../../utils/calculations';
import { BranchReceiptHeader } from '../common/BranchReceiptHeader';
import { getVisibleOrderModifiers } from '../../utils/orderModifierUtils';
import { resolveBranchPrintConfig } from '../../utils/printConfigUtils';
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
  const { currentBranch, staffName } = useRestaurant();
  const { branches, currentUser } = useAuth();

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
  const resolvedPrintConfig = resolveBranchPrintConfig(
    branch?.printConfig,
    order?.branchSnapshot?.printConfig
  );
  // Priorizar configuración actual de la sucursal para ajustes de cocina
  const titleFontSize =
    branch?.printConfig?.kitchenTitleFontSize ?? resolvedPrintConfig.kitchenTitleFontSize;
  const bodyFontSize =
    branch?.printConfig?.kitchenBodyFontSize ?? resolvedPrintConfig.kitchenBodyFontSize;
  const showBranchHeader =
    branch?.printConfig?.kitchenShowHeader ?? resolvedPrintConfig.kitchenShowHeader;
  const selectedWidth: PaperWidth = resolvedPrintConfig.paperWidth || '80mm';
  const selectedRound: number | 'all' = initialRound;
  const includePrices: boolean =
    branch?.printConfig?.includeKitchenPrices ?? resolvedPrintConfig.includeKitchenPrices;

  // Normalizar ítems a imprimir y garantizar que aparezca el nombre real del usuario en lugar del cargo
  const orderNumber = order?.orderNumber ?? comanda?.orderNumber ?? 0;
  const tableName = order?.tableName ?? comanda?.tableName ?? (order?.type === 'mesa' ? 'Mesa' : 'Mostrador');
  const orderType = order?.type ?? comanda?.orderType ?? 'mesa';
  const rawWaiterName = (order?.waiterName ?? comanda?.waiterName ?? '').trim();
  const isGenericRoleLabel = [
    'administrador colmena',
    'asesor de operación',
    'asesor de operacion',
    'cajero colmena',
    'cocinero',
    'personal colmena',
    'staff',
  ].includes(rawWaiterName.toLowerCase());
  const waiterName =
    !rawWaiterName || isGenericRoleLabel
      ? currentUser?.fullName?.trim() || staffName || rawWaiterName || 'Usuario'
      : rawWaiterName;
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

  const is58mm = selectedWidth === '58mm';
  const titleStyle: React.CSSProperties = {
    fontSize: `${titleFontSize}px`,
    lineHeight: 1.2,
  };
  const bodyStyle: React.CSSProperties = {
    fontSize: `${bodyFontSize}px`,
    lineHeight: 1.25,
  };

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
            data-paper-width={selectedWidth}
            className={`colmena-printable-ticket bg-white text-black font-mono select-all transition-all print:shadow-none print:border-none print:m-0 print:p-0 print:text-black print:bg-white ${
              is58mm ? 'w-full max-w-[270px]' : 'w-full max-w-[360px]'
            }`}
          >
            {/* ENCABEZADO DINÁMICO DE SUCURSAL */}
            {showBranchHeader && (
              <div className="pb-2 border-b border-dotted border-gray-300 print:border-gray-300">
                <BranchReceiptHeader
                  branch={branch}
                  snapshot={order?.branchSnapshot}
                  paperWidth={selectedWidth}
                  showDianResolution={false}
                  titleFontSize={titleFontSize}
                  bodyFontSize={bodyFontSize}
                />
              </div>
            )}

            {/* TÍTULO DE COMANDA DE COCINA */}
            <div className="my-1.5 py-1 font-black tracking-wide text-center uppercase text-black" style={titleStyle}>
              <span>*** COMANDA DE COCINA ***</span>
            </div>

            {/* DESTINO: MESA O MODALIDAD */}
            <div className="my-2 py-1 text-center space-y-0.5">
              <div className="font-bold uppercase text-black tracking-wider" style={bodyStyle}>
                DESTINO / ENTREGA
              </div>
              <div className="text-black uppercase font-black break-words" style={titleStyle}>
                {tableName}
              </div>
              {order?.customerName && orderType !== 'mesa' && (
                <div className="font-bold text-black mt-0.5 uppercase break-words" style={bodyStyle}>
                  CLIENTE: {order.customerName}
                </div>
              )}
            </div>

            {/* METADATOS DEL PEDIDO (NÚMERO, HORA, MESERO) */}
            <div className="py-1.5 border-b border-dotted border-gray-300 print:border-gray-300 text-black space-y-1" style={bodyStyle}>
              <div className="flex flex-wrap justify-between items-baseline gap-x-2">
                <span className="font-bold">ORDEN:</span>
                <span className="font-black" style={titleStyle}>#{orderNumber}</span>
              </div>
              <div className="flex flex-wrap justify-between items-baseline gap-x-2">
                <span className="font-bold">HORA:</span>
                <span className="font-bold">{formatColombiaDateTime(createdAt)}</span>
              </div>
              <div className="flex flex-wrap justify-between items-baseline gap-x-2">
                <span className="font-bold">MESERO:</span>
                <span className="font-bold break-words">{waiterName}</span>
              </div>
              {selectedRound !== 'all' && (
                <div className="flex flex-wrap justify-between items-baseline gap-x-2 font-bold text-black mt-0.5">
                  <span>RONDA:</span>
                  <span className="font-black" style={titleStyle}>RONDA #{selectedRound}</span>
                </div>
              )}
            </div>

            {/* NOTA GENERAL DEL PEDIDO (SI EXISTE) */}
            {generalNotes && (
              <div className="my-2 py-1.5 px-2 border border-dotted border-gray-300 text-black" style={bodyStyle}>
                <div className="font-black uppercase tracking-wider text-black flex items-center gap-1.5" style={titleStyle}>
                  <AlertCircle className="w-4 h-4 shrink-0 text-black" />
                  <span>NOTA DEL CLIENTE:</span>
                </div>
                <div className="font-bold text-black mt-0.5 break-words">
                  "{generalNotes}"
                </div>
              </div>
            )}

            {/* LISTA DE PLATOS Y PRODUCTOS */}
            <div className="py-2 space-y-2.5">
              <div
                className="text-center font-black uppercase tracking-wider border-b border-dotted border-gray-300 print:border-gray-300 pb-1"
                style={titleStyle}
              >
                -- PLATOS A PREPARAR --
              </div>

              {Object.entries(groupedByRound).map(([roundNum, items]) => (
                <div key={roundNum} className="space-y-2">
                  {/* Indicador de Ronda si se imprimen todas */}
                  {selectedRound === 'all' && availableRounds.length > 1 && (
                    <div
                      className="pt-1 pb-1 border-b border-dotted border-gray-300 print:border-gray-300 flex flex-wrap items-baseline justify-between gap-2"
                      style={titleStyle}
                    >
                      <span className="font-black text-black">
                        RONDA #{roundNum}
                      </span>
                      <span className="font-bold text-black" style={bodyStyle}>
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
                      <div className="flex items-start gap-2" style={titleStyle}>
                        <div className="font-black text-black shrink-0">
                          {it.quantity}X
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-black uppercase font-black break-words">
                            {it.name}
                          </div>
                          {includePrices && it.price > 0 && (
                            <div className="font-mono text-black font-bold" style={bodyStyle}>
                              ${(it.price * it.quantity).toLocaleString('es-CO')}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Modificadores o acompañamientos seleccionados */}
                      {(() => {
                        const visibleMods = getVisibleOrderModifiers(it.selectedModifiers);
                        if (visibleMods.length === 0) return null;
                        return (
                          <div className="pl-3 space-y-0.5 text-black" style={bodyStyle}>
                            {visibleMods.map((modItem, mIdx) => (
                              <div key={mIdx} className="flex items-start gap-1.5 font-bold">
                                <span className="font-black text-black shrink-0">›</span>
                                <span className="break-words">{modItem.cleanName}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Observaciones o Notas de cocina destacadas */}
                      {it.notes && it.notes.trim() && (
                        <div className="pl-2 pt-0.5">
                          <div className="p-1.5 border border-dotted border-gray-300 text-black" style={bodyStyle}>
                            <span className="block font-black uppercase tracking-wider text-black" style={titleStyle}>
                              ¡OJO COCINA!:
                            </span>
                            <span className="block text-black uppercase font-bold break-words">
                              {it.notes}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Estación de cocina si aplica */}
                      {it.station && it.station !== 'cocina_caliente' && (
                        <div className="pl-3 font-bold uppercase text-black" style={bodyStyle}>
                          Estación: [{it.station.replace('_', ' ')}]
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* RESUMEN Y PIE DE COMANDA */}
            <div className="pt-2 border-t border-dotted border-gray-300 print:border-gray-300 space-y-1.5" style={bodyStyle}>
              <div className="flex flex-wrap justify-between items-baseline gap-2 font-bold text-black">
                <span>TOTAL PLATOS / ITEMS:</span>
                <span className="font-black text-black" style={titleStyle}>
                  {totalItemCount}
                </span>
              </div>

              <div className="text-center pt-1 font-black text-black uppercase" style={titleStyle}>
                *** VERIFICAR ANTES DE DESPACHAR ***
              </div>

              <div className="text-center font-mono font-bold text-black pt-0.5">
                Colmena POS · Impreso: {new Date().toLocaleTimeString('es-CO')}
              </div>

              <div className="text-center font-bold text-black pt-0.5 uppercase">
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

