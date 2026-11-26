import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import {
  MenuItem,
  Order,
  Product,
  CustomizedItemSelection,
  QuickSaleVisibilityConfig,
} from '../../types';
import { formatCOP, calculateOrderTotals, getEffectiveTaxRate } from '../../utils/calculations';
import { ProductCustomizeModal } from '../catalog/ProductCustomizeModal';
import {
  buildDefaultDailyMenuItem,
  getCatalogGroupByCategoryPreference,
  groupProductsByCategories,
  sortOrderItemsByCatalogConfig,
} from '../../utils/productUtils';
import { getVisibleOrderModifiers } from '../../utils/orderModifierUtils';
import {
  filterQuickSaleCategories,
  filterQuickSaleProducts,
  isCategoryVisibleInQuickSale,
  isProductVisibleInQuickSale,
  normalizeQuickSaleConfig,
  setAllQuickSaleVisibility,
  toggleQuickSaleCategory,
  toggleQuickSaleProduct,
} from '../../utils/quickSaleConfigUtils';
import {
  X,
  Plus,
  Minus,
  Search,
  UtensilsCrossed,
  ShoppingBag,
  Flame,
  Wine,
  Cake,
  Soup,
  Trash2,
  User,
  FileText,
  Store,
  AlertCircle,
  Edit,
  Sliders,
  SlidersHorizontal,
  Zap,
  Eye,
  EyeOff,
  Check,
  Save,
  ArrowLeft,
  CreditCard,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface QuickSaleModalProps {
  onClose: () => void;
  onOrderCreatedForCheckout: (order: Order) => void;
}

export const QuickSaleModal: React.FC<QuickSaleModalProps> = ({
  onClose,
  onOrderCreatedForCheckout,
}) => {
  const {
    currentBranch,
    catalogCategories,
    menuItems,
    products,
    modifierGroups,
    quickSaleConfig,
    saveQuickSaleConfig,
    createOrder,
    actionLoading,
  } = useRestaurant();
  const { showToast } = useToast();

  const catalogScrollRef = useRef<HTMLDivElement>(null);

  // Vista activa: catálogo de venta rápida vs configuración de visibilidad
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [draftConfig, setDraftConfig] = useState<QuickSaleVisibilityConfig>(() =>
    normalizeQuickSaleConfig(quickSaleConfig)
  );
  const [configSearch, setConfigSearch] = useState<string>('');
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);

  // Estado del catálogo y carrito (destino siempre Mostrador por defecto)
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [includeTax] = useState<boolean>(() => getEffectiveTaxRate(currentBranch) > 0);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);

  const [cartItems, setCartItems] = useState<CustomizedItemSelection[]>([]);
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [editingLineItem, setEditingLineItem] = useState<CustomizedItemSelection | null>(null);

  // Sincronizar borrador cuando se abre el panel de configuración
  useEffect(() => {
    if (!isConfigOpen) {
      setDraftConfig(normalizeQuickSaleConfig(quickSaleConfig));
    }
  }, [quickSaleConfig, isConfigOpen]);

  const groupByCategory = useMemo(() => getCatalogGroupByCategoryPreference(), []);

  // Todas las categorías activas del catálogo principal
  const allExistingCategories = useMemo(() => {
    return [...(catalogCategories || [])]
      .filter((c) => c.isActive !== false && c.isVisibleInMenu !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [catalogCategories]);

  // Todos los productos activos disponibles para venta
  const allActiveProducts: MenuItem[] = useMemo(() => {
    if (products && products.length > 0) {
      const activeProds = products
        .filter((p) => p.status === 'activo' && p.isAvailableForSale !== false)
        .map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          categoryId: p.categoryId,
          price: p.price,
          station:
            p.prepStationId === 'st-parrilla'
              ? ('parrilla' as const)
              : p.prepStationId === 'st-bar-bebidas'
              ? ('bar_bebidas' as const)
              : p.prepStationId === 'st-postres'
              ? ('postres' as const)
              : ('cocina_caliente' as const),
          prepTimeMinutes: p.prepTimeMinutes || 15,
          recipe: (p.recipe as any) || [],
          isAvailable: true,
          image: p.images?.[0] || '',
          sku: p.sku,
          isDailyMenu: p.isDailyMenu,
          featureGroups: p.featureGroups,
          displayOrder: p.displayOrder,
          globalOrder: p.globalOrder,
        }));
      return sortOrderItemsByCatalogConfig(activeProds, allExistingCategories, groupByCategory, 'todos');
    }

    const fallbackList = menuItems.filter((m) => m.isAvailable !== false);
    return sortOrderItemsByCatalogConfig(fallbackList, allExistingCategories, groupByCategory, 'todos');
  }, [menuItems, products, allExistingCategories, groupByCategory]);

  // Categorías y productos visibles según la configuración de Venta Rápida
  const visibleCategories = useMemo(
    () => filterQuickSaleCategories(allExistingCategories, quickSaleConfig),
    [allExistingCategories, quickSaleConfig]
  );

  const visibleProducts = useMemo(
    () => filterQuickSaleProducts(allActiveProducts, quickSaleConfig),
    [allActiveProducts, quickSaleConfig]
  );

  // Botones de navegación por categoría (solo categorías visibles con productos visibles)
  const navCategoryButtons = useMemo(() => {
    const validIds = new Set(allExistingCategories.map((c) => c.id));
    const list = visibleCategories
      .map((c) => ({
        id: c.id,
        name: c.name,
        count: visibleProducts.filter((p) => p.categoryId === c.id).length,
      }))
      .filter((c) => c.count > 0);

    const uncategorizedCount = visibleProducts.filter(
      (p) => !p.categoryId || !validIds.has(p.categoryId)
    ).length;

    if (uncategorizedCount > 0) {
      list.push({
        id: 'sin-categoria',
        name: 'Sin Categoría',
        count: uncategorizedCount,
      });
    }

    return list;
  }, [allExistingCategories, visibleCategories, visibleProducts]);

  // Resetear categoría seleccionada si quedó oculta tras guardar configuración
  useEffect(() => {
    if (selectedCategory !== 'todos') {
      const stillExists = navCategoryButtons.some((c) => c.id === selectedCategory);
      if (!stillExists) {
        setSelectedCategory('todos');
      }
    }
  }, [navCategoryButtons, selectedCategory]);

  const filteredMenuItems = useMemo(() => {
    const validCatIds = new Set(allExistingCategories.map((c) => c.id));
    const list = visibleProducts.filter((item) => {
      if (item.isAvailable === false) return false;
      if (selectedCategory !== 'todos') {
        if (selectedCategory === 'sin-categoria') {
          if (item.categoryId && validCatIds.has(item.categoryId)) return false;
        } else if (item.categoryId !== selectedCategory) {
          return false;
        }
      }
      if (searchFilter.trim()) {
        const query = searchFilter.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(query);
        const matchDesc = (item.description || '').toLowerCase().includes(query);
        const matchSku = (item.sku || '').toLowerCase().includes(query);
        if (!matchName && !matchDesc && !matchSku) return false;
      }
      return true;
    });
    return sortOrderItemsByCatalogConfig(list, visibleCategories, groupByCategory, selectedCategory);
  }, [
    visibleProducts,
    selectedCategory,
    searchFilter,
    allExistingCategories,
    visibleCategories,
    groupByCategory,
  ]);

  const groupedMenuSections = useMemo(() => {
    return groupProductsByCategories(filteredMenuItems, visibleCategories);
  }, [filteredMenuItems, visibleCategories]);

  // Datos estructurados para el panel de configuración de visibilidad
  const configBuckets = useMemo(() => {
    const validCatIds = new Set(allExistingCategories.map((c) => c.id));
    const buckets: Array<{
      id: string;
      name: string;
      isUncategorized?: boolean;
      items: MenuItem[];
    }> = allExistingCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      items: allActiveProducts.filter((p) => p.categoryId === cat.id),
    }));

    const uncategorized = allActiveProducts.filter(
      (p) => !p.categoryId || !validCatIds.has(p.categoryId)
    );
    if (uncategorized.length > 0) {
      buckets.push({
        id: 'sin-categoria',
        name: 'Sin Categoría',
        isUncategorized: true,
        items: uncategorized,
      });
    }

    return buckets;
  }, [allExistingCategories, allActiveProducts]);

  const filteredConfigBuckets = useMemo(() => {
    const q = configSearch.trim().toLowerCase();
    if (!q) return configBuckets;

    return configBuckets
      .map((bucket) => {
        const catMatches = bucket.name.toLowerCase().includes(q);
        if (catMatches) return bucket;
        const matchingItems = bucket.items.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            (item.sku || '').toLowerCase().includes(q)
        );
        return { ...bucket, items: matchingItems };
      })
      .filter((bucket) => bucket.items.length > 0 || bucket.name.toLowerCase().includes(q));
  }, [configBuckets, configSearch]);

  const draftStats = useMemo(() => {
    const totalCategories = allExistingCategories.length;
    const visibleCategoriesCount = allExistingCategories.filter((cat) => {
      const catItems = allActiveProducts.filter((p) => p.categoryId === cat.id);
      if (!isCategoryVisibleInQuickSale(cat.id, draftConfig)) return false;
      if (catItems.length === 0) return true;
      return catItems.some((item) => isProductVisibleInQuickSale(item, draftConfig));
    }).length;

    const totalProducts = allActiveProducts.length;
    const visibleProductsCount = allActiveProducts.filter((item) =>
      isProductVisibleInQuickSale(item, draftConfig)
    ).length;

    return {
      totalCategories,
      visibleCategoriesCount,
      totalProducts,
      visibleProductsCount,
    };
  }, [allExistingCategories, allActiveProducts, draftConfig]);

  const activeHiddenSummaryCount = useMemo(() => {
    const hiddenProds = allActiveProducts.filter(
      (item) => !isProductVisibleInQuickSale(item, quickSaleConfig)
    ).length;
    return hiddenProds;
  }, [allActiveProducts, quickSaleConfig]);

  // Handlers de configuración de visibilidad
  const handleToggleConfigMode = () => {
    if (isConfigOpen) {
      setDraftConfig(normalizeQuickSaleConfig(quickSaleConfig));
      setConfigSearch('');
      setIsConfigOpen(false);
    } else {
      setDraftConfig(normalizeQuickSaleConfig(quickSaleConfig));
      setConfigSearch('');
      setIsCartOpen(false);
      setIsConfigOpen(true);
    }
  };

  const handleToggleCategoryInDraft = (bucket: {
    id: string;
    isUncategorized?: boolean;
    items: MenuItem[];
  }) => {
    const itemIds = bucket.items.map((i) => i.id);
    if (bucket.isUncategorized) {
      const anyVisible = bucket.items.some((item) => isProductVisibleInQuickSale(item, draftConfig));
      const itemSet = new Set(itemIds);
      setDraftConfig((prev) => ({
        ...prev,
        hiddenProductIds: anyVisible
          ? Array.from(new Set([...prev.hiddenProductIds, ...itemIds]))
          : prev.hiddenProductIds.filter((id) => !itemSet.has(id)),
      }));
      return;
    }

    setDraftConfig((prev) => toggleQuickSaleCategory(prev, bucket.id, itemIds));
  };

  const handleToggleProductInDraft = (
    item: MenuItem,
    bucket: { id: string; isUncategorized?: boolean; items: MenuItem[] }
  ) => {
    const siblingIds = bucket.items.map((i) => i.id);
    setDraftConfig((prev) =>
      toggleQuickSaleProduct(
        prev,
        item.id,
        bucket.isUncategorized ? undefined : bucket.id,
        siblingIds
      )
    );
  };

  const handleSetAllDraftVisibility = (visible: boolean) => {
    const allCatIds = allExistingCategories.map((c) => c.id);
    const validCatIds = new Set(allCatIds);
    const uncategorizedIds = allActiveProducts
      .filter((p) => !p.categoryId || !validCatIds.has(p.categoryId))
      .map((p) => p.id);

    setDraftConfig(setAllQuickSaleVisibility(allCatIds, uncategorizedIds, visible));
  };

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      await saveQuickSaleConfig(draftConfig);
      showToast('Configuración de Venta Rápida guardada', 'success');
      setConfigSearch('');
      setIsConfigOpen(false);
    } catch (err) {
      console.error('Error saving quick sale visibility:', err);
      showToast('No se pudo guardar la configuración de Venta Rápida', 'error');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Handlers del catálogo y carrito (idénticos al flujo ágil de Nuevo Pedido)
  const handleCategoryNavClick = (catId: string) => {
    const nextCat = selectedCategory === catId && catId !== 'todos' ? 'todos' : catId;
    setSelectedCategory(nextCat);
    if (catalogScrollRef.current) {
      catalogScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectProduct = (item: MenuItem, forceCustomize: boolean = false) => {
    const matchedProduct = products.find((p) => p.id === item.id);
    const hasOptions =
      matchedProduct &&
      (matchedProduct.isDailyMenu ||
        (matchedProduct.variants && matchedProduct.variants.length > 0) ||
        (matchedProduct.featureGroups && matchedProduct.featureGroups.length > 0) ||
        matchedProduct.isCombo ||
        (matchedProduct.modifierGroupIds && matchedProduct.modifierGroupIds.length > 0));

    if ((forceCustomize || hasOptions) && matchedProduct) {
      setEditingLineItem(null);
      setCustomizingProduct(matchedProduct);
    } else {
      quickAddMenuItem(item);
    }
  };

  const handleQuickAddProduct = (item: MenuItem) => {
    setValidationError('');
    const isDaily = Boolean(item.isDailyMenu || item.id === 'prod-almuerzo-del-dia');
    const matchedProduct = products.find((p) => p.id === item.id);

    if (isDaily && matchedProduct) {
      const defaultItem = buildDefaultDailyMenuItem(matchedProduct, products);
      setCartItems((prev) => {
        const defaultModIds = JSON.stringify(
          (defaultItem.selectedModifiers || []).map((m) => m.optionId).sort()
        );
        const existingIdx = prev.findIndex((c) => {
          if (c.productId !== item.id) return false;
          if (c.notes || (c.adjustments && c.adjustments.length > 0)) return false;
          const cModIds = JSON.stringify(
            (c.selectedModifiers || []).map((m) => m.optionId).sort()
          );
          return cModIds === defaultModIds;
        });

        if (existingIdx >= 0) {
          const updated = [...prev];
          const curr = updated[existingIdx];
          const newQty = curr.quantity + 1;
          updated[existingIdx] = {
            ...curr,
            quantity: newQty,
            totalPrice: curr.unitPrice * newQty,
          };
          return updated;
        }

        return [...prev, defaultItem];
      });
      return;
    }

    quickAddMenuItem(item);
  };

  const quickAddMenuItem = (item: MenuItem) => {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (c) =>
          c.productId === item.id &&
          !c.variant &&
          (!c.selectedModifiers || c.selectedModifiers.length === 0) &&
          (!c.adjustments || c.adjustments.length === 0) &&
          !c.notes
      );

      if (existingIdx >= 0) {
        const updated = [...prev];
        const current = updated[existingIdx];
        const newQty = current.quantity + 1;
        updated[existingIdx] = {
          ...current,
          quantity: newQty,
          totalPrice: current.unitPrice * newQty,
        };
        return updated;
      }

      const newItem: CustomizedItemSelection = {
        lineItemId: `qs-line-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        productId: item.id,
        productName: item.name,
        basePrice: item.price,
        quantity: 1,
        unitPrice: item.price,
        totalPrice: item.price,
        effectiveRecipe: (item.recipe as any) || [],
      };
      return [...prev, newItem];
    });
  };

  const handleAddCustomizedItem = (customized: CustomizedItemSelection) => {
    setValidationError('');
    setCartItems((prev) => {
      const existingIdx = prev.findIndex((c) => c.lineItemId === customized.lineItemId);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = customized;
        return updated;
      }
      return [...prev, customized];
    });
    setCustomizingProduct(null);
    setEditingLineItem(null);
  };

  const handleEditLineItem = (lineItem: CustomizedItemSelection) => {
    const matchedProduct = products.find((p) => p.id === lineItem.productId) || {
      id: lineItem.productId,
      name: lineItem.productName,
      price: lineItem.basePrice,
      recipe: lineItem.effectiveRecipe || [],
      sku: 'PRD-01',
      categoryId: 'cat-general',
      prepStationId: 'st-cocina-caliente',
      prepTimeMinutes: 15,
      isAvailableForSale: true,
      isAvailableForDelivery: true,
      isVisibleInMenu: true,
      status: 'activo' as const,
      variants: [],
      createdAt: '',
      updatedAt: '',
    };

    setEditingLineItem(lineItem);
    setCustomizingProduct(matchedProduct as Product);
  };

  const handleUpdateLineQty = (lineItemId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.lineItemId === lineItemId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              totalPrice: item.unitPrice * newQty,
            };
          }
          return item;
        })
        .filter(Boolean) as CustomizedItemSelection[]
    );
  };

  const handleDeleteLineItem = (lineItemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.lineItemId !== lineItemId));
  };

  const cartItemCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);
  const taxRate = getEffectiveTaxRate(currentBranch);
  const totals = calculateOrderTotals(
    cartItems.map((i) => ({ price: i.unitPrice, quantity: i.quantity })),
    includeTax ? taxRate : 0,
    false,
    0.10
  );

  // Registrar pedido en Mostrador y abrir automáticamente el espacio de cobro
  const handleRegisterAndCheckout = async () => {
    setValidationError('');

    if (cartItems.length === 0) {
      setValidationError('Agrega al menos un producto para registrar la venta rápida.');
      return;
    }

    if (isSubmittingOrder || actionLoading) return;
    setIsSubmittingOrder(true);

    try {
      let createdOrder: Order | null = null;

      await createOrder({
        type: 'mostrador',
        customerName: customerName.trim() || undefined,
        items: cartItems.map((c) => {
          const matchedMenuItem = allActiveProducts.find((m) => m.id === c.productId) || {
            id: c.productId,
            name: c.productName,
            description: '',
            categoryId: 'cat-general',
            price: c.unitPrice,
            station: 'cocina_caliente' as const,
            prepTimeMinutes: 15,
            recipe: c.effectiveRecipe || [],
            isAvailable: true,
          };

          return {
            menuItem: {
              ...matchedMenuItem,
              price: c.unitPrice,
              recipe: c.effectiveRecipe || matchedMenuItem.recipe,
            },
            quantity: c.quantity,
            notes: c.notes,
            selectedModifiers: c.selectedModifiers,
            adjustments: c.adjustments,
            effectiveRecipe: c.effectiveRecipe,
          };
        }),
        notes: notes.trim() || undefined,
        includeTip: false,
        onOrderCreated: (order) => {
          createdOrder = order;
        },
      });

      if (createdOrder) {
        showToast(`Pedido #${(createdOrder as Order).orderNumber} en Mostrador listo para cobro`, 'success');
        onOrderCreatedForCheckout(createdOrder);
      } else {
        onClose();
      }
    } catch (err) {
      console.error('Error registering quick sale order:', err);
      setValidationError('Ocurrió un error al registrar la venta rápida. Intenta nuevamente.');
      showToast('Error al registrar el pedido de venta rápida', 'error');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const getCategoryIcon = (catName: string) => {
    const n = catName.toLowerCase();
    if (n.includes('entrada') || n.includes('sopa')) return Soup;
    if (n.includes('parrilla') || n.includes('costilla') || n.includes('carne')) return Flame;
    if (n.includes('bebida') || n.includes('cerveza') || n.includes('trago')) return Wine;
    if (n.includes('postre') || n.includes('dulce')) return Cake;
    return UtensilsCrossed;
  };

  const renderProductCard = (item: MenuItem) => {
    const itemCountInCart = cartItems
      .filter((c) => c.productId === item.id)
      .reduce((acc, c) => acc + c.quantity, 0);

    const matchedProd = products.find((p) => p.id === item.id);
    const hasVariants = matchedProd && matchedProd.variants && matchedProd.variants.length > 0;
    const isDailyMenu = Boolean(
      matchedProd?.isDailyMenu || item.isDailyMenu || item.id === 'prod-almuerzo-del-dia'
    );
    const hasModifiers =
      matchedProd &&
      ((matchedProd.modifierGroupIds && matchedProd.modifierGroupIds.length > 0) ||
        (matchedProd.featureGroups && matchedProd.featureGroups.length > 0) ||
        matchedProd.isCombo ||
        isDailyMenu);

    return (
      <div
        key={item.id}
        className={`rounded-2xl border overflow-hidden flex flex-col justify-between transition-all ${
          itemCountInCart > 0
            ? 'bg-[#2b2416] border-[#d4af37] shadow-lg shadow-[#d4af37]/15 ring-1 ring-[#d4af37]/40'
            : 'bg-[#18171f] border-[#2d281e] hover:border-[#d4af37]/60'
        }`}
      >
        {/* Zona superior táctil: agrega rápido al carrito */}
        <button
          type="button"
          onClick={() => handleQuickAddProduct(item)}
          className="text-left flex flex-col flex-1 w-full cursor-pointer focus:outline-none group"
        >
          <div className="relative h-24 sm:h-28 w-full bg-[#121117] overflow-hidden shrink-0">
            {item.image ? (
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1f1c16] to-[#121117]">
                <UtensilsCrossed className="w-7 h-7 text-[#d4af37]/30" />
              </div>
            )}

            {itemCountInCart > 0 && (
              <span className="absolute top-2 right-2 min-w-[24px] h-6 px-1.5 rounded-full bg-[#d4af37] text-[#121117] text-xs font-black flex items-center justify-center shadow-md">
                {itemCountInCart}
              </span>
            )}

            {isDailyMenu && (
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-950/90 border border-amber-500/60 text-amber-300 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                <span>Menú del Día</span>
              </span>
            )}
          </div>

          <div className="p-2.5 flex-1 flex flex-col justify-between w-full">
            <div>
              <h4 className="text-xs font-black text-[#fef3c7] line-clamp-2 leading-tight group-hover:text-[#d4af37] transition-colors">
                {item.name}
              </h4>
              {item.description && (
                <p className="text-[10px] text-[#a8a29e] line-clamp-1 mt-0.5">
                  {item.description}
                </p>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between gap-1">
              <span className="text-sm font-black text-[#d4af37] font-mono">
                {formatCOP(item.price)}
              </span>
              {(hasVariants || hasModifiers) && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#2b2416] text-[#d4af37] border border-[#d4af37]/30">
                  Opciones
                </span>
              )}
            </div>
          </div>
        </button>

        {/* Barra de acciones inferior (botones hermanos sin anidamiento) */}
        <div className="px-2.5 pb-2.5 pt-1 flex items-center gap-1.5 border-t border-[#2d281e]/60">
          <button
            type="button"
            onClick={() => handleQuickAddProduct(item)}
            className="flex-1 py-1.5 px-2 rounded-lg bg-[#2b2416] hover:bg-[#d4af37] text-[#fef3c7] hover:text-[#121117] border border-[#d4af37]/40 text-[11px] font-black inline-flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Agregar</span>
          </button>

          {(hasVariants || hasModifiers) && (
            <button
              type="button"
              onClick={() => handleSelectProduct(item, true)}
              className="p-1.5 rounded-lg bg-[#14131a] hover:bg-[#2b2416] text-[#d4af37] border border-[#383124] hover:border-[#d4af37]/60 transition-colors cursor-pointer"
              title="Personalizar opciones o notas"
              aria-label={`Personalizar ${item.name}`}
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-between overflow-hidden p-0 sm:p-3 md:p-6">
      <div className="bg-[#121117] border sm:border-[#3f3521] sm:rounded-3xl w-full max-w-7xl h-full flex flex-col shadow-2xl text-[#faf5ee] overflow-hidden mx-auto relative">
        {/* Cabecera Superior */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-[#2d281e] bg-gradient-to-r from-[#1a1722] via-[#16141d] to-[#121117] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-950/80 border border-emerald-500/60 flex items-center justify-center text-emerald-300 shadow-md shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-[#fef3c7] tracking-tight truncate">
                  {isConfigOpen ? 'Configurar Venta Rápida' : 'Venta Rápida'}
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-600/60">
                  <Store className="w-3 h-3" />
                  <span>Mostrador por defecto</span>
                </span>
              </div>
              <p className="text-[11px] text-[#a8a29e] truncate">
                {isConfigOpen
                  ? 'Elige qué categorías y productos se muestran en este espacio rápido'
                  : `${currentBranch?.name || 'Restrepo (Valle)'} · Agrega productos y registra para abrir el cobro automáticamente`}
              </p>
            </div>
          </div>

          {/* Buscador + Botón de Configuración Superior + Cerrar */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end min-w-[240px]">
            <div className="relative flex-1 sm:w-56 md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a29e]" />
              <input
                type="text"
                value={isConfigOpen ? configSearch : searchFilter}
                onChange={(e) =>
                  isConfigOpen ? setConfigSearch(e.target.value) : setSearchFilter(e.target.value)
                }
                placeholder={
                  isConfigOpen ? 'Buscar categoría o producto...' : 'Buscar producto rápido...'
                }
                className="w-full pl-9 pr-7 py-1.5 rounded-xl bg-[#121117] border border-[#2d281e] text-xs text-[#FFFDF5] placeholder-[#78716c] focus:outline-none focus:border-[#d4af37]"
              />
              {(isConfigOpen ? configSearch : searchFilter) && (
                <button
                  type="button"
                  onClick={() => (isConfigOpen ? setConfigSearch('') : setSearchFilter(''))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a8a29e] hover:text-[#fef3c7] cursor-pointer"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Botón superior para configurar categorías y productos visibles */}
            <button
              type="button"
              onClick={handleToggleConfigMode}
              className={`px-3 py-2 rounded-xl border text-xs font-black inline-flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                isConfigOpen
                  ? 'bg-[#2b2416] border-[#d4af37] text-[#fef3c7]'
                  : 'bg-[#18171f] hover:bg-[#2b2416] border-[#383124] hover:border-[#d4af37]/70 text-[#fef3c7]'
              }`}
              title="Configurar qué categorías y productos son visibles en Venta Rápida"
            >
              {isConfigOpen ? (
                <>
                  <ArrowLeft className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>Volver a productos</span>
                </>
              ) : (
                <>
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>Configurar visibles</span>
                  {activeHiddenSummaryCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-950/90 text-amber-300 border border-amber-600/60">
                      {activeHiddenSummaryCount} ocultos
                    </span>
                  )}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-[#18171f] hover:bg-[#2b2416] border border-[#2d281e] text-[#a8a29e] hover:text-[#fef3c7] transition-colors cursor-pointer shrink-0"
              aria-label="Cerrar Venta Rápida"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* MODO CONFIGURACIÓN DE CATEGORÍAS Y PRODUCTOS VISIBLES        */}
        {/* ============================================================ */}
        {isConfigOpen ? (
          <>
            {/* Barra de resumen y acciones masivas */}
            <div className="px-4 sm:px-6 py-3 border-b border-[#2d281e] bg-[#14131a] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-[#18171f] border border-[#2d281e] font-bold text-[#fef3c7]">
                  Categorías visibles:{' '}
                  <strong className="text-[#d4af37]">
                    {draftStats.visibleCategoriesCount}/{draftStats.totalCategories}
                  </strong>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-[#18171f] border border-[#2d281e] font-bold text-[#fef3c7]">
                  Productos visibles:{' '}
                  <strong className="text-emerald-400">
                    {draftStats.visibleProductsCount}/{draftStats.totalProducts}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSetAllDraftVisibility(true)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-700/60 text-emerald-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Mostrar todo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllDraftVisibility(false)}
                  className="px-3 py-1.5 rounded-xl bg-[#18171f] hover:bg-red-950/60 border border-[#383124] hover:border-red-700/60 text-[#a8a29e] hover:text-red-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Ocultar todo</span>
                </button>
              </div>
            </div>

            {/* Lista de categorías y sus productos */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {filteredConfigBuckets.length === 0 ? (
                <div className="text-center py-12 text-[#a8a29e]">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-bold text-[#fef3c7]">
                    No se encontraron categorías ni productos con "{configSearch}"
                  </p>
                </div>
              ) : (
                filteredConfigBuckets.map((bucket) => {
                  const visibleCount = bucket.items.filter((item) =>
                    isProductVisibleInQuickSale(item, draftConfig)
                  ).length;
                  const catIsVisible = bucket.isUncategorized
                    ? visibleCount > 0
                    : isCategoryVisibleInQuickSale(bucket.id, draftConfig) &&
                      (bucket.items.length === 0 || visibleCount > 0);

                  return (
                    <div
                      key={bucket.id}
                      className={`rounded-2xl border overflow-hidden transition-all ${
                        catIsVisible
                          ? 'bg-[#18171f] border-[#383124]'
                          : 'bg-[#14131a] border-[#2d281e] opacity-80'
                      }`}
                    >
                      {/* Cabecera de Categoría */}
                      <div className="px-4 py-3 border-b border-[#2d281e] bg-[#1a1922] flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleCategoryInDraft(bucket)}
                          className="flex items-center gap-3 text-left cursor-pointer group"
                        >
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                              catIsVisible
                                ? 'bg-emerald-600 border-emerald-500 text-white'
                                : 'bg-[#121117] border-[#383124]'
                            }`}
                          >
                            {catIsVisible && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </span>
                          <div>
                            <span className="text-sm font-black text-[#fef3c7] group-hover:text-[#d4af37] transition-colors">
                              {bucket.name}
                            </span>
                            <span className="ml-2 text-[11px] font-bold text-[#a8a29e]">
                              ({visibleCount}/{bucket.items.length} productos visibles)
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleCategoryInDraft(bucket)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black border inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                            catIsVisible
                              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/70'
                              : 'bg-[#14131a] text-[#a8a29e] border-[#383124] hover:border-[#d4af37]/50'
                          }`}
                        >
                          {catIsVisible ? (
                            <>
                              <Eye className="w-3 h-3" />
                              <span>Categoría visible</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3" />
                              <span>Categoría oculta</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Grid de productos individuales */}
                      {bucket.items.length > 0 ? (
                        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {bucket.items.map((item) => {
                            const prodVisible = isProductVisibleInQuickSale(item, draftConfig);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleToggleProductInDraft(item, bucket)}
                                className={`px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                  prodVisible
                                    ? 'bg-[#2b2416] border-[#d4af37]/60 text-[#fef3c7] hover:border-[#d4af37]'
                                    : 'bg-[#121117] border-[#2d281e] text-[#78716c] hover:border-[#383124]'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold truncate">{item.name}</p>
                                  <p className="text-[10px] font-mono text-[#d4af37]">
                                    {formatCOP(item.price)}
                                  </p>
                                </div>
                                <span
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${
                                    prodVisible
                                      ? 'bg-emerald-950/80 border-emerald-600/60 text-emerald-300'
                                      : 'bg-[#18171f] border-[#2d281e] text-[#78716c]'
                                  }`}
                                >
                                  {prodVisible ? (
                                    <Eye className="w-3.5 h-3.5" />
                                  ) : (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="px-4 py-3 text-xs text-[#78716c]">
                          Esta categoría no tiene productos activos registrados.
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer del modo configuración */}
            <div className="px-4 sm:px-6 py-3.5 border-t border-[#2d281e] bg-[#14131a] flex items-center justify-between gap-3 shrink-0">
              <p className="text-[11px] text-[#a8a29e] hidden sm:block">
                Esta configuración solo controla qué aparece en Venta Rápida y no modifica tu catálogo general.
              </p>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  disabled={isSavingConfig}
                  onClick={handleToggleConfigMode}
                  className="px-4 py-2 rounded-xl bg-[#18171f] hover:bg-[#2b2416] border border-[#383124] text-xs font-bold text-[#a8a29e] hover:text-[#fef3c7] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSavingConfig || actionLoading}
                  onClick={handleSaveConfig}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] text-xs font-black inline-flex items-center gap-2 hover:brightness-110 shadow-lg cursor-pointer disabled:opacity-50"
                >
                  {isSavingConfig ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{isSavingConfig ? 'Guardando...' : 'Guardar configuración'}</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* ============================================================ */
          /* MODO CATÁLOGO DE VENTA RÁPIDA (MOSTRADOR POR DEFECTO)        */
          /* ============================================================ */
          <>
            {/* Pestañas de Categorías Visibles */}
            <div className="px-4 sm:px-6 py-2.5 border-b border-[#2d281e] bg-[#14131a] flex items-center gap-2 overflow-x-auto shrink-0">
              <button
                type="button"
                onClick={() => handleCategoryNavClick('todos')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  selectedCategory === 'todos'
                    ? 'bg-[#d4af37] text-[#121117] border-[#d4af37] shadow-md'
                    : 'bg-[#18171f] text-[#fef3c7] border-[#2d281e] hover:border-[#d4af37]/50'
                }`}
              >
                <span>Todos</span>
                <span className="opacity-80 font-mono text-[10px]">({visibleProducts.length})</span>
              </button>

              {navCategoryButtons.map((cat) => {
                const Icon = getCategoryIcon(cat.name);
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryNavClick(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#d4af37] text-[#121117] border-[#d4af37] shadow-md'
                        : 'bg-[#18171f] text-[#fef3c7] border-[#2d281e] hover:border-[#d4af37]/50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{cat.name}</span>
                    <span className="opacity-75 font-mono text-[10px]">({cat.count})</span>
                  </button>
                );
              })}
            </div>

            {/* Banner de error de validación si aplica */}
            {validationError && (
              <div className="mx-4 sm:mx-6 mt-3 px-4 py-2.5 rounded-xl bg-red-950/70 border border-red-600/60 text-red-200 text-xs font-bold flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{validationError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setValidationError('')}
                  className="text-red-300 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Cuadrícula de Productos */}
            <div ref={catalogScrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6">
              {visibleProducts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#18171f] border border-[#383124] flex items-center justify-center text-[#d4af37] mb-3">
                    <EyeOff className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-black text-[#fef3c7]">
                    No hay productos visibles en Venta Rápida
                  </h3>
                  <p className="text-xs text-[#a8a29e] mt-1 max-w-md">
                    Configura las categorías o productos que deseas mostrar aquí para vender al instante en mostrador.
                  </p>
                  <button
                    type="button"
                    onClick={handleToggleConfigMode}
                    className="mt-4 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] text-xs font-black inline-flex items-center gap-2 hover:brightness-110 cursor-pointer shadow-lg"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Configurar productos visibles</span>
                  </button>
                </div>
              ) : filteredMenuItems.length === 0 ? (
                <div className="text-center py-14 text-[#a8a29e]">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-bold text-[#fef3c7]">
                    No encontramos productos para "{searchFilter}"
                  </p>
                </div>
              ) : groupByCategory && selectedCategory === 'todos' && !searchFilter.trim() ? (
                <div className="space-y-6">
                  {groupedMenuSections.map((section) => (
                    <div key={section.categoryId} className="space-y-2.5">
                      <div className="flex items-center justify-between border-b border-[#2d281e] pb-1.5">
                        <h3 className="text-xs font-black uppercase tracking-wider text-[#d4af37]">
                          {section.categoryName}
                        </h3>
                        <span className="text-[11px] font-mono text-[#a8a29e]">
                          {section.products.length}{' '}
                          {section.products.length === 1 ? 'producto' : 'productos'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                        {section.products.map((item) => renderProductCard(item))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {filteredMenuItems.map((item) => renderProductCard(item))}
                </div>
              )}
            </div>

            {/* Barra Inferior Fija: Resumen + Ver Carrito + Registrar y Cobrar */}
            <div className="px-4 sm:px-6 py-3.5 border-t border-[#2d281e] bg-[#14131a] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 text-xs font-black inline-flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5" />
                  <span>Destino: Mostrador</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">
                    Total Venta Rápida ({cartItemCount} {cartItemCount === 1 ? 'ítem' : 'ítems'})
                  </span>
                  <span className="text-lg font-black text-[#d4af37] font-mono leading-none">
                    {formatCOP(totals.total)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsCartOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-[#18171f] hover:bg-[#2b2416] border border-[#383124] hover:border-[#d4af37]/60 text-[#fef3c7] text-xs font-black inline-flex items-center gap-2 cursor-pointer transition-all"
                >
                  <ShoppingBag className="w-4 h-4 text-[#d4af37]" />
                  <span>Ver Pedido</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#2b2416] text-[#d4af37] font-mono text-[11px] border border-[#d4af37]/40">
                    {cartItemCount}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={cartItems.length === 0 || isSubmittingOrder || actionLoading}
                  onClick={handleRegisterAndCheckout}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 text-white text-xs font-black inline-flex items-center gap-2 shadow-lg shadow-emerald-900/30 cursor-pointer transition-all disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  {isSubmittingOrder ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4" />
                  )}
                  <span>{isSubmittingOrder ? 'Registrando...' : 'Registrar y Cobrar'}</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ============================================================ */}
        {/* PANEL LATERAL DEL CARRITO DE VENTA RÁPIDA (MOSTRADOR)        */}
        {/* ============================================================ */}
        {isCartOpen && !isConfigOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
            <div className="w-full max-w-md bg-[#121117] border-l border-[#3f3521] h-full flex flex-col shadow-2xl text-[#faf5ee]">
              <div className="px-5 py-4 border-b border-[#2d281e] bg-[#1a1722] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className="w-5 h-5 text-[#d4af37]" />
                  <div>
                    <h3 className="text-sm font-black text-[#fef3c7]">
                      Pedido de Venta Rápida
                    </h3>
                    <p className="text-[11px] text-emerald-400 font-bold">
                      Mostrador por defecto · Cobro inmediato al registrar
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="p-1.5 rounded-xl bg-[#18171f] border border-[#2d281e] text-[#a8a29e] hover:text-[#fef3c7] cursor-pointer"
                  aria-label="Cerrar carrito"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Destino fijo en Mostrador */}
                <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-700/50 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-600/60 flex items-center justify-center text-emerald-300 shrink-0">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-emerald-300">
                      Pedido en Mostrador
                    </p>
                    <p className="text-[11px] text-[#a8a29e]">
                      No requiere seleccionar mesa ni destino. Al registrar se abrirá el cobro.
                    </p>
                  </div>
                </div>

                {/* Datos opcionales del cliente y notas */}
                <div className="grid grid-cols-1 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-[#a8a29e] flex items-center gap-1.5 mb-1">
                      <User className="w-3 h-3 text-[#d4af37]" />
                      <span>Nombre del cliente (opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ej. Cliente General"
                      className="w-full px-3 py-2 rounded-xl bg-[#18171f] border border-[#2d281e] text-xs text-[#FFFDF5] placeholder-[#78716c] focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#a8a29e] flex items-center gap-1.5 mb-1">
                      <FileText className="w-3 h-3 text-[#d4af37]" />
                      <span>Notas para cocina o barra (opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ej. Para empacar, sin hielo..."
                      className="w-full px-3 py-2 rounded-xl bg-[#18171f] border border-[#2d281e] text-xs text-[#FFFDF5] placeholder-[#78716c] focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>
                </div>

                {/* Lista de productos en carrito */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-[#d4af37]">
                      Productos ({cartItemCount})
                    </h4>
                    {cartItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCartItems([])}
                        className="text-[11px] font-bold text-red-400 hover:text-red-300 cursor-pointer"
                      >
                        Vaciar
                      </button>
                    )}
                  </div>

                  {cartItems.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-[#18171f] border border-[#2d281e] text-center text-xs text-[#a8a29e]">
                      Aún no has agregado productos a esta venta rápida.
                    </div>
                  ) : (
                    cartItems.map((line) => {
                      const visibleMods = getVisibleOrderModifiers(line.selectedModifiers);
                      return (
                        <div
                          key={line.lineItemId}
                          className="p-3 rounded-2xl bg-[#18171f] border border-[#2d281e] space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-black text-[#fef3c7] leading-tight">
                                {line.productName}
                              </p>
                              {line.variant && (
                                <p className="text-[10px] text-[#d4af37] font-bold mt-0.5">
                                  Variante: {line.variant.name}
                                </p>
                              )}
                              {visibleMods.length > 0 && (
                                <p className="text-[10px] text-[#a8a29e] mt-0.5">
                                  {visibleMods.map((m) => m.cleanName).join(' · ')}
                                </p>
                              )}
                              {line.notes && (
                                <p className="text-[10px] text-amber-300 italic mt-0.5">
                                  Nota: {line.notes}
                                </p>
                              )}
                            </div>
                            <span className="text-xs font-black font-mono text-[#d4af37] shrink-0">
                              {formatCOP(line.totalPrice)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1.5 border-t border-[#2d281e]/70">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateLineQty(line.lineItemId || '', -1)}
                                className="w-7 h-7 rounded-lg bg-[#14131a] hover:bg-[#2b2416] border border-[#383124] flex items-center justify-center text-[#fef3c7] cursor-pointer"
                                aria-label="Disminuir cantidad"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-7 text-center text-xs font-black font-mono text-[#fef3c7]">
                                {line.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateLineQty(line.lineItemId || '', 1)}
                                className="w-7 h-7 rounded-lg bg-[#14131a] hover:bg-[#2b2416] border border-[#383124] flex items-center justify-center text-[#fef3c7] cursor-pointer"
                                aria-label="Aumentar cantidad"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleEditLineItem(line)}
                                className="px-2 py-1 rounded-lg bg-[#14131a] hover:bg-[#2b2416] border border-[#383124] text-[10px] font-bold text-[#d4af37] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Edit className="w-3 h-3" />
                                <span>Editar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLineItem(line.lineItemId || '')}
                                className="p-1.5 rounded-lg bg-[#14131a] hover:bg-red-950/60 border border-[#383124] text-[#a8a29e] hover:text-red-400 cursor-pointer"
                                aria-label="Eliminar producto"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Resumen y Botón Final de Registro y Cobro */}
              <div className="p-4 border-t border-[#2d281e] bg-[#14131a] space-y-3">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-[#a8a29e]">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatCOP(totals.subtotal)}</span>
                  </div>
                  {totals.tax > 0 && (
                    <div className="flex justify-between text-[#a8a29e]">
                      <span>Impuesto</span>
                      <span className="font-mono">{formatCOP(totals.tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black text-[#fef3c7] pt-1 border-t border-[#2d281e]">
                    <span>Total a cobrar</span>
                    <span className="font-mono text-[#d4af37]">{formatCOP(totals.total)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={cartItems.length === 0 || isSubmittingOrder || actionLoading}
                  onClick={handleRegisterAndCheckout}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 text-white text-xs font-black inline-flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  {isSubmittingOrder ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4" />
                  )}
                  <span>
                    {isSubmittingOrder
                      ? 'Registrando y abriendo cobro...'
                      : 'Registrar pedido y abrir cobro'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Personalización de Producto / Menú del Día */}
        {customizingProduct && (
          <ProductCustomizeModal
            product={customizingProduct}
            modifierGroups={modifierGroups}
            initialItem={editingLineItem}
            onClose={() => {
              setCustomizingProduct(null);
              setEditingLineItem(null);
            }}
            onAddToCart={handleAddCustomizedItem}
          />
        )}
      </div>
    </div>
  );
};
