import { AppView } from '../components/layout/AppLayout';

export type UserRoleName = 'administrador' | 'asesor' | 'cocinero';

export interface MenuButtonItemConfig {
  id: AppView;
  label: string;
  iconName: string;
  sectionId: string;
  order: number;
  allowedRoles: UserRoleName[];
  isVisible: boolean;
  description?: string;
  badgeType?: 'activeOrders' | 'occupiedTables' | 'pendingComandas' | 'lowStock' | 'text';
  badgeText?: string;
}

export interface MenuSectionConfig {
  id: string;
  title: string;
  order: number;
  description?: string;
}

export interface MenuConfig {
  sections: MenuSectionConfig[];
  buttons: MenuButtonItemConfig[];
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_MENU_SECTIONS: MenuSectionConfig[] = [
  { id: 'operacion', title: 'OPERACIÓN', order: 0, description: 'Operación diaria del restaurante y atención al cliente' },
  { id: 'productos', title: 'PRODUCTOS E INVENTARIO', order: 1, description: 'Gestión de cartas, recetas e insumos' },
  { id: 'compras', title: 'COMPRAS Y PROVEEDORES', order: 2, description: 'Egresos, facturas de compras y cuentas por pagar' },
  { id: 'comercial', title: 'GESTIÓN COMERCIAL', order: 3, description: 'Fidelización de clientes, separados y cartera' },
  { id: 'administracion', title: 'ADMINISTRACIÓN', order: 4, description: 'Reportes gerenciales, usuarios, sucursales y ajustes' },
];

export const DEFAULT_MENU_BUTTONS: MenuButtonItemConfig[] = [
  // OPERACIÓN
  {
    id: 'home',
    label: 'Inicio',
    iconName: 'Home',
    sectionId: 'operacion',
    order: 0,
    allowedRoles: ['administrador', 'asesor'],
    isVisible: true,
    description: 'Tablero principal con resumen operativo',
  },
  {
    id: 'pedidos',
    label: 'Pedidos Comercial',
    iconName: 'ClipboardList',
    sectionId: 'operacion',
    order: 1,
    allowedRoles: ['administrador', 'asesor'],
    isVisible: true,
    badgeType: 'activeOrders',
    description: 'Gestión de comandas y pedidos activos',
  },
  {
    id: 'mesas',
    label: 'Mesas & Salón',
    iconName: 'LayoutGrid',
    sectionId: 'operacion',
    order: 2,
    allowedRoles: ['administrador', 'asesor'],
    isVisible: true,
    badgeType: 'occupiedTables',
    description: 'Mapa de mesas, estados y cuentas abiertas',
  },
  {
    id: 'cocina',
    label: 'Cocina (KDS)',
    iconName: 'Flame',
    sectionId: 'operacion',
    order: 3,
    allowedRoles: ['administrador', 'asesor', 'cocinero'],
    isVisible: true,
    badgeType: 'pendingComandas',
    description: 'Monitor de comandas para personal de cocina',
  },
  {
    id: 'domicilios',
    label: 'Domicilios & Llevar',
    iconName: 'Bike',
    sectionId: 'operacion',
    order: 4,
    allowedRoles: ['administrador', 'asesor'],
    isVisible: true,
    description: 'Entregas a domicilio y pedidos para recoger',
  },
  {
    id: 'caja',
    label: 'Caja & Movimientos',
    iconName: 'Receipt',
    sectionId: 'operacion',
    order: 5,
    allowedRoles: ['administrador', 'asesor'],
    isVisible: true,
    description: 'Apertura de turno, arqueo y pagos',
  },
  {
    id: 'ingresos',
    label: 'Ingresos',
    iconName: 'TrendingUp',
    sectionId: 'operacion',
    order: 6,
    allowedRoles: ['administrador', 'asesor'],
    isVisible: true,
    description: 'Control de ingresos adicionales y comprobantes',
  },

  // PRODUCTOS E INVENTARIO
  {
    id: 'catalogo',
    label: 'Menú & Productos',
    iconName: 'UtensilsCrossed',
    sectionId: 'productos',
    order: 0,
    allowedRoles: ['administrador'],
    isVisible: true,
    description: 'Catálogo de platos, combos y modificadores',
  },
  {
    id: 'inventario',
    label: 'Ingredientes e Inventario',
    iconName: 'Boxes',
    sectionId: 'productos',
    order: 1,
    allowedRoles: ['administrador'],
    isVisible: true,
    badgeType: 'lowStock',
    description: 'Stock de ingredientes y mermas',
  },

  // COMPRAS Y PROVEEDORES
  {
    id: 'desembolsos',
    label: 'Desembolsos',
    iconName: 'DollarSign',
    sectionId: 'compras',
    order: 0,
    allowedRoles: ['administrador'],
    isVisible: true,
    description: 'Registro de gastos y compras generales',
  },
  {
    id: 'proveedores',
    label: 'Proveedores',
    iconName: 'Building',
    sectionId: 'compras',
    order: 1,
    allowedRoles: ['administrador'],
    isVisible: true,
    description: 'Directorio y compras por proveedor',
  },
  {
    id: 'cuentas-por-pagar',
    label: 'Cuentas por Pagar',
    iconName: 'CreditCard',
    sectionId: 'compras',
    order: 2,
    allowedRoles: ['administrador'],
    isVisible: true,
    description: 'Facturas pendientes a crédito con proveedores',
  },
  {
    id: 'anticipos-proveedores',
    label: 'Anticipos a Proveedores',
    iconName: 'DollarSign',
    sectionId: 'compras',
    order: 3,
    allowedRoles: ['administrador'],
    isVisible: true,
    description: 'Adelantos y saldos a favor con proveedores',
  },

  // GESTIÓN COMERCIAL
  {
    id: 'clientes',
    label: 'Clientes & CRM',
    iconName: 'Users',
    sectionId: 'comercial',
    order: 0,
    allowedRoles: ['administrador'],
    isVisible: true,
    description: 'Base de clientes, datos de contacto y fidelización',
  },
  {
    id: 'separados',
    label: 'Separados & Reservas',
    iconName: 'BookmarkCheck',
    sectionId: 'comercial',
    order: 1,
    allowedRoles: ['administrador'],
    isVisible: true,
    badgeText: 'Layaway',
    description: 'Planes de separado y anticipos de clientes',
  },
  {
    id: 'cartera',
    label: 'Cartera & Cobros',
    iconName: 'CreditCard',
    sectionId: 'comercial',
    order: 2,
    allowedRoles: ['administrador'],
    isVisible: true,
    badgeText: 'Créditos',
    description: 'Créditos a clientes y cobro de abonos',
  },

  // ADMINISTRACIÓN
  {
    id: 'reportes',
    label: 'Informes & Estadísticas',
    iconName: 'BarChart3',
    sectionId: 'administracion',
    order: 0,
    allowedRoles: ['administrador'],
    isVisible: true,
    description: 'Gráficos de ventas, cortes de caja y rentabilidad',
  },
  {
    id: 'medios-pago',
    label: 'Medios de Pago',
    iconName: 'CreditCard',
    sectionId: 'administracion',
    order: 1,
    allowedRoles: ['administrador'],
    isVisible: true,
    description: 'Configuración de pasarelas, datáfonos y efectivo',
  },
  {
    id: 'usuarios',
    label: 'Usuarios & Personal',
    iconName: 'Users',
    sectionId: 'administracion',
    order: 2,
    allowedRoles: ['administrador'],
    isVisible: true,
    description: 'Cuentas de empleados, cédulas y asignación de rol',
  },
  {
    id: 'sucursales',
    label: 'Sucursales & Facturación',
    iconName: 'Building2',
    sectionId: 'administracion',
    order: 3,
    allowedRoles: ['administrador'],
    isVisible: true,
    description: 'Parámetros fiscales, NIT, resolución DIAN y logos',
  },
  {
    id: 'config-mesas',
    label: 'Config. Salones & Mesas',
    iconName: 'Settings',
    sectionId: 'administracion',
    order: 4,
    allowedRoles: ['administrador'],
    isVisible: true,
    description: 'Distribución física de áreas, zonas y mesas',
  },
  {
    id: 'config-botones',
    label: 'Configuración de Menú y Botones',
    iconName: 'Sliders',
    sectionId: 'administracion',
    order: 5,
    allowedRoles: ['administrador'],
    isVisible: true,
    description: 'Personalizar ubicación, orden y visibilidad por rol',
  },
  {
    id: 'config',
    label: 'Matriz de Permisos',
    iconName: 'Sliders',
    sectionId: 'administracion',
    order: 6,
    allowedRoles: ['administrador'],
    isVisible: true,
    description: 'Resumen legal y descriptivo de perfiles del sistema',
  },
  {
    id: 'manual',
    label: 'Manual de Usuario',
    iconName: 'BookOpen',
    sectionId: 'administracion',
    order: 7,
    allowedRoles: ['administrador', 'asesor', 'cocinero'],
    isVisible: true,
    description: 'Guía paso a paso, ilustraciones y funcionamiento integral',
  },
];

export const DEFAULT_MENU_CONFIG: MenuConfig = {
  sections: DEFAULT_MENU_SECTIONS,
  buttons: DEFAULT_MENU_BUTTONS,
};
