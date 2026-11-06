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

        {/* Tirilla de Factura / Voucher Imprimible (Estilo de Alta Nitidez POS) */}
        <div className="flex justify-center p-4 bg-[#0a0a0c] overflow-y-auto print:block print:bg-white print:p-0 print:overflow-visible">
          <div
            id="colmena-printable-receipt"
            data-testid="colmena-printable-receipt"
            className={`colmena-printable-ticket p-5 bg-[#fffdfa] text-[#0a0a0a] font-mono shadow-inner select-all rounded-sm transition-all print:shadow-none print:border-none print:p-0 print:m-0 print:text-black print:bg-white ${
              is58mm ? 'w-full max-w-[270px]' : 'w-full max-w-[360px]'
            }`}
          >
            {/* 1. ENCABEZADO DINÁMICO DE SUCURSAL */}
            <div className="pb-2 border-b-2 border-dashed border-black">
              <BranchReceiptHeader
                branch={originatingBranch}
                snapshot={snapshot}
                paperWidth={paperWidth}
                showDianResolution={false}
              />
            </div>

            {/* 2. TÍTULO DE COMPROBANTE POS */}
            <div className="my-2 py-1.5 px-2 bg-black text-white font-black tracking-widest text-center uppercase rounded-xs">
              <span className={is58mm ? 'text-xs font-black' : 'text-sm font-black'}>
                *** COMPROBANTE DE VENTA POS ***
              </span>
            </div>

            {/* 3. RECUADRO DESTACADO DE FACTURA Y CLIENTE */}
            <div className="my-2 py-2 px-2.5 border-2 border-black rounded-xs bg-neutral-100 text-black space-y-1">
              <div className="flex justify-between items-center border-b border-black pb-1">
                <span className="text-[11px] font-black uppercase">FACTURA POS:</span>
                <span className={`${is58mm ? 'text-base' : 'text-lg'} font-black tracking-tight`}>
                  {prefix}{payment.orderNumber}
                </span>
              </div>
              {order?.tableName && (
                <div className="flex justify-between items-center text-xs font-black">
                  <span>MESA / SERVICIO:</span>
                  <span className="uppercase">{order.tableName}</span>
                </div>
              )}
              <div className="flex justify-between items-start text-xs font-black pt-0.5">
                <span className="shrink-0 pr-2">CLIENTE:</span>
                <span className="text-right uppercase break-words">
                  {payment.customerName || 'Consumidor Final'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold">
                <span>NIT / CC:</span>
                <span className="font-black">{payment.customerNitOrCedula || '222222222222'}</span>
              </div>
            </div>

            {/* 4. METADATOS DE CAJA (FECHA, HORA, CAJERO) */}
            <div className="py-1.5 border-b-2 border-dashed border-black text-xs font-bold text-black space-y-0.5">
              <div className="flex justify-between items-center">
                <span className="font-black">FECHA / HORA:</span>
                <span className="font-bold">{formatColombiaDateTime(payment.createdAt)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-black">CAJERO(A):</span>
                <span className="font-black uppercase">{payment.cashierName}</span>
              </div>
            </div>

            {/* 5. LISTADO DE PRODUCTOS CON ALTA NITIDEZ */}
            <div className="py-2 border-b-2 border-dashed border-black">
              <div className="flex justify-between items-center text-xs font-black text-black mb-2 pb-1 border-b-2 border-black uppercase">
                <span>CANT / DESCRIPCIÓN</span>
                <span>TOTAL</span>
              </div>
              <div className="space-y-2 text-black">
                {filterReceiptItems(payment, order).length > 0 ? (
                  filterReceiptItems(payment, order).map((it) => (
                    <div
                      key={it.id}
                      className="pb-1.5 border-b border-dashed border-neutral-400 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-1.5 flex-1 min-w-0">
                          <span className="bg-black text-white font-black text-xs px-1.5 py-0.5 rounded-xs shrink-0 min-w-[26px] text-center">
                            {it.quantity}X
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className={`${is58mm ? 'text-xs' : 'text-sm'} font-black text-black uppercase leading-snug break-words`}>
                              {it.name}
                            </div>
                            {it.quantity > 1 && (
                              <div className="text-[11px] font-bold text-black">
                                {it.quantity} x {formatCOP(it.price)} c/u
                              </div>
                            )}
                          </div>
                        </div>
                        <span className={`${is58mm ? 'text-xs' : 'text-sm'} font-black text-black shrink-0 pt-0.5`}>
                          {formatCOP(it.price * it.quantity)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between items-center text-xs sm:text-sm font-black text-black">
                    <span>1X CONSUMO ALIMENTOS Y BEBIDAS</span>
                    <span>{formatCOP(payment.subtotal)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 6. LIQUIDACIÓN DE TOTALES */}
            <div className="py-2 border-b-2 border-dashed border-black space-y-1 text-xs font-bold text-black">
              <div className="flex justify-between items-center">
                <span className="font-bold uppercase">SUBTOTAL:</span>
                <span className="font-black">{formatCOP(payment.subtotal)}</span>
              </div>
              {payment.tax > 0 && (
                <div className="flex justify-between items-center">
                  <span className="font-bold uppercase">
                    IMPOCONSUMO ({Math.round((payment.tax / (payment.subtotal || 1)) * 100)}%):
                  </span>
                  <span className="font-black">{formatCOP(payment.tax)}</span>
                </div>
              )}
              {payment.tipAmount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="font-black uppercase">PROPINA VOLUNTARIA:</span>
                  <span className="font-black">{formatCOP(payment.tipAmount)}</span>
                </div>
              )}
              <div className="mt-1.5 py-2 px-2.5 bg-black text-white rounded-xs flex justify-between items-center">
                <span className="text-xs sm:text-sm font-black uppercase tracking-wide">
                  TOTAL PAGADO:
                </span>
                <span className={`${is58mm ? 'text-base' : 'text-lg'} font-black`}>
                  {formatCOP(payment.total)}
                </span>
              </div>
            </div>

            {/* 7. MEDIOS DE PAGO Y CAMBIO */}
            <div className="py-2 border-b-2 border-dashed border-black space-y-1 text-xs font-bold text-black">
              <div className="flex justify-between items-center">
                <span className="font-black uppercase">MEDIO DE PAGO:</span>
                <span className="font-black uppercase">{payment.method?.replace(/_/g, ' ')}</span>
              </div>
              {payment.method === 'efectivo' && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="font-bold uppercase">EFECTIVO RECIBIDO:</span>
                    <span className="font-black">{formatCOP(payment.amountPaid)}</span>
                  </div>
                  <div className="mt-1 py-1 px-2 border-2 border-black bg-neutral-100 rounded-xs flex justify-between items-center text-black">
                    <span className="font-black uppercase">CAMBIO / VUELTAS:</span>
                    <span className="text-sm font-black">{formatCOP(payment.change)}</span>
                  </div>
                </>
              )}
            </div>

            {/* 8. MENSAJE DE DESPEDIDA Y RESOLUCIÓN DIAN */}
            <div className="pt-2.5 text-center space-y-1 text-black">
              <p className="text-xs font-black text-black uppercase leading-snug">
                {footerText}
              </p>
              {resolutionDian && (
                <p className="text-[11px] font-bold text-black leading-snug">
                  {resolutionDian}
                </p>
              )}
              <div className="text-center text-[10px] font-bold text-black pt-1">
                Colmena POS · Impreso: {new Date().toLocaleTimeString('es-CO')}
              </div>
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

