import React, { useState } from 'react';
import { Customer } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { CustomerModal } from '../customers/CustomerModal';
import { Search, UserPlus, X, User, Phone, Check, Building } from 'lucide-react';

interface CustomerSelectInputProps {
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
  label?: string;
  required?: boolean;
  className?: string;
}

export const CustomerSelectInput: React.FC<CustomerSelectInputProps> = ({
  selectedCustomer,
  onSelectCustomer,
  label = 'Cliente / Destinatario',
  required = false,
  className = '',
}) => {
  const { customers } = useRestaurant();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  const filteredCustomers = customers.filter((c) => {
    if (!searchTerm.trim()) return false;
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.documentNumber.includes(term) ||
      c.phone.includes(term) ||
      (c.observations && c.observations.toLowerCase().includes(term))
    );
  });

  const handleCreateSuccess = (newCust: Customer) => {
    onSelectCustomer(newCust);
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
            <span>Crear cliente</span>
          </button>
        </label>
      )}

      {selectedCustomer ? (
        // Tarjeta de Cliente Seleccionado
        <div className="bg-[#121214] border border-[#B77900]/50 rounded-2xl p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-[#292212] border border-[#B77900]/40 flex items-center justify-center text-[#D6A21A] flex-shrink-0">
              {selectedCustomer.documentType === 'NIT' ? <Building className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-[#FFFDF5] truncate">
                  {selectedCustomer.name}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#242424] text-[#D6A21A] border border-[#383838]">
                  {selectedCustomer.documentType} {selectedCustomer.documentNumber}
                </span>
              </div>
              <p className="text-[10px] text-[#a8a29e] flex items-center gap-1 mt-0.5 truncate">
                <Phone className="w-3 h-3 text-[#D6A21A]" />
                <span>{selectedCustomer.phone}</span>
                {selectedCustomer.address && <span>· {selectedCustomer.address}</span>}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectCustomer(null)}
            className="p-1 text-[#a8a29e] hover:text-red-400 rounded-lg hover:bg-[#242424] transition-colors ml-2 flex-shrink-0 cursor-pointer"
            title="Cambiar cliente"
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
              placeholder="Buscar cliente por nombre, cédula, NIT o celular..."
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
          {isDropdownOpen && searchTerm.trim().length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#181818] border border-[#B77900]/40 rounded-2xl shadow-2xl z-50 max-h-56 overflow-y-auto p-1.5">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onSelectCustomer(c);
                      setSearchTerm('');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full p-2.5 rounded-xl text-left hover:bg-[#242424] flex items-center justify-between text-xs transition-colors cursor-pointer group"
                  >
                    <div>
                      <div className="font-bold text-[#FFFDF5] group-hover:text-[#D6A21A]">
                        {c.name}
                      </div>
                      <div className="text-[10px] text-[#a8a29e] flex items-center gap-2 mt-0.5">
                        <span>{c.documentType}: {c.documentNumber}</span>
                        <span>·</span>
                        <span>{c.phone}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-[#D6A21A] px-2 py-0.5 rounded bg-[#292212] border border-[#B77900]/30">
                      Seleccionar
                    </span>
                  </button>
                ))
              ) : (
                <div className="p-3 text-center">
                  <p className="text-xs text-[#a8a29e] mb-2">No se encontró cliente con ese criterio</p>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-[#B77900] text-[#181818] font-bold text-xs inline-flex items-center gap-1 cursor-pointer hover:brightness-110"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Crear cliente ahora</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de Creación Inline */}
      <CustomerModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
};
