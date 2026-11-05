import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import { PaymentMethodItem, PaymentMethodCategory } from '../../types';
import {
  CreditCard,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Banknote,
  QrCode,
  Building,
  Gift,
  Wallet,
  ShieldCheck,
  AlertTriangle,
  X,
  Sparkles,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  methodToEdit?: PaymentMethodItem | null;
  onSave: (data: Omit<PaymentMethodItem, 'id' | 'createdAt'>) => Promise<void>;
  isLoading: boolean;
}

const PaymentMethodModal: React.FC<PaymentMethodModalProps> = ({
  isOpen,
  onClose,
  methodToEdit,
  onSave,
  isLoading,
}) => {
  const [name, setName] = useState<string>(methodToEdit?.name || '');
  const [category, setCategory] = useState<PaymentMethodCategory>(methodToEdit?.category || 'transferencia');
  const [bankName, setBankName] = useState<string>(methodToEdit?.bankName || '');
  const [accountNumber, setAccountNumber] = useState<string>(methodToEdit?.accountNumber || '');
  const [description, setDescription] = useState<string>(methodToEdit?.description || '');
  const [requiresReference, setRequiresReference] = useState<boolean>(methodToEdit?.requiresReference ?? false);
  const [isCashType, setIsCashType] = useState<boolean>(methodToEdit?.isCashType ?? false);
  const [isActive, setIsActive] = useState<boolean>(methodToEdit?.isActive ?? true);
  const [error, setError] = useState<string>('');

  React.useEffect(() => {
    if (methodToEdit) {
      setName(methodToEdit.name);
      setCategory(methodToEdit.category);
      setBankName(methodToEdit.bankName || '');
      setAccountNumber(methodToEdit.accountNumber || '');
      setDescription(methodToEdit.description || '');
      setRequiresReference(methodToEdit.requiresReference ?? false);
      setIsCashType(methodToEdit.isCashType ?? false);
      setIsActive(methodToEdit.isActive ?? true);
    } else {
      setName('');
      setCategory('transferencia');
      setBankName('');
      setAccountNumber('');
      setDescription('');
      setRequiresReference(true);
      setIsCashType(false);
      setIsActive(true);
    }
    setError('');
  }, [methodToEdit, isOpen]);

  // Si cambia a efectivo, activar por defecto isCashType y desactivar requiresReference
  const handleCategoryChange = (cat: PaymentMethodCategory) => {
    setCategory(cat);
    if (cat === 'efectivo') {
      setIsCashType(true);
      setRequiresReference(false);
    } else {
      setIsCashType(false);
      setRequiresReference(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre del medio de pago es obligatorio.');
      return;
    }

    try {
      await onSave({
        name: name.trim(),
        category,
        bankName: bankName.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        description: description.trim() || undefined,
        requiresReference,
        isCashType,
        isActive,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el medio de pago');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative bg-[#181818] border border-amber-600/60 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden my-6 text-[#FFFDF5]">
        
        {/* Cabecera */}
        <div className="p-5 border-b border-[#333333] flex items-center justify-between bg-gradient-to-r from-[#181818] to-[#242424]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-600/60 text-[#D6A21A] flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#FFFDF5]">
                {methodToEdit ? 'Editar Medio de Pago' : 'Nuevo Medio de Pago'}
              </h3>
              <p className="text-xs text-[#a8a29e]">
                {methodToEdit ? 'Actualice la información del método' : 'Configure una nueva forma de pago'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#a8a29e] hover:text-[#FFFDF5] rounded-xl hover:bg-[#2d2d2d] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-700/60 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5 uppercase">
              Nombre del Medio de Pago <span className="text-[#D6A21A]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Bancolombia QR, Nequi, Datafono Bold, Sodexo..."
              className="w-full bg-[#242424] border border-[#383838] focus:border-[#D6A21A] rounded-xl px-4 py-2.5 text-xs text-[#FFFDF5] outline-none"
              required
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5 uppercase">
              Tipo / Categoría <span className="text-[#D6A21A]">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'efectivo', label: 'Efectivo', icon: Banknote },
                { id: 'billetera_digital', label: 'Billetera Digital', icon: QrCode },
                { id: 'transferencia', label: 'Transferencia', icon: Building },
                { id: 'tarjeta', label: 'Tarjeta / Datáfono', icon: CreditCard },
                { id: 'bono', label: 'Bono / Vale', icon: Gift },
                { id: 'otro', label: 'Otro Canal', icon: Wallet },
              ].map((cat) => {
                const Icon = cat.icon;
                const isSel = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryChange(cat.id as PaymentMethodCategory)}
                    className={`p-2.5 rounded-xl border text-left text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                      isSel
                        ? 'bg-amber-950/80 border-amber-600 text-[#D6A21A]'
                        : 'bg-[#242424] border-[#383838] text-[#a8a29e] hover:text-[#FFFDF5] hover:border-[#555]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Entidad Bancaria & Número de Cuenta/Celular */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5 uppercase">
                Banco o Proveedor (Opcional)
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Ej: Bancolombia, Davivienda, Redeban..."
                className="w-full bg-[#242424] border border-[#383838] focus:border-[#D6A21A] rounded-xl px-4 py-2.5 text-xs text-[#FFFDF5] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5 uppercase">
                Cuenta / Llave / Celular (Opcional)
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Ej: 312 345 6789 o Ahorros #..."
                className="w-full bg-[#242424] border border-[#383838] focus:border-[#D6A21A] rounded-xl px-4 py-2.5 text-xs text-[#FFFDF5] outline-none"
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5 uppercase">
              Descripción o Instrucciones para el Cajero
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Pedir número de aprobación del datáfono o verificar comprobante en pantalla..."
              className="w-full bg-[#242424] border border-[#383838] focus:border-[#D6A21A] rounded-xl p-3 text-xs text-[#FFFDF5] outline-none"
            />
          </div>

          {/* Opciones y Switches */}
          <div className="space-y-3 pt-2 border-t border-[#2e2e2e]">
            {/* Requiere Referencia */}
            <label className="flex items-center justify-between p-3 bg-[#1f1f22] border border-[#333333] rounded-2xl cursor-pointer hover:bg-[#252528] transition-colors">
              <div>
                <span className="text-xs font-bold text-[#FFFDF5] block">
                  Solicitar número de comprobante / aprobación
                </span>
                <span className="text-[10px] text-[#a8a29e] block mt-0.5">
                  Obliga al cajero o asesor a ingresar el código de autorización
                </span>
              </div>
              <input
                type="checkbox"
                checked={requiresReference}
                onChange={(e) => setRequiresReference(e.target.checked)}
                className="w-4 h-4 accent-[#D6A21A] cursor-pointer"
              />
            </label>

            {/* Afecta Arqueo de Efectivo */}
            <label className="flex items-center justify-between p-3 bg-[#1f1f22] border border-[#333333] rounded-2xl cursor-pointer hover:bg-[#252528] transition-colors">
              <div>
                <span className="text-xs font-bold text-[#FFFDF5] block">
                  Afecta arqueo físico de caja (Efectivo en gaveta)
                </span>
                <span className="text-[10px] text-[#a8a29e] block mt-0.5">
                  Marca si el dinero ingresa físicamente al cajón monedero
                </span>
              </div>
              <input
                type="checkbox"
                checked={isCashType}
                onChange={(e) => setIsCashType(e.target.checked)}
                className="w-4 h-4 accent-[#D6A21A] cursor-pointer"
              />
            </label>

            {/* Estado Activo */}
            <label className="flex items-center justify-between p-3 bg-[#1f1f22] border border-[#333333] rounded-2xl cursor-pointer hover:bg-[#252528] transition-colors">
              <div>
                <span className="text-xs font-bold text-[#FFFDF5] block">
                  Medio de pago disponible (Activo)
                </span>
                <span className="text-[10px] text-[#a8a29e] block mt-0.5">
                  Disponible para cobros en mesas, domicilios, POS y desembolsos
                </span>
              </div>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 accent-[#D6A21A] cursor-pointer"
              />
            </label>
          </div>

          {/* Acciones */}
          <div className="pt-4 border-t border-[#333333] flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] text-xs font-bold text-[#a8a29e] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs hover:brightness-110 shadow-lg cursor-pointer disabled:opacity-50"
            >
              {isLoading ? 'Guardando...' : methodToEdit ? 'Guardar Cambios' : 'Crear Medio de Pago'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export const PaymentMethodsManagementView: React.FC = () => {
  const {
    paymentMethods,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    togglePaymentMethodStatus,
    actionLoading,
  } = useRestaurant();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [onlyActive, setOnlyActive] = useState<boolean>(false);

  // Modal de Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [methodToEdit, setMethodToEdit] = useState<PaymentMethodItem | null>(null);

  // Modal de Confirmación de Borrado
  const [methodToDelete, setMethodToDelete] = useState<PaymentMethodItem | null>(null);

  const handleOpenCreate = () => {
    setMethodToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (method: PaymentMethodItem) => {
    setMethodToEdit(method);
    setIsModalOpen(true);
  };

  const handleSaveMethod = async (data: Omit<PaymentMethodItem, 'id' | 'createdAt'>) => {
    try {
      if (methodToEdit) {
        await updatePaymentMethod(methodToEdit.id, data);
        showToast(`Medio de pago "${data.name}" actualizado con éxito`, 'success');
      } else {
        await createPaymentMethod(data);
        showToast(`Medio de pago "${data.name}" creado con éxito`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Error al procesar el medio de pago', 'error');
      throw err;
    }
  };

  const handleConfirmDelete = async () => {
    if (!methodToDelete) return;

    if (paymentMethods.length <= 1) {
      showToast('No es posible eliminar el único medio de pago del sistema', 'error');
      setMethodToDelete(null);
      return;
    }

    try {
      await deletePaymentMethod(methodToDelete.id);
      showToast(`Medio de pago "${methodToDelete.name}" eliminado correctamente`, 'info');
      setMethodToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar el medio de pago', 'error');
    }
  };

  // Filtrado de medios de pago
  const filteredMethods = paymentMethods.filter((item) => {
    if (onlyActive && !item.isActive) return false;
    if (selectedCategory !== 'todos' && item.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchBank = (item.bankName || '').toLowerCase().includes(q);
      const matchAcc = (item.accountNumber || '').toLowerCase().includes(q);
      const matchDesc = (item.description || '').toLowerCase().includes(q);
      if (!matchName && !matchBank && !matchAcc && !matchDesc) return false;
    }
    return true;
  });

  const totalCount = paymentMethods.length;
  const activeCount = paymentMethods.filter((p) => p.isActive).length;
  const cashCount = paymentMethods.filter((p) => p.isCashType).length;
  const digitalCount = paymentMethods.filter((p) => !p.isCashType).length;

  const getCategoryIcon = (cat: PaymentMethodCategory) => {
    switch (cat) {
      case 'efectivo':
        return Banknote;
      case 'billetera_digital':
        return QrCode;
      case 'transferencia':
        return Building;
      case 'tarjeta':
        return CreditCard;
      case 'bono':
        return Gift;
      default:
        return Wallet;
    }
  };

  const getCategoryLabel = (cat: PaymentMethodCategory) => {
    switch (cat) {
      case 'efectivo':
        return 'Efectivo';
      case 'billetera_digital':
        return 'Billetera Digital';
      case 'transferencia':
        return 'Transferencia Bancaria';
      case 'tarjeta':
        return 'Tarjeta / Datáfono';
      case 'bono':
        return 'Bono o Vale';
      default:
        return 'Otro';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Cabecera Principal */}
      <div className="bg-[#181818] p-6 rounded-3xl border border-[#333333] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[#FFFDF5] tracking-wide flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-[#D6A21A]" />
            <span>MEDIOS DE PAGO</span>
          </h2>
          <p className="text-xs text-[#d6d3d1] mt-0.5">
            Administración, altas, edición y control de formas de pago aceptadas en el restaurante y sucursales.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs flex items-center gap-2 hover:brightness-110 shadow-lg cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Medio de Pago</span>
        </button>
      </div>

      {/* 2. Tarjetas de Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#181818] p-4 rounded-2xl border border-[#333333]">
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Total Registrados</span>
          <span className="text-xl font-black text-[#FFFDF5] mt-1 block">{totalCount}</span>
          <span className="text-[10px] text-[#78716c]">métodos configurados</span>
        </div>

        <div className="bg-[#181818] p-4 rounded-2xl border border-[#333333]">
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Activos para Cobro</span>
          <span className="text-xl font-black text-emerald-400 mt-1 block">{activeCount}</span>
          <span className="text-[10px] text-emerald-400/70">habilitados en el sistema</span>
        </div>

        <div className="bg-[#181818] p-4 rounded-2xl border border-[#333333]">
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Efectivo / Caja</span>
          <span className="text-xl font-black text-[#D6A21A] mt-1 block">{cashCount}</span>
          <span className="text-[10px] text-[#78716c]">afectan arqueo físico</span>
        </div>

        <div className="bg-[#181818] p-4 rounded-2xl border border-[#333333]">
          <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Bancarios / Digitales</span>
          <span className="text-xl font-black text-cyan-400 mt-1 block">{digitalCount}</span>
          <span className="text-[10px] text-cyan-400/70">transferencias & datáfonos</span>
        </div>
      </div>

      {/* 3. Filtros y Búsqueda */}
      <div className="bg-[#181818] border border-[#333333] p-4 rounded-3xl space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#a8a29e]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, banco, cuenta o descripción..."
              className="w-full bg-[#242424] border border-[#383838] focus:border-[#D6A21A] rounded-xl pl-10 pr-4 py-2 text-xs text-[#FFFDF5] outline-none"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#d6d3d1] whitespace-nowrap self-start sm:self-auto">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
              className="w-4 h-4 accent-[#D6A21A] cursor-pointer"
            />
            <span>Solo activos</span>
          </label>
        </div>

        {/* Categorías Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'efectivo', label: 'Efectivo' },
            { id: 'billetera_digital', label: 'Billeteras (Nequi/Davi)' },
            { id: 'transferencia', label: 'Transferencias' },
            { id: 'tarjeta', label: 'Tarjetas / Datáfonos' },
            { id: 'bono', label: 'Bonos / Vales' },
            { id: 'otro', label: 'Otros' },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === c.id
                  ? 'bg-[#B77900] text-[#181818]'
                  : 'bg-[#242424] text-[#a8a29e] hover:text-[#FFFDF5] hover:bg-[#2d2d2d]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Lista / Cuadrícula de Medios de Pago */}
      {filteredMethods.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMethods.map((pm) => {
            const Icon = getCategoryIcon(pm.category);
            return (
              <div
                key={pm.id}
                className={`bg-[#181818] border rounded-3xl p-5 shadow-lg flex flex-col justify-between transition-all ${
                  pm.isActive
                    ? 'border-[#333333] hover:border-amber-600/50'
                    : 'border-[#262626] opacity-60'
                }`}
              >
                <div>
                  {/* Encabezado de la tarjeta */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-[#242424] border border-[#383838] flex items-center justify-center text-[#D6A21A]">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-[#FFFDF5] leading-tight">
                          {pm.name}
                        </h4>
                        <span className="text-[10px] text-[#a8a29e] font-bold block mt-0.5">
                          {getCategoryLabel(pm.category)}
                        </span>
                      </div>
                    </div>

                    {/* Switch de Estado */}
                    <button
                      type="button"
                      onClick={() => togglePaymentMethodStatus(pm.id)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full cursor-pointer transition-colors ${
                        pm.isActive
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-[#292929] text-[#78716c] border border-[#3a3a3a]'
                      }`}
                      title="Cambiar estado activo / inactivo"
                    >
                      {pm.isActive ? 'Activo' : 'Inactivo'}
                    </button>
                  </div>

                  {/* Detalles / Entidad */}
                  {(pm.bankName || pm.accountNumber) && (
                    <div className="bg-[#121214] border border-[#2e2e2e] rounded-xl p-2.5 text-xs space-y-1 mb-3">
                      {pm.bankName && (
                        <p className="text-[#FFFDF5] font-bold text-[11px] flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-[#D6A21A]" />
                          <span>{pm.bankName}</span>
                        </p>
                      )}
                      {pm.accountNumber && (
                        <p className="text-[#a8a29e] font-mono text-[10px]">
                          Ref/Cuenta: <strong className="text-[#FFFDF5]">{pm.accountNumber}</strong>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Descripción / Notas */}
                  {pm.description && (
                    <p className="text-[11px] text-[#a8a29e] leading-relaxed mb-3 italic">
                      "{pm.description}"
                    </p>
                  )}

                  {/* Insignias de control operativo */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {pm.isCashType ? (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800">
                        Afecta Arqueo Caja
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#242424] text-[#a8a29e] border border-[#333]">
                        No Afecta Arqueo Físico
                      </span>
                    )}

                    {pm.requiresReference && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800">
                        Exige No. Comprobante
                      </span>
                    )}
                  </div>
                </div>

                {/* Acciones de Edición / Borrado */}
                <div className="pt-3 border-t border-[#292929] flex items-center justify-between">
                  <span className="text-[10px] text-[#57534e]">
                    ID: {pm.id.substring(0, 10)}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(pm)}
                      className="px-3 py-1.5 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] border border-[#383838] text-[#D6A21A] text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMethodToDelete(pm)}
                      className="p-1.5 rounded-xl bg-red-950/50 hover:bg-red-900/80 border border-red-800 text-red-300 text-xs font-bold inline-flex items-center cursor-pointer transition-all"
                      title="Eliminar medio de pago"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#181818] border border-[#333333] rounded-3xl p-12 text-center text-[#a8a29e] space-y-3">
          <CreditCard className="w-12 h-12 mx-auto text-[#B77900] opacity-50" />
          <h3 className="text-base font-black text-[#FFFDF5]">No se encontraron medios de pago</h3>
          <p className="text-xs text-[#a8a29e] max-w-md mx-auto">
            {searchQuery || selectedCategory !== 'todos'
              ? 'No hay métodos que coincidan con los criterios de búsqueda aplicados.'
              : 'Aún no se han configurado medios de pago en la base de datos.'}
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center gap-1.5 hover:brightness-110 shadow cursor-pointer mt-2"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Primer Medio de Pago</span>
          </button>
        </div>
      )}

      {/* MODAL: CREAR / EDITAR */}
      <PaymentMethodModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        methodToEdit={methodToEdit}
        onSave={handleSaveMethod}
        isLoading={actionLoading}
      />

      {/* MODAL: CONFIRMAR BORRADO */}
      {methodToDelete && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-red-500/50 rounded-3xl w-full max-w-md p-6 text-[#FFFDF5] shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-600 text-red-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-[#FFFDF5]">
                ¿Eliminar Medio de Pago?
              </h3>
              <p className="text-xs text-[#d6d3d1] leading-relaxed">
                Está a punto de eliminar definitivamente el medio de pago{' '}
                <strong className="text-[#D6A21A]">"{methodToDelete.name}"</strong>.
                Los registros históricos continuarán intactos, pero no estará disponible para nuevos cobros ni compras.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2e2e2e]">
              <button
                type="button"
                onClick={() => setMethodToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] text-xs font-bold text-[#a8a29e] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-red-600 hover:brightness-110 text-white font-black text-xs cursor-pointer shadow-lg inline-flex items-center gap-2"
              >
                <span>Sí, Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
