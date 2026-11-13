import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampPosFontSize,
  resolveBranchPrintConfig,
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
  assert.equal(resolved.kitchenTitleFontSize, 22);
  assert.equal(resolved.kitchenBodyFontSize, 22);
  assert.equal(resolved.receiptTitleFontSize, 16);
  assert.equal(resolved.receiptBodyFontSize, 12);
  assert.equal(resolved.kitchenShowHeader, true);
});

test('resolveBranchPrintConfig upgrades legacy branch config without numeric sizes to 22pt kitchen default while respecting explicit sizes', () => {
  const legacyBranchConfig = {
    showLogo: true,
    showTradeName: true,
    showNit: true,
    showAddress: true,
    showPhone: true,
    paperWidth: '80mm' as const,
    kitchenFontSize: 'grande' as const,
  };

  const resolvedLegacy = resolveBranchPrintConfig(legacyBranchConfig);
  assert.equal(resolvedLegacy.kitchenTitleFontSize, 22);
  assert.equal(resolvedLegacy.kitchenBodyFontSize, 22);

  const customBranchConfig = {
    ...legacyBranchConfig,
    receiptTitleFontSize: 18,
    receiptBodyFontSize: 14,
    kitchenTitleFontSize: 24,
    kitchenBodyFontSize: 20,
    kitchenShowHeader: false,
  };

  const resolvedCustom = resolveBranchPrintConfig(customBranchConfig);
  assert.equal(resolvedCustom.receiptTitleFontSize, 18);
  assert.equal(resolvedCustom.receiptBodyFontSize, 14);
  assert.equal(resolvedCustom.kitchenTitleFontSize, 24);
  assert.equal(resolvedCustom.kitchenBodyFontSize, 20);
  assert.equal(resolvedCustom.kitchenShowHeader, false);
});
