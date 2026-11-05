import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import { formatCOP } from '../../utils/calculations';
import { Expense, PaymentMethod } from '../../types';
import {
  DollarSign,
  Plus,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  Printer,
  FileText,
  Building,
} from 'lucide-react';

interface ExpenseRegistrationViewProps {
  onBack: () => void;
}

interface ExpenseTabForm {
  id: string;
  category: string;
  concept: string;
  thirdParty: string;
  paymentMethod: string;
  amount: number;
  observations: string;
}

export const ExpenseRegistrationView: React.FC<ExpenseRegistrationViewProps> = ({ onBack }) => {
  const { createExpense, currentBranch, actionLoading, paymentMethods } = useRestaurant();
  const { showToast } = useToast();

  const [tabs, setTabs] = useState<ExpenseTabForm[]>([
    {
      id: 'tab-1',
      category: 'Servicios públicos',
      concept: '',
      thirdParty: '',
      paymentMethod: 'efectivo',
      amount: 0,
      observations: '',
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');
  const [savedExpense, setSavedExpense] = useState<Expense | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const handleFieldChange = (field: keyof ExpenseTabForm, value: any) => {
    setTabs(tabs.map((t) => (t.id === activeTabId ? { ...t, [field]: value } : t)));
  };

  const handleAddTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTab: ExpenseTabForm = {
      id: newId,
      category: 'Otros',
      concept: '',
      thirdParty: '',
      paymentMethod: 'efectivo',
      amount: 0,
      observations: '',
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
  };

  const handleRemoveTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      showToast('Debe mantener al menos una pestaña de registro', 'warning');
      return;
    }
    const nextTabs = tabs.filter((t) => t.id !== id);
    setTabs(nextTabs);
    if (activeTabId === id) {
      setActiveTabId(nextTabs[0].id);
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTab.concept.trim()) {
      showToast('El concepto del gasto es obligatorio', 'warning');
      return;
    }
    if (activeTab.amount <= 0) {
      showToast('El valor del gasto debe ser mayor a cero', 'warning');
      return;
    }

    try {
      const expense = await createExpense({
        category: activeTab.category.trim() || 'General',
        concept: activeTab.concept.trim(),
        thirdParty: activeTab.thirdParty.trim() || 'General',
        paymentMethod: activeTab.paymentMethod,
        amount: activeTab.amount,
        observations: activeTab.observations.trim(),
      });

      if (expense) {
        setSavedExpense(expense);
        showToast(`Gasto "${expense.concept}" guardado y registrado en Caja`, 'success');

        // Cerrar o quitar la pestaña guardada
        const remainingTabs = tabs.filter((t) => t.id !== activeTabId);
        if (remainingTabs.length > 0) {
          setTabs(remainingTabs);
          setActiveTabId(remainingTabs[0].id);
        } else {
          // Si era la única, resetear con una limpia
          setTabs([
            {
              id: `tab-${Date.now()}`,
              category: 'Servicios públicos',
              concept: '',
              thirdParty: '',
              paymentMethod: 'efectivo',
              amount: 0,
              observations: '',
            },
          ]);
          setActiveTabId(`tab-${Date.now()}`);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Error al guardar el gasto', 'error');
    }
  };

  const categorySuggestions = [
    'Servicios públicos',
    'Arriendo',
    'Transporte',
    'Mantenimiento',
    'Aseo',
    'Publicidad',
    'Nómina y Honorarios',
    'Insumos Operativos',
    'Otros',
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* 1. Cabecera */}
      <div className="bg-[#181818] p-6 rounded-3xl border border-[#333333] shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] border border-[#383838] text-[#D6A21A] flex items-center justify-center cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-black text-[#FFFDF5] tracking-wide">
              Registrar Gasto
            </h2>
            <p className="text-xs text-[#d6d3d1]">
              Sucursal: <strong className="text-[#D6A21A]">{currentBranch?.name}</strong> · Genera salida automática en Caja
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] border border-[#383838] text-[#FFFDF5] font-bold text-xs flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#D6A21A]" />
          <span>Volver a Desembolsos</span>
        </button>
      </div>

      {/* 2. Barra de Pestañas de Registro Múltiple */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#333333]">
        {tabs.map((tab, idx) => (
          <div
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 cursor-pointer transition-all ${
              activeTabId === tab.id
                ? 'bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] shadow-lg'
                : 'bg-[#181818] text-[#a8a29e] border border-[#333333] hover:text-[#FFFDF5]'
            }`}
          >
            <span>Gasto {idx + 1} {tab.concept ? `: ${tab.concept.substring(0, 15)}...` : ''}</span>
            {tabs.length > 1 && (
              <button
                type="button"
                onClick={(e) => handleRemoveTab(tab.id, e)}
                className="hover:text-red-300"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={handleAddTab}
          className="px-3.5 py-2.5 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] border border-[#383838] text-[#D6A21A] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Pestaña</span>
        </button>
      </div>

      {/* 3. Formulario de Gasto Activo */}
      <form onSubmit={handleSaveExpense} className="bg-[#181818] p-6 sm:p-8 rounded-3xl border border-[#333333] shadow-2xl space-y-5">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Categoría */}
          <div>
            <label className="block text-xs font-bold text-[#a8a29e] mb-1">Categoría del Gasto</label>
            <input
              type="text"
              list="categories-list"
              required
              value={activeTab.category}
              onChange={(e) => handleFieldChange('category', e.target.value)}
              placeholder="Ej: Servicios públicos"
              className="w-full bg-[#242424] border border-[#383838] rounded-xl px-4 py-3 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
            />
            <datalist id="categories-list">
              {categorySuggestions.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          {/* Concepto */}
          <div>
            <label className="block text-xs font-bold text-[#FFFDF5] mb-1">Concepto / Motivo (*)</label>
            <input
              type="text"
              required
              value={activeTab.concept}
              onChange={(e) => handleFieldChange('concept', e.target.value)}
              placeholder="Ej: Pago de energía eléctrica recibo #12345"
              className="w-full bg-[#242424] border border-[#383838] rounded-xl px-4 py-3 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Proveedor / Tercero */}
          <div>
            <label className="block text-xs font-bold text-[#a8a29e] mb-1">Proveedor / Tercero</label>
            <input
              type="text"
              value={activeTab.thirdParty}
              onChange={(e) => handleFieldChange('thirdParty', e.target.value)}
              placeholder="Ej: Central de Energías"
              className="w-full bg-[#242424] border border-[#383838] rounded-xl px-4 py-3 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
            />
          </div>

          {/* Medio de pago */}
          <div>
            <label className="block text-xs font-bold text-[#a8a29e] mb-1">Medio de Pago</label>
            <select
              aria-label="Seleccionar medio de pago"
              value={activeTab.paymentMethod}
              onChange={(e) => handleFieldChange('paymentMethod', e.target.value)}
              className="w-full bg-[#242424] border border-[#383838] rounded-xl px-4 py-3 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
            >
              {paymentMethods.filter((p) => p.isActive).length > 0 ? (
                paymentMethods
                  .filter((p) => p.isActive)
                  .map((pm) => (
                    <option key={pm.id} value={pm.name}>
                      {pm.name} {pm.bankName ? `(${pm.bankName})` : ''}
                    </option>
                  ))
              ) : (
                <>
                  <option value="efectivo">Efectivo (Caja)</option>
                  <option value="transferencia">Transferencia (Nequi / Daviplata / Banco)</option>
                  <option value="tarjeta">Tarjeta / Datáfono</option>
                  <option value="otro">Otro medio</option>
                </>
              )}
            </select>
          </div>

          {/* Valor */}
          <div>
            <label className="block text-xs font-bold text-[#FFFDF5] mb-1">Valor en Pesos (COP) (*)</label>
            <input
              type="number"
              min="1"
              required
              value={activeTab.amount || ''}
              onChange={(e) => handleFieldChange('amount', parseInt(e.target.value) || 0)}
              placeholder="0"
              className="w-full bg-[#242424] border border-[#383838] rounded-xl px-4 py-3 text-sm font-black text-[#D6A21A] focus:outline-none focus:border-[#D6A21A]"
            />
          </div>
        </div>

        {/* Observaciones */}
        <div>
          <label className="block text-xs font-bold text-[#a8a29e] mb-1">Observaciones / Notas Adicionales</label>
          <textarea
            rows={2}
            value={activeTab.observations}
            onChange={(e) => handleFieldChange('observations', e.target.value)}
            placeholder="Detalles adicionales del gasto..."
            className="w-full bg-[#242424] border border-[#383838] rounded-xl p-3 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
          />
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <button
            type="submit"
            disabled={actionLoading}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-red-700 via-red-600 to-red-700 hover:brightness-110 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xl shadow-red-900/30 cursor-pointer transition-all"
          >
            <DollarSign className="w-4 h-4" />
            <span>{actionLoading ? 'Guardando Gasto...' : 'Guardar Gasto (Salida de Dinero)'}</span>
          </button>
        </div>

      </form>

      {/* MODAL / TICKET: Comprobante de Egreso Generado */}
      {savedExpense && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#B77900] rounded-3xl w-full max-w-md p-6 text-[#FFFDF5] shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-600 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-base text-[#FFFDF5]">
                  ¡Gasto Guardado con Éxito!
                </h3>
                <p className="text-xs text-[#a8a29e]">
                  Se ha generado el comprobante de egreso y actualizado la caja.
                </p>
              </div>
            </div>

            <div className="bg-[#242424] p-4 rounded-2xl border border-[#383838] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#a8a29e]">Consecutivo:</span>
                <span className="font-mono font-bold text-[#D6A21A]">#{savedExpense.consecutivo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#a8a29e]">Categoría:</span>
                <span className="font-bold text-[#FFFDF5]">{savedExpense.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#a8a29e]">Concepto:</span>
                <span className="font-bold text-[#FFFDF5]">{savedExpense.concept}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#a8a29e]">Tercero:</span>
                <span className="font-bold text-[#FFFDF5]">{savedExpense.thirdParty}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#a8a29e]">Medio de Pago:</span>
                <span className="uppercase font-bold text-[#D6A21A]">{savedExpense.paymentMethod}</span>
              </div>
              <div className="pt-2 border-t border-[#383838] flex justify-between font-black text-sm text-red-400">
                <span>Valor Desembolsado:</span>
                <span>{formatCOP(savedExpense.amount)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2.5 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] border border-[#383838] text-xs font-bold text-[#FFFDF5] flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-[#D6A21A]" />
                <span>Imprimir Comprobante</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSavedExpense(null);
                  onBack();
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs hover:brightness-110 cursor-pointer"
              >
                Aceptar y Continuar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
