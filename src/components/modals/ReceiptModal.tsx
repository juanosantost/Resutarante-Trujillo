import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Payment, Order } from '../../types';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import { BranchReceiptHeader } from '../common/BranchReceiptHeader';
import { filterReceiptItems } from '../../utils/checkoutCalculations';
import { formatModifiersDisplaySummary } from '../../utils/orderModifierUtils';
import { resolveBranchPrintConfig } from '../../utils/printConfigUtils';
import { Printer, X, CheckCircle } from 'lucide-react';

interface ReceiptModalProps {
  payment: Payment;
  order?: Order | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  payment,
  order,
  onClose,
}) => {
  const { currentBranch: currentContextBranch, staffName } = useRestaurant();
  const { branches, currentUser } = useAuth();

  // Solo mostrar el valor de lo pagado (TOTAL PAGADO, Medio de Pago, Efectivo Recibido, Cambio)
  // cuando realmente se ha registrado el cobro (no en la tirilla previa al pago)
  const isPaid = !payment.id?.startsWith('preview-');

  const rawCashierName = (payment.cashierName || '').trim();
  const isGenericRoleLabel = [
    'administrador colmena',
    'asesor de operación',
    'asesor de operacion',
    'cajero colmena',
    'cocinero',
    'personal colmena',
    'staff',
  ].includes(rawCashierName.toLowerCase());

  const resolvedCashierName =
    !isPaid || !rawCashierName || isGenericRoleLabel
      ? currentUser?.fullName?.trim() || staffName || rawCashierName || 'Usuario'
      : rawCashierName;

  useEffect(() => {
    document.body.classList.add('printing-pos-ticket');
    return () => {
      if (document.querySelectorAll('.colmena-ticket-print-portal').length <= 1) {
        document.body.classList.remove('printing-pos-ticket');
      }
    };
  }, []);

  // Resolución estricta de la sucursal de origen:
  // 1. Snapshot histórico grabado al momento de la transacción
  // 2. Sucursal original por payment.branchId o order.branchId
  // 3. Sucursal actualmente seleccionada como fallback
  const snapshot = payment.branchSnapshot || order?.branchSnapshot;
  const originBranchId = snapshot?.branchId || payment.branchId || order?.branchId;
  const originatingBranch =
    branches.find((b) => b.id === originBranchId) ||
    currentContextBranch;

  const resolvedPrintConfig = resolveBranchPrintConfig(
    originatingBranch?.printConfig,
    snapshot?.printConfig
  );
  const paperWidth = resolvedPrintConfig.paperWidth || '80mm';
  const is58mm = paperWidth === '58mm';
  const titleFontSize =
    originatingBranch?.printConfig?.receiptTitleFontSize ?? resolvedPrintConfig.receiptTitleFontSize;
  const bodyFontSize =
    originatingBranch?.printConfig?.receiptBodyFontSize ?? resolvedPrintConfig.receiptBodyFontSize;
  const titleStyle: React.CSSProperties = { fontSize: `${titleFontSize}px`, lineHeight: 1.25 };
  const bodyStyle: React.CSSProperties = { fontSize: `${bodyFontSize}px`, lineHeight: 1.3 };

  const prefix = snapshot?.prefix || originatingBranch?.receiptConfig?.prefix || 'FAC-';
  const resolutionDian = snapshot?.resolutionDian || originatingBranch?.receiptConfig?.resolutionDian;
  const footerText = snapshot?.footerText || originatingBranch?.receiptConfig?.footerText || '¡Gracias por su visita a Colmena!';

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div className="colmena-ticket-print-portal fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:static print:p-0 print:bg-white print:overflow-visible">
      <div className="bg-white rounded-2xl w-full max-w-[390px] shadow-2xl text-black overflow-hidden flex flex-col border border-neutral-200 print:static print:border-none print:shadow-none print:bg-white print:max-w-none print:w-full print:overflow-visible">
        
        {/* Cabecera modal (oculta en impresión) */}
        <div className="px-4 py-2.5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50 print:hidden">
          <div className="flex items-center gap-2 text-neutral-800 font-bold text-xs uppercase tracking-wider">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Factura de Cobro POS</span>
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

        {/* Tirilla de Factura / Voucher Imprimible */}
        <div className="flex justify-center p-4 sm:p-5 bg-white overflow-y-auto max-h-[80vh] print:max-h-none print:block print:bg-white print:p-0 print:overflow-visible">
          <div
            id="colmena-printable-receipt"
            data-testid="colmena-printable-receipt"
            data-paper-width={paperWidth}
            style={bodyStyle}
            className={`colmena-printable-ticket bg-white text-black font-mono select-all transition-all print:shadow-none print:p-0 print:m-0 ${
              is58mm ? 'w-full max-w-[270px]' : 'w-full max-w-[360px]'
            }`}
          >
            {/* Encabezado dinámico con datos de la sucursal de origen */}
            <div className="pb-2.5 border-b border-dotted border-gray-300 print:border-gray-300">
              <BranchReceiptHeader
                branch={originatingBranch}
                snapshot={snapshot}
                paperWidth={paperWidth}
                showDianResolution={false}
                titleFontSize={titleFontSize}
                bodyFontSize={bodyFontSize}
              />
            </div>

            {/* Datos del Comprobante */}
            <div className="py-2 border-b border-dotted border-gray-300 print:border-gray-300 space-y-1 text-black" style={bodyStyle}>
              <div className="flex flex-wrap justify-between gap-x-2">
                <span className="font-bold">Factura POS:</span>
                <span className="font-black" style={titleStyle}>{prefix}{payment.orderNumber}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-x-2">
                <span className="font-bold">Fecha / Hora:</span>
                <span className="font-bold">{formatColombiaDateTime(payment.createdAt)}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-x-2">
                <span className="font-bold">Cajero / Atendido por:</span>
                <span className="font-bold">{resolvedCashierName}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-x-2">
                <span className="font-bold">Cliente:</span>
                <span className="font-bold">{payment.customerName || 'Consumidor Final'}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-x-2">
                <span className="font-bold">NIT / CC:</span>
                <span className="font-bold">{payment.customerNitOrCedula || '222222222222'}</span>
              </div>
            </div>

            {/* Listado de Productos */}
            <div className="py-2 border-b border-dotted border-gray-300 print:border-gray-300">
              <div className="flex justify-between font-black text-black mb-1.5 pb-1 border-b border-dotted border-gray-300 print:border-gray-300" style={bodyStyle}>
                <span>CANT / DESCRIPCIÓN</span>
                <span>TOTAL</span>
              </div>
              <div className="space-y-1.5 text-black font-bold" style={bodyStyle}>
                {filterReceiptItems(payment, order).length > 0 ? (
                  filterReceiptItems(payment, order).map((it) => {
                    const modSummary = formatModifiersDisplaySummary(it.selectedModifiers);

                    return (
                      <div key={it.id} className="space-y-0.5">
                        <div className="flex justify-between gap-2">
                          <span className="leading-snug font-bold">
                            {it.quantity}x {it.name}
                          </span>
                          <span className="font-black shrink-0">{formatCOP(it.price * it.quantity)}</span>
                        </div>
                        {modSummary && (
                          <div className="font-bold leading-tight pl-2 text-black" style={{ fontSize: `${Math.max(9, bodyFontSize - 1)}px` }}>
                            {modSummary}
                          </div>
                        )}
                        {it.adjustments && it.adjustments.length > 0 && (
                          <div className="font-bold leading-tight pl-2 text-black" style={{ fontSize: `${Math.max(9, bodyFontSize - 1)}px` }}>
                            {it.adjustments.map((a) => a.concept).join(' · ')}
                          </div>
                        )}
                        {it.notes && (
                          <div className="italic font-bold leading-tight pl-2 text-black" style={{ fontSize: `${Math.max(9, bodyFontSize - 1)}px` }}>
                            Obs: {it.notes}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="flex justify-between">
                    <span className="font-bold">Consumo de Alimentos y Bebidas</span>
                    <span className="font-black">{formatCOP(payment.subtotal)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Liquidación de Totales */}
            <div className="py-2 border-b border-dotted border-gray-300 print:border-gray-300 space-y-1 text-black" style={bodyStyle}>
              <div className="flex justify-between font-bold">
                <span>Subtotal:</span>
                <span className="font-black">{formatCOP(payment.subtotal)}</span>
              </div>
              {payment.tax > 0 && (
                <div className="flex justify-between font-bold">
                  <span>Impoconsumo ({Math.round((payment.tax / (payment.subtotal || 1)) * 100)}%):</span>
                  <span className="font-black">{formatCOP(payment.tax)}</span>
                </div>
              )}
              {payment.tipAmount > 0 && (
                <div className="flex justify-between font-bold">
                  <span>Propina Voluntaria:</span>
                  <span className="font-black">{formatCOP(payment.tipAmount)}</span>
                </div>
              )}
              {(payment.advanceApplied || 0) > 0 && (
                <div className="flex justify-between font-bold">
                  <span>Abono Anticipado{order?.fromSeparadoCode ? ` (${order.fromSeparadoCode})` : ''}:</span>
                  <span className="font-black">-{formatCOP(payment.advanceApplied || 0)}</span>
                </div>
              )}
              <div className="flex justify-between font-black pt-1.5 border-t border-dotted border-gray-300 print:border-gray-300 text-black" style={titleStyle}>
                <span>{isPaid ? 'TOTAL PAGADO:' : 'TOTAL:'}</span>
                <span>{formatCOP(payment.total)}</span>
              </div>
            </div>

            {/* Medios de Pago y Valores Pagados */}
            {isPaid && (
              <div className="py-2 border-b border-dotted border-gray-300 print:border-gray-300 space-y-1 text-black" style={bodyStyle}>
                <div className="flex justify-between capitalize">
                  <span className="font-bold">Medio de Pago:</span>
                  <span className="font-black">{payment.method?.replace(/_/g, ' ')}</span>
                </div>
                {payment.method === 'mixto' && payment.splits && payment.splits.length > 0 && (
                  <div className="pt-1 mt-1 border-t border-dotted border-gray-300 print:border-gray-300 space-y-0.5">
                    {payment.splits.map((s, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="capitalize font-bold">• {s.method.replace(/_/g, ' ')}:</span>
                        <span className="font-black">{formatCOP(s.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {payment.method === 'efectivo' && (
                  <>
                    <div className="flex justify-between font-bold">
                      <span>Efectivo Recibido:</span>
                      <span className="font-black">{formatCOP(payment.amountPaid)}</span>
                    </div>
                    <div className="flex justify-between font-black">
                      <span>Cambio / Vueltas:</span>
                      <span>{formatCOP(payment.change)}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Mensaje de Despedida y DIAN */}
            <div className="pt-3 text-center space-y-1 text-black" style={{ fontSize: `${Math.max(9, bodyFontSize - 1)}px`, lineHeight: 1.25 }}>
              <p className="font-bold text-black">{footerText}</p>
              {resolutionDian && <p className="font-semibold text-black">{resolutionDian}</p>}
              <p className="font-bold text-black pt-1 tracking-widest uppercase">
                *** FIN DE LA FACTURA ***
              </p>
            </div>

            {/* Espacio de avance de papel para permitir corte limpio sin cortar el texto */}
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



