import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canUserAccessBranch,
  canUserAccessModule,
  validateDocumentNumber,
  validateEmail,
  isFirstAdminCandidate,
} from './auth';
import { ColmenaUser } from '../types';

test('canUserAccessBranch allows administrator into all branches', () => {
  const adminUser: ColmenaUser = {
    id: 'usr-admin',
    firebaseUid: 'fb-admin',
    fullName: 'Juan Administrador',
    documentNumber: '1020304050',
    email: 'admin@colmena.co',
    role: 'administrador',
    authorizedBranchIds: ['sede-chapinero'],
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  assert.equal(canUserAccessBranch(adminUser, 'sede-chapinero'), true);
  assert.equal(canUserAccessBranch(adminUser, 'sede-parque93'), true);
  assert.equal(canUserAccessBranch(adminUser, 'otra-sede'), true);
});

test('canUserAccessBranch restricts non-admin to authorized branches only', () => {
  const cajeroUser: ColmenaUser = {
    id: 'usr-cajero',
    firebaseUid: 'fb-cajero',
    fullName: 'Carolina Cajera',
    documentNumber: '52304050',
    email: 'carolina@colmena.co',
    role: 'cajero',
    authorizedBranchIds: ['sede-chapinero'],
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  assert.equal(canUserAccessBranch(cajeroUser, 'sede-chapinero'), true);
  assert.equal(canUserAccessBranch(cajeroUser, 'sede-parque93'), false);

  // If user is inactive, access is revoked
  cajeroUser.isActive = false;
  assert.equal(canUserAccessBranch(cajeroUser, 'sede-chapinero'), false);
});

test('canUserAccessModule enforces strict RBAC for the 3 roles', () => {
  // 1. Administrador: Acceso total
  assert.equal(canUserAccessModule('administrador', 'usuarios'), true);
  assert.equal(canUserAccessModule('administrador', 'sucursales'), true);
  assert.equal(canUserAccessModule('administrador', 'caja'), true);
  assert.equal(canUserAccessModule('administrador', 'inventario'), true);
  assert.equal(canUserAccessModule('administrador', 'reportes'), true);
  assert.equal(canUserAccessModule('administrador', 'cocina'), true);

  // 2. Asesor: Acceso al apartado operación (pedidos, mesas, domicilios, caja, ingresos, cocina)
  assert.equal(canUserAccessModule('asesor', 'pedidos'), true);
  assert.equal(canUserAccessModule('asesor', 'mesas'), true);
  assert.equal(canUserAccessModule('asesor', 'caja'), true);
  assert.equal(canUserAccessModule('asesor', 'ingresos'), true);
  assert.equal(canUserAccessModule('asesor', 'cocina'), true);
  assert.equal(canUserAccessModule('asesor', 'usuarios'), false);
  assert.equal(canUserAccessModule('asesor', 'sucursales'), false);
  assert.equal(canUserAccessModule('asesor', 'inventario'), false);
  assert.equal(canUserAccessModule('asesor', 'reportes'), false);

  // 3. Cocinero: Acceso únicamente a la parte de cocina
  assert.equal(canUserAccessModule('cocinero', 'cocina'), true);
  assert.equal(canUserAccessModule('cocinero', 'caja'), false);
  assert.equal(canUserAccessModule('cocinero', 'usuarios'), false);
  assert.equal(canUserAccessModule('cocinero', 'inventario'), false);
  assert.equal(canUserAccessModule('cocinero', 'pedidos'), false);
  assert.equal(canUserAccessModule('cocinero', 'mesas'), false);
});

test('validateDocumentNumber and validateEmail validate correctly', () => {
  assert.equal(validateDocumentNumber('1020304050'), true);
  assert.equal(validateDocumentNumber('80.123.456'), true); // stripped
  assert.equal(validateDocumentNumber('123'), false); // too short

  assert.equal(validateEmail('juan@colmena.com'), true);
  assert.equal(validateEmail('invalido@'), false);
  assert.equal(validateEmail(''), false);
});

test('isFirstAdminCandidate identifies initial bootstrap eligibility', () => {
  assert.equal(isFirstAdminCandidate('cualquiera@test.com', 0), true);
  assert.equal(isFirstAdminCandidate('juan.santos.ieci@gmail.com', 5), true);
  assert.equal(isFirstAdminCandidate('otro@test.com', 5), false);
});
