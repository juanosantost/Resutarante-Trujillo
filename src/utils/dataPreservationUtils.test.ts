import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldSeedFromSnapshot,
  shouldRunInitialDatabaseSeed,
  preserveBranchDocumentFromFirestore,
  normalizeDailyMenuGroupsForModal,
  reconcileSessionUserWithFirestore,
  buildDailyMenuAuditSummary,
  FixedCategoryMeta,
} from './dataPreservationUtils';
import { ColmenaUser, DEFAULT_BRANCH_PRINT_CONFIG, ModifierGroup } from '../types';

const SAMPLE_META: FixedCategoryMeta[] = [
  { id: 'grp-sopa', name: 'Sopa', defaultDiscount: 2000, description: 'Sopas del día' },
  { id: 'grp-carne', name: 'Carne', defaultDiscount: 6000, description: 'Proteínas' },
  { id: 'grp-acomp2', name: 'Acompañamiento 2', defaultDiscount: 1000, description: 'Acomp 2' },
];

const SAMPLE_FALLBACK: ModifierGroup[] = [
  {
    id: 'grp-sopa',
    name: 'Sopa',
    selectionType: 'single',
    minSelections: 0,
    maxSelections: 1,
    isRequired: false,
    isActive: true,
    order: 1,
    noSelectionDiscount: 2000,
    options: [{ id: 'opt-default-sopa', name: 'Sopa de Pastas Casera', priceSurcharge: 0, isActive: true, isDefault: true }],
  },
  {
    id: 'grp-carne',
    name: 'Carne',
    selectionType: 'single',
    minSelections: 0,
    maxSelections: 1,
    isRequired: false,
    isActive: true,
    order: 2,
    noSelectionDiscount: 6000,
    options: [{ id: 'opt-default-carne', name: 'Pechuga a la Plancha', priceSurcharge: 0, isActive: true, isDefault: true }],
  },
  {
    id: 'grp-acomp2',
    name: 'Acompañamiento 2',
    selectionType: 'single',
    minSelections: 0,
    maxSelections: 1,
    isRequired: false,
    isActive: true,
    order: 3,
    noSelectionDiscount: 1000,
    options: [{ id: 'opt-default-acomp2', name: 'Tajadas de Maduro', priceSurcharge: 0, isActive: true, isDefault: true }],
  },
];

describe('shouldSeedFromSnapshot', () => {
  it('blocks seeding when snapshot comes from local cache even if empty', () => {
    assert.equal(shouldSeedFromSnapshot({ isEmpty: true, fromCache: true }), false);
  });

  it('blocks seeding when snapshot is not empty', () => {
    assert.equal(shouldSeedFromSnapshot({ isEmpty: false, fromCache: false }), false);
  });

  it('blocks seeding when snapshot has pending local writes', () => {
    assert.equal(
      shouldSeedFromSnapshot({ isEmpty: true, fromCache: false, hasPendingWrites: true }),
      false
    );
  });

  it('allows seeding only when server snapshot is definitively empty', () => {
    assert.equal(shouldSeedFromSnapshot({ isEmpty: true, fromCache: false }), true);
  });
});

describe('normalizeDailyMenuGroupsForModal', () => {
  it('preserves user custom options and intentionally empty groups without injecting defaults', () => {
    const savedGroups: ModifierGroup[] = [
      {
        id: 'grp-sopa',
        name: 'Sopa',
        selectionType: 'single',
        minSelections: 0,
        maxSelections: 1,
        isRequired: false,
        isActive: true,
        order: 1,
        noSelectionDiscount: 2000,
        options: [{ id: 'opt-sopa', name: 'Sopa', priceSurcharge: 0, isActive: true, isDefault: true }],
      },
      {
        id: 'grp-carne',
        name: 'Carne',
        selectionType: 'single',
        minSelections: 0,
        maxSelections: 1,
        isRequired: false,
        isActive: true,
        order: 2,
        noSelectionDiscount: 6000,
        options: [
          { id: 'opt-filete', name: 'Filete de Pollo', priceSurcharge: 0, isActive: true, isDefault: true },
          { id: 'opt-chicharron', name: 'Chicharrón', priceSurcharge: 0, isActive: true, isDefault: false },
        ],
      },
      {
        id: 'grp-acomp2',
        name: 'Acompañamiento 2',
        selectionType: 'single',
        minSelections: 0,
        maxSelections: 1,
        isRequired: false,
        isActive: true,
        order: 3,
        noSelectionDiscount: 1000,
        options: [],
      },
    ];

    const normalized = normalizeDailyMenuGroupsForModal(savedGroups, SAMPLE_META, SAMPLE_FALLBACK);
    assert.equal(normalized.length, 3);
    assert.deepEqual(normalized[0].options.map((o) => o.name), ['Sopa']);
    assert.deepEqual(normalized[1].options.map((o) => o.name), ['Filete de Pollo', 'Chicharrón']);
    // Empty group must stay empty and NOT pull Tajadas de Maduro from fallback
    assert.deepEqual(normalized[2].options, []);
  });

  it('does not pull fallback options for a group omitted from a saved featureGroups array', () => {
    const savedPartial: ModifierGroup[] = [
      {
        id: 'grp-sopa',
        name: 'Sopa',
        selectionType: 'single',
        minSelections: 0,
        maxSelections: 1,
        isRequired: false,
        isActive: true,
        order: 1,
        noSelectionDiscount: 2000,
        options: [{ id: 'opt-sopa', name: 'Sopa', priceSurcharge: 0, isActive: true, isDefault: true }],
      },
    ];
    const normalized = normalizeDailyMenuGroupsForModal(savedPartial, SAMPLE_META, SAMPLE_FALLBACK);
    assert.deepEqual(normalized[1].options, []);
    assert.deepEqual(normalized[2].options, []);
  });

  it('uses fallback groups only when existingGroups is undefined', () => {
    const normalized = normalizeDailyMenuGroupsForModal(undefined, SAMPLE_META, SAMPLE_FALLBACK);
    assert.deepEqual(normalized[0].options.map((o) => o.name), ['Sopa de Pastas Casera']);
    assert.deepEqual(normalized[1].options.map((o) => o.name), ['Pechuga a la Plancha']);
  });
});

describe('reconcileSessionUserWithFirestore', () => {
  const realAdmin: ColmenaUser = {
    id: 'usr-admin-principal',
    firebaseUid: 'admin-seed-uid',
    fullName: 'Juan David Santos Tamayo',
    documentNumber: '1115069269',
    email: 'juan.santos.ieci@gmail.com',
    role: 'administrador',
    authorizedBranchIds: ['sede-buga'],
    isActive: true,
    phone: '31546040990',
    createdAt: '2026-11-25T20:31:41.754Z',
  };

  it('replaces stale cached placeholder session user with live Firestore admin by id', () => {
    const staleSession: ColmenaUser = {
      ...realAdmin,
      fullName: 'Juan Carlos Gómez (Super Admin)',
      documentNumber: '1020304050',
      phone: '3001234567',
    };

    const reconciled = reconcileSessionUserWithFirestore(staleSession, [realAdmin]);
    assert.equal(reconciled?.fullName, 'Juan David Santos Tamayo');
    assert.equal(reconciled?.documentNumber, '1115069269');
    assert.equal(reconciled?.phone, '31546040990');
  });

  it('matches by email if ids differ', () => {
    const staleByEmail: ColmenaUser = {
      ...realAdmin,
      id: 'some-other-uid',
      fullName: 'Juan Carlos Gómez',
    };

    const reconciled = reconcileSessionUserWithFirestore(staleByEmail, [realAdmin]);
    assert.equal(reconciled?.id, 'usr-admin-principal');
    assert.equal(reconciled?.fullName, 'Juan David Santos Tamayo');
  });

  it('returns null when sessionUser is null', () => {
    assert.equal(reconcileSessionUserWithFirestore(null, [realAdmin]), null);
  });
});

describe('buildDailyMenuAuditSummary', () => {
  it('includes configured option names per group for future traceability', () => {
    const summary = buildDailyMenuAuditSummary({
      name: 'Menú del Día',
      price: 16000,
      isVisible: true,
      featureGroups: [
        {
          id: 'grp-carne',
          name: 'Carne',
          selectionType: 'single',
          minSelections: 0,
          maxSelections: 1,
          isRequired: false,
          isActive: true,
          order: 1,
          options: [
            { id: '1', name: 'Filete de Pollo', priceSurcharge: 0, isActive: true },
            { id: '2', name: 'Chicharrón', priceSurcharge: 0, isActive: true },
            { id: '3', name: 'Oculta', priceSurcharge: 0, isActive: false },
          ],
        },
      ],
    });
    assert.ok(summary.includes('Filete de Pollo'));
    assert.ok(summary.includes('Chicharrón'));
    assert.ok(!summary.includes('Oculta'));
  });
});

describe('shouldRunInitialDatabaseSeed', () => {
  it('blocks seeding when server is unreachable', () => {
    assert.equal(
      shouldRunInitialDatabaseSeed({
        serverReachable: false,
        markerExists: false,
        existingCoreCounts: { branches: 0, users: 0, products: 0, orders: 0 },
      }),
      false
    );
  });

  it('blocks seeding permanently once db_initialized marker exists', () => {
    assert.equal(
      shouldRunInitialDatabaseSeed({
        serverReachable: true,
        markerExists: true,
        existingCoreCounts: { branches: 0, users: 0, products: 0, orders: 0 },
      }),
      false
    );
  });

  it('blocks seeding when ANY real data already exists on server (branches, users, products, or orders)', () => {
    assert.equal(
      shouldRunInitialDatabaseSeed({
        serverReachable: true,
        markerExists: false,
        existingCoreCounts: { branches: 1, users: 0, products: 0, orders: 0 },
      }),
      false
    );
    assert.equal(
      shouldRunInitialDatabaseSeed({
        serverReachable: true,
        markerExists: false,
        existingCoreCounts: { branches: 0, users: 4, products: 0, orders: 0 },
      }),
      false
    );
    assert.equal(
      shouldRunInitialDatabaseSeed({
        serverReachable: true,
        markerExists: false,
        existingCoreCounts: { branches: 0, users: 0, products: 1, orders: 0 },
      }),
      false
    );
  });

  it('allows one-time seeding ONLY on a completely empty brand-new server database', () => {
    assert.equal(
      shouldRunInitialDatabaseSeed({
        serverReachable: true,
        markerExists: false,
        existingCoreCounts: { branches: 0, users: 0, products: 0, orders: 0 },
      }),
      true
    );
  });
});

describe('preserveBranchDocumentFromFirestore', () => {
  it('preserves real saved branch name, city, address, NIT, phone and logo without rewriting strings', () => {
    const branch = preserveBranchDocumentFromFirestore(
      {
        name: 'Restaurante Buga Real',
        city: 'Buga (Valle)',
        address: 'Cra 14 # 5-42 Buga',
        nit: '900.111.222-3',
        phone: '3150009999',
        logoUrl: 'data:image/png;base64,ABC',
        taxRate: 0,
      },
      'sede-buga',
      {
        receiptConfig: {
          headerText: 'DEFAULT',
          footerText: 'DEFAULT',
          resolutionDian: '',
          resolutionDate: '',
          prefix: 'RES-',
          currentNumber: 1,
          showTax: false,
          showTip: false,
        },
        printConfig: DEFAULT_BRANCH_PRINT_CONFIG,
      }
    );

    assert.equal(branch.name, 'Restaurante Buga Real');
    assert.equal(branch.city, 'Buga (Valle)');
    assert.equal(branch.address, 'Cra 14 # 5-42 Buga');
    assert.equal(branch.nit, '900.111.222-3');
    assert.equal(branch.phone, '3150009999');
    assert.equal(branch.logoUrl, 'data:image/png;base64,ABC');
    assert.equal(branch.taxRate, 0);
  });
});

