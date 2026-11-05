import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { InventoryItem } from '../../types';
import { formatCOP } from '../../utils/calculations';
import {
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Boxes,
  FileText,
  Check,
} from 'lucide-react';

interface ProduceItemModalProps {
  item: InventoryItem;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ProduceItemModal: React.FC<ProduceItemModalProps> = ({
  item,
  onClose,
  onSuccess,
}) => {
  const { inventory, produceInventoryItem, actionLoading } = useRestaurant();
  const [unitsToProduce, setUnitsToProduce] = useState<number>(10);
  const [notes, setNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const recipe = item.productionRecipe || [];

  // Verificar disponibilidad de cada ingrediente
  const ingredientChecks = recipe.map((ing) => {
    const rawInv = inventory.find((i) => i.id === ing.inventoryItemId);
    const requiredQty = ing.quantity * unitsToProduce;
    const currentStock = rawInv ? rawInv.currentStock : 0;
    const remainingStock = currentStock - requiredQty;
    const isSufficient = currentStock >= requiredQty;
    const missingQty = Math.max(0, requiredQty - currentStock);
    const unitCost = rawInv ? rawInv.costPerUnit : 0;
    const totalCost = requiredQty * unitCost;

    return {
      ...ing,
      rawInv,
      requiredQty,
      currentStock,
      remainingStock,
      isSufficient,
      missingQty,
      unitCost,
      totalCost,
    };
  });

  const hasInsufficientStock = ingredientChecks.some((i) => !i.isSufficient);
  const totalProductionCost = ingredientChecks.reduce((sum, i) => sum + i.totalCost, 0);
  const estimatedUnitCost = unitsToProduce > 0 ? totalProductionCost / unitsToProduce : 0;

  const handleProduce = async () => {
    if (unitsToProduce <= 0 || isSubmitting) return;
    if (hasInsufficientStock) {
      setErrorMessage('No hay suficientes materias primas en bodega para realizar esta producción.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');
      await produceInventoryItem(item.id, unitsToProduce, notes);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error producing item:', err);
      setErrorMessage(err.message || 'Ocurrió un error al ejecutar la producción.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto text-[#faf5ee]">
      <div className="relative w-full max-w-xl bg-[#121117] border border-[#3f3521] rounded-3xl shadow-2xl p-5 sm:p-6 space-y-5 my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2d281e] pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#2a2213] border border-[#d4af37]/50 flex items-center justify-center text-[#d4af37]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-[#fef3c7]">
                Orden de Producción de Artículo
              </h3>
              <p className="text-xs text-[#a8a29e]">
                Producir: <span className="text-[#d4af37] font-bold">{item.name}</span>
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

        {/* Info del artículo y foto */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#1a1922] border border-[#383124]">
          <div className="w-12 h-12 rounded-xl bg-[#121117] border border-[#2d281e] overflow-hidden shrink-0 flex items-center justify-center">
            {item.images && item.images.length > 0 ? (
              <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <Boxes className="w-6 h-6 text-[#d4af37]/50" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm text-[#fef3c7] truncate">{item.name}</h4>
            <div className="text-[11px] text-[#a8a29e] flex items-center gap-2">
              <span>Categoría: <strong className="text-zinc-300">{item.category || 'General'}</strong></span>
              <span>·</span>
              <span>Stock actual: <strong className="text-[#d4af37]">{item.currentStock} {item.unit}</strong></span>
            </div>
          </div>
        </div>

        {/* Input Cantidad a Producir */}
        <div className="p-4 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-2">
          <label className="block text-xs font-bold text-[#fef3c7]">
            ¿Cuántas unidades o porciones deseas producir ({item.unit})?
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              value={unitsToProduce}
              onChange={(e) => setUnitsToProduce(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-full px-4 py-2.5 bg-[#121117] border border-[#d4af37]/60 rounded-xl text-sm font-black text-[#d4af37] font-mono focus:outline-none focus:border-[#d4af37]"
            />
            <span className="text-xs font-bold text-[#a8a29e] shrink-0">{item.unit}</span>
          </div>
          <div className="text-[11px] text-[#a8a29e] flex justify-between pt-1">
            <span>Stock anterior: {item.currentStock} {item.unit}</span>
            <span>Nuevo stock estimado: <strong className="text-emerald-400">{item.currentStock + unitsToProduce} {item.unit}</strong></span>
          </div>
        </div>

        {/* Tabla Comparativa de Componentes Necesarios */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#d4af37] uppercase tracking-wider block">
              Materias Primas / Componentes Requeridos:
            </span>
            <span className="text-[10px] text-[#a8a29e]">
              Fórmula: Consumo x {unitsToProduce}
            </span>
          </div>

          <div className="border border-[#2d281e] rounded-xl overflow-hidden bg-[#14131a] max-h-56 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#18171f] text-[10px] uppercase font-bold text-[#a8a29e] border-b border-[#2d281e]">
                <tr>
                  <th className="p-2.5">Componente</th>
                  <th className="p-2.5 text-center">Disponible</th>
                  <th className="p-2.5 text-center">Requerido</th>
                  <th className="p-2.5 text-center">Restante</th>
                  <th className="p-2.5 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24211a]">
                {ingredientChecks.map((ing) => (
                  <tr
                    key={ing.inventoryItemId}
                    className={ing.isSufficient ? 'hover:bg-[#1a1922]' : 'bg-red-950/30'}
                  >
                    <td className="p-2.5 font-bold text-[#fef3c7]">
                      {ing.name}
                      <span className="text-[10px] text-[#a8a29e] block font-mono font-normal">
                        ({formatCOP(ing.unitCost)} / {ing.unit})
                      </span>
                    </td>
                    <td className="p-2.5 text-center font-mono text-[#a8a29e]">
                      {ing.currentStock} {ing.unit}
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-[#d4af37]">
                      {ing.requiredQty} {ing.unit}
                    </td>
                    <td className={`p-2.5 text-center font-mono font-bold ${ing.remainingStock < 0 ? 'text-red-400' : 'text-zinc-300'}`}>
                      {ing.remainingStock} {ing.unit}
                    </td>
                    <td className="p-2.5 text-right">
                      {ing.isSufficient ? (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                          Suficiente
                        </span>
                      ) : (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800">
                          Faltan {ing.missingQty} {ing.unit}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Desglose de Costos de Producción */}
        <div className="p-3.5 rounded-2xl bg-[#1a1922] border border-[#383124] space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-[#a8a29e]">Costo Total Materias Primas Consumidas:</span>
            <span className="font-mono font-bold text-[#fef3c7] text-sm">{formatCOP(totalProductionCost)}</span>
          </div>
          <div className="flex justify-between items-center border-t border-[#2d281e] pt-1.5">
            <span className="text-[#a8a29e]">Costo Unitario Resultante:</span>
            <span className="font-mono font-black text-[#d4af37] text-sm">
              {formatCOP(estimatedUnitCost)} / {item.unit}
            </span>
          </div>
        </div>

        {/* Campo Observaciones */}
        <div>
          <label className="text-xs font-bold text-[#fef3c7] block mb-1">
            Observaciones o Nota de Producción (Opcional):
          </label>
          <input
            type="text"
            placeholder="Ej: Lote de salsa preparado para el fin de semana, turno mañana..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 bg-[#1a1922] border border-[#2d281e] rounded-xl text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
          />
        </div>

        {/* Mensajes de error / alertas */}
        {hasInsufficientStock && (
          <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <span>
              Stock insuficiente en materias primas. Registra compras de insumos para poder procesar la orden de producción.
            </span>
          </div>
        )}

        {errorMessage && (
          <p className="text-xs font-bold text-red-400">{errorMessage}</p>
        )}

        {/* Botones de Acción */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#383124] text-xs font-bold text-[#a8a29e] hover:bg-[#1a1922] cursor-pointer text-center"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleProduce}
            disabled={hasInsufficientStock || unitsToProduce <= 0 || actionLoading || isSubmitting}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all ${
              hasInsufficientStock || unitsToProduce <= 0 || actionLoading || isSubmitting
                ? 'bg-[#2a2213] text-[#78716c] cursor-not-allowed border border-[#383124]'
                : 'bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] hover:brightness-110 active:scale-95 shadow-[#d4af37]/25'
            }`}
          >
            <CheckCircle className="w-4 h-4 stroke-[2.5]" />
            <span>{actionLoading || isSubmitting ? 'Procesando Producción...' : 'Confirmar Producción'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
