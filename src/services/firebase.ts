import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setLogLevel,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Silenciar advertencias internas repetitivas de reintento de conexión de Firestore SDK
setLogLevel('silent');

// Inicializar la aplicación Firebase con la configuración del proyecto aprovisionado
const app = initializeApp(firebaseConfig);

// Base de datos Firestore con el ID de base de datos específico y caché persistente
export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  },
  firebaseConfig.firestoreDatabaseId
);

export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  let userId: string | null = null;
  let email: string | null = null;
  let emailVerified: boolean | null = null;
  let isAnonymous: boolean | null = null;
  let tenantId: string | null = null;
  let providerInfo: { providerId?: string | null; email?: string | null }[] = [];

  try {
    if (auth.currentUser) {
      userId = auth.currentUser.uid;
      email = auth.currentUser.email;
      emailVerified = auth.currentUser.emailVerified;
      isAnonymous = auth.currentUser.isAnonymous;
      tenantId = auth.currentUser.tenantId;
      providerInfo = auth.currentUser.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [];
    }
  } catch (authErr) {
    console.warn('Auth info unavailable for Firestore error context:', authErr);
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId,
      email,
      emailVerified,
      isAnonymous,
      tenantId,
      providerInfo,
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Info: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Iniciar sesión con Google (proveedor oficial configurado por ProvisionFirebase)
export async function loginWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    return await signInWithPopup(auth, provider);
  } catch (error) {
    console.warn('Error Google Sign In:', error);
    throw error;
  }
}

export async function logoutUser() {
  try {
    return await signOut(auth);
  } catch (err) {
    console.warn('Logout warning:', err);
  }
}

// Helper para sanitizar objetos antes de enviarlos a Firestore (remueve campos undefined)
export function sanitizeFirestoreData<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestoreData(item)) as unknown as T;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeFirestoreData(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

// Validación de conexión al iniciar
export async function initializeAuthAndConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client in offline/cache mode:', error.message);
    } else {
      console.warn('Firebase connection check info:', error);
    }
  }
}

