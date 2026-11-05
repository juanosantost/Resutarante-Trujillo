import test from 'node:test';
import assert from 'node:assert/strict';
import { ColmenaUser } from '../types';

test('Soft-delete user flags user properly', () => {
  const user: ColmenaUser = {
    id: 'usr-1',
    firebaseUid: 'fb-1',
    fullName: 'Carlos Vendedor',
    documentNumber: '11223344',
    email: 'carlos@colmena.com',
    role: 'asesor',
    authorizedBranchIds: ['sede-buga'],
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  // Simular soft-delete
  const deletedUser: ColmenaUser = {
    ...user,
    isDeleted: true,
    deletedAt: new Date().toISOString(),
    deletedBy: 'Administrador',
    deleteReason: 'Creado por error',
    isActive: false,
  };

  assert.equal(deletedUser.isDeleted, true);
  assert.equal(deletedUser.isActive, false);
  assert.ok(deletedUser.deletedAt);
  assert.equal(deletedUser.deletedBy, 'Administrador');
  assert.equal(deletedUser.deleteReason, 'Creado por error');

  // Simular restore
  const restoredUser: ColmenaUser = {
    ...deletedUser,
    isDeleted: false,
    deletedAt: undefined,
    deletedBy: undefined,
    deleteReason: undefined,
    isActive: true,
  };

  assert.equal(restoredUser.isDeleted, false);
  assert.equal(restoredUser.isActive, true);
  assert.equal(restoredUser.deletedAt, undefined);
});

test('Filtering separates active users from deleted users', () => {
  const users: ColmenaUser[] = [
    {
      id: 'usr-1',
      firebaseUid: 'fb-1',
      fullName: 'Admin Principal',
      documentNumber: '1020304050',
      email: 'juan.santos.ieci@gmail.com',
      role: 'administrador',
      authorizedBranchIds: ['sede-buga'],
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr-2',
      firebaseUid: 'fb-2',
      fullName: 'Usuario Incorrecto',
      documentNumber: '99887766',
      email: 'error@colmena.com',
      role: 'asesor',
      authorizedBranchIds: ['sede-buga'],
      isActive: false,
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  ];

  const active = users.filter((u) => !u.isDeleted);
  const trash = users.filter((u) => u.isDeleted === true);

  assert.equal(active.length, 1);
  assert.equal(active[0].id, 'usr-1');
  assert.equal(trash.length, 1);
  assert.equal(trash[0].id, 'usr-2');
});
