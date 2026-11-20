import { BranchPrintConfig, DEFAULT_BRANCH_PRINT_CONFIG } from '../types';

export const MIN_POS_FONT_SIZE = 9;
export const MAX_POS_FONT_SIZE = 32;

export function clampPosFontSize(
  value: unknown,
  fallback: number,
  min: number = MIN_POS_FONT_SIZE,
  max: number = MAX_POS_FONT_SIZE
): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(num)));
}

export interface ResolvedBranchPrintConfig extends Required<BranchPrintConfig> {}

/**
 * Resuelve la configuración POS dando prioridad a la configuración vigente de la sucursal
 * (`branchConfig`) sobre snapshots antiguos (`snapshotConfig`), manteniendo totalmente
 * separados los ajustes de POS de Cobro y POS de Cocina.
 */
export function resolveBranchPrintConfig(
  branchConfig?: Partial<BranchPrintConfig> | null,
  snapshotConfig?: Partial<BranchPrintConfig> | null
): ResolvedBranchPrintConfig {
  const merged = {
    ...DEFAULT_BRANCH_PRINT_CONFIG,
    ...(snapshotConfig || {}),
    ...(branchConfig || {}),
  };

  const cobroPaperWidth =
    branchConfig?.paperWidth ??
    snapshotConfig?.paperWidth ??
    DEFAULT_BRANCH_PRINT_CONFIG.paperWidth;

  const kitchenPaperWidth =
    branchConfig?.kitchenPaperWidth ??
    snapshotConfig?.kitchenPaperWidth ??
    cobroPaperWidth ??
    '80mm';

  return {
    // POS de Cobro (independiente)
    showLogo:
      branchConfig?.showLogo ??
      snapshotConfig?.showLogo ??
      DEFAULT_BRANCH_PRINT_CONFIG.showLogo,
    logoSize:
      branchConfig?.logoSize ??
      snapshotConfig?.logoSize ??
      DEFAULT_BRANCH_PRINT_CONFIG.logoSize ??
      'mediano',
    showTradeName:
      branchConfig?.showTradeName ??
      snapshotConfig?.showTradeName ??
      DEFAULT_BRANCH_PRINT_CONFIG.showTradeName,
    showNit:
      branchConfig?.showNit ??
      snapshotConfig?.showNit ??
      DEFAULT_BRANCH_PRINT_CONFIG.showNit,
    showAddress:
      branchConfig?.showAddress ??
      snapshotConfig?.showAddress ??
      DEFAULT_BRANCH_PRINT_CONFIG.showAddress,
    showPhone:
      branchConfig?.showPhone ??
      snapshotConfig?.showPhone ??
      DEFAULT_BRANCH_PRINT_CONFIG.showPhone,
    paperWidth: cobroPaperWidth,
    receiptTitleFontSize: clampPosFontSize(
      branchConfig?.receiptTitleFontSize ?? snapshotConfig?.receiptTitleFontSize,
      DEFAULT_BRANCH_PRINT_CONFIG.receiptTitleFontSize ?? 16
    ),
    receiptBodyFontSize: clampPosFontSize(
      branchConfig?.receiptBodyFontSize ?? snapshotConfig?.receiptBodyFontSize,
      DEFAULT_BRANCH_PRINT_CONFIG.receiptBodyFontSize ?? 12
    ),

    // POS de Cocina (totalmente independiente del POS de Cobro)
    kitchenPaperWidth,
    kitchenFontSize: merged.kitchenFontSize || 'extragrande',
    includeKitchenPrices:
      branchConfig?.includeKitchenPrices ??
      snapshotConfig?.includeKitchenPrices ??
      DEFAULT_BRANCH_PRINT_CONFIG.includeKitchenPrices ??
      false,
    kitchenTitleFontSize: clampPosFontSize(
      branchConfig?.kitchenTitleFontSize ?? snapshotConfig?.kitchenTitleFontSize,
      DEFAULT_BRANCH_PRINT_CONFIG.kitchenTitleFontSize ?? 22
    ),
    kitchenBodyFontSize: clampPosFontSize(
      branchConfig?.kitchenBodyFontSize ?? snapshotConfig?.kitchenBodyFontSize,
      DEFAULT_BRANCH_PRINT_CONFIG.kitchenBodyFontSize ?? 22
    ),
    kitchenShowHeader:
      branchConfig?.kitchenShowHeader ??
      snapshotConfig?.kitchenShowHeader ??
      DEFAULT_BRANCH_PRINT_CONFIG.kitchenShowHeader ??
      true,
    kitchenShowLogo:
      branchConfig?.kitchenShowLogo ??
      snapshotConfig?.kitchenShowLogo ??
      DEFAULT_BRANCH_PRINT_CONFIG.kitchenShowLogo ??
      true,
    kitchenLogoSize:
      branchConfig?.kitchenLogoSize ??
      snapshotConfig?.kitchenLogoSize ??
      DEFAULT_BRANCH_PRINT_CONFIG.kitchenLogoSize ??
      'mediano',
    kitchenShowTradeName:
      branchConfig?.kitchenShowTradeName ??
      snapshotConfig?.kitchenShowTradeName ??
      DEFAULT_BRANCH_PRINT_CONFIG.kitchenShowTradeName ??
      true,
    kitchenShowNit:
      branchConfig?.kitchenShowNit ??
      snapshotConfig?.kitchenShowNit ??
      DEFAULT_BRANCH_PRINT_CONFIG.kitchenShowNit ??
      true,
    kitchenShowAddress:
      branchConfig?.kitchenShowAddress ??
      snapshotConfig?.kitchenShowAddress ??
      DEFAULT_BRANCH_PRINT_CONFIG.kitchenShowAddress ??
      true,
    kitchenShowPhone:
      branchConfig?.kitchenShowPhone ??
      snapshotConfig?.kitchenShowPhone ??
      DEFAULT_BRANCH_PRINT_CONFIG.kitchenShowPhone ??
      true,
  };
}

/**
 * Construye una configuración de encabezado exclusiva para la Factura de Cobro POS.
 * Nunca se ve afectada por los controles de POS de Cocina (`kitchenShowHeader`, `kitchenShowLogo`, etc.).
 */
export function buildReceiptHeaderPrintConfig(
  config?: Partial<BranchPrintConfig> | null
): BranchPrintConfig {
  const resolved = resolveBranchPrintConfig(config);
  return {
    showLogo: resolved.showLogo,
    logoSize: resolved.logoSize,
    showTradeName: resolved.showTradeName,
    showNit: resolved.showNit,
    showAddress: resolved.showAddress,
    showPhone: resolved.showPhone,
    paperWidth: resolved.paperWidth,
    receiptTitleFontSize: resolved.receiptTitleFontSize,
    receiptBodyFontSize: resolved.receiptBodyFontSize,
  };
}

/**
 * Construye una configuración de encabezado exclusiva para el Ticket POS de Cocina.
 * Lee únicamente los controles `kitchen*` sin afectar ni depender de la Factura de Cobro.
 */
export function buildKitchenHeaderPrintConfig(
  config?: Partial<BranchPrintConfig> | null
): BranchPrintConfig {
  const resolved = resolveBranchPrintConfig(config);
  const enabled = resolved.kitchenShowHeader;
  return {
    showLogo: enabled && resolved.kitchenShowLogo,
    logoSize: resolved.kitchenLogoSize,
    showTradeName: enabled && resolved.kitchenShowTradeName,
    showNit: enabled && resolved.kitchenShowNit,
    showAddress: enabled && resolved.kitchenShowAddress,
    showPhone: enabled && resolved.kitchenShowPhone,
    paperWidth: resolved.kitchenPaperWidth,
    kitchenTitleFontSize: resolved.kitchenTitleFontSize,
    kitchenBodyFontSize: resolved.kitchenBodyFontSize,
    kitchenShowHeader: resolved.kitchenShowHeader,
  };
}
