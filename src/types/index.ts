/**
 * SISTEMA COLMENA RESTAURANTE - Modelos de Datos Tipados
 * Identidad Visual Colmena:
 * - Negro #181818
 * - Dorado Principal #B77900
 * - Dorado Secundario #D6A21A
 * - Fondo Crema #FFFDF5
 */

export type StandardUserRole = 'administrador' | 'asesor' | 'cocinero';

export type UserRole =
  | 'administrador'
  | 'asesor'
  | 'cocinero'
  | 'supervisor'
  | 'cajero'
  | 'mesero'
  | 'cocina'
  | 'domiciliario';

export interface ColmenaUser {
  id: string; // ID interno en Firestore
  firebaseUid: string; // UID de Firebase Authentication
  fullName: string;
  documentNumber: string; // Cédula de Ciudadanía / Documento de identidad
  email: string;
  role: UserRole;
  authorizedBranchIds: string[]; // Lista de IDs de sucursales a las que tiene acceso
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: string;
  createdAt: string; // Fecha en formato ISO / Colombia
  lastLoginAt?: string;
  phone?: string;
}

export interface ReceiptConfig {
  headerText: string;
  footerText: string;
  resolutionDian: string;
  resolutionDate?: string;
  prefix: string;
  currentNumber: number;
  showTax: boolean;
  showTip: boolean;
}

export type PaperWidth = '58mm' | '80mm';

export interface BranchPrintConfig {
  showLogo: boolean;
  showTradeName: boolean;
  showNit: boolean;
  showAddress: boolean;
  showPhone: boolean;
  paperWidth: PaperWidth;
}

export const DEFAULT_BRANCH_PRINT_CONFIG: BranchPrintConfig = {
  showLogo: true,
  showTradeName: true,
  showNit: true,
  showAddress: true,
  showPhone: true,
  paperWidth: '80mm',
};

export interface BranchReceiptSnapshot {
  id?: string;
  branchId: string;
  name: string;
  nit: string;
  address: string;
  phone: string;
  logoUrl?: string;
  notes?: string;
  printConfig: BranchPrintConfig;
  resolutionDian?: string;
  resolutionDate?: string;
  prefix?: string;
  footerText?: string;
  issuedAt?: string;
}

export interface Branch {
  id: string;
  name: string; // Nombre comercial
  nit: string; // NIT tributario en Colombia
  address: string;
  phone: string;
  city: string;
  logoUrl?: string;
  notes?: string;
  taxRate: number; // Impoconsumo 8% (0.08)
  isActive: boolean;
  status?: 'activa' | 'inactiva';
  receiptConfig: ReceiptConfig;
  printConfig?: BranchPrintConfig;
  createdAt?: string;
  updatedAt?: string;
}

export type TableStatus =
  | 'libre'
  | 'ocupada'
  | 'reservada'
  | 'limpieza'
  | 'mantenimiento'
  | 'cuenta_solicitada';

export interface RestaurantArea {
  id: string;
  branchId: string;
  name: string; // Salón Principal, Terraza, Segundo Piso, Barra, Zona Exterior
  description?: string;
  order: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Table {
  id: string;
  branchId: string;
  areaId: string; // Relación con RestaurantArea
  number: number;
  name?: string; // Nombre amigable (ej: "Mesa 1", "Barra B-01")
  zone: string; // Nombre del área para compatibilidad
  capacity: number; // Capacidad de comensales
  status: TableStatus; // libre, ocupada, reservada, limpieza, mantenimiento
  displayOrder: number;
  isActive: boolean;
  // Ocupación física vs Cuenta abierta
  hasOpenTab?: boolean;
  currentOrderId?: string | null;
  currentBillAmount?: number;
  occupiedSince?: string | null; // ISO Timestamp de inicio de ocupación
  assignedWaiterId?: string | null;
  assignedWaiterName?: string | null;
  partySize?: number; // Personas reales ocupando la mesa
  openedAt?: string | null;
  updatedAt?: string;
}

export interface PrepStation {
  id: string;
  branchId: string;
  name: string; // Cocina Caliente, Cocina Fría, Bebidas & Coctelería, Barra, Postres, etc.
  code: string; // COC_CAL, COC_FRIA, BEB_COC, etc.
  description?: string;
  order: number;
  color: string; // Hex color para identificación visual
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type AuditEntityType =
  | 'area'
  | 'table'
  | 'prep_station'
  | 'branch'
  | 'user'
  | 'product'
  | 'category'
  | 'modifier_group'
  | 'combo'
  | 'pedidos'
  | 'caja'
  | 'otros';

export type AuditActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'activate'
  | 'deactivate'
  | 'creacion'
  | 'modificacion';

export interface AuditLog {
  id: string;
  branchId: string;
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
  action: AuditActionType;
  details: string;
  performedBy: string;
  performedByName: string;
  timestamp: string;
}

export type ProductStatus = 'activo' | 'inactivo' | 'agotado';

export interface ProductVariant {
  id: string;
  name: string; // Ej: Sencilla, Doble, Triple / 6, 12, 24 alitas / Personal, Mediana, Grande
  sku?: string;
  priceAdjustment: number; // Incremento o diferencia de precio en COP (puede ser 0 si es base)
  calculatedPrice?: number; // Precio final de la variante
  isDefault?: boolean;
  isActive: boolean;
}

export interface OptionIngredient {
  id?: string;
  ingredientType?: 'inventory' | 'product';
  ingredientId?: string;
  ingredientQuantity?: number;
  ingredientAction?: 'add' | 'remove';
}

export interface ModifierOption {
  id: string;
  name: string; // Ej: Término Medio, Tocineta caramelizada, Sin cebolla, etc.
  description?: string;
  priceSurcharge: number; // Recargo en COP (0 para modificaciones estándar/sin cargo)
  isActive: boolean;
  order?: number;
  ingredientType?: 'inventory' | 'product'; // Insumo de inventario o producto comercial (legacy/individual)
  ingredientId?: string; // Relación con insumo de inventario o producto comercial
  ingredientQuantity?: number; // Cantidad a agregar o remover del inventario
  ingredientAction?: 'add' | 'remove'; // Acción sobre inventario
  ingredients?: OptionIngredient[]; // Múltiples afectaciones de inventario por opción
  isDefault?: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string; // Ej: Término de la carne, Tipo de salsa, Acompañamiento, Adiciones
  description?: string;
  selectionType: 'single' | 'multiple' | 'quantity' | 'text';
  minSelections: number; // 0 para opcional, 1+ para obligatorio
  maxSelections: number; // 1 para radio/única, N para múltiple
  isRequired: boolean;
  options: ModifierOption[];
  appliesToCategoryIds?: string[];
  appliesToProductIds?: string[];
  isActive: boolean;
  order?: number;
}

export interface ProductAdjustment {
  id: string;
  type: 'descuento' | 'recargo';
  modality: 'fijo' | 'porcentaje';
  value: number; // Valor fijo en COP o Porcentaje (%)
  concept: string; // Motivo o concepto
  calculatedAmount: number; // Valor neto calculated en COP
}

export interface SelectedModifierDetail {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceSurcharge: number;
  quantity?: number;
  textValue?: string;
  ingredientType?: 'inventory' | 'product';
  ingredientId?: string;
  ingredientQuantity?: number;
  ingredientAction?: 'add' | 'remove';
  ingredients?: OptionIngredient[];
}

export interface ComboSwapOption {
  productId: string;
  productName: string;
  priceSurcharge: number; // Recargo por cambio de producto (ej: papas rústicas por aros de cebolla +$2.500)
}

export interface ComboComponentRule {
  id: string;
  roleName: string; // Ej: "Plato Principal", "Acompañamiento", "Bebida"
  defaultProductId: string;
  defaultProductName: string;
  allowedSwaps: ComboSwapOption[];
}

export interface ComboConfig {
  id: string;
  commercialPrice: number; // Precio de venta del combo (ej: $42.000)
  individualItemsSum: number; // Suma de productos por separado (ej: $54.000)
  savingsCOP: number; // Ahorro para el cliente (ej: $12.000)
  components: ComboComponentRule[];
  description?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName?: string;
  price: number; // Precio base de venta en COP
  sku: string; // Código único / SKU
  reference?: string;
  barcode?: string;
  size?: string;
  color?: string;
  unit?: string;
  observations?: string;
  linkedInventoryItemId?: string;
  images: string[]; // Hasta tres fotografías (URLs)
  branchId: string; // 'all' o ID de sucursal específica
  prepStationId: string; // Relación con estación de preparación del Módulo 02 (ej: COC_CAL, PARRILLA, etc.)
  prepStationCode?: string;
  prepTimeMinutes: number; // Tiempo estimado de preparación
  isAvailableForSale: boolean; // Disponible para venta
  isAvailableForDelivery: boolean; // Disponible para domicilio
  isVisibleInMenu: boolean; // Visible en menú
  status: ProductStatus; // activo, inactivo, agotado
  variants: ProductVariant[];
  modifierGroupIds: string[];
  featureGroups?: ModifierGroup[]; // Grupos de características específicos del producto
  isCombo?: boolean;
  comboConfig?: ComboConfig;
  recipe?: RecipeIngredient[];
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string; // Hamburguesas, Perros calientes, Costillas, Alitas, Bebidas, Entradas, Postres, Combos
  description?: string;
  order: number;
  isActive: boolean;
  isVisibleInMenu: boolean;
  icon?: string;
  itemCount?: number;
  createdAt?: string;
}

export interface CustomizedItemSelection {
  lineItemId?: string;
  productId: string;
  productName: string;
  variant?: ProductVariant | null;
  variantId?: string;
  variantName?: string;
  variantPriceAdjustment?: number;
  basePrice: number;
  selectedModifiers?: SelectedModifierDetail[];
  adjustments?: ProductAdjustment[];
  comboSwaps?: Record<string, string> | Array<{
    componentRuleId: string;
    roleName: string;
    selectedProductId: string;
    selectedProductName: string;
    priceSurcharge: number;
  }>;
  notes?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  effectiveRecipe?: RecipeIngredient[];
  prepStationId?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  price: number; // Pesos colombianos (COP)
  station: KitchenStation;
  prepTimeMinutes: number;
  recipe: RecipeIngredient[];
  isAvailable: boolean;
  image?: string;
  // Campos extendidos de Módulo 03
  sku?: string;
  images?: string[];
  branchId?: string;
  prepStationId?: string;
  isAvailableForSale?: boolean;
  isAvailableForDelivery?: boolean;
  isVisibleInMenu?: boolean;
  status?: ProductStatus;
  variants?: ProductVariant[];
  modifierGroupIds?: string[];
  isCombo?: boolean;
  comboConfig?: ComboConfig;
}

export interface MenuCategory {
  id: string;
  name: string;
  order: number;
  icon?: string;
  isActive?: boolean;
  isVisibleInMenu?: boolean;
  description?: string;
}

export type OrderType = 'mesa' | 'mostrador' | 'para_llevar' | 'domicilio';
export type OrderStatus = 'abierto' | 'facturado' | 'cancelado';

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  basePrice?: number;
  quantity: number;
  station: KitchenStation;
  notes?: string;
  roundNumber: number;
  sentToKitchen: boolean;
  selectedModifiers?: SelectedModifierDetail[];
  adjustments?: ProductAdjustment[];
  effectiveRecipe?: RecipeIngredient[];
  paid?: boolean;
  paidAt?: string;
  paidPaymentId?: string;
}

export type DeliveryStatus =
  | 'recibido'
  | 'en_preparacion'
  | 'listo_despacho'
  | 'en_camino'
  | 'entregado'
  | 'cancelado';

export type DeliveryPaymentStatus = 'pagado_anticipado' | 'pendiente' | 'contraentrega';

export interface Order {
  id: string;
  branchId: string;
  orderNumber: number;
  type: OrderType;
  tableId?: string | null;
  tableName?: string | null;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  neighborhood?: string; // Barrio
  addressReference?: string; // Referencia de ubicación
  deliveryFee?: number; // Tarifa de domicilio en COP
  paymentStatus?: DeliveryPaymentStatus;
  paymentMethod?: PaymentMethod;
  deliveryStatus?: DeliveryStatus;
  deliveryDriverId?: string;
  deliveryDriverName?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  incidenceNote?: string;
  reconciledInCash?: boolean; // Conciliación en caja
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  waiterId?: string;
  waiterName?: string;
  notes?: string;
  currentRound: number;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  createdAt: string;
  updatedAt: string;
  branchSnapshot?: BranchReceiptSnapshot;
}

export type ComandaItemStatus = 'pendiente' | 'en_preparacion' | 'listo' | 'servido';

export interface ComandaItem {
  orderItemId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  station: KitchenStation;
  notes?: string;
  selectedModifiers?: SelectedModifierDetail[];
  status: ComandaItemStatus;
}

export type ComandaStatus = 'nueva' | 'en_preparacion' | 'lista' | 'servida' | 'cancelada';

export interface Comanda {
  id: string;
  branchId: string;
  orderId: string;
  orderNumber: number;
  tableName: string;
  orderType: OrderType;
  roundNumber: number;
  status: ComandaStatus;
  items: ComandaItem[];
  waiterName: string;
  createdAt: string;
  updatedAt?: string;
}

export type KitchenStation = 'cocina_caliente' | 'parrilla' | 'cocina_fria' | 'bar_bebidas' | 'postres';

export interface RecipeIngredient {
  inventoryItemId: string;
  name: string;
  quantity: number;
  unit: InventoryUnit;
}

export type InventoryUnit = 'kg' | 'g' | 'ml' | 'lt' | 'und' | 'porc';

export interface InventoryItem {
  id: string;
  branchId: string;
  name: string;
  category?: string;
  categoryId?: string;
  reference?: string;
  size?: string;
  color?: string;
  barcode?: string;
  controlType?: 'por_unidad' | 'por_peso' | 'por_volumen' | 'general';
  unit: InventoryUnit;
  currentStock: number;
  minStock: number;
  costPerUnit: number;
  totalCost?: number;
  observations?: string;
  images?: string[];
  productionRecipe?: RecipeIngredient[];
  isProducible?: boolean;
  linkedProductId?: string;
  updatedAt: string;
  createdAt?: string;
}

export interface ProductionLog {
  id: string;
  code?: string; // Ej: PROD-001
  branchId: string;
  itemId: string;
  itemName: string;
  unitsProduced: number;
  unit: InventoryUnit;
  totalCost: number;
  unitCost: number;
  consumedIngredients: Array<{
    inventoryItemId: string;
    name: string;
    quantityDeducted: number;
    unit: InventoryUnit;
    unitCost: number;
  }>;
  notes?: string;
  status?: 'completada' | 'anulada';
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export type InventoryMovementType =
  | 'compra_entrada'
  | 'consumo_comanda'
  | 'merma'
  | 'ajuste_manual'
  | 'sobrante'
  | 'bajas'
  | 'desperdicio'
  | 'produccion_interna'
  | 'traslado_sucursal';

export interface InventoryMovement {
  id: string;
  branchId: string;
  itemId: string;
  itemName: string;
  type: InventoryMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export type CashShiftStatus = 'abierto' | 'cerrado';

export interface CashShift {
  id: string;
  branchId: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string | null;
  initialCash: number;
  baseEntries?: {
    id: string;
    amount: number;
    reason: string;
    createdAt: string;
    userName: string;
  }[];
  salesCash: number;
  salesCard: number;
  salesTransfer: number;
  inflowCash: number;
  outflowCash: number;
  expectedCash: number;
  actualCash?: number | null;
  difference?: number | null;
  status: CashShiftStatus;
  notes?: string;
}

export interface Expense {
  id: string;
  branchId: string;
  category: string;
  concept: string;
  thirdParty: string;
  paymentMethod: string;
  amount: number;
  observations: string;
  createdAt: string;
  userId: string;
  userName: string;
  status: 'activo' | 'anulado';
  consecutivo: string;
}

export interface CashMovement {
  id: string;
  branchId: string;
  shiftId: string;
  type: 'ingreso' | 'egreso';
  amount: number;
  reason: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export type PaymentMethodCategory =
  | 'efectivo'
  | 'transferencia'
  | 'tarjeta'
  | 'billetera_digital'
  | 'bono'
  | 'otro';

export interface PaymentMethodItem {
  id: string;
  name: string;
  category: PaymentMethodCategory;
  description?: string;
  isActive: boolean;
  requiresReference?: boolean;
  accountNumber?: string;
  bankName?: string;
  isCashType?: boolean;
  branchId?: string;
  createdAt: string;
  updatedAt?: string;
}

export type PaymentMethod =
  | 'efectivo'
  | 'tarjeta'
  | 'nequi_daviplata'
  | 'transferencia'
  | 'mixto'
  | (string & {});

export interface PaymentSplit {
  method: PaymentMethod;
  amount: number;
}

export interface Payment {
  id: string;
  branchId: string;
  orderId: string;
  orderNumber: number;
  shiftId: string;
  method: PaymentMethod;
  splits?: PaymentSplit[];
  amountPaid: number;
  subtotal: number;
  tax: number;
  tipAmount: number;
  total: number;
  change: number;
  cashierId: string;
  cashierName: string;
  customerName?: string;
  customerNitOrCedula?: string;
  createdAt: string;
  branchSnapshot?: BranchReceiptSnapshot;
  items?: OrderItem[];
  selectedItemIds?: string[];
  status?: 'completado' | 'anulado';
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
}

export interface OtherIncome {
  id: string;
  consecutivo: string; // Ej: ING-0001
  branchId: string;
  branchSnapshot?: BranchReceiptSnapshot;
  date: string; // Fecha y hora (ISO)
  concept: string; // Reintegro, Recuperación de dinero, Venta material usado, etc.
  thirdParty?: string; // Tercero / Referencia
  paymentMethod: PaymentMethod;
  amount: number;
  observations?: string;
  status: 'activo' | 'anulado';
  userId: string;
  userName: string;
  shiftId?: string;
  cashMovementId?: string;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

// MÓDULO 11: COMPRAS Y PROVEEDORES
export interface Supplier {
  id: string;
  branchId: string; // 'all' o ID de sucursal
  documentType?: DocumentType;
  documentNumber?: string;
  document: string; // NIT o Cédula
  name: string; // Nombre o Razón Social
  phoneCountryCode?: string;
  phoneNumber?: string;
  phone: string;
  address: string;
  email?: string;
  observations?: string;
  status: 'activo' | 'inactivo';
  createdAt: string;
  updatedAt?: string;
}

export interface PurchaseItem {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: InventoryUnit;
  unitCost: number;
  total: number;
}

export type PurchasePaymentStatus = 'pagada' | 'parcial' | 'pendiente';

export interface Purchase {
  id: string;
  branchId: string;
  supplierId: string;
  supplierName: string;
  date: string;
  documentNumber: string; // Factura o remisión
  items: PurchaseItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod | 'credito';
  paymentStatus: PurchasePaymentStatus;
  amountPaid: number;
  balanceDue: number;
  observations?: string;
  status: 'confirmada' | 'anulada';
  userId: string;
  userName: string;
  createdAt: string;
}

export type SupplierAdvanceStatus =
  | 'disponible'
  | 'parcialmente_aplicado'
  | 'aplicado_totalmente'
  | 'reintegrado'
  | 'anulado';

export interface SupplierAdvance {
  id: string;
  receiptNumber?: string; // Ej: ANT-1001
  branchId: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  originalAmount?: number;
  appliedAmount?: number;
  reintegratedAmount?: number;
  availableBalance?: number;
  balance: number; // Saldo de anticipo disponible por aplicar
  date: string;
  paymentMethod: PaymentMethod;
  observations?: string;
  status?: SupplierAdvanceStatus;
  userId: string;
  userName: string;
  createdAt?: string;
  branchSnapshot?: BranchReceiptSnapshot;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
}

export interface SupplierAdvanceReintegro {
  id: string;
  receiptNumber: string; // Ej: REI-1001
  branchId: string;
  advanceId: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  date: string;
  observations?: string;
  userId: string;
  userName: string;
  createdAt: string;
  branchSnapshot?: BranchReceiptSnapshot;
}

export type PurchasePaymentType = 'pago_real' | 'aplicacion_anticipo' | 'ajuste';

export interface PurchasePayment {
  id: string;
  receiptNumber?: string; // Ej: PAG-1001
  branchId: string;
  purchaseId: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  type?: PurchasePaymentType;
  advanceId?: string;
  status?: 'activo' | 'anulado';
  notes?: string;
  date: string;
  userId: string;
  userName: string;
  createdAt?: string;
  branchSnapshot?: BranchReceiptSnapshot;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  updatedAt?: string;
}

// MÓDULO 12: CLIENTES Y FIDELIZACIÓN
export type DocumentType = 'CC' | 'NIT' | 'CE' | 'TI' | 'Pasaporte' | 'Otro';
export type CustomerStatus = 'activo' | 'inactivo' | 'vetado';

export interface CustomerConsent {
  dataProcessingAuthorized: boolean; // Habeas Data (Ley 1581 de 2012)
  marketingAuthorized: boolean; // Autorización para promociones y campañas
  authorizedAt: string;
}

export interface Customer {
  id: string;
  branchId: string; // 'all' o ID de sucursal
  documentType: DocumentType;
  documentNumber: string;
  name: string; // Nombre completo o razón social
  phoneCountryCode?: string; // Indicativo telefónico internacional (+57)
  phoneNumber?: string; // Número de celular sin indicativo
  phone: string; // Celular completo con indicativo (+57 ...)
  address: string;
  neighborhood: string; // Barrio o zona
  observations?: string;
  status: CustomerStatus;
  consent: CustomerConsent;
  loyaltyPoints: number;
  totalSpent: number;
  visitsCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface LoyaltyTransaction {
  id: string;
  branchId: string;
  customerId: string;
  customerName: string;
  type: 'acumulacion' | 'redencion' | 'ajuste';
  points: number;
  reason: string;
  orderId?: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface LoyaltyConfig {
  isEnabled: boolean;
  pointsPerPeso: number;
  pesosPerRedemptionPoint: number;
  minPointsToRedeem: number;
}

// ==========================================
// MÓDULO DE SEPARADOS Y CARTERA
// ==========================================

export type AbonoParentType = 'separado' | 'cartera';
export type AbonoStatus = 'activo' | 'anulado';

export interface Abono {
  id: string;
  parentId: string; // ID del separado o de la cuenta de cartera
  parentType: AbonoParentType;
  receiptNumber: string; // Consecutivo de comprobante (ej: ABN-001)
  branchId: string;
  branchSnapshot?: BranchReceiptSnapshot;
  customerId: string;
  customerName: string;
  customerDocument?: string;
  customerPhone?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  shiftId?: string;
  cashMovementId?: string;
  userId: string;
  userName: string;
  createdAt: string;
  status: AbonoStatus;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  updatedAt?: string;
}

export interface SeparadoItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  recipe?: RecipeIngredient[];
}

export type SeparadoStatus = 'activo' | 'completado' | 'cancelado';
export type SeparadoDeliveryStatus = 'pendiente' | 'en_cocina' | 'listo' | 'entregado';

export interface Separado {
  id: string;
  code: string; // Ej: SEP-1001
  branchId: string;
  branchSnapshot?: BranchReceiptSnapshot;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerDocument: string;
  customerAddress?: string;
  items: SeparadoItem[];
  totalAmount: number;
  initialDeposit: number; // Anticipo
  totalAbonado: number; // Suma de abonos activos
  pendingBalance: number; // Saldo pendiente
  deliveryDate: string; // Fecha de entrega o evento
  deliveryTime?: string; // Hora estimada
  reserveInventory: boolean; // Si se reservan insumos físicos
  inventoryReserved?: boolean; // Si la reserva física ya fue aplicada
  sentToKitchen: boolean; // Si ya se envió comanda a cocina
  kitchenComandaId?: string;
  status: SeparadoStatus;
  deliveryStatus: SeparadoDeliveryStatus;
  notes?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  refundAmount?: number;
  finalSaleId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type CarteraStatus = 'vigente' | 'vencida' | 'pagada' | 'anulada';

export interface CarteraRecord {
  id: string;
  code: string; // Ej: CRD-1001
  saleId: string; // ID de orden/venta origen
  orderNumber: number;
  branchId: string;
  branchSnapshot?: BranchReceiptSnapshot;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerDocument: string;
  customerAddress?: string;
  totalAmount: number;
  initialPayment: number;
  totalAbonado: number;
  balanceDue: number; // Saldo pendiente
  dueDate: string; // Fecha límite de pago
  status: CarteraStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}



