import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCustomizedProductPrice,
  validateModifierGroupSelection,
  validateAllModifierGroups,
  calculateComboSavings,
  filterProducts,
  sortCategories,
  formatProductPrice,
} from './productUtils';
import {
  Product,
  ProductVariant,
  ModifierGroup,
  ModifierOption,
  Category,
} from '../types';

test('calculateCustomizedProductPrice calculates correct totals with variant, modifiers and quantity', () => {
  const basePrice = 36000;
  const variant: ProductVariant = {
    id: 'var-doble',
    name: 'Doble Angus (400g)',
    priceAdjustment: 10000,
    isActive: true,
  };
  const modifiers: ModifierOption[] = [
    { id: 'mod-tocineta', name: 'Tocineta Caramelizada', priceSurcharge: 5000, isActive: true },
    { id: 'mod-queso', name: 'Queso Cheddar Fundido', priceSurcharge: 4500, isActive: true },
    { id: 'mod-sin-cebolla', name: 'Sin cebolla', priceSurcharge: 0, isActive: true },
  ];
  const swapSurcharges = [2500]; // Cambió papas por aros de cebolla
  const quantity = 2;

  const result = calculateCustomizedProductPrice(
    basePrice,
    variant,
    modifiers,
    swapSurcharges,
    quantity
  );

  // 36.000 + 10.000 + (5.000 + 4.500 + 0) + 2.500 = 58.000 COP unit price
  assert.equal(result.basePrice, 36000);
  assert.equal(result.variantAdjustment, 10000);
  assert.equal(result.modifiersSurcharge, 9500);
  assert.equal(result.swapsSurcharge, 2500);
  assert.equal(result.unitPrice, 58000);
  assert.equal(result.quantity, 2);
  assert.equal(result.totalPrice, 116000);
});

test('calculateCustomizedProductPrice handles base item with no variants or modifiers', () => {
  const result = calculateCustomizedProductPrice(22000, null, [], [], 1);
  assert.equal(result.unitPrice, 22000);
  assert.equal(result.totalPrice, 22000);
  assert.equal(result.variantAdjustment, 0);
  assert.equal(result.modifiersSurcharge, 0);
});

test('validateModifierGroupSelection enforces single selection rules', () => {
  const terminoCarneGroup: ModifierGroup = {
    id: 'grp-termino',
    name: 'Término de la Carne',
    selectionType: 'single',
    minSelections: 1,
    maxSelections: 1,
    isRequired: true,
    options: [
      { id: 'opt-medio', name: 'Término Medio', priceSurcharge: 0, isActive: true },
      { id: 'opt-34', name: 'Tres Cuartos', priceSurcharge: 0, isActive: true },
      { id: 'opt-bien', name: 'Bien Asado', priceSurcharge: 0, isActive: true },
    ],
    isActive: true,
  };

  // 0 selected when required
  const resEmpty = validateModifierGroupSelection(terminoCarneGroup, []);
  assert.equal(resEmpty.isValid, false);
  assert.match(resEmpty.errorMessage || '', /Debes seleccionar al menos una opción/);

  // 1 selected (valid)
  const resValid = validateModifierGroupSelection(terminoCarneGroup, ['opt-medio']);
  assert.equal(resValid.isValid, true);

  // 2 selected when max is 1
  const resTooMany = validateModifierGroupSelection(terminoCarneGroup, ['opt-medio', 'opt-34']);
  assert.equal(resTooMany.isValid, false);
  assert.match(resTooMany.errorMessage || '', /solo puedes seleccionar una única opción/);
});

test('validateModifierGroupSelection enforces multiple selection min/max constraints', () => {
  const salsasGroup: ModifierGroup = {
    id: 'grp-salsas',
    name: 'Salsas de la Casa',
    selectionType: 'multiple',
    minSelections: 1,
    maxSelections: 2,
    isRequired: true,
    options: [],
    isActive: true,
  };

  // Below min
  const resUnderMin = validateModifierGroupSelection(salsasGroup, []);
  assert.equal(resUnderMin.isValid, false);

  // Exactly min
  const resMin = validateModifierGroupSelection(salsasGroup, ['salsa-bbq']);
  assert.equal(resMin.isValid, true);

  // Max allowed
  const resMax = validateModifierGroupSelection(salsasGroup, ['salsa-bbq', 'salsa-honey']);
  assert.equal(resMax.isValid, true);

  // Exceeds max
  const resOver = validateModifierGroupSelection(salsasGroup, ['salsa-1', 'salsa-2', 'salsa-3']);
  assert.equal(resOver.isValid, false);
  assert.match(resOver.errorMessage || '', /el máximo permitido es de 2/);
});

test('validateAllModifierGroups checks multiple groups and aggregates errors', () => {
  const groups: ModifierGroup[] = [
    {
      id: 'grp-1',
      name: 'Término de la Carne',
      selectionType: 'single',
      minSelections: 1,
      maxSelections: 1,
      isRequired: true,
      options: [],
      isActive: true,
    },
    {
      id: 'grp-2',
      name: 'Acompañamiento',
      selectionType: 'single',
      minSelections: 1,
      maxSelections: 1,
      isRequired: true,
      options: [],
      isActive: true,
    },
    {
      id: 'grp-3',
      name: 'Adiciones Extras',
      selectionType: 'multiple',
      minSelections: 0,
      maxSelections: 5,
      isRequired: false,
      options: [],
      isActive: true,
    },
  ];

  // Missing grp-1 and grp-2
  const checkFail = validateAllModifierGroups(groups, {});
  assert.equal(checkFail.isValid, false);
  assert.equal(checkFail.errors.length, 2);

  // Fulfills grp-1 and grp-2
  const checkSuccess = validateAllModifierGroups(groups, {
    'grp-1': ['opt-medio'],
    'grp-2': ['opt-papas-criollas'],
  });
  assert.equal(checkSuccess.isValid, true);
  assert.equal(checkSuccess.errors.length, 0);
});

test('calculateComboSavings computes accurate savings amount and percentage', () => {
  const commercialPrice = 46000;
  const components = [
    { name: 'Hamburguesa Colmena Signature', price: 36000 },
    { name: 'Papas Rústicas', price: 14000 },
    { name: 'Cerveza Mestiza Dorada', price: 14000 },
  ];

  const savings = calculateComboSavings(commercialPrice, components);
  // Total separate items = 64.000 COP
  // Commercial price = 46.000 COP
  // Savings = 18.000 COP
  // Percentage = 18.000 / 64.000 = ~28%
  assert.equal(savings.commercialPrice, 46000);
  assert.equal(savings.individualItemsSum, 64000);
  assert.equal(savings.savingsCOP, 18000);
  assert.equal(savings.savingsPercentage, 28);
});

test('filterProducts filters correctly by search term, category, branch and availability', () => {
  const mockProducts: Product[] = [
    {
      id: 'prod-1',
      name: 'Hamburguesa Colmena Signature',
      description: '200g carne Angus madurada en pan brioche',
      categoryId: 'cat-hamburguesas',
      price: 36000,
      sku: 'HBG-001',
      images: ['https://example.com/hbg1.jpg'],
      branchId: 'sede-chapinero',
      prepStationId: 'st-parrilla',
      prepTimeMinutes: 18,
      isAvailableForSale: true,
      isAvailableForDelivery: true,
      isVisibleInMenu: true,
      status: 'activo',
      variants: [],
      modifierGroupIds: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'prod-2',
      name: 'Costillas San Luis BBQ en Miel',
      description: 'Costillas tiernas glaseadas con miel pura',
      categoryId: 'cat-costillas',
      price: 44000,
      sku: 'CST-002',
      images: ['https://example.com/cst1.jpg'],
      branchId: 'sede-parque93',
      prepStationId: 'st-parrilla',
      prepTimeMinutes: 25,
      isAvailableForSale: true,
      isAvailableForDelivery: false,
      isVisibleInMenu: true,
      status: 'activo',
      variants: [],
      modifierGroupIds: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'prod-3',
      name: 'Limonada de Coco Frappé',
      description: 'Leche de coco natural',
      categoryId: 'cat-bebidas',
      price: 15000,
      sku: 'BEB-003',
      images: ['https://example.com/beb1.jpg'],
      branchId: 'all',
      prepStationId: 'st-bar-bebidas',
      prepTimeMinutes: 5,
      isAvailableForSale: true,
      isAvailableForDelivery: true,
      isVisibleInMenu: true,
      status: 'agotado',
      variants: [],
      modifierGroupIds: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  // 1. Filter by search query "hbg"
  const resSearch = filterProducts(mockProducts, { searchTerm: 'hbg' });
  assert.equal(resSearch.length, 1);
  assert.equal(resSearch[0].id, 'prod-1');

  // 2. Filter by category
  const resCat = filterProducts(mockProducts, { categoryId: 'cat-costillas' });
  assert.equal(resCat.length, 1);
  assert.equal(resCat[0].id, 'prod-2');

  // 3. Filter by branch 'sede-chapinero' (matches prod-1 and prod-3 with branchId: 'all')
  const resBranch = filterProducts(mockProducts, { branchId: 'sede-chapinero' });
  assert.equal(resBranch.length, 2);
  assert.equal(resBranch.some((p) => p.id === 'prod-2'), false);

  // 4. Filter by status 'agotado'
  const resStatus = filterProducts(mockProducts, { status: 'agotado' });
  assert.equal(resStatus.length, 1);
  assert.equal(resStatus[0].id, 'prod-3');

  // 5. Filter by delivery only
  const resDelivery = filterProducts(mockProducts, { availableForDeliveryOnly: true });
  assert.equal(resDelivery.length, 2);
  assert.equal(resDelivery.some((p) => p.id === 'prod-2'), false);
});

test('sortCategories sorts categories by numeric order', () => {
  const cats: Category[] = [
    { id: 'c3', name: 'Postres', order: 3, isActive: true, isVisibleInMenu: true },
    { id: 'c1', name: 'Hamburguesas', order: 1, isActive: true, isVisibleInMenu: true },
    { id: 'c2', name: 'Costillas', order: 2, isActive: true, isVisibleInMenu: true },
  ];
  const sorted = sortCategories(cats);
  assert.equal(sorted[0].id, 'c1');
  assert.equal(sorted[1].id, 'c2');
  assert.equal(sorted[2].id, 'c3');
});
