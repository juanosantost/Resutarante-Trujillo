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

export function resolveBranchPrintConfig(
  branchConfig?: Partial<BranchPrintConfig> | null,
  snapshotConfig?: Partial<BranchPrintConfig> | null
): ResolvedBranchPrintConfig {
  const merged = {
    ...DEFAULT_BRANCH_PRINT_CONFIG,
    ...(branchConfig || {}),
    ...(snapshotConfig || {}),
  };

  return {
    showLogo: merged.showLogo ?? true,
    logoSize: merged.logoSize || 'mediano',
    showTradeName: merged.showTradeName ?? true,
    showNit: merged.showNit ?? true,
    showAddress: merged.showAddress ?? true,
    showPhone: merged.showPhone ?? true,
    paperWidth: merged.paperWidth || '80mm',
    kitchenFontSize: merged.kitchenFontSize || 'extragrande',
    includeKitchenPrices: merged.includeKitchenPrices ?? false,
    receiptTitleFontSize: clampPosFontSize(
      snapshotConfig?.receiptTitleFontSize ?? branchConfig?.receiptTitleFontSize,
      DEFAULT_BRANCH_PRINT_CONFIG.receiptTitleFontSize ?? 16
    ),
    receiptBodyFontSize: clampPosFontSize(
      snapshotConfig?.receiptBodyFontSize ?? branchConfig?.receiptBodyFontSize,
      DEFAULT_BRANCH_PRINT_CONFIG.receiptBodyFontSize ?? 12
    ),
    kitchenTitleFontSize: clampPosFontSize(
      snapshotConfig?.kitchenTitleFontSize ?? branchConfig?.kitchenTitleFontSize,
      DEFAULT_BRANCH_PRINT_CONFIG.kitchenTitleFontSize ?? 22
    ),
    kitchenBodyFontSize: clampPosFontSize(
      snapshotConfig?.kitchenBodyFontSize ?? branchConfig?.kitchenBodyFontSize,
      DEFAULT_BRANCH_PRINT_CONFIG.kitchenBodyFontSize ?? 22
    ),
    kitchenShowHeader:
      snapshotConfig?.kitchenShowHeader ??
      branchConfig?.kitchenShowHeader ??
      DEFAULT_BRANCH_PRINT_CONFIG.kitchenShowHeader ??
      true,
  };
}
