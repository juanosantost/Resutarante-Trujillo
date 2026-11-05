import React from 'react';
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

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="bg-[#121117] border border-[#3f3521] rounded-2xl w-full max-w-md shadow-2xl text-[#faf5ee] overflow-hidden flex flex-col print:border-none print:shadow-none print:bg-white print:max-w-none print:w-full">
        
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
        <div className="flex justify-center p-4 bg-[#0a0a0c] print:bg-white print:p-0">
          <div
            id="colmena-printable-receipt"
            data-testid="colmena-printable-receipt"
            className={`p-5 bg-[#fffdfa] text-[#1c1917] font-mono shadow-inner select-all rounded-sm transition-all print:shadow-none print:p-0 print:m-0 ${
              is58mm ? 'w-full max-w-[270px] text-[10px]' : 'w-full max-w-[360px] text-[11px]'
            }`}
          >
            {/* Encabezado dinámico con datos de la sucursal de origen */}
            <div className="pb-3 border-b border-dashed border-[#a8a29e]">
              <BranchReceiptHeader
                branch={originatingBranch}
                snapshot={snapshot}
                paperWidth={paperWidth}
                showDianResolution={false}
              />
            </div>

            {/* Datos del Comprobante */}
            <div className="py-2.5 border-b border-dashed border-[#a8a29e] space-y-1 text-[10px] text-neutral-800">
              <div className="flex justify-between">
                <span>Factura POS:</span>
                <span className="font-bold">{prefix}{payment.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Fecha / Hora:</span>
                <span>{formatColombiaDateTime(payment.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cajero:</span>
                <span>{payment.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Cliente:</span>
                <span>{payment.customerName || 'Consumidor Final'}</span>
              </div>
              <div className="flex justify-between">
                <span>NIT / CC:</span>
                <span>{payment.customerNitOrCedula || '222222222222'}</span>
              </div>
            </div>

            {/* Listado de Productos */}
            <div className="py-2.5 border-b border-dashed border-[#a8a29e]">
              <div className="flex justify-between text-[10px] font-bold text-neutral-900 mb-1.5 pb-1 border-b border-neutral-300">
                <span>CANT / DESCRIPCIÓN</span>
                <span>TOTAL</span>
              </div>
              <div className="space-y-1.5 text-neutral-900">
                {filterReceiptItems(payment, order).length > 0 ? (
                  filterReceiptItems(payment, order).map((it) => (
                    <div key={it.id} className="flex justify-between">
                      <span className="truncate pr-2">
                        {it.quantity}x {it.name}
                      </span>
                      <span className="font-semibold shrink-0">{formatCOP(it.price * it.quantity)}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between">
                    <span>Consumo de Alimentos y Bebidas</span>
                    <span className="font-semibold">{formatCOP(payment.subtotal)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Liquidación de Totales */}
            <div className="py-2.5 border-b border-dashed border-[#a8a29e] space-y-1">
              <div className="flex justify-between text-neutral-700">
                <span>Subtotal:</span>
                <span>{formatCOP(payment.subtotal)}</span>
              </div>
              {payment.tax > 0 && (
                <div className="flex justify-between text-neutral-700">
                  <span>Impoconsumo ({Math.round((payment.tax / (payment.subtotal || 1)) * 100)}%):</span>
                  <span>{formatCOP(payment.tax)}</span>
                </div>
              )}
              {payment.tipAmount > 0 && (
                <div className="flex justify-between text-emerald-800 font-semibold">
                  <span>Propina Voluntaria:</span>
                  <span>{formatCOP(payment.tipAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-neutral-400 text-neutral-900">
                <span>TOTAL PAGADO:</span>
                <span>{formatCOP(payment.total)}</span>
              </div>
            </div>

            {/* Medios de Pago */}
            <div className="py-2.5 border-b border-dashed border-[#a8a29e] space-y-1 text-[10px] text-neutral-800">
              <div className="flex justify-between capitalize">
                <span>Medio de Pago:</span>
                <span className="font-bold">{payment.method?.replace(/_/g, ' ')}</span>
              </div>
              {payment.method === 'efectivo' && (
                <>
                  <div className="flex justify-between">
                    <span>Efectivo Recibido:</span>
                    <span>{formatCOP(payment.amountPaid)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-800">
                    <span>Cambio / Vueltas:</span>
                    <span>{formatCOP(payment.change)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Mensaje de Despedida y DIAN */}
            <div className="pt-3 text-center space-y-1 text-[9px] text-neutral-600">
              <p className="font-semibold text-neutral-900">{footerText}</p>
              {resolutionDian && <p>{resolutionDian}</p>}
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
    </div>
  );
};
