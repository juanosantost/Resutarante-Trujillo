import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { InventoryItem, Supplier, PaymentMethod, InventoryUnit } from '../../types';
import { InventoryItemModal } from '../inventory/InventoryItemModal';
import { SupplierModal } from './SupplierModal';
import { SupplierSelectInput } from '../common/SupplierSelectInput';
import {
  Truck,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Printer,
  FileText,
  Search,
  Package,
  DollarSign,
  Building,
  AlertTriangle,
  X,
  Edit2,
  Check,
} from 'lucide-react';

interface PurchaseRegistrationViewProps {
  onBack: () => void;
  initialSupplier?: Supplier | null;
}

interface CartItem {
  ingredientId: string;
  ingredientName: string;
  category: string;
  unit: InventoryUnit;
  quantity: number;
  unitCost: number;
  currentStock: number;
}

export const PurchaseRegistrationView: React.FC<PurchaseRegistrationViewProps> = ({
  onBack,
  initialSupplier,
}) => {
  const {
    inventory,
    suppliers,
    createPurchase,
    createSupplierAdvance,
    currentBranch,
    actionLoading,
    paymentMethods,
  } = useRestaurant();
  const { showToast } = useToast();

  // Etapas del formulario: 1 = Seleccionar artículos, 2 = Finalizar compra
  const [stage, setStage] = useState<1 | 2>(1);

  // Catálogo & Búsqueda
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');

  // Carrito de compras
  const [cart, setCart] = useState<CartItem[]>([]);

  // Modal para agregar/editar artículo del carrito
  const [activeItemModal, setActiveItemModal] = useState<InventoryItem | null>(null);
  const [modalQty, setModalQty] = useState<string>('1');
  const [modalUnitCost, setModalUnitCost] = useState<string>('0');
  const [modalTotalCost, setModalTotalCost] = useState<string>('0');

  // Modales auxiliares
  const [showCreateItemModal, setShowCreateItemModal] = useState<boolean>(false);
  const [showSupplierModal, setShowSupplierModal] = useState<boolean>(false);

  // Datos de finalización (Etapa 2)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(initialSupplier || null);
  const [documentNumber, setDocumentNumber] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [observations, setObservations] = useState<string>('');

  // Múltiples medios de pago
  interface PaymentRow {
    id: string;
    method: PaymentMethod;
    amount: number;
  }
  const [payments, setPayments] = useState<PaymentRow[]>([
    { id: 'pay-1', method: 'transferencia', amount: 0 },
  ]);

  // Tipo de compra con saldo pendiente ('pagada' | 'cuenta_por_pagar' | 'anticipo')
  const [purchaseTypeChoice, setPurchaseTypeChoice] = useState<'pagada' | 'cuenta_por_pagar' | 'anticipo'>('pagada');

  // Cola de operaciones / estado de guardado
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [successResultId, setSuccessResultId] = useState<string | null>(null);

  // Categorías de inventario únicas
  const categories: string[] = ['todos', ...Array.from(new Set(inventory.map((i) => i.category || 'General')))];

  const filteredInventory: InventoryItem[] = inventory.filter((item: InventoryItem) => {
    if (selectedCategory !== 'todos' && (item.category || 'General') !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchRef = item.reference?.toLowerCase().includes(q) || false;
      const matchBarcode = item.barcode?.toLowerCase().includes(q) || false;
      if (!matchName && !matchRef && !matchBarcode) return false;
    }
    return true;
  });

  // Cálculos totales
  const subtotalCart = cart.reduce((sum: number, item: CartItem) => sum + item.quantity * item.unitCost, 0);
  const taxCart = Math.round(subtotalCart * 0.19);
  const totalCart = subtotalCart + taxCart;

  const totalPaid = payments.reduce((sum: number, p: PaymentRow) => sum + p.amount, 0);
  const balanceDue = Math.max(0, totalCart - totalPaid);

  // Abrir modal de artículo
  const handleOpenItemModal = (item: InventoryItem) => {
    setActiveItemModal(item);
    const existing = cart.find((c: CartItem) => c.ingredientId === item.id);
    const qty = existing ? existing.quantity : 1;
    const cost = existing ? existing.unitCost : item.costPerUnit || 0;
    setModalQty(qty.toString());
    setModalUnitCost(cost.toString());
    setModalTotalCost((qty * cost).toString());
  };

  const handleQtyChange = (val: string) => {
    setModalQty(val);
    const q = parseFloat(val) || 0;
    const uc = parseFloat(modalUnitCost) || 0;
    setModalTotalCost((q * uc).toFixed(2));
  };

  const handleUnitCostChange = (val: string) => {
    setModalUnitCost(val);
    const q = parseFloat(modalQty) || 0;
    const uc = parseFloat(val) || 0;
    setModalTotalCost((q * uc).toFixed(2));
  };

  const handleTotalCostChange = (val: string) => {
    setModalTotalCost(val);
    const tot = parseFloat(val) || 0;
    const q = parseFloat(modalQty) || 1;
    if (q > 0) {
      setModalUnitCost((tot / q).toFixed(2));
    }
  };

  const handleAddToCartConfirm = () => {
    if (!activeItemModal) return;
    const qty = parseFloat(modalQty);
    const cost = parseFloat(modalUnitCost);

    if (isNaN(qty) || qty <= 0) {
      showToast('La cantidad debe ser mayor a cero', 'error');
      return;
    }
    if (isNaN(cost) || cost < 0) {
      showToast('El costo unitario no puede ser negativo', 'error');
      return;
    }

    const newItem: CartItem = {
      ingredientId: activeItemModal.id,
      ingredientName: activeItemModal.name,
      category: activeItemModal.category || 'General',
      unit: activeItemModal.unit,
      quantity: qty,
      unitCost: cost,
      currentStock: activeItemModal.currentStock,
    };

    const existingIndex = cart.findIndex((c: CartItem) => c.ingredientId === activeItemModal.id);
    if (existingIndex >= 0) {
      const updated = [...cart];
      updated[existingIndex] = newItem;
      setCart(updated);
    } else {
      setCart([...cart, newItem]);
    }

    setActiveItemModal(null);
    showToast(`${activeItemModal.name} agregado al carrito de compra`, 'success');
  };

  const handleRemoveCartItem = (id: string) => {
    setCart(cart.filter((c: CartItem) => c.ingredientId !== id));
  };

  // Manejo de pagos múltiples
  const handleAddPaymentRow = () => {
    setPayments([
      ...payments,
      { id: `pay-${Date.now()}`, method: 'efectivo', amount: Math.max(0, balanceDue) },
    ]);
  };

  const handleRemovePaymentRow = (id: string) => {
    if (payments.length === 1) {
      showToast('Debe mantener al menos un método de pago', 'warning');
      return;
    }
    setPayments(payments.filter((p: PaymentRow) => p.id !== id));
  };

  const handlePaymentRowChange = (id: string, field: 'method' | 'amount', value: any) => {
    setPayments(
      payments.map((p: PaymentRow) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  // Guardar compra completa
  const handleExecuteSavePurchase = async () => {
    if (!selectedSupplier) {
      showToast('Debe seleccionar un proveedor para la compra', 'error');
      return;
    }
    if (!documentNumber.trim()) {
      showToast('El número de factura o documento soporte es obligatorio', 'error');
      return;
    }
    if (cart.length === 0) {
      showToast('El carrito de compras está vacío', 'error');
      return;
    }

    setIsProcessing(true);
    setProcessingStep('Validando datos de la compra...');

    try {
      await new Promise((r) => setTimeout(r, 600));
      setProcessingStep('Registrando compra y actualizando inventario...');

      const mainPaymentMethod = payments[0]?.method || 'transferencia';
      const purchaseId = await createPurchase({
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        date: purchaseDate,
        documentNumber: documentNumber.trim(),
        items: cart.map((i: CartItem) => ({
          ingredientId: i.ingredientId,
          ingredientName: i.ingredientName,
          quantity: i.quantity,
          unit: i.unit,
          unitCost: i.unitCost,
        })),
        paymentMethod: mainPaymentMethod,
        amountPaid: totalPaid,
        observations: observations.trim() || `Compra registrada en Desembolsos - Tipo: ${purchaseTypeChoice}`,
      });

      // Si se registró como anticipo con saldo y pago inicial
      if (purchaseTypeChoice === 'anticipo' && totalPaid > 0) {
        setProcessingStep('Generando registro de anticipo a proveedor...');
        await createSupplierAdvance({
          supplierId: selectedSupplier.id,
          supplierName: selectedSupplier.name,
          amount: totalPaid,
          paymentMethod: mainPaymentMethod,
          observations: `Anticipo por mercancía pendiente de recepción - Factura #${documentNumber.trim()}`,
        });
      }

      setProcessingStep('Generando comprobantes y registrando auditoría...');
      await new Promise((r) => setTimeout(r, 500));

      setSuccessResultId(purchaseId);
      showToast('¡Compra registrada correctamente!', 'success');
    } catch (err: any) {
      console.error('Error saving purchase:', err);
      showToast(err.message || 'Error al guardar la compra', 'error');
      setIsProcessing(false);
    }
  };

  const handleBackWithConfirmation = () => {
    if (cart.length > 0 && !successResultId) {
      if (!window.confirm('Tiene artículos en el carrito sin guardar. ¿Está seguro de regresar a Desembolsos?')) {
        return;
      }
    }
    onBack();
  };

  if (successResultId) {
    return (
      <div className="bg-[#181818] p-8 rounded-3xl border border-[#333333] shadow-2xl max-w-2xl mx-auto text-center my-12 text-[#FFFDF5]">
        <div className="w-20 h-20 rounded-full bg-emerald-950/80 border border-emerald-600/60 text-emerald-400 flex items-center justify-center mx-auto mb-6 shadow-xl animate-bounce">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black mb-2 tracking-wide">
          ¡COMPRA REGISTRADA EXITOSAMENTE!
        </h2>
        <p className="text-xs text-[#d6d3d1] mb-6">
          La operación se ha integrado correctamente con Inventario, Proveedores, Caja y Desembolsos.
        </p>

        <div className="bg-[#242424] p-4 rounded-2xl border border-[#383838] text-left mb-6 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-[#a8a29e]">Proveedor:</span>
            <span className="font-bold text-[#FFFDF5]">{selectedSupplier?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#a8a29e]">Documento / Factura:</span>
            <span className="font-bold text-[#D6A21A]">{documentNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#a8a29e]">Valor Comercial Total:</span>
            <span className="font-bold text-emerald-400">{formatCOP(totalCart)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#a8a29e]">Total Pagado (Caja):</span>
            <span className="font-bold text-[#FFFDF5]">{formatCOP(totalPaid)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#a8a29e]">Saldo / Estado:</span>
            <span className="font-bold text-amber-300">
              {balanceDue > 0 ? `${formatCOP(balanceDue)} (${purchaseTypeChoice === 'anticipo' ? 'Anticipo' : 'Cuenta por Pagar'})` : 'Pagado 100%'}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#242424] text-[#D6A21A] border border-[#383838] hover:bg-[#2e2e2e] font-bold text-xs flex items-center justify-center gap-2 shadow cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Comprobante</span>
          </button>

          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs flex items-center justify-center gap-2 hover:brightness-110 shadow-lg cursor-pointer"
          >
            <span>Volver a Desembolsos</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      
      {/* 1. Cabecera */}
      <div className="bg-[#181818] p-6 rounded-3xl border border-[#333333] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 rounded-full bg-amber-950/80 text-[#D6A21A] border border-amber-600/40 text-[10px] font-bold uppercase tracking-wider">
              Módulo de Compras & Insumos
            </span>
            <span className="text-xs text-[#a8a29e]">Sucursal: <strong className="text-[#FFFDF5]">{currentBranch?.name}</strong></span>
          </div>
          <h2 className="text-xl font-black text-[#FFFDF5] tracking-wide">
            REGISTRAR COMPRA
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackWithConfirmation}
            className="px-4 py-2.5 rounded-xl bg-[#242424] text-[#a8a29e] border border-[#383838] hover:bg-[#2e2e2e] hover:text-[#FFFDF5] font-bold text-xs flex items-center gap-2 shadow cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Desembolsos</span>
          </button>

          {stage === 1 ? (
            <button
              type="button"
              onClick={() => {
                if (cart.length === 0) {
                  showToast('Agregue al menos un artículo al carrito para continuar', 'warning');
                  return;
                }
                setStage(2);
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs flex items-center gap-2 hover:brightness-110 shadow-lg cursor-pointer"
            >
              <span>Continuar a Finalizar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStage(1)}
              className="px-4 py-2.5 rounded-xl bg-[#242424] text-[#D6A21A] border border-[#383838] hover:bg-[#2e2e2e] font-bold text-xs flex items-center gap-2 shadow cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Modificar Artículos</span>
            </button>
          )}
        </div>
      </div>

      {/* Indicador de Etapas */}
      <div className="grid grid-cols-2 gap-4">
        <div
          onClick={() => setStage(1)}
          className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
            stage === 1
              ? 'bg-[#242424] border-[#D6A21A] shadow-lg'
              : 'bg-[#181818] border-[#333333] opacity-70 hover:opacity-100'
          }`}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${stage === 1 ? 'bg-[#D6A21A] text-[#181818]' : 'bg-[#333333] text-[#a8a29e]'}`}>
            1
          </div>
          <div>
            <h4 className="text-xs font-black text-[#FFFDF5]">Etapa 1: Seleccionar Artículos</h4>
            <p className="text-[10px] text-[#a8a29e]">Elija insumos, cantidades y costos del inventario</p>
          </div>
        </div>

        <div
          onClick={() => {
            if (cart.length === 0) {
              showToast('Debe agregar artículos antes de pasar a finalización', 'warning');
              return;
            }
            setStage(2);
          }}
          className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
            stage === 2
              ? 'bg-[#242424] border-[#D6A21A] shadow-lg'
              : 'bg-[#181818] border-[#333333] opacity-70 hover:opacity-100'
          }`}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${stage === 2 ? 'bg-[#D6A21A] text-[#181818]' : 'bg-[#333333] text-[#a8a29e]'}`}>
            2
          </div>
          <div>
            <h4 className="text-xs font-black text-[#FFFDF5]">Etapa 2: Proveedor & Pagos</h4>
            <p className="text-[10px] text-[#a8a29e]">Asigne proveedor, pagos y tipo de compra</p>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* ETAPA 1: SELECCIONAR ARTÍCULOS Y CARRITO   */}
      {/* ========================================== */}
      {stage === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Catálogo de Inventario (2 columnas) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-[#181818] p-5 rounded-3xl border border-[#333333] shadow-xl space-y-4">
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#a8a29e]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    placeholder="Buscar insumo o artículo..."
                    className="w-full pl-10 pr-4 py-2 bg-[#242424] border border-[#383838] rounded-xl text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowCreateItemModal(true)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 text-white font-black text-xs flex items-center justify-center gap-2 hover:brightness-110 shadow cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear Artículo de Inventario</span>
                </button>
              </div>

              {/* Categorías */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {categories.map((cat: string) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                      selectedCategory === cat
                        ? 'bg-[#D6A21A] text-[#181818]'
                        : 'bg-[#242424] text-[#a8a29e] hover:text-[#FFFDF5] border border-[#383838]'
                    }`}
                  >
                    {cat.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Grilla de Artículos de Inventario */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                {filteredInventory.map((item: InventoryItem) => {
                  const inCart = cart.find((c: CartItem) => c.ingredientId === item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleOpenItemModal(item)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        inCart
                          ? 'bg-amber-950/20 border-amber-600/60 shadow-md'
                          : 'bg-[#202020] border-[#333333] hover:border-[#555555]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-[#2b2b2b] border border-[#383838] flex items-center justify-center text-[#D6A21A] flex-shrink-0">
                          <Package className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-[#FFFDF5]">{item.name}</h4>
                          <span className="text-[10px] text-[#a8a29e] block">{item.category || 'General'} · Stock: {item.currentStock} {item.unit}</span>
                          <span className="text-[10px] text-[#D6A21A] font-bold mt-0.5 block">Costo ref: {formatCOP(item.costPerUnit || 0)}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {inCart ? (
                          <span className="px-2.5 py-1 rounded-lg bg-[#D6A21A] text-[#181818] font-black text-[10px]">
                            x{inCart.quantity}
                          </span>
                        ) : (
                          <span className="p-2 rounded-xl bg-[#282828] text-[#a8a29e] hover:text-[#FFFDF5] border border-[#383838]">
                            <Plus className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

          {/* Carrito de Compras (1 columna) */}
          <div className="space-y-4">
            <div className="bg-[#181818] p-5 rounded-3xl border border-[#333333] shadow-xl space-y-4 sticky top-6">
              <div className="flex items-center justify-between border-b border-[#333333] pb-3">
                <h3 className="text-sm font-black text-[#FFFDF5] flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#D6A21A]" />
                  <span>Carrito de Compra</span>
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-[#242424] text-[#D6A21A] border border-[#383838] text-[10px] font-bold">
                  {cart.length} ítems
                </span>
              </div>

              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-[#78716c]">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">No hay insumos agregados</p>
                    <p className="text-[10px] mt-1 text-[#57534e]">Seleccione artículos del catálogo</p>
                  </div>
                ) : (
                  cart.map((item: CartItem) => (
                    <div key={item.ingredientId} className="p-3 rounded-2xl bg-[#242424] border border-[#383838] space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5 className="text-xs font-black text-[#FFFDF5]">{item.ingredientName}</h5>
                          <span className="text-[10px] text-[#a8a29e]">{item.quantity} {item.unit} × {formatCOP(item.unitCost)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCartItem(item.ingredientId)}
                          className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-[#333333]">
                        <span className="text-[10px] text-[#a8a29e]">Subtotal:</span>
                        <span className="text-xs font-black text-emerald-400">{formatCOP(item.quantity * item.unitCost)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Totales */}
              <div className="border-t border-[#333333] pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-[#a8a29e]">
                  <span>Subtotal Insumos:</span>
                  <span>{formatCOP(subtotalCart)}</span>
                </div>
                <div className="flex justify-between text-[#a8a29e]">
                  <span>Impuestos / IVA (19%):</span>
                  <span>{formatCOP(taxCart)}</span>
                </div>
                <div className="flex justify-between font-black text-sm text-[#FFFDF5] pt-2 border-t border-[#333333]">
                  <span>Valor Total:</span>
                  <span className="text-[#D6A21A]">{formatCOP(totalCart)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (cart.length === 0) {
                    showToast('Agregue al menos un artículo al carrito', 'warning');
                    return;
                  }
                  setStage(2);
                }}
                disabled={cart.length === 0}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs flex items-center justify-center gap-2 hover:brightness-110 shadow-lg cursor-pointer disabled:opacity-50"
              >
                <span>Proceder al Pago & Proveedor</span>
                <ArrowRight className="w-4 h-4" />
              </button>

            </div>
          </div>

        </div>
      )}

      {/* ========================================== */}
      {/* ETAPA 2: FINALIZAR COMPRA & PROVEEDOR     */}
      {/* ========================================== */}
      {stage === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2 space-y-6">
            
            {/* 1. Proveedor & Documento */}
            <div className="bg-[#181818] p-6 rounded-3xl border border-[#333333] shadow-xl space-y-4">
              <h3 className="text-sm font-black text-[#FFFDF5] flex items-center gap-2 border-b border-[#333333] pb-3">
                <Building className="w-4 h-4 text-[#D6A21A]" />
                <span>Información del Proveedor y Factura</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-[#a8a29e] uppercase font-bold mb-1.5">Proveedor o Tercero *</label>
                  <SupplierSelectInput
                    selectedSupplier={selectedSupplier}
                    onSelectSupplier={(sup: Supplier | null) => setSelectedSupplier(sup)}
                    label=""
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-[#a8a29e] uppercase font-bold mb-1.5">Número de Factura / Remisión *</label>
                  <input
                    type="text"
                    value={documentNumber}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDocumentNumber(e.target.value)}
                    placeholder="Ej: FAC-98231"
                    className="w-full px-4 py-2.5 bg-[#242424] border border-[#383838] rounded-xl text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-[#a8a29e] uppercase font-bold mb-1.5">Fecha de Compra</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPurchaseDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#242424] border border-[#383838] rounded-xl text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-[#a8a29e] uppercase font-bold mb-1.5">Observaciones</label>
                  <input
                    type="text"
                    value={observations}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setObservations(e.target.value)}
                    placeholder="Notas o condiciones de la compra..."
                    className="w-full px-4 py-2.5 bg-[#242424] border border-[#383838] rounded-xl text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                  />
                </div>
              </div>
            </div>

            {/* 2. Registro de Pagos (Uno o Varios) */}
            <div className="bg-[#181818] p-6 rounded-3xl border border-[#333333] shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#333333] pb-3">
                <h3 className="text-sm font-black text-[#FFFDF5] flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#D6A21A]" />
                  <span>Medios de Pago y Desembolsos en Caja</span>
                </h3>
                <button
                  type="button"
                  onClick={handleAddPaymentRow}
                  className="px-3 py-1.5 rounded-xl bg-[#242424] text-[#D6A21A] border border-[#383838] hover:bg-[#2e2e2e] font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Pago</span>
                </button>
              </div>

              <div className="space-y-3">
                {payments.map((p: PaymentRow, idx: number) => (
                  <div key={p.id} className="flex items-center gap-3 bg-[#242424] p-3 rounded-2xl border border-[#383838]">
                    <div className="flex-1">
                      <label className="block text-[10px] text-[#a8a29e] uppercase font-bold mb-1">Medio de Pago #{idx + 1}</label>
                      <select
                        value={p.method}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handlePaymentRowChange(p.id, 'method', e.target.value as PaymentMethod)}
                        className="w-full px-3 py-2 bg-[#181818] border border-[#333333] rounded-xl text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                      >
                        {paymentMethods.filter((pm) => pm.isActive).length > 0 ? (
                          paymentMethods
                            .filter((pm) => pm.isActive)
                            .map((pm) => (
                              <option key={pm.id} value={pm.name.toLowerCase().replace(/\s+/g, '_')}>
                                {pm.name} {pm.isCashType ? '(Caja)' : ''}
                              </option>
                            ))
                        ) : (
                          <>
                            <option value="efectivo">Efectivo (Egresa de Caja)</option>
                            <option value="transferencia">Transferencia Bancaria</option>
                            <option value="tarjeta">Tarjeta Débito / Crédito</option>
                            <option value="nequi_daviplata">Nequi / Daviplata</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div className="flex-1">
                      <label className="block text-[10px] text-[#a8a29e] uppercase font-bold mb-1">Monto Pagado ($)</label>
                      <input
                        type="number"
                        min={0}
                        value={p.amount}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePaymentRowChange(p.id, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-[#181818] border border-[#333333] rounded-xl text-xs text-emerald-400 font-bold focus:outline-none focus:border-[#D6A21A]"
                      />
                    </div>

                    {payments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePaymentRow(p.id)}
                        className="mt-5 text-red-400 hover:text-red-300 p-2 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Selección de Tipo de Compra si hay saldo pendiente */}
              {balanceDue > 0 && (
                <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-600/50 space-y-2 mt-4">
                  <span className="text-xs font-black text-amber-300 block">
                    Existe un saldo pendiente de {formatCOP(balanceDue)}. ¿Cómo desea registrar la operación?
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <label className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 ${purchaseTypeChoice === 'cuenta_por_pagar' ? 'bg-[#282828] border-[#D6A21A]' : 'bg-[#181818] border-[#333333]'}`}>
                      <input
                        type="radio"
                        name="purchaseType"
                        checked={purchaseTypeChoice === 'cuenta_por_pagar'}
                        onChange={() => setPurchaseTypeChoice('cuenta_por_pagar')}
                        className="text-[#D6A21A]"
                      />
                      <div>
                        <span className="text-xs font-bold text-[#FFFDF5] block">Cuenta por Pagar</span>
                        <span className="text-[10px] text-[#a8a29e]">La mercancía ya fue recibida</span>
                      </div>
                    </label>

                    <label className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 ${purchaseTypeChoice === 'anticipo' ? 'bg-[#282828] border-[#D6A21A]' : 'bg-[#181818] border-[#333333]'}`}>
                      <input
                        type="radio"
                        name="purchaseType"
                        checked={purchaseTypeChoice === 'anticipo'}
                        onChange={() => setPurchaseTypeChoice('anticipo')}
                        className="text-[#D6A21A]"
                      />
                      <div>
                        <span className="text-xs font-bold text-[#FFFDF5] block">Anticipo a Proveedor</span>
                        <span className="text-[10px] text-[#a8a29e]">Mercancía pendiente de recibir</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* Resumen Final & Botón Guardar */}
          <div className="space-y-4">
            <div className="bg-[#181818] p-6 rounded-3xl border border-[#333333] shadow-xl space-y-4 sticky top-6">
              <h3 className="text-sm font-black text-[#FFFDF5] flex items-center gap-2 border-b border-[#333333] pb-3">
                <FileText className="w-4 h-4 text-[#D6A21A]" />
                <span>Resumen de la Compra</span>
              </h3>

              <div className="space-y-2 text-xs text-[#d6d3d1]">
                <div className="flex justify-between">
                  <span className="text-[#a8a29e]">Proveedor:</span>
                  <span className="font-bold text-[#FFFDF5]">{selectedSupplier ? selectedSupplier.name : <strong className="text-red-400">Sin seleccionar</strong>}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a8a29e]">Factura:</span>
                  <span className="font-bold text-[#D6A21A]">{documentNumber || 'S/N'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a8a29e]">Ítems en carrito:</span>
                  <span className="font-bold text-[#FFFDF5]">{cart.length} productos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a8a29e]">Total Comercial:</span>
                  <span className="font-bold text-emerald-400">{formatCOP(totalCart)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a8a29e]">Total Pagado:</span>
                  <span className="font-bold text-[#FFFDF5]">{formatCOP(totalPaid)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#333333] text-sm">
                  <span className="font-black text-[#FFFDF5]">Saldo Pendiente:</span>
                  <span className="font-black text-amber-300">{formatCOP(balanceDue)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExecuteSavePurchase}
                disabled={isProcessing || !selectedSupplier || !documentNumber.trim() || cart.length === 0}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs flex items-center justify-center gap-2 hover:brightness-110 shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Registrar Compra Definitiva</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: AGREGAR / EDITAR ÍTEM AL CARRITO   */}
      {/* ========================================== */}
      {activeItemModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#333333] rounded-3xl p-6 max-w-md w-full shadow-2xl text-[#FFFDF5] space-y-4">
            <div className="flex items-center justify-between border-b border-[#333333] pb-3">
              <h3 className="text-sm font-black text-[#D6A21A]">
                Agregar Artículo a la Compra
              </h3>
              <button
                type="button"
                onClick={() => setActiveItemModal(null)}
                className="text-[#a8a29e] hover:text-[#FFFDF5] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#242424] p-3 rounded-2xl border border-[#383838] space-y-1">
              <h4 className="text-xs font-black text-[#FFFDF5]">{activeItemModal.name}</h4>
              <span className="text-[10px] text-[#a8a29e] block">Categoría: {activeItemModal.category || 'General'} · Unidad: {activeItemModal.unit}</span>
              <span className="text-[10px] text-[#a8a29e] block">Stock Actual: <strong className="text-emerald-400">{activeItemModal.currentStock} {activeItemModal.unit}</strong></span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] text-[#a8a29e] uppercase font-bold mb-1">Cantidad a Comprar *</label>
                <input
                  type="number"
                  step="any"
                  min={0.01}
                  value={modalQty}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleQtyChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#242424] border border-[#383838] rounded-xl text-[#FFFDF5] font-bold focus:outline-none focus:border-[#D6A21A]"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[#a8a29e] uppercase font-bold mb-1">Costo Unitario ($)</label>
                <input
                  type="number"
                  min={0}
                  value={modalUnitCost}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUnitCostChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#242424] border border-[#383838] rounded-xl text-[#FFFDF5] font-bold focus:outline-none focus:border-[#D6A21A]"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[#a8a29e] uppercase font-bold mb-1">Costo Total de la Línea ($)</label>
                <input
                  type="number"
                  min={0}
                  value={modalTotalCost}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleTotalCostChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#242424] border border-[#383838] rounded-xl text-emerald-400 font-bold focus:outline-none focus:border-[#D6A21A]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveItemModal(null)}
                className="px-4 py-2.5 rounded-xl bg-[#242424] text-[#a8a29e] border border-[#383838] hover:bg-[#2e2e2e] font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddToCartConfirm}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs hover:brightness-110 shadow cursor-pointer"
              >
                Confirmar & Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: CREAR NUEVO ARTÍCULO DE INVENTARIO */}
      {/* ========================================== */}
      {showCreateItemModal && (
        <InventoryItemModal
          onClose={() => setShowCreateItemModal(false)}
          onSuccess={(newItemIds: string[]) => {
            setShowCreateItemModal(false);
            showToast('Artículo creado con éxito en inventario', 'success');
          }}
        />
      )}

      {/* ========================================== */}
      {/* OVERLAY DE PROCESAMIENTO / COLA DE OPERACIONES */}
      {/* ========================================== */}
      {isProcessing && !successResultId && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#333333] rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-4 text-[#FFFDF5]">
            <div className="w-16 h-16 rounded-2xl bg-amber-950/80 border border-amber-600/60 text-[#D6A21A] flex items-center justify-center mx-auto animate-spin">
              <Truck className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black tracking-wide">
              PROCESANDO COMPRA
            </h3>
            <p className="text-xs text-[#D6A21A] font-bold animate-pulse">
              {processingStep}
            </p>
            <p className="text-[10px] text-[#78716c]">
              Actualizando inventario, kardex, caja, comprobantes y cuentas por pagar de manera transaccional...
            </p>
          </div>
        </div>
      )}

    </div>
  );
};
