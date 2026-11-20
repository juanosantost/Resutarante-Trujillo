import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeThermalPixelValue,
  detectLightOnTransparentLogo,
  getThermalPrintableWidthMm,
  buildThermalPrintDocumentHtml,
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

test('getThermalPrintableWidthMm calibra 70mm para 80mm (JAL-821 / 72mm útiles) y 46mm para 58mm', () => {
  assert.equal(getThermalPrintableWidthMm('80mm'), 70);
  assert.equal(getThermalPrintableWidthMm('58mm'), 46);
  assert.equal(getThermalPrintableWidthMm(undefined), 70);
});

test('buildThermalPrintDocumentHtml genera documento aislado sin size: 80mm auto y calibrado a JAL-821 (70mm)', () => {
  const html = buildThermalPrintDocumentHtml({
    ticketHtml: '<div class="colmena-printable-ticket"><div>FACTURA #101</div></div>',
    paperWidth: '80mm',
    title: 'Factura <POS> & Cobro',
  });

  assert.ok(html.includes('<!doctype html>'));
  assert.ok(html.includes('@page {\n      margin: 0;'));
  assert.ok(!html.includes('size: 80mm auto'), 'No debe incluir la regla inválida size: 80mm auto');
  assert.ok(html.includes('width: 70mm !important;'));
  assert.ok(html.includes('max-width: 70mm !important;'));
  assert.ok(html.includes('margin: 0 !important;'));
  assert.ok(html.includes('FACTURA #101'));
  assert.ok(html.includes('<title>Factura &lt;POS&gt; &amp; Cobro</title>'));
  assert.ok(html.includes('img.receipt-logo-img[data-logo-size="grande"]'));
  assert.ok(html.includes('.border-dashed, .border-dotted { border-width: 0; border-color: #000000; }'));
  assert.ok(html.includes('.shrink-0 { flex-shrink: 0; white-space: nowrap; }'));
});

test('buildThermalPrintDocumentHtml calibra correctamente tirillas de 58mm a 46mm útiles', () => {
  const html = buildThermalPrintDocumentHtml({
    ticketHtml: '<div class="colmena-printable-ticket"><div>COMANDA #5</div></div>',
    paperWidth: '58mm',
  });

  assert.ok(html.includes('width: 46mm !important;'));
  assert.ok(html.includes('data-paper-width="58mm"'));
  assert.ok(html.includes('COMANDA #5'));
});
