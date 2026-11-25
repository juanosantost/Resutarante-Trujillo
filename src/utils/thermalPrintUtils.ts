/**
 * SISTEMA COLMENA - Motor de Impresión Térmica POS (80mm / 58mm)
 * Optimizado para impresoras térmicas ESC/POS como Jaltech JAL-821 (80mm, 576 dots / 72mm útiles),
 * Xprinter, Epson TM-T20, 3nStar y SAT conectadas por USB o red LAN.
 *
 * Resuelve los problemas más frecuentes al imprimir desde Chrome/Edge en impresoras térmicas:
 * 1. Impresión mediante iframe térmico aislado (sin Tailwind v4 oklch, sin modales fixed, sin scroll ni tema claro/oscuro).
 * 2. Ancho útil exacto del cabezal térmico (70mm en rollo de 80mm / JAL-821; 48mm en rollo de 58mm), alineado a la izquierda (margin: 0) para evitar desplazamientos o recortes.
 * 3. Regla @page válida (`margin: 0`) sin `size: 80mm auto` inválido que confunde drivers POS-80 en Windows.
 * 4. Rasterización de logotipos a blanco y negro de alto contraste 100% opacos (sin transparencia ni colores claros que el cabezal 1-bit omita).
 */

import type { PaperWidth, LogoPrintMode } from '../types';

const thermalLogoCache = new Map<string, string>();

const PRINT_IFRAME_ID = 'colmena-thermal-print-iframe';

/**
 * Devuelve el ancho útil imprimible en milímetros según el rollo térmico.
 * - Rollo 80mm (ej. Jaltech JAL-821, 576 dots a 203 DPI = 72mm físicos): 70mm seguros con 1mm de respiro lateral.
 * - Rollo 58mm (384 dots a 203 DPI = 48mm físicos): 46mm seguros.
 */
export function getThermalPrintableWidthMm(paperWidth?: string | null): number {
  return paperWidth === '58mm' ? 46 : 70;
}

/**
 * Detecta si un logotipo está compuesto mayoritariamente por trazos blancos o muy claros
 * sobre un fondo transparente (por ejemplo, logos pensados para fondos oscuros).
 */
export function detectLightOnTransparentLogo(data: Uint8ClampedArray): boolean {
  const totalPixels = Math.floor(data.length / 4);
  if (totalPixels === 0) return false;

  let transparentCount = 0;
  let opaqueCount = 0;
  let opaqueLumaSum = 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 32) {
      transparentCount++;
    } else {
      opaqueCount++;
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      opaqueLumaSum += luma;
    }
  }

  if (opaqueCount === 0) return false;
  const avgOpaqueLuma = opaqueLumaSum / opaqueCount;
  const transparentRatio = transparentCount / totalPixels;

  return transparentRatio > 0.12 && avgOpaqueLuma > 218;
}

/**
 * Convierte un píxel RGBA en un valor de escala de grises (0 = negro puro, 255 = blanco puro)
 * profundizando colores de marca (útil para sellos o logos dorados claros).
 */
export function computeThermalPixelValue(
  r: number,
  g: number,
  b: number,
  a: number,
  isLightOnTransparent: boolean
): number {
  const alpha = a / 255;
  if (alpha < 0.08) {
    return 255;
  }

  if (isLightOnTransparent) {
    return Math.max(0, Math.min(255, Math.round(255 * (1 - alpha * 0.95))));
  }

  const cr = r * alpha + 255 * (1 - alpha);
  const cg = g * alpha + 255 * (1 - alpha);
  const cb = b * alpha + 255 * (1 - alpha);

  const luma = 0.299 * cr + 0.587 * cg + 0.114 * cb;
  const chroma = Math.max(cr, cg, cb) - Math.min(cr, cg, cb);

  if (luma >= 242 && chroma < 18) {
    return 255;
  }

  const effectiveLuma = Math.max(0, luma - chroma * 0.55);
  const normalized = Math.min(1, effectiveLuma / 242);
  const darkened = Math.pow(normalized, 1.45) * 255;

  return Math.max(0, Math.min(255, Math.round(darkened)));
}

/**
 * Convierte un píxel RGBA a escala de grises limpia y equilibrada (Rec. 709) para impresión térmica.
 * A diferencia del oscurecimiento agresivo, evita aplastar detalles/colores en manchas negras densas:
 * - Limpia fondos casi blancos y ruido claro a blanco puro (255).
 * - Conserva gradaciones suaves y aireadas para que letras finas y detalles respiren al imprimir.
 */
export function computeGrayscaleThermalPixel(
  r: number,
  g: number,
  b: number,
  a: number,
  isLightOnTransparent: boolean
): number {
  const alpha = a / 255;
  if (alpha < 0.08) {
    return 255;
  }

  if (isLightOnTransparent) {
    return Math.max(0, Math.min(255, Math.round(255 * (1 - alpha * 0.92))));
  }

  // Componer sobre papel blanco puro (#FFFFFF)
  const cr = r * alpha + 255 * (1 - alpha);
  const cg = g * alpha + 255 * (1 - alpha);
  const cb = b * alpha + 255 * (1 - alpha);

  // Luminancia perceptual Rec. 709 (fiel al ojo humano, sin aplastar rojos/verdes/amarillos en negro sólido)
  const luma = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb;

  // Limpiar fondos claros y artefactos de compresión directamente a blanco de papel
  if (luma >= 230) {
    return 255;
  }

  // Estiramiento suave de rango [12..230] -> [0..255] con curva limpia que preserva claros y nitidez en negros
  const stretched = Math.max(0, Math.min(1, (luma - 12) / (230 - 12)));
  // Curva sigmoidea suave para mejorar legibilidad del texto sin empastar ilustraciones
  const contrasted = stretched < 0.5
    ? 0.5 * Math.pow(stretched * 2, 1.08)
    : 1 - 0.5 * Math.pow((1 - stretched) * 2, 1.15);

  return Math.max(0, Math.min(255, Math.round(contrasted * 255)));
}

/**
 * Aplica tramado Atkinson (1-bit: 0 o 255) sobre un búfer en escala de grises.
 * El algoritmo Atkinson difunde solo 6/8 del error, evitando el sangrado térmico ("empastado")
 * en impresoras POS de 203 DPI como la Jaltech JAL-821 y manteniendo el logotipo abierto y nítido.
 */
export function applyAtkinsonDithering(
  gray: Uint8ClampedArray | Float32Array,
  width: number,
  height: number
): Uint8ClampedArray {
  const buf = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    buf[i] = gray[i];
  }

  const out = new Uint8ClampedArray(gray.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldVal = buf[idx];
      // Mantener blancos limpios sin ruido disperso
      const newVal = oldVal >= 142 ? 255 : 0;
      out[idx] = newVal;
      const err = (oldVal - newVal) / 8;

      if (err === 0) continue;

      if (x + 1 < width) buf[idx + 1] += err;
      if (x + 2 < width) buf[idx + 2] += err;
      if (y + 1 < height) {
        if (x - 1 >= 0) buf[(y + 1) * width + (x - 1)] += err;
        buf[(y + 1) * width + x] += err;
        if (x + 1 < width) buf[(y + 1) * width + (x + 1)] += err;
      }
      if (y + 2 < height) {
        buf[(y + 2) * width + x] += err;
      }
    }
  }

  return out;
}

/**
 * Convierte un búfer en escala de grises a silueta limpia de alto contraste (0 o 255),
 * eliminando adornos grises/claros y dejando únicamente los trazos principales y la tipografía.
 */
export function applyCleanSilhouetteThreshold(
  gray: Uint8ClampedArray,
  threshold: number = 148
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < gray.length; i++) {
    out[i] = gray[i] < threshold ? 0 : 255;
  }
  return out;
}

/**
 * Procesa un arreglo RGBA in-place según el modo térmico elegido:
 * - `escala_grises`: Escala de grises limpia y equilibrada (recomendado para logos con muchos colores/detalles).
 * - `termico_bn`: Blanco y negro térmico 1-bit con tramado fino Atkinson (ideal para JAL-821 203 DPI).
 * - `alto_contraste`: Blanco y negro sólido/silueta limpia que remueve detalles claros.
 * - `original`: Mantiene colores originales compuestos sobre fondo blanco opaco (sin transparencia).
 */
export function processLogoPixelsForMode(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  mode: LogoPrintMode = 'escala_grises'
): void {
  const total = width * height;
  if (total <= 0) return;

  if (mode === 'original') {
    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = pixels[i + 3] / 255;
      pixels[i] = Math.round(pixels[i] * alpha + 255 * (1 - alpha));
      pixels[i + 1] = Math.round(pixels[i + 1] * alpha + 255 * (1 - alpha));
      pixels[i + 2] = Math.round(pixels[i + 2] * alpha + 255 * (1 - alpha));
      pixels[i + 3] = 255;
    }
    return;
  }

  const isLightOnTransparent = detectLightOnTransparentLogo(pixels);
  const gray = new Uint8ClampedArray(total);

  for (let p = 0; p < total; p++) {
    const i = p * 4;
    gray[p] = computeGrayscaleThermalPixel(
      pixels[i],
      pixels[i + 1],
      pixels[i + 2],
      pixels[i + 3],
      isLightOnTransparent
    );
  }

  let finalGray: Uint8ClampedArray = gray;
  if (mode === 'termico_bn') {
    finalGray = applyAtkinsonDithering(gray, width, height);
  } else if (mode === 'alto_contraste') {
    finalGray = applyCleanSilhouetteThreshold(gray, 148);
  }

  for (let p = 0; p < total; p++) {
    const i = p * 4;
    const v = finalGray[p];
    pixels[i] = v;
    pixels[i + 1] = v;
    pixels[i + 2] = v;
    pixels[i + 3] = 255;
  }
}

/**
 * Prepara una versión optimizada (100% opaca sobre papel blanco) del logotipo según el modo elegido
 * (`escala_grises`, `termico_bn`, `alto_contraste` u `original`), devuelta como Data URL PNG.
 */
export async function prepareThermalPrintLogo(
  src: string,
  mode: LogoPrintMode = 'escala_grises'
): Promise<string> {
  const cleanSrc = (src || '').trim();
  if (!cleanSrc) return '';

  const cacheKey = `${mode}::${cleanSrc}`;
  const cached = thermalLogoCache.get(cacheKey);
  if (cached) return cached;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return cleanSrc;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    if (!cleanSrc.startsWith('data:') && !cleanSrc.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }

    img.onerror = () => resolve(cleanSrc);
    img.onload = () => {
      try {
        const naturalWidth = img.naturalWidth || img.width;
        const naturalHeight = img.naturalHeight || img.height;
        if (!naturalWidth || !naturalHeight) {
          resolve(cleanSrc);
          return;
        }

        // Resolución óptima para impresión térmica 203 DPI (cabezal JAL-821 576 dots)
        const maxDim = 384;
        let width = naturalWidth;
        let height = naturalHeight;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.round(width * scale));
          height = Math.max(1, Math.round(height * scale));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(cleanSrc);
          return;
        }

        // Pintar fondo blanco sólido antes de dibujar para eliminar transparencia
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        processLogoPixelsForMode(imageData.data, width, height, mode);

        ctx.putImageData(imageData, 0, 0);
        const thermalDataUrl = canvas.toDataURL('image/png');

        if (thermalLogoCache.size > 40) {
          thermalLogoCache.clear();
        }
        thermalLogoCache.set(cacheKey, thermalDataUrl);
        resolve(thermalDataUrl);
      } catch {
        resolve(cleanSrc);
      }
    };

    img.src = cleanSrc;
  });
}

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface BuildThermalPrintDocumentOptions {
  ticketHtml: string;
  paperWidth?: PaperWidth | string | null;
  title?: string;
}

/**
 * Construye un documento HTML5 100% independiente, liviano y sin conflictos CSS (sin oklch ni Tailwind SPA),
 * calibrado específicamente para impresoras térmicas POS-80 / Jaltech JAL-821 (70mm útiles en 80mm) y 58mm (46mm útiles).
 */
export function buildThermalPrintDocumentHtml({
  ticketHtml,
  paperWidth = '80mm',
  title = 'Ticket POS',
}: BuildThermalPrintDocumentOptions): string {
  const normalizedWidth: PaperWidth = paperWidth === '58mm' ? '58mm' : '80mm';
  const printableWidthMm = getThermalPrintableWidthMm(normalizedWidth);
  const is58mm = normalizedWidth === '58mm';

  const logoPequeW = is58mm ? '28mm' : '38mm';
  const logoPequeH = is58mm ? '14mm' : '16mm';
  const logoMedW = is58mm ? '38mm' : '52mm';
  const logoMedH = is58mm ? '20mm' : '26mm';
  const logoGrandW = is58mm ? '44mm' : '64mm';
  const logoGrandH = is58mm ? '28mm' : '38mm';

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtmlText(title)}</title>
  <style>
    @page {
      margin: 0;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      transition: none !important;
      animation: none !important;
      box-shadow: none !important;
      text-shadow: none !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: ${printableWidthMm}mm !important;
      max-width: ${printableWidthMm}mm !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Courier New', Courier, 'Liberation Mono', monospace !important;
      line-height: 1.3;
      overflow: visible !important;
    }

    .colmena-thermal-sheet {
      display: block !important;
      width: ${printableWidthMm}mm !important;
      max-width: ${printableWidthMm}mm !important;
      margin: 0 !important;
      padding: 1.5mm 1mm 3mm 1mm !important;
      background: #ffffff !important;
      color: #000000 !important;
    }

    .colmena-printable-ticket {
      display: block !important;
      position: static !important;
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      background: #ffffff !important;
      color: #000000 !important;
    }

    .colmena-printable-ticket *:not(img) {
      background: transparent !important;
      background-color: transparent !important;
      color: #000000 !important;
    }

    .hidden, .no-print, .print\\:hidden {
      display: none !important;
    }

    /* Encabezado y logotipo térmico optimizado para cabezal 203 DPI (JAL-821 / POS-80) */
    .branch-receipt-header {
      display: block !important;
      text-align: center !important;
      width: 100% !important;
      color: #000000 !important;
    }

    .receipt-logo-container {
      display: block !important;
      text-align: center !important;
      width: 100% !important;
      margin: 0 auto 1.5mm auto !important;
      padding: 0 !important;
    }

    .receipt-logo-container img.receipt-logo-img,
    img.receipt-logo-img {
      display: block !important;
      margin: 0 auto !important;
      padding: 0 !important;
      width: auto !important;
      height: auto !important;
      max-width: ${logoMedW} !important;
      max-height: ${logoMedH} !important;
      object-fit: contain !important;
      background: #ffffff !important;
      filter: none !important;
      image-rendering: crisp-edges;
    }

    img.receipt-logo-img[data-logo-size="pequeno"] {
      max-width: ${logoPequeW} !important;
      max-height: ${logoPequeH} !important;
    }

    img.receipt-logo-img[data-logo-size="mediano"] {
      max-width: ${logoMedW} !important;
      max-height: ${logoMedH} !important;
    }

    img.receipt-logo-img[data-logo-size="grande"] {
      max-width: ${logoGrandW} !important;
      max-height: ${logoGrandH} !important;
    }

    /* Utilidades puras de maquetación para los tickets POS */
    p, h1, h2, h3, h4, div { margin: 0; }
    .block { display: block; }
    .inline-block { display: inline-block; }
    .flex { display: flex; }
    .inline-flex { display: inline-flex; }
    .flex-col { flex-direction: column; }
    .flex-wrap { flex-wrap: wrap; }
    .flex-1 { flex: 1 1 0%; }
    .items-center { align-items: center; }
    .items-start { align-items: flex-start; }
    .items-baseline { align-items: baseline; }
    .justify-between { justify-content: space-between; }
    .justify-center { justify-content: center; }
    .justify-end { justify-content: flex-end; }
    .justify-start { justify-content: flex-start; }
    .shrink-0 { flex-shrink: 0; white-space: nowrap; }
    .min-w-0 { min-width: 0; }
    .w-full { width: 100%; }
    .max-w-full { max-width: 100%; }
    .mx-auto { margin-left: auto; margin-right: auto; }
    .relative { position: relative; }
    .absolute { position: absolute; }
    .grid { display: grid; }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }

    .gap-1 { gap: 4px; }
    .gap-1\\.5 { gap: 6px; }
    .gap-2 { gap: 8px; }
    .gap-2\\.5 { gap: 10px; }
    .gap-3 { gap: 12px; }
    .gap-x-2 { column-gap: 8px; }

    .space-y-0\\.5 > * + * { margin-top: 2px; }
    .space-y-1 > * + * { margin-top: 4px; }
    .space-y-1\\.5 > * + * { margin-top: 6px; }
    .space-y-2 > * + * { margin-top: 8px; }
    .space-y-2\\.5 > * + * { margin-top: 10px; }
    .space-y-3 > * + * { margin-top: 12px; }
    .space-y-4 > * + * { margin-top: 14px; }

    .p-1 { padding: 4px; }
    .p-1\\.5 { padding: 6px; }
    .p-2 { padding: 8px; }
    .px-0\\.5 { padding-left: 2px; padding-right: 2px; }
    .px-1\\.5 { padding-left: 6px; padding-right: 6px; }
    .px-2 { padding-left: 8px; padding-right: 8px; }
    .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
    .py-1 { padding-top: 4px; padding-bottom: 4px; }
    .py-1\\.5 { padding-top: 6px; padding-bottom: 6px; }
    .py-2 { padding-top: 8px; padding-bottom: 8px; }
    .py-2\\.5 { padding-top: 10px; padding-bottom: 10px; }
    .py-3 { padding-top: 12px; padding-bottom: 12px; }
    .pt-0\\.5 { padding-top: 2px; }
    .pt-1 { padding-top: 4px; }
    .pt-1\\.5 { padding-top: 6px; }
    .pt-2 { padding-top: 8px; }
    .pt-3 { padding-top: 12px; }
    .pb-1 { padding-bottom: 4px; }
    .pb-2 { padding-bottom: 8px; }
    .pb-2\\.5 { padding-bottom: 10px; }
    .pb-3 { padding-bottom: 12px; }
    .pl-2 { padding-left: 8px; }
    .pl-3 { padding-left: 12px; }
    .pr-0\\.5 { padding-right: 2px; }

    .my-1 { margin-top: 4px; margin-bottom: 4px; }
    .my-2 { margin-top: 8px; margin-bottom: 8px; }
    .my-3 { margin-top: 12px; margin-bottom: 12px; }
    .mt-0\\.5 { margin-top: 2px; }
    .mt-1 { margin-top: 4px; }
    .mt-1\\.5 { margin-top: 6px; }
    .mt-2 { margin-top: 8px; }
    .mt-3 { margin-top: 12px; }
    .mb-1 { margin-bottom: 4px; }
    .mb-1\\.5 { margin-bottom: 6px; }
    .mb-2 { margin-bottom: 8px; }
    .mb-3 { margin-bottom: 12px; }

    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .uppercase { text-transform: uppercase; }
    .capitalize { text-transform: capitalize; }
    .italic { font-style: italic; }
    .font-normal { font-weight: 400; }
    .font-medium { font-weight: 500; }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }
    .font-black { font-weight: 900; }
    .font-mono { font-family: 'Courier New', Courier, 'Liberation Mono', monospace; }
    .font-sans { font-family: Arial, Helvetica, sans-serif; }
    .leading-tight { line-height: 1.2; }
    .leading-snug { line-height: 1.3; }
    .tracking-tight { letter-spacing: -0.02em; }
    .tracking-wider { letter-spacing: 0.04em; }
    .tracking-widest { letter-spacing: 0.08em; }
    .break-words { overflow-wrap: break-word; word-break: break-word; }
    .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .text-\\[9px\\] { font-size: 9px; }
    .text-\\[10px\\] { font-size: 10px; }
    .text-\\[11px\\] { font-size: 11px; }
    .text-xs { font-size: 12px; }
    .text-sm { font-size: 14px; }
    .text-base { font-size: 16px; }
    .text-4xl { font-size: 28px; }

    /* Separadores negros nítidos (1px) para impresión térmica 1-bit sin bordes laterales fantasma */
    .border-dashed, .border-dotted { border-width: 0; border-color: #000000; }
    .border { border: 1px solid #000000; }
    .border-t { border-top: 1px solid #000000; }
    .border-b { border-bottom: 1px solid #000000; }
    .border-b-2 { border-bottom: 2px solid #000000; }
    .border-y { border-top: 1px solid #000000; border-bottom: 1px solid #000000; }
    .border.border-dashed { border-style: dashed; }
    .border.border-dotted { border-style: dotted; }
    .border-t.border-dashed, .border-y.border-dashed { border-top-style: dashed; }
    .border-b.border-dashed, .border-y.border-dashed { border-bottom-style: dashed; }
    .border-t.border-dotted, .border-y.border-dotted { border-top-style: dotted; }
    .border-b.border-dotted, .border-y.border-dotted { border-bottom-style: dotted; }
    .last\\:border-b-0:last-child { border-bottom: 0 !important; }

    /* Tamaño controlado de iconos SVG inline */
    svg {
      display: inline-block;
      vertical-align: middle;
      color: #000000 !important;
      stroke: #000000 !important;
    }
    svg.w-3, svg.h-3 { width: 12px; height: 12px; }
    svg.w-3\\.5, svg.h-3\\.5 { width: 14px; height: 14px; }
    svg.w-4, svg.h-4 { width: 16px; height: 16px; }
    svg.w-5, svg.h-5 { width: 18px; height: 18px; }
  </style>
</head>
<body>
  <div class="colmena-thermal-sheet" data-paper-width="${normalizedWidth}">
    ${ticketHtml}
  </div>
</body>
</html>`;
}

/**
 * Espera a que todas las imágenes dentro de un documento o contenedor estén cargadas y decodificadas
 * antes de disparar la impresión, evitando que el logotipo falte por carrera de renderizado.
 */
export async function waitForPrintableImages(
  containerSelector: string = '.colmena-printable-ticket',
  timeoutMs: number = 1500,
  rootDoc: Document = document
): Promise<void> {
  if (typeof window === 'undefined' || !rootDoc) return;

  const container = rootDoc.querySelector(containerSelector);
  const images = container
    ? Array.from(container.querySelectorAll<HTMLImageElement>('img'))
    : Array.from(rootDoc.querySelectorAll<HTMLImageElement>('img'));

  if (images.length > 0) {
    const loadPromises = images.map(
      (img) =>
        new Promise<void>((resolve) => {
          const finish = () => {
            if (typeof img.decode === 'function') {
              img.decode().then(() => resolve()).catch(() => resolve());
            } else {
              resolve();
            }
          };

          if (img.complete && img.naturalWidth > 0) {
            finish();
            return;
          }

          const onDone = () => {
            img.removeEventListener('load', onDone);
            img.removeEventListener('error', onDone);
            finish();
          };
          img.addEventListener('load', onDone, { once: true });
          img.addEventListener('error', onDone, { once: true });
        })
    );

    await Promise.race([
      Promise.all(loadPromises),
      new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
    ]);
  }

  const targetWin = rootDoc.defaultView || window;
  await new Promise<void>((resolve) => {
    targetWin.requestAnimationFrame(() => {
      targetWin.requestAnimationFrame(() => resolve());
    });
  });
}

/**
 * Crea o reutiliza un iframe oculto dedicado a impresión térmica POS.
 * Nunca usa `display: none` (que impide a Chromium decodificar imágenes o imprimir).
 */
function getOrCreatePrintIframe(paperWidth: PaperWidth): HTMLIFrameElement {
  let iframe = document.getElementById(PRINT_IFRAME_ID) as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = PRINT_IFRAME_ID;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    document.body.appendChild(iframe);
  }

  const widthMm = getThermalPrintableWidthMm(paperWidth);
  iframe.style.position = 'fixed';
  iframe.style.top = '0';
  iframe.style.left = '-10000px';
  iframe.style.width = `${widthMm}mm`;
  iframe.style.height = '1px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  return iframe;
}

/**
 * Imprime una tirilla térmica POS (Factura de Cobro, Comanda de Cocina, Abono, Comprobante)
 * mediante un documento térmico aislado optimizado para impresoras ESC/POS (Jaltech JAL-821 80mm, 58mm, etc.).
 * Si el entorno restringe impresión desde iframe, aplica fallback seguro a `window.print()`.
 */
export async function printPosTicket(
  containerSelector: string = '.colmena-printable-ticket'
): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const ticketEl =
    (document.querySelector(containerSelector) as HTMLElement | null) ||
    (document.querySelector('.colmena-printable-ticket') as HTMLElement | null);

  if (!ticketEl) {
    await waitForPrintableImages(containerSelector);
    window.print();
    return;
  }

  // Restablecer scroll del modal por si se usa fallback o Ctrl+P
  let ancestor: HTMLElement | null = ticketEl;
  while (ancestor) {
    if (ancestor.scrollTop > 0) {
      ancestor.scrollTop = 0;
    }
    ancestor = ancestor.parentElement;
  }
  window.scrollTo(0, 0);

  // Asegurar que las imágenes originales estén listas antes de clonar
  await waitForPrintableImages(containerSelector);

  const paperWidthAttr = ticketEl.getAttribute('data-paper-width');
  const paperWidth: PaperWidth = paperWidthAttr === '58mm' ? '58mm' : '80mm';

  try {
    // 1. Clonar únicamente el ticket (sin overlays, ni modales, ni botones print:hidden)
    const clonedTicket = ticketEl.cloneNode(true) as HTMLElement;
    clonedTicket.querySelectorAll('.print\\:hidden, .no-print').forEach((el) => el.remove());

    // 2. Optimizar logotipos según el modo configurado (escala de grises, térmico B/N Atkinson, silueta o original)
    const clonedImages = Array.from(clonedTicket.querySelectorAll<HTMLImageElement>('img'));
    await Promise.all(
      clonedImages.map(async (img) => {
        const src = img.getAttribute('src') || img.src || '';
        if (!src) return;
        const alreadyPrepared = img.getAttribute('data-logo-ready') === '1';
        if (!alreadyPrepared) {
          const modeAttr = img.getAttribute('data-logo-mode') as LogoPrintMode | null;
          const mode: LogoPrintMode =
            modeAttr === 'termico_bn' ||
            modeAttr === 'alto_contraste' ||
            modeAttr === 'original' ||
            modeAttr === 'escala_grises'
              ? modeAttr
              : 'escala_grises';
          const thermalSrc = await prepareThermalPrintLogo(src, mode);
          if (thermalSrc) {
            img.setAttribute('src', thermalSrc);
          }
        }
        img.setAttribute('loading', 'eager');
        img.setAttribute('decoding', 'sync');
        // Limpiar clases de tamaño de pantalla que compitan con las escalas en milímetros del cabezal térmico
        img.className = 'receipt-logo-img';
      })
    );

    const htmlDoc = buildThermalPrintDocumentHtml({
      ticketHtml: clonedTicket.outerHTML,
      paperWidth,
      title: document.title || 'Ticket POS',
    });

    // 3. Montar documento térmico limpio en iframe dedicado y esperar carga/decodificación completa
    const iframe = getOrCreatePrintIframe(paperWidth);
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    const iframeWin = iframe.contentWindow;

    if (!iframeDoc || !iframeWin) {
      window.print();
      return;
    }

    iframeDoc.open();
    iframeDoc.write(htmlDoc);
    iframeDoc.close();

    await waitForPrintableImages('.colmena-printable-ticket', 1800, iframeDoc);

    // 4. Enviar directamente a la impresora térmica desde el documento aislado
    iframeWin.focus();
    iframeWin.print();
  } catch {
    // Fallback seguro si el entorno del navegador impide imprimir un iframe
    window.print();
  }
}

/**
 * Ejecuta la orden de impresión evitando disparos duplicados y cierra el modal
 * automáticamente una vez enviada la impresión (incluso si ocurre fallback o error).
 */
export async function executePrintAndClose(
  printAction: () => Promise<void> | void,
  onClose: () => void,
  lockRef?: { current: boolean }
): Promise<boolean> {
  if (lockRef?.current) return false;
  if (lockRef) lockRef.current = true;
  try {
    await printAction();
  } finally {
    if (lockRef) lockRef.current = false;
    onClose();
  }
  return true;
}

