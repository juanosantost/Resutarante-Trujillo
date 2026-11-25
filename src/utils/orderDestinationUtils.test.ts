import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDestinationTypeName,
  formatOrderDestinationLabel,
  resolveRoundDestination,
} from './orderDestinationUtils';
import type { Table } from '../types';

const sampleTables: Table[] = [
  {
    id: 'tbl-1',
    branchId: 'br-1',
    areaId: 'area-1',
    number: 1,
    zone: 'Salón',
    capacity: 4,
    status: 'libre',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'tbl-9',
    branchId: 'br-1',
    areaId: 'area-1',
    number: 9,
    zone: 'Salón',
    capacity: 4,
    status: 'ocupada',
    currentOrderId: 'ord-138',
    displayOrder: 9,
    isActive: true,
  },
  {
    id: 'tbl-4',
    branchId: 'br-1',
    areaId: 'area-2',
    number: 4,
    zone: 'Terraza',
    capacity: 4,
    status: 'ocupada',
    currentOrderId: 'ord-999',
    displayOrder: 4,
    isActive: true,
  },
];

const sampleMesaOrder = {
  id: 'ord-138',
  type: 'mesa' as const,
  tableId: 'tbl-9',
  tableName: 'Mesa 9 (Salón)',
  customerName: 'Mesa 9 (Salón)',
  customerPhone: '',
  customerAddress: '',
};

test('formatOrderDestinationLabel formatea correctamente mesa, domicilio, mostrador y para llevar', () => {
  assert.equal(formatOrderDestinationLabel(sampleMesaOrder), 'Mesa 9 (Salón)');
  assert.equal(
    formatOrderDestinationLabel({
      type: 'domicilio',
      tableName: 'Domicilio',
      customerAddress: 'Calle 10 # 5-20',
      customerName: 'Laura',
    }),
    'Domicilio · Calle 10 # 5-20'
  );
  assert.equal(
    formatOrderDestinationLabel({
      type: 'mostrador',
      tableName: 'Mostrador',
      customerName: 'Cliente General',
    }),
    'Mostrador'
  );
  assert.equal(
    formatOrderDestinationLabel({
      type: 'para_llevar',
      tableName: 'Para Llevar',
      customerName: 'Carlos',
    }),
    'Para Llevar · Carlos'
  );
  assert.equal(formatDestinationTypeName('domicilio'), 'Domicilio');
});

test('resolveRoundDestination con mismo_lugar mantiene el destino actual del pedido', () => {
  const res = resolveRoundDestination({
    order: sampleMesaOrder,
    input: { scope: 'mismo_lugar' },
    tables: sampleTables,
  });

  assert.equal(res.valid, true);
  assert.equal(res.scope, 'mismo_lugar');
  assert.equal(res.isDifferentFromOrder, false);
  assert.equal(res.destination.type, 'mesa');
  assert.equal(res.destination.label, 'Mesa 9 (Salón)');
});

test('resolveRoundDestination permite enviar una ronda adicional a domicilio validando dirección obligatoria', () => {
  const missingAddr = resolveRoundDestination({
    order: sampleMesaOrder,
    input: { scope: 'solo_ronda', type: 'domicilio', customerAddress: '   ' },
    tables: sampleTables,
  });
  assert.equal(missingAddr.valid, false);
  assert.match(missingAddr.error || '', /dirección/i);

  const validDelivery = resolveRoundDestination({
    order: sampleMesaOrder,
    input: {
      scope: 'solo_ronda',
      type: 'domicilio',
      customerName: 'Ana Pérez',
      customerPhone: '3001234567',
      customerAddress: 'Cra 8 # 12-30',
    },
    tables: sampleTables,
  });

  assert.equal(validDelivery.valid, true);
  assert.equal(validDelivery.isDifferentFromOrder, true);
  assert.equal(validDelivery.destination.type, 'domicilio');
  assert.equal(validDelivery.destination.label, 'Domicilio · Cra 8 # 12-30');
  assert.equal(validDelivery.destination.customerPhone, '3001234567');
});

test('resolveRoundDestination permite enviar solo la ronda a otra mesa aunque esté ocupada, pero exige mesa libre al cambiar todo el pedido', () => {
  const soloToOccupied = resolveRoundDestination({
    order: sampleMesaOrder,
    input: { scope: 'solo_ronda', type: 'mesa', tableId: 'tbl-4' },
    tables: sampleTables,
  });
  assert.equal(soloToOccupied.valid, true);
  assert.equal(soloToOccupied.isDifferentFromOrder, true);
  assert.equal(soloToOccupied.destination.label, 'Mesa 4 (Terraza)');

  const moveToOccupied = resolveRoundDestination({
    order: sampleMesaOrder,
    input: { scope: 'cambiar_pedido', type: 'mesa', tableId: 'tbl-4' },
    tables: sampleTables,
  });
  assert.equal(moveToOccupied.valid, false);
  assert.match(moveToOccupied.error || '', /ocupada|pedido activo/i);

  const moveToFree = resolveRoundDestination({
    order: sampleMesaOrder,
    input: { scope: 'cambiar_pedido', type: 'mesa', tableId: 'tbl-1' },
    tables: sampleTables,
  });
  assert.equal(moveToFree.valid, true);
  assert.equal(moveToFree.isDifferentFromOrder, true);
  assert.equal(moveToFree.destination.label, 'Mesa 1 (Salón)');
  assert.equal(moveToFree.destination.tableId, 'tbl-1');
});

test('resolveRoundDestination permite elegir Mostrador y Para Llevar desde una mesa', () => {
  const mostrador = resolveRoundDestination({
    order: sampleMesaOrder,
    input: { scope: 'solo_ronda', type: 'mostrador', customerName: 'Pedro' },
    tables: sampleTables,
  });
  assert.equal(mostrador.valid, true);
  assert.equal(mostrador.isDifferentFromOrder, true);
  assert.equal(mostrador.destination.label, 'Mostrador · Pedro');

  const paraLlevar = resolveRoundDestination({
    order: sampleMesaOrder,
    input: { scope: 'cambiar_pedido', type: 'para_llevar', customerPhone: '3110000000' },
    tables: sampleTables,
  });
  assert.equal(paraLlevar.valid, true);
  assert.equal(paraLlevar.isDifferentFromOrder, true);
  assert.equal(paraLlevar.destination.label, 'Para Llevar');
});
