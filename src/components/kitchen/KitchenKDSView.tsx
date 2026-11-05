import React, { useState, useEffect } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Comanda, KitchenStation, ComandaStatus, ComandaItemStatus } from '../../types';
import { formatColombiaDateTime } from '../../utils/calculations';
import {
  Flame,
  Clock,
  CheckCircle,
  AlertTriangle,
  UtensilsCrossed,
  Filter,
  Layers,
  Soup,
  Wine,
  Cake,
  Bell,
  RefreshCw,
} from 'lucide-react';

export const KitchenKDSView: React.FC = () => {
  const {
    activeComandas,
    updateComandaStatus,
    updateComandaItemStatus,
    currentBranch,
  } = useRestaurant();

  const [selectedStation, setSelectedStation] = useState<string>('todas');
  const [nowTime, setNowTime] = useState<number>(Date.now());

  // Ticker para actualizar los minutos transcurridos en tiempo real
  useEffect(() => {
    const interval = setInterval(() => setNowTime(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  const stations: { id: string; label: string; icon: any }[] = [
    { id: 'todas', label: 'Todas las Estaciones', icon: UtensilsCrossed },
    { id: 'parrilla', label: 'Parrilla & Cortes', icon: Flame },
    { id: 'cocina_caliente', label: 'Cocina Caliente', icon: Soup },
    { id: 'bar_bebidas', label: 'Bar & Bebidas', icon: Wine },
    { id: 'postres', label: 'Postres & Dulce', icon: Cake },
  ];

  // Filtrar comandas según la estación si tienen items para dicha estación
  const filteredComandas = activeComandas.filter((c) => {
    if (selectedStation === 'todas') return true;
    return c.items.some((it) => it.station === selectedStation);
  });

  const getElapsedMinutes = (dateString: string) => {
    const elapsed = Math.floor((nowTime - new Date(dateString).getTime()) / 60000);
    return Math.max(0, elapsed);
  };

  const getElapsedBadge = (minutes: number) => {
    if (minutes < 12) {
      return {
        text: `${minutes} min`,
        classes: 'bg-[#1a2e22] text-emerald-400 border border-emerald-600/40',
      };
    }
    if (minutes < 25) {
      return {
        text: `${minutes} min (Demora media)`,
        classes: 'bg-[#3b2a12] text-[#d4af37] border border-[#d4af37]/50 animate-pulse',
      };
    }
    return {
      text: `⚠️ ${minutes} min (Demora alta)`,
      classes: 'bg-red-950 text-red-300 border border-red-700 animate-bounce',
    };
  };

  return (
    <div className="space-y-6">
      
      {/* Barra superior KDS */}
      <div className="bg-[#14131a] p-4 rounded-2xl border border-[#2d281e] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#785c13] flex items-center justify-center text-[#0e0e12] font-black shadow-lg">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#fef3c7]">
                Monitor de Cocina y Despacho (KDS)
              </h2>
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700/60">
                Tiempo Real
              </span>
            </div>
            <p className="text-xs text-[#a8a29e]">
              {currentBranch?.name} · {activeComandas.length} comandas en preparación
            </p>
          </div>
        </div>

        {/* Filtro por Estación de Cocina */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {stations.map((st) => {
            const Icon = st.icon;
            const isSelected = selectedStation === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStation(st.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-[#d4af37] text-[#0e0e12] font-black shadow-md'
                    : 'bg-[#18171f] text-[#a8a29e] border border-[#2d281e] hover:bg-[#22202b]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{st.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Comandas Activas */}
      {filteredComandas.length === 0 ? (
        <div className="bg-[#14131a] border border-dashed border-[#383124] rounded-2xl p-12 text-center text-[#78716c]">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500/50" />
          <h3 className="text-sm font-bold text-[#fef3c7] mb-1">¡Cocina al día!</h3>
          <p className="text-xs text-[#a8a29e]">
            No hay comandas pendientes de preparación en la estación seleccionada.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredComandas.map((comanda) => {
            const elapsed = getElapsedMinutes(comanda.createdAt);
            const elapsedBadge = getElapsedBadge(elapsed);
            const isNew = comanda.status === 'nueva';

            // Filtrar items si hay estación seleccionada
            const visibleItems =
              selectedStation === 'todas'
                ? comanda.items
                : comanda.items.filter((it) => it.station === selectedStation);

            return (
              <div
                key={comanda.id}
                className={`rounded-2xl border flex flex-col justify-between overflow-hidden transition-all shadow-xl ${
                  isNew
                    ? 'bg-gradient-to-br from-[#1e1912] to-[#121117] border-[#d4af37] ring-1 ring-[#d4af37]/40'
                    : 'bg-[#14131a] border-[#2d281e]'
                }`}
              >
                {/* Cabecera del Ticket */}
                <div className="p-3.5 border-b border-[#2d281e] bg-[#18171f] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-[#fef3c7]">
                        {comanda.tableName}
                      </span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#2b2416] text-[#d4af37] border border-[#d4af37]/40">
                        Ronda #{comanda.roundNumber}
                      </span>
                      {isNew && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-600 text-white animate-pulse">
                          Nueva
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#a8a29e] block mt-0.5">
                      Pedido #{comanda.orderNumber} · Mesero: {comanda.waiterName}
                    </span>
                  </div>

                  {/* Tiempo transcurrido */}
                  <div className={`px-2 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1 ${elapsedBadge.classes}`}>
                    <Clock className="w-3 h-3" />
                    <span>{elapsedBadge.text}</span>
                  </div>
                </div>

                {/* Items a Preparar */}
                <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-72">
                  {visibleItems.map((item) => {
                    const isItemReady = item.status === 'listo' || item.status === 'servido';
                    return (
                      <div
                        key={item.orderItemId}
                        onClick={() => {
                          const nextStatus: ComandaItemStatus =
                            item.status === 'pendiente'
                              ? 'en_preparacion'
                              : item.status === 'en_preparacion'
                              ? 'listo'
                              : 'servido';
                          updateComandaItemStatus(comanda.id, item.orderItemId, nextStatus);
                        }}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                          isItemReady
                            ? 'bg-[#111e16] border-emerald-600/40 text-emerald-300 opacity-80'
                            : item.status === 'en_preparacion'
                            ? 'bg-[#261f13] border-[#d4af37]/60 text-[#fef3c7]'
                            : 'bg-[#18171f] border-[#2d281e] text-[#faf5ee] hover:border-[#4d3d19]'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-[#0e0e12] border border-[#383124] flex items-center justify-center font-black text-sm text-[#d4af37] shrink-0">
                          {item.quantity}x
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold leading-tight ${isItemReady ? 'line-through text-emerald-400' : ''}`}>
                              {item.name}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-[#a8a29e]">
                              {item.status.replace('_', ' ')}
                            </span>
                          </div>

                          {item.notes && (
                            <p className="text-[11px] text-[#e6ca65] italic mt-1 font-semibold bg-[#2a2315] px-2 py-0.5 rounded border border-[#52411e]">
                              Nota: {item.notes}
                            </p>
                          )}

                          {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                            <div className="mt-1 text-[10.5px] text-[#d4af37] space-y-0.5 font-medium">
                              {item.selectedModifiers.map((m: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-1">
                                  <span>• {m.groupName}:</span>
                                  <strong className="text-white">{m.optionName}</strong>
                                  {m.quantity && m.quantity > 1 ? ` (x${m.quantity})` : ''}
                                  {m.textValue ? ` "${m.textValue}"` : ''}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Acciones Rápidas del Ticket */}
                <div className="p-3 border-t border-[#2d281e] bg-[#121117] flex items-center gap-2">
                  {comanda.status === 'nueva' && (
                    <button
                      type="button"
                      onClick={() => updateComandaStatus(comanda.id, 'en_preparacion')}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#2a2213] text-[#d4af37] border border-[#d4af37]/40 hover:bg-[#382d17] font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>Iniciar Marcha</span>
                    </button>
                  )}

                  {comanda.status !== 'lista' && comanda.status !== 'servida' && (
                    <button
                      type="button"
                      onClick={() => updateComandaStatus(comanda.id, 'lista')}
                      className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs flex items-center justify-center gap-1 hover:brightness-110 shadow cursor-pointer transition-all"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>¡Marcar Todo Listo!</span>
                    </button>
                  )}

                  {comanda.status === 'lista' && (
                    <button
                      type="button"
                      onClick={() => updateComandaStatus(comanda.id, 'servida')}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-600/50 hover:bg-emerald-900 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Entregado a Mesero / Despachado</span>
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
