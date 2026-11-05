import React, { useState } from 'react';
import { Supplier, Purchase, SupplierAdvance, PurchasePayment } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { calculateSupplierMetrics } from '../../utils/supplierAndPayablesUtils';
import { SupplierModal } from './SupplierModal';
import { SupplierActionsDropdown } from './SupplierActionsDropdown';
import {
  Building,
  Search,
  Plus,
  Phone,
  MessageCircle,
  FileText,
  CreditCard,
  DollarSign,
  Package,
  TrendingUp,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Calendar,
  AlertCircle,
  X,
  Eye,
} from 'lucide-react';

interface SuppliersDirectoryViewProps {
  onNavigateToPurchaseWithSupplier?: (supplier: Supplier) => void;
  onNavigateToAdvanceWithSupplier?: (supplier: Supplier) => void;
  onNavigateToPayablesWithSupplier?: (supplier: Supplier) => void;
}

export const SuppliersDirectoryView: React.FC<SuppliersDirectoryViewProps> = ({
  onNavigateToPurchaseWithSupplier,
  onNavigateToAdvanceWithSupplier,
  onNavigateToPayablesWithSupplier,
}) => {
  const {
    suppliers,
    purchases,
    supplierAdvances,
    purchasePayments,
    toggleSupplierStatus,
  } = useRestaurant();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'activos' | 'inactivos'>('activos');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierDetailTab, setSupplierDetailTab] = useState<
    'compras' | 'cuentas' | 'anticipos' | 'movimientos' | 'informacion'
  >('compras');

  const [showSupplierModal, setShowSupplierModal] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Filtrado de proveedores
  const filteredSuppliers = suppliers.filter((s) => {
    if (filterStatus === 'activos' && s.status !== 'activo') return false;
    if (filterStatus === 'inactivos' && s.status !== 'inactivo') return false;
    if (!searchQuery.trim()) return true;

    const term = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      (s.document && s.document.toLowerCase().includes(term)) ||
      (s.phone && s.phone.toLowerCase().includes(term)) ||
      (s.address && s.address.toLowerCase().includes(term))
    );
  });

  const openWhatsApp = (phone: string, name: string) => {
    const clean = phone.replace(/[^0-9]/g, '');
    const msg = `Hola ${name} 👋 Te saludamos de Sistema Colmena Restaurante. ¿Deseas enviarnos la cotización o actualización de lista de precios de insumos?`;
    window.open(`https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Métricas globales
  const totalSuppliers = suppliers.length;
  const activeSuppliersCount = suppliers.filter((s) => s.status === 'activo').length;

  return (
    <div className="space-y-6">
      
      {/* Si hay un proveedor seleccionado, muestra la Ficha Detallada e Historial */}
      {selectedSupplier ? (
        <div className="space-y-6">
          
          {/* Cabecera Ficha de Proveedor */}
          <div className="bg-[#181818] border border-[#B77900]/40 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2e2e2e] pb-5">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedSupplier(null)}
                  className="p-2.5 rounded-2xl bg-[#242424] text-[#a8a29e] hover:text-[#FFFDF5] hover:bg-[#333333] transition-colors cursor-pointer"
                  title="Volver al directorio"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-12 h-12 rounded-2xl bg-[#292212] border border-[#B77900]/40 flex items-center justify-center text-[#D6A21A] flex-shrink-0 font-black text-xl">
                  <Building className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-[#FFFDF5]">
                      {selectedSupplier.name}
                    </h2>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                        selectedSupplier.status === 'activo'
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                          : 'bg-red-950/80 text-red-300 border-red-800'
                      }`}
                    >
                      {selectedSupplier.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#a8a29e] flex items-center gap-2 mt-1">
                    <span>{selectedSupplier.documentType || 'NIT/CC'}: <strong className="text-[#FFFDF5]">{selectedSupplier.documentNumber || selectedSupplier.document}</strong></span>
                    <span>·</span>
                    <span>Celular: <strong className="text-[#FFFDF5]">{selectedSupplier.phone}</strong></span>
                  </p>
                </div>
              </div>

              {/* Botones de Acción Rápida */}
              <div className="flex flex-wrap items-center gap-2">
                {onNavigateToPurchaseWithSupplier && (
                  <button
                    type="button"
                    onClick={() => onNavigateToPurchaseWithSupplier(selectedSupplier)}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center gap-1.5 hover:brightness-110 shadow transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Registrar Compra</span>
                  </button>
                )}

                <SupplierActionsDropdown
                  supplier={selectedSupplier}
                  label="Opciones Proveedor"
                  onWhatsApp={() => openWhatsApp(selectedSupplier.phone, selectedSupplier.name)}
                  onEdit={() => {
                    setEditingSupplier(selectedSupplier);
                    setShowSupplierModal(true);
                  }}
                  onToggleStatus={async () => {
                    const nextStatus = selectedSupplier.status === 'activo' ? 'inactivo' : 'activo';
                    await toggleSupplierStatus(selectedSupplier.id, nextStatus);
                    setSelectedSupplier((prev) => (prev ? { ...prev, status: nextStatus } : null));
                    showToast(`Proveedor ${nextStatus === 'activo' ? 'activado' : 'desactivado'} con éxito`, 'success');
                  }}
                />
              </div>
            </div>

            {/* 5 Tarjetas Métricas del Proveedor */}
            {(() => {
              const metrics = calculateSupplierMetrics(
                selectedSupplier.id,
                purchases,
                purchasePayments,
                supplierAdvances
              );

              return (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-5">
                  <div className="bg-[#121214] border border-[#2d281e] p-3.5 rounded-2xl">
                    <span className="text-[10px] uppercase font-bold text-[#a8a29e]">Total Compras</span>
                    <p className="text-base font-black text-[#FFFDF5] mt-1">{formatCOP(metrics.totalPurchasesAmount)}</p>
                    <span className="text-[10px] text-[#a8a29e]">{metrics.purchasesCount} facturas</span>
                  </div>

                  <div className="bg-[#121214] border border-[#2d281e] p-3.5 rounded-2xl">
                    <span className="text-[10px] uppercase font-bold text-[#a8a29e]">Total Pagado</span>
                    <p className="text-base font-black text-emerald-400 mt-1">{formatCOP(metrics.totalPaidReal)}</p>
                    <span className="text-[10px] text-emerald-400">desembolsos reales</span>
                  </div>

                  <div className="bg-[#121214] border border-[#2d281e] p-3.5 rounded-2xl">
                    <span className="text-[10px] uppercase font-bold text-[#a8a29e]">Saldo Pendiente</span>
                    <p className={`text-base font-black mt-1 ${metrics.totalBalanceDue > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {formatCOP(metrics.totalBalanceDue)}
                    </p>
                    <span className="text-[10px] text-[#a8a29e]">por pagar</span>
                  </div>

                  <div className="bg-[#121214] border border-[#2d281e] p-3.5 rounded-2xl">
                    <span className="text-[10px] uppercase font-bold text-[#a8a29e]">Anticipos Disponibles</span>
                    <p className="text-base font-black text-cyan-400 mt-1">{formatCOP(metrics.totalAdvancesAvailable)}</p>
                    <span className="text-[10px] text-cyan-400">por aplicar</span>
                  </div>

                  <div className="bg-[#121214] border border-[#2d281e] p-3.5 rounded-2xl">
                    <span className="text-[10px] uppercase font-bold text-[#a8a29e]">Última Compra</span>
                    <p className="text-xs font-bold text-[#FFFDF5] mt-2">
                      {metrics.lastPurchaseDate ? formatColombiaDateTime(metrics.lastPurchaseDate) : 'Sin compras'}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Pestañas de Detalle del Proveedor */}
          <div className="bg-[#181818] border border-[#2d281e] rounded-3xl p-6 shadow-xl">
            <div className="flex border-b border-[#2d2d2d] gap-2 overflow-x-auto mb-6">
              {[
                { id: 'compras', label: 'Compras', icon: FileText },
                { id: 'cuentas', label: 'Cuentas por Pagar', icon: CreditCard },
                { id: 'anticipos', label: 'Anticipos', icon: DollarSign },
                { id: 'movimientos', label: 'Movimientos', icon: TrendingUp },
                { id: 'informacion', label: 'Información Proveedor', icon: Building },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSupplierDetailTab(tab.id as any)}
                    className={`px-4 py-3 font-bold text-xs border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                      supplierDetailTab === tab.id
                        ? 'border-[#B77900] text-[#D6A21A] bg-[#292212]/50 rounded-t-xl'
                        : 'border-transparent text-[#a8a29e] hover:text-[#FFFDF5]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB: COMPRAS */}
            {supplierDetailTab === 'compras' && (
              <div className="space-y-4">
                {purchases.filter((p) => p.supplierId === selectedSupplier.id).length > 0 ? (
                  <div className="divide-y divide-[#242424] border border-[#2e2e2e] rounded-2xl overflow-hidden">
                    {purchases
                      .filter((p) => p.supplierId === selectedSupplier.id)
                      .map((p) => (
                        <div key={p.id} className="p-4 bg-[#121214] hover:bg-[#1f1e24] transition-colors flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-[#FFFDF5]">Factura #{p.documentNumber}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  p.paymentStatus === 'pagada'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : p.paymentStatus === 'parcial'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : 'bg-red-950 text-red-300 border border-red-800'
                                }`}
                              >
                                {p.paymentStatus === 'pagada' ? 'PAGADA' : p.paymentStatus === 'parcial' ? 'CON ABONO' : 'PENDIENTE'}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#a8a29e] mt-1">
                              Fecha: {p.date} · {p.items.length} ítems de insumos
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-[#FFFDF5]">{formatCOP(p.total)}</p>
                            <p className="text-[11px] text-amber-400">Saldo: {formatCOP(p.balanceDue)}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-[#a8a29e]">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-bold text-[#FFFDF5]">No hay compras registradas para este proveedor</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB: CUENTAS POR PAGAR */}
            {supplierDetailTab === 'cuentas' && (
              <div className="space-y-4">
                {purchases.filter((p) => p.supplierId === selectedSupplier.id && p.balanceDue > 0).length > 0 ? (
                  <div className="divide-y divide-[#242424] border border-[#2e2e2e] rounded-2xl overflow-hidden">
                    {purchases
                      .filter((p) => p.supplierId === selectedSupplier.id && p.balanceDue > 0)
                      .map((p) => (
                        <div key={p.id} className="p-4 bg-[#121214] flex items-center justify-between">
                          <div>
                            <span className="text-xs font-black text-[#FFFDF5]">Factura #{p.documentNumber}</span>
                            <p className="text-[11px] text-[#a8a29e] mt-1">Total: {formatCOP(p.total)} · Abonado: {formatCOP(p.amountPaid)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-xs font-bold text-amber-400 block">Pendiente:</span>
                              <span className="text-sm font-black text-amber-400">{formatCOP(p.balanceDue)}</span>
                            </div>
                            {onNavigateToPayablesWithSupplier && (
                              <button
                                type="button"
                                onClick={() => onNavigateToPayablesWithSupplier(selectedSupplier)}
                                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-bold text-xs cursor-pointer"
                              >
                                Registrar Pago
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-emerald-400 font-bold">
                    <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                    <p className="text-sm">¡El proveedor se encuentra al día sin obligaciones pendientes!</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB: ANTICIPOS */}
            {supplierDetailTab === 'anticipos' && (
              <div className="space-y-4">
                {supplierAdvances.filter((a) => a.supplierId === selectedSupplier.id).length > 0 ? (
                  <div className="divide-y divide-[#242424] border border-[#2e2e2e] rounded-2xl overflow-hidden">
                    {supplierAdvances
                      .filter((a) => a.supplierId === selectedSupplier.id)
                      .map((a) => {
                        const avail = a.availableBalance !== undefined ? a.availableBalance : a.balance;
                        return (
                          <div key={a.id} className="p-4 bg-[#121214] flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-[#FFFDF5]">{a.receiptNumber || a.id}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                                  {a.status || 'disponible'}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#a8a29e] mt-1">Monto Original: {formatCOP(a.amount)} · Fecha: {a.date}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-bold text-cyan-400 block">Disponible:</span>
                              <span className="text-sm font-black text-cyan-400">{formatCOP(avail)}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-[#a8a29e]">
                    <p className="text-sm font-bold text-[#FFFDF5]">No hay anticipos entregados a este proveedor</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB: INFORMACIÓN GENERAL */}
            {supplierDetailTab === 'informacion' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#FFFDF5]">
                <div className="p-4 bg-[#121214] border border-[#2e2e2e] rounded-2xl space-y-2">
                  <p className="text-[#a8a29e] font-bold uppercase text-[10px]">Documento Identificación</p>
                  <p className="font-bold">{selectedSupplier.documentType || 'NIT'}: {selectedSupplier.documentNumber || selectedSupplier.document}</p>
                </div>

                <div className="p-4 bg-[#121214] border border-[#2e2e2e] rounded-2xl space-y-2">
                  <p className="text-[#a8a29e] font-bold uppercase text-[10px]">Contacto Comercial</p>
                  <p className="font-bold">{selectedSupplier.phone}</p>
                  {selectedSupplier.email && <p className="text-[#a8a29e]">{selectedSupplier.email}</p>}
                </div>

                <div className="p-4 bg-[#121214] border border-[#2e2e2e] rounded-2xl space-y-2">
                  <p className="text-[#a8a29e] font-bold uppercase text-[10px]">Dirección de Despacho</p>
                  <p className="font-bold">{selectedSupplier.address || 'No especificada'}</p>
                </div>

                <div className="p-4 bg-[#121214] border border-[#2e2e2e] rounded-2xl space-y-2">
                  <p className="text-[#a8a29e] font-bold uppercase text-[10px]">Observaciones Comerciales</p>
                  <p className="italic text-[#a8a29e]">{selectedSupplier.observations || 'Sin observaciones registradas'}</p>
                </div>
              </div>
            )}

          </div>

        </div>
      ) : (
        /* VISTA GENERAL: DIRECTORIO DE PROVEEDORES */
        <div className="space-y-6">
          
          {/* Métricas y Barra Superior */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterStatus('activos')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'activos'
                    ? 'bg-[#B77900] text-[#181818]'
                    : 'bg-[#181818] border border-[#333333] text-[#a8a29e]'
                }`}
              >
                Activos ({activeSuppliersCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('todos')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'todos'
                    ? 'bg-[#B77900] text-[#181818]'
                    : 'bg-[#181818] border border-[#333333] text-[#a8a29e]'
                }`}
              >
                Todos ({totalSuppliers})
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#a8a29e]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre, NIT, celular..."
                  className="w-full bg-[#181818] border border-[#333333] rounded-2xl pl-10 pr-4 py-2.5 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingSupplier(null);
                  setShowSupplierModal(true);
                }}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center gap-1.5 hover:brightness-110 shadow-lg transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Proveedor</span>
              </button>
            </div>
          </div>

          {/* Grilla de Proveedores */}
          {filteredSuppliers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSuppliers.map((sup) => {
                const metrics = calculateSupplierMetrics(sup.id, purchases, purchasePayments, supplierAdvances);

                return (
                  <div
                    key={sup.id}
                    className="bg-[#181818] border border-[#2d281e] hover:border-[#B77900]/60 rounded-3xl p-5 shadow-lg flex flex-col justify-between transition-all group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-[#292212] border border-[#B77900]/40 flex items-center justify-center text-[#D6A21A] flex-shrink-0">
                            <Building className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-[#FFFDF5] group-hover:text-[#D6A21A] transition-colors">
                              {sup.name}
                            </h3>
                            <span className="text-[10px] font-bold text-[#a8a29e]">
                              {sup.documentType || 'NIT'}: {sup.documentNumber || sup.document}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            sup.status === 'activo'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-red-950 text-red-300 border border-red-800'
                          }`}
                        >
                          {sup.status}
                        </span>
                      </div>

                      {/* Info de contacto */}
                      <p className="text-xs text-[#a8a29e] mb-3 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-[#D6A21A]" />
                        <span>{sup.phone}</span>
                        {sup.address && <span className="truncate">· {sup.address}</span>}
                      </p>

                      {/* Métricas rápidas */}
                      <div className="grid grid-cols-2 gap-2 p-3 bg-[#121214] rounded-2xl border border-[#242424] text-[11px] mb-4">
                        <div>
                          <span className="text-[#a8a29e] block text-[10px]">Saldo por Pagar:</span>
                          <span className={`font-black ${metrics.totalBalanceDue > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {formatCOP(metrics.totalBalanceDue)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#a8a29e] block text-[10px]">Anticipo Dispon.:</span>
                          <span className="font-black text-cyan-400">{formatCOP(metrics.totalAdvancesAvailable)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Acciones del Proveedor */}
                    <div className="pt-3 border-t border-[#2a2a2a] flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setSelectedSupplier(sup)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#292212] border border-[#B77900]/40 text-[#D6A21A] hover:bg-[#B77900] hover:text-[#181818] font-bold text-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Historial</span>
                      </button>

                      <SupplierActionsDropdown
                        supplier={sup}
                        label="Opciones"
                        onWhatsApp={() => openWhatsApp(sup.phone, sup.name)}
                        onEdit={() => {
                          setEditingSupplier(sup);
                          setShowSupplierModal(true);
                        }}
                        onToggleStatus={async () => {
                          const nextStatus = sup.status === 'activo' ? 'inactivo' : 'activo';
                          await toggleSupplierStatus(sup.id, nextStatus);
                          showToast(`Proveedor ${nextStatus === 'activo' ? 'activado' : 'desactivado'} con éxito`, 'success');
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-[#181818] border border-[#2d281e] rounded-3xl p-12 text-center text-[#a8a29e]">
              <Building className="w-12 h-12 mx-auto text-[#B77900] mb-3 opacity-60" />
              <p className="text-base font-bold text-[#FFFDF5]">No hay proveedores registrados que coincidan</p>
            </div>
          )}

        </div>
      )}

      {/* Modal de Proveedor */}
      <SupplierModal
        isOpen={showSupplierModal}
        onClose={() => {
          setShowSupplierModal(false);
          setEditingSupplier(null);
        }}
        editingSupplier={editingSupplier}
      />

    </div>
  );
};
