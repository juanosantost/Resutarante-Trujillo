import React, { useState, useMemo, useEffect } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Order, PaymentMethod, PaymentSplit, Payment, OrderItem } from '../../types';
import { formatCOP, splitBillEqually, getEffectiveTaxRate } from '../../utils/calculations';
import {
  calculateSelectedItemsTotals,
  getInitialSelectedItemIds,
  filterReceiptItems,
} from '../../utils/checkoutCalculations';
import { ReceiptModal } from './ReceiptModal';
import {
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Layers,
  Receipt,
  CheckCircle,
  Users,
  Plus,
  Trash2,
  Edit2,
  CheckSquare,
  Square,
  Printer,
  AlertCircle,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

interface CheckoutModalProps {
  order: Order;
  onClose: () => void;
  onPaymentComplete: (payment: Payment) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  order,
  onClose,
  onPaymentComplete,
}) => {
  const {
    closeAndPayOrder,
    updateOrderItems,
    activeShift,
    actionLoading,
    paymentMethods,
    currentBranch,
    products,
    menuItems,
  } = useRestaurant();

  // 1. Estado editable de los productos de la comanda
  const [items, setItems] = useState<OrderItem[]>(() => {
    return (order.items || []).map((it) => ({ ...it }));
  });

  // 2. Selección de ítems con checkbox (por defecto seleccionados los no pagados)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(() => {
    return getInitialSelectedItemIds(order.items || []);
  });

  // 3. Modal / formulario para agregar producto no registrado previamente
  const [showAddItemModal, setShowAddItemModal] = useState<boolean>(false);
  const [newProductName, setNewProductName] = useState<string>('');
  const [newProductPrice, setNewProductPrice] = useState<number>(10000);
  const [newProductQuantity, setNewProductQuantity] = useState<number>(1);
  const [newProductNotes, setNewProductNotes] = useState<string>('');
  const [catalogSearch, setCatalogSearch] = useState<string>('');

  // 4. Edición rápida inline de un ítem existente
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>('');

  // 5. Medios de pago y propinas
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [includeTip, setIncludeTip] = useState<boolean>(order.tip > 0);
  const [customTip, setCustomTip] = useState<number>(
    order.tip > 0 ? order.tip : Math.round(order.subtotal * 0.10)
  );
  const [customerName, setCustomerName] = useState<string>(order.customerName || '');
  const [customerNit, setCustomerNit] = useState<string>('222222222222'); // Consumidor final Colombia
  const [splitCount, setSplitCount] = useState<number>(1);
  const [isSplitting, setIsSplitting] = useState<boolean>(false);

  // 6. Previsualización / Impresión anticipada de tirilla POS con los ítems seleccionados
  const [previewReceiptPayment, setPreviewReceiptPayment] = useState<Payment | null>(null);

  // Totales dinámicos basados exclusivamente en los elementos seleccionados
  const taxRate = getEffectiveTaxRate(currentBranch);
  const totalsResult = useMemo(() => {
    return calculateSelectedItemsTotals(
      items,
      selectedItemIds,
      includeTip,
      customTip,
      taxRate
    );
  }, [items, selectedItemIds, includeTip, customTip, taxRate]);

  const tipAmount = totalsResult.tip;
  const grandTotal = totalsResult.total;

  // Actualizar propina sugerida cuando cambia la selección o el subtotal
  useEffect(() => {
    if (includeTip && !order.tip) {
      setCustomTip(Math.round(totalsResult.subtotal * 0.10));
    }
  }, [totalsResult.subtotal, includeTip, order.tip]);

  // Manejo de efectivo y pagos mixtos sincronizados con grandTotal
  const [cashReceived, setCashReceived] = useState<number>(grandTotal);
  const [splits, setSplits] = useState<PaymentSplit[]>([
    { method: 'efectivo', amount: Math.round(grandTotal / 2) },
    { method: 'tarjeta', amount: Math.round(grandTotal / 2) },
  ]);

  useEffect(() => {
    setCashReceived(grandTotal);
    setSplits([
      { method: 'efectivo', amount: Math.round(grandTotal / 2) },
      { method: 'tarjeta', amount: Math.round(grandTotal / 2) },
    ]);
  }, [grandTotal]);

  const change = Math.max(0, cashReceived - grandTotal);
  const splitAmounts = splitBillEqually(grandTotal, splitCount);

  // Helpers de selección
  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedItemIds(items.map((it) => it.id));
  };

  const handleSelectUnpaidOnly = () => {
    setSelectedItemIds(items.filter((it) => !it.paid).map((it) => it.id));
  };

  const handleDeselectAll = () => {
    setSelectedItemIds([]);
  };

  // Modificación de cantidades
  const handleQuantityChange = (itemId: string, delta: number) => {
    setItems((prev) => {
      const updated = prev
        .map((it) => {
          if (it.id === itemId) {
            const nextQty = it.quantity + delta;
            return nextQty > 0 ? { ...it, quantity: nextQty } : null;
          }
          return it;
        })
        .filter(Boolean) as OrderItem[];
      return updated;
    });
  };

  const handleDeleteItem = (itemId: string) => {
    if (window.confirm('¿Deseas quitar este producto de la cuenta a cobrar?')) {
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
    }
  };

  const handleStartEditItem = (item: OrderItem) => {
    setEditingItemId(item.id);
    setEditPrice(item.price);
    setEditNotes(item.notes || '');
  };

  const handleSaveEditItem = () => {
    if (!editingItemId) return;
    setItems((prev) =>
      prev.map((it) =>
        it.id === editingItemId
          ? { ...it, price: Math.max(0, editPrice), notes: editNotes.trim() }
          : it
      )
    );
    setEditingItemId(null);
  };

  // Agregar un producto adicional (ej: entregado pero omitido en registro)
  const handleAddDeliveredProduct = () => {
    if (!newProductName.trim() || newProductPrice <= 0 || newProductQuantity <= 0) return;

    const newItemId = `item-deliv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newItem: OrderItem = {
      id: newItemId,
      menuItemId: `custom-${Date.now()}`,
      name: newProductName.trim(),
      price: newProductPrice,
      quantity: newProductQuantity,
      station: 'cocina_caliente',
      roundNumber: order.currentRound || 1,
      sentToKitchen: true,
      notes: newProductNotes.trim() || 'Entregado en mesa / Adición en cobro',
      paid: false,
    };

    setItems((prev) => [...prev, newItem]);
    // Seleccionar automáticamente el ítem recién agregado
    setSelectedItemIds((prev) => [...prev, newItemId]);

    // Resetear formulario
    setNewProductName('');
    setNewProductPrice(10000);
    setNewProductQuantity(1);
    setNewProductNotes('');
    setCatalogSearch('');
    setShowAddItemModal(false);
  };

  // Autocompletar desde el catálogo al seleccionar un producto sugerido
  const catalogSuggestions = useMemo(() => {
    const list = [...(products || []), ...(menuItems || [])];
    if (!catalogSearch.trim()) return list.slice(0, 6);
    const q = catalogSearch.toLowerCase();
    return list
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [products, menuItems, catalogSearch]);

  const handleSelectFromCatalog = (prod: any) => {
    setNewProductName(prod.name);
    setNewProductPrice(prod.price || 0);
  };

  // Generar objeto Payment de previsualización para imprimir tirilla POS de los ítems seleccionados
  const handlePreviewReceipt = () => {
    const now = new Date().toISOString();
    const previewPayment: Payment = {
      id: `preview-${Date.now()}`,
      branchId: order.branchId || currentBranch?.id || '',
      orderId: order.id,
      orderNumber: order.orderNumber,
      shiftId: activeShift ? activeShift.id : 'turno-actual',
      method: paymentMethod,
      amountPaid: paymentMethod === 'efectivo' ? cashReceived : grandTotal,
      subtotal: totalsResult.subtotal,
      tax: totalsResult.tax,
      tipAmount,
      total: grandTotal,
      change,
      cashierId: activeShift?.cashierId || 'usr-cajero',
      cashierName: activeShift?.cashierName || 'Cajero Colmena',
      customerName: customerName.trim() || order.customerName,
      customerNitOrCedula: customerNit.trim() || '222222222222',
      createdAt: now,
      branchSnapshot: order.branchSnapshot || (currentBranch ? {
        branchId: currentBranch.id,
        name: currentBranch.name,
        nit: currentBranch.nit,
        address: currentBranch.address,
        phone: currentBranch.phone,
        printConfig: currentBranch.printConfig || {
          showLogo: true,
          showTradeName: true,
          showNit: true,
          showAddress: true,
          showPhone: true,
          paperWidth: '80mm',
        },
        resolutionDian: currentBranch.receiptConfig?.resolutionDian || '',
        prefix: currentBranch.receiptConfig?.prefix || 'FAC-',
        footerText: currentBranch.receiptConfig?.footerText || '¡Gracias por su visita a Colmena!',
      } : undefined),
      items: totalsResult.selectedItems,
      selectedItemIds,
    };
    setPreviewReceiptPayment(previewPayment);
  };

  const handlePay = async () => {
    if (actionLoading || selectedItemIds.length === 0) return;

    try {
      const payment = await closeAndPayOrder({
        orderId: order.id,
        method: paymentMethod,
        splits: paymentMethod === 'mixto' ? splits : undefined,
        amountPaid: paymentMethod === 'efectivo' ? cashReceived : grandTotal,
        tipAmount,
        customerName: customerName.trim() || undefined,
        customerNitOrCedula: customerNit.trim() || undefined,
        selectedItemIds,
        updatedItems: items,
      });

      onPaymentComplete(payment);
    } catch (err) {
      console.error('Error completing payment:', err);
    }
  };

  const methodsList: { id: PaymentMethod; label: string; icon: any; desc: string }[] = useMemo(() => {
    const active = paymentMethods.filter((p) => p.isActive);
    if (active.length === 0) {
      return [
        { id: 'efectivo', label: 'Efectivo', icon: Banknote, desc: 'Cálculo de cambio/vueltas' },
        { id: 'tarjeta', label: 'Tarjeta / Datáfono', icon: CreditCard, desc: 'Crédito o Débito' },
        { id: 'nequi_daviplata', label: 'Nequi / Daviplata', icon: Smartphone, desc: 'Transferencia móvil inmediata' },
        { id: 'mixto', label: 'Pago Mixto', icon: Layers, desc: 'Dividir métodos de pago' },
      ];
    }
    const mapped = active.map((p) => {
      let icon = CreditCard;
      if (p.category === 'efectivo') icon = Banknote;
      else if (p.category === 'billetera_digital') icon = Smartphone;
      return {
        id: (p.name.toLowerCase().replace(/\s+/g, '_')) as PaymentMethod,
        label: p.name,
        icon,
        desc: p.description || (p.isCashType ? 'Efectivo en caja' : p.bankName ? `Canal ${p.bankName}` : 'Medio habilitado'),
      };
    });
    return [...mapped, { id: 'mixto' as PaymentMethod, label: 'Pago Mixto', icon: Layers, desc: 'Dividir métodos de pago' }];
  }, [paymentMethods]);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
        <div className="bg-[#121117] border border-[#3f3521] rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl text-[#faf5ee]">
          
          {/* Cabecera */}
          <div className="px-5 py-4 border-b border-[#2d281e] flex items-center justify-between bg-gradient-to-r from-[#1a1722] to-[#121117]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#8c711a] flex items-center justify-center text-[#0e0e12] font-black shadow-md">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-[#fef3c7]">
                    Cobro, Facturación & Selección de Ítems
                  </h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#2b2416] text-[#d4af37] border border-[#d4af37]/40">
                    {order.tableName || `Pedido #${order.orderNumber}`}
                  </span>
                </div>
                <p className="text-xs text-[#a8a29e]">
                  {activeShift ? `Turno activo de ${activeShift.cashierName}` : 'Sin turno de caja abierto'} · {items.length} productos en comanda
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePreviewReceipt}
                disabled={selectedItemIds.length === 0}
                className="px-3 py-1.5 rounded-xl bg-[#1c1a24] border border-[#d4af37]/40 text-[#d4af37] hover:bg-[#2b2416] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                title="Imprimir factura o tirilla POS previa solo con los elementos seleccionados"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Tirilla POS Selección</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#a8a29e] hover:text-[#fef3c7] hover:bg-[#201e28] cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Contenido Principal */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
            
            {/* SECCIÓN 1: ELEMENTOS PEDIDOS, EDICIÓN Y CHECKBOX DE COBRO */}
            <div className="bg-[#18171f] p-4 rounded-xl border border-[#2d281e] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2d281e] pb-2.5">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4af37] flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4" />
                    <span>Elementos de la Cuenta para Cobro ({selectedItemIds.length} seleccionados de {items.length})</span>
                  </h3>
                  <p className="text-[11px] text-[#a8a29e]">
                    Marca los ítems a facturar en esta transacción. Los ya pagados aparecen tachados y los nuevos pueden agregarse o editarse.
                  </p>
                </div>

                {/* Acciones de Selección y Agregar Producto */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-2 py-1 rounded bg-[#121117] border border-[#383124] text-[10px] font-semibold text-[#a8a29e] hover:text-[#d4af37] cursor-pointer"
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectUnpaidOnly}
                    className="px-2 py-1 rounded bg-[#2b2416] border border-[#d4af37]/30 text-[10px] font-bold text-[#d4af37] hover:bg-[#3d321d] cursor-pointer"
                  >
                    Solo Pendientes
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="px-2 py-1 rounded bg-[#121117] border border-[#383124] text-[10px] font-semibold text-[#a8a29e] hover:text-red-400 cursor-pointer"
                  >
                    Ninguno
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddItemModal(true)}
                    className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] text-[11px] font-black flex items-center gap-1 hover:brightness-110 shadow cursor-pointer ml-1"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>+ Agregar Ítem Entregado</span>
                  </button>
                </div>
              </div>

              {/* Lista Detallada de Productos con Checkbox Izquierdo */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#78716c] italic border border-dashed border-[#383124] rounded-lg">
                    No hay productos en esta cuenta. Haz clic en "+ Agregar Ítem Entregado" para registrar consumos.
                  </div>
                ) : (
                  items.map((item) => {
                    const isChecked = selectedItemIds.includes(item.id);
                    const isPaid = Boolean(item.paid);

                    return (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                          isPaid
                            ? 'bg-[#14121a]/60 border-[#332a1e] text-[#8c8270]'
                            : isChecked
                            ? 'bg-[#1e1b26] border-[#d4af37]/60 shadow-sm'
                            : 'bg-[#14131a] border-[#2d281e] opacity-75'
                        }`}
                      >
                        {/* Checkbox y Nombre */}
                        <div className="flex items-start sm:items-center gap-2.5 flex-1 min-w-0">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectItem(item.id)}
                              className="w-4 h-4 rounded accent-[#d4af37] cursor-pointer mt-0.5 sm:mt-0"
                            />
                          </label>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-xs font-bold truncate ${
                                  isPaid ? 'line-through text-[#8c8270] decoration-[#d4af37]/80' : 'text-[#fef3c7]'
                                }`}
                              >
                                {item.name}
                              </span>

                              {isPaid && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-[#2b2416] text-[#d4af37] border border-[#d4af37]/40 tracking-wider">
                                  ✓ Ya Pagado
                                </span>
                              )}

                              <span className="text-[10px] text-[#78716c]">
                                {formatCOP(item.price)} c/u
                              </span>
                            </div>

                            {item.notes && (
                              <p className="text-[10px] text-[#a8a29e] italic truncate">
                                Nota: {item.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Modificación de Cantidad, Edición y Subtotal */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          
                          {/* Selector de Cantidad */}
                          <div className="flex items-center gap-1 bg-[#121117] border border-[#383124] rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.id, -1)}
                              disabled={isPaid}
                              className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold text-[#a8a29e] hover:text-[#fef3c7] hover:bg-[#201e28] disabled:opacity-30 cursor-pointer"
                              title="Reducir cantidad"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-xs font-mono font-bold text-[#fef3c7]">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.id, 1)}
                              disabled={isPaid}
                              className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold text-[#a8a29e] hover:text-[#fef3c7] hover:bg-[#201e28] disabled:opacity-30 cursor-pointer"
                              title="Aumentar cantidad"
                            >
                              +
                            </button>
                          </div>

                          {/* Subtotal del ítem */}
                          <span
                            className={`w-24 text-right font-mono text-xs font-bold ${
                              isPaid
                                ? 'line-through text-[#8c8270] decoration-[#d4af37]/80'
                                : isChecked
                                ? 'text-[#d4af37]'
                                : 'text-[#a8a29e]'
                            }`}
                          >
                            {formatCOP(item.price * item.quantity)}
                          </span>

                          {/* Botón Editar Precio / Notas */}
                          <button
                            type="button"
                            onClick={() => handleStartEditItem(item)}
                            className="p-1 text-[#a8a29e] hover:text-[#d4af37] rounded hover:bg-[#201e28] cursor-pointer"
                            title="Editar precio o detalles"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Botón Borrar Ítem */}
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1 text-[#a8a29e] hover:text-red-400 rounded hover:bg-[#201e28] cursor-pointer"
                            title="Eliminar de la cuenta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Notificación si no hay ítems seleccionados */}
              {selectedItemIds.length === 0 && (
                <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Ningún producto seleccionado. Marca al menos un elemento con el checkbox para calcular el total a cobrar.</span>
                </div>
              )}
            </div>

            {/* SECCIÓN 2: LIQUIDACIÓN Y TOTALES DINÁMICOS */}
            <div className="bg-[#18171f] p-4 rounded-xl border border-[#2d281e] grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Resumen de Selección */}
              <div className="space-y-2 text-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-[#a8a29e] block">
                  Resumen de Facturación ({totalsResult.selectedItems.length} ítems)
                </span>
                
                <div className="bg-[#121117] p-3 rounded-lg border border-[#2d281e] space-y-1.5 text-xs">
                  <div className="flex justify-between text-[#a8a29e]">
                    <span>Subtotal Selección:</span>
                    <span className="font-semibold text-[#fef3c7]">{formatCOP(totalsResult.subtotal)}</span>
                  </div>
                  {taxRate > 0 ? (
                    <div className="flex justify-between text-[#a8a29e]">
                      <span>Impoconsumo ({Math.round(taxRate * 100)}%):</span>
                      <span className="font-semibold text-[#fef3c7]">{formatCOP(totalsResult.tax)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-[#78716c] text-[11px]">
                      <span>Impoconsumo:</span>
                      <span className="font-mono text-[#a8a29e]">Desactivado en Sede ($0)</span>
                    </div>
                  )}

                  {/* Propina Voluntaria */}
                  <div className="pt-2 border-t border-[#2d281e]">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[#d4af37] font-semibold">
                        <input
                          type="checkbox"
                          checked={includeTip}
                          onChange={(e) => setIncludeTip(e.target.checked)}
                          className="accent-[#d4af37]"
                        />
                        <span>Propina Voluntaria (10%):</span>
                      </label>
                      <span className="font-bold text-[#d4af37]">{formatCOP(tipAmount)}</span>
                    </div>

                    {includeTip && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCustomTip(Math.round(totalsResult.subtotal * 0.10))}
                          className="px-2 py-0.5 rounded bg-[#2b2416] text-[10px] text-[#d4af37] hover:bg-[#3d331f]"
                        >
                          10% Sugerido
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomTip(Math.round(totalsResult.subtotal * 0.15))}
                          className="px-2 py-0.5 rounded bg-[#2b2416] text-[10px] text-[#d4af37] hover:bg-[#3d331f]"
                        >
                          15% Extra
                        </button>
                        <input
                          type="number"
                          aria-label="Monto de propina personalizado"
                          value={customTip}
                          onChange={(e) => setCustomTip(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-24 bg-[#18171f] border border-[#383124] rounded px-2 py-0.5 text-right text-xs font-mono text-[#fef3c7]"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Total a Cobrar Destacado */}
              <div className="bg-[#121117] p-4 rounded-xl border border-[#383124] flex flex-col justify-between space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] uppercase font-bold text-[#a8a29e] block">
                      Total a Cobrar por Ítems Seleccionados
                    </span>
                    <span className="text-[10px] text-[#78716c]">
                      {totalsResult.selectedItems.length === items.length
                        ? 'Cuenta completa seleccionada'
                        : `Cobro parcial (${totalsResult.selectedItems.length} de ${items.length} productos)`}
                    </span>
                  </div>
                  <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#fef3c7] via-[#d4af37] to-[#e6ca65]">
                    {formatCOP(grandTotal)}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-[#18171f] border border-[#2d281e] flex items-center justify-between text-xs">
                  <span className="text-[#a8a29e]">Ítems ya pagados previamente:</span>
                  <span className="font-bold text-[#d4af37]">{totalsResult.paidItemsCount}</span>
                </div>
              </div>

            </div>

            {/* SECCIÓN 3: FORMA DE PAGO */}
            <div>
              <label className="block text-xs font-semibold text-[#a8a29e] mb-2 uppercase">
                Forma de Pago para los Ítems Seleccionados
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {methodsList.map((m) => {
                  const Icon = m.icon;
                  const isSelected = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#2b2416] border-[#d4af37] shadow-lg shadow-[#d4af37]/10'
                          : 'bg-[#18171f] border-[#2d281e] hover:border-[#383124]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-[#d4af37]' : 'text-[#78716c]'}`} />
                        {isSelected && <CheckCircle className="w-3.5 h-3.5 text-[#d4af37]" />}
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-[#fef3c7]">{m.label}</span>
                        <span className="block text-[10px] text-[#a8a29e]">{m.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Opciones Específicas por Método */}
            {paymentMethod === 'efectivo' && (
              <div className="bg-[#18171f] p-4 rounded-xl border border-[#2d281e] grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#d4af37] mb-1">
                    Efectivo Recibido (COP):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm font-bold text-[#a8a29e]">$</span>
                    <input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#121117] border border-[#383124] rounded-lg pl-7 pr-3 py-2 text-sm font-bold text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    {[20000, 50000, 100000].map((bill) => (
                      <button
                        key={bill}
                        type="button"
                        onClick={() => setCashReceived(bill)}
                        className="px-2 py-1 bg-[#121117] border border-[#383124] rounded text-[10px] font-semibold text-[#a8a29e] hover:text-[#d4af37] cursor-pointer"
                      >
                        ${bill / 1000}k
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCashReceived(grandTotal)}
                      className="px-2 py-1 bg-[#2b2416] border border-[#d4af37]/40 rounded text-[10px] font-bold text-[#d4af37] cursor-pointer"
                    >
                      Exacto ({formatCOP(grandTotal)})
                    </button>
                  </div>
                </div>

                <div className="bg-[#121117] p-3 rounded-xl border border-[#383124] flex flex-col justify-center text-center">
                  <span className="text-xs uppercase font-bold text-[#a8a29e]">Cambio / Vueltas a Entregar</span>
                  <span className={`text-xl font-black mt-1 ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCOP(change)}
                  </span>
                  {change < 0 && (
                    <span className="text-[10px] text-red-400 mt-1">Faltan fondos por recibir</span>
                  )}
                </div>
              </div>
            )}

            {paymentMethod === 'mixto' && (
              <div className="bg-[#18171f] p-4 rounded-xl border border-[#2d281e] space-y-3">
                <span className="text-xs font-bold text-[#d4af37] block">
                  Distribución de Montos Mixtos (Total: {formatCOP(grandTotal)}):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#a8a29e] mb-1">Parte en Efectivo (COP):</label>
                    <input
                      type="number"
                      value={splits[0].amount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setSplits([
                          { method: 'efectivo', amount: val },
                          { method: 'tarjeta', amount: Math.max(0, grandTotal - val) },
                        ]);
                      }}
                      className="w-full bg-[#121117] border border-[#383124] rounded-lg px-3 py-1.5 text-xs text-[#fef3c7]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#a8a29e] mb-1">Parte en Tarjeta / Datáfono (COP):</label>
                    <input
                      type="number"
                      value={splits[1].amount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setSplits([
                          { method: 'efectivo', amount: Math.max(0, grandTotal - val) },
                          { method: 'tarjeta', amount: val },
                        ]);
                      }}
                      className="w-full bg-[#121117] border border-[#383124] rounded-lg px-3 py-1.5 text-xs text-[#fef3c7]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECCIÓN 4: DATOS DE FACTURACIÓN */}
            <div className="bg-[#18171f] p-3 rounded-xl border border-[#2d281e] grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[#a8a29e] mb-1">Nombre en Factura POS</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Consumidor Final o Nombre Cliente"
                  className="w-full bg-[#121117] border border-[#383124] rounded-lg px-3 py-1.5 text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#a8a29e] mb-1">Cédula o NIT</label>
                <input
                  type="text"
                  value={customerNit}
                  onChange={(e) => setCustomerNit(e.target.value)}
                  placeholder="222222222222"
                  className="w-full bg-[#121117] border border-[#383124] rounded-lg px-3 py-1.5 text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                />
              </div>
            </div>

          </div>

          {/* Footer de Acciones */}
          <div className="px-5 py-4 border-t border-[#2d281e] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#14131a]">
            <div className="text-xs text-[#a8a29e]">
              {selectedItemIds.length === items.length
                ? order.tableId
                  ? 'La mesa quedará libre al cobrar la totalidad de los ítems'
                  : 'El pedido quedará completamente facturado'
                : `Cobro parcial (${selectedItemIds.length}/${items.length} ítems): La cuenta permanecerá abierta con el saldo restante`}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#383124] text-xs font-semibold text-[#a8a29e] hover:bg-[#1a1922] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePay}
                disabled={
                  actionLoading ||
                  selectedItemIds.length === 0 ||
                  (paymentMethod === 'efectivo' && cashReceived < grandTotal)
                }
                className={`px-6 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  actionLoading ||
                  selectedItemIds.length === 0 ||
                  (paymentMethod === 'efectivo' && cashReceived < grandTotal)
                    ? 'bg-[#2a2213] text-[#78716c] cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#d4af37] via-[#c49f2b] to-[#a68218] text-[#0e0e12] hover:brightness-110 shadow-lg shadow-[#d4af37]/25'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>
                  {actionLoading
                    ? 'Procesando...'
                    : selectedItemIds.length === 0
                    ? 'Selecciona ítems para cobrar'
                    : `Cobrar ${formatCOP(grandTotal)} (${selectedItemIds.length} ítems)`}
                </span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* MODAL: AGREGAR PRODUCTO ENTREGADO / NO REGISTRADO */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16151f] border border-[#d4af37]/50 rounded-2xl w-full max-w-md p-5 text-[#faf5ee] shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#2d281e] pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#d4af37]" />
                <h3 className="font-bold text-sm text-[#fef3c7]">
                  Agregar Producto Entregado al Cliente
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddItemModal(false)}
                className="p-1 text-[#a8a29e] hover:text-[#fef3c7] rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#a8a29e]">
              Añade un producto o consumo que se le entregó al cliente pero no se registró en la comanda inicial.
            </p>

            {/* Búsqueda rápida en catálogo */}
            <div>
              <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">
                Buscar en Catálogo o Menú:
              </label>
              <input
                type="text"
                placeholder="Escribe para autocompletar..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full bg-[#121117] border border-[#383124] rounded-lg px-3 py-1.5 text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
              />
              {catalogSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {catalogSuggestions.map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleSelectFromCatalog(prod)}
                      className="text-[10px] px-2 py-0.5 rounded bg-[#252016] text-[#d4af37] border border-[#d4af37]/30 hover:bg-[#3d321d] cursor-pointer"
                    >
                      {prod.name} ({formatCOP(prod.price)})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Campos del producto */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">
                  Nombre del Producto / Consumo:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Cerveza adicional, postre, adición..."
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full bg-[#121117] border border-[#383124] rounded-lg px-3 py-2 text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">
                    Precio Unitario (COP):
                  </label>
                  <input
                    type="number"
                    value={newProductPrice}
                    onChange={(e) => setNewProductPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-[#121117] border border-[#383124] rounded-lg px-3 py-2 text-xs font-bold text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">
                    Cantidad:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newProductQuantity}
                    onChange={(e) => setNewProductQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-[#121117] border border-[#383124] rounded-lg px-3 py-2 text-xs font-bold text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">
                  Observación o Motivo:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Entregado en mesa, adición de último momento"
                  value={newProductNotes}
                  onChange={(e) => setNewProductNotes(e.target.value)}
                  className="w-full bg-[#121117] border border-[#383124] rounded-lg px-3 py-2 text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#2d281e]">
              <button
                type="button"
                onClick={() => setShowAddItemModal(false)}
                className="px-4 py-2 rounded-xl border border-[#383124] text-xs font-semibold text-[#a8a29e] hover:bg-[#201e28] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddDeliveredProduct}
                disabled={!newProductName.trim() || newProductPrice <= 0}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs hover:brightness-110 disabled:opacity-40 cursor-pointer"
              >
                Agregar a la Cuenta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR ÍTEM ESPECÍFICO */}
      {editingItemId && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16151f] border border-[#d4af37]/50 rounded-2xl w-full max-w-sm p-5 text-[#faf5ee] shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#2d281e] pb-2">
              <h3 className="font-bold text-sm text-[#fef3c7] flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-[#d4af37]" />
                <span>Editar Precio y Detalles</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingItemId(null)}
                className="p-1 text-[#a8a29e] hover:text-[#fef3c7] rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">
                  Precio Unitario (COP):
                </label>
                <input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-[#121117] border border-[#383124] rounded-lg px-3 py-2 text-sm font-bold text-[#fef3c7]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">
                  Nota o Concepto:
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Detalle o modificación..."
                  className="w-full bg-[#121117] border border-[#383124] rounded-lg px-3 py-2 text-xs text-[#fef3c7]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#2d281e]">
              <button
                type="button"
                onClick={() => setEditingItemId(null)}
                className="px-3 py-1.5 rounded-xl border border-[#383124] text-xs font-semibold text-[#a8a29e]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditItem}
                className="px-4 py-1.5 rounded-xl bg-[#d4af37] text-[#0e0e12] font-black text-xs hover:brightness-110"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW / IMPRESIÓN TIRILLA POS DE LA SELECCIÓN */}
      {previewReceiptPayment && (
        <ReceiptModal
          payment={previewReceiptPayment}
          order={order}
          onClose={() => setPreviewReceiptPayment(null)}
        />
      )}
    </>
  );
};
