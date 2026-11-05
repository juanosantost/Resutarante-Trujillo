import React, { useState } from 'react';
import { ModifierGroup, ModifierOption, OptionIngredient } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import { formatProductPrice } from '../../utils/productUtils';
import {
  X,
  Plus,
  Trash2,
  Sliders,
  Check,
  Edit,
  Save,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react';

interface ModifierGroupManagementModalProps {
  onClose: () => void;
}

export const ModifierGroupManagementModal: React.FC<ModifierGroupManagementModalProps> = ({
  onClose,
}) => {
  const { modifierGroups, createModifierGroup, updateModifierGroup, deleteModifierGroup, inventory, products } = useRestaurant();
  const { showToast } = useToast();

  const [selectedGroup, setSelectedGroup] = useState<ModifierGroup | null>(
    modifierGroups[0] || null
  );
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [groupToDelete, setGroupToDelete] = useState<ModifierGroup | null>(null);

  // Form state
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [selectionType, setSelectionType] = useState<'single' | 'multiple' | 'quantity' | 'text'>('single');
  const [minSelections, setMinSelections] = useState<number>(1);
  const [maxSelections, setMaxSelections] = useState<number>(1);
  const [isRequired, setIsRequired] = useState<boolean>(true);
  const [options, setOptions] = useState<ModifierOption[]>([]);

  // Open edit for a group
  const handleSelectGroup = (group: ModifierGroup) => {
    setSelectedGroup(group);
    setIsCreatingNew(false);
    setName(group.name);
    setDescription(group.description || '');
    setSelectionType(group.selectionType);
    setMinSelections(group.minSelections);
    setMaxSelections(group.maxSelections);
    setIsRequired(group.isRequired);
    setOptions(group.options || []);
  };

  const handleStartNew = () => {
    setSelectedGroup(null);
    setIsCreatingNew(true);
    setName('');
    setDescription('');
    setSelectionType('single');
    setMinSelections(1);
    setMaxSelections(1);
    setIsRequired(true);
    setOptions([
      { id: `opt-${Date.now()}-1`, name: 'Opción 1', priceSurcharge: 0, isActive: true, isDefault: true },
      { id: `opt-${Date.now()}-2`, name: 'Opción 2', priceSurcharge: 0, isActive: true },
    ]);
  };

  // Add / Remove option
  const handleAddOption = () => {
    setOptions([
      ...options,
      {
        id: `opt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: 'Nueva Opción',
        priceSurcharge: 0,
        isActive: true,
      },
    ]);
  };

  const handleUpdateOption = (id: string, updates: Partial<ModifierOption>) => {
    setOptions(
      options.map((o) => (o.id === id ? { ...o, ...updates } : o))
    );
  };

  const handleRemoveOption = (id: string) => {
    setOptions(options.filter((o) => o.id !== id));
  };

  // Manage multiple inventory/product composition ingredients per option
  const handleAddIngredientToOption = (optId: string) => {
    setOptions(
      options.map((o) => {
        if (o.id !== optId) return o;
        const currentList: OptionIngredient[] =
          o.ingredients && o.ingredients.length > 0
            ? [...o.ingredients]
            : o.ingredientId
            ? [
                {
                  id: `ing-${Date.now()}-1`,
                  ingredientType: o.ingredientType || 'inventory',
                  ingredientId: o.ingredientId,
                  ingredientQuantity: o.ingredientQuantity || 1,
                  ingredientAction: o.ingredientAction || 'add',
                },
              ]
            : [];

        const newList: OptionIngredient[] = [
          ...currentList,
          {
            id: `ing-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            ingredientType: 'inventory',
            ingredientId: '',
            ingredientQuantity: 1,
            ingredientAction: 'add',
          },
        ];

        return {
          ...o,
          ingredients: newList,
          ingredientType: newList[0]?.ingredientType,
          ingredientId: newList[0]?.ingredientId,
          ingredientQuantity: newList[0]?.ingredientQuantity,
          ingredientAction: newList[0]?.ingredientAction,
        };
      })
    );
  };

  const handleUpdateOptionIngredient = (
    optId: string,
    ingIndex: number,
    updates: Partial<OptionIngredient>
  ) => {
    setOptions(
      options.map((o) => {
        if (o.id !== optId) return o;
        const currentList: OptionIngredient[] =
          o.ingredients && o.ingredients.length > 0
            ? [...o.ingredients]
            : o.ingredientId
            ? [
                {
                  id: `ing-${Date.now()}-1`,
                  ingredientType: o.ingredientType || 'inventory',
                  ingredientId: o.ingredientId,
                  ingredientQuantity: o.ingredientQuantity || 1,
                  ingredientAction: o.ingredientAction || 'add',
                },
              ]
            : [];

        if (!currentList[ingIndex]) return o;
        currentList[ingIndex] = { ...currentList[ingIndex], ...updates };

        return {
          ...o,
          ingredients: currentList,
          ingredientType: currentList[0]?.ingredientType,
          ingredientId: currentList[0]?.ingredientId,
          ingredientQuantity: currentList[0]?.ingredientQuantity,
          ingredientAction: currentList[0]?.ingredientAction,
        };
      })
    );
  };

  const handleRemoveOptionIngredient = (optId: string, ingIndex: number) => {
    setOptions(
      options.map((o) => {
        if (o.id !== optId) return o;
        const currentList: OptionIngredient[] =
          o.ingredients && o.ingredients.length > 0
            ? [...o.ingredients]
            : o.ingredientId
            ? [
                {
                  id: `ing-${Date.now()}-1`,
                  ingredientType: o.ingredientType || 'inventory',
                  ingredientId: o.ingredientId,
                  ingredientQuantity: o.ingredientQuantity || 1,
                  ingredientAction: o.ingredientAction || 'add',
                },
              ]
            : [];

        const newList = currentList.filter((_, idx) => idx !== ingIndex);

        return {
          ...o,
          ingredients: newList,
          ingredientType: newList[0]?.ingredientType,
          ingredientId: newList[0]?.ingredientId,
          ingredientQuantity: newList[0]?.ingredientQuantity,
          ingredientAction: newList[0]?.ingredientAction,
        };
      })
    );
  };

  // Save changes
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('El nombre del grupo es obligatorio', 'error');
      return;
    }
    if (options.length === 0) {
      showToast('Debes agregar al menos una opción', 'error');
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim(),
      selectionType,
      minSelections: Number(minSelections),
      maxSelections: selectionType === 'single' ? 1 : Number(maxSelections),
      isRequired,
      options,
      isActive: true,
    };

    try {
      if (isCreatingNew) {
        await createModifierGroup(payload);
        showToast(`Grupo "${name}" creado exitosamente`, 'success');
        setIsCreatingNew(false);
      } else if (selectedGroup) {
        await updateModifierGroup(selectedGroup.id, payload);
        showToast(`Grupo "${name}" actualizado`, 'success');
      }
    } catch (err: any) {
      showToast('Error al guardar grupo de modificadores', 'error');
    }
  };

  const handleDeleteGroup = async (group: ModifierGroup) => {
    try {
      await deleteModifierGroup(group.id);
      showToast(`Grupo "${group.name}" borrado exitosamente`, 'success');
      setGroupToDelete(null);
      if (selectedGroup?.id === group.id) {
        setSelectedGroup(null);
      }
    } catch (err) {
      showToast('Error al borrar el grupo de modificadores', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#1a1a1a] border border-[#B77900]/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2d2d2d] bg-[#141414] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-[#292212] border border-[#B77900]/50 text-[#D6A21A] flex items-center justify-center font-bold">
              <Sliders className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-black text-[#FFFDF5]">
                Configuración de Modificadores & Adicionales
              </h2>
              <p className="text-xs text-zinc-400">
                Términos, salsas, acompañamientos, adiciones y exclusiones
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#252525] hover:bg-[#333] text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body: Sidebar list + Detail Editor */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left: Groups List */}
          <div className="md:col-span-4 p-4 border-r border-[#262626] bg-[#151515] overflow-y-auto space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-zinc-300">Grupos Existentes</span>
              <button
                type="button"
                onClick={handleStartNew}
                className="px-2.5 py-1 rounded-xl bg-[#292212] text-[#D6A21A] border border-[#B77900]/50 text-xs font-bold hover:brightness-110 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo</span>
              </button>
            </div>

            {modifierGroups.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500 rounded-xl bg-[#1a1a1a] border border-dashed border-[#333]">
                No hay grupos creados. Presiona "+ Nuevo" para agregar uno.
              </div>
            ) : (
              modifierGroups.map((grp) => {
                const isSelected = selectedGroup?.id === grp.id && !isCreatingNew;

                return (
                  <div
                    key={grp.id}
                    className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between group cursor-pointer ${
                      isSelected
                        ? 'bg-[#292212] border-[#D6A21A] text-white shadow'
                        : 'bg-[#1c1c1c] border-[#2b2b2b] text-zinc-400 hover:border-zinc-600'
                    }`}
                    onClick={() => handleSelectGroup(grp)}
                  >
                    <div className="flex flex-col gap-1 min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#FFFDF5] truncate">{grp.name}</span>
                        {grp.isRequired && (
                          <span className="text-[9px] bg-red-950 text-red-300 px-1.5 py-0.2 rounded font-mono shrink-0">
                            Obligatorio
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400">
                        {grp.selectionType === 'single' ? 'Selección Única' : 'Múltiple'} ·{' '}
                        {grp.options.length} opciones
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setGroupToDelete(grp);
                      }}
                      className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/80 text-red-400 hover:text-red-200 border border-red-800/40 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                      title="Borrar grupo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Group Editor Form */}
          <div className="md:col-span-8 p-5 overflow-y-auto bg-[#181818]">
            {selectedGroup || isCreatingNew ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#282828]">
                  <h3 className="text-xs font-bold text-[#D6A21A] uppercase tracking-wider">
                    {isCreatingNew ? 'Crear Nuevo Grupo' : `Editar: ${name}`}
                  </h3>

                  <div className="flex items-center gap-2">
                    {!isCreatingNew && selectedGroup && (
                      <button
                        type="button"
                        onClick={() => setGroupToDelete(selectedGroup)}
                        className="px-3 py-1.5 rounded-xl bg-red-950/70 hover:bg-red-900 border border-red-800/80 text-red-300 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow"
                        title="Borrar este grupo de modificadores"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Borrar Grupo</span>
                      </button>
                    )}

                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs hover:brightness-110 flex items-center gap-1 cursor-pointer shadow"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Guardar Grupo</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-300 block mb-1">
                      Nombre del Grupo *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej: Término de la Carne, Salsas, Adicionales..."
                      className="w-full px-3 py-2 rounded-xl bg-[#141414] border border-[#333] text-xs text-white focus:outline-none focus:border-[#D6A21A]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-300 block mb-1">
                      Tipo de Selección *
                    </label>
                    <select
                      value={selectionType}
                      onChange={(e) => {
                        const val = e.target.value as 'single' | 'multiple';
                        setSelectionType(val);
                        if (val === 'single') {
                          setMaxSelections(1);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-[#141414] border border-[#333] text-xs text-white focus:outline-none focus:border-[#D6A21A]"
                    >
                      <option value="single">Selección Única (Radio - Máx 1)</option>
                      <option value="multiple">Selección Múltiple (Checkboxes)</option>
                      <option value="quantity">Selección por Cantidad</option>
                      <option value="text">Indicación Libre (Texto)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">
                    Descripción / Indicación para el comensal
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ej: Elige hasta dos salsas artesanales para acompañar"
                    className="w-full px-3 py-2 rounded-xl bg-[#141414] border border-[#333] text-xs text-white focus:outline-none focus:border-[#D6A21A]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-[#141414] border border-[#2a2a2a]">
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRequired}
                      onChange={(e) => setIsRequired(e.target.checked)}
                      className="w-4 h-4 rounded text-[#B77900]"
                    />
                    <span>¿Obligatorio?</span>
                  </label>

                  <div>
                    <label className="text-[10px] text-zinc-400 block">Min. Elecciones</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={minSelections}
                      onChange={(e) => setMinSelections(Number(e.target.value))}
                      className="w-full px-2 py-1 rounded bg-[#1c1c1c] border border-[#333] text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 block">Max. Elecciones</label>
                    <input
                      type="number"
                      disabled={selectionType === 'single'}
                      min={1}
                      max={10}
                      value={selectionType === 'single' ? 1 : maxSelections}
                      onChange={(e) => setMaxSelections(Number(e.target.value))}
                      className="w-full px-2 py-1 rounded bg-[#1c1c1c] border border-[#333] text-xs text-white disabled:opacity-40"
                    />
                  </div>
                </div>

                {/* Options Table */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#FFFDF5]">
                      Opciones del Grupo ({options.length}):
                    </span>
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="px-2.5 py-1 rounded-lg bg-[#252525] text-[#D6A21A] text-xs font-bold hover:bg-[#333] flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar Opción</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {options.map((opt) => (
                      <div
                        key={opt.id}
                        className="p-3 rounded-xl bg-[#141414] border border-[#2e2e2e] space-y-2.5"
                      >
                        <div className="flex flex-col sm:flex-row items-center gap-2">
                          <input
                            type="text"
                            value={opt.name}
                            onChange={(e) =>
                              handleUpdateOption(opt.id, { name: e.target.value })
                            }
                            placeholder="Nombre de la opción (ej: Salsa BBQ, Extra queso...)"
                            className="flex-1 w-full px-2.5 py-1.5 rounded-lg bg-[#1c1c1c] border border-[#333] text-xs text-white"
                          />

                          <div className="flex items-center gap-1 w-full sm:w-36">
                            <span className="text-[10px] text-zinc-400">+$:</span>
                            <input
                              type="number"
                              step={500}
                              min={0}
                              value={opt.priceSurcharge}
                              onChange={(e) =>
                                handleUpdateOption(opt.id, {
                                  priceSurcharge: Number(e.target.value),
                                })
                              }
                              className="w-full px-2 py-1.5 rounded-lg bg-[#1c1c1c] border border-[#333] text-xs font-bold text-[#D6A21A]"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="text-[10px] text-zinc-400 flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={opt.isDefault}
                                onChange={(e) =>
                                  handleUpdateOption(opt.id, { isDefault: e.target.checked })
                                }
                                className="w-3.5 h-3.5 rounded text-[#B77900]"
                              />
                              <span>Default</span>
                            </label>

                            <button
                              type="button"
                              onClick={() => handleRemoveOption(opt.id)}
                              className="p-1 text-red-400 hover:text-red-300 cursor-pointer"
                              title="Quitar opción"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Inventario / Composición de Insumos o Productos (Múltiple) */}
                        <div className="p-2.5 rounded-lg bg-[#181818] border border-[#262626] space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-[#D6A21A] flex items-center gap-1">
                              <span>
                                Afectaciones de Inventario / Composición (
                                {opt.ingredients?.length || (opt.ingredientId ? 1 : 0)}):
                              </span>
                            </span>

                            <button
                              type="button"
                              onClick={() => handleAddIngredientToOption(opt.id)}
                              className="px-2 py-0.5 rounded bg-[#292212] text-[#D6A21A] hover:bg-[#382d18] border border-[#B77900]/50 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              <span>+ Agregar Afectación</span>
                            </button>
                          </div>

                          {/* List active composition ingredients for this option */}
                          {(() => {
                            const activeList: OptionIngredient[] =
                              opt.ingredients && opt.ingredients.length > 0
                                ? opt.ingredients
                                : opt.ingredientId
                                ? [
                                    {
                                      id: 'legacy-1',
                                      ingredientType: opt.ingredientType || 'inventory',
                                      ingredientId: opt.ingredientId,
                                      ingredientQuantity: opt.ingredientQuantity || 1,
                                      ingredientAction: opt.ingredientAction || 'add',
                                    },
                                  ]
                                : [];

                            if (activeList.length === 0) {
                              return (
                                <div className="text-[11px] text-zinc-500 italic py-1">
                                  Sin afectación de inventario. Presiona "+ Agregar Afectación" para vincular insumos o productos.
                                </div>
                              );
                            }

                            return (
                              <div className="space-y-2 pt-1">
                                {activeList.map((ing, ingIdx) => (
                                  <div
                                    key={ing.id || ingIdx}
                                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2 rounded-lg bg-[#121117] border border-[#2d281e] items-center"
                                  >
                                    {/* 1. Tipo de Elemento */}
                                    <div className="sm:col-span-3">
                                      <label className="text-[9px] text-zinc-400 block mb-0.5">
                                        Tipo Elemento
                                      </label>
                                      <select
                                        value={ing.ingredientType || 'inventory'}
                                        onChange={(e) =>
                                          handleUpdateOptionIngredient(opt.id, ingIdx, {
                                            ingredientType: e.target.value as 'inventory' | 'product',
                                            ingredientId: '',
                                          })
                                        }
                                        className="w-full px-2 py-1 rounded bg-[#1c1c1c] border border-[#333] text-[11px] text-zinc-200"
                                      >
                                        <option value="inventory">Artículo de Inventario</option>
                                        <option value="product">Producto Comercial</option>
                                      </select>
                                    </div>

                                    {/* 2. Selección de Insumo / Producto */}
                                    <div className="sm:col-span-4">
                                      <label className="text-[9px] text-zinc-400 block mb-0.5">
                                        {ing.ingredientType === 'product' ? 'Producto *' : 'Insumo *'}
                                      </label>
                                      {ing.ingredientType === 'product' ? (
                                        <select
                                          value={ing.ingredientId || ''}
                                          onChange={(e) =>
                                            handleUpdateOptionIngredient(opt.id, ingIdx, {
                                              ingredientId: e.target.value,
                                            })
                                          }
                                          className="w-full px-2 py-1 rounded bg-[#1c1c1c] border border-[#333] text-[11px] text-white"
                                        >
                                          <option value="">-- Elegir Producto --</option>
                                          {products.map((p) => (
                                            <option key={p.id} value={p.id}>
                                              {p.name} ({formatProductPrice(p.price)})
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <select
                                          value={ing.ingredientId || ''}
                                          onChange={(e) =>
                                            handleUpdateOptionIngredient(opt.id, ingIdx, {
                                              ingredientId: e.target.value,
                                            })
                                          }
                                          className="w-full px-2 py-1 rounded bg-[#1c1c1c] border border-[#333] text-[11px] text-white"
                                        >
                                          <option value="">-- Elegir Insumo --</option>
                                          {inventory.map((inv) => (
                                            <option key={inv.id} value={inv.id}>
                                              {inv.name} ({inv.currentStock} {inv.unit})
                                            </option>
                                          ))}
                                        </select>
                                      )}
                                    </div>

                                    {/* 3. Cantidad */}
                                    <div className="sm:col-span-2">
                                      <label className="text-[9px] text-zinc-400 block mb-0.5">
                                        Cantidad
                                      </label>
                                      <input
                                        type="number"
                                        min={0.01}
                                        step="any"
                                        value={ing.ingredientQuantity ?? 1}
                                        onChange={(e) =>
                                          handleUpdateOptionIngredient(opt.id, ingIdx, {
                                            ingredientQuantity: parseFloat(e.target.value) || 0,
                                          })
                                        }
                                        className="w-full px-2 py-1 rounded bg-[#1c1c1c] border border-[#333] text-[11px] font-bold text-[#D6A21A]"
                                      />
                                    </div>

                                    {/* 4. Efecto */}
                                    <div className="sm:col-span-2">
                                      <label className="text-[9px] text-zinc-400 block mb-0.5">
                                        Efecto
                                      </label>
                                      <select
                                        value={ing.ingredientAction || 'add'}
                                        onChange={(e) =>
                                          handleUpdateOptionIngredient(opt.id, ingIdx, {
                                            ingredientAction: e.target.value as 'add' | 'remove',
                                          })
                                        }
                                        className="w-full px-2 py-1 rounded bg-[#1c1c1c] border border-[#333] text-[11px] text-white"
                                      >
                                        <option value="add">Consumo (+)</option>
                                        <option value="remove">Remoción (-)</option>
                                      </select>
                                    </div>

                                    {/* 5. Eliminar afectación */}
                                    <div className="sm:col-span-1 flex items-center justify-end pt-3">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveOptionIngredient(opt.id, ingIdx)}
                                        className="p-1 text-red-400 hover:text-red-300 cursor-pointer"
                                        title="Eliminar esta afectación"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 py-16">
                <Sliders className="w-12 h-12 mb-2 opacity-30" />
                <p className="text-xs">Selecciona un grupo a la izquierda o crea uno nuevo</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2d2d2d] bg-[#141414] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs hover:brightness-110 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Modal Confirmación de Eliminación de Grupo */}
      {groupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#1c1b18] border border-red-800/80 rounded-3xl p-6 max-w-md w-full shadow-2xl text-[#FFFDF5] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-950/70 border border-red-700/60 text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">¿Borrar Grupo de Modificadores?</h3>
                <p className="text-xs text-zinc-400">Esta acción retirará el grupo y todas sus opciones.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#141414] border border-[#2b2b2b] text-xs space-y-1">
              <div className="font-bold text-[#D6A21A] text-sm">{groupToDelete.name}</div>
              <div className="text-zinc-400 font-mono text-[11px]">
                {groupToDelete.options?.length || 0} opciones contenidas
              </div>
            </div>

            <p className="text-xs text-zinc-300">
              ¿Estás seguro de que deseas eliminar permanentemente este grupo de modificadores? Ya no aparecerá en el catálogo ni estará disponible para vincular a los productos.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#2d2d2d]">
              <button
                type="button"
                onClick={() => setGroupToDelete(null)}
                className="px-4 py-2 rounded-xl bg-[#282828] text-zinc-300 hover:bg-[#333] text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteGroup(groupToDelete)}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Borrar Grupo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
