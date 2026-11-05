import React, { useState } from 'react';
import { ProductionLog } from '../../types';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { useRestaurant } from '../../context/RestaurantContext';
import { X, Sparkles, AlertTriangle, RotateCcw } from 'lucide-react';

interface ProductionDetailModalProps {
  log: ProductionLog;
  onClose: () => void;
}

export const ProductionDetailModal: React.FC<ProductionDetailModalProps> = ({ log, onClose }) => {
  const { cancelProductionLog, actionLoading } = useRestaurant();
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const isAnnulled = log.status === 'anulada';

  const handleCancelProduction = async () => {
    try {
      setErrorMessage('');
      await cancelProductionLog(log.id, cancelReason);
      setShowCancelConfirm(false);
      onClose();
    } catch (err: any) {
      console.error('Error canceling production:', err);
      setErrorMessage(err.message || 'Error al anular la producción.');
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
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-[#fef3c7]">
                  Detalle de Producción {log.code || ''}
                </h3>
                <span
                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                    isAnnulled
                      ? 'bg-red-950 text-red-300 border border-red-800'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}
                >
                  {isAnnulled ? 'Anulada' : 'Completada'}
                </span>
              </div>
              <p className="text-xs text-[#a8a29e]">
                Registrado el {formatColombiaDateTime(log.createdAt)} por <span className="text-[#d4af37] font-semibold">{log.userName}</span>
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

        {/* Info resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-[#1a1922] border border-[#383124] text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">Artículo Producido</span>
            <span className="font-bold text-[#fef3c7] text-sm">{log.itemName}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">Cantidad Producida</span>
            <span className="font-bold text-emerald-400 text-sm font-mono">{log.unitsProduced} {log.unit}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">Costo Total Lote</span>
            <span className="font-bold text-[#d4af37] text-sm font-mono">{formatCOP(log.totalCost)}</span>
          </div>
        </div>

        {/* Consumo de materias primas snapshot */}
        <div className="space-y-2">
          <span className="text-xs font-black text-[#d4af37] uppercase tracking-wider block">
            Materias Primas Consumidas en esta Producción:
          </span>

          <div className="border border-[#2d281e] rounded-xl overflow-hidden bg-[#14131a] max-h-56 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#18171f] text-[10px] uppercase font-bold text-[#a8a29e] border-b border-[#2d281e]">
                <tr>
                  <th className="p-2.5">Materia Prima</th>
                  <th className="p-2.5 text-center">Cant. Descontada</th>
                  <th className="p-2.5 text-right">Costo Unit.</th>
                  <th className="p-2.5 text-right">Costo Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24211a]">
                {(log.consumedIngredients || []).map((ing, idx) => (
                  <tr key={idx} className="hover:bg-[#1a1922]">
                    <td className="p-2.5 font-bold text-[#fef3c7]">{ing.name}</td>
                    <td className="p-2.5 text-center font-mono font-bold text-[#d4af37]">
                      {ing.quantityDeducted} {ing.unit}
                    </td>
                    <td className="p-2.5 text-right font-mono text-zinc-400">
                      {formatCOP(ing.unitCost)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-[#fef3c7]">
                      {formatCOP(ing.quantityDeducted * ing.unitCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {log.notes && (
          <div className="p-3 rounded-xl bg-[#1a1922] border border-[#2d281e] text-xs">
            <span className="text-[10px] uppercase font-bold text-[#a8a29e] block mb-0.5">Observaciones:</span>
            <p className="text-zinc-300 italic">{log.notes}</p>
          </div>
        )}

        {isAnnulled && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>Producción Anulada el {log.cancelledAt ? formatColombiaDateTime(log.cancelledAt) : ''} por {log.cancelledBy}</span>
            </div>
            {log.cancellationReason && (
              <p className="text-[11px] text-red-200">Motivo: {log.cancellationReason}</p>
            )}
          </div>
        )}

        {errorMessage && (
          <p className="text-xs font-bold text-red-400">{errorMessage}</p>
        )}

        {/* Modal confirmación de anulación */}
        {showCancelConfirm ? (
          <div className="p-4 rounded-2xl bg-red-950/80 border border-red-800 text-red-100 space-y-3">
            <h4 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>¿Confirmar Anulación de Producción {log.code}?</span>
            </h4>
            <p className="text-xs text-red-200">
              Esta acción revertirá los stock: descontará {log.unitsProduced} {log.unit} del artículo producido y devolverá los ingredientes al inventario.
            </p>
            <div>
              <label className="text-[10px] font-bold text-red-300 block mb-1">Motivo de la anulación:</label>
              <input
                type="text"
                placeholder="Ej: Error en digitación de cantidad, lote dañado..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#121117] border border-red-700 text-xs text-white focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-[#24222e] text-[#a8a29e] text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCancelProduction}
                disabled={actionLoading}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-black text-xs cursor-pointer shadow"
              >
                {actionLoading ? 'Anulando...' : 'Sí, Anular Producción'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-2">
            {!isAnnulled ? (
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                className="px-3.5 py-2 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Anular Esta Producción</span>
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#24222e] hover:bg-[#322f3f] text-white text-xs font-bold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
