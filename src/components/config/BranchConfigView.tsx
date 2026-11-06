import React from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { UserRole, PaperWidth, KitchenFontSize, DEFAULT_BRANCH_PRINT_CONFIG, BranchPrintConfig } from '../../types';
import {
  Building2,
  ShieldCheck,
  Coins,
  Check,
  Sliders,
  Printer,
  ChefHat,
  Receipt,
} from 'lucide-react';

interface BranchConfigViewProps {
  onNavigateToButtons?: () => void;
}

export const BranchConfigView: React.FC<BranchConfigViewProps> = ({ onNavigateToButtons }) => {
  const { branches, currentBranch, setCurrentBranchId } = useRestaurant();
  const { updateBranchData } = useAuth();
  const { showToast } = useToast();

  const currentPrintConfig: BranchPrintConfig = currentBranch?.printConfig || DEFAULT_BRANCH_PRINT_CONFIG;
  const activePaperWidth: PaperWidth = currentPrintConfig.paperWidth || '80mm';
  const activeKitchenFontSize: KitchenFontSize = currentPrintConfig.kitchenFontSize || 'grande';
  const activeIncludeKitchenPrices: boolean = currentPrintConfig.includeKitchenPrices ?? false;

  const handleUpdateTicketConfig = async (partial: Partial<BranchPrintConfig>) => {
    if (!currentBranch) return;
    const nextConfig: BranchPrintConfig = {
      ...currentPrintConfig,
      ...partial,
    };
    try {
      await updateBranchData(currentBranch.id, { printConfig: nextConfig });
      showToast('Configuración de tickets POS actualizada', 'success');
    } catch (err) {
      console.error(err);
      showToast('No se pudo actualizar la configuración de tickets', 'error');
    }
  };

  // Matriz de permisos configurables por rol
  const rolePermissions: Array<{
    role: UserRole;
    title: string;
    description: string;
    permissions: string[];
  }> = [
    {
      role: 'administrador',
      title: 'Administrador (Acceso Total)',
      description: 'Acceso irrestricto y completo a todas las sucursales, finanzas, inventarios, compras, informes y configuraciones.',
      permissions: [
        'Acceso total a todos los módulos y apartados del sistema',
        'Gestión de usuarios, roles y sucursales autorizadas',
        'Configuración de cartas, productos, recetas y salones',
        'Administración de compras, desembolsos, proveedores y gastos',
        'Consultar informes y estadísticas avanzadas con exportación',
        'Apertura, arqueo, cierre y movimientos de caja',
        'Operación de pedidos, mesas, cocina, domicilios e ingresos',
      ],
    },
    {
      role: 'asesor',
      title: 'Asesor (Apartado Operación)',
      description: 'Acceso exclusivo al apartado Operación para la atención comercial diaria y cuadre de caja.',
      permissions: [
        'Acceso al módulo Inicio y Tablero Principal de Pedidos',
        'Crear, editar y cobrar Pedidos Comerciales',
        'Control y gestión de Mesas y Salón (abrir cuentas, rondas, pre-cuentas)',
        'Despacho y seguimiento de Domicilios y Pedidos para Llevar',
        'Apertura de turno, registro de bases y cierre de Caja con arqueo',
        'Módulo de Ingresos, registro de Otros Ingresos y emisión de comprobantes',
        'Visualización de monitor de cocina (KDS) para seguimiento de comandas',
      ],
    },
    {
      role: 'cocinero',
      title: 'Cocinero (Únicamente Cocina)',
      description: 'Acceso únicamente a la parte de cocina para visualización y preparación de comandas en tiempo real.',
      permissions: [
        'Acceso único y exclusivo al Monitor KDS de Cocina',
        'Visualización de comandas en tiempo real filtradas por estación',
        'Marcar comandas y platos en preparación',
        'Marcar comandas y platos listos para servir o despachar',
        'Consultar notas de preparación, términos de carne y alérgenos',
      ],
    },
  ];

  return (
    <div className="space-y-6">
      
      {/* 1. Sucursales Colmena */}
      <div className="bg-[#14131a] p-5 rounded-2xl border border-[#2d281e] shadow-xl">
        <div className="flex items-center gap-2 pb-3 border-b border-[#2d281e] mb-4">
          <Building2 className="w-5 h-5 text-[#d4af37]" />
          <div>
            <h3 className="font-bold text-sm text-[#fef3c7]">Sucursales del Sistema Colmena</h3>
            <p className="text-xs text-[#a8a29e]">
              Cada registro comercial, mesa, inventario y turno de caja pertenece estrictamente a una sucursal.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {branches.map((branch) => {
            const isSelected = currentBranch?.id === branch.id;
            return (
              <div
                key={branch.id}
                onClick={() => setCurrentBranchId(branch.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#1e1b15] border-[#d4af37] ring-1 ring-[#d4af37]/30 shadow-lg'
                    : 'bg-[#18171f] border-[#2d281e] hover:border-[#383124]'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h4 className="font-bold text-sm text-[#fef3c7]">{branch.name}</h4>
                    <span className="text-xs text-[#a8a29e]">{branch.address}</span>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-[#d4af37] text-[#0e0e12]">
                      Activa
                    </span>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-[#2d281e] flex items-center justify-between text-xs text-[#d6d3d1]">
                  <span>Teléfono: {branch.phone}</span>
                  <span className="text-[#d4af37] font-bold">Impoconsumo: {((branch.receiptConfig?.showTax === false || branch.taxRate === 0) ? 0 : (branch.taxRate * 100)).toFixed(0)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 1.5 Configuración de Tickets POS y Preferencias de Cocina */}
      {currentBranch && (
        <div className="bg-[#14131a] p-5 rounded-2xl border border-[#d4af37]/40 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#2d281e] gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#292212] border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37]">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#fef3c7]">
                  Configuración de Tickets POS y Preferencias de Cocina ({currentBranch.name})
                </h3>
                <p className="text-xs text-[#a8a29e]">
                  Ajusta el tamaño de letra de impresión, el ancho del papel térmico y las preferencias del ticket de cocina.
                </p>
              </div>
            </div>
            <span className="text-[10px] uppercase font-black px-2.5 py-1 rounded-full bg-[#292212] text-[#d4af37] border border-[#d4af37]/30 self-start sm:self-auto">
              1 Sola Copia por Impresión
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tamaño de la Impresión (Letra de Cocina) */}
            <div className="bg-[#18171f] p-4 rounded-xl border border-[#2d281e] space-y-2.5">
              <span className="text-xs font-bold text-[#d4af37] flex items-center gap-1.5">
                <ChefHat className="w-4 h-4" />
                <span>1. Tamaño de la Impresión (Cocina)</span>
              </span>
              <div className="space-y-1.5">
                {(
                  [
                    { id: 'compacto', label: 'Compacto (Estándar)', desc: 'Ahorra papel en pedidos largos' },
                    { id: 'grande', label: 'Grande (Recomendado)', desc: 'Letra grande y clara para cocina' },
                    { id: 'extragrande', label: 'Extra Grande (Adulto Mayor)', desc: 'Máxima legibilidad a distancia' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleUpdateTicketConfig({ kitchenFontSize: opt.id })}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      activeKitchenFontSize === opt.id
                        ? 'bg-[#292212] border-[#d4af37] text-[#fef3c7]'
                        : 'bg-[#14131a] border-[#2d281e] text-[#a8a29e] hover:border-[#383124]'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-black">{opt.label}</div>
                      <div className="text-[10px] opacity-80">{opt.desc}</div>
                    </div>
                    {activeKitchenFontSize === opt.id && <Check className="w-4 h-4 text-[#d4af37] shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Ancho del Papel Térmico */}
            <div className="bg-[#18171f] p-4 rounded-xl border border-[#2d281e] space-y-2.5">
              <span className="text-xs font-bold text-[#d4af37] flex items-center gap-1.5">
                <Receipt className="w-4 h-4" />
                <span>2. Ancho del Papel Térmico</span>
              </span>
              <p className="text-[11px] text-[#a8a29e]">
                Aplica tanto al Ticket de Cobro al Cliente como al Ticket POS de Cocina.
              </p>
              <div className="grid grid-cols-1 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleUpdateTicketConfig({ paperWidth: '80mm' })}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    activePaperWidth === '80mm'
                      ? 'bg-[#292212] border-[#d4af37] text-[#fef3c7]'
                      : 'bg-[#14131a] border-[#2d281e] text-[#a8a29e] hover:border-[#383124]'
                  }`}
                >
                  <div>
                    <div className="text-xs font-black">80 mm (Estándar POS)</div>
                    <div className="text-[10px] opacity-80">Ancho imprimible ~72 mm</div>
                  </div>
                  {activePaperWidth === '80mm' && <Check className="w-4 h-4 text-[#d4af37]" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateTicketConfig({ paperWidth: '58mm' })}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    activePaperWidth === '58mm'
                      ? 'bg-[#292212] border-[#d4af37] text-[#fef3c7]'
                      : 'bg-[#14131a] border-[#2d281e] text-[#a8a29e] hover:border-[#383124]'
                  }`}
                >
                  <div>
                    <div className="text-xs font-black">58 mm (Rollo Estrecho)</div>
                    <div className="text-[10px] opacity-80">Ancho imprimible ~48 mm</div>
                  </div>
                  {activePaperWidth === '58mm' && <Check className="w-4 h-4 text-[#d4af37]" />}
                </button>
              </div>
            </div>

            {/* Preferencias de Cocina */}
            <div className="bg-[#18171f] p-4 rounded-xl border border-[#2d281e] space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-[#d4af37] flex items-center gap-1.5">
                  <Sliders className="w-4 h-4" />
                  <span>3. Preferencias de Cocina</span>
                </span>
                <p className="text-[11px] text-[#a8a29e]">
                  Configura qué información adicional se incluye en la comanda impresa para los cocineros.
                </p>

                <label className="flex items-center justify-between p-3 rounded-xl bg-[#14131a] border border-[#2d281e] hover:border-[#d4af37]/50 cursor-pointer transition-all">
                  <div className="pr-2">
                    <span className="text-xs font-bold text-[#fef3c7] block">
                      Mostrar precios en ticket de cocina
                    </span>
                    <span className="text-[10px] text-[#a8a29e] block">
                      Si se desactiva, el ticket de cocina muestra solo cantidades, platos y notas.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={activeIncludeKitchenPrices}
                    onChange={(e) =>
                      handleUpdateTicketConfig({ includeKitchenPrices: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#d4af37] cursor-pointer shrink-0"
                  />
                </label>
              </div>

              <div className="p-2.5 rounded-lg bg-[#14131a] border border-[#2d281e] text-[10px] text-[#a8a29e]">
                Al abrir el botón <strong className="text-[#d4af37]">POS Cocina</strong> en cualquier pedido, se mostrará únicamente el ticket listo para imprimir 1 sola página.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Parámetros Legales y Financieros Colombia */}
      <div className="bg-[#14131a] p-5 rounded-2xl border border-[#2d281e] shadow-xl">
        <h3 className="font-bold text-sm text-[#fef3c7] mb-3 flex items-center gap-2">
          <Coins className="w-4 h-4 text-[#d4af37]" />
          <span>Configuración Regional y Fiscal (Colombia)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[#18171f] p-3.5 rounded-xl border border-[#2d281e]">
            <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">Moneda de Operación</span>
            <span className="text-sm font-black text-[#fef3c7] mt-1 block">Pesos Colombianos (COP)</span>
            <span className="text-[11px] text-[#78716c]">Separador de miles punto ($ 25.000 COP)</span>
          </div>

          <div className="bg-[#18171f] p-3.5 rounded-xl border border-[#2d281e]">
            <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">Zona Horaria Oficial</span>
            <span className="text-sm font-black text-[#d4af37] mt-1 block">America/Bogota (UTC-5)</span>
            <span className="text-[11px] text-[#78716c]">Registros y auditoría en hora colombiana</span>
          </div>

          <div className="bg-[#18171f] p-3.5 rounded-xl border border-[#2d281e]">
            <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">Impuestos Gastronómicos</span>
            <span className="text-sm font-black text-emerald-400 mt-1 block">Impoconsumo 8%</span>
            <span className="text-[11px] text-[#78716c]">Ley 1935 / Estatuto Tributario Art. 512-1</span>
          </div>
        </div>
      </div>

      {/* 3. Matriz de Roles y Permisos de Personal */}
      <div className="bg-[#14131a] p-5 rounded-2xl border border-[#2d281e] shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#2d281e] mb-4 gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#d4af37]" />
            <div>
              <h3 className="font-bold text-sm text-[#fef3c7]">Matriz de Roles y Permisos del Personal</h3>
              <p className="text-xs text-[#a8a29e]">
                Administrador (Acceso total), Asesor (Operación) y Cocinero (Cocina KDS).
              </p>
            </div>
          </div>
          {onNavigateToButtons && (
            <button
              type="button"
              onClick={onNavigateToButtons}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs flex items-center gap-2 hover:brightness-110 shadow-md cursor-pointer self-start sm:self-auto"
            >
              <Sliders className="w-4 h-4" />
              <span>Configurar Botones y Roles</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rolePermissions.map((item) => (
            <div
              key={item.role}
              className="bg-[#18171f] p-4 rounded-xl border border-[#2d281e] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-7 h-7 rounded-lg bg-[#2b2416] text-[#d4af37] font-black text-xs flex items-center justify-center border border-[#d4af37]/40 uppercase">
                    {item.role[0]}
                  </span>
                  <h4 className="font-bold text-sm text-[#fef3c7]">{item.title}</h4>
                </div>
                <p className="text-xs text-[#a8a29e] mb-3 leading-relaxed">
                  {item.description}
                </p>

                <div className="space-y-1.5 pt-2 border-t border-[#26231d]">
                  <span className="text-[10px] uppercase font-bold text-[#d4af37] block">
                    Permisos Otorgados:
                  </span>
                  {item.permissions.map((p, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-xs text-[#d6d3d1]">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
