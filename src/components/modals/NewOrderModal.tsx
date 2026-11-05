import React, { useState, useMemo } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { MenuItem, OrderType, Table, Product, CustomizedItemSelection } from '../../types';
import { formatCOP, calculateOrderTotals, getEffectiveTaxRate } from '../../utils/calculations';
import { ProductCustomizeModal } from '../catalog/ProductCustomizeModal';
import {
  X,
  Plus,
  Minus,
  Search,
  UtensilsCrossed,
  Clock,
  Sparkles,
  ShoppingBag,
  Flame,
  Wine,
  Cake,
  Soup,
  CheckCircle,
  Trash2,
  User,
  Phone,
  MapPin,
  FileText,
  Building2,
  Bike,
  Store,
  AlertCircle,
  Edit,
  Tag,
  Sliders,
} from 'lucide-react';

interface NewOrderModalProps {
  initialTable?: Table | null;
  initialOrderType?: OrderType;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  initialTable,
  initialOrderType,
  onClose,
  onSuccess,
}) => {
  const {
    currentBranch,
    tables,
    categories,
    menuItems,
    products,
    modifierGroups,
    createOrder,
    actionLoading,
  } = useRestaurant();

  const [orderType, setOrderType] = useState<OrderType>(
    initialTable ? 'mesa' : (initialOrderType || 'mesa')
  );
  const [selectedTableId, setSelectedTableId] = useState<string>(initialTable ? initialTable.id : '');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [includeTax, setIncludeTax] = useState<boolean>(() => getEffectiveTaxRate(currentBranch) > 0);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>('');

  // Customized line items in cart: CustomizedItemSelection[]
  const [cartItems, setCartItems] = useState<CustomizedItemSelection[]>([]);

  // Modal customization state
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [editingLineItem, setEditingLineItem] = useState<CustomizedItemSelection | null>(null);

  const availableTables = tables.filter((t) => t.status === 'libre' || t.id === initialTable?.id);

  // Unificar productos activos garantizando que siempre haya platos disponibles
  const allActiveProducts: MenuItem[] = useMemo(() => {
    const list: MenuItem[] = [...menuItems];
    const existingIds = new Set(list.map((m) => m.id));

    for (const p of products) {
      if (!existingIds.has(p.id) && p.status === 'activo' && p.isAvailableForSale !== false) {
        list.push({
          id: p.id,
          name: p.name,
          description: p.description || '',
          categoryId: p.categoryId,
          price: p.price,
          station:
            p.prepStationId === 'st-parrilla'
              ? 'parrilla'
              : p.prepStationId === 'st-bar-bebidas'
              ? 'bar_bebidas'
              : p.prepStationId === 'st-postres'
              ? 'postres'
              : 'cocina_caliente',
          prepTimeMinutes: p.prepTimeMinutes || 15,
          recipe: (p.recipe as any) || [],
          isAvailable: true,
          image: p.images?.[0] || '',
          sku: p.sku,
        });
        existingIds.add(p.id);
      }
    }
    return list;
  }, [menuItems, products]);

  const filteredMenuItems = useMemo(() => {
    return allActiveProducts.filter((item) => {
      if (item.isAvailable === false) return false;
      if (selectedCategory !== 'todos' && item.categoryId !== selectedCategory) {
        return false;
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
  }, [allActiveProducts, selectedCategory, searchFilter]);

  // Handle clicking product in grid
  const handleSelectProduct = (item: MenuItem, forceCustomize: boolean = false) => {
    const matchedProduct = products.find((p) => p.id === item.id);

    const hasOptions =
      matchedProduct &&
      ((matchedProduct.variants && matchedProduct.variants.length > 0) ||
        (matchedProduct.featureGroups && matchedProduct.featureGroups.length > 0) ||
        matchedProduct.isCombo ||
        (matchedProduct.modifierGroupIds && matchedProduct.modifierGroupIds.length > 0));

    if (forceCustomize || hasOptions) {
      if (matchedProduct) {
        setEditingLineItem(null);
        setCustomizingProduct(matchedProduct);
      } else {
        // Fallback simple add
        quickAddMenuItem(item);
      }
    } else {
      quickAddMenuItem(item);
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
        lineItemId: `line-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
      categoryId: 'cat-hamburguesas',
      prepStationId: 'st-parrilla',
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
    setCartItems((prev) => {
      return prev
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
        .filter(Boolean) as CustomizedItemSelection[];
    });
  };

  const handleDeleteLineItem = (lineItemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.lineItemId !== lineItemId));
  };

  const cartItemCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);
  const taxRate = getEffectiveTaxRate(currentBranch);
  const totals = calculateOrderTotals(
    cartItems.map((i) => ({ price: i.unitPrice, quantity: i.quantity })),
    includeTax ? taxRate : 0,
    false, // La propina se liquida al momento del cobro/pago
    0.10
  );

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setValidationError('');

    if (cartItems.length === 0) {
      setValidationError('Debes agregar al menos un producto al pedido.');
      setIsCartOpen(true);
      return;
    }

    if (orderType === 'mesa' && !selectedTableId) {
      setValidationError('Por favor selecciona la mesa para este pedido.');
      setIsCartOpen(true);
      return;
    }

    if (orderType === 'domicilio' && !customerAddress.trim()) {
      setValidationError('Por favor ingresa la dirección de entrega para el domicilio.');
      setIsCartOpen(true);
      return;
    }

    try {
      const orderId = await createOrder({
        type: orderType,
        tableId: orderType === 'mesa' ? selectedTableId : undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        items: cartItems.map((c) => {
          const matchedMenuItem = allActiveProducts.find((m) => m.id === c.productId) || {
            id: c.productId,
            name: c.productName,
            description: '',
            categoryId: 'cat-hamburguesas',
            price: c.unitPrice,
            station: 'cocina_caliente',
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
            variant: c.variant,
            comboSwaps: c.comboSwaps,
            effectiveRecipe: c.effectiveRecipe,
          };
        }),
        notes: notes.trim() || undefined,
        includeTip: false,
      });

      onSuccess(orderId);
      onClose();
    } catch (err) {
      console.error('Error creating order:', err);
      setValidationError('Ocurrió un error al registrar el pedido. Intenta nuevamente.');
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

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-between overflow-hidden p-0 sm:p-3 md:p-6">
      <div className="bg-[#121117] border sm:border-[#3f3521] sm:rounded-3xl w-full max-w-7xl h-full flex flex-col shadow-2xl text-[#faf5ee] overflow-hidden mx-auto relative">
        
        {/* Cabecera Principal Estilo Kiosco Moderno con Botón X Claro en Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-[#2d281e] bg-gradient-to-r from-[#1a1722] via-[#16141d] to-[#121117] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#2a2213] border border-[#d4af37]/50 flex items-center justify-center text-[#d4af37] shadow-md shadow-[#d4af37]/10">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-[#fef3c7] tracking-tight">
                  Kiosco de Pedidos · Guadalajara de Buga
                </h2>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#2b2416] text-[#d4af37] border border-[#d4af37]/40">
                  Catálogo Principal
                </span>
              </div>
              <p className="text-[11px] text-[#a8a29e]">
                {currentBranch?.name} · Selecciona tus productos y presiona "Ver Pedido" para completar la orden
              </p>
            </div>
          </div>

          {/* Buscador de Platos en Header */}
          <div className="flex items-center gap-2 flex-1 max-w-xs sm:max-w-sm ml-auto">
            <div className="relative w-full">
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

          {/* Acciones de Cabecera: Botón X de Cerrar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-[#1c1a24] hover:bg-[#282633] border border-[#383124] text-[#a8a29e] hover:text-[#fef3c7] flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Cerrar kiosco"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Pestañas de Categorías Estilo Kiosco (Grandes y Táctiles) */}
        <div className="px-4 sm:px-6 py-2.5 bg-[#14131a] border-b border-[#2d281e] flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
          <button
            type="button"
            onClick={() => setSelectedCategory('todos')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              selectedCategory === 'todos'
                ? 'bg-[#d4af37] text-[#0e0e12] shadow-md shadow-[#d4af37]/20'
                : 'bg-[#18171f] text-[#a8a29e] border border-[#2d281e] hover:bg-[#201e28] hover:text-white'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Todos los Platos</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${selectedCategory === 'todos' ? 'bg-[#0e0e12]/20 text-[#0e0e12]' : 'bg-black/40 text-[#d4af37]'}`}>
              {allActiveProducts.length}
            </span>
          </button>

          {categories.map((c) => {
            const count = allActiveProducts.filter((p) => p.categoryId === c.id).length;
            const Icon = getCategoryIcon(c.name);
            const isSelected = selectedCategory === c.id;

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? 'bg-[#d4af37] text-[#0e0e12] shadow-md shadow-[#d4af37]/20'
                    : 'bg-[#18171f] text-[#a8a29e] border border-[#2d281e] hover:bg-[#201e28] hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{c.name}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isSelected ? 'bg-[#0e0e12]/20 text-[#0e0e12]' : 'bg-black/40 text-[#d4af37]'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* CATÁLOGO COMPLETO ESTILO KIOSCO ULTRA-COMPACTO */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-[#0f0e13]">
          {filteredMenuItems.length === 0 ? (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center p-8 rounded-3xl bg-[#14131a] border border-dashed border-[#2d281e] text-center my-auto">
              <UtensilsCrossed className="w-12 h-12 text-[#a8a29e] mb-3 opacity-30" />
              <h4 className="text-base font-black text-[#FFFDF5]">No hay productos que coincidan</h4>
              <p className="text-xs text-[#a8a29e] mt-1 max-w-sm">
                {searchFilter
                  ? `No se encontraron resultados para "${searchFilter}".`
                  : 'No hay platos disponibles en esta categoría actualmente.'}
              </p>
              {(searchFilter || selectedCategory !== 'todos') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchFilter('');
                    setSelectedCategory('todos');
                  }}
                  className="mt-4 px-4 py-2 rounded-xl bg-[#2b2416] text-[#d4af37] border border-[#d4af37]/40 text-xs font-black hover:brightness-110 cursor-pointer shadow-md"
                >
                  Ver todo el menú ({allActiveProducts.length} productos)
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 pb-6">
              {filteredMenuItems.map((item) => {
                const inCartQty = cartItems
                  .filter((c) => c.productId === item.id)
                  .reduce((sum, c) => sum + c.quantity, 0);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectProduct(item, false)}
                    className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden cursor-pointer group hover:scale-[1.01] hover:shadow-xl ${
                      inCartQty > 0
                        ? 'bg-[#1b181e] border-[#d4af37] shadow-lg shadow-[#d4af37]/15 ring-1 ring-[#d4af37]'
                        : 'bg-[#15141a] border-[#292520] hover:border-[#d4af37]/60 hover:bg-[#1a1820]'
                    }`}
                  >
                    {/* Imagen Ultra-Compacta */}
                    <div className="relative w-full h-16 sm:h-16 bg-[#1a1822] overflow-hidden">
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

                      {/* Badge de Tiempo */}
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full text-[8.5px] font-bold bg-black/80 backdrop-blur-md text-[#fef3c7] border border-white/10 flex items-center gap-0.5 shadow">
                        <Clock className="w-2 h-2 text-[#d4af37]" />
                        {item.prepTimeMinutes || 15}m
                      </span>

                      {/* Badge si ya está en pedido */}
                      {inCartQty > 0 && (
                        <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-[#d4af37] text-[#0e0e12] shadow-lg flex items-center gap-0.5 animate-in zoom-in-95">
                          ✓ {inCartQty}
                        </span>
                      )}
                    </div>

                    {/* Contenido del Producto Ultra-Compacto */}
                    <div className="p-2 sm:p-2.5 flex-1 flex flex-col justify-between space-y-1.5">
                      <div>
                        <h3 className="font-black text-xs text-[#fef3c7] leading-tight group-hover:text-[#d4af37] transition-colors line-clamp-2">
                          {item.name}
                        </h3>
                        <p className="text-[10px] text-[#a8a29e] mt-0.5 line-clamp-2 leading-snug">
                          {item.description || 'Receta artesanal preparada en cocina.'}
                        </p>
                      </div>

                      {/* Precio y Botón Kiosco */}
                      <div className="pt-1.5 border-t border-[#25221c] flex items-center justify-between gap-1">
                        <div>
                          <span className="text-xs sm:text-sm font-black text-[#d4af37] font-mono leading-none block">
                            {formatCOP(item.price)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectProduct(item, true);
                            }}
                            className="p-1 rounded-lg bg-[#24222e] hover:bg-[#343042] text-[#d4af37] border border-[#d4af37]/40 cursor-pointer"
                            title="Agregar con detalles / Personalizar"
                          >
                            <Sliders className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectProduct(item, false);
                            }}
                            className="py-1 px-2 rounded-lg bg-gradient-to-r from-[#292212] to-[#3a2f16] group-hover:from-[#d4af37] group-hover:to-[#b89728] text-[#fef3c7] group-hover:text-[#0e0e12] border border-[#d4af37]/60 font-black text-[10px] sm:text-[11px] flex items-center justify-center shadow-sm transition-all cursor-pointer hover:brightness-110 active:scale-95"
                          >
                            <span>+ Agregar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER DEL KIOSCO INTEGRADO AL FINAL */}
        <div className="border-t border-[#2d281e] bg-[#16151c] px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 rounded-xl bg-[#2b2416] border border-[#d4af37]/60 text-[#d4af37] hover:brightness-110 flex items-center justify-center cursor-pointer shadow transition-all shrink-0"
              title="Ver mi pedido"
            >
              <ShoppingBag className="w-4 h-4" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#d4af37] text-[#0e0e12] font-black text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center shadow animate-pulse">
                  {cartItemCount}
                </span>
              )}
            </button>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-[#a8a29e] hidden sm:inline">Total Pedido:</span>
                <span className="text-base sm:text-lg font-black text-[#d4af37] font-mono leading-none">
                  {formatCOP(totals.total)}
                </span>
              </div>
              <span className="text-[11px] text-[#a8a29e] block leading-tight truncate">
                {cartItemCount} {cartItemCount === 1 ? 'producto seleccionado' : 'productos seleccionados'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="py-2.5 px-4 sm:px-5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] hover:brightness-110 active:scale-95 text-xs font-black flex items-center gap-2 shadow-lg shadow-[#d4af37]/20 transition-all cursor-pointer whitespace-nowrap"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Ver Pedido ({cartItemCount}) →</span>
            </button>
          </div>
        </div>

        {/* CUADRO EMERGENTE / DRAWER "VER PEDIDO" QUE CONTIENE SELECCIÓN DE DESTINO Y DETALLES */}
        {isCartOpen && (
          <div
            className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setIsCartOpen(false)}
          >
            <div
              className="w-full sm:max-w-md md:max-w-xl bg-[#14131a] border-l border-[#3f3521] shadow-2xl flex flex-col justify-between text-[#faf5ee] h-full animate-in slide-in-from-right duration-250 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabecera del Cuadro Emergente de Pedido */}
              <div className="px-5 py-4 border-b border-[#2d281e] flex items-center justify-between bg-[#18171f]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#2a2213] border border-[#d4af37]/50 flex items-center justify-center text-[#d4af37]">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-[#fef3c7]">Confirmación de Pedido</h3>
                    <p className="text-[11px] text-[#a8a29e]">
                      Configura el destino y revisa los {cartItemCount} productos
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="w-8 h-8 rounded-xl bg-[#24222e] hover:bg-[#322f3f] text-[#a8a29e] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                  aria-label="Cerrar panel de pedido"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mensaje de Error de Validación */}
              {validationError && (
                <div className="mx-4 mt-3 p-3 rounded-xl bg-red-950/80 border border-red-800/80 text-red-200 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Contenido Desplegable Dividido en Secciones */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
                
                {/* SECCIÓN 1: DATOS DEL PEDIDO Y SELECCIÓN DE DESTINO */}
                <div className="p-4 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-3.5 shadow-md">
                  <div className="flex items-center justify-between border-b border-[#2d281e] pb-2">
                    <span className="text-xs font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5">
                      <Store className="w-4 h-4" />
                      1. Destino del Pedido
                    </span>
                    <span className="text-[10px] text-[#a8a29e]">¿Para dónde va la orden?</span>
                  </div>

                  {/* Selector de Modalidad */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[#121117] rounded-xl border border-[#2d281e]">
                    {[
                      { id: 'mesa', label: 'En Mesa', icon: Building2 },
                      { id: 'mostrador', label: 'Mostrador', icon: Store },
                      { id: 'para_llevar', label: 'Para Llevar', icon: ShoppingBag },
                      { id: 'domicilio', label: 'Domicilio', icon: Bike },
                    ].map((t) => {
                      const IconComp = t.icon;
                      const isActive = orderType === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setOrderType(t.id as OrderType);
                            setValidationError('');
                          }}
                          className={`py-2 px-2 text-xs font-black rounded-lg transition-all cursor-pointer flex flex-col items-center gap-1 ${
                            isActive
                              ? 'bg-[#d4af37] text-[#0e0e12] shadow-md scale-[1.02]'
                              : 'text-[#a8a29e] hover:text-[#fef3c7] hover:bg-[#1f1d28]'
                          }`}
                        >
                          <IconComp className="w-3.5 h-3.5" />
                          <span className="text-[11px]">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Características Específicas de cada Selección */}
                  {orderType === 'mesa' && (
                    <div className="space-y-1.5 pt-1">
                      <label className="block text-xs font-bold text-[#fef3c7] flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#d4af37]" />
                        Seleccionar Mesa Disponible:
                      </label>
                      <select
                        aria-label="Seleccionar Mesa"
                        value={selectedTableId}
                        onChange={(e) => {
                          setSelectedTableId(e.target.value);
                          setValidationError('');
                        }}
                        className="w-full bg-[#121117] border border-[#483d29] rounded-xl px-3 py-2 text-xs text-[#fef3c7] font-bold focus:outline-none focus:border-[#d4af37]"
                      >
                        <option value="">-- Elige la mesa en Guadalajara de Buga --</option>
                        {availableTables.map((t) => (
                          <option key={t.id} value={t.id}>
                            Mesa {t.number} — {t.zone} (Capacidad: {t.capacity} personas)
                          </option>
                        ))}
                      </select>
                      {availableTables.length === 0 && (
                        <p className="text-[10px] text-amber-400">
                          * Todas las mesas están ocupadas. Puedes seleccionar otra modalidad o liberar una mesa.
                        </p>
                      )}
                    </div>
                  )}

                  {orderType === 'mostrador' && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[11px] text-[#a8a29e]">
                        El pedido se retirará directamente en la barra/mostrador del restaurante.
                      </p>
                      <div>
                        <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">
                          Nombre del Cliente (Opcional):
                        </label>
                        <div className="relative">
                          <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a29e]" />
                          <input
                            type="text"
                            placeholder="Ej: Carlos Pérez..."
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {orderType === 'para_llevar' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">
                          Nombre Cliente:
                        </label>
                        <div className="relative">
                          <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a29e]" />
                          <input
                            type="text"
                            placeholder="Ej: María Gómez..."
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">
                          Teléfono / WhatsApp:
                        </label>
                        <div className="relative">
                          <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a29e]" />
                          <input
                            type="text"
                            placeholder="300 000 0000..."
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {orderType === 'domicilio' && (
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">
                            Nombre Cliente:
                          </label>
                          <div className="relative">
                            <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a29e]" />
                            <input
                              type="text"
                              placeholder="Ej: Andrés López..."
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">
                            Teléfono Contacto:
                          </label>
                          <div className="relative">
                            <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a29e]" />
                            <input
                              type="text"
                              placeholder="315 000 0000..."
                              value={customerPhone}
                              onChange={(e) => setCustomerPhone(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">
                          Dirección de Entrega Completa (Obligatorio):
                        </label>
                        <div className="relative">
                          <MapPin className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#d4af37]" />
                          <input
                            type="text"
                            placeholder="Calle 12 # 14-20, Buga..."
                            value={customerAddress}
                            onChange={(e) => {
                              setCustomerAddress(e.target.value);
                              setValidationError('');
                            }}
                            className="w-full pl-9 pr-3 py-2 bg-[#121117] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* SECCIÓN 2: SELECCIÓN Y REVISIÓN DE PRODUCTOS DEL PEDIDO */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#2d281e] pb-2">
                    <span className="text-xs font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5">
                      <ShoppingBag className="w-4 h-4" />
                      2. Platos y Bebidas Seleccionados ({cartItemCount})
                    </span>
                    <span className="text-[10px] text-[#a8a29e]">Detalle para comanda</span>
                  </div>

                  {cartItems.length === 0 ? (
                    <div className="py-10 text-center text-[#78716c] space-y-2 bg-[#17161f] rounded-2xl border border-dashed border-[#2d281e] p-4">
                      <UtensilsCrossed className="w-8 h-8 mx-auto text-[#4d3d19]" />
                      <p className="text-xs font-bold text-[#fef3c7]">Aún no has añadido productos</p>
                      <p className="text-[11px] text-[#a8a29e] max-w-xs mx-auto">
                        Presiona "+ Agregar" o el ícono de opciones en los platos para agregarlos con detalles.
                      </p>
                    </div>
                  ) : (
                    cartItems.map((line) => (
                      <div
                        key={line.lineItemId}
                        className="p-3 rounded-2xl bg-[#1a1922] border border-[#2d281e] space-y-2 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-black text-[#fef3c7]">{line.productName}</h4>
                              {line.variant && (
                                <span className="text-[10px] text-[#d4af37] font-bold bg-[#2b2416] px-1.5 py-0.2 rounded border border-[#d4af37]/40">
                                  {line.variant.name}
                                </span>
                              )}
                            </div>

                            {/* Modifiers breakdown */}
                            {line.selectedModifiers && line.selectedModifiers.length > 0 && (
                              <div className="text-[11px] text-[#a8a29e] mt-1 space-y-0.5">
                                {line.selectedModifiers.map((m) => (
                                  <div key={m.optionId} className="flex items-center justify-between">
                                    <span>
                                      • {m.groupName}: <strong className="text-white">{m.optionName}</strong>
                                      {m.quantity && m.quantity > 1 ? ` (x${m.quantity})` : ''}
                                      {m.textValue ? ` "${m.textValue}"` : ''}
                                    </span>
                                    {m.priceSurcharge > 0 && (
                                      <span className="text-[#d4af37] text-[10px] font-mono">
                                        +{formatCOP(m.priceSurcharge * (m.quantity || 1))}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Adjustments line */}
                            {line.adjustments && line.adjustments.length > 0 && (
                              <div className="text-[11px] text-emerald-400 mt-1 font-bold">
                                {line.adjustments.map((a) => (
                                  <div key={a.id}>
                                    {a.type === 'descuento' ? 'Desc' : 'Rec'}: {a.concept} (
                                    {a.modality === 'porcentaje' ? `${a.value}%` : formatCOP(a.value)})
                                  </div>
                                ))}
                              </div>
                            )}

                            <span className="font-mono text-xs font-bold text-[#d4af37] block mt-1">
                              {formatCOP(line.totalPrice)} ({formatCOP(line.unitPrice)} c/u)
                            </span>
                          </div>

                          {/* Action controls */}
                          <div className="flex items-center gap-1.5 bg-[#121117] p-1 rounded-xl border border-[#383124]">
                            <button
                              type="button"
                              onClick={() => handleUpdateLineQty(line.lineItemId || '', -1)}
                              className="w-6 h-6 rounded-lg bg-[#24222e] text-[#a8a29e] hover:text-white flex items-center justify-center font-black text-xs cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono font-bold text-xs px-1 text-[#fef3c7]">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateLineQty(line.lineItemId || '', 1)}
                              className="w-6 h-6 rounded-lg bg-[#2b2416] text-[#d4af37] hover:bg-[#d4af37] hover:text-[#0e0e12] flex items-center justify-center font-black text-xs cursor-pointer transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditLineItem(line)}
                              className="w-6 h-6 rounded-lg bg-[#24222e] text-[#d4af37] hover:bg-[#343042] flex items-center justify-center text-xs cursor-pointer"
                              title="Personalizar / Editar detalles"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLineItem(line.lineItemId || '')}
                              className="w-6 h-6 rounded-lg hover:bg-red-950/80 text-[#78716c] hover:text-red-400 flex items-center justify-center text-xs cursor-pointer"
                              title="Eliminar del pedido"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Line Notes */}
                        {line.notes && (
                          <div className="text-[11px] text-[#e6ca65] italic font-semibold bg-[#2a2315] px-2 py-1 rounded border border-[#52411e]">
                            Nota: {line.notes}
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  {/* Observación General */}
                  {cartItems.length > 0 && (
                    <div className="pt-1">
                      <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">
                        Observación general para la comanda:
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Entregar entradas primero, cliente alérgico a maní..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full bg-[#18171f] border border-[#2d281e] rounded-xl px-3 py-2 text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  )}
                </div>

                {/* SECCIÓN 3: RESUMEN FINANCIERO MÓVIL (SCROLLABLE DENTRO DEL CONTENIDO) */}
                <div className="p-4 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-3 shadow-md">
                  <div className="flex items-center justify-between border-b border-[#2d281e] pb-2">
                    <span className="text-xs font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4" />
                      3. Resumen Financiero
                    </span>
                    <span className="text-[10px] text-[#a8a29e]">Subtotal e Impuestos</span>
                  </div>

                  <div className="space-y-2 text-xs text-[#a8a29e]">
                    <div className="flex justify-between items-center">
                      <span>Subtotal Neto:</span>
                      <span className="font-semibold text-[#fef3c7] font-mono">{formatCOP(totals.subtotal)}</span>
                    </div>

                    {taxRate > 0 ? (
                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-[#fef3c7] hover:text-white">
                          <input
                            type="checkbox"
                            checked={includeTax}
                            onChange={(e) => setIncludeTax(e.target.checked)}
                            className="w-4 h-4 rounded bg-[#121117] border-[#383124] accent-[#d4af37] cursor-pointer"
                          />
                          <span className="text-xs font-bold">Incluir Impoconsumo ({Math.round(taxRate * 100)}%):</span>
                        </label>
                        <span className="font-semibold text-[#d4af37] font-mono">
                          {includeTax ? formatCOP(totals.tax) : '$0'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-[#a8a29e]">Impoconsumo:</span>
                        <span className="font-mono text-[#78716c]">Desactivado en Sede ($0)</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-[#2d281e] flex justify-between items-center text-sm sm:text-base font-black">
                      <span className="text-[#fef3c7]">Total Estimado:</span>
                      <span className="text-[#d4af37] font-mono text-base sm:text-lg">{formatCOP(totals.total)}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* FOOTER DEL DRAWER: BOTONES DE ACCIÓN FIJOS AL FINAL */}
              <div className="p-4 border-t border-[#2d281e] bg-[#16151c] flex gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="flex-1 py-3 px-3 rounded-xl border border-[#383124] text-xs font-bold text-[#a8a29e] hover:bg-[#1a1922] hover:text-white cursor-pointer text-center transition-colors"
                >
                  Seguir Agregando
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={cartItems.length === 0 || (orderType === 'mesa' && !selectedTableId) || actionLoading}
                  className={`flex-1 py-3 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all ${
                    cartItems.length === 0 || (orderType === 'mesa' && !selectedTableId) || actionLoading
                      ? 'bg-[#2a2213] text-[#78716c] cursor-not-allowed border border-[#383124]'
                      : 'bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] hover:brightness-110 active:scale-95 shadow-[#d4af37]/25'
                  }`}
                >
                  <CheckCircle className="w-4 h-4 stroke-[2.5]" />
                  <span>{actionLoading ? 'Procesando...' : 'Confirmar Orden →'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* MODAL DE PERSONALIZACIÓN Y DETALLES DEL PRODUCTO */}
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
