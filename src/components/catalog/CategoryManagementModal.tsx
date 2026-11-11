import React, { useState, useEffect } from 'react';
import { Category } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import { canDeleteCategory } from '../../utils/productUtils';
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
  Trash2,
  AlertTriangle,
  Lock,
} from 'lucide-react';

interface CategoryManagementModalProps {
  onClose: () => void;
}

export const CategoryManagementModal: React.FC<CategoryManagementModalProps> = ({
  onClose,
}) => {
  const {
    catalogCategories,
    products,
    createCategory,
    updateCategory,
    deleteCategory,
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
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState<boolean>(false);

  // Sync with context whenever categories change
  useEffect(() => {
    setCategoriesList([...catalogCategories]);
  }, [catalogCategories]);

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

  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      setIsDeletingCategory(true);
      await deleteCategory(categoryToDelete.id);
      setCategoriesList((prev) => prev.filter((c) => c.id !== categoryToDelete.id));
      showToast(`Categoría "${categoryToDelete.name}" eliminada correctamente`, 'success');
      setCategoryToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar categoría', 'error');
    } finally {
      setIsDeletingCategory(false);
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

                    {/* Delete button */}
                    {cat.id === 'cat-menu-del-dia' || cat.name.trim().toLowerCase() === 'menú del día' ? (
                      <span
                        className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed"
                        title="Categoría del sistema protegida"
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCategoryToDelete(cat)}
                        className="p-1.5 rounded-lg border border-rose-900/40 bg-rose-950/30 text-rose-400 hover:bg-rose-900/50 hover:text-rose-200 transition-colors cursor-pointer"
                        title={`Eliminar categoría "${cat.name}"`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
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

      {/* Modal de confirmación para eliminar categoría */}
      {categoryToDelete && (() => {
        const deleteCheck = canDeleteCategory(categoryToDelete, products);

        return (
          <div
            className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
            onClick={() => !isDeletingCategory && setCategoryToDelete(null)}
          >
            <div
              className="bg-[#181818] border border-rose-500/40 rounded-3xl max-w-md w-full p-5 sm:p-6 text-[#FFFDF5] shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3.5 pb-4 border-b border-[#2d281e]">
                <div className="w-10 h-10 rounded-2xl bg-rose-950/80 border border-rose-600/50 flex items-center justify-center text-rose-400 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black text-[#FFFDF5]">
                    ¿Eliminar Categoría "{categoryToDelete.name}"?
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Esta acción eliminará la categoría del catálogo de venta.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isDeletingCategory}
                  onClick={() => setCategoryToDelete(null)}
                  className="w-7 h-7 rounded-full bg-[#242424] hover:bg-[#333] text-zinc-400 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Detalles de la categoría */}
              <div className="mt-4 p-3.5 rounded-2xl bg-[#141414] border border-[#2d281e] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Nombre:</span>
                  <span className="text-xs font-bold text-[#FFFDF5]">{categoryToDelete.name}</span>
                </div>
                {categoryToDelete.description && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-zinc-400">Descripción:</span>
                    <span className="text-xs text-zinc-300 text-right">{categoryToDelete.description}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Productos vinculados:</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      deleteCheck.assignedCount > 0
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    }`}
                  >
                    {deleteCheck.assignedCount} productos
                  </span>
                </div>
              </div>

              {/* Advertencia sobre productos asociados */}
              {deleteCheck.assignedCount > 0 && (
                <div className="mt-4 p-3 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Productos en esta categoría</span>
                    <p className="mt-0.5 text-amber-300/90 leading-relaxed">
                      Esta categoría tiene {deleteCheck.assignedCount} producto(s) asignado(s). Al eliminarla, dichos productos no se borrarán pero quedarán sin categoría en el catálogo.
                    </p>
                  </div>
                </div>
              )}

              <p className="mt-4 text-xs text-zinc-400 leading-relaxed">
                ¿Estás seguro de que deseas eliminar permanentemente esta categoría? Esta operación no se puede deshacer.
              </p>

              <div className="mt-5 pt-3 border-t border-[#2d281e] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isDeletingCategory}
                  onClick={() => setCategoryToDelete(null)}
                  className="px-4 py-2 rounded-xl bg-[#242424] hover:bg-[#333] text-zinc-300 text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeletingCategory}
                  onClick={handleConfirmDeleteCategory}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2 cursor-pointer shadow-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeletingCategory ? 'Eliminando...' : 'Sí, Eliminar Categoría'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
