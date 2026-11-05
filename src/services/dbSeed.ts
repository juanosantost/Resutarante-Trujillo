import {
  collection,
  doc,
  getDocs,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Branch, Table, RestaurantArea, PrepStation, MenuCategory, MenuItem, InventoryItem, CashShift, DEFAULT_BRANCH_PRINT_CONFIG } from '../types';

export const INITIAL_BRANCHES: Branch[] = [
  {
    id: 'sede-buga',
    name: 'Sede Principal — Guadalajara de Buga',
    nit: '901.458.920-4',
    address: 'Cl. 4 # 13 - 28, Guadalajara de Buga',
    phone: '+57 (602) 237-4589',
    city: 'Guadalajara de Buga, Valle del Cauca',
    taxRate: 0.08, // Impoconsumo 8%
    isActive: true,
    status: 'activa',
    notes: 'Sede principal restaurante y barra con atención de mesas y domicilios.',
    receiptConfig: {
      headerText: 'SISTEMA COLMENA RESTAURANTE',
      footerText: '¡Gracias por su visita! Guadalajara de Buga. Propina voluntaria según Ley 1935 de 2018.',
      resolutionDian: 'Resolución DIAN No. 18764000129 de 2026',
      resolutionDate: '2026-01-15',
      prefix: 'BUG-',
      currentNumber: 101,
      showTax: true,
      showTip: true,
    },
    printConfig: DEFAULT_BRANCH_PRINT_CONFIG,
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_AREAS: RestaurantArea[] = [
  {
    id: 'area-salon-principal',
    branchId: 'sede-buga',
    name: 'Salón Principal',
    description: 'Área principal climatizada con ambiente Colmena clásico',
    order: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'area-terraza',
    branchId: 'sede-buga',
    name: 'Terraza Gourmet',
    description: 'Zona al aire libre con calentadores y vista a los Cerros',
    order: 2,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'area-vip',
    branchId: 'sede-buga',
    name: 'Segundo Piso VIP',
    description: 'Espacio exclusivo para eventos privados y reservas especiales',
    order: 3,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'area-barra',
    branchId: 'sede-buga',
    name: 'Barra & Cocteles',
    description: 'Servicio directo a barra para bebidas y piqueos',
    order: 4,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'area-exterior',
    branchId: 'sede-buga',
    name: 'Zona Exterior',
    description: 'Mesas pet-friendly en plazoleta frontal',
    order: 5,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_PREP_STATIONS: PrepStation[] = [
  {
    id: 'st-cocina-caliente',
    branchId: 'sede-buga',
    name: 'Cocina Caliente',
    code: 'COC_CAL',
    description: 'Platos fuertes de autor, salsas, reducciones y sopas tradicionales',
    order: 1,
    color: '#e11d48',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'st-parrilla',
    branchId: 'sede-buga',
    name: 'Parrilla & Brasas',
    code: 'PARRILLA',
    description: 'Cortes Angus, lomos sellados y hamburguesas artesanales',
    order: 2,
    color: '#ea580c',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'st-cocina-fria',
    branchId: 'sede-buga',
    name: 'Cocina Fría & Entradas',
    code: 'COC_FRIA',
    description: 'Ensaladas frescas, carpaccios, ceviches y tapas frías',
    order: 3,
    color: '#0284c7',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'st-bar-bebidas',
    branchId: 'sede-buga',
    name: 'Bebidas & Coctelería',
    code: 'BEB_COC',
    description: 'Cocteles signature, limonadas frappé, jugos naturales y cervezas',
    order: 4,
    color: '#d97706',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'st-postres',
    branchId: 'sede-buga',
    name: 'Postres & Repostería',
    code: 'POSTRES',
    description: 'Dulces con miel de abeja, volcán de chocolate y café especial',
    order: 5,
    color: '#db2777',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_TABLES: Table[] = [
  {
    id: 'tab-1',
    branchId: 'sede-buga',
    areaId: 'area-salon-principal',
    number: 1,
    name: 'Mesa 1',
    zone: 'Salón Principal',
    capacity: 4,
    status: 'libre',
    displayOrder: 1,
    isActive: true,
    hasOpenTab: false,
  },
  {
    id: 'tab-2',
    branchId: 'sede-buga',
    areaId: 'area-salon-principal',
    number: 2,
    name: 'Mesa 2',
    zone: 'Salón Principal',
    capacity: 2,
    status: 'libre',
    displayOrder: 2,
    isActive: true,
    hasOpenTab: false,
  },
  {
    id: 'tab-3',
    branchId: 'sede-buga',
    areaId: 'area-salon-principal',
    number: 3,
    name: 'Mesa 3',
    zone: 'Salón Principal',
    capacity: 6,
    status: 'libre',
    displayOrder: 3,
    isActive: true,
    hasOpenTab: false,
  },
  {
    id: 'tab-4',
    branchId: 'sede-buga',
    areaId: 'area-salon-principal',
    number: 4,
    name: 'Mesa 4',
    zone: 'Salón Principal',
    capacity: 4,
    status: 'libre',
    displayOrder: 4,
    isActive: true,
    hasOpenTab: false,
  },
  {
    id: 'tab-10',
    branchId: 'sede-buga',
    areaId: 'area-terraza',
    number: 10,
    name: 'Mesa Terraza 10',
    zone: 'Terraza Gourmet',
    capacity: 4,
    status: 'libre',
    displayOrder: 1,
    isActive: true,
    hasOpenTab: false,
  },
  {
    id: 'tab-11',
    branchId: 'sede-buga',
    areaId: 'area-terraza',
    number: 11,
    name: 'Mesa Terraza 11',
    zone: 'Terraza Gourmet',
    capacity: 4,
    status: 'libre',
    displayOrder: 2,
    isActive: true,
    hasOpenTab: false,
  },
  {
    id: 'tab-20',
    branchId: 'sede-buga',
    areaId: 'area-barra',
    number: 20,
    name: 'Barra Asiento 1',
    zone: 'Barra & Cocteles',
    capacity: 2,
    status: 'libre',
    displayOrder: 1,
    isActive: true,
    hasOpenTab: false,
  },
  {
    id: 'tab-21',
    branchId: 'sede-buga',
    areaId: 'area-barra',
    number: 21,
    name: 'Barra Asiento 2',
    zone: 'Barra & Cocteles',
    capacity: 2,
    status: 'libre',
    displayOrder: 2,
    isActive: true,
    hasOpenTab: false,
  },
  {
    id: 'tab-30',
    branchId: 'sede-buga',
    areaId: 'area-vip',
    number: 30,
    name: 'Mesa Presidencial VIP',
    zone: 'Segundo Piso VIP',
    capacity: 8,
    status: 'libre',
    displayOrder: 1,
    isActive: true,
    hasOpenTab: false,
  },
];

export const INITIAL_CATEGORIES: MenuCategory[] = [
  { id: 'cat-entradas', name: 'Entradas & Tapas', order: 1, icon: 'Soup' },
  { id: 'cat-parrilla', name: 'Parrilla & Cortes', order: 2, icon: 'Flame' },
  { id: 'cat-fuertes', name: 'Platos Fuertes de Autor', order: 3, icon: 'UtensilsCrossed' },
  { id: 'cat-bebidas', name: 'Bebidas & Coctelería', order: 4, icon: 'Wine' },
  { id: 'cat-postres', name: 'Postres & Dulce Colmena', order: 5, icon: 'Cake' },
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  { id: 'inv-carne-angus', branchId: 'sede-buga', name: 'Carne Angus Madurada (g)', unit: 'g', currentStock: 8500, minStock: 2000, costPerUnit: 48, updatedAt: new Date().toISOString() },
  { id: 'inv-lomo-fino', branchId: 'sede-buga', name: 'Lomo Fino de Res (g)', unit: 'g', currentStock: 6200, minStock: 1500, costPerUnit: 55, updatedAt: new Date().toISOString() },
  { id: 'inv-pechuga-pollo', branchId: 'sede-buga', name: 'Pechuga de Pollo Fresca (g)', unit: 'g', currentStock: 9000, minStock: 2500, costPerUnit: 24, updatedAt: new Date().toISOString() },
  { id: 'inv-costilla-cerdo', branchId: 'sede-buga', name: 'Costilla de Cerdo Ahumada (g)', unit: 'g', currentStock: 7400, minStock: 2000, costPerUnit: 36, updatedAt: new Date().toISOString() },
  { id: 'inv-pan-brioche', branchId: 'sede-buga', name: 'Pan Brioche Artesanal', unit: 'und', currentStock: 48, minStock: 15, costPerUnit: 2200, updatedAt: new Date().toISOString() },
  { id: 'inv-queso-cheddar', branchId: 'sede-buga', name: 'Queso Cheddar Madurado (g)', unit: 'g', currentStock: 3200, minStock: 800, costPerUnit: 32, updatedAt: new Date().toISOString() },
  { id: 'inv-miel-colmena', branchId: 'sede-buga', name: 'Miel Pura de Abejas Colmena (g)', unit: 'g', currentStock: 4500, minStock: 1000, costPerUnit: 28, updatedAt: new Date().toISOString() },
  { id: 'inv-papa-criolla', branchId: 'sede-buga', name: 'Papa Criolla Limpia (g)', unit: 'g', currentStock: 12000, minStock: 3000, costPerUnit: 8, updatedAt: new Date().toISOString() },
  { id: 'inv-leche-coco', branchId: 'sede-buga', name: 'Leche de Coco Natural (ml)', unit: 'ml', currentStock: 5000, minStock: 1200, costPerUnit: 14, updatedAt: new Date().toISOString() },
  { id: 'inv-cerveza-mestiza', branchId: 'sede-buga', name: 'Cerveza Mestiza Dorada 330ml', unit: 'und', currentStock: 64, minStock: 20, costPerUnit: 6200, updatedAt: new Date().toISOString() },
  { id: 'inv-chocolate-70', branchId: 'sede-buga', name: 'Chocolate 70% Santander (g)', unit: 'g', currentStock: 2800, minStock: 600, costPerUnit: 42, updatedAt: new Date().toISOString() },
];

export const INITIAL_MENU_ITEMS: MenuItem[] = [
  {
    id: 'prod-burger-colmena',
    name: 'Hamburguesa Colmena Signature',
    description: '200g carne Angus, queso cheddar fundido, tocineta confitada en miel de abejas y pan brioche artesanal con papas rústicas.',
    categoryId: 'cat-parrilla',
    price: 36000,
    station: 'parrilla',
    prepTimeMinutes: 18,
    isAvailable: true,
    recipe: [
      { inventoryItemId: 'inv-carne-angus', name: 'Carne Angus Madurada (g)', quantity: 200, unit: 'g' },
      { inventoryItemId: 'inv-pan-brioche', name: 'Pan Brioche Artesanal', quantity: 1, unit: 'und' },
      { inventoryItemId: 'inv-queso-cheddar', name: 'Queso Cheddar Madurado (g)', quantity: 40, unit: 'g' },
      { inventoryItemId: 'inv-miel-colmena', name: 'Miel Pura de Abejas Colmena (g)', quantity: 25, unit: 'g' },
      { inventoryItemId: 'inv-papa-criolla', name: 'Papa Criolla Limpia (g)', quantity: 150, unit: 'g' },
    ],
  },
  {
    id: 'prod-lomo-trapo',
    name: 'Lomo al Trapo en Reducción de Café',
    description: '300g de lomo fino sellado en tela y sal marina, bañado con mantequilla de café colombiano y puré de papa criolla.',
    categoryId: 'cat-parrilla',
    price: 52000,
    station: 'parrilla',
    prepTimeMinutes: 22,
    isAvailable: true,
    recipe: [
      { inventoryItemId: 'inv-lomo-fino', name: 'Lomo Fino de Res (g)', quantity: 300, unit: 'g' },
      { inventoryItemId: 'inv-papa-criolla', name: 'Papa Criolla Limpia (g)', quantity: 180, unit: 'g' },
    ],
  },
  {
    id: 'prod-ajiaco-colmena',
    name: 'Ajiaco Santafereño de la Casa',
    description: 'Tradicional receta bogotana con pechuga desmechada, tres variedades de papa criolla, mazorca tierna, alcaparras y crema agria.',
    categoryId: 'cat-fuertes',
    price: 38000,
    station: 'cocina_caliente',
    prepTimeMinutes: 15,
    isAvailable: true,
    recipe: [
      { inventoryItemId: 'inv-pechuga-pollo', name: 'Pechuga de Pollo Fresca (g)', quantity: 250, unit: 'g' },
      { inventoryItemId: 'inv-papa-criolla', name: 'Papa Criolla Limpia (g)', quantity: 220, unit: 'g' },
    ],
  },
  {
    id: 'prod-picada-gourmet',
    name: 'Picada Gourmet Colmena (2 personas)',
    description: 'Cortes de Angus, pechuga a la brasa, costilla ahumada en miel de panela, papas criollas doradas y arepitas de choclo.',
    categoryId: 'cat-fuertes',
    price: 68000,
    station: 'parrilla',
    prepTimeMinutes: 25,
    isAvailable: true,
    recipe: [
      { inventoryItemId: 'inv-carne-angus', name: 'Carne Angus Madurada (g)', quantity: 150, unit: 'g' },
      { inventoryItemId: 'inv-pechuga-pollo', name: 'Pechuga de Pollo Fresca (g)', quantity: 150, unit: 'g' },
      { inventoryItemId: 'inv-costilla-cerdo', name: 'Costilla de Cerdo Ahumada (g)', quantity: 200, unit: 'g' },
      { inventoryItemId: 'inv-papa-criolla', name: 'Papa Criolla Limpia (g)', quantity: 250, unit: 'g' },
      { inventoryItemId: 'inv-miel-colmena', name: 'Miel Pura de Abejas Colmena (g)', quantity: 30, unit: 'g' },
    ],
  },
  {
    id: 'prod-limonada-coco',
    name: 'Limonada de Coco Colmena Frappé',
    description: 'Exquisita leche de coco natural, zumo de limones criollos y toque de miel dorada.',
    categoryId: 'cat-bebidas',
    price: 15000,
    station: 'bar_bebidas',
    prepTimeMinutes: 6,
    isAvailable: true,
    recipe: [
      { inventoryItemId: 'inv-leche-coco', name: 'Leche de Coco Natural (ml)', quantity: 160, unit: 'ml' },
      { inventoryItemId: 'inv-miel-colmena', name: 'Miel Pura de Abejas Colmena (g)', quantity: 25, unit: 'g' },
    ],
  },
  {
    id: 'prod-cerveza-mestiza',
    name: 'Cerveza Mestiza Dorada Artesanal (330ml)',
    description: 'Cerveza rubia colombiana con notas a miel y malta tostada.',
    categoryId: 'cat-bebidas',
    price: 14000,
    station: 'bar_bebidas',
    prepTimeMinutes: 2,
    isAvailable: true,
    recipe: [
      { inventoryItemId: 'inv-cerveza-mestiza', name: 'Cerveza Mestiza Dorada 330ml', quantity: 1, unit: 'und' },
    ],
  },
  {
    id: 'prod-volcan-chocolate',
    name: 'Volcán de Chocolate con Miel de Abejas',
    description: 'Bizcocho tibio de chocolate amargo 70% con corazón líquido, crocante de panal y helado artesanal.',
    categoryId: 'cat-postres',
    price: 22000,
    station: 'postres',
    prepTimeMinutes: 12,
    isAvailable: true,
    recipe: [
      { inventoryItemId: 'inv-chocolate-70', name: 'Chocolate 70% Santander (g)', quantity: 70, unit: 'g' },
      { inventoryItemId: 'inv-miel-colmena', name: 'Miel Pura de Abejas Colmena (g)', quantity: 20, unit: 'g' },
    ],
  },
];

export async function checkAndSeedInitialData() {
  try {
    const branchesRef = collection(db, 'branches');
    const branchSnap = await getDocs(branchesRef);

    if (branchSnap.empty) {
      console.log('Seeding initial Sistema Colmena branch...');
      for (const branch of INITIAL_BRANCHES) {
        await setDoc(doc(db, 'branches', branch.id), branch);
      }
    }

    // 2. Seed menu categories si está vacío
    const menuCatRef = collection(db, 'menuCategories');
    const menuCatSnap = await getDocs(menuCatRef);
    if (menuCatSnap.empty) {
      console.log('Seeding initial Menu Categories...');
      for (const cat of INITIAL_CATEGORIES) {
        await setDoc(doc(db, 'menuCategories', cat.id), cat);
      }
    }

    // 3. Seed menu items si está vacío
    const menuItemsRef = collection(db, 'menuItems');
    const menuItemsSnap = await getDocs(menuItemsRef);
    if (menuItemsSnap.empty) {
      console.log('Seeding initial Menu Items...');
      for (const item of INITIAL_MENU_ITEMS) {
        await setDoc(doc(db, 'menuItems', item.id), item);
      }
    }

    // 4. Seed inventory items si está vacío
    const invRef = collection(db, 'inventoryItems');
    const invSnap = await getDocs(invRef);
    if (invSnap.empty) {
      console.log('Seeding initial Inventory Items...');
      for (const inv of INITIAL_INVENTORY) {
        await setDoc(doc(db, 'inventoryItems', inv.id), inv);
      }
    }

    // Módulo 02: Seed Áreas si no existen
    const areasRef = collection(db, 'areas');
    const areasSnap = await getDocs(areasRef);
    if (areasSnap.empty) {
      console.log('Seeding initial Restaurant Areas...');
      for (const area of INITIAL_AREAS) {
        await setDoc(doc(db, 'areas', area.id), area);
      }
    }

    // Módulo 02: Seed Estaciones Operativas si no existen
    const prepStationsRef = collection(db, 'prepStations');
    const prepStationsSnap = await getDocs(prepStationsRef);
    if (prepStationsSnap.empty) {
      console.log('Seeding initial Prep Stations...');
      for (const st of INITIAL_PREP_STATIONS) {
        await setDoc(doc(db, 'prepStations', st.id), st);
      }
    }

    // Módulo 02: Seed o actualizar Mesas con areaId y campos completos
    const tablesRef = collection(db, 'tables');
    const tablesSnap = await getDocs(tablesRef);
    if (tablesSnap.empty) {
      console.log('Seeding initial Tables...');
      for (const table of INITIAL_TABLES) {
        await setDoc(doc(db, 'tables', table.id), {
          ...table,
          currentOrderId: null,
          hasOpenTab: false,
          currentBillAmount: 0,
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      // Migrar mesas existentes que no tengan areaId
      for (const tableDoc of tablesSnap.docs) {
        const data = tableDoc.data();
        if (!data.areaId) {
          const matchingArea = INITIAL_AREAS.find((a) => a.name === data.zone) || INITIAL_AREAS[0];
          await setDoc(
            doc(db, 'tables', tableDoc.id),
            {
              areaId: matchingArea.id,
              name: data.name || `Mesa ${data.number}`,
              displayOrder: data.displayOrder || data.number,
              isActive: data.isActive !== undefined ? data.isActive : true,
              hasOpenTab: data.hasOpenTab || Boolean(data.currentOrderId),
              currentBillAmount: data.currentBillAmount || 0,
            },
            { merge: true }
          );
        }
      }
    }

    // Módulo 03: Seed Categorías del Menú Gastronómico si no existen
    const categoriesRef = collection(db, 'categories');
    const categoriesSnap = await getDocs(categoriesRef);
    if (categoriesSnap.empty) {
      console.log('Seeding initial Módulo 03 Product Categories...');
      const { INITIAL_PRODUCT_CATEGORIES } = await import('./catalogSeed');
      for (const cat of INITIAL_PRODUCT_CATEGORIES) {
        await setDoc(doc(db, 'categories', cat.id), cat);
      }
    }

    // Módulo 03: Seed Grupos de Modificadores y Adicionales
    const modGroupsRef = collection(db, 'modifierGroups');
    const modGroupsSnap = await getDocs(modGroupsRef);
    if (modGroupsSnap.empty) {
      console.log('Seeding initial Módulo 03 Modifier Groups...');
      const { INITIAL_MODIFIER_GROUPS } = await import('./catalogSeed');
      for (const group of INITIAL_MODIFIER_GROUPS) {
        await setDoc(doc(db, 'modifierGroups', group.id), group);
      }
    }

    // Módulo 03: Seed Productos con Variantes y Combos
    const productsRef = collection(db, 'products');
    const productsSnap = await getDocs(productsRef);
    if (productsSnap.empty) {
      console.log('Seeding initial Módulo 03 Products & Combos...');
      const { INITIAL_PRODUCTS } = await import('./catalogSeed');
      for (const prod of INITIAL_PRODUCTS) {
        await setDoc(doc(db, 'products', prod.id), prod);
        // También sincronizar con menuItems para compatibilidad con pedidos previos
        await setDoc(
          doc(db, 'menuItems', prod.id),
          {
            id: prod.id,
            name: prod.name,
            description: prod.description,
            categoryId: prod.categoryId,
            price: prod.price,
            station:
              prod.prepStationId === 'st-parrilla'
                ? 'parrilla'
                : prod.prepStationId === 'st-bar-bebidas'
                ? 'bar_bebidas'
                : prod.prepStationId === 'st-postres'
                ? 'postres'
                : 'cocina_caliente',
            prepTimeMinutes: prod.prepTimeMinutes,
            recipe: [],
            isAvailable: prod.isAvailableForSale && prod.status === 'activo',
            image: prod.images?.[0] || '',
            sku: prod.sku,
            branchId: prod.branchId,
            prepStationId: prod.prepStationId,
            variants: prod.variants || [],
            isCombo: Boolean(prod.isCombo),
            comboConfig: prod.comboConfig || null,
          },
          { merge: true }
        );
      }
    }

    // Seed de Clientes de prueba
    const customersRef = collection(db, 'customers');
    const custSnap = await getDocs(customersRef);
    if (custSnap.empty) {
      console.log('Seeding initial Customers...');
      const sampleCustomers = [
        {
          id: 'cust-buga-01',
          branchId: 'all',
          documentType: 'CC',
          documentNumber: '1114567890',
          name: 'Carlos Alberto Gómez Restrepo',
          phoneCountryCode: '+57',
          phoneNumber: '3154567890',
          phone: '+57 3154567890',
          address: 'Cra. 14 # 5 - 42',
          neighborhood: 'El Albergue',
          observations: 'Cliente corporativo frecuente y organizador de eventos',
          status: 'activo',
          loyaltyPoints: 120,
          totalSpent: 420000,
          visitsCount: 4,
          consent: {
            dataProcessingAuthorized: true,
            marketingAuthorized: true,
            authorizedAt: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
        },
        {
          id: 'cust-buga-02',
          branchId: 'all',
          documentType: 'NIT',
          documentNumber: '901.324.555-1',
          name: 'Inversiones y Eventos del Valle SAS',
          phoneCountryCode: '+57',
          phoneNumber: '3187654321',
          phone: '+57 3187654321',
          address: 'Cl. 7 # 12 - 18',
          neighborhood: 'Centro Histórico',
          observations: 'Empresa aliada. Facturación mensual y línea de crédito',
          status: 'activo',
          loyaltyPoints: 350,
          totalSpent: 1250000,
          visitsCount: 8,
          consent: {
            dataProcessingAuthorized: true,
            marketingAuthorized: true,
            authorizedAt: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
        },
        {
          id: 'cust-buga-03',
          branchId: 'all',
          documentType: 'CC',
          documentNumber: '31890123',
          name: 'Mariana Sofía Pérez Valencia',
          phoneCountryCode: '+57',
          phoneNumber: '3123456789',
          phone: '+57 3123456789',
          address: 'Av. Alejandro Cabal # 18 - 30',
          neighborhood: 'Santa Bárbara',
          observations: 'Cumpleaños en mayo. Prefiere mesas en terraza',
          status: 'activo',
          loyaltyPoints: 60,
          totalSpent: 185000,
          visitsCount: 2,
          consent: {
            dataProcessingAuthorized: true,
            marketingAuthorized: true,
            authorizedAt: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
        },
      ];

      for (const cust of sampleCustomers) {
        await setDoc(doc(db, 'customers', cust.id), cust);
      }
    }

    // Seed de Separados iniciales
    const sepRef = collection(db, 'separados');
    const sepSnap = await getDocs(sepRef);
    if (sepSnap.empty) {
      console.log('Seeding initial Separados...');
      const sampleSeparado = {
        id: 'sep-buga-101',
        code: 'SEP-1001',
        branchId: 'sede-buga',
        customerId: 'cust-buga-01',
        customerName: 'Carlos Alberto Gómez Restrepo',
        customerPhone: '+57 3154567890',
        customerDocument: '1114567890',
        customerAddress: 'Cra. 14 # 5 - 42, El Albergue',
        items: [
          {
            id: 'item-sep-1',
            menuItemId: 'prod-01',
            name: 'Hamburguesa Doble Colmena Especial',
            quantity: 20,
            unitPrice: 28000,
            totalPrice: 560000,
            notes: 'Sin cebolla para 5 unidades',
          },
          {
            id: 'item-sep-2',
            menuItemId: 'prod-02',
            name: 'Limonada de Coco Natural',
            quantity: 20,
            unitPrice: 9000,
            totalPrice: 180000,
            notes: 'En vasos biodegradables con pitillo',
          },
        ],
        totalAmount: 740000,
        initialDeposit: 250000,
        totalAbonado: 250000,
        pendingBalance: 490000,
        deliveryDate: '2026-03-25',
        deliveryTime: '13:00',
        reserveInventory: true,
        inventoryReserved: true,
        sentToKitchen: false,
        status: 'activo',
        deliveryStatus: 'pendiente',
        notes: 'Reserva para almuerzo institucional de 20 personas en Buga.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'Juan Administrador',
      };
      await setDoc(doc(db, 'separados', sampleSeparado.id), sampleSeparado);

      // Registrar el abono del anticipo
      await setDoc(doc(db, 'abonos', 'abn-init-sep-101'), {
        id: 'abn-init-sep-101',
        parentId: sampleSeparado.id,
        parentType: 'separado',
        receiptNumber: 'ABN-1001',
        branchId: 'sede-buga',
        customerId: sampleSeparado.customerId,
        customerName: sampleSeparado.customerName,
        customerDocument: sampleSeparado.customerDocument,
        customerPhone: sampleSeparado.customerPhone,
        amount: 250000,
        paymentMethod: 'transferencia',
        notes: 'Anticipo inicial del 35% recibido por transferencia Bancolombia',
        userId: 'Juan Administrador',
        userName: 'Juan Administrador',
        status: 'activo',
        createdAt: new Date().toISOString(),
      });
    }

    // Seed de Cartera inicial
    const crdRef = collection(db, 'cartera');
    const crdSnap = await getDocs(crdRef);
    if (crdSnap.empty) {
      console.log('Seeding initial Cartera...');
      const sampleCartera = {
        id: 'crd-buga-201',
        code: 'CRD-1001',
        saleId: 'ord-hist-901',
        orderNumber: 901,
        branchId: 'sede-buga',
        customerId: 'cust-buga-02',
        customerName: 'Inversiones y Eventos del Valle SAS',
        customerPhone: '+57 3187654321',
        customerDocument: '901.324.555-1',
        customerAddress: 'Cl. 7 # 12 - 18, Centro Histórico',
        totalAmount: 580000,
        initialPayment: 180000,
        totalAbonado: 180000,
        balanceDue: 400000,
        dueDate: '2026-03-30',
        status: 'vigente',
        notes: 'Crédito a 30 días para evento empresarial de cierre de mes.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'Juan Administrador',
      };
      await setDoc(doc(db, 'cartera', sampleCartera.id), sampleCartera);

      // Seed de Cartera inicial
      await setDoc(doc(db, 'abonos', 'abn-init-crd-201'), {
        id: 'abn-init-crd-201',
        parentId: sampleCartera.id,
        parentType: 'cartera',
        receiptNumber: 'ABN-2001',
        branchId: 'sede-buga',
        customerId: sampleCartera.customerId,
        customerName: sampleCartera.customerName,
        customerDocument: sampleCartera.customerDocument,
        customerPhone: sampleCartera.customerPhone,
        amount: 180000,
        paymentMethod: 'transferencia',
        notes: 'Pago inicial pactado al momento de la entrega',
        userId: 'Juan Administrador',
        userName: 'Juan Administrador',
        status: 'activo',
        createdAt: new Date().toISOString(),
      });
    }

    // Seed de Proveedores, Compras, Anticipos y Cuentas por Pagar
    const supRef = collection(db, 'suppliers');
    const supSnap = await getDocs(supRef);
    if (supSnap.empty) {
      console.log('Seeding initial Suppliers, Advances and Payables...');
      
      const sup1 = {
        id: 'sup-buga-01',
        branchId: 'all',
        documentType: 'NIT',
        documentNumber: '901.458.920-1',
        document: 'NIT 901.458.920-1',
        name: 'Distribuidora Avícola y Carnes del Valle SAS',
        phoneCountryCode: '+57',
        phoneNumber: '3158889900',
        phone: '+57 3158889900',
        address: 'Cl. 4 # 18 - 20, Guadalajara de Buga',
        email: 'ventas@avicoladelvalle.com.co',
        observations: 'Proveedor principal de pechuga, carne molida y chorizos artesanales.',
        status: 'activo',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'suppliers', sup1.id), sup1);

      const sup2 = {
        id: 'sup-buga-02',
        branchId: 'all',
        documentType: 'NIT',
        documentNumber: '800.123.456-8',
        document: 'NIT 800.123.456-8',
        name: 'Lácteos & Quesos de la Sabana Ltda',
        phoneCountryCode: '+57',
        phoneNumber: '3125554433',
        phone: '+57 3125554433',
        address: 'Av. Alejandro Cabal # 12 - 40',
        email: 'pedidos@lacteossabana.com',
        observations: 'Queso doble crema, crema de leche y mantequilla.',
        status: 'activo',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'suppliers', sup2.id), sup2);

      // Seed Anticipo
      const adv1 = {
        id: 'adv-buga-101',
        receiptNumber: 'ANT-1001',
        branchId: 'sede-buga',
        supplierId: 'sup-buga-01',
        supplierName: 'Distribuidora Avícola y Carnes del Valle SAS',
        amount: 300000,
        originalAmount: 300000,
        appliedAmount: 100000,
        reintegratedAmount: 0,
        availableBalance: 200000,
        balance: 200000,
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'transferencia',
        observations: 'Anticipo para reserva de lote semanal de pechuga deshuesada',
        status: 'parcialmente_aplicado',
        userId: 'Juan Administrador',
        userName: 'Juan Administrador',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'supplierAdvances', adv1.id), adv1);

      // Seed Compra a Crédito con Pago Parcial
      const pur1 = {
        id: 'pur-buga-501',
        branchId: 'sede-buga',
        supplierId: 'sup-buga-01',
        supplierName: 'Distribuidora Avícola y Carnes del Valle SAS',
        date: new Date().toISOString().split('T')[0],
        documentNumber: 'FAC-8890',
        items: [
          {
            ingredientId: 'inv-01',
            ingredientName: 'Carne de Res Molida Especial',
            quantity: 25,
            unit: 'kg',
            unitCost: 14000,
            total: 350000,
          },
          {
            ingredientId: 'inv-02',
            ingredientName: 'Pechuga de Pollo Deshuesada',
            quantity: 40,
            unit: 'kg',
            unitCost: 12500,
            total: 500000,
          },
        ],
        subtotal: 714286,
        tax: 135714,
        total: 850000,
        paymentMethod: 'credito',
        paymentStatus: 'parcial',
        amountPaid: 350000,
        balanceDue: 500000,
        observations: 'Compra de insumos cárnicos para el fin de semana. Pago $250k efectivo + $100k anticipo ANT-1001.',
        status: 'confirmada',
        userId: 'Juan Administrador',
        userName: 'Juan Administrador',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'purchases', pur1.id), pur1);

      // Payments for purchase
      await setDoc(doc(db, 'purchasePayments', 'pay-buga-701'), {
        id: 'pay-buga-701',
        receiptNumber: 'PAG-1001',
        branchId: 'sede-buga',
        purchaseId: 'pur-buga-501',
        supplierId: 'sup-buga-01',
        supplierName: 'Distribuidora Avícola y Carnes del Valle SAS',
        amount: 250000,
        paymentMethod: 'efectivo',
        type: 'pago_real',
        status: 'activo',
        notes: 'Pago inicial parcial al recibir la mercancía en caja',
        date: new Date().toISOString(),
        userId: 'Juan Administrador',
        userName: 'Juan Administrador',
        createdAt: new Date().toISOString(),
      });

      await setDoc(doc(db, 'purchasePayments', 'pay-buga-702'), {
        id: 'pay-buga-702',
        receiptNumber: 'PAG-1002',
        branchId: 'sede-buga',
        purchaseId: 'pur-buga-501',
        supplierId: 'sup-buga-01',
        supplierName: 'Distribuidora Avícola y Carnes del Valle SAS',
        amount: 100000,
        paymentMethod: 'transferencia',
        type: 'aplicacion_anticipo',
        advanceId: 'adv-buga-101',
        status: 'activo',
        notes: 'Abono aplicado desde anticipo #ANT-1001',
        date: new Date().toISOString(),
        userId: 'Juan Administrador',
        userName: 'Juan Administrador',
        createdAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error seeding data:', error);
    handleFirestoreError(error, OperationType.WRITE, 'seed_data');
  }
}
