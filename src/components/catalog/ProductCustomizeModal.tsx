import React, { useState, useMemo } from 'react';
import {
  Product,
  ProductVariant,
  ModifierGroup,
  ModifierOption,
  ProductAdjustment,
  SelectedModifierDetail,
  CustomizedItemSelection,
} from '../../types';
import {
  calculateCustomizedProductPrice,
  validateAllModifierGroups,
  formatProductPrice,
  calculateEffectiveRecipe,
} from '../../utils/productUtils';
import { useToast } from '../../context/ToastContext';
import { useRestaurant } from '../../context/RestaurantContext';
import {
  X,
  Plus,
  Minus,
  Check,
  Flame,
  Clock,
  Sparkles,
  Layers,
  ShoppingBag,
  Info,
  AlertCircle,
  Tag,
  Percent,
  DollarSign,
  Edit3,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';

export interface ProductCustomizeModalProps {
  product: Product;
  modifierGroups?: ModifierGroup[];
  initialItem?: CustomizedItemSelection | null;
  onClose: () => void;
  onAddToCart?: (customizedItem: CustomizedItemSelection) => void;
}

export const ProductCustomizeModal: React.FC<ProductCustomizeModalProps> = ({
  product,
  modifierGroups = [],
  initialItem = null,
  onClose,
  onAddToCart,
}) => {
  const { showToast } = useToast();
  const { products } = useRestaurant();

  // Active photo in gallery
  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);

  // Selected Variant (defaults to default variant or first variant)
  const defaultVariant =
    initialItem?.variant ||
    product.variants?.find((v) => v.isDefault) ||
    product.variants?.[0] ||
    null;
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(defaultVariant);

  // Combine product's featureGroups and relevant global modifierGroups
  const allGroups = useMemo(() => {
    const combined: ModifierGroup[] = [];
    const seenIds = new Set<string>();

    if (product.featureGroups && product.featureGroups.length > 0) {
      for (const fg of product.featureGroups) {
        if (fg.isActive !== false) {
          combined.push(fg);
          seenIds.add(fg.id);
        }
      }
    }

    const relevantGlobal = modifierGroups.filter(
      (g) =>
        g.isActive &&
        !seenIds.has(g.id) &&
        (product.modifierGroupIds?.includes(g.id) ||
          g.appliesToCategoryIds?.includes(product.categoryId) ||
          g.appliesToProductIds?.includes(product.id))
    );

    return [...combined, ...relevantGlobal];
  }, [product, modifierGroups]);

  // Initial modifier selections state
  // State 1: selectedOptionIds: { [groupId]: string[] }
  // State 2: optionQuantities: { [groupId_optionId]: number }
  // State 3: optionTexts: { [groupId_optionId]: string }
  const [selectedModifierIds, setSelectedModifierIds] = useState<Record<string, string[]>>(() => {
    if (initialItem?.selectedModifiers && initialItem.selectedModifiers.length > 0) {
      const initMap: Record<string, string[]> = {};
      for (const m of initialItem.selectedModifiers) {
        if (!initMap[m.groupId]) initMap[m.groupId] = [];
        if (!initMap[m.groupId].includes(m.optionId)) {
          initMap[m.groupId].push(m.optionId);
        }
      }
      return initMap;
    }

    const initial: Record<string, string[]> = {};
    for (const group of allGroups) {
      const defaultOpt = group.options.find((o) => o.isDefault && o.isActive);
      if (defaultOpt) {
        initial[group.id] = [defaultOpt.id];
      } else if (group.isRequired && group.minSelections > 0 && group.options.length > 0) {
        if (group.selectionType === 'single') {
          initial[group.id] = [group.options[0].id];
        }
      }
    }
    return initial;
  });

  const [optionQuantities, setOptionQuantities] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    if (initialItem?.selectedModifiers) {
      for (const m of initialItem.selectedModifiers) {
        if (m.quantity && m.quantity > 1) {
          map[`${m.groupId}_${m.optionId}`] = m.quantity;
        }
      }
    }
    return map;
  });

  const [optionTexts, setOptionTexts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (initialItem?.selectedModifiers) {
      for (const m of initialItem.selectedModifiers) {
        if (m.textValue) {
          map[`${m.groupId}_${m.optionId}`] = m.textValue;
        }
      }
    }
    return map;
  });

  // Combo Swaps
  const [comboSwaps, setComboSwaps] = useState<Record<string, string>>(() => {
    if (!initialItem?.comboSwaps) return {};
    if (Array.isArray(initialItem.comboSwaps)) {
      const map: Record<string, string> = {};
      for (const item of initialItem.comboSwaps) {
        map[item.componentRuleId] = item.selectedProductId;
      }
      return map;
    }
    return initialItem.comboSwaps as Record<string, string>;
  });

  // Quantity and Notes
  const [quantity, setQuantity] = useState<number>(initialItem?.quantity || 1);
  const [notes, setNotes] = useState<string>(initialItem?.notes || '');

  // Commercial Adjustments (Discounts & Surcharges line items)
  const [adjustments, setAdjustments] = useState<ProductAdjustment[]>(initialItem?.adjustments || []);
  const [showAddAdjustment, setShowAddAdjustment] = useState<boolean>(false);
  const [adjType, setAdjType] = useState<'descuento' | 'recargo'>('descuento');
  const [adjModality, setAdjModality] = useState<'fijo' | 'porcentaje'>('fijo');
  const [adjValue, setAdjValue] = useState<number>(0);
  const [adjConcept, setAdjConcept] = useState<string>('');

  // Selected modifier option details for price calculation
  const selectedDetailsList = useMemo(() => {
    const list: SelectedModifierDetail[] = [];
    for (const group of allGroups) {
      const ids = selectedModifierIds[group.id] || [];
      for (const id of ids) {
        const opt = group.options.find((o) => o.id === id);
        if (opt) {
          const qtyKey = `${group.id}_${opt.id}`;
          const txtKey = `${group.id}_${opt.id}`;
          list.push({
            groupId: group.id,
            groupName: group.name,
            optionId: opt.id,
            optionName: opt.name,
            priceSurcharge: opt.priceSurcharge || 0,
            quantity: optionQuantities[qtyKey] || 1,
            textValue: optionTexts[txtKey] || undefined,
            ingredientType: opt.ingredientType,
            ingredientId: opt.ingredientId,
            ingredientQuantity: opt.ingredientQuantity,
            ingredientAction: opt.ingredientAction,
            ingredients: opt.ingredients,
          });
        }
      }
    }
    return list;
  }, [allGroups, selectedModifierIds, optionQuantities, optionTexts]);

  // Combo swap surcharges
  const swapSurchargesList = useMemo(() => {
    if (!product.isCombo || !product.comboConfig) return [];
    const surcharges: number[] = [];
    for (const comp of product.comboConfig.components) {
      const selectedSwapId = comboSwaps[comp.id];
      if (selectedSwapId && selectedSwapId !== comp.defaultProductId) {
        const swap = comp.allowedSwaps.find((s) => s.productId === selectedSwapId);
        if (swap && swap.priceSurcharge > 0) {
          surcharges.push(swap.priceSurcharge);
        }
      }
    }
    return surcharges;
  }, [product, comboSwaps]);

  // Price Breakdown
  const priceBreakdown = useMemo(() => {
    return calculateCustomizedProductPrice(
      product.price,
      selectedVariant,
      selectedDetailsList,
      swapSurchargesList,
      quantity,
      adjustments
    );
  }, [product.price, selectedVariant, selectedDetailsList, swapSurchargesList, quantity, adjustments]);

  // Validation
  const validation = useMemo(() => {
    return validateAllModifierGroups(allGroups, selectedModifierIds);
  }, [allGroups, selectedModifierIds]);

  // Toggle option selection
  const handleToggleOption = (group: ModifierGroup, option: ModifierOption) => {
    setSelectedModifierIds((prev) => {
      const current = prev[group.id] || [];
      if (group.selectionType === 'single') {
        return {
          ...prev,
          [group.id]: [option.id],
        };
      } else {
        if (current.includes(option.id)) {
          return {
            ...prev,
            [group.id]: current.filter((id) => id !== option.id),
          };
        } else {
          if (current.length >= group.maxSelections) {
            showToast(
              `Solo puedes seleccionar hasta ${group.maxSelections} opciones en ${group.name}`,
              'warning'
            );
            return prev;
          }
          return {
            ...prev,
            [group.id]: [...current, option.id],
          };
        }
      }
    });
  };

  const handleOptionQtyChange = (group: ModifierGroup, option: ModifierOption, delta: number) => {
    const key = `${group.id}_${option.id}`;
    const currentQty = optionQuantities[key] || 1;
    const newQty = Math.max(1, currentQty + delta);

    setOptionQuantities((prev) => ({ ...prev, [key]: newQty }));

    // Auto-select option if not selected
    setSelectedModifierIds((prev) => {
      const current = prev[group.id] || [];
      if (!current.includes(option.id)) {
        return { ...prev, [group.id]: [...current, option.id] };
      }
      return prev;
    });
  };

  // Adjustments handling
  const handleAddAdjustment = () => {
    if (adjValue <= 0) {
      showToast('Ingresa un valor de ajuste mayor a 0', 'warning');
      return;
    }
    const newAdj: ProductAdjustment = {
      id: `adj-${Date.now()}`,
      type: adjType,
      modality: adjModality,
      value: Number(adjValue),
      concept: adjConcept.trim() || (adjType === 'descuento' ? 'Descuento especial' : 'Recargo por servicio'),
      calculatedAmount:
        adjModality === 'porcentaje'
          ? Math.round(priceBreakdown.subtotalBeforeAdjustments * (adjValue / 100))
          : adjValue,
    };

    setAdjustments([...adjustments, newAdj]);
    setAdjValue(0);
    setAdjConcept('');
    setShowAddAdjustment(false);
    showToast(`${adjType === 'descuento' ? 'Descuento' : 'Recargo'} aplicado al producto`, 'success');
  };

  const handleRemoveAdjustment = (id: string) => {
    setAdjustments(adjustments.filter((a) => a.id !== id));
  };

  // Handle confirm selection
  const handleConfirm = () => {
    if (!validation.isValid) {
      showToast(validation.errors[0] || 'Por favor completa las opciones requeridas', 'error');
      return;
    }

    const effectiveRecipe = calculateEffectiveRecipe(product.recipe || [], selectedDetailsList, products);

    const customizedItem: CustomizedItemSelection = {
      lineItemId: initialItem?.lineItemId || `line-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      productId: product.id,
      productName: product.name,
      basePrice: product.price,
      variant: selectedVariant,
      selectedModifiers: selectedDetailsList,
      comboSwaps,
      quantity,
      adjustments,
      notes: notes.trim(),
      unitPrice: priceBreakdown.unitPrice,
      totalPrice: priceBreakdown.totalPrice,
      prepStationId: product.prepStationId,
      effectiveRecipe,
    };

    if (onAddToCart) {
      onAddToCart(customizedItem);
    }

    showToast(
      `¡${product.name}${selectedVariant ? ` (${selectedVariant.name})` : ''} configurado correctamente! Total: ${formatProductPrice(
        priceBreakdown.totalPrice
      )}`,
      'success'
    );
    onClose();
  };

  const hasCustomImages = Boolean(product.images && product.images.length > 0);
  const images = hasCustomImages ? product.images! : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#121117] border border-[#3f3521] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-[#faf5ee]">
        {/* Header Modal Bar */}
        <div className="px-6 py-4 border-b border-[#2d281e] bg-gradient-to-r from-[#1a1722] via-[#16141d] to-[#121117] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-2xl bg-[#2a2213] border border-[#d4af37]/50 text-[#d4af37] flex items-center justify-center font-bold shadow">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-black text-[#fef3c7] leading-tight">
                {initialItem ? 'Editar Detalles del Producto' : 'Personalizar Producto / Agregar con Detalles'}
              </h2>
              <p className="text-xs text-[#a8a29e] flex items-center gap-1.5 mt-0.5">
                <span>{product.name}</span>
                <span>· SKU:</span>
                <span className="sku-badge px-1.5 py-0.5 rounded font-mono font-bold text-[#d4af37] bg-[#292212] border border-[#B77900]/40">
                  {product.sku}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#24222e] hover:bg-[#322f3f] text-[#a8a29e] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Gallery & Description Hero */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5 flex flex-col gap-2">
              <div className="relative h-40 rounded-2xl overflow-hidden bg-[#18171f] border border-[#2d281e] flex items-center justify-center">
                {hasCustomImages ? (
                  <img
                    src={images[activePhotoIdx] || images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-500">
                    <UtensilsCrossed className="w-10 h-10 mb-1 opacity-40 text-[#d4af37]" />
                    <span className="text-xs font-medium text-zinc-400">Sin fotografía asignada</span>
                  </div>
                )}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-sm text-[10px] text-[#fef3c7] flex items-center gap-1 border border-white/10">
                  <Clock className="w-3 h-3 text-[#d4af37]" />
                  <span>{product.prepTimeMinutes || 15} min prep</span>
                </div>
              </div>

              {images.length > 1 && (
                <div className="flex items-center gap-2">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActivePhotoIdx(i)}
                      className={`h-11 w-14 rounded-lg overflow-hidden border transition-all ${
                        activePhotoIdx === i
                          ? 'border-[#d4af37] scale-105 shadow-md'
                          : 'border-zinc-700 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-7 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black text-[#fef3c7] mb-1">{product.name}</h3>
                <p className="text-xs text-[#a8a29e] leading-relaxed mb-3">
                  {product.description || 'Plato gastronómico preparado con insumos frescos de alta calidad.'}
                </p>

                {product.isCombo && product.comboConfig && (
                  <div className="p-3 rounded-xl bg-gradient-to-br from-[#2a2213] to-[#1c1810] border border-[#d4af37]/40 text-xs mb-3">
                    <div className="flex items-center justify-between font-bold text-[#d4af37] mb-0.5">
                      <span>COMBO ESPECIAL COLMENA</span>
                      <span className="text-emerald-400">
                        ¡Ahorras {formatProductPrice(product.comboConfig.savingsCOP || 0)}!
                      </span>
                    </div>
                    <p className="text-[11px] text-[#a8a29e]">
                      Suma individual: {formatProductPrice(product.comboConfig.individualItemsSum || 0)}
                    </p>
                  </div>
                )}
              </div>

              {/* Base Price Badge */}
              <div className="p-3 rounded-xl bg-[#1a1922] border border-[#383124] flex items-center justify-between">
                <span className="text-xs text-[#a8a29e] font-medium">Precio Base:</span>
                <span className="text-base font-black text-[#d4af37]">
                  {formatProductPrice(product.price)}
                </span>
              </div>
            </div>
          </div>

          {/* 1. SECCIÓN DE VARIANTES */}
          {product.variants && product.variants.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#fef3c7]">
                  <Layers className="w-4 h-4 text-[#d4af37]" />
                  <span>Selecciona el Tamaño / Variante</span>
                </div>
                <span className="text-[10px] font-bold text-[#d4af37] bg-[#2b2416] px-2.5 py-0.5 rounded-full border border-[#d4af37]/40">
                  Requerido (1)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {product.variants.map((variant) => {
                  const isSelected = selectedVariant?.id === variant.id;
                  const finalVarPrice = product.price + variant.priceAdjustment;

                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariant(variant)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#2b2416] border-[#d4af37] text-white shadow-md'
                          : 'bg-[#121117] border-[#2d281e] text-[#a8a29e] hover:border-[#383124]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold">{variant.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#d4af37]" />}
                      </div>
                      <div className="text-xs font-black text-[#d4af37]">
                        {formatProductPrice(finalVarPrice)}
                      </div>
                      {variant.priceAdjustment !== 0 && (
                        <span className="text-[10px] text-[#a8a29e]">
                          ({variant.priceAdjustment > 0 ? '+' : ''}
                          {formatProductPrice(variant.priceAdjustment)})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. SECCIÓN DE COMBOS (REGLAS DE SWAP / ACOMPAÑAMIENTOS) */}
          {product.isCombo && product.comboConfig && product.comboConfig.components && (
            <div className="p-4 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-3 shadow-md">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#fef3c7]">
                <Sparkles className="w-4 h-4 text-[#d4af37]" />
                <span>Componentes del Combo & Cambios</span>
              </div>

              <div className="space-y-3">
                {product.comboConfig.components.map((comp) => {
                  const currentSelected = comboSwaps[comp.id] || comp.defaultProductId;
                  return (
                    <div
                      key={comp.id}
                      className="p-3 rounded-xl bg-[#121117] border border-[#2d281e] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#d4af37] block">
                          {comp.roleName}
                        </span>
                        <span className="text-xs font-bold text-[#fef3c7]">
                          {comp.defaultProductName}
                        </span>
                      </div>

                      {comp.allowedSwaps && comp.allowedSwaps.length > 0 && (
                        <select
                          value={currentSelected}
                          onChange={(e) =>
                            setComboSwaps((prev) => ({
                              ...prev,
                              [comp.id]: e.target.value,
                            }))
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[#18171f] border border-[#383124] text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                        >
                          <option value={comp.defaultProductId}>
                            {comp.defaultProductName} (Incluido $0)
                          </option>
                          {comp.allowedSwaps.map((swap) => (
                            <option key={swap.productId} value={swap.productId}>
                              {swap.productName}{' '}
                              {swap.priceSurcharge > 0
                                ? `(+ ${formatProductPrice(swap.priceSurcharge)})`
                                : '(Sin recargo)'}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. SECCIÓN DE ADICIONALES Y CARACTERÍSTICAS DEL PRODUCTO */}
          {allGroups.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black text-[#d4af37] uppercase tracking-wider">
                Características & Opciones del Producto
              </h3>

              {allGroups.map((group) => {
                const currentSelections = selectedModifierIds[group.id] || [];
                const isSingle = group.selectionType === 'single';
                const isQuantityType = group.selectionType === 'quantity';
                const isTextType = group.selectionType === 'text';

                return (
                  <div
                    key={group.id}
                    className="p-4 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-3 shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#fef3c7]">
                            {group.name}
                          </span>
                          {group.isRequired && (
                            <span className="text-[9px] bg-red-950 text-red-300 border border-red-800/80 px-1.5 py-0.2 rounded font-bold">
                              Obligatorio
                            </span>
                          )}
                        </div>
                        {group.description && (
                          <p className="text-[11px] text-[#a8a29e] mt-0.5">{group.description}</p>
                        )}
                      </div>

                      <span className="text-[10px] text-[#a8a29e] bg-[#121117] px-2.5 py-0.5 rounded-full border border-[#2d281e]">
                        {isSingle
                          ? 'Elige 1'
                          : isQuantityType
                          ? 'Por cantidad'
                          : isTextType
                          ? 'Indicación libre'
                          : `Elige min ${group.minSelections} - max ${group.maxSelections} (${currentSelections.length}/${group.maxSelections})`}
                      </span>
                    </div>

                    {/* Options list */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.options.map((option) => {
                        const isSelected = currentSelections.includes(option.id);
                        const optQty = optionQuantities[`${group.id}_${option.id}`] || 1;

                        return (
                          <div
                            key={option.id}
                            className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between ${
                              isSelected
                                ? 'bg-[#2b2416] border-[#d4af37] text-white shadow-sm'
                                : 'bg-[#121117] border-[#2d281e] text-[#a8a29e] hover:border-[#383124]'
                            }`}
                          >
                            <div
                              onClick={() => handleToggleOption(group, option)}
                              className="flex items-center justify-between cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-4 h-4 rounded-${
                                    isSingle ? 'full' : 'md'
                                  } border flex items-center justify-center ${
                                    isSelected
                                      ? 'border-[#d4af37] bg-[#d4af37] text-[#0e0e12]'
                                      : 'border-zinc-600'
                                  }`}
                                >
                                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                                <div>
                                  <span className="text-xs font-bold block">{option.name}</span>
                                  {option.description && (
                                    <span className="text-[10px] text-[#a8a29e] block">{option.description}</span>
                                  )}
                                </div>
                              </div>

                              {option.priceSurcharge > 0 && (
                                <span className="text-xs font-black text-[#d4af37]">
                                  +{formatProductPrice(option.priceSurcharge)}
                                </span>
                              )}
                            </div>

                            {/* Quantity control per option if selectionType === 'quantity' */}
                            {isQuantityType && isSelected && (
                              <div className="mt-2 pt-2 border-t border-[#3f3521] flex items-center justify-between">
                                <span className="text-[10px] text-[#a8a29e]">Cantidad de porciones:</span>
                                <div className="flex items-center gap-1 bg-[#121117] p-0.5 rounded-lg border border-[#383124]">
                                  <button
                                    type="button"
                                    onClick={() => handleOptionQtyChange(group, option, -1)}
                                    className="w-5 h-5 rounded bg-[#24222e] text-[#a8a29e] flex items-center justify-center text-xs font-bold"
                                  >
                                    -
                                  </button>
                                  <span className="text-xs font-mono font-bold px-1.5 text-[#d4af37]">
                                    {optQty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOptionQtyChange(group, option, 1)}
                                    className="w-5 h-5 rounded bg-[#d4af37] text-[#0e0e12] flex items-center justify-center text-xs font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Free text observation per option if selectionType === 'text' */}
                            {isTextType && isSelected && (
                              <div className="mt-2 pt-2 border-t border-[#3f3521]">
                                <input
                                  type="text"
                                  placeholder="Especifica indicación libre..."
                                  value={optionTexts[`${group.id}_${option.id}`] || ''}
                                  onChange={(e) =>
                                    setOptionTexts({
                                      ...optionTexts,
                                      [`${group.id}_${option.id}`]: e.target.value,
                                    })
                                  }
                                  className="w-full px-2 py-1 rounded-lg bg-[#18171f] border border-[#383124] text-[11px] text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 4. SECCIÓN "AGREGAR CON DETALLES" (DESCUENTOS Y RECARGOS POR PRODUCTO) */}
          <div className="p-4 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-3 shadow-md">
            <div className="flex items-center justify-between border-b border-[#2d281e] pb-2">
              <div>
                <h3 className="text-xs font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-4 h-4" />
                  <span>Detalles de Venta y Ajustes del Producto</span>
                </h3>
                <p className="text-[11px] text-[#a8a29e]">
                  Aplica descuentos, recargos u observaciones individuales a este producto
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddAdjustment(!showAddAdjustment)}
                className="px-3 py-1.5 rounded-xl bg-[#2b2416] border border-[#d4af37]/60 text-[#d4af37] text-xs font-bold hover:brightness-110 cursor-pointer flex items-center gap-1 shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Ajuste Comercial</span>
              </button>
            </div>

            {/* Form to add adjustment */}
            {showAddAdjustment && (
              <div className="p-3.5 rounded-xl bg-[#121117] border border-[#4d3d19] space-y-3 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-[#a8a29e] block mb-1">Tipo de Ajuste</label>
                    <select
                      value={adjType}
                      onChange={(e) => setAdjType(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 bg-[#18171f] border border-[#383124] rounded-lg text-xs text-[#fef3c7]"
                    >
                      <option value="descuento">Descuento (-)</option>
                      <option value="recargo">Recargo (+)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#a8a29e] block mb-1">Modalidad</label>
                    <select
                      value={adjModality}
                      onChange={(e) => setAdjModality(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 bg-[#18171f] border border-[#383124] rounded-lg text-xs text-[#fef3c7]"
                    >
                      <option value="fijo">Valor Fijo ($ COP)</option>
                      <option value="porcentaje">Porcentaje (%)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#a8a29e] block mb-1">
                      Valor ({adjModality === 'fijo' ? '$ COP' : '%'})
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={adjValue}
                      onChange={(e) => setAdjValue(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-[#18171f] border border-[#383124] rounded-lg text-xs text-[#d4af37] font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[#a8a29e] block mb-1">Concepto / Motivo</label>
                  <input
                    type="text"
                    placeholder="Ej: Cortesía del chef, Empaque especial, Descuento empleado..."
                    value={adjConcept}
                    onChange={(e) => setAdjConcept(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#18171f] border border-[#383124] rounded-lg text-xs text-[#fef3c7]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddAdjustment(false)}
                    className="px-3 py-1 rounded-lg bg-[#24222e] text-[#a8a29e] text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAddAdjustment}
                    className="px-4 py-1 rounded-lg bg-[#d4af37] text-[#0e0e12] font-black text-xs hover:brightness-110 shadow"
                  >
                    Aplicar Ajuste
                  </button>
                </div>
              </div>
            )}

            {/* List of active adjustments */}
            {adjustments.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">
                  Ajustes Aplicados:
                </span>
                {adjustments.map((adj) => (
                  <div
                    key={adj.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#121117] border border-[#2d281e] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                          adj.type === 'descuento'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {adj.type}
                      </span>
                      <span className="font-bold text-[#fef3c7]">{adj.concept}</span>
                      <span className="text-[11px] text-[#a8a29e]">
                        ({adj.modality === 'porcentaje' ? `${adj.value}%` : formatProductPrice(adj.value)})
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono font-bold ${
                          adj.type === 'descuento' ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {adj.type === 'descuento' ? '-' : '+'}{' '}
                        {formatProductPrice(
                          adj.modality === 'porcentaje'
                            ? Math.round(priceBreakdown.subtotalBeforeAdjustments * (adj.value / 100))
                            : adj.value
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAdjustment(adj.id)}
                        className="text-red-400 hover:text-red-300 cursor-pointer p-0.5"
                        title="Quitar ajuste"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. NOTAS ESPECIALES PARA COCINA / COMANDA */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#fef3c7]">
              Instrucciones / Notas para la Cocina (Opcional):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Pan bien dorado, salsas servidas por aparte, sin picante..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#1a1922] border border-[#2d281e] text-xs text-white placeholder-[#78716c] focus:outline-none focus:border-[#d4af37]"
            />
          </div>
        </div>

        {/* Footer: Price Counter & Confirm CTA */}
        <div className="p-4 border-t border-[#2d281e] bg-[#16151c] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between">
            {/* Quantity Controls */}
            <div className="flex items-center gap-1.5 bg-[#121117] border border-[#383124] p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-lg bg-[#24222e] text-white flex items-center justify-center hover:bg-[#322f3f] cursor-pointer font-black"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-black font-mono text-[#fef3c7]">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-8 h-8 rounded-lg bg-[#2b2416] text-[#d4af37] flex items-center justify-center hover:bg-[#d4af37] hover:text-[#0e0e12] cursor-pointer font-black transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Total Price Breakdown */}
            <div className="text-right">
              <div className="text-[10px] text-[#a8a29e]">Precio Unitario: {formatProductPrice(priceBreakdown.unitPrice)}</div>
              <div className="text-base font-black text-[#d4af37]">
                Total: {formatProductPrice(priceBreakdown.totalPrice)}
              </div>
            </div>
          </div>

          {/* Validation Warnings / Button */}
          <div className="w-full sm:w-auto flex items-center gap-2">
            {!validation.isValid && (
              <span className="text-[11px] text-amber-400 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Completa campos obligatorios</span>
              </span>
            )}

            <button
              type="button"
              onClick={handleConfirm}
              disabled={!validation.isValid}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                validation.isValid
                  ? 'bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] hover:brightness-110 active:scale-95 shadow-[#d4af37]/20'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Confirmar Selección ({formatProductPrice(priceBreakdown.totalPrice)})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
