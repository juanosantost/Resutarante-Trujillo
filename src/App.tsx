import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RestaurantProvider } from './context/RestaurantContext';
import { Loader } from './components/common/Loader';
import { LoginView } from './components/auth/LoginView';
import { AppLayout, AppView } from './components/layout/AppLayout';
import { HomeDashboard } from './components/home/HomeDashboard';
import { TablesView } from './components/tables/TablesView';
import { OrdersView } from './components/orders/OrdersView';
import { KitchenKDSView } from './components/kitchen/KitchenKDSView';
import { CashView } from './components/checkout/CashView';
import { InventoryView } from './components/inventory/InventoryView';
import { UsersManagementView } from './components/admin/UsersManagementView';
import { BranchesManagementView } from './components/admin/BranchesManagementView';
import { BranchConfigView } from './components/config/BranchConfigView';
import { RestaurantConfigView } from './components/config/RestaurantConfigView';
import { ProductCatalogView } from './components/catalog/ProductCatalogView';
import { DeliveryAndPickupView } from './components/orders/DeliveryAndPickupView';
import { PurchasesView } from './components/purchases/PurchasesView';
import { DisbursementsView } from './components/purchases/DisbursementsView';
import { ExpenseRegistrationView } from './components/purchases/ExpenseRegistrationView';
import { PurchaseRegistrationView } from './components/purchases/PurchaseRegistrationView';
import { CustomersView } from './components/customers/CustomersView';
import { SeparadosView } from './components/separados/SeparadosView';
import { CarteraView } from './components/cartera/CarteraView';
import { ReportsView } from './components/reports/ReportsView';
import { PaymentMethodsManagementView } from './components/admin/PaymentMethodsManagementView';
import { IncomesView } from './components/incomes/IncomesView';
import { OtherIncomeRegistrationView } from './components/incomes/OtherIncomeRegistrationView';
import { MenuButtonsConfigView } from './components/admin/MenuButtonsConfigView';
import { ManualView } from './components/manual/ManualView';
import { AuditHistoryView } from './components/admin/AuditHistoryView';
import { MenuConfigProvider, useMenuConfig } from './context/MenuConfigContext';
import { Supplier } from './types';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { normalizeUserRole, canUserAccessModule } from './utils/auth';

const MainAppContent: React.FC = () => {
  const { isAuthenticated, isLoading, currentUser } = useAuth();
  const { canRoleAccessView } = useMenuConfig();
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [selectedSupplierForPurchase, setSelectedSupplierForPurchase] = useState<Supplier | null>(null);

  // Redirección inteligente al iniciar sesión según rol operativo
  React.useEffect(() => {
    if (currentUser) {
      const normRole = normalizeUserRole(currentUser.role);
      if (normRole === 'cocinero') {
        setCurrentView('cocina');
      } else if (normRole === 'asesor' && !canUserAccessModule('asesor', currentView)) {
        setCurrentView('home');
      }
    }
  }, [currentUser]);

  if (isLoading) {
    return (
      <Loader
        message="SISTEMA COLMENA RESTAURANTE"
        subtext="Conectando a Cloud Firestore en Colombia (America/Bogota)..."
        fullScreen={true}
      />
    );
  }

  if (!isAuthenticated || !currentUser) {
    return <LoginView />;
  }

  // Comprobar si el usuario tiene acceso a la vista seleccionada según los 3 roles y la configuración dinámica del menú:
  // Administrador: Acceso total (configurable).
  // Asesor: Acceso a módulos autorizados (operación por defecto).
  // Cocinero: Acceso únicamente a módulos autorizados (cocina por defecto).
  const isAuthorizedForView = (view: AppView): boolean => {
    if (view === 'manual') return true;
    if (!currentUser) return false;
    return canRoleAccessView(currentUser.role, view);
  };

  const hasAccess = isAuthorizedForView(currentView);

  return (
    <AppLayout currentView={currentView} onNavigate={setCurrentView}>
      {!hasAccess ? (
        <div className="bg-[#181818] border border-amber-600/40 rounded-3xl p-8 text-center text-[#FFFDF5] max-w-xl mx-auto shadow-2xl my-12">
          <div className="w-16 h-16 rounded-2xl bg-amber-950/60 border border-amber-600/60 text-[#D6A21A] flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-[#FFFDF5] mb-2">
            Módulo Restringido por Rol
          </h2>
          <p className="text-xs text-[#d6d3d1] mb-6 leading-relaxed">
            Tu rol actual de <strong className="capitalize text-[#D6A21A]">{normalizeUserRole(currentUser.role)}</strong> no cuenta con los permisos necesarios para acceder a este módulo. Si requieres autorización, solicita la habilitación a un Administrador del Sistema Colmena.
          </p>
          <button
            type="button"
            onClick={() => setCurrentView(normalizeUserRole(currentUser.role) === 'cocinero' ? 'cocina' : 'home')}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center gap-2 hover:brightness-110 shadow-lg cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a {normalizeUserRole(currentUser.role) === 'cocinero' ? 'Cocina' : 'Operación'}</span>
          </button>
        </div>
      ) : (
        <>
          {currentView === 'home' && (
            <HomeDashboard onNavigate={(v) => setCurrentView(v as AppView)} />
          )}
          {currentView === 'mesas' && <TablesView />}
          {currentView === 'catalogo' && <ProductCatalogView />}
          {currentView === 'pedidos' && <OrdersView />}
          {currentView === 'domicilios' && <DeliveryAndPickupView />}
          {currentView === 'cocina' && <KitchenKDSView />}
          {currentView === 'caja' && <CashView />}
          {currentView === 'ingresos' && (
            <IncomesView onNavigateToView={(v) => setCurrentView(v as AppView)} />
          )}
          {currentView === 'otros-ingresos' && (
            <OtherIncomeRegistrationView onBack={() => setCurrentView('ingresos')} />
          )}
          {currentView === 'inventario' && <InventoryView />}
          {currentView === 'compras' && (
            <DisbursementsView onNavigateToView={(v) => setCurrentView(v as AppView)} />
          )}
          {currentView === 'desembolsos' && (
            <DisbursementsView onNavigateToView={(v) => setCurrentView(v as AppView)} />
          )}
          {currentView === 'registrar-gasto' && (
            <ExpenseRegistrationView onBack={() => setCurrentView('desembolsos')} />
          )}
          {currentView === 'registrar-compra' && (
            <PurchaseRegistrationView
              initialSupplier={selectedSupplierForPurchase}
              onBack={() => {
                setSelectedSupplierForPurchase(null);
                setCurrentView('desembolsos');
              }}
            />
          )}
          {currentView === 'proveedores' && (
            <PurchasesView
              initialTab="proveedores"
              onNavigateToView={(v) => setCurrentView(v as AppView)}
              onNavigateToPurchaseWithSupplier={(sup) => {
                setSelectedSupplierForPurchase(sup);
                setCurrentView('registrar-compra');
              }}
            />
          )}
          {currentView === 'cuentas-por-pagar' && (
            <PurchasesView
              initialTab="cuentas"
              onNavigateToView={(v) => setCurrentView(v as AppView)}
              onNavigateToPurchaseWithSupplier={(sup) => {
                setSelectedSupplierForPurchase(sup);
                setCurrentView('registrar-compra');
              }}
            />
          )}
          {currentView === 'anticipos-proveedores' && (
            <PurchasesView
              initialTab="anticipos"
              onNavigateToView={(v) => setCurrentView(v as AppView)}
              onNavigateToPurchaseWithSupplier={(sup) => {
                setSelectedSupplierForPurchase(sup);
                setCurrentView('registrar-compra');
              }}
            />
          )}
          {currentView === 'clientes' && <CustomersView onNavigateToView={(v) => setCurrentView(v as AppView)} />}
          {currentView === 'separados' && <SeparadosView />}
          {currentView === 'cartera' && <CarteraView />}
          {currentView === 'reportes' && <ReportsView />}
          {currentView === 'medios-pago' && <PaymentMethodsManagementView />}
          {currentView === 'usuarios' && <UsersManagementView />}
          {currentView === 'sucursales' && <BranchesManagementView />}
          {currentView === 'config-mesas' && <RestaurantConfigView />}
          {currentView === 'config-botones' && <MenuButtonsConfigView />}
          {currentView === 'config' && <BranchConfigView onNavigateToButtons={() => setCurrentView('config-botones')} />}
          {currentView === 'manual' && <ManualView />}
          {currentView === 'auditoria' && <AuditHistoryView />}
        </>
      )}
    </AppLayout>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <RestaurantProvider>
            <MenuConfigProvider>
              <MainAppContent />
            </MenuConfigProvider>
          </RestaurantProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
