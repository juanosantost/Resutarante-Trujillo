import React, { useState } from 'react';
import { Category } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import {
  X,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Plus,
  Save,
  Layers,
  Edit,
} from 'lucide-react';

interface CategoryManagementModalProps {
  onClose: () => void;
}

export const CategoryManagementModal: React.FC<CategoryManagementModalProps> = ({
  onClose,
}) => {
  const {
    catalogCategories,
    createCategory,
    updateCategory,
    toggleCategoryActive,
    toggleCategoryVisibility,
    reorderCategories,
    actionLoading,
  } = useRestaurant();
  const { showToast } = useToast();

  const [categoriesList, setCategoriesList] = useState<Category[]>([...catalogCategories]);
  const [showNewCatForm, setShowNewCatForm] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newDesc, setNewDesc] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editDesc, setEditDesc] = useState<string>('');

  // Handle reorder move
  const moveCategory = async (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= categoriesList.length) return;

    const updated = [...categoriesList];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIdx, 0, moved);

    setCategoriesList(updated);
    try {
      await reorderCategories(updated.map((c) => c.id));
      showToast('Orden de categorías actualizado', 'info');
    } catch (err: any) {
      showToast('Error al actualizar el orden', 'error');
    }
  };

  const handleToggleActive = async (cat: Category) => {
    try {
      await toggleCategoryActive(cat.id, !cat.isActive);
      setCategoriesList((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, isActive: !cat.isActive } : c))
      );
      showToast(`Categoría "${cat.name}" ${!cat.isActive ? 'activada' : 'desactivada'}`, 'info');
    } catch (err) {
      showToast('Error al cambiar estado de categoría', 'error');
    }
  };

  const handleToggleVisibility = async (cat: Category) => {
    try {
      await toggleCategoryVisibility(cat.id, !cat.isVisibleInMenu);
      setCategoriesList((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, isVisibleInMenu: !cat.isVisibleInMenu } : c))
      );
      showToast(
        `Categoría "${cat.name}" ahora está ${!cat.isVisibleInMenu ? 'VISIBLE' : 'OCULTA'}`,
        'info'
      );
    } catch (err) {
      showToast('Error al cambiar visibilidad', 'error');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const id = await createCategory({
        name: newName.trim(),
        description: newDesc.trim(),
        order: categoriesList.length + 1,
        isActive: true,
        isVisibleInMenu: true,
        icon: 'Utensils',
      });
      showToast(`Categoría "${newName}" creada con éxito`, 'success');
      setNewName('');
      setNewDesc('');
      setShowNewCatForm(false);
    } catch (err) {
      showToast('Error al crear categoría', 'error');
    }
  };

  const handleSaveEdit = async (catId: string) => {
    if (!editName.trim()) return;
    try {
      await updateCategory(catId, {
        name: editName.trim(),
        description: editDesc.trim(),
      });
      showToast('Categoría actualizada', 'success');
      setEditingId(null);
    } catch (err) {
      showToast('Error al guardar categoría', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-[#1a1a1a] border border-[#B77900]/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2d2d2d] bg-[#141414] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-[#292212] border border-[#B77900]/50 text-[#D6A21A] flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-black text-[#FFFDF5]">
                Administrador de Categorías
              </h2>
              <p className="text-xs text-zinc-400">
                Ordenar, activar, ocultar o añadir nuevas categorías del menú
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-300">
              {categoriesList.length} Categorías configuradas
            </span>
            <button
              type="button"
              onClick={() => setShowNewCatForm(!showNewCatForm)}
              className="px-3 py-1.5 rounded-xl bg-[#292212] border border-[#B77900]/50 text-[#D6A21A] text-xs font-bold hover:brightness-110 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showNewCatForm ? 'Cancelar' : 'Nueva Categoría'}</span>
            </button>
          </div>

          {/* Form to add new category */}
          {showNewCatForm && (
            <form
              onSubmit={handleCreate}
              className="p-4 rounded-2xl bg-[#141414] border border-[#B77900]/40 space-y-3"
            >
              <h3 className="text-xs font-bold text-[#D6A21A] uppercase tracking-wider">
                Crear Nueva Categoría
              </h3>
              <div>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre de la categoría (ej: Alitas Picantes, Menú Infantil)"
                  className="w-full px-3 py-2 rounded-xl bg-[#1c1c1c] border border-[#333] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D6A21A]"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Descripción corta para el comensal..."
                  className="w-full px-3 py-2 rounded-xl bg-[#1c1c1c] border border-[#333] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D6A21A]"
                />
              </div>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-bold text-xs hover:brightness-110 cursor-pointer"
              >
                Guardar Categoría
              </button>
            </form>
          )}

          {/* Category Items List with Reordering Controls */}
          <div className="space-y-2">
            {categoriesList.map((cat, index) => {
              const isEditingThis = editingId === cat.id;

              return (
                <div
                  key={cat.id}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    cat.isActive
                      ? 'bg-[#151515] border-[#292929]'
                      : 'bg-[#151515]/60 border-[#222] opacity-60'
                  }`}
                >
                  {/* Left: Reorder Arrows & Number */}
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 text-center text-xs font-mono text-zinc-500">
                      {index + 1}
                    </span>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveCategory(index, 'up')}
                        className="p-1 text-zinc-400 hover:text-[#D6A21A] disabled:opacity-20 cursor-pointer"
                        title="Subir orden"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === categoriesList.length - 1}
                        onClick={() => moveCategory(index, 'down')}
                        className="p-1 text-zinc-400 hover:text-[#D6A21A] disabled:opacity-20 cursor-pointer"
                        title="Bajar orden"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Center: Name & Description */}
                  <div className="flex-1">
                    {isEditingThis ? (
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2 py-1 rounded bg-[#1c1c1c] border border-[#B77900] text-xs text-white"
                        />
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="w-full px-2 py-1 rounded bg-[#1c1c1c] border border-zinc-700 text-xs text-zinc-300"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(cat.id)}
                          className="px-2.5 py-1 rounded bg-[#B77900] text-[#181818] font-bold text-[11px]"
                        >
                          Guardar
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#FFFDF5]">
                            {cat.name}
                          </span>
                          {!cat.isActive && (
                            <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.2 rounded font-mono">
                              Inactiva
                            </span>
                          )}
                          {!cat.isVisibleInMenu && (
                            <span className="text-[9px] bg-amber-950/80 text-amber-300 px-1.5 py-0.2 rounded font-mono">
                              Oculta en Menú
                            </span>
                          )}
                        </div>
                        {cat.description && (
                          <p className="text-[11px] text-zinc-400 line-clamp-1">
                            {cat.description}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-1.5">
                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditingThis) {
                          setEditingId(null);
                        } else {
                          setEditingId(cat.id);
                          setEditName(cat.name);
                          setEditDesc(cat.description || '');
                        }
                      }}
                      className="p-1.5 rounded-lg bg-[#252525] text-zinc-300 hover:text-white"
                      title="Editar nombre"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    {/* Toggle Visibility */}
                    <button
                      type="button"
                      onClick={() => handleToggleVisibility(cat)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        cat.isVisibleInMenu
                          ? 'bg-[#1e271e] text-emerald-400 border-emerald-800/40'
                          : 'bg-[#271e1e] text-zinc-500 border-zinc-700'
                      }`}
                      title={cat.isVisibleInMenu ? 'Visible en menú' : 'Oculto en menú'}
                    >
                      {cat.isVisibleInMenu ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Toggle Active */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(cat)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        cat.isActive
                          ? 'bg-[#292212] text-[#D6A21A] border-[#B77900]/40'
                          : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                      }`}
                      title={cat.isActive ? 'Activo en sistema' : 'Inactivo en sistema'}
                    >
                      {cat.isActive ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2d2d2d] bg-[#141414] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs hover:brightness-110 cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
