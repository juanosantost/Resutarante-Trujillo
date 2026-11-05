import React, { useState } from 'react';
import { Supplier } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { SupplierModal } from '../purchases/SupplierModal';
import { Search, UserPlus, X, Phone, Building } from 'lucide-react';

interface SupplierSelectInputProps {
  selectedSupplier: Supplier | null;
  onSelectSupplier: (supplier: Supplier | null) => void;
  label?: string;
  required?: boolean;
  className?: string;
}

export const SupplierSelectInput: React.FC<SupplierSelectInputProps> = ({
  selectedSupplier,
  onSelectSupplier,
  label = 'Proveedor seleccionado',
  required = false,
  className = '',
}) => {
  const { suppliers } = useRestaurant();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  const activeSuppliers = suppliers.filter((s) => s.status === 'activo');

  const filteredSuppliers = activeSuppliers.filter((s) => {
    if (!searchTerm.trim()) return false;
    const term = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      (s.document && s.document.includes(term)) ||
      (s.phone && s.phone.includes(term)) ||
      (s.observations && s.observations.toLowerCase().includes(term))
    );
  });

  const handleCreateSuccess = (newSup: Supplier) => {
    onSelectSupplier(newSup);
    setSearchTerm('');
    setIsDropdownOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5 flex items-center justify-between">
          <span>
            {label} {required && <span className="text-amber-500">*</span>}
          </span>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="text-[11px] text-[#D6A21A] hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Crear proveedor</span>
          </button>
        </label>
      )}

      {selectedSupplier ? (
        // Tarjeta de Proveedor Seleccionado
        <div className="bg-[#121214] border border-[#B77900]/50 rounded-2xl p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-[#292212] border border-[#B77900]/40 flex items-center justify-center text-[#D6A21A] flex-shrink-0">
              <Building className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-[#FFFDF5] truncate">
                  {selectedSupplier.name}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#242424] text-[#D6A21A] border border-[#383838]">
                  {selectedSupplier.documentType || 'NIT/CC'}: {selectedSupplier.documentNumber || selectedSupplier.document}
                </span>
              </div>
              <p className="text-[10px] text-[#a8a29e] flex items-center gap-1 mt-0.5 truncate">
                <Phone className="w-3 h-3 text-[#D6A21A]" />
                <span>{selectedSupplier.phone}</span>
                {selectedSupplier.address && <span>· {selectedSupplier.address}</span>}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectSupplier(null)}
            className="p-1 text-[#a8a29e] hover:text-red-400 rounded-lg hover:bg-[#242424] transition-colors ml-2 flex-shrink-0 cursor-pointer"
            title="Cambiar proveedor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        // Input de Búsqueda
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3.5 text-[#a8a29e]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder="Buscar proveedor por nombre, NIT, cédula o celular..."
              className="w-full bg-[#121214] border border-[#333333] rounded-xl pl-9.5 pr-24 py-2.5 text-xs text-[#FFFDF5] placeholder:text-neutral-500 focus:outline-none focus:border-[#B77900]"
            />
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="absolute right-1.5 px-2.5 py-1.5 rounded-lg bg-[#292212] border border-[#B77900]/40 text-[#D6A21A] hover:bg-[#B77900] hover:text-[#181818] text-[11px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
            >
              <UserPlus className="w-3 h-3" />
              <span>Nuevo</span>
            </button>
          </div>

          {/* Menú Desplegable de Resultados */}
          {isDropdownOpen && searchTerm.trim() && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#181818] border border-[#333333] rounded-2xl shadow-2xl z-30 max-h-56 overflow-y-auto divide-y divide-[#242424]">
              {filteredSuppliers.length > 0 ? (
                filteredSuppliers.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onSelectSupplier(s);
                      setSearchTerm('');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left p-3 hover:bg-[#242424] transition-colors flex items-center justify-between cursor-pointer group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#FFFDF5] group-hover:text-[#D6A21A]">
                          {s.name}
                        </span>
                        <span className="text-[10px] text-[#a8a29e] bg-[#121214] px-1.5 py-0.5 rounded">
                          {s.documentType || 'NIT'}: {s.documentNumber || s.document}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#a8a29e] mt-0.5">
                        Tel: {s.phone} {s.address ? `· ${s.address}` : ''}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center">
                  <p className="text-xs text-[#a8a29e]">
                    No se encontraron proveedores que coincidan con "<strong className="text-[#FFFDF5]">{searchTerm}</strong>"
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setIsCreateModalOpen(true);
                    }}
                    className="mt-2 text-xs font-bold text-[#D6A21A] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Registrar a "{searchTerm}" como nuevo proveedor</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de Creación Inline */}
      <SupplierModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
        initialName={searchTerm}
      />
    </div>
  );
};
