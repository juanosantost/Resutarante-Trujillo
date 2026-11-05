import React from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import {
  LayoutGrid,
  ClipboardList,
  Flame,
  Receipt,
  Boxes,
  Settings,
} from 'lucide-react';

export type ActiveTab = 'mesas' | 'pedidos' | 'cocina' | 'caja' | 'inventario' | 'config';

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  const { tables, activeOrders, activeComandas, inventory } = useRestaurant();

  const occupiedTablesCount = tables.filter((t) => t.status === 'ocupada' || t.status === 'cuenta_solicitada').length;
  const lowStockCount = inventory.filter((i) => i.currentStock <= i.minStock).length;
  const newKitchenComandasCount = activeComandas.filter((c) => c.status === 'nueva' || c.status === 'en_preparacion').length;

  const navItems = [
    {
      id: 'mesas' as ActiveTab,
      label: 'Mesas & Salón',
      icon: LayoutGrid,
      badge: occupiedTablesCount > 0 ? `${occupiedTablesCount}/${tables.length}` : undefined,
      badgeColor: 'bg-[#b45309] text-[#fef3c7]',
    },
    {
      id: 'pedidos' as ActiveTab,
      label: 'Pedidos',
      icon: ClipboardList,
      badge: activeOrders.length > 0 ? `${activeOrders.length}` : undefined,
      badgeColor: 'bg-[#2a2213] text-[#d4af37] border border-[#d4af37]/40',
    },
    {
      id: 'cocina' as ActiveTab,
      label: 'Monitor Cocina (KDS)',
      icon: Flame,
      badge: newKitchenComandasCount > 0 ? `${newKitchenComandasCount}` : undefined,
      badgeColor: 'bg-amber-600 text-white animate-pulse',
    },
    {
      id: 'caja' as ActiveTab,
      label: 'Caja & Facturación',
      icon: Receipt,
    },
    {
      id: 'inventario' as ActiveTab,
      label: 'Inventario & Recetas',
      icon: Boxes,
      badge: lowStockCount > 0 ? `! ${lowStockCount}` : undefined,
      badgeColor: 'bg-red-900/80 text-red-200 border border-red-700/50',
    },
    {
      id: 'config' as ActiveTab,
      label: 'Sucursal & Ajustes',
      icon: Settings,
    },
  ];

  return (
    <nav className="bg-[#121117] border-b border-[#2d281e] px-4 sticky top-16 sm:top-20 z-30 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-start overflow-x-auto no-scrollbar gap-1 sm:gap-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] shadow-md shadow-[#d4af37]/20 font-bold'
                  : 'text-[#d6d3d1] hover:text-[#fef3c7] hover:bg-[#1f1d26]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#0e0e12]' : 'text-[#d4af37]'}`} />
              <span>{item.label}</span>
              {item.badge && (
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
