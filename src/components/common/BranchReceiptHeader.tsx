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

  // 2. Extraer datos comerciales
  const name =
    overrideData?.name !== undefined
      ? overrideData.name
      : snapshot?.name !== undefined
      ? snapshot.name
      : branch?.name || '';

  const nit =
    overrideData?.nit !== undefined
      ? overrideData.nit
      : snapshot?.nit !== undefined
      ? snapshot.nit
      : branch?.nit || '';

  const address =
    overrideData?.address !== undefined
      ? overrideData.address
      : snapshot?.address !== undefined
      ? snapshot.address
      : branch?.address || '';

  const phone =
    overrideData?.phone !== undefined
      ? overrideData.phone
      : snapshot?.phone !== undefined
      ? snapshot.phone
      : branch?.phone || '';

  const logoUrl =
    overrideData?.logoUrl !== undefined
      ? overrideData.logoUrl
      : snapshot?.logoUrl !== undefined
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

  return (
    <header
      data-testid="branch-receipt-header"
      className={`branch-receipt-header text-center flex flex-col items-center justify-center font-mono ${
        is58mm ? 'text-[10px] space-y-0.5' : 'text-xs space-y-1'
      } ${className}`}
    >
      {/* 1. Logotipo de la Sucursal */}
      {printConfig.showLogo && logoUrl && (
        <div className="flex justify-center items-center w-full my-1 receipt-logo-container">
          <img
            src={logoUrl}
            alt={name || 'Logotipo Sucursal'}
            className={`object-contain max-w-full ${
              is58mm ? 'max-h-12 max-w-[120px]' : 'max-h-16 max-w-[170px]'
            } filter contrast-125`}
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
          className={`font-black tracking-tight text-neutral-900 uppercase leading-snug break-words max-w-full ${
            is58mm ? 'text-xs' : 'text-sm'
          }`}
        >
          {name.trim()}
        </div>
      )}

      {/* 3. NIT */}
      {printConfig.showNit && nit.trim() && (
        <div className="font-semibold text-neutral-800 break-words max-w-full">
          NIT: {nit.trim()}
        </div>
      )}

      {/* 4. Dirección */}
      {printConfig.showAddress && address.trim() && (
        <div className="text-neutral-700 leading-tight break-words max-w-full">
          {address.trim()}
        </div>
      )}

      {/* 5. Celular / Teléfono */}
      {printConfig.showPhone && phone.trim() && (
        <div className="text-neutral-700 leading-tight break-words max-w-full">
          Tel: {phone.trim()}
        </div>
      )}

      {/* Resolución DIAN Opcional en el encabezado */}
      {showDianResolution && resolutionDian && (
        <div className="text-[9px] text-neutral-600 italic pt-0.5 border-t border-neutral-300 mt-1 max-w-full break-words">
          {resolutionDian}
        </div>
      )}
    </header>
  );
};
