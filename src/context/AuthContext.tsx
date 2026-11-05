import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../services/firebase';
import { ColmenaUser, UserRole, Branch, ReceiptConfig, BranchPrintConfig, DEFAULT_BRANCH_PRINT_CONFIG } from '../types';
import { canUserAccessBranch, canUserAccessModule, normalizeUserRole } from '../utils/auth';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  currentUser: ColmenaUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  branches: Branch[];
  currentBranch: Branch | null;
  authorizedBranches: Branch[];
  setCurrentBranchId: (branchId: string) => void;
  allUsers: ColmenaUser[];
  loginGoogle: () => Promise<void>;
  loginWithIdentifier: (identifier: string, password?: string) => Promise<void>;
  loginAsStaffProfile: (user: ColmenaUser) => void;
  logout: () => Promise<void>;
  bootstrapFirstAdmin: (params: {
    fullName: string;
    documentNumber: string;
    email: string;
  }) => Promise<void>;
  createNewUser: (data: {
    fullName: string;
    documentNumber: string;
    email: string;
    role: UserRole;
    authorizedBranchIds: string[];
    phone?: string;
  }) => Promise<void>;
  updateUserData: (
    userId: string,
    data: Partial<Pick<ColmenaUser, 'fullName' | 'documentNumber' | 'role' | 'authorizedBranchIds' | 'phone'>>
  ) => Promise<void>;
  toggleUserActiveStatus: (userId: string, currentStatus: boolean) => Promise<void>;
  softDeleteUser: (userId: string, reason?: string) => Promise<void>;
  restoreUser: (userId: string) => Promise<void>;
  permanentDeleteUser: (userId: string) => Promise<void>;
  createNewBranch: (branchData: Omit<Branch, 'id'>) => Promise<string>;
  updateBranchData: (branchId: string, branchData: Partial<Branch>) => Promise<void>;
  canAccess: (moduleName: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const DEFAULT_RECEIPT_CONFIG: ReceiptConfig = {
  headerText: 'SISTEMA COLMENA RESTAURANTE',
  footerText: '¡Gracias por su visita! Guadalajara de Buga. Propina voluntaria según Ley 1935 de 2018.',
  resolutionDian: 'Resolución DIAN No. 18764000129 de 2026',
  resolutionDate: '2026-01-15',
  prefix: 'BUG-',
  currentNumber: 101,
  showTax: true,
  showTip: true,
};

export const INITIAL_BRANCHES: Branch[] = [
  {
    id: 'sede-buga',
    name: 'Sede Principal — Guadalajara de Buga',
    nit: '901.458.920-4',
    address: 'Cl. 4 # 13 - 28, Guadalajara de Buga',
    phone: '+57 (602) 237-4589',
    city: 'Guadalajara de Buga, Valle del Cauca',
    taxRate: 0.08,
    isActive: true,
    status: 'activa',
    notes: 'Sede principal restaurante y barra con atención de mesas y domicilios.',
    receiptConfig: {
      ...DEFAULT_RECEIPT_CONFIG,
      prefix: 'BUG-',
    },
    printConfig: DEFAULT_BRANCH_PRINT_CONFIG,
    createdAt: new Date().toISOString(),
  },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<ColmenaUser | null>(() => {
    try {
      const saved = localStorage.getItem('colmena_logged_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [branches, setBranches] = useState<Branch[]>(INITIAL_BRANCHES);
  const [currentBranchId, setCurrentBranchId] = useState<string>('sede-buga');
  const [allUsers, setAllUsers] = useState<ColmenaUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 1. Escuchar cambios de autenticación en Firebase
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(
      auth,
      async (fbUser) => {
        setFirebaseUser(fbUser);
        if (!fbUser) {
          // Si no hay sesión de Firebase activa y no hay credenciales en localStorage, cerrar sesión
          const saved = localStorage.getItem('colmena_logged_user');
          if (!saved) {
            setCurrentUser(null);
          }
        } else {
          try {
            // Buscar perfil en colección /users por firebaseUid o email
            const userDocRef = doc(db, 'users', fbUser.uid);
            const userSnap = await getDoc(userDocRef);

            if (userSnap.exists()) {
              const userData = { ...userSnap.data(), id: userSnap.id } as ColmenaUser;
              if (!userData.isActive && userData.email !== 'juan.santos.ieci@gmail.com') {
                await signOut(auth).catch(() => {});
                setCurrentUser(null);
                setIsLoading(false);
                return;
              }
              setCurrentUser(userData);
              await updateDoc(userDocRef, {
                lastLoginAt: new Date().toISOString(),
              }).catch(() => {});
            } else {
              // Verificar si existe por email
              const emailLower = fbUser.email?.toLowerCase() || '';
              const q = query(collection(db, 'users'), where('email', '==', emailLower));
              const querySnap = await getDocs(q);
              if (!querySnap.empty) {
                const matchedDoc = querySnap.docs[0];
                const userData = { ...matchedDoc.data(), id: matchedDoc.id } as ColmenaUser;
                setCurrentUser(userData);
                await updateDoc(doc(db, 'users', matchedDoc.id), {
                  firebaseUid: fbUser.uid,
                  lastLoginAt: new Date().toISOString(),
                }).catch(() => {});
              } else {
                // Si no está autorizado y no es el dueño, denegar acceso
                if (emailLower !== 'juan.santos.ieci@gmail.com') {
                  await signOut(auth).catch(() => {});
                  setCurrentUser(null);
                  setIsLoading(false);
                  return;
                }
                // Crear primer admin
                const newUser: ColmenaUser = {
                  id: fbUser.uid,
                  firebaseUid: fbUser.uid,
                  fullName: fbUser.displayName || 'Juan Carlos Gómez',
                  documentNumber: '1020304050',
                  email: 'juan.santos.ieci@gmail.com',
                  role: 'administrador',
                  authorizedBranchIds: ['sede-chapinero', 'sede-parque93'],
                  isActive: true,
                  createdAt: new Date().toISOString(),
                  lastLoginAt: new Date().toISOString(),
                  phone: '3001234567',
                };
                await setDoc(userDocRef, newUser).catch(() => {});
                setCurrentUser(newUser);
              }
            }
          } catch (err) {
            console.warn('Handling auth user profile fetch:', err);
            // Fallback al usuario autorizado
            if (!currentUser) {
              const fallbackUser: ColmenaUser = {
                id: fbUser.uid || 'usr-admin-principal',
                firebaseUid: fbUser.uid || 'admin-seed-uid',
                fullName: fbUser.displayName || 'Juan Carlos Gómez',
                documentNumber: '1020304050',
                email: 'juan.santos.ieci@gmail.com',
                role: 'administrador',
                authorizedBranchIds: ['sede-chapinero', 'sede-parque93'],
                isActive: true,
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
                phone: '3001234567',
              };
              setCurrentUser(fallbackUser);
            }
          }
        }
        setIsLoading(false);
      },
      (error) => {
        console.warn('Firebase auth state listener warning:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribeAuth();
  }, []);

  // 2. Listener en tiempo real para Sucursales
  useEffect(() => {
    const unsubBranches = onSnapshot(
      collection(db, 'branches'),
      (snap) => {
        const list: Branch[] = [];
        snap.forEach((d) => {
          const raw = d.data();
          const branchItem: Branch = {
            ...raw,
            id: d.id,
            name: raw.name || 'Sede Colmena',
            nit: raw.nit || '901.458.920-4',
            address: raw.address || 'Guadalajara de Buga, Colombia',
            phone: raw.phone || '+57 (602) 237-4589',
            city: raw.city || 'Guadalajara de Buga',
            logoUrl: raw.logoUrl || undefined,
            notes: raw.notes || '',
            taxRate: raw.taxRate !== undefined ? Number(raw.taxRate) : (raw.receiptConfig?.showTax === false ? 0 : 0.08),
            isActive: raw.isActive ?? true,
            status: (raw.isActive ?? true) ? 'activa' : 'inactiva',
            receiptConfig: raw.receiptConfig || {
              ...DEFAULT_RECEIPT_CONFIG,
              prefix: d.id.includes('93') ? 'P93-' : 'BUG-',
            },
            printConfig: raw.printConfig || DEFAULT_BRANCH_PRINT_CONFIG,
            createdAt: raw.createdAt || new Date().toISOString(),
          };
          list.push(branchItem);

          // Si el documento en Firestore no tiene NIT o receiptConfig o printConfig, actualizarlo
          if (!raw.nit || !raw.receiptConfig || !raw.printConfig) {
            setDoc(
              doc(db, 'branches', d.id),
              {
                nit: branchItem.nit,
                receiptConfig: branchItem.receiptConfig,
                printConfig: branchItem.printConfig,
                taxRate: branchItem.taxRate,
              },
              { merge: true }
            ).catch(() => {});
          }
        });
        if (list.length > 0) {
          setBranches(list);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'branches')
    );

    return () => unsubBranches();
  }, []);

  // 3. Listener en tiempo real para Usuarios del sistema
  useEffect(() => {
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list: ColmenaUser[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as ColmenaUser));
        setAllUsers(list.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '')));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'users')
    );

    return () => unsubUsers();
  }, []);

  // Si no hay usuarios en la base de datos, sembrar únicamente el administrador autorizado
  useEffect(() => {
    async function seedInitialUsersIfEmpty() {
      try {
        const snap = await getDocs(collection(db, 'users'));
        if (snap.empty) {
          console.log('Sembrando usuario administrador inicial...');
          const adminUser: ColmenaUser = {
            id: 'usr-admin-principal',
            firebaseUid: 'admin-seed-uid',
            fullName: 'Juan Carlos Gómez (Super Admin)',
            documentNumber: '1020304050',
            email: 'juan.santos.ieci@gmail.com',
            role: 'administrador',
            authorizedBranchIds: ['sede-buga'],
            isActive: true,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            phone: '3001234567',
          };
          await setDoc(doc(db, 'users', adminUser.id), adminUser);
        }
      } catch (err) {
        console.warn('Note on user seeding:', err);
      }
    }

    seedInitialUsersIfEmpty();
  }, []);

  // Asegurar que exista únicamente la sede de Guadalajara de Buga y limpiar sucursales obsoletas
  useEffect(() => {
    async function seedBranchesIfEmpty() {
      try {
        const snap = await getDocs(collection(db, 'branches'));
        const bugaBranch = INITIAL_BRANCHES[0];
        
        // Asegurar que sede-buga esté registrada
        const bugaRef = doc(db, 'branches', 'sede-buga');
        const bugaSnap = await getDoc(bugaRef);
        if (!bugaSnap.exists()) {
          await setDoc(bugaRef, bugaBranch);
        }

        // Limpiar sucursales obsoletas no pertenecientes a Guadalajara de Buga
        for (const bDoc of snap.docs) {
          if (bDoc.id === 'sede-chapinero' || bDoc.id === 'sede-parque93') {
            await deleteDoc(doc(db, 'branches', bDoc.id)).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Note on branch seeding:', err);
      }
    }
    seedBranchesIfEmpty();
  }, []);

  // Determinar sucursal actual y sucursales autorizadas
  const authorizedBranches = branches.filter((b) => {
    if (!currentUser) return true; // Por defecto todas si no hay perfil asignado
    return canUserAccessBranch(currentUser, b.id);
  });

  const currentBranch =
    branches.find((b) => b.id === currentBranchId) ||
    authorizedBranches[0] ||
    branches[0] ||
    null;

  // Cambiar sucursal validando autorización
  const handleSetCurrentBranchId = (branchId: string) => {
    if (!currentUser || canUserAccessBranch(currentUser, branchId)) {
      setCurrentBranchId(branchId);
    } else {
      throw new Error('No tienes permisos autorizados para acceder a esta sucursal.');
    }
  };

  const saveUserSession = (user: ColmenaUser) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('colmena_logged_user', JSON.stringify(user));
    } catch (e) {
      console.warn('Could not save user session', e);
    }
  };

  const clearUserSession = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('colmena_logged_user');
    } catch (e) {
      console.warn('Could not remove user session', e);
    }
  };

  // Iniciar sesión con Google
  const loginGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const emailLower = user.email?.toLowerCase() || '';
    const isOwner = emailLower === 'juan.santos.ieci@gmail.com';

    // Verificar si ya tiene perfil o crearlo
    const userDocRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userDocRef);

    if (snap.exists()) {
      const u = { ...snap.data(), id: snap.id } as ColmenaUser;
      if (!u.isActive && !isOwner) {
        await signOut(auth);
        throw new Error('Este usuario se encuentra inactivo.');
      }
      saveUserSession(u);
      await updateDoc(userDocRef, {
        lastLoginAt: new Date().toISOString(),
      });
    } else {
      // Buscar por email
      const q = query(collection(db, 'users'), where('email', '==', emailLower));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        const doc0 = qSnap.docs[0];
        const u = { ...doc0.data(), id: doc0.id } as ColmenaUser;
        saveUserSession(u);
        await updateDoc(doc(db, 'users', doc0.id), {
          firebaseUid: user.uid,
          lastLoginAt: new Date().toISOString(),
        });
      } else {
        if (!isOwner) {
          await signOut(auth);
          throw new Error('Acceso no autorizado. Este correo electrónico no está autorizado en Sistema Colmena.');
        }
        const newUser: ColmenaUser = {
          id: user.uid,
          firebaseUid: user.uid,
          fullName: user.displayName || 'Juan Carlos Gómez',
          documentNumber: '1020304050',
          email: 'juan.santos.ieci@gmail.com',
          role: 'administrador',
          authorizedBranchIds: branches.map((b) => b.id),
          isActive: true,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          phone: '3001234567',
        };
        await setDoc(userDocRef, newUser);
        saveUserSession(newUser);
      }
    }
  };

  // Iniciar sesión con Correo o Número de Cédula
  const loginWithIdentifier = async (identifier: string, password?: string): Promise<void> => {
    const term = identifier.toLowerCase().trim();
    if (!term) throw new Error('Ingresa un correo electrónico o número de cédula.');

    // Buscar en usuarios cargados (allUsers)
    let matched = allUsers.find(
      (u) =>
        u.email.toLowerCase() === term ||
        u.documentNumber === term ||
        u.fullName.toLowerCase().includes(term)
    );

    if (!matched) {
      // Buscar en Firestore /users por email o documento
      try {
        const qEmail = query(collection(db, 'users'), where('email', '==', term));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          const doc0 = snapEmail.docs[0];
          matched = { ...doc0.data(), id: doc0.id } as ColmenaUser;
        } else {
          const qDoc = query(collection(db, 'users'), where('documentNumber', '==', term));
          const snapDoc = await getDocs(qDoc);
          if (!snapDoc.empty) {
            const doc0 = snapDoc.docs[0];
            matched = { ...doc0.data(), id: doc0.id } as ColmenaUser;
          }
        }
      } catch (err) {
        console.warn('Error querying user by identifier:', err);
      }
    }

    if (!matched) {
      throw new Error('Usuario no registrado en el sistema. Debe estar registrado en el módulo de usuarios por un administrador.');
    }

    if (matched.isDeleted) {
      throw new Error('Este usuario se encuentra en la papelera de usuarios eliminados. Un administrador debe restablecerlo.');
    }

    if (!matched.isActive) {
      throw new Error('Este usuario se encuentra inactivo en el sistema.');
    }

    saveUserSession(matched);
    if (matched.authorizedBranchIds && matched.authorizedBranchIds.length > 0 && !matched.authorizedBranchIds.includes(currentBranchId)) {
      setCurrentBranchId(matched.authorizedBranchIds[0]);
    }
  };

  // Inicio de sesión directo como perfil del equipo (para terminal POS o selección de usuario)
  const loginAsStaffProfile = (user: ColmenaUser) => {
    saveUserSession(user);
    if (user.authorizedBranchIds.length > 0 && !user.authorizedBranchIds.includes(currentBranchId)) {
      setCurrentBranchId(user.authorizedBranchIds[0]);
    }
  };

  // Cerrar sesión
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Signout note:', e);
    }
    setFirebaseUser(null);
    clearUserSession();
  };

  // Procedimiento seguro para registrar el Primer Administrador
  const bootstrapFirstAdmin = async ({
    fullName,
    documentNumber,
    email,
  }: {
    fullName: string;
    documentNumber: string;
    email: string;
  }) => {
    const adminId = firebaseUser ? firebaseUser.uid : `admin-${Date.now()}`;
    const newAdmin: ColmenaUser = {
      id: adminId,
      firebaseUid: firebaseUser ? firebaseUser.uid : 'bootstrap-admin-uid',
      fullName,
      documentNumber,
      email: email.toLowerCase().trim(),
      role: 'administrador',
      authorizedBranchIds: branches.map((b) => b.id),
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'users', adminId), newAdmin);
    setCurrentUser(newAdmin);
  };

  // Crear nuevo usuario (Administrador)
  const createNewUser = async (data: {
    fullName: string;
    documentNumber: string;
    email: string;
    role: UserRole;
    authorizedBranchIds: string[];
    phone?: string;
  }) => {
    const newId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const userDoc: ColmenaUser = {
      id: newId,
      firebaseUid: `pending-auth-${newId}`,
      fullName: data.fullName.trim(),
      documentNumber: data.documentNumber.trim(),
      email: data.email.toLowerCase().trim(),
      role: data.role,
      authorizedBranchIds: data.authorizedBranchIds,
      isActive: true,
      createdAt: new Date().toISOString(),
      phone: data.phone?.trim() || '',
    };

    await setDoc(doc(db, 'users', newId), userDoc);
  };

  // Actualizar datos de usuario
  const updateUserData = async (
    userId: string,
    data: Partial<Pick<ColmenaUser, 'fullName' | 'documentNumber' | 'role' | 'authorizedBranchIds' | 'phone'>>
  ) => {
    await updateDoc(doc(db, 'users', userId), {
      ...data,
      updatedAt: new Date().toISOString(),
    });

    if (currentUser && currentUser.id === userId) {
      setCurrentUser((prev) => (prev ? { ...prev, ...data } : null));
    }
  };

  // Activar o desactivar usuario
  const toggleUserActiveStatus = async (userId: string, currentStatus: boolean) => {
    await updateDoc(doc(db, 'users', userId), {
      isActive: !currentStatus,
      updatedAt: new Date().toISOString(),
    });

    if (currentUser && currentUser.id === userId) {
      setCurrentUser((prev) => (prev ? { ...prev, isActive: !currentStatus } : null));
    }
  };

  // Mover usuario a la papelera (Soft delete con motivo y fecha)
  const softDeleteUser = async (userId: string, reason: string = 'Eliminado por error o retiro') => {
    const userToDelete = allUsers.find((u) => u.id === userId);
    if (!userToDelete) throw new Error('Usuario no encontrado.');

    if (currentUser && currentUser.id === userId) {
      throw new Error('No puedes eliminar tu propio usuario en sesión activa.');
    }

    if (normalizeUserRole(userToDelete.role) === 'administrador') {
      const activeAdmins = allUsers.filter(
        (u) => normalizeUserRole(u.role) === 'administrador' && !u.isDeleted && u.isActive
      );
      if (activeAdmins.length <= 1) {
        throw new Error('No puedes eliminar al único Administrador activo del sistema.');
      }
    }

    const now = new Date().toISOString();
    await updateDoc(doc(db, 'users', userId), {
      isDeleted: true,
      deletedAt: now,
      deletedBy: currentUser?.fullName || 'Administrador',
      deleteReason: reason.trim() || 'Eliminado desde administración',
      isActive: false,
      updatedAt: now,
    });

    // Actualización local
    setAllUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              isDeleted: true,
              deletedAt: now,
              deletedBy: currentUser?.fullName || 'Administrador',
              deleteReason: reason.trim() || 'Eliminado desde administración',
              isActive: false,
            }
          : u
      )
    );
  };

  // Restablecer usuario eliminado desde la papelera
  const restoreUser = async (userId: string) => {
    const userToRestore = allUsers.find((u) => u.id === userId);
    if (!userToRestore) throw new Error('Usuario no encontrado.');

    const now = new Date().toISOString();
    await updateDoc(doc(db, 'users', userId), {
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
      isActive: true,
      updatedAt: now,
    });

    // Actualización local
    setAllUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              isDeleted: false,
              deletedAt: undefined,
              deletedBy: undefined,
              deleteReason: undefined,
              isActive: true,
            }
          : u
      )
    );
  };

  // Eliminación definitiva en Firestore
  const permanentDeleteUser = async (userId: string) => {
    const userToDelete = allUsers.find((u) => u.id === userId);
    if (!userToDelete) throw new Error('Usuario no encontrado.');

    if (currentUser && currentUser.id === userId) {
      throw new Error('No puedes eliminar tu propio usuario en sesión activa.');
    }

    if (normalizeUserRole(userToDelete.role) === 'administrador') {
      const activeAdmins = allUsers.filter(
        (u) => normalizeUserRole(u.role) === 'administrador' && !u.isDeleted && u.isActive
      );
      if (activeAdmins.length <= 1) {
        throw new Error('No puedes eliminar al único Administrador del sistema.');
      }
    }

    await deleteDoc(doc(db, 'users', userId));
    setAllUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  // Crear nueva sucursal (ID autogenerado e inmutable)
  const createNewBranch = async (branchData: Omit<Branch, 'id'>): Promise<string> => {
    const slug = (branchData.name || 'sucursal')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 18);
    const branchId = `sede-${slug}-${Date.now().toString().slice(-5)}`;
    
    const newBranch: Branch = {
      name: branchData.name.trim(),
      nit: branchData.nit.trim(),
      address: branchData.address.trim(),
      phone: branchData.phone.trim(),
      city: branchData.city?.trim() || 'Guadalajara de Buga',
      taxRate: typeof branchData.taxRate === 'number' ? branchData.taxRate : (branchData.receiptConfig?.showTax === false ? 0 : 0.08),
      isActive: branchData.isActive ?? true,
      status: (branchData.isActive ?? true) ? 'activa' : 'inactiva',
      logoUrl: branchData.logoUrl || '',
      notes: branchData.notes?.trim() || '',
      receiptConfig: branchData.receiptConfig || DEFAULT_RECEIPT_CONFIG,
      printConfig: branchData.printConfig || DEFAULT_BRANCH_PRINT_CONFIG,
      id: branchId,
      createdAt: new Date().toISOString(),
    };

    // Sanitizar campos undefined para Firestore
    const cleanDoc: Record<string, any> = {};
    Object.entries(newBranch).forEach(([key, val]) => {
      if (val !== undefined) cleanDoc[key] = val;
    });

    await setDoc(doc(db, 'branches', branchId), cleanDoc);
    setBranches((prev) => [...prev, newBranch]);
    return branchId;
  };

  // Actualizar sucursal (conserva ID único y fecha de creación histórica)
  const updateBranchData = async (branchId: string, branchData: Partial<Branch>) => {
    // Proteger campos inmutables
    const { id: _ignoreId, createdAt: _ignoreCreatedAt, ...allowedUpdates } = branchData;

    const payload: Record<string, any> = {
      ...allowedUpdates,
      updatedAt: new Date().toISOString(),
    };

    if ('isActive' in allowedUpdates) {
      payload.status = allowedUpdates.isActive ? 'activa' : 'inactiva';
    }

    // Sanitizar campos undefined
    const cleanPayload: Record<string, any> = {};
    Object.entries(payload).forEach(([key, val]) => {
      if (val !== undefined) cleanPayload[key] = val;
    });

    await updateDoc(doc(db, 'branches', branchId), cleanPayload);

    setBranches((prev) =>
      prev.map((b) => (b.id === branchId ? { ...b, ...cleanPayload } : b))
    );
  };

  const canAccess = useCallback(
    (moduleName: string): boolean => {
      if (!currentUser) return false;
      return canUserAccessModule(currentUser.role, moduleName);
    },
    [currentUser]
  );

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        currentUser,
        isAuthenticated: !!currentUser,
        isLoading,
        branches,
        currentBranch,
        authorizedBranches,
        setCurrentBranchId: handleSetCurrentBranchId,
        allUsers,
        loginGoogle,
        loginWithIdentifier,
        loginAsStaffProfile,
        logout,
        bootstrapFirstAdmin,
        createNewUser,
        updateUserData,
        toggleUserActiveStatus,
        softDeleteUser,
        restoreUser,
        permanentDeleteUser,
        createNewBranch,
        updateBranchData,
        canAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};
