import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  RestaurantArea,
  Table,
  PrepStation,
  AuditLog,
  TableStatus,
} from '../../types';
import {
  validateAreaPayload,
  validateTablePayload,
  validatePrepStationPayload,
  getTableStatusConfig,
} from '../../utils/tableOperations';
import { formatColombiaDateTime } from '../../utils/calculations';
import {
  Layers,
  LayoutGrid,
  Flame,
  History,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Search,
  Filter,
  Users,
  Clock,
  Sparkles,
  Palette,
  X,
  Check,
} from 'lucide-react';

export const RestaurantConfigView: React.FC = () => {
  const {
    currentBranch,
    areas,
    tables,
    prepStations,
    auditLogs,
    createArea,
    updateArea,
    toggleAreaActive,
    createTable,
    updateTable,
    createPrepStation,
    updatePrepStation,
    togglePrepStationActive,
  } = useRestaurant();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'areas' | 'tables' | 'stations' | 'history'>('areas');

  // Modales
  const [areaModalOpen, setAreaModalOpen] = useState<boolean>(false);
  const [editingArea, setEditingArea] = useState<RestaurantArea | null>(null);

  const [tableModalOpen, setTableModalOpen] = useState<boolean>(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);

  const [stationModalOpen, setStationModalOpen] = useState<boolean>(false);
  const [editingStation, setEditingStation] = useState<PrepStation | null>(null);

  // Filtros de búsqueda
  const [tableAreaFilter, setTableAreaFilter] = useState<string>('todos');
  const [searchTable, setSearchTable] = useState<string>('');
  const [auditEntityFilter, setAuditEntityFilter] = useState<string>('todos');

  // Form states - Área
  const [areaForm, setAreaForm] = useState<{
    name: string;
    description: string;
    order: number;
    isActive: boolean;
  }>({
    name: '',
    description: '',
    order: 1,
    isActive: true,
  });

  // Form states - Mesa
  const [tableForm, setTableForm] = useState<{
    number: number;
    name: string;
    areaId: string;
    capacity: number;
    displayOrder: number;
    status: TableStatus;
    isActive: boolean;
  }>({
    number: 1,
    name: '',
    areaId: areas[0]?.id || '',
    capacity: 4,
    displayOrder: 1,
    status: 'libre',
    isActive: true,
  });

  // Form states - Estación
  const [stationForm, setStationForm] = useState<{
    name: string;
    code: string;
    color: string;
    order: number;
    description: string;
    isActive: boolean;
  }>({
    name: '',
    code: '',
    color: '#e11d48',
    order: 1,
    description: '',
    isActive: true,
  });

  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Handlers Área
  const openCreateArea = () => {
    setEditingArea(null);
    setAreaForm({
      name: '',
      description: '',
      order: areas.length + 1,
      isActive: true,
    });
    setFormErrors([]);
    setAreaModalOpen(true);
  };

  const openEditArea = (area: RestaurantArea) => {
    setEditingArea(area);
    setAreaForm({
      name: area.name,
      description: area.description || '',
      order: area.order,
      isActive: area.isActive,
    });
    setFormErrors([]);
    setAreaModalOpen(true);
  };

  const handleSaveArea = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = validateAreaPayload(areaForm);
    if (!val.isValid) {
      setFormErrors(val.errors);
      return;
    }
    try {
      setIsSaving(true);
      if (editingArea) {
        await updateArea(editingArea.id, areaForm);
        showToast(`Salón "${areaForm.name}" actualizado con éxito`, 'success');
      } else {
        await createArea(areaForm);
        showToast(`Nuevo salón "${areaForm.name}" creado con éxito`, 'success');
      }
      setAreaModalOpen(false);
    } catch (err: any) {
      setFormErrors([err.message || 'Error al guardar salón']);
    } finally {
      setIsSaving(false);
    }
  };

  // Handlers Mesa
  const openCreateTable = () => {
    setEditingTable(null);
    const nextNum = tables.length > 0 ? Math.max(...tables.map((t) => t.number || 0)) + 1 : 1;
    setTableForm({
      number: nextNum,
      name: `Mesa ${nextNum}`,
      areaId: areas[0]?.id || '',
      capacity: 4,
      displayOrder: nextNum,
      status: 'libre',
      isActive: true,
    });
    setFormErrors([]);
    setTableModalOpen(true);
  };

  const openEditTable = (table: Table) => {
    setEditingTable(table);
    setTableForm({
      number: table.number,
      name: table.name || `Mesa ${table.number}`,
      areaId: table.areaId || areas[0]?.id || '',
      capacity: table.capacity,
      displayOrder: table.displayOrder || table.number,
      status: table.status,
      isActive: table.isActive !== undefined ? table.isActive : true,
    });
    setFormErrors([]);
    setTableModalOpen(true);
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = validateTablePayload(tableForm);
    if (!val.isValid) {
      setFormErrors(val.errors);
      return;
    }
    try {
      setIsSaving(true);
      const selectedArea = areas.find((a) => a.id === tableForm.areaId);
      if (editingTable) {
        await updateTable(editingTable.id, {
          ...tableForm,
          zone: selectedArea?.name || editingTable.zone,
        });
        showToast(`Mesa #${tableForm.number} actualizada con éxito`, 'success');
      } else {
        await createTable({
          ...tableForm,
          zone: selectedArea?.name || 'Salón Principal',
        });
        showToast(`Mesa #${tableForm.number} registrada con éxito`, 'success');
      }
      setTableModalOpen(false);
    } catch (err: any) {
      setFormErrors([err.message || 'Error al guardar mesa']);
    } finally {
      setIsSaving(false);
    }
  };

  // Handlers Estación
  const openCreateStation = () => {
    setEditingStation(null);
    setStationForm({
      name: '',
      code: '',
      color: '#e11d48',
      order: prepStations.length + 1,
      description: '',
      isActive: true,
    });
    setFormErrors([]);
    setStationModalOpen(true);
  };

  const openEditStation = (st: PrepStation) => {
    setEditingStation(st);
    setStationForm({
      name: st.name,
      code: st.code,
      color: st.color || '#e11d48',
      order: st.order,
      description: st.description || '',
      isActive: st.isActive,
    });
    setFormErrors([]);
    setStationModalOpen(true);
  };

  const handleSaveStation = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = validatePrepStationPayload(stationForm);
    if (!val.isValid) {
      setFormErrors(val.errors);
      return;
    }
    try {
      setIsSaving(true);
      if (editingStation) {
        await updatePrepStation(editingStation.id, stationForm);
        showToast(`Estación "${stationForm.name}" actualizada con éxito`, 'success');
      } else {
        await createPrepStation(stationForm);
        showToast(`Nueva estación "${stationForm.name}" creada con éxito`, 'success');
      }
      setStationModalOpen(false);
    } catch (err: any) {
      setFormErrors([err.message || 'Error al guardar estación']);
    } finally {
      setIsSaving(false);
    }
  };

  // Filtros de mesas
  const filteredTables = tables.filter((t) => {
    const matchArea = tableAreaFilter === 'todos' || t.areaId === tableAreaFilter;
    const matchSearch =
      searchTable === '' ||
      t.number.toString().includes(searchTable) ||
      (t.name && t.name.toLowerCase().includes(searchTable.toLowerCase()));
    return matchArea && matchSearch;
  });

  // Filtros de auditoría
  const filteredAuditLogs = auditLogs.filter((log) => {
    if (auditEntityFilter === 'todos') return true;
    return log.entityType === auditEntityFilter;
  });

  return (
    <div className="space-y-6">
      {/* Encabezado del Módulo 02 */}
      <div className="bg-[#181818] rounded-3xl p-5 sm:p-6 border border-[#B77900]/30 text-[#FFFDF5] shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs uppercase font-extrabold tracking-widest text-[#D6A21A] bg-[#292212] px-2.5 py-0.5 rounded-full border border-[#B77900]/40">
                MÓDULO 02
              </span>
              <span className="text-xs text-[#a8a29e]">· Configuración de Restaurante y Mesas</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#FFFDF5]">
              Salones, Mesas & Estaciones Operativas
            </h1>
            <p className="text-xs sm:text-sm text-[#d6d3d1] mt-1 max-w-2xl">
              Administración de la distribución física de la sede{' '}
              <strong className="text-[#D6A21A]">{currentBranch?.name}</strong>, asignación de áreas,
              dimensionamiento de mesas y enrutamiento hacia estaciones de preparación.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <div className="bg-[#14131a] border border-[#2d281e] px-3.5 py-2 rounded-2xl flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#D6A21A]" />
              <div className="text-left">
                <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Sucursal</span>
                <span className="text-xs font-bold text-[#FFFDF5]">{currentBranch?.city || 'Bogotá'}</span>
              </div>
            </div>
            <div className="bg-[#14131a] border border-[#2d281e] px-3.5 py-2 rounded-2xl flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#D6A21A]" />
              <div className="text-left">
                <span className="text-[10px] text-[#a8a29e] uppercase font-bold block">Espacios</span>
                <span className="text-xs font-bold text-[#FFFDF5]">{areas.length} salones</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pestañas de Navegación del Módulo */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-1 no-scrollbar border-b border-[#2d281e]">
          <button
            type="button"
            onClick={() => setActiveTab('areas')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'areas'
                ? 'bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] shadow-lg shadow-[#B77900]/20'
                : 'bg-[#14131a] text-[#a8a29e] hover:text-[#FFFDF5] border border-[#24211a]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Salones & Espacios ({areas.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tables')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'tables'
                ? 'bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] shadow-lg shadow-[#B77900]/20'
                : 'bg-[#14131a] text-[#a8a29e] hover:text-[#FFFDF5] border border-[#24211a]'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Gestión de Mesas ({tables.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stations')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'stations'
                ? 'bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] shadow-lg shadow-[#B77900]/20'
                : 'bg-[#14131a] text-[#a8a29e] hover:text-[#FFFDF5] border border-[#24211a]'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Estaciones Operativas ({prepStations.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] shadow-lg shadow-[#B77900]/20'
                : 'bg-[#14131a] text-[#a8a29e] hover:text-[#FFFDF5] border border-[#24211a]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial de Modificaciones ({auditLogs.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: SALONES & ÁREAS */}
      {activeTab === 'areas' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#FFFDF5]">Salones y Espacios del Restaurante</h2>
              <p className="text-xs text-[#a8a29e]">
                Áreas físicas configuradas para la sucursal actual con orden de visualización y estado.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateArea}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] text-xs font-black flex items-center gap-2 hover:brightness-110 shadow-lg cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Salón / Área</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {areas.map((area) => {
              const areaTables = tables.filter((t) => t.areaId === area.id);
              const capacityTotal = areaTables.reduce((sum, t) => sum + (t.capacity || 0), 0);

              return (
                <div
                  key={area.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                    area.isActive
                      ? 'bg-[#181818] border-[#2d281e] hover:border-[#B77900]/50'
                      : 'bg-[#131317] border-stone-800 opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-[#292212] text-[#D6A21A] border border-[#B77900]/30">
                        Orden #{area.order}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          area.isActive
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-600/40'
                            : 'bg-stone-900 text-stone-400 border-stone-700'
                        }`}
                      >
                        {area.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-[#FFFDF5]">{area.name}</h3>
                    <p className="text-xs text-[#a8a29e] mt-1 line-clamp-2">
                      {area.description || 'Sin descripción asignada.'}
                    </p>

                    <div className="mt-4 pt-3 border-t border-[#2d281e] grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-[#a8a29e] uppercase block font-semibold">
                          Mesas Asignadas
                        </span>
                        <span className="font-black text-[#FFFDF5] text-base">{areaTables.length} mesas</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#a8a29e] uppercase block font-semibold">
                          Aforo Total
                        </span>
                        <span className="font-black text-[#D6A21A] text-base">{capacityTotal} comensales</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#2d281e] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleAreaActive(area.id, !area.isActive)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        area.isActive
                          ? 'bg-stone-900/60 text-stone-300 border-stone-700 hover:bg-stone-900'
                          : 'bg-emerald-950/40 text-emerald-300 border-emerald-600/40 hover:bg-emerald-950'
                      }`}
                    >
                      {area.isActive ? 'Desactivar' : 'Activar'}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditArea(area)}
                      className="px-3 py-1.5 rounded-xl bg-[#292212] border border-[#B77900]/40 text-[#D6A21A] text-xs font-bold hover:brightness-110 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: GESTIÓN DE MESAS */}
      {activeTab === 'tables' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#FFFDF5]">Administración y Registro de Mesas</h2>
              <p className="text-xs text-[#a8a29e]">
                Configura número, salón asignado, capacidad y estado operativo por mesa.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateTable}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] text-xs font-black flex items-center gap-2 hover:brightness-110 shadow-lg cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Nueva Mesa</span>
            </button>
          </div>

          {/* Filtros de mesas */}
          <div className="p-3.5 rounded-2xl bg-[#14131a] border border-[#2d281e] flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Search className="w-4 h-4 text-[#a8a29e]" />
              <input
                type="text"
                placeholder="Buscar por número o nombre de mesa..."
                value={searchTable}
                onChange={(e) => setSearchTable(e.target.value)}
                className="bg-transparent text-xs text-[#FFFDF5] placeholder-[#a8a29e] focus:outline-none w-full sm:w-64"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-[#a8a29e] font-semibold whitespace-nowrap">Filtrar por Salón:</span>
              <select
                value={tableAreaFilter}
                onChange={(e) => setTableAreaFilter(e.target.value)}
                className="bg-[#1c1b24] border border-[#333] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A] w-full sm:w-auto"
              >
                <option value="todos">Todos los Salones</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabla listado de mesas */}
          <div className="bg-[#181818] border border-[#2d281e] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#14131a] text-[#a8a29e] uppercase font-bold text-[10px] tracking-wider border-b border-[#2d281e]">
                  <tr>
                    <th className="py-3 px-4">Mesa</th>
                    <th className="py-3 px-4">Salón / Área</th>
                    <th className="py-3 px-4">Capacidad</th>
                    <th className="py-3 px-4">Estado Actual</th>
                    <th className="py-3 px-4">Orden</th>
                    <th className="py-3 px-4">Operación</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24211a]">
                  {filteredTables.map((table) => {
                    const statusMeta = getTableStatusConfig(table.status);
                    const isMesaActive = table.isActive !== false;

                    return (
                      <tr key={table.id} className="hover:bg-[#1f1d24] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-xl bg-[#292212] border border-[#B77900]/40 text-[#D6A21A] font-black flex items-center justify-center text-sm">
                              {table.number}
                            </span>
                            <div>
                              <span className="font-bold text-[#FFFDF5] block">
                                {table.name || `Mesa #${table.number}`}
                              </span>
                              <span className="text-[10px] text-[#a8a29e]">ID: {table.id}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="bg-[#24211a] px-2 py-0.5 rounded-lg border border-[#333] text-[#d6d3d1] font-semibold text-[11px]">
                            {table.zone || 'Salón Principal'}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-[#FFFDF5] font-semibold">
                            <Users className="w-3.5 h-3.5 text-[#D6A21A]" />
                            <span>{table.capacity} personas</span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusMeta.badgeClass}`}
                          >
                            {statusMeta.label}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono text-[#a8a29e]">#{table.displayOrder || table.number}</td>

                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isMesaActive
                                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-600/40'
                                : 'bg-stone-900 text-stone-400 border-stone-700'
                            }`}
                          >
                            {isMesaActive ? 'Habilitada' : 'Desactivada'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateTable(table.id, { isActive: !isMesaActive })}
                              className="p-1.5 rounded-lg bg-[#24211a] hover:bg-[#333] text-[#d6d3d1] transition-colors cursor-pointer"
                              title={isMesaActive ? 'Desactivar mesa' : 'Activar mesa'}
                            >
                              {isMesaActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditTable(table)}
                              className="px-2.5 py-1 rounded-lg bg-[#292212] border border-[#B77900]/40 text-[#D6A21A] text-[11px] font-bold hover:brightness-110 flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Editar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTables.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-[#a8a29e]">
                        No se encontraron mesas que coincidan con los criterios de búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ESTACIONES OPERATIVAS */}
      {activeTab === 'stations' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#FFFDF5]">Estaciones Operativas de Preparación</h2>
              <p className="text-xs text-[#a8a29e]">
                Puntos de producción (Cocina caliente, cocina fría, barra, bebidas, postres) para enrutamiento de comandas.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateStation}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] text-xs font-black flex items-center gap-2 hover:brightness-110 shadow-lg cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Estación Operativa</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {prepStations.map((st) => (
              <div
                key={st.id}
                className="p-5 rounded-2xl bg-[#181818] border border-[#2d281e] hover:border-[#B77900]/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full inline-block"
                        style={{ backgroundColor: st.color || '#e11d48' }}
                      />
                      <span className="font-mono text-xs font-bold text-[#D6A21A] bg-[#292212] px-2 py-0.5 rounded border border-[#B77900]/30">
                        {st.code}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        st.isActive
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-600/40'
                          : 'bg-stone-900 text-stone-400 border-stone-700'
                      }`}
                    >
                      {st.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-[#FFFDF5] mt-2">{st.name}</h3>
                  <p className="text-xs text-[#a8a29e] mt-1 line-clamp-2">
                    {st.description || 'Sin descripción detallada.'}
                  </p>

                  <div className="mt-3 text-[11px] text-[#a8a29e]">
                    <span>Prioridad de Enrutamiento: </span>
                    <strong className="text-[#FFFDF5]">#{st.order}</strong>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#2d281e] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => togglePrepStationActive(st.id, !st.isActive)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer bg-[#24211a] hover:bg-[#333] text-[#d6d3d1]"
                  >
                    {st.isActive ? 'Desactivar' : 'Activar'}
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditStation(st)}
                    className="px-3 py-1.5 rounded-xl bg-[#292212] border border-[#B77900]/40 text-[#D6A21A] text-xs font-bold hover:brightness-110 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: HISTORIAL DE MODIFICACIONES (AUDITORÍA) */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#FFFDF5]">Historial de Modificaciones & Auditoría</h2>
              <p className="text-xs text-[#a8a29e]">
                Registro inmutable de todas las creaciones, cambios de estado y modificaciones en la sucursal actual.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#a8a29e] font-semibold whitespace-nowrap">Filtrar Entidad:</span>
              <select
                value={auditEntityFilter}
                onChange={(e) => setAuditEntityFilter(e.target.value)}
                className="bg-[#1c1b24] border border-[#333] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
              >
                <option value="todos">Todas las Entidades</option>
                <option value="area">Salones / Áreas</option>
                <option value="table">Mesas</option>
                <option value="prep_station">Estaciones Operativas</option>
              </select>
            </div>
          </div>

          <div className="bg-[#181818] border border-[#2d281e] rounded-2xl overflow-hidden shadow-xl">
            <div className="divide-y divide-[#24211a]">
              {filteredAuditLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-[#1c1b24] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#292212] border border-[#B77900]/40 text-[#D6A21A] flex items-center justify-center shrink-0 mt-0.5">
                      {log.entityType === 'area' && <Layers className="w-4 h-4" />}
                      {log.entityType === 'table' && <LayoutGrid className="w-4 h-4" />}
                      {log.entityType === 'prep_station' && <Flame className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-[#FFFDF5]">{log.entityName}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#24211a] text-[#a8a29e] border border-[#333]">
                          {log.entityType}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#292212] text-[#D6A21A] border border-[#B77900]/30">
                          {log.action}
                        </span>
                      </div>
                      <p className="text-xs text-[#d6d3d1] mt-1">{log.details}</p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-xs font-semibold text-[#FFFDF5] block">{log.performedByName}</span>
                    <span className="text-[11px] text-[#a8a29e] font-mono">
                      {formatColombiaDateTime(log.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
              {filteredAuditLogs.length === 0 && (
                <div className="text-center py-12 text-[#a8a29e] text-xs">
                  No se registran eventos de auditoría para el filtro seleccionado.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR ÁREA */}
      {areaModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          onClick={() => setAreaModalOpen(false)}
        >
          <div
            className="bg-[#181818] border border-[#B77900]/40 rounded-3xl max-w-md w-full p-5 sm:p-6 text-[#FFFDF5] shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#2d281e]">
              <h3 className="text-lg font-black text-[#FFFDF5]">
                {editingArea ? 'Editar Salón / Área' : 'Crear Nuevo Salón / Área'}
              </h3>
              <button
                type="button"
                onClick={() => setAreaModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#242424] hover:bg-[#333] text-[#d6d3d1] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formErrors.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-600/50 text-rose-200 text-xs space-y-1">
                {formErrors.map((err, i) => (
                  <p key={i}>• {err}</p>
                ))}
              </div>
            )}

            <form onSubmit={handleSaveArea} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-[#a8a29e] uppercase tracking-wider mb-1">
                  Nombre del Salón / Espacio *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Terraza Gourmet, Segundo Piso VIP"
                  value={areaForm.name}
                  onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })}
                  className="w-full bg-[#14131a] border border-[#333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#a8a29e] uppercase tracking-wider mb-1">
                  Descripción
                </label>
                <textarea
                  rows={2}
                  placeholder="Características del área (vista, pet-friendly, climatizada, etc.)"
                  value={areaForm.description}
                  onChange={(e) => setAreaForm({ ...areaForm, description: e.target.value })}
                  className="w-full bg-[#14131a] border border-[#333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#a8a29e] uppercase tracking-wider mb-1">
                    Orden de Visualización
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={areaForm.order}
                    onChange={(e) => setAreaForm({ ...areaForm, order: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-[#14131a] border border-[#333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={areaForm.isActive}
                      onChange={(e) => setAreaForm({ ...areaForm, isActive: e.target.checked })}
                      className="w-4 h-4 rounded text-[#D6A21A] focus:ring-0 bg-[#14131a] border-[#333]"
                    />
                    <span className="text-xs text-[#FFFDF5] font-semibold">Salón Activo</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-[#2d281e] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAreaModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#242424] text-[#d6d3d1] text-xs font-bold hover:bg-[#333] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs hover:brightness-110 cursor-pointer shadow-md"
                >
                  {isSaving ? 'Guardando...' : editingArea ? 'Guardar Cambios' : 'Crear Salón'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR MESA */}
      {tableModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          onClick={() => setTableModalOpen(false)}
        >
          <div
            className="bg-[#181818] border border-[#B77900]/40 rounded-3xl max-w-md w-full p-5 sm:p-6 text-[#FFFDF5] shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#2d281e]">
              <h3 className="text-lg font-black text-[#FFFDF5]">
                {editingTable ? `Editar Mesa #${editingTable.number}` : 'Registrar Nueva Mesa'}
              </h3>
              <button
                type="button"
                onClick={() => setTableModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#242424] hover:bg-[#333] text-[#d6d3d1] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formErrors.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-600/50 text-rose-200 text-xs space-y-1">
                {formErrors.map((err, i) => (
                  <p key={i}>• {err}</p>
                ))}
              </div>
            )}

            <form onSubmit={handleSaveTable} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#a8a29e] uppercase tracking-wider mb-1">
                    Número de Mesa *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={tableForm.number}
                    onChange={(e) => {
                      const num = parseInt(e.target.value, 10) || 1;
                      setTableForm({
                        ...tableForm,
                        number: num,
                        name: tableForm.name === `Mesa ${tableForm.number}` ? `Mesa ${num}` : tableForm.name,
                      });
                    }}
                    className="w-full bg-[#14131a] border border-[#333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#a8a29e] uppercase tracking-wider mb-1">
                    Capacidad (Comensales) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    required
                    value={tableForm.capacity}
                    onChange={(e) => setTableForm({ ...tableForm, capacity: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-[#14131a] border border-[#333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#a8a29e] uppercase tracking-wider mb-1">
                  Nombre o Identificador de Mesa
                </label>
                <input
                  type="text"
                  placeholder="Ej: Mesa 1, Mesa T-02, Barra 1"
                  value={tableForm.name}
                  onChange={(e) => setTableForm({ ...tableForm, name: e.target.value })}
                  className="w-full bg-[#14131a] border border-[#333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#a8a29e] uppercase tracking-wider mb-1">
                  Salón / Área Asignada *
                </label>
                <select
                  required
                  value={tableForm.areaId}
                  onChange={(e) => setTableForm({ ...tableForm, areaId: e.target.value })}
                  className="w-full bg-[#14131a] border border-[#333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                >
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} {!a.isActive ? '(Inactivo)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#a8a29e] uppercase tracking-wider mb-1">
                    Estado Inicial
                  </label>
                  <select
                    value={tableForm.status}
                    onChange={(e) => setTableForm({ ...tableForm, status: e.target.value as TableStatus })}
                    className="w-full bg-[#14131a] border border-[#333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                  >
                    <option value="libre">Libre</option>
                    <option value="ocupada">Ocupada</option>
                    <option value="reservada">Reservada</option>
                    <option value="limpieza">Limpieza</option>
                    <option value="mantenimiento">Fuera de Servicio</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={tableForm.isActive}
                      onChange={(e) => setTableForm({ ...tableForm, isActive: e.target.checked })}
                      className="w-4 h-4 rounded text-[#D6A21A] focus:ring-0 bg-[#14131a] border-[#333]"
                    />
                    <span className="text-xs text-[#FFFDF5] font-semibold">Mesa Habilitada</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-[#2d281e] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTableModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#242424] text-[#d6d3d1] text-xs font-bold hover:bg-[#333] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs hover:brightness-110 cursor-pointer shadow-md"
                >
                  {isSaving ? 'Guardando...' : editingTable ? 'Guardar Cambios' : 'Registrar Mesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR ESTACIÓN OPERATIVA */}
      {stationModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          onClick={() => setStationModalOpen(false)}
        >
          <div
            className="bg-[#181818] border border-[#B77900]/40 rounded-3xl max-w-md w-full p-5 sm:p-6 text-[#FFFDF5] shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#2d281e]">
              <h3 className="text-lg font-black text-[#FFFDF5]">
                {editingStation ? 'Editar Estación Operativa' : 'Nueva Estación Operativa'}
              </h3>
              <button
                type="button"
                onClick={() => setStationModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#242424] hover:bg-[#333] text-[#d6d3d1] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formErrors.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-600/50 text-rose-200 text-xs space-y-1">
                {formErrors.map((err, i) => (
                  <p key={i}>• {err}</p>
                ))}
              </div>
            )}

            <form onSubmit={handleSaveStation} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-[#a8a29e] uppercase tracking-wider mb-1">
                  Nombre de la Estación *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Cocina Caliente, Cocina Fría, Bebidas & Coctelería"
                  value={stationForm.name}
                  onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })}
                  className="w-full bg-[#14131a] border border-[#333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#a8a29e] uppercase tracking-wider mb-1">
                    Código Identificador *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: COC_CAL, BEB_COC"
                    value={stationForm.code}
                    onChange={(e) => setStationForm({ ...stationForm, code: e.target.value.toUpperCase() })}
                    className="w-full bg-[#14131a] border border-[#333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] font-mono focus:outline-none focus:border-[#D6A21A]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#a8a29e] uppercase tracking-wider mb-1">
                    Color de Identificación
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={stationForm.color}
                      onChange={(e) => setStationForm({ ...stationForm, color: e.target.value })}
                      className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={stationForm.color}
                      onChange={(e) => setStationForm({ ...stationForm, color: e.target.value })}
                      className="w-full bg-[#14131a] border border-[#333] rounded-xl px-2 py-1.5 text-xs text-[#FFFDF5] font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#a8a29e] uppercase tracking-wider mb-1">
                  Descripción
                </label>
                <textarea
                  rows={2}
                  placeholder="Línea de preparación, platos o insumos que procesa..."
                  value={stationForm.description}
                  onChange={(e) => setStationForm({ ...stationForm, description: e.target.value })}
                  className="w-full bg-[#14131a] border border-[#333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#a8a29e] uppercase tracking-wider mb-1">
                    Prioridad / Orden
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={stationForm.order}
                    onChange={(e) => setStationForm({ ...stationForm, order: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-[#14131a] border border-[#333] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={stationForm.isActive}
                      onChange={(e) => setStationForm({ ...stationForm, isActive: e.target.checked })}
                      className="w-4 h-4 rounded text-[#D6A21A] focus:ring-0 bg-[#14131a] border-[#333]"
                    />
                    <span className="text-xs text-[#FFFDF5] font-semibold">Estación Activa</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-[#2d281e] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStationModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#242424] text-[#d6d3d1] text-xs font-bold hover:bg-[#333] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs hover:brightness-110 cursor-pointer shadow-md"
                >
                  {isSaving ? 'Guardando...' : editingStation ? 'Guardar Cambios' : 'Crear Estación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
