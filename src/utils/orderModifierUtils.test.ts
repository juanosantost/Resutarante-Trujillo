import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getVisibleOrderModifiers,
  getKitchenPosOrderModifiers,
  isDailyMenuDrinkModifier,
  isDailyMenuOrderItem,
} from './orderModifierUtils';
import { SelectedModifierDetail } from '../types';

const dailyMenuModifiers: SelectedModifierDetail[] = [
  {
    groupId: 'grp-almuerzo-sopa',
    groupName: 'Sopa',
    optionId: 'opt-sopa-verduras',
    optionName: 'Sopa de Verduras',
    priceSurcharge: 0,
    quantity: 1,
  },
  {
    groupId: 'grp-almuerzo-principio',
    groupName: 'Principio',
    optionId: 'opt-prin-frijoles',
    optionName: 'Frijoles',
    priceSurcharge: 0,
    quantity: 1,
  },
  {
    groupId: 'grp-almuerzo-carne',
    groupName: 'Carne',
    optionId: 'opt-carne-pechuga',
    optionName: 'Pechuga a la Plancha',
    priceSurcharge: 0,
    quantity: 1,
  },
  {
    groupId: 'grp-almuerzo-acomp1',
    groupName: 'Acompañamiento 1',
    optionId: 'opt-ac1-arroz-blanco',
    optionName: 'Arroz Blanco',
    priceSurcharge: 0,
    quantity: 1,
    isDefault: true,
  },
  {
    groupId: 'grp-almuerzo-bebida',
    groupName: 'Bebida / Sobremesa',
    optionId: 'opt-beb-limonada',
    optionName: 'Limonada Natural / Guarapo',
    priceSurcharge: 0,
    quantity: 1,
    isDefault: true,
  },
];

test('getKitchenPosOrderModifiers - Omits daily menu drink on Kitchen POS while keeping food modifiers', () => {
  const item = {
    menuItemId: 'prod-almuerzo-del-dia',
    name: 'Menú del Día',
    selectedModifiers: dailyMenuModifiers,
  };

  // Standard view (cart / receipt) still includes the drink
  const standardVisible = getVisibleOrderModifiers(item.selectedModifiers).map((m) => m.cleanName);
  assert.deepEqual(standardVisible, [
    'Sopa de Verduras',
    'Frijoles',
    'Pechuga a la Plancha',
    'Limonada Natural / Guarapo',
  ]);

  // Kitchen POS omits the daily menu drink
  const kitchenVisible = getKitchenPosOrderModifiers(item).map((m) => m.cleanName);
  assert.deepEqual(kitchenVisible, [
    'Sopa de Verduras',
    'Frijoles',
    'Pechuga a la Plancha',
  ]);
});

test('getKitchenPosOrderModifiers - Detects renamed daily menu product and custom drink options', () => {
  const renamedItem = {
    menuItemId: 'custom-daily-id',
    name: 'Almuerzo Ejecutivo Especial',
    selectedModifiers: [
      {
        groupId: 'grp-almuerzo-sopa',
        groupName: 'Sopa',
        optionId: 'opt-sopa-1',
        optionName: 'Ajiaco',
        priceSurcharge: 0,
        quantity: 1,
      },
      {
        groupId: 'grp-almuerzo-bebida',
        groupName: 'Bebida / Sobremesa',
        optionId: 'opt-custom-jugo',
        optionName: 'Jugo de Lulo en Leche',
        priceSurcharge: 1500,
        quantity: 1,
      },
    ],
  };

  assert.equal(isDailyMenuOrderItem(renamedItem), true);
  assert.equal(isDailyMenuDrinkModifier(renamedItem.selectedModifiers[1]), true);

  const kitchenVisible = getKitchenPosOrderModifiers(renamedItem).map((m) => m.cleanName);
  assert.deepEqual(kitchenVisible, ['Ajiaco']);
});

test('getKitchenPosOrderModifiers - Does not strip non-daily-menu modifiers', () => {
  const burgerItem = {
    menuItemId: 'prod-burger-colmena',
    name: 'Hamburguesa Colmena',
    selectedModifiers: [
      {
        groupId: 'grp-termino',
        groupName: 'Término',
        optionId: 'opt-termino-medio',
        optionName: 'Término Medio',
        priceSurcharge: 0,
        quantity: 1,
      },
      {
        groupId: 'grp-adicionales',
        groupName: 'Adicionales',
        optionId: 'opt-tocineta',
        optionName: 'Extra Tocineta',
        priceSurcharge: 4000,
        quantity: 1,
      },
    ],
  };

  assert.equal(isDailyMenuOrderItem(burgerItem), false);
  const kitchenVisible = getKitchenPosOrderModifiers(burgerItem).map((m) => m.cleanName);
  assert.deepEqual(kitchenVisible, ['Término Medio', 'Extra Tocineta']);
});
