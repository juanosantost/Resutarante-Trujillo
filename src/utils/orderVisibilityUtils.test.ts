import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveOrderOwnership,
  isOrderOwnedByUser,
  canUserViewOrder,
  canUserManageOrder,
  filterOrdersForViewer,
  OrderViewerContext,
} from './orderVisibilityUtils';

const ADMIN_USER: OrderViewerContext = {
  id: 'usr-admin-principal',
  email: 'juan.santos.ieci@gmail.com',
  fullName: 'Juan David Santos Tamayo',
  role: 'administrador',
};

const ASESOR_CARLOS: OrderViewerContext = {
  id: 'usr-asesor-carlos',
  email: 'carlos@colmena.co',
  fullName: 'Carlos Ramírez',
  role: 'asesor',
};

const ASESOR_MARIA: OrderViewerContext = {
  id: 'usr-asesor-maria',
  email: 'maria@colmena.co',
  fullName: 'María López',
  role: 'asesor',
};

const COCINERO_USER: OrderViewerContext = {
  id: 'usr-cocinero-1',
  email: 'cocina@colmena.co',
  fullName: 'Pedro Cocina',
  role: 'cocinero',
};

test('resolveOrderOwnership stamps real user id, email, and fullName instead of generic usr-staff', () => {
  const ownership = resolveOrderOwnership(
    { id: 'usr-asesor-carlos', email: 'Carlos@Colmena.CO', fullName: 'Carlos Ramírez' },
    'Staff',
    'asesor'
  );

  assert.equal(ownership.waiterId, 'usr-asesor-carlos');
  assert.equal(ownership.createdByUserId, 'usr-asesor-carlos');
  assert.equal(ownership.createdByEmail, 'carlos@colmena.co');
  assert.equal(ownership.waiterName, 'Carlos Ramírez');
});

test('administrador sees ALL active orders regardless of owner', () => {
  const sampleOrders = [
    { id: 'ord-1', waiterId: 'usr-asesor-carlos', createdByUserId: 'usr-asesor-carlos', waiterName: 'Carlos Ramírez' },
    { id: 'ord-2', waiterId: 'usr-asesor-maria', createdByUserId: 'usr-asesor-maria', waiterName: 'María López' },
    { id: 'ord-3', waiterId: 'usr-admin-principal', createdByUserId: 'usr-admin-principal', waiterName: 'Juan David Santos Tamayo' },
    { id: 'ord-legacy', waiterId: 'usr-staff', waiterName: 'Otro Mesero' },
  ];

  const visibleToAdmin = filterOrdersForViewer(sampleOrders, ADMIN_USER);
  assert.equal(visibleToAdmin.length, 4);
  assert.equal(canUserManageOrder(sampleOrders[0], ADMIN_USER), true);
  assert.equal(canUserManageOrder(sampleOrders[1], ADMIN_USER), true);
});

test('asesor ONLY sees their own orders and NEVER sees orders from other asesores or admin', () => {
  const sampleOrders = [
    { id: 'ord-carlos-1', waiterId: 'usr-asesor-carlos', createdByUserId: 'usr-asesor-carlos', waiterName: 'Carlos Ramírez' },
    { id: 'ord-maria-1', waiterId: 'usr-asesor-maria', createdByUserId: 'usr-asesor-maria', waiterName: 'María López' },
    { id: 'ord-admin-1', waiterId: 'usr-admin-principal', createdByUserId: 'usr-admin-principal', waiterName: 'Juan David Santos Tamayo' },
    { id: 'ord-carlos-2', waiterId: 'usr-asesor-carlos', createdByUserId: 'usr-asesor-carlos', waiterName: 'Carlos Ramírez' },
  ];

  const visibleToCarlos = filterOrdersForViewer(sampleOrders, ASESOR_CARLOS);
  assert.deepEqual(
    visibleToCarlos.map((o) => o.id),
    ['ord-carlos-1', 'ord-carlos-2']
  );

  const visibleToMaria = filterOrdersForViewer(sampleOrders, ASESOR_MARIA);
  assert.deepEqual(
    visibleToMaria.map((o) => o.id),
    ['ord-maria-1']
  );

  assert.equal(canUserViewOrder(sampleOrders[1], ASESOR_CARLOS), false);
  assert.equal(canUserManageOrder(sampleOrders[1], ASESOR_CARLOS), false);
  assert.equal(canUserViewOrder(sampleOrders[2], ASESOR_CARLOS), false);
});

test('strict ID match prevents cross-user leakage even if two asesores share the exact same display name', () => {
  const orderByCarlos1 = {
    waiterId: 'usr-asesor-carlos',
    createdByUserId: 'usr-asesor-carlos',
    waiterName: 'Carlos Ramírez',
  };
  const anotherCarlos: OrderViewerContext = {
    id: 'usr-asesor-carlos-2',
    email: 'carlos2@colmena.co',
    fullName: 'Carlos Ramírez',
    role: 'asesor',
  };

  assert.equal(isOrderOwnedByUser(orderByCarlos1, ASESOR_CARLOS), true);
  assert.equal(isOrderOwnedByUser(orderByCarlos1, anotherCarlos), false);
});

test('legacy orders with placeholder waiterId usr-staff fall back to non-generic fullName match only', () => {
  const legacyCarlosOrder = {
    waiterId: 'usr-staff',
    waiterName: 'Carlos Ramírez',
  };
  const legacyGenericOrder = {
    waiterId: 'usr-staff',
    waiterName: 'Staff',
  };

  assert.equal(canUserViewOrder(legacyCarlosOrder, ASESOR_CARLOS), true);
  assert.equal(canUserViewOrder(legacyCarlosOrder, ASESOR_MARIA), false);
  assert.equal(canUserViewOrder(legacyGenericOrder, ASESOR_CARLOS), false);
  assert.equal(canUserViewOrder(legacyGenericOrder, ADMIN_USER), true);
});

test('legacy roles normalized to asesor (mesero, cajero) follow asesor ownership restriction and null viewer fails closed', () => {
  const meseroViewer: OrderViewerContext = {
    id: 'usr-mesero-1',
    fullName: 'Luis Mesero',
    role: 'mesero',
  };
  const ownOrder = { createdByUserId: 'usr-mesero-1', waiterId: 'usr-mesero-1', waiterName: 'Luis Mesero' };
  const otherOrder = { createdByUserId: 'usr-asesor-maria', waiterId: 'usr-asesor-maria', waiterName: 'María López' };

  assert.equal(canUserViewOrder(ownOrder, meseroViewer), true);
  assert.equal(canUserViewOrder(otherOrder, meseroViewer), false);
  assert.equal(canUserViewOrder(ownOrder, null), false);
  assert.equal(canUserViewOrder(ownOrder, COCINERO_USER), false);
  assert.deepEqual(filterOrdersForViewer([ownOrder, otherOrder], null), []);
});
