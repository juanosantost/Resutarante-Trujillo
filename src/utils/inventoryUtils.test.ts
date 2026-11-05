import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areUnitsCompatible,
  convertUnitQuantity,
  calculateRecipeCostAndMargin,
  calculateRealIngredientConsumption,
  getLowStockAlerts,
} from './inventoryUtils';
import { InventoryItem, RecipeIngredient, ProductVariant, ModifierOption } from '../types';

test('areUnitsCompatible verifies dimensional compatibility correctly', () => {
  assert.equal(areUnitsCompatible('g', 'kg'), true);
  assert.equal(areUnitsCompatible('kg', 'g'), true);
  assert.equal(areUnitsCompatible('ml', 'lt'), true);
  assert.equal(areUnitsCompatible('und', 'porc'), true);
  assert.equal(areUnitsCompatible('g', 'ml'), false);
  assert.equal(areUnitsCompatible('kg', 'und'), false);
});

test('convertUnitQuantity performs accurate conversions between compatible units', () => {
  assert.equal(convertUnitQuantity(1500, 'g', 'kg'), 1.5);
  assert.equal(convertUnitQuantity(2, 'kg', 'g'), 2000);
  assert.equal(convertUnitQuantity(500, 'ml', 'lt'), 0.5);
  assert.equal(convertUnitQuantity(1.2, 'lt', 'ml'), 1200);

  // Incompatible should throw
  assert.throws(() => {
    convertUnitQuantity(100, 'g', 'ml');
  });
});

test('calculateRecipeCostAndMargin computes exact recipe costs and margins', () => {
  const sellingPrice = 36000;
  const recipe: RecipeIngredient[] = [
    { inventoryItemId: 'inv-carne', name: 'Carne Angus', quantity: 200, unit: 'g' },
    { inventoryItemId: 'inv-pan', name: 'Pan Brioche', quantity: 1, unit: 'und' },
  ];

  const invMap = new Map<string, InventoryItem>([
    ['inv-carne', { id: 'inv-carne', branchId: 's1', name: 'Carne Angus', unit: 'g', currentStock: 5000, minStock: 1000, costPerUnit: 48, updatedAt: '' }],
    ['inv-pan', { id: 'inv-pan', branchId: 's1', name: 'Pan Brioche', unit: 'und', currentStock: 50, minStock: 10, costPerUnit: 2200, updatedAt: '' }],
  ]);

  const result = calculateRecipeCostAndMargin(sellingPrice, recipe, invMap);
  // Costo carne = 200 * 48 = 9.600 COP
  // Costo pan = 1 * 2.200 = 2.200 COP
  // Total costo = 11.800 COP
  // Margen COP = 36.000 - 11.800 = 24.200 COP
  // Margen % = 24.200 / 36.000 = ~67%
  assert.equal(result.totalRecipeCost, 11800);
  assert.equal(result.grossMarginCOP, 24200);
  assert.equal(result.marginPercentage, 67);
});

test('calculateRealIngredientConsumption aggregates base recipe, variants and modifiers', () => {
  const baseRecipe: RecipeIngredient[] = [
    { inventoryItemId: 'inv-carne', name: 'Carne Angus', quantity: 150, unit: 'g' },
  ];
  const variant: ProductVariant = {
    id: 'v2',
    name: 'Doble Carne',
    priceAdjustment: 10000,
    isActive: true,
  };
  const modifiers: ModifierOption[] = [
    { id: 'm1', name: 'Adición Tocineta', priceSurcharge: 5000, isActive: true, ingredientId: 'inv-tocineta' },
  ];

  const consumption = calculateRealIngredientConsumption(baseRecipe, variant, modifiers, 1);
  // Carne: 150g * 2 (por ser variante doble) = 300g
  // Tocineta: 1 unidad adicional
  assert.equal(consumption.get('inv-carne'), 300);
  assert.equal(consumption.get('inv-tocineta'), 1);
});

test('getLowStockAlerts filters items below minimum stock threshold', () => {
  const items: InventoryItem[] = [
    { id: '1', branchId: 's1', name: 'Item A', unit: 'g', currentStock: 500, minStock: 1000, costPerUnit: 10, updatedAt: '' },
    { id: '2', branchId: 's1', name: 'Item B', unit: 'g', currentStock: 5000, minStock: 1000, costPerUnit: 10, updatedAt: '' },
  ];
  const alerts = getLowStockAlerts(items);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].id, '1');
});
