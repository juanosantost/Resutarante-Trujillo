import { ModifierGroup } from '../types';

/**
 * Resuelve los grupos/categorías editables del Menú del Día respetando estrictamente
 * lo guardado por el usuario (incluyendo categorías renombradas, ocultas, agregadas
 * o eliminadas). Solo usa `fallbackGroups` cuando el producto nunca ha tenido
 * `featureGroups` configurados (`existingGroups === undefined`).
 */
export function resolveEditableDailyMenuGroups(
  existingGroups: ModifierGroup[] | undefined,
  fallbackGroups: ModifierGroup[]
): ModifierGroup[] {
  const source = Array.isArray(existingGroups) ? existingGroups : fallbackGroups;

  return source
    .map((group, idx) => ({
      group,
      originalIndex: idx,
      sortOrder: typeof group.order === 'number' ? group.order : idx + 1,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.originalIndex - b.originalIndex)
    .map(({ group }, idx) => ({
      ...group,
      name: typeof group.name === 'string' ? group.name : '',
      description: typeof group.description === 'string' ? group.description : '',
      selectionType: group.selectionType || 'single',
      minSelections: typeof group.minSelections === 'number' ? group.minSelections : 0,
      maxSelections: typeof group.maxSelections === 'number' ? group.maxSelections : 1,
      isRequired: group.isRequired ?? false,
      isActive: group.isActive !== false,
      order: idx + 1,
      noSelectionDiscount: Math.max(
        0,
        Math.round(Number(group.noSelectionDiscount) || 0)
      ),
      options: Array.isArray(group.options)
        ? group.options.map((opt) => ({ ...opt }))
        : [],
    }));
}

/**
 * Actualiza propiedades editables de una categoría específica del Menú del Día.
 */
export function updateDailyMenuCategory(
  groups: ModifierGroup[],
  categoryId: string,
  updates: Partial<
    Pick<ModifierGroup, 'name' | 'description' | 'noSelectionDiscount' | 'isActive'>
  >
): ModifierGroup[] {
  return groups.map((group) => {
    if (group.id !== categoryId) return group;
    return {
      ...group,
      ...updates,
      noSelectionDiscount:
        updates.noSelectionDiscount !== undefined
          ? Math.max(0, Math.round(Number(updates.noSelectionDiscount) || 0))
          : group.noSelectionDiscount,
    };
  });
}

/**
 * Alterna la visibilidad (`isActive`) de una categoría del Menú del Día.
 * Una categoría oculta (`isActive: false`) se conserva en configuración con todas sus opciones,
 * pero no aparece al tomar pedidos ni aplica descuento por omisión.
 */
export function toggleDailyMenuCategoryVisibility(
  groups: ModifierGroup[],
  categoryId: string
): ModifierGroup[] {
  return groups.map((group) => {
    if (group.id !== categoryId) return group;
    const currentlyVisible = group.isActive !== false;
    return {
      ...group,
      isActive: !currentlyVisible,
    };
  });
}

/**
 * Elimina una categoría del Menú del Día, reindexa el orden (`1..N`) y calcula
 * cuál pestaña debe quedar activa a continuación.
 */
export function deleteDailyMenuCategory(
  groups: ModifierGroup[],
  categoryId: string,
  currentActiveTabId: string
): {
  nextGroups: ModifierGroup[];
  nextActiveTabId: string;
  deletedCategory: ModifierGroup | null;
} {
  const targetIndex = groups.findIndex((g) => g.id === categoryId);
  if (targetIndex === -1) {
    return {
      nextGroups: groups,
      nextActiveTabId: currentActiveTabId,
      deletedCategory: null,
    };
  }

  const deletedCategory = groups[targetIndex];
  const nextGroups = groups
    .filter((g) => g.id !== categoryId)
    .map((g, idx) => ({
      ...g,
      order: idx + 1,
    }));

  let nextActiveTabId = currentActiveTabId;
  if (nextGroups.length === 0) {
    nextActiveTabId = '';
  } else if (currentActiveTabId === categoryId) {
    const fallbackIndex = Math.min(targetIndex, nextGroups.length - 1);
    nextActiveTabId = nextGroups[fallbackIndex].id;
  } else if (!nextGroups.some((g) => g.id === currentActiveTabId)) {
    nextActiveTabId = nextGroups[0].id;
  }

  return {
    nextGroups,
    nextActiveTabId,
    deletedCategory,
  };
}

/**
 * Crea y agrega una nueva categoría personalizada al Menú del Día.
 */
export function addDailyMenuCategory(
  groups: ModifierGroup[],
  params: {
    name: string;
    description?: string;
    noSelectionDiscount?: number;
  }
):
  | { ok: true; nextGroups: ModifierGroup[]; createdCategory: ModifierGroup }
  | { ok: false; error: string } {
  const trimmedName = (params.name || '').trim();
  if (!trimmedName) {
    return { ok: false, error: 'Escribe un nombre para la nueva categoría.' };
  }

  const normalizedName = trimmedName.toLowerCase();
  const duplicate = groups.some(
    (g) => (g.name || '').trim().toLowerCase() === normalizedName
  );
  if (duplicate) {
    return {
      ok: false,
      error: `Ya existe una categoría llamada "${trimmedName}".`,
    };
  }

  const createdCategory: ModifierGroup = {
    id: `grp-almuerzo-custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: trimmedName,
    description: (params.description || '').trim(),
    selectionType: 'single',
    minSelections: 0,
    maxSelections: 1,
    isRequired: false,
    isActive: true,
    order: groups.length + 1,
    noSelectionDiscount: Math.max(
      0,
      Math.round(Number(params.noSelectionDiscount) || 0)
    ),
    options: [],
  };

  return {
    ok: true,
    nextGroups: [...groups, createdCategory],
    createdCategory,
  };
}

/**
 * Filtra únicamente las categorías visibles (`isActive !== false`) ordenadas por `order`.
 */
export function getVisibleDailyMenuGroups(groups: ModifierGroup[]): ModifierGroup[] {
  return groups
    .filter((g) => g.isActive !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Valida y sanea todas las categorías antes de persistir el Menú del Día en Firestore.
 */
export function validateDailyMenuCategoriesBeforeSave(
  groups: ModifierGroup[]
):
  | { valid: true; sanitizedGroups: ModifierGroup[] }
  | { valid: false; error: string; invalidCategoryId?: string } {
  const seenNames = new Set<string>();
  const sanitizedGroups: ModifierGroup[] = [];

  for (let i = 0; i < groups.length; i++) {
    const grp = groups[i];
    const cleanName = (grp.name || '').trim();
    if (!cleanName) {
      return {
        valid: false,
        error: 'Todas las categorías del Menú del Día deben tener un nombre.',
        invalidCategoryId: grp.id,
      };
    }

    const key = cleanName.toLowerCase();
    if (seenNames.has(key)) {
      return {
        valid: false,
        error: `Hay categorías repetidas con el nombre "${cleanName}". Usa nombres distintos.`,
        invalidCategoryId: grp.id,
      };
    }
    seenNames.add(key);

    sanitizedGroups.push({
      ...grp,
      name: cleanName,
      description: (grp.description || '').trim(),
      isActive: grp.isActive !== false,
      order: i + 1,
      noSelectionDiscount: Math.max(
        0,
        Math.round(Number(grp.noSelectionDiscount) || 0)
      ),
      options: (grp.options || []).map((opt) => ({
        ...opt,
        name: (opt.name || '').trim() || opt.name,
        priceSurcharge: Math.round(Number(opt.priceSurcharge) || 0),
        isActive: opt.isActive !== false,
      })),
    });
  }

  return { valid: true, sanitizedGroups };
}
