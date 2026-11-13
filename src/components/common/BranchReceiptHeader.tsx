import React from 'react';
import { Branch, BranchReceiptSnapshot, BranchPrintConfig, DEFAULT_BRANCH_PRINT_CONFIG, PaperWidth } from '../../types';

export interface BranchReceiptHeaderProps {
  branch?: Branch | null;
  snapshot?: BranchReceiptSnapshot | null;
  overrideData?: {
    name?: string;
    nit?: string;
    address?: string;
    phone?: string;
    logoUrl?: string;
    printConfig?: BranchPrintConfig;
    resolutionDian?: string;
  };
  paperWidth?: PaperWidth;
  className?: string;
  showDianResolution?: boolean;
}

/**
 * BranchReceiptHeader
 * Componente modular y reutilizable para el encabezado de comprobantes térmicos y tirillas POS.
 * Construye dinámicamente el encabezado respetando estrictamente los 5 controles configurados
 * por sucursal o los valores congelados en el snapshot histórico del documento:
 * 1. Mostrar logotipo
 * 2. Mostrar nombre comercial
 * 3. Mostrar NIT
 * 4. Mostrar dirección
 * 5. Mostrar celular / teléfono
 *
 * Sin textos fijos, sin espacios vacíos ni etiquetas fantasma.
 */
export const BranchReceiptHeader: React.FC<BranchReceiptHeaderProps> = ({
  branch,
  snapshot,
  overrideData,
  paperWidth,
  className = '',
  showDianResolution = false,
}) => {
  // 1. Extraer configuración de impresión con prioridad: override -> snapshot -> branch -> default
  const printConfig: BranchPrintConfig =
    overrideData?.printConfig ||
    snapshot?.printConfig ||
    branch?.printConfig ||
    DEFAULT_BRANCH_PRINT_CONFIG;

  // 2. Extraer datos comerciales (si el snapshot tiene campo vacío, respaldar con la sucursal actual)
  const name =
    overrideData?.name !== undefined
      ? overrideData.name
      : snapshot?.name?.trim()
      ? snapshot.name
      : branch?.name || '';

  const nit =
    overrideData?.nit !== undefined
      ? overrideData.nit
      : snapshot?.nit?.trim()
      ? snapshot.nit
      : branch?.nit || '';

  const address =
    overrideData?.address !== undefined
      ? overrideData.address
      : snapshot?.address?.trim()
      ? snapshot.address
      : branch?.address || '';

  const phone =
    overrideData?.phone !== undefined
      ? overrideData.phone
      : snapshot?.phone?.trim()
      ? snapshot.phone
      : branch?.phone || '';

  const logoUrl =
    overrideData?.logoUrl !== undefined
      ? overrideData.logoUrl
      : snapshot?.logoUrl
      ? snapshot.logoUrl
      : branch?.logoUrl;

  const resolutionDian =
    overrideData?.resolutionDian ||
    snapshot?.resolutionDian ||
    branch?.receiptConfig?.resolutionDian;

  const activePaperWidth: PaperWidth =
    paperWidth || printConfig.paperWidth || '80mm';

  const is58mm = activePaperWidth === '58mm';

  // Si ninguno de los 5 elementos está activo y no hay resolución DIAN, no renderizar nada
  const hasAnyContent =
    (printConfig.showLogo && !!logoUrl) ||
    (printConfig.showTradeName && !!name.trim()) ||
    (printConfig.showNit && !!nit.trim()) ||
    (printConfig.showAddress && !!address.trim()) ||
    (printConfig.showPhone && !!phone.trim()) ||
    (showDianResolution && !!resolutionDian);

  if (!hasAnyContent) {
    return null;
  }

  const logoSize = printConfig.logoSize || 'mediano';
  const logoDimensions = {
    pequeno: is58mm ? 'max-h-12 max-w-[120px]' : 'max-h-16 max-w-[160px]',
    mediano: is58mm ? 'max-h-20 max-w-[190px]' : 'max-h-28 max-w-[250px]',
    grande: is58mm ? 'max-h-32 max-w-[240px]' : 'max-h-44 max-w-[340px]',
  }[logoSize];

  return (
    <header
      data-testid="branch-receipt-header"
      className={`branch-receipt-header text-center flex flex-col items-center justify-center font-mono text-black print:flex print:flex-col print:items-center print:visible print:opacity-100 ${
        is58mm ? 'text-[11px] space-y-0.5' : 'text-xs space-y-1'
      } ${className}`}
    >
      {/* 1. Logotipo de la Sucursal */}
      {printConfig.showLogo && logoUrl && (
        <div className="flex justify-center items-center w-full my-1 receipt-logo-container print:flex">
          <img
            src={logoUrl}
            alt={name || 'Logotipo Sucursal'}
            className={`object-contain max-w-full ${logoDimensions} filter contrast-150 transition-all print:transition-none print:block`}
            style={{ imageRendering: 'crisp-edges' }}
            onError={(e) => {
              // Ocultar suavemente si falla carga de imagen
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      )}

      {/* 2. Nombre Comercial */}
      {printConfig.showTradeName && name.trim() && (
        <div
          className={`font-black tracking-tight text-black uppercase leading-tight break-words max-w-full ${
            is58mm ? 'text-sm' : 'text-base sm:text-lg'
          }`}
        >
          {name.trim()}
        </div>
      )}

      {/* 3. NIT */}
      {printConfig.showNit && nit.trim() && (
        <div className="font-black text-black break-words max-w-full">
          NIT: {nit.trim()}
        </div>
      )}

      {/* 4. Dirección */}
      {printConfig.showAddress && address.trim() && (
        <div className="font-bold text-black leading-tight break-words max-w-full">
          {address.trim()}
        </div>
      )}

      {/* 5. Celular / Teléfono */}
      {printConfig.showPhone && phone.trim() && (
        <div className="font-bold text-black leading-tight break-words max-w-full">
          Tel: {phone.trim()}
        </div>
      )}

      {/* Resolución DIAN Opcional en el encabezado */}
      {showDianResolution && resolutionDian && (
        <div className="text-[10px] font-bold text-black pt-0.5 border-t border-dotted border-gray-300 print:border-gray-300 mt-1 max-w-full break-words">
          {resolutionDian}
        </div>
      )}
    </header>
  );
};
