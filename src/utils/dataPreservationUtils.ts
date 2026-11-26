import { Branch, BranchPrintConfig, ColmenaUser, ModifierGroup, ReceiptConfig } from '../types';

export interface FixedCategoryMeta {
  id: string;
  name: string;
  defaultDiscount: number;
  description: string;
}

/**
 * Determina si es seguro ejecutar una operación de siembra (seed) a partir de un snapshot.
 * Nunca se debe sembrar desde caché local ni cuando el snapshot aún tiene escrituras pendientes.
 */
export function shouldSeedFromSnapshot(params: {
  isEmpty: boolean;
  fromCache: boolean;
  hasPendingWrites?: boolean;
}): boolean {
  if (!params.isEmpty) return false;
  if (params.fromCache) return false;
  if (params.hasPendingWrites) return false;
  return true;
}

/**
 * Compuerta permanente de protección de datos reales:
 * La siembra inicial de datos de fábrica SOLO se permite si el servidor está accesible,
 * NO existe la marca `system_settings/db_initialized`, y TODAS las colecciones base
 * (`branches`, `users`, `products`, `orders`) están completamente vacías en el servidor.
 *
 * Una vez que la base de datos contiene cualquier dato real, NUNCA vuelve a sembrar ni
 * reinyectar valores de fábrica aunque el administrador elimine registros de prueba.
 */
export function shouldRunInitialDatabaseSeed(params: {
  serverReachable: boolean;
  markerExists: boolean;
  existingCoreCounts: {
    branches: number;
    users: number;
    products: number;
    orders: number;
  };
}): boolean {
  if (!params.serverReachable) return false;
  if (params.markerExists) return false;
  const { branches, users, products, orders } = params.existingCoreCounts;
  if (branches > 0 || users > 0 || products > 0 || orders > 0) {
    return false;
  }
  return true;
}

/**
 * Lee un documento de sucursal desde Firestore conservando intactos todos los datos reales
 * guardados por el usuario (nombre, NIT, dirección, teléfono, ciudad, logo, facturación e impresión),
 * sin sobrescribir ni reemplazar cadenas por valores de fábrica.
 */
export function preserveBranchDocumentFromFirestore(
  raw: Record<string, any>,
  id: string,
  defaults: {
    receiptConfig: ReceiptConfig;
    printConfig: BranchPrintConfig;
  }
): Branch {
  return {
    ...raw,
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Sede Principal',
    nit: typeof raw.nit === 'string' ? raw.nit : '',
    address: typeof raw.address === 'string' ? raw.address : '',
    phone: typeof raw.phone === 'string' ? raw.phone : '',
    city: typeof raw.city === 'string' ? raw.city : '',
    logoUrl: raw.logoUrl || undefined,
    notes: raw.notes || '',
    taxRate:
      raw.taxRate !== undefined
        ? Number(raw.taxRate)
        : raw.receiptConfig?.showTax === false
        ? 0
        : 0.08,
    isActive: raw.isActive ?? true,
    status: (raw.isActive ?? true) ? 'activa' : 'inactiva',
    receiptConfig: raw.receiptConfig || {
      ...defaults.receiptConfig,
    },
    printConfig: raw.printConfig || defaults.printConfig,
    createdAt: raw.createdAt || '',
  };
}

/**
 * Normaliza los grupos del Menú del Día para el modal de configuración sin reinyectar
 * opciones por defecto cuando el producto ya tiene grupos configurados por el usuario.
 *
 * - Si `existingGroups` es `undefined` (producto nunca configurado), usa `fallbackGroups`.
 * - Si `existingGroups` es un arreglo (incluso si algún grupo quedó vacío a propósito),
 *   respeta estrictamente las opciones guardadas por el usuario.
 */
export function normalizeDailyMenuGroupsForModal(
  existingGroups: ModifierGroup[] | undefined,
  fixedCategoryMeta: FixedCategoryMeta[],
  fallbackGroups: ModifierGroup[]
): ModifierGroup[] {
  const hasSavedGroups = Array.isArray(existingGroups);
  const sourceGroups = hasSavedGroups ? existingGroups : fallbackGroups;

  return fixedCategoryMeta.map((meta, index) => {
    const found =
      sourceGroups.find(
        (g) => g.id === meta.id || g.name.toLowerCase() === meta.name.toLowerCase()
      ) || (!hasSavedGroups ? fallbackGroups.find((g) => g.id === meta.id) : undefined);

    return {
      id: meta.id,
      name: meta.name,
      description: found?.description || meta.description,
      selectionType: 'single',
      minSelections: 0,
      maxSelections: 1,
      isRequired: false,
      isActive: true,
      order: index + 1,
      noSelectionDiscount:
        typeof found?.noSelectionDiscount === 'number'
          ? found.noSelectionDiscount
          : meta.defaultDiscount,
      options: Array.isArray(found?.options)
        ? found.options.map((o) => ({ ...o }))
        : [],
    };
  });
}

/**
 * Sincroniza el usuario en sesión (ej. restaurado desde localStorage) con el listado real
 * de usuarios proveniente de Firestore para evitar que persistan datos obsoletos o por defecto.
 */
export function reconcileSessionUserWithFirestore(
  sessionUser: ColmenaUser | null,
  firestoreUsers: ColmenaUser[]
): ColmenaUser | null {
  if (!sessionUser || firestoreUsers.length === 0) return sessionUser;

  const sessionEmail = (sessionUser.email || '').toLowerCase().trim();
  const sessionDoc = (sessionUser.documentNumber || '').trim();

  const matched =
    firestoreUsers.find((u) => u.id === sessionUser.id) ||
    (sessionEmail
      ? firestoreUsers.find((u) => (u.email || '').toLowerCase().trim() === sessionEmail)
      : undefined) ||
    (sessionDoc
      ? firestoreUsers.find((u) => (u.documentNumber || '').trim() === sessionDoc)
      : undefined);

  return matched || sessionUser;
}

/**
 * Genera un resumen detallado de auditoría para los cambios del Menú del Día,
 * registrando las opciones activas por categoría para trazabilidad completa.
 */
export function buildDailyMenuAuditSummary(params: {
  name: string;
  price: number;
  isVisible: boolean;
  featureGroups: ModifierGroup[];
}): string {
  const groupSummaries = params.featureGroups
    .map((g) => {
      const hiddenTag = g.isActive === false ? ' [OCULTA]' : '';
      const activeNames = (g.options || [])
        .filter((o) => o.isActive !== false)
        .map((o) =>
          o.priceSurcharge
            ? `${o.name} (+$${o.priceSurcharge.toLocaleString('es-CO')})`
            : o.name
        );
      return `${g.name}${hiddenTag}: ${activeNames.length > 0 ? activeNames.join(', ') : 'Sin opciones'}`;
    })
    .join(' | ');

  return `Menú del día "${params.name}" actualizado: Precio $${params.price.toLocaleString('es-CO')} COP, Visible: ${
    params.isVisible ? 'SÍ' : 'NO'
  }, ${params.featureGroups.length} categorías [${groupSummaries}]`;
}
