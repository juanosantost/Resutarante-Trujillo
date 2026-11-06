import React, { createContext, useContext, useEffect, useState, useTransition } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  setDoc,
  updateDoc,
  addDoc,
  getDocs,
  orderBy,
  limit,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, initializeAuthAndConnection, handleFirestoreError, OperationType, sanitizeFirestoreData } from '../services/firebase';
import { checkAndSeedInitialData, INITIAL_BRANCHES, INITIAL_MENU_ITEMS, INITIAL_CATEGORIES } from '../services/dbSeed';
import {
  Branch,
  UserRole,
  Table,
  TableStatus,
  RestaurantArea,
  PrepStation,
  AuditLog,
  AuditEntityType,
  AuditActionType,
  Order,
  OrderItem,
  Comanda,
  ComandaStatus,
  ComandaItemStatus,
  InventoryItem,
  InventoryMovement,
  ProductionLog,
  CashShift,
  CashMovement,
  Payment,
  MenuCategory,
  MenuItem,
  KitchenStation,
  OrderType,
  PaymentMethod,
  PaymentMethodItem,
  PaymentSplit,
  Product,
  Category,
  ModifierGroup,
  ProductStatus,
  Supplier,
  Purchase,
  SupplierAdvance,
  PurchasePayment,
  SupplierAdvanceReintegro,
  PurchaseItem,
  InventoryUnit,
  RecipeIngredient,
  Customer,
  LoyaltyTransaction,
  DocumentType,
  CustomerStatus,
  BranchReceiptSnapshot,
  DEFAULT_BRANCH_PRINT_CONFIG,
  Separado,
  SeparadoItem,
  SeparadoStatus,
  SeparadoDeliveryStatus,
  CarteraRecord,
  CarteraStatus,
  Abono,
  AbonoParentType,
  AbonoStatus,
  Expense,
  OtherIncome,
} from '../types';
import {
  calculateOrderTotals,
  calculateRecipeDeductions,
  calculateCashBalance,
  formatCOP,
  getEffectiveTaxRate,
} from '../utils/calculations';
import {
  calculateNewAverageCost,
  determinePurchasePaymentStatus,
  validatePurchaseCancellation,
} from '../utils/purchasingUtils';
import {
  calculateEarnedPoints,
  DEFAULT_LOYALTY_CONFIG,
} from '../utils/loyaltyUtils';
import {
  calculateSelectedItemsTotals,
  markItemsAsPaid,
  isOrderFullyPaid,
  getInitialSelectedItemIds,
} from '../utils/checkoutCalculations';
import {
  recalculateCarteraBalance,
  recalculateSeparadoBalance,
  voidAbonoRecord,
  validateAbonoAmount,
  isCarteraOverdue,
} from '../utils/creditAndLayawayUtils';
import {
  validateFinancialAmount,
  calculateAdvanceAvailableBalance,
  determineAdvanceStatus,
  recalculatePurchasePayableBalance,
  voidPurchasePaymentRecord,
  voidSupplierAdvanceRecord,
} from '../utils/supplierAndPayablesUtils';

interface RestaurantContextType {
  // Estado base
  branches: Branch[];
  currentBranch: Branch | null;
  setCurrentBranchId: (branchId: string) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  staffName: string;
  setStaffName: (name: string) => void;
  isLoading: boolean;
  actionLoading: boolean;

  // Datos en tiempo real
  tables: Table[];
  areas: RestaurantArea[];
  prepStations: PrepStation[];
  auditLogs: AuditLog[];
  orders: Order[];
  activeOrders: Order[];
  payments: Payment[];
  comandas: Comanda[];
  activeComandas: Comanda[];
  inventory: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  productionLogs: ProductionLog[];
  activeShift: CashShift | null;
  cashMovements: CashMovement[];
  categories: MenuCategory[];
  menuItems: MenuItem[];

  // Módulo 03: Catálogo, Productos y Variantes
  products: Product[];
  catalogCategories: Category[];
  modifierGroups: ModifierGroup[];

  createProduct: (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  toggleProductStatus: (id: string, status: ProductStatus) => Promise<void>;

  createCategory: (data: Omit<Category, 'id' | 'createdAt'>) => Promise<string>;
  updateCategory: (id: string, data: Partial<Category>) => Promise<void>;
  toggleCategoryActive: (id: string, isActive: boolean) => Promise<void>;
  toggleCategoryVisibility: (id: string, isVisible: boolean) => Promise<void>;
  reorderCategories: (orderedIds: string[]) => Promise<void>;

  createModifierGroup: (data: Omit<ModifierGroup, 'id'>) => Promise<string>;
  updateModifierGroup: (id: string, data: Partial<ModifierGroup>) => Promise<void>;
  deleteModifierGroup: (id: string) => Promise<void>;

  // Operaciones de Mesas y Configuración (Módulo 02)
  createArea: (data: Omit<RestaurantArea, 'id' | 'branchId'>) => Promise<string>;
  updateArea: (id: string, data: Partial<RestaurantArea>) => Promise<void>;
  toggleAreaActive: (id: string, isActive: boolean) => Promise<void>;

  createTable: (data: Omit<Table, 'id' | 'branchId'>) => Promise<string>;
  updateTable: (id: string, data: Partial<Table>) => Promise<void>;
  setTableStatus: (
    tableId: string,
    status: TableStatus,
    extra?: { waiterId?: string; waiterName?: string; partySize?: number }
  ) => Promise<void>;
  liberateTable: (tableId: string, toCleaning?: boolean) => Promise<void>;

  createPrepStation: (data: Omit<PrepStation, 'id' | 'branchId'>) => Promise<string>;
  updatePrepStation: (id: string, data: Partial<PrepStation>) => Promise<void>;
  togglePrepStationActive: (id: string, isActive: boolean) => Promise<void>;

  logAuditAction: (params: {
    entityType: AuditEntityType;
    entityId: string;
    entityName: string;
    action: AuditActionType;
    details: string;
  }) => Promise<void>;

  // Operaciones existentes
  createOrder: (params: {
    type: OrderType;
    tableId?: string;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    items: Array<{
      menuItem: MenuItem;
      quantity: number;
      notes?: string;
    }>;
    notes?: string;
    includeTip?: boolean;
  }) => Promise<string>;

  addRoundToOrder: (
    orderId: string,
    newItems: Array<{
      menuItem: MenuItem;
      quantity: number;
      notes?: string;
    }>
  ) => Promise<void>;
  cancelOrder: (orderId: string, reason?: string) => Promise<void>;

  updateComandaStatus: (comandaId: string, status: ComandaStatus) => Promise<void>;
  updateComandaItemStatus: (comandaId: string, orderItemId: string, status: ComandaItemStatus) => Promise<void>;

  closeAndPayOrder: (params: {
    orderId: string;
    method: PaymentMethod;
    splits?: PaymentSplit[];
    amountPaid: number;
    tipAmount: number;
    customerName?: string;
    customerNitOrCedula?: string;
    selectedItemIds?: string[];
    updatedItems?: OrderItem[];
  }) => Promise<Payment>;
  updateOrderItems: (orderId: string, updatedItems: OrderItem[]) => Promise<void>;

  openCashShift: (initialCash: number, notes?: string) => Promise<void>;
  addCashBase: (amount: number, reason: string) => Promise<void>;
  updateCashBase: (baseId: string, newAmount: number, newReason: string) => Promise<void>;
  deleteCashBase: (baseId: string) => Promise<void>;
  closeCashShift: (actualCash: number, notes?: string) => Promise<void>;
  addCashMovement: (type: 'ingreso' | 'egreso', amount: number, reason: string) => Promise<void>;
  updateInventoryStock: (
    itemId: string,
    quantity: number,
    type: 'compra_entrada' | 'ajuste_manual' | 'merma',
    reason: string
  ) => Promise<void>;
  createInventoryItem: (params: {
    name: string;
    category?: string;
    reference?: string;
    size?: string;
    color?: string;
    barcode?: string;
    controlType?: 'por_unidad' | 'por_peso' | 'por_volumen' | 'general';
    unit: InventoryUnit;
    minStock: number;
    observations?: string;
    images?: string[];
    hasInitialStock?: boolean;
    initialQuantity?: number;
    costPerUnit?: number;
    isProducible?: boolean;
    productionRecipe?: RecipeIngredient[];
    alsoCreateProduct?: boolean;
    sellingPrice?: number;
  }) => Promise<string>;
  produceInventoryItem: (itemId: string, unitsToProduce: number, notes?: string) => Promise<void>;
  cancelProductionLog: (productionId: string, reason?: string) => Promise<void>;
  updateTableStatus: (tableId: string, status: TableStatus) => Promise<void>;

  // Módulo 11: Compras, Proveedores y Gastos
  suppliers: Supplier[];
  purchases: Purchase[];
  expenses: Expense[];
  supplierAdvances: SupplierAdvance[];
  purchasePayments: PurchasePayment[];
  supplierAdvanceReintegros: SupplierAdvanceReintegro[];
  createSupplier: (data: Omit<Supplier, 'id' | 'createdAt'>) => Promise<string>;
  updateSupplier: (id: string, data: Partial<Supplier>) => Promise<void>;
  toggleSupplierStatus: (id: string, status: 'activo' | 'inactivo') => Promise<void>;
  createExpense: (data: {
    category: string;
    concept: string;
    thirdParty: string;
    paymentMethod: string;
    amount: number;
    observations: string;
  }) => Promise<Expense>;
  createPurchase: (data: {
    supplierId: string;
    supplierName: string;
    date: string;
    documentNumber: string;
    items: Array<{
      ingredientId: string;
      ingredientName: string;
      quantity: number;
      unit: InventoryUnit;
      unitCost: number;
    }>;
    paymentMethod: PaymentMethod | 'credito';
    amountPaid: number;
    observations?: string;
    appliedAdvanceIds?: string[];
  }) => Promise<string>;
  createSupplierAdvance: (data: {
    supplierId: string;
    supplierName: string;
    amount: number;
    paymentMethod: PaymentMethod;
    observations?: string;
  }) => Promise<string>;
  registerSupplierAdvanceReintegro: (params: {
    advanceId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    observations?: string;
  }) => Promise<string>;
  voidSupplierAdvance: (advanceId: string, reason: string) => Promise<void>;
  addPurchasePayment: (data: {
    purchaseId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    advanceId?: string;
    notes?: string;
  }) => Promise<void>;
  editPurchasePayment: (
    paymentId: string,
    updates: { amount: number; paymentMethod: PaymentMethod; notes?: string }
  ) => Promise<void>;
  voidPurchasePayment: (paymentId: string, reason: string) => Promise<void>;
  cancelPurchase: (purchaseId: string) => Promise<void>;

  // Módulo 12: Clientes y Fidelización
  customers: Customer[];
  loyaltyTransactions: LoyaltyTransaction[];
  createCustomer: (data: Omit<Customer, 'id' | 'createdAt' | 'loyaltyPoints' | 'totalSpent' | 'visitsCount' | 'status'>) => Promise<string>;
  updateCustomer: (id: string, data: Partial<Customer>) => Promise<void>;
  toggleCustomerStatus: (id: string, status: CustomerStatus) => Promise<void>;
  adjustCustomerPoints: (customerId: string, points: number, reason: string) => Promise<void>;

  // Módulo de Separados y Cartera
  separados: Separado[];
  cartera: CarteraRecord[];
  abonos: Abono[];

  createSeparado: (data: {
    customerId: string;
    customerName: string;
    customerPhone: string;
    customerDocument: string;
    customerAddress?: string;
    items: SeparadoItem[];
    initialDeposit: number;
    deliveryDate: string;
    deliveryTime?: string;
    reserveInventory?: boolean;
    notes?: string;
    paymentMethod?: PaymentMethod;
  }) => Promise<{ separadoId: string; receiptAbono?: Abono }>;

  registerSeparadoAbono: (params: {
    separadoId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    notes?: string;
  }) => Promise<Abono>;

  sendSeparadoToKitchen: (separadoId: string) => Promise<void>;
  finalizeSeparado: (separadoId: string) => Promise<void>;
  cancelSeparado: (separadoId: string, reason: string, refundAmount?: number) => Promise<void>;

  createCarteraRecord: (data: {
    saleId: string;
    orderNumber: number;
    customerId: string;
    customerName: string;
    customerPhone: string;
    customerDocument: string;
    customerAddress?: string;
    totalAmount: number;
    initialPayment: number;
    dueDate: string;
    notes?: string;
    paymentMethod?: PaymentMethod;
  }) => Promise<{ carteraId: string; receiptAbono?: Abono }>;

  registerCarteraAbono: (params: {
    carteraId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    notes?: string;
  }) => Promise<Abono>;

  editAbono: (abonoId: string, updates: { notes?: string; paymentMethod?: PaymentMethod }) => Promise<void>;
  voidAbono: (abonoId: string, reason: string) => Promise<void>;

  // Medios de Pago
  paymentMethods: PaymentMethodItem[];
  createPaymentMethod: (data: Omit<PaymentMethodItem, 'id' | 'createdAt'>) => Promise<string>;
  updatePaymentMethod: (id: string, updates: Partial<PaymentMethodItem>) => Promise<void>;
  deletePaymentMethod: (id: string) => Promise<void>;
  togglePaymentMethodStatus: (id: string, status?: boolean) => Promise<void>;

  // Otros Ingresos
  otherIncomes: OtherIncome[];
  createOtherIncome: (data: {
    date?: string;
    concept: string;
    thirdParty?: string;
    paymentMethod: PaymentMethod;
    amount: number;
    observations?: string;
  }) => Promise<OtherIncome>;
  updateOtherIncome: (id: string, updates: Partial<OtherIncome>) => Promise<void>;
  voidOtherIncome: (id: string, reason: string) => Promise<void>;
  voidPayment: (paymentId: string, reason: string) => Promise<void>;

  clearAllTransactionalRecords: () => Promise<void>;
}

export const DEFAULT_PAYMENT_METHODS: Omit<PaymentMethodItem, 'id' | 'createdAt'>[] = [
  {
    name: 'Efectivo',
    category: 'efectivo',
    description: 'Billetes y monedas en caja física (afecta arqueo de efectivo)',
    isActive: true,
    requiresReference: false,
    isCashType: true,
  },
  {
    name: 'Transferencia Bancaria',
    category: 'transferencia',
    bankName: 'Bancolombia',
    description: 'Transferencia directa a cuenta bancaria empresarial',
    isActive: true,
    requiresReference: true,
    isCashType: false,
  },
  {
    name: 'Nequi',
    category: 'billetera_digital',
    bankName: 'Nequi',
    description: 'Transferencia o escaneo de código QR Nequi',
    isActive: true,
    requiresReference: true,
    isCashType: false,
  },
  {
    name: 'Daviplata',
    category: 'billetera_digital',
    bankName: 'Davivienda / Daviplata',
    description: 'Transferencia o escaneo de código QR Daviplata',
    isActive: true,
    requiresReference: true,
    isCashType: false,
  },
  {
    name: 'Tarjeta Débito / Crédito',
    category: 'tarjeta',
    description: 'Datáfono POS (Redeban, CredibanCo, Bold, etc.)',
    isActive: true,
    requiresReference: true,
    isCashType: false,
  },
];

const RestaurantContext = createContext<RestaurantContextType | null>(null);

export const RestaurantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branches, setBranches] = useState<Branch[]>(INITIAL_BRANCHES);
  const [currentBranchId, setCurrentBranchId] = useState<string>('sede-buga');
  const [userRole, setUserRole] = useState<UserRole>('administrador');
  const [staffName, setStaffName] = useState<string>('Juan Administrador');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Medios de Pago
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);
  // Otros Ingresos
  const [otherIncomes, setOtherIncomes] = useState<OtherIncome[]>([]);

  // Colecciones reactivas
  const [tables, setTables] = useState<Table[]>([]);
  const [areas, setAreas] = useState<RestaurantArea[]>([]);
  const [prepStations, setPrepStations] = useState<PrepStation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>([]);
  const [activeShift, setActiveShift] = useState<CashShift | null>(null);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [separados, setSeparados] = useState<Separado[]>([]);
  const [cartera, setCartera] = useState<CarteraRecord[]>([]);
  const [abonos, setAbonos] = useState<Abono[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<Category[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);

  // Módulo 11: Compras, Proveedores y Gastos
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [supplierAdvances, setSupplierAdvances] = useState<SupplierAdvance[]>([]);
  const [purchasePayments, setPurchasePayments] = useState<PurchasePayment[]>([]);
  const [supplierAdvanceReintegros, setSupplierAdvanceReintegros] = useState<SupplierAdvanceReintegro[]>([]);

  // Módulo 12: Clientes y Fidelización
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransaction[]>([]);

  // Asignar nombre según rol elegido
  useEffect(() => {
    switch (userRole) {
      case 'administrador':
        setStaffName('Administrador Colmena');
        break;
      case 'asesor':
      case 'cajero':
      case 'mesero':
      case 'domiciliario':
      case 'supervisor':
        setStaffName('Asesor de Operación');
        break;
      case 'cocinero':
      case 'cocina':
        setStaffName('Cocinero');
        break;
      default:
        setStaffName('Personal Colmena');
        break;
    }
  }, [userRole]);

  // Inicialización y Seed
  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        await initializeAuthAndConnection();
        await checkAndSeedInitialData();
        // Cargar semillas iniciales de Módulo 03 si las colecciones aún no han emitido
        const { INITIAL_PRODUCTS, INITIAL_PRODUCT_CATEGORIES, INITIAL_MODIFIER_GROUPS } = await import('../services/catalogSeed');
        if (isMounted) {
          setProducts((prev) => (prev.length === 0 ? INITIAL_PRODUCTS : prev));
          setCatalogCategories((prev) => (prev.length === 0 ? INITIAL_PRODUCT_CATEGORIES : prev));
          setModifierGroups((prev) => (prev.length === 0 ? INITIAL_MODIFIER_GROUPS : prev));
          setMenuItems((prev) => (prev.length === 0 ? INITIAL_MENU_ITEMS : prev));
          setCategories((prev) => (prev.length === 0 ? INITIAL_CATEGORIES : prev));
        }
      } catch (err) {
        console.error('Initial setup error:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const currentBranch = branches.find((b) => b.id === currentBranchId) || branches[0] || null;

  // Listeners Firestore en tiempo real para Sucursales, Menú, Categorías y Productos (Módulo 03)
  useEffect(() => {
    const unsubBranches = onSnapshot(collection(db, 'branches'), (snap) => {
      const list: Branch[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Branch));
      if (list.length > 0) setBranches(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'branches'));

    const unsubCategories = onSnapshot(collection(db, 'menuCategories'), (snap) => {
      const list: MenuCategory[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as MenuCategory));
      setCategories(list.sort((a, b) => a.order - b.order));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'menuCategories'));

    const unsubMenuItems = onSnapshot(collection(db, 'menuItems'), (snap) => {
      const list: MenuItem[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as MenuItem));
      setMenuItems(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'menuItems'));

    // Módulo 03: Categorías
    const unsubCatalogCategories = onSnapshot(collection(db, 'categories'), (snap) => {
      const list: Category[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Category));
      if (list.length > 0) {
        setCatalogCategories(list.sort((a, b) => (a.order || 0) - (b.order || 0)));
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'categories'));

    // Módulo 03: Modificadores
    const unsubModGroups = onSnapshot(collection(db, 'modifierGroups'), (snap) => {
      const list: ModifierGroup[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as ModifierGroup));
      if (list.length > 0) setModifierGroups(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'modifierGroups'));

    // Módulo 03: Productos
    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      const list: Product[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Product));
      setProducts(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'products'));

    // Módulo 11: Proveedores
    const suppliersQ = query(collection(db, 'suppliers'));
    const unsubSuppliers = onSnapshot(suppliersQ, (snap) => {
      const list: Supplier[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Supplier));
      setSuppliers(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'suppliers'));

    // Módulo 12: Clientes
    const customersQ = query(collection(db, 'customers'));
    const unsubCustomers = onSnapshot(customersQ, (snap) => {
      const list: Customer[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Customer));
      setCustomers(list.sort((a, b) => a.name.localeCompare(b.name)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'customers'));

    // Configuración: Medios de Pago
    const paymentMethodsQ = query(collection(db, 'payment_methods'));
    const unsubPaymentMethods = onSnapshot(
      paymentMethodsQ,
      async (snap) => {
        if (snap.empty) {
          try {
            const batch = writeBatch(db);
            DEFAULT_PAYMENT_METHODS.forEach((pm) => {
              const docRef = doc(collection(db, 'payment_methods'));
              batch.set(docRef, {
                ...pm,
                createdAt: new Date().toISOString(),
              });
            });
            await batch.commit();
          } catch (e) {
            console.error('Error sembrando medios de pago por defecto:', e);
          }
        } else {
          const list: PaymentMethodItem[] = [];
          snap.forEach((d) => list.push({ ...d.data(), id: d.id } as PaymentMethodItem));
          setPaymentMethods(list.sort((a, b) => a.name.localeCompare(b.name)));
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'payment_methods')
    );

    return () => {
      unsubBranches();
      unsubCategories();
      unsubMenuItems();
      unsubCatalogCategories();
      unsubModGroups();
      unsubProducts();
      unsubSuppliers();
      unsubCustomers();
      unsubPaymentMethods();
    };
  }, []);

  // Listeners dependientes de la Sucursal Activa
  useEffect(() => {
    if (!currentBranchId) return;

    // Mesas
    const tablesQ = query(collection(db, 'tables'), where('branchId', '==', currentBranchId));
    const unsubTables = onSnapshot(tablesQ, (snap) => {
      const list: Table[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Table));
      setTables(list.sort((a, b) => a.number - b.number));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'tables'));

    // Pedidos
    const ordersQ = query(collection(db, 'orders'), where('branchId', '==', currentBranchId));
    const unsubOrders = onSnapshot(ordersQ, (snap) => {
      const list: Order[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Order));
      // Más recientes primero
      setOrders(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'orders'));

    // Comandas
    const comandasQ = query(collection(db, 'comandas'), where('branchId', '==', currentBranchId));
    const unsubComandas = onSnapshot(comandasQ, (snap) => {
      const list: Comanda[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Comanda));
      setComandas(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'comandas'));

    // Pagos
    const paymentsQ = query(collection(db, 'payments'), where('branchId', '==', currentBranchId));
    const unsubPayments = onSnapshot(paymentsQ, (snap) => {
      const list: Payment[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Payment));
      setPayments(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'payments'));

    // Inventario
    const invQ = query(collection(db, 'inventoryItems'), where('branchId', '==', currentBranchId));
    const unsubInventory = onSnapshot(invQ, (snap) => {
      const list: InventoryItem[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as InventoryItem));
      setInventory(list.sort((a, b) => a.name.localeCompare(b.name)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'inventoryItems'));

    // Movimientos de inventario (Kardex)
    const movQ = query(collection(db, 'inventoryMovements'), where('branchId', '==', currentBranchId));
    const unsubMov = onSnapshot(movQ, (snap) => {
      const list: InventoryMovement[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as InventoryMovement));
      setInventoryMovements(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'inventoryMovements'));

    // Historial de Producciones (ProductionLogs)
    const prodLogsQ = query(collection(db, 'productionLogs'), where('branchId', '==', currentBranchId));
    const unsubProdLogs = onSnapshot(prodLogsQ, (snap) => {
      const list: ProductionLog[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as ProductionLog));
      setProductionLogs(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'productionLogs'));

    // Turno de caja abierto
    const shiftQ = query(
      collection(db, 'cashShifts'),
      where('branchId', '==', currentBranchId),
      where('status', '==', 'abierto')
    );
    const unsubShift = onSnapshot(shiftQ, (snap) => {
      if (!snap.empty) {
        const doc0 = snap.docs[0];
        setActiveShift({ ...doc0.data(), id: doc0.id } as CashShift);
      } else {
        setActiveShift(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'cashShifts'));

    // Movimientos de caja
    const cashMovQ = query(collection(db, 'cashMovements'), where('branchId', '==', currentBranchId));
    const unsubCashMov = onSnapshot(cashMovQ, (snap) => {
      const list: CashMovement[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as CashMovement));
      setCashMovements(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'cashMovements'));

    // Salones y Áreas (Módulo 02)
    const areasQ = query(collection(db, 'areas'), where('branchId', '==', currentBranchId));
    const unsubAreas = onSnapshot(areasQ, (snap) => {
      const list: RestaurantArea[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as RestaurantArea));
      setAreas(list.sort((a, b) => (a.order || 0) - (b.order || 0)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'areas'));

    // Estaciones Operativas (Módulo 02)
    const prepStationsQ = query(collection(db, 'prepStations'), where('branchId', '==', currentBranchId));
    const unsubPrepStations = onSnapshot(prepStationsQ, (snap) => {
      const list: PrepStation[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as PrepStation));
      setPrepStations(list.sort((a, b) => (a.order || 0) - (b.order || 0)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'prepStations'));

    // Historial de Auditoría (Módulo 02)
    const auditLogsQ = query(collection(db, 'auditLogs'), where('branchId', '==', currentBranchId));
    const unsubAuditLogs = onSnapshot(auditLogsQ, (snap) => {
      const list: AuditLog[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as AuditLog));
      setAuditLogs(list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'auditLogs'));

    // Módulo 11: Compras, Anticipos y Abonos
    const purchasesQ = query(collection(db, 'purchases'), where('branchId', '==', currentBranchId));
    const unsubPurchases = onSnapshot(purchasesQ, (snap) => {
      const list: Purchase[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Purchase));
      setPurchases(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'purchases'));

    const advancesQ = query(collection(db, 'supplierAdvances'), where('branchId', '==', currentBranchId));
    const unsubAdvances = onSnapshot(advancesQ, (snap) => {
      const list: SupplierAdvance[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as SupplierAdvance));
      setSupplierAdvances(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'supplierAdvances'));

    const payQ = query(collection(db, 'purchasePayments'), where('branchId', '==', currentBranchId));
    const unsubPay = onSnapshot(payQ, (snap) => {
      const list: PurchasePayment[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as PurchasePayment));
      setPurchasePayments(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'purchasePayments'));

    const reintegrosQ = query(collection(db, 'supplierAdvanceReintegros'), where('branchId', '==', currentBranchId));
    const unsubReintegros = onSnapshot(reintegrosQ, (snap) => {
      const list: SupplierAdvanceReintegro[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as SupplierAdvanceReintegro));
      setSupplierAdvanceReintegros(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'supplierAdvanceReintegros'));

    // Módulo 12: Fidelización
    const loyaltyQ = query(collection(db, 'loyaltyTransactions'), where('branchId', '==', currentBranchId));
    const unsubLoyalty = onSnapshot(loyaltyQ, (snap) => {
      const list: LoyaltyTransaction[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as LoyaltyTransaction));
      setLoyaltyTransactions(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'loyaltyTransactions'));

    // Módulos Separados, Cartera y Abonos
    const separadosQ = query(collection(db, 'separados'), where('branchId', '==', currentBranchId));
    const unsubSeparados = onSnapshot(separadosQ, (snap) => {
      const list: Separado[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Separado));
      setSeparados(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'separados'));

    const carteraQ = query(collection(db, 'cartera'), where('branchId', '==', currentBranchId));
    const unsubCartera = onSnapshot(carteraQ, (snap) => {
      const list: CarteraRecord[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as CarteraRecord));
      setCartera(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'cartera'));

    const abonosQ = query(collection(db, 'abonos'), where('branchId', '==', currentBranchId));
    const unsubAbonos = onSnapshot(abonosQ, (snap) => {
      const list: Abono[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Abono));
      setAbonos(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'abonos'));

    const expensesQ = query(collection(db, 'expenses'), where('branchId', '==', currentBranchId));
    const unsubExpenses = onSnapshot(expensesQ, (snap) => {
      const list: Expense[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Expense));
      setExpenses(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'expenses'));

    const otherIncomesQ = query(collection(db, 'other_incomes'), where('branchId', '==', currentBranchId));
    const unsubOtherIncomes = onSnapshot(otherIncomesQ, (snap) => {
      const list: OtherIncome[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as OtherIncome));
      setOtherIncomes(list.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'other_incomes'));

    return () => {
      unsubTables();
      unsubAreas();
      unsubPrepStations();
      unsubAuditLogs();
      unsubOrders();
      unsubComandas();
      unsubInventory();
      unsubMov();
      unsubShift();
      unsubCashMov();
      unsubPurchases();
      unsubAdvances();
      unsubPay();
      unsubLoyalty();
      unsubPayments();
      unsubSeparados();
      unsubCartera();
      unsubAbonos();
      unsubExpenses();
      unsubOtherIncomes();
    };
  }, [currentBranchId]);

  // Listas derivadas
  const activeOrders = orders.filter((o) => o.status === 'abierto');
  const activeComandas = comandas.filter((c) => c.status !== 'servida' && c.status !== 'cancelada');

  // OPERACIÓN 1: Crear nuevo pedido comercial + generar 1era Comanda a Cocina + actualizar Mesa
  const createOrder = async ({
    type,
    tableId,
    customerName,
    customerPhone,
    customerAddress,
    items,
    notes,
    includeTip = true,
  }: {
    type: OrderType;
    tableId?: string;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    items: Array<{
      menuItem: MenuItem;
      quantity: number;
      notes?: string;
    }>;
    notes?: string;
    includeTip?: boolean;
  }): Promise<string> => {
    if (actionLoading) throw new Error('Operación en proceso');
    setActionLoading(true);

    try {
      const orderId = `ord-${Date.now()}`;
      const orderNumber = orders.length > 0 ? Math.max(...orders.map((o) => o.orderNumber || 0)) + 1 : 101;

      let tableName = '';
      if (type === 'mesa' && tableId) {
        const targetTable = tables.find((t) => t.id === tableId);
        tableName = targetTable ? `Mesa ${targetTable.number} (${targetTable.zone})` : 'Mesa';
      } else {
        tableName = type === 'mostrador' ? 'Mostrador' : type === 'para_llevar' ? 'Para Llevar' : 'Domicilio';
      }

      // Estructurar items de la orden
      const orderItems: OrderItem[] = items.map((it, idx) => ({
        id: `oi-${orderId}-${idx + 1}`,
        menuItemId: it.menuItem.id,
        name: it.menuItem.name,
        price: it.menuItem.price,
        quantity: it.quantity,
        station: it.menuItem.station,
        notes: it.notes || '',
        roundNumber: 1,
        sentToKitchen: true, // Ya se envía en la primera comanda
      }));

      // Totales
      const taxRate = getEffectiveTaxRate(currentBranch);
      const { subtotal, tax, tip, total } = calculateOrderTotals(orderItems, taxRate, includeTip, 0.10);

      const now = new Date().toISOString();

      const newOrder: Order = {
        id: orderId,
        branchId: currentBranchId,
        orderNumber,
        type,
        tableId: tableId || null,
        tableName,
        customerName: customerName || (type === 'mesa' ? tableName : 'Cliente General'),
        customerPhone: customerPhone || '',
        customerAddress: customerAddress || '',
        deliveryStatus: type === 'domicilio' ? 'recibido' : undefined,
        paymentStatus: type === 'domicilio' ? 'contraentrega' : undefined,
        status: 'abierto',
        items: orderItems,
        subtotal,
        tax,
        tip,
        total,
        waiterId: userRole === 'mesero' ? 'usr-mesero' : 'usr-staff',
        waiterName: staffName,
        notes: notes || '',
        currentRound: 1,
        createdAt: now,
        updatedAt: now,
      };

      // 1. Guardar orden
      await setDoc(doc(db, 'orders', orderId), sanitizeFirestoreData(newOrder));

      // 2. Si es mesa, marcarla ocupada
      if (type === 'mesa' && tableId) {
        await updateDoc(doc(db, 'tables', tableId), {
          status: 'ocupada',
          currentOrderId: orderId,
          assignedWaiterName: staffName,
          openedAt: now,
          updatedAt: now,
        });
      }

      // 3. Generar comanda de cocina para Ronda 1
      const comandaId = `com-${Date.now()}`;
      const comanda: Comanda = {
        id: comandaId,
        branchId: currentBranchId,
        orderId,
        orderNumber,
        tableName,
        orderType: type,
        roundNumber: 1,
        status: 'nueva',
        items: orderItems.map((oi) => ({
          orderItemId: oi.id,
          menuItemId: oi.menuItemId,
          name: oi.name,
          quantity: oi.quantity,
          station: oi.station,
          notes: oi.notes,
          status: 'pendiente',
        })),
        waiterName: staffName,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, 'comandas', comandaId), comanda);

      // 4. Descontar inventario según recetas (Trazabilidad Kardex)
      const recipeDeductions = calculateRecipeDeductions(
        items.map((i) => ({ recipe: i.menuItem.recipe, quantity: i.quantity }))
      );
      for (const [invId, deduction] of Object.entries(recipeDeductions)) {
        const invItem = inventory.find((it) => it.id === invId);
        if (invItem) {
          const previousStock = invItem.currentStock;
          const newStock = Math.max(0, previousStock - deduction.quantity);
          await updateDoc(doc(db, 'inventoryItems', invId), {
            currentStock: newStock,
            updatedAt: now,
          });

          // Registrar movimiento en Kardex
          const movId = `mov-${Date.now()}-${invId}`;
          const mov: InventoryMovement = {
            id: movId,
            branchId: currentBranchId,
            itemId: invId,
            itemName: invItem.name,
            type: 'consumo_comanda',
            quantity: deduction.quantity,
            previousStock,
            newStock,
            reason: `Consumo comanda #${orderNumber} Ronda 1`,
            userId: userRole,
            userName: staffName,
            createdAt: now,
          };
          await setDoc(doc(db, 'inventoryMovements', movId), mov);
        }
      }

      return orderId;
    } catch (error) {
      console.error('Error in createOrder:', error);
      handleFirestoreError(error, OperationType.CREATE, 'orders');
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  // OPERACIÓN 2: Agregar Ronda de productos a una mesa existente
  // REGLA COLMENA: La cocina recibe ÚNICAMENTE los productos nuevos de esta ronda, evitando duplicar comandas.
  const addRoundToOrder = async (
    orderId: string,
    newItems: Array<{
      menuItem: MenuItem;
      quantity: number;
      notes?: string;
    }>
  ) => {
    if (actionLoading) throw new Error('Operación en proceso');
    setActionLoading(true);

    try {
      const targetOrder = orders.find((o) => o.id === orderId);
      if (!targetOrder) throw new Error('Orden no encontrada');

      const nextRound = (targetOrder.currentRound || 1) + 1;
      const now = new Date().toISOString();

      // Convertir nuevos items
      const roundOrderItems: OrderItem[] = newItems.map((it, idx) => ({
        id: `oi-${orderId}-r${nextRound}-${idx + 1}`,
        menuItemId: it.menuItem.id,
        name: it.menuItem.name,
        price: it.menuItem.price,
        quantity: it.quantity,
        station: it.menuItem.station,
        notes: it.notes || '',
        roundNumber: nextRound,
        sentToKitchen: true,
      }));

      // Combinar con items existentes
      const allItems = [...targetOrder.items, ...roundOrderItems];

      // Recalcular totales
      const taxRate = getEffectiveTaxRate(currentBranch);
      const hasTip = targetOrder.tip > 0;
      const { subtotal, tax, tip, total } = calculateOrderTotals(allItems, taxRate, hasTip, 0.10);

      // Actualizar Orden
      await updateDoc(doc(db, 'orders', orderId), {
        items: allItems,
        subtotal,
        tax,
        tip,
        total,
        currentRound: nextRound,
        updatedAt: now,
      });

      // Crear Comanda para Cocina (SOLO CON LOS PRODUCTOS NUEVOS DE ESTA RONDA)
      const comandaId = `com-${Date.now()}`;
      const comanda: Comanda = {
        id: comandaId,
        branchId: currentBranchId,
        orderId,
        orderNumber: targetOrder.orderNumber,
        tableName: targetOrder.tableName || 'Mesa',
        orderType: targetOrder.type,
        roundNumber: nextRound,
        status: 'nueva',
        items: roundOrderItems.map((oi) => ({
          orderItemId: oi.id,
          menuItemId: oi.menuItemId,
          name: oi.name,
          quantity: oi.quantity,
          station: oi.station,
          notes: oi.notes,
          status: 'pendiente',
        })),
        waiterName: staffName,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, 'comandas', comandaId), comanda);

      // Descontar inventario de la nueva ronda
      const recipeDeductions = calculateRecipeDeductions(
        newItems.map((i) => ({ recipe: i.menuItem.recipe, quantity: i.quantity }))
      );
      for (const [invId, deduction] of Object.entries(recipeDeductions)) {
        const invItem = inventory.find((it) => it.id === invId);
        if (invItem) {
          const previousStock = invItem.currentStock;
          const newStock = Math.max(0, previousStock - deduction.quantity);
          await updateDoc(doc(db, 'inventoryItems', invId), {
            currentStock: newStock,
            updatedAt: now,
          });

          const movId = `mov-${Date.now()}-${invId}`;
          const mov: InventoryMovement = {
            id: movId,
            branchId: currentBranchId,
            itemId: invId,
            itemName: invItem.name,
            type: 'consumo_comanda',
            quantity: deduction.quantity,
            previousStock,
            newStock,
            reason: `Consumo comanda #${targetOrder.orderNumber} Ronda ${nextRound}`,
            userId: userRole,
            userName: staffName,
            createdAt: now,
          };
          await setDoc(doc(db, 'inventoryMovements', movId), mov);
        }
      }
    } catch (error) {
      console.error('Error in addRoundToOrder:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  // OPERACIÓN: Anular Pedido
  const cancelOrder = async (orderId: string, reason?: string) => {
    if (actionLoading) throw new Error('Operación en proceso');
    setActionLoading(true);

    try {
      const targetOrder = orders.find((o) => o.id === orderId);
      if (!targetOrder) throw new Error('Pedido no encontrado');
      if (targetOrder.status === 'facturado') {
        throw new Error('No se puede anular un pedido que ya ha sido facturado y cobrado.');
      }

      const now = new Date().toISOString();
      const cancelReason = reason?.trim() || 'Anulación manual solicitada';

      // 1. Actualizar estado de la orden a 'cancelado'
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'cancelado',
        deliveryStatus: 'cancelado',
        cancellationReason: cancelReason,
        cancelledAt: now,
        cancelledBy: staffName,
        updatedAt: now,
      });

      // 2. Si tenía mesa asignada, liberarla automáticamente
      if (targetOrder.tableId) {
        await updateDoc(doc(db, 'tables', targetOrder.tableId), {
          status: 'libre',
          currentOrderId: null,
          hasOpenTab: false,
          currentBillAmount: 0,
          occupiedSince: null,
          assignedWaiterName: null,
          openedAt: null,
          updatedAt: now,
        });
      }

      // 3. Cancelar las comandas de cocina asociadas que no estén servidas
      const relatedComandas = comandas.filter(
        (c) => c.orderId === orderId && c.status !== 'servida' && c.status !== 'cancelada'
      );
      for (const com of relatedComandas) {
        await updateDoc(doc(db, 'comandas', com.id), {
          status: 'cancelada',
          updatedAt: now,
        });
      }

      // 4. Registro en Auditoría
      await logAuditAction({
        entityType: 'pedidos',
        entityId: orderId,
        entityName: `Pedido #${targetOrder.orderNumber}`,
        action: 'status_change',
        details: `Pedido #${targetOrder.orderNumber} anulado por ${staffName} (${userRole}). Motivo: ${cancelReason}`,
      });
    } catch (error) {
      console.error('Error in cancelOrder:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  // OPERACIÓN 3: Actualizar Estado de Comanda en Cocina (KDS)
  const updateComandaStatus = async (comandaId: string, status: ComandaStatus) => {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'comandas', comandaId), {
        status,
        updatedAt: now,
      });
    } catch (error) {
      console.error('Error in updateComandaStatus:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'comandas');
    }
  };

  const updateComandaItemStatus = async (comandaId: string, orderItemId: string, status: ComandaItemStatus) => {
    try {
      const targetComanda = comandas.find((c) => c.id === comandaId);
      if (!targetComanda) return;

      const updatedItems = targetComanda.items.map((it) =>
        it.orderItemId === orderItemId ? { ...it, status } : it
      );

      // Si todos están listos, cambiar la comanda a 'lista'
      const allReady = updatedItems.every((it) => it.status === 'listo' || it.status === 'servido');
      const allServed = updatedItems.every((it) => it.status === 'servido');

      let comandaStatus = targetComanda.status;
      if (allServed) comandaStatus = 'servida';
      else if (allReady) comandaStatus = 'lista';
      else comandaStatus = 'en_preparacion';

      await updateDoc(doc(db, 'comandas', comandaId), {
        items: updatedItems,
        status: comandaStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error in updateComandaItemStatus:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'comandas');
    }
  };

  const updateOrderItems = async (orderId: string, updatedItems: OrderItem[]) => {
    if (actionLoading) throw new Error('Operación en proceso');
    setActionLoading(true);
    try {
      const order = orders.find((o) => o.id === orderId);
      if (!order) throw new Error('Orden no encontrada');

      const now = new Date().toISOString();
      const taxRate = getEffectiveTaxRate(currentBranch);
      const subtotal = updatedItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
      const tax = Math.round(subtotal * taxRate);
      const tip = order.tip > 0 ? order.tip : 0;
      const total = subtotal + tax + tip;

      await updateDoc(doc(db, 'orders', orderId), sanitizeFirestoreData({
        items: updatedItems,
        subtotal,
        tax,
        total,
        updatedAt: now,
      }));

      if (order.tableId) {
        await updateDoc(doc(db, 'tables', order.tableId), {
          currentBillAmount: total,
          updatedAt: now,
        });
      }
    } catch (error) {
      console.error('Error updating order items:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  // OPERACIÓN 4: Cobro y Facturación de Orden con Selección Parcial y Control de Ítems Pagados
  // REGLAS COLMENA:
  // - Permite seleccionar los ítems a cobrar y calcular el total de forma dinámica.
  // - Los ítems cobrados quedan marcados con paid: true.
  // - Si todos los ítems fueron cobrados, la orden pasa a 'facturado' y la mesa se libera.
  // - Si quedan ítems pendientes, la orden permanece 'abierto' para pagos posteriores.
  const closeAndPayOrder = async ({
    orderId,
    method,
    splits,
    amountPaid,
    tipAmount,
    customerName,
    customerNitOrCedula,
    selectedItemIds,
    updatedItems,
  }: {
    orderId: string;
    method: PaymentMethod;
    splits?: PaymentSplit[];
    amountPaid: number;
    tipAmount: number;
    customerName?: string;
    customerNitOrCedula?: string;
    selectedItemIds?: string[];
    updatedItems?: OrderItem[];
  }): Promise<Payment> => {
    if (actionLoading) throw new Error('Operación en proceso');
    setActionLoading(true);

    try {
      const order = orders.find((o) => o.id === orderId);
      if (!order) throw new Error('Orden no encontrada');

      const now = new Date().toISOString();
      const currentItems: OrderItem[] = updatedItems || order.items || [];
      const taxRate = getEffectiveTaxRate(currentBranch);

      // Determinar los IDs seleccionados para este pago
      const effectiveSelectedIds =
        selectedItemIds && selectedItemIds.length > 0
          ? selectedItemIds
          : getInitialSelectedItemIds(currentItems);

      // Calcular montos específicos de los ítems seleccionados
      const totalsResult = calculateSelectedItemsTotals(
        currentItems,
        effectiveSelectedIds,
        tipAmount > 0,
        tipAmount,
        taxRate
      );

      const paymentSubtotal = totalsResult.subtotal;
      const paymentTax = totalsResult.tax;
      const paymentTotal = totalsResult.total;
      const change = Math.max(0, amountPaid - paymentTotal);

      // 1. Obtener sucursal de origen real y congelar snapshot histórico
      const docBranchId = order.branchId || currentBranchId;
      const originBranch =
        branches.find((b) => b.id === docBranchId) ||
        branches.find((b) => b.id === currentBranchId) ||
        branches[0];

      const branchSnapshot: BranchReceiptSnapshot = {
        branchId: originBranch?.id || docBranchId,
        name: originBranch?.name || 'SISTEMA COLMENA RESTAURANTE',
        nit: originBranch?.nit || '901.458.920-4',
        address: originBranch?.address || '',
        phone: originBranch?.phone || '',
        logoUrl: originBranch?.logoUrl || '',
        notes: originBranch?.notes || '',
        printConfig: originBranch?.printConfig || DEFAULT_BRANCH_PRINT_CONFIG,
        resolutionDian: originBranch?.receiptConfig?.resolutionDian || '',
        resolutionDate: originBranch?.receiptConfig?.resolutionDate || '',
        prefix: originBranch?.receiptConfig?.prefix || 'FAC-',
        footerText: originBranch?.receiptConfig?.footerText || '¡Gracias por su visita!',
        issuedAt: now,
      };

      // 2. Crear documento de pago con los ítems cobrados
      const paymentId = `pay-${Date.now()}`;
      const payment: Payment = {
        id: paymentId,
        branchId: docBranchId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        shiftId: activeShift ? activeShift.id : 'sin-turno-activo',
        method,
        splits: splits || [],
        amountPaid,
        subtotal: paymentSubtotal,
        tax: paymentTax,
        tipAmount,
        total: paymentTotal,
        change,
        cashierId: userRole === 'cajero' ? 'usr-cajero' : 'usr-staff',
        cashierName: staffName,
        customerName: customerName || order.customerName,
        customerNitOrCedula: customerNitOrCedula || '222222222222',
        createdAt: now,
        branchSnapshot,
        items: totalsResult.selectedItems,
        selectedItemIds: effectiveSelectedIds,
      };

      await setDoc(doc(db, 'payments', paymentId), sanitizeFirestoreData(payment));

      // 3. Marcar los ítems seleccionados como pagados
      const updatedOrderItems = markItemsAsPaid(currentItems, effectiveSelectedIds, paymentId, now);
      const allItemsPaid = isOrderFullyPaid(updatedOrderItems);

      // Recalcular el total global del pedido
      const newOrderSubtotal = updatedOrderItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
      const newOrderTax = Math.round(newOrderSubtotal * taxRate);
      const newOrderTotal = newOrderSubtotal + newOrderTax + (order.tip || 0);

      await updateDoc(doc(db, 'orders', order.id), sanitizeFirestoreData({
        status: allItemsPaid ? 'facturado' : 'abierto',
        items: updatedOrderItems,
        subtotal: newOrderSubtotal,
        tax: newOrderTax,
        total: newOrderTotal,
        tip: tipAmount,
        updatedAt: now,
        branchSnapshot,
      }));

      // Otorgar puntos de fidelización si el cliente está registrado
      const finalCustomerName = customerName || order.customerName;
      if (finalCustomerName) {
        const matchingCustomer = customers.find(
          (c) => c.name.toLowerCase() === finalCustomerName.toLowerCase() || (order.customerPhone && c.phone.includes(order.customerPhone))
        );
        if (matchingCustomer && DEFAULT_LOYALTY_CONFIG.isEnabled) {
          const earned = calculateEarnedPoints(paymentTotal, DEFAULT_LOYALTY_CONFIG);
          if (earned > 0) {
            const newPts = (matchingCustomer.loyaltyPoints || 0) + earned;
            const newSpent = (matchingCustomer.totalSpent || 0) + paymentTotal;
            const newVisits = (matchingCustomer.visitsCount || 0) + 1;
            await updateDoc(doc(db, 'customers', matchingCustomer.id), {
              loyaltyPoints: newPts,
              totalSpent: newSpent,
              visitsCount: newVisits,
            });

            const txRef = doc(collection(db, 'loyaltyTransactions'));
            const tx: LoyaltyTransaction = {
              id: txRef.id,
              branchId: currentBranchId,
              customerId: matchingCustomer.id,
              customerName: matchingCustomer.name,
              type: 'acumulacion',
              points: earned,
              reason: `Acumulación por pago de pedido #${order.orderNumber}`,
              orderId: order.id,
              userId: staffName,
              userName: staffName,
              createdAt: now,
            };
            await setDoc(txRef, tx);
          }
        }
      }

      // 4. Si es mesa y se pagaron todos los ítems, liberarla a 'libre'
      if (order.tableId) {
        if (allItemsPaid) {
          await updateDoc(doc(db, 'tables', order.tableId), {
            status: 'libre',
            currentOrderId: null,
            assignedWaiterName: null,
            openedAt: null,
            currentBillAmount: 0,
            hasOpenTab: false,
            updatedAt: now,
          });
        } else {
          // Si quedan ítems pendientes, calcular saldo restante de la mesa
          const remainingItems = updatedOrderItems.filter((it) => !it.paid);
          const remainingSubtotal = remainingItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
          const remainingTotal = remainingSubtotal + Math.round(remainingSubtotal * taxRate);
          await updateDoc(doc(db, 'tables', order.tableId), {
            currentBillAmount: remainingTotal,
            updatedAt: now,
          });
        }
      }

      // 5. Si hay turno de caja abierto, acumular los ingresos del pago actual
      if (activeShift) {
        let addCash = 0;
        let addCard = 0;
        let addTransfer = 0;

        if (method === 'efectivo') {
          addCash = paymentTotal;
        } else if (method === 'tarjeta') {
          addCard = paymentTotal;
        } else if (method === 'nequi_daviplata' || method === 'transferencia') {
          addTransfer = paymentTotal;
        } else if (method === 'mixto' && splits) {
          for (const s of splits) {
            if (s.method === 'efectivo') addCash += s.amount;
            else if (s.method === 'tarjeta') addCard += s.amount;
            else addTransfer += s.amount;
          }
        }

        const newSalesCash = (activeShift.salesCash || 0) + addCash;
        const newSalesCard = (activeShift.salesCard || 0) + addCard;
        const newSalesTransfer = (activeShift.salesTransfer || 0) + addTransfer;

        const balance = calculateCashBalance(
          activeShift.initialCash,
          newSalesCash,
          activeShift.inflowCash,
          activeShift.outflowCash,
          activeShift.actualCash
        );

        await updateDoc(doc(db, 'cashShifts', activeShift.id), {
          salesCash: newSalesCash,
          salesCard: newSalesCard,
          salesTransfer: newSalesTransfer,
          expectedCash: balance.expectedCash,
        });
      }

      return payment;
    } catch (error) {
      console.error('Error in closeAndPayOrder:', error);
      handleFirestoreError(error, OperationType.WRITE, 'payments');
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  // OPERACIÓN 5: Apertura de Turno de Caja
  const openCashShift = async (initialCash: number, notes?: string) => {
    try {
      const now = new Date().toISOString();
      const shiftId = `shift-${Date.now()}`;
      const initialBaseEntry = {
        id: `base-${Date.now()}`,
        amount: initialCash,
        reason: notes || 'Base inicial de apertura',
        createdAt: now,
        userName: staffName,
      };
      const newShift: CashShift = {
        id: shiftId,
        branchId: currentBranchId,
        cashierId: userRole,
        cashierName: staffName,
        openedAt: now,
        closedAt: null,
        initialCash,
        baseEntries: [initialBaseEntry],
        salesCash: 0,
        salesCard: 0,
        salesTransfer: 0,
        inflowCash: 0,
        outflowCash: 0,
        expectedCash: initialCash,
        actualCash: null,
        difference: null,
        status: 'abierto',
        notes: notes || 'Apertura de turno',
      };
      await setDoc(doc(db, 'cashShifts', shiftId), newShift);
    } catch (error) {
      console.error('Error opening shift:', error);
      handleFirestoreError(error, OperationType.CREATE, 'cashShifts');
    }
  };

  // OPERACIÓN 5.1: Registrar Base Adicional de Caja
  const addCashBase = async (amount: number, reason: string) => {
    if (!activeShift) throw new Error('No hay un turno de caja abierto en esta sucursal');
    try {
      const now = new Date().toISOString();
      const baseEntry = {
        id: `base-${Date.now()}`,
        amount,
        reason,
        createdAt: now,
        userName: staffName,
      };
      const newInitial = (activeShift.initialCash || 0) + amount;
      const existingEntries = activeShift.baseEntries || [];
      const balance = calculateCashBalance(
        newInitial,
        activeShift.salesCash,
        activeShift.inflowCash,
        activeShift.outflowCash,
        activeShift.actualCash
      );

      await updateDoc(doc(db, 'cashShifts', activeShift.id), {
        initialCash: newInitial,
        baseEntries: [...existingEntries, baseEntry],
        expectedCash: balance.expectedCash,
      });
    } catch (error) {
      console.error('Error adding cash base:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'cashShifts');
    }
  };

  // OPERACIÓN 5.2: Editar Base de Caja Registrada
  const updateCashBase = async (baseId: string, newAmount: number, newReason: string) => {
    if (!activeShift) throw new Error('No hay un turno de caja abierto en esta sucursal');
    try {
      const entries = activeShift.baseEntries || [];
      const updatedEntries = entries.map((b) => (b.id === baseId ? { ...b, amount: newAmount, reason: newReason } : b));
      const totalInitial = updatedEntries.reduce((acc, curr) => acc + curr.amount, 0);
      const balance = calculateCashBalance(
        totalInitial,
        activeShift.salesCash,
        activeShift.inflowCash,
        activeShift.outflowCash,
        activeShift.actualCash
      );

      await updateDoc(doc(db, 'cashShifts', activeShift.id), {
        initialCash: totalInitial,
        baseEntries: updatedEntries,
        expectedCash: balance.expectedCash,
      });
    } catch (error) {
      console.error('Error updating cash base:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'cashShifts');
    }
  };

  // OPERACIÓN 5.3: Borrar Base de Caja Registrada
  const deleteCashBase = async (baseId: string) => {
    if (!activeShift) throw new Error('No hay un turno de caja abierto en esta sucursal');
    try {
      const entries = activeShift.baseEntries || [];
      const updatedEntries = entries.filter((b) => b.id !== baseId);
      const totalInitial = updatedEntries.reduce((acc, curr) => acc + curr.amount, 0);
      const balance = calculateCashBalance(
        totalInitial,
        activeShift.salesCash,
        activeShift.inflowCash,
        activeShift.outflowCash,
        activeShift.actualCash
      );

      await updateDoc(doc(db, 'cashShifts', activeShift.id), {
        initialCash: totalInitial,
        baseEntries: updatedEntries,
        expectedCash: balance.expectedCash,
      });
    } catch (error) {
      console.error('Error deleting cash base:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'cashShifts');
    }
  };

  // OPERACIÓN 6: Cierre de Turno de Caja (Arqueo con conteo físico y cálculo de diferencias)
  const closeCashShift = async (actualCash: number, notes?: string) => {
    if (!activeShift) return;
    try {
      const now = new Date().toISOString();
      const balance = calculateCashBalance(
        activeShift.initialCash,
        activeShift.salesCash,
        activeShift.inflowCash,
        activeShift.outflowCash,
        actualCash
      );

      await updateDoc(doc(db, 'cashShifts', activeShift.id), {
        status: 'cerrado',
        closedAt: now,
        actualCash,
        difference: balance.difference,
        notes: notes ? `${activeShift.notes || ''} | Cierre: ${notes}` : activeShift.notes,
      });
    } catch (error) {
      console.error('Error closing shift:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'cashShifts');
    }
  };

  // OPERACIÓN 7: Movimiento de Caja Menor (Ingreso / Egreso puntual)
  const addCashMovement = async (type: 'ingreso' | 'egreso', amount: number, reason: string) => {
    if (!activeShift) throw new Error('No hay un turno de caja abierto en esta sucursal');
    try {
      const now = new Date().toISOString();
      const movId = `cmov-${Date.now()}`;
      const mov: CashMovement = {
        id: movId,
        branchId: currentBranchId,
        shiftId: activeShift.id,
        type,
        amount,
        reason,
        userId: userRole,
        userName: staffName,
        createdAt: now,
      };
      await setDoc(doc(db, 'cashMovements', movId), mov);

      const newInflows = type === 'ingreso' ? (activeShift.inflowCash || 0) + amount : activeShift.inflowCash;
      const newOutflows = type === 'egreso' ? (activeShift.outflowCash || 0) + amount : activeShift.outflowCash;

      const balance = calculateCashBalance(
        activeShift.initialCash,
        activeShift.salesCash,
        newInflows,
        newOutflows,
        activeShift.actualCash
      );

      await updateDoc(doc(db, 'cashShifts', activeShift.id), {
        inflowCash: newInflows,
        outflowCash: newOutflows,
        expectedCash: balance.expectedCash,
      });
    } catch (error) {
      console.error('Error adding cash movement:', error);
      handleFirestoreError(error, OperationType.CREATE, 'cashMovements');
    }
  };

  // OPERACIÓN 8: Ajuste de Inventario / Entrada de compra
  const updateInventoryStock = async (
    itemId: string,
    quantity: number,
    type: 'compra_entrada' | 'ajuste_manual' | 'merma',
    reason: string
  ) => {
    try {
      const invItem = inventory.find((i) => i.id === itemId);
      if (!invItem) return;

      const now = new Date().toISOString();
      const previousStock = invItem.currentStock;
      let newStock = previousStock;

      if (type === 'compra_entrada') {
        newStock = previousStock + quantity;
      } else if (type === 'merma') {
        newStock = Math.max(0, previousStock - quantity);
      } else {
        newStock = quantity; // Ajuste directo al nuevo conteo
      }

      await updateDoc(doc(db, 'inventoryItems', itemId), {
        currentStock: newStock,
        updatedAt: now,
      });

      const movId = `mov-${Date.now()}-${itemId}`;
      const mov: InventoryMovement = {
        id: movId,
        branchId: currentBranchId,
        itemId,
        itemName: invItem.name,
        type,
        quantity: Math.abs(newStock - previousStock),
        previousStock,
        newStock,
        reason,
        userId: userRole,
        userName: staffName,
        createdAt: now,
      };
      await setDoc(doc(db, 'inventoryMovements', movId), mov);
    } catch (error) {
      console.error('Error updating inventory:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'inventoryItems');
    }
  };

  // OPERACIÓN: Crear Artículo de Inventario (Soporta vinculación con Producto de Venta y Kardex Inicial)
  const createInventoryItem = async (params: {
    name: string;
    category?: string;
    reference?: string;
    size?: string;
    color?: string;
    barcode?: string;
    controlType?: 'por_unidad' | 'por_peso' | 'por_volumen' | 'general';
    unit: InventoryUnit;
    minStock: number;
    observations?: string;
    images?: string[];
    hasInitialStock?: boolean;
    initialQuantity?: number;
    costPerUnit?: number;
    isProducible?: boolean;
    productionRecipe?: RecipeIngredient[];
    alsoCreateProduct?: boolean;
    sellingPrice?: number;
  }): Promise<string> => {
    setActionLoading(true);
    try {
      const now = new Date().toISOString();
      const itemRef = doc(collection(db, 'inventoryItems'));
      const itemId = itemRef.id;

      const initialQty = params.hasInitialStock ? (params.initialQuantity || 0) : 0;
      const unitCost = params.hasInitialStock ? (params.costPerUnit || 0) : 0;
      const totalCostVal = initialQty * unitCost;

      let linkedProductId: string | undefined = undefined;

      // 1. Si "alsoCreateProduct" es verdadero, crear el Producto comercial vinculado
      if (params.alsoCreateProduct) {
        const prodRef = doc(collection(db, 'products'));
        linkedProductId = prodRef.id;

        const defaultStationId = prepStations[0]?.id || 'st-cocina-caliente';
        const defaultStationCode = prepStations[0]?.code || 'COC_CAL';
        const defaultCategoryObj = catalogCategories.find(c => c.name.toLowerCase() === (params.category || '').toLowerCase()) || catalogCategories[0];

        const newProduct: Product = sanitizeFirestoreData({
          id: linkedProductId,
          name: params.name,
          description: `Producto comercial elaborado con ${params.name}`,
          categoryId: defaultCategoryObj?.id || 'cat-general',
          categoryName: defaultCategoryObj?.name || params.category || 'General',
          price: params.sellingPrice || 0,
          sku: params.barcode || `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
          reference: params.reference,
          barcode: params.barcode,
          size: params.size,
          color: params.color,
          unit: params.unit,
          observations: params.observations,
          linkedInventoryItemId: itemId,
          images: params.images || [],
          branchId: currentBranchId,
          prepStationId: defaultStationId,
          prepStationCode: defaultStationCode,
          prepTimeMinutes: 15,
          isAvailableForSale: true,
          isAvailableForDelivery: true,
          isVisibleInMenu: true,
          status: 'activo',
          variants: [],
          modifierGroupIds: [],
          recipe: [
            {
              inventoryItemId: itemId,
              name: params.name,
              quantity: 1,
              unit: params.unit,
            },
          ],
          createdAt: now,
          updatedAt: now,
        });

        await setDoc(prodRef, newProduct);
      }

      // 2. Crear documento de InventoryItem
      const newItem: InventoryItem = sanitizeFirestoreData({
        id: itemId,
        branchId: currentBranchId,
        name: params.name,
        category: params.category || 'General',
        reference: params.reference,
        size: params.size,
        color: params.color,
        barcode: params.barcode,
        controlType: params.controlType || 'por_unidad',
        unit: params.unit,
        currentStock: initialQty,
        minStock: params.minStock || 0,
        costPerUnit: unitCost,
        totalCost: totalCostVal,
        observations: params.observations,
        images: params.images || [],
        productionRecipe: params.productionRecipe,
        isProducible: params.isProducible,
        linkedProductId,
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(itemRef, newItem);

      // 3. Si ingresa con stock inicial > 0, registrar el movimiento Kardex de entrada inicial
      if (initialQty > 0) {
        const movRef = doc(collection(db, 'inventoryMovements'));
        const newMov: InventoryMovement = {
          id: movRef.id,
          branchId: currentBranchId,
          itemId: itemId,
          itemName: params.name,
          type: 'compra_entrada',
          quantity: initialQty,
          previousStock: 0,
          newStock: initialQty,
          reason: `Inventario inicial al crear artículo (${formatCOP(unitCost)}/u)`,
          userId: userRole,
          userName: staffName,
          createdAt: now,
        };
        await setDoc(movRef, newMov);
      }

      await logAuditAction({
        entityType: 'product',
        entityId: itemId,
        entityName: params.name,
        action: 'create',
        details: `Artículo de inventario creado: "${params.name}" (${initialQty} ${params.unit} iniciales)`,
      });

      return itemId;
    } catch (error) {
      console.error('Error creating inventory item:', error);
      handleFirestoreError(error, OperationType.CREATE, 'inventoryItems');
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  // OPERACIÓN: Producción Interna de Artículo
  const produceInventoryItem = async (
    itemId: string,
    unitsToProduce: number,
    notes?: string
  ): Promise<void> => {
    setActionLoading(true);
    try {
      const now = new Date().toISOString();
      const targetItem = inventory.find((i) => i.id === itemId);
      if (!targetItem) throw new Error('Artículo no encontrado');
      if (!targetItem.productionRecipe || targetItem.productionRecipe.length === 0) {
        throw new Error('Este artículo no tiene una composición de producción configurada');
      }

      // Consecutivo de producción único
      const prodCode = `PROD-${String(productionLogs.length + 1).padStart(3, '0')}`;

      // 1. Verificar existencias suficientes para todos los ingredientes
      for (const ing of targetItem.productionRecipe) {
        const rawInv = inventory.find((i) => i.id === ing.inventoryItemId);
        const requiredQty = ing.quantity * unitsToProduce;
        if (!rawInv || rawInv.currentStock < requiredQty) {
          const available = rawInv ? rawInv.currentStock : 0;
          throw new Error(
            `Stock insuficiente del ingrediente "${ing.name}". Requerido: ${requiredQty} ${ing.unit}, Disponible: ${available} ${ing.unit}`
          );
        }
      }

      // 2. Descontar ingredientes e incorporar sus costos
      let totalIngredientsCost = 0;
      const consumedIngredientsSnapshot: Array<{
        inventoryItemId: string;
        name: string;
        quantityDeducted: number;
        unit: InventoryUnit;
        unitCost: number;
      }> = [];

      for (const ing of targetItem.productionRecipe) {
        const rawInv = inventory.find((i) => i.id === ing.inventoryItemId)!;
        const requiredQty = ing.quantity * unitsToProduce;
        const prevStock = rawInv.currentStock;
        const newStock = prevStock - requiredQty;
        const ingUnitCost = rawInv.costPerUnit || 0;
        totalIngredientsCost += requiredQty * ingUnitCost;

        consumedIngredientsSnapshot.push({
          inventoryItemId: rawInv.id,
          name: rawInv.name,
          quantityDeducted: requiredQty,
          unit: rawInv.unit,
          unitCost: ingUnitCost,
        });

        await updateDoc(doc(db, 'inventoryItems', rawInv.id), {
          currentStock: newStock,
          updatedAt: now,
        });

        // Registrar movimiento de salida de materia prima por producción
        const movRef = doc(collection(db, 'inventoryMovements'));
        const movOut: InventoryMovement = {
          id: movRef.id,
          branchId: currentBranchId,
          itemId: rawInv.id,
          itemName: rawInv.name,
          type: 'produccion_interna',
          quantity: requiredQty,
          previousStock: prevStock,
          newStock: newStock,
          reason: `Consumo para producción ${prodCode} (${targetItem.name})`,
          userId: userRole,
          userName: staffName,
          createdAt: now,
        };
        await setDoc(movRef, movOut);
      }

      // 3. Aumentar stock del artículo producido y recalcular costo promedio unitario
      const prevProducedStock = targetItem.currentStock;
      const newProducedStock = prevProducedStock + unitsToProduce;
      const unitCostProduced = unitsToProduce > 0 ? totalIngredientsCost / unitsToProduce : 0;
      const newUnitCost = calculateNewAverageCost(
        prevProducedStock,
        targetItem.costPerUnit || 0,
        unitsToProduce,
        unitCostProduced
      );

      await updateDoc(doc(db, 'inventoryItems', itemId), {
        currentStock: newProducedStock,
        costPerUnit: newUnitCost,
        updatedAt: now,
      });

      // Registrar movimiento de entrada del artículo producido
      const movInRef = doc(collection(db, 'inventoryMovements'));
      const movIn: InventoryMovement = {
        id: movInRef.id,
        branchId: currentBranchId,
        itemId: itemId,
        itemName: targetItem.name,
        type: 'produccion_interna',
        quantity: unitsToProduce,
        previousStock: prevProducedStock,
        newStock: newProducedStock,
        reason: `Ingreso por producción ${prodCode} (${unitsToProduce} ${targetItem.unit})`,
        userId: userRole,
        userName: staffName,
        createdAt: now,
      };
      await setDoc(movInRef, movIn);

      // 4. Crear documento del Historial de Producciones (ProductionLog)
      const logRef = doc(collection(db, 'productionLogs'));
      const newProdLog: ProductionLog = sanitizeFirestoreData({
        id: logRef.id,
        code: prodCode,
        branchId: currentBranchId,
        itemId: targetItem.id,
        itemName: targetItem.name,
        unitsProduced: unitsToProduce,
        unit: targetItem.unit,
        totalCost: totalIngredientsCost,
        unitCost: unitCostProduced,
        consumedIngredients: consumedIngredientsSnapshot,
        notes: notes?.trim() || undefined,
        status: 'completada',
        userId: userRole,
        userName: staffName,
        createdAt: now,
      });
      await setDoc(logRef, newProdLog);

      await logAuditAction({
        entityType: 'product',
        entityId: itemId,
        entityName: targetItem.name,
        action: 'create',
        details: `Producción interna ${prodCode} registrada: ${unitsToProduce} ${targetItem.unit} (Costo total: ${formatCOP(totalIngredientsCost)})`,
      });
    } catch (error) {
      console.error('Error producing inventory item:', error);
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  // OPERACIÓN: Anular Producción y Revertir Stock
  const cancelProductionLog = async (productionId: string, reason?: string): Promise<void> => {
    setActionLoading(true);
    try {
      const now = new Date().toISOString();
      const prodLog = productionLogs.find((p) => p.id === productionId);
      if (!prodLog) throw new Error('Registro de producción no encontrado');
      if (prodLog.status === 'anulada') throw new Error('Esta producción ya fue anulada previamente');

      const targetItem = inventory.find((i) => i.id === prodLog.itemId);
      if (!targetItem) throw new Error('El artículo producido no existe en el inventario');

      if (targetItem.currentStock < prodLog.unitsProduced) {
        throw new Error(
          `No se puede anular la producción ${prodLog.code || ''}. El stock actual (${targetItem.currentStock} ${targetItem.unit}) es menor a la cantidad producida (${prodLog.unitsProduced} ${prodLog.unit}), indicando que parte del lote ya fue vendido o consumido.`
        );
      }

      // 1. Revertir stock del artículo producido
      const prevProducedStock = targetItem.currentStock;
      const newProducedStock = prevProducedStock - prodLog.unitsProduced;
      await updateDoc(doc(db, 'inventoryItems', targetItem.id), {
        currentStock: newProducedStock,
        updatedAt: now,
      });

      const movInRef = doc(collection(db, 'inventoryMovements'));
      await setDoc(movInRef, {
        id: movInRef.id,
        branchId: currentBranchId,
        itemId: targetItem.id,
        itemName: targetItem.name,
        type: 'ajuste_manual',
        quantity: -prodLog.unitsProduced,
        previousStock: prevProducedStock,
        newStock: newProducedStock,
        reason: `Anulación producción ${prodLog.code || ''}: ${reason || 'Anulación autorizada'}`,
        userId: userRole,
        userName: staffName,
        createdAt: now,
      });

      // 2. Revertir materias primas consumidas
      for (const ing of prodLog.consumedIngredients) {
        const rawInv = inventory.find((i) => i.id === ing.inventoryItemId);
        if (rawInv) {
          const prevRawStock = rawInv.currentStock;
          const newRawStock = prevRawStock + ing.quantityDeducted;
          await updateDoc(doc(db, 'inventoryItems', rawInv.id), {
            currentStock: newRawStock,
            updatedAt: now,
          });

          const movOutRef = doc(collection(db, 'inventoryMovements'));
          await setDoc(movOutRef, {
            id: movOutRef.id,
            branchId: currentBranchId,
            itemId: rawInv.id,
            itemName: rawInv.name,
            type: 'sobrante',
            quantity: ing.quantityDeducted,
            previousStock: prevRawStock,
            newStock: newRawStock,
            reason: `Devolución por anulación producción ${prodLog.code || ''}`,
            userId: userRole,
            userName: staffName,
            createdAt: now,
          });
        }
      }

      // 3. Marcar el registro de producción como anulado
      await updateDoc(doc(db, 'productionLogs', productionId), {
        status: 'anulada',
        cancelledAt: now,
        cancelledBy: staffName,
        cancellationReason: reason?.trim() || 'Anulación por usuario',
      });

      await logAuditAction({
        entityType: 'product',
        entityId: targetItem.id,
        entityName: targetItem.name,
        action: 'update',
        details: `Anulación de producción ${prodLog.code || ''} completada: stock revertido`,
      });
    } catch (error) {
      console.error('Error canceling production log:', error);
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  // AUDITORÍA Y TRAZABILIDAD (Módulo 02)
  const logAuditAction = async ({
    entityType,
    entityId,
    entityName,
    action,
    details,
  }: {
    entityType: AuditEntityType;
    entityId: string;
    entityName: string;
    action: AuditActionType;
    details: string;
  }) => {
    try {
      const now = new Date().toISOString();
      const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const logDoc: AuditLog = {
        id: logId,
        branchId: currentBranchId,
        entityType,
        entityId,
        entityName,
        action,
        details,
        performedBy: userRole,
        performedByName: staffName,
        timestamp: now,
      };
      await setDoc(doc(db, 'auditLogs', logId), logDoc);
    } catch (err) {
      console.error('Error logging audit action:', err);
    }
  };

  // MÓDULO 02: Áreas y Salones
  const createArea = async (data: Omit<RestaurantArea, 'id' | 'branchId'>): Promise<string> => {
    try {
      const id = `area-${Date.now()}`;
      const newArea: RestaurantArea = {
        ...data,
        id,
        branchId: currentBranchId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'areas', id), newArea);
      await logAuditAction({
        entityType: 'area',
        entityId: id,
        entityName: newArea.name,
        action: 'create',
        details: `Salón/Área creado con orden ${newArea.order}: "${newArea.name}"`,
      });
      return id;
    } catch (error) {
      console.error('Error creating area:', error);
      handleFirestoreError(error, OperationType.CREATE, 'areas');
      throw error;
    }
  };

  const updateArea = async (id: string, data: Partial<RestaurantArea>): Promise<void> => {
    try {
      await updateDoc(doc(db, 'areas', id), {
        ...data,
        updatedAt: new Date().toISOString(),
      });
      const currentName = data.name || areas.find((a) => a.id === id)?.name || id;
      await logAuditAction({
        entityType: 'area',
        entityId: id,
        entityName: currentName,
        action: 'update',
        details: `Salón/Área actualizado: ${Object.keys(data).join(', ')}`,
      });
    } catch (error) {
      console.error('Error updating area:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'areas');
      throw error;
    }
  };

  const toggleAreaActive = async (id: string, isActive: boolean): Promise<void> => {
    try {
      await updateDoc(doc(db, 'areas', id), {
        isActive,
        updatedAt: new Date().toISOString(),
      });
      const area = areas.find((a) => a.id === id);
      await logAuditAction({
        entityType: 'area',
        entityId: id,
        entityName: area?.name || id,
        action: isActive ? 'activate' : 'deactivate',
        details: `Salón/Área ${isActive ? 'activado' : 'desactivado'} para operación`,
      });
    } catch (error) {
      console.error('Error toggling area:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'areas');
      throw error;
    }
  };

  // MÓDULO 02: Mesas
  const createTable = async (data: Omit<Table, 'id' | 'branchId'>): Promise<string> => {
    try {
      const id = `tab-${Date.now()}`;
      const areaName = areas.find((a) => a.id === data.areaId)?.name || data.zone || 'Salón Principal';
      const newTable: Table = {
        ...data,
        id,
        branchId: currentBranchId,
        zone: areaName,
        name: data.name || `Mesa ${data.number}`,
        status: data.status || 'libre',
        isActive: data.isActive !== undefined ? data.isActive : true,
        hasOpenTab: false,
        currentBillAmount: 0,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'tables', id), newTable);
      await logAuditAction({
        entityType: 'table',
        entityId: id,
        entityName: newTable.name || `Mesa ${newTable.number}`,
        action: 'create',
        details: `Mesa #${newTable.number} registrada en ${areaName} (Capacidad: ${newTable.capacity} comensales)`,
      });
      return id;
    } catch (error) {
      console.error('Error creating table:', error);
      handleFirestoreError(error, OperationType.CREATE, 'tables');
      throw error;
    }
  };

  const updateTable = async (id: string, data: Partial<Table>): Promise<void> => {
    try {
      const updatePayload: Record<string, any> = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      if (data.areaId) {
        const area = areas.find((a) => a.id === data.areaId);
        if (area) {
          updatePayload.zone = area.name;
        }
      }
      await updateDoc(doc(db, 'tables', id), updatePayload);
      const existing = tables.find((t) => t.id === id);
      await logAuditAction({
        entityType: 'table',
        entityId: id,
        entityName: existing?.name || `Mesa ${existing?.number || id}`,
        action: 'update',
        details: `Datos de mesa modificados: ${Object.keys(data).join(', ')}`,
      });
    } catch (error) {
      console.error('Error updating table:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'tables');
      throw error;
    }
  };

  const setTableStatus = async (
    tableId: string,
    status: TableStatus,
    extra?: { waiterId?: string; waiterName?: string; partySize?: number }
  ): Promise<void> => {
    try {
      const currentTable = tables.find((t) => t.id === tableId);
      const updatePayload: Record<string, any> = {
        status,
        updatedAt: new Date().toISOString(),
      };

      if (status === 'ocupada') {
        if (!currentTable?.occupiedSince) {
          updatePayload.occupiedSince = new Date().toISOString();
        }
        if (extra?.waiterId) updatePayload.assignedWaiterId = extra.waiterId;
        if (extra?.waiterName) updatePayload.assignedWaiterName = extra.waiterName;
        if (extra?.partySize) updatePayload.partySize = extra.partySize;
      } else if (status === 'libre') {
        updatePayload.occupiedSince = null;
        updatePayload.assignedWaiterId = null;
        updatePayload.assignedWaiterName = null;
        updatePayload.partySize = null;
        updatePayload.currentOrderId = null;
        updatePayload.currentBillAmount = 0;
        updatePayload.hasOpenTab = false;
      } else if (status === 'limpieza') {
        updatePayload.currentOrderId = null;
        updatePayload.currentBillAmount = 0;
        updatePayload.hasOpenTab = false;
      }

      await updateDoc(doc(db, 'tables', tableId), updatePayload);
      await logAuditAction({
        entityType: 'table',
        entityId: tableId,
        entityName: currentTable?.name || `Mesa ${currentTable?.number || tableId}`,
        action: 'status_change',
        details: `Estado cambiado de "${currentTable?.status || 'desconocido'}" a "${status}"`,
      });
    } catch (error) {
      console.error('Error updating table status:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'tables');
      throw error;
    }
  };

  const liberateTable = async (tableId: string, toCleaning: boolean = true): Promise<void> => {
    try {
      const currentTable = tables.find((t) => t.id === tableId);
      const newStatus: TableStatus = toCleaning ? 'limpieza' : 'libre';
      await updateDoc(doc(db, 'tables', tableId), {
        status: newStatus,
        occupiedSince: null,
        assignedWaiterId: null,
        assignedWaiterName: null,
        partySize: null,
        currentOrderId: null,
        currentBillAmount: 0,
        hasOpenTab: false,
        updatedAt: new Date().toISOString(),
      });
      await logAuditAction({
        entityType: 'table',
        entityId: tableId,
        entityName: currentTable?.name || `Mesa ${currentTable?.number || tableId}`,
        action: 'status_change',
        details: `Mesa liberada -> Nuevo estado: ${newStatus === 'limpieza' ? 'Pendiente de limpieza' : 'Libre'}`,
      });
    } catch (error) {
      console.error('Error liberating table:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'tables');
      throw error;
    }
  };

  // MÓDULO 02: Estaciones Operativas
  const createPrepStation = async (data: Omit<PrepStation, 'id' | 'branchId'>): Promise<string> => {
    try {
      const id = `st-${Date.now()}`;
      const newStation: PrepStation = {
        ...data,
        id,
        branchId: currentBranchId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'prepStations', id), newStation);
      await logAuditAction({
        entityType: 'prep_station',
        entityId: id,
        entityName: newStation.name,
        action: 'create',
        details: `Estación operativa creada: [${newStation.code}] "${newStation.name}"`,
      });
      return id;
    } catch (error) {
      console.error('Error creating prep station:', error);
      handleFirestoreError(error, OperationType.CREATE, 'prepStations');
      throw error;
    }
  };

  const updatePrepStation = async (id: string, data: Partial<PrepStation>): Promise<void> => {
    try {
      await updateDoc(doc(db, 'prepStations', id), {
        ...data,
        updatedAt: new Date().toISOString(),
      });
      const station = prepStations.find((s) => s.id === id);
      await logAuditAction({
        entityType: 'prep_station',
        entityId: id,
        entityName: data.name || station?.name || id,
        action: 'update',
        details: `Estación operativa actualizada: ${Object.keys(data).join(', ')}`,
      });
    } catch (error) {
      console.error('Error updating prep station:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'prepStations');
      throw error;
    }
  };

  const togglePrepStationActive = async (id: string, isActive: boolean): Promise<void> => {
    try {
      await updateDoc(doc(db, 'prepStations', id), {
        isActive,
        updatedAt: new Date().toISOString(),
      });
      const station = prepStations.find((s) => s.id === id);
      await logAuditAction({
        entityType: 'prep_station',
        entityId: id,
        entityName: station?.name || id,
        action: isActive ? 'activate' : 'deactivate',
        details: `Estación operativa ${isActive ? 'activada' : 'desactivada'}`,
      });
    } catch (error) {
      console.error('Error toggling prep station:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'prepStations');
      throw error;
    }
  };

  const updateTableStatus = async (tableId: string, status: TableStatus) => {
    await setTableStatus(tableId, status);
  };

  // ==========================================
  // MÓDULO 03: PRODUCTOS Y MENÚ GASTRONÓMICO
  // ==========================================

  const createProduct = async (
    data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    try {
      setActionLoading(true);
      const newRef = doc(collection(db, 'products'));
      const id = newRef.id;
      const now = new Date().toISOString();

      const newProduct: Product = sanitizeFirestoreData({
        ...data,
        id,
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(newRef, newProduct);

      // Sincronizar con menuItems para POS, pedidos y cocina KDS
      const stationMap: Record<string, any> = {
        'st-parrilla': 'parrilla',
        'st-bar-bebidas': 'bar_bebidas',
        'st-postres': 'postres',
        'st-cocina-fria': 'cocina_caliente',
        'st-cocina-caliente': 'cocina_caliente',
      };

      await setDoc(
        doc(db, 'menuItems', id),
        sanitizeFirestoreData({
          id,
          name: newProduct.name,
          description: newProduct.description,
          categoryId: newProduct.categoryId,
          price: newProduct.price,
          station: stationMap[newProduct.prepStationId] || 'cocina_caliente',
          prepTimeMinutes: newProduct.prepTimeMinutes,
          recipe: newProduct.recipe || [],
          isAvailable: newProduct.isAvailableForSale && newProduct.status === 'activo',
          image: newProduct.images?.[0] || '',
          sku: newProduct.sku,
          branchId: newProduct.branchId,
          prepStationId: newProduct.prepStationId,
          variants: newProduct.variants || [],
          isCombo: Boolean(newProduct.isCombo),
          comboConfig: newProduct.comboConfig || null,
        }),
        { merge: true }
      );

      await logAuditAction({
        entityType: 'product',
        entityId: id,
        entityName: newProduct.name,
        action: 'create',
        details: `Producto creado: SKU ${newProduct.sku}, Precio: $${newProduct.price.toLocaleString('es-CO')} COP`,
      });

      return id;
    } catch (error) {
      console.error('Error creating product:', error);
      handleFirestoreError(error, OperationType.CREATE, 'products');
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const updateProduct = async (id: string, data: Partial<Product>): Promise<void> => {
    try {
      setActionLoading(true);
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'products', id), sanitizeFirestoreData({
        ...data,
        updatedAt: now,
      }));

      // Sincronizar con menuItems
      const menuItemUpdate: Record<string, any> = {};
      if (data.name !== undefined) menuItemUpdate.name = data.name;
      if (data.description !== undefined) menuItemUpdate.description = data.description;
      if (data.price !== undefined) menuItemUpdate.price = data.price;
      if (data.categoryId !== undefined) menuItemUpdate.categoryId = data.categoryId;
      if (data.prepTimeMinutes !== undefined) menuItemUpdate.prepTimeMinutes = data.prepTimeMinutes;
      if (data.images !== undefined && data.images.length > 0) menuItemUpdate.image = data.images[0];
      if (data.sku !== undefined) menuItemUpdate.sku = data.sku;
      if (data.variants !== undefined) menuItemUpdate.variants = data.variants;
      if (data.status !== undefined || data.isAvailableForSale !== undefined) {
        menuItemUpdate.isAvailable =
          (data.status !== undefined ? data.status === 'activo' : true) &&
          (data.isAvailableForSale !== undefined ? data.isAvailableForSale : true);
      }
      if (Object.keys(menuItemUpdate).length > 0) {
        await updateDoc(doc(db, 'menuItems', id), menuItemUpdate);
      }

      const prod = products.find((p) => p.id === id);
      await logAuditAction({
        entityType: 'product',
        entityId: id,
        entityName: data.name || prod?.name || id,
        action: 'update',
        details: `Producto modificado: campos [${Object.keys(data).join(', ')}]`,
      });
    } catch (error) {
      console.error('Error updating product:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'products');
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const deleteProduct = async (id: string): Promise<void> => {
    try {
      setActionLoading(true);
      const prod = products.find((p) => p.id === id);
      const prodName = prod?.name || id;

      // 1. Eliminar permanentemente de Firestore
      await deleteDoc(doc(db, 'products', id)).catch((delErr) => {
        console.warn('Error eliminando doc products:', delErr);
      });
      await deleteDoc(doc(db, 'menuItems', id)).catch(() => {});

      // 2. Actualizar estado local inmediatamente para reactividad instantánea
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setMenuItems((prev) => prev.filter((m) => m.id !== id));

      await logAuditAction({
        entityType: 'product',
        entityId: id,
        entityName: prodName,
        action: 'delete',
        details: `Producto "${prodName}" eliminado permanentemente del sistema`,
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      handleFirestoreError(error, OperationType.DELETE, 'products');
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const toggleProductStatus = async (id: string, status: ProductStatus): Promise<void> => {
    try {
      setActionLoading(true);
      await updateDoc(doc(db, 'products', id), {
        status,
        isAvailableForSale: status === 'activo',
        updatedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'menuItems', id), {
        isAvailable: status === 'activo',
      });
      const prod = products.find((p) => p.id === id);
      await logAuditAction({
        entityType: 'product',
        entityId: id,
        entityName: prod?.name || id,
        action: 'status_change',
        details: `Estado operativo cambiado a: ${status.toUpperCase()}`,
      });
    } catch (error) {
      console.error('Error toggling product status:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'products');
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const createCategory = async (
    data: Omit<Category, 'id' | 'createdAt'>
  ): Promise<string> => {
    try {
      setActionLoading(true);
      const newRef = doc(collection(db, 'categories'));
      const id = newRef.id;
      const newCat: Category = {
        ...data,
        id,
        createdAt: new Date().toISOString(),
      };
      await setDoc(newRef, newCat);
      await setDoc(doc(db, 'menuCategories', id), {
        id,
        name: data.name,
        order: data.order,
        icon: data.icon || 'Utensils',
      });
      await logAuditAction({
        entityType: 'category',
        entityId: id,
        entityName: data.name,
        action: 'create',
        details: `Categoría gastronómica creada: ${data.name}`,
      });
      return id;
    } catch (error) {
      console.error('Error creating category:', error);
      handleFirestoreError(error, OperationType.CREATE, 'categories');
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const updateCategory = async (id: string, data: Partial<Category>): Promise<void> => {
    try {
      setActionLoading(true);
      await updateDoc(doc(db, 'categories', id), data);
      if (data.name !== undefined || data.order !== undefined || data.icon !== undefined) {
        const menuCatUpdate: Record<string, any> = {};
        if (data.name !== undefined) menuCatUpdate.name = data.name;
        if (data.order !== undefined) menuCatUpdate.order = data.order;
        if (data.icon !== undefined) menuCatUpdate.icon = data.icon;
        await updateDoc(doc(db, 'menuCategories', id), menuCatUpdate);
      }
      const cat = catalogCategories.find((c) => c.id === id);
      await logAuditAction({
        entityType: 'category',
        entityId: id,
        entityName: data.name || cat?.name || id,
        action: 'update',
        details: `Categoría actualizada: [${Object.keys(data).join(', ')}]`,
      });
    } catch (error) {
      console.error('Error updating category:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'categories');
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const toggleCategoryActive = async (id: string, isActive: boolean): Promise<void> => {
    try {
      await updateDoc(doc(db, 'categories', id), { isActive });
      const cat = catalogCategories.find((c) => c.id === id);
      await logAuditAction({
        entityType: 'category',
        entityId: id,
        entityName: cat?.name || id,
        action: isActive ? 'activate' : 'deactivate',
        details: `Categoría ${isActive ? 'activada' : 'desactivada'} en el sistema`,
      });
    } catch (error) {
      console.error('Error toggling category active:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'categories');
      throw error;
    }
  };

  const toggleCategoryVisibility = async (id: string, isVisible: boolean): Promise<void> => {
    try {
      await updateDoc(doc(db, 'categories', id), { isVisibleInMenu: isVisible });
      const cat = catalogCategories.find((c) => c.id === id);
      await logAuditAction({
        entityType: 'category',
        entityId: id,
        entityName: cat?.name || id,
        action: 'update',
        details: `Visibilidad de categoría en menú cambiada a: ${isVisible ? 'VISIBLE' : 'OCULTA'}`,
      });
    } catch (error) {
      console.error('Error toggling category visibility:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'categories');
      throw error;
    }
  };

  const reorderCategories = async (orderedIds: string[]): Promise<void> => {
    try {
      for (let i = 0; i < orderedIds.length; i++) {
        const catId = orderedIds[i];
        await updateDoc(doc(db, 'categories', catId), { order: i + 1 });
        await updateDoc(doc(db, 'menuCategories', catId), { order: i + 1 }).catch(() => {});
      }
      await logAuditAction({
        entityType: 'category',
        entityId: 'all',
        entityName: 'Categorías',
        action: 'update',
        details: `Reordenamiento visual de ${orderedIds.length} categorías`,
      });
    } catch (error) {
      console.error('Error reordering categories:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'categories');
      throw error;
    }
  };

  const createModifierGroup = async (
    data: Omit<ModifierGroup, 'id'>
  ): Promise<string> => {
    try {
      setActionLoading(true);
      const newRef = doc(collection(db, 'modifierGroups'));
      const id = newRef.id;
      const newGroup: ModifierGroup = { ...data, id };
      await setDoc(newRef, newGroup);
      await logAuditAction({
        entityType: 'modifier_group',
        entityId: id,
        entityName: data.name,
        action: 'create',
        details: `Grupo de modificadores creado: ${data.name} (${data.options.length} opciones)`,
      });
      return id;
    } catch (error) {
      console.error('Error creating modifier group:', error);
      handleFirestoreError(error, OperationType.CREATE, 'modifierGroups');
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const updateModifierGroup = async (
    id: string,
    data: Partial<ModifierGroup>
  ): Promise<void> => {
    try {
      setActionLoading(true);
      await updateDoc(doc(db, 'modifierGroups', id), data);
      const grp = modifierGroups.find((g) => g.id === id);
      await logAuditAction({
        entityType: 'modifier_group',
        entityId: id,
        entityName: data.name || grp?.name || id,
        action: 'update',
        details: `Grupo de modificadores actualizado: [${Object.keys(data).join(', ')}]`,
      });
    } catch (error) {
      console.error('Error updating modifier group:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'modifierGroups');
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const deleteModifierGroup = async (id: string): Promise<void> => {
    try {
      setActionLoading(true);
      await updateDoc(doc(db, 'modifierGroups', id), { isActive: false });
      const grp = modifierGroups.find((g) => g.id === id);
      await logAuditAction({
        entityType: 'modifier_group',
        entityId: id,
        entityName: grp?.name || id,
        action: 'deactivate',
        details: 'Grupo de modificadores desactivado',
      });
    } catch (error) {
      console.error('Error deleting modifier group:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'modifierGroups');
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const createSupplier = async (data: Omit<Supplier, 'id' | 'createdAt'>): Promise<string> => {
    try {
      setActionLoading(true);
      const ref = doc(collection(db, 'suppliers'));
      const id = ref.id;
      const newSup: Supplier = {
        ...data,
        id,
        createdAt: new Date().toISOString(),
      };
      await setDoc(ref, newSup);
      await logAuditAction({
        entityType: 'branch',
        entityId: id,
        entityName: data.name,
        action: 'create',
        details: `Proveedor creado: ${data.name} (NIT/CC: ${data.document})`,
      });
      return id;
    } catch (err) {
      console.error('Error creating supplier:', err);
      handleFirestoreError(err, OperationType.CREATE, 'suppliers');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const updateSupplier = async (id: string, data: Partial<Supplier>): Promise<void> => {
    try {
      setActionLoading(true);
      await updateDoc(doc(db, 'suppliers', id), data);
      await logAuditAction({
        entityType: 'branch',
        entityId: id,
        entityName: data.name || id,
        action: 'update',
        details: `Proveedor actualizado: [${Object.keys(data).join(', ')}]`,
      });
    } catch (err) {
      console.error('Error updating supplier:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'suppliers');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSupplierStatus = async (id: string, status: 'activo' | 'inactivo'): Promise<void> => {
    try {
      await updateDoc(doc(db, 'suppliers', id), { status });
    } catch (err) {
      console.error('Error toggling supplier status:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'suppliers');
      throw err;
    }
  };

  const createPurchase = async (params: {
    supplierId: string;
    supplierName: string;
    date: string;
    documentNumber: string;
    items: Array<{
      ingredientId: string;
      ingredientName: string;
      quantity: number;
      unit: InventoryUnit;
      unitCost: number;
    }>;
    paymentMethod: PaymentMethod | 'credito';
    amountPaid: number;
    observations?: string;
  }): Promise<string> => {
    try {
      setActionLoading(true);
      const subtotal = params.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
      const tax = Math.round(subtotal * 0.19);
      const total = subtotal + tax;
      const amountPaid = Math.min(total, Math.max(0, params.amountPaid));
      const balanceDue = total - amountPaid;
      const paymentStatus = determinePurchasePaymentStatus(total, amountPaid);

      const purchaseRef = doc(collection(db, 'purchases'));
      const purchaseId = purchaseRef.id;

      const purchaseItems: PurchaseItem[] = params.items.map((i) => ({
        ...i,
        total: i.quantity * i.unitCost,
      }));

      const newPurchase: Purchase = {
        id: purchaseId,
        branchId: currentBranchId,
        supplierId: params.supplierId,
        supplierName: params.supplierName,
        date: params.date,
        documentNumber: params.documentNumber,
        items: purchaseItems,
        subtotal,
        tax,
        total,
        paymentMethod: params.paymentMethod,
        paymentStatus,
        amountPaid,
        balanceDue,
        observations: params.observations,
        status: 'confirmada',
        userId: staffName,
        userName: staffName,
        createdAt: new Date().toISOString(),
      };

      await setDoc(purchaseRef, newPurchase);

      for (const pItem of purchaseItems) {
        const invItem = inventory.find((i) => i.id === pItem.ingredientId);
        const currentStock = invItem ? invItem.currentStock : 0;
        const currentCost = invItem ? invItem.costPerUnit || 0 : 0;
        const newStock = currentStock + pItem.quantity;
        const newCost = calculateNewAverageCost(currentStock, currentCost, pItem.quantity, pItem.unitCost);

        if (invItem) {
          await updateDoc(doc(db, 'inventoryItems', invItem.id), {
            currentStock: newStock,
            costPerUnit: newCost,
            updatedAt: new Date().toISOString(),
          });
        }

        const movRef = doc(collection(db, 'inventoryMovements'));
        const newMov: InventoryMovement = {
          id: movRef.id,
          branchId: currentBranchId,
          itemId: pItem.ingredientId,
          itemName: pItem.ingredientName,
          type: 'compra_entrada',
          quantity: pItem.quantity,
          previousStock: currentStock,
          newStock,
          reason: `Compra #${params.documentNumber} (${params.supplierName})`,
          userId: staffName,
          userName: staffName,
          createdAt: new Date().toISOString(),
        };
        await setDoc(movRef, newMov);
      }

      if (amountPaid > 0) {
        const payRef = doc(collection(db, 'purchasePayments'));
        const newPay: PurchasePayment = {
          id: payRef.id,
          branchId: currentBranchId,
          purchaseId,
          supplierId: params.supplierId,
          supplierName: params.supplierName,
          amount: amountPaid,
          paymentMethod: params.paymentMethod === 'credito' ? 'efectivo' : params.paymentMethod,
          date: new Date().toISOString(),
          userId: staffName,
          userName: staffName,
        };
        await setDoc(payRef, newPay);
      }

      await logAuditAction({
        entityType: 'branch',
        entityId: purchaseId,
        entityName: `Compra ${params.documentNumber}`,
        action: 'create',
        details: `Compra registrada a proveedor ${params.supplierName} por ${formatCOP(total)}`,
      });

      return purchaseId;
    } catch (err) {
      console.error('Error creating purchase:', err);
      handleFirestoreError(err, OperationType.CREATE, 'purchases');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const createExpense = async (data: {
    category: string;
    concept: string;
    thirdParty: string;
    paymentMethod: string;
    amount: number;
    observations: string;
  }): Promise<Expense> => {
    setActionLoading(true);
    try {
      const now = new Date().toISOString();
      const ref = doc(collection(db, 'expenses'));
      const id = ref.id;
      const consecutivo = `EXP-${Math.floor(1000 + Math.random() * 9000)}`;

      const newExpense: Expense = {
        id,
        branchId: currentBranchId,
        category: data.category,
        concept: data.concept,
        thirdParty: data.thirdParty,
        paymentMethod: data.paymentMethod,
        amount: data.amount,
        observations: data.observations,
        createdAt: now,
        userId: staffName,
        userName: staffName,
        status: 'activo',
        consecutivo,
      };

      await setDoc(ref, sanitizeFirestoreData(newExpense));

      if (activeShift && data.paymentMethod === 'efectivo') {
        await addCashMovement(
          'egreso',
          data.amount,
          `Gasto #${consecutivo} (${data.concept}) - ${data.thirdParty}`
        );
      }

      await logAuditAction({
        entityType: 'branch',
        entityId: id,
        entityName: `Gasto #${consecutivo}`,
        action: 'create',
        details: `Gasto registrado: ${data.concept} por $${data.amount.toLocaleString('es-CO')} (${data.category})`,
      });

      return newExpense;
    } catch (err) {
      console.error('Error creating expense:', err);
      handleFirestoreError(err, OperationType.CREATE, 'expenses');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const createSupplierAdvance = async (params: {
    supplierId: string;
    supplierName: string;
    amount: number;
    paymentMethod: PaymentMethod;
    observations?: string;
  }): Promise<string> => {
    try {
      setActionLoading(true);
      const validation = validateFinancialAmount(params.amount);
      if (!validation.isValid) throw new Error(validation.error);

      const branch = branches.find((b) => b.id === currentBranchId);
      const branchSnapshot: BranchReceiptSnapshot = {
        id: currentBranchId,
        branchId: currentBranchId,
        name: branch?.name || 'Sede Principal',
        nit: branch?.nit || '',
        address: branch?.address || '',
        phone: branch?.phone || '',
        printConfig: branch?.printConfig || DEFAULT_BRANCH_PRINT_CONFIG,
      };

      const receiptNumber = `ANT-${1000 + supplierAdvances.length + 1}`;
      const ref = doc(collection(db, 'supplierAdvances'));
      const id = ref.id;

      const adv: SupplierAdvance = {
        id,
        receiptNumber,
        branchId: currentBranchId,
        supplierId: params.supplierId,
        supplierName: params.supplierName,
        amount: params.amount,
        originalAmount: params.amount,
        appliedAmount: 0,
        reintegratedAmount: 0,
        availableBalance: params.amount,
        balance: params.amount,
        date: new Date().toISOString().split('T')[0],
        paymentMethod: params.paymentMethod,
        observations: params.observations,
        status: 'disponible',
        userId: staffName,
        userName: staffName,
        createdAt: new Date().toISOString(),
        branchSnapshot,
      };

      await setDoc(ref, adv);

      if (params.paymentMethod === 'efectivo') {
        await addCashMovement('egreso', params.amount, `Anticipo a proveedor ${params.supplierName} (${receiptNumber})`);
      }

      await logAuditAction({
        entityType: 'branch',
        entityId: id,
        entityName: `Anticipo ${receiptNumber}`,
        action: 'create',
        details: `Anticipo a proveedor ${params.supplierName} registrado por ${formatCOP(params.amount)} (${params.paymentMethod})`,
      });

      return id;
    } catch (err) {
      console.error('Error creating supplier advance:', err);
      handleFirestoreError(err, OperationType.CREATE, 'supplierAdvances');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const registerSupplierAdvanceReintegro = async (params: {
    advanceId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    observations?: string;
  }): Promise<string> => {
    try {
      setActionLoading(true);
      const adv = supplierAdvances.find((a) => a.id === params.advanceId);
      if (!adv) throw new Error('Anticipo no encontrado');

      const currentAvailable = adv.availableBalance !== undefined ? adv.availableBalance : adv.balance;
      const validation = validateFinancialAmount(params.amount, currentAvailable);
      if (!validation.isValid) throw new Error(validation.error);

      const newReintegrated = (adv.reintegratedAmount || 0) + params.amount;
      const newAvailable = calculateAdvanceAvailableBalance(
        adv.originalAmount || adv.amount,
        adv.appliedAmount || 0,
        newReintegrated,
        adv.status || 'disponible'
      );
      const newStatus = determineAdvanceStatus(
        adv.originalAmount || adv.amount,
        adv.appliedAmount || 0,
        newReintegrated,
        adv.status === 'anulado'
      );

      await updateDoc(doc(db, 'supplierAdvances', adv.id), {
        reintegratedAmount: newReintegrated,
        availableBalance: newAvailable,
        balance: newAvailable,
        status: newStatus,
      });

      const branch = branches.find((b) => b.id === currentBranchId);
      const branchSnapshot: BranchReceiptSnapshot = {
        id: currentBranchId,
        branchId: currentBranchId,
        name: branch?.name || 'Sede Principal',
        nit: branch?.nit || '',
        address: branch?.address || '',
        phone: branch?.phone || '',
        printConfig: branch?.printConfig || DEFAULT_BRANCH_PRINT_CONFIG,
      };

      const receiptNumber = `REI-${1000 + supplierAdvanceReintegros.length + 1}`;
      const reiRef = doc(collection(db, 'supplierAdvanceReintegros'));
      const reintegroObj: SupplierAdvanceReintegro = {
        id: reiRef.id,
        receiptNumber,
        branchId: currentBranchId,
        advanceId: adv.id,
        supplierId: adv.supplierId,
        supplierName: adv.supplierName,
        amount: params.amount,
        paymentMethod: params.paymentMethod,
        date: new Date().toISOString(),
        observations: params.observations,
        userId: staffName,
        userName: staffName,
        createdAt: new Date().toISOString(),
        branchSnapshot,
      };

      await setDoc(reiRef, reintegroObj);

      if (params.paymentMethod === 'efectivo') {
        await addCashMovement('ingreso', params.amount, `Reintegro de anticipo ${adv.receiptNumber || adv.id} - ${adv.supplierName}`);
      }

      await logAuditAction({
        entityType: 'branch',
        entityId: adv.id,
        entityName: `Reintegro ${receiptNumber}`,
        action: 'update',
        details: `Reintegro de ${formatCOP(params.amount)} recibido de proveedor ${adv.supplierName}`,
      });

      return reiRef.id;
    } catch (err) {
      console.error('Error registering supplier advance reintegro:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'supplierAdvances');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const voidSupplierAdvance = async (advanceId: string, reason: string): Promise<void> => {
    try {
      setActionLoading(true);
      const adv = supplierAdvances.find((a) => a.id === advanceId);
      if (!adv) throw new Error('Anticipo no encontrado');

      const voidedAdv = voidSupplierAdvanceRecord(adv, reason, staffName);

      await updateDoc(doc(db, 'supplierAdvances', adv.id), {
        status: voidedAdv.status,
        availableBalance: 0,
        balance: 0,
        voidReason: voidedAdv.voidReason,
        voidedBy: voidedAdv.voidedBy,
        voidedAt: voidedAdv.voidedAt,
      });

      if (adv.paymentMethod === 'efectivo') {
        await addCashMovement('ingreso', adv.amount, `Anulación de anticipo ${adv.receiptNumber || adv.id} - ${adv.supplierName}`);
      }

      await logAuditAction({
        entityType: 'branch',
        entityId: adv.id,
        entityName: `Anulación Anticipo ${adv.receiptNumber || adv.id}`,
        action: 'update',
        details: `Anticipo anulado. Motivo: ${reason}`,
      });
    } catch (err) {
      console.error('Error voiding supplier advance:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'supplierAdvances');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const addPurchasePayment = async (params: {
    purchaseId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    advanceId?: string;
    notes?: string;
  }): Promise<void> => {
    try {
      setActionLoading(true);
      const purchase = purchases.find((p) => p.id === params.purchaseId);
      if (!purchase) throw new Error('Compra no encontrada');

      const validation = validateFinancialAmount(params.amount, purchase.balanceDue);
      if (!validation.isValid) throw new Error(validation.error);

      const amountToPay = Math.min(purchase.balanceDue, params.amount);
      const isAdvanceApp = !!params.advanceId;

      if (isAdvanceApp) {
        const adv = supplierAdvances.find((a) => a.id === params.advanceId);
        if (!adv) throw new Error('Anticipo no encontrado');
        const advAvailable = adv.availableBalance !== undefined ? adv.availableBalance : adv.balance;
        if (advAvailable < amountToPay) {
          throw new Error(`El saldo disponible del anticipo ($ ${formatCOP(advAvailable)}) es inferior al monto a aplicar.`);
        }

        const newApplied = (adv.appliedAmount || 0) + amountToPay;
        const newAvailable = calculateAdvanceAvailableBalance(
          adv.originalAmount || adv.amount,
          newApplied,
          adv.reintegratedAmount || 0,
          adv.status || 'disponible'
        );
        const newStatus = determineAdvanceStatus(
          adv.originalAmount || adv.amount,
          newApplied,
          adv.reintegratedAmount || 0,
          adv.status === 'anulado'
        );

        await updateDoc(doc(db, 'supplierAdvances', adv.id), {
          appliedAmount: newApplied,
          availableBalance: newAvailable,
          balance: newAvailable,
          status: newStatus,
        });
      } else if (params.paymentMethod === 'efectivo') {
        await addCashMovement('egreso', amountToPay, `Pago a proveedor ${purchase.supplierName} / Factura #${purchase.documentNumber}`);
      }

      const branch = branches.find((b) => b.id === currentBranchId);
      const branchSnapshot: BranchReceiptSnapshot = {
        id: currentBranchId,
        branchId: currentBranchId,
        name: branch?.name || 'Sede Principal',
        nit: branch?.nit || '',
        address: branch?.address || '',
        phone: branch?.phone || '',
        printConfig: branch?.printConfig || DEFAULT_BRANCH_PRINT_CONFIG,
      };

      const receiptNumber = `PAG-${1000 + purchasePayments.length + 1}`;
      const payRef = doc(collection(db, 'purchasePayments'));
      const newPay: PurchasePayment = {
        id: payRef.id,
        receiptNumber,
        branchId: currentBranchId,
        purchaseId: purchase.id,
        supplierId: purchase.supplierId,
        supplierName: purchase.supplierName,
        amount: amountToPay,
        paymentMethod: params.paymentMethod,
        type: isAdvanceApp ? 'aplicacion_anticipo' : 'pago_real',
        advanceId: params.advanceId,
        status: 'activo',
        notes: params.notes,
        date: new Date().toISOString(),
        userId: staffName,
        userName: staffName,
        createdAt: new Date().toISOString(),
        branchSnapshot,
      };

      await setDoc(payRef, newPay);

      const purchasePaymentsForThis = [...purchasePayments, newPay].filter((p) => p.purchaseId === purchase.id);
      const recalculated = recalculatePurchasePayableBalance(purchase.total, purchasePaymentsForThis);

      await updateDoc(doc(db, 'purchases', purchase.id), {
        amountPaid: recalculated.totalCovered,
        balanceDue: recalculated.balanceDue,
        paymentStatus: recalculated.paymentStatus,
      });

      await logAuditAction({
        entityType: 'branch',
        entityId: purchase.id,
        entityName: `Abono Compra ${purchase.documentNumber}`,
        action: 'update',
        details: `${isAdvanceApp ? 'Aplicación de anticipo' : 'Pago'} por ${formatCOP(amountToPay)} a factura #${purchase.documentNumber}`,
      });
    } catch (err) {
      console.error('Error adding purchase payment:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'purchases');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const editPurchasePayment = async (
    paymentId: string,
    updates: { amount: number; paymentMethod: PaymentMethod; notes?: string }
  ): Promise<void> => {
    try {
      setActionLoading(true);
      const payment = purchasePayments.find((p) => p.id === paymentId);
      if (!payment || payment.status === 'anulado') throw new Error('Comprobante de pago no válido');

      const purchase = purchases.find((p) => p.id === payment.purchaseId);
      if (!purchase) throw new Error('Compra de origen no encontrada');

      await updateDoc(doc(db, 'purchasePayments', payment.id), {
        amount: updates.amount,
        paymentMethod: updates.paymentMethod,
        notes: updates.notes,
        updatedAt: new Date().toISOString(),
      });

      const updatedPaymentsList = purchasePayments
        .map((p) => (p.id === payment.id ? { ...p, amount: updates.amount, paymentMethod: updates.paymentMethod } : p))
        .filter((p) => p.purchaseId === purchase.id);

      const recalculated = recalculatePurchasePayableBalance(purchase.total, updatedPaymentsList);

      await updateDoc(doc(db, 'purchases', purchase.id), {
        amountPaid: recalculated.totalCovered,
        balanceDue: recalculated.balanceDue,
        paymentStatus: recalculated.paymentStatus,
      });

      await logAuditAction({
        entityType: 'branch',
        entityId: payment.id,
        entityName: `Edición Comprobante ${payment.receiptNumber || payment.id}`,
        action: 'update',
        details: `Comprobante de pago modificado a ${formatCOP(updates.amount)} (${updates.paymentMethod})`,
      });
    } catch (err) {
      console.error('Error editing purchase payment:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'purchasePayments');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const voidPurchasePayment = async (paymentId: string, reason: string): Promise<void> => {
    try {
      setActionLoading(true);
      const payment = purchasePayments.find((p) => p.id === paymentId);
      if (!payment || payment.status === 'anulado') throw new Error('Comprobante de pago no encontrado o ya anulado');

      const purchase = purchases.find((p) => p.id === payment.purchaseId);
      if (!purchase) throw new Error('Compra de origen no encontrada');

      const voidedPay = voidPurchasePaymentRecord(payment, reason, staffName);

      await updateDoc(doc(db, 'purchasePayments', payment.id), {
        status: voidedPay.status,
        voidReason: voidedPay.voidReason,
        voidedBy: voidedPay.voidedBy,
        voidedAt: voidedPay.voidedAt,
        updatedAt: voidedPay.updatedAt,
      });

      if (payment.type === 'aplicacion_anticipo' && payment.advanceId) {
        const adv = supplierAdvances.find((a) => a.id === payment.advanceId);
        if (adv) {
          const newApplied = Math.max(0, (adv.appliedAmount || 0) - payment.amount);
          const newAvailable = calculateAdvanceAvailableBalance(
            adv.originalAmount || adv.amount,
            newApplied,
            adv.reintegratedAmount || 0,
            adv.status || 'disponible'
          );
          const newStatus = determineAdvanceStatus(
            adv.originalAmount || adv.amount,
            newApplied,
            adv.reintegratedAmount || 0,
            adv.status === 'anulado'
          );

          await updateDoc(doc(db, 'supplierAdvances', adv.id), {
            appliedAmount: newApplied,
            availableBalance: newAvailable,
            balance: newAvailable,
            status: newStatus,
          });
        }
      } else if (payment.paymentMethod === 'efectivo') {
        await addCashMovement('ingreso', payment.amount, `Anulación de pago a proveedor ${payment.supplierName} / Factura #${purchase.documentNumber}`);
      }

      const updatedPaymentsList = purchasePayments.map((p) => (p.id === payment.id ? { ...p, status: 'anulado' as const } : p)).filter((p) => p.purchaseId === purchase.id);
      const recalculated = recalculatePurchasePayableBalance(purchase.total, updatedPaymentsList);

      await updateDoc(doc(db, 'purchases', purchase.id), {
        amountPaid: recalculated.totalCovered,
        balanceDue: recalculated.balanceDue,
        paymentStatus: recalculated.paymentStatus,
      });

      await logAuditAction({
        entityType: 'branch',
        entityId: payment.id,
        entityName: `Anulación Pago ${payment.receiptNumber || payment.id}`,
        action: 'update',
        details: `Comprobante de pago anulado. Motivo: ${reason}`,
      });
    } catch (err) {
      console.error('Error voiding purchase payment:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'purchasePayments');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const cancelPurchase = async (purchaseId: string): Promise<void> => {
    try {
      setActionLoading(true);
      const purchase = purchases.find((p) => p.id === purchaseId);
      if (!purchase || purchase.status === 'anulada') throw new Error('Compra inválida');

      const validation = validatePurchaseCancellation(purchase.items, inventory);
      if (!validation.canCancel) {
        throw new Error(validation.error || 'No se puede anular la compra');
      }

      for (const pItem of purchase.items) {
        const invItem = inventory.find((i) => i.id === pItem.ingredientId);
        if (invItem) {
          const newStock = invItem.currentStock - pItem.quantity;
          await updateDoc(doc(db, 'inventoryItems', invItem.id), {
            currentStock: newStock,
            updatedAt: new Date().toISOString(),
          });

          const movRef = doc(collection(db, 'inventoryMovements'));
          const newMov: InventoryMovement = {
            id: movRef.id,
            branchId: currentBranchId,
            itemId: pItem.ingredientId,
            itemName: pItem.ingredientName,
            type: 'ajuste_manual',
            quantity: -pItem.quantity,
            previousStock: invItem.currentStock,
            newStock,
            reason: `Anulación Compra #${purchase.documentNumber}`,
            userId: staffName,
            userName: staffName,
            createdAt: new Date().toISOString(),
          };
          await setDoc(movRef, newMov);
        }
      }

      await updateDoc(doc(db, 'purchases', purchase.id), {
        status: 'anulada',
        balanceDue: 0,
      });

      await logAuditAction({
        entityType: 'branch',
        entityId: purchase.id,
        entityName: `Anulación Compra ${purchase.documentNumber}`,
        action: 'update',
        details: `Compra ${purchase.documentNumber} anulada y stock revertido`,
      });
    } catch (err) {
      console.error('Error canceling purchase:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'purchases');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const createCustomer = async (
    data: Omit<Customer, 'id' | 'createdAt' | 'loyaltyPoints' | 'totalSpent' | 'visitsCount' | 'status'>
  ): Promise<string> => {
    try {
      setActionLoading(true);
      const ref = doc(collection(db, 'customers'));
      const id = ref.id;
      const initialPoints = 50;

      const newCustomer: Customer = {
        ...data,
        id,
        branchId: 'all',
        status: 'activo',
        loyaltyPoints: initialPoints,
        totalSpent: 0,
        visitsCount: 0,
        createdAt: new Date().toISOString(),
      };

      await setDoc(ref, newCustomer);

      const txRef = doc(collection(db, 'loyaltyTransactions'));
      const initialTx: LoyaltyTransaction = {
        id: txRef.id,
        branchId: currentBranchId,
        customerId: id,
        customerName: data.name,
        type: 'acumulacion',
        points: initialPoints,
        reason: 'Bono de bienvenida por registro en Sistema Colmena',
        userId: staffName,
        userName: staffName,
        createdAt: new Date().toISOString(),
      };
      await setDoc(txRef, initialTx);

      await logAuditAction({
        entityType: 'branch',
        entityId: id,
        entityName: data.name,
        action: 'create',
        details: `Cliente registrado: ${data.name} (${data.documentNumber})`,
      });

      return id;
    } catch (err) {
      console.error('Error creating customer:', err);
      handleFirestoreError(err, OperationType.CREATE, 'customers');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const updateCustomer = async (id: string, data: Partial<Customer>): Promise<void> => {
    try {
      setActionLoading(true);
      await updateDoc(doc(db, 'customers', id), data);
      await logAuditAction({
        entityType: 'branch',
        entityId: id,
        entityName: data.name || id,
        action: 'update',
        details: `Cliente actualizado: [${Object.keys(data).join(', ')}]`,
      });
    } catch (err) {
      console.error('Error updating customer:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'customers');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const toggleCustomerStatus = async (id: string, status: CustomerStatus): Promise<void> => {
    try {
      await updateDoc(doc(db, 'customers', id), { status });
    } catch (err) {
      console.error('Error toggling customer status:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'customers');
      throw err;
    }
  };

  const adjustCustomerPoints = async (customerId: string, points: number, reason: string): Promise<void> => {
    try {
      setActionLoading(true);
      const cust = customers.find((c) => c.id === customerId);
      if (!cust) throw new Error('Cliente no encontrado');

      const newPoints = Math.max(0, cust.loyaltyPoints + points);
      await updateDoc(doc(db, 'customers', customerId), {
        loyaltyPoints: newPoints,
      });

      const txRef = doc(collection(db, 'loyaltyTransactions'));
      const tx: LoyaltyTransaction = {
        id: txRef.id,
        branchId: currentBranchId,
        customerId,
        customerName: cust.name,
        type: points >= 0 ? 'acumulacion' : 'redencion',
        points: Math.abs(points),
        reason,
        userId: staffName,
        userName: staffName,
        createdAt: new Date().toISOString(),
      };
      await setDoc(txRef, tx);
    } catch (err) {
      console.error('Error adjusting customer points:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'customers');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================
  // OPERACIONES DE SEPARADOS, CARTERA Y ABONOS
  // ==========================================

  const createSeparado = async (data: {
    customerId: string;
    customerName: string;
    customerPhone: string;
    customerDocument: string;
    customerAddress?: string;
    items: SeparadoItem[];
    initialDeposit: number;
    deliveryDate: string;
    deliveryTime?: string;
    reserveInventory?: boolean;
    notes?: string;
    paymentMethod?: PaymentMethod;
  }): Promise<{ separadoId: string; receiptAbono?: Abono }> => {
    setActionLoading(true);
    try {
      const now = new Date().toISOString();
      const ref = doc(collection(db, 'separados'));
      const id = ref.id;
      const code = `SEP-${Math.floor(1000 + Math.random() * 9000)}`;

      const totalAmount = data.items.reduce((sum, item) => sum + (item.totalPrice || item.quantity * item.unitPrice), 0);
      const initialDeposit = Math.max(0, data.initialDeposit || 0);
      const pendingBalance = Math.max(0, totalAmount - initialDeposit);

      const originBranch = branches.find((b) => b.id === currentBranchId) || branches[0];
      const branchSnapshot: BranchReceiptSnapshot = {
        branchId: originBranch?.id || currentBranchId,
        name: originBranch?.name || 'SISTEMA COLMENA RESTAURANTE',
        nit: originBranch?.nit || '901.458.920-4',
        address: originBranch?.address || '',
        phone: originBranch?.phone || '',
        logoUrl: originBranch?.logoUrl || '',
        notes: originBranch?.notes || '',
        printConfig: originBranch?.printConfig || DEFAULT_BRANCH_PRINT_CONFIG,
        resolutionDian: originBranch?.receiptConfig?.resolutionDian || '',
        prefix: originBranch?.receiptConfig?.prefix || 'SEP-',
        issuedAt: now,
      };

      let initialAbono: Abono | undefined;

      // Si hay anticipo inicial, registrar Abono y movimiento en caja
      if (initialDeposit > 0) {
        const abonoRef = doc(collection(db, 'abonos'));
        initialAbono = {
          id: abonoRef.id,
          parentId: id,
          parentType: 'separado',
          receiptNumber: `ABN-${Math.floor(1000 + Math.random() * 9000)}`,
          branchId: currentBranchId,
          branchSnapshot,
          customerId: data.customerId,
          customerName: data.customerName,
          customerDocument: data.customerDocument,
          customerPhone: data.customerPhone,
          amount: initialDeposit,
          paymentMethod: data.paymentMethod || 'efectivo',
          notes: 'Anticipo inicial por reserva de separado',
          shiftId: activeShift ? activeShift.id : undefined,
          userId: staffName,
          userName: staffName,
          createdAt: now,
          status: 'activo',
        };
        await setDoc(abonoRef, sanitizeFirestoreData(initialAbono));

        if (activeShift && (data.paymentMethod === 'efectivo' || !data.paymentMethod)) {
          await addCashMovement(
            'ingreso',
            initialDeposit,
            `Anticipo Separado #${code} - ${data.customerName}`
          );
        }
      }

      const newSeparado: Separado = {
        id,
        code,
        branchId: currentBranchId,
        branchSnapshot,
        customerId: data.customerId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerDocument: data.customerDocument,
        customerAddress: data.customerAddress || '',
        items: data.items,
        totalAmount,
        initialDeposit,
        totalAbonado: initialDeposit,
        pendingBalance,
        deliveryDate: data.deliveryDate,
        deliveryTime: data.deliveryTime || '12:00',
        reserveInventory: Boolean(data.reserveInventory),
        inventoryReserved: Boolean(data.reserveInventory),
        sentToKitchen: false,
        status: 'activo',
        deliveryStatus: 'pendiente',
        notes: data.notes || '',
        createdAt: now,
        updatedAt: now,
        createdBy: staffName,
      };

      await setDoc(ref, sanitizeFirestoreData(newSeparado));

      await logAuditAction({
        entityType: 'branch',
        entityId: id,
        entityName: `Separado #${code}`,
        action: 'create',
        details: `Separado registrado para ${data.customerName} - Total: $${totalAmount.toLocaleString('es-CO')} - Anticipo: $${initialDeposit.toLocaleString('es-CO')}`,
      });

      return { separadoId: id, receiptAbono: initialAbono };
    } catch (err) {
      console.error('Error creating separado:', err);
      handleFirestoreError(err, OperationType.CREATE, 'separados');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const registerSeparadoAbono = async (params: {
    separadoId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    notes?: string;
  }): Promise<Abono> => {
    setActionLoading(true);
    try {
      const sep = separados.find((s) => s.id === params.separadoId);
      if (!sep) throw new Error('Separado no encontrado');

      const validation = validateAbonoAmount(params.amount, sep.pendingBalance);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Monto de abono inválido');
      }

      const now = new Date().toISOString();
      const originBranch = branches.find((b) => b.id === sep.branchId) || branches[0];
      const branchSnapshot: BranchReceiptSnapshot = {
        branchId: originBranch?.id || sep.branchId,
        name: originBranch?.name || 'SISTEMA COLMENA RESTAURANTE',
        nit: originBranch?.nit || '901.458.920-4',
        address: originBranch?.address || '',
        phone: originBranch?.phone || '',
        logoUrl: originBranch?.logoUrl || '',
        notes: originBranch?.notes || '',
        printConfig: originBranch?.printConfig || DEFAULT_BRANCH_PRINT_CONFIG,
        resolutionDian: originBranch?.receiptConfig?.resolutionDian || '',
        prefix: originBranch?.receiptConfig?.prefix || 'ABN-',
        issuedAt: now,
      };

      const abonoRef = doc(collection(db, 'abonos'));
      const abonoId = abonoRef.id;
      const receiptNumber = `ABN-${Math.floor(1000 + Math.random() * 9000)}`;

      const newAbono: Abono = {
        id: abonoId,
        parentId: sep.id,
        parentType: 'separado',
        receiptNumber,
        branchId: sep.branchId,
        branchSnapshot,
        customerId: sep.customerId,
        customerName: sep.customerName,
        customerDocument: sep.customerDocument,
        customerPhone: sep.customerPhone,
        amount: params.amount,
        paymentMethod: params.paymentMethod,
        notes: params.notes || 'Abono a separado comercial',
        shiftId: activeShift ? activeShift.id : undefined,
        userId: staffName,
        userName: staffName,
        createdAt: now,
        status: 'activo',
      };

      await setDoc(abonoRef, sanitizeFirestoreData(newAbono));

      if (activeShift && params.paymentMethod === 'efectivo') {
        await addCashMovement(
          'ingreso',
          params.amount,
          `Abono a Separado #${sep.code} (${sep.customerName})`
        );
      }

      const existingAbonos = abonos.filter((a) => a.parentId === sep.id);
      const { totalAbonado, pendingBalance } = recalculateSeparadoBalance(
        sep.totalAmount,
        sep.initialDeposit,
        [...existingAbonos, newAbono]
      );

      await updateDoc(doc(db, 'separados', sep.id), {
        totalAbonado,
        pendingBalance,
        updatedAt: now,
      });

      await logAuditAction({
        entityType: 'branch',
        entityId: abonoId,
        entityName: `Abono #${receiptNumber}`,
        action: 'create',
        details: `Abono de $${params.amount.toLocaleString('es-CO')} registrado al Separado #${sep.code}`,
      });

      return newAbono;
    } catch (err) {
      console.error('Error registering separado abono:', err);
      handleFirestoreError(err, OperationType.CREATE, 'abonos');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const sendSeparadoToKitchen = async (separadoId: string): Promise<void> => {
    setActionLoading(true);
    try {
      const sep = separados.find((s) => s.id === separadoId);
      if (!sep) throw new Error('Separado no encontrado');

      const now = new Date().toISOString();
      const comandaRef = doc(collection(db, 'comandas'));
      const comandaId = comandaRef.id;

      const comandaItems = sep.items.map((it, idx) => ({
        orderItemId: `sep-item-${idx}-${Date.now()}`,
        menuItemId: it.menuItemId || `menu-${idx}`,
        name: it.name,
        quantity: it.quantity,
        station: 'cocina_caliente' as KitchenStation,
        notes: it.notes || `Separado #${sep.code} - Entrega: ${sep.deliveryDate} ${sep.deliveryTime || ''}`,
        status: 'pendiente' as const,
      }));

      const newComanda: Comanda = {
        id: comandaId,
        branchId: sep.branchId,
        orderId: sep.id,
        orderNumber: parseInt(sep.code.replace(/\D/g, '')) || 9999,
        tableName: `Separado #${sep.code} (${sep.customerName})`,
        orderType: 'para_llevar',
        roundNumber: 1,
        status: 'nueva',
        items: comandaItems,
        waiterName: staffName,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(comandaRef, sanitizeFirestoreData(newComanda));

      await updateDoc(doc(db, 'separados', sep.id), {
        sentToKitchen: true,
        deliveryStatus: 'en_cocina',
        kitchenComandaId: comandaId,
        updatedAt: now,
      });

      await logAuditAction({
        entityType: 'pedidos',
        entityId: sep.id,
        entityName: `Comanda Separado #${sep.code}`,
        action: 'create',
        details: `Separado #${sep.code} enviado a cocina para preparación`,
      });
    } catch (err) {
      console.error('Error sending separado to kitchen:', err);
      handleFirestoreError(err, OperationType.CREATE, 'comandas');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const finalizeSeparado = async (separadoId: string): Promise<void> => {
    setActionLoading(true);
    try {
      const sep = separados.find((s) => s.id === separadoId);
      if (!sep) throw new Error('Separado no encontrado');
      if (sep.pendingBalance > 0) {
        throw new Error(`El separado tiene un saldo pendiente de $${sep.pendingBalance.toLocaleString('es-CO')}. Debe completar los abonos antes de finalizar.`);
      }

      const now = new Date().toISOString();

      for (const item of sep.items) {
        if (item.recipe && item.recipe.length > 0) {
          for (const ing of item.recipe) {
            const invItem = inventory.find((i) => i.id === ing.inventoryItemId);
            if (invItem) {
              const qtyDeducted = ing.quantity * item.quantity;
              const newStock = Math.max(0, invItem.currentStock - qtyDeducted);
              await updateDoc(doc(db, 'inventoryItems', invItem.id), {
                currentStock: newStock,
                updatedAt: now,
              });

              const movRef = doc(collection(db, 'inventoryMovements'));
              const newMov: InventoryMovement = {
                id: movRef.id,
                branchId: sep.branchId,
                itemId: invItem.id,
                itemName: invItem.name,
                type: 'consumo_comanda',
                quantity: -qtyDeducted,
                previousStock: invItem.currentStock,
                newStock,
                reason: `Entrega Separado #${sep.code} (${item.name} x${item.quantity})`,
                userId: staffName,
                userName: staffName,
                createdAt: now,
              };
              await setDoc(movRef, newMov);
            }
          }
        }
      }

      await updateDoc(doc(db, 'separados', sep.id), {
        status: 'completado',
        deliveryStatus: 'entregado',
        updatedAt: now,
      });

      await logAuditAction({
        entityType: 'branch',
        entityId: sep.id,
        entityName: `Separado #${sep.code}`,
        action: 'update',
        details: `Separado finalizado y entregado al cliente ${sep.customerName}`,
      });
    } catch (err) {
      console.error('Error finalizing separado:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'separados');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const cancelSeparado = async (separadoId: string, reason: string, refundAmount?: number): Promise<void> => {
    setActionLoading(true);
    try {
      const sep = separados.find((s) => s.id === separadoId);
      if (!sep) throw new Error('Separado no encontrado');
      if (!reason || reason.trim().length < 5) {
        throw new Error('Debe proporcionar un motivo de cancelación detallado (mínimo 5 caracteres).');
      }

      const now = new Date().toISOString();
      const refund = Math.max(0, refundAmount || 0);

      if (refund > 0 && activeShift) {
        await addCashMovement(
          'egreso',
          refund,
          `Devolución cancelación Separado #${sep.code}: ${reason.trim()}`
        );
      }

      await updateDoc(doc(db, 'separados', sep.id), {
        status: 'cancelado',
        cancellationReason: reason.trim(),
        cancelledAt: now,
        cancelledBy: staffName,
        refundAmount: refund,
        updatedAt: now,
      });

      await logAuditAction({
        entityType: 'branch',
        entityId: sep.id,
        entityName: `Separado #${sep.code}`,
        action: 'status_change',
        details: `Separado cancelado. Motivo: ${reason.trim()}. Devolución: $${refund.toLocaleString('es-CO')}`,
      });
    } catch (err) {
      console.error('Error canceling separado:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'separados');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const createCarteraRecord = async (data: {
    saleId: string;
    orderNumber: number;
    customerId: string;
    customerName: string;
    customerPhone: string;
    customerDocument: string;
    customerAddress?: string;
    totalAmount: number;
    initialPayment: number;
    dueDate: string;
    notes?: string;
    paymentMethod?: PaymentMethod;
  }): Promise<{ carteraId: string; receiptAbono?: Abono }> => {
    setActionLoading(true);
    try {
      const now = new Date().toISOString();
      const ref = doc(collection(db, 'cartera'));
      const id = ref.id;
      const code = `CRD-${data.orderNumber || Math.floor(1000 + Math.random() * 9000)}`;

      const totalAmount = data.totalAmount;
      const initialPayment = Math.max(0, data.initialPayment || 0);
      const balanceDue = Math.max(0, totalAmount - initialPayment);

      const originBranch = branches.find((b) => b.id === currentBranchId) || branches[0];
      const branchSnapshot: BranchReceiptSnapshot = {
        branchId: originBranch?.id || currentBranchId,
        name: originBranch?.name || 'SISTEMA COLMENA RESTAURANTE',
        nit: originBranch?.nit || '901.458.920-4',
        address: originBranch?.address || '',
        phone: originBranch?.phone || '',
        logoUrl: originBranch?.logoUrl || '',
        notes: originBranch?.notes || '',
        printConfig: originBranch?.printConfig || DEFAULT_BRANCH_PRINT_CONFIG,
        resolutionDian: originBranch?.receiptConfig?.resolutionDian || '',
        prefix: originBranch?.receiptConfig?.prefix || 'CRD-',
        issuedAt: now,
      };

      let initialAbono: Abono | undefined;

      if (initialPayment > 0) {
        const abonoRef = doc(collection(db, 'abonos'));
        initialAbono = {
          id: abonoRef.id,
          parentId: id,
          parentType: 'cartera',
          receiptNumber: `ABN-${Math.floor(1000 + Math.random() * 9000)}`,
          branchId: currentBranchId,
          branchSnapshot,
          customerId: data.customerId,
          customerName: data.customerName,
          customerDocument: data.customerDocument,
          customerPhone: data.customerPhone,
          amount: initialPayment,
          paymentMethod: data.paymentMethod || 'efectivo',
          notes: 'Pago inicial / Cuota inicial por venta a crédito',
          shiftId: activeShift ? activeShift.id : undefined,
          userId: staffName,
          userName: staffName,
          createdAt: now,
          status: 'activo',
        };
        await setDoc(abonoRef, sanitizeFirestoreData(initialAbono));

        if (activeShift && (data.paymentMethod === 'efectivo' || !data.paymentMethod)) {
          await addCashMovement(
            'ingreso',
            initialPayment,
            `Cuota inicial Cartera #${code} - ${data.customerName}`
          );
        }
      }

      const status: CarteraStatus = balanceDue <= 0 ? 'pagada' : isCarteraOverdue(data.dueDate) ? 'vencida' : 'vigente';

      const newCartera: CarteraRecord = {
        id,
        code,
        saleId: data.saleId,
        orderNumber: data.orderNumber,
        branchId: currentBranchId,
        branchSnapshot,
        customerId: data.customerId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerDocument: data.customerDocument,
        customerAddress: data.customerAddress || '',
        totalAmount,
        initialPayment,
        totalAbonado: initialPayment,
        balanceDue,
        dueDate: data.dueDate,
        status,
        notes: data.notes || '',
        createdAt: now,
        updatedAt: now,
        createdBy: staffName,
      };

      await setDoc(ref, sanitizeFirestoreData(newCartera));

      await logAuditAction({
        entityType: 'branch',
        entityId: id,
        entityName: `Cartera #${code}`,
        action: 'create',
        details: `Cuenta por cobrar registrada para ${data.customerName} - Saldo: $${balanceDue.toLocaleString('es-CO')}`,
      });

      return { carteraId: id, receiptAbono: initialAbono };
    } catch (err) {
      console.error('Error creating cartera record:', err);
      handleFirestoreError(err, OperationType.CREATE, 'cartera');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const registerCarteraAbono = async (params: {
    carteraId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    notes?: string;
  }): Promise<Abono> => {
    setActionLoading(true);
    try {
      const crd = cartera.find((c) => c.id === params.carteraId);
      if (!crd) throw new Error('Cuenta de cartera no encontrada');

      const validation = validateAbonoAmount(params.amount, crd.balanceDue);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Monto de abono inválido');
      }

      const now = new Date().toISOString();
      const originBranch = branches.find((b) => b.id === crd.branchId) || branches[0];
      const branchSnapshot: BranchReceiptSnapshot = {
        branchId: originBranch?.id || crd.branchId,
        name: originBranch?.name || 'SISTEMA COLMENA RESTAURANTE',
        nit: originBranch?.nit || '901.458.920-4',
        address: originBranch?.address || '',
        phone: originBranch?.phone || '',
        logoUrl: originBranch?.logoUrl || '',
        notes: originBranch?.notes || '',
        printConfig: originBranch?.printConfig || DEFAULT_BRANCH_PRINT_CONFIG,
        resolutionDian: originBranch?.receiptConfig?.resolutionDian || '',
        prefix: originBranch?.receiptConfig?.prefix || 'ABN-',
        issuedAt: now,
      };

      const abonoRef = doc(collection(db, 'abonos'));
      const abonoId = abonoRef.id;
      const receiptNumber = `ABN-${Math.floor(1000 + Math.random() * 9000)}`;

      const newAbono: Abono = {
        id: abonoId,
        parentId: crd.id,
        parentType: 'cartera',
        receiptNumber,
        branchId: crd.branchId,
        branchSnapshot,
        customerId: crd.customerId,
        customerName: crd.customerName,
        customerDocument: crd.customerDocument,
        customerPhone: crd.customerPhone,
        amount: params.amount,
        paymentMethod: params.paymentMethod,
        notes: params.notes || 'Abono a cartera de clientes',
        shiftId: activeShift ? activeShift.id : undefined,
        userId: staffName,
        userName: staffName,
        createdAt: now,
        status: 'activo',
      };

      await setDoc(abonoRef, sanitizeFirestoreData(newAbono));

      if (activeShift && params.paymentMethod === 'efectivo') {
        await addCashMovement(
          'ingreso',
          params.amount,
          `Abono Cartera #${crd.code} (${crd.customerName})`
        );
      }

      const existingAbonos = abonos.filter((a) => a.parentId === crd.id);
      const { totalAbonado, balanceDue, isFullyPaid } = recalculateCarteraBalance(
        crd.totalAmount,
        crd.initialPayment,
        [...existingAbonos, newAbono]
      );

      const status: CarteraStatus = isFullyPaid ? 'pagada' : isCarteraOverdue(crd.dueDate) ? 'vencida' : 'vigente';

      await updateDoc(doc(db, 'cartera', crd.id), {
        totalAbonado,
        balanceDue,
        status,
        updatedAt: now,
      });

      await logAuditAction({
        entityType: 'branch',
        entityId: abonoId,
        entityName: `Abono #${receiptNumber}`,
        action: 'create',
        details: `Abono de $${params.amount.toLocaleString('es-CO')} registrado a Cartera #${crd.code}`,
      });

      return newAbono;
    } catch (err) {
      console.error('Error registering cartera abono:', err);
      handleFirestoreError(err, OperationType.CREATE, 'abonos');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const editAbono = async (abonoId: string, updates: { notes?: string; paymentMethod?: PaymentMethod }): Promise<void> => {
    setActionLoading(true);
    try {
      const ab = abonos.find((a) => a.id === abonoId);
      if (!ab) throw new Error('Abono no encontrado');
      if (ab.status === 'anulado') throw new Error('No se puede editar un abono anulado');

      const now = new Date().toISOString();
      await updateDoc(doc(db, 'abonos', abonoId), {
        ...updates,
        updatedAt: now,
      });

      await logAuditAction({
        entityType: 'branch',
        entityId: abonoId,
        entityName: `Abono #${ab.receiptNumber}`,
        action: 'update',
        details: `Edición de abono #${ab.receiptNumber}: ${Object.keys(updates).join(', ')}`,
      });
    } catch (err) {
      console.error('Error editing abono:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'abonos');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const voidAbono = async (abonoId: string, reason: string): Promise<void> => {
    setActionLoading(true);
    try {
      const ab = abonos.find((a) => a.id === abonoId);
      if (!ab) throw new Error('Abono no encontrado');

      const voided = voidAbonoRecord(ab, reason, staffName);
      const now = new Date().toISOString();

      await updateDoc(doc(db, 'abonos', abonoId), {
        status: 'anulado',
        voidReason: voided.voidReason,
        voidedAt: voided.voidedAt,
        voidedBy: voided.voidedBy,
        updatedAt: now,
      });

      // Si fue en efectivo y hay turno activo, registrar movimiento de egreso para cuadre de caja
      if (activeShift && ab.paymentMethod === 'efectivo') {
        await addCashMovement(
          'egreso',
          ab.amount,
          `Anulación de Abono #${ab.receiptNumber} (${ab.customerName}): ${reason}`
        );
      }

      // Reajustar saldo del padre sin anular la venta o separado
      if (ab.parentType === 'cartera') {
        const crd = cartera.find((c) => c.id === ab.parentId);
        if (crd) {
          const remainingAbonos = abonos.map((a) => (a.id === abonoId ? voided : a)).filter((a) => a.parentId === crd.id);
          const { totalAbonado, balanceDue, isFullyPaid } = recalculateCarteraBalance(
            crd.totalAmount,
            crd.initialPayment,
            remainingAbonos
          );
          const status: CarteraStatus = isFullyPaid ? 'pagada' : isCarteraOverdue(crd.dueDate) ? 'vencida' : 'vigente';
          await updateDoc(doc(db, 'cartera', crd.id), {
            totalAbonado,
            balanceDue,
            status,
            updatedAt: now,
          });
        }
      } else if (ab.parentType === 'separado') {
        const sep = separados.find((s) => s.id === ab.parentId);
        if (sep) {
          const remainingAbonos = abonos.map((a) => (a.id === abonoId ? voided : a)).filter((a) => a.parentId === sep.id);
          const { totalAbonado, pendingBalance } = recalculateSeparadoBalance(
            sep.totalAmount,
            sep.initialDeposit,
            remainingAbonos
          );
          await updateDoc(doc(db, 'separados', sep.id), {
            totalAbonado,
            pendingBalance,
            updatedAt: now,
          });
        }
      }

      await logAuditAction({
        entityType: 'branch',
        entityId: abonoId,
        entityName: `Anulación Abono #${ab.receiptNumber}`,
        action: 'status_change',
        details: `Abono de $${ab.amount.toLocaleString('es-CO')} anulado. Motivo: ${reason}`,
      });
    } catch (err) {
      console.error('Error voiding abono:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'abonos');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  // CRUD de Medios de Pago
  const createPaymentMethod = async (data: Omit<PaymentMethodItem, 'id' | 'createdAt'>): Promise<string> => {
    setActionLoading(true);
    try {
      const now = new Date().toISOString();
      const sanitized = sanitizeFirestoreData({
        ...data,
        createdAt: now,
        updatedAt: now,
      });
      const docRef = await addDoc(collection(db, 'payment_methods'), sanitized);
      await logAuditAction({
        entityType: 'branch',
        entityId: docRef.id,
        entityName: `Crear Medio de Pago: ${data.name}`,
        action: 'create',
        details: `Creado medio de pago ${data.name} (${data.category})`,
      });
      return docRef.id;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'payment_methods');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const updatePaymentMethod = async (id: string, updates: Partial<PaymentMethodItem>): Promise<void> => {
    setActionLoading(true);
    try {
      const docRef = doc(db, 'payment_methods', id);
      const sanitized = sanitizeFirestoreData({
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      await updateDoc(docRef, sanitized);
      await logAuditAction({
        entityType: 'branch',
        entityId: id,
        entityName: `Actualizar Medio de Pago: ${updates.name || id}`,
        action: 'update',
        details: `Actualizado medio de pago ${id}`,
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `payment_methods/${id}`);
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const deletePaymentMethod = async (id: string): Promise<void> => {
    setActionLoading(true);
    try {
      const target = paymentMethods.find((p) => p.id === id);
      const docRef = doc(db, 'payment_methods', id);
      await deleteDoc(docRef);
      await logAuditAction({
        entityType: 'branch',
        entityId: id,
        entityName: `Eliminar Medio de Pago: ${target?.name || id}`,
        action: 'delete',
        details: `Eliminado medio de pago ${target?.name || id}`,
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `payment_methods/${id}`);
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const togglePaymentMethodStatus = async (id: string, status?: boolean): Promise<void> => {
    const target = paymentMethods.find((p) => p.id === id);
    if (!target) return;
    const nextStatus = status !== undefined ? status : !target.isActive;
    await updatePaymentMethod(id, { isActive: nextStatus });
  };

  // CRUD de Otros Ingresos
  const createOtherIncome = async (data: {
    date?: string;
    concept: string;
    thirdParty?: string;
    paymentMethod: PaymentMethod;
    amount: number;
    observations?: string;
  }): Promise<OtherIncome> => {
    setActionLoading(true);
    try {
      const now = new Date().toISOString();
      const incomeDate = data.date || now;
      const consecutivo = `ING-${String(otherIncomes.length + 1).padStart(4, '0')}`;
      
      const newIncomeId = `inc-${Date.now()}`;
      let cashMovementId: string | undefined = undefined;

      // Si es en efectivo y hay turno activo, registrar ingreso en caja
      const isCash =
        data.paymentMethod === 'efectivo' ||
        (paymentMethods.find((p) => p.name.toLowerCase() === data.paymentMethod.toLowerCase())?.isCashType ?? false);
      if (isCash && activeShift) {
        await addCashMovement(
          'ingreso',
          data.amount,
          `Otro Ingreso #${consecutivo}: ${data.concept} (${data.thirdParty || 'General'})`
        );
      }

      const originBranch = branches.find((b) => b.id === currentBranchId) || branches[0];
      const branchSnapshot: BranchReceiptSnapshot = {
        branchId: originBranch?.id || currentBranchId,
        name: originBranch?.name || currentBranch?.name || 'SISTEMA COLMENA RESTAURANTE',
        nit: originBranch?.nit || currentBranch?.nit || '901.458.920-4',
        address: originBranch?.address || currentBranch?.address || '',
        phone: originBranch?.phone || currentBranch?.phone || '',
        logoUrl: originBranch?.logoUrl || '',
        notes: originBranch?.notes || '',
        printConfig: originBranch?.printConfig || DEFAULT_BRANCH_PRINT_CONFIG,
        resolutionDian: originBranch?.receiptConfig?.resolutionDian || '',
        prefix: originBranch?.receiptConfig?.prefix || 'ING-',
        issuedAt: now,
      };

      const newIncome: OtherIncome = {
        id: newIncomeId,
        consecutivo,
        branchId: currentBranchId,
        branchSnapshot,
        date: incomeDate,
        concept: data.concept,
        thirdParty: data.thirdParty || undefined,
        paymentMethod: data.paymentMethod,
        amount: data.amount,
        observations: data.observations || undefined,
        status: 'activo',
        userId: staffName,
        userName: staffName,
        shiftId: activeShift?.id,
        cashMovementId,
        createdAt: now,
        updatedAt: now,
      };

      const sanitized = sanitizeFirestoreData(newIncome);
      await setDoc(doc(db, 'other_incomes', newIncomeId), sanitized);

      await logAuditAction({
        entityType: 'branch',
        entityId: newIncomeId,
        entityName: `Otro Ingreso #${consecutivo}`,
        action: 'create',
        details: `Registrado ingreso de ${formatCOP(data.amount)} (${data.concept}) vía ${data.paymentMethod}`,
      });

      return newIncome;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'other_incomes');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const updateOtherIncome = async (id: string, updates: Partial<OtherIncome>): Promise<void> => {
    setActionLoading(true);
    try {
      const target = otherIncomes.find((i) => i.id === id);
      if (!target) throw new Error('Ingreso no encontrado');

      const now = new Date().toISOString();
      const docRef = doc(db, 'other_incomes', id);
      const sanitized = sanitizeFirestoreData({
        ...updates,
        updatedAt: now,
      });

      await updateDoc(docRef, sanitized);

      await logAuditAction({
        entityType: 'branch',
        entityId: id,
        entityName: `Edición Ingreso #${target.consecutivo}`,
        action: 'update',
        details: `Actualizado ingreso #${target.consecutivo}. Monto: ${updates.amount ? formatCOP(updates.amount) : formatCOP(target.amount)}`,
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `other_incomes/${id}`);
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const voidOtherIncome = async (id: string, reason: string): Promise<void> => {
    setActionLoading(true);
    try {
      const target = otherIncomes.find((i) => i.id === id);
      if (!target) throw new Error('Ingreso no encontrado');
      if (target.status === 'anulado') throw new Error('Este ingreso ya fue anulado previamente');

      const now = new Date().toISOString();
      const docRef = doc(db, 'other_incomes', id);

      // Si fue en efectivo y hay turno activo, registrar egreso para reversión en caja
      const isCash =
        target.paymentMethod === 'efectivo' ||
        (paymentMethods.find((p) => p.name.toLowerCase() === target.paymentMethod.toLowerCase())?.isCashType ?? false);
      if (isCash && activeShift) {
        await addCashMovement(
          'egreso',
          target.amount,
          `Anulación Otro Ingreso #${target.consecutivo} (${target.concept}): ${reason}`
        );
      }

      await updateDoc(docRef, {
        status: 'anulado',
        voidReason: reason,
        voidedAt: now,
        voidedBy: staffName,
        updatedAt: now,
      });

      await logAuditAction({
        entityType: 'branch',
        entityId: id,
        entityName: `Anulación Ingreso #${target.consecutivo}`,
        action: 'status_change',
        details: `Ingreso #${target.consecutivo} de ${formatCOP(target.amount)} anulado. Motivo: ${reason}`,
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `other_incomes/${id}`);
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const voidPayment = async (paymentId: string, reason: string): Promise<void> => {
    setActionLoading(true);
    try {
      const target = payments.find((p) => p.id === paymentId);
      if (!target) throw new Error('Pago no encontrado');
      if (target.status === 'anulado') throw new Error('Este pago ya fue anulado');

      const now = new Date().toISOString();
      const docRef = doc(db, 'payments', paymentId);

      // Si fue en efectivo y hay turno activo, revertir en caja
      if (target.method === 'efectivo' && activeShift) {
        await addCashMovement(
          'egreso',
          target.amountPaid,
          `Anulación Pago Venta #${target.orderNumber}: ${reason}`
        );
      }

      await updateDoc(docRef, {
        status: 'anulado',
        voidReason: reason,
        voidedAt: now,
        voidedBy: staffName,
      });

      await logAuditAction({
        entityType: 'branch',
        entityId: paymentId,
        entityName: `Anulación Pago #${target.orderNumber}`,
        action: 'status_change',
        details: `Pago de venta #${target.orderNumber} por ${formatCOP(target.amountPaid)} anulado. Motivo: ${reason}`,
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `payments/${paymentId}`);
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  // Helper para convertir Product y MenuItem unificados para pedidos, POS y comandas
  const activeProductsAsMenuItems: MenuItem[] = React.useMemo(() => {
    const stationMap: Record<string, KitchenStation> = {
      'st-parrilla': 'parrilla',
      'st-bar-bebidas': 'bar_bebidas',
      'st-postres': 'postres',
      'st-cocina-fria': 'cocina_fria',
      'st-cocina-caliente': 'cocina_caliente',
    };

    // Mapear productos activos desde Módulo 03
    const mappedProducts: MenuItem[] = products
      .filter((p) => p.status === 'activo' && p.isAvailableForSale !== false)
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        categoryId: p.categoryId,
        price: p.price,
        station: stationMap[p.prepStationId] || 'cocina_caliente',
        prepTimeMinutes: p.prepTimeMinutes || 15,
        recipe: (p.recipe as any) || [],
        isAvailable: true,
        image: (p.images && p.images[0]) || '',
        sku: p.sku,
        images: p.images,
        branchId: p.branchId,
        prepStationId: p.prepStationId,
        isAvailableForSale: p.isAvailableForSale,
        isAvailableForDelivery: p.isAvailableForDelivery,
        isVisibleInMenu: p.isVisibleInMenu,
        status: p.status,
        variants: p.variants,
        modifierGroupIds: p.modifierGroupIds,
        isCombo: p.isCombo,
        comboConfig: p.comboConfig,
      }));

    // Combinar con menuItems evitando duplicados por id
    const existingIds = new Set(mappedProducts.map((m) => m.id));
    const extraMenuItems = menuItems.filter(
      (m) => !existingIds.has(m.id) && m.isAvailable !== false
    );

    return [...mappedProducts, ...extraMenuItems];
  }, [products, menuItems]);

  const activeCombinedCategories: MenuCategory[] = React.useMemo(() => {
    const mappedCatalog: MenuCategory[] = catalogCategories
      .filter((c) => c.isActive !== false)
      .map((c, idx) => ({
        id: c.id,
        name: c.name,
        order: c.order || idx + 1,
        icon: c.icon,
        isActive: c.isActive,
        isVisibleInMenu: c.isVisibleInMenu,
        description: c.description,
      }));

    const existingCatIds = new Set(mappedCatalog.map((c) => c.id));
    const extraCats = categories.filter((c) => !existingCatIds.has(c.id));

    return [...mappedCatalog, ...extraCats].sort((a, b) => a.order - b.order);
  }, [catalogCategories, categories]);

  return (
    <RestaurantContext.Provider
      value={{
        branches,
        currentBranch,
        setCurrentBranchId,
        userRole,
        setUserRole,
        staffName,
        setStaffName,
        isLoading,
        actionLoading,

        tables,
        areas,
        prepStations,
        auditLogs,
        orders,
        activeOrders,
        payments,
        comandas,
        activeComandas,
        inventory,
        inventoryMovements,
        productionLogs,
        activeShift,
        cashMovements,
        categories: activeCombinedCategories,
        menuItems: activeProductsAsMenuItems,

        // Módulo 03
        products,
        catalogCategories,
        modifierGroups,
        createProduct,
        updateProduct,
        deleteProduct,
        toggleProductStatus,
        createCategory,
        updateCategory,
        toggleCategoryActive,
        toggleCategoryVisibility,
        reorderCategories,
        createModifierGroup,
        updateModifierGroup,
        deleteModifierGroup,

        createArea,
        updateArea,
        toggleAreaActive,
        createTable,
        updateTable,
        setTableStatus,
        liberateTable,
        createPrepStation,
        updatePrepStation,
        togglePrepStationActive,
        logAuditAction,

        createOrder,
        addRoundToOrder,
        cancelOrder,
        updateComandaStatus,
        updateComandaItemStatus,
        closeAndPayOrder,
        updateOrderItems,
        openCashShift,
        addCashBase,
        updateCashBase,
        deleteCashBase,
        closeCashShift,
        addCashMovement,
        updateInventoryStock,
        createInventoryItem,
        produceInventoryItem,
        cancelProductionLog,
        updateTableStatus,

        // Módulo 11: Compras y Proveedores
        suppliers,
        purchases,
        expenses,
        supplierAdvances,
        purchasePayments,
        supplierAdvanceReintegros,
        createSupplier,
        updateSupplier,
        toggleSupplierStatus,
        createPurchase,
        createExpense,
        createSupplierAdvance,
        registerSupplierAdvanceReintegro,
        voidSupplierAdvance,
        addPurchasePayment,
        editPurchasePayment,
        voidPurchasePayment,
        cancelPurchase,

        // Módulo 12: Clientes y Fidelización
        customers,
        loyaltyTransactions,
        createCustomer,
        updateCustomer,
        toggleCustomerStatus,
        adjustCustomerPoints,

        // Módulos Separados, Cartera y Abonos
        separados,
        cartera,
        abonos,
        createSeparado,
        registerSeparadoAbono,
        sendSeparadoToKitchen,
        finalizeSeparado,
        cancelSeparado,
        createCarteraRecord,
        registerCarteraAbono,
        editAbono,
        voidAbono,

        // Medios de Pago
        paymentMethods,
        createPaymentMethod,
        updatePaymentMethod,
        deletePaymentMethod,
        togglePaymentMethodStatus,

        // Otros Ingresos
        otherIncomes,
        createOtherIncome,
        updateOtherIncome,
        voidOtherIncome,
        voidPayment,

        clearAllTransactionalRecords: async () => {
          if (actionLoading) throw new Error('Operación en proceso');
          setActionLoading(true);
          try {
            const collectionsToClear = [
              'orders',
              'comandas',
              'payments',
              'cashShifts',
              'cashMovements',
              'purchases',
              'supplierAdvances',
              'purchasePayments',
              'loyaltyTransactions',
              'separados',
              'cartera',
              'abonos',
              'other_incomes',
              'expenses',
              'auditLogs',
              'audit_logs',
              'inventoryMovements',
              'customers',
            ];

            for (const colName of collectionsToClear) {
              try {
                const snap = await getDocs(collection(db, colName));
                for (const d of snap.docs) {
                  await deleteDoc(doc(db, colName, d.id)).catch((delErr) => {
                    console.warn(`Error eliminando documento ${d.id} de ${colName}:`, delErr);
                  });
                }
              } catch (colErr) {
                console.warn(`No se pudo vaciar la colección ${colName}:`, colErr);
              }
            }

            // Cleanup obsolete branches leaving only sede-buga
            try {
              const branchesSnap = await getDocs(collection(db, 'branches'));
              for (const bDoc of branchesSnap.docs) {
                if (bDoc.id !== 'sede-buga') {
                  await deleteDoc(doc(db, 'branches', bDoc.id)).catch(() => {});
                }
              }
              // Ensure sede-buga is saved
              await setDoc(doc(db, 'branches', 'sede-buga'), {
                id: 'sede-buga',
                name: 'Sede Principal Buga',
                address: 'Cl. 4 # 13 - 28, Guadalajara de Buga, Valle del Cauca',
                phone: '+57 (602) 237-4589',
                isActive: true,
                orderPrefix: 'BUG-',
                createdAt: new Date().toISOString(),
              }, { merge: true });
            } catch (branchErr) {
              console.warn('Error regulando colección branches:', branchErr);
            }

            // Reset tables to 'libre' and ensure branchId is sede-buga
            try {
              const tablesSnap = await getDocs(collection(db, 'tables'));
              for (const tDoc of tablesSnap.docs) {
                await updateDoc(doc(db, 'tables', tDoc.id), {
                  branchId: 'sede-buga',
                  status: 'libre',
                  currentOrderId: null,
                  hasOpenTab: false,
                  currentBillAmount: 0,
                  assignedWaiterName: null,
                  openedAt: null,
                  updatedAt: new Date().toISOString(),
                }).catch(() => {});
              }
            } catch (tErr) {
              console.warn('Error restableciendo mesas:', tErr);
            }

            // Create initial active shift for Guadalajara de Buga
            const now = new Date().toISOString();
            const initialShiftId = `shift-sede-buga-${Date.now()}`;
            const initialShift: CashShift = {
              id: initialShiftId,
              branchId: 'sede-buga',
              cashierId: staffName,
              cashierName: staffName,
              openedAt: now,
              closedAt: null,
              initialCash: 500000,
              salesCash: 0,
              salesCard: 0,
              salesTransfer: 0,
              inflowCash: 0,
              outflowCash: 0,
              expectedCash: 500000,
              actualCash: null,
              difference: null,
              status: 'abierto',
              notes: 'Apertura de turno inicial para Guadalajara de Buga',
            };
            await setDoc(doc(db, 'cashShifts', initialShiftId), initialShift);

            // Audit log
            const auditRef = doc(collection(db, 'auditLogs'));
            await setDoc(auditRef, {
              id: auditRef.id,
              branchId: 'sede-buga',
              entityType: 'branch',
              entityId: 'sede-buga',
              entityName: 'Sede Guadalajara de Buga',
              action: 'delete',
              details: 'Limpieza de datos demo y registros de prueba completada con éxito',
              userId: staffName,
              userName: staffName,
              timestamp: now,
            });
          } catch (err: any) {
            console.error('Error clearing transactional records:', err);
            throw new Error(err.message || 'Error al limpiar los registros.');
          } finally {
            setActionLoading(false);
          }
        },
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
};

export const useRestaurant = () => {
  const context = useContext(RestaurantContext);
  if (!context) {
    throw new Error('useRestaurant debe usarse dentro de un RestaurantProvider');
  }
  return context;
};
