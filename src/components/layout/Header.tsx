import React, { useState, useEffect } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { UserRole } from '../../types';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { auth, loginWithGoogle, logoutUser } from '../../services/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  Store,
  Clock,
  Shield,
  DollarSign,
  ChevronDown,
  UserCheck,
  Building2,
  Sparkles,
  Wifi,
  LogIn,
  LogOut,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    branches,
    currentBranch,
    setCurrentBranchId,
    userRole,
    setUserRole,
    staffName,
    activeShift,
  } = useRestaurant();

  const [colombiaTime, setColombiaTime] = useState<string>('');
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (usr) => {
      setGoogleUser(usr);
    });
    return () => unsub();
  }, []);

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

  const rolesList: { id: UserRole; label: string; desc: string }[] = [
    { id: 'administrador', label: 'Administrador', desc: 'Acceso total al sistema y configuraciones' },
    { id: 'asesor', label: 'Asesor', desc: 'Acceso al apartado operación' },
    { id: 'cocinero', label: 'Cocinero', desc: 'Acceso únicamente a la parte de cocina' },
  ];

  return (
    <header className="bg-[#0e0e12] border-b border-[#2d281e] text-[#faf5ee] sticky top-0 z-40 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2">
          
          {/* Logo y Marca Colmena */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-[#d4af37] via-[#b89728] to-[#6c5411] text-[#0e0e12] shadow-lg shadow-[#d4af37]/20 border border-[#fef3c7]/30">
              <span className="font-extrabold text-2xl tracking-tighter">⬡</span>
              <Sparkles className="w-3.5 h-3.5 absolute top-1 right-1 text-[#fef3c7] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#fef3c7] via-[#d4af37] to-[#e6ca65]">
                  COLMENA
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-[#2a2213] text-[#d4af37] border border-[#d4af37]/40 hidden sm:inline-block">
                  Restaurante POS
                </span>
              </div>
              <p className="text-[11px] text-[#a8a29e] hidden md:block">
                Multisucursal · Tiempo Real · Colombia (COP)
              </p>
            </div>
          </div>

          {/* Selector de Sucursal */}
          <div className="hidden lg:flex items-center bg-[#17171f] border border-[#383124] rounded-lg px-3 py-1.5 gap-2">
            <Building2 className="w-4 h-4 text-[#d4af37]" />
            <div className="text-left">
              <span className="block text-[10px] text-[#a8a29e] uppercase font-semibold">Sucursal Activa</span>
              <select
                aria-label="Seleccionar Sucursal"
                value={currentBranch?.id || ''}
                onChange={(e) => setCurrentBranchId(e.target.value)}
                className="bg-transparent text-sm font-medium text-[#fef3c7] focus:outline-none cursor-pointer pr-2"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-[#17171f] text-[#faf5ee]">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reloj Colombia & Estado de Conexión */}
          <div className="hidden sm:flex items-center gap-4 bg-[#14141b] border border-[#2d281e] px-3.5 py-1.5 rounded-lg">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#d4af37]" />
              <div className="text-right">
                <span className="block text-[9px] text-[#a8a29e] uppercase">Bogotá (UTC-5)</span>
                <span className="text-xs font-mono font-semibold text-[#fef3c7]">{colombiaTime || '12:00:00 PM'}</span>
              </div>
            </div>
            <div className="h-6 w-[1px] bg-[#2d281e]" />
            <div className="flex items-center gap-1.5" title="Conexión en tiempo real activa">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] text-emerald-400 font-medium">En línea</span>
            </div>
          </div>

          {/* Estado de Turno de Caja */}
          <div className="hidden md:flex items-center bg-[#181611] border border-[#4d3d19] rounded-lg px-3 py-1.5 gap-2">
            <DollarSign className="w-4 h-4 text-[#d4af37]" />
            <div>
              <span className="block text-[9px] text-[#a8a29e] uppercase font-semibold">Caja Hoy</span>
              <span className="text-xs font-bold text-[#d4af37]">
                {activeShift ? `Turno Abierto · ${formatCOP(activeShift.expectedCash)}` : 'Caja Cerrada'}
              </span>
            </div>
          </div>

          {/* Selector de Rol de Usuario (Staff) */}
          <div className="flex items-center gap-2">
            <div className="relative group">
              <button
                type="button"
                className="flex items-center gap-2 bg-gradient-to-r from-[#201c14] to-[#18171d] hover:border-[#d4af37] border border-[#3f3521] rounded-lg px-3 py-1.5 text-xs text-[#fef3c7] transition-all shadow"
              >
                <div className="w-6 h-6 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/50 flex items-center justify-center text-[#d4af37] font-bold text-xs">
                  {userRole[0].toUpperCase()}
                </div>
                <div className="text-left hidden xs:block">
                  <span className="block text-[9px] text-[#a8a29e] uppercase font-semibold">Rol Activo</span>
                  <span className="font-semibold capitalize text-[#fef3c7]">{userRole}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#d4af37]" />
              </button>

              {/* Menú desplegable para cambiar de rol para pruebas y operaciones */}
              <div className="absolute right-0 mt-1 w-56 bg-[#17171f] border border-[#3f3521] rounded-xl shadow-2xl py-2 hidden group-hover:block group-focus-within:block z-50">
                <div className="px-3 py-1.5 border-b border-[#2d281e]">
                  <p className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider">Cambiar Perfil de Operación</p>
                  <p className="text-xs font-medium text-[#fef3c7] truncate">{staffName}</p>
                </div>
                {rolesList.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setUserRole(r.id)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                      userRole === r.id
                        ? 'bg-[#2b2416] text-[#d4af37] font-bold border-l-2 border-[#d4af37]'
                        : 'text-[#d6d3d1] hover:bg-[#201f28]'
                    }`}
                  >
                    <div>
                      <div className="capitalize">{r.label}</div>
                      <div className="text-[10px] text-[#a8a29e] font-normal">{r.desc}</div>
                    </div>
                    {userRole === r.id && <UserCheck className="w-3.5 h-3.5 text-[#d4af37]" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Google Authentication */}
            {googleUser ? (
              <div className="flex items-center gap-2 bg-[#1b1924] border border-[#3b354d] px-2.5 py-1.5 rounded-lg text-xs">
                {googleUser.photoURL ? (
                  <img
                    src={googleUser.photoURL}
                    alt={googleUser.displayName || 'Usuario'}
                    className="w-5 h-5 rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-[#d4af37] text-[#0e0e12] flex items-center justify-center font-bold text-[10px]">
                    {googleUser.email?.[0].toUpperCase()}
                  </div>
                )}
                <span className="text-[11px] text-[#fef3c7] font-semibold hidden md:inline max-w-[120px] truncate">
                  {googleUser.displayName || googleUser.email}
                </span>
                <button
                  type="button"
                  onClick={() => logoutUser()}
                  className="text-[#a8a29e] hover:text-red-400 p-0.5"
                  title="Cerrar sesión de Google"
                  aria-label="Cerrar sesión de Google"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => loginWithGoogle().catch(() => {})}
                className="hidden sm:flex items-center gap-1.5 bg-[#17161f] hover:bg-[#22202c] border border-[#383124] px-2.5 py-1.5 rounded-lg text-xs text-[#d4af37] font-semibold cursor-pointer transition-all"
                title="Acceder con Google"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Google</span>
              </button>
            )}
          </div>

        </div>

        {/* Barra móvil para sucursal */}
        <div className="lg:hidden py-2 border-t border-[#232019] flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-[#a8a29e]">
            <Building2 className="w-3.5 h-3.5 text-[#d4af37]" />
            <select
              aria-label="Seleccionar Sucursal Móvil"
              value={currentBranch?.id || ''}
              onChange={(e) => setCurrentBranchId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#fef3c7] focus:outline-none"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="bg-[#17171f] text-[#faf5ee]">
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="text-[11px] text-[#d4af37] font-semibold">
            {colombiaTime} (Bogotá)
          </div>
        </div>

      </div>
    </header>
  );
};
