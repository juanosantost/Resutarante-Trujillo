/**
 * SISTEMA COLMENA - Utilidades de Impresión Térmica POS para Logotipos
 *
 * Resuelve los 3 problemas más frecuentes en impresoras térmicas POS (58mm/80mm) al imprimir desde el navegador:
 * 1. Bug del compositor de impresión de Chromium con CSS `filter: contrast(...)` que deja la imagen en blanco.
 * 2. Drivers térmicos Windows/ESC-POS que descartan o corrompen canales alfa (PNG transparente).
 * 3. Conversión 1-bit monocromática de las impresoras térmicas que blanquea logotipos dorados, claros o a color.
 */

const thermalLogoCache = new Map<string, string>();

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
 * optimizado para impresión térmica POS sobre papel blanco.
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
    // Invertir trazos blancos/claros sobre fondo transparente a tinta oscura nítida
    return Math.max(0, Math.min(255, Math.round(255 * (1 - alpha * 0.95))));
  }

  // Componer sobre fondo blanco puro (#FFFFFF) para eliminar canal alfa
  const cr = r * alpha + 255 * (1 - alpha);
  const cg = g * alpha + 255 * (1 - alpha);
  const cb = b * alpha + 255 * (1 - alpha);

  const luma = 0.299 * cr + 0.587 * cg + 0.114 * cb;
  const chroma = Math.max(cr, cg, cb) - Math.min(cr, cg, cb);

  // Preservar fondo blanco / casi blanco limpio sin recuadros grises
  if (luma >= 242 && chroma < 18) {
    return 255;
  }

  // Profundizar colores de marca (dorado, amarillo, rojo, azul, etc.) para que la cabeza térmica los imprima nítidos
  const effectiveLuma = Math.max(0, luma - chroma * 0.55);
  const normalized = Math.min(1, effectiveLuma / 242);
  const darkened = Math.pow(normalized, 1.45) * 255;

  return Math.max(0, Math.min(255, Math.round(darkened)));
}

/**
 * Prepara una versión opaca (fondo blanco puro, sin transparencia) y de alto contraste térmico
 * de un logotipo, devuelta como Data URL PNG lista para imprimir sin filtros CSS.
 * Si por CORS o entorno no puede procesarse en Canvas, devuelve el `src` original de forma segura.
 */
export async function prepareThermalPrintLogo(src: string): Promise<string> {
  const cleanSrc = (src || '').trim();
  if (!cleanSrc) return '';

  const cached = thermalLogoCache.get(cleanSrc);
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

        // Limitar resolución máxima razonable para impresión térmica 203 DPI (~576px en 80mm)
        const maxDim = 480;
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

        ctx.clearRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = imageData.data;
        const isLightOnTransparent = detectLightOnTransparentLogo(pixels);

        for (let i = 0; i < pixels.length; i += 4) {
          const v = computeThermalPixelValue(
            pixels[i],
            pixels[i + 1],
            pixels[i + 2],
            pixels[i + 3],
            isLightOnTransparent
          );
          pixels[i] = v;
          pixels[i + 1] = v;
          pixels[i + 2] = v;
          pixels[i + 3] = 255; // 100% opaco: sin canal alfa para impresoras térmicas
        }

        ctx.putImageData(imageData, 0, 0);
        const thermalDataUrl = canvas.toDataURL('image/png');

        // Pre-decodificar en caché del navegador para impresión instantánea (incluso con Ctrl+P)
        const preloader = new Image();
        preloader.src = thermalDataUrl;
        if (typeof preloader.decode === 'function') {
          preloader.decode().catch(() => {});
        }

        // Evitar crecimiento ilimitado de caché
        if (thermalLogoCache.size > 20) {
          thermalLogoCache.clear();
        }
        thermalLogoCache.set(cleanSrc, thermalDataUrl);
        resolve(thermalDataUrl);
      } catch {
        // Fallback silencioso si la imagen externa bloquea lectura por CORS
        resolve(cleanSrc);
      }
    };

    img.src = cleanSrc;
  });
}

/**
 * Espera a que todas las imágenes dentro de la tirilla imprimible estén cargadas y decodificadas
 * antes de disparar `window.print()`, evitando que el logotipo falte por carrera de renderizado.
 */
export async function waitForPrintableImages(
  containerSelector: string = '.colmena-printable-ticket',
  timeoutMs: number = 1200
): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const container = document.querySelector(containerSelector);
  const images = container
    ? Array.from(container.querySelectorAll<HTMLImageElement>('img'))
    : Array.from(document.querySelectorAll<HTMLImageElement>('.colmena-printable-ticket img'));

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

  // Esperar 2 frames de pintura para garantizar layout y bitmap listos antes del spooler de impresión
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

/**
 * Asegura la decodificación completa de imágenes/logotipos de la tirilla,
 * restablece el scroll superior para no recortar el encabezado y ejecuta `window.print()`.
 */
export async function printPosTicket(
  containerSelector: string = '.colmena-printable-ticket'
): Promise<void> {
  if (typeof document !== 'undefined') {
    const ticketEl = document.querySelector(containerSelector);
    let el: HTMLElement | null = ticketEl as HTMLElement | null;
    while (el) {
      if (el.scrollTop > 0) {
        el.scrollTop = 0;
      }
      el = el.parentElement;
    }
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }
  await waitForPrintableImages(containerSelector);
  window.print();
}
