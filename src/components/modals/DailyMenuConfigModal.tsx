import React, { useState, useMemo, useEffect } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import { Product, ModifierGroup, ModifierOption } from '../../types';
import { DEFAULT_DAILY_MENU_PRODUCT, DEFAULT_DAILY_MENU_GROUPS } from '../../services/catalogSeed';
import { formatCOP } from '../../utils/calculations';
import {
  resolveEditableDailyMenuGroups,
  updateDailyMenuCategory,
  toggleDailyMenuCategoryVisibility,
  deleteDailyMenuCategory,
  addDailyMenuCategory,
  validateDailyMenuCategoriesBeforeSave,
} from '../../utils/dailyMenuCategoryUtils';
import {
  X,
  UtensilsCrossed,
  Plus,
  Trash2,
  Soup,
  Flame,
  Salad,
  Layers,
  DollarSign,
  Eye,
  EyeOff,
  Save,
  Sparkles,
  Info,
  Wine,
  Pencil,
  AlertTriangle,
  FolderPlus,
} from 'lucide-react';

interface DailyMenuConfigModalProps {
  onClose: () => void;
}

export const DailyMenuConfigModal: React.FC<DailyMenuConfigModalProps> = ({ onClose }) => {
  const { dailyMenuProduct, saveDailyMenuConfig, actionLoading } = useRestaurant();
  const { showToast } = useToast();

  const sourceProduct: Product = dailyMenuProduct || DEFAULT_DAILY_MENU_PRODUCT;
  const [hasUserEdited, setHasUserEdited] = useState<boolean>(false);

  const [isVisible, setIsVisible] = useState<boolean>(
    sourceProduct.isVisibleInMenu !== false &&
      sourceProduct.isAvailableForSale !== false &&
      sourceProduct.status === 'activo'
  );
  const [productName, setProductName] = useState<string>(
    sourceProduct.name || 'Menú del Día'
  );
  const [basePrice, setBasePrice] = useState<number>(
    typeof sourceProduct.price === 'number' ? sourceProduct.price : 16000
  );

  // Respetar estrictamente las categorías guardadas (incluyendo nombres editados, ocultas, agregadas o eliminadas)
  const [groups, setGroups] = useState<ModifierGroup[]>(() =>
    resolveEditableDailyMenuGroups(sourceProduct.featureGroups, DEFAULT_DAILY_MENU_GROUPS)
  );

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const initial = resolveEditableDailyMenuGroups(
      sourceProduct.featureGroups,
      DEFAULT_DAILY_MENU_GROUPS
    );
    return initial[0]?.id || '';
  });

  // Si dailyMenuProduct termina de llegar desde Firestore después de montar el modal y el usuario
  // aún no ha editado nada, sincronizar para no mostrar ni guardar valores por defecto obsoletos
  useEffect(() => {
    if (hasUserEdited || !dailyMenuProduct) return;
    setIsVisible(
      dailyMenuProduct.isVisibleInMenu !== false &&
        dailyMenuProduct.isAvailableForSale !== false &&
        dailyMenuProduct.status === 'activo'
    );
    setProductName(dailyMenuProduct.name || 'Menú del Día');
    setBasePrice(typeof dailyMenuProduct.price === 'number' ? dailyMenuProduct.price : 16000);
    const resolved = resolveEditableDailyMenuGroups(
      dailyMenuProduct.featureGroups,
      DEFAULT_DAILY_MENU_GROUPS
    );
    setGroups(resolved);
    setActiveTabId((prev) =>
      resolved.some((g) => g.id === prev) ? prev : resolved[0]?.id || ''
    );
  }, [dailyMenuProduct, hasUserEdited]);

  const [newOptionName, setNewOptionName] = useState<string>('');
  const [newOptionPrice, setNewOptionPrice] = useState<number>(0);

  // Gestión de creación y confirmación de borrado de categorías
  const [showAddCategoryForm, setShowAddCategoryForm] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryDescription, setNewCategoryDescription] = useState<string>('');
  const [newCategoryDiscount, setNewCategoryDiscount] = useState<number>(0);
  const [pendingDeleteCategoryId, setPendingDeleteCategoryId] = useState<string | null>(null);

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeTabId) || groups[0] || null,
    [groups, activeTabId]
  );

  const visibleCategoriesCount = useMemo(
    () => groups.filter((g) => g.isActive !== false).length,
    [groups]
  );
  const hiddenCategoriesCount = groups.length - visibleCategoriesCount;

  const firstVisibleDiscountGroup = useMemo(
    () => groups.find((g) => g.isActive !== false && (g.noSelectionDiscount || 0) > 0) || null,
    [groups]
  );

  // Editar nombre, descripción o descuento de una categoría
  const handleUpdateCategoryField = (
    groupId: string,
    updates: Partial<Pick<ModifierGroup, 'name' | 'description' | 'noSelectionDiscount' | 'isActive'>>
  ) => {
    setHasUserEdited(true);
    setGroups((prev) => updateDailyMenuCategory(prev, groupId, updates));
  };

  // Ocultar o mostrar una categoría completa
  const handleToggleCategoryVisibility = (groupId: string) => {
    const target = groups.find((g) => g.id === groupId);
    if (!target) return;
    const willBeVisible = target.isActive === false;
    setHasUserEdited(true);
    setGroups((prev) => toggleDailyMenuCategoryVisibility(prev, groupId));
    showToast(
      willBeVisible
        ? `Categoría "${target.name}" visible nuevamente en pedidos`
        : `Categoría "${target.name}" ocultada en pedidos (sus opciones se conservan)`,
      'info'
    );
  };

  // Solicitar confirmación inline para borrar categoría
  const handleRequestDeleteCategory = (groupId: string) => {
    setActiveTabId(groupId);
    setPendingDeleteCategoryId(groupId);
  };

  // Confirmar eliminación de categoría
  const handleConfirmDeleteCategory = (groupId: string) => {
    const result = deleteDailyMenuCategory(groups, groupId, activeTabId);
    if (!result.deletedCategory) {
      setPendingDeleteCategoryId(null);
      return;
    }
    setHasUserEdited(true);
    setGroups(result.nextGroups);
    setActiveTabId(result.nextActiveTabId);
    setPendingDeleteCategoryId(null);
    showToast(
      `Categoría "${result.deletedCategory.name}" eliminada. Haz clic en "Guardar Menú del Día" para aplicar.`,
      'warning'
    );
  };

  // Crear nueva categoría personalizada
  const handleCreateCategory = () => {
    const res = addDailyMenuCategory(groups, {
      name: newCategoryName,
      description: newCategoryDescription,
      noSelectionDiscount: newCategoryDiscount,
    });
    if (!res.ok) {
      showToast(res.error, 'warning');
      return;
    }
    setHasUserEdited(true);
    setGroups(res.nextGroups);
    setActiveTabId(res.createdCategory.id);
    setNewCategoryName('');
    setNewCategoryDescription('');
    setNewCategoryDiscount(0);
    setShowAddCategoryForm(false);
    setPendingDeleteCategoryId(null);
    showToast(`Categoría "${res.createdCategory.name}" creada`, 'success');
  };

  // Agregar nueva opción a la categoría activa
  const handleAddOption = (groupId: string) => {
    const trimmed = newOptionName.trim();
    if (!trimmed) {
      showToast('Escribe el nombre del elemento para agregarlo a la categoría', 'warning');
      return;
    }

    const newOpt: ModifierOption = {
      id: `opt-${groupId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: trimmed,
      priceSurcharge: Math.round(newOptionPrice || 0),
      isActive: true,
      isDefault: false,
    };

    setHasUserEdited(true);
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const hasAnyDefault = g.options.some((o) => o.isDefault && o.isActive);
        return {
          ...g,
          options: [
            ...g.options,
            {
              ...newOpt,
              isDefault: !hasAnyDefault,
            },
          ],
        };
      })
    );

    setNewOptionName('');
    setNewOptionPrice(0);
    showToast(`"${trimmed}" agregado a ${activeGroup?.name || 'la categoría'}`, 'success');
  };

  // Editar nombre o valor adicional de una opción existente
  const handleUpdateOption = (
    groupId: string,
    optionId: string,
    updates: Partial<ModifierOption>
  ) => {
    setHasUserEdited(true);
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          options: g.options.map((opt) =>
            opt.id === optionId ? { ...opt, ...updates } : opt
          ),
        };
      })
    );
  };

  // Marcar una opción como predeterminada dentro de su categoría
  const handleSetDefaultOption = (groupId: string, optionId: string) => {
    setHasUserEdited(true);
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          options: g.options.map((opt) => ({
            ...opt,
            isDefault: opt.id === optionId,
            isActive: opt.id === optionId ? true : opt.isActive,
          })),
        };
      })
    );
  };

  // Eliminar opción
  const handleDeleteOption = (groupId: string, optionId: string) => {
    setHasUserEdited(true);
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const remaining = g.options.filter((opt) => opt.id !== optionId);
        return {
          ...g,
          options: remaining,
        };
      })
    );
  };

  // Guardar configuración completa
  const handleSave = async () => {
    const cleanName = productName.trim() || 'Menú del Día';
    const cleanPrice = Math.max(0, Math.round(basePrice || 0));

    const validation = validateDailyMenuCategoriesBeforeSave(groups);
    if (!validation.valid) {
      if (validation.invalidCategoryId) {
        setActiveTabId(validation.invalidCategoryId);
      }
      showToast(validation.error, 'warning');
      return;
    }

    try {
      await saveDailyMenuConfig({
        name: cleanName,
        price: cleanPrice,
        isVisible,
        featureGroups: validation.sanitizedGroups,
      });
      showToast(
        `Configuración de "${cleanName}" guardada (${
          isVisible ? 'Visible en pedidos' : 'Oculto en pedidos'
        })`,
        'success'
      );
      onClose();
    } catch (err) {
      console.error('Error saving daily menu config:', err);
      showToast('Error al guardar la configuración del Menú del día', 'error');
    }
  };

  const getCategoryIcon = (grp: ModifierGroup) => {
    const key = `${grp.id} ${grp.name}`.toLowerCase();
    if (key.includes('sopa') || key.includes('crema')) return Soup;
    if (key.includes('carne') || key.includes('prote')) return Flame;
    if (key.includes('principio') || key.includes('ensalada')) return Salad;
    if (key.includes('bebida') || key.includes('sobremesa') || key.includes('jugo')) return Wine;
    return Layers;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#121117] border border-[#3f3521] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] text-[#faf5ee]">
        {/* Cabecera Principal */}
        <div className="px-5 sm:px-6 py-4 border-b border-[#2d281e] bg-gradient-to-r from-[#1a1722] via-[#16141d] to-[#121117] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#2a2213] border border-[#d4af37]/50 text-[#d4af37] flex items-center justify-center shadow-md">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-[#fef3c7] leading-tight">
                  Configuración del Menú del Día
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                    isVisible
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {isVisible ? 'Visible en Pedidos' : 'Oculto'}
                </span>
              </div>
              <p className="text-xs text-[#a8a29e] mt-0.5">
                Administra disponibilidad, valor base y personaliza, oculta, agrega o elimina las categorías y opciones del menú
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#24222e] hover:bg-[#322f3f] text-[#a8a29e] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* 1. Configuración General del Producto Almuerzo del Día */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-4 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2d281e] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#d4af37]" />
                <h3 className="text-xs sm:text-sm font-black text-[#fef3c7] uppercase tracking-wider">
                  1. Datos Principales del Producto
                </h3>
              </div>

              {/* Checkbox de Visibilidad */}
              <label className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#121117] border border-[#d4af37]/50 cursor-pointer select-none hover:border-[#d4af37] transition-all">
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={(e) => {
                    setHasUserEdited(true);
                    setIsVisible(e.target.checked);
                  }}
                  className="w-4 h-4 accent-[#d4af37] rounded cursor-pointer"
                />
                {isVisible ? (
                  <Eye className="w-4 h-4 text-emerald-400" />
                ) : (
                  <EyeOff className="w-4 h-4 text-zinc-400" />
                )}
                <span className="text-xs font-black text-[#fef3c7]">
                  Producto visible y disponible en pedidos
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nombre del Producto */}
              <div>
                <label className="text-xs font-bold text-[#fef3c7] block mb-1.5">
                  Nombre del Producto:
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => {
                    setHasUserEdited(true);
                    setProductName(e.target.value);
                  }}
                  placeholder="Menú del Día"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#121117] border border-[#383124] text-sm font-bold text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                />
                <span className="text-[11px] text-[#a8a29e] mt-1 block">
                  Nombre con el que aparece en el catálogo de pedidos, cocina y tirilla POS.
                </span>
              </div>

              {/* Valor Base del Menú del Día */}
              <div>
                <label className="text-xs font-bold text-[#fef3c7] block mb-1.5">
                  Valor Base del Menú del Día ($ COP):
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-[#d4af37] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={basePrice}
                    onChange={(e) => {
                      setHasUserEdited(true);
                      setBasePrice(parseFloat(e.target.value) || 0);
                    }}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#121117] border border-[#383124] text-sm font-black font-mono text-[#d4af37] focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
                <span className="text-[11px] text-[#a8a29e] mt-1 block">
                  Valor completo con todas las opciones estándar ({formatCOP(basePrice)}). Cambia según la carne u opciones elegidas o disminuye si no se selecciona alguna categoría.
                </span>
              </div>
            </div>
          </div>

          {/* 2. Categorías del Menú del Día (Editables, Ocultables, Eliminables y Creables) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs sm:text-sm font-black text-[#d4af37] uppercase tracking-wider">
                  2. Categorías y Elementos del "{productName || 'Menú del Día'}"
                </h3>
                <span className="px-2 py-0.5 rounded-lg bg-[#18171f] border border-[#2d281e] text-[10px] font-bold text-[#a8a29e]">
                  {visibleCategoriesCount} {visibleCategoriesCount === 1 ? 'visible' : 'visibles'}
                  {hiddenCategoriesCount > 0 ? ` · ${hiddenCategoriesCount} ocultas` : ''}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowAddCategoryForm((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl bg-[#2b2416] hover:bg-[#382e1a] border border-[#d4af37]/60 text-[#fef3c7] font-black text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>{showAddCategoryForm ? 'Cerrar formulario' : '+ Nueva Categoría'}</span>
              </button>
            </div>

            <div className="text-[11px] text-[#a8a29e] flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
              <span>
                Haz clic en una categoría para editar su nombre, descripción u opciones, o usa los íconos para ocultarla o borrarla.
              </span>
            </div>

            {/* Formulario Colapsable para Crear Nueva Categoría */}
            {showAddCategoryForm && (
              <div className="p-4 rounded-2xl bg-[#18171f] border border-[#d4af37]/60 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#d4af37] uppercase tracking-wider">
                    Crear nueva categoría en el Menú del Día
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddCategoryForm(false)}
                    className="text-xs text-[#a8a29e] hover:text-white cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-4">
                    <label className="text-[10px] font-bold text-[#a8a29e] block mb-1">
                      Nombre de la categoría *
                    </label>
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateCategory();
                        }
                      }}
                      placeholder="Ej: Postre, Entrada, Ensalada..."
                      className="w-full px-3 py-2 rounded-xl bg-[#121117] border border-[#383124] text-xs font-bold text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="text-[10px] font-bold text-[#a8a29e] block mb-1">
                      Descripción (opcional)
                    </label>
                    <input
                      type="text"
                      value={newCategoryDescription}
                      onChange={(e) => setNewCategoryDescription(e.target.value)}
                      placeholder="Ej: Postres caseros disponibles hoy"
                      className="w-full px-3 py-2 rounded-xl bg-[#121117] border border-[#383124] text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-[#a8a29e] block mb-1">
                      Descuento (-$ COP)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={newCategoryDiscount}
                      onChange={(e) => setNewCategoryDiscount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl bg-[#121117] border border-[#383124] text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs flex items-center justify-center gap-1 hover:brightness-110 cursor-pointer shadow"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Crear</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Pestañas / Tarjetas de Categorías */}
            {groups.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#1a1922] border border-dashed border-[#383124] text-center space-y-3">
                <p className="text-sm font-bold text-[#fef3c7]">
                  No hay categorías configuradas en el Menú del Día
                </p>
                <p className="text-xs text-[#a8a29e]">
                  Puedes agregar categorías personalizadas como Sopa, Principio, Carne, Acompañamientos o Bebida.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddCategoryForm(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs inline-flex items-center gap-1.5 hover:brightness-110 cursor-pointer shadow"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>Agregar primera categoría</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {groups.map((grp) => {
                  const Icon = getCategoryIcon(grp);
                  const isSelected = activeGroup?.id === grp.id;
                  const isHidden = grp.isActive === false;
                  const activeCount = grp.options.filter((o) => o.isActive !== false).length;

                  return (
                    <div
                      key={grp.id}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 ${
                        isSelected
                          ? isHidden
                            ? 'bg-amber-950/50 border-amber-500 border-dashed text-[#fef3c7] shadow-md ring-1 ring-amber-500/70'
                            : 'bg-[#2b2416] border-[#d4af37] text-[#fef3c7] shadow-lg shadow-[#d4af37]/15 ring-1 ring-[#d4af37]'
                          : isHidden
                          ? 'bg-[#18171f] border-amber-500/60 border-dashed text-[#a8a29e] opacity-80 hover:opacity-100'
                          : 'bg-[#18171f] border-[#2d281e] text-[#a8a29e] hover:border-[#383124] hover:text-white'
                      }`}
                    >
                      {/* Fila superior: Selector de categoría + Acciones rápidas (Ocultar/Mostrar y Eliminar) */}
                      <div className="flex items-start justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTabId(grp.id);
                            if (pendingDeleteCategoryId && pendingDeleteCategoryId !== grp.id) {
                              setPendingDeleteCategoryId(null);
                            }
                          }}
                          className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer focus:outline-none"
                          title={`Seleccionar categoría "${grp.name}"`}
                        >
                          <Icon
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isHidden
                                ? 'text-zinc-500'
                                : isSelected
                                ? 'text-[#d4af37]'
                                : 'text-[#a8a29e]'
                            }`}
                          />
                          <span
                            className={`text-xs font-black truncate ${
                              isHidden ? 'line-through decoration-zinc-500' : ''
                            }`}
                          >
                            {grp.name || 'Sin nombre'}
                          </span>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleCategoryVisibility(grp.id)}
                            className={`p-1 rounded-lg border transition-colors cursor-pointer ${
                              isHidden
                                ? 'bg-amber-950/70 border-amber-700/60 text-amber-300 hover:bg-amber-900/70'
                                : 'bg-[#121117] border-[#2d281e] text-[#a8a29e] hover:text-white hover:border-[#d4af37]/60'
                            }`}
                            title={
                              isHidden
                                ? `Mostrar categoría "${grp.name}" en pedidos`
                                : `Ocultar categoría "${grp.name}" en pedidos`
                            }
                            aria-label={
                              isHidden
                                ? `Mostrar categoría ${grp.name}`
                                : `Ocultar categoría ${grp.name}`
                            }
                          >
                            {isHidden ? (
                              <EyeOff className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRequestDeleteCategory(grp.id)}
                            className="p-1 rounded-lg bg-[#121117] border border-[#2d281e] text-[#a8a29e] hover:text-red-400 hover:border-red-700/60 hover:bg-red-950/60 transition-colors cursor-pointer"
                            title={`Eliminar categoría "${grp.name}"`}
                            aria-label={`Eliminar categoría ${grp.name}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Fila inferior seleccionable: Conteo de opciones + Badge OCULTA o Descuento */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTabId(grp.id);
                          if (pendingDeleteCategoryId && pendingDeleteCategoryId !== grp.id) {
                            setPendingDeleteCategoryId(null);
                          }
                        }}
                        className="flex items-center justify-between text-[10px] gap-1 w-full text-left cursor-pointer focus:outline-none"
                      >
                        <span className="font-mono font-bold text-[#d4af37]">
                          {activeCount} {activeCount === 1 ? 'opción' : 'opciones'}
                        </span>

                        {isHidden ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-700/60 text-amber-300 font-black uppercase text-[9px]">
                            Oculta
                          </span>
                        ) : (
                          <span
                            className="text-emerald-400 font-mono font-bold"
                            title="Valor que disminuye si no se selecciona"
                          >
                            -{formatCOP(grp.noSelectionDiscount || 0)}
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Panel de Configuración de la Categoría Seleccionada */}
            {activeGroup && (
              <div className="p-4 sm:p-5 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-4 shadow-md">
                {/* Banner de Confirmación Inline para Eliminar Categoría */}
                {pendingDeleteCategoryId === activeGroup.id && (
                  <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-black text-red-200">
                          ¿Eliminar la categoría "{activeGroup.name || 'Sin nombre'}"?
                        </p>
                        <p className="text-red-200 mt-0.5">
                          Se quitará esta categoría junto con{' '}
                          {activeGroup.options.length === 1
                            ? 'su 1 opción'
                            : `sus ${activeGroup.options.length} opciones`}
                          . El cambio se guardará permanentemente al presionar "Guardar Menú del Día".
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 justify-end">
                      <button
                        type="button"
                        onClick={() => setPendingDeleteCategoryId(null)}
                        className="px-3 py-1.5 rounded-lg bg-[#24222e] hover:bg-[#322f3f] text-xs font-bold text-[#fef3c7] cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmDeleteCategory(activeGroup.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black cursor-pointer"
                      >
                        Sí, eliminar categoría
                      </button>
                    </div>
                  </div>
                )}

                {/* Aviso cuando la categoría está oculta */}
                {activeGroup.isActive === false && (
                  <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 text-xs text-amber-200">
                      <EyeOff className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        <strong>Categoría oculta:</strong> "{activeGroup.name}" no aparecerá al tomar pedidos ni descontará del precio base hasta que vuelvas a mostrarla.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleCategoryVisibility(activeGroup.id)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/60 text-amber-200 text-xs font-black shrink-0 cursor-pointer"
                    >
                      Mostrar categoría
                    </button>
                  </div>
                )}

                {/* Cabecera Editable de Categoría + Controles de Visibilidad / Eliminación / Descuento */}
                <div className="space-y-3 pb-4 border-b border-[#2d281e]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-[#2b2416] border border-[#d4af37]/50 text-[#d4af37] text-xs font-black flex items-center gap-1.5">
                        <Pencil className="w-3 h-3" />
                        <span>Editando categoría</span>
                      </span>
                      <span className="text-xs text-[#a8a29e]">
                        ({activeGroup.options.filter((o) => o.isActive !== false).length} disponibles hoy)
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleCategoryVisibility(activeGroup.id)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors ${
                          activeGroup.isActive === false
                            ? 'bg-amber-950/70 border-amber-600/70 text-amber-200 hover:bg-amber-900/70'
                            : 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60'
                        }`}
                      >
                        {activeGroup.isActive === false ? (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>Mostrar en pedidos</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Ocultar categoría</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRequestDeleteCategory(activeGroup.id)}
                        className="px-3 py-1.5 rounded-xl bg-[#121117] hover:bg-red-950/80 border border-red-800/50 text-red-400 text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar categoría</span>
                      </button>
                    </div>
                  </div>

                  {/* Inputs editables de Nombre, Descripción y Descuento */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-4">
                      <label className="text-[11px] font-bold text-[#fef3c7] block mb-1">
                        Nombre de la categoría:
                      </label>
                      <input
                        type="text"
                        value={activeGroup.name}
                        onChange={(e) =>
                          handleUpdateCategoryField(activeGroup.id, { name: e.target.value })
                        }
                        placeholder="Ej: Sopa, Principio, Carne..."
                        className="w-full px-3 py-2 rounded-xl bg-[#121117] border border-[#383124] text-xs font-black text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="text-[11px] font-bold text-[#a8a29e] block mb-1">
                        Descripción:
                      </label>
                      <input
                        type="text"
                        value={activeGroup.description || ''}
                        onChange={(e) =>
                          handleUpdateCategoryField(activeGroup.id, {
                            description: e.target.value,
                          })
                        }
                        placeholder="Descripción breve para meseros y caja..."
                        className="w-full px-3 py-2 rounded-xl bg-[#121117] border border-[#383124] text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="text-[11px] font-black text-emerald-400 block mb-1">
                        Descuento si NO lleva {activeGroup.name || 'esta categoría'}:
                      </label>
                      <div className="relative">
                        <span className="text-xs font-black text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2">
                          -$
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={500}
                          value={activeGroup.noSelectionDiscount || 0}
                          onChange={(e) =>
                            handleUpdateCategoryField(activeGroup.id, {
                              noSelectionDiscount: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#121117] border border-emerald-700/60 text-xs font-black font-mono text-emerald-400 focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Formulario para Agregar Nueva Opción a esta Categoría */}
                <div className="p-3.5 rounded-xl bg-[#121117] border border-[#2d281e] space-y-2.5">
                  <span className="text-[11px] font-black text-[#d4af37] uppercase tracking-wider block">
                    + Agregar nuevo elemento a {activeGroup.name || 'la categoría'}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-6">
                      <label className="text-[10px] font-bold text-[#a8a29e] block mb-1">
                        Nombre de la opción (ej:{' '}
                        {activeGroup.name.toLowerCase().includes('carne')
                          ? 'Churrasco Especial, Pechuga Asada'
                          : activeGroup.name.toLowerCase().includes('sopa')
                          ? 'Sancocho de Gallina'
                          : 'Nuevo elemento'}
                        )
                      </label>
                      <input
                        type="text"
                        value={newOptionName}
                        onChange={(e) => setNewOptionName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddOption(activeGroup.id);
                          }
                        }}
                        placeholder={`Escribe una opción para ${activeGroup.name || 'la categoría'}...`}
                        className="w-full px-3 py-2 rounded-xl bg-[#18171f] border border-[#383124] text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-[10px] font-bold text-[#a8a29e] block mb-1">
                        Cambio de precio ($ COP)
                      </label>
                      <input
                        type="number"
                        step={500}
                        value={newOptionPrice}
                        onChange={(e) => setNewOptionPrice(parseFloat(e.target.value) || 0)}
                        placeholder="0 (Incluido)"
                        className="w-full px-3 py-2 rounded-xl bg-[#18171f] border border-[#383124] text-xs font-mono font-bold text-[#d4af37] focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <button
                        type="button"
                        onClick={() => handleAddOption(activeGroup.id)}
                        className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs flex items-center justify-center gap-1.5 hover:brightness-110 cursor-pointer shadow"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span className="truncate">Agregar a {activeGroup.name || 'categoría'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lista de Elementos / Opciones de la Categoría */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#a8a29e] px-1">
                    <span>
                      ELEMENTOS CONFIGURADOS EN {(activeGroup.name || 'CATEGORÍA').toUpperCase()}
                    </span>
                    <span>CAMBIO EN PRECIO / ACCIONES</span>
                  </div>

                  {activeGroup.options.length === 0 ? (
                    <div className="p-6 rounded-xl bg-[#121117] border border-dashed border-[#383124] text-center text-xs text-[#a8a29e]">
                      No hay elementos en {activeGroup.name || 'esta categoría'}. Usa el formulario de arriba para agregar opciones.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeGroup.options.map((option) => (
                        <div
                          key={option.id}
                          className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            option.isActive !== false
                              ? 'bg-[#121117] border-[#383124]'
                              : 'bg-[#121117]/50 border-[#2d281e] opacity-60'
                          }`}
                        >
                          {/* Checkbox Disponible + Nombre Editable */}
                          <div className="flex items-center gap-3 flex-1">
                            <input
                              type="checkbox"
                              checked={option.isActive !== false}
                              onChange={(e) =>
                                handleUpdateOption(activeGroup.id, option.id, {
                                  isActive: e.target.checked,
                                })
                              }
                              title="Habilitar o deshabilitar opción en el menú de hoy"
                              className="w-4 h-4 accent-[#d4af37] rounded cursor-pointer shrink-0"
                            />

                            <input
                              type="text"
                              value={option.name}
                              onChange={(e) =>
                                handleUpdateOption(activeGroup.id, option.id, {
                                  name: e.target.value,
                                })
                              }
                              className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#18171f] border border-[#2d281e] text-xs font-bold text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                            />
                          </div>

                          {/* Recargo/Variación de Precio + Predeterminado + Eliminar */}
                          <div className="flex flex-wrap items-center gap-2 justify-end">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-[#a8a29e] font-bold">
                                Variación $:
                              </span>
                              <input
                                type="number"
                                step={500}
                                value={option.priceSurcharge || 0}
                                onChange={(e) =>
                                  handleUpdateOption(activeGroup.id, option.id, {
                                    priceSurcharge: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-28 px-2.5 py-1.5 rounded-lg bg-[#18171f] border border-[#383124] text-xs font-mono font-black text-[#d4af37] focus:outline-none focus:border-[#d4af37]"
                              />
                            </div>

                            <span className="text-[11px] font-mono font-bold min-w-[95px] text-right">
                              {option.priceSurcharge === 0 ? (
                                <span className="text-[#a8a29e]">Base ({formatCOP(basePrice)})</span>
                              ) : option.priceSurcharge > 0 ? (
                                <span className="text-[#d4af37]">
                                  Queda en {formatCOP(basePrice + option.priceSurcharge)}
                                </span>
                              ) : (
                                <span className="text-emerald-400">
                                  Queda en {formatCOP(Math.max(0, basePrice + option.priceSurcharge))}
                                </span>
                              )}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleSetDefaultOption(activeGroup.id, option.id)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black border cursor-pointer transition-all ${
                                option.isDefault
                                  ? 'bg-[#2b2416] border-[#d4af37] text-[#d4af37]'
                                  : 'bg-[#18171f] border-[#2d281e] text-[#a8a29e] hover:text-white'
                              }`}
                              title="Opción preseleccionada por defecto al abrir el Menú del Día"
                            >
                              {option.isDefault ? '★ Por defecto' : 'Hacer defecto'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteOption(activeGroup.id, option.id)}
                              className="p-1.5 rounded-lg bg-[#18171f] hover:bg-red-950/80 text-[#a8a29e] hover:text-red-400 border border-[#2d281e] cursor-pointer transition-colors"
                              title="Eliminar opción"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer de Guardado */}
        <div className="px-5 sm:px-6 py-4 border-t border-[#2d281e] bg-[#16151c] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-[#a8a29e] flex flex-wrap items-center gap-2">
            <span>
              Producto: <strong className="text-[#fef3c7]">{productName || 'Menú del Día'}</strong>
            </span>
            <span>·</span>
            <span>
              Valor base: <strong className="text-[#d4af37] font-mono">{formatCOP(basePrice)}</strong>
            </span>
            <span>·</span>
            <span>
              Categorías:{' '}
              <strong className="text-[#fef3c7]">
                {visibleCategoriesCount} {visibleCategoriesCount === 1 ? 'visible' : 'visibles'}
              </strong>
              {hiddenCategoriesCount > 0 && (
                <span className="text-amber-400"> ({hiddenCategoriesCount} ocultas)</span>
              )}
            </span>
            {firstVisibleDiscountGroup && (
              <>
                <span>·</span>
                <span>
                  Sin {firstVisibleDiscountGroup.name}:{' '}
                  <strong className="text-emerald-400 font-mono">
                    {formatCOP(
                      Math.max(0, basePrice - (firstVisibleDiscountGroup.noSelectionDiscount || 0))
                    )}
                  </strong>
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[#24222e] hover:bg-[#322f3f] text-[#a8a29e] hover:text-white text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={actionLoading}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs flex items-center gap-2 hover:brightness-110 shadow-lg shadow-[#d4af37]/20 cursor-pointer whitespace-nowrap"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>{actionLoading ? 'Guardando...' : 'Guardar Menú del Día'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
