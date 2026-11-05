import React, { useState, useEffect } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Supplier } from '../../types';
import { formatCOP } from '../../utils/calculations';
import { generateReplenishmentProposals } from '../../utils/purchasingUtils';
import { SuppliersDirectoryView } from './SuppliersDirectoryView';
import { SupplierAdvancesView } from './SupplierAdvancesView';
import { AccountsPayableDirectoryView } from './AccountsPayableDirectoryView';
import {
  Building,
  CreditCard,
  DollarSign,
  Package,
  Truck,
  Plus,
  CheckCircle,
} from 'lucide-react';

export type PurchasesTab = 'proveedores' | 'cuentas' | 'anticipos' | 'abastecimiento';

interface PurchasesViewProps {
  initialTab?: PurchasesTab | 'compras';
  onNavigateToView?: (view: string) => void;
  onNavigateToPurchaseWithSupplier?: (supplier: Supplier) => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  initialTab = 'proveedores',
  onNavigateToView,
  onNavigateToPurchaseWithSupplier,
}) => {
  const {
    suppliers,
    purchases,
    supplierAdvances,
    inventory,
  } = useRestaurant();

  // Mapear tab inicial (si es 'compras' redirigir a 'proveedores')
  const resolveTab = (tab?: PurchasesTab | 'compras'): PurchasesTab => {
    if (!tab || tab === 'compras') return 'proveedores';
    return tab;
  };

  const [activeTab, setActiveTab] = useState<PurchasesTab>(resolveTab(initialTab));

  useEffect(() => {
    if (initialTab) {
      setActiveTab(resolveTab(initialTab));
    }
  }, [initialTab]);

  // Navegación unificada al único método de registro de compras
  const handleGoToNewPurchase = (supplier?: Supplier) => {
    if (supplier && onNavigateToPurchaseWithSupplier) {
      onNavigateToPurchaseWithSupplier(supplier);
    } else if (onNavigateToView) {
      onNavigateToView('registrar-compra');
    }
  };

  const confirmedPurchases = purchases.filter((p) => p.status !== 'anulada');
  const proposals = generateReplenishmentProposals(inventory);

  return (
    <div className="space-y-6">
      
      {/* 1. CABECERA PRINCIPAL CON BOTÓN AL MÉTODO ÚNICO DE COMPRAS */}
      <div className="bg-[#181818] p-5 rounded-3xl border border-[#333333] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[#FFFDF5] tracking-wide flex items-center gap-2">
            <Building className="w-6 h-6 text-[#D6A21A]" />
            <span>PROVEEDORES Y OBLIGACIONES</span>
          </h2>
          <p className="text-xs text-[#d6d3d1] mt-0.5">
            Directorio de proveedores, gestión de cuentas por pagar, anticipos y abastecimiento.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleGoToNewPurchase()}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs flex items-center gap-2 hover:brightness-110 shadow-lg cursor-pointer"
          >
            <Truck className="w-4 h-4" />
            <span>Registrar Compra</span>
          </button>
        </div>
      </div>

      {/* 2. NAVEGACIÓN DE SECCIONES (4 PESTAÑAS) */}
      <div className="bg-[#181818] border border-[#B77900]/40 rounded-3xl p-4 shadow-xl">
        <div className="flex border-b border-[#2d2d2d] gap-2 overflow-x-auto">
          {[
            { id: 'proveedores' as const, label: 'Proveedores & CRM', icon: Building, badge: suppliers.length },
            { id: 'cuentas' as const, label: 'Cuentas por Pagar', icon: CreditCard, badge: confirmedPurchases.filter((p) => p.balanceDue > 0).length, color: 'text-amber-400 font-bold' },
            { id: 'anticipos' as const, label: 'Anticipos a Proveedores', icon: DollarSign, badge: supplierAdvances.filter((a) => (a.availableBalance !== undefined ? a.availableBalance : a.balance) > 0).length, color: 'text-cyan-400 font-bold' },
            { id: 'abastecimiento' as const, label: 'Abastecimiento Sugerido', icon: Package, badge: proposals.length, color: proposals.length > 0 ? 'text-red-400 animate-pulse' : '' },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 font-bold text-xs border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-[#B77900] text-[#D6A21A] bg-[#292212]/60 rounded-t-xl'
                    : 'border-transparent text-[#a8a29e] hover:text-[#FFFDF5]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-[#121214] border border-[#333333] ${tab.color || 'text-[#FFFDF5]'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. CONTENIDO SEGÚN LA PESTAÑA ACTIVA */}

      {/* VISTA 1: PROVEEDORES & CRM INSUMOS */}
      {activeTab === 'proveedores' && (
        <SuppliersDirectoryView
          onNavigateToPurchaseWithSupplier={handleGoToNewPurchase}
          onNavigateToAdvanceWithSupplier={() => setActiveTab('anticipos')}
          onNavigateToPayablesWithSupplier={() => setActiveTab('cuentas')}
        />
      )}

      {/* VISTA 2: CUENTAS POR PAGAR */}
      {activeTab === 'cuentas' && <AccountsPayableDirectoryView />}

      {/* VISTA 3: ANTICIPOS A PROVEEDORES */}
      {activeTab === 'anticipos' && <SupplierAdvancesView />}

      {/* VISTA 4: ABASTECIMIENTO SUGERIDO */}
      {activeTab === 'abastecimiento' && (
        <div className="bg-[#181818] border border-[#2d281e] rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#2d2d2d] pb-4 gap-4">
            <div>
              <h3 className="text-base font-black text-[#FFFDF5]">Propuestas de Reabastecimiento de Insumos</h3>
              <p className="text-xs text-[#a8a29e]">Alertas automáticas según existencias mínimas de cocina e inventario físico</p>
            </div>

            {proposals.length > 0 && (
              <button
                type="button"
                onClick={() => handleGoToNewPurchase()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center gap-2 hover:brightness-110 shadow cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Compra de Insumos</span>
              </button>
            )}
          </div>

          {proposals.length > 0 ? (
            <div className="divide-y divide-[#242424]">
              {proposals.map((prop) => (
                <div key={prop.itemId} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#FFFDF5] text-sm">{prop.itemName}</span>
                    <p className="text-[#a8a29e] mt-0.5">
                      Stock Actual: <strong className="text-red-400">{prop.currentStock} {prop.unit}</strong> · Mínimo: {prop.minStock} {prop.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-amber-400 font-bold block">Sugerido: +{prop.recommendedQty} {prop.unit}</span>
                    <span className="text-[#a8a29e]">Est: {formatCOP(prop.estimatedCost)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-emerald-400 font-bold">
              <CheckCircle className="w-10 h-10 mx-auto mb-2" />
              <p className="text-sm">¡Todos los insumos e ingredientes cuentan con inventario óptimo!</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
