import React, { useState } from 'react';
import { CashClosure } from '../../types';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { parseOptionalCurrencyInput } from '../../utils/cashReconciliationUtils';
import { X, Save, Edit2, AlertCircle, Loader2, Banknote } from 'lucide-react';

interface CashClosureEditModalProps {
  closure: CashClosure;
  isSaving: boolean;
  onSave: (rawValuesByMethodId: Record<string, string>, notes: string) => Promise<void>;
  onClose: () => void;
}

export const CashClosureEditModal: React.FC<CashClosureEditModalProps> = ({
  closure,
  isSaving,
  onSave,
  onClose,
}) => {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const mb of closure.methodBalances) {
      initial[mb.methodId] =
        mb.registeredAmount !== null && mb.registeredAmount !== undefined
          ? String(mb.registeredAmount)
          : '';
    }
    return initial;
  });
  const [notes, setNotes] = useState<string>(closure.notes || '');
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await onSave(values, notes);
    } catch (err: any) {
      setError(err?.message || 'Error al actualizar los valores del cierre.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121117] border border-[#3f3521] rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl text-[#faf5ee] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2d281e] bg-[#1a1722] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2b2416] border border-[#d4af37]/50 flex items-center justify-center text-[#d4af37]">
              <Edit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#fef3c7]">
                Editar Valores del Cierre · {closure.consecutivo}
              </h3>
              <p className="text-[11px] text-[#a8a29e]">
                Cerrado el {formatColombiaDateTime(closure.closedAt)} · Corrige valores registrados por error
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#18171f] border border-[#2d281e] text-[#a8a29e] hover:text-[#fef3c7] cursor-pointer"
            aria-label="Cerrar edición de cierre"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/70 border border-red-600/60 text-red-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {closure.methodBalances.map((mb) => {
              const rawVal = values[mb.methodId] ?? '';
              const parsed = parseOptionalCurrencyInput(rawVal);
              const previewDiff =
                parsed.isValid && parsed.value !== null ? parsed.value - mb.expectedAmount : null;

              return (
                <div
                  key={mb.methodId}
                  className={`p-3.5 rounded-2xl border space-y-2 ${
                    mb.isCash
                      ? 'bg-[#2b2416] border-[#d4af37]/60'
                      : 'bg-[#18171f] border-[#2d281e]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor={`edit-closure-${mb.methodId}`}
                      className="text-xs font-black text-[#fef3c7] flex items-center gap-1.5"
                    >
                      {mb.isCash && <Banknote className="w-3.5 h-3.5 text-emerald-400" />}
                      <span>{mb.methodName}</span>
                    </label>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                        mb.isCash
                          ? 'bg-emerald-950/70 text-emerald-300 border-emerald-600/60'
                          : 'bg-[#14131a] text-[#a8a29e] border-[#383124]'
                      }`}
                    >
                      {mb.isCash ? 'Obligatorio' : 'Opcional'}
                    </span>
                  </div>

                  <input
                    id={`edit-closure-${mb.methodId}`}
                    type="number"
                    min={0}
                    step="1"
                    value={rawVal}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [mb.methodId]: e.target.value }))
                    }
                    placeholder={mb.isCash ? 'Ingresa valor en efectivo' : 'Dejar vacío = Sin registrar'}
                    className="w-full px-3 py-2 rounded-xl bg-[#121117] border border-[#383124] focus:border-[#d4af37] text-sm font-black font-mono text-[#fef3c7] placeholder-[#78716c] focus:outline-none"
                  />

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#a8a29e]">
                      Esperado: <strong className="font-mono text-[#fef3c7]">{formatCOP(mb.expectedAmount)}</strong>
                    </span>
                    {previewDiff === null ? (
                      <span className="text-[#a8a29e] italic">Sin registrar</span>
                    ) : previewDiff === 0 ? (
                      <span className="text-emerald-400 font-bold">Cuadrado</span>
                    ) : previewDiff > 0 ? (
                      <span className="text-sky-300 font-bold">+{formatCOP(previewDiff)}</span>
                    ) : (
                      <span className="text-red-400 font-bold">{formatCOP(previewDiff)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <label
              htmlFor="edit-closure-notes"
              className="block text-xs font-bold text-[#a8a29e] mb-1"
            >
              Observaciones del cierre (opcional)
            </label>
            <textarea
              id="edit-closure-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Corrección de conteo de billetes o soporte de transferencia..."
              className="w-full px-3 py-2 rounded-xl bg-[#18171f] border border-[#383124] focus:border-[#d4af37] text-xs text-[#fef3c7] placeholder-[#78716c] focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-[#2d281e] flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#18171f] border border-[#383124] text-xs font-bold text-[#a8a29e] hover:text-[#fef3c7] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] text-xs font-black inline-flex items-center gap-2 hover:brightness-110 shadow-lg cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'Guardando...' : 'Guardar cambios'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
