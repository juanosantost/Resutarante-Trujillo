import React, { useState } from 'react';
import { Branch, BranchPrintConfig, DEFAULT_BRANCH_PRINT_CONFIG, PaperWidth } from '../../types';
import { BranchReceiptHeader } from '../common/BranchReceiptHeader';
import { formatCOP } from '../../utils/calculations';
import {
  X,
  Printer,
  Sparkles,
  Eye,
  Sliders,
  Check,
  Smartphone,
  MapPin,
  FileText,
  Image as ImageIcon,
  Building2,
} from 'lucide-react';

interface BranchReceiptPreviewModalProps {
  branch?: Branch | null;
  overrideData?: {
    name?: string;
    nit?: string;
    address?: string;
    phone?: string;
    logoUrl?: string;
    printConfig?: BranchPrintConfig;
    resolutionDian?: string;
    footerText?: string;
    prefix?: string;
    currentNumber?: number;
    showTax?: boolean;
    taxRate?: number;
  };
  onClose: () => void;
  onUpdatePrintConfig?: (config: BranchPrintConfig) => void;
}

export const BranchReceiptPreviewModal: React.FC<BranchReceiptPreviewModalProps> = ({
  branch,
  overrideData,
  onClose,
  onUpdatePrintConfig,
}) => {
  const initialPrintConfig: BranchPrintConfig =
    overrideData?.printConfig ||
    branch?.printConfig ||
    DEFAULT_BRANCH_PRINT_CONFIG;

  const [activeConfig, setActiveConfig] = useState<BranchPrintConfig>(initialPrintConfig);
  const [selectedWidth, setSelectedWidth] = useState<PaperWidth>(initialPrintConfig.paperWidth || '80mm');

  const handleToggle = (key: keyof Omit<BranchPrintConfig, 'paperWidth'>) => {
    const updated: BranchPrintConfig = {
      ...activeConfig,
      [key]: !activeConfig[key],
    };
    setActiveConfig(updated);
    if (onUpdatePrintConfig) {
      onUpdatePrintConfig(updated);
    }
  };

  const handleWidthChange = (w: PaperWidth) => {
    setSelectedWidth(w);
    const updated: BranchPrintConfig = {
      ...activeConfig,
      paperWidth: w,
    };
    setActiveConfig(updated);
    if (onUpdatePrintConfig) {
      onUpdatePrintConfig(updated);
    }
  };

  const handlePrintTest = () => {
    window.print();
  };

  const name = overrideData?.name ?? branch?.name ?? 'SISTEMA COLMENA RESTAURANTE';
  const nit = overrideData?.nit ?? branch?.nit ?? '901.458.920-4';
  const address = overrideData?.address ?? branch?.address ?? 'Cl. 4 # 13 - 28, Guadalajara de Buga';
  const phone = overrideData?.phone ?? branch?.phone ?? '+57 (602) 237-4589';
  const logoUrl = overrideData?.logoUrl !== undefined ? overrideData.logoUrl : branch?.logoUrl;
  const resolutionDian =
    overrideData?.resolutionDian ||
    branch?.receiptConfig?.resolutionDian ||
    'Resolución DIAN No. 18764000129 de 2026';
  const prefix = overrideData?.prefix || branch?.receiptConfig?.prefix || 'BUG-';
  const currentNumber = overrideData?.currentNumber || branch?.receiptConfig?.currentNumber || 101;
  const footerText =
    overrideData?.footerText ||
    branch?.receiptConfig?.footerText ||
    '¡Gracias por su visita a Colmena! Propina voluntaria según Ley 1935 de 2018.';

  const is58mm = selectedWidth === '58mm';

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="bg-[#181818] border border-[#B77900] rounded-3xl w-full max-w-4xl shadow-2xl text-[#FFFDF5] overflow-hidden flex flex-col max-h-[92vh] print:border-none print:shadow-none print:bg-white print:max-w-none print:max-h-none">
        
        {/* Cabecera del modal (oculta al imprimir) */}
        <div className="p-4 sm:p-5 border-b border-[#333333] flex items-center justify-between bg-[#1f1f1f] print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#B77900] to-[#D6A21A] flex items-center justify-center text-[#181818] font-black shadow-md">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-[#FFFDF5]">
                  Vista Previa del Comprobante POS
                </h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#B77900]/20 text-[#D6A21A] border border-[#B77900]/40">
                  Simulador Térmico
                </span>
              </div>
              <p className="text-xs text-[#a8a29e]">
                Previsualización reactiva de comprobantes térmicos para {name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintTest}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-bold text-xs flex items-center gap-1.5 hover:brightness-110 shadow cursor-pointer transition-all"
              title="Probar impresión térmica directa"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir Prueba</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#a8a29e] hover:text-[#FFFDF5] hover:bg-[#2b2b2b] transition-all cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido dividido: Controles a la izquierda y Tirilla a la derecha (en móvil apilado) */}
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-y-auto print:block print:p-0">
          
          {/* Panel de Controles Reactivos (Oculto al imprimir) */}
          <div className="md:col-span-5 space-y-4 print:hidden">
            <div className="bg-[#222222] border border-[#333333] rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#333333]">
                <span className="text-xs uppercase font-black text-[#D6A21A] flex items-center gap-1.5">
                  <Sliders className="w-4 h-4" />
                  <span>Ajustes Rápidos de Encabezado</span>
                </span>
                <span className="text-[10px] text-[#a8a29e]">En tiempo real</span>
              </div>

              {/* Selector de Ancho de Papel */}
              <div>
                <label className="block text-xs font-semibold text-[#a8a29e] mb-2">
                  Ancho de Papel Térmico:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleWidthChange('58mm')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      selectedWidth === '58mm'
                        ? 'bg-[#B77900] text-[#181818] border-[#D6A21A] shadow-md font-black'
                        : 'bg-[#181818] text-[#a8a29e] border-[#383838] hover:border-[#B77900]'
                    }`}
                  >
                    <span>58 mm (Estrecho)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleWidthChange('80mm')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      selectedWidth === '80mm'
                        ? 'bg-[#B77900] text-[#181818] border-[#D6A21A] shadow-md font-black'
                        : 'bg-[#181818] text-[#a8a29e] border-[#383838] hover:border-[#B77900]'
                    }`}
                  >
                    <span>80 mm (Estándar POS)</span>
                  </button>
                </div>
              </div>

              {/* Los 5 Controles Independientes */}
              <div className="space-y-2.5 pt-2">
                <span className="text-[11px] font-bold text-[#FFFDF5] block">
                  Elementos del Encabezado Comercial:
                </span>

                {/* 1. Logotipo */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#181818] border border-[#333333] hover:border-[#B77900]/50 cursor-pointer transition-all">
                  <div className="flex items-center gap-2.5">
                    <ImageIcon className="w-4 h-4 text-[#D6A21A]" />
                    <span className="text-xs font-semibold text-[#FFFDF5]">Mostrar logotipo</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={activeConfig.showLogo}
                    onChange={() => handleToggle('showLogo')}
                    className="w-4 h-4 accent-[#B77900] cursor-pointer"
                  />
                </label>

                {/* 2. Nombre comercial */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#181818] border border-[#333333] hover:border-[#B77900]/50 cursor-pointer transition-all">
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-[#D6A21A]" />
                    <span className="text-xs font-semibold text-[#FFFDF5]">Mostrar nombre comercial</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={activeConfig.showTradeName}
                    onChange={() => handleToggle('showTradeName')}
                    className="w-4 h-4 accent-[#B77900] cursor-pointer"
                  />
                </label>

                {/* 3. NIT */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#181818] border border-[#333333] hover:border-[#B77900]/50 cursor-pointer transition-all">
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-[#D6A21A]" />
                    <span className="text-xs font-semibold text-[#FFFDF5]">Mostrar NIT</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={activeConfig.showNit}
                    onChange={() => handleToggle('showNit')}
                    className="w-4 h-4 accent-[#B77900] cursor-pointer"
                  />
                </label>

                {/* 4. Dirección */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#181818] border border-[#333333] hover:border-[#B77900]/50 cursor-pointer transition-all">
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 text-[#D6A21A]" />
                    <span className="text-xs font-semibold text-[#FFFDF5]">Mostrar dirección</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={activeConfig.showAddress}
                    onChange={() => handleToggle('showAddress')}
                    className="w-4 h-4 accent-[#B77900] cursor-pointer"
                  />
                </label>

                {/* 5. Celular */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#181818] border border-[#333333] hover:border-[#B77900]/50 cursor-pointer transition-all">
                  <div className="flex items-center gap-2.5">
                    <Smartphone className="w-4 h-4 text-[#D6A21A]" />
                    <span className="text-xs font-semibold text-[#FFFDF5]">Mostrar celular / teléfono</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={activeConfig.showPhone}
                    onChange={() => handleToggle('showPhone')}
                    className="w-4 h-4 accent-[#B77900] cursor-pointer"
                  />
                </label>
              </div>

              <div className="p-3 rounded-xl bg-[#181818] border border-[#2e2e2e] text-[11px] text-[#a8a29e] space-y-1">
                <span className="text-[#D6A21A] font-bold block flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Regla de Independencia de Sucursal
                </span>
                <p>
                  Esta simulación no afecta ventas ni genera movimientos reales. Permite verificar
                  el diseño térmico antes de guardar la sucursal.
                </p>
              </div>
            </div>
          </div>

          {/* Panel de Simulación Térmica */}
          <div className="md:col-span-7 flex flex-col items-center justify-start print:block print:w-full">
            <div className="w-full flex justify-between items-center mb-2 px-2 print:hidden">
              <span className="text-xs font-bold text-[#a8a29e]">
                Representación Física del Papel ({selectedWidth})
              </span>
              <span className="text-[10px] text-[#D6A21A] font-mono">
                {is58mm ? 'Ancho: ~384 px / 58 mm' : 'Ancho: ~576 px / 80 mm'}
              </span>
            </div>

            {/* Simulación del Rollo Térmico POS */}
            <div
              id="printable-pos-ticket-preview"
              data-testid="pos-ticket-preview"
              className={`bg-[#fffdfa] text-[#1c1917] font-mono shadow-2xl rounded-sm p-4 sm:p-5 border-t-8 border-b-8 border-dashed border-[#e7e5e4] transition-all select-all print:shadow-none print:border-none print:m-0 print:p-0 ${
                is58mm ? 'w-full max-w-[270px] text-[10px]' : 'w-full max-w-[360px] text-[11px]'
              }`}
            >
              {/* Encabezado Dinámico Reutilizable */}
              <BranchReceiptHeader
                branch={branch}
                overrideData={{
                  name,
                  nit,
                  address,
                  phone,
                  logoUrl,
                  printConfig: activeConfig,
                  resolutionDian,
                }}
                paperWidth={selectedWidth}
                showDianResolution={false}
              />

              {/* Información del Documento de Simulación */}
              <div className="py-2.5 my-2 border-y border-dashed border-[#a8a29e] space-y-1 text-[10px] text-neutral-800">
                <div className="flex justify-between">
                  <span>Factura de Venta POS:</span>
                  <span className="font-bold">{prefix}{currentNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fecha:</span>
                  <span>{new Date().toLocaleDateString('es-CO')} {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cajero:</span>
                  <span>Cajero General / POS</span>
                </div>
                <div className="flex justify-between">
                  <span>Cliente:</span>
                  <span>Consumidor Final (222222222222)</span>
                </div>
              </div>

              {/* Items simulados */}
              <div className="py-2 border-b border-dashed border-[#a8a29e] space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-neutral-900 pb-1 border-b border-neutral-300">
                  <span>CANT / PRODUCTO</span>
                  <span>TOTAL</span>
                </div>
                <div className="flex justify-between">
                  <span className="truncate pr-2">1x Hamburguesa Colmena Especial</span>
                  <span className="font-semibold shrink-0">{formatCOP(32000)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="truncate pr-2">1x Papas Rústicas con Queso</span>
                  <span className="font-semibold shrink-0">{formatCOP(12000)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="truncate pr-2">2x Limonada de Hierbabuena</span>
                  <span className="font-semibold shrink-0">{formatCOP(16000)}</span>
                </div>
              </div>

              {/* Totales */}
              {(() => {
                const effectiveShowTax =
                  overrideData?.showTax !== undefined
                    ? overrideData.showTax
                    : (branch?.receiptConfig?.showTax !== false && (branch?.taxRate ?? 0.08) > 0);
                const subtotal = 60000;
                const tax = effectiveShowTax ? Math.round(subtotal * ((branch?.taxRate ?? 0.08) || 0.08)) : 0;
                const tip = 6000;
                const total = subtotal + tax + tip;
                const taxRatePercent = Math.round(((branch?.taxRate ?? 0.08) || 0.08) * 100);

                return (
                  <div className="py-2.5 border-b border-dashed border-[#a8a29e] space-y-1">
                    <div className="flex justify-between text-neutral-700">
                      <span>Subtotal:</span>
                      <span>{formatCOP(subtotal)}</span>
                    </div>
                    {effectiveShowTax && (
                      <div className="flex justify-between text-neutral-700">
                        <span>Impoconsumo ({taxRatePercent}%):</span>
                        <span>{formatCOP(tax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-emerald-800 font-semibold">
                      <span>Propina Voluntaria (10%):</span>
                      <span>{formatCOP(tip)}</span>
                    </div>
                    <div className="flex justify-between font-black text-sm pt-1.5 border-t border-neutral-400 text-neutral-900">
                      <span>TOTAL:</span>
                      <span>{formatCOP(total)}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Medios de Pago */}
              <div className="py-2 border-b border-dashed border-[#a8a29e] text-[10px] space-y-0.5 text-neutral-800">
                <div className="flex justify-between">
                  <span>Forma de Pago:</span>
                  <span className="font-bold">Efectivo</span>
                </div>
                <div className="flex justify-between">
                  <span>Efectivo Recibido:</span>
                  <span>{formatCOP(70000)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-800">
                  <span>Cambio / Vueltas:</span>
                  <span>{formatCOP(4000)}</span>
                </div>
              </div>

              {/* Pie de Página y Resolución DIAN */}
              <div className="pt-3 text-center space-y-1 text-[9px] text-neutral-600">
                <p className="font-semibold text-neutral-900">{footerText}</p>
                <p className="italic">{resolutionDian}</p>
                <p className="text-[8px] text-neutral-500 mt-1 uppercase tracking-widest">
                  *** COMPROBANTE DE PRUEBA POS ***
                </p>
              </div>

            </div>
          </div>

        </div>

        {/* Pie del modal */}
        <div className="p-4 border-t border-[#333333] flex items-center justify-between bg-[#1f1f1f] print:hidden">
          <span className="text-xs text-[#a8a29e]">
            Configuración activa: <strong className="text-[#D6A21A]">{selectedWidth}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#2b2b2b] hover:bg-[#383838] text-xs font-bold text-[#FFFDF5] cursor-pointer transition-all"
          >
            Cerrar Vista Previa
          </button>
        </div>

      </div>
    </div>
  );
};
