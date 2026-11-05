/**
 * Pruebas unitarias para fidelización y clientes (Módulo 12)
 */

import test from 'node:test';
import assert from 'node:assert';
import {
  calculateEarnedPoints,
  calculateRedemptionValue,
  generateWhatsAppMessage,
  DEFAULT_LOYALTY_CONFIG,
} from './loyaltyUtils';

test('calculateEarnedPoints computes earned points correctly based on spending', () => {
  // Gasto de $50.000 con pointsPerPeso = 0.001 (1 punto por cada $1.000) -> 50 puntos
  const points = calculateEarnedPoints(50000, DEFAULT_LOYALTY_CONFIG);
  assert.strictEqual(points, 50);

  // Con programa desactivado
  const pointsDisabled = calculateEarnedPoints(50000, { ...DEFAULT_LOYALTY_CONFIG, isEnabled: false });
  assert.strictEqual(pointsDisabled, 0);
});

test('calculateRedemptionValue computes COP discount value correctly', () => {
  // 150 puntos con pesosPerRedemptionPoint = 10 -> $1.500 COP
  const value = calculateRedemptionValue(150, DEFAULT_LOYALTY_CONFIG);
  assert.strictEqual(value, 1500);

  // Por debajo del mínimo (50 puntos < minPointsToRedeem 100) -> 0
  const valueBelowMin = calculateRedemptionValue(50, DEFAULT_LOYALTY_CONFIG);
  assert.strictEqual(valueBelowMin, 0);
});

test('generateWhatsAppMessage creates proper preformatted messages', () => {
  const msg = generateWhatsAppMessage('bienvenida', 'Carlos Pérez');
  assert.ok(msg.includes('Carlos Pérez'));
  assert.ok(msg.includes('Colmena'));
});
