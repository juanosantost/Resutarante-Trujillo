import React, { useState, useMemo, useEffect } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import { Order, PaymentMethod, PaymentSplit, Payment, OrderItem } from '../../types';
import { formatCOP, splitBillEqually, getEffectiveTaxRate } from '../../utils/calculations';
import {
  calculateSelectedItemsTotals,
  getInitialSelectedItemIds,
  filterReceiptItems,
  expandOrderItemsToSingleUnits,
  formatOrderItemModifiersSummary,
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
  BookmarkCheck,
  Calendar,
  Phone,
  User,
  ShieldAlert,
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
    sendOrderToCartera,
    updateOrderItems,
    activeShift,
    actionLoading,
    paymentMethods,
    currentBranch,
    products,
    menuItems,
    customers,
  } = useRestaurant();
  const { showToast } = useToast();

  // 1. Estado editable de los productos de la comanda (desagrupados en unidades de 1 para cobro individual)
  const [items, setItems] = useState<OrderItem[]>(() => {
    return expandOrderItemsToSingleUnits(order.items || []);
  });

  // 2. Selección de ítems con checkbox (por defecto seleccionados los no pagados)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(() => {
    return getInitialSelectedItemIds(expandOrderItemsToSingleUnits(order.items || []));
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
  const [customerNit, setCustomerNit] = useState<string>(order.customerDocument || '222222222222'); // Consumidor final Colombia
  const [splitCount, setSplitCount] = useState<number>(1);
  const [isSplitting, setIsSplitting] = useState<boolean>(false);

  // 6. Previsualización / Impresión anticipada de tirilla POS con los ítems seleccionados
  const [previewReceiptPayment, setPreviewReceiptPayment] = useState<Payment | null>(null);

  // 7. Modal de Confirmación para Enviar Pedido a Cartera
  const [showConfirmCarteraModal, setShowConfirmCarteraModal] = useState<boolean>(false);
  const [carteraCustomerId, setCarteraCustomerId] = useState<string>(order.customerId || '');
  const [carteraCustomerName, setCarteraCustomerName] = useState<string>(
    order.customerName && order.customerName !== 'Cliente General' ? order.customerName : ''
  );
  const [carteraCustomerDoc, setCarteraCustomerDoc] = useState<string>(order.customerDocument || '');
  const [carteraCustomerPhone, setCarteraCustomerPhone] = useState<string>(order.customerPhone || '');
  const [carteraDueDate, setCarteraDueDate] = useState<string>(() => {
    return new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0];
  });
  const [carteraNotes, setCarteraNotes] = useState<string>(
    order.fromSeparadoCode
      ? `Saldo pendiente de Pedido #${order.orderNumber} (Separado #${order.fromSeparadoCode})`
      : `Saldo pendiente de Pedido #${order.orderNumber}`
  );
  const [carteraError, setCarteraError] = useState<string>('');

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
  const grossSelectedTotal = totalsResult.total;
  const orderAdvanceAmount = Math.max(0, order.advanceAmount || 0);
  const advanceApplied = Math.min(grossSelectedTotal, orderAdvanceAmount);
  const grandTotal = Math.max(0, grossSelectedTotal - advanceApplied);

  // Saldo pendiente total de los ítems no pagados de la orden (para envío a Cartera)
  const unpaidItemsTotals = useMemo(() => {
    const unpaid = items.filter((it) => !it.paid);
    const sub = unpaid.reduce((acc, it) => acc + it.price * it.quantity, 0);
    const tx = Math.round(sub * taxRate);
    const gross = sub + tx + (includeTip ? tipAmount : 0);
    const adv = Math.min(gross, orderAdvanceAmount);
    const netPending = Math.max(0, gross - adv);
    return {
      unpaidCount: unpaid.length,
      grossTotal: gross,
      advanceDeducted: adv,
      netPending,
    };
  }, [items, taxRate, includeTip, tipAmount, orderAdvanceAmount]);

  // Actualizar propina sugerida cuando cambia la selección o el subtotal
  useEffect(() => {
    if (includeTip && !order.tip) {
      setCustomTip(Math.round(totalsResult.subtotal * 0.10));
    }
  }, [totalsResult.subtotal, includeTip, order.tip]);

  // Manejo de efectivo y pagos mixtos sincronizados con grandTotal
  const [cashReceived, setCashReceived] = useState<number>(grandTotal);
  const [splits, setSplits] = useState<PaymentSplit[]>(() => {
    const half = Math.floor(grandTotal / 2);
    return [
      { method: 'efectivo', amount: half },
      { method: 'nequi_daviplata', amount: Math.max(0, grandTotal - half) },
    ];
  });

  useEffect(() => {
    setCashReceived(grandTotal);
    setSplits((prev) => {
      const m0 = prev[0]?.method || 'efectivo';
      const m1 = prev[1]?.method || 'nequi_daviplata';
      const half = Math.floor(grandTotal / 2);
      if (prev.length <= 2) {
        return [
          { method: m0, amount: half },
          { method: m1, amount: Math.max(0, grandTotal - half) },
        ];
      }
      // Si hay 3 o más medios, ajustar el último con el saldo restante
      const othersSum = prev.slice(0, -1).reduce((sum, s) => sum + (s.amount || 0), 0);
      return prev.map((s, idx) =>
        idx === prev.length - 1 ? { ...s, amount: Math.max(0, grandTotal - othersSum) } : s
      );
    });
  }, [grandTotal]);

  const splitsTotal = useMemo(
    () => splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
    [splits]
  );
  const splitsDifference = grandTotal - splitsTotal;

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

  // Modificación de cantidades (al incrementar, crea una unidad separada para mantener el cobro individual)
  const handleQuantityChange = (itemId: string, delta: number) => {
    if (delta > 0) {
      const target = items.find((it) => it.id === itemId);
      if (!target) return;
      const newCloneId = `${target.id}-extra-${Date.now()}-${Math.random().toString(36).substr(2, 3)}`;
      const clonedItem: OrderItem = {
        ...target,
        id: newCloneId,
        quantity: 1,
        paid: false,
        paidAt: undefined,
        paidPaymentId: undefined,
      };
      setItems((prev) => {
        const idx = prev.findIndex((it) => it.id === itemId);
        if (idx === -1) return [...prev, clonedItem];
        const next = [...prev];
        next.splice(idx + 1, 0, clonedItem);
        return next;
      });
      setSelectedItemIds((prev) => [...prev, newCloneId]);
      return;
    }

    // Si delta < 0 y la cantidad es 1, remover esa unidad individual
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
    setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
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

  // Agregar un producto adicional (ej: entregado pero omitido en registro), separado en unidades individuales
  const handleAddDeliveredProduct = () => {
    if (!newProductName.trim() || newProductPrice <= 0 || newProductQuantity <= 0) return;

    const qty = Math.max(1, Math.round(newProductQuantity));
    const baseTimestamp = Date.now();
    const newUnits: OrderItem[] = [];

    for (let i = 0; i < qty; i++) {
      const newItemId = `item-deliv-${baseTimestamp}-${i + 1}-${Math.random().toString(36).substr(2, 4)}`;
      newUnits.push({
        id: newItemId,
        menuItemId: `custom-${baseTimestamp}`,
        name: newProductName.trim(),
        price: newProductPrice,
        quantity: 1,
        station: 'cocina_caliente',
        roundNumber: order.currentRound || 1,
        sentToKitchen: true,
        notes: newProductNotes.trim() || 'Entregado en mesa / Adición en cobro',
        paid: false,
      });
    }

    setItems((prev) => [...prev, ...newUnits]);
    // Seleccionar automáticamente los ítems recién agregados
    setSelectedItemIds((prev) => [...prev, ...newUnits.map((u) => u.id)]);

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
      splits: paymentMethod === 'mixto' ? splits.filter((s) => s.amount > 0) : undefined,
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

  // Abrir modal de confirmación para enviar el pedido con su saldo pendiente a Cartera
  const handleOpenConfirmCartera = () => {
    setCarteraError('');
    setCarteraCustomerName(
      (prev) => prev.trim() || (customerName && customerName !== 'Cliente General' ? customerName : order.customerName || '')
    );
    setCarteraCustomerDoc(
      (prev) => prev.trim() || (customerNit && customerNit !== '222222222222' ? customerNit : order.customerDocument || '')
    );
    setCarteraCustomerPhone((prev) => prev.trim() || order.customerPhone || '');
    setShowConfirmCarteraModal(true);
  };

  // Confirmar y ejecutar el envío del pedido a Cartera
  const handleConfirmSendToCartera = async () => {
    if (actionLoading) return;
    setCarteraError('');

    const finalCustName = carteraCustomerName.trim() || customerName.trim() || order.customerName || '';
    if (!finalCustName) {
      setCarteraError('Por favor ingresa o selecciona el nombre del cliente para registrar la cuenta en Cartera.');
      return;
    }

    try {
      const createdCartera = await sendOrderToCartera({
        orderId: order.id,
        customerId: carteraCustomerId || order.customerId || undefined,
        customerName: finalCustName,
        customerPhone: carteraCustomerPhone.trim() || order.customerPhone || '',
        customerDocument: carteraCustomerDoc.trim() || customerNit.trim() || order.customerDocument || '222222222222',
        customerAddress: order.customerAddress || '',
        dueDate: carteraDueDate || new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
        notes: carteraNotes.trim() || undefined,
        updatedItems: items,
        tipAmount: includeTip ? tipAmount : 0,
      });

      setShowConfirmCarteraModal(false);
      showToast(
        `¡Pedido #${order.orderNumber} enviado a Cartera (${createdCartera.code}) con saldo pendiente de ${formatCOP(
          createdCartera.balanceDue
        )}!`,
        'success'
      );
      onClose();
    } catch (err: any) {
      console.error('Error sending order to cartera:', err);
      setCarteraError(err.message || 'Error al enviar el pedido a cartera.');
    }
  };

  const methodsList: { id: PaymentMethod; label: string; icon: any; desc: string }[] = useMemo(() => {
    const active = paymentMethods.filter((p) => p.isActive);
    if (active.length === 0) {
      return [
        { id: 'efectivo', label: 'Efectivo', icon: Banknote, desc: 'Cálculo de cambio/vueltas' },
        { id: 'tarjeta', label: 'Tarjeta / Datáfono', icon: CreditCard, desc: 'Crédito o Débito' },
        { id: 'nequi_daviplata', label: 'Nequi / Daviplata', icon: Smartphone, desc: 'Transferencia móvil inmediata' },
        { id: 'transferencia', label: 'Transferencia Bancaria', icon: CreditCard, desc: 'Bancolombia / PSE' },
        { id: 'mixto', label: 'Pago Mixto', icon: Layers, desc: 'Combinar medios de pago' },
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
    return [...mapped, { id: 'mixto' as PaymentMethod, label: 'Pago Mixto', icon: Layers, desc: 'Combinar medios de pago' }];
  }, [paymentMethods]);

  // Opciones disponibles para elegir dentro de cada línea del Pago Mixto
  const selectableSplitMethods: { id: PaymentMethod; label: string }[] = useMemo(() => {
    const fromActive = methodsList.filter((m) => m.id !== 'mixto').map((m) => ({ id: m.id, label: m.label }));
    const standardDefaults: { id: PaymentMethod; label: string }[] = [
      { id: 'efectivo', label: 'Efectivo' },
      { id: 'tarjeta', label: 'Tarjeta / Datáfono' },
      { id: 'nequi_daviplata', label: 'Nequi / Daviplata' },
      { id: 'transferencia', label: 'Transferencia Bancaria' },
    ];
    const combined = [...fromActive];
    for (const std of standardDefaults) {
      const alreadyExists = combined.some(
        (c) =>
          c.id === std.id ||
          c.label.toLowerCase().includes(std.label.split(' ')[0].toLowerCase())
      );
      if (!alreadyExists) {
        combined.push(std);
      }
    }
    return combined;
  }, [methodsList]);

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
                    <span>Agregar Ítem Entregado</span>
                  </button>
                </div>
              </div>

              {/* Lista Detallada de Productos con Checkbox Izquierdo */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#78716c] italic border border-dashed border-[#383124] rounded-lg">
                    No hay productos en esta cuenta. Haz clic en "Agregar Ítem Entregado" para registrar consumos.
                  </div>
                ) : (
                  items.map((item) => {
                    const isChecked = selectedItemIds.includes(item.id);
                    const isPaid = Boolean(item.paid);
                    const modifiersSummary = formatOrderItemModifiersSummary(item);
                    const matchedCatalogProduct =
                      products.find((p) => p.id === item.menuItemId) ||
                      menuItems.find((m) => m.id === item.menuItemId);
                    const fallbackDescription =
                      !modifiersSummary && matchedCatalogProduct?.description
                        ? matchedCatalogProduct.description
                        : '';

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 ${
                          isPaid
                            ? 'bg-[#14121a]/60 border-[#332a1e] text-[#8c8270]'
                            : isChecked
                            ? 'bg-[#1e1b26] border-[#d4af37]/60 shadow-sm'
                            : 'bg-[#14131a] border-[#2d281e] opacity-75'
                        }`}
                      >
                        {/* Checkbox, Nombre, Descripción Completa y Observaciones */}
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <label className="flex items-center gap-2 cursor-pointer select-none pt-0.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectItem(item.id)}
                              className="w-4 h-4 rounded accent-[#d4af37] cursor-pointer"
                            />
                          </label>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-xs font-bold ${
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

                              <span className="text-[10px] font-mono text-[#a8a29e]">
                                {formatCOP(item.price)} c/u
                              </span>
                            </div>

                            {/* Descripción completa de lo que pidió el cliente (Sopa, Principio, Carne, Acompañamientos, Bebida o descripción del plato) */}
                            {modifiersSummary && (
                              <p className="text-[11px] text-[#d6d3d1] leading-snug whitespace-normal break-words bg-[#121117]/80 px-2 py-1 rounded-lg border border-[#2d281e]">
                                <span className="font-semibold text-[#d4af37]">Detalle pedido: </span>
                                {modifiersSummary}
                              </p>
                            )}

                            {fallbackDescription && (
                              <p className="text-[11px] text-[#a8a29e] leading-snug whitespace-normal break-words">
                                {fallbackDescription}
                              </p>
                            )}

                            {/* Descuentos por omisión o recargos aplicados al plato */}
                            {item.adjustments && item.adjustments.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {item.adjustments.map((adj) => (
                                  <span
                                    key={adj.id}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                      adj.type === 'descuento'
                                        ? 'bg-emerald-950/50 border-emerald-700/50 text-emerald-300'
                                        : 'bg-amber-950/50 border-amber-700/50 text-amber-300'
                                    }`}
                                  >
                                    {adj.type === 'descuento' ? 'Descuento' : 'Adición'}: {adj.concept} (
                                    {adj.type === 'descuento' ? '-' : '+'}
                                    {adj.modality === 'porcentaje' ? `${adj.value}%` : formatCOP(adj.value)})
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Observaciones / Notas del cliente (completas sin recortar) */}
                            {item.notes && (
                              <div className="text-[11px] text-[#fef3c7] bg-[#2b2416]/80 border border-[#d4af37]/50 px-2 py-1 rounded-lg whitespace-normal break-words">
                                <strong className="text-[#d4af37]">Observación:</strong> {item.notes}
                              </div>
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
                      {advanceApplied > 0 ? 'Saldo Neto a Cobrar' : 'Total a Cobrar por Ítems Seleccionados'}
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

                {orderAdvanceAmount > 0 && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-700/50 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[#d6d3d1]">
                      <span>Total Pedido Seleccionado:</span>
                      <span className="font-mono font-semibold">{formatCOP(grossSelectedTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-emerald-400 font-bold">
                      <span className="flex items-center gap-1">
                        <BookmarkCheck className="w-3.5 h-3.5" />
                        <span>Abono Anticipado ({order.fromSeparadoCode || 'Separado'}):</span>
                      </span>
                      <span className="font-mono">-{formatCOP(advanceApplied)}</span>
                    </div>
                  </div>
                )}

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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2d281e] pb-2.5">
                  <div>
                    <span className="text-xs font-bold text-[#d4af37] block">
                      Distribución de Pago Mixto (Total a cubrir: {formatCOP(grandTotal)})
                    </span>
                    <span className="text-[11px] text-[#a8a29e]">
                      Selecciona los medios de pago que se van a utilizar y el valor recibido en cada uno.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const usedMethods = splits.map((s) => s.method);
                      const nextMethod =
                        selectableSplitMethods.find((m) => !usedMethods.includes(m.id))?.id ||
                        selectableSplitMethods[0]?.id ||
                        'transferencia';
                      const currentSum = splits.reduce((sum, s) => sum + (s.amount || 0), 0);
                      const remaining = Math.max(0, grandTotal - currentSum);
                      setSplits((prev) => [...prev, { method: nextMethod, amount: remaining }]);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#2b2416] hover:bg-[#3d321d] border border-[#d4af37]/50 text-[#d4af37] text-[11px] font-bold flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar otro medio</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {splits.map((split, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-[#121117] border border-[#383124] grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                    >
                      <div className="sm:col-span-6">
                        <label className="block text-[11px] font-semibold text-[#a8a29e] mb-1">
                          Medio de Pago #{idx + 1}
                        </label>
                        <select
                          aria-label={`Medio de pago ${idx + 1}`}
                          value={split.method}
                          onChange={(e) => {
                            const newMethod = e.target.value as PaymentMethod;
                            setSplits((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, method: newMethod } : item))
                            );
                          }}
                          className="w-full bg-[#18171f] border border-[#383124] rounded-lg px-3 py-2 text-xs font-bold text-[#fef3c7] focus:outline-none focus:border-[#d4af37] cursor-pointer"
                        >
                          {selectableSplitMethods.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className={splits.length > 2 ? 'sm:col-span-5' : 'sm:col-span-6'}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-[#a8a29e]">
                            Monto en {selectableSplitMethods.find((m) => m.id === split.method)?.label || split.method} (COP)
                          </label>
                          {splits.length > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                const otherSum = splits.reduce(
                                  (sum, s, i) => (i === idx ? sum : sum + (s.amount || 0)),
                                  0
                                );
                                const rem = Math.max(0, grandTotal - otherSum);
                                setSplits((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, amount: rem } : item))
                                );
                              }}
                              className="text-[10px] font-bold text-[#d4af37] hover:underline cursor-pointer"
                            >
                              Completar saldo
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-[#a8a29e]">$</span>
                          <input
                            type="number"
                            min={0}
                            value={split.amount}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setSplits((prev) => {
                                if (prev.length === 2) {
                                  const otherIdx = idx === 0 ? 1 : 0;
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], amount: val };
                                  next[otherIdx] = {
                                    ...next[otherIdx],
                                    amount: Math.max(0, grandTotal - val),
                                  };
                                  return next;
                                }
                                return prev.map((item, i) => (i === idx ? { ...item, amount: val } : item));
                              });
                            }}
                            className="w-full bg-[#18171f] border border-[#383124] rounded-lg pl-7 pr-3 py-1.5 text-xs font-mono font-bold text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                          />
                        </div>
                      </div>

                      {splits.length > 2 && (
                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setSplits((prev) => {
                                const filtered = prev.filter((_, i) => i !== idx);
                                if (filtered.length === 2) {
                                  const firstAmt = Math.min(grandTotal, filtered[0].amount || 0);
                                  return [
                                    { ...filtered[0], amount: firstAmt },
                                    { ...filtered[1], amount: Math.max(0, grandTotal - firstAmt) },
                                  ];
                                }
                                return filtered;
                              });
                            }}
                            className="p-2 rounded-lg bg-red-950/50 hover:bg-red-900/70 text-red-400 border border-red-800/50 cursor-pointer"
                            title="Quitar este medio de pago"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Resumen de cuadre del Pago Mixto */}
                <div
                  className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                    splitsDifference === 0
                      ? 'bg-emerald-950/30 border-emerald-700/50 text-emerald-300'
                      : 'bg-amber-950/40 border-amber-600/50 text-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold">
                      Suma asignada: <strong className="font-mono">{formatCOP(splitsTotal)}</strong> de{' '}
                      <strong className="font-mono">{formatCOP(grandTotal)}</strong>
                    </span>
                    {splitsDifference === 0 ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 text-[10px] font-black">
                        ✓ Monto exacto cuadrado
                      </span>
                    ) : splitsDifference > 0 ? (
                      <span className="text-[11px] font-bold text-amber-300">
                        · Faltan {formatCOP(splitsDifference)} por asignar
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-red-300">
                        · Excede el total por {formatCOP(Math.abs(splitsDifference))}
                      </span>
                    )}
                  </div>

                  {splitsDifference !== 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSplits((prev) => {
                          if (prev.length === 0) return prev;
                          const othersSum = prev
                            .slice(0, -1)
                            .reduce((sum, s) => sum + (s.amount || 0), 0);
                          return prev.map((s, i) =>
                            i === prev.length - 1
                              ? { ...s, amount: Math.max(0, grandTotal - othersSum) }
                              : s
                          );
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#d4af37] text-[#0e0e12] text-[10px] font-black hover:brightness-110 cursor-pointer self-start sm:self-auto"
                    >
                      Cuadrar Diferencia Automáticamente
                    </button>
                  )}
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

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#383124] text-xs font-semibold text-[#a8a29e] hover:bg-[#1a1922] cursor-pointer"
              >
                Cancelar
              </button>

              {unpaidItemsTotals.netPending > 0 && (
                <button
                  type="button"
                  onClick={handleOpenConfirmCartera}
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/70 border border-amber-500/60 text-amber-300 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md"
                  title="Enviar este pedido a Cartera con el saldo pendiente por cobrar"
                >
                  <CreditCard className="w-4 h-4 text-amber-400" />
                  <span>Enviar a Cartera ({formatCOP(unpaidItemsTotals.netPending)})</span>
                </button>
              )}

              <button
                type="button"
                onClick={handlePay}
                disabled={
                  actionLoading ||
                  selectedItemIds.length === 0 ||
                  (paymentMethod === 'efectivo' && cashReceived < grandTotal) ||
                  (paymentMethod === 'mixto' && splitsDifference !== 0)
                }
                className={`px-6 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  actionLoading ||
                  selectedItemIds.length === 0 ||
                  (paymentMethod === 'efectivo' && cashReceived < grandTotal) ||
                  (paymentMethod === 'mixto' && splitsDifference !== 0)
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

      {/* MODAL DE CONFIRMACIÓN: ENVIAR PEDIDO CON SALDO PENDIENTE A CARTERA */}
      {showConfirmCarteraModal && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16151f] border border-amber-500/60 rounded-2xl w-full max-w-lg p-5 text-[#faf5ee] shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-[#2d281e] pb-3 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-500/60 flex items-center justify-center text-amber-400 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-[#fef3c7]">
                    Confirmar Envío de Pedido #{order.orderNumber} a Cartera
                  </h3>
                  <p className="text-[11px] text-[#a8a29e]">
                    Por seguridad, confirma que deseas enviar el saldo pendiente a Cuentas por Cobrar.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmCarteraModal(false)}
                className="p-1 text-[#a8a29e] hover:text-[#fef3c7] rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-xs space-y-2">
              <p className="text-[#d6d3d1] leading-snug">
                Al dar clic en <strong>Aceptar</strong>, este pedido <strong>saldrá de los pedidos activos</strong>{order.tableId ? ' (liberando la mesa)' : ''} y pasará al módulo de <strong>Cartera</strong> con el siguiente saldo pendiente:
              </p>
              <div className="pt-2 border-t border-amber-500/20 space-y-1">
                <div className="flex justify-between text-[#a8a29e]">
                  <span>Total Ítems Pendientes:</span>
                  <span className="font-mono font-bold text-[#fef3c7]">{formatCOP(unpaidItemsTotals.grossTotal)}</span>
                </div>
                {unpaidItemsTotals.advanceDeducted > 0 && (
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>Abono Recibido con Anticipación ({order.fromSeparadoCode || 'Separado'}):</span>
                    <span className="font-mono">-{formatCOP(unpaidItemsTotals.advanceDeducted)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-amber-300 pt-1 border-t border-amber-500/20">
                  <span>Saldo Pendiente que pasa a Cartera:</span>
                  <span className="font-mono">{formatCOP(unpaidItemsTotals.netPending)}</span>
                </div>
              </div>
            </div>

            {carteraError && (
              <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{carteraError}</span>
              </div>
            )}

            {/* Selección o confirmación de datos del cliente para Cartera */}
            <div className="space-y-3">
              {customers.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">
                    Seleccionar Cliente Registrado (Opcional):
                  </label>
                  <select
                    value={carteraCustomerId}
                    onChange={(e) => {
                      const cId = e.target.value;
                      setCarteraCustomerId(cId);
                      const found = customers.find((c) => c.id === cId);
                      if (found) {
                        setCarteraCustomerName(found.name);
                        setCarteraCustomerDoc(found.documentNumber || '');
                        setCarteraCustomerPhone(found.phone || '');
                        setCarteraError('');
                      }
                    }}
                    className="w-full bg-[#121117] border border-[#383124] rounded-lg px-3 py-2 text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                  >
                    <option value="">-- Seleccionar de la base de clientes o escribir abajo --</option>
                    {customers
                      .filter((c) => c.status === 'activo')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} — {c.documentNumber} ({c.phone})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">
                    Nombre del Cliente <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a29e]" />
                    <input
                      type="text"
                      value={carteraCustomerName}
                      onChange={(e) => {
                        setCarteraCustomerName(e.target.value);
                        setCarteraError('');
                      }}
                      placeholder="Nombre completo del cliente"
                      className="w-full pl-9 pr-3 py-1.5 bg-[#121117] border border-[#383124] rounded-lg text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">
                    Cédula o NIT:
                  </label>
                  <input
                    type="text"
                    value={carteraCustomerDoc}
                    onChange={(e) => setCarteraCustomerDoc(e.target.value)}
                    placeholder="Documento del cliente"
                    className="w-full px-3 py-1.5 bg-[#121117] border border-[#383124] rounded-lg text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">
                    Teléfono / WhatsApp:
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a29e]" />
                    <input
                      type="text"
                      value={carteraCustomerPhone}
                      onChange={(e) => setCarteraCustomerPhone(e.target.value)}
                      placeholder="300 000 0000"
                      className="w-full pl-9 pr-3 py-1.5 bg-[#121117] border border-[#383124] rounded-lg text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">
                    Fecha Límite de Pago:
                  </label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#d4af37]" />
                    <input
                      type="date"
                      value={carteraDueDate}
                      onChange={(e) => setCarteraDueDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-[#121117] border border-[#383124] rounded-lg text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#a8a29e] mb-1">
                  Observaciones de la Cuenta por Cobrar:
                </label>
                <input
                  type="text"
                  value={carteraNotes}
                  onChange={(e) => setCarteraNotes(e.target.value)}
                  placeholder="Nota o referencia del saldo enviado a cartera"
                  className="w-full px-3 py-1.5 bg-[#121117] border border-[#383124] rounded-lg text-xs text-[#fef3c7] focus:outline-none focus:border-[#d4af37]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#2d281e]">
              <button
                type="button"
                onClick={() => setShowConfirmCarteraModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl border border-[#383124] text-xs font-bold text-[#a8a29e] hover:bg-[#201e28] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSendToCartera}
                disabled={actionLoading}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs hover:brightness-110 cursor-pointer shadow-lg inline-flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{actionLoading ? 'Enviando...' : 'Aceptar y Enviar a Cartera'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
