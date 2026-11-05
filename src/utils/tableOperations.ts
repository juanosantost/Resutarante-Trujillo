import { Table, TableStatus, RestaurantArea, PrepStation } from '../types';

/**
 * Calcula los minutos de ocupación transcurridos desde una fecha ISO.
 */
export function calculateOccupancyMinutes(
  occupiedSince: string | null | undefined,
  now: Date = new Date()
): number {
  if (!occupiedSince) return 0;
  const startTime = new Date(occupiedSince).getTime();
  if (isNaN(startTime)) return 0;
  const diffMs = now.getTime() - startTime;
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60));
}

/**
 * Formatea la duración de ocupación para visualización amigable en tarjetas.
 * Ej: "25 min", "1h 10m", "2h 45m"
 */
export function formatOccupancyDuration(
  occupiedSince: string | null | undefined,
  now: Date = new Date()
): string {
  const minutes = calculateOccupancyMinutes(occupiedSince, now);
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

/**
 * Reglas de transición de estados operativos de una mesa.
 * - Libre: Mesa desocupada y limpia, lista para recibir comensales.
 * - Ocupada: Clientes sentados (con o sin cuenta abierta).
 * - Reservada: Apartada para una reserva futura.
 * - Limpieza: Clientes salieron, mesa pendiente de desinfección y alistamiento.
 * - Mantenimiento: Mesa fuera de servicio técnico o dañada.
 */
export function validateTableStatusTransition(
  currentStatus: TableStatus,
  newStatus: TableStatus,
  hasOpenTab: boolean
): { isValid: boolean; error?: string } {
  if (currentStatus === newStatus) {
    return { isValid: true };
  }

  // No se puede pasar a fuera de servicio (mantenimiento) o limpieza si tiene cuenta abierta activa
  if (hasOpenTab && (newStatus === 'mantenimiento' || newStatus === 'limpieza' || newStatus === 'libre')) {
    return {
      isValid: false,
      error: `La mesa tiene una cuenta o comanda activa. Debe cerrar o facturar la cuenta antes de marcarla como ${newStatus}.`,
    };
  }

  // De mantenimiento no se puede pasar a ocupada directamente, debe pasar primero a libre o limpieza
  if (currentStatus === 'mantenimiento' && newStatus === 'ocupada') {
    return {
      isValid: false,
      error: 'Una mesa en mantenimiento debe habilitarse como libre antes de ser ocupada.',
    };
  }

  return { isValid: true };
}

/**
 * Metadata visual estricta Colmena para cada estado operativo.
 */
export function getTableStatusConfig(status: TableStatus): {
  label: string;
  badgeClass: string;
  cardBorder: string;
  cardBg: string;
  accentColor: string;
  description: string;
} {
  switch (status) {
    case 'libre':
      return {
        label: 'Libre',
        badgeClass: 'bg-emerald-950/70 text-emerald-400 border border-emerald-500/40',
        cardBorder: 'border-emerald-700/30 hover:border-emerald-500/60',
        cardBg: 'bg-[#141d17]',
        accentColor: '#10b981',
        description: 'Disponible y lista para asignar comensales',
      };
    case 'ocupada':
      return {
        label: 'Ocupada',
        badgeClass: 'bg-rose-950/70 text-rose-300 border border-rose-500/50',
        cardBorder: 'border-rose-600/40 hover:border-rose-500/80',
        cardBg: 'bg-[#221316]',
        accentColor: '#f43f5e',
        description: 'Mesa con comensales en consumo',
      };
    case 'reservada':
      return {
        label: 'Reservada',
        badgeClass: 'bg-[#291e33] text-purple-300 border border-purple-500/40',
        cardBorder: 'border-purple-600/30 hover:border-purple-500/70',
        cardBg: 'bg-[#1b1522]',
        accentColor: '#a855f7',
        description: 'Mesa separada para clientes agendados',
      };
    case 'limpieza':
      return {
        label: 'Pendiente de Limpieza',
        badgeClass: 'bg-sky-950/70 text-sky-300 border border-sky-500/50',
        cardBorder: 'border-sky-600/40 hover:border-sky-500/80',
        cardBg: 'bg-[#121b24]',
        accentColor: '#0ea5e9',
        description: 'Comensales se retiraron, requiere alistamiento',
      };
    case 'mantenimiento':
      return {
        label: 'Fuera de Servicio',
        badgeClass: 'bg-stone-900 text-stone-400 border border-stone-600/50',
        cardBorder: 'border-stone-700 hover:border-stone-500',
        cardBg: 'bg-[#171717]',
        accentColor: '#78716c',
        description: 'Mesa deshabilitada por daño o reparación',
      };
    case 'cuenta_solicitada':
    default:
      return {
        label: 'Pidiendo Cuenta',
        badgeClass: 'bg-amber-950/70 text-[#D6A21A] border border-[#B77900]/60 animate-pulse',
        cardBorder: 'border-[#B77900]/60 hover:border-[#D6A21A]',
        cardBg: 'bg-[#241d13]',
        accentColor: '#D6A21A',
        description: 'Comensales han solicitado el preconteo o factura',
      };
  }
}

/**
 * Ordena áreas por su campo 'order' ascendente.
 */
export function sortAreasByOrder(areas: RestaurantArea[]): RestaurantArea[] {
  return [...areas].sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Agrupa mesas activas por área, ordenando las mesas por displayOrder.
 */
export function groupTablesByArea(
  tables: Table[],
  areas: RestaurantArea[]
): Array<{ area: RestaurantArea; tables: Table[] }> {
  const sortedAreas = sortAreasByOrder(areas);
  const areaMap = new Map<string, Table[]>();

  for (const area of sortedAreas) {
    areaMap.set(area.id, []);
  }

  const unassigned: Table[] = [];

  for (const table of tables) {
    if (table.areaId && areaMap.has(table.areaId)) {
      areaMap.get(table.areaId)!.push(table);
    } else {
      unassigned.push(table);
    }
  }

  const result: Array<{ area: RestaurantArea; tables: Table[] }> = [];

  for (const area of sortedAreas) {
    const areaTables = areaMap.get(area.id) || [];
    areaTables.sort((a, b) => (a.displayOrder || a.number) - (b.displayOrder || b.number));
    result.push({ area, tables: areaTables });
  }

  if (unassigned.length > 0) {
    unassigned.sort((a, b) => (a.displayOrder || a.number) - (b.displayOrder || b.number));
    result.push({
      area: {
        id: 'unassigned',
        branchId: unassigned[0]?.branchId || '',
        name: 'Otras Mesas / Sin Área',
        order: 999,
        isActive: true,
      },
      tables: unassigned,
    });
  }

  return result;
}

/**
 * Validación de payload para crear/editar Áreas.
 */
export function validateAreaPayload(data: Partial<RestaurantArea>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!data.name || data.name.trim().length < 3) {
    errors.push('El nombre del área o salón debe tener al menos 3 caracteres.');
  }
  if (data.order !== undefined && (isNaN(data.order) || data.order < 0)) {
    errors.push('El orden del área debe ser un número entero positivo.');
  }
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validación de payload para crear/editar Mesas.
 */
export function validateTablePayload(data: Partial<Table>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (data.number === undefined || isNaN(data.number) || data.number <= 0) {
    errors.push('El número de mesa debe ser un número entero mayor a 0.');
  }
  if (!data.areaId || data.areaId.trim().length === 0) {
    errors.push('Debe asignar un área o salón a la mesa.');
  }
  if (data.capacity === undefined || isNaN(data.capacity) || data.capacity < 1) {
    errors.push('La capacidad debe ser de al menos 1 comensal.');
  }
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validación de payload para crear/editar Estaciones Operativas de Cocina.
 */
export function validatePrepStationPayload(data: Partial<PrepStation>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!data.name || data.name.trim().length < 3) {
    errors.push('El nombre de la estación debe tener al menos 3 caracteres.');
  }
  if (!data.code || data.code.trim().length < 2) {
    errors.push('El código identificador debe tener al menos 2 caracteres (ej: COC_CAL).');
  }
  if (data.order !== undefined && (isNaN(data.order) || data.order < 0)) {
    errors.push('El orden de la estación debe ser un número mayor o igual a 0.');
  }
  return {
    isValid: errors.length === 0,
    errors,
  };
}
