import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import { formatCOP } from '../../utils/calculations';
import {
  ArrowLeft,
  Plus,
  X,
  Save,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Calendar,
  Building,
  User,
  CreditCard,
  FileText,
} from 'lucide-react';

interface OtherIncomeRegistrationViewProps {
  onBack: () => void;
}

interface IncomeTabForm {
  id: string;
  tabLabel: string;
  date: string;
  concept: string;
  thirdParty: string;
  paymentMethod: string;
  amount: number;
  observations: string;
}

export const OtherIncomeRegistrationView: React.FC<OtherIncomeRegistrationViewProps> = ({ onBack }) => {
  const {
    createOtherIncome,
    currentBranch,
    actionLoading,
    paymentMethods,
  } = useRestaurant();
  const { showToast } = useToast();

  const getNowColombiaDatetimeLocal = () => {
    const now = new Date();
    // Offset for local Colombia display
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - offset).toISOString().slice(0, 16);
    return localISOTime;
  };

  const createBlankTab = (index: number): IncomeTabForm => ({
    id: `tab-${Date.now()}-${index}`,
    tabLabel: `Ingreso ${index}`,
    date: getNowColombiaDatetimeLocal(),
    concept: '',
    thirdParty: '',
    paymentMethod: 'efectivo',
    amount: 0,
    observations: '',
  });

  const [tabs, setTabs] = useState<IncomeTabForm[]>([createBlankTab(1)]);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const handleFieldChange = (field: keyof IncomeTabForm, value: any) => {
    setTabs(tabs.map((t) => (t.id === activeTabId ? { ...t, [field]: value } : t)));
  };

  const handleAddTab = () => {
    const nextIndex = tabs.length + 1;
    const newTab = createBlankTab(nextIndex);
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      showToast('Debe mantener al menos una pestaña de registro activa', 'warning');
      return;
    }

    const targetTab = tabs.find((t) => t.id === tabId);
    if (targetTab && (targetTab.concept.trim() || targetTab.amount > 0)) {
      if (!window.confirm(`¿Desea descartar los datos de "${targetTab.tabLabel}"?`)) {
        return;
      }
    }

    const nextTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId) {
      setActiveTabId(nextTabs[0].id);
    }
  };

  const handleBackWithCheck = () => {
    const hasUnsavedData = tabs.some((t) => t.concept.trim() || t.amount > 0);
    if (hasUnsavedData) {
      if (!window.confirm('Hay datos de ingresos sin guardar en las pestañas. ¿Desea salir y descartarlos?')) {
        return;
      }
    }
    onBack();
  };

  const handleSaveCurrentTab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTab.concept.trim()) {
      showToast('El concepto del ingreso es obligatorio', 'error');
      return;
    }
    if (activeTab.amount <= 0 || isNaN(activeTab.amount)) {
      showToast('El valor del ingreso debe ser un importe positivo mayor a cero', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const savedIncome = await createOtherIncome({
        date: new Date(activeTab.date).toISOString(),
        concept: activeTab.concept.trim(),
        thirdParty: activeTab.thirdParty.trim() || undefined,
        paymentMethod: activeTab.paymentMethod,
        amount: activeTab.amount,
        observations: activeTab.observations.trim() || undefined,
      });

      showToast(`Ingreso #${savedIncome.consecutivo} por ${formatCOP(savedIncome.amount)} registrado con éxito`, 'success');

      // Eliminar la pestaña guardada
      const remainingTabs = tabs.filter((t) => t.id !== activeTab.id);
      if (remainingTabs.length > 0) {
        setTabs(remainingTabs);
        setActiveTabId(remainingTabs[0].id);
        showToast(`Pestaña completada. Quedan ${remainingTabs.length} registro(s) pendiente(s).`, 'info');
      } else {
        // Regresar a Ingresos si no quedan pestañas
        onBack();
      }
    } catch (err: any) {
      showToast(err.message || 'Error al guardar el ingreso', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activePaymentMethods = paymentMethods.filter((p) => p.isActive);

  return (
    <div className="space-y-6">
      
      {/* 1. Cabecera y Navegación */}
      <div className="bg-[#181818] p-6 rounded-3xl border border-[#333333] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={handleBackWithCheck}
            className="text-xs text-[#D6A21A] hover:underline inline-flex items-center gap-1.5 font-bold mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Ingresos</span>
          </button>
          <h2 className="text-xl font-black text-[#FFFDF5] tracking-wide flex items-center gap-2">
            <Wallet className="w-6 h-6 text-[#D6A21A]" />
            <span>Otros ingresos</span>
          </h2>
          <p className="text-xs text-[#d6d3d1] mt-0.5">
            Registrar entradas de dinero extraordinarias en la sucursal <strong className="text-[#D6A21A]">{currentBranch?.name}</strong>.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddTab}
          className="px-4 py-2.5 rounded-xl bg-[#242424] text-[#D6A21A] border border-[#383838] hover:bg-[#2e2e2e] font-bold text-xs flex items-center gap-2 shadow cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar otra pestaña</span>
        </button>
      </div>

      {/* 2. Barra de Pestañas Multi-Ingreso */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#2d2d2d]">
        {tabs.map((tab, idx) => {
          const isSelected = tab.id === activeTabId;
          const hasData = Boolean(tab.concept || tab.amount > 0);
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`px-4 py-3 rounded-t-2xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all border-t-2 ${
                isSelected
                  ? 'bg-[#181818] text-[#D6A21A] border-[#D6A21A]'
                  : 'bg-[#121214] text-[#a8a29e] border-transparent hover:text-[#FFFDF5]'
              }`}
            >
              <span>{tab.tabLabel}</span>
              {hasData && (
                <span className="w-2 h-2 rounded-full bg-emerald-400" title="Contiene datos" />
              )}
              {tabs.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  className="p-1 hover:bg-[#2b2b2b] rounded-full text-[#78716c] hover:text-red-400 cursor-pointer ml-1"
                  title="Cerrar pestaña"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={handleAddTab}
          className="p-2.5 rounded-xl bg-[#181818] hover:bg-[#242424] text-[#D6A21A] text-xs font-bold border border-dashed border-[#383838] cursor-pointer flex items-center gap-1"
          title="Crear nueva pestaña de ingreso"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nueva</span>
        </button>
      </div>

      {/* 3. Formulario de Otros Ingresos (Estructura de 4 filas solicitada) */}
      <form onSubmit={handleSaveCurrentTab} className="bg-[#181818] p-6 sm:p-8 rounded-3xl border border-[#333333] shadow-2xl space-y-6">
        
        {/* FILA 1: Fecha y hora & Concepto */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Fecha y hora */}
          <div>
            <label className="block text-xs font-bold text-[#a8a29e] mb-1.5 uppercase">
              Fecha y Hora del Ingreso <span className="text-[#D6A21A]">*</span>
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                required
                value={activeTab.date}
                onChange={(e) => handleFieldChange('date', e.target.value)}
                className="w-full bg-[#242424] border border-[#383838] focus:border-[#D6A21A] rounded-xl px-4 py-3 text-xs text-[#FFFDF5] outline-none"
              />
            </div>
            <p className="text-[10px] text-[#78716c] mt-1">Hora oficial de Colombia (America/Bogota)</p>
          </div>

          {/* Concepto */}
          <div>
            <label className="block text-xs font-bold text-[#a8a29e] mb-1.5 uppercase">
              Concepto del Ingreso <span className="text-[#D6A21A]">*</span>
            </label>
            <input
              type="text"
              required
              value={activeTab.concept}
              onChange={(e) => handleFieldChange('concept', e.target.value)}
              placeholder="Ej: Reintegro, Recuperación de dinero, Venta material usado..."
              className="w-full bg-[#242424] border border-[#383838] focus:border-[#D6A21A] rounded-xl px-4 py-3 text-xs text-[#FFFDF5] outline-none"
            />
            {/* Sugerencias Rápidas */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[
                'Reintegro de dinero',
                'Recuperación de cartera castigada',
                'Venta de reciclaje / material usado',
                'Ajuste sobrante de caja',
                'Ingreso extraordinario',
              ].map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => handleFieldChange('concept', sug)}
                  className="text-[10px] bg-[#242424] hover:bg-[#2c2c2c] text-[#a8a29e] hover:text-[#FFFDF5] border border-[#383838] px-2 py-0.5 rounded-lg cursor-pointer"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* FILA 2: Tercero / Referencia & Medio de Pago */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Tercero / Referencia */}
          <div>
            <label className="block text-xs font-bold text-[#a8a29e] mb-1.5 uppercase">
              Tercero / Referencia (Opcional)
            </label>
            <input
              type="text"
              value={activeTab.thirdParty}
              onChange={(e) => handleFieldChange('thirdParty', e.target.value)}
              placeholder="Ej: Distribuidora del Valle, Juan Pérez, etc."
              className="w-full bg-[#242424] border border-[#383838] focus:border-[#D6A21A] rounded-xl px-4 py-3 text-xs text-[#FFFDF5] outline-none"
            />
          </div>

          {/* Medio de Pago */}
          <div>
            <label className="block text-xs font-bold text-[#a8a29e] mb-1.5 uppercase">
              Medio de Pago <span className="text-[#D6A21A]">*</span>
            </label>
            <select
              value={activeTab.paymentMethod}
              onChange={(e) => handleFieldChange('paymentMethod', e.target.value)}
              aria-label="Seleccionar medio de pago"
              className="w-full bg-[#242424] border border-[#383838] focus:border-[#D6A21A] rounded-xl px-4 py-3 text-xs text-[#FFFDF5] outline-none"
            >
              {activePaymentMethods.length > 0 ? (
                activePaymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.name.toLowerCase().replace(/\s+/g, '_')}>
                    {pm.name} {pm.isCashType ? '(Caja Física)' : pm.bankName ? `(${pm.bankName})` : ''}
                  </option>
                ))
              ) : (
                <>
                  <option value="efectivo">Efectivo (Caja Física)</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="nequi">Nequi</option>
                  <option value="daviplata">Daviplata</option>
                  <option value="tarjeta">Tarjeta / Datáfono</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* FILA 3: Valor */}
        <div>
          <label className="block text-xs font-bold text-[#a8a29e] mb-1.5 uppercase">
            Valor del Ingreso ($ COP) <span className="text-[#D6A21A]">*</span>
          </label>
          <div className="relative max-w-md">
            <span className="absolute left-4 top-3 text-[#D6A21A] font-black text-sm">$</span>
            <input
              type="number"
              min={1}
              step="any"
              required
              value={activeTab.amount === 0 ? '' : activeTab.amount}
              onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-full bg-[#242424] border border-[#383838] focus:border-[#D6A21A] rounded-xl pl-8 pr-4 py-3 text-base font-black text-emerald-400 outline-none"
            />
          </div>
          {activeTab.amount > 0 && (
            <p className="text-xs text-[#D6A21A] font-bold mt-1.5">
              Importe a registrar: {formatCOP(activeTab.amount)}
            </p>
          )}
        </div>

        {/* FILA 4: Observaciones */}
        <div>
          <label className="block text-xs font-bold text-[#a8a29e] mb-1.5 uppercase">
            Observaciones o Aclaraciones (Opcional)
          </label>
          <textarea
            rows={3}
            value={activeTab.observations}
            onChange={(e) => handleFieldChange('observations', e.target.value)}
            placeholder="Aclaraciones adicionales sobre el origen o soporte del dinero..."
            className="w-full bg-[#242424] border border-[#383838] focus:border-[#D6A21A] rounded-xl p-4 text-xs text-[#FFFDF5] outline-none"
          />
        </div>

        {/* BOTÓN GRANDE GUARDAR INGRESO */}
        <div className="pt-4 border-t border-[#2e2e2e] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <p className="text-xs text-[#a8a29e]">
            {tabs.length > 1
              ? `Guardando "${activeTab.tabLabel}". Conservará las otras ${tabs.length - 1} pestaña(s).`
              : 'Al guardar, se registrará el comprobante y el efecto financiero en caja.'}
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isSubmitting || actionLoading}
              onClick={handleBackWithCheck}
              className="px-5 py-3 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] text-xs font-bold text-[#d6d3d1] cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting || actionLoading}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 shadow-xl cursor-pointer disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              <span>{isSubmitting ? 'Registrando ingreso...' : 'Guardar ingreso'}</span>
            </button>
          </div>
        </div>

      </form>

    </div>
  );
};
