import React, { useState, useMemo } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Product, Category } from '../../types';
import { filterProducts, sortCategories, formatProductPrice } from '../../utils/productUtils';
import { ProductCard } from './ProductCard';
import { ProductCustomizeModal } from './ProductCustomizeModal';
import { ProductManagementModal } from './ProductManagementModal';
import { CategoryManagementModal } from './CategoryManagementModal';
import { ModifierGroupManagementModal } from './ModifierGroupManagementModal';
import { ProductExcelImportPanel } from './ProductExcelImportPanel';
import {
  UtensilsCrossed,
  Search,
  Plus,
  Sliders,
  Layers,
  Sparkles,
  Building2,
  Flame,
  Boxes,
  CheckCircle2,
  Filter,
  Eye,
  LayoutGrid,
  List,
  Edit,
  Trash2,
  AlertTriangle,
  Tag,
  HelpCircle,
  Lock,
} from 'lucide-react';

export const ProductCatalogView: React.FC = () => {
  const {
    products,
    catalogCategories,
    prepStations,
    modifierGroups,
    currentBranch,
    toggleProductStatus,
    deleteProduct,
    actionLoading,
  } = useRestaurant();
  const { currentUser, branches } = useAuth();
  const { showToast } = useToast();

  // Search & Filter State
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [deliveryOnly, setDeliveryOnly] = useState<boolean>(false);
  const [combosOnly, setCombosOnly] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals state
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState<boolean>(false);
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [showModifierModal, setShowModifierModal] = useState<boolean>(false);

  const canManage = currentUser?.role === 'administrador';

  // Sorted active categories
  const sortedCategories = useMemo(() => {
    return sortCategories(catalogCategories);
  }, [catalogCategories]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    let list = filterProducts(products, {
      searchTerm,
      categoryId: selectedCategoryId,
      branchId: selectedBranchFilter,
      status: selectedStatus,
      availableForDeliveryOnly: deliveryOnly,
    });

    if (combosOnly) {
      list = list.filter((p) => p.isCombo);
    }

    const dailyIdx = list.findIndex((p) => p.id === 'prod-almuerzo-del-dia' || p.isDailyMenu);
    if (dailyIdx > 0) {
      const [daily] = list.splice(dailyIdx, 1);
      list.unshift(daily);
    }

    return list;
  }, [
    products,
    searchTerm,
    selectedCategoryId,
    selectedBranchFilter,
    selectedStatus,
    deliveryOnly,
    combosOnly,
  ]);

  // Stats Counters
  const totalActiveProducts = products.filter((p) => p.status === 'activo').length;
  const totalCombos = products.filter((p) => p.isCombo).length;
  const totalCategories = catalogCategories.filter((c) => c.isActive).length;

  return (
    <div className="space-y-6">
      {/* 1. Header Hero & Navigation Bar */}
      <div className="rounded-3xl bg-[#181818] border border-[#B77900]/30 p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#292212] border border-[#B77900]/60 text-[#D6A21A] flex items-center justify-center shadow-lg">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-[#FFFDF5] tracking-tight">
                  Catálogo de Productos
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-[#B77900] text-[#181818] text-[10px] font-black uppercase tracking-wider">
                  MÓDULO 03
                </span>
              </div>
              <p className="text-xs text-[#d6d3d1] mt-0.5">
                Gestión de categorías, hamburguesas, costillas, alitas, bebidas, variantes de precio, modificadores y combos.
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                className="px-3.5 py-2 rounded-xl bg-[#252525] hover:bg-[#303030] border border-zinc-700 text-zinc-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-[#D6A21A]" />
                <span>Categorías ({catalogCategories.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setShowModifierModal(true)}
                className="px-3.5 py-2 rounded-xl bg-[#252525] hover:bg-[#303030] border border-zinc-700 text-zinc-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-[#D6A21A]" />
                <span>Modificadores ({modifierGroups.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCreatingProduct(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] text-xs font-black hover:brightness-110 active:scale-95 transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Nuevo Producto</span>
              </button>
            </div>
          )}
        </div>

        {/* 2. Overview Stats Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-[#383838]">
          <div className="p-3 rounded-2xl bg-[#242424] border border-[#383838] flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-[#292212] border border-[#B77900]/40 text-[#D6A21A] flex items-center justify-center font-bold">
              <Tag className="w-4 h-4" />
            </span>
            <div>
              <div className="text-base font-black text-[#FFFDF5]">{products.length}</div>
              <div className="text-[10px] text-zinc-400">Total Productos</div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-[#242424] border border-[#383838] flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-700/40 text-emerald-300 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </span>
            <div>
              <div className="text-base font-black text-emerald-400">{totalActiveProducts}</div>
              <div className="text-[10px] text-zinc-400">Disponibles Venta</div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-[#242424] border border-[#383838] flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-amber-950/80 border border-amber-600/40 text-[#D6A21A] flex items-center justify-center font-bold">
              <Boxes className="w-4 h-4" />
            </span>
            <div>
              <div className="text-base font-black text-[#D6A21A]">{totalCombos}</div>
              <div className="text-[10px] text-zinc-400">Combos Especiales</div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-[#242424] border border-[#383838] flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-rose-950/80 border border-rose-700/40 text-rose-300 flex items-center justify-center font-bold">
              <Flame className="w-4 h-4" />
            </span>
            <div>
              <div className="text-base font-black text-rose-400">{prepStations.length}</div>
              <div className="text-[10px] text-zinc-400">Estaciones KDS (M02)</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2.5. Espacio de Carga Masiva por Excel */}
      {canManage && <ProductExcelImportPanel />}

      {/* 3. Category Tabs Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedCategoryId('todos')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 border ${
            selectedCategoryId === 'todos'
              ? 'bg-[#B77900] text-[#181818] border-[#B77900] shadow-md'
              : 'bg-[#1a1a1a] text-zinc-300 border-[#2d2d2d] hover:border-[#B77900]/50'
          }`}
        >
          <span>Todos los Platos</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              selectedCategoryId === 'todos' ? 'bg-[#181818] text-[#D6A21A]' : 'bg-[#292929] text-zinc-400'
            }`}
          >
            {products.length}
          </span>
        </button>

        {sortedCategories.map((cat) => {
          const isSelected = selectedCategoryId === cat.id;
          const count = products.filter((p) => p.categoryId === cat.id).length;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 border ${
                isSelected
                  ? 'bg-[#B77900] text-[#181818] border-[#B77900] shadow-md'
                  : 'bg-[#1a1a1a] text-zinc-300 border-[#2d2d2d] hover:border-[#B77900]/50'
              }`}
            >
              <span>{cat.name}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  isSelected ? 'bg-[#181818] text-[#D6A21A]' : 'bg-[#292929] text-zinc-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. Toolbar & Search Controls */}
      <div className="p-4 rounded-2xl bg-[#191919] border border-[#2b2b2b] flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, SKU o ingredientes..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#131313] border border-[#2d2d2d] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D6A21A]"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Branch filter */}
          <select
            value={selectedBranchFilter}
            onChange={(e) => setSelectedBranchFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#131313] border border-[#2d2d2d] text-xs text-zinc-300 focus:outline-none focus:border-[#D6A21A]"
          >
            <option value="all">Todas las Sedes</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#131313] border border-[#2d2d2d] text-xs text-zinc-300 focus:outline-none focus:border-[#D6A21A]"
          >
            <option value="todos">Todos los Estados</option>
            <option value="activo">Solo Activos</option>
            <option value="agotado">Solo Agotados</option>
            <option value="inactivo">Solo Inactivos</option>
          </select>

          {/* Quick toggle chips */}
          <button
            type="button"
            onClick={() => setDeliveryOnly(!deliveryOnly)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
              deliveryOnly
                ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                : 'bg-[#1e1e1e] text-zinc-400 border-zinc-700 hover:text-white'
            }`}
          >
            Domicilio
          </button>

          <button
            type="button"
            onClick={() => setCombosOnly(!combosOnly)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
              combosOnly
                ? 'bg-[#292212] text-[#D6A21A] border-[#B77900]'
                : 'bg-[#1e1e1e] text-zinc-400 border-zinc-700 hover:text-white'
            }`}
          >
            Solo Combos
          </button>

          {/* View mode toggle */}
          <div className="flex items-center bg-[#242424] p-1 rounded-xl border border-[#383838]">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#292212] text-[#D6A21A]'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Vista en tarjetas cuadrícula"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-[#292212] text-[#D6A21A]'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Vista en tabla administrativa"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Main Catalog Content (Grid or Table) */}
      {filteredProducts.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-[#181818] border border-[#383838] text-zinc-400 space-y-3">
          <UtensilsCrossed className="w-12 h-12 mx-auto text-zinc-600" />
          <h3 className="text-base font-bold text-white">No se encontraron productos</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            No existen productos registrados con los filtros seleccionados o con el término de búsqueda ingresado.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategoryId('todos');
              setSelectedStatus('todos');
              setDeliveryOnly(false);
              setCombosOnly(false);
            }}
            className="px-4 py-2 rounded-xl bg-[#252525] hover:bg-[#303030] text-xs font-bold text-[#D6A21A] cursor-pointer"
          >
            Limpiar Filtros
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((prod) => (
            <ProductCard
              key={prod.id}
              product={prod}
              prepStations={prepStations}
              canManage={canManage}
              onCustomize={(p) => setCustomizingProduct(p)}
              onEdit={(p) => setEditingProduct(p)}
              onDelete={(p) => setProductToDelete(p)}
              onToggleStatus={(p) =>
                toggleProductStatus(
                  p.id,
                  p.status === 'activo' ? 'agotado' : 'activo'
                )
              }
            />
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="rounded-3xl bg-[#191919] border border-[#2b2b2b] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-[#141414] text-[11px] uppercase tracking-wider text-zinc-400 border-b border-[#2b2b2b]">
                <tr>
                  <th className="py-3.5 px-4">Producto</th>
                  <th className="py-3.5 px-4">SKU</th>
                  <th className="py-3.5 px-4">Categoría</th>
                  <th className="py-3.5 px-4">Estación KDS</th>
                  <th className="py-3.5 px-4">Variantes</th>
                  <th className="py-3.5 px-4">Precio (COP)</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262626]">
                {filteredProducts.map((p) => {
                  const prepStation = prepStations.find((s) => s.id === p.prepStationId);

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-[#1f1f1f] transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {p.images && p.images.length > 0 ? (
                            <img
                              src={p.images[0]}
                              alt=""
                              className="w-10 h-10 rounded-xl object-cover border border-zinc-700 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-[#1a1924] border border-zinc-700 flex items-center justify-center flex-shrink-0 text-zinc-400">
                              <UtensilsCrossed className="w-4 h-4 text-[#D6A21A]/70" />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-[#FFFDF5] group-hover:text-[#D6A21A] transition-colors">
                              {p.name}
                            </div>
                            <div className="text-[10px] text-zinc-500 line-clamp-1">
                              {p.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="sku-badge inline-block px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wide border shadow-xs bg-[#292212] text-[#D6A21A] border-[#B77900]/60">
                          {p.sku || 'SIN-SKU'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-zinc-300">
                        {p.categoryName || 'Gastronomía'}
                      </td>
                      <td className="py-3 px-4">
                        {prepStation ? (
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm inline-flex items-center gap-1"
                            style={{ backgroundColor: prepStation.color || '#ea580c' }}
                          >
                            <Flame className="w-3 h-3" />
                            <span>{prepStation.name}</span>
                          </span>
                        ) : (
                          <span className="text-zinc-500 text-[11px]">General</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {p.variants && p.variants.length > 0 ? (
                          <span className="text-xs text-[#D6A21A] font-bold">
                            {p.variants.length} variantes
                          </span>
                        ) : (
                          <span className="text-zinc-500">Único</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-black text-[#D6A21A] text-sm">
                        {formatProductPrice(p.price)}
                      </td>
                      <td className="py-3 px-4">
                        {p.status === 'activo' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                            Activo
                          </span>
                        ) : p.status === 'agotado' ? (
                          <span className="px-2 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-800 text-[10px] font-bold">
                            Agotado
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px] font-bold">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.isDailyMenu || p.id === 'prod-almuerzo-del-dia' ? (
                            <>
                              <span
                                className="px-2 py-1 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-400 text-[10px] font-bold flex items-center gap-1 shadow-sm"
                                title="Producto del sistema protegido contra edición estándar y borrado"
                              >
                                <Lock className="w-3 h-3 text-amber-400" />
                                <span>Protegido</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setCustomizingProduct(p)}
                                className="px-3 py-1.5 rounded-lg text-xs font-black bg-gradient-to-r from-amber-500 to-[#D6A21A] text-[#181818] hover:brightness-110 transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                                title="Seleccionar y elegir parámetros establecidos del Menú del Día"
                              >
                                <Sparkles className="w-3.5 h-3.5 fill-current" />
                                <span>Seleccionar Parámetros</span>
                              </button>
                            </>
                          ) : canManage ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingProduct(p)}
                                className="px-3 py-1.5 rounded-lg text-xs font-black bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] hover:brightness-110 transition-all cursor-pointer shadow-md flex items-center gap-1"
                                title="Editar producto"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Editar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setProductToDelete(p)}
                                className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900 border border-red-800/40 text-red-400 hover:text-red-200 cursor-pointer"
                                title="Eliminar producto permanentemente"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Active Modals */}
      {customizingProduct && (
        <ProductCustomizeModal
          product={customizingProduct}
          modifierGroups={modifierGroups}
          onClose={() => setCustomizingProduct(null)}
        />
      )}

      {(isCreatingProduct || editingProduct) && (
        <ProductManagementModal
          product={editingProduct}
          onClose={() => {
            setIsCreatingProduct(false);
            setEditingProduct(null);
          }}
        />
      )}

      {showCategoryModal && (
        <CategoryManagementModal onClose={() => setShowCategoryModal(false)} />
      )}

      {showModifierModal && (
        <ModifierGroupManagementModal onClose={() => setShowModifierModal(false)} />
      )}

      {/* Modal Confirmación de Eliminación de Producto */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#1c1b18] border border-red-800/80 rounded-3xl p-6 max-w-md w-full shadow-2xl text-[#FFFDF5] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-950/70 border border-red-700/60 text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">¿Eliminar Producto?</h3>
                <p className="text-xs text-zinc-400">Esta acción retirará el plato del restaurante.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#141414] border border-[#2b2b2b] text-xs space-y-1">
              <div className="font-bold text-[#D6A21A] text-sm">{productToDelete.name}</div>
              <div className="text-zinc-400 font-mono text-[11px] flex items-center gap-1.5 flex-wrap">
                <span>SKU:</span>
                <span className="sku-badge px-1.5 py-0.5 rounded font-mono font-bold text-[#D6A21A] bg-[#292212] border border-[#B77900]/60">
                  {productToDelete.sku}
                </span>
                <span>· Precio: {formatProductPrice(productToDelete.price)}</span>
              </div>
              {productToDelete.description && (
                <div className="text-zinc-500 text-[11px] line-clamp-2">{productToDelete.description}</div>
              )}
            </div>

            {productToDelete.isDailyMenu || productToDelete.id === 'prod-almuerzo-del-dia' ? (
              <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-200 text-xs space-y-3">
                <div className="flex items-center gap-2 font-black text-[#D6A21A] text-sm">
                  <Lock className="w-4 h-4 text-[#D6A21A]" />
                  <span>Producto Protegido del Sistema</span>
                </div>
                <p className="leading-relaxed text-zinc-300">
                  El <strong>Menú del Día</strong> es un producto central del restaurante y no puede ser eliminado ni borrado del sistema para preservar la estructura de Sopa, Principio, Carne y Acompañamientos.
                </p>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setProductToDelete(null)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-bold text-xs cursor-pointer"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-zinc-300">
                  ¿Estás seguro de que deseas eliminar permanentemente este producto? Se eliminará del menú, de las opciones de pedidos activos y de la cocina.
                </p>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#2d2d2d]">
                  <button
                    type="button"
                    onClick={() => setProductToDelete(null)}
                    className="px-4 py-2 rounded-xl bg-[#282828] text-zinc-300 hover:bg-[#333] text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={async () => {
                      try {
                        await deleteProduct(productToDelete.id);
                        showToast(`Producto "${productToDelete.name}" eliminado correctamente`, 'success');
                        setProductToDelete(null);
                      } catch (err) {
                        showToast('Error al eliminar el producto', 'error');
                      }
                    }}
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black shadow-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{actionLoading ? 'Eliminando...' : 'Sí, Eliminar Producto'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
