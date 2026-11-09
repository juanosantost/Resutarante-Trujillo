import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import { useMenuConfig } from '../../context/MenuConfigContext';
import { normalizeUserRole } from '../../utils/auth';
import {
  LayoutGrid,
  ClipboardList,
  Flame,
  Receipt,
  Boxes,
  Users,
  Building2,
  Building,
  Home,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Clock,
  Sparkles,
  Sliders,
  DollarSign,
  ChevronDown,
  Settings,
  UtensilsCrossed,
  Bike,
  Truck,
  BarChart3,
  MapPin,
  BookmarkCheck,
  CreditCard,
  TrendingUp,
  Pin,
  PinOff,
  PanelLeft,
  BookOpen,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export type AppView =
  | 'home'
  | 'manual'
  | 'mesas'
  | 'catalogo'
  | 'pedidos'
  | 'domicilios'
  | 'cocina'
  | 'caja'
  | 'ingresos'
  | 'otros-ingresos'
  | 'inventario'
  | 'compras'
  | 'proveedores'
  | 'cuentas-por-pagar'
  | 'anticipos-proveedores'
  | 'desembolsos'
  | 'registrar-gasto'
  | 'registrar-compra'
  | 'clientes'
  | 'separados'
  | 'cartera'
  | 'reportes'
  | 'usuarios'
  | 'sucursales'
  | 'config'
  | 'config-mesas'
  | 'config-botones'
  | 'medios-pago';

interface AppLayoutProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentView,
  onNavigate,
  children,
}) => {
  const {
    currentUser,
    branches,
    currentBranch,
    authorizedBranches,
    setCurrentBranchId,
    logout,
    canAccess,
  } = useAuth();
  const { tables, activeOrders, activeComandas, inventory, activeShift, separados, cartera } = useRestaurant();
  const { showToast } = useToast();
  const { isLight, toggleTheme } = useTheme();

  // Estado para la navbar: oculta para aprovechar el 100% de la pantalla en escritorio y móvil
  const [isNavOpen, setIsNavOpen] = useState<boolean>(false);
  const [isNavPinned, setIsNavPinned] = useState<boolean>(() => {
    try {
      return localStorage.getItem('colmena_nav_pinned') === 'true';
    } catch {
      return false;
    }
  });
  const [colombiaTime, setColombiaTime] = useState<string>('');
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);

  const togglePinNav = () => {
    const next = !isNavPinned;
    setIsNavPinned(next);
    try {
      localStorage.setItem('colmena_nav_pinned', String(next));
    } catch {}
    if (next) {
      setIsNavOpen(true);
      showToast('Menú lateral fijado en pantalla', 'info');
    } else {
      showToast('Menú configurado para auto-ocultarse al seleccionar opciones', 'info');
    }
  };

  // Atajo de teclado: Escape cierra la navbar si está abierta como overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isNavOpen && !isNavPinned) {
        setIsNavOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNavOpen, isNavPinned]);

  // Reloj oficial de Colombia (America/Bogota, UTC-5)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setColombiaTime(
        new Intl.DateTimeFormat('es-CO', {
          timeZone: 'America/Bogota',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(now)
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Conteos en tiempo real para badges
  const occupiedTables = tables.filter(
    (t) => t.status === 'ocupada' || t.status === 'cuenta_solicitada'
  ).length;
  const pendingComandas = activeComandas.filter(
    (c) => c.status === 'nueva' || c.status === 'en_preparacion'
  ).length;
  const lowStockItems = inventory.filter((i) => !i.isDeleted && i.currentStock <= i.minStock).length;
  const activeSeparadosCount = separados.filter((s) => s.status === 'activo').length;
  const pendingCarteraCount = cartera.filter(
    (c) => (c.status === 'vigente' || c.status === 'vencida') && c.balanceDue > 0
  ).length;

  const handleLogout = async () => {
    try {
      await logout();
      showToast('Sesión cerrada correctamente', 'info');
    } catch (err: any) {
      console.error(err);
      showToast('Error al cerrar sesión', 'error');
    }
  };

  const handleBranchSelect = (branchId: string) => {
    try {
      setCurrentBranchId(branchId);
      const b = branches.find((x) => x.id === branchId);
      showToast(`Cambiado a sucursal: ${b?.name || branchId}`, 'info');
    } catch (err: any) {
      showToast(err.message || 'No autorizado para esta sucursal', 'error');
    }
  };

  const { menuConfig } = useMenuConfig();
  const normRole = normalizeUserRole(currentUser?.role);

  // Mapeo dinámico de componentes de iconos Lucide
  const ICON_MAP: Record<string, any> = {
    Home,
    ClipboardList,
    LayoutGrid,
    Flame,
    Bike,
    Receipt,
    TrendingUp,
    UtensilsCrossed,
    Boxes,
    DollarSign,
    Building,
    CreditCard,
    Users,
    BookmarkCheck,
    BarChart3,
    Building2,
    Settings,
    Sliders,
    BookOpen,
  };

  // Construir secciones visibles y ordenadas dinámicamente según configuración de administración y rol
  const sortedSections = [...(menuConfig.sections || [])].sort((a, b) => a.order - b.order);

  const visibleSections = sortedSections
    .map((sec) => {
      // Filtrar y ordenar botones asignados a esta sección
      const items = (menuConfig.buttons || [])
        .filter((btn) => {
          if (btn.sectionId !== sec.id) return false;
          if (btn.isVisible === false) return false;
          return Array.isArray(btn.allowedRoles) && btn.allowedRoles.includes(normRole);
        })
        .sort((a, b) => a.order - b.order)
        .map((btn) => {
          // Resolver insignias numéricas y de alerta dinámicamente
          let badge: string | number | undefined = undefined;
          let badgeColor: string | undefined = undefined;

          if (btn.badgeType === 'activeOrders' && activeOrders.length > 0) {
            badge = activeOrders.length;
            badgeColor = 'bg-[#292212] text-[#D6A21A] border border-[#B77900]/40';
          } else if (btn.badgeType === 'occupiedTables' && occupiedTables > 0) {
            badge = `${occupiedTables}/${tables.length}`;
            badgeColor = 'bg-[#B77900] text-[#181818]';
          } else if (btn.badgeType === 'pendingComandas' && pendingComandas > 0) {
            badge = pendingComandas;
            badgeColor = 'bg-amber-600 text-white animate-pulse';
          } else if (btn.badgeType === 'lowStock' && lowStockItems > 0) {
            badge = `! ${lowStockItems}`;
            badgeColor = 'bg-red-900/80 text-red-200 border border-red-700/50';
          } else if (btn.id === 'separados' && activeSeparadosCount > 0) {
            badge = activeSeparadosCount;
            badgeColor = 'bg-[#292212] text-[#D6A21A] border border-[#B77900]/40';
          } else if (btn.id === 'cartera' && pendingCarteraCount > 0) {
            badge = pendingCarteraCount;
            badgeColor = 'bg-[#292212] text-[#D6A21A] border border-[#B77900]/40';
          } else if (btn.badgeText) {
            badge = btn.badgeText;
            badgeColor = 'bg-[#B77900] text-[#181818]';
          }

          return {
            id: btn.id as AppView,
            label: btn.label,
            icon: ICON_MAP[btn.iconName] || Home,
            badge,
            badgeColor,
            moduleKey: btn.id,
          };
        });

      return {
        sectionTitle: sec.title,
        items,
      };
    })
    .filter((sec) => sec.items.length > 0);

  const getRoleDisplayName = (role: string = '') => {
    const norm = normalizeUserRole(role);
    switch (norm) {
      case 'administrador':
        return 'Administrador';
      case 'asesor':
        return 'Asesor';
      case 'cocinero':
        return 'Cocinero';
      default:
        return 'Personal';
    }
  };

  const getRoleBadgeColor = (role: string = '') => {
    const norm = normalizeUserRole(role);
    switch (norm) {
      case 'administrador':
        return 'bg-[#292212] text-[#D6A21A] border-[#B77900]';
      case 'asesor':
        return 'bg-blue-950 text-blue-300 border-blue-800';
      case 'cocinero':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      default:
        return 'bg-[#242424] text-[#a8a29e] border-[#383838]';
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0e10] text-[#FFFDF5] flex flex-col antialiased selection:bg-[#B77900] selection:text-[#FFFDF5]">
      
      {/* 1. Encabezado Superior Fijo */}
      <header className="bg-[#181818] border-b border-[#333333] text-[#FFFDF5] sticky top-0 z-40 shadow-lg">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20 gap-3">
            
            {/* Lado Izquierdo: Botón Menú Móvil + Logo Colmena */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsNavOpen(!isNavOpen)}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-[#242424] hover:bg-[#2d2d2d] text-[#D6A21A] hover:text-[#FFFDF5] border border-[#383838] flex items-center gap-2 cursor-pointer shadow-sm transition-all focus:outline-none"
                aria-label={isNavOpen ? 'Ocultar menú' : 'Abrir menú'}
                title={isNavOpen ? 'Ocultar menú lateral (Pantalla completa)' : 'Desplegar menú lateral'}
              >
                {isNavOpen ? <X className="w-5 h-5 text-amber-400" /> : <Menu className="w-5 h-5" />}
                <span className="text-xs font-bold hidden sm:inline">
                  {isNavOpen ? 'Ocultar Menú' : 'Menú'}
                </span>
              </button>

              <div
                onClick={() => onNavigate('home')}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-[#B77900] via-[#D6A21A] to-[#181818] text-[#FFFDF5] shadow-lg shadow-[#B77900]/25 border border-[#D6A21A]/40 group-hover:scale-105 transition-transform">
                  <span className="font-black text-2xl tracking-tighter">⬡</span>
                  <Sparkles className="w-3.5 h-3.5 absolute top-1 right-1 text-[#FFFDF5] animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg sm:text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#FFFDF5] via-[#D6A21A] to-[#B77900]">
                      COLMENA
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-[#292212] text-[#D6A21A] border border-[#B77900]/40 hidden sm:inline-block">
                      Restaurante POS
                    </span>
                  </div>
                  <p className="text-[11px] text-[#a8a29e] hidden md:block">
                    Multisucursal · Tiempo Real · Colombia (COP)
                  </p>
                </div>
              </div>
            </div>

            {/* Centro: Sede Única — Guadalajara de Buga */}
            <div className="hidden md:flex items-center bg-[#242424] border border-[#383838] rounded-2xl px-3.5 py-1.5 gap-2.5 shadow-sm">
              <MapPin className="w-4 h-4 text-[#D6A21A] shrink-0" />
              <div className="text-left">
                <span className="block text-[9px] text-[#a8a29e] uppercase font-bold tracking-wider">
                  Sede Oficial
                </span>
                <span className="text-xs font-black text-[#FFFDF5]">
                  Guadalajara de Buga (Valle del Cauca)
                </span>
              </div>
            </div>

            {/* Lado Derecho: Botón Tema Claro/Oscuro, Manual y Cerrar Sesión */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-950 shadow-sm'
                    : 'bg-[#242424] hover:bg-[#2e2e2e] border-[#383838] text-[#e7e5e4] hover:border-[#d4af37]/60'
                }`}
                title={isLight ? 'Cambiar a Modo Oscuro' : 'Cambiar a Modo Claro'}
              >
                {isLight ? (
                  <Moon className="w-3.5 h-3.5 text-amber-800" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-[#D6A21A]" />
                )}
                <span className="hidden sm:inline">{isLight ? 'Modo Oscuro' : 'Modo Claro'}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('manual')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentView === 'manual'
                    ? 'bg-[#2b2416] border-[#d4af37] text-[#fef3c7]'
                    : 'bg-[#242424] hover:bg-[#2e2e2e] border-[#383838] text-[#e7e5e4] hover:border-[#d4af37]/60'
                }`}
                title="Manual de Usuario e Inducción Paso a Paso"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#D6A21A]" />
                <span className="hidden sm:inline">Manual</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5 text-red-400" />
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </button>
            </div>

          </div>

          {/* Barra móvil para sede, tema y hora oficial */}
          <div className="md:hidden py-2 border-t border-[#2e2e2e] flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-[#a8a29e]">
              <MapPin className="w-3.5 h-3.5 text-[#D6A21A]" />
              <span className="text-xs font-bold text-[#FFFDF5]">Guadalajara de Buga</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className={`px-2 py-1 rounded-lg border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-amber-100 border-amber-300 text-amber-950'
                    : 'bg-[#242424] border-[#383838] text-[#D6A21A]'
                }`}
                title={isLight ? 'Modo Oscuro' : 'Modo Claro'}
              >
                {isLight ? <Moon className="w-3.5 h-3.5 text-amber-800" /> : <Sun className="w-3.5 h-3.5 text-[#D6A21A]" />}
                <span className="text-[10px] font-semibold">{isLight ? 'Oscuro' : 'Claro'}</span>
              </button>
              <div className="text-[11px] text-[#D6A21A] font-mono font-semibold">
                {colombiaTime} (Buga)
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* 2. Cuerpo Principal: Navbar Ocultable + Contenido Central a Pantalla Completa */}
      <div className="flex-1 flex w-full relative">

        {/* Barra Lateral Fijada (cuando el usuario decide anclarla en escritorio) */}
        {isNavPinned && (
          <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-[#181818] border-r border-[#333333] sticky top-20 h-[calc(100vh-5rem)] z-30 transition-all">
            <div className="p-3 border-b border-[#2e2e2e] flex items-center justify-between text-xs">
              <span className="text-[10px] uppercase font-bold text-[#D6A21A] flex items-center gap-1.5">
                <PanelLeft className="w-3.5 h-3.5" />
                <span>Navegación Fija</span>
              </span>
              <button
                type="button"
                onClick={togglePinNav}
                className="p-1.5 rounded-lg bg-[#242424] hover:bg-[#2d2d2d] text-[#a8a29e] hover:text-[#D6A21A] border border-[#383838] transition-colors cursor-pointer"
                title="Desfijar para auto-ocultar menú y aprovechar toda la pantalla"
              >
                <PinOff className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
              {visibleSections.map((sec) => (
                <div key={sec.sectionTitle} className="space-y-1">
                  <div className="px-2 pt-2 pb-1 text-[10px] font-black uppercase tracking-wider text-[#D6A21A]/80 border-b border-[#292212]">
                    {sec.sectionTitle}
                  </div>
                  {sec.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onNavigate(item.id)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer group ${
                          isActive
                            ? 'bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] shadow-md shadow-[#B77900]/20'
                            : 'text-[#d6d3d1] hover:text-[#FFFDF5] hover:bg-[#242424]'
                        }`}
                        title={item.label}
                      >
                        <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-[#181818]' : 'text-[#D6A21A]'}`} />
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {item.badge && (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${item.badgeColor || 'bg-[#292212] text-[#D6A21A]'}`}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Pie de barra fijada con botón de tema */}
            <div className="p-3 border-t border-[#2e2e2e] shrink-0">
              <button
                type="button"
                onClick={toggleTheme}
                className={`w-full flex items-center justify-center gap-2 p-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                  isLight
                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300 shadow-sm'
                    : 'bg-[#242424] hover:bg-[#2e2e2e] text-[#d6d3d1] border-[#383838] hover:border-[#d4af37]/60'
                }`}
                title={isLight ? 'Cambiar a Modo Oscuro' : 'Cambiar a Modo Claro'}
              >
                {isLight ? (
                  <Moon className="w-3.5 h-3.5 text-amber-800" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-[#D6A21A]" />
                )}
                <span>{isLight ? 'Modo Oscuro' : 'Modo Claro'}</span>
              </button>
            </div>
          </aside>
        )}

        {/* Navbar Desplegable Flotante (Escritorio y Móvil): Se abre con el botón Menú y se oculta automáticamente al seleccionar cualquier opción */}
        {isNavOpen && !isNavPinned && (
          <div className="fixed inset-0 z-50 flex">
            {/* Backdrop oscuro translúcido */}
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
              onClick={() => setIsNavOpen(false)}
            />

            {/* Panel Lateral Flotante */}
            <div className="relative w-72 sm:w-80 max-w-[85vw] bg-[#181818] border-r border-[#B77900]/60 text-[#FFFDF5] flex flex-col p-4 shadow-2xl z-10 animate-in slide-in-from-left duration-200">
              {/* Encabezado del Menú */}
              <div className="flex items-center justify-between pb-3 border-b border-[#2e2e2e] mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#B77900] to-[#D6A21A] flex items-center justify-center text-[#181818] font-black shadow">
                    ⬡
                  </div>
                  <div>
                    <span className="font-black text-sm text-[#FFFDF5] block leading-tight">COLMENA RESTAURANTE</span>
                    <span className="text-[10px] text-[#D6A21A] font-bold block">Menú del Sistema</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {/* Botón para fijar menú en pantalla (opcional) */}
                  <button
                    type="button"
                    onClick={togglePinNav}
                    className="p-1.5 rounded-xl bg-[#242424] hover:bg-[#2d2d2d] text-[#a8a29e] hover:text-[#D6A21A] border border-[#383838] transition-colors cursor-pointer"
                    title="Fijar menú permanente en pantalla"
                  >
                    <Pin className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNavOpen(false)}
                    className="p-1.5 rounded-xl bg-[#242424] hover:bg-[#2d2d2d] text-[#a8a29e] hover:text-[#FFFDF5] border border-[#383838] transition-colors cursor-pointer"
                    title="Cerrar menú (Escape)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Mensaje informativo */}
              <div className="px-3 py-1.5 rounded-xl bg-[#242424]/90 border border-[#383838] mb-3 text-[11px] text-[#D6A21A] flex items-center justify-between">
                <span>Al seleccionar una opción el menú se oculta automáticamente.</span>
              </div>

              {/* Lista de Secciones y Opciones */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {visibleSections.map((sec) => (
                  <div key={sec.sectionTitle} className="space-y-1">
                    <div className="px-2 pt-2 pb-1 text-[10px] font-black uppercase tracking-wider text-[#D6A21A]/80 border-b border-[#292212]">
                      {sec.sectionTitle}
                    </div>
                    {sec.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = currentView === item.id;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            onNavigate(item.id);
                            // Al seleccionar algo, ocultar la navbar automáticamente para aprovechar mejor el tamaño de la pantalla
                            if (!isNavPinned) {
                              setIsNavOpen(false);
                            }
                          }}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                            isActive
                              ? 'bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] shadow-md shadow-[#B77900]/20'
                              : 'text-[#d6d3d1] hover:text-[#FFFDF5] hover:bg-[#242424]'
                          }`}
                        >
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-transform ${
                              isActive ? 'text-[#181818]' : 'text-[#D6A21A]'
                            }`}
                          />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && (
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                                item.badgeColor || 'bg-[#292212] text-[#D6A21A]'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Tema, Manual y Cerrar Sesión en pie del drawer */}
              <div className="pt-3 border-t border-[#2e2e2e] mt-3 space-y-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                    isLight
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300 shadow-sm'
                      : 'bg-[#242424] hover:bg-[#2e2e2e] text-[#d6d3d1] border-[#383838] hover:border-[#d4af37]/60'
                  }`}
                  title={isLight ? 'Cambiar a Modo Oscuro' : 'Cambiar a Modo Claro'}
                >
                  {isLight ? (
                    <Moon className="w-4 h-4 text-amber-800" />
                  ) : (
                    <Sun className="w-4 h-4 text-[#D6A21A]" />
                  )}
                  <span>{isLight ? 'Cambiar a Modo Oscuro' : 'Cambiar a Modo Claro'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onNavigate('manual');
                    if (!isNavPinned) setIsNavOpen(false);
                  }}
                  className={`w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                    currentView === 'manual'
                      ? 'bg-[#2b2416] text-[#fef3c7] border-[#d4af37]'
                      : 'bg-[#242424] hover:bg-[#2e2e2e] text-[#d6d3d1] border-[#383838] hover:border-[#d4af37]/60'
                  }`}
                >
                  <BookOpen className="w-4 h-4 text-[#D6A21A]" />
                  <span>Manual de Usuario</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsNavOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-red-950/40 hover:bg-red-950/70 text-red-300 border border-red-800 text-xs font-bold cursor-pointer transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Área Principal de Contenido (Aprovechamiento máximo de pantalla) */}
        <main className="flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-4">
          
          {/* Barra Superior de Estado, Reloj y Perfil de Usuario (Ubicada fuera del Header) */}
          <div className="bg-[#181818] border border-[#333333] text-[#FFFDF5] rounded-2xl p-3 sm:px-4 sm:py-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
            
            {/* Usuario Autenticado y Rol */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#B77900] to-[#D6A21A] text-[#181818] flex items-center justify-center font-black text-sm shrink-0 shadow">
                {currentUser?.fullName?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs sm:text-sm text-[#FFFDF5]">
                    {currentUser?.fullName || 'Usuario'}
                  </span>
                  <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-full border ${getRoleBadgeColor(currentUser?.role)}`}>
                    {getRoleDisplayName(currentUser?.role)}
                  </span>
                </div>
                <p className="text-[11px] text-[#a8a29e] flex items-center gap-2 font-mono">
                  <span>C.C. {currentUser?.documentNumber || '—'}</span>
                  <span>·</span>
                  <span>{currentUser?.email}</span>
                </p>
              </div>
            </div>

            {/* Reloj Oficial Bogotá y Estado de Caja */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              {/* Indicador de Turno de Caja */}
              <div className="flex items-center gap-2 bg-[#242424] border border-[#383838] px-3 py-1.5 rounded-xl">
                <DollarSign className="w-3.5 h-3.5 text-[#D6A21A]" />
                <div className="text-left">
                  <span className="block text-[8px] text-[#a8a29e] uppercase font-bold tracking-wider">
                    Estado Caja
                  </span>
                  <span className="text-xs font-bold text-[#D6A21A]">
                    {activeShift ? 'Turno Abierto' : 'Caja Cerrada'}
                  </span>
                </div>
              </div>

              {/* Reloj Oficial Colombia */}
              <div className="flex items-center gap-2 bg-[#242424] border border-[#383838] px-3 py-1.5 rounded-xl">
                <Clock className="w-3.5 h-3.5 text-[#D6A21A]" />
                <div className="text-right">
                  <span className="block text-[8px] text-[#a8a29e] uppercase font-bold tracking-wider">
                    Bogotá (UTC-5)
                  </span>
                  <span className="text-xs font-mono font-bold text-[#FFFDF5]">
                    {colombiaTime || '12:00:00 PM'}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {children}
        </main>

      </div>

      {/* 3. Footer Oficial Colmena */}
      <footer className="bg-[#181818] border-t border-[#333333] py-4 text-xs text-[#a8a29e]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[#D6A21A] font-bold">⬡ Sistema Colmena Restaurante</span>
            <span className="text-[#44403c]">·</span>
            <span className="text-[#FFFDF5] font-semibold">{currentBranch?.name}</span>
            <span className="text-[#44403c]">·</span>
            <span>NIT: {currentBranch?.nit || '901.458.920-4'}</span>
          </div>
          <div className="text-[11px] text-[#78716c]">
            Pesos Colombianos (COP) · Zona Horaria: America/Bogota (UTC-5) · Impoconsumo 8%
          </div>
        </div>
      </footer>

    </div>
  );
};
