import React, { useState, useMemo } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { MenuItem, Order } from '../../types';
import { formatCOP, calculateOrderTotals, getEffectiveTaxRate } from '../../utils/calculations';
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
  History,
  Trash2,
  Layers,
} from 'lucide-react';

interface AddRoundModalProps {
  order: Order;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddRoundModal: React.FC<AddRoundModalProps> = ({
  order,
  onClose,
  onSuccess,
}) => {
  const {
    currentBranch,
    categories,
    menuItems,
    products,
    addRoundToOrder,
    actionLoading,
  } = useRestaurant();

  const nextRoundNumber = (order.currentRound || 1) + 1;
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  // Carrito de items para esta ronda nueva
  const [roundCart, setRoundCart] = useState<
    Record<string, { menuItem: MenuItem; quantity: number; notes: string }>
  >({});

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

  const handleAddItem = (item: MenuItem) => {
    setRoundCart((prev) => {
      const existing = prev[item.id];
      if (existing) {
        return {
          ...prev,
          [item.id]: {
            ...existing,
            quantity: existing.quantity + 1,
          },
        };
      }
      return {
        ...prev,
        [item.id]: {
          menuItem: item,
          quantity: 1,
          notes: '',
        },
      };
    });
  };

  const handleRemoveItem = (itemId: string) => {
    setRoundCart((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return {
        ...prev,
        [itemId]: {
          ...existing,
          quantity: existing.quantity - 1,
        },
      };
    });
  };

  const handleDeleteItem = (itemId: string) => {
    setRoundCart((prev) => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  };

  const handleUpdateNotes = (itemId: string, noteText: string) => {
    setRoundCart((prev) => {
      if (!prev[itemId]) return prev;
      return {
        ...prev,
        [itemId]: {
          ...prev[itemId],
          notes: noteText,
        },
      };
    });
  };

  const cartList = Object.values(roundCart);
  const cartItemCount = cartList.reduce((acc, i) => acc + i.quantity, 0);
  const taxRate = getEffectiveTaxRate(currentBranch);
  const newRoundTotals = calculateOrderTotals(
    cartList.map((i) => ({ price: i.menuItem.price, quantity: i.quantity })),
    taxRate,
    order.tip > 0,
    0.10
  );

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (cartList.length === 0) return;

    try {
      await addRoundToOrder(
        order.id,
        cartList.map((c) => ({
          menuItem: c.menuItem,
          quantity: c.quantity,
          notes: c.notes,
        }))
      );
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error adding round:', err);
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
        
        {/* Cabecera Principal Estilo Kiosco */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-[#2d281e] bg-gradient-to-r from-[#1a1722] via-[#16141d] to-[#121117] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#2a2213] border border-[#d4af37]/50 flex items-center justify-center text-[#d4af37] shadow-md shadow-[#d4af37]/10">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-[#fef3c7] tracking-tight">
                  Agregar Productos · Ronda #{nextRoundNumber}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#2b2416] text-[#d4af37] border border-[#d4af37]/40">
                  {order.tableName || `Pedido #${order.orderNumber}`}
                </span>
              </div>
              <p className="text-[11px] text-[#a8a29e]">
                {currentBranch?.name} · La cocina recibirá la comanda solo con los nuevos ítems de esta adición
              </p>
            </div>
          </div>

          {/* Acciones de Cabecera: Rondas Anteriores y Cerrar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#383124] text-xs font-bold text-[#d4af37] hover:bg-[#1f1d28] cursor-pointer transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              <span>{showHistory ? 'Ocultar Consumo Previo' : 'Ver Consumo Previo'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-[#1c1a24] hover:bg-[#282633] border border-[#383124] text-[#a8a29e] hover:text-[#fef3c7] flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Cerrar modal"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-barra: Consumo Previo Desplegable si está activo */}
        {showHistory && (
          <div className="px-4 sm:px-6 py-2.5 bg-[#18171f] border-b border-[#2d281e] max-h-32 overflow-y-auto shrink-0">
            <div className="text-[11px] font-bold text-[#a8a29e] mb-1 uppercase tracking-wider">
              Productos ya pedidos en esta mesa (Rondas anteriores):
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {order.items.map((it, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-lg bg-[#121117] border border-[#2d281e] text-[#d6d3d1]"
                >
                  <strong className="text-[#d4af37]">{it.quantity}x</strong> {it.name} ({formatCOP(it.price * it.quantity)})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sub-barra: Buscador & Categorías de Menú */}
        <div className="px-4 sm:px-6 py-2.5 bg-[#16151c] border-b border-[#2d281e] flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Pestañas de Categorías */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-1">
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

          {/* Buscador de Platos */}
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

        {/* CATÁLOGO COMPLETO ESTILO MCDONALD'S (100% ANCHO, ESPACIOSO Y VISIBLE) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0f0e13]">
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
                const inCart = roundCart[item.id]?.quantity || 0;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleAddItem(item)}
                    className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden cursor-pointer group hover:scale-[1.01] hover:shadow-xl ${
                      inCart > 0
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

                      {/* Badge si ya está seleccionado */}
                      {inCart > 0 && (
                        <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-[#d4af37] text-[#0e0e12] shadow-lg flex items-center gap-0.5 animate-in zoom-in-95">
                          ✓ +{inCart}
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

                        <div onClick={(e) => e.stopPropagation()}>
                          {inCart > 0 ? (
                            <div className="flex items-center gap-0.5 bg-[#121117] p-0.5 rounded-lg border border-[#d4af37]/50 shadow-inner">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="w-5 h-5 rounded-md bg-[#24222e] hover:bg-[#343042] text-[#a8a29e] hover:text-white flex items-center justify-center font-black text-[11px] cursor-pointer"
                                title="Disminuir cantidad"
                              >
                                -
                              </button>
                              <span className="font-mono font-black text-[11px] px-1 text-[#d4af37]">
                                +{inCart}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAddItem(item)}
                                className="w-5 h-5 rounded-md bg-[#d4af37] hover:brightness-110 text-[#0e0e12] font-black text-[11px] flex items-center justify-center cursor-pointer shadow"
                                title="Agregar otro"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddItem(item)}
                              className="py-1 px-2.5 rounded-lg bg-gradient-to-r from-[#292212] to-[#3a2f16] group-hover:from-[#d4af37] group-hover:to-[#b89728] text-[#fef3c7] group-hover:text-[#0e0e12] border border-[#d4af37]/60 font-black text-[10px] sm:text-[11px] flex items-center justify-center shadow-sm transition-all cursor-pointer hover:brightness-110 active:scale-95"
                            >
                              <span>Agregar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER DE RONDA DOCKED AL FINAL */}
        <div className="border-t border-[#2d281e] bg-[#16151c] px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsCartOpen(!isCartOpen)}
              className="relative p-2.5 rounded-xl bg-[#2b2416] border border-[#d4af37]/60 text-[#d4af37] hover:brightness-110 flex items-center justify-center cursor-pointer shadow transition-all shrink-0"
              title="Ver adicionales de la ronda"
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
                <span className="text-xs text-[#a8a29e] hidden sm:inline">Ronda #{nextRoundNumber}:</span>
                <span className="text-base sm:text-lg font-black text-[#d4af37] font-mono leading-none">
                  +{formatCOP(newRoundTotals.total)}
                </span>
                <span className="text-[11px] text-emerald-400 font-bold ml-1 hidden md:inline">
                  (Nuevo total: {formatCOP(order.total + newRoundTotals.total)})
                </span>
              </div>
              <span className="text-[11px] text-[#a8a29e] block leading-tight truncate">
                {cartItemCount} {cartItemCount === 1 ? 'producto nuevo' : 'productos nuevos'} seleccionados
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsCartOpen(!isCartOpen)}
              className="py-2.5 px-3.5 sm:px-4 rounded-xl bg-[#24222e] hover:bg-[#302d3d] text-[#fef3c7] font-bold text-xs flex items-center gap-1.5 border border-[#383124] transition-all cursor-pointer whitespace-nowrap"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>{isCartOpen ? 'Ocultar' : `Ver Adición (${cartItemCount})`}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={cartItemCount === 0 || actionLoading}
              className={`py-2.5 px-4 sm:px-5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg transition-all cursor-pointer whitespace-nowrap ${
                cartItemCount === 0 || actionLoading
                  ? 'bg-[#2a2213] text-[#78716c] cursor-not-allowed border border-[#383124]'
                  : 'bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] hover:brightness-110 active:scale-95 shadow-[#d4af37]/25'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 stroke-[3]" />
              <span>{actionLoading ? 'Enviando...' : `+ Confirmar Ronda #${nextRoundNumber} →`}</span>
            </button>
          </div>
        </div>

        {/* DRAWER / PANEL LATERAL DESPLEGABLE "NUEVOS PRODUCTOS" (SIN APLASTAR EL CATÁLOGO) */}
        {isCartOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              className="w-full sm:max-w-md md:max-w-lg bg-[#14131a] border-l border-[#3f3521] shadow-2xl flex flex-col justify-between text-[#faf5ee] h-full animate-in slide-in-from-right duration-250"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabecera del Carrito */}
              <div className="px-5 py-4 border-b border-[#2d281e] flex items-center justify-between bg-[#18171f]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#2a2213] border border-[#d4af37]/50 flex items-center justify-center text-[#d4af37]">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-[#fef3c7]">Nuevos Productos para Ronda #{nextRoundNumber}</h3>
                    <p className="text-[11px] text-[#a8a29e]">
                      {order.tableName || `Pedido #${order.orderNumber}`} · {cartItemCount} items a sumar
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="w-8 h-8 rounded-xl bg-[#24222e] hover:bg-[#322f3f] text-[#a8a29e] hover:text-white flex items-center justify-center cursor-pointer"
                  aria-label="Cerrar panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Lista de Items con Notas y Controles */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
                {cartList.length === 0 ? (
                  <div className="py-16 text-center text-[#78716c] space-y-2">
                    <UtensilsCrossed className="w-10 h-10 mx-auto text-[#4d3d19]" />
                    <p className="text-sm font-bold text-[#fef3c7]">No has seleccionado nuevos productos</p>
                    <p className="text-xs text-[#a8a29e] max-w-xs mx-auto">
                      Toca "+ Agregar" en las bebidas, platos o postres que los comensales desean añadir a su mesa.
                    </p>
                  </div>
                ) : (
                  cartList.map(({ menuItem, quantity, notes: itemNotes }) => (
                    <div
                      key={menuItem.id}
                      className="p-3.5 rounded-2xl bg-[#1a1922] border border-[#2d281e] space-y-2.5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-[#fef3c7]">{menuItem.name}</h4>
                          <span className="font-mono text-xs font-bold text-[#d4af37]">
                            {formatCOP(menuItem.price * quantity)}
                          </span>
                        </div>

                        {/* Controles de Cantidad */}
                        <div className="flex items-center gap-1.5 bg-[#121117] p-1 rounded-xl border border-[#383124]">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(menuItem.id)}
                            className="w-6 h-6 rounded-lg bg-[#24222e] text-[#a8a29e] hover:text-white flex items-center justify-center font-black text-xs cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono font-bold text-xs px-2 text-[#fef3c7]">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddItem(menuItem)}
                            className="w-6 h-6 rounded-lg bg-[#2b2416] text-[#d4af37] hover:bg-[#d4af37] hover:text-[#0e0e12] flex items-center justify-center font-black text-xs cursor-pointer transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(menuItem.id)}
                            className="w-6 h-6 rounded-lg hover:bg-red-950/80 text-[#78716c] hover:text-red-400 flex items-center justify-center text-xs ml-1 cursor-pointer"
                            title="Eliminar de esta ronda"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Nota para Cocina */}
                      <input
                        type="text"
                        placeholder="Nota de preparación para cocina..."
                        value={itemNotes}
                        onChange={(e) => handleUpdateNotes(menuItem.id, e.target.value)}
                        className="w-full bg-[#121117] border border-[#2d281e] rounded-xl px-3 py-1.5 text-xs text-[#d6d3d1] placeholder-[#57534e] focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  ))
                )}
              </div>

              {/* Resumen Financiero de la Ronda y Total */}
              <div className="p-4 sm:p-5 border-t border-[#2d281e] bg-[#16151c] space-y-3">
                <div className="space-y-1.5 text-xs text-[#a8a29e]">
                  <div className="flex justify-between">
                    <span>Total Previo de la Mesa:</span>
                    <span className="font-semibold text-[#fef3c7] font-mono">{formatCOP(order.total)}</span>
                  </div>
                  <div className="flex justify-between text-[#d4af37] font-bold">
                    <span>Adicional de esta Ronda #{nextRoundNumber}:</span>
                    <span className="font-mono">+{formatCOP(newRoundTotals.total)}</span>
                  </div>
                  <div className="pt-2 border-t border-[#2d281e] flex justify-between text-base font-black">
                    <span className="text-[#fef3c7]">Nuevo Total de la Mesa:</span>
                    <span className="text-emerald-400 font-mono">{formatCOP(order.total + newRoundTotals.total)}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCartOpen(false)}
                    className="flex-1 py-2.5 px-3 rounded-xl border border-[#383124] text-xs font-bold text-[#a8a29e] hover:bg-[#1a1922] cursor-pointer text-center"
                  >
                    Seguir Agregando
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    disabled={cartList.length === 0 || actionLoading}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all ${
                      cartList.length === 0 || actionLoading
                        ? 'bg-[#2a2213] text-[#78716c] cursor-not-allowed'
                        : 'bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] hover:brightness-110 active:scale-95 shadow-[#d4af37]/25'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4 stroke-[2.5]" />
                    <span>{actionLoading ? 'Enviando...' : `Confirmar Ronda #${nextRoundNumber}`}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
