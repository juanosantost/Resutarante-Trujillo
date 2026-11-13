import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Branch,
  BranchPrintConfig,
  PaperWidth,
  LogoSize,
} from '../../types';
import { BranchReceiptHeader } from '../common/BranchReceiptHeader';
import { formatCOP } from '../../utils/calculations';
import {
  clampPosFontSize,
  resolveBranchPrintConfig,
  MIN_POS_FONT_SIZE,
  MAX_POS_FONT_SIZE,
} from '../../utils/printConfigUtils';
import {
  X,
  Printer,
  Sparkles,
  Eye,
  Sliders,
  Smartphone,
  MapPin,
  FileText,
  Image as ImageIcon,
  Building2,
  ChefHat,
  Receipt,
  Type,
  Minus,
  Plus,
  Save,
  AlertCircle,
} from 'lucide-react';

export type PreviewPosMode = 'cobro' | 'cocina';

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
  initialMode?: PreviewPosMode;
  onClose: () => void;
  onUpdatePrintConfig?: (config: BranchPrintConfig) => void;
  onSavePrintConfig?: (config: BranchPrintConfig) => Promise<void> | void;
}

interface FontSizeControlProps {
  label: string;
  description: string;
  value: number;
  presets: number[];
  onChange: (next: number) => void;
}

const FontSizeControl: React.FC<FontSizeControlProps> = ({
  label,
  description,
  value,
  presets,
  onChange,
}) => {
  return (
    <div className="p-3 rounded-xl bg-[#181818] border border-[#333333] space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-xs font-bold text-[#FFFDF5] flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-[#D6A21A]" />
            <span>{label}</span>
          </span>
          <p className="text-[10px] text-[#a8a29e] mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onChange(clampPosFontSize(value - 1, value))}
            className="w-7 h-7 rounded-lg bg-[#242424] hover:bg-[#323232] border border-[#3e3e3e] text-[#FFFDF5] flex items-center justify-center cursor-pointer"
            aria-label={`Disminuir ${label}`}
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center bg-[#242424] border border-[#3e3e3e] rounded-lg px-1.5 py-1">
            <input
              type="number"
              min={MIN_POS_FONT_SIZE}
              max={MAX_POS_FONT_SIZE}
              value={value}
              aria-label={label}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                if (!Number.isNaN(parsed)) {
                  onChange(clampPosFontSize(parsed, value));
                }
              }}
              className="w-10 bg-transparent text-center text-xs font-mono font-black text-[#D6A21A] outline-none"
            />
            <span className="text-[10px] font-bold text-[#a8a29e] pr-0.5">pts</span>
          </div>
          <button
            type="button"
            onClick={() => onChange(clampPosFontSize(value + 1, value))}
            className="w-7 h-7 rounded-lg bg-[#242424] hover:bg-[#323232] border border-[#3e3e3e] text-[#FFFDF5] flex items-center justify-center cursor-pointer"
            aria-label={`Aumentar ${label}`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <input
        type="range"
        min={MIN_POS_FONT_SIZE}
        max={MAX_POS_FONT_SIZE}
        value={value}
        aria-label={`Deslizador ${label}`}
        onChange={(e) => onChange(clampPosFontSize(Number(e.target.value), value))}
        className="w-full accent-[#D6A21A] cursor-pointer"
      />

      <div className="flex flex-wrap gap-1.5">
        {presets.map((pt) => (
          <button
            key={pt}
            type="button"
            onClick={() => onChange(pt)}
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition-all cursor-pointer ${
              value === pt
                ? 'bg-[#B77900] text-[#181818] border-[#D6A21A] font-black'
                : 'bg-[#222222] text-[#a8a29e] border-[#383838] hover:border-[#B77900]'
            }`}
          >
            {pt} pts
          </button>
        ))}
      </div>
    </div>
  );
};

export const BranchReceiptPreviewModal: React.FC<BranchReceiptPreviewModalProps> = ({
  branch,
  overrideData,
  initialMode = 'cobro',
  onClose,
  onUpdatePrintConfig,
  onSavePrintConfig,
}) => {
  useEffect(() => {
    document.body.classList.add('printing-pos-ticket');
    return () => {
      if (document.querySelectorAll('.colmena-ticket-print-portal').length <= 1) {
        document.body.classList.remove('printing-pos-ticket');
      }
    };
  }, []);

  const initialPrintConfig = resolveBranchPrintConfig(
    branch?.printConfig,
    overrideData?.printConfig
  );

  const [previewMode, setPreviewMode] = useState<PreviewPosMode>(initialMode);
  const [activeConfig, setActiveConfig] = useState<BranchPrintConfig>(initialPrintConfig);
  const [selectedWidth, setSelectedWidth] = useState<PaperWidth>(
    initialPrintConfig.paperWidth || '80mm'
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const applyConfigUpdate = (updated: BranchPrintConfig) => {
    setActiveConfig(updated);
    if (onUpdatePrintConfig) {
      onUpdatePrintConfig(updated);
    }
  };

  const handleToggle = (
    key:
      | 'showLogo'
      | 'showTradeName'
      | 'showNit'
      | 'showAddress'
      | 'showPhone'
      | 'includeKitchenPrices'
      | 'kitchenShowHeader'
  ) => {
    applyConfigUpdate({
      ...activeConfig,
      [key]: !activeConfig[key],
    });
  };

  const handleWidthChange = (w: PaperWidth) => {
    setSelectedWidth(w);
    applyConfigUpdate({
      ...activeConfig,
      paperWidth: w,
    });
  };

  const handleLogoSizeChange = (s: LogoSize) => {
    applyConfigUpdate({
      ...activeConfig,
      logoSize: s,
    });
  };

  const handleFontSizeChange = (
    key:
      | 'receiptTitleFontSize'
      | 'receiptBodyFontSize'
      | 'kitchenTitleFontSize'
      | 'kitchenBodyFontSize',
    pts: number
  ) => {
    const safePts = clampPosFontSize(pts, 22);
    applyConfigUpdate({
      ...activeConfig,
      [key]: safePts,
    });
  };

  const handleMatchKitchenFontSizes = () => {
    const targetPts = clampPosFontSize(activeConfig.kitchenTitleFontSize, 22);
    applyConfigUpdate({
      ...activeConfig,
      kitchenTitleFontSize: targetPts,
      kitchenBodyFontSize: targetPts,
    });
  };

  const handlePrintTest = () => {
    window.print();
  };

  const handleSave = async () => {
    if (!onSavePrintConfig) return;
    setIsSaving(true);
    try {
      await onSavePrintConfig(activeConfig);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const name = overrideData?.name ?? branch?.name ?? 'SISTEMA COLMENA RESTAURANTE';
  const nit = overrideData?.nit ?? branch?.nit ?? '901.458.920-4';
  const address = overrideData?.address ?? branch?.address ?? 'Restrepo (Valle), Colombia';
  const phone = overrideData?.phone ?? branch?.phone ?? '+57 (602) 237-4589';
  const logoUrl = overrideData?.logoUrl !== undefined ? overrideData.logoUrl : branch?.logoUrl;
  const resolutionDian =
    overrideData?.resolutionDian ||
    branch?.receiptConfig?.resolutionDian ||
    'Resolución DIAN No. 18764000129 de 2026';
  const prefix = overrideData?.prefix || branch?.receiptConfig?.prefix || 'RES-';
  const currentNumber = overrideData?.currentNumber || branch?.receiptConfig?.currentNumber || 101;
  const footerText =
    overrideData?.footerText ||
    branch?.receiptConfig?.footerText ||
    '¡Gracias por su visita a Colmena! Propina voluntaria según Ley 1935 de 2018.';

  const is58mm = selectedWidth === '58mm';

  const receiptTitlePts = clampPosFontSize(activeConfig.receiptTitleFontSize, 16);
  const receiptBodyPts = clampPosFontSize(activeConfig.receiptBodyFontSize, 12);
  const kitchenTitlePts = clampPosFontSize(activeConfig.kitchenTitleFontSize, 22);
  const kitchenBodyPts = clampPosFontSize(activeConfig.kitchenBodyFontSize, 22);
  const kitchenShowHeader = activeConfig.kitchenShowHeader ?? true;
  const includeKitchenPrices = activeConfig.includeKitchenPrices ?? false;

  return createPortal(
    <div className="colmena-ticket-print-portal fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto print:static print:p-0 print:bg-white print:overflow-visible">
      <div className="bg-[#181818] border border-[#B77900] rounded-3xl w-full max-w-5xl shadow-2xl text-[#FFFDF5] overflow-hidden flex flex-col max-h-[92vh] print:static print:border-none print:shadow-none print:bg-white print:max-w-none print:max-h-none print:w-full print:overflow-visible">
        
        {/* Cabecera del modal (oculta al imprimir) */}
        <div className="p-4 sm:p-5 border-b border-[#333333] flex flex-wrap items-center justify-between gap-3 bg-[#1f1f1f] print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#B77900] to-[#D6A21A] flex items-center justify-center text-[#181818] font-black shadow-md">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-[#FFFDF5]">
                  Configuración y Vista Previa POS
                </h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#B77900]/20 text-[#D6A21A] border border-[#B77900]/40">
                  Simulador Térmico
                </span>
              </div>
              <p className="text-xs text-[#a8a29e]">
                Ajusta en puntos el tamaño de títulos y textos normales para {name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Selector de Modelo POS */}
            <div className="flex items-center bg-[#141414] p-1 rounded-xl border border-[#333333]">
              <button
                type="button"
                onClick={() => setPreviewMode('cobro')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  previewMode === 'cobro'
                    ? 'bg-[#B77900] text-[#181818] font-black shadow'
                    : 'text-[#a8a29e] hover:text-[#FFFDF5]'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>POS de Cobro</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('cocina')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  previewMode === 'cocina'
                    ? 'bg-[#B77900] text-[#181818] font-black shadow'
                    : 'text-[#a8a29e] hover:text-[#FFFDF5]'
                }`}
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>POS de Cocina</span>
              </button>
            </div>

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

        {/* Contenido dividido: Controles a la izquierda y Tirilla a la derecha */}
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-y-auto print:block print:p-0">
          
          {/* Panel de Controles Reactivos (Oculto al imprimir) */}
          <div className="md:col-span-5 space-y-4 print:hidden">
            <div className="bg-[#222222] border border-[#333333] rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#333333]">
                <span className="text-xs uppercase font-black text-[#D6A21A] flex items-center gap-1.5">
                  <Sliders className="w-4 h-4" />
                  <span>
                    {previewMode === 'cobro'
                      ? 'Ajustes: POS de Cobro'
                      : 'Ajustes: POS de Cocina'}
                  </span>
                </span>
                <span className="text-[10px] text-[#a8a29e]">Vista previa en vivo</span>
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

              {/* Controles específicos de Cocina (prominente para ahorro de papel) */}
              {previewMode === 'cocina' && (
                <div className="space-y-2">
                  <label className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[#181818] border border-[#B77900]/40 hover:border-[#D6A21A] cursor-pointer transition-all">
                    <div className="flex items-start gap-2.5">
                      <Building2 className="w-4 h-4 text-[#D6A21A] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold text-[#FFFDF5] block">
                          Incluir información del local en cocina
                        </span>
                        <span className="text-[10px] text-[#a8a29e] block mt-0.5 leading-snug">
                          Logo, nombre, NIT, dirección y teléfono. Desactívalo para ahorrar papel térmico.
                        </span>
                        <span
                          className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            kitchenShowHeader
                              ? 'bg-[#292212] text-[#D6A21A] border-[#B77900]/40'
                              : 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                          }`}
                        >
                          {kitchenShowHeader
                            ? 'Imprime datos del local'
                            : 'Ahorro de papel activo (sin datos del local)'}
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      aria-label="Incluir información del local en cocina"
                      checked={kitchenShowHeader}
                      onChange={() => handleToggle('kitchenShowHeader')}
                      className="w-4 h-4 accent-[#B77900] cursor-pointer mt-0.5 shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#181818] border border-[#333333] hover:border-[#B77900]/50 cursor-pointer transition-all">
                    <div className="flex items-center gap-2.5">
                      <Receipt className="w-4 h-4 text-[#D6A21A]" />
                      <span className="text-xs font-semibold text-[#FFFDF5]">
                        Incluir precios en ticket de cocina
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={includeKitchenPrices}
                      onChange={() => handleToggle('includeKitchenPrices')}
                      className="w-4 h-4 accent-[#B77900] cursor-pointer"
                    />
                  </label>
                </div>
              )}

              {/* Controles de Tamaño de Letra en Puntos según pestaña activa */}
              {previewMode === 'cobro' ? (
                <div className="space-y-3">
                  <FontSizeControl
                    label="Tamaño de Títulos (POS Cobro)"
                    description="Nombre del negocio, número de factura y Total a pagar"
                    value={receiptTitlePts}
                    presets={[14, 16, 18, 20, 22]}
                    onChange={(pts) => handleFontSizeChange('receiptTitleFontSize', pts)}
                  />
                  <FontSizeControl
                    label="Tamaño Textos Normales (POS Cobro)"
                    description="Productos, precios, fecha, datos del cliente y pie"
                    value={receiptBodyPts}
                    presets={[10, 12, 13, 14, 16]}
                    onChange={(pts) => handleFontSizeChange('receiptBodyFontSize', pts)}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <FontSizeControl
                    label="Tamaño de Títulos (POS Cocina)"
                    description="Mesa, número de orden, rondas y nombres de platos"
                    value={kitchenTitlePts}
                    presets={[16, 18, 20, 22, 24, 26]}
                    onChange={(pts) => handleFontSizeChange('kitchenTitleFontSize', pts)}
                  />
                  <FontSizeControl
                    label="Tamaño Textos Normales (POS Cocina)"
                    description="Acompañamientos, notas de cocina, mesero, hora y pie"
                    value={kitchenBodyPts}
                    presets={[16, 18, 20, 22, 24, 26]}
                    onChange={(pts) => handleFontSizeChange('kitchenBodyFontSize', pts)}
                  />
                  <button
                    type="button"
                    onClick={handleMatchKitchenFontSizes}
                    className="w-full py-2 px-3 rounded-xl bg-[#181818] hover:bg-[#2a2a2a] border border-[#B77900]/50 text-[#D6A21A] text-xs font-bold cursor-pointer transition-all"
                  >
                    Igualar textos normales a {kitchenTitlePts} pts
                  </button>
                </div>
              )}

              {/* Controles del Encabezado Comercial */}
              {(previewMode === 'cobro' || kitchenShowHeader) && (
                <div className="space-y-2 pt-2 border-t border-[#333333]">
                  <span className="text-[11px] font-bold text-[#FFFDF5] block">
                    Elementos del Encabezado Comercial:
                  </span>

                {/* 1. Logotipo */}
                <div className="space-y-1.5">
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

                  {activeConfig.showLogo && (
                    <div className="p-2 rounded-xl bg-[#151515] border border-[#2e2e2e] space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-[#a8a29e] px-0.5">
                        <span className="font-bold text-[#D6A21A]">Tamaño del Logotipo:</span>
                        <span className="capitalize text-[#FFFDF5] font-semibold">
                          {activeConfig.logoSize || 'mediano'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { id: 'pequeno', label: 'Pequeño' },
                          { id: 'mediano', label: 'Mediano' },
                          { id: 'grande', label: 'Grande' },
                        ].map((sz) => (
                          <button
                            key={sz.id}
                            type="button"
                            onClick={() => handleLogoSizeChange(sz.id as LogoSize)}
                            className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                              (activeConfig.logoSize || 'mediano') === sz.id
                                ? 'bg-[#B77900] text-[#181818] border-[#D6A21A] font-black shadow-sm'
                                : 'bg-[#202020] text-[#a8a29e] border-[#383838] hover:border-[#B77900]'
                            }`}
                          >
                            {sz.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

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
              )}

              <div className="p-3 rounded-xl bg-[#181818] border border-[#2e2e2e] text-[11px] text-[#a8a29e] space-y-1">
                <span className="text-[#D6A21A] font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Modelo de Ejemplo Reactivo</span>
                </span>
                <p>
                  Cada cambio en puntos se refleja de inmediato en el ticket de muestra sin afectar pedidos reales.
                </p>
              </div>
            </div>
          </div>

          {/* Panel de Simulación Térmica */}
          <div className="md:col-span-7 flex flex-col items-center justify-start print:block print:w-full">
            <div className="w-full flex flex-wrap justify-between items-center gap-2 mb-2 px-2 print:hidden">
              <span className="text-xs font-bold text-[#a8a29e]">
                {previewMode === 'cobro'
                  ? `Modelo POS de Cobro (${selectedWidth})`
                  : `Modelo POS de Cocina (${selectedWidth})`}
              </span>
              <span className="text-[10px] text-[#D6A21A] font-mono font-bold">
                {previewMode === 'cobro'
                  ? `Títulos: ${receiptTitlePts} pts · Textos: ${receiptBodyPts} pts`
                  : `Títulos: ${kitchenTitlePts} pts · Textos: ${kitchenBodyPts} pts · ${
                      kitchenShowHeader ? 'Con info local' : 'Sin info local (ahorro papel)'
                    }`}
              </span>
            </div>

            {previewMode === 'cobro' ? (
              /* MODELO DE EJEMPLO: POS DE COBRO (FACTURA) */
              <div
                id="printable-pos-ticket-preview"
                data-testid="pos-ticket-preview"
                data-paper-width={selectedWidth}
                style={{ fontSize: `${receiptBodyPts}px`, lineHeight: 1.3 }}
                className={`colmena-printable-ticket bg-white text-black font-mono shadow-2xl rounded-sm p-4 sm:p-5 border-t-8 border-b-8 border-dashed border-[#e7e5e4] transition-all select-all print:shadow-none print:border-none print:m-0 print:p-0 ${
                  is58mm ? 'w-full max-w-[270px]' : 'w-full max-w-[360px]'
                }`}
              >
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
                  titleFontSize={receiptTitlePts}
                  bodyFontSize={receiptBodyPts}
                />

                <div
                  className="py-2.5 my-2 border-y border-dotted border-gray-300 print:border-gray-300 space-y-1 text-black"
                  style={{ fontSize: `${receiptBodyPts}px`, lineHeight: 1.3 }}
                >
                  <div className="flex flex-wrap justify-between gap-x-2">
                    <span className="font-bold">Factura de Venta POS:</span>
                    <span className="font-black" style={{ fontSize: `${receiptTitlePts}px` }}>
                      {prefix}{currentNumber}
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-2">
                    <span className="font-bold">Fecha:</span>
                    <span className="font-bold">
                      {new Date().toLocaleDateString('es-CO')}{' '}
                      {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-2">
                    <span className="font-bold">Cajero:</span>
                    <span className="font-bold">Cajero General / POS</span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-2">
                    <span className="font-bold">Cliente:</span>
                    <span className="font-bold">Consumidor Final (222222222222)</span>
                  </div>
                </div>

                <div
                  className="py-2 border-b border-dotted border-gray-300 print:border-gray-300 space-y-1.5 text-black"
                  style={{ fontSize: `${receiptBodyPts}px`, lineHeight: 1.3 }}
                >
                  <div className="flex justify-between font-black text-black pb-1 border-b border-dotted border-gray-300 print:border-gray-300">
                    <span>CANT / PRODUCTO</span>
                    <span>TOTAL</span>
                  </div>
                  <div className="flex justify-between gap-2 font-bold">
                    <span>1x Hamburguesa Colmena Especial</span>
                    <span className="font-black shrink-0">{formatCOP(32000)}</span>
                  </div>
                  <div className="flex justify-between gap-2 font-bold">
                    <span>1x Papas Rústicas con Queso</span>
                    <span className="font-black shrink-0">{formatCOP(12000)}</span>
                  </div>
                  <div className="flex justify-between gap-2 font-bold">
                    <span>2x Limonada de Hierbabuena</span>
                    <span className="font-black shrink-0">{formatCOP(16000)}</span>
                  </div>
                </div>

                {(() => {
                  const effectiveShowTax =
                    overrideData?.showTax !== undefined
                      ? overrideData.showTax
                      : branch?.receiptConfig?.showTax !== false && (branch?.taxRate ?? 0.08) > 0;
                  const subtotal = 60000;
                  const tax = effectiveShowTax
                    ? Math.round(subtotal * ((branch?.taxRate ?? 0.08) || 0.08))
                    : 0;
                  const tip = 6000;
                  const total = subtotal + tax + tip;
                  const taxRatePercent = Math.round(((branch?.taxRate ?? 0.08) || 0.08) * 100);

                  return (
                    <div
                      className="py-2.5 border-b border-dotted border-gray-300 print:border-gray-300 space-y-1 text-black"
                      style={{ fontSize: `${receiptBodyPts}px`, lineHeight: 1.3 }}
                    >
                      <div className="flex justify-between font-bold">
                        <span>Subtotal:</span>
                        <span className="font-bold">{formatCOP(subtotal)}</span>
                      </div>
                      {effectiveShowTax && (
                        <div className="flex justify-between font-bold">
                          <span>Impoconsumo ({taxRatePercent}%):</span>
                          <span className="font-bold">{formatCOP(tax)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold">
                        <span>Propina Voluntaria (10%):</span>
                        <span className="font-black">{formatCOP(tip)}</span>
                      </div>
                      <div
                        className="flex justify-between font-black pt-1.5 border-t border-dotted border-gray-300 print:border-gray-300 text-black"
                        style={{ fontSize: `${receiptTitlePts}px`, lineHeight: 1.25 }}
                      >
                        <span>TOTAL:</span>
                        <span>{formatCOP(total)}</span>
                      </div>
                    </div>
                  );
                })()}

                <div
                  className="py-2 border-b border-dotted border-gray-300 print:border-gray-300 space-y-0.5 text-black"
                  style={{ fontSize: `${receiptBodyPts}px`, lineHeight: 1.3 }}
                >
                  <div className="flex justify-between">
                    <span className="font-semibold">Forma de Pago:</span>
                    <span className="font-black">Efectivo</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Efectivo Recibido:</span>
                    <span className="font-bold">{formatCOP(70000)}</span>
                  </div>
                  <div className="flex justify-between font-black">
                    <span>Cambio / Vueltas:</span>
                    <span>{formatCOP(4000)}</span>
                  </div>
                </div>

                <div
                  className="pt-3 text-center space-y-1 text-black"
                  style={{ fontSize: `${Math.max(9, receiptBodyPts - 1)}px`, lineHeight: 1.25 }}
                >
                  <p className="font-bold text-black">{footerText}</p>
                  <p className="font-semibold text-black">{resolutionDian}</p>
                  <p className="font-bold text-black mt-1 uppercase tracking-widest">
                    *** COMPROBANTE DE PRUEBA POS ***
                  </p>
                </div>
              </div>
            ) : (
              /* MODELO DE EJEMPLO: POS DE COCINA (COMANDA) */
              <div
                id="printable-pos-ticket-preview"
                data-testid="kitchen-ticket-preview"
                data-paper-width={selectedWidth}
                style={{ fontSize: `${kitchenBodyPts}px`, lineHeight: 1.25 }}
                className={`colmena-printable-ticket bg-white text-black font-mono shadow-2xl rounded-sm p-4 sm:p-5 border-t-8 border-b-8 border-dashed border-[#e7e5e4] transition-all select-all print:shadow-none print:border-none print:m-0 print:p-0 ${
                  is58mm ? 'w-full max-w-[270px]' : 'w-full max-w-[360px]'
                }`}
              >
                {kitchenShowHeader && (
                  <div className="pb-2 border-b border-dotted border-gray-300 print:border-gray-300">
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
                      titleFontSize={kitchenTitlePts}
                      bodyFontSize={kitchenBodyPts}
                    />
                  </div>
                )}

                <div
                  className="my-1.5 py-1 font-black tracking-wide text-center uppercase text-black"
                  style={{ fontSize: `${kitchenTitlePts}px`, lineHeight: 1.2 }}
                >
                  *** COMANDA DE COCINA ***
                </div>

                <div className="my-2 py-1 text-center space-y-0.5">
                  <div
                    className="font-bold uppercase text-black tracking-wider"
                    style={{ fontSize: `${kitchenBodyPts}px`, lineHeight: 1.25 }}
                  >
                    DESTINO / ENTREGA
                  </div>
                  <div
                    className="text-black uppercase font-black break-words"
                    style={{ fontSize: `${kitchenTitlePts}px`, lineHeight: 1.2 }}
                  >
                    Mesa 4 (Terraza)
                  </div>
                </div>

                <div
                  className="py-1.5 border-b border-dotted border-gray-300 print:border-gray-300 text-black space-y-1"
                  style={{ fontSize: `${kitchenBodyPts}px`, lineHeight: 1.25 }}
                >
                  <div className="flex flex-wrap justify-between items-baseline gap-x-2">
                    <span className="font-bold">ORDEN:</span>
                    <span className="font-black" style={{ fontSize: `${kitchenTitlePts}px` }}>
                      #120
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-between items-baseline gap-x-2">
                    <span className="font-bold">HORA:</span>
                    <span className="font-bold">13 nov 2026, 12:30 p. m.</span>
                  </div>
                  <div className="flex flex-wrap justify-between items-baseline gap-x-2">
                    <span className="font-bold">MESERO:</span>
                    <span className="font-bold">Carlos Mendoza</span>
                  </div>
                </div>

                <div className="py-2 space-y-2.5">
                  <div
                    className="text-center font-black uppercase tracking-wider border-b border-dotted border-gray-300 print:border-gray-300 pb-1"
                    style={{ fontSize: `${kitchenTitlePts}px`, lineHeight: 1.2 }}
                  >
                    -- PLATOS A PREPARAR --
                  </div>

                  {/* Plato 1 con modificadores y nota */}
                  <div className="pb-2 border-b border-dotted border-gray-300 print:border-gray-300 space-y-1">
                    <div
                      className="flex items-start gap-2"
                      style={{ fontSize: `${kitchenTitlePts}px`, lineHeight: 1.2 }}
                    >
                      <span className="font-black text-black shrink-0">1X</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-black uppercase font-black break-words">
                          MENÚ DEL DÍA
                        </div>
                        {includeKitchenPrices && (
                          <div
                            className="font-mono text-black font-bold"
                            style={{ fontSize: `${kitchenBodyPts}px` }}
                          >
                            {formatCOP(16000)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      className="pl-3 space-y-0.5 text-black"
                      style={{ fontSize: `${kitchenBodyPts}px`, lineHeight: 1.25 }}
                    >
                      <div className="flex items-start gap-1.5 font-bold">
                        <span className="font-black shrink-0">›</span>
                        <span>Sopa de Pastas Casera</span>
                      </div>
                      <div className="flex items-start gap-1.5 font-bold">
                        <span className="font-black shrink-0">›</span>
                        <span>Pechuga a la Plancha</span>
                      </div>
                      <div className="flex items-start gap-1.5 font-bold">
                        <span className="font-black shrink-0">›</span>
                        <span>Limonada Natural</span>
                      </div>
                    </div>

                    <div className="pl-2 pt-0.5">
                      <div
                        className="p-1.5 border border-dotted border-gray-300 text-black"
                        style={{ fontSize: `${kitchenBodyPts}px`, lineHeight: 1.25 }}
                      >
                        <span
                          className="block font-black uppercase text-black flex items-center gap-1"
                          style={{ fontSize: `${kitchenTitlePts}px`, lineHeight: 1.2 }}
                        >
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>¡OJO COCINA!:</span>
                        </span>
                        <span className="block text-black uppercase font-bold">
                          SIN CEBOLLA EN LA ENSALADA
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Plato 2 */}
                  <div className="pb-2 space-y-1">
                    <div
                      className="flex items-start gap-2"
                      style={{ fontSize: `${kitchenTitlePts}px`, lineHeight: 1.2 }}
                    >
                      <span className="font-black text-black shrink-0">2X</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-black uppercase font-black break-words">
                          JUGO EN LECHE DE MORA
                        </div>
                        {includeKitchenPrices && (
                          <div
                            className="font-mono text-black font-bold"
                            style={{ fontSize: `${kitchenBodyPts}px` }}
                          >
                            {formatCOP(14000)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="pt-2 border-t border-dotted border-gray-300 print:border-gray-300 space-y-1.5 text-black"
                  style={{ fontSize: `${kitchenBodyPts}px`, lineHeight: 1.25 }}
                >
                  <div className="flex flex-wrap justify-between items-baseline gap-2 font-bold">
                    <span>TOTAL PLATOS / ITEMS:</span>
                    <span className="font-black" style={{ fontSize: `${kitchenTitlePts}px` }}>
                      3
                    </span>
                  </div>
                  <div
                    className="text-center pt-1 font-black uppercase"
                    style={{ fontSize: `${kitchenTitlePts}px`, lineHeight: 1.2 }}
                  >
                    *** VERIFICAR ANTES DE DESPACHAR ***
                  </div>
                  <div className="text-center font-mono font-bold pt-0.5">
                    Colmena POS · Ejemplo Cocina
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pie del modal */}
        <div className="p-4 border-t border-[#333333] flex flex-wrap items-center justify-between gap-3 bg-[#1f1f1f] print:hidden">
          <span className="text-xs text-[#a8a29e]">
            Configuración activa:{' '}
            <strong className="text-[#D6A21A]">
              {selectedWidth} · Cobro ({receiptTitlePts}/{receiptBodyPts} pts) · Cocina ({kitchenTitlePts}/{kitchenBodyPts} pts ·{' '}
              {kitchenShowHeader ? 'Con local' : 'Sin local'})
            </strong>
          </span>
          <div className="flex items-center gap-2">
            {onSavePrintConfig && (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] text-xs font-black flex items-center gap-1.5 hover:brightness-110 shadow cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Guardando...' : 'Guardar Configuración POS'}</span>
              </button>
            )}
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
    </div>,
    document.body
  );
};
