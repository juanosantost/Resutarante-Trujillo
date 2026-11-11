import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import { extractObjectsFromSheetMatrix } from '../../utils/productUtils';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  X,
  Loader2,
} from 'lucide-react';

interface ImportSummary {
  fileName: string;
  createdCount: number;
  createdCategoriesCount: number;
  skippedDuplicates: string[];
  skippedEmpty: number;
}

export const ProductExcelImportPanel: React.FC = () => {
  const { importProductsFromExcel, actionLoading } = useRestaurant();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastSummary, setLastSummary] = useState<ImportSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDownloadTemplate = () => {
    try {
      const sampleData = [
        {
          'Categoría': 'Carnes y Parrilla',
          'Plato o producto': 'Churrasco Especial 300g',
          'Precio (COP)': 38000,
          'Estado del precio': 'Definido',
          'Descripción / ingredientes': 'Corte de res a la parrilla acompañado de papa al vapor, ensalada fresca y arepa.',
        },
        {
          'Categoría': 'Bebidas Naturales',
          'Plato o producto': 'Limonada Cerezada',
          'Precio (COP)': 12000,
          'Estado del precio': 'Definido',
          'Descripción / ingredientes': 'Limón natural, cerezas en almíbar y hielo frappé.',
        },
      ];

      const worksheet = XLSX.utils.json_to_sheet(sampleData, {
        header: [
          'Categoría',
          'Plato o producto',
          'Precio (COP)',
          'Estado del precio',
          'Descripción / ingredientes',
        ],
      });

      worksheet['!cols'] = [
        { wch: 24 },
        { wch: 32 },
        { wch: 16 },
        { wch: 18 },
        { wch: 55 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');
      XLSX.writeFile(workbook, 'Plantilla_Productos_Colmena.xlsx');
      showToast('Plantilla de Excel descargada correctamente', 'info');
    } catch (err) {
      console.error('Error generating template:', err);
      showToast('No se pudo generar la plantilla de Excel', 'error');
    }
  };

  const processExcelFile = async (file: File) => {
    setErrorMessage(null);
    setLastSummary(null);
    setIsProcessing(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('El archivo Excel no contiene hojas válidas.');
      }

      let allExtractedRows: Array<Record<string, unknown>> = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          defval: '',
        });
        const rows = extractObjectsFromSheetMatrix(matrix);
        if (rows.length > 0) {
          allExtractedRows = allExtractedRows.concat(rows);
        }
      }

      if (allExtractedRows.length === 0) {
        throw new Error(
          'No se encontraron filas con datos bajo los encabezados esperados (Categoría, Plato o producto, Precio (COP), Estado del precio, Descripción / ingredientes).'
        );
      }

      const result = await importProductsFromExcel(allExtractedRows);

      setLastSummary({
        fileName: file.name,
        ...result,
      });

      if (result.createdCount > 0) {
        showToast(
          `Se agregaron ${result.createdCount} producto(s) automáticamente${
            result.skippedDuplicates.length > 0
              ? ` (${result.skippedDuplicates.length} duplicado(s) omitido(s))`
              : ''
          }`,
          'success'
        );
      } else if (result.skippedDuplicates.length > 0) {
        showToast(
          `No se agregaron productos nuevos: los ${result.skippedDuplicates.length} plato(s) del archivo ya existen en el catálogo.`,
          'warning'
        );
      } else {
        showToast('No se encontraron productos válidos para importar.', 'warning');
      }
    } catch (err: any) {
      console.error('Error processing Excel file:', err);
      const msg = err?.message || 'Error al procesar el archivo de Excel.';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processExcelFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isProcessing || actionLoading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processExcelFile(file);
    }
  };

  return (
    <div className="rounded-3xl bg-[#181818] border border-[#B77900]/40 p-5 shadow-xl space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-950/80 border border-emerald-600/50 text-emerald-400 flex items-center justify-center shrink-0 shadow-md">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-[#FFFDF5]">
                Importar Productos desde Excel
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-700/50 text-[10px] font-bold uppercase tracking-wider">
                Carga Automática · Sin Duplicados
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Sube tu archivo <strong className="text-zinc-200">.xlsx, .xls o .csv</strong> con los encabezados requeridos. Al seleccionarlo se cargarán automáticamente todos los platos y se omitirán los que ya existan con el mismo nombre.
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase mr-1">
                Encabezados:
              </span>
              {[
                'Categoría',
                'Plato o producto',
                'Precio (COP)',
                'Estado del precio',
                'Descripción / ingredientes',
              ].map((header) => (
                <span
                  key={header}
                  className="px-2 py-0.5 rounded-md bg-[#242424] border border-[#383838] text-[#D6A21A] text-[11px] font-mono font-bold"
                >
                  {header}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={isProcessing || actionLoading}
            className="px-3.5 py-2.5 rounded-xl bg-[#242424] hover:bg-[#2f2f2f] border border-zinc-700 text-zinc-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-[#D6A21A]" />
            <span>Descargar Plantilla</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing || actionLoading}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 text-white text-xs font-black transition-all shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Importando Productos...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Cargar Archivo Excel</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Zona Drag & Drop */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (!isProcessing && !actionLoading) {
            fileInputRef.current?.click();
          }
        }}
        className={`rounded-2xl border-2 border-dashed p-4 text-center transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-3 ${
          isDragging
            ? 'border-emerald-400 bg-emerald-950/30'
            : 'border-[#383838] hover:border-[#D6A21A]/60 bg-[#141414]'
        }`}
      >
        <Upload
          className={`w-5 h-5 ${
            isDragging ? 'text-emerald-400' : 'text-[#D6A21A]'
          }`}
        />
        <div className="text-xs text-zinc-300">
          {isProcessing ? (
            <span className="font-bold text-emerald-400">
              Procesando hoja de cálculo y registrando productos en el catálogo...
            </span>
          ) : (
            <>
              <span className="font-bold text-[#FFFDF5]">
                Haz clic aquí o arrastra tu archivo Excel (.xlsx, .xls, .csv)
              </span>{' '}
              <span className="text-zinc-400">
                — Los productos nuevos se agregarán de inmediato y los nombres repetidos se ignorarán automáticamente.
              </span>
            </>
          )}
        </div>
      </div>

      {/* Mensaje de error si ocurre */}
      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-red-950/50 border border-red-800/70 text-red-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Resumen de última importación */}
      {lastSummary && (
        <div className="p-4 rounded-2xl bg-[#141414] border border-emerald-700/50 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-black text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Archivo procesado: <span className="text-white">{lastSummary.fileName}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLastSummary(null)}
              className="text-zinc-400 hover:text-white text-xs cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 flex items-center justify-between">
              <span className="text-zinc-300">Productos agregados:</span>
              <span className="font-black text-emerald-400 text-sm">
                +{lastSummary.createdCount}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#242424] border border-[#383838] flex items-center justify-between">
              <span className="text-zinc-300">Categorías nuevas creadas:</span>
              <span className="font-black text-[#D6A21A] text-sm">
                +{lastSummary.createdCategoriesCount}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 flex items-center justify-between">
              <span className="text-zinc-300">Omitidos (mismo nombre):</span>
              <span className="font-black text-amber-400 text-sm">
                {lastSummary.skippedDuplicates.length}
              </span>
            </div>
          </div>

          {lastSummary.skippedDuplicates.length > 0 && (
            <div className="text-[11px] text-amber-300/90 bg-amber-950/20 border border-amber-800/30 rounded-xl p-2.5">
              <span className="font-bold">Platos no tenidos en cuenta por nombre repetido: </span>
              <span className="text-zinc-300">
                {lastSummary.skippedDuplicates.slice(0, 15).join(', ')}
                {lastSummary.skippedDuplicates.length > 15
                  ? ` y ${lastSummary.skippedDuplicates.length - 15} más...`
                  : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
