import React, { useState, useMemo } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import { Product, ModifierGroup, ModifierOption } from '../../types';
import { DEFAULT_DAILY_MENU_PRODUCT, DEFAULT_DAILY_MENU_GROUPS } from '../../services/catalogSeed';
import { formatCOP } from '../../utils/calculations';
import {
  X,
  UtensilsCrossed,
  Plus,
  Trash2,
  Check,
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
} from 'lucide-react';

interface DailyMenuConfigModalProps {
  onClose: () => void;
}

const FIXED_CATEGORY_META: Array<{
  id: string;
  name: string;
  defaultDiscount: number;
  description: string;
}> = [
  {
    id: 'grp-almuerzo-sopa',
    name: 'Sopa',
    defaultDiscount: 2000,
    description: 'Sopas o cremas del día',
  },
  {
    id: 'grp-almuerzo-principio',
    name: 'Principio',
    defaultDiscount: 1000,
    description: 'Granos o principios del almuerzo',
  },
  {
    id: 'grp-almuerzo-carne',
    name: 'Carne',
    defaultDiscount: 6000,
    description: 'Proteínas principales (pueden modificar el precio del almuerzo)',
  },
  {
    id: 'grp-almuerzo-acomp1',
    name: 'Acompañamiento 1',
    defaultDiscount: 1000,
    description: 'Primer acompañamiento (ej: Arroz)',
  },
  {
    id: 'grp-almuerzo-acomp2',
    name: 'Acompañamiento 2',
    defaultDiscount: 1000,
    description: 'Segundo acompañamiento (ej: Tajadas, Patacón, Papas)',
  },
  {
    id: 'grp-almuerzo-acomp3',
    name: 'Acompañamiento 3',
    defaultDiscount: 1000,
    description: 'Tercer acompañamiento (ej: Ensalada, Aguacate, Postre)',
  },
  {
    id: 'grp-almuerzo-bebida',
    name: 'Bebida / Sobremesa',
    defaultDiscount: 1000,
    description: 'Bebida o sobremesa del almuerzo (ej: Limonada, Jugo Natural, Mazamorra)',
  },
];

export const DailyMenuConfigModal: React.FC<DailyMenuConfigModalProps> = ({ onClose }) => {
  const { dailyMenuProduct, saveDailyMenuConfig, actionLoading } = useRestaurant();
  const { showToast } = useToast();

  const sourceProduct: Product = dailyMenuProduct || DEFAULT_DAILY_MENU_PRODUCT;

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

  // Normalizar siempre las 6 categorías fijas requeridas
  const [groups, setGroups] = useState<ModifierGroup[]>(() => {
    const existingGroups = sourceProduct.featureGroups || DEFAULT_DAILY_MENU_GROUPS;
    return FIXED_CATEGORY_META.map((meta, index) => {
      const found =
        existingGroups.find(
          (g) => g.id === meta.id || g.name.toLowerCase() === meta.name.toLowerCase()
        ) || DEFAULT_DAILY_MENU_GROUPS.find((g) => g.id === meta.id);

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
        options:
          found?.options && found.options.length > 0
            ? found.options.map((o) => ({ ...o }))
            : [],
      };
    });
  });

  const [activeTabId, setActiveTabId] = useState<string>(FIXED_CATEGORY_META[0].id);
  const [newOptionName, setNewOptionName] = useState<string>('');
  const [newOptionPrice, setNewOptionPrice] = useState<number>(0);

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeTabId) || groups[0],
    [groups, activeTabId]
  );

  // Cambiar valor que disminuye si no se selecciona ninguna opción de la categoría
  const handleUpdateGroupDiscount = (groupId: string, discountValue: number) => {
    const safeVal = Math.max(0, Math.round(discountValue || 0));
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, noSelectionDiscount: safeVal } : g))
    );
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
    showToast(`"${trimmed}" agregado a ${activeGroup.name}`, 'success');
  };

  // Editar nombre o valor adicional de una opción existente
  const handleUpdateOption = (
    groupId: string,
    optionId: string,
    updates: Partial<ModifierOption>
  ) => {
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

    try {
      await saveDailyMenuConfig({
        name: cleanName,
        price: cleanPrice,
        isVisible,
        featureGroups: groups,
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

  const getCategoryIcon = (id: string) => {
    if (id.includes('sopa')) return Soup;
    if (id.includes('carne')) return Flame;
    if (id.includes('principio')) return Salad;
    if (id.includes('bebida')) return Wine;
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
                Configura disponibilidad, nombre, valor base, descuentos por omisión y opciones de Sopa, Principio, Carne, Acompañamientos y Bebida / Sobremesa
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
                  onChange={(e) => setIsVisible(e.target.checked)}
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
                  onChange={(e) => setProductName(e.target.value)}
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
                    onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#121117] border border-[#383124] text-sm font-black font-mono text-[#d4af37] focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
                <span className="text-[11px] text-[#a8a29e] mt-1 block">
                  Valor completo con todas las opciones estándar ({formatCOP(basePrice)}). Cambia según la carne u opciones elegidas o disminuye si no se selecciona alguna categoría.
                </span>
              </div>
            </div>
          </div>

          {/* 2. Categorías del Almuerzo del Día (Sopa, Principio, Carne, Acompañamientos 1, 2, 3 y Bebida / Sobremesa) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs sm:text-sm font-black text-[#d4af37] uppercase tracking-wider">
                2. Categorías y Elementos del "{productName || 'Menú del Día'}"
              </h3>
              <span className="text-[11px] text-[#a8a29e] flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Selecciona cada categoría para configurar sus opciones y el valor que disminuye si no se incluye</span>
              </span>
            </div>

            {/* Pestañas de las 7 Categorías */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {groups.map((grp) => {
                const Icon = getCategoryIcon(grp.id);
                const isSelected = grp.id === activeGroup.id;
                const activeCount = grp.options.filter((o) => o.isActive !== false).length;

                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => setActiveTabId(grp.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      isSelected
                        ? 'bg-[#2b2416] border-[#d4af37] text-[#fef3c7] shadow-lg shadow-[#d4af37]/15 ring-1 ring-[#d4af37]'
                        : 'bg-[#18171f] border-[#2d281e] text-[#a8a29e] hover:border-[#383124] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black truncate">{grp.name}</span>
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#d4af37]' : 'text-[#a8a29e]'}`} />
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono font-bold text-[#d4af37]">
                        {activeCount} {activeCount === 1 ? 'opción' : 'opciones'}
                      </span>
                      <span className="text-emerald-400 font-mono font-bold" title="Valor que disminuye si no se selecciona">
                        -{formatCOP(grp.noSelectionDiscount || 0)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Panel de Configuración de la Categoría Seleccionada */}
            {activeGroup && (
              <div className="p-4 sm:p-5 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-4 shadow-md">
                {/* Cabecera de Categoría + Valor que disminuye si no se selecciona */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#2d281e]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-[#2b2416] border border-[#d4af37]/50 text-[#d4af37] text-xs font-black">
                        Categoría: {activeGroup.name}
                      </span>
                      <span className="text-xs text-[#a8a29e]">
                        ({activeGroup.options.filter((o) => o.isActive !== false).length} disponibles hoy)
                      </span>
                    </div>
                    <p className="text-xs text-[#a8a29e] mt-1">
                      {activeGroup.description}
                    </p>
                  </div>

                  {/* Input Valor que disminuye si NO se selecciona ninguna opción de esta categoría */}
                  <div className="p-3 rounded-xl bg-[#121117] border border-emerald-700/50 flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <div>
                      <label className="text-[11px] font-black text-emerald-400 block">
                        Valor que disminuye si NO lleva {activeGroup.name}:
                      </label>
                      <span className="text-[10px] text-[#a8a29e] block">
                        Se descuenta si el cliente no selecciona ninguna opción de {activeGroup.name}
                      </span>
                    </div>
                    <div className="relative w-full sm:w-36 shrink-0">
                      <span className="text-xs font-black text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2">
                        -$
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={500}
                        value={activeGroup.noSelectionDiscount || 0}
                        onChange={(e) =>
                          handleUpdateGroupDiscount(
                            activeGroup.id,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#18171f] border border-emerald-700/60 text-xs font-black font-mono text-emerald-400 focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Formulario para Agregar Nueva Opción a esta Categoría */}
                <div className="p-3.5 rounded-xl bg-[#121117] border border-[#2d281e] space-y-2.5">
                  <span className="text-[11px] font-black text-[#d4af37] uppercase tracking-wider block">
                    + Agregar nuevo elemento a {activeGroup.name}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-6">
                      <label className="text-[10px] font-bold text-[#a8a29e] block mb-1">
                        Nombre de la opción (ej: {activeGroup.name === 'Carne' ? 'Churrasco Especial, Pechuga Asada' : activeGroup.name === 'Sopa' ? 'Sancocho de Gallina' : 'Nuevo elemento'})
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
                        placeholder={`Escribe una opción para ${activeGroup.name}...`}
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
                        <span>Agregar a {activeGroup.name}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lista de Elementos / Opciones de la Categoría */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#a8a29e] px-1">
                    <span>ELEMENTOS CONFIGURADOS EN {activeGroup.name.toUpperCase()}</span>
                    <span>CAMBIO EN PRECIO / ACCIONES</span>
                  </div>

                  {activeGroup.options.length === 0 ? (
                    <div className="p-6 rounded-xl bg-[#121117] border border-dashed border-[#383124] text-center text-xs text-[#a8a29e]">
                      No hay elementos en {activeGroup.name}. Usa el formulario de arriba para agregar opciones.
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
              Sin Sopa:{' '}
              <strong className="text-emerald-400 font-mono">
                {formatCOP(
                  Math.max(
                    0,
                    basePrice -
                      (groups.find((g) => g.id === 'grp-almuerzo-sopa')?.noSelectionDiscount || 0)
                  )
                )}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[#24222e] hover:bg-[#322f3f] text-[#a8a29e] hover:text-white text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={actionLoading}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs flex items-center gap-2 hover:brightness-110 shadow-lg shadow-[#d4af37]/20 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{actionLoading ? 'Guardando...' : 'Guardar Menú del Día'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
