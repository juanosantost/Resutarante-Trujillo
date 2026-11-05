import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Sparkles,
  Shield,
  Building2,
  LogIn,
  User,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const LoginView: React.FC = () => {
  const {
    loginGoogle,
    loginWithIdentifier,
    bootstrapFirstAdmin,
    branches,
  } = useAuth();
  const { showToast } = useToast();
  const { isLight, toggleTheme } = useTheme();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showBootstrapModal, setShowBootstrapModal] = useState<boolean>(false);
  const [identifierInput, setIdentifierInput] = useState<string>('');
  
  // Datos para registrar primer administrador (vacíos por defecto)
  const [adminName, setAdminName] = useState<string>('');
  const [adminDoc, setAdminDoc] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('');

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifierInput.trim()) {
      showToast('Ingresa tu correo o número de cédula', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      await loginWithIdentifier(identifierInput.trim());
      showToast('¡Sesión iniciada con éxito en Sistema Colmena!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error al iniciar sesión', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await loginGoogle();
      showToast('Sesión iniciada correctamente con Google', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error al iniciar sesión con Google', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName.trim() || !adminDoc.trim() || !adminEmail.trim()) {
      showToast('Por favor completa todos los campos del administrador', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      await bootstrapFirstAdmin({
        fullName: adminName.trim(),
        documentNumber: adminDoc.trim(),
        email: adminEmail.trim(),
      });
      showToast('¡Primer Administrador configurado con éxito!', 'success');
      setShowBootstrapModal(false);
    } catch (err: any) {
      console.error(err);
      showToast('Error al registrar administrador', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0e10] text-[#FFFDF5] flex flex-col justify-center items-center p-4 sm:p-8 relative">
      {/* Botón flotante superior para alternar modo claro / oscuro */}
      <div className="fixed top-4 right-4 z-50">
        <button
          type="button"
          onClick={toggleTheme}
          className={`px-3 py-2 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
            isLight
              ? 'bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-950 shadow-amber-900/10'
              : 'bg-[#181818] hover:bg-[#242424] border-[#383838] text-[#e7e5e4] hover:border-[#d4af37]/60'
          }`}
          title={isLight ? 'Cambiar a Modo Oscuro' : 'Cambiar a Modo Claro'}
        >
          {isLight ? (
            <Moon className="w-4 h-4 text-amber-800" />
          ) : (
            <Sun className="w-4 h-4 text-[#D6A21A]" />
          )}
          <span>{isLight ? 'Modo Oscuro' : 'Modo Claro'}</span>
        </button>
      </div>

      {/* Tarjeta Central de Inicio de Sesión */}
      <div className="w-full max-w-xl bg-[#181818] text-[#FFFDF5] rounded-3xl p-6 sm:p-10 border border-[#B77900]/40 shadow-2xl relative overflow-hidden">
        
        {/* Adorno dorado de fondo */}
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-gradient-to-br from-[#B77900]/20 to-transparent rounded-full blur-2xl pointer-events-none" />

        {/* Encabezado Logo Colmena */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#B77900] via-[#D6A21A] to-[#181818] text-[#FFFDF5] shadow-xl shadow-[#B77900]/30 border border-[#D6A21A]/50 mb-4">
            <span className="font-black text-3xl">⬡</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#FFFDF5] via-[#D6A21A] to-[#B77900]">
            SISTEMA COLMENA
          </h1>
          <p className="text-xs sm:text-sm text-[#D6A21A] font-semibold tracking-widest uppercase mt-1">
            Gastronomía Inteligente · Multisucursal Colombia
          </p>
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#242424] text-[11px] text-[#d6d3d1] border border-[#383838]">
            <Building2 className="w-3.5 h-3.5 text-[#D6A21A]" />
            <span>{branches.length} Sucursales activas</span>
          </div>
        </div>

        {/* Formulario de Inicio de Sesión por Cédula o Correo */}
        <form onSubmit={handleCredentialLogin} className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-[#a8a29e] mb-1">
              Correo Electrónico o Número de Cédula
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-3.5 text-[#D6A21A]" />
              <input
                type="text"
                required
                value={identifierInput}
                onChange={(e) => setIdentifierInput(e.target.value)}
                placeholder="Ingresa tu número de documento o correo registrado"
                className="w-full bg-[#242424] border border-[#383838] rounded-xl pl-10 pr-4 py-3 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
              />
            </div>
            <p className="text-[10px] text-[#88837d] mt-1">
              Solo personal registrado en el sistema puede acceder.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#B77900] via-[#D6A21A] to-[#B77900] hover:brightness-110 text-[#181818] font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#B77900]/25 transition-all cursor-pointer"
          >
            <LogIn className="w-4 h-4 text-[#181818]" />
            <span>{isLoading ? 'Verificando...' : 'Iniciar Sesión'}</span>
          </button>
        </form>

        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#2e2e2e]"></div>
          </div>
          <span className="relative px-3 bg-[#181818] text-[10px] uppercase font-bold text-[#a8a29e]">
            O
          </span>
        </div>

        {/* Botón Google */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full py-3 px-4 rounded-xl bg-[#242424] border border-[#383838] hover:border-[#D6A21A] text-[#FFFDF5] text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <span>Iniciar Sesión con Google</span>
        </button>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setShowBootstrapModal(true)}
            className="text-[11px] text-[#D6A21A] hover:underline font-bold"
          >
            Configurar Primer Administrador (Si la base está vacía)
          </button>
        </div>

      </div>

      {/* Modal: Procedimiento Seguro para el Primer Administrador */}
      {showBootstrapModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#B77900] rounded-2xl w-full max-w-md p-6 text-[#FFFDF5] shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#B77900]/20 border border-[#B77900] flex items-center justify-center text-[#D6A21A]">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-[#FFFDF5]">
                  Asignar Primer Administrador
                </h3>
                <p className="text-xs text-[#a8a29e]">
                  Configura las credenciales maestras de la Colmena.
                </p>
              </div>
            </div>

            <form onSubmit={handleBootstrap} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#a8a29e] mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full bg-[#242424] border border-[#383838] rounded-lg px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a8a29e] mb-1">Número de Documento (C.C.)</label>
                <input
                  type="text"
                  required
                  value={adminDoc}
                  onChange={(e) => setAdminDoc(e.target.value)}
                  placeholder="Ej: 1020304050"
                  className="w-full bg-[#242424] border border-[#383838] rounded-lg px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a8a29e] mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="Ej: admin@colmena.com"
                  className="w-full bg-[#242424] border border-[#383838] rounded-lg px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBootstrapModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#242424] text-xs font-bold text-[#a8a29e] hover:text-[#FFFDF5]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs hover:brightness-110"
                >
                  Guardar Administrador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
