import React, { useState, useMemo } from 'react';
import { useMenuConfig } from '../../context/MenuConfigContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { AppView } from '../layout/AppLayout';
import { UserRoleName, MenuButtonItemConfig } from '../../types/menuConfig';
import {
  Sliders,
  Save,
  RotateCcw,
  Search,
  Eye,
  ArrowUp,
  ArrowDown,
  Plus,
  Shield,
  ShieldCheck,
  Check,
  X,
  LayoutGrid,
  ClipboardList,
  Flame,
  Receipt,
  Boxes,
  Users,
  Building2,
  Building,
  Home,
  DollarSign,
  TrendingUp,
  UtensilsCrossed,
  Bike,
  BarChart3,
  CreditCard,
  BookmarkCheck,
  Settings,
  FolderPlus,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
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
};

export const MenuButtonsConfigView: React.FC = () => {
  const {
    menuConfig,
    isSaving,
    saveMenuConfig,
    resetToDefault,
    updateButtonItem,
    updateButtonSection,
    moveButtonOrder,
    toggleRoleForButton,
    addSection,
    removeSection,
    moveSectionOrder,
  } = useMenuConfig();

  const { showToast } = useToast();
  const { currentUser } = useAuth();

  // Filtros y modo de previsualización
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewRole, setPreviewRole] = useState<'all' | UserRoleName>('all');
  const [filterSection, setFilterSection] = useState<string>('all');

  // Modal para agregar nueva sección
  const [showAddSectionModal, setShowAddSectionModal] = useState<boolean>(false);
  const [newSectionTitle, setNewSectionTitle] = useState<string>('');
  const [newSectionDesc, setNewSectionDesc] = useState<string>('');

  // Modal para confirmar restablecimiento
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);

  // Secciones ordenadas
  const sortedSections = useMemo(() => {
    return [...menuConfig.sections].sort((a, b) => a.order - b.order);
  }, [menuConfig.sections]);

  // Botones agrupados por sección y filtrados
  const filteredButtonsBySection = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return sortedSections.map((sec) => {
      let buttons = menuConfig.buttons.filter((b) => b.sectionId === sec.id);

      // Filtro de búsqueda
      if (query) {
        buttons = buttons.filter(
          (b) =>
            b.label.toLowerCase().includes(query) ||
            b.id.toLowerCase().includes(query) ||
            (b.description || '').toLowerCase().includes(query)
        );
      }

      // Ordenar por orden numérico
      buttons = [...buttons].sort((a, b) => a.order - b.order);

      return {
        section: sec,
        buttons,
      };
    });
  }, [sortedSections, menuConfig.buttons, searchQuery]);

  // Conteos estadísticos de roles
  const stats = useMemo(() => {
    const total = menuConfig.buttons.length;
    const adminCount = menuConfig.buttons.filter((b) => b.isVisible && b.allowedRoles.includes('administrador')).length;
    const asesorCount = menuConfig.buttons.filter((b) => b.isVisible && b.allowedRoles.includes('asesor')).length;
    const cocineroCount = menuConfig.buttons.filter((b) => b.isVisible && b.allowedRoles.includes('cocinero')).length;

    return { total, adminCount, asesorCount, cocineroCount };
  }, [menuConfig.buttons]);

  // Manejar creación de nueva sección
  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionTitle.trim()) {
      showToast('Por favor escribe un nombre para la sección', 'error');
      return;
    }
    try {
      await addSection(newSectionTitle, newSectionDesc);
      showToast(`Sección "${newSectionTitle.toUpperCase()}" creada correctamente`, 'success');
      setNewSectionTitle('');
      setNewSectionDesc('');
      setShowAddSectionModal(false);
    } catch (err: any) {
      showToast(err.message || 'Error al crear sección', 'error');
    }
  };

  // Manejar guardar cambios
  const handleSaveAll = async () => {
    try {
      await saveMenuConfig(menuConfig, currentUser?.fullName || 'Administrador');
      showToast('Configuración de menú y botones guardada exitosamente en el sistema', 'success');
    } catch (err: any) {
      showToast('Error al guardar la configuración en base de datos', 'error');
    }
  };

  // Manejar restablecer valores predeterminados
  const handleConfirmReset = async () => {
    try {
      await resetToDefault(currentUser?.fullName || 'Administrador');
      showToast('Menú y permisos restablecidos a los valores estándar de fábrica', 'info');
      setShowResetConfirmModal(false);
    } catch (err: any) {
      showToast('Error al restablecer configuración', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Encabezado Principal */}
      <div className="bg-[#181818] p-5 sm:p-6 rounded-3xl border border-[#383838] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-[#B77900]/10 via-transparent to-transparent pointer-events-none rounded-full blur-3xl -mr-20 -mt-20" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#B77900] via-[#D6A21A] to-[#181818] text-[#181818] flex items-center justify-center font-black shadow-lg shadow-[#B77900]/25 shrink-0 border border-[#D6A21A]/40">
              <Sliders className="w-6 h-6 text-[#181818]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-[#FFFDF5] tracking-tight">
                  Configuración de Menú y Botones
                </h1>
                <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-[#292212] text-[#D6A21A] border border-[#B77900]/50 hidden sm:inline-block">
                  Administración POS
                </span>
              </div>
              <p className="text-xs text-[#d6d3d1] mt-1 leading-relaxed">
                Controla dónde va cada botón (sección), el orden de visualización en la navegación y qué roles pueden ver y acceder a cada módulo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setShowResetConfirmModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-[#242424] hover:bg-[#2d2d2d] text-[#a8a29e] hover:text-[#FFFDF5] border border-[#383838] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Restablecer diseño y permisos originales"
            >
              <RotateCcw className="w-4 h-4 text-amber-500" />
              <span className="hidden sm:inline">Restablecer</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddSectionModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-[#242424] hover:bg-[#2d2d2d] text-[#D6A21A] hover:text-[#FFFDF5] border border-[#B77900]/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Nueva Sección</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] hover:brightness-110 text-[#181818] font-black text-xs flex items-center gap-2 shadow-lg shadow-[#B77900]/20 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Guardando...' : 'Guardar Configuración'}</span>
            </button>
          </div>
        </div>

        {/* 2. Tarjetas Resumen de Roles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-[#2e2e2e]">
          <div className="bg-[#242424]/90 p-3 rounded-2xl border border-[#383838]">
            <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">Botones Configurados</span>
            <span className="text-lg font-black text-[#FFFDF5] mt-0.5 block">{stats.total} módulos</span>
            <span className="text-[10px] text-[#78716c]">En {menuConfig.sections.length} secciones activas</span>
          </div>

          <div className="bg-[#292212]/70 p-3 rounded-2xl border border-[#B77900]/40">
            <span className="text-[10px] uppercase font-bold text-[#D6A21A] flex items-center gap-1">
              <span>👑 Administrador</span>
            </span>
            <span className="text-lg font-black text-[#FFFDF5] mt-0.5 block">{stats.adminCount} visibles</span>
            <span className="text-[10px] text-[#D6A21A]/80">Acceso total por perfil</span>
          </div>

          <div className="bg-blue-950/40 p-3 rounded-2xl border border-blue-900/60">
            <span className="text-[10px] uppercase font-bold text-blue-300 flex items-center gap-1">
              <span>👔 Asesor</span>
            </span>
            <span className="text-lg font-black text-[#FFFDF5] mt-0.5 block">{stats.asesorCount} visibles</span>
            <span className="text-[10px] text-blue-300/80">Atención comercial y caja</span>
          </div>

          <div className="bg-emerald-950/40 p-3 rounded-2xl border border-emerald-900/60">
            <span className="text-[10px] uppercase font-bold text-emerald-300 flex items-center gap-1">
              <span>🍳 Cocinero</span>
            </span>
            <span className="text-lg font-black text-[#FFFDF5] mt-0.5 block">{stats.cocineroCount} visibles</span>
            <span className="text-[10px] text-emerald-300/80">Monitor KDS y pedidos</span>
          </div>
        </div>
      </div>

      {/* 3. Barra de Filtros y Selector de Previsualización en Tiempo Real */}
      <div className="bg-[#181818] p-4 rounded-2xl border border-[#383838] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-lg">
        {/* Selector de Previsualización */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-xs font-bold text-[#a8a29e] flex items-center gap-1.5 shrink-0 pr-1">
            <Eye className="w-4 h-4 text-[#D6A21A]" />
            <span className="hidden sm:inline">Vista previa:</span>
          </span>

          <button
            type="button"
            onClick={() => setPreviewRole('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              previewRole === 'all'
                ? 'bg-[#B77900] text-[#181818] shadow'
                : 'bg-[#242424] text-[#a8a29e] hover:text-[#FFFDF5] border border-[#383838]'
            }`}
          >
            Todos (Edición General)
          </button>

          <button
            type="button"
            onClick={() => setPreviewRole('administrador')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              previewRole === 'administrador'
                ? 'bg-[#292212] text-[#D6A21A] border border-[#B77900]'
                : 'bg-[#242424] text-[#a8a29e] hover:text-[#D6A21A] border border-[#383838]'
            }`}
          >
            <span>👑 Administrador</span>
          </button>

          <button
            type="button"
            onClick={() => setPreviewRole('asesor')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              previewRole === 'asesor'
                ? 'bg-blue-950 text-blue-300 border border-blue-600'
                : 'bg-[#242424] text-[#a8a29e] hover:text-blue-300 border border-[#383838]'
            }`}
          >
            <span>👔 Asesor</span>
          </button>

          <button
            type="button"
            onClick={() => setPreviewRole('cocinero')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              previewRole === 'cocinero'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                : 'bg-[#242424] text-[#a8a29e] hover:text-emerald-300 border border-[#383838]'
            }`}
          >
            <span>🍳 Cocinero</span>
          </button>
        </div>

        {/* Buscador de botones */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-[#a8a29e] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar botón por nombre..."
            className="w-full bg-[#242424] border border-[#383838] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#FFFDF5] placeholder-[#78716c] focus:outline-none focus:border-[#D6A21A]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#a8a29e] hover:text-[#FFFDF5]"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* 4. Lista de Secciones y Botones Configurables */}
      <div className="space-y-6">
        {filteredButtonsBySection.map(({ section, buttons }, secIdx) => {
          if (filterSection !== 'all' && filterSection !== section.id) return null;

          return (
            <div
              key={section.id}
              className="bg-[#14131a] border border-[#2d281e] rounded-3xl p-5 sm:p-6 shadow-xl space-y-4"
            >
              {/* Encabezado de Sección */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#2d281e] gap-2">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-[#292212] border border-[#B77900]/40 text-[#D6A21A] text-xs font-black flex items-center justify-center">
                    {section.order + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-black text-[#fef3c7] tracking-wide">
                        {section.title}
                      </h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#181818] border border-[#383838] text-[#a8a29e]">
                        {buttons.length} {buttons.length === 1 ? 'botón' : 'botones'}
                      </span>
                    </div>
                    {section.description && (
                      <p className="text-[11px] text-[#78716c] mt-0.5">{section.description}</p>
                    )}
                  </div>
                </div>

                {/* Controles de orden de la sección */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <span className="text-[10px] text-[#78716c] uppercase font-bold mr-1 hidden sm:inline">
                    Mover Sección:
                  </span>
                  <button
                    type="button"
                    onClick={() => moveSectionOrder(section.id, 'up')}
                    disabled={secIdx === 0}
                    className="p-1.5 rounded-lg bg-[#181818] hover:bg-[#242424] text-[#a8a29e] hover:text-[#FFFDF5] border border-[#383838] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Subir sección en el menú"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSectionOrder(section.id, 'down')}
                    disabled={secIdx === sortedSections.length - 1}
                    className="p-1.5 rounded-lg bg-[#181818] hover:bg-[#242424] text-[#a8a29e] hover:text-[#FFFDF5] border border-[#383838] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Bajar sección en el menú"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Botones dentro de esta sección */}
              {buttons.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#78716c] bg-[#181818]/60 rounded-2xl border border-dashed border-[#383838]">
                  No hay botones configurados en esta sección. Puedes mover botones aquí desde otra sección mediante el selector de «Ubicación».
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {buttons.map((btn, btnIdx) => {
                    const IconComponent = ICON_MAP[btn.iconName] || Home;

                    // Comprobar si el botón coincide con el modo de previsualización seleccionado
                    const isVisibleInPreview =
                      previewRole === 'all' ? true : btn.isVisible && btn.allowedRoles.includes(previewRole);

                    return (
                      <div
                        key={btn.id}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 ${
                          !btn.isVisible
                            ? 'bg-[#181818]/40 border-red-900/30 opacity-60'
                            : !isVisibleInPreview
                            ? 'bg-[#181818]/50 border-[#2d281e] opacity-40'
                            : 'bg-[#181818] border-[#383838] hover:border-[#B77900]/50 shadow-sm'
                        }`}
                      >
                        {/* 1. Datos del Botón: Icono, Nombre y Ubicación */}
                        <div className="flex items-center gap-3 min-w-[240px]">
                          {/* Botones de Orden Subir / Bajar */}
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveButtonOrder(btn.id, 'up')}
                              disabled={btnIdx === 0}
                              className="p-1 rounded bg-[#242424] hover:bg-[#2e2e2e] text-[#a8a29e] hover:text-[#D6A21A] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                              title="Subir de posición"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <span className="text-[9px] font-mono text-center text-[#78716c] font-black">
                              {btn.order + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => moveButtonOrder(btn.id, 'down')}
                              disabled={btnIdx === buttons.length - 1}
                              className="p-1 rounded bg-[#242424] hover:bg-[#2e2e2e] text-[#a8a29e] hover:text-[#D6A21A] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                              title="Bajar de posición"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="w-9 h-9 rounded-xl bg-[#242424] border border-[#383838] text-[#D6A21A] flex items-center justify-center shrink-0">
                            <IconComponent className="w-4 h-4" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-xs text-[#FFFDF5] truncate">{btn.label}</span>
                              <span className="text-[10px] font-mono text-[#78716c] hidden sm:inline">
                                ({btn.id})
                              </span>
                            </div>
                            <p className="text-[11px] text-[#a8a29e] truncate">
                              {btn.description || 'Acceso al módulo operativo'}
                            </p>
                          </div>
                        </div>

                        {/* 2. Selector «Dónde va el botón» (Cambio de Sección) */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[#78716c] uppercase font-bold shrink-0">
                            Ubicación:
                          </span>
                          <select
                            value={btn.sectionId}
                            onChange={(e) => updateButtonSection(btn.id, e.target.value)}
                            className="bg-[#242424] border border-[#383838] text-xs text-[#FFFDF5] rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-[#D6A21A] cursor-pointer"
                            title="Mover este botón a otra sección del menú"
                          >
                            {sortedSections.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.title}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* 3. Permisos por Rol: Administrador, Asesor, Cocinero */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-[#78716c] uppercase font-bold mr-1">
                            Roles:
                          </span>

                          {/* Rol: Administrador */}
                          <button
                            type="button"
                            onClick={() => toggleRoleForButton(btn.id, 'administrador')}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              btn.allowedRoles.includes('administrador')
                                ? 'bg-[#292212] text-[#D6A21A] border border-[#B77900]'
                                : 'bg-[#242424] text-[#78716c] border border-[#383838] hover:text-[#a8a29e]'
                            }`}
                            title="Permiso para Administrador (Acceso total)"
                          >
                            <span className="text-xs">👑</span>
                            <span>Admin</span>
                            {btn.allowedRoles.includes('administrador') ? (
                              <Check className="w-3 h-3 text-[#D6A21A]" />
                            ) : (
                              <X className="w-3 h-3 text-[#78716c]" />
                            )}
                          </button>

                          {/* Rol: Asesor */}
                          <button
                            type="button"
                            onClick={() => toggleRoleForButton(btn.id, 'asesor')}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              btn.allowedRoles.includes('asesor')
                                ? 'bg-blue-950 text-blue-300 border border-blue-600'
                                : 'bg-[#242424] text-[#78716c] border border-[#383838] hover:text-[#a8a29e]'
                            }`}
                            title="Permiso para Asesor (Operación comercial y caja)"
                          >
                            <span className="text-xs">👔</span>
                            <span>Asesor</span>
                            {btn.allowedRoles.includes('asesor') ? (
                              <Check className="w-3 h-3 text-blue-400" />
                            ) : (
                              <X className="w-3 h-3 text-[#78716c]" />
                            )}
                          </button>

                          {/* Rol: Cocinero */}
                          <button
                            type="button"
                            onClick={() => toggleRoleForButton(btn.id, 'cocinero')}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              btn.allowedRoles.includes('cocinero')
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                                : 'bg-[#242424] text-[#78716c] border border-[#383838] hover:text-[#a8a29e]'
                            }`}
                            title="Permiso para Cocinero (Cocina KDS)"
                          >
                            <span className="text-xs">🍳</span>
                            <span>Cocinero</span>
                            {btn.allowedRoles.includes('cocinero') ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <X className="w-3 h-3 text-[#78716c]" />
                            )}
                          </button>
                        </div>

                        {/* 4. Switch Visibilidad General */}
                        <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
                          <button
                            type="button"
                            onClick={() => updateButtonItem(btn.id, { isVisible: !btn.isVisible })}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              btn.isVisible
                                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800'
                                : 'bg-red-950/40 text-red-300 border border-red-800'
                            }`}
                            title={btn.isVisible ? 'Botón activo en la navegación' : 'Botón oculto del sistema'}
                          >
                            {btn.isVisible ? (
                              <>
                                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Activo</span>
                              </>
                            ) : (
                              <>
                                <X className="w-3.5 h-3.5 text-red-400" />
                                <span>Oculto</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal: Crear Nueva Sección */}
      {showAddSectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#181818] border border-[#383838] rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2e2e2e]">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-[#D6A21A]" />
                <h3 className="text-base font-black text-[#FFFDF5]">Crear Nueva Sección de Menú</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSectionModal(false)}
                className="text-[#a8a29e] hover:text-[#FFFDF5] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                  Nombre de la Sección (Categoría):
                </label>
                <input
                  type="text"
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  placeholder="Ej: SERVICIOS Y BARRA, FINANZAS..."
                  className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3.5 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                  Descripción Corta (Opcional):
                </label>
                <input
                  type="text"
                  value={newSectionDesc}
                  onChange={(e) => setNewSectionDesc(e.target.value)}
                  placeholder="Ej: Módulos de atención rápida en barra"
                  className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3.5 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSectionModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#242424] text-[#a8a29e] hover:text-[#FFFDF5] text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] text-xs font-black hover:brightness-110 cursor-pointer shadow-md"
                >
                  Crear Sección
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Restablecer a Valores Predeterminados */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#181818] border border-amber-600/40 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-950/60 border border-amber-600/50 text-[#D6A21A] flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-[#FFFDF5]">
                ¿Restablecer Menú Predeterminado?
              </h3>
              <p className="text-xs text-[#d6d3d1] mt-2 leading-relaxed">
                Esta acción devolverá la ubicación de los botones, sus órdenes y los permisos de rol a la distribución estándar de fábrica del Sistema Colmena.
              </p>
            </div>

            <div className="pt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl bg-[#242424] hover:bg-[#2d2d2d] text-[#a8a29e] hover:text-[#FFFDF5] text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] text-xs font-black hover:brightness-110 cursor-pointer shadow-lg"
              >
                Sí, Restablecer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
