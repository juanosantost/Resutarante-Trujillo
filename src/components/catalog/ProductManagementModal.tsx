import React, { useState } from 'react';
import {
  Product,
  Category,
  PrepStation,
  ModifierGroup,
  ModifierOption,
  ProductVariant,
  ProductStatus,
  ComboConfig,
  ComboComponentRule,
  RecipeIngredient,
} from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatProductPrice } from '../../utils/productUtils';
import { formatCOP } from '../../utils/calculations';
import { InventoryItemModal } from '../inventory/InventoryItemModal';
import { sanitizeFirestoreData } from '../../services/firebase';
import {
  X,
  Plus,
  Trash2,
  Image as ImageIcon,
  Flame,
  Clock,
  Sparkles,
  Layers,
  Save,
  Check,
  AlertCircle,
  HelpCircle,
  Boxes,
  Barcode,
  Calculator,
  PlusCircle,
  Sliders,
  Edit,
} from 'lucide-react';

interface ProductManagementModalProps {
  product?: Product | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ProductManagementModal: React.FC<ProductManagementModalProps> = ({
  product,
  onClose,
  onSuccess,
}) => {
  const isEditing = Boolean(product);
  const {
    catalogCategories,
    prepStations,
    modifierGroups,
    products,
    inventory,
    createProduct,
    updateProduct,
    deleteProduct,
    actionLoading,
  } = useRestaurant();
  const { branches, currentBranch } = useAuth();
  const { showToast } = useToast();

  // Informacion Basica y Comercial
  const [name, setName] = useState<string>(product?.name || '');
  const [description, setDescription] = useState<string>(product?.description || '');
  const [categoryId, setCategoryId] = useState<string>(
    product?.categoryId || catalogCategories[0]?.id || 'cat-hamburguesas'
  );
  const [price, setPrice] = useState<number>(product?.price || 25000);
  const [sku, setSku] = useState<string>(product?.sku || `PRD-${Math.floor(100 + Math.random() * 900)}`);
  const [reference, setReference] = useState<string>(product?.reference || '');
  const [barcode, setBarcode] = useState<string>(product?.barcode || '');
  const [size, setSize] = useState<string>(product?.size || '');
  const [color, setColor] = useState<string>(product?.color || '');
  const [unit, setUnit] = useState<string>(product?.unit || 'und');
  const [observations, setObservations] = useState<string>(product?.observations || '');

  const [prepStationId, setPrepStationId] = useState<string>(
    product?.prepStationId || prepStations[0]?.id || 'st-cocina-caliente'
  );
  const [prepTimeMinutes, setPrepTimeMinutes] = useState<number>(product?.prepTimeMinutes || 15);
  const [branchId, setBranchId] = useState<string>(product?.branchId || 'all');
  const [status, setStatus] = useState<ProductStatus>(product?.status || 'activo');

  // Disponibilidad
  const [isAvailableForSale, setIsAvailableForSale] = useState<boolean>(
    product?.isAvailableForSale ?? true
  );
  const [isAvailableForDelivery, setIsAvailableForDelivery] = useState<boolean>(
    product?.isAvailableForDelivery ?? true
  );
  const [isVisibleInMenu, setIsVisibleInMenu] = useState<boolean>(
    product?.isVisibleInMenu ?? true
  );

  // Fotografías (sin fotos por defecto para nuevos productos)
  const [images, setImages] = useState<string[]>(
    product?.images && product.images.length > 0 ? product.images.slice(0, 3) : []
  );
  const [newImageUrl, setNewImageUrl] = useState<string>('');

  // Composición del Producto (Receta de Inventario)
  const [recipe, setRecipe] = useState<RecipeIngredient[]>(product?.recipe || []);
  const [selectedInvId, setSelectedInvId] = useState<string>('');
  const [selectedInvQty, setSelectedInvQty] = useState<number>(1);

  // Modal para crear artículo de inventario al vuelo
  const [isCreatingItem, setIsCreatingItem] = useState<boolean>(false);

  // Variantes
  const [variants, setVariants] = useState<ProductVariant[]>(product?.variants || []);

  // Modificadores y Grupos de Características
  const [selectedModifierGroupIds, setSelectedModifierGroupIds] = useState<string[]>(
    product?.modifierGroupIds || []
  );
  const [featureGroups, setFeatureGroups] = useState<ModifierGroup[]>(
    product?.featureGroups || []
  );

  // Combo
  const [isCombo, setIsCombo] = useState<boolean>(Boolean(product?.isCombo));
  const [commercialPrice, setCommercialPrice] = useState<number>(
    product?.comboConfig?.commercialPrice || price || 35000
  );
  const [comboComponents, setComboComponents] = useState<ComboComponentRule[]>(
    product?.comboConfig?.components || []
  );

  // Cálculo de Costo Estimado y Margen Bruto
  const estimatedCost = recipe.reduce((sum, ing) => {
    const invItem = inventory.find((i) => i.id === ing.inventoryItemId);
    const unitCost = invItem ? invItem.costPerUnit : 0;
    return sum + ing.quantity * unitCost;
  }, 0);

  const grossProfit = price - estimatedCost;
  const marginPercentage = price > 0 ? Math.round((grossProfit / price) * 100) : 0;

  // Agregar / Eliminar Imagen
  const handleAddImage = () => {
    if (!newImageUrl.trim()) return;
    if (images.length >= 3) {
      showToast('Se permite un máximo de 3 fotografías por producto', 'warning');
      return;
    }
    setImages([...images, newImageUrl.trim()]);
    setNewImageUrl('');
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  // Agregar / Eliminar Insumo a la Composición
  const handleAddIngredient = () => {
    if (!selectedInvId) {
      showToast('Selecciona un artículo de inventario', 'warning');
      return;
    }
    const invItem = inventory.find((i) => i.id === selectedInvId);
    if (!invItem) return;

    const qty = Number(selectedInvQty) || 0;
    if (qty <= 0) {
      showToast('La cantidad debe ser mayor a 0', 'warning');
      return;
    }

    const existingIdx = recipe.findIndex((r) => r.inventoryItemId === selectedInvId);
    if (existingIdx >= 0) {
      const updated = [...recipe];
      updated[existingIdx].quantity += qty;
      setRecipe(updated);
    } else {
      setRecipe([
        ...recipe,
        {
          inventoryItemId: invItem.id,
          name: invItem.name,
          quantity: qty,
          unit: invItem.unit,
        },
      ]);
    }

    setSelectedInvId('');
    setSelectedInvQty(1);
  };

  const handleRemoveIngredient = (invId: string) => {
    setRecipe(recipe.filter((r) => r.inventoryItemId !== invId));
  };

  // Callback cuando se crea un artículo nuevo desde el modal de inventario
  const handleItemCreatedOnTheFly = (newItemIds: string[]) => {
    setIsCreatingItem(false);
    showToast('Artículo de inventario creado y listo para la receta', 'success');

    // Intentar agregar los nuevos artículos recién creados directamente a la composición
    if (newItemIds && newItemIds.length > 0) {
      const createdItems = inventory.filter((i) => newItemIds.includes(i.id));
      const newIngredients: RecipeIngredient[] = createdItems.map((i) => ({
        inventoryItemId: i.id,
        name: i.name,
        quantity: 1,
        unit: i.unit,
      }));

      setRecipe((prev) => {
        const existingIds = new Set(prev.map((r) => r.inventoryItemId));
        const filteredNew = newIngredients.filter((n) => !existingIds.has(n.inventoryItemId));
        return [...prev, ...filteredNew];
      });
    }
  };

  // Agregar Variante
  const handleAddVariant = () => {
    const newVariant: ProductVariant = {
      id: `var-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: 'Nueva Variante (ej: Doble)',
      sku: `${sku}-V${variants.length + 1}`,
      priceAdjustment: 0,
      isActive: true,
      isDefault: variants.length === 0,
    };
    setVariants([...variants, newVariant]);
  };

  const handleUpdateVariant = (id: string, updates: Partial<ProductVariant>) => {
    setVariants(
      variants.map((v) => {
        if (v.id === id) {
          return { ...v, ...updates };
        }
        if (updates.isDefault && v.id !== id) {
          return { ...v, isDefault: false };
        }
        return v;
      })
    );
  };

  const handleRemoveVariant = (id: string) => {
    setVariants(variants.filter((v) => v.id !== id));
  };

  const handleToggleModifierGroup = (groupId: string) => {
    setSelectedModifierGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  // Administrar Grupos de Características Específicos del Producto
  const handleAddFeatureGroup = () => {
    const newGroup: ModifierGroup = {
      id: `fg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: 'Nuevo Grupo (Ej: Término / Salsa / Acompañamiento)',
      selectionType: 'single',
      minSelections: 1,
      maxSelections: 1,
      isRequired: true,
      options: [
        {
          id: `opt-${Date.now()}-1`,
          name: 'Opción 1',
          priceSurcharge: 0,
          isActive: true,
        },
      ],
      isActive: true,
    };
    setFeatureGroups([...featureGroups, newGroup]);
  };

  const handleUpdateFeatureGroup = (groupId: string, updates: Partial<ModifierGroup>) => {
    setFeatureGroups(featureGroups.map((g) => (g.id === groupId ? { ...g, ...updates } : g)));
  };

  const handleRemoveFeatureGroup = (groupId: string) => {
    setFeatureGroups(featureGroups.filter((g) => g.id !== groupId));
  };

  const handleAddOptionToFeatureGroup = (groupId: string) => {
    setFeatureGroups(
      featureGroups.map((g) => {
        if (g.id === groupId) {
          const newOpt: ModifierOption = {
            id: `opt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: 'Nueva Opción / Adición',
            priceSurcharge: 0,
            isActive: true,
          };
          return { ...g, options: [...g.options, newOpt] };
        }
        return g;
      })
    );
  };

  const handleUpdateFeatureOption = (
    groupId: string,
    optionId: string,
    updates: Partial<ModifierOption>
  ) => {
    setFeatureGroups(
      featureGroups.map((g) => {
        if (g.id === groupId) {
          return {
            ...g,
            options: g.options.map((o) => (o.id === optionId ? { ...o, ...updates } : o)),
          };
        }
        return g;
      })
    );
  };

  const handleRemoveFeatureOption = (groupId: string, optionId: string) => {
    setFeatureGroups(
      featureGroups.map((g) => {
        if (g.id === groupId) {
          return { ...g, options: g.options.filter((o) => o.id !== optionId) };
        }
        return g;
      })
    );
  };

  const handleAddComboComponent = () => {
    const newComp: ComboComponentRule = {
      id: `cmp-${Date.now()}`,
      roleName: 'Acompañamiento o Bebida',
      defaultProductId: products[0]?.id || 'prod-default',
      defaultProductName: products[0]?.name || 'Producto Principal',
      allowedSwaps: [],
    };
    setComboComponents([...comboComponents, newComp]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast('El nombre del producto es obligatorio', 'error');
      return;
    }
    if (price < 0) {
      showToast('El precio debe ser válido y no negativo', 'error');
      return;
    }
    // Composición de inventario es opcional (no obligatoria)

    const categoryObj = catalogCategories.find((c) => c.id === categoryId);
    const prepStationObj = prepStations.find((s) => s.id === prepStationId);

    const comboConfigData: ComboConfig | undefined = isCombo
      ? {
          id: product?.comboConfig?.id || `cfg-${Date.now()}`,
          commercialPrice,
          individualItemsSum: price,
          savingsCOP: Math.max(0, price - commercialPrice),
          components: comboComponents,
          description: `Combo especial ${name}`,
        }
      : undefined;

    const rawPayload: Record<string, any> = {
      name: name.trim(),
      description: description.trim(),
      categoryId,
      categoryName: categoryObj?.name || 'Gastronomía',
      price: Number(price),
      sku: sku.trim().toUpperCase(),
      unit: unit.trim() || 'und',
      images: images.slice(0, 3),
      branchId,
      prepStationId,
      prepStationCode: prepStationObj?.code || 'COC_CAL',
      prepTimeMinutes: Number(prepTimeMinutes) || 15,
      isAvailableForSale,
      isAvailableForDelivery,
      isVisibleInMenu,
      status,
      variants,
      modifierGroupIds: selectedModifierGroupIds,
      featureGroups,
      isCombo,
      recipe,
    };

    if (reference.trim()) rawPayload.reference = reference.trim();
    if (barcode.trim()) rawPayload.barcode = barcode.trim();
    if (size.trim()) rawPayload.size = size.trim();
    if (color.trim()) rawPayload.color = color.trim();
    if (observations.trim()) rawPayload.observations = observations.trim();
    if (isCombo && comboConfigData) rawPayload.comboConfig = comboConfigData;

    const payload = sanitizeFirestoreData(rawPayload) as Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;

    try {
      if (isEditing && product) {
        await updateProduct(product.id, payload);
        showToast(`Producto "${name}" actualizado exitosamente`, 'success');
      } else {
        await createProduct(payload);
        showToast(`Producto comercial "${name}" registrado en el menú`, 'success');
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast(`Error: ${err.message || 'No se pudo guardar el producto'}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#121117] border border-[#3f3521] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-[#faf5ee]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2d281e] bg-gradient-to-r from-[#1a1722] via-[#16141d] to-[#121117] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-[#2a2213] border border-[#d4af37]/50 text-[#d4af37] flex items-center justify-center font-bold">
              {isCombo ? <Boxes className="w-5 h-5" /> : <Flame className="w-5 h-5" />}
            </span>
            <div>
              <h2 className="text-base font-black text-[#fef3c7]">
                {isEditing ? 'Editar Producto Comercial de Venta' : 'Registrar Nuevo Producto Comercial de Venta'}
              </h2>
              <p className="text-xs text-[#a8a29e]">
                Gestión y Registro de Producto Comercial del Catálogo POS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#24222e] hover:bg-[#322f3f] text-[#a8a29e] hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* 1. INFORMACIÓN COMERCIAL */}
          <div className="p-4 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-4 shadow-md">
            <h3 className="text-xs font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5">
              <span>1. Información Comercial del Producto</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#fef3c7] block mb-1">
                  Nombre Comercial del Producto *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Hamburguesa Colmena Especial, Combo Costillas BBQ..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#121117] border border-[#2d281e] text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#fef3c7] block mb-1">
                  Código de Barras / SKU *
                </label>
                <input
                  type="text"
                  required
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  placeholder="Ej: HBG-COL-001"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#121117] border border-[#2d281e] text-xs font-mono text-[#d4af37] focus:outline-none focus:border-[#d4af37]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">Referencia</label>
                <input
                  type="text"
                  placeholder="Ej: REF-302"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">Código QR / Alt</label>
                <input
                  type="text"
                  placeholder="Ej: QR-HBG01"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7] font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">Talla / Porción</label>
                <input
                  type="text"
                  placeholder="Ej: Mediana, 250g..."
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">Color / Término</label>
                <input
                  type="text"
                  placeholder="Ej: Dorado, 3/4..."
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#fef3c7] block mb-1">
                Descripción para el Menú
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción gastronómica para atraer al cliente..."
                className="w-full px-3.5 py-2 rounded-xl bg-[#121117] border border-[#2d281e] text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-[#fef3c7] block mb-1">
                  Categoría del Menú *
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#121117] border border-[#2d281e] text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                >
                  {catalogCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#fef3c7] block mb-1">
                  Precio de Venta Comercial (COP) *
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  step={500}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#121117] border border-[#d4af37]/60 text-xs font-bold text-[#d4af37] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#fef3c7] block mb-1">
                  Estación de Preparación *
                </label>
                <select
                  value={prepStationId}
                  onChange={(e) => setPrepStationId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#121117] border border-[#2d281e] text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                >
                  {prepStations.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. COMPOSICIÓN DEL PRODUCTO DE VENTA (RECETA DE INVENTARIO) */}
          <div className="p-4 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-4 shadow-md">
            <div className="flex items-center justify-between border-b border-[#2d281e] pb-2">
              <div>
                <h3 className="text-xs font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5">
                  <Calculator className="w-4 h-4" />
                  <span>2. Composición de Inventario del Producto (Opcional)</span>
                </h3>
                <p className="text-[11px] text-[#a8a29e]">
                  Opcional: Si este producto descuenta insumos de bodega por cada unidad vendida, agrégalos aquí.
                </p>
              </div>

              {/* Botón para crear artículo al vuelo */}
              <button
                type="button"
                onClick={() => setIsCreatingItem(true)}
                className="px-3 py-1.5 rounded-xl bg-[#2b2416] border border-[#d4af37]/60 text-[#d4af37] text-xs font-bold hover:brightness-110 cursor-pointer flex items-center gap-1.5 shadow"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Crear artículo de inventario</span>
              </button>
            </div>

            {/* Controles para Agregar Insumo a la Composición */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <select
                value={selectedInvId}
                onChange={(e) => setSelectedInvId(e.target.value)}
                className="flex-1 w-full px-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
              >
                <option value="">-- Seleccionar artículo de inventario a descontar --</option>
                {inventory.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name} (Stock: {inv.currentStock} {inv.unit}) — Costo unit: {formatCOP(inv.costPerUnit)}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={selectedInvQty}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedInvQty(val === '' ? ('' as any) : parseFloat(val));
                  }}
                  className="w-24 px-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs font-bold text-[#fef3c7]"
                />

                <button
                  type="button"
                  onClick={handleAddIngredient}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs hover:brightness-110 cursor-pointer shadow whitespace-nowrap"
                >
                  + Agregar
                </button>
              </div>
            </div>

            {/* Lista de Artículos de la Composición */}
            {recipe.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#121117] border border-dashed border-[#2d281e] text-center text-[#78716c] text-xs">
                Sin artículos de inventario asignados (opcional). Este producto no descontará insumos de forma automática al facturarse.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-[#121117] border border-[#2d281e] space-y-2">
                  <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">
                    Artículos Configurados ({recipe.length}):
                  </span>
                  {recipe.map((ing) => {
                    const matchedInv = inventory.find((i) => i.id === ing.inventoryItemId);
                    const unitCost = matchedInv ? matchedInv.costPerUnit : 0;
                    const itemTotalCost = ing.quantity * unitCost;

                    return (
                      <div
                        key={ing.inventoryItemId}
                        className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#18171f] border border-[#24211a]"
                      >
                        <div>
                          <span className="font-bold text-[#fef3c7]">{ing.name}</span>
                          <span className="text-[10px] text-[#a8a29e] block">
                            Costo Unit: {formatCOP(unitCost)} / {ing.unit}
                          </span>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="font-mono text-[#d4af37] font-bold">
                            {ing.quantity} {ing.unit} ({formatCOP(itemTotalCost)})
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveIngredient(ing.inventoryItemId)}
                            className="text-red-400 hover:text-red-300 cursor-pointer p-1"
                            title="Quitar artículo de la receta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Resumen de Costo Estimado y Margen Bruto */}
                <div className="p-3 rounded-xl bg-[#211b11] border border-[#d4af37]/40 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[#a8a29e] block text-[10px]">Costo Estimado Composición:</span>
                    <span className="font-mono font-bold text-red-400 text-sm">
                      {formatCOP(estimatedCost)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[#a8a29e] block text-[10px]">Precio Venta Comercial:</span>
                    <span className="font-mono font-bold text-[#d4af37] text-sm">
                      {formatCOP(price)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[#a8a29e] block text-[10px]">Utilidad Bruta Estimada:</span>
                    <span className={`font-mono font-bold text-sm ${grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCOP(grossProfit)} ({marginPercentage}%)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. FOTOGRAFÍAS (HASTA TRES) */}
          <div className="p-4 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>3. Fotografías Comerciales (Opcional, hasta 3)</span>
              </h3>
              <span className="text-[10px] text-[#a8a29e]">
                {images.length}/3 fotos
              </span>
            </div>

            {images.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#121117] border border-dashed border-[#2d281e] text-center text-xs flex flex-col items-center justify-center gap-1.5 text-[#a8a29e]">
                <ImageIcon className="w-6 h-6 opacity-40 text-[#d4af37]" />
                <span className="font-semibold text-[#fef3c7]">No hay fotografías cargadas por defecto</span>
                <span className="text-[11px] text-[#78716c]">
                  Si deseas agregar una foto comercial, ingresa la URL a continuación. De lo contrario, se usará el icono predeterminado.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {images.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-xl overflow-hidden h-24 bg-[#121117] border border-[#2d281e]"
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-900/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-white">
                      Foto {idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {images.length < 3 && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="URL de fotografía del producto comercial..."
                  className="flex-1 px-3.5 py-2 rounded-xl bg-[#121117] border border-[#2d281e] text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                />
                <button
                  type="button"
                  onClick={handleAddImage}
                  className="px-3.5 py-2 rounded-xl bg-[#2b2416] border border-[#d4af37]/50 text-[#d4af37] text-xs font-bold hover:brightness-110 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir</span>
                </button>
              </div>
            )}
          </div>

          {/* 4. CARACTERÍSTICAS Y OPCIONES DEL PRODUCTO */}
          <div className="p-4 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-4 shadow-md">
            <div className="flex items-center justify-between border-b border-[#2d281e] pb-2">
              <div>
                <h3 className="text-xs font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>4. Características y Opciones del Producto</span>
                </h3>
                <p className="text-[11px] text-[#a8a29e]">
                  Configura salsas, acompañamientos, términos y adicionales que el cliente podrá seleccionar
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddFeatureGroup}
                className="px-3 py-1.5 rounded-xl bg-[#2b2416] border border-[#d4af37]/60 text-[#d4af37] text-xs font-bold hover:brightness-110 cursor-pointer flex items-center gap-1 shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Agregar Grupo</span>
              </button>
            </div>

            {featureGroups.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#121117] border border-dashed border-[#2d281e] text-center text-[#78716c] text-xs">
                No se han creado grupos de características directos para este producto. Puedes agregar uno arriba o enlazar grupos de modificadores globales.
              </div>
            ) : (
              <div className="space-y-4">
                {featureGroups.map((group) => (
                  <div
                    key={group.id}
                    className="p-3.5 rounded-xl bg-[#121117] border border-[#2d281e] space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#24211a] pb-2">
                      <input
                        type="text"
                        value={group.name}
                        onChange={(e) => handleUpdateFeatureGroup(group.id, { name: e.target.value })}
                        placeholder="Nombre del grupo (ej: Selección de salsa)"
                        className="px-3 py-1.5 bg-[#18171f] border border-[#383124] rounded-lg text-xs font-bold text-[#fef3c7] focus:outline-none focus:border-[#d4af37] flex-1"
                      />

                      <div className="flex items-center gap-2">
                        <select
                          value={group.selectionType}
                          onChange={(e) =>
                            handleUpdateFeatureGroup(group.id, {
                              selectionType: e.target.value as any,
                            })
                          }
                          className="px-2.5 py-1.5 bg-[#18171f] border border-[#383124] rounded-lg text-xs text-[#d4af37] font-bold"
                        >
                          <option value="single">Selección Única (Radio)</option>
                          <option value="multiple">Selección Múltiple (Checkbox)</option>
                          <option value="quantity">Selección por Cantidad</option>
                          <option value="text">Indicación Libre (Texto)</option>
                        </select>

                        <label className="flex items-center gap-1.5 text-xs text-[#a8a29e] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={group.isRequired}
                            onChange={(e) =>
                              handleUpdateFeatureGroup(group.id, { isRequired: e.target.checked })
                            }
                            className="w-3.5 h-3.5 rounded accent-[#d4af37]"
                          />
                          <span>Obligatorio</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => handleRemoveFeatureGroup(group.id)}
                          className="text-red-400 hover:text-red-300 p-1"
                          title="Eliminar grupo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Options list inside this group */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#a8a29e]">
                        <span>Opciones / Modificadores del Grupo:</span>
                        <button
                          type="button"
                          onClick={() => handleAddOptionToFeatureGroup(group.id)}
                          className="text-[#d4af37] hover:underline cursor-pointer font-bold"
                        >
                          + Añadir Opción
                        </button>
                      </div>

                      {group.options.map((opt) => (
                        <div
                          key={opt.id}
                          className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2 rounded-lg bg-[#18171f] border border-[#24211a] items-center"
                        >
                          <div className="sm:col-span-5">
                            <input
                              type="text"
                              value={opt.name}
                              onChange={(e) =>
                                handleUpdateFeatureOption(group.id, opt.id, {
                                  name: e.target.value,
                                })
                              }
                              placeholder="Nombre de la opción (ej: Salsa BBQ)"
                              className="w-full px-2.5 py-1 bg-[#121117] border border-[#2d281e] rounded-md text-xs text-[#fef3c7]"
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <input
                              type="number"
                              min={0}
                              value={opt.priceSurcharge}
                              onChange={(e) =>
                                handleUpdateFeatureOption(group.id, opt.id, {
                                  priceSurcharge: parseFloat(e.target.value) || 0,
                                })
                              }
                              placeholder="Recargo COP ($)"
                              className="w-full px-2.5 py-1 bg-[#121117] border border-[#2d281e] rounded-md text-xs text-[#d4af37] font-bold"
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <select
                              value={opt.ingredientId || ''}
                              onChange={(e) =>
                                handleUpdateFeatureOption(group.id, opt.id, {
                                  ingredientId: e.target.value || undefined,
                                })
                              }
                              className="w-full px-2 py-1 bg-[#121117] border border-[#2d281e] rounded-md text-[11px] text-[#a8a29e]"
                            >
                              <option value="">(Sin impacto en inventario)</option>
                              {inventory.map((inv) => (
                                <option key={inv.id} value={inv.id}>
                                  Insumo: {inv.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-1 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveFeatureOption(group.id, opt.id)}
                              className="text-red-400 hover:text-red-300 p-1"
                              title="Eliminar opción"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. ASIGNACIÓN DE GRUPOS DE MODIFICADORES GLOBALES */}
          <div className="p-4 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-3 shadow-md">
            <div className="flex items-center justify-between border-b border-[#2d281e] pb-2">
              <div>
                <h3 className="text-xs font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-4 h-4" />
                  <span>5. Grupos de Modificadores Globales Asignados</span>
                </h3>
                <p className="text-[11px] text-[#a8a29e]">
                  Selecciona los grupos de modificadores del sistema que aplican a este producto (ej. Salsas, Acompañamientos, Adiciones)
                </p>
              </div>
              <span className="text-[10px] font-bold text-[#d4af37] bg-[#2b2416] px-2.5 py-0.5 rounded-full border border-[#d4af37]/40">
                {selectedModifierGroupIds.length} seleccionados
              </span>
            </div>

            {modifierGroups.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#121117] border border-dashed border-[#2d281e] text-center text-[#78716c] text-xs">
                No hay grupos de modificadores globales creados en el sistema. Puedes crearlos desde la opción "Modificadores" del catálogo.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {modifierGroups.map((group) => {
                  const isChecked = selectedModifierGroupIds.includes(group.id);
                  return (
                    <label
                      key={group.id}
                      className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-[#2b2416] border-[#d4af37] text-white shadow-sm'
                          : 'bg-[#121117] border-[#2d281e] text-[#a8a29e] hover:border-[#383124]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleModifierGroup(group.id)}
                        className="w-4 h-4 rounded accent-[#d4af37] mt-0.5 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-[#fef3c7] block truncate">
                          {group.name}
                        </span>
                        <span className="text-[10px] text-[#a8a29e] block">
                          {group.selectionType === 'single' ? 'Selección única' : 'Selección múltiple'} · {group.options.length} opciones
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* 6. DISPONIBILIDAD Y OPCIONES OPERATIVAS */}
          <div className="p-4 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-3">
            <h3 className="text-xs font-bold text-[#d4af37] uppercase tracking-wider">
              6. Canales de Venta & Visibilidad
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#121117] border border-[#2d281e] text-xs text-[#fef3c7] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAvailableForSale}
                  onChange={(e) => setIsAvailableForSale(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#d4af37]"
                />
                <span>Disponible para Venta</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#121117] border border-[#2d281e] text-xs text-[#fef3c7] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAvailableForDelivery}
                  onChange={(e) => setIsAvailableForDelivery(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#d4af37]"
                />
                <span>Disponible Domicilio</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#121117] border border-[#2d281e] text-xs text-[#fef3c7] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isVisibleInMenu}
                  onChange={(e) => setIsVisibleInMenu(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#d4af37]"
                />
                <span>Visible POS</span>
              </label>
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-[#2d281e] flex items-center justify-between gap-3 shrink-0">
            {isEditing && product ? (
              <button
                type="button"
                disabled={actionLoading}
                onClick={async () => {
                  if (window.confirm(`¿Estás seguro de que deseas eliminar permanentemente el producto "${product.name}"?`)) {
                    try {
                      await deleteProduct(product.id);
                      showToast(`Producto "${product.name}" eliminado correctamente`, 'success');
                      onClose();
                      if (onSuccess) onSuccess();
                    } catch (err) {
                      showToast('Error al eliminar producto', 'error');
                    }
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-red-950/50 hover:bg-red-900 border border-red-800/60 text-red-300 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Producto</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-[#383124] text-xs font-bold text-[#a8a29e] hover:bg-[#1a1922] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs hover:brightness-110 active:scale-95 transition-all shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isEditing ? 'Guardar Cambios' : 'Crear Producto Comercial'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* MODAL OVERLAY PARA CREAR ARTÍCULO DE INVENTARIO SIN SALIR DEL PRODUCTO */}
      {isCreatingItem && (
        <InventoryItemModal
          onClose={() => setIsCreatingItem(false)}
          onSuccess={handleItemCreatedOnTheFly}
          defaultAlsoCreateProduct={false}
        />
      )}
    </div>
  );
};
