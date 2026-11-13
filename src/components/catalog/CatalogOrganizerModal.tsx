import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ArrowUp,
  ArrowDown,
  Layers,
  ListOrdered,
  CheckCircle2,
  FolderKanban,
  Package,
  Sparkles,
} from 'lucide-react';
import { Category, Product } from '../../types';
import {
  sortCategories,
  sortProductsWithDailyFirst,
  formatProductPrice,
} from '../../utils/productUtils';

interface CatalogOrganizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  categories: Category[];
  groupByCategory: boolean;
  onToggleGroupByCategory: (grouped: boolean) => void;
  onReorderCategories: (orderedIds: string[]) => Promise<void>;
  onReorderProducts: (
    updates: Array<{ id: string; displayOrder?: number; globalOrder?: number }>
  ) => Promise<void>;
}

export const CatalogOrganizerModal: React.FC<CatalogOrganizerModalProps> = ({
  isOpen,
  onClose,
  products,
  categories,
  groupByCategory,
  onToggleGroupByCategory,
  onReorderCategories,
  onReorderProducts,
}) => {
  const [activeTab, setActiveTab] = useState<'por_categoria' | 'sin_categoria'>(
    groupByCategory ? 'por_categoria' : 'sin_categoria'
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const sortedCategories = useMemo(() => sortCategories(categories), [categories]);

  // Grupos disponibles: categorías existentes + "sin-categoria" si hay productos sin categoría válida
  const categoryGroups = useMemo(() => {
    const validCatIds = new Set(sortedCategories.map((c) => c.id));
    const groups = sortedCategories.map((cat, idx) => ({
      id: cat.id,
      name: cat.name,
      order: cat.order || idx + 1,
      isUncategorized: false,
      products: sortProductsWithDailyFirst(
        products.filter((p) => p.categoryId === cat.id),
        'category'
      ),
    }));

    const uncategorizedProducts = sortProductsWithDailyFirst(
      products.filter((p) => !p.categoryId || !validCatIds.has(p.categoryId)),
      'category'
    );

    if (uncategorizedProducts.length > 0) {
      groups.push({
        id: 'sin-categoria',
        name: 'Sin Categoría Asignada',
        order: groups.length + 1,
        isUncategorized: true,
        products: uncategorizedProducts,
      });
    }

    return groups;
  }, [sortedCategories, products]);

  // Productos en orden global (para cuando no se agrupa por categoría)
  const globalSortedProducts = useMemo(
    () => sortProductsWithDailyFirst(products, 'global'),
    [products]
  );

  useEffect(() => {
    if (isOpen) {
      setActiveTab(groupByCategory ? 'por_categoria' : 'sin_categoria');
      if (!selectedGroupId && categoryGroups.length > 0) {
        setSelectedGroupId(categoryGroups[0].id);
      }
    }
  }, [isOpen, groupByCategory, categoryGroups, selectedGroupId]);

  if (!isOpen) return null;

  const currentGroup =
    categoryGroups.find((g) => g.id === selectedGroupId) || categoryGroups[0] || null;

  const showTempFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2800);
  };

  // Mover categoría a una nueva posición (0-indexed)
  const handleMoveCategoryToIndex = async (fromIndex: number, toIndex: number) => {
    if (
      toIndex < 0 ||
      toIndex >= sortedCategories.length ||
      fromIndex === toIndex ||
      isSaving
    ) {
      return;
    }
    setIsSaving(true);
    try {
      const ids = sortedCategories.map((c) => c.id);
      const [moved] = ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, moved);
      await onReorderCategories(ids);
      showTempFeedback('Orden de categorías actualizado');
    } finally {
      setIsSaving(false);
    }
  };

  // Mover producto dentro de su categoría (o grupo sin categoría) a una nueva posición (0-indexed)
  const handleMoveProductInCategory = async (fromIndex: number, toIndex: number) => {
    if (!currentGroup || isSaving) return;
    const list = [...currentGroup.products];
    if (toIndex < 0 || toIndex >= list.length || fromIndex === toIndex) return;

    setIsSaving(true);
    try {
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);

      const updates = list.map((prod, idx) => ({
        id: prod.id,
        displayOrder: idx + 1,
      }));
      await onReorderProducts(updates);
      showTempFeedback(
        `Posiciones actualizadas en "${currentGroup.name}" (1° a ${list.length}°)`
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Mover producto en la lista global sin categorías a una nueva posición (0-indexed)
  const handleMoveProductGlobal = async (fromIndex: number, toIndex: number) => {
    if (isSaving) return;
    const list = [...globalSortedProducts];
    if (toIndex < 0 || toIndex >= list.length || fromIndex === toIndex) return;

    setIsSaving(true);
    try {
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);

      const updates = list.map((prod, idx) => ({
        id: prod.id,
        globalOrder: idx + 1,
      }));
      await onReorderProducts(updates);
      showTempFeedback('Orden general de productos actualizado');
    } finally {
      setIsSaving(false);
    }
  };

  const getOrdinalLabel = (pos: number) => {
    if (pos === 1) return '1° Primero';
    if (pos === 2) return '2° Segundo';
    if (pos === 3) return '3° Tercero';
    if (pos === 4) return '4° Cuarto';
    if (pos === 5) return '5° Quinto';
    return `${pos}° Posición`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="bg-[#181818] text-[#FFFDF5] px-6 py-4 flex items-center justify-between border-b border-[#B77900]/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#B77900]/20 border border-[#B77900]/40 flex items-center justify-center text-[#D6A21A]">
              <ListOrdered className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                Organizar Orden y Agrupación del Catálogo
              </h2>
              <p className="text-xs text-stone-400">
                Escoge si deseas agrupar por categoría y define qué producto va 1°, 2°, 3°...
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1.5 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector principal: ¿Cómo deseas ver el Catálogo? */}
        <div className="bg-[#FFFDF5] px-6 py-4 border-b border-stone-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-stone-500 block">
                Modo de Visualización en el Catálogo de Productos
              </span>
              <p className="text-xs text-stone-600 mt-0.5">
                Selecciona cómo quieres que se muestren y organicen los productos en la pantalla principal:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full md:w-auto">
              <button
                type="button"
                onClick={() => {
                  onToggleGroupByCategory(true);
                  setActiveTab('por_categoria');
                }}
                className={`px-4 py-2.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  groupByCategory
                    ? 'bg-[#181818] border-[#B77900] text-[#FFFDF5] shadow-md'
                    : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
                }`}
              >
                <Layers
                  className={`w-5 h-5 shrink-0 ${
                    groupByCategory ? 'text-[#D6A21A]' : 'text-stone-400'
                  }`}
                />
                <div>
                  <div className="text-xs font-black flex items-center gap-1.5">
                    <span>Agrupar por Categorías</span>
                    {groupByCategory && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-[#B77900] text-white font-bold">
                        Activo
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-[10px] ${
                      groupByCategory ? 'text-stone-300' : 'text-stone-500'
                    }`}
                  >
                    Muestra bloques por categoría y su orden 1°, 2°, 3°
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleGroupByCategory(false);
                  setActiveTab('sin_categoria');
                }}
                className={`px-4 py-2.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  !groupByCategory
                    ? 'bg-[#181818] border-[#B77900] text-[#FFFDF5] shadow-md'
                    : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
                }`}
              >
                <ListOrdered
                  className={`w-5 h-5 shrink-0 ${
                    !groupByCategory ? 'text-[#D6A21A]' : 'text-stone-400'
                  }`}
                />
                <div>
                  <div className="text-xs font-black flex items-center gap-1.5">
                    <span>Sin Agrupar (Lista General)</span>
                    {!groupByCategory && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-[#B77900] text-white font-bold">
                        Activo
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-[10px] ${
                      !groupByCategory ? 'text-stone-300' : 'text-stone-500'
                    }`}
                  >
                    Todos los productos juntos en orden 1°, 2°, 3°...
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Pestañas de organización */}
          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-stone-200/80">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('por_categoria')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'por_categoria'
                    ? 'bg-[#B77900] text-white shadow-sm'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <FolderKanban className="w-3.5 h-3.5" />
                <span>Organizar Dentro de Categorías (y Sin Categoría)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('sin_categoria')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sin_categoria'
                    ? 'bg-[#B77900] text-white shadow-sm'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Organizar Lista General (Sin Categorías)</span>
              </button>
            </div>

            {feedback && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{feedback}</span>
              </div>
            )}
          </div>
        </div>

        {/* Contenido principal */}
        <div className="flex-1 overflow-y-auto p-6 bg-stone-50">
          {activeTab === 'por_categoria' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Columna Izquierda: Orden de las Categorías */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200 p-4 shadow-sm flex flex-col">
                <div className="mb-3 pb-2 border-b border-stone-100">
                  <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[#181818] text-[#D6A21A] text-xs font-black inline-flex items-center justify-center">
                      1
                    </span>
                    <span>Orden de las Categorías</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Haz clic en una categoría para ordenar sus productos a la derecha, o cambia qué categoría va 1ª, 2ª, 3ª.
                  </p>
                </div>

                <div className="space-y-2 flex-1 overflow-y-auto max-h-[420px] pr-1">
                  {categoryGroups.map((group, index) => {
                    const isSelected = currentGroup?.id === group.id;
                    const catIndex = sortedCategories.findIndex((c) => c.id === group.id);

                    return (
                      <div
                        key={group.id}
                        onClick={() => setSelectedGroupId(group.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-amber-50/90 border-[#B77900] shadow-sm'
                            : 'bg-white border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-[#B77900] text-white'
                                : 'bg-stone-100 text-stone-700'
                            }`}
                          >
                            {index + 1}°
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-stone-900 truncate">
                              {group.name}
                            </p>
                            <span className="text-[11px] text-stone-500">
                              {group.products.length}{' '}
                              {group.products.length === 1 ? 'producto' : 'productos'}
                            </span>
                          </div>
                        </div>

                        {!group.isUncategorized && (
                          <div
                            className="flex items-center gap-1 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <select
                              value={catIndex}
                              disabled={isSaving}
                              onChange={(e) =>
                                handleMoveCategoryToIndex(catIndex, Number(e.target.value))
                              }
                              title="Cambiar posición de la categoría"
                              className="text-[11px] font-bold bg-stone-100 border border-stone-200 rounded-lg px-1.5 py-1 text-stone-700 focus:outline-none focus:border-[#B77900]"
                            >
                              {sortedCategories.map((_, idx) => (
                                <option key={idx} value={idx}>
                                  {idx + 1}°
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={catIndex <= 0 || isSaving}
                              onClick={() => handleMoveCategoryToIndex(catIndex, catIndex - 1)}
                              className="p-1 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 disabled:opacity-30 cursor-pointer"
                              title="Subir categoría"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={
                                catIndex < 0 ||
                                catIndex >= sortedCategories.length - 1 ||
                                isSaving
                              }
                              onClick={() => handleMoveCategoryToIndex(catIndex, catIndex + 1)}
                              className="p-1 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 disabled:opacity-30 cursor-pointer"
                              title="Bajar categoría"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Columna Derecha: Orden de los Productos dentro de la Categoría Seleccionada */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200 p-4 shadow-sm flex flex-col">
                <div className="mb-3 pb-2 border-b border-stone-100 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-[#B77900] text-white text-xs font-black inline-flex items-center justify-center">
                        2
                      </span>
                      <span>
                        Productos en:{' '}
                        <span className="text-[#B77900]">
                          {currentGroup?.name || 'Categoría'}
                        </span>
                      </span>
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Escoge cuál producto va 1° primero, 2° segundo, 3° tercero dentro de este grupo.
                    </p>
                  </div>
                </div>

                {currentGroup && currentGroup.products.length > 0 ? (
                  <div className="space-y-2 flex-1 overflow-y-auto max-h-[420px] pr-1">
                    {currentGroup.products.map((prod, index) => (
                      <div
                        key={prod.id}
                        className="p-3 rounded-xl border border-stone-200 bg-stone-50/60 hover:bg-white hover:border-[#B77900]/50 transition-all flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-8 h-8 rounded-xl bg-[#181818] text-[#D6A21A] text-xs font-black flex items-center justify-center shrink-0 shadow-sm">
                            {index + 1}°
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-bold text-stone-900 truncate">
                                {prod.name}
                              </p>
                              {(prod.isDailyMenu || prod.id === 'prod-almuerzo-del-dia') && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-[#B77900] text-[10px] font-bold">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  Menú del Día
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-stone-500 font-medium">
                              {formatProductPrice(prod.price)} · SKU: {prod.sku}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <select
                            value={index}
                            disabled={isSaving}
                            onChange={(e) =>
                              handleMoveProductInCategory(index, Number(e.target.value))
                            }
                            className="text-xs font-bold bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-stone-800 focus:outline-none focus:border-[#B77900] cursor-pointer"
                          >
                            {currentGroup.products.map((_, idx) => (
                              <option key={idx} value={idx}>
                                {getOrdinalLabel(idx + 1)}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            disabled={index === 0 || isSaving}
                            onClick={() => handleMoveProductInCategory(index, index - 1)}
                            className="p-1.5 rounded-lg bg-white border border-stone-200 text-stone-600 hover:text-stone-900 hover:border-stone-300 disabled:opacity-30 cursor-pointer"
                            title="Subir una posición"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={
                              index === currentGroup.products.length - 1 || isSaving
                            }
                            onClick={() => handleMoveProductInCategory(index, index + 1)}
                            className="p-1.5 rounded-lg bg-white border border-stone-200 text-stone-600 hover:text-stone-900 hover:border-stone-300 disabled:opacity-30 cursor-pointer"
                            title="Bajar una posición"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-stone-400">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-semibold text-stone-600">
                      Esta categoría aún no tiene productos asignados
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Pestaña 2: Orden General cuando NO están agrupados por categoría */
            <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
              <div className="mb-4 pb-3 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-stone-900">
                    Orden General de Productos (Vista Sin Categorías)
                  </h3>
                  <p className="text-xs text-stone-500">
                    Define cuál producto quieres de 1° primero, 2° segundo, 3° tercero... cuando el catálogo se muestra sin agrupar por categorías.
                  </p>
                </div>
                <span className="text-xs font-bold text-stone-600 bg-stone-100 px-3 py-1 rounded-full">
                  {globalSortedProducts.length} productos en total
                </span>
              </div>

              <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                {globalSortedProducts.map((prod, index) => {
                  const catName =
                    categories.find((c) => c.id === prod.categoryId)?.name ||
                    'Sin categoría';

                  return (
                    <div
                      key={prod.id}
                      className="p-3 rounded-xl border border-stone-200 bg-stone-50/60 hover:bg-white hover:border-[#B77900]/50 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-9 h-8 rounded-xl bg-[#181818] text-[#D6A21A] text-xs font-black flex items-center justify-center shrink-0 shadow-sm">
                          {index + 1}°
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-stone-900 truncate">
                              {prod.name}
                            </p>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-stone-200/80 text-stone-700">
                              {catName}
                            </span>
                          </div>
                          <p className="text-xs text-stone-500 font-medium">
                            {formatProductPrice(prod.price)} · SKU: {prod.sku}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <select
                          value={index}
                          disabled={isSaving}
                          onChange={(e) =>
                            handleMoveProductGlobal(index, Number(e.target.value))
                          }
                          className="text-xs font-bold bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-stone-800 focus:outline-none focus:border-[#B77900] cursor-pointer"
                        >
                          {globalSortedProducts.map((_, idx) => (
                            <option key={idx} value={idx}>
                              {getOrdinalLabel(idx + 1)}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          disabled={index === 0 || isSaving}
                          onClick={() => handleMoveProductGlobal(index, index - 1)}
                          className="p-1.5 rounded-lg bg-white border border-stone-200 text-stone-600 hover:text-stone-900 hover:border-stone-300 disabled:opacity-30 cursor-pointer"
                          title="Subir una posición"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={
                            index === globalSortedProducts.length - 1 || isSaving
                          }
                          onClick={() => handleMoveProductGlobal(index, index + 1)}
                          className="p-1.5 rounded-lg bg-white border border-stone-200 text-stone-600 hover:text-stone-900 hover:border-stone-300 disabled:opacity-30 cursor-pointer"
                          title="Bajar una posición"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="px-6 py-3.5 bg-white border-t border-stone-200 flex items-center justify-between">
          <p className="text-xs text-stone-500">
            Los cambios de posición se guardan automáticamente en tiempo real.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#181818] hover:bg-stone-800 text-[#FFFDF5] text-xs font-bold transition-colors cursor-pointer"
          >
            Listo, Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
