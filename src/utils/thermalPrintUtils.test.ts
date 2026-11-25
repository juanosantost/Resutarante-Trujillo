import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeThermalPixelValue,
  computeGrayscaleThermalPixel,
  applyAtkinsonDithering,
  applyCleanSilhouetteThreshold,
  processLogoPixelsForMode,
  detectLightOnTransparentLogo,
  getThermalPrintableWidthMm,
  buildThermalPrintDocumentHtml,
  executePrintAndClose,
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

test('computeGrayscaleThermalPixel genera escala de grises equilibrada sin empastar colores ni ensuciar el fondo', () => {
  // Fondo casi blanco y transparente se limpian a blanco puro (255)
  assert.equal(computeGrayscaleThermalPixel(240, 238, 232, 255, false), 255);
  assert.equal(computeGrayscaleThermalPixel(0, 0, 0, 0, false), 255);
  // Negro puro se mantiene en 0
  assert.equal(computeGrayscaleThermalPixel(0, 0, 0, 255, false), 0);
  // Color verde/amarillo vivo permanece en tono gris medio abierto (no aplastado a negro)
  const warmLeaf = computeGrayscaleThermalPixel(140, 175, 70, 255, false);
  assert.ok(warmLeaf > 120 && warmLeaf < 230, `Expected balanced mid-gray, got ${warmLeaf}`);
});

test('applyAtkinsonDithering produce salida estricta 1-bit (0 o 255) sin ensuciar blancos', () => {
  const whiteGrid = new Uint8ClampedArray(16).fill(255);
  const ditheredWhite = applyAtkinsonDithering(whiteGrid, 4, 4);
  assert.ok(Array.from(ditheredWhite).every((v) => v === 255));

  const midGrayGrid = new Uint8ClampedArray(16).fill(140);
  const ditheredMid = applyAtkinsonDithering(midGrayGrid, 4, 4);
  assert.ok(Array.from(ditheredMid).every((v) => v === 0 || v === 255));
  const blacks = Array.from(ditheredMid).filter((v) => v === 0).length;
  const whites = Array.from(ditheredMid).filter((v) => v === 255).length;
  assert.ok(blacks > 0 && whites > 0, `Expected mixed 1-bit pattern, got ${blacks}B/${whites}W`);
});

test('applyCleanSilhouetteThreshold limpia tonos claros y deja solo trazos oscuros', () => {
  const res = applyCleanSilhouetteThreshold(new Uint8ClampedArray([20, 110, 160, 240]), 148);
  assert.deepEqual(Array.from(res), [0, 0, 255, 255]);
});

test('processLogoPixelsForMode convierte colores a escala de grises opaca (R=G=B, A=255)', () => {
  const pixels = new Uint8ClampedArray([
    220, 40, 30, 255,   // rojo
    40, 180, 70, 255,   // verde
    250, 250, 250, 255, // fondo blanco
    0, 0, 0, 0,         // transparente
  ]);
  processLogoPixelsForMode(pixels, 2, 2, 'escala_grises');
  for (let i = 0; i < pixels.length; i += 4) {
    assert.equal(pixels[i], pixels[i + 1]);
    assert.equal(pixels[i + 1], pixels[i + 2]);
    assert.equal(pixels[i + 3], 255);
  }
  // Fondo blanco y transparente deben quedar en 255
  assert.equal(pixels[8], 255);
  assert.equal(pixels[12], 255);
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

test('executePrintAndClose ejecuta impresión primero y cierra el modal al finalizar', async () => {
  const events: string[] = [];
  const lock = { current: false };

  const ran = await executePrintAndClose(
    async () => {
      events.push('print-start');
      await new Promise((r) => setTimeout(r, 5));
      events.push('print-end');
    },
    () => {
      events.push('modal-closed');
    },
    lock
  );

  assert.equal(ran, true);
  assert.equal(lock.current, false);
  assert.deepEqual(events, ['print-start', 'print-end', 'modal-closed']);
});

test('executePrintAndClose bloquea clics duplicados simultáneos y cierra incluso si falla la impresión', async () => {
  const lock = { current: false };
  let printCount = 0;
  let closeCount = 0;

  const first = executePrintAndClose(
    async () => {
      printCount++;
      await new Promise((r) => setTimeout(r, 15));
    },
    () => {
      closeCount++;
    },
    lock
  );

  const duplicate = await executePrintAndClose(
    async () => {
      printCount++;
    },
    () => {
      closeCount++;
    },
    lock
  );

  await first;
  assert.equal(duplicate, false);
  assert.equal(printCount, 1);
  assert.equal(closeCount, 1);
  assert.equal(lock.current, false);

  let closedAfterError = false;
  await assert.rejects(
    () =>
      executePrintAndClose(
        async () => {
          throw new Error('simulated print failure');
        },
        () => {
          closedAfterError = true;
        },
        lock
      ),
    /simulated print failure/
  );
  assert.equal(closedAfterError, true);
  assert.equal(lock.current, false);
});

