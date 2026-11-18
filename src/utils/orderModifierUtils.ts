import { SelectedModifierDetail, OrderItem } from '../types';

/**
 * Identifica si un grupo o modificador corresponde a un acompañamiento de menú
 */
export function isAccompanimentModifier(mod: SelectedModifierDetail): boolean {
  const gName = (mod.groupName || '').toLowerCase().trim();
  const gId = (mod.groupId || '').toLowerCase().trim();
  const oName = (mod.optionName || '').toLowerCase().trim();

  return (
    gName.includes('acompañamiento') ||
    gName.includes('acomp') ||
    gId.includes('acomp') ||
    oName.startsWith('acompañamiento') ||
    oName.startsWith('acomp')
  );
}

/**
 * Limpia el nombre del modificador eliminando cualquier prefijo de categoría o elemento
 * Ej: "Sopa: Sopa de verduras" -> "Sopa de verduras"
 * Ej: "Carne: Carne asada" -> "Carne asada"
 * Ej: "Principio: Frijoles" -> "Frijoles"
 * Ej: "Acompañamiento 1: Arroz con coco" -> "Arroz con coco"
 * Ej: "Bebida / Sobremesa: Jugo natural" -> "Jugo natural"
 */
export function getCleanModifierOptionName(mod: SelectedModifierDetail): string {
  let name = mod.optionName || (mod as any).name || '';
  if (!name) return '';

  // Si contiene prefijo coincidente con groupName (ej: "Carne: Carne asada" o "Sopa: Sopa de...")
  if (mod.groupName && name.toLowerCase().startsWith(`${mod.groupName.toLowerCase()}:`)) {
    name = name.substring(mod.groupName.length + 1).trim();
  }

  // Remover prefijos comunes de categorías del menú del día
  name = name.replace(
    /^(sopa|principio|carne|proteína|acompañamiento\s*\d*|acomp\s*\d*|guarnición\s*\d*|bebida\s*\/\s*sobremesa|bebida|sobremesa):\s*/i,
    ''
  );

  return name.trim();
}

/**
 * Nombres y patrones estándar de los acompañamientos por defecto del Menú del Día:
 * - Acompañamiento 1 por defecto: Arroz Blanco
 * - Acompañamiento 2 por defecto: Tajadas de Maduro (o Tajadas)
 * - Acompañamiento 3 por defecto: Ensalada Fresca del Día (o Ensalada Fresca)
 */
export function isDefaultAccompanimentOption(mod: SelectedModifierDetail): boolean {
  // 1. Si explícitamente viene marcado con isDefault desde el configurador
  if (mod.isDefault === true) {
    return true;
  }
  if (mod.isDefault === false) {
    return false;
  }

  // 2. Si no tiene bandera explícita (pedidos existentes o cargados anteriormente), verificar por ID u opción conocida
  const optId = (mod.optionId || '').toLowerCase();
  if (
    optId === 'opt-ac1-arroz-blanco' ||
    optId === 'opt-ac2-maduro' ||
    optId === 'opt-ac3-ensalada'
  ) {
    return true;
  }

  // 3. Verificar por texto limpio de la opción
  const cleanName = getCleanModifierOptionName(mod).toLowerCase();
  const isAcomp = isAccompanimentModifier(mod);
  if (!isAcomp) return false;

  const standardDefaultNames = [
    'arroz blanco',
    'tajadas de maduro',
    'tajadas',
    'ensalada fresca del día',
    'ensalada fresca',
    'ensalada del día',
  ];

  return standardDefaultNames.some((dName) => cleanName === dName || cleanName.startsWith(dName));
}

/**
 * Obtiene la lista de modificadores visibles para un ítem de pedido:
 * 1. Oculta los acompañamientos que sean los que tiene por defecto.
 * 2. Muestra los acompañamientos ÚNICAMENTE cuando hayan sido cambiados.
 * 3. Quita los nombres de categoría (Sopa, Carne, Principio, Acompañamiento #).
 */
export function getVisibleOrderModifiers(
  modifiers?: SelectedModifierDetail[]
): { cleanName: string; detail: SelectedModifierDetail }[] {
  if (!modifiers || modifiers.length === 0) return [];

  const results: { cleanName: string; detail: SelectedModifierDetail }[] = [];

  for (const mod of modifiers) {
    // Si es un acompañamiento y es el que tiene por defecto, NO mostrarlo
    if (isAccompanimentModifier(mod) && isDefaultAccompanimentOption(mod)) {
      continue;
    }

    const clean = getCleanModifierOptionName(mod);
    if (!clean) continue;

    results.push({
      cleanName: clean,
      detail: mod,
    });
  }

  return results;
}

/**
 * Identifica si un modificador corresponde a la bebida / sobremesa del Menú del Día.
 */
export function isDailyMenuDrinkModifier(mod: SelectedModifierDetail): boolean {
  const gId = (mod.groupId || '').toLowerCase().trim();
  const gName = (mod.groupName || '').toLowerCase().trim();
  const optId = (mod.optionId || '').toLowerCase().trim();
  const oName = (mod.optionName || '').toLowerCase().trim();

  return (
    gId === 'grp-almuerzo-bebida' ||
    gId.includes('almuerzo-bebida') ||
    gId.includes('sobremesa') ||
    gId.includes('bebida') ||
    optId.startsWith('opt-beb-') ||
    optId === 'none-grp-almuerzo-bebida' ||
    gName.includes('bebida') ||
    gName.includes('sobremesa') ||
    /^(sin\s+)?(bebida|sobremesa)\b/i.test(oName)
  );
}

/**
 * Determina si una línea de pedido corresponde al Menú del Día.
 */
export function isDailyMenuOrderItem(
  item: Pick<OrderItem, 'menuItemId' | 'name' | 'selectedModifiers'>
): boolean {
  if (item.menuItemId === 'prod-almuerzo-del-dia') {
    return true;
  }

  const normalizedName = (item.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (
    normalizedName.includes('menu del dia') ||
    normalizedName.includes('almuerzo del dia')
  ) {
    return true;
  }

  return Boolean(
    item.selectedModifiers?.some((mod) =>
      (mod.groupId || '').toLowerCase().startsWith('grp-almuerzo-')
    )
  );
}

/**
 * Obtiene la lista de modificadores visibles para un ítem en el ticket POS de cocina:
 * - Aplica las reglas estándar de getVisibleOrderModifiers.
 * - Oculta la bebida / sobremesa seleccionada en el Menú del Día.
 */
export function getKitchenPosOrderModifiers(
  item: Pick<OrderItem, 'menuItemId' | 'name' | 'selectedModifiers'>
): { cleanName: string; detail: SelectedModifierDetail }[] {
  const visible = getVisibleOrderModifiers(item.selectedModifiers);
  if (visible.length === 0) return [];

  const isDaily = isDailyMenuOrderItem(item);
  return visible.filter(({ detail }) => {
    if (isDaily && isDailyMenuDrinkModifier(detail)) {
      return false;
    }
    const gId = (detail.groupId || '').toLowerCase().trim();
    if (gId === 'grp-almuerzo-bebida') {
      return false;
    }
    return true;
  });
}

/**
 * Formatea el resumen de modificadores en una sola línea elegante separada por ' · '
 * Ej: "Sopa de verduras · Carne asada · Frijoles" (y el acompañamiento solo si fue cambiado)
 */
export function formatModifiersDisplaySummary(modifiers?: SelectedModifierDetail[]): string {
  const visible = getVisibleOrderModifiers(modifiers);
  if (visible.length === 0) return '';

  return visible
    .map(({ cleanName, detail }) => {
      const qtyStr = detail.quantity && detail.quantity > 1 ? ` (x${detail.quantity})` : '';
      const textStr = detail.textValue ? ` "${detail.textValue}"` : '';
      const surchargeStr =
        detail.priceSurcharge && detail.priceSurcharge > 0
          ? ` (+$${(detail.priceSurcharge * (detail.quantity || 1)).toLocaleString('es-CO')})`
          : '';
      return `${cleanName}${qtyStr}${textStr}${surchargeStr}`;
    })
    .join(' · ');
}

/**
 * Helper para formatear los modificadores de un OrderItem directamente
 */
export function formatOrderItemSummary(item: OrderItem): string {
  return formatModifiersDisplaySummary(item.selectedModifiers);
}
