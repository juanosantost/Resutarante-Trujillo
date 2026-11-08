import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Payment, Order } from '../../types';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import { BranchReceiptHeader } from '../common/BranchReceiptHeader';
import { filterReceiptItems } from '../../utils/checkoutCalculations';
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
  const { currentBranch: currentContextBranch } = useRestaurant();
  const { branches } = useAuth();

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

  const paperWidth = snapshot?.printConfig?.paperWidth || originatingBranch?.printConfig?.paperWidth || '80mm';
  const is58mm = paperWidth === '58mm';

  const prefix = snapshot?.prefix || originatingBranch?.receiptConfig?.prefix || 'FAC-';
  const resolutionDian = snapshot?.resolutionDian || originatingBranch?.receiptConfig?.resolutionDian;
  const footerText = snapshot?.footerText || originatingBranch?.receiptConfig?.footerText || '¡Gracias por su visita a Colmena!';

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div className="colmena-ticket-print-portal fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:static print:p-0 print:bg-white print:overflow-visible">
      <div className="bg-[#121117] border border-[#3f3521] rounded-2xl w-full max-w-md shadow-2xl text-[#faf5ee] overflow-hidden flex flex-col print:static print:border-none print:shadow-none print:bg-white print:max-w-none print:w-full print:overflow-visible">
        
        {/* Cabecera modal (oculta en impresión) */}
        <div className="p-4 border-b border-[#2d281e] flex items-center justify-between bg-[#17161f] print:hidden">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>Comprobante de Venta POS</span>
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

        {/* Tirilla de Factura / Voucher Imprimible */}
        <div className="flex justify-center p-4 bg-[#0a0a0c] overflow-y-auto print:block print:bg-white print:p-0 print:overflow-visible">
          <div
            id="colmena-printable-receipt"
            data-testid="colmena-printable-receipt"
            className={`colmena-printable-ticket p-5 bg-white text-black font-mono shadow-inner select-all rounded-sm transition-all print:shadow-none print:p-0 print:m-0 ${
              is58mm ? 'w-full max-w-[270px] text-xs' : 'w-full max-w-[360px] text-[13px]'
            }`}
          >
            {/* Encabezado dinámico con datos de la sucursal de origen */}
            <div className="pb-3 border-b border-dashed border-black">
              <BranchReceiptHeader
                branch={originatingBranch}
                snapshot={snapshot}
                paperWidth={paperWidth}
                showDianResolution={false}
              />
            </div>

            {/* Datos del Comprobante */}
            <div className={`py-2.5 border-b border-dashed border-black space-y-1 text-black ${is58mm ? 'text-[11px]' : 'text-xs'}`}>
              <div className="flex justify-between">
                <span className="font-semibold">Factura POS:</span>
                <span className="font-black">{prefix}{payment.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Fecha / Hora:</span>
                <span className="font-bold">{formatColombiaDateTime(payment.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Cajero:</span>
                <span className="font-bold">{payment.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Cliente:</span>
                <span className="font-bold">{payment.customerName || 'Consumidor Final'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">NIT / CC:</span>
                <span className="font-bold">{payment.customerNitOrCedula || '222222222222'}</span>
              </div>
            </div>

            {/* Listado de Productos */}
            <div className="py-2.5 border-b border-dashed border-black">
              <div className={`flex justify-between font-black text-black mb-1.5 pb-1 border-b border-black ${is58mm ? 'text-[11px]' : 'text-xs'}`}>
                <span>CANT / DESCRIPCIÓN</span>
                <span>TOTAL</span>
              </div>
              <div className={`space-y-1.5 text-black font-bold ${is58mm ? 'text-xs' : 'text-[13px]'}`}>
                {filterReceiptItems(payment, order).length > 0 ? (
                  filterReceiptItems(payment, order).map((it) => (
                    <div key={it.id} className="flex justify-between gap-2">
                      <span className="leading-snug">
                        {it.quantity}x {it.name}
                      </span>
                      <span className="font-black shrink-0">{formatCOP(it.price * it.quantity)}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between">
                    <span>Consumo de Alimentos y Bebidas</span>
                    <span className="font-black">{formatCOP(payment.subtotal)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Liquidación de Totales */}
            <div className={`py-2.5 border-b border-dashed border-black space-y-1 text-black ${is58mm ? 'text-xs' : 'text-[13px]'}`}>
              <div className="flex justify-between font-semibold">
                <span>Subtotal:</span>
                <span className="font-bold">{formatCOP(payment.subtotal)}</span>
              </div>
              {payment.tax > 0 && (
                <div className="flex justify-between font-semibold">
                  <span>Impoconsumo ({Math.round((payment.tax / (payment.subtotal || 1)) * 100)}%):</span>
                  <span className="font-bold">{formatCOP(payment.tax)}</span>
                </div>
              )}
              {payment.tipAmount > 0 && (
                <div className="flex justify-between font-bold">
                  <span>Propina Voluntaria:</span>
                  <span className="font-black">{formatCOP(payment.tipAmount)}</span>
                </div>
              )}
              <div className={`flex justify-between font-black pt-1.5 border-t border-black text-black ${is58mm ? 'text-sm' : 'text-base'}`}>
                <span>TOTAL PAGADO:</span>
                <span>{formatCOP(payment.total)}</span>
              </div>
            </div>

            {/* Medios de Pago */}
            <div className={`py-2.5 border-b border-dashed border-black space-y-1 text-black ${is58mm ? 'text-[11px]' : 'text-xs'}`}>
              <div className="flex justify-between capitalize">
                <span className="font-semibold">Medio de Pago:</span>
                <span className="font-black">{payment.method?.replace(/_/g, ' ')}</span>
              </div>
              {payment.method === 'mixto' && payment.splits && payment.splits.length > 0 && (
                <div className="pt-1 mt-1 border-t border-dotted border-black/50 space-y-0.5">
                  {payment.splits.map((s, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="capitalize font-medium">• {s.method.replace(/_/g, ' ')}:</span>
                      <span className="font-bold">{formatCOP(s.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              {payment.method === 'efectivo' && (
                <>
                  <div className="flex justify-between font-semibold">
                    <span>Efectivo Recibido:</span>
                    <span className="font-bold">{formatCOP(payment.amountPaid)}</span>
                  </div>
                  <div className="flex justify-between font-black">
                    <span>Cambio / Vueltas:</span>
                    <span>{formatCOP(payment.change)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Mensaje de Despedida y DIAN */}
            <div className={`pt-3 text-center space-y-1 text-black ${is58mm ? 'text-[10px]' : 'text-[11px]'}`}>
              <p className="font-bold text-black">{footerText}</p>
              {resolutionDian && <p className="font-semibold text-black">{resolutionDian}</p>}
            </div>

          </div>
        </div>

        {/* Botones de pie (ocultos al imprimir) */}
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

