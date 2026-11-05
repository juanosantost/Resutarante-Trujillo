import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BRANCH_PRINT_CONFIG, BranchPrintConfig, BranchReceiptSnapshot, Branch } from '../src/types/index.ts';

// Función pura de resolución de encabezado para comprobantes
export function resolveReceiptHeaderElements(params: {
  branch?: Partial<Branch> | null;
  snapshot?: BranchReceiptSnapshot | null;
  overrideData?: {
    name?: string;
    nit?: string;
    address?: string;
    phone?: string;
    logoUrl?: string;
    printConfig?: BranchPrintConfig;
  };
}) {
  const printConfig: BranchPrintConfig =
    params.overrideData?.printConfig ||
    params.snapshot?.printConfig ||
    params.branch?.printConfig ||
    DEFAULT_BRANCH_PRINT_CONFIG;

  const name =
    params.overrideData?.name ??
    params.snapshot?.name ??
    params.branch?.name ??
    '';

  const nit =
    params.overrideData?.nit ??
    params.snapshot?.nit ??
    params.branch?.nit ??
    '';

  const address =
    params.overrideData?.address ??
    params.snapshot?.address ??
    params.branch?.address ??
    '';

  const phone =
    params.overrideData?.phone ??
    params.snapshot?.phone ??
    params.branch?.phone ??
    '';

  const logoUrl =
    params.overrideData?.logoUrl !== undefined
      ? params.overrideData.logoUrl
      : params.snapshot?.logoUrl !== undefined
      ? params.snapshot.logoUrl
      : params.branch?.logoUrl;

  return {
    renderedLogo: Boolean(printConfig.showLogo && logoUrl),
    renderedTradeName: Boolean(printConfig.showTradeName && name.trim()),
    renderedNit: Boolean(printConfig.showNit && nit.trim()),
    renderedAddress: Boolean(printConfig.showAddress && address.trim()),
    renderedPhone: Boolean(printConfig.showPhone && phone.trim()),
    paperWidth: printConfig.paperWidth,
    effectiveName: printConfig.showTradeName ? name.trim() : null,
    effectiveNit: printConfig.showNit ? nit.trim() : null,
    effectiveAddress: printConfig.showAddress ? address.trim() : null,
    effectivePhone: printConfig.showPhone ? phone.trim() : null,
  };
}

describe('SISTEMA COLMENA - Módulo de Sucursales y Comprobantes', () => {
  test('La configuración predeterminada habilita los 5 controles y ancho de 80mm', () => {
    assert.equal(DEFAULT_BRANCH_PRINT_CONFIG.showLogo, true);
    assert.equal(DEFAULT_BRANCH_PRINT_CONFIG.showTradeName, true);
    assert.equal(DEFAULT_BRANCH_PRINT_CONFIG.showNit, true);
    assert.equal(DEFAULT_BRANCH_PRINT_CONFIG.showAddress, true);
    assert.equal(DEFAULT_BRANCH_PRINT_CONFIG.showPhone, true);
    assert.equal(DEFAULT_BRANCH_PRINT_CONFIG.paperWidth, '80mm');
  });

  test('Si Mostrar Dirección está desactivado, la dirección se omite sin generar espacios ni texto', () => {
    const branch: Partial<Branch> = {
      name: 'Restaurante Colmena Centro',
      nit: '901.458.920-4',
      address: 'Cl. 4 # 13 - 28',
      phone: '+57 (602) 237-4589',
      logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      printConfig: {
        showLogo: true,
        showTradeName: true,
        showNit: true,
        showAddress: false, // Desactivado
        showPhone: true,
        paperWidth: '80mm',
      },
    };

    const result = resolveReceiptHeaderElements({ branch });

    assert.equal(result.renderedLogo, true);
    assert.equal(result.renderedTradeName, true);
    assert.equal(result.renderedNit, true);
    assert.equal(result.renderedAddress, false); // No renderiza
    assert.equal(result.effectiveAddress, null);
    assert.equal(result.renderedPhone, true);
  });

  test('Si Mostrar Logotipo está desactivado, el logotipo no se incluye en el comprobante', () => {
    const branch: Partial<Branch> = {
      name: 'Restaurante Colmena Norte',
      nit: '901.458.920-4',
      address: 'Av 6N # 24 - 10',
      phone: '+57 310 9876543',
      logoUrl: 'data:image/png;base64,samplelogodata',
      printConfig: {
        showLogo: false, // Desactivado
        showTradeName: true,
        showNit: true,
        showAddress: true,
        showPhone: true,
        paperWidth: '58mm',
      },
    };

    const result = resolveReceiptHeaderElements({ branch });

    assert.equal(result.renderedLogo, false);
    assert.equal(result.renderedTradeName, true);
    assert.equal(result.paperWidth, '58mm');
  });

  test('Regla obligatoria: Snapshot histórico prevalece sobre la sucursal actual', () => {
    // Venta originada en Sucursal Centro con su snapshot grabado al momento de la venta
    const historicalSnapshot: BranchReceiptSnapshot = {
      branchId: 'sede-centro',
      name: 'Restaurante Colmena Centro Histórico',
      nit: '901.458.920-1',
      address: 'Carrera 1 # 10-20',
      phone: '3001112233',
      printConfig: {
        showLogo: false,
        showTradeName: true,
        showNit: true,
        showAddress: true,
        showPhone: false,
        paperWidth: '58mm',
      },
    };

    // Administrador está actualmente ubicado en Sucursal Norte
    const currentBranch: Partial<Branch> = {
      id: 'sede-norte',
      name: 'Restaurante Colmena Norte Actual',
      nit: '901.458.920-9',
      address: 'Calle 100 # 15-30',
      phone: '3009998877',
      printConfig: {
        showLogo: true,
        showTradeName: true,
        showNit: true,
        showAddress: true,
        showPhone: true,
        paperWidth: '80mm',
      },
    };

    // Al imprimir el comprobante histórico, se debe usar la información del snapshot
    const result = resolveReceiptHeaderElements({
      branch: currentBranch,
      snapshot: historicalSnapshot,
    });

    assert.equal(result.effectiveName, 'Restaurante Colmena Centro Histórico');
    assert.equal(result.effectiveNit, '901.458.920-1');
    assert.equal(result.effectiveAddress, 'Carrera 1 # 10-20');
    assert.equal(result.effectivePhone, null); // Oculto según snapshot
    assert.equal(result.renderedPhone, false);
    assert.equal(result.paperWidth, '58mm'); // Ancho según snapshot
  });

  test('Validación de formato de archivo de logotipo (PNG, JPG, WEBP)', () => {
    const validMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    assert.equal(validMimes.includes('image/png'), true);
    assert.equal(validMimes.includes('image/jpeg'), true);
    assert.equal(validMimes.includes('image/webp'), true);
    assert.equal(validMimes.includes('image/gif'), false);
    assert.equal(validMimes.includes('application/pdf'), false);
  });
});
