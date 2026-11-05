import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import { ColmenaUser, UserRole } from '../../types';
import { validateDocumentNumber, validateEmail, normalizeUserRole } from '../../utils/auth';
import { formatColombiaDateTime } from '../../utils/calculations';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Building2,
  CheckCircle2,
  XCircle,
  Edit2,
  Lock,
  Unlock,
  X,
  FileText,
  Mail,
  Phone,
  Calendar,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Archive,
  Clock,
  UserX,
} from 'lucide-react';

export const UsersManagementView: React.FC = () => {
  const {
    allUsers,
    branches,
    currentUser,
    createNewUser,
    updateUserData,
    toggleUserActiveStatus,
    softDeleteUser,
    restoreUser,
    permanentDeleteUser,
  } = useAuth();
  const { showToast } = useToast();

  // Pestaña actual: 'activos' o 'papelera' (Usuarios Borrados)
  const [activeTab, setActiveTab] = useState<'activos' | 'papelera'>('activos');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('todos');
  const [branchFilter, setBranchFilter] = useState<string>('todos');

  // Modal de Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<ColmenaUser | null>(null);

  // Modal de Mover a Papelera (Borrar)
  const [userToDelete, setUserToDelete] = useState<ColmenaUser | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>('Creado por error');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Modal de Eliminación Definitiva (Purgar)
  const [userToPurge, setUserToPurge] = useState<ColmenaUser | null>(null);
  const [isPurging, setIsPurging] = useState<boolean>(false);

  // Form states para Crear / Editar
  const [fullName, setFullName] = useState<string>('');
  const [documentNumber, setDocumentNumber] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<UserRole>('asesor');
  const [authorizedBranchIds, setAuthorizedBranchIds] = useState<string[]>([]);
  const [phone, setPhone] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const rolesList: { id: UserRole; label: string; desc: string }[] = [
    { id: 'administrador', label: 'Administrador (Acceso total)', desc: 'Acceso total a todos los módulos y opciones' },
    { id: 'asesor', label: 'Asesor (Apartado operación)', desc: 'Acceso exclusivo al apartado operación' },
    { id: 'cocinero', label: 'Cocinero (Únicamente cocina)', desc: 'Acceso únicamente a la parte de cocina' },
  ];

  // Separar usuarios activos de usuarios en papelera
  const activeUsers = allUsers.filter((u) => !u.isDeleted);
  const deletedUsers = allUsers.filter((u) => u.isDeleted === true);

  // Filtrar según pestaña seleccionada
  const currentTabUsers = activeTab === 'activos' ? activeUsers : deletedUsers;

  const filteredUsers = currentTabUsers.filter((u) => {
    if (roleFilter !== 'todos' && normalizeUserRole(u.role) !== roleFilter) return false;
    if (branchFilter !== 'todos' && !u.authorizedBranchIds?.includes(branchFilter)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (u.fullName || '').toLowerCase().includes(q);
      const matchDoc = (u.documentNumber || '').includes(q);
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      if (!matchName && !matchDoc && !matchEmail) return false;
    }
    return true;
  });

  const openCreateModal = () => {
    setEditingUser(null);
    setFullName('');
    setDocumentNumber('');
    setEmail('');
    setRole('asesor');
    setAuthorizedBranchIds(branches.map((b) => b.id)); // Por defecto todas
    setPhone('');
    setIsModalOpen(true);
  };

  const openEditModal = (u: ColmenaUser) => {
    setEditingUser(u);
    setFullName(u.fullName);
    setDocumentNumber(u.documentNumber);
    setEmail(u.email);
    setRole(normalizeUserRole(u.role));
    setAuthorizedBranchIds(u.authorizedBranchIds || []);
    setPhone(u.phone || '');
    setIsModalOpen(true);
  };

  const handleBranchCheckbox = (branchId: string) => {
    setAuthorizedBranchIds((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      showToast('El nombre completo es requerido', 'warning');
      return;
    }
    if (!validateDocumentNumber(documentNumber)) {
      showToast('El número de documento debe contener entre 5 y 15 dígitos numéricos', 'warning');
      return;
    }
    if (!validateEmail(email)) {
      showToast('Ingresa un correo electrónico válido', 'warning');
      return;
    }
    if (authorizedBranchIds.length === 0) {
      showToast('Debes autorizar al menos una sucursal para el usuario', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingUser) {
        await updateUserData(editingUser.id, {
          fullName: fullName.trim(),
          documentNumber: documentNumber.trim(),
          role,
          authorizedBranchIds,
          phone: phone.trim(),
        });
        showToast('Usuario actualizado correctamente', 'success');
      } else {
        await createNewUser({
          fullName: fullName.trim(),
          documentNumber: documentNumber.trim(),
          email: email.trim(),
          role,
          authorizedBranchIds,
          phone: phone.trim(),
        });
        showToast('Usuario creado con éxito en Sistema Colmena', 'success');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error al guardar el usuario', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: ColmenaUser) => {
    // Si intenta desactivar al único admin activo, bloquear
    if (normalizeUserRole(user.role) === 'administrador' && user.isActive) {
      const activeAdmins = activeUsers.filter(
        (u) => normalizeUserRole(u.role) === 'administrador' && u.isActive
      );
      if (activeAdmins.length <= 1) {
        showToast('No puedes desactivar al único Administrador activo del sistema', 'error');
        return;
      }
    }

    try {
      await toggleUserActiveStatus(user.id, user.isActive);
      showToast(
        `Usuario ${user.fullName} ${user.isActive ? 'desactivado' : 'activado'} correctamente`,
        'info'
      );
    } catch (err: any) {
      console.error(err);
      showToast('Error al modificar estado del usuario', 'error');
    }
  };

  // Confirmar mover a papelera (Soft delete)
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await softDeleteUser(userToDelete.id, deleteReason);
      showToast(`Usuario "${userToDelete.fullName}" enviado a la papelera`, 'info');
      setUserToDelete(null);
      setDeleteReason('Creado por error');
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar usuario', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Restablecer usuario desde la papelera
  const handleRestoreUser = async (u: ColmenaUser) => {
    try {
      await restoreUser(u.id);
      showToast(`Usuario "${u.fullName}" restablecido exitosamente en el sistema`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al restablecer usuario', 'error');
    }
  };

  // Confirmar eliminación definitiva
  const handleConfirmPurge = async () => {
    if (!userToPurge) return;
    setIsPurging(true);
    try {
      await permanentDeleteUser(userToPurge.id);
      showToast(`Usuario "${userToPurge.fullName}" eliminado permanentemente`, 'info');
      setUserToPurge(null);
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar usuario permanentemente', 'error');
    } finally {
      setIsPurging(false);
    }
  };

  const getRoleLabel = (r: UserRole) => {
    const norm = normalizeUserRole(r);
    switch (norm) {
      case 'administrador':
        return 'Administrador';
      case 'asesor':
        return 'Asesor';
      case 'cocinero':
        return 'Cocinero';
    }
  };

  const getRoleBadge = (r: UserRole) => {
    const norm = normalizeUserRole(r);
    switch (norm) {
      case 'administrador':
        return 'bg-[#292212] text-[#D6A21A] border border-[#B77900]';
      case 'asesor':
        return 'bg-blue-950/80 text-blue-300 border border-blue-800';
      case 'cocinero':
        return 'bg-emerald-950/80 text-emerald-300 border border-emerald-800';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* 1. Cabecera Principal del Módulo */}
      <div className="bg-[#181818] p-5 sm:p-6 rounded-3xl border border-[#333333] text-[#FFFDF5] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#B77900] to-[#D6A21A] flex items-center justify-center text-[#181818] font-black shadow-lg shadow-[#B77900]/25 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-[#FFFDF5]">
                Administración de Usuarios y Personal
              </h1>
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-[#292212] text-[#D6A21A] border border-[#B77900]/40 hidden sm:inline-block">
                Colmena POS
              </span>
            </div>
            <p className="text-xs text-[#a8a29e] mt-0.5">
              Control de roles, sucursales autorizadas y papelera segura para restablecer usuarios eliminados por error.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs flex items-center gap-2 hover:brightness-110 shadow-lg shadow-[#B77900]/20 cursor-pointer transition-transform active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* 2. Pestañas de Navegación: Usuarios Activos vs Papelera de Usuarios Borrados */}
      <div className="flex items-center justify-between border-b border-[#2e2e2e] pb-1 gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2">
          {/* Pestaña: Usuarios en Lista / Activos */}
          <button
            type="button"
            onClick={() => setActiveTab('activos')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'activos'
                ? 'bg-[#292212] text-[#D6A21A] border border-[#B77900] shadow-md shadow-[#B77900]/15'
                : 'bg-[#181818] text-[#a8a29e] hover:text-[#FFFDF5] border border-[#333333]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Usuarios en Lista</span>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                activeTab === 'activos'
                  ? 'bg-[#B77900] text-[#181818]'
                  : 'bg-[#242424] text-[#a8a29e]'
              }`}
            >
              {activeUsers.length}
            </span>
          </button>

          {/* Pestaña: Usuarios Borrados (Papelera con Opción de Restablecer) */}
          <button
            type="button"
            onClick={() => setActiveTab('papelera')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'papelera'
                ? 'bg-red-950/60 text-red-300 border border-red-700 shadow-md shadow-red-900/20'
                : 'bg-[#181818] text-[#a8a29e] hover:text-red-300 border border-[#333333]'
            }`}
          >
            <Archive className="w-4 h-4 text-red-400" />
            <span>Usuarios Borrados (Papelera)</span>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                deletedUsers.length > 0
                  ? 'bg-red-800 text-white'
                  : 'bg-[#242424] text-[#78716c]'
              }`}
            >
              {deletedUsers.length}
            </span>
          </button>
        </div>

        {/* Mensaje Informativo de Seguridad */}
        {activeTab === 'papelera' && (
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-[#D6A21A] bg-[#292212]/50 px-3 py-1.5 rounded-xl border border-[#B77900]/30">
            <RotateCcw className="w-3.5 h-3.5 text-[#D6A21A]" />
            <span>Los usuarios en papelera pueden ser restablecidos con un clic en cualquier momento.</span>
          </div>
        )}
      </div>

      {/* 3. Barra de Filtros y Búsqueda */}
      <div className="bg-[#181818] p-4 rounded-2xl border border-[#333333] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 text-[#a8a29e] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={
              activeTab === 'activos'
                ? 'Buscar usuario por nombre, documento o correo...'
                : 'Buscar usuario eliminado en papelera...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#242424] border border-[#383838] rounded-xl pl-9 pr-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
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

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            aria-label="Filtrar por Rol"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] font-semibold focus:outline-none focus:border-[#D6A21A] cursor-pointer"
          >
            <option value="todos">Todos los Roles</option>
            {rolesList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por Sucursal"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] font-semibold focus:outline-none focus:border-[#D6A21A] cursor-pointer"
          >
            <option value="todos">Todas las Sucursales</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Tabla Principal según Pestaña */}
      {activeTab === 'activos' ? (
        /* Pestaña: Usuarios Activos / En Lista */
        <div className="bg-[#181818] rounded-2xl border border-[#333333] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#d6d3d1]">
              <thead className="bg-[#222222] text-[10px] uppercase font-bold text-[#a8a29e] border-b border-[#333333]">
                <tr>
                  <th className="p-3.5">Personal / Nombre</th>
                  <th className="p-3.5">Documento (C.C.)</th>
                  <th className="p-3.5">Correo Autenticación</th>
                  <th className="p-3.5">Rol</th>
                  <th className="p-3.5">Sucursales Autorizadas</th>
                  <th className="p-3.5">Estado</th>
                  <th className="p-3.5">Último Acceso</th>
                  <th className="p-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-[#78716c]">
                      <Users className="w-8 h-8 mx-auto mb-2 text-[#78716c] opacity-50" />
                      <span>No se encontraron usuarios en la lista con los filtros aplicados.</span>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const roleBadge = getRoleBadge(user.role);
                    const isSelf = currentUser?.id === user.id;

                    return (
                      <tr key={user.id} className="hover:bg-[#222222] transition-colors">
                        <td className="p-3.5">
                          <div className="font-bold text-[#FFFDF5] flex items-center gap-1.5">
                            <span>{user.fullName}</span>
                            {isSelf && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-[#292212] text-[#D6A21A] border border-[#B77900]/40">
                                Tú
                              </span>
                            )}
                          </div>
                          {user.phone && (
                            <div className="text-[10px] text-[#a8a29e] flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-[#D6A21A]" />
                              <span>{user.phone}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 font-mono text-[#D6A21A] font-semibold">
                          {user.documentNumber || '—'}
                        </td>
                        <td className="p-3.5 text-[#FFFDF5] font-mono">
                          {user.email}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${roleBadge}`}>
                            {getRoleLabel(user.role)}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {normalizeUserRole(user.role) === 'administrador' ? (
                              <span className="px-1.5 py-0.5 rounded bg-[#292212] text-[#D6A21A] text-[10px] font-bold border border-[#B77900]/40">
                                Todas las Sucursales
                              </span>
                            ) : user.authorizedBranchIds?.length > 0 ? (
                              user.authorizedBranchIds.map((bid) => {
                                const b = branches.find((br) => br.id === bid);
                                return (
                                  <span
                                    key={bid}
                                    className="px-1.5 py-0.5 rounded bg-[#262626] text-[#FFFDF5] text-[10px] font-medium border border-[#383838]"
                                  >
                                    {b ? b.name.split('—')[0].trim() : bid}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-[10px] text-red-400">Sin sucursal asignada</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              user.isActive
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-red-950 text-red-400 border border-red-800'
                            }`}
                          >
                            {user.isActive ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Activo</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" />
                                <span>Inactivo</span>
                              </>
                            )}
                          </span>
                        </td>
                        <td className="p-3.5 text-[#a8a29e] text-[11px] whitespace-nowrap">
                          {user.lastLoginAt ? formatColombiaDateTime(user.lastLoginAt) : 'Sin ingresos'}
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* 1. Editar usuario */}
                            <button
                              type="button"
                              onClick={() => openEditModal(user)}
                              className="p-1.5 rounded-lg bg-[#2a2a2a] text-[#D6A21A] hover:bg-[#333333] border border-[#383838] cursor-pointer"
                              title="Editar usuario"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* 2. Activar / Desactivar estado */}
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(user)}
                              className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                                user.isActive
                                  ? 'bg-amber-950/40 text-amber-400 border-amber-800 hover:bg-amber-950'
                                  : 'bg-emerald-950/40 text-emerald-400 border-emerald-800 hover:bg-emerald-950'
                              }`}
                              title={user.isActive ? 'Desactivar usuario' : 'Activar usuario'}
                            >
                              {user.isActive ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                            </button>

                            {/* 3. Borrar usuario (Mover a papelera segura) */}
                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() => {
                                setUserToDelete(user);
                                setDeleteReason('Creado por error o retiro');
                              }}
                              className={`p-1.5 rounded-lg border text-xs transition-colors ${
                                isSelf
                                  ? 'bg-[#222222] text-[#555555] border-[#333333] cursor-not-allowed opacity-40'
                                  : 'bg-red-950/40 text-red-400 hover:text-red-200 border-red-800/80 hover:bg-red-900 cursor-pointer shadow-sm'
                              }`}
                              title={
                                isSelf
                                  ? 'No puedes borrar tu propio usuario en sesión'
                                  : 'Borrar usuario (Se enviará a la papelera donde podrás restablecerlo)'
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Pestaña: Usuarios Borrados / Papelera */
        <div className="bg-[#181818] rounded-2xl border border-red-900/40 overflow-hidden shadow-xl">
          <div className="p-4 bg-red-950/20 border-b border-red-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-red-300">
              <Archive className="w-4 h-4 text-red-400" />
              <span>Papelera de Usuarios Eliminados</span>
            </div>
            <span className="text-[11px] text-[#a8a29e]">
              Total en papelera: <strong className="text-red-300">{deletedUsers.length}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#d6d3d1]">
              <thead className="bg-[#222222] text-[10px] uppercase font-bold text-[#a8a29e] border-b border-[#333333]">
                <tr>
                  <th className="p-3.5">Usuario Eliminado</th>
                  <th className="p-3.5">Documento</th>
                  <th className="p-3.5">Correo</th>
                  <th className="p-3.5">Rol Anterior</th>
                  <th className="p-3.5">Fecha de Borrado</th>
                  <th className="p-3.5">Motivo / Causa</th>
                  <th className="p-3.5 text-right">Acciones de Seguridad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-[#78716c]">
                      <Archive className="w-10 h-10 mx-auto mb-2 text-[#78716c] opacity-40" />
                      <p className="font-bold text-sm text-[#a8a29e]">La papelera de usuarios está vacía</p>
                      <p className="text-xs text-[#78716c] mt-1">
                        Cuando borres un usuario creado por error, aparecerá aquí protegido para que puedas restablecerlo cuando lo necesites.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const roleBadge = getRoleBadge(user.role);

                    return (
                      <tr key={user.id} className="hover:bg-[#222222] transition-colors">
                        <td className="p-3.5">
                          <div className="font-bold text-[#FFFDF5]">{user.fullName}</div>
                          {user.phone && <div className="text-[10px] text-[#78716c]">{user.phone}</div>}
                        </td>
                        <td className="p-3.5 font-mono text-[#D6A21A]">{user.documentNumber}</td>
                        <td className="p-3.5 text-[#a8a29e] font-mono">{user.email}</td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${roleBadge}`}>
                            {getRoleLabel(user.role)}
                          </span>
                        </td>
                        <td className="p-3.5 text-[#a8a29e] text-[11px] whitespace-nowrap">
                          {user.deletedAt ? formatColombiaDateTime(user.deletedAt) : 'Fecha no registrada'}
                        </td>
                        <td className="p-3.5 text-[#d6d3d1] text-xs">
                          <span className="inline-block px-2 py-0.5 rounded bg-[#242424] border border-[#383838] text-[11px]">
                            {user.deleteReason || 'Eliminado desde la lista'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {/* Botón: Restablecer Usuario */}
                            <button
                              type="button"
                              onClick={() => handleRestoreUser(user)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                              title="Restablecer este usuario y devolverlo a la lista activa"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Restablecer</span>
                            </button>

                            {/* Botón: Eliminación Definitiva */}
                            <button
                              type="button"
                              onClick={() => setUserToPurge(user)}
                              className="p-1.5 rounded-xl bg-red-950/40 hover:bg-red-950 border border-red-800/80 text-red-400 hover:text-red-200 cursor-pointer transition-colors"
                              title="Eliminar definitivamente de la base de datos"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Crear / Editar Usuario */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-[#181818] border border-[#B77900] rounded-3xl w-full max-w-lg p-6 text-[#FFFDF5] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#333333]">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#D6A21A]" />
                <h3 className="font-black text-base text-[#FFFDF5]">
                  {editingUser ? 'Editar Usuario Colmena' : 'Registrar Nuevo Usuario'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[#a8a29e] hover:text-[#FFFDF5] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                  Nombre Completo y Apellidos: *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej: Andrés Felipe Gómez"
                  className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3.5 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                    Cédula / Documento: *
                  </label>
                  <input
                    type="text"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    placeholder="Ej: 1020304050"
                    className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3.5 py-2 text-xs text-[#FFFDF5] font-mono focus:outline-none focus:border-[#D6A21A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                    Teléfono / WhatsApp:
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej: 3154896541"
                    className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3.5 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                  Correo Electrónico (Acceso Google / Sistema): *
                </label>
                <input
                  type="email"
                  value={email}
                  disabled={!!editingUser}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ej: usuario@colmenabuga.com"
                  className={`w-full bg-[#242424] border border-[#383838] rounded-xl px-3.5 py-2 text-xs text-[#FFFDF5] font-mono focus:outline-none focus:border-[#D6A21A] ${
                    editingUser ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                />
                {editingUser && (
                  <span className="text-[10px] text-[#78716c] block mt-1">
                    El correo electrónico de inicio de sesión no puede ser modificado.
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                  Rol Operativo Oficial: *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {rolesList.map((r) => {
                    const isSelected = role === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRole(r.id)}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#292212] border-[#D6A21A] text-[#D6A21A] shadow-sm'
                            : 'bg-[#242424] border-[#383838] text-[#a8a29e] hover:border-[#555]'
                        }`}
                      >
                        <span className="text-xs font-bold block">{r.label.split('(')[0].trim()}</span>
                        <span className="text-[10px] text-[#78716c] block mt-0.5 leading-tight">
                          {r.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                  Sucursales Autorizadas: *
                </label>
                <div className="space-y-1.5 bg-[#242424] p-3 rounded-xl border border-[#383838] max-h-36 overflow-y-auto">
                  {branches.map((b) => {
                    const isChecked = authorizedBranchIds.includes(b.id);
                    return (
                      <label
                        key={b.id}
                        className="flex items-center gap-2 text-xs text-[#FFFDF5] cursor-pointer hover:bg-[#2e2e2e] p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleBranchCheckbox(b.id)}
                          className="accent-[#D6A21A] cursor-pointer"
                        />
                        <span>{b.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#333333]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#242424] text-[#a8a29e] hover:text-[#FFFDF5] text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs hover:brightness-110 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Confirmar Borrado / Mover a Papelera */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#181818] border border-red-700/60 rounded-3xl w-full max-w-md p-6 text-[#FFFDF5] shadow-2xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[#2e2e2e]">
              <div className="w-10 h-10 rounded-xl bg-red-950/80 border border-red-700 flex items-center justify-center text-red-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-[#FFFDF5]">¿Borrar este Usuario?</h3>
                <span className="text-xs text-[#a8a29e]">Se enviará a la papelera de usuarios</span>
              </div>
            </div>

            <div className="bg-[#242424] p-3.5 rounded-2xl border border-[#383838] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#a8a29e]">Nombre:</span>
                <strong className="text-[#FFFDF5]">{userToDelete.fullName}</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#a8a29e]">Documento:</span>
                <span className="font-mono text-[#D6A21A]">{userToDelete.documentNumber}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#a8a29e]">Correo:</span>
                <span className="font-mono text-[#FFFDF5]">{userToDelete.email}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#a8a29e]">Rol:</span>
                <span className="font-bold text-[#D6A21A] uppercase">{getRoleLabel(userToDelete.role)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#d6d3d1] mb-1">
                Motivo de la eliminación (opcional):
              </label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Ej: Creado por error, retiro laboral..."
                className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-700/40 text-[11px] text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Medida de seguridad:</strong> El usuario dejará de aparecer en la lista y no podrá iniciar sesión, pero quedará almacenado en la pestaña <strong>«Usuarios Borrados (Papelera)»</strong> donde podrás restablecerlo con un clic en cualquier momento.
              </span>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#2e2e2e]">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl bg-[#242424] text-[#a8a29e] hover:text-[#FFFDF5] text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-red-800 hover:bg-red-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-lg transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Borrando...' : 'Sí, Mover a Papelera'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Confirmar Eliminación Definitiva (Purgar de Firestore) */}
      {userToPurge && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#181818] border border-red-800 rounded-3xl w-full max-w-md p-6 text-[#FFFDF5] shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-950 border border-red-700 flex items-center justify-center text-red-400 mx-auto">
              <UserX className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-black text-base text-[#FFFDF5]">¿Eliminar Usuario Definitivamente?</h3>
              <p className="text-xs text-red-300 mt-2 leading-relaxed">
                Estás a punto de borrar permanentemente de la base de datos a <strong className="text-white">{userToPurge.fullName}</strong>. Esta acción no se puede deshacer y el usuario no podrá volver a ser restablecido.
              </p>
            </div>

            <div className="pt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setUserToPurge(null)}
                className="px-4 py-2.5 rounded-xl bg-[#242424] text-[#a8a29e] hover:text-[#FFFDF5] text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPurging}
                onClick={handleConfirmPurge}
                className="px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-xs font-black cursor-pointer shadow-lg disabled:opacity-50"
              >
                {isPurging ? 'Eliminando...' : 'Sí, Purgar Permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
