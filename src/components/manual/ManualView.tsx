import React, { useState } from 'react';
import {
  BookOpen,
  Printer,
  ExternalLink,
  Search,
  CheckCircle2,
  Clock,
  Coins,
  ShieldCheck,
  UtensilsCrossed,
  ChefHat,
  Receipt,
  Store,
  Layers,
  Users,
  Building2,
  Bike,
  HelpCircle,
  FileText,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { formatCOP } from '../../utils/calculations';

interface ManualTopic {
  id: string;
  category: 'operacion' | 'facturacion' | 'administracion';
  title: string;
  badge: string;
  summary: string;
  steps: string[];
  tips?: string;
  tagColor: string;
}

const TOPICS: ManualTopic[] = [
  {
    id: 'roles',
    category: 'administracion',
    title: '1. Roles de Personal y Permisos',
    badge: 'Seguridad',
    tagColor: 'text-amber-400 bg-amber-950/40 border-amber-800',
    summary: 'El sistema restringe el acceso según el rol de cada colaborador para proteger arqueos y configuraciones fiscales.',
    steps: [
      'Administrador: Control total de cajas, usuarios, compras, reportes, sucursales y parámetros DIAN.',
      'Asesor / Mesero: Apertura de mesas, toma de pedidos, rondas adicionales y liquidación de cuentas.',
      'Cocinero: Acceso exclusivo a la pantalla KDS de cocina por estaciones (Parrilla, Caliente, Bar, Postres).',
    ],
    tips: 'Al ingresar con la cédula de ciudadanía, el sistema redirige automáticamente al módulo correspondiente.',
  },
  {
    id: 'mesas',
    category: 'operacion',
    title: '2. Gestión de Salones y Mesas',
    badge: 'Sala',
    tagColor: 'text-emerald-400 bg-emerald-950/40 border-emerald-800',
    summary: 'Control visual en tiempo real de la ocupación, cuentas abiertas y tiempos de servicio.',
    steps: [
      'Mesa Libre (Verde): Toca la mesa para abrir comanda y asignar mesero.',
      'Mesa Ocupada (Ámbar): Cuenta abierta con cronómetro de tiempo de estancia en vivo.',
      'Cuenta Pedida (Azul): Comensal listo para pagar; mesa en proceso de liquidación.',
      'Reservada (Púrpura): Mesa bloqueada con anticipación para clientes preferentes.',
    ],
    tips: 'La barra de estado muestra el saldo actual de consumo en cada mesa sin necesidad de abrirla.',
  },
  {
    id: 'pedidos',
    category: 'operacion',
    title: '3. Toma de Pedidos y Modificadores',
    badge: 'Comanda',
    tagColor: 'text-blue-400 bg-blue-950/40 border-blue-800',
    summary: 'Personalización detallada con términos de carne, sustituciones y notas de cocina.',
    steps: [
      'Selecciona el tipo de servicio: Mesa, Mostrador, Para Llevar o Domicilio.',
      'Elige el plato en el catálogo y abre el modal de personalización gastronómica.',
      'Configura términos (3/4, medio), exclusiones (sin cebolla) o adiciones con cobro.',
      'Presiona "Confirmar y Despachar"; la comanda se proyecta al instante en el KDS de cocina.',
    ],
    tips: 'El inventario de insumos (carne, pan, queso) se descuenta automáticamente según la receta técnica.',
  },
  {
    id: 'rondas',
    category: 'operacion',
    title: '4. Adición de Rondas sin Duplicidad',
    badge: 'Cocina Ágil',
    tagColor: 'text-purple-400 bg-purple-950/40 border-purple-800',
    summary: 'Envía segundas o terceras rondas de bebidas y comida sin duplicar los platos iniciales.',
    steps: [
      'En la tarjeta del pedido o mesa abierta, presiona "Agregar Productos / Ronda".',
      'El carrito se inicia en blanco para seleccionar únicamente las nuevas adiciones.',
      'Al enviar, cocina recibe un ticket exclusivo de "Ronda #2", manteniendo la cuenta unificada.',
    ],
    tips: 'Los cocineros visualizan en grande el número de ronda para priorizar los despachos.',
  },
  {
    id: 'impoconsumo',
    category: 'facturacion',
    title: '5. Articulación de Impoconsumo (8% o 0%)',
    badge: 'Fiscal DIAN',
    tagColor: 'text-amber-400 bg-amber-950/40 border-amber-800',
    summary: 'Configuración flexible por sucursal para establecimientos responsables o no responsables.',
    steps: [
      'Si la sucursal tiene "Cobrar y discriminar Impoconsumo (8%)" marcado: se liquida el 8% y se suma al total.',
      'Si la sucursal tiene la casilla desmarcada: la tarifa pasa a ser estrictamente 0% ($0).',
      'Con la casilla desmarcada, el sistema NO totaliza ningún impuesto (Total = Subtotal + Propina).',
      'En el comprobante POS y en pantalla, el impuesto no se cobra al cliente.',
    ],
    tips: 'Para cambiarlo, entra a Administración > Sucursales > Editar datos y modifica la casilla de DIAN.',
  },
  {
    id: 'cobro',
    category: 'facturacion',
    title: '6. Cobro Parcial y División de Cuenta',
    badge: 'Caja POS',
    tagColor: 'text-emerald-400 bg-emerald-950/40 border-emerald-800',
    summary: 'Permite pagar cuentas completas, cobrar por persona o dividir en partes iguales.',
    steps: [
      'Cobro total: Se seleccionan todos los ítems y se define el medio de pago.',
      'Cobro por persona: Desmarca los platos de otros y cobra únicamente los consumidos por ese cliente.',
      'Los ítems pagados quedan marcados con ✓ Pagado; la mesa permanece abierta con el saldo restante.',
      'División equitativa (Split): Calcula el valor exacto por persona ingresando el número de pagadores.',
    ],
    tips: 'Admite pagos fraccionados combinando efectivo, datáfono y transferencias Nequi/Bancolombia.',
  },
  {
    id: 'propina',
    category: 'facturacion',
    title: '7. Propina Voluntaria (Ley 1935 de 2018)',
    badge: 'Ley 1935',
    tagColor: 'text-blue-400 bg-blue-950/40 border-blue-800',
    summary: 'Cumplimiento de la normativa colombiana de gratificación voluntaria.',
    steps: [
      'El sistema sugiere por defecto el 10% sobre el subtotal neto de alimentos y bebidas.',
      'El cliente tiene el derecho legal de aceptar el 10%, modificar el valor o rechazarlo.',
      'Si se desmarca, la propina queda en $0 COP sin generar ningún inconveniente en la factura.',
    ],
    tips: 'El valor de la propina recaudada se detalla de forma transparente en el arqueo de caja.',
  },
  {
    id: 'caja',
    category: 'facturacion',
    title: '8. Turnos de Caja y Arqueo Ciego',
    badge: 'Tesorería',
    tagColor: 'text-purple-400 bg-purple-950/40 border-purple-800',
    summary: 'Apertura con base en efectivo y cierre de turno sin descuadres.',
    steps: [
      'Apertura: Digita el fondo inicial en efectivo para cambio antes de facturar.',
      'Movimientos: Registra egresos justificados de caja menor (hielo, domicilios, etc.).',
      'Cierre Ciego: El cajero cuenta el efectivo físico sin ver lo esperado por el software.',
      'Auditoría: El sistema compara el conteo con las ventas y genera el reporte de sobrante/faltante.',
    ],
    tips: 'Todos los cierres de caja quedan archivados con fecha, hora colombiana y usuario responsable.',
  },
];

export const ManualView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<'todos' | 'operacion' | 'facturacion' | 'administracion'>('todos');
  const [activeTopicId, setActiveTopicId] = useState<string>('impoconsumo');

  const filteredTopics = TOPICS.filter((t) => {
    if (selectedCategory !== 'todos' && t.category !== selectedCategory) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        t.steps.some((s) => s.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const activeTopic = TOPICS.find((t) => t.id === activeTopicId) || TOPICS[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* HEADER PRINCIPAL */}
      <div className="bg-[#181818] p-6 rounded-3xl border border-[#2d281e] shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#8c6d1d] flex items-center justify-center text-[#0e0e12] font-black text-2xl shadow-lg shadow-[#d4af37]/20 shrink-0">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-black text-[#fef3c7]">
                Manual de Usuario & Guía Operativa
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#2b2416] text-[#d4af37] border border-[#d4af37]/40">
                Oficial Colmena
              </span>
            </div>
            <p className="text-xs text-[#a8a29e] mt-1 leading-relaxed max-w-2xl">
              Aprende paso a paso cómo operar los salones, cocina KDS, facturación POS en Colombia, división de cuentas y parametrización de impoconsumo.
            </p>
          </div>
        </div>

        {/* ACCIONES SUPERIORES */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <a
            href="/manual.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-[#1e1c26] border border-[#383124] hover:border-[#d4af37] text-xs font-bold text-[#fef3c7] hover:text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
            title="Abrir en pestaña independiente para imprimir o compartir"
          >
            <ExternalLink className="w-4 h-4 text-[#d4af37]" />
            <span>Abrir en Pantalla Completa</span>
          </a>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89728] text-[#0e0e12] font-black text-xs flex items-center justify-center gap-2 hover:brightness-110 shadow-lg shadow-[#d4af37]/20 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#121117] p-3 rounded-2xl border border-[#2d281e]">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['todos', 'operacion', 'facturacion', 'administracion'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-[#2b2416] text-[#d4af37] border border-[#d4af37]/60 shadow-sm'
                  : 'text-[#a8a29e] hover:text-white hover:bg-[#1a1924]'
              }`}
            >
              {cat === 'todos' ? 'Todos los Módulos' : cat === 'operacion' ? 'Operación en Sala' : cat === 'facturacion' ? 'Facturación & Caja' : 'Administración'}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-[#78716c] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar tema (ej: impoconsumo, mesa)..."
            className="w-full bg-[#18171f] border border-[#383124] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#fef3c7] placeholder-[#78716c] focus:outline-none focus:border-[#d4af37]"
          />
        </div>
      </div>

      {/* CUERPO DEL MANUAL: LISTA LATERAL + DETALLE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: INDICE DE TEMAS */}
        <div className="lg:col-span-5 space-y-2.5">
          {filteredTopics.map((topic) => {
            const isSelected = topic.id === activeTopicId;
            return (
              <div
                key={topic.id}
                onClick={() => setActiveTopicId(topic.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#1e1c28] border-[#d4af37] shadow-lg shadow-[#d4af37]/10'
                    : 'bg-[#14131a] border-[#2d281e] hover:border-[#383124] hover:bg-[#181720]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${topic.tagColor}`}>
                    {topic.badge}
                  </span>
                  <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-[#d4af37] translate-x-1' : 'text-[#57534e]'}`} />
                </div>
                <h4 className={`text-sm font-bold ${isSelected ? 'text-[#fef3c7]' : 'text-[#d6d3d1]'}`}>
                  {topic.title}
                </h4>
                <p className="text-xs text-[#78716c] line-clamp-2 mt-1 leading-relaxed">
                  {topic.summary}
                </p>
              </div>
            );
          })}
        </div>

        {/* COLUMNA DERECHA: DETALLE PASO A PASO */}
        <div className="lg:col-span-7 bg-[#14131a] p-6 rounded-3xl border border-[#2d281e] space-y-6 shadow-xl">
          {activeTopic && (
            <>
              {/* ENCABEZADO DEL TEMA */}
              <div className="border-b border-[#2d281e] pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full border ${activeTopic.tagColor}`}>
                    {activeTopic.badge}
                  </span>
                  <span className="text-xs text-[#78716c]">Guía Operativa Paso a Paso</span>
                </div>
                <h3 className="text-xl font-black text-[#fef3c7]">
                  {activeTopic.title}
                </h3>
                <p className="text-xs text-[#a8a29e] mt-2 leading-relaxed">
                  {activeTopic.summary}
                </p>
              </div>

              {/* LISTA DE PASOS NUMERADOS */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#d4af37] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Pasos para su ejecución:</span>
                </h4>
                <div className="space-y-2.5">
                  {activeTopic.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-[#181720] border border-[#2d281e] flex items-start gap-3"
                    >
                      <div className="w-6 h-6 rounded-xl bg-[#2b2416] border border-[#d4af37]/40 text-[#d4af37] font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <p className="text-xs text-[#e7e5e4] leading-relaxed">
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* CONSEJO OPERATIVO */}
              {activeTopic.tips && (
                <div className="p-4 rounded-2xl bg-[#1e1b12] border border-[#73531b] flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-[#d4af37] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-[#fef3c7] block mb-0.5">
                      Consejo Práctico Colmena:
                    </span>
                    <p className="text-xs text-[#d6d3d1] leading-relaxed">
                      {activeTopic.tips}
                    </p>
                  </div>
                </div>
              )}

              {/* SIMULACIÓN GRÁFICA / EJEMPLO EN VIVO PARA IMPOCONSUMO */}
              {activeTopic.id === 'impoconsumo' && (
                <div className="p-4 rounded-2xl bg-[#0f0e14] border border-[#2d281e] space-y-3">
                  <h4 className="text-xs font-black text-[#fef3c7] flex items-center gap-2">
                    <Coins className="w-4 h-4 text-emerald-400" />
                    <span>Comparativa en Vivo de Liquidación</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-[#1a1924] border border-[#383124]">
                      <span className="text-[10px] font-bold uppercase text-emerald-400 block mb-1">
                        ● Con Impoconsumo 8% (Marcado)
                      </span>
                      <div className="space-y-1 text-[#a8a29e] font-mono">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>{formatCOP(50000)}</span>
                        </div>
                        <div className="flex justify-between text-[#d4af37]">
                          <span>Impuesto (8%):</span>
                          <span>{formatCOP(4000)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Propina (10%):</span>
                          <span>{formatCOP(5000)}</span>
                        </div>
                        <div className="pt-1 border-t border-[#383124] flex justify-between font-bold text-[#fef3c7]">
                          <span>Total:</span>
                          <span>{formatCOP(59000)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#1a1924] border border-amber-600/50">
                      <span className="text-[10px] font-bold uppercase text-amber-400 block mb-1">
                        ● Sin Impoconsumo (Desmarcado)
                      </span>
                      <div className="space-y-1 text-[#a8a29e] font-mono">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>{formatCOP(50000)}</span>
                        </div>
                        <div className="flex justify-between text-[#78716c]">
                          <span>Impuesto (0%):</span>
                          <span>$ 0 (No Aplica)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Propina (10%):</span>
                          <span>{formatCOP(5000)}</span>
                        </div>
                        <div className="pt-1 border-t border-[#383124] flex justify-between font-bold text-emerald-400">
                          <span>Total:</span>
                          <span>{formatCOP(55000)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
