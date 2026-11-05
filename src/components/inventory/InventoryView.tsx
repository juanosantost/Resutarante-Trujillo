import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { InventoryItem, InventoryMovementType, ProductionLog } from '../../types';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { InventoryItemModal } from './InventoryItemModal';
import { ProduceItemModal } from './ProduceItemModal';
import { ProductionDetailModal } from './ProductionDetailModal';
import {
  Boxes,
  AlertTriangle,
  PlusCircle,
  History,
  BookOpen,
  Search,
  Sparkles,
  Plus,
  UtensilsCrossed,
  Barcode,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Eye,
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const {
    inventory,
    inventoryMovements,
    productionLogs,
    products,
    updateInventoryStock,
    currentBranch,
    actionLoading,
  } = useRestaurant();

  const [activeTab, setActiveTab] = useState<'insumos' | 'recetas' | 'producciones' | 'kardex'>('insumos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('todos');

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [itemToProduce, setItemToProduce] = useState<InventoryItem | null>(null);
  const [selectedProductionLog, setSelectedProductionLog] = useState<ProductionLog | null>(null);

  // Modal de ajuste / entrada manual
  const [selectedItemForAdjust, setSelectedItemForAdjust] = useState<InventoryItem | null>(null);
  const [adjustType, setAdjustType] = useState<InventoryMovementType>('compra_entrada');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(100);
  const [adjustReason, setAdjustReason] = useState<string>('');

  // Categorías únicas de inventario
  const categoriesList = Array.from(new Set(inventory.map((i) => i.category || 'General')));

  const filteredInventory = inventory.filter((item) => {
    if (categoryFilter !== 'todos' && (item.category || 'General') !== categoryFilter) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const matchName = item.name.toLowerCase().includes(q);
    const matchCat = (item.category || '').toLowerCase().includes(q);
    const matchRef = (item.reference || '').toLowerCase().includes(q);
    const matchCode = (item.barcode || '').toLowerCase().includes(q);
    return matchName || matchCat || matchRef || matchCode;
  });

  const lowStockItems = inventory.filter((i) => i.currentStock <= i.minStock);

  // Valor total del inventario en COP
  const totalInventoryValue = inventory.reduce(
    (sum, i) => sum + i.currentStock * (i.costPerUnit || 0),
    0
  );

  const handleExecuteAdjust = async () => {
    if (!selectedItemForAdjust || !adjustReason.trim() || adjustQuantity <= 0) return;
    try {
      await updateInventoryStock(
        selectedItemForAdjust.id,
        adjustQuantity,
        adjustType === 'compra_entrada' ? 'compra_entrada' : adjustType === 'merma' ? 'merma' : 'ajuste_manual',
        adjustReason.trim()
      );
      setSelectedItemForAdjust(null);
      setAdjustReason('');
    } catch (err) {
      console.error('Error updating stock:', err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Cabecera & Métricas */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[#fef3c7] flex items-center gap-2">
            <Boxes className="w-6 h-6 text-[#d4af37]" />
            <span>Artículos de Inventario & Existencias</span>
          </h2>
          <p className="text-xs text-[#a8a29e]">
            {currentBranch?.name} · Gestión física independiente con escandallo y producción
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="py-2.5 px-4 rounded-2xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs hover:brightness-110 active:scale-95 shadow-lg shadow-[#d4af37]/20 flex items-center gap-2 cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Nuevo Artículo de Inventario</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[#14131a] p-4 rounded-2xl border border-[#2d281e]">
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider">
            Artículos Registrados
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-[#fef3c7]">{inventory.length}</span>
            <span className="text-xs text-[#a8a29e]">artículos en inventario</span>
          </div>
        </div>

        <div className="bg-[#14131a] p-4 rounded-2xl border border-[#2d281e]">
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider">
            Artículos en Nivel Crítico
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-xl font-black ${lowStockItems.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {lowStockItems.length}
            </span>
            <span className="text-xs text-[#a8a29e]">bajo stock mínimo</span>
          </div>
        </div>

        <div className="bg-[#14131a] p-4 rounded-2xl border border-[#2d281e]">
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider">
            Valor Total en Bodega
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-[#d4af37]">{formatCOP(totalInventoryValue)}</span>
          </div>
        </div>
      </div>

      {/* Selector de Pestañas */}
      <div className="flex items-center gap-2 border-b border-[#2d281e] pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('insumos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'insumos'
              ? 'bg-[#2b2416] text-[#d4af37] border border-[#d4af37]'
              : 'bg-[#14131a] text-[#a8a29e] border border-[#24211a] hover:bg-[#1a1922]'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Artículos ({inventory.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('recetas')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'recetas'
              ? 'bg-[#2b2416] text-[#d4af37] border border-[#d4af37]'
              : 'bg-[#14131a] text-[#a8a29e] border border-[#24211a] hover:bg-[#1a1922]'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Productos Comercializados ({products.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('producciones')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'producciones'
              ? 'bg-[#2b2416] text-[#d4af37] border border-[#d4af37]'
              : 'bg-[#14131a] text-[#a8a29e] border border-[#24211a] hover:bg-[#1a1922]'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Producciones Registradas ({productionLogs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('kardex')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'kardex'
              ? 'bg-[#2b2416] text-[#d4af37] border border-[#d4af37]'
              : 'bg-[#14131a] text-[#a8a29e] border border-[#24211a] hover:bg-[#1a1922]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Kardex / Trazabilidad ({inventoryMovements.length})</span>
        </button>
      </div>

      {/* PESTAÑA 1: ARTÍCULOS DE INVENTARIO */}
      {activeTab === 'insumos' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 text-[#a8a29e] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por nombre, categoría, referencia o código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#14131a] border border-[#383124] rounded-xl pl-9 pr-3 py-2 text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-[#a8a29e]" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-[#14131a] border border-[#383124] rounded-xl px-3 py-2 text-xs text-[#fef3c7] focus:outline-none"
              >
                <option value="todos">Todas las Categorías</option>
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-[#14131a] rounded-2xl border border-[#2d281e] overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#d6d3d1]">
                <thead className="bg-[#18171f] text-[10px] uppercase font-bold text-[#a8a29e] border-b border-[#2d281e]">
                  <tr>
                    <th className="p-3.5">Artículo</th>
                    <th className="p-3.5">Categoría</th>
                    <th className="p-3.5">Stock Disponible</th>
                    <th className="p-3.5">Mínimo</th>
                    <th className="p-3.5">Costo Unit.</th>
                    <th className="p-3.5">Valor Total</th>
                    <th className="p-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24211a]">
                  {filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[#78716c]">
                        No se encontraron artículos de inventario.
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map((item) => {
                      const isLow = item.currentStock <= item.minStock;
                      const hasRecipe = item.isProducible || (item.productionRecipe && item.productionRecipe.length > 0);

                      return (
                        <tr key={item.id} className="hover:bg-[#1a1922] transition-colors">
                          <td className="p-3.5 font-bold text-[#fef3c7]">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-[#121117] border border-[#2d281e] overflow-hidden shrink-0 flex items-center justify-center">
                                {item.images && item.images.length > 0 ? (
                                  <img src={item.images[0]} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Boxes className="w-4 h-4 text-[#d4af37]/50" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span>{item.name}</span>
                                  {isLow && (
                                    <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-red-950 text-red-300 border border-red-700/60">
                                      Bajo Stock
                                    </span>
                                  )}
                                  {hasRecipe && (
                                    <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-[#2b2416] text-[#d4af37] border border-[#d4af37]/40">
                                      Producible
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-[#a8a29e] block font-mono">
                                  Ref: {item.reference || 'N/A'} {item.barcode ? `· QR: ${item.barcode}` : ''}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 text-[#a8a29e]">{item.category || 'General'}</td>
                          <td className="p-3.5">
                            <span className={`font-black text-sm ${isLow ? 'text-red-400' : 'text-[#fef3c7]'}`}>
                              {item.currentStock.toLocaleString('es-CO')} {item.unit}
                            </span>
                          </td>
                          <td className="p-3.5 text-[#78716c]">
                            {item.minStock.toLocaleString('es-CO')} {item.unit}
                          </td>
                          <td className="p-3.5 font-mono text-[#d4af37]">
                            {formatCOP(item.costPerUnit)}
                          </td>
                          <td className="p-3.5 font-bold text-[#fef3c7]">
                            {formatCOP(item.currentStock * item.costPerUnit)}
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {hasRecipe && (
                                <button
                                  type="button"
                                  onClick={() => setItemToProduce(item)}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#2b2416] text-[#d4af37] border border-[#d4af37]/50 hover:brightness-110 text-xs font-bold cursor-pointer flex items-center gap-1"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  <span>Producir</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedItemForAdjust(item);
                                  setAdjustType('compra_entrada');
                                  setAdjustQuantity(100);
                                  setAdjustReason('Entrada manual / ajuste de inventario');
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-[#1e1c26] text-[#a8a29e] hover:text-white border border-[#383124] hover:bg-[#282633] text-xs font-bold cursor-pointer"
                              >
                                Ajustar / Entrar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: PRODUCTOS COMERCIALES */}
      {activeTab === 'recetas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products.map((prod) => {
            const recipeCost = (prod.recipe || []).reduce((sum, ing) => {
              const matchedInv = inventory.find((i) => i.id === ing.inventoryItemId);
              const unitCost = matchedInv ? matchedInv.costPerUnit : 0;
              return sum + ing.quantity * unitCost;
            }, 0);

            const marginCOP = prod.price - recipeCost;
            const marginPct = prod.price > 0 ? Math.round((marginCOP / prod.price) * 100) : 0;

            return (
              <div
                key={prod.id}
                className="bg-[#14131a] p-4 rounded-2xl border border-[#2d281e] flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-sm text-[#fef3c7]">{prod.name}</h4>
                      <span className="text-[10px] text-[#a8a29e] uppercase font-semibold block">
                        Categoría: {prod.categoryName || 'General'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-[#d4af37] block font-mono">
                        {formatCOP(prod.price)}
                      </span>
                      <span className="text-[10px] text-[#78716c]">Precio Venta</span>
                    </div>
                  </div>

                  {/* Ingredientes de la receta */}
                  <div className="mt-3 p-3 rounded-xl bg-[#18171f] border border-[#24211a] space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-[#a8a29e] block mb-1">
                      Composición de Inventario Consumida al Vender:
                    </span>
                    {(prod.recipe || []).length === 0 ? (
                      <span className="text-xs text-[#78716c] italic">Sin composición configurada</span>
                    ) : (
                      (prod.recipe || []).map((ing, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-[#d6d3d1]">
                          <span>• {ing.name}</span>
                          <span className="font-bold text-[#fef3c7] font-mono">
                            {ing.quantity} {ing.unit}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Métricas de Costo y Margen */}
                <div className="pt-3 border-t border-[#2d281e] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#a8a29e] block text-[10px]">Costo Receta:</span>
                    <span className="font-bold text-red-400 font-mono">{formatCOP(recipeCost)}</span>
                  </div>
                  <div>
                    <span className="text-[#a8a29e] block text-[10px]">Utilidad Bruta:</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      {formatCOP(marginCOP)} ({marginPct}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PESTAÑA 3: PRODUCCIONES REGISTRADAS */}
      {activeTab === 'producciones' && (
        <div className="bg-[#14131a] rounded-2xl border border-[#2d281e] overflow-hidden shadow-xl space-y-0">
          <div className="p-4 border-b border-[#2d281e] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#d4af37]" />
              <div>
                <h3 className="font-bold text-sm text-[#fef3c7]">
                  Historial de Producciones de Inventario
                </h3>
                <p className="text-xs text-[#a8a29e]">
                  Lotes elaborados, materias primas consumidas y costos resultantes
                </p>
              </div>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#a8a29e] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por código, artículo u observación..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#18171f] border border-[#383124] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#d6d3d1]">
              <thead className="bg-[#18171f] text-[10px] uppercase font-bold text-[#a8a29e] border-b border-[#2d281e]">
                <tr>
                  <th className="p-3.5">Código / Fecha</th>
                  <th className="p-3.5">Artículo Producido</th>
                  <th className="p-3.5">Cantidad</th>
                  <th className="p-3.5">Costo Unitario</th>
                  <th className="p-3.5">Costo Total Lote</th>
                  <th className="p-3.5">Usuario / Sucursal</th>
                  <th className="p-3.5">Estado</th>
                  <th className="p-3.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24211a]">
                {productionLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-[#78716c]">
                      No hay registros de producción interna aún. Selecciona la opción "Producir" en un artículo producible para registrar un lote.
                    </td>
                  </tr>
                ) : (
                  productionLogs
                    .filter((log) => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase().trim();
                      return (
                        (log.code || '').toLowerCase().includes(q) ||
                        (log.itemName || '').toLowerCase().includes(q) ||
                        (log.notes || '').toLowerCase().includes(q) ||
                        (log.userName || '').toLowerCase().includes(q)
                      );
                    })
                    .map((log) => {
                      const isAnnulled = log.status === 'anulada';
                      return (
                        <tr key={log.id} className="hover:bg-[#1a1922] transition-colors">
                          <td className="p-3.5 font-mono text-[#fef3c7]">
                            <span className="font-bold text-[#d4af37] block">{log.code || 'PROD-LOG'}</span>
                            <span className="text-[10px] text-[#a8a29e]">
                              {formatColombiaDateTime(log.createdAt)}
                            </span>
                          </td>
                          <td className="p-3.5 font-bold text-[#fef3c7]">
                            {log.itemName}
                            {log.notes && (
                              <span className="text-[10px] text-[#a8a29e] block font-normal truncate max-w-xs">
                                {log.notes}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-emerald-400">
                            {log.unitsProduced} {log.unit}
                          </td>
                          <td className="p-3.5 font-mono text-[#d4af37]">
                            {formatCOP(log.unitCost)} / {log.unit}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-[#fef3c7]">
                            {formatCOP(log.totalCost)}
                          </td>
                          <td className="p-3.5 text-[#a8a29e]">
                            <span className="text-[#d4af37] font-semibold block">{log.userName}</span>
                            <span className="text-[10px]">{currentBranch?.name}</span>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                                isAnnulled
                                  ? 'bg-red-950 text-red-300 border border-red-800'
                                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              }`}
                            >
                              {isAnnulled ? 'Anulada' : 'Completada'}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedProductionLog(log)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#2b2416] text-[#d4af37] border border-[#d4af37]/50 hover:brightness-110 text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ver Detalle</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PESTAÑA 4: KARDEX / TRAZABILIDAD */}
      {activeTab === 'kardex' && (
        <div className="bg-[#14131a] rounded-2xl border border-[#2d281e] overflow-hidden shadow-xl">
          <div className="p-4 border-b border-[#2d281e] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#d4af37]" />
              <h3 className="font-bold text-sm text-[#fef3c7]">
                Trazabilidad Histórica de Movimientos de Inventario
              </h3>
            </div>
            <span className="text-xs text-[#a8a29e]">
              Inmutable y con auditoría de usuario
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#d6d3d1]">
              <thead className="bg-[#18171f] text-[10px] uppercase font-bold text-[#a8a29e] border-b border-[#2d281e]">
                <tr>
                  <th className="p-3.5">Fecha / Hora (Bogotá)</th>
                  <th className="p-3.5">Artículo</th>
                  <th className="p-3.5">Tipo</th>
                  <th className="p-3.5">Cant. Afectada</th>
                  <th className="p-3.5">Stock Ant. → Nuevo</th>
                  <th className="p-3.5">Motivo / Auditoría</th>
                  <th className="p-3.5">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24211a]">
                {inventoryMovements.map((mov) => {
                  const isPositive = mov.type === 'compra_entrada' || mov.type === 'produccion_interna' || mov.type === 'sobrante';
                  return (
                    <tr key={mov.id} className="hover:bg-[#1a1922] transition-colors">
                      <td className="p-3.5 text-[#a8a29e] whitespace-nowrap">
                        {formatColombiaDateTime(mov.createdAt)}
                      </td>
                      <td className="p-3.5 font-bold text-[#fef3c7]">{mov.itemName}</td>
                      <td className="p-3.5 capitalize font-semibold">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isPositive
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                              : 'bg-amber-950 text-amber-300 border border-amber-700/50'
                          }`}
                        >
                          {mov.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono font-bold">
                        {isPositive ? '+' : '-'} {mov.quantity}
                      </td>
                      <td className="p-3.5 text-[#a8a29e]">
                        {mov.previousStock} → <span className="font-bold text-[#fef3c7]">{mov.newStock}</span>
                      </td>
                      <td className="p-3.5 max-w-xs truncate">{mov.reason}</td>
                      <td className="p-3.5 text-[#d4af37] font-semibold">{mov.userName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE PRODUCCIÓN */}
      {selectedProductionLog && (
        <ProductionDetailModal
          log={selectedProductionLog}
          onClose={() => setSelectedProductionLog(null)}
        />
      )}

      {/* MODAL CREAR ARTÍCULO DE INVENTARIO */}
      {isCreateModalOpen && (
        <InventoryItemModal
          onClose={() => setIsCreateModalOpen(false)}
          defaultAlsoCreateProduct={false}
        />
      )}

      {/* MODAL EJECUTAR PRODUCCIÓN */}
      {itemToProduce && (
        <ProduceItemModal
          item={itemToProduce}
          onClose={() => setItemToProduce(null)}
        />
      )}

      {/* MODAL DE AJUSTE / ENTRADA MANUAL */}
      {selectedItemForAdjust && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121117] border border-[#3f3521] rounded-2xl w-full max-w-md p-5 text-[#faf5ee] shadow-2xl">
            <h3 className="font-bold text-base text-[#fef3c7] mb-1">
              Movimiento de Inventario: {selectedItemForAdjust.name}
            </h3>
            <p className="text-xs text-[#a8a29e] mb-4">
              Stock actual: {selectedItemForAdjust.currentStock} {selectedItemForAdjust.unit}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#a8a29e] mb-1">Tipo</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as InventoryMovementType)}
                  className="w-full bg-[#18171f] border border-[#383124] rounded-lg p-2 text-xs text-[#fef3c7]"
                >
                  <option value="compra_entrada">Entrada de Compra (+ stock)</option>
                  <option value="merma">Merma / Desperdicio (- stock)</option>
                  <option value="ajuste_manual">Ajuste de Conteo Físico</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a8a29e] mb-1">
                  Cantidad ({selectedItemForAdjust.unit})
                </label>
                <input
                  type="number"
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-[#18171f] border border-[#383124] rounded-lg p-2 text-sm font-bold text-[#fef3c7]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a8a29e] mb-1">
                  Motivo / Observación
                </label>
                <input
                  type="text"
                  placeholder="Ej: Reposición de stock o ajuste por inventario físico..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full bg-[#18171f] border border-[#383124] rounded-lg p-2 text-xs text-[#fef3c7] focus:border-[#d4af37]"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedItemForAdjust(null)}
                className="px-4 py-2 rounded-xl border border-[#383124] text-xs font-semibold text-[#a8a29e]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteAdjust}
                disabled={!adjustReason.trim() || adjustQuantity <= 0}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs hover:brightness-110 disabled:opacity-50"
              >
                Registrar en Kardex
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
