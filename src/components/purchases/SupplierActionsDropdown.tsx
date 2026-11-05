import React, { useState, useRef, useEffect } from 'react';
import { Supplier } from '../../types';
import {
  MoreVertical,
  MessageCircle,
  Edit2,
  Power,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface SupplierActionsDropdownProps {
  supplier: Supplier;
  onEdit: () => void;
  onToggleStatus: () => void;
  onWhatsApp: () => void;
  label?: string;
}

export const SupplierActionsDropdown: React.FC<SupplierActionsDropdownProps> = ({
  supplier,
  onEdit,
  onToggleStatus,
  onWhatsApp,
  label = 'Opciones',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera del menú
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAction = (actionFn: () => void) => {
    setIsOpen(false);
    actionFn();
  };

  const isActive = supplier.status === 'activo';

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="px-3 py-1.5 rounded-xl bg-[#242424] border border-[#3d3d3d] hover:border-[#B77900] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer hover:bg-[#2d2d2d]"
        title="Opciones del proveedor"
      >
        <span>{label}</span>
        <MoreVertical className="w-3.5 h-3.5 text-[#D6A21A]" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-1.5 w-52 rounded-2xl bg-[#1f1f24] border border-[#B77900]/40 shadow-2xl z-50 py-1.5 text-xs text-[#FFFDF5] divide-y divide-[#2a2a30] animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Opción WhatsApp */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => handleAction(onWhatsApp)}
              className="w-full text-left px-3.5 py-2 hover:bg-[#2a2a32] flex items-center gap-2.5 text-[#25D366] font-bold transition-colors cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 flex-shrink-0" />
              <span>Contactar WhatsApp</span>
            </button>
          </div>

          {/* Opción Editar */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => handleAction(onEdit)}
              className="w-full text-left px-3.5 py-2 hover:bg-[#2a2a32] flex items-center gap-2.5 text-[#FFFDF5] font-bold transition-colors cursor-pointer"
            >
              <Edit2 className="w-4 h-4 text-[#D6A21A] flex-shrink-0" />
              <span>Editar Proveedor</span>
            </button>
          </div>

          {/* Opción Activar / Desactivar */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => handleAction(onToggleStatus)}
              className={`w-full text-left px-3.5 py-2 hover:bg-[#2a2a32] flex items-center gap-2.5 font-bold transition-colors cursor-pointer ${
                isActive ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              {isActive ? (
                <>
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>Desactivar Proveedor</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Activar Proveedor</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
