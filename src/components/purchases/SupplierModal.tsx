import React, { useState, useEffect } from 'react';
import { Supplier, DocumentType } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { useToast } from '../../context/ToastContext';
import { COUNTRY_DIAL_CODES } from '../../utils/creditAndLayawayUtils';
import { Building, X, Check, Mail, Phone, MapPin, FileText } from 'lucide-react';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSupplier?: Supplier | null;
  onSuccess?: (supplier: Supplier) => void;
  initialName?: string;
}

export const SupplierModal: React.FC<SupplierModalProps> = ({
  isOpen,
  onClose,
  editingSupplier,
  onSuccess,
  initialName = '',
}) => {
  const { createSupplier, updateSupplier } = useRestaurant();
  const { showToast } = useToast();

  const [documentType, setDocumentType] = useState<DocumentType>('NIT');
  const [documentNumber, setDocumentNumber] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [phoneCountryCode, setPhoneCountryCode] = useState<string>('+57');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [observations, setObservations] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (editingSupplier) {
      setDocumentType(editingSupplier.documentType || 'NIT');
      setDocumentNumber(editingSupplier.documentNumber || editingSupplier.document || '');
      setName(editingSupplier.name || '');
      setPhoneCountryCode(editingSupplier.phoneCountryCode || '+57');
      setPhoneNumber(editingSupplier.phoneNumber || editingSupplier.phone?.replace(/[^0-9]/g, '') || '');
      setAddress(editingSupplier.address || '');
      setEmail(editingSupplier.email || '');
      setObservations(editingSupplier.observations || '');
      setIsActive(editingSupplier.status === 'activo');
    } else {
      setDocumentType('NIT');
      setDocumentNumber('');
      setName(initialName || '');
      setPhoneCountryCode('+57');
      setPhoneNumber('');
      setAddress('');
      setEmail('');
      setObservations('');
      setIsActive(true);
    }
  }, [editingSupplier, isOpen, initialName]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!name.trim()) {
      showToast('El nombre o razón social del proveedor es obligatorio', 'error');
      return;
    }
    if (!documentNumber.trim()) {
      showToast('El NIT o número de documento es obligatorio', 'error');
      return;
    }
    if (!phoneNumber.trim()) {
      showToast('El número de celular o teléfono es obligatorio', 'error');
      return;
    }

    const cleanDigits = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanDigits.length < 7) {
      showToast('Ingrese un número de celular o teléfono válido (mínimo 7 dígitos)', 'error');
      return;
    }

    const fullPhone = `${phoneCountryCode} ${cleanDigits}`;
    const fullDocument = `${documentType} ${documentNumber.trim()}`;

    setIsSubmitting(true);

    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, {
          documentType,
          documentNumber: documentNumber.trim(),
          document: fullDocument,
          name: name.trim(),
          phoneCountryCode,
          phoneNumber: cleanDigits,
          phone: fullPhone,
          address: address.trim(),
          email: email.trim(),
          observations: observations.trim(),
          status: isActive ? 'activo' : 'inactivo',
          updatedAt: new Date().toISOString(),
        });
        showToast('Proveedor actualizado correctamente', 'success');
        onClose();
      } else {
        const newId = await createSupplier({
          branchId: 'all',
          documentType,
          documentNumber: documentNumber.trim(),
          document: fullDocument,
          name: name.trim(),
          phoneCountryCode,
          phoneNumber: cleanDigits,
          phone: fullPhone,
          address: address.trim(),
          email: email.trim(),
          observations: observations.trim(),
          status: 'activo',
        });

        showToast('Proveedor registrado con éxito', 'success');

        const createdObj: Supplier = {
          id: newId,
          branchId: 'all',
          documentType,
          documentNumber: documentNumber.trim(),
          document: fullDocument,
          name: name.trim(),
          phoneCountryCode,
          phoneNumber: cleanDigits,
          phone: fullPhone,
          address: address.trim(),
          email: email.trim(),
          observations: observations.trim(),
          status: 'activo',
          createdAt: new Date().toISOString(),
        };

        if (onSuccess) {
          onSuccess(createdObj);
        }
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error al guardar la información del proveedor', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCountry = COUNTRY_DIAL_CODES.find((c) => c.code === phoneCountryCode) || COUNTRY_DIAL_CODES[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative bg-[#181818] border border-[#B77900]/40 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden my-6">
        
        {/* Encabezado */}
        <div className="flex items-center justify-between p-5 border-b border-[#333333] bg-gradient-to-r from-[#181818] to-[#242424]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#292212] border border-[#B77900]/40 flex items-center justify-center text-[#D6A21A]">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#FFFDF5]">
                {editingSupplier ? 'Editar Ficha de Proveedor' : 'Registrar Nuevo Proveedor'}
              </h3>
              <p className="text-xs text-[#a8a29e]">
                Catálogo comercial multisucursal de insumos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#a8a29e] hover:text-[#FFFDF5] rounded-xl hover:bg-[#2d2d2d] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenedor del Formulario (Div para evitar anidación de forms) */}
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
                <option value="NIT">NIT (Empresas)</option>
                <option value="CC">Cédula Ciudadanía (CC)</option>
                <option value="CE">Cédula Extranjería (CE)</option>
                <option value="TI">Tarjeta Identidad (TI)</option>
                <option value="Pasaporte">Pasaporte</option>
                <option value="Otro">Otro Documento</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5">
                Número de NIT / Documento <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="Ej: 901.458.920-4 o 1114567890"
                className="w-full bg-[#121214] border border-[#333333] rounded-xl px-3 py-2.5 text-xs text-[#FFFDF5] placeholder:text-neutral-500 focus:outline-none focus:border-[#B77900]"
              />
            </div>
          </div>

          {/* Nombre / Razón Social */}
          <div>
            <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5">
              Nombre Comercial o Razón Social <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Distribuidora Avícola del Valle SAS"
              className="w-full bg-[#121214] border border-[#333333] rounded-xl px-3 py-2.5 text-xs text-[#FFFDF5] placeholder:text-neutral-500 focus:outline-none focus:border-[#B77900]"
            />
          </div>

          {/* Celular / WhatsApp con Indicativo */}
          <div>
            <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5">
              Celular / WhatsApp <span className="text-amber-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative">
                <select
                  value={phoneCountryCode}
                  onChange={(e) => setPhoneCountryCode(e.target.value)}
                  className="bg-[#121214] border border-[#333333] rounded-xl pl-2 pr-6 py-2.5 text-xs text-[#FFFDF5] appearance-none focus:outline-none focus:border-[#B77900] cursor-pointer"
                >
                  {COUNTRY_DIAL_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <span className="absolute right-2 top-3 text-[10px] text-[#a8a29e] pointer-events-none">▼</span>
              </div>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="315 123 4567"
                className="flex-1 bg-[#121214] border border-[#333333] rounded-xl px-3 py-2.5 text-xs text-[#FFFDF5] placeholder:text-neutral-500 focus:outline-none focus:border-[#B77900]"
              />
            </div>
            <p className="text-[10px] text-[#a8a29e] mt-1">
              Indicativo seleccionado: {selectedCountry.flag} {selectedCountry.country} ({selectedCountry.code}). No digite el +.
            </p>
          </div>

          {/* Dirección y Correo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5">
                Dirección Física
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Cl. 4 # 13 - 28, Buga"
                className="w-full bg-[#121214] border border-[#333333] rounded-xl px-3 py-2.5 text-xs text-[#FFFDF5] placeholder:text-neutral-500 focus:outline-none focus:border-[#B77900]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5">
                Correo Electrónico (Opcional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ventas@proveedor.com"
                className="w-full bg-[#121214] border border-[#333333] rounded-xl px-3 py-2.5 text-xs text-[#FFFDF5] placeholder:text-neutral-500 focus:outline-none focus:border-[#B77900]"
              />
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-bold text-[#d6d3d1] mb-1.5">
              Observaciones / Términos de Comercialización
            </label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={2}
              placeholder="Días de despacho, líneas de crédito acordadas, insumos principales..."
              className="w-full bg-[#121214] border border-[#333333] rounded-xl p-3 text-xs text-[#FFFDF5] placeholder:text-neutral-500 focus:outline-none focus:border-[#B77900]"
            />
          </div>

          {/* Estado Activo */}
          {editingSupplier && (
            <div className="flex items-center justify-between p-3.5 bg-[#121214] rounded-2xl border border-[#333333]">
              <div>
                <span className="text-xs font-bold text-[#FFFDF5]">Estado del Proveedor</span>
                <p className="text-[10px] text-[#a8a29e]">
                  Habilitado para registrar compras, anticipos y facturas a crédito
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  isActive ? 'bg-[#B77900]' : 'bg-neutral-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isActive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}

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
              <span>{isSubmitting ? 'Guardando...' : editingSupplier ? 'Actualizar Proveedor' : 'Guardar y Seleccionar'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
