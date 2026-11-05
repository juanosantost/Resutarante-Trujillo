import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', title?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success', title?: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastMessage = {
        id,
        message,
        type,
        title,
        duration: 4500,
      };

      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* Contenedor de notificaciones flotantes */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3">
        {toasts.map((t) => {
          let bgStyle = 'bg-[#181818] border-[#B77900] text-[#FFFDF5] shadow-2xl';
          let IconComponent = CheckCircle2;
          let iconColor = 'text-[#D6A21A]';

          if (t.type === 'error') {
            bgStyle = 'bg-[#181818] border-red-700 text-[#FFFDF5] shadow-2xl';
            IconComponent = AlertCircle;
            iconColor = 'text-red-400';
          } else if (t.type === 'warning') {
            bgStyle = 'bg-[#181818] border-amber-600 text-[#FFFDF5] shadow-2xl';
            IconComponent = AlertTriangle;
            iconColor = 'text-amber-400';
          } else if (t.type === 'info') {
            bgStyle = 'bg-[#181818] border-[#D6A21A] text-[#FFFDF5] shadow-2xl';
            IconComponent = Info;
            iconColor = 'text-[#D6A21A]';
          }

          return (
            <div
              key={t.id}
              role="alert"
              className={`pointer-events-auto p-3.5 rounded-xl border flex items-start gap-3 transition-all duration-300 transform translate-y-0 ${bgStyle}`}
            >
              <IconComponent className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
              <div className="flex-1 text-xs">
                {t.title && <div className="font-bold text-[#D6A21A] mb-0.5">{t.title}</div>}
                <div className="text-[#FFFDF5] font-medium leading-relaxed">{t.message}</div>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-[#a8a29e] hover:text-[#FFFDF5] p-1 rounded-md"
                aria-label="Cerrar notificación"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe usarse dentro de un ToastProvider');
  }
  return context;
};
