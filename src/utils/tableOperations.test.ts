import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOccupancyMinutes,
  formatOccupancyDuration,
  validateTableStatusTransition,
  getTableStatusConfig,
  sortAreasByOrder,
  groupTablesByArea,
  validateAreaPayload,
  validateTablePayload,
  validatePrepStationPayload,
} from './tableOperations';
import { Table, RestaurantArea, PrepStation } from '../types';

test('calculateOccupancyMinutes correctly returns elapsed minutes', () => {
  const now = new Date('2026-10-22T15:00:00Z');
  const thirtyMinsAgo = new Date('2026-10-22T14:30:00Z').toISOString();
  const ninetyMinsAgo = new Date('2026-10-22T13:30:00Z').toISOString();

  assert.equal(calculateOccupancyMinutes(thirtyMinsAgo, now), 30);
  assert.equal(calculateOccupancyMinutes(ninetyMinsAgo, now), 90);
  assert.equal(calculateOccupancyMinutes(null, now), 0);
  assert.equal(calculateOccupancyMinutes(undefined, now), 0);
  assert.equal(calculateOccupancyMinutes('invalid-date', now), 0);
});

test('formatOccupancyDuration formats duration nicely', () => {
  const now = new Date('2026-10-22T15:00:00Z');
  const nowISO = new Date('2026-10-22T15:00:00Z').toISOString();
  const twentyMinsAgo = new Date('2026-10-22T14:40:00Z').toISOString();
  const seventyMinsAgo = new Date('2026-10-22T13:50:00Z').toISOString();
  const twoHoursAgo = new Date('2026-10-22T13:00:00Z').toISOString();

  assert.equal(formatOccupancyDuration(nowISO, now), '< 1 min');
  assert.equal(formatOccupancyDuration(twentyMinsAgo, now), '20 min');
  assert.equal(formatOccupancyDuration(seventyMinsAgo, now), '1h 10m');
  assert.equal(formatOccupancyDuration(twoHoursAgo, now), '2h');
});

test('validateTableStatusTransition enforces business rules on active tabs and states', () => {
  // Allowed transitions when no tab is open
  assert.equal(validateTableStatusTransition('libre', 'ocupada', false).isValid, true);
  assert.equal(validateTableStatusTransition('ocupada', 'limpieza', false).isValid, true);
  assert.equal(validateTableStatusTransition('limpieza', 'libre', false).isValid, true);
  assert.equal(validateTableStatusTransition('libre', 'mantenimiento', false).isValid, true);

  // When there is an open tab, cannot transition to mantenimiento, limpieza, or libre directly without closing tab
  const blockedMantenimiento = validateTableStatusTransition('ocupada', 'mantenimiento', true);
  assert.equal(blockedMantenimiento.isValid, false);
  assert.match(blockedMantenimiento.error || '', /cuenta o comanda activa/i);

  const blockedLimpieza = validateTableStatusTransition('ocupada', 'limpieza', true);
  assert.equal(blockedLimpieza.isValid, false);

  // Cannot transition directly from mantenimiento to ocupada
  const blockedFromMantenimiento = validateTableStatusTransition('mantenimiento', 'ocupada', false);
  assert.equal(blockedFromMantenimiento.isValid, false);
});

test('getTableStatusConfig provides proper styling and descriptive labels', () => {
  const libre = getTableStatusConfig('libre');
  assert.equal(libre.label, 'Libre');
  assert.match(libre.badgeClass, /emerald/i);

  const ocupada = getTableStatusConfig('ocupada');
  assert.equal(ocupada.label, 'Ocupada');
  assert.match(ocupada.badgeClass, /rose/i);

  const reservada = getTableStatusConfig('reservada');
  assert.equal(reservada.label, 'Reservada');

  const limpieza = getTableStatusConfig('limpieza');
  assert.equal(limpieza.label, 'Pendiente de Limpieza');

  const mantenimiento = getTableStatusConfig('mantenimiento');
  assert.equal(mantenimiento.label, 'Fuera de Servicio');
});

test('sortAreasByOrder sorts areas correctly by ascending order', () => {
  const areas: RestaurantArea[] = [
    { id: 'a3', branchId: 'b1', name: 'Barra', order: 3, isActive: true },
    { id: 'a1', branchId: 'b1', name: 'Salón', order: 1, isActive: true },
    { id: 'a2', branchId: 'b1', name: 'Terraza', order: 2, isActive: true },
  ];

  const sorted = sortAreasByOrder(areas);
  assert.equal(sorted[0].id, 'a1');
  assert.equal(sorted[1].id, 'a2');
  assert.equal(sorted[2].id, 'a3');
});

test('groupTablesByArea groups and sorts tables under respective areas', () => {
  const areas: RestaurantArea[] = [
    { id: 'salon', branchId: 'b1', name: 'Salón Principal', order: 1, isActive: true },
    { id: 'terraza', branchId: 'b1', name: 'Terraza', order: 2, isActive: true },
  ];

  const tables: Table[] = [
    {
      id: 't-2',
      branchId: 'b1',
      areaId: 'salon',
      number: 2,
      zone: 'Salón Principal',
      capacity: 4,
      status: 'libre',
      displayOrder: 2,
      isActive: true,
    },
    {
      id: 't-1',
      branchId: 'b1',
      areaId: 'salon',
      number: 1,
      zone: 'Salón Principal',
      capacity: 2,
      status: 'libre',
      displayOrder: 1,
      isActive: true,
    },
    {
      id: 't-10',
      branchId: 'b1',
      areaId: 'terraza',
      number: 10,
      zone: 'Terraza',
      capacity: 6,
      status: 'ocupada',
      displayOrder: 1,
      isActive: true,
    },
  ];

  const grouped = groupTablesByArea(tables, areas);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].area.id, 'salon');
  assert.equal(grouped[0].tables.length, 2);
  // Verify sorted by displayOrder
  assert.equal(grouped[0].tables[0].number, 1);
  assert.equal(grouped[0].tables[1].number, 2);
  assert.equal(grouped[1].area.id, 'terraza');
  assert.equal(grouped[1].tables.length, 1);
});

test('validators check requirements for areas, tables and prep stations', () => {
  // Area validation
  assert.equal(validateAreaPayload({ name: 'Salón VIP', order: 1 }).isValid, true);
  assert.equal(validateAreaPayload({ name: 'AB' }).isValid, false);

  // Table validation
  assert.equal(
    validateTablePayload({ number: 5, areaId: 'area-1', capacity: 4 }).isValid,
    true
  );
  assert.equal(validateTablePayload({ number: 0, areaId: 'area-1', capacity: 4 }).isValid, false);
  assert.equal(validateTablePayload({ number: 5, areaId: '', capacity: 4 }).isValid, false);
  assert.equal(validateTablePayload({ number: 5, areaId: 'area-1', capacity: 0 }).isValid, false);

  // Prep Station validation
  assert.equal(
    validatePrepStationPayload({ name: 'Cocina Fría', code: 'COC_FRIA', order: 2 }).isValid,
    true
  );
  assert.equal(validatePrepStationPayload({ name: 'Co', code: 'C' }).isValid, false);
});
