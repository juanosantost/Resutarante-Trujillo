import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MENU_CONFIG,
  DEFAULT_MENU_SECTIONS,
  DEFAULT_MENU_BUTTONS,
  MenuButtonItemConfig,
} from '../types/menuConfig';

test('DEFAULT_MENU_CONFIG contains valid sections and buttons', () => {
  assert.ok(Array.isArray(DEFAULT_MENU_CONFIG.sections));
  assert.ok(DEFAULT_MENU_CONFIG.sections.length >= 5);
  assert.ok(Array.isArray(DEFAULT_MENU_CONFIG.buttons));
  assert.ok(DEFAULT_MENU_CONFIG.buttons.length >= 20);

  // Every button must have a valid sectionId corresponding to one of the sections
  const sectionIds = new Set(DEFAULT_MENU_CONFIG.sections.map((s) => s.id));
  for (const btn of DEFAULT_MENU_CONFIG.buttons) {
    assert.ok(
      sectionIds.has(btn.sectionId),
      `Button ${btn.id} has invalid sectionId: ${btn.sectionId}`
    );
    assert.ok(Array.isArray(btn.allowedRoles), `Button ${btn.id} must have allowedRoles`);
    assert.ok(btn.allowedRoles.length > 0, `Button ${btn.id} must have at least one allowed role`);
  }
});

test('Role permissions default logic', () => {
  // Administrador has access to all default buttons
  for (const btn of DEFAULT_MENU_CONFIG.buttons) {
    assert.ok(
      btn.allowedRoles.includes('administrador'),
      `Administrator should have access to ${btn.id}`
    );
  }

  // Cocinero has access to cocina by default
  const cocinaBtn = DEFAULT_MENU_CONFIG.buttons.find((b) => b.id === 'cocina');
  assert.ok(cocinaBtn, 'Cocina button must exist');
  assert.ok(cocinaBtn.allowedRoles.includes('cocinero'));

  // Asesor has access to operacion buttons by default
  const operacionButtons = DEFAULT_MENU_CONFIG.buttons.filter((b) => b.sectionId === 'operacion');
  for (const btn of operacionButtons) {
    assert.ok(
      btn.allowedRoles.includes('asesor'),
      `Asesor should have access to operational button ${btn.id}`
    );
  }

  // Asesor should not have access to admin-only buttons by default
  const usuariosBtn = DEFAULT_MENU_CONFIG.buttons.find((b) => b.id === 'usuarios');
  assert.ok(usuariosBtn, 'Usuarios button must exist');
  assert.equal(usuariosBtn.allowedRoles.includes('asesor'), false);
});

test('Reordering buttons preserves integrity', () => {
  const sectionButtons = DEFAULT_MENU_CONFIG.buttons
    .filter((b) => b.sectionId === 'operacion')
    .sort((a, b) => a.order - b.order);

  assert.equal(sectionButtons[0].id, 'home');
  assert.equal(sectionButtons[1].id, 'pedidos');

  // Simulate swap order
  const swapped = sectionButtons.map((b) => {
    if (b.id === 'home') return { ...b, order: 1 };
    if (b.id === 'pedidos') return { ...b, order: 0 };
    return b;
  }).sort((a, b) => a.order - b.order);

  assert.equal(swapped[0].id, 'pedidos');
  assert.equal(swapped[1].id, 'home');
});
