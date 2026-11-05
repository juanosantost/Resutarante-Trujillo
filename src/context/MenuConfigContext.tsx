import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppView } from '../components/layout/AppLayout';
import {
  MenuConfig,
  MenuButtonItemConfig,
  MenuSectionConfig,
  UserRoleName,
  DEFAULT_MENU_CONFIG,
} from '../types/menuConfig';
import { normalizeUserRole } from '../utils/auth';

const STORAGE_KEY = 'colmena_menu_config_v1';
const FIRESTORE_SETTINGS_COLLECTION = 'system_settings';
const FIRESTORE_MENU_DOC = 'menu_config';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
  };
  console.warn('Firestore MenuConfig notice: ', JSON.stringify(errInfo));
}

interface MenuConfigContextType {
  menuConfig: MenuConfig;
  isLoading: boolean;
  isSaving: boolean;
  saveMenuConfig: (newConfig: MenuConfig, staffName?: string) => Promise<void>;
  resetToDefault: (staffName?: string) => Promise<void>;
  updateButtonItem: (buttonId: AppView, updates: Partial<MenuButtonItemConfig>) => Promise<void>;
  updateButtonSection: (buttonId: AppView, targetSectionId: string) => Promise<void>;
  moveButtonOrder: (buttonId: AppView, direction: 'up' | 'down') => Promise<void>;
  toggleRoleForButton: (buttonId: AppView, role: UserRoleName) => Promise<void>;
  addSection: (title: string, description?: string) => Promise<void>;
  removeSection: (sectionId: string) => Promise<void>;
  moveSectionOrder: (sectionId: string, direction: 'up' | 'down') => Promise<void>;
  canRoleAccessView: (role: string | undefined, view: AppView) => boolean;
  getRoleVisibleButtons: (role: string | undefined) => MenuButtonItemConfig[];
}

const MenuConfigContext = createContext<MenuConfigContextType | undefined>(undefined);

export const MenuConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Cargar estado inicial desde localStorage para evitar parpadeos
  const [menuConfig, setMenuConfig] = useState<MenuConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.sections) && Array.isArray(parsed.buttons)) {
          // Fusionar con botones por defecto para garantizar que nuevas opciones existan
          const existingIds = new Set(parsed.buttons.map((b: any) => b.id));
          const missingDefaults = DEFAULT_MENU_CONFIG.buttons.filter((b) => !existingIds.has(b.id));
          return {
            ...parsed,
            buttons: [...parsed.buttons, ...missingDefaults],
          };
        }
      }
    } catch (e) {
      console.warn('Error leyendo menuConfig de localStorage', e);
    }
    return DEFAULT_MENU_CONFIG;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Escuchar configuración global de Firestore en tiempo real
  useEffect(() => {
    const docRef = doc(db, FIRESTORE_SETTINGS_COLLECTION, FIRESTORE_MENU_DOC);
    const unsub = onSnapshot(
      docRef,
      (snapshot) => {
        setIsLoading(false);
        if (snapshot.exists()) {
          const data = snapshot.data() as MenuConfig;
          if (data && Array.isArray(data.sections) && Array.isArray(data.buttons)) {
            // Asegurar que todos los botones predeterminados existan incluso si se agregaron nuevos
            const existingIds = new Set(data.buttons.map((b) => b.id));
            const missing = DEFAULT_MENU_CONFIG.buttons.filter((b) => !existingIds.has(b.id));
            const mergedButtons = [...data.buttons, ...missing];

            const updatedConfig: MenuConfig = {
              sections: data.sections,
              buttons: mergedButtons,
              updatedAt: data.updatedAt,
              updatedBy: data.updatedBy,
            };

            setMenuConfig(updatedConfig);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedConfig));
            } catch {}
            return;
          }
        }
      },
      (error) => {
        setIsLoading(false);
        handleFirestoreError(error, OperationType.GET, `${FIRESTORE_SETTINGS_COLLECTION}/${FIRESTORE_MENU_DOC}`);
      }
    );

    return () => unsub();
  }, []);

  // Guardar configuración completa en Firestore y localStorage
  const saveMenuConfig = async (newConfig: MenuConfig, staffName: string = 'Administrador') => {
    setIsSaving(true);
    const payload: MenuConfig = {
      ...newConfig,
      updatedAt: new Date().toISOString(),
      updatedBy: staffName,
    };

    // Actualización optimista local
    setMenuConfig(payload);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}

    try {
      const docRef = doc(db, FIRESTORE_SETTINGS_COLLECTION, FIRESTORE_MENU_DOC);
      await setDoc(docRef, payload, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${FIRESTORE_SETTINGS_COLLECTION}/${FIRESTORE_MENU_DOC}`);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  // Restablecer valores predeterminados
  const resetToDefault = async (staffName: string = 'Administrador') => {
    await saveMenuConfig(DEFAULT_MENU_CONFIG, staffName);
  };

  // Actualizar un botón específico
  const updateButtonItem = async (buttonId: AppView, updates: Partial<MenuButtonItemConfig>) => {
    const updatedButtons = menuConfig.buttons.map((btn) => {
      if (btn.id === buttonId) {
        return { ...btn, ...updates };
      }
      return btn;
    });

    const newConfig: MenuConfig = {
      ...menuConfig,
      buttons: updatedButtons,
    };

    await saveMenuConfig(newConfig);
  };

  // Mover botón a otra sección (cambiar ubicación)
  const updateButtonSection = async (buttonId: AppView, targetSectionId: string) => {
    const buttonsInTarget = menuConfig.buttons.filter((b) => b.sectionId === targetSectionId);
    const maxOrder = buttonsInTarget.reduce((max, b) => Math.max(max, b.order), -1);

    const updatedButtons = menuConfig.buttons.map((btn) => {
      if (btn.id === buttonId) {
        return {
          ...btn,
          sectionId: targetSectionId,
          order: maxOrder + 1,
        };
      }
      return btn;
    });

    const newConfig: MenuConfig = {
      ...menuConfig,
      buttons: updatedButtons,
    };

    await saveMenuConfig(newConfig);
  };

  // Subir o bajar el orden de un botón dentro de su sección
  const moveButtonOrder = async (buttonId: AppView, direction: 'up' | 'down') => {
    const targetBtn = menuConfig.buttons.find((b) => b.id === buttonId);
    if (!targetBtn) return;

    // Obtener todos los botones de la misma sección ordenados
    const sectionButtons = menuConfig.buttons
      .filter((b) => b.sectionId === targetBtn.sectionId)
      .sort((a, b) => a.order - b.order);

    const currentIndex = sectionButtons.findIndex((b) => b.id === buttonId);
    if (currentIndex < 0) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= sectionButtons.length) return; // Ya está en el límite

    const otherBtn = sectionButtons[swapIndex];

    // Intercambiar órdenes
    const updatedButtons = menuConfig.buttons.map((btn) => {
      if (btn.id === targetBtn.id) {
        return { ...btn, order: otherBtn.order };
      }
      if (btn.id === otherBtn.id) {
        return { ...btn, order: targetBtn.order };
      }
      return btn;
    });

    // Re-normalizar órdenes continuos 0, 1, 2...
    const normalizedInSec = updatedButtons
      .filter((b) => b.sectionId === targetBtn.sectionId)
      .sort((a, b) => a.order - b.order);

    const orderMap = new Map<string, number>();
    normalizedInSec.forEach((b, idx) => orderMap.set(b.id, idx));

    const finalButtons = updatedButtons.map((btn) => {
      if (orderMap.has(btn.id)) {
        return { ...btn, order: orderMap.get(btn.id)! };
      }
      return btn;
    });

    await saveMenuConfig({
      ...menuConfig,
      buttons: finalButtons,
    });
  };

  // Conmutar rol para un botón específico (Administrador / Asesor / Cocinero)
  const toggleRoleForButton = async (buttonId: AppView, role: UserRoleName) => {
    const btn = menuConfig.buttons.find((b) => b.id === buttonId);
    if (!btn) return;

    const currentRoles = new Set<UserRoleName>(btn.allowedRoles || []);
    if (currentRoles.has(role)) {
      currentRoles.delete(role);
    } else {
      currentRoles.add(role);
    }

    const updatedButtons = menuConfig.buttons.map((b) => {
      if (b.id === buttonId) {
        return {
          ...b,
          allowedRoles: Array.from(currentRoles) as UserRoleName[],
        };
      }
      return b;
    });

    await saveMenuConfig({
      ...menuConfig,
      buttons: updatedButtons,
    });
  };

  // Crear una nueva sección en el menú
  const addSection = async (title: string, description: string = '') => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const newId = trimmedTitle
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .slice(0, 30) + `_${Date.now().toString().slice(-4)}`;

    const maxOrder = menuConfig.sections.reduce((max, s) => Math.max(max, s.order), -1);

    const newSection: MenuSectionConfig = {
      id: newId,
      title: trimmedTitle.toUpperCase(),
      order: maxOrder + 1,
      description,
    };

    await saveMenuConfig({
      ...menuConfig,
      sections: [...menuConfig.sections, newSection],
    });
  };

  // Eliminar una sección personalizada (reasignar botones a 'operacion')
  const removeSection = async (sectionId: string) => {
    if (sectionId === 'operacion' || sectionId === 'administracion') {
      throw new Error('Las secciones principales del sistema no pueden eliminarse.');
    }

    const updatedSections = menuConfig.sections.filter((s) => s.id !== sectionId);
    const updatedButtons = menuConfig.buttons.map((btn) => {
      if (btn.sectionId === sectionId) {
        return { ...btn, sectionId: 'operacion' };
      }
      return btn;
    });

    await saveMenuConfig({
      ...menuConfig,
      sections: updatedSections,
      buttons: updatedButtons,
    });
  };

  // Mover orden de una sección
  const moveSectionOrder = async (sectionId: string, direction: 'up' | 'down') => {
    const sortedSections = [...menuConfig.sections].sort((a, b) => a.order - b.order);
    const currentIndex = sortedSections.findIndex((s) => s.id === sectionId);
    if (currentIndex < 0) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= sortedSections.length) return;

    const currentSec = sortedSections[currentIndex];
    const otherSec = sortedSections[swapIndex];

    const tempOrder = currentSec.order;
    currentSec.order = otherSec.order;
    otherSec.order = tempOrder;

    sortedSections.sort((a, b) => a.order - b.order);
    sortedSections.forEach((s, idx) => {
      s.order = idx;
    });

    await saveMenuConfig({
      ...menuConfig,
      sections: sortedSections,
    });
  };

  // Comprueba si un rol específico tiene acceso a una vista
  const canRoleAccessView = (role: string | undefined, view: AppView): boolean => {
    const norm = normalizeUserRole(role);
    // Vistas fijas que siempre están disponibles para navegación de retorno
    if (view === 'home' && norm !== 'cocinero') return true;
    if (view === 'cocina') return true; // Todos pueden ver o supervisar cocina si lo desean

    // Subvistas operativas de compras o egresos heredan permiso del botón padre
    if (view === 'registrar-gasto' || view === 'registrar-compra') {
      const parent = menuConfig.buttons.find((b) => b.id === 'desembolsos' || b.id === 'compras');
      if (parent) return parent.allowedRoles.includes(norm);
    }
    if (view === 'otros-ingresos') {
      const parent = menuConfig.buttons.find((b) => b.id === 'ingresos');
      if (parent) return parent.allowedRoles.includes(norm);
    }

    const button = menuConfig.buttons.find((b) => b.id === view);
    if (!button) {
      // Fallback a administrador si no está en la lista de botones
      return norm === 'administrador';
    }

    if (!button.isVisible) return false;
    return button.allowedRoles.includes(norm);
  };

  // Obtiene la lista de botones visibles para un rol ordenados por sección y orden
  const getRoleVisibleButtons = (role: string | undefined): MenuButtonItemConfig[] => {
    const norm = normalizeUserRole(role);
    return menuConfig.buttons
      .filter((b) => b.isVisible && b.allowedRoles.includes(norm))
      .sort((a, b) => a.order - b.order);
  };

  return (
    <MenuConfigContext.Provider
      value={{
        menuConfig,
        isLoading,
        isSaving,
        saveMenuConfig,
        resetToDefault,
        updateButtonItem,
        updateButtonSection,
        moveButtonOrder,
        toggleRoleForButton,
        addSection,
        removeSection,
        moveSectionOrder,
        canRoleAccessView,
        getRoleVisibleButtons,
      }}
    >
      {children}
    </MenuConfigContext.Provider>
  );
};

export const useMenuConfig = (): MenuConfigContextType => {
  const context = useContext(MenuConfigContext);
  if (!context) {
    throw new Error('useMenuConfig debe utilizarse dentro de un MenuConfigProvider');
  }
  return context;
};
