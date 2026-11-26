import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_QUICK_SALE_CONFIG,
  normalizeQuickSaleConfig,
  isCategoryVisibleInQuickSale,
  isProductVisibleInQuickSale,
  filterQuickSaleCategories,
  filterQuickSaleProducts,
  toggleQuickSaleCategory,
  toggleQuickSaleProduct,
  setAllQuickSaleVisibility,
} from './quickSaleConfigUtils';

const SAMPLE_CATEGORIES = [
  { id: 'cat-bebidas', name: 'Bebidas' },
  { id: 'cat-platos', name: 'Platos Fuertes' },
  { id: 'cat-postres', name: 'Postres' },
];

const SAMPLE_PRODUCTS = [
  { id: 'prod-coca', name: 'Coca-Cola', categoryId: 'cat-bebidas' },
  { id: 'prod-jugo', name: 'Jugo Natural', categoryId: 'cat-bebidas' },
  { id: 'prod-agua', name: 'Agua Botella', categoryId: 'cat-bebidas' },
  { id: 'prod-almuerzo', name: 'Menú del Día', categoryId: 'cat-platos' },
  { id: 'prod-torta', name: 'Torta de Chocolate', categoryId: 'cat-postres' },
];

test('DEFAULT_QUICK_SALE_CONFIG shows all categories and products by default', () => {
  const cats = filterQuickSaleCategories(SAMPLE_CATEGORIES, DEFAULT_QUICK_SALE_CONFIG);
  const prods = filterQuickSaleProducts(SAMPLE_PRODUCTS, DEFAULT_QUICK_SALE_CONFIG);

  assert.equal(cats.length, 3);
  assert.equal(prods.length, 5);
});

test('normalizeQuickSaleConfig sanitizes duplicates, blanks, and nullish values', () => {
  const normalized = normalizeQuickSaleConfig({
    hiddenCategoryIds: ['cat-bebidas', ' cat-bebidas ', ''],
    hiddenProductIds: ['prod-agua', 'prod-agua'],
  });

  assert.deepEqual(normalized.hiddenCategoryIds, ['cat-bebidas']);
  assert.deepEqual(normalized.hiddenProductIds, ['prod-agua']);
  assert.deepEqual(normalizeQuickSaleConfig(null), {
    hiddenCategoryIds: [],
    hiddenProductIds: [],
    updatedAt: undefined,
    updatedBy: undefined,
  });
});

test('toggleQuickSaleCategory hides an entire category and all its products, then restores them cleanly', () => {
  const drinkIds = ['prod-coca', 'prod-jugo', 'prod-agua'];

  // Hide bebidas
  const hiddenBebidas = toggleQuickSaleCategory(
    DEFAULT_QUICK_SALE_CONFIG,
    'cat-bebidas',
    drinkIds
  );
  assert.equal(isCategoryVisibleInQuickSale('cat-bebidas', hiddenBebidas), false);
  assert.equal(isProductVisibleInQuickSale(SAMPLE_PRODUCTS[0], hiddenBebidas), false);
  assert.equal(isProductVisibleInQuickSale(SAMPLE_PRODUCTS[3], hiddenBebidas), true);
  assert.equal(filterQuickSaleProducts(SAMPLE_PRODUCTS, hiddenBebidas).length, 2);

  // Restore bebidas
  const restoredBebidas = toggleQuickSaleCategory(hiddenBebidas, 'cat-bebidas', drinkIds);
  assert.equal(isCategoryVisibleInQuickSale('cat-bebidas', restoredBebidas), true);
  assert.equal(filterQuickSaleProducts(SAMPLE_PRODUCTS, restoredBebidas).length, 5);
});

test('toggleQuickSaleProduct hides a single product and can selectively enable one product inside a hidden category', () => {
  const drinkIds = ['prod-coca', 'prod-jugo', 'prod-agua'];

  // 1. Hide only Agua while keeping Coca-Cola and Jugo visible
  const hideAgua = toggleQuickSaleProduct(
    DEFAULT_QUICK_SALE_CONFIG,
    'prod-agua',
    'cat-bebidas',
    drinkIds
  );
  assert.equal(isProductVisibleInQuickSale(SAMPLE_PRODUCTS[0], hideAgua), true);
  assert.equal(isProductVisibleInQuickSale(SAMPLE_PRODUCTS[2], hideAgua), false);

  // 2. Hide entire Bebidas category, then turn ON only Coca-Cola
  const hideAllBebidas = toggleQuickSaleCategory(
    DEFAULT_QUICK_SALE_CONFIG,
    'cat-bebidas',
    drinkIds
  );
  const onlyCocaVisible = toggleQuickSaleProduct(
    hideAllBebidas,
    'prod-coca',
    'cat-bebidas',
    drinkIds
  );

  assert.equal(isCategoryVisibleInQuickSale('cat-bebidas', onlyCocaVisible), true);
  assert.equal(isProductVisibleInQuickSale(SAMPLE_PRODUCTS[0], onlyCocaVisible), true);
  assert.equal(isProductVisibleInQuickSale(SAMPLE_PRODUCTS[1], onlyCocaVisible), false);
  assert.equal(isProductVisibleInQuickSale(SAMPLE_PRODUCTS[2], onlyCocaVisible), false);
});

test('setAllQuickSaleVisibility hides all and restores all cleanly', () => {
  const allHidden = setAllQuickSaleVisibility(
    SAMPLE_CATEGORIES.map((c) => c.id),
    [],
    false
  );
  assert.equal(filterQuickSaleCategories(SAMPLE_CATEGORIES, allHidden).length, 0);
  assert.equal(filterQuickSaleProducts(SAMPLE_PRODUCTS, allHidden).length, 0);

  const allShown = setAllQuickSaleVisibility(
    SAMPLE_CATEGORIES.map((c) => c.id),
    [],
    true
  );
  assert.equal(filterQuickSaleCategories(SAMPLE_CATEGORIES, allShown).length, 3);
  assert.equal(filterQuickSaleProducts(SAMPLE_PRODUCTS, allShown).length, 5);
});
