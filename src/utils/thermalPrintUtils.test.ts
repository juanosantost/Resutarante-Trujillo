import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeThermalPixelValue,
  detectLightOnTransparentLogo,
} from './thermalPrintUtils';

test('mantiene píxeles transparentes y fondo blanco puro como 255 (blanco)', () => {
  assert.equal(computeThermalPixelValue(0, 0, 0, 0, false), 255);
  assert.equal(computeThermalPixelValue(255, 255, 255, 255, false), 255);
  assert.equal(computeThermalPixelValue(248, 248, 248, 255, false), 255);
});

test('mantiene tinta negra pura como 0 (negro)', () => {
  assert.equal(computeThermalPixelValue(0, 0, 0, 255, false), 0);
});

test('oscurece colores de marca (ej. dorado Colmena #D6A21A y #B77900) para impresión térmica', () => {
  const colmenaGoldLight = computeThermalPixelValue(214, 162, 26, 255, false);
  const colmenaGoldDark = computeThermalPixelValue(183, 121, 0, 255, false);
  const brightYellow = computeThermalPixelValue(250, 204, 21, 255, false);

  assert.ok(colmenaGoldLight < 60, `Expected < 60, got ${colmenaGoldLight}`);
  assert.ok(colmenaGoldDark < 40, `Expected < 40, got ${colmenaGoldDark}`);
  assert.ok(brightYellow < 80, `Expected < 80, got ${brightYellow}`);
});

test('detecta e invierte logotipos blancos sobre fondo transparente a tinta oscura imprimible', () => {
  const data = new Uint8ClampedArray([
    0, 0, 0, 0,
    0, 0, 0, 0,
    255, 255, 255, 255,
    250, 250, 250, 255,
  ]);
  assert.equal(detectLightOnTransparentLogo(data), true);

  const whiteStroke = computeThermalPixelValue(255, 255, 255, 255, true);
  const transparentBg = computeThermalPixelValue(0, 0, 0, 0, true);
  assert.ok(whiteStroke < 30, `Expected < 30, got ${whiteStroke}`);
  assert.equal(transparentBg, 255);
});

test('no marca como logo blanco-sobre-transparente un logotipo oscuro normal', () => {
  const data = new Uint8ClampedArray([
    0, 0, 0, 0,
    0, 0, 0, 0,
    24, 24, 24, 255,
    183, 121, 0, 255,
  ]);
  assert.equal(detectLightOnTransparentLogo(data), false);
});
