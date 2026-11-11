import React, { useState, useMemo } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import { formatColombiaDateTime } from '../../utils/calculations';
import {
  History,
  Search,
  Filter,
  Layers,
  LayoutGrid,
  Flame,
  Building2,
  UtensilsCrossed,
  Boxes,
  CreditCard,
  User,
  Shield,
  FileText,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export const AuditHistoryView: React.FC = () => {
  const { auditLogs, currentBranch } = useRestaurant();
  const { currentUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [entityFilter, setEntityFilter] = useState<string>('todos');
  const [actionFilter, setActionFilter] = useState<string>('todas');

  // Filtrado reactivo de registros de auditoría
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      // Filtro por entidad
      if (entityFilter !== 'todos' && log.entityType !== entityFilter) {
        return false;
      }

      // Filtro por acción
      if (actionFilter !== 'todas') {
        const act = (log.action || '').toLowerCase();
        if (actionFilter === 'creacion' && !act.includes('crea') && !act.includes('create')) {
          return false;
        }
        if (actionFilter === 'modificacion' && !act.includes('modific') && !act.includes('actualiz') && !act.includes('update')) {
          return false;
        }
        if (actionFilter === 'eliminacion' && !act.includes('elimin') && !act.includes('borr') && !act.includes('delete')) {
          return false;
        }
        if (actionFilter === 'estado' && !act.includes('activ') && !act.includes('desactiv')) {
          return false;
        }
      }

      // Búsqueda de texto libre
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchEntity = (log.entityName || '').toLowerCase().includes(query);
        const matchUser = (log.performedByName || '').toLowerCase().includes(query);
        const matchDetails = (log.details || '').toLowerCase().includes(query);
        const matchAction = (log.action || '').toLowerCase().includes(query);
        const matchType = (log.entityType || '').toLowerCase().includes(query);

        if (!matchEntity && !matchUser && !matchDetails && !matchAction && !matchType) {
          return false;
        }
      }

      return true;
    });
  }, [auditLogs, entityFilter, actionFilter, searchTerm]);

  // Ícono según tipo de entidad
  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'area':
        return <Layers className="w-4 h-4 text-amber-400" />;
      case 'table':
        return <LayoutGrid className="w-4 h-4 text-[#D6A21A]" />;
      case 'prep_station':
        return <Flame className="w-4 h-4 text-rose-400" />;
      case 'branch':
        return <Building2 className="w-4 h-4 text-emerald-400" />;
      case 'product':
      case 'menu_item':
        return <UtensilsCrossed className="w-4 h-4 text-orange-400" />;
      case 'category':
        return <FileText className="w-4 h-4 text-yellow-400" />;
      case 'inventory':
      case 'inventory_item':
        return <Boxes className="w-4 h-4 text-blue-400" />;
      case 'payment_method':
        return <CreditCard className="w-4 h-4 text-purple-400" />;
      case 'user':
        return <User className="w-4 h-4 text-cyan-400" />;
      default:
        return <History className="w-4 h-4 text-[#D6A21A]" />;
    }
  };

  // Nombre legible de la entidad
  const getEntityLabel = (type: string) => {
    switch (type) {
      case 'area':
        return 'Salón / Espacio';
      case 'table':
        return 'Mesa';
      case 'prep_station':
        return 'Estación de Cocina';
      case 'branch':
        return 'Sucursal';
      case 'product':
      case 'menu_item':
        return 'Plato / Producto';
      case 'category':
        return 'Categoría';
      case 'inventory':
      case 'inventory_item':
        return 'Insumo / Stock';
      case 'payment_method':
        return 'Medio de Pago';
      case 'user':
        return 'Usuario';
      default:
        return type || 'Entidad';
    }
  };

  // Estilo de badge según acción
  const getActionBadge = (action: string = '') => {
    const act = action.toLowerCase();
    if (act.includes('crea') || act.includes('create')) {
      return 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60';
    }
    if (act.includes('elimin') || act.includes('borr') || act.includes('delete')) {
      return 'bg-red-950/80 text-red-300 border-red-700/60';
    }
    if (act.includes('desactiv')) {
      return 'bg-amber-950/80 text-amber-300 border-amber-700/60';
    }
    if (act.includes('activ')) {
      return 'bg-blue-950/80 text-blue-300 border-blue-700/60';
    }
    return 'bg-[#292212] text-[#D6A21A] border-[#B77900]/40';
  };

  return (
    <div className="space-y-6">
      {/* 1. Cabecera Principal */}
      <div className="bg-[#181818] p-5 sm:p-6 rounded-3xl border border-[#333333] text-[#FFFDF5] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#B77900] to-[#D6A21A] flex items-center justify-center text-[#181818] font-black shadow-lg shadow-[#B77900]/20">
            <History className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-black text-[#FFFDF5]">
                Historial de Modificaciones & Auditoría
              </h2>
              <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-[#292212] text-[#D6A21A] border border-[#B77900]/40">
                Inmutable · Tiempo Real
              </span>
            </div>
            <p className="text-xs text-[#a8a29e] mt-0.5">
              Trazabilidad integral de cambios en salones, mesas, estaciones, cartas, sucursales y ajustes operativos.
            </p>
          </div>
        </div>

        {/* Badge de Sede Actual */}
        {currentBranch && (
          <div className="bg-[#242424] border border-[#383838] px-3.5 py-2 rounded-2xl flex items-center gap-2.5 self-start md:self-auto shadow-sm">
            <Building2 className="w-4 h-4 text-[#D6A21A]" />
            <div className="text-left">
              <span className="block text-[9px] uppercase font-bold text-[#a8a29e]">Sede de Auditoría</span>
              <span className="text-xs font-black text-[#FFFDF5]">{currentBranch.name}</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Filtros y Búsqueda */}
      <div className="bg-[#181818] p-4 sm:p-5 rounded-2xl border border-[#333333] shadow-md space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Búsqueda */}
          <div className="sm:col-span-2 lg:col-span-5 relative">
            <Search className="w-4 h-4 text-[#a8a29e] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por usuario, elemento o detalles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#242424] border border-[#383838] rounded-xl pl-9 pr-3 py-2 text-xs text-[#FFFDF5] placeholder:text-[#78716c] focus:outline-none focus:border-[#D6A21A] transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#a8a29e] hover:text-[#FFFDF5]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtro por Entidad */}
          <div className="lg:col-span-4 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#D6A21A] shrink-0" />
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A] cursor-pointer"
            >
              <option value="todos">Todas las Entidades</option>
              <option value="area">Salones / Áreas</option>
              <option value="table">Mesas</option>
              <option value="prep_station">Estaciones de Cocina</option>
              <option value="product">Platos / Productos</option>
              <option value="category">Categorías de Menú</option>
              <option value="branch">Sucursales</option>
              <option value="inventory">Insumos e Inventario</option>
              <option value="user">Usuarios & Personal</option>
              <option value="payment_method">Medios de Pago</option>
            </select>
          </div>

          {/* Filtro por Tipo de Acción */}
          <div className="lg:col-span-3">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A] cursor-pointer"
            >
              <option value="todas">Todas las Acciones</option>
              <option value="creacion">Creaciones</option>
              <option value="modificacion">Modificaciones</option>
              <option value="eliminacion">Eliminaciones</option>
              <option value="estado">Cambios de Estado</option>
            </select>
          </div>
        </div>

        {/* Resumen de Resultados */}
        <div className="flex items-center justify-between pt-2 border-t border-[#2a2a2a] text-xs text-[#a8a29e]">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#D6A21A]" />
            <span>
              Mostrando <strong className="text-[#FFFDF5]">{filteredLogs.length}</strong> de{' '}
              <strong className="text-[#FFFDF5]">{auditLogs.length}</strong> eventos registrados
            </span>
          </span>
          {(searchTerm || entityFilter !== 'todos' || actionFilter !== 'todas') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setEntityFilter('todos');
                setActionFilter('todas');
              }}
              className="text-[#D6A21A] hover:underline font-bold text-[11px] cursor-pointer"
            >
              Restablecer filtros
            </button>
          )}
        </div>
      </div>

      {/* 3. Lista de Eventos de Auditoría */}
      <div className="bg-[#181818] border border-[#333333] rounded-3xl overflow-hidden shadow-xl">
        {filteredLogs.length > 0 ? (
          <div className="divide-y divide-[#2a2a2a]">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 sm:p-5 hover:bg-[#202020] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                {/* Lado Izquierdo: Ícono de entidad + Detalles */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-[#242424] border border-[#383838] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    {getEntityIcon(log.entityType)}
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-black text-[#FFFDF5] truncate">
                        {log.entityName || 'Registro del Sistema'}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#242424] text-[#a8a29e] border border-[#383838]">
                        {getEntityLabel(log.entityType)}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </div>

                    <p className="text-xs text-[#d6d3d1] break-words leading-relaxed">
                      {log.details || 'Sin detalles adicionales especificados.'}
                    </p>
                  </div>
                </div>

                {/* Lado Derecho: Responsable + Fecha */}
                <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#2a2a2a] md:border-none pl-13 md:pl-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#FFFDF5]">
                    <User className="w-3.5 h-3.5 text-[#D6A21A]" />
                    <span>{log.performedByName || 'Usuario del Sistema'}</span>
                  </div>
                  <span className="text-[11px] text-[#a8a29e] font-mono mt-0.5">
                    {log.timestamp ? formatColombiaDateTime(log.timestamp) : 'Fecha no registrada'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-[#242424] border border-[#383838] text-[#a8a29e] flex items-center justify-center mx-auto">
              <History className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-black text-[#FFFDF5]">
              No se encontraron eventos de auditoría
            </h3>
            <p className="text-xs text-[#a8a29e] max-w-sm mx-auto">
              {auditLogs.length === 0
                ? 'Aún no se han registrado eventos de modificación en esta base de datos.'
                : 'No hay eventos que coincidan con los filtros y término de búsqueda seleccionados.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
