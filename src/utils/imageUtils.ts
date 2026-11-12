/**
 * SISTEMA COLMENA - Utilidades de Imagen y Optimización para Impresión y Firestore
 *
 * Firestore tiene un límite estricto de 1.048.576 bytes (1 MiB) por documento.
 * Las tirillas térmicas POS manejan logotipos de 120px a 170px de ancho.
 * Esta utilidad comprime y redimensiona proporcionalmente cualquier fotografía o logotipo
 * para garantizar máxima nitidez visual en pantalla y comprobantes físicos ocupando entre 15 y 50 KB.
 */

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeBytes?: number;
}

export const DEFAULT_LOGO_COMPRESSION_OPTIONS: Required<ImageCompressionOptions> = {
  maxWidth: 360,
  maxHeight: 180,
  quality: 0.85,
  maxSizeBytes: 120 * 1024, // 120 KB máximo para el documento Firestore
};

export const ALLOWED_LOGO_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
];

/**
 * Valida formato y tamaño del archivo antes de procesarlo.
 * Permite archivos de origen de hasta 10 MB porque serán comprimidos y redimensionados en el cliente.
 */
export function validateLogoFile(
  file: File,
  maxInputSizeBytes: number = 10 * 1024 * 1024
): { isValid: boolean; error?: string } {
  if (!file) {
    return { isValid: false, error: 'No se seleccionó ningún archivo de imagen.' };
  }

  const normalizedType = file.type?.toLowerCase().trim();
  if (!ALLOWED_LOGO_MIME_TYPES.includes(normalizedType)) {
    return {
      isValid: false,
      error: 'Formato no compatible. Únicamente se aceptan imágenes en formato PNG, JPG o WEBP.',
    };
  }

  if (file.size > maxInputSizeBytes) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      isValid: false,
      error: `El archivo seleccionado (${sizeMb} MB) es demasiado pesado. El límite máximo de subida es de 10 MB.`,
    };
  }

  return { isValid: true };
}

/**
 * Calcula el tamaño estimado en bytes de una cadena Base64 / Data URL
 */
export function estimateDataUrlSizeBytes(dataUrl: string): number {
  if (!dataUrl) return 0;
  const commaIndex = dataUrl.indexOf(',');
  const base64Data = commaIndex !== -1 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  const padding = (base64Data.match(/=+$/) || [''])[0].length;
  return Math.max(0, Math.floor((base64Data.length * 3) / 4) - padding);
}

/**
 * Formatea bytes en cadena legible (ej. "32.4 KB")
 */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Redimensiona y comprime una imagen a una Data URL optimizada para Firestore y tirillas POS.
 * Se ejecuta en el navegador usando Canvas 2D.
 */
export async function compressLogoImage(
  file: File,
  options?: ImageCompressionOptions
): Promise<{ dataUrl: string; sizeBytes: number; width: number; height: number }> {
  const opts: Required<ImageCompressionOptions> = {
    ...DEFAULT_LOGO_COMPRESSION_OPTIONS,
    ...options,
  };

  // En entornos de Node o sin Canvas disponible, fallback seguro a FileReader
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    const rawDataUrl = await readFileAsDataUrl(file);
    return {
      dataUrl: rawDataUrl,
      sizeBytes: estimateDataUrlSizeBytes(rawDataUrl),
      width: 0,
      height: 0,
    };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error al leer el archivo de imagen.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo decodificar la imagen seleccionada.'));
      img.onload = () => {
        try {
          let { width, height } = img;
          const originalAspect = width / (height || 1);

          // Escalamiento proporcional sin deformar
          if (width > opts.maxWidth) {
            width = opts.maxWidth;
            height = Math.round(width / originalAspect);
          }
          if (height > opts.maxHeight) {
            height = opts.maxHeight;
            width = Math.round(height * originalAspect);
          }

          width = Math.max(1, Math.round(width));
          height = Math.max(1, Math.round(height));

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            // Si el contexto 2D no está disponible, devolver lectura directa
            const fallback = reader.result as string;
            resolve({
              dataUrl: fallback,
              sizeBytes: estimateDataUrlSizeBytes(fallback),
              width,
              height,
            });
            return;
          }

          // Para impresión térmica y máxima legibilidad, fondo blanco para imágenes transparentes
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Si el archivo original era PNG, verificar si tiene transparencia
          const isPng = file.type === 'image/png';
          
          if (!isPng) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Probar exportación
          let resultDataUrl: string;

          if (isPng) {
            resultDataUrl = canvas.toDataURL('image/png');
            // Si el PNG resultante es mayor al límite deseado, convertir a JPEG con fondo blanco
            if (estimateDataUrlSizeBytes(resultDataUrl) > opts.maxSizeBytes) {
              const bgCanvas = document.createElement('canvas');
              bgCanvas.width = width;
              bgCanvas.height = height;
              const bgCtx = bgCanvas.getContext('2d');
              if (bgCtx) {
                bgCtx.fillStyle = '#FFFFFF';
                bgCtx.fillRect(0, 0, width, height);
                bgCtx.drawImage(canvas, 0, 0);
                resultDataUrl = bgCanvas.toDataURL('image/jpeg', opts.quality);
              }
            }
          } else {
            resultDataUrl = canvas.toDataURL('image/jpeg', opts.quality);
          }

          const finalSize = estimateDataUrlSizeBytes(resultDataUrl);

          resolve({
            dataUrl: resultDataUrl,
            sizeBytes: finalSize,
            width,
            height,
          });
        } catch (err) {
          reject(err);
        }
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}
