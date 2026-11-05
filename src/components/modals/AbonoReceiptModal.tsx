import React from 'react';
import { Abono, Branch } from '../../types';
import { BranchReceiptHeader } from '../common/BranchReceiptHeader';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { Printer, X, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';

interface AbonoReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  abono: Abono | null;
  parentTotalAmount?: number;
  remainingBalance?: number;
  branch?: Branch | null;
}

export const AbonoReceiptModal: React.FC<AbonoReceiptModalProps> = ({
  isOpen,
  onClose,
  abono,
  parentTotalAmount,
  remainingBalance,
  branch,
}) => {
  if (!isOpen || !abono) return null;

  const isAnulado = abono.status === 'anulado';
  const paperWidth = abono.branchSnapshot?.printConfig?.paperWidth || branch?.printConfig?.paperWidth || '80mm';
  const is58mm = paperWidth === '58mm';

  const handlePrint = () => {
    window.print();
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'efectivo':
        return 'Efectivo';
      case 'tarjeta':
        return 'Tarjeta Débito/Crédito';
      case 'nequi_daviplata':
        return 'Nequi / Daviplata';
      case 'transferencia':
        return 'Transferencia Bancaria';
      default:
        return method;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="relative bg-[#181818] border border-[#B77900]/40 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden print:border-none print:shadow-none print:max-w-none print:w-auto print:bg-white print:text-black">
        
        {/* Encabezado Modal (Oculto al imprimir) */}
        <div className="flex items-center justify-between p-4 border-b border-[#333333] print:hidden bg-[#1f1e24]">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#D6A21A]" />
            <h3 className="text-sm font-black text-[#FFFDF5]">
              Comprobante de Abono Térmico
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#a8a29e] hover:text-[#FFFDF5] rounded-lg hover:bg-[#2d2d2d] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido Imprimible (Tirilla Térmica POS) */}
        <div className="p-6 overflow-y-auto max-h-[75vh] flex justify-center bg-[#121214] print:p-0 print:bg-white print:max-h-none">
          <div
            id="thermal-abono-ticket"
            className={`bg-[#FFFDF5] text-[#181818] p-5 rounded-2xl shadow-md border border-neutral-200 font-mono text-xs print:p-2 print:border-none print:shadow-none print:rounded-none ${
              is58mm ? 'w-[260px] text-[10px]' : 'w-[320px] text-[11px]'
            }`}
          >
            {/* Encabezado dinámico de la Sucursal con los 5 controles */}
            <BranchReceiptHeader
              snapshot={abono.branchSnapshot}
              branch={branch}
              paperWidth={paperWidth}
              className="mb-3"
            />

            {/* Separador */}
            <div className="border-t border-dashed border-neutral-400 my-2" />

            {/* Marca de agua si está Anulado */}
            {isAnulado && (
              <div className="my-2 p-2 bg-red-100 border border-red-400 text-red-800 rounded text-center">
                <div className="flex items-center justify-center gap-1 font-black text-xs uppercase tracking-widest text-red-700">
                  <ShieldAlert className="w-4 h-4 text-red-600" />
                  <span>*** REGISTRO ANULADO ***</span>
                </div>
                {abono.voidReason && (
                  <p className="text-[10px] mt-1 leading-tight text-red-900 font-sans">
                    <strong>Motivo:</strong> {abono.voidReason}
                  </p>
                )}
                {abono.voidedAt && (
                  <p className="text-[9px] text-red-700 font-sans mt-0.5">
                    Anulado por {abono.voidedBy || 'Personal'} el {formatColombiaDateTime(abono.voidedAt)}
                  </p>
                )}
              </div>
            )}

            {/* Título del Comprobante */}
            <div className="text-center font-black uppercase tracking-wider text-xs my-2">
              COMPROBANTE DE INGRESO / ABONO
            </div>

            {/* Datos del Comprobante */}
            <div className="space-y-1 text-left my-2 border-b border-dashed border-neutral-300 pb-2">
              <div className="flex justify-between">
                <span className="text-neutral-500">Comprobante No:</span>
                <span className="font-bold text-[#181818]">{abono.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Fecha y Hora:</span>
                <span className="font-bold text-[#181818]">{formatColombiaDateTime(abono.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Tipo de Trámite:</span>
                <span className="font-bold uppercase text-[#B77900]">
                  {abono.parentType === 'separado' ? 'Separado / Reserva' : 'Abono a Cartera'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Atendido por:</span>
                <span className="font-medium text-[#181818]">{abono.userName}</span>
              </div>
            </div>

            {/* Datos del Cliente */}
            <div className="space-y-1 text-left my-2 border-b border-dashed border-neutral-300 pb-2">
              <div className="font-bold uppercase text-[10px] text-neutral-600 mb-1">
                Datos del Cliente
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Nombre / Razón:</span>
                <span className="font-bold text-[#181818] text-right truncate max-w-[170px]">
                  {abono.customerName}
                </span>
              </div>
              {abono.customerDocument && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Documento / NIT:</span>
                  <span className="font-medium text-[#181818]">{abono.customerDocument}</span>
                </div>
              )}
              {abono.customerPhone && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Celular:</span>
                  <span className="font-medium text-[#181818]">{abono.customerPhone}</span>
                </div>
              )}
            </div>

            {/* Detalle Financiero del Abono */}
            <div className="my-3 space-y-1.5 bg-neutral-100 p-2.5 rounded-lg border border-neutral-200">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold uppercase text-neutral-700">VALOR ABONADO:</span>
                <span className="font-black text-sm text-[#181818]">
                  {formatCOP(abono.amount)}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-neutral-500">Medio de Pago:</span>
                <span className="font-semibold text-neutral-800">{getMethodLabel(abono.paymentMethod)}</span>
              </div>
              {parentTotalAmount !== undefined && (
                <div className="flex justify-between text-[10px] pt-1 border-t border-neutral-200">
                  <span className="text-neutral-500">Valor Total Operación:</span>
                  <span className="font-medium text-neutral-800">{formatCOP(parentTotalAmount)}</span>
                </div>
              )}
              {remainingBalance !== undefined && (
                <div className="flex justify-between text-[11px] font-bold text-neutral-900 pt-0.5">
                  <span>Nuevo Saldo Pendiente:</span>
                  <span className={remainingBalance > 0 ? 'text-amber-800' : 'text-emerald-700'}>
                    {formatCOP(remainingBalance)}
                  </span>
                </div>
              )}
            </div>

            {/* Notas / Observaciones */}
            {abono.notes && (
              <div className="text-left text-[10px] my-2 p-1.5 bg-neutral-50 rounded border border-neutral-200">
                <span className="font-bold text-neutral-600 block">Observaciones:</span>
                <p className="text-neutral-700 italic leading-snug">{abono.notes}</p>
              </div>
            )}

            {/* Firma y Pie */}
            <div className="text-center mt-6 pt-4 border-t border-dashed border-neutral-300">
              <div className="w-36 border-b border-neutral-400 mx-auto mb-1"></div>
              <p className="text-[9px] text-neutral-500 uppercase">Firma del Cajero / Recibido</p>
              <p className="text-[9px] text-neutral-400 mt-3">
                Comprobante electrónico válido interno de caja · Sistema Colmena
              </p>
            </div>
          </div>
        </div>

        {/* Botones de Acción (Oculto al imprimir) */}
        <div className="p-4 bg-[#1f1e24] border-t border-[#333333] flex items-center justify-end gap-3 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#444444] text-[#d6d3d1] hover:bg-[#2d2d2d] text-xs font-bold cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center gap-2 hover:brightness-110 shadow-lg cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Tirilla POS</span>
          </button>
        </div>
      </div>
    </div>
  );
};
