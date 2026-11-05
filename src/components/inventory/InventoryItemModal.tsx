import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { InventoryUnit, RecipeIngredient } from '../../types';
import { formatCOP } from '../../utils/calculations';
import {
  X,
  Plus,
  Trash2,
  Image as ImageIcon,
  Boxes,
  Save,
  CheckCircle,
  AlertCircle,
  ShoppingBag,
  Sparkles,
  Layers,
  Barcode,
  RotateCcw,
} from 'lucide-react';

interface ItemFormState {
  tabId: string;
  name: string;
  category: string;
  reference: string;
  size: string;
  color: string;
  barcode: string;
  controlType: 'por_unidad' | 'por_peso' | 'por_volumen' | 'general';
  unit: InventoryUnit;
  minStock: number;
  observations: string;
  images: string[];
  newImageUrl: string;

  // Inventario Inicial
  hasInitialStock: boolean;
  initialQuantity: number;
  unitCost: number;
  totalCost: number;

  // Composición de producción
  hasProductionRecipe: boolean;
  productionRecipe: RecipeIngredient[];
  selectedRawItemId: string;
  selectedRawQty: number;

  // Agregar como producto de venta
  alsoCreateProduct: boolean;
  sellingPrice: number;

  // Estado de guardado
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  errorMessage?: string;
}

interface InventoryItemModalProps {
  onClose: () => void;
  onSuccess?: (newItemIds: string[]) => void;
  defaultAlsoCreateProduct?: boolean;
}

const createInitialTab = (index: number, defaultAlsoProduct: boolean = false): ItemFormState => ({
  tabId: `tab-${Date.now()}-${index}`,
  name: '',
  category: 'Ingredientes',
  reference: '',
  size: '',
  color: '',
  barcode: '',
  controlType: 'por_unidad',
  unit: 'und',
  minStock: 10,
  observations: '',
  images: [],
  newImageUrl: '',

  hasInitialStock: false,
  initialQuantity: 100,
  unitCost: 2000,
  totalCost: 200000,

  hasProductionRecipe: false,
  productionRecipe: [],
  selectedRawItemId: '',
  selectedRawQty: 1,

  alsoCreateProduct: defaultAlsoProduct,
  sellingPrice: 5000,

  saveStatus: 'idle',
});

export const InventoryItemModal: React.FC<InventoryItemModalProps> = ({
  onClose,
  onSuccess,
  defaultAlsoCreateProduct = false,
}) => {
  const { inventory, categories, createInventoryItem } = useRestaurant();

  // Arreglo de pestañas para soportar la creación múltiple sin perder datos
  const [tabs, setTabs] = useState<ItemFormState[]>([
    createInitialTab(1, defaultAlsoCreateProduct),
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].tabId);

  const activeTab = tabs.find((t) => t.tabId === activeTabId) || tabs[0];

  const updateActiveTab = (updates: Partial<ItemFormState>) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.tabId !== activeTabId) return t;

        const next = { ...t, ...updates };

        // Recalcular costos iniciales automáticamente si cambian
        if ('initialQuantity' in updates || 'unitCost' in updates) {
          const qty = updates.initialQuantity ?? t.initialQuantity;
          const uCost = updates.unitCost ?? t.unitCost;
          next.totalCost = qty * uCost;
        } else if ('totalCost' in updates) {
          const qty = t.initialQuantity > 0 ? t.initialQuantity : 1;
          const tCost = updates.totalCost ?? t.totalCost;
          next.unitCost = Math.round(tCost / qty);
        }

        return next;
      })
    );
  };

  const handleAddTab = () => {
    const newTab = createInitialTab(tabs.length + 1, defaultAlsoCreateProduct);
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.tabId);
  };

  const handleRemoveTab = (tabIdToRemove: string) => {
    if (tabs.length <= 1) return;
    const filtered = tabs.filter((t) => t.tabId !== tabIdToRemove);
    setTabs(filtered);
    if (activeTabId === tabIdToRemove) {
      setActiveTabId(filtered[0].tabId);
    }
  };

  // Manejo de fotos
  const handleAddPhoto = () => {
    if (!activeTab.newImageUrl.trim()) return;
    if (activeTab.images.length >= 3) return;
    updateActiveTab({
      images: [...activeTab.images, activeTab.newImageUrl.trim()],
      newImageUrl: '',
    });
  };

  const handleRemovePhoto = (idx: number) => {
    updateActiveTab({
      images: activeTab.images.filter((_, i) => i !== idx),
    });
  };

  // Manejo de receta de producción
  const handleAddRawIngredient = () => {
    if (!activeTab.selectedRawItemId) return;
    const itemObj = inventory.find((i) => i.id === activeTab.selectedRawItemId);
    if (!itemObj) return;

    // Evitar que un artículo se agregue a sí mismo (ciclos)
    if (activeTab.name && itemObj.name.toLowerCase() === activeTab.name.toLowerCase()) {
      alert('Un artículo no puede componerse de sí mismo.');
      return;
    }

    const newIng: RecipeIngredient = {
      inventoryItemId: itemObj.id,
      name: itemObj.name,
      quantity: activeTab.selectedRawQty || 1,
      unit: itemObj.unit,
    };

    updateActiveTab({
      productionRecipe: [...activeTab.productionRecipe, newIng],
      selectedRawItemId: '',
      selectedRawQty: 1,
    });
  };

  const handleRemoveRawIngredient = (invId: string) => {
    updateActiveTab({
      productionRecipe: activeTab.productionRecipe.filter((i) => i.inventoryItemId !== invId),
    });
  };

  // Guardar una pestaña específica
  const saveSingleTab = async (tabToSave: ItemFormState): Promise<string | null> => {
    if (!tabToSave.name.trim()) {
      setTabs((prev) =>
        prev.map((t) =>
          t.tabId === tabToSave.tabId
            ? { ...t, saveStatus: 'error', errorMessage: 'El nombre del artículo es obligatorio.' }
            : t
        )
      );
      return null;
    }

    // Marcar como guardando
    setTabs((prev) =>
      prev.map((t) => (t.tabId === tabToSave.tabId ? { ...t, saveStatus: 'saving' } : t))
    );

    try {
      const createdId = await createInventoryItem({
        name: tabToSave.name.trim(),
        category: tabToSave.category || 'General',
        reference: tabToSave.reference.trim() || undefined,
        size: tabToSave.size.trim() || undefined,
        color: tabToSave.color.trim() || undefined,
        barcode: tabToSave.barcode.trim() || undefined,
        controlType: tabToSave.controlType,
        unit: tabToSave.unit,
        minStock: Number(tabToSave.minStock) || 0,
        observations: tabToSave.observations.trim() || undefined,
        images: tabToSave.images.slice(0, 3),

        hasInitialStock: tabToSave.hasInitialStock,
        initialQuantity: tabToSave.hasInitialStock ? Number(tabToSave.initialQuantity) || 0 : 0,
        costPerUnit: tabToSave.hasInitialStock ? Number(tabToSave.unitCost) || 0 : 0,

        isProducible: tabToSave.hasProductionRecipe && tabToSave.productionRecipe.length > 0,
        productionRecipe: tabToSave.hasProductionRecipe ? tabToSave.productionRecipe : undefined,

        alsoCreateProduct: tabToSave.alsoCreateProduct,
        sellingPrice: tabToSave.alsoCreateProduct ? Number(tabToSave.sellingPrice) || 0 : 0,
      });

      setTabs((prev) =>
        prev.map((t) =>
          t.tabId === tabToSave.tabId ? { ...t, saveStatus: 'saved', errorMessage: undefined } : t
        )
      );

      return createdId;
    } catch (err: any) {
      console.error('Error saving tab:', err);
      setTabs((prev) =>
        prev.map((t) =>
          t.tabId === tabToSave.tabId
            ? {
                ...t,
                saveStatus: 'error',
                errorMessage: err.message || 'Error al guardar el artículo.',
              }
            : t
        )
      );
      return null;
    }
  };

  // Guardar todos o el activo
  const handleSaveActiveTab = async () => {
    const id = await saveSingleTab(activeTab);
    if (id && onSuccess) {
      onSuccess([id]);
    }
  };

  const handleSaveAllTabs = async () => {
    const createdIds: string[] = [];
    for (const tab of tabs) {
      if (tab.saveStatus !== 'saved') {
        const id = await saveSingleTab(tab);
        if (id) createdIds.push(id);
      }
    }
    if (createdIds.length > 0 && onSuccess) {
      onSuccess(createdIds);
    }
    const allSaved = tabs.every((t) => t.saveStatus === 'saved');
    if (allSaved) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#121117] border border-[#3f3521] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-[#faf5ee]">
        
        {/* Cabecera Principal */}
        <div className="px-6 py-4 border-b border-[#2d281e] bg-gradient-to-r from-[#1a1722] via-[#16141d] to-[#121117] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#2a2213] border border-[#d4af37]/50 flex items-center justify-center text-[#d4af37]">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#fef3c7]">
                Creación de Artículos de Inventario
              </h2>
              <p className="text-xs text-[#a8a29e]">
                Registra insumos o materias primas físicas (Soporta múltiples pestañas)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#24222e] hover:bg-[#322f3f] text-[#a8a29e] hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Pestañas Múltiples (Permite trabajar en varios formularios a la vez) */}
        <div className="px-4 py-2 bg-[#16151c] border-b border-[#2d281e] flex items-center gap-2 overflow-x-auto shrink-0">
          {tabs.map((tab, idx) => {
            const isActive = tab.tabId === activeTabId;
            return (
              <div
                key={tab.tabId}
                onClick={() => setActiveTabId(tab.tabId)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border whitespace-nowrap ${
                  isActive
                    ? 'bg-[#d4af37] text-[#0e0e12] border-[#d4af37] shadow-md'
                    : 'bg-[#1a1922] text-[#a8a29e] border-[#2d281e] hover:text-white'
                }`}
              >
                <span>
                  {tab.name.trim() ? tab.name : `Artículo ${idx + 1}`}
                </span>

                {tab.saveStatus === 'saved' && (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                )}
                {tab.saveStatus === 'saving' && (
                  <span className="w-3 h-3 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                )}
                {tab.saveStatus === 'error' && (
                  <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                )}

                {tabs.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTab(tab.tabId);
                    }}
                    className={`p-0.5 rounded-md hover:bg-black/20 ${isActive ? 'text-[#0e0e12]' : 'text-[#a8a29e]'}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleAddTab}
            className="px-3 py-1.5 rounded-xl bg-[#2b2416] border border-[#d4af37]/40 text-[#d4af37] text-xs font-bold hover:brightness-110 flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Artículo</span>
          </button>
        </div>

        {/* Cuerpo del Formulario de la Pestaña Activa */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab.saveStatus === 'saved' && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>
                Artículo guardado con éxito. Puedes continuar creando otro en una nueva pestaña o cerrar.
              </span>
            </div>
          )}

          {activeTab.errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{activeTab.errorMessage}</span>
            </div>
          )}

          {/* 1. INFORMACIÓN GENERAL */}
          <div className="p-4 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-3.5 shadow-md">
            <h3 className="text-xs font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5">
              <span>1. Información General del Artículo</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-[#fef3c7] mb-1">
                  Nombre del Artículo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pan de Hamburguesa Brioche..."
                  value={activeTab.name}
                  onChange={(e) => updateActiveTab({ name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#fef3c7] mb-1">
                  Categoría *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Carnes, Panadería, Salsas, Bebidas..."
                  value={activeTab.category}
                  onChange={(e) => updateActiveTab({ category: e.target.value })}
                  className="w-full px-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-[#fef3c7] mb-1">
                  Unidad de Medida *
                </label>
                <select
                  value={activeTab.unit}
                  onChange={(e) => updateActiveTab({ unit: e.target.value as InventoryUnit })}
                  className="w-full px-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                >
                  <option value="und">Unidades (und)</option>
                  <option value="kg">Kilogramos (kg)</option>
                  <option value="g">Gramos (g)</option>
                  <option value="lt">Litros (lt)</option>
                  <option value="ml">Mililitros (ml)</option>
                  <option value="porc">Porciones (porc)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#fef3c7] mb-1">
                  Tipo de Control
                </label>
                <select
                  value={activeTab.controlType}
                  onChange={(e) => updateActiveTab({ controlType: e.target.value as any })}
                  className="w-full px-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                >
                  <option value="por_unidad">Por Unidad Contable</option>
                  <option value="por_peso">Por Peso (Báscula)</option>
                  <option value="por_volumen">Por Volumen (Líquidos)</option>
                  <option value="general">Control General</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#fef3c7] mb-1">
                  Stock Mínimo de Alerta
                </label>
                <input
                  type="number"
                  min={0}
                  value={activeTab.minStock}
                  onChange={(e) => updateActiveTab({ minStock: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full px-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                />
              </div>
            </div>
          </div>

          {/* 2. CÓDIGOS, REFERENCIA Y ESPECIFICACIONES */}
          <div className="p-4 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-3.5 shadow-md">
            <h3 className="text-xs font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5">
              <Barcode className="w-4 h-4" />
              <span>2. Códigos y Especificaciones Opcionales</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">Referencia</label>
                <input
                  type="text"
                  placeholder="Ej: REF-001"
                  value={activeTab.reference}
                  onChange={(e) => updateActiveTab({ reference: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">Código Barras / QR</label>
                <input
                  type="text"
                  placeholder="Ej: 770123456789"
                  value={activeTab.barcode}
                  onChange={(e) => updateActiveTab({ barcode: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7] font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">Talla / Peso Unit.</label>
                <input
                  type="text"
                  placeholder="Ej: 150g, Mediano..."
                  value={activeTab.size}
                  onChange={(e) => updateActiveTab({ size: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">Color / Variedad</label>
                <input
                  type="text"
                  placeholder="Ej: Blanco, Ahumado..."
                  value={activeTab.color}
                  onChange={(e) => updateActiveTab({ color: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7]"
                />
              </div>
            </div>
          </div>

          {/* 3. INVENTARIO INICIAL Y COSTO */}
          <div className="p-4 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-3.5 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5">
                  <Boxes className="w-4 h-4" />
                  <span>3. Inventario Inicial y Valoración de Stock</span>
                </h3>
                <p className="text-[11px] text-[#a8a29e]">
                  ¿El artículo ingresa con existencias iniciales en bodega?
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeTab.hasInitialStock}
                  onChange={(e) => updateActiveTab({ hasInitialStock: e.target.checked })}
                  className="w-4 h-4 rounded accent-[#d4af37]"
                />
                <span className="text-xs font-bold text-[#fef3c7]">Registrar Stock Inicial</span>
              </label>
            </div>

            {activeTab.hasInitialStock && (
              <div className="pt-2 border-t border-[#2d281e] grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#fef3c7] mb-1">
                    Cantidad Inicial ({activeTab.unit})
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={activeTab.initialQuantity}
                    onChange={(e) => updateActiveTab({ initialQuantity: Math.max(1, parseFloat(e.target.value) || 0) })}
                    className="w-full px-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs font-bold text-[#fef3c7]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#fef3c7] mb-1">
                    Costo Unitario (COP)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={activeTab.unitCost}
                    onChange={(e) => updateActiveTab({ unitCost: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full px-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs font-mono font-bold text-[#d4af37]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#fef3c7] mb-1">
                    Valor Total Calculado
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={activeTab.totalCost}
                    onChange={(e) => updateActiveTab({ totalCost: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full px-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs font-mono font-bold text-emerald-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 4. FOTOGRAFÍAS (HASTA 3) */}
          <div className="p-4 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-3.5 shadow-md">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" />
                <span>4. Fotografías del Artículo ({activeTab.images.length}/3)</span>
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {activeTab.images.map((url, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden h-20 bg-[#121117] border border-[#2d281e]">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-900/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {activeTab.images.length < 3 && (
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  placeholder="URL de imagen del insumo..."
                  value={activeTab.newImageUrl}
                  onChange={(e) => updateActiveTab({ newImageUrl: e.target.value })}
                  className="flex-1 px-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7]"
                />
                <button
                  type="button"
                  onClick={handleAddPhoto}
                  className="px-3 py-2 rounded-xl bg-[#2b2416] border border-[#d4af37]/40 text-[#d4af37] text-xs font-bold hover:brightness-110 cursor-pointer"
                >
                  Agregar Foto
                </button>
              </div>
            )}
          </div>

          {/* 5. COMPOSICIÓN DE PRODUCCIÓN (SI SE PRODUCE INTERNAMENTE) */}
          <div className="p-4 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-3.5 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>5. Composición de Producción Interna (Opcional)</span>
                </h3>
                <p className="text-[11px] text-[#a8a29e]">
                  Actívala si este artículo se elabora preparando otros insumos (ej: Salsa de la Casa)
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeTab.hasProductionRecipe}
                  onChange={(e) => updateActiveTab({ hasProductionRecipe: e.target.checked })}
                  className="w-4 h-4 rounded accent-[#d4af37]"
                />
                <span className="text-xs font-bold text-[#fef3c7]">Es Producible</span>
              </label>
            </div>

            {activeTab.hasProductionRecipe && (
              <div className="space-y-3 pt-2 border-t border-[#2d281e]">
                <div className="flex items-center gap-2">
                  <select
                    value={activeTab.selectedRawItemId}
                    onChange={(e) => updateActiveTab({ selectedRawItemId: e.target.value })}
                    className="flex-1 px-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7]"
                  >
                    <option value="">-- Seleccionar materia prima / ingrediente --</option>
                    {inventory.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.name} ({inv.unit}) — {formatCOP(inv.costPerUnit)}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={activeTab.selectedRawQty}
                    onChange={(e) => updateActiveTab({ selectedRawQty: parseFloat(e.target.value) || 1 })}
                    className="w-24 px-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7] font-bold"
                  />

                  <button
                    type="button"
                    onClick={handleAddRawIngredient}
                    className="px-3 py-2 rounded-xl bg-[#2b2416] border border-[#d4af37]/40 text-[#d4af37] text-xs font-bold cursor-pointer hover:brightness-110"
                  >
                    + Agregar Insumo
                  </button>
                </div>

                {activeTab.productionRecipe.length > 0 && (
                  <div className="space-y-1.5 p-3 rounded-xl bg-[#121117] border border-[#2d281e]">
                    {activeTab.productionRecipe.map((ing) => (
                      <div key={ing.inventoryItemId} className="flex items-center justify-between text-xs p-1.5 border-b border-[#24211a] last:border-0">
                        <span className="font-bold text-[#fef3c7]">• {ing.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[#d4af37]">{ing.quantity} {ing.unit}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRawIngredient(ing.inventoryItemId)}
                            className="text-red-400 hover:text-red-300 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 6. AGREGAR TAMBIÉN COMO PRODUCTO DE VENTA */}
          <div className="p-4 rounded-2xl bg-[#211b11] border border-[#d4af37]/40 space-y-3.5 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#d4af37]" />
                <div>
                  <h3 className="text-xs font-black text-[#d4af37] uppercase tracking-wider">
                    6. Venta Comercial en Menú POS
                  </h3>
                  <p className="text-[11px] text-[#a8a29e]">
                    Crea automáticamente un producto de venta vinculado 1:1 con este artículo
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeTab.alsoCreateProduct}
                  onChange={(e) => updateActiveTab({ alsoCreateProduct: e.target.checked })}
                  className="w-4 h-4 rounded accent-[#d4af37]"
                />
                <span className="text-xs font-black text-[#fef3c7]">Agregar como producto de venta</span>
              </label>
            </div>

            {activeTab.alsoCreateProduct && (
              <div className="pt-2 border-t border-[#3a2f18] grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#fef3c7] mb-1">
                    Precio de Venta al Público (COP) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={activeTab.sellingPrice}
                    onChange={(e) => updateActiveTab({ sellingPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full px-3 py-2 bg-[#121117] border border-[#d4af37]/50 rounded-xl text-xs font-bold text-[#d4af37]"
                  />
                </div>
                <div className="text-[11px] text-[#a8a29e] flex items-center">
                  * Se creará en la categoría "{activeTab.category}" y descontará 1 unidad de este artículo por cada venta.
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer con Botones de Acción */}
        <div className="p-4 border-t border-[#2d281e] bg-[#16151c] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#383124] text-xs font-bold text-[#a8a29e] hover:bg-[#1a1922] cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleSaveActiveTab}
              disabled={activeTab.saveStatus === 'saving'}
              className="px-4 py-2.5 rounded-xl bg-[#2b2416] border border-[#d4af37]/60 text-[#d4af37] text-xs font-bold hover:brightness-110 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Este Artículo</span>
            </button>

            {tabs.length > 1 && (
              <button
                type="button"
                onClick={handleSaveAllTabs}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs hover:brightness-110 shadow-lg cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Guardar Todas las Pestañas ({tabs.length})</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
