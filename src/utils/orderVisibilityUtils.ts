import { Order, UserRole } from '../types';
import { normalizeUserRole } from './auth';

export interface OrderViewerContext {
  id?: string | null;
  email?: string | null;
  fullName?: string | null;
  role?: UserRole | string | null;
}

export type OrderOwnershipFields = Pick<
  Order,
  'waiterId' | 'waiterName' | 'createdByUserId' | 'createdByEmail'
>;

const LEGACY_PLACEHOLDER_IDS = new Set(['', 'usr-staff', 'usr-mesero']);
const GENERIC_PLACEHOLDER_NAMES = new Set([
  '',
  'staff',
  'usuario',
  'mesero',
  'asesor',
  'administrador',
]);

function normalizeText(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

/**
 * Resuelve los metadatos de propietario/creador al crear un nuevo pedido.
 * Siempre prioriza el ID y nombre reales del usuario en sesión para que cada asesor
 * quede asociado inequívocamente a sus propios pedidos.
 */
export function resolveOrderOwnership(
  user: { id?: string; email?: string; fullName?: string } | null | undefined,
  fallbackStaffName: string,
  fallbackRole?: string
): {
  waiterId: string;
  waiterName: string;
  createdByUserId?: string;
  createdByEmail?: string;
} {
  const realId = (user?.id || '').trim();
  const realEmail = (user?.email || '').trim().toLowerCase();
  const realName = (user?.fullName || '').trim() || (fallbackStaffName || '').trim() || 'Staff';

  return {
    waiterId: realId || (fallbackRole === 'mesero' ? 'usr-mesero' : 'usr-staff'),
    waiterName: realName,
    createdByUserId: realId || undefined,
    createdByEmail: realEmail || undefined,
  };
}

/**
 * Determina si un pedido pertenece al usuario indicado.
 * - Si el pedido tiene un ID real de usuario (`createdByUserId` o `waiterId` no genérico),
 *   compara estrictamente por ID.
 * - Si el pedido tiene correo del creador (`createdByEmail`), compara por correo.
 * - Solo para pedidos heredados antiguos sin ID real (`usr-staff` / `usr-mesero`),
 *   hace coincidencia por nombre completo no genérico.
 */
export function isOrderOwnedByUser(
  order: OrderOwnershipFields | null | undefined,
  viewer: OrderViewerContext | null | undefined
): boolean {
  if (!order || !viewer) return false;

  const ownerId = (order.createdByUserId || order.waiterId || '').trim();
  if (ownerId && !LEGACY_PLACEHOLDER_IDS.has(ownerId.toLowerCase())) {
    const viewerId = (viewer.id || '').trim();
    return Boolean(viewerId && viewerId === ownerId);
  }

  const ownerEmail = normalizeText(order.createdByEmail);
  if (ownerEmail) {
    const viewerEmail = normalizeText(viewer.email);
    return Boolean(viewerEmail && viewerEmail === ownerEmail);
  }

  const ownerName = normalizeText(order.waiterName);
  const viewerName = normalizeText(viewer.fullName);
  if (
    ownerName &&
    viewerName &&
    !GENERIC_PLACEHOLDER_NAMES.has(ownerName) &&
    !GENERIC_PLACEHOLDER_NAMES.has(viewerName)
  ) {
    return ownerName === viewerName;
  }

  return false;
}

/**
 * Control de acceso por rol para visibilidad de pedidos:
 * - Administrador: puede ver TODOS los pedidos activos e históricos.
 * - Asesor: SOLO puede ver sus propios pedidos.
 * - Otros roles (ej. cocinero): no acceden al listado comercial de pedidos.
 */
export function canUserViewOrder(
  order: OrderOwnershipFields | null | undefined,
  viewer: OrderViewerContext | null | undefined
): boolean {
  if (!order || !viewer || !viewer.role) return false;
  const normRole = normalizeUserRole(viewer.role);

  if (normRole === 'administrador') {
    return true;
  }

  if (normRole === 'asesor') {
    return isOrderOwnedByUser(order, viewer);
  }

  return false;
}

/**
 * Control de acceso para acciones de gestión sobre un pedido (agregar rondas,
 * anular productos/pedidos, cobrar). Sigue la misma política estricta de propiedad.
 */
export function canUserManageOrder(
  order: OrderOwnershipFields | null | undefined,
  viewer: OrderViewerContext | null | undefined
): boolean {
  return canUserViewOrder(order, viewer);
}

/**
 * Filtra una lista de pedidos según el rol y la identidad del usuario en sesión.
 */
export function filterOrdersForViewer<T extends OrderOwnershipFields>(
  orders: T[],
  viewer: OrderViewerContext | null | undefined
): T[] {
  if (!viewer || !viewer.role) return [];
  const normRole = normalizeUserRole(viewer.role);
  if (normRole === 'administrador') {
    return orders;
  }
  if (normRole === 'asesor') {
    return orders.filter((order) => isOrderOwnedByUser(order, viewer));
  }
  return [];
}
