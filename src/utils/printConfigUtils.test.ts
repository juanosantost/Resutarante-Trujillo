import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampPosFontSize,
  resolveBranchPrintConfig,
  buildReceiptHeaderPrintConfig,
  buildKitchenHeaderPrintConfig,
  MIN_POS_FONT_SIZE,
  MAX_POS_FONT_SIZE,
} from './printConfigUtils';

test('clampPosFontSize enforces bounds and handles invalid values', () => {
  assert.equal(clampPosFontSize(22, 16), 22);
  assert.equal(clampPosFontSize(4, 16), MIN_POS_FONT_SIZE);
  assert.equal(clampPosFontSize(50, 16), MAX_POS_FONT_SIZE);
  assert.equal(clampPosFontSize(undefined, 22), 22);
  assert.equal(clampPosFontSize(NaN, 12), 12);
  assert.equal(clampPosFontSize(18.6, 12), 19);
});

test('resolveBranchPrintConfig defaults kitchen titles and normal texts to 22 points', () => {
  const resolved = resolveBranchPrintConfig(undefined, undefined);
  assert.equal(resolved.receiptTitleFontSize, 16);
  assert.equal(resolved.receiptBodyFontSize, 12);
  assert.equal(resolved.kitchenTitleFontSize, 22);
  assert.equal(resolved.kitchenBodyFontSize, 22);
  assert.equal(resolved.kitchenShowHeader, true);
  assert.equal(resolved.kitchenPaperWidth, '80mm');
});

test('live branchConfig takes precedence over stale snapshotConfig', () => {
  const liveBranch = {
    showLogo: true,
    showTradeName: true,
    showNit: true,
    showAddress: true,
    showPhone: true,
    paperWidth: '80mm' as const,
    receiptTitleFontSize: 18,
    receiptBodyFontSize: 13,
    kitchenTitleFontSize: 24,
    kitchenBodyFontSize: 22,
    kitchenShowHeader: false,
  };
  const staleSnapshot = {
    showLogo: false,
    showTradeName: false,
    showNit: false,
    showAddress: false,
    showPhone: false,
    paperWidth: '58mm' as const,
    receiptTitleFontSize: 14,
    receiptBodyFontSize: 10,
  };

  const resolved = resolveBranchPrintConfig(liveBranch, staleSnapshot);
  assert.equal(resolved.showLogo, true);
  assert.equal(resolved.showTradeName, true);
  assert.equal(resolved.paperWidth, '80mm');
  assert.equal(resolved.receiptTitleFontSize, 18);
  assert.equal(resolved.kitchenShowHeader, false);
});

test('hiding logo and local info in POS Cocina does NOT affect POS Cobro header config', () => {
  const cfg = resolveBranchPrintConfig({
    paperWidth: '80mm',
    showLogo: true,
    logoSize: 'grande',
    showTradeName: true,
    showNit: true,
    showAddress: true,
    showPhone: true,
    kitchenPaperWidth: '58mm',
    kitchenShowHeader: false,
    kitchenShowLogo: false,
    kitchenLogoSize: 'pequeno',
    kitchenShowTradeName: false,
    kitchenShowNit: false,
    kitchenShowAddress: false,
    kitchenShowPhone: false,
  });

  const cobroHeader = buildReceiptHeaderPrintConfig(cfg);
  const cocinaHeader = buildKitchenHeaderPrintConfig(cfg);

  assert.equal(cobroHeader.showLogo, true);
  assert.equal(cobroHeader.logoSize, 'grande');
  assert.equal(cobroHeader.showTradeName, true);
  assert.equal(cobroHeader.showNit, true);
  assert.equal(cobroHeader.showAddress, true);
  assert.equal(cobroHeader.showPhone, true);
  assert.equal(cobroHeader.paperWidth, '80mm');

  assert.equal(cocinaHeader.showLogo, false);
  assert.equal(cocinaHeader.logoSize, 'pequeno');
  assert.equal(cocinaHeader.showTradeName, false);
  assert.equal(cocinaHeader.showNit, false);
  assert.equal(cocinaHeader.showAddress, false);
  assert.equal(cocinaHeader.showPhone, false);
  assert.equal(cocinaHeader.paperWidth, '58mm');
});

test('logoPrintMode defaults to escala_grises and stays independent between POS Cobro and POS Cocina', () => {
  const defaults = resolveBranchPrintConfig(undefined, undefined);
  assert.equal(defaults.logoPrintMode, 'escala_grises');
  assert.equal(defaults.kitchenLogoPrintMode, 'escala_grises');

  const custom = resolveBranchPrintConfig({
    logoPrintMode: 'termico_bn',
    kitchenLogoPrintMode: 'alto_contraste',
  });
  assert.equal(buildReceiptHeaderPrintConfig(custom).logoPrintMode, 'termico_bn');
  assert.equal(buildKitchenHeaderPrintConfig(custom).logoPrintMode, 'alto_contraste');
});
