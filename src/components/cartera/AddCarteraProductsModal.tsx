import React, { useState, useMemo, useRef } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import {
  CarteraRecord,
  CustomizedItemSelection,
  MenuItem,
  Product,
} from '../../types';
import { formatCOP, getEffectiveTaxRate } from '../../utils/calculations';
import { calculateCarteraAdditionAmounts } from '../../utils/carteraProductsUtils';
import {
  buildDefaultDailyMenuItem,
  getCatalogGroupByCategoryPreference,
  groupProductsByCategories,
  sortOrderItemsByCatalogConfig,
} from '../../utils/productUtils';
import { getVisibleOrderModifiers } from '../../utils/orderModifierUtils';
import { ProductCustomizeModal } from '../catalog/ProductCustomizeModal';
import {
  X,
  Plus,
  Minus,
  Search,
  Clock,
  UtensilsCrossed,
  Sparkles,
  ShoppingBag,
  Flame,
  Wine,
  Cake,
  Soup,
  CheckCircle,
  Sliders,
  Edit,
  Trash2,
  ChefHat,
  CreditCard,
} from 'lucide-react';

interface AddCarteraProductsModalProps {
  carteraRecord: CarteraRecord;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddCarteraProductsModal: React.FC<AddCarteraProductsModalProps> = ({
  carteraRecord,
  onClose,
  onSuccess,
}) => {
  const {
    currentBranch,
    catalogCategories,
    menuItems,
    products,
    modifierGroups,
    addProductsToCarteraRecord,
    actionLoading,
  } = useRestaurant();
  const { showToast } = useToast();

  const catalogScrollRef = useRef<HTMLDivElement>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [sendToKitchen, setSendToKitchen] = useState<boolean>(true);
  const [cartItems, setCartItems] = useState<CustomizedItemSelection[]>([]);

  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [editingLineItem, setEditingLineItem] = useState<CustomizedItemSelection | null>(null);

  const groupByCategory = useMemo(() => getCatalogGroupByCategoryPreference(), []);

  const existingCategories = useMemo(() => {
    return [...(catalogCategories || [])]
      .filter((c) => c.isActive !== false && c.isVisibleInMenu !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [catalogCategories]);

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
      return sortOrderItemsByCatalogConfig(activeProds, existingCategories, groupByCategory, 'todos');
    }

    const fallbackList = menuItems.filter((m) => m.isAvailable !== false);
    return sortOrderItemsByCatalogConfig(fallbackList, existingCategories, groupByCategory, 'todos');
  }, [menuItems, products, existingCategories, groupByCategory]);

  const navCategoryButtons = useMemo(() => {
    const validIds = new Set(existingCategories.map((c) => c.id));
    const list = existingCategories.map((c) => ({
      id: c.id,
      name: c.name,
      count: allActiveProducts.filter((p) => p.categoryId === c.id).length,
    }));

    const uncategorizedCount = allActiveProducts.filter(
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
  }, [existingCategories, allActiveProducts]);

  const filteredMenuItems = useMemo(() => {
    const validCatIds = new Set(existingCategories.map((c) => c.id));
    const list = allActiveProducts.filter((item) => {
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
    return sortOrderItemsByCatalogConfig(list, existingCategories, groupByCategory, selectedCategory);
  }, [allActiveProducts, selectedCategory, searchFilter, existingCategories, groupByCategory]);

  const groupedMenuSections = useMemo(() => {
    return groupProductsByCategories(filteredMenuItems, existingCategories);
  }, [filteredMenuItems, existingCategories]);

  const handleCategoryNavClick = (catId: string) => {
    const nextCat = selectedCategory === catId && catId !== 'todos' ? 'todos' : catId;
    setSelectedCategory(nextCat);
    if (catalogScrollRef.current) {
      catalogScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
        lineItemId: `line-crd-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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

  const handleQuickAddProduct = (item: MenuItem) => {
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

  const handleAddCustomizedItem = (customized: CustomizedItemSelection) => {
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
      sku: 'PRD-CRD',
      categoryId: 'cat-entradas',
      prepStationId: 'st-cocina-caliente',
      prepTimeMinutes: 15,
      isAvailableForSale: true,
      isAvailableForDelivery: true,
      isVisibleInMenu: true,
      status: 'activo',
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
  const additionPreview = useMemo(
    () =>
      calculateCarteraAdditionAmounts({
        newItems: cartItems.map((i) => ({ price: i.unitPrice, quantity: i.quantity })),
        taxRate,
        currentTotalAmount: carteraRecord.totalAmount,
        currentBalanceDue: carteraRecord.balanceDue,
        dueDate: carteraRecord.dueDate,
      }),
    [cartItems, taxRate, carteraRecord.totalAmount, carteraRecord.balanceDue, carteraRecord.dueDate]
  );

  const handleConfirmSubmit = async () => {
    if (cartItems.length === 0 || actionLoading) return;
    try {
      const result = await addProductsToCarteraRecord({
        carteraId: carteraRecord.id,
        newItems: cartItems.map((c) => {
          const matchedMenuItem = allActiveProducts.find((m) => m.id === c.productId) || {
            id: c.productId,
            name: c.productName,
            description: '',
            categoryId: 'cat-entradas',
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
        sendToKitchen,
      });

      showToast(
        `Productos agregados a ${carteraRecord.code} (+${formatCOP(result.addedTotal)})${
          result.sentToKitchen ? ' y enviados a Cocina (KDS)' : ''
        }`,
        'success'
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Error al agregar productos a la cuenta de cartera', 'error');
    }
  };

  const getCategoryIcon = (catName: string) => {
    const n = catName.toLowerCase();
    if (n.includes('entrada') || n.includes('sopa') || n.includes('menú') || n.includes('almuerzo')) return Soup;
    if (n.includes('parrilla') || n.includes('costilla') || n.includes('carne')) return Flame;
    if (n.includes('bebida') || n.includes('cerveza') || n.includes('trago')) return Wine;
    if (n.includes('postre') || n.includes('dulce')) return Cake;
    return UtensilsCrossed;
  };

  const renderProductCard = (item: MenuItem) => {
    const inCartQty = cartItems
      .filter((c) => c.productId === item.id)
      .reduce((sum, c) => sum + c.quantity, 0);
    const isDaily = Boolean(item.isDailyMenu || item.id === 'prod-almuerzo-del-dia');

    return (
      <div
        key={item.id}
        onClick={() => handleQuickAddProduct(item)}
        className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden cursor-pointer group hover:scale-[1.01] hover:shadow-xl ${
          isDaily
            ? 'bg-[#1b1915] border-[#d4af37]/80 ring-1 ring-[#d4af37]/40 shadow-lg shadow-[#d4af37]/10'
            : inCartQty > 0
            ? 'bg-[#1b181e] border-[#d4af37] shadow-lg shadow-[#d4af37]/15 ring-1 ring-[#d4af37]'
            : 'bg-[#15141a] border-[#292520] hover:border-[#d4af37]/60 hover:bg-[#1a1820]'
        }`}
      >
        <div className="relative w-full h-16 bg-[#1a1822] overflow-hidden">
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#1e1b26] text-[#d4af37]/40">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
          )}

          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full text-[8.5px] font-bold bg-black/80 backdrop-blur-md text-[#fef3c7] border border-white/10 flex items-center gap-0.5 shadow">
            <Clock className="w-2 h-2 text-[#d4af37]" />
            {item.prepTimeMinutes || 15}m
          </span>

          {inCartQty > 0 && (
            <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-[#d4af37] text-[#0e0e12] shadow-lg flex items-center gap-0.5">
              ✓ +{inCartQty}
            </span>
          )}

          {isDaily && (
            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md text-[8.5px] font-black bg-gradient-to-r from-amber-500 to-[#d4af37] text-[#0e0e12] flex items-center gap-0.5 shadow-sm">
              <Sparkles className="w-2.5 h-2.5 fill-current" />
              Menú del Día
            </span>
          )}
        </div>

        <div className="p-2 sm:p-2.5 flex-1 flex flex-col justify-between space-y-1.5">
          <div>
            <h3 className="font-black text-xs text-[#fef3c7] leading-tight group-hover:text-[#d4af37] transition-colors line-clamp-2">
              {item.name}
            </h3>
            <p className="text-[10px] text-[#a8a29e] mt-0.5 line-clamp-2 leading-snug">
              {isDaily
                ? 'Sopa · Principio · Carne · 3 Acompañamientos · Bebida'
                : item.description || 'Receta artesanal preparada en cocina.'}
            </p>
          </div>

          <div className="pt-1.5 border-t border-[#25221c] flex items-center justify-between gap-1">
            <span className="text-xs sm:text-sm font-black text-[#d4af37] font-mono tabular-nums leading-none block">
              {formatCOP(item.price)}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectProduct(item, true);
                }}
                className="p-1 rounded-lg bg-[#24222e] hover:bg-[#343042] text-[#d4af37] border border-[#d4af37]/40 cursor-pointer"
                title="Configurar opciones del plato"
              >
                <Sliders className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectProduct(item, true);
                }}
                className={`py-1 px-2.5 rounded-lg font-black text-[10px] sm:text-[11px] flex items-center justify-center shadow-sm transition-all cursor-pointer hover:brightness-110 active:scale-95 ${
                  isDaily
                    ? 'bg-gradient-to-r from-amber-500 to-[#d4af37] text-[#0e0e12] border border-[#d4af37]'
                    : 'bg-gradient-to-r from-[#292212] to-[#3a2f16] group-hover:from-[#d4af37] group-hover:to-[#b89728] text-[#fef3c7] group-hover:text-[#0e0e12] border border-[#d4af37]/60'
                }`}
              >
                + Agregar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex flex-col justify-between overflow-hidden p-0 sm:p-3 md:p-6">
      <div className="bg-[#121117] border sm:border-[#3f3521] sm:rounded-3xl w-full max-w-7xl h-full flex flex-col shadow-2xl text-[#faf5ee] overflow-hidden mx-auto relative">
        {/* Cabecera */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-[#2d281e] bg-gradient-to-r from-[#1a1722] via-[#16141d] to-[#121117] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#2a2213] border border-[#d4af37]/50 flex items-center justify-center text-[#d4af37]">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-[#fef3c7] tracking-tight">
                  Agregar Productos a Cartera
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-[#2b2416] text-[#d4af37] border border-[#d4af37]/40">
                  {carteraRecord.code}
                </span>
              </div>
              <p className="text-[11px] text-[#a8a29e]">
                {carteraRecord.customerName} · Saldo actual:{' '}
                <strong className="font-mono tabular-nums text-amber-400">
                  {formatCOP(carteraRecord.balanceDue)}
                </strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#1c1a24] hover:bg-[#282633] border border-[#383124] text-[#a8a29e] hover:text-[#fef3c7] flex items-center justify-center cursor-pointer transition-colors"
            aria-label="Cerrar selector"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Buscador y Categorías */}
        <div className="sticky top-0 z-30 px-3 sm:px-6 py-2.5 bg-[#16151c]/95 backdrop-blur-md border-b border-[#2d281e] shadow-md flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none snap-x snap-mandatory flex-1 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleCategoryNavClick('todos')}
              className={`snap-start shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                selectedCategory === 'todos'
                  ? 'bg-[#d4af37] text-[#0e0e12] shadow-md'
                  : 'bg-[#18171f] text-[#a8a29e] border border-[#2d281e] hover:bg-[#201e28] hover:text-white'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5 shrink-0" />
              <span>Todos los Platos</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  selectedCategory === 'todos' ? 'bg-[#0e0e12]/20 text-[#0e0e12]' : 'bg-black/40 text-[#d4af37]'
                }`}
              >
                {allActiveProducts.length}
              </span>
            </button>

            {navCategoryButtons.map((c) => {
              const Icon = getCategoryIcon(c.name);
              const isSelected = selectedCategory === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleCategoryNavClick(c.id)}
                  className={`snap-start shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                    isSelected
                      ? 'bg-[#d4af37] text-[#0e0e12] shadow-md'
                      : 'bg-[#18171f] text-[#a8a29e] border border-[#2d281e] hover:bg-[#201e28] hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{c.name}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isSelected ? 'bg-[#0e0e12]/20 text-[#0e0e12]' : 'bg-black/40 text-[#d4af37]'
                    }`}
                  >
                    {c.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a29e]" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Buscar plato o bebida..."
              className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-[#121117] border border-[#2d281e] text-xs text-[#FFFDF5] placeholder-[#78716c] focus:outline-none focus:border-[#d4af37]"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#a8a29e] hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Catálogo de Productos */}
        <div ref={catalogScrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0f0e13]">
          {filteredMenuItems.length === 0 ? (
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center p-8 rounded-3xl bg-[#14131a] border border-dashed border-[#2d281e] text-center">
              <UtensilsCrossed className="w-12 h-12 text-[#a8a29e] mb-3 opacity-30" />
              <h4 className="text-base font-black text-[#FFFDF5]">No hay productos que coincidan</h4>
              <p className="text-xs text-[#a8a29e] mt-1">
                {searchFilter ? `No se encontraron resultados para "${searchFilter}".` : 'Sin productos disponibles.'}
              </p>
            </div>
          ) : groupByCategory && selectedCategory === 'todos' ? (
            <div className="space-y-6 pb-6">
              {groupedMenuSections.map((section, secIdx) => (
                <div key={section.categoryId} className="space-y-2.5">
                  <div className="sticky top-0 z-20 flex items-center justify-between px-3 py-2 rounded-xl bg-[#18171f]/95 backdrop-blur-md border border-[#2d281e] shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-[#d4af37] text-[#0e0e12] text-[11px] font-black flex items-center justify-center">
                        {secIdx + 1}°
                      </span>
                      <span className="text-xs sm:text-sm font-black text-[#fef3c7]">
                        {section.categoryName}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#a8a29e] font-semibold">
                      {section.products.length} {section.products.length === 1 ? 'producto' : 'productos'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                    {section.products.map(renderProductCard)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 pb-6">
              {filteredMenuItems.map(renderProductCard)}
            </div>
          )}
        </div>

        {/* Footer Confirmación y Toggle Envío a Cocina */}
        <div className="border-t border-[#2d281e] bg-[#16151c] px-4 sm:px-6 py-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-[#201d18] border border-[#383124] text-[#d4af37] flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs text-[#a8a29e]">Sumar al saldo:</span>
                <span className="text-base sm:text-lg font-black text-[#d4af37] font-mono tabular-nums leading-none">
                  +{formatCOP(additionPreview.addedTotal)}
                </span>
                <span className="text-[11px] text-emerald-400 font-bold font-mono tabular-nums">
                  (Nuevo saldo: {formatCOP(additionPreview.newBalanceDue)})
                </span>
              </div>
              <span className="text-[11px] text-[#a8a29e] block leading-tight truncate">
                {cartItemCount} {cartItemCount === 1 ? 'producto nuevo' : 'productos nuevos'} seleccionados
                {taxRate > 0 && additionPreview.addedTax > 0
                  ? ` · Incluye impuesto (${formatCOP(additionPreview.addedTax)})`
                  : ''}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 shrink-0">
            <label
              className={`px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-colors ${
                sendToKitchen
                  ? 'bg-emerald-950/40 border-emerald-700/70 text-emerald-200'
                  : 'bg-[#1e1d26] border-[#383124] text-[#a8a29e]'
              }`}
            >
              <input
                type="checkbox"
                checked={sendToKitchen}
                onChange={(e) => setSendToKitchen(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
              <ChefHat className="w-4 h-4 text-[#d4af37]" />
              <span>Enviar a Cocina (KDS)</span>
            </label>

            <button
              type="button"
              onClick={() => setIsCartOpen(!isCartOpen)}
              className="py-2.5 px-3.5 rounded-xl bg-[#24222e] hover:bg-[#302d3d] text-[#fef3c7] font-bold text-xs flex items-center gap-1.5 border border-[#383124] transition-all cursor-pointer whitespace-nowrap"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>{isCartOpen ? 'Ocultar' : `Ver Lista (${cartItemCount})`}</span>
            </button>

            <button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={cartItemCount === 0 || actionLoading}
              className={`py-2.5 px-4 sm:px-5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg transition-all cursor-pointer whitespace-nowrap ${
                cartItemCount === 0 || actionLoading
                  ? 'bg-[#2a2213] text-[#78716c] cursor-not-allowed border border-[#383124]'
                  : 'bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] hover:brightness-110 active:scale-95'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 stroke-[3]" />
              <span>{actionLoading ? 'Guardando...' : 'Agregar a Cartera →'}</span>
            </button>
          </div>
        </div>

        {/* Drawer lateral con el detalle de la adición */}
        {isCartOpen && (
          <div className="fixed inset-0 z-[70] flex justify-end bg-black/60 backdrop-blur-sm">
            <div
              className="w-full sm:max-w-md md:max-w-lg bg-[#14131a] border-l border-[#3f3521] shadow-2xl flex flex-col justify-between text-[#faf5ee] h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-[#2d281e] flex items-center justify-between bg-[#18171f]">
                <div>
                  <h3 className="font-black text-sm text-[#fef3c7]">
                    Productos a Agregar · {carteraRecord.code}
                  </h3>
                  <p className="text-[11px] text-[#a8a29e]">
                    {carteraRecord.customerName} · {cartItemCount} ítems
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="w-8 h-8 rounded-xl bg-[#24222e] hover:bg-[#322f3f] text-[#a8a29e] hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[#0f0e13]">
                {cartItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#a8a29e]">
                    <ShoppingBag className="w-10 h-10 mb-2 opacity-20 text-[#d4af37]" />
                    <p className="text-xs font-bold text-[#fef3c7]">No hay productos seleccionados aún</p>
                  </div>
                ) : (
                  cartItems.map((c) => {
                    const visibleModifiers = getVisibleOrderModifiers(c.selectedModifiers);
                    return (
                      <div
                        key={c.lineItemId}
                        className="p-3 rounded-2xl bg-[#18171f] border border-[#2d281e] space-y-1.5"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-xs text-[#fef3c7] block truncate">
                              {c.productName}
                            </span>
                            {c.variant && (
                              <span className="text-[10px] text-[#d4af37] font-semibold block">
                                Presentación: {c.variant.name}
                              </span>
                            )}
                            {visibleModifiers.length > 0 && (
                              <div className="mt-1 space-y-0.5 text-[10px] text-[#a8a29e] border-l-2 border-[#d4af37]/40 pl-2">
                                {visibleModifiers.map(({ cleanName, detail }, idx) => (
                                  <div key={idx}>
                                    <span className="text-[#d4af37] font-semibold">
                                      {detail.groupName ? `${detail.groupName}:` : '•'}
                                    </span>{' '}
                                    {cleanName}
                                  </div>
                                ))}
                              </div>
                            )}
                            {c.notes && (
                              <p className="text-[10px] text-amber-300/90 italic mt-1">Nota: {c.notes}</p>
                            )}
                          </div>
                          <span className="font-black text-xs text-[#d4af37] font-mono tabular-nums">
                            {formatCOP(c.totalPrice)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[#25221c]">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEditLineItem(c)}
                              className="px-2 py-1 rounded-lg bg-[#24222e] hover:bg-[#322f3f] text-[10px] font-bold text-[#d4af37] flex items-center gap-1 cursor-pointer"
                            >
                              <Edit className="w-3 h-3" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => c.lineItemId && handleDeleteLineItem(c.lineItemId)}
                              className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 bg-[#121117] px-2 py-1 rounded-xl border border-[#2d281e]">
                            <button
                              type="button"
                              onClick={() => c.lineItemId && handleUpdateLineQty(c.lineItemId, -1)}
                              className="w-5 h-5 rounded-md bg-[#201d18] text-[#d4af37] hover:bg-[#d4af37] hover:text-[#0e0e12] flex items-center justify-center cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-black font-mono text-[#fef3c7] w-6 text-center">
                              {c.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => c.lineItemId && handleUpdateLineQty(c.lineItemId, 1)}
                              className="w-5 h-5 rounded-md bg-[#201d18] text-[#d4af37] hover:bg-[#d4af37] hover:text-[#0e0e12] flex items-center justify-center cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-4 border-t border-[#2d281e] bg-[#18171f] space-y-2.5 text-xs">
                <div className="flex justify-between text-[#a8a29e]">
                  <span>Subtotal Adición</span>
                  <span className="font-mono tabular-nums">{formatCOP(additionPreview.addedSubtotal)}</span>
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between text-[#a8a29e]">
                    <span>Impoconsumo ({Math.round(taxRate * 100)}%)</span>
                    <span className="font-mono tabular-nums">{formatCOP(additionPreview.addedTax)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm text-[#d4af37] pt-1.5 border-t border-[#2d281e]">
                  <span>Total a Sumar</span>
                  <span className="font-mono tabular-nums">+{formatCOP(additionPreview.addedTotal)}</span>
                </div>
                <div className="flex justify-between font-bold text-xs text-emerald-400">
                  <span>Nuevo Saldo Cartera</span>
                  <span className="font-mono tabular-nums">{formatCOP(additionPreview.newBalanceDue)}</span>
                </div>

                <label className="p-2.5 rounded-xl bg-[#121117] border border-[#2d281e] flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendToKitchen}
                    onChange={(e) => setSendToKitchen(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  />
                  <div className="text-[11px]">
                    <span className="font-bold text-[#fef3c7] block">Enviar a Cocina (KDS)</span>
                    <span className="text-[#a8a29e]">
                      {sendToKitchen
                        ? 'Genera comanda en KDS y descuenta inventario.'
                        : 'Solo suma los productos y el saldo en Cartera.'}
                    </span>
                  </div>
                </label>

                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  disabled={cartItemCount === 0 || actionLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs hover:brightness-110 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Guardando...' : 'Confirmar y Sumar a Cartera'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

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
  );
};
