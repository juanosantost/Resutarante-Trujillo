import React, { useState, useEffect } from 'react';
import { Customer, DocumentType, CustomerStatus } from '../../types';
import { COUNTRY_DIAL_CODES } from '../../utils/creditAndLayawayUtils';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import {
  X,
  User,
  Phone,
  MapPin,
  FileText,
  ShieldCheck,
  Check,
  Building,
  AlertCircle,
} from 'lucide-react';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCustomer?: Customer | null;
  onSuccess?: (createdCustomer: Customer) => void;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  editingCustomer,
  onSuccess,
}) => {
  const { createCustomer, updateCustomer, customers, currentBranch } = useRestaurant();
  const { showToast } = useToast();

  const [documentType, setDocumentType] = useState<DocumentType>('CC');
  const [documentNumber, setDocumentNumber] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [phoneCountryCode, setPhoneCountryCode] = useState<string>('+57');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [neighborhood, setNeighborhood] = useState<string>('');
  const [observations, setObservations] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [dataProcessingAuthorized, setDataProcessingAuthorized] = useState<boolean>(true);
  const [marketingAuthorized, setMarketingAuthorized] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (editingCustomer) {
      setDocumentType(editingCustomer.documentType || 'CC');
      setDocumentNumber(editingCustomer.documentNumber || '');
      setName(editingCustomer.name || '');

      // Extraer indicativo y celular
      if (editingCustomer.phoneCountryCode && editingCustomer.phoneNumber) {
        setPhoneCountryCode(editingCustomer.phoneCountryCode);
        setPhoneNumber(editingCustomer.phoneNumber);
      } else if (editingCustomer.phone) {
        const parts = editingCustomer.phone.split(' ');
        if (parts.length > 1 && parts[0].startsWith('+')) {
          setPhoneCountryCode(parts[0]);
          setPhoneNumber(parts.slice(1).join(''));
        } else {
          setPhoneCountryCode('+57');
          setPhoneNumber(editingCustomer.phone.replace(/[^0-9]/g, ''));
        }
      } else {
        setPhoneCountryCode('+57');
        setPhoneNumber('');
      }

      setAddress(editingCustomer.address || '');
      setNeighborhood(editingCustomer.neighborhood || '');
      setObservations(editingCustomer.observations || '');
      setIsActive(editingCustomer.status === 'activo');
      setDataProcessingAuthorized(editingCustomer.consent?.dataProcessingAuthorized ?? true);
      setMarketingAuthorized(editingCustomer.consent?.marketingAuthorized ?? true);
    } else {
      // Valores por defecto para nuevo cliente
      setDocumentType('CC');
      setDocumentNumber('');
      setName('');
      setPhoneCountryCode('+57');
      setPhoneNumber('');
      setAddress('');
      setNeighborhood('');
      setObservations('');
      setIsActive(true);
      setDataProcessingAuthorized(true);
      setMarketingAuthorized(true);
    }
  }, [editingCustomer, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!name.trim()) {
      showToast('El nombre completo o razón social es obligatorio', 'error');
      return;
    }
    if (!documentNumber.trim()) {
      showToast('El número de documento o NIT es obligatorio', 'error');
      return;
    }
    if (!phoneNumber.trim()) {
      showToast('El número de celular es obligatorio', 'error');
      return;
    }

    // Limpiar dígitos de teléfono
    const cleanDigits = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanDigits.length < 7) {
      showToast('Ingrese un número de celular válido (mínimo 7 dígitos)', 'error');
      return;
    }

    const fullPhone = `${phoneCountryCode} ${cleanDigits}`;
    setIsSubmitting(true);

    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, {
          documentType,
          documentNumber: documentNumber.trim(),
          name: name.trim(),
          phoneCountryCode,
          phoneNumber: cleanDigits,
          phone: fullPhone,
          address: address.trim(),
          neighborhood: neighborhood.trim(),
          observations: observations.trim(),
          status: isActive ? 'activo' : 'inactivo',
          consent: {
            dataProcessingAuthorized,
            marketingAuthorized,
            authorizedAt: editingCustomer.consent?.authorizedAt || new Date().toISOString(),
          },
          updatedAt: new Date().toISOString(),
        });
        showToast('Cliente actualizado correctamente', 'success');
        onClose();
      } else {
        const newCustomerId = await createCustomer({
          branchId: 'all',
          documentType,
          documentNumber: documentNumber.trim(),
          name: name.trim(),
          phoneCountryCode,
          phoneNumber: cleanDigits,
          phone: fullPhone,
          address: address.trim(),
          neighborhood: neighborhood.trim(),
          observations: observations.trim(),
          consent: {
            dataProcessingAuthorized,
            marketingAuthorized,
            authorizedAt: new Date().toISOString(),
          },
        });

        showToast('Cliente registrado con éxito en Sistema Colmena', 'success');

        const createdObj: Customer = {
          id: newCustomerId,
          branchId: 'all',
          documentType,
          documentNumber: documentNumber.trim(),
          name: name.trim(),
          phoneCountryCode,
          phoneNumber: cleanDigits,
          phone: fullPhone,
          address: address.trim(),
          neighborhood: neighborhood.trim(),
          observations: observations.trim(),
          status: 'activo',
          consent: {
            dataProcessingAuthorized,
            marketingAuthorized,
            authorizedAt: new Date().toISOString(),
          },
          loyaltyPoints: 50,
          totalSpent: 0,
          visitsCount: 0,
          createdAt: new Date().toISOString(),
        };

        if (onSuccess) {
          onSuccess(createdObj);
        }
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error al guardar la información del cliente', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCountry = COUNTRY_DIAL_CODES.find((c) => c.code === phoneCountryCode) || COUNTRY_DIAL_CODES[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative bg-[#181818] border border-[#B77900]/40 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden my-6">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between p-5 border-b border-[#333333] bg-gradient-to-r from-[#181818] to-[#242424]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#292212] border border-[#B77900]/40 flex items-center justify-center text-[#D6A21A]">
              {documentType === 'NIT' ? <Building className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-black text-[#FFFDF5]">
                {editingCustomer ? 'Editar Ficha de Cliente' : 'Registrar Nuevo Cliente'}
              </h3>
              <p className="text-xs text-[#a8a29e]">
                {editingCustomer ? `ID: ${editingCustomer.id}` : 'Base de datos unificada multisucursal'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#a8a29e] hover:text-[#FFFDF5] rounded-xl hover:bg-[#2d2d2d] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario / Contenedor */}
        <div className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          
          {/* Tipo y Número de Documento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5">
                Tipo Documento <span className="text-amber-500">*</span>
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                className="w-full bg-[#121214] border border-[#333333] rounded-xl px-3 py-2.5 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
              >
                <option value="CC">Cédula Ciudadanía (CC)</option>
                <option value="NIT">NIT (Empresas)</option>
                <option value="CE">Cédula Extranjería (CE)</option>
                <option value="TI">Tarjeta Identidad (TI)</option>
                <option value="Pasaporte">Pasaporte</option>
                <option value="Otro">Otro Documento</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5">
                Número de Documento / NIT <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder={documentType === 'NIT' ? '901.458.920-4' : '1114567890'}
                className="w-full bg-[#121214] border border-[#333333] rounded-xl px-3.5 py-2.5 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
                required
              />
            </div>
          </div>

          {/* Nombre Completo o Razón Social */}
          <div>
            <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5">
              {documentType === 'NIT' ? 'Razón Social de la Empresa' : 'Nombre Completo del Cliente'} <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={documentType === 'NIT' ? 'Distribuidora del Valle SAS' : 'Carlos Alberto Gómez Restrepo'}
              className="w-full bg-[#121214] border border-[#333333] rounded-xl px-3.5 py-2.5 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
              required
            />
          </div>

          {/* Selector de Indicativo Internacional y Celular */}
          <div>
            <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5">
              Celular / WhatsApp <span className="text-amber-500">*</span>
            </label>
            <div className="flex gap-2">
              {/* Selector de País con Bandera */}
              <div className="relative w-36 flex-shrink-0">
                <select
                  value={phoneCountryCode}
                  onChange={(e) => setPhoneCountryCode(e.target.value)}
                  className="w-full bg-[#121214] border border-[#333333] rounded-xl pl-3 pr-6 py-2.5 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900] appearance-none cursor-pointer"
                >
                  {COUNTRY_DIAL_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <span className="absolute right-2.5 top-3 text-[10px] pointer-events-none text-[#a8a29e]">
                  ▼
                </span>
              </div>

              {/* Input de Dígitos de Celular */}
              <div className="relative flex-1">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder={selectedCountry.maskExample}
                  className="w-full bg-[#121214] border border-[#333333] rounded-xl px-3.5 py-2.5 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
                  required
                />
              </div>
            </div>
            <p className="text-[10px] text-[#a8a29e] mt-1">
              Indicativo seleccionado: {selectedCountry.flag} {selectedCountry.country} ({phoneCountryCode}). No digite el símbolo +.
            </p>
          </div>

          {/* Dirección y Barrio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5">
                Dirección
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Cl. 4 # 13 - 28"
                className="w-full bg-[#121214] border border-[#333333] rounded-xl px-3.5 py-2.5 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5">
                Barrio o Zona
              </label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="El Albergue / Centro"
                className="w-full bg-[#121214] border border-[#333333] rounded-xl px-3.5 py-2.5 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900]"
              />
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5">
              Observaciones / Preferencias
            </label>
            <textarea
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Preferencias en mesas, alergias, acuerdos de pago o eventos especiales..."
              className="w-full bg-[#121214] border border-[#333333] rounded-xl p-3 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#B77900] resize-none"
            />
          </div>

          {/* Estado Activo / Inactivo */}
          <div className="p-3 bg-[#121214] rounded-2xl border border-[#2d281e] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#FFFDF5]">Estado del Cliente</span>
              <p className="text-[10px] text-[#a8a29e]">
                {isActive ? 'Activo para ventas, separados y créditos' : 'Inactivo (conserva movimientos históricos)'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                isActive ? 'bg-[#B77900]' : 'bg-[#333333]'
              }`}
            >
              <div
                className={`bg-[#181818] w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  isActive ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Habeas Data y Consentimiento */}
          <div className="space-y-2 pt-2 border-t border-[#333333]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dataProcessingAuthorized}
                onChange={(e) => setDataProcessingAuthorized(e.target.checked)}
                className="rounded border-[#444444] text-[#B77900] focus:ring-[#B77900] bg-[#121214]"
              />
              <span className="text-[11px] text-[#d6d3d1]">
                Autoriza tratamiento de datos personales (Habeas Data - Ley 1581)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={marketingAuthorized}
                onChange={(e) => setMarketingAuthorized(e.target.checked)}
                className="rounded border-[#444444] text-[#B77900] focus:ring-[#B77900] bg-[#121214]"
              />
              <span className="text-[11px] text-[#d6d3d1]">
                Autoriza recepción de promociones por WhatsApp y beneficios de fidelización
              </span>
            </label>
          </div>

          {/* Botones de Acción */}
          <div className="pt-4 border-t border-[#333333] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-[#444444] text-[#d6d3d1] hover:bg-[#2d2d2d] text-xs font-bold cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs inline-flex items-center gap-2 hover:brightness-110 shadow-lg cursor-pointer transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Guardando...' : editingCustomer ? 'Actualizar Cliente' : 'Guardar y Seleccionar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
