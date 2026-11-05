import React from 'react';
import { Branch, BranchReceiptSnapshot } from '../../types';
import { BranchReceiptHeader } from '../common/BranchReceiptHeader';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { Printer, X, ShieldAlert } from 'lucide-react';

export type SupplierVoucherType = 'anticipo' | 'pago' | 'aplicacion_anticipo' | 'reintegro';

export interface SupplierVoucherData {
  voucherType: SupplierVoucherType;
  voucherNumber: string; // Ej: ANT-1001, PAG-1001, APL-1001, REI-1001
  date: string;
  supplierName: string;
  supplierDocument?: string;
  supplierPhone?: string;
  amount: number;
  paymentMethod?: string;
  relatedDocumentNumber?: string; // Factura o pedido
  observations?: string;
  userName: string;
  branchSnapshot?: BranchReceiptSnapshot;
  status?: 'activo' | 'disponible' | 'parcialmente_aplicado' | 'aplicado_totalmente' | 'reintegrado' | 'anulado';
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  totalPurchaseAmount?: number;
  remainingBalanceDue?: number;
  advanceAvailableBalance?: number;
}

interface SupplierVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: SupplierVoucherData | null;
  branch?: Branch | null;
}

export const SupplierVoucherModal: React.FC<SupplierVoucherModalProps> = ({
  isOpen,
  onClose,
  voucher,
  branch,
}) => {
  if (!isOpen || !voucher) return null;

  const isAnulado = voucher.status === 'anulado';
  const paperWidth = voucher.branchSnapshot?.printConfig?.paperWidth || branch?.printConfig?.paperWidth || '80mm';
  const is58mm = paperWidth === '58mm';

  const handlePrint = () => {
    window.print();
  };

  const getTitle = () => {
    switch (voucher.voucherType) {
      case 'anticipo':
        return 'COMPROBANTE DE EGRESO / ANTICIPO A PROVEEDOR';
      case 'pago':
        return 'COMPROBANTE DE EGRESO / PAGO A PROVEEDOR';
      case 'aplicacion_anticipo':
        return 'CONSTANCIA DE APLICACIÓN DE ANTICIPO (SIN MOV. DE CAJA)';
      case 'reintegro':
        return 'COMPROBANTE DE INGRESO / REINTEGRO DE ANTICIPO';
      default:
        return 'COMPROBANTE COMERCIAL DE PROVEEDORES';
    }
  };

  const getPaymentMethodLabel = (method?: string) => {
    if (!method) return 'N/A';
    switch (method) {
      case 'efectivo':
        return 'Efectivo en Caja';
      case 'tarjeta':
        return 'Datáfono / Tarjeta';
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
              Comprobante de Proveedores Térmico
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#a8a29e] hover:text-[#FFFDF5] rounded-lg hover:bg-[#2d2d2d] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido Imprimible (Tirilla Térmica POS) */}
        <div className={`p-6 bg-white text-black font-mono text-xs shadow-inner mx-auto ${is58mm ? 'max-w-[240px]' : 'max-w-[320px]'} relative`}>
          
          {/* Marca de Agua de Anulado */}
          {isAnulado && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-20">
              <span className="text-red-600 font-black text-4xl transform -rotate-45 border-8 border-red-600 px-4 py-2 rounded-2xl">
                ANULADO
              </span>
            </div>
          )}

          {/* Encabezado Dinámico de Sucursal */}
          <BranchReceiptHeader
            branch={branch}
            snapshot={voucher.branchSnapshot}
            paperWidth={paperWidth}
            className="mb-3 border-b border-dashed border-gray-300 pb-3"
          />

          {/* Título del Documento */}
          <div className="text-center font-black uppercase tracking-tight text-[11px] mb-3 bg-stone-100 p-1.5 rounded">
            {getTitle()}
          </div>

          {/* Datos del Comprobante */}
          <div className="space-y-1 text-[11px] border-b border-dashed border-gray-300 pb-3 mb-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Comprobante No:</span>
              <span className="font-bold">{voucher.voucherNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Fecha y Hora:</span>
              <span className="font-bold">{formatColombiaDateTime(voucher.date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Responsable:</span>
              <span className="font-bold">{voucher.userName}</span>
            </div>
          </div>

          {/* Datos del Proveedor */}
          <div className="space-y-1 text-[11px] border-b border-dashed border-gray-300 pb-3 mb-3 bg-stone-50 p-2 rounded">
            <span className="font-bold uppercase text-[10px] text-gray-500 block mb-1">
              Datos del Proveedor
            </span>
            <div className="flex justify-between">
              <span className="text-gray-600">Razón / Nombre:</span>
              <span className="font-bold text-right truncate max-w-[150px]">{voucher.supplierName}</span>
            </div>
            {voucher.supplierDocument && (
              <div className="flex justify-between">
                <span className="text-gray-600">NIT / Cédula:</span>
                <span>{voucher.supplierDocument}</span>
              </div>
            )}
            {voucher.supplierPhone && (
              <div className="flex justify-between">
                <span className="text-gray-600">Celular:</span>
                <span>{voucher.supplierPhone}</span>
              </div>
            )}
          </div>

          {/* Detalles Financieros */}
          <div className="space-y-1.5 text-[11px] border-b border-dashed border-gray-300 pb-3 mb-3">
            <div className="flex justify-between text-xs font-black bg-stone-100 p-1.5 rounded">
              <span>VALOR OPERACIÓN:</span>
              <span className="font-mono text-sm">{formatCOP(voucher.amount)}</span>
            </div>

            {voucher.voucherType !== 'aplicacion_anticipo' && (
              <div className="flex justify-between">
                <span className="text-gray-600">Medio de Pago:</span>
                <span className="font-bold">{getPaymentMethodLabel(voucher.paymentMethod)}</span>
              </div>
            )}

            {voucher.relatedDocumentNumber && (
              <div className="flex justify-between">
                <span className="text-gray-600">Doc. Compra Relacionado:</span>
                <span className="font-bold">#{voucher.relatedDocumentNumber}</span>
              </div>
            )}

            {voucher.totalPurchaseAmount !== undefined && (
              <div className="flex justify-between text-[10px] text-gray-600">
                <span>Total Compra Original:</span>
                <span>{formatCOP(voucher.totalPurchaseAmount)}</span>
              </div>
            )}

            {voucher.remainingBalanceDue !== undefined && (
              <div className="flex justify-between font-bold text-amber-700 bg-amber-50 p-1 rounded mt-1">
                <span>Nuevo Saldo Pendiente:</span>
                <span>{formatCOP(voucher.remainingBalanceDue)}</span>
              </div>
            )}

            {voucher.advanceAvailableBalance !== undefined && (
              <div className="flex justify-between font-bold text-emerald-700 bg-emerald-50 p-1 rounded mt-1">
                <span>Saldo Disponible Anticipo:</span>
                <span>{formatCOP(voucher.advanceAvailableBalance)}</span>
              </div>
            )}
          </div>

          {/* Observaciones */}
          {voucher.observations && (
            <div className="text-[10px] border-b border-dashed border-gray-300 pb-2 mb-3">
              <span className="text-gray-500 font-bold block">Observaciones:</span>
              <p className="italic text-gray-700">{voucher.observations}</p>
            </div>
          )}

          {/* Información de Anulación */}
          {isAnulado && voucher.voidReason && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded text-[10px] mb-3 space-y-1">
              <div className="font-bold flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-red-600" />
                <span>INFORMACIÓN DE ANULACIÓN</span>
              </div>
              <p><strong>Motivo:</strong> {voucher.voidReason}</p>
              {voucher.voidedBy && <p><strong>Anulado por:</strong> {voucher.voidedBy}</p>}
              {voucher.voidedAt && <p><strong>Fecha anulación:</strong> {formatColombiaDateTime(voucher.voidedAt)}</p>}
            </div>
          )}

          {/* Pie del Comprobante */}
          <div className="text-center text-[9px] text-gray-500 pt-1 space-y-1">
            <div className="border-t border-gray-300 pt-6 mt-6 w-3/4 mx-auto text-center font-sans text-gray-400">
              Firma Responsable / Recibido
            </div>
            <p className="mt-2 font-bold text-gray-700">
              Sistema Colmena Restaurante
            </p>
            <p>Comprobante oficial interno de caja e insumos</p>
          </div>
        </div>

        {/* Acciones Inferiores (Ocultas al imprimir) */}
        <div className="p-4 border-t border-[#333333] bg-[#1f1e24] flex items-center justify-between print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#444444] text-[#d6d3d1] hover:bg-[#2d2d2d] text-xs font-bold cursor-pointer transition-colors"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center gap-2 hover:brightness-110 shadow-lg cursor-pointer transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Tirilla POS</span>
          </button>
        </div>

      </div>
    </div>
  );
};
