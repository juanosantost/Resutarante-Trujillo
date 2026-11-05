import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { PaperWidth, DEFAULT_BRANCH_PRINT_CONFIG } from '../../types';
import { Printer, X, Receipt, CheckCircle2 } from 'lucide-react';

export interface IncomeReceiptData {
  consecutivo: string;
  type: 'venta' | 'separado' | 'cartera' | 'otro_ingreso';
  date: string;
  concept: string;
  thirdParty?: string;
  documentRef?: string;
  paymentMethod: string;
  amount: number;
  observations?: string;
  userName: string;
  status: 'activo' | 'anulado';
  voidReason?: string;
  balanceResulting?: number;
}

interface IncomeReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: IncomeReceiptData | null;
}

export const IncomeReceiptModal: React.FC<IncomeReceiptModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const { currentBranch } = useRestaurant();
  const [paperWidth, setPaperWidth] = useState<PaperWidth>('80mm');

  if (!isOpen || !data) return null;

  const branchConfig = currentBranch?.printConfig || DEFAULT_BRANCH_PRINT_CONFIG;

  const handlePrint = () => {
    window.print();
  };

  const getTypeLabel = (type: IncomeReceiptData['type']) => {
    switch (type) {
      case 'venta':
        return 'PAGO DE VENTA COMERCIAL';
      case 'separado':
        return 'ABONO A SISTEMA SEPARADO';
      case 'cartera':
        return 'ABONO A CUENTA POR COBRAR (CARTERA)';
      case 'otro_ingreso':
        return 'COMPROBANTE DE OTRO INGRESO';
      default:
        return 'COMPROBANTE DE INGRESO';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="relative bg-[#181818] border border-amber-600/60 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden my-6 text-[#FFFDF5] flex flex-col max-h-[92vh]">
        
        {/* Cabecera del Modal */}
        <div className="p-4 sm:p-5 border-b border-[#333333] flex items-center justify-between bg-gradient-to-r from-[#181818] to-[#242424]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-600/60 text-[#D6A21A] flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-[#FFFDF5]">
                  Comprobante de Ingreso
                </h3>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    data.status === 'activo'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-red-950 text-red-400 border border-red-800 line-through'
                  }`}
                >
                  {data.status}
                </span>
              </div>
              <p className="text-xs text-[#a8a29e]">
                No. Consecutivo: <strong className="text-[#D6A21A]">#{data.consecutivo}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={paperWidth}
              onChange={(e) => setPaperWidth(e.target.value as PaperWidth)}
              aria-label="Ancho de papel térmico"
              className="bg-[#242424] border border-[#383838] rounded-lg px-2 py-1 text-xs text-[#d6d3d1] outline-none"
            >
              <option value="80mm">80 mm</option>
              <option value="58mm">58 mm</option>
            </select>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[#a8a29e] hover:text-[#FFFDF5] rounded-xl hover:bg-[#2d2d2d] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Vista previa del Comprobante Térmico */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#121214] flex justify-center">
          <div
            className={`bg-[#FFFDF5] text-[#181818] p-5 rounded-2xl shadow-xl font-mono text-xs border border-amber-900/30 transition-all ${
              paperWidth === '58mm' ? 'w-[280px]' : 'w-[360px]'
            }`}
          >
            {/* Membrete de la Sucursal */}
            <div className="text-center pb-3 border-b border-dashed border-[#888] space-y-1">
              {branchConfig.showTradeName && (
                <h4 className="font-black text-sm uppercase tracking-wider text-[#181818]">
                  {currentBranch?.name || 'SISTEMA COLMENA'}
                </h4>
              )}
              {branchConfig.showNit && currentBranch?.nit && (
                <p className="text-[11px] text-[#444]">NIT: {currentBranch.nit}</p>
              )}
              {branchConfig.showAddress && currentBranch?.address && (
                <p className="text-[11px] text-[#444]">{currentBranch.address}</p>
              )}
              {branchConfig.showPhone && currentBranch?.phone && (
                <p className="text-[11px] text-[#444]">Tel / Cel: {currentBranch.phone}</p>
              )}
              <div className="pt-1">
                <span className="inline-block bg-[#181818] text-[#FFFDF5] font-black text-[10px] px-2 py-0.5 rounded">
                  {getTypeLabel(data.type)}
                </span>
              </div>
            </div>

            {/* Datos del Comprobante */}
            <div className="py-3 border-b border-dashed border-[#888] space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="font-bold">Comprobante No:</span>
                <span className="font-black">#{data.consecutivo}</span>
              </div>
              <div className="flex justify-between">
                <span>Fecha y Hora:</span>
                <span>{formatColombiaDateTime(data.date)}</span>
              </div>
              {data.documentRef && (
                <div className="flex justify-between">
                  <span>Documento Origen:</span>
                  <span className="font-bold">{data.documentRef}</span>
                </div>
              )}
              {data.thirdParty && (
                <div className="flex justify-between">
                  <span>Cliente / Tercero:</span>
                  <span className="font-bold">{data.thirdParty}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Atendido por:</span>
                <span>{data.userName}</span>
              </div>
            </div>

            {/* Concepto y Medio de Pago */}
            <div className="py-3 border-b border-dashed border-[#888] space-y-2">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#666] block">Concepto:</span>
                <p className="font-bold text-xs">{data.concept}</p>
              </div>

              <div className="flex justify-between items-center pt-1 text-[11px]">
                <span className="text-[#666]">Medio de Pago:</span>
                <span className="font-black uppercase">{data.paymentMethod}</span>
              </div>

              {data.observations && (
                <div className="bg-amber-100/60 p-2 rounded text-[10px] text-[#555] italic">
                  Obs: {data.observations}
                </div>
              )}
            </div>

            {/* Valor Recibido */}
            <div className="py-3 border-b-2 border-[#181818] space-y-1">
              <div className="flex justify-between items-baseline font-black text-sm">
                <span>TOTAL RECIBIDO:</span>
                <span className="text-base">{formatCOP(data.amount)}</span>
              </div>
              {data.balanceResulting !== undefined && (
                <div className="flex justify-between text-[11px] text-[#666] pt-1">
                  <span>Saldo Pendiente:</span>
                  <span className="font-bold">{formatCOP(data.balanceResulting)}</span>
                </div>
              )}
            </div>

            {/* Anulación si aplica */}
            {data.status === 'anulado' && (
              <div className="my-3 p-2 bg-red-100 border border-red-400 rounded text-center text-red-700 text-[10px] font-bold">
                *** REGISTRO ANULADO ***
                {data.voidReason && <p className="font-normal mt-0.5">Motivo: {data.voidReason}</p>}
              </div>
            )}

            {/* Pie de Comprobante */}
            <div className="pt-3 text-center text-[10px] text-[#666] space-y-1">
              <p>¡Gracias por su pago!</p>
              <p className="text-[9px] text-[#888]">Sistema Colmena Restaurante · Colombia</p>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="p-4 border-t border-[#333333] flex items-center justify-between bg-[#181818]">
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center gap-2 hover:brightness-110 shadow-lg cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Comprobante</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] text-xs font-bold text-[#d6d3d1] cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
