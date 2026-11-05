import { ColmenaUser, UserRole } from '../types';

/**
 * Determina si un usuario tiene acceso a una sucursal específica.
 * El rol 'administrador' tiene acceso a todas las sucursales.
 * Otros roles solo a sus sucursales autorizadas.
 */
export function canUserAccessBranch(user: ColmenaUser | null | undefined, branchId: string): boolean {
  if (!user || !user.isActive) return false;
  if (user.role === 'administrador') return true;
  return Array.isArray(user.authorizedBranchIds) && user.authorizedBranchIds.includes(branchId);
}

/**
 * Normaliza cualquier rol a los 3 roles oficiales del Sistema Colmena:
 * - 'administrador': Acceso total.
 * - 'asesor': Acceso al apartado operación.
 * - 'cocinero': Acceso únicamente a la parte de cocina.
 */
export function normalizeUserRole(role: string | undefined): 'administrador' | 'asesor' | 'cocinero' {
  if (!role) return 'asesor';
  const r = role.toLowerCase().trim();
  if (r === 'administrador') return 'administrador';
  if (r === 'cocinero' || r === 'cocina') return 'cocinero';
  return 'asesor';
}

/**
 * Vistas y submódulos que pertenecen al apartado OPERACIÓN.
 */
export const OPERACION_VIEWS = [
  'home',
  'pedidos',
  'mesas',
  'cocina',
  'domicilios',
  'caja',
  'ingresos',
  'otros-ingresos',
];

/**
 * Matriz de acceso estricta para los 3 roles:
 * - Administrador: Acceso total a todos los módulos y opciones.
 * - Asesor: Acceso al apartado OPERACIÓN (inicio, pedidos, mesas, cocina, domicilios, caja, ingresos).
 * - Cocinero: Acceso únicamente a la parte de cocina.
 */
export function canUserAccessModule(role: UserRole | string | undefined, moduleName: string): boolean {
  if (!role) return false;
  const normRole = normalizeUserRole(role);
  if (normRole === 'administrador') {
    return true;
  }
  if (normRole === 'cocinero') {
    return moduleName === 'cocina';
  }
  if (normRole === 'asesor') {
    return OPERACION_VIEWS.includes(moduleName);
  }
  return false;
}

/**
 * Valida un número de documento de identidad en Colombia (C.C., C.E., NIT).
 */
export function validateDocumentNumber(doc: string): boolean {
  if (!doc) return false;
  const clean = doc.trim().replace(/\D/g, '');
  return clean.length >= 5 && clean.length <= 15;
}

/**
 * Valida formato estándar de correo electrónico.
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Determina si el usuario que está ingresando califica como candidato para registrarse
 * como el Primer Administrador de la Colmena (si no hay usuarios registrados aún o si coincide con el correo principal).
 */
export function isFirstAdminCandidate(
  userEmail: string | null | undefined,
  totalUsersCount: number,
  ownerEmail = 'juan.santos.ieci@gmail.com'
): boolean {
  if (totalUsersCount === 0) return true;
  if (userEmail && userEmail.toLowerCase() === ownerEmail.toLowerCase()) return true;
  return false;
}
