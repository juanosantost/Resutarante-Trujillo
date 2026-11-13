import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { ShieldAlert, ArrowLeft, AlertTriangle, LogOut, X } from 'lucide-react';
import { normalizeUserRole, canUserAccessModule } from './utils/auth';

export const VIEW_LABELS: Record<AppView, string> = {
  home: 'Inicio',
  manual: 'Manual de Usuario',
  mesas: 'Mesas y Salón',
  catalogo: 'Catálogo de Productos',
  pedidos: 'Pedidos',
  domicilios: 'Domicilios y Para Llevar',
  cocina: 'Cocina (KDS)',
  caja: 'Caja y Turnos',
  ingresos: 'Ingresos',
  'otros-ingresos': 'Registrar Otro Ingreso',
  inventario: 'Inventario',
  compras: 'Compras y Gastos',
  proveedores: 'Proveedores',
  'cuentas-por-pagar': 'Cuentas por Pagar',
  'anticipos-proveedores': 'Anticipos a Proveedores',
  desembolsos: 'Desembolsos y Gastos',
  'registrar-gasto': 'Registrar Gasto',
  'registrar-compra': 'Registrar Compra',
  clientes: 'Clientes',
  separados: 'Separados',
  cartera: 'Cartera',
  reportes: 'Reportes',
  usuarios: 'Usuarios',
  sucursales: 'Sucursales',
  config: 'Configuración de Sucursal',
  'config-mesas': 'Salones y Mesas',
  'config-botones': 'Botones del Menú',
  'medios-pago': 'Medios de Pago',
  auditoria: 'Auditoría',
};

const MainAppContent: React.FC = () => {
  const { isAuthenticated, isLoading, currentUser, logout } = useAuth();
  const { canRoleAccessView } = useMenuConfig();
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [viewHistory, setViewHistory] = useState<AppView[]>(['home']);
  const [selectedSupplierForPurchase, setSelectedSupplierForPurchase] = useState<Supplier | null>(null);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState<boolean>(false);

  const viewHistoryRef = useRef<AppView[]>(viewHistory);
  viewHistoryRef.current = viewHistory;

  const currentViewRef = useRef<AppView>(currentView);
  currentViewRef.current = currentView;

  // Confirmación antes de cerrar o recargar la pestaña/ventana del navegador
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '¿Está seguro de que desea cerrar o salir de la página?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Función para navegar hacia una vista registrando el paso en el historial interno y en el navegador
  const navigateToView = useCallback((nextView: AppView) => {
    setCurrentView((prev) => {
      if (prev === nextView) return prev;
      setViewHistory((oldStack) => {
        const updated = [...oldStack, nextView].slice(-30);
        try {
          window.history.pushState(
            { colmenaStep: true, view: nextView, stepDepth: updated.length },
            '',
            window.location.pathname + window.location.search
          );
        } catch {}
        return updated;
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return nextView;
    });
  }, []);

  // Intentar cerrar el modal superior abierto si existe en pantalla antes de retroceder de vista
  const tryCloseTopModalOnBack = useCallback((): boolean => {
    const closeButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '.fixed.inset-0 button[aria-label*="Cerrar"], .fixed.inset-0 button[title*="Cerrar"]'
      )
    );
    if (closeButtons.length > 0) {
      const topCloseBtn = closeButtons[closeButtons.length - 1];
      topCloseBtn.click();
      return true;
    }
    return false;
  }, []);

  // Función para retroceder un paso al último lugar donde se estuvo en la página
  const goBackStep = useCallback(() => {
    if (showExitConfirmModal) {
      setShowExitConfirmModal(false);
      return;
    }

    // Si hay un modal abierto en la vista actual, cerrarlo primero como un paso hacia atrás
    if (tryCloseTopModalOnBack()) {
      return;
    }

    const stack = viewHistoryRef.current;
    if (stack.length > 1) {
      const nextStack = stack.slice(0, -1);
      const previousView = nextStack[nextStack.length - 1];
      setViewHistory(nextStack);
      setCurrentView(previousView);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Ya está en el primer paso: preguntar si está seguro de salir
      setShowExitConfirmModal(true);
    }
  }, [showExitConfirmModal, tryCloseTopModalOnBack]);

  // Saltar a un paso específico del historial reciente
  const jumpToHistoryStep = useCallback((indexInStack: number) => {
    setViewHistory((oldStack) => {
      if (indexInStack < 0 || indexInStack >= oldStack.length) return oldStack;
      const targetView = oldStack[indexInStack];
      const nextStack = oldStack.slice(0, indexInStack + 1);
      setCurrentView(targetView);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return nextStack;
    });
  }, []);

  // Inicializar estado centinela en el historial del navegador e interceptar el botón "Atrás" (popstate)
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    try {
      window.history.replaceState(
        { colmenaSentinel: true, view: currentViewRef.current },
        '',
        window.location.pathname + window.location.search
      );
      window.history.pushState(
        { colmenaStep: true, view: currentViewRef.current, stepDepth: viewHistoryRef.current.length },
        '',
        window.location.pathname + window.location.search
      );
    } catch {}

    const handlePopState = () => {
      // Re-insertar estado inmediatamente para evitar que el navegador abandone la aplicación hacia una página externa
      try {
        window.history.pushState(
          { colmenaStep: true, view: currentViewRef.current, stepDepth: viewHistoryRef.current.length },
          '',
          window.location.pathname + window.location.search
        );
      } catch {}

      // Ejecutar retroceso por pasos dentro de la aplicación
      if (tryCloseTopModalOnBack()) {
        return;
      }

      const stack = viewHistoryRef.current;
      if (stack.length > 1) {
        const nextStack = stack.slice(0, -1);
        const previousView = nextStack[nextStack.length - 1];
        setViewHistory(nextStack);
        setCurrentView(previousView);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setShowExitConfirmModal(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isAuthenticated, currentUser, tryCloseTopModalOnBack]);

  // Redirección inteligente al iniciar sesión según rol operativo
  useEffect(() => {
    if (currentUser) {
      const normRole = normalizeUserRole(currentUser.role);
      if (normRole === 'cocinero') {
        setCurrentView('cocina');
        setViewHistory(['cocina']);
      } else if (normRole === 'asesor' && !canUserAccessModule('asesor', currentView)) {
        setCurrentView('home');
        setViewHistory(['home']);
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
  const isAuthorizedForView = (view: AppView): boolean => {
    if (view === 'manual') return true;
    if (!currentUser) return false;
    return canRoleAccessView(currentUser.role, view);
  };

  const hasAccess = isAuthorizedForView(currentView);
  const previousView = viewHistory.length > 1 ? viewHistory[viewHistory.length - 2] : null;

  return (
    <AppLayout
      currentView={currentView}
      onNavigate={navigateToView}
      viewHistory={viewHistory}
      previousView={previousView}
      onGoBack={goBackStep}
      onJumpToStep={jumpToHistoryStep}
    >
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
            onClick={() => navigateToView(normalizeUserRole(currentUser.role) === 'cocinero' ? 'cocina' : 'home')}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center gap-2 hover:brightness-110 shadow-lg cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a {normalizeUserRole(currentUser.role) === 'cocinero' ? 'Cocina' : 'Operación'}</span>
          </button>
        </div>
      ) : (
        <>
          {currentView === 'home' && (
            <HomeDashboard onNavigate={(v) => navigateToView(v as AppView)} />
          )}
          {currentView === 'mesas' && <TablesView />}
          {currentView === 'catalogo' && <ProductCatalogView />}
          {currentView === 'pedidos' && <OrdersView />}
          {currentView === 'domicilios' && <DeliveryAndPickupView />}
          {currentView === 'cocina' && <KitchenKDSView />}
          {currentView === 'caja' && <CashView />}
          {currentView === 'ingresos' && (
            <IncomesView onNavigateToView={(v) => navigateToView(v as AppView)} />
          )}
          {currentView === 'otros-ingresos' && (
            <OtherIncomeRegistrationView onBack={goBackStep} />
          )}
          {currentView === 'inventario' && <InventoryView />}
          {currentView === 'compras' && (
            <DisbursementsView onNavigateToView={(v) => navigateToView(v as AppView)} />
          )}
          {currentView === 'desembolsos' && (
            <DisbursementsView onNavigateToView={(v) => navigateToView(v as AppView)} />
          )}
          {currentView === 'registrar-gasto' && (
            <ExpenseRegistrationView onBack={goBackStep} />
          )}
          {currentView === 'registrar-compra' && (
            <PurchaseRegistrationView
              initialSupplier={selectedSupplierForPurchase}
              onBack={() => {
                setSelectedSupplierForPurchase(null);
                goBackStep();
              }}
            />
          )}
          {currentView === 'proveedores' && (
            <PurchasesView
              initialTab="proveedores"
              onNavigateToView={(v) => navigateToView(v as AppView)}
              onNavigateToPurchaseWithSupplier={(sup) => {
                setSelectedSupplierForPurchase(sup);
                navigateToView('registrar-compra');
              }}
            />
          )}
          {currentView === 'cuentas-por-pagar' && (
            <PurchasesView
              initialTab="cuentas"
              onNavigateToView={(v) => navigateToView(v as AppView)}
              onNavigateToPurchaseWithSupplier={(sup) => {
                setSelectedSupplierForPurchase(sup);
                navigateToView('registrar-compra');
              }}
            />
          )}
          {currentView === 'anticipos-proveedores' && (
            <PurchasesView
              initialTab="anticipos"
              onNavigateToView={(v) => navigateToView(v as AppView)}
              onNavigateToPurchaseWithSupplier={(sup) => {
                setSelectedSupplierForPurchase(sup);
                navigateToView('registrar-compra');
              }}
            />
          )}
          {currentView === 'clientes' && <CustomersView onNavigateToView={(v) => navigateToView(v as AppView)} />}
          {currentView === 'separados' && <SeparadosView />}
          {currentView === 'cartera' && <CarteraView />}
          {currentView === 'reportes' && <ReportsView />}
          {currentView === 'medios-pago' && <PaymentMethodsManagementView />}
          {currentView === 'usuarios' && <UsersManagementView />}
          {currentView === 'sucursales' && <BranchesManagementView />}
          {currentView === 'config-mesas' && <RestaurantConfigView />}
          {currentView === 'config-botones' && <MenuButtonsConfigView />}
          {currentView === 'config' && <BranchConfigView onNavigateToButtons={() => navigateToView('config-botones')} />}
          {currentView === 'manual' && <ManualView />}
          {currentView === 'auditoria' && <AuditHistoryView />}
        </>
      )}

      {/* Modal de Confirmación al intentar salir en el primer paso */}
      {showExitConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#181818] border border-[#B77900]/50 p-6 shadow-2xl text-[#FFFDF5] space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-950/60 border border-amber-600/50 text-[#D6A21A] flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#FFFDF5]">
                    ¿Está seguro de salir de la página?
                  </h3>
                  <p className="text-xs text-[#a8a29e] mt-0.5">
                    Ya te encuentras en el inicio del historial de navegación.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExitConfirmModal(false)}
                className="p-1.5 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] text-[#a8a29e] hover:text-white border border-[#383838] cursor-pointer"
                title="Permanecer en la página"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#d6d3d1] leading-relaxed bg-[#141414] border border-[#2b2b2b] rounded-2xl p-3.5">
              Para evitar cierres accidentales o pérdida de pedidos en curso, el sistema protege la salida con el botón Atrás. ¿Deseas permanecer en el sistema o cerrar tu sesión?
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowExitConfirmModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs hover:brightness-110 transition-all shadow cursor-pointer"
              >
                Permanecer en la Página
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowExitConfirmModal(false);
                  await logout();
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-200 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
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
