import test from 'node:test';
import assert from 'node:assert/strict';
import { ModifierGroup, Product } from '../types';
import {
  resolveEditableDailyMenuGroups,
  updateDailyMenuCategory,
  toggleDailyMenuCategoryVisibility,
  deleteDailyMenuCategory,
  addDailyMenuCategory,
  getVisibleDailyMenuGroups,
  validateDailyMenuCategoriesBeforeSave,
} from './dailyMenuCategoryUtils';
import { buildDefaultDailyMenuItem } from './productUtils';
import { buildDailyMenuAuditSummary } from './dataPreservationUtils';

const SAMPLE_FALLBACK_GROUPS: ModifierGroup[] = [
  {
    id: 'grp-almuerzo-sopa',
    name: 'Sopa',
    description: 'Sopas o cremas del día',
    selectionType: 'single',
    minSelections: 0,
    maxSelections: 1,
    isRequired: false,
    isActive: true,
    order: 1,
    noSelectionDiscount: 2000,
    options: [
      { id: 'opt-sopa-1', name: 'Sopa de Guineo', priceSurcharge: 0, isActive: true, isDefault: true },
    ],
  },
  {
    id: 'grp-almuerzo-principio',
    name: 'Principio',
    description: 'Granos o principios',
    selectionType: 'single',
    minSelections: 0,
    maxSelections: 1,
    isRequired: false,
    isActive: true,
    order: 2,
    noSelectionDiscount: 1000,
    options: [
      { id: 'opt-princ-1', name: 'Frijoles', priceSurcharge: 0, isActive: true, isDefault: true },
    ],
  },
  {
    id: 'grp-almuerzo-carne',
    name: 'Carne',
    description: 'Proteínas principales',
    selectionType: 'single',
    minSelections: 0,
    maxSelections: 1,
    isRequired: false,
    isActive: true,
    order: 3,
    noSelectionDiscount: 6000,
    options: [
      { id: 'opt-carne-1', name: 'Filete de Pollo', priceSurcharge: 0, isActive: true, isDefault: true },
      { id: 'opt-carne-2', name: 'Chicharrón', priceSurcharge: 2000, isActive: true, isDefault: false },
    ],
  },
];

test('resolveEditableDailyMenuGroups preserves deleted, renamed, hidden, and custom categories without resurrecting defaults', () => {
  const savedByUser: ModifierGroup[] = [
    {
      ...SAMPLE_FALLBACK_GROUPS[0],
      name: 'Sopas y Cremas',
      isActive: false,
      order: 2,
    },
    {
      id: 'grp-almuerzo-custom-postre',
      name: 'Postre del Día',
      description: 'Postre opcional',
      selectionType: 'single',
      minSelections: 0,
      maxSelections: 1,
      isRequired: false,
      isActive: true,
      order: 1,
      noSelectionDiscount: 500,
      options: [{ id: 'opt-postre-1', name: 'Arroz con Leche', priceSurcharge: 0, isActive: true, isDefault: true }],
    },
  ];

  const resolved = resolveEditableDailyMenuGroups(savedByUser, SAMPLE_FALLBACK_GROUPS);

  assert.equal(resolved.length, 2, 'Deleted categories (Principio, Carne) must NOT be resurrected');
  assert.equal(resolved[0].id, 'grp-almuerzo-custom-postre');
  assert.equal(resolved[0].order, 1);
  assert.equal(resolved[1].id, 'grp-almuerzo-sopa');
  assert.equal(resolved[1].name, 'Sopas y Cremas');
  assert.equal(resolved[1].isActive, false);
  assert.equal(resolved[1].order, 2);
});

test('resolveEditableDailyMenuGroups preserves empty array and only uses fallback when undefined', () => {
  const emptyResolved = resolveEditableDailyMenuGroups([], SAMPLE_FALLBACK_GROUPS);
  assert.equal(emptyResolved.length, 0);

  const fallbackResolved = resolveEditableDailyMenuGroups(undefined, SAMPLE_FALLBACK_GROUPS);
  assert.equal(fallbackResolved.length, 3);
  assert.equal(fallbackResolved[0].name, 'Sopa');
});

test('updateDailyMenuCategory edits name, description, discount, and visibility without mutating others', () => {
  const updated = updateDailyMenuCategory(SAMPLE_FALLBACK_GROUPS, 'grp-almuerzo-carne', {
    name: 'Proteína',
    description: 'Carnes y pescados del día',
    noSelectionDiscount: -500,
  });

  const carne = updated.find((g) => g.id === 'grp-almuerzo-carne')!;
  assert.equal(carne.name, 'Proteína');
  assert.equal(carne.description, 'Carnes y pescados del día');
  assert.equal(carne.noSelectionDiscount, 0);
  assert.equal(updated[0].name, 'Sopa');
});

test('toggleDailyMenuCategoryVisibility toggles visible -> hidden -> visible cleanly', () => {
  const hiddenOnce = toggleDailyMenuCategoryVisibility(SAMPLE_FALLBACK_GROUPS, 'grp-almuerzo-sopa');
  assert.equal(hiddenOnce[0].isActive, false);
  assert.equal(hiddenOnce[1].isActive, true);

  const shownAgain = toggleDailyMenuCategoryVisibility(hiddenOnce, 'grp-almuerzo-sopa');
  assert.equal(shownAgain[0].isActive, true);
});

test('deleteDailyMenuCategory removes category, re-indexes order, and chooses valid nextActiveTabId', () => {
  // Deleting active first item -> selects next item (Principio)
  const res1 = deleteDailyMenuCategory(
    SAMPLE_FALLBACK_GROUPS,
    'grp-almuerzo-sopa',
    'grp-almuerzo-sopa'
  );
  assert.equal(res1.nextGroups.length, 2);
  assert.equal(res1.nextGroups[0].id, 'grp-almuerzo-principio');
  assert.equal(res1.nextGroups[0].order, 1);
  assert.equal(res1.nextGroups[1].order, 2);
  assert.equal(res1.nextActiveTabId, 'grp-almuerzo-principio');
  assert.equal(res1.deletedCategory?.name, 'Sopa');

  // Deleting active last item -> selects previous item (Principio)
  const res2 = deleteDailyMenuCategory(
    res1.nextGroups,
    'grp-almuerzo-carne',
    'grp-almuerzo-carne'
  );
  assert.equal(res2.nextGroups.length, 1);
  assert.equal(res2.nextActiveTabId, 'grp-almuerzo-principio');

  // Deleting the only remaining item -> empty activeTabId
  const res3 = deleteDailyMenuCategory(
    res2.nextGroups,
    'grp-almuerzo-principio',
    'grp-almuerzo-principio'
  );
  assert.equal(res3.nextGroups.length, 0);
  assert.equal(res3.nextActiveTabId, '');
});

test('addDailyMenuCategory validates blank and duplicate names and creates a clean custom category', () => {
  const blankRes = addDailyMenuCategory(SAMPLE_FALLBACK_GROUPS, { name: '   ' });
  assert.equal(blankRes.ok, false);

  const dupRes = addDailyMenuCategory(SAMPLE_FALLBACK_GROUPS, { name: '  sopa ' });
  assert.equal(dupRes.ok, false);

  const okRes = addDailyMenuCategory(SAMPLE_FALLBACK_GROUPS, {
    name: 'Postre',
    description: 'Dulces de la casa',
    noSelectionDiscount: 1500,
  });
  assert.equal(okRes.ok, true);
  if (okRes.ok) {
    assert.equal(okRes.nextGroups.length, 4);
    assert.equal(okRes.createdCategory.name, 'Postre');
    assert.equal(okRes.createdCategory.description, 'Dulces de la casa');
    assert.equal(okRes.createdCategory.noSelectionDiscount, 1500);
    assert.equal(okRes.createdCategory.isActive, true);
    assert.equal(okRes.createdCategory.order, 4);
    assert.deepEqual(okRes.createdCategory.options, []);
  }
});

test('getVisibleDailyMenuGroups excludes hidden categories while preserving order', () => {
  const withHidden = toggleDailyMenuCategoryVisibility(SAMPLE_FALLBACK_GROUPS, 'grp-almuerzo-principio');
  const visible = getVisibleDailyMenuGroups(withHidden);
  assert.deepEqual(
    visible.map((g) => g.id),
    ['grp-almuerzo-sopa', 'grp-almuerzo-carne']
  );
});

test('validateDailyMenuCategoriesBeforeSave catches empty or duplicate names and trims valid ones', () => {
  const emptyNameGroups = updateDailyMenuCategory(SAMPLE_FALLBACK_GROUPS, 'grp-almuerzo-sopa', {
    name: '   ',
  });
  const emptyValidation = validateDailyMenuCategoriesBeforeSave(emptyNameGroups);
  assert.equal(emptyValidation.valid, false);
  if (!emptyValidation.valid) {
    assert.equal(emptyValidation.invalidCategoryId, 'grp-almuerzo-sopa');
  }

  const dupNameGroups = updateDailyMenuCategory(SAMPLE_FALLBACK_GROUPS, 'grp-almuerzo-principio', {
    name: 'SOPA',
  });
  const dupValidation = validateDailyMenuCategoriesBeforeSave(dupNameGroups);
  assert.equal(dupValidation.valid, false);

  const validGroups = updateDailyMenuCategory(SAMPLE_FALLBACK_GROUPS, 'grp-almuerzo-sopa', {
    name: '  Sopas del Día  ',
    description: '  Recién hechas  ',
  });
  const okValidation = validateDailyMenuCategoriesBeforeSave(validGroups);
  assert.equal(okValidation.valid, true);
  if (okValidation.valid) {
    assert.equal(okValidation.sanitizedGroups[0].name, 'Sopas del Día');
    assert.equal(okValidation.sanitizedGroups[0].description, 'Recién hechas');
  }
});

test('buildDefaultDailyMenuItem skips hidden categories (isActive === false) and their surcharges', () => {
  const hiddenSopaAndCarne: ModifierGroup[] = [
    { ...SAMPLE_FALLBACK_GROUPS[0], isActive: false },
    { ...SAMPLE_FALLBACK_GROUPS[1], isActive: true },
    {
      ...SAMPLE_FALLBACK_GROUPS[2],
      isActive: false,
      options: [
        { id: 'opt-carne-premium', name: 'Churrasco', priceSurcharge: 5000, isActive: true, isDefault: true },
      ],
    },
  ];

  const product: Product = {
    id: 'prod-almuerzo-del-dia',
    name: 'Menú del Día',
    categoryId: 'cat-menu-del-dia',
    categoryName: 'Menú del Día',
    description: 'Almuerzo',
    price: 16000,
    isDailyMenu: true,
    status: 'activo',
    isVisibleInMenu: true,
    isAvailableForSale: true,
    featureGroups: hiddenSopaAndCarne,
  } as Product;

  const item = buildDefaultDailyMenuItem(product);
  assert.deepEqual(
    (item.selectedModifiers || []).map((m) => m.groupId),
    ['grp-almuerzo-principio']
  );
  assert.equal(item.unitPrice, 16000);
});

test('buildDailyMenuAuditSummary tags hidden categories with [OCULTA]', () => {
  const groups = toggleDailyMenuCategoryVisibility(SAMPLE_FALLBACK_GROUPS, 'grp-almuerzo-sopa');
  const summary = buildDailyMenuAuditSummary({
    name: 'Menú del Día',
    price: 16000,
    isVisible: true,
    featureGroups: groups,
  });

  assert.match(summary, /Sopa \[OCULTA\]: Sopa de Guineo/);
  assert.match(summary, /Principio: Frijoles/);
});
