import React, { useState, useRef } from 'react';
import { useAuth, DEFAULT_RECEIPT_CONFIG } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Branch, ReceiptConfig, BranchPrintConfig, DEFAULT_BRANCH_PRINT_CONFIG, PaperWidth } from '../../types';
import { BranchReceiptHeader } from '../common/BranchReceiptHeader';
import { BranchReceiptPreviewModal } from '../modals/BranchReceiptPreviewModal';
import { formatColombiaDateTime } from '../../utils/calculations';
import {
  Building2,
  Plus,
  Edit3,
  CheckCircle2,
  XCircle,
  Receipt,
  Phone,
  MapPin,
  Coins,
  FileText,
  X,
  Lock,
  Unlock,
  Sparkles,
  Upload,
  Trash2,
  Image as ImageIcon,
  Eye,
  Sliders,
  Check,
  Smartphone,
  Calendar,
  AlertCircle,
  Hash,
} from 'lucide-react';

export const BranchesManagementView: React.FC = () => {
  const {
    branches,
    currentBranch,
    setCurrentBranchId,
    createNewBranch,
    updateBranchData,
    currentUser,
  } = useAuth();
  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  // Form state: Información de la Sucursal
  const [name, setName] = useState<string>('');
  const [nit, setNit] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [city, setCity] = useState<string>('Guadalajara de Buga');
  const [notes, setNotes] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [taxRate, setTaxRate] = useState<number>(0.08);

  // Form state: Logotipo
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoError, setLogoError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state: Configuración de impresión de comprobantes (5 controles independientes)
  const [showLogo, setShowLogo] = useState<boolean>(true);
  const [showTradeName, setShowTradeName] = useState<boolean>(true);
  const [showNit, setShowNit] = useState<boolean>(true);
  const [showAddress, setShowAddress] = useState<boolean>(true);
  const [showPhone, setShowPhone] = useState<boolean>(true);
  const [paperWidth, setPaperWidth] = useState<PaperWidth>('80mm');

  // Form state: Configuración DIAN
  const [headerText, setHeaderText] = useState<string>('SISTEMA COLMENA RESTAURANTE');
  const [footerText, setFooterText] = useState<string>('¡Gracias por su visita! Propina voluntaria según Ley 1935 de 2018.');
  const [resolutionDian, setResolutionDian] = useState<string>('Resolución DIAN No. 18764000129 de 2026');
  const [resolutionDate, setResolutionDate] = useState<string>('2026-01-15');
  const [prefix, setPrefix] = useState<string>('BUG-');
  const [currentNumber, setCurrentNumber] = useState<number>(101);
  const [showTax, setShowTax] = useState<boolean>(true);
  const [showTip, setShowTip] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Estado para la vista previa modal
  const [previewBranch, setPreviewBranch] = useState<Branch | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [previewOverrideData, setPreviewOverrideData] = useState<any>(null);

  const openCreateModal = () => {
    setEditingBranch(null);
    setName('');
    setNit('901.458.920-4');
    setAddress('');
    setPhone('+57 (602) 237-4589');
    setCity('Guadalajara de Buga');
    setNotes('');
    setIsActive(true);
    setTaxRate(0.08);

    // Reset logotipo
    setLogoUrl('');
    setLogoError('');

    // Reset 5 controles de impresión
    setShowLogo(true);
    setShowTradeName(true);
    setShowNit(true);
    setShowAddress(true);
    setShowPhone(true);
    setPaperWidth('80mm');

    // Reset DIAN
    setHeaderText('SISTEMA COLMENA RESTAURANTE');
    setFooterText('¡Gracias por su visita! Guadalajara de Buga. Propina voluntaria según Ley 1935 de 2018.');
    setResolutionDian('Resolución DIAN No. 18764000129 de 2026');
    setResolutionDate('2026-01-15');
    setPrefix('SUC-');
    setCurrentNumber(1);
    setShowTax(true);
    setShowTip(true);

    setIsModalOpen(true);
  };

  const openEditModal = (b: Branch) => {
    setEditingBranch(b);
    setName(b.name);
    setNit(b.nit);
    setAddress(b.address);
    setPhone(b.phone);
    setCity(b.city || 'Guadalajara de Buga');
    setNotes(b.notes || '');
    setIsActive(b.isActive ?? true);
    const isTaxActive = b.receiptConfig?.showTax !== false && b.taxRate !== 0;
    setTaxRate(isTaxActive ? (b.taxRate ?? 0.08) : 0);

    // Logotipo
    setLogoUrl(b.logoUrl || '');
    setLogoError('');

    // 5 Controles de impresión
    const printConfig = b.printConfig || DEFAULT_BRANCH_PRINT_CONFIG;
    setShowLogo(printConfig.showLogo ?? true);
    setShowTradeName(printConfig.showTradeName ?? true);
    setShowNit(printConfig.showNit ?? true);
    setShowAddress(printConfig.showAddress ?? true);
    setShowPhone(printConfig.showPhone ?? true);
    setPaperWidth(printConfig.paperWidth || '80mm');

    // DIAN
    setHeaderText(b.receiptConfig?.headerText || 'SISTEMA COLMENA RESTAURANTE');
    setFooterText(b.receiptConfig?.footerText || '¡Gracias por su visita!');
    setResolutionDian(b.receiptConfig?.resolutionDian || '');
    setResolutionDate(b.receiptConfig?.resolutionDate || '');
    setPrefix(b.receiptConfig?.prefix || 'COL-');
    setCurrentNumber(b.receiptConfig?.currentNumber || 1);
    setShowTax(isTaxActive);
    setShowTip(b.receiptConfig?.showTip ?? true);

    setIsModalOpen(true);
  };

  // Manejo de carga de logotipo con validación de tipo y tamaño
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoError('');
    const file = e.target.files?.[0];
    if (!file) return;

    // Validación de formatos aceptados: PNG, JPG, JPEG, WEBP
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      const err = 'Formato no compatible. Únicamente se aceptan imágenes en formato PNG, JPG o WEBP.';
      setLogoError(err);
      showToast(err, 'error');
      return;
    }

    // Validación de tamaño: máximo 2.5 MB para almacenar de forma segura y eficiente
    const maxSizeInBytes = 2.5 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      const err = `El tamaño de la imagen (${(file.size / (1024 * 1024)).toFixed(2)} MB) supera el límite máximo permitido de 2.5 MB.`;
      setLogoError(err);
      showToast(err, 'error');
      return;
    }

    // Lectura persistente a Base64
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setLogoUrl(result);
      showToast('Logotipo cargado con éxito en la vista previa', 'success');
    };
    reader.onerror = () => {
      setLogoError('No fue posible procesar el archivo seleccionado.');
      showToast('Error al leer el archivo de imagen', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoUrl('');
    setLogoError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    showToast('Logotipo eliminado', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('El nombre comercial de la sucursal es obligatorio', 'warning');
      return;
    }
    if (!nit.trim()) {
      showToast('El NIT es obligatorio para facturación y comprobantes', 'warning');
      return;
    }
    if (!address.trim()) {
      showToast('La dirección de la sucursal es obligatoria', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const printConfig: BranchPrintConfig = {
        showLogo,
        showTradeName,
        showNit,
        showAddress,
        showPhone,
        paperWidth,
      };

      const receiptConfig: ReceiptConfig = {
        headerText: headerText.trim(),
        footerText: footerText.trim(),
        resolutionDian: resolutionDian.trim(),
        resolutionDate: resolutionDate.trim(),
        prefix: prefix.trim().toUpperCase(),
        currentNumber: Number(currentNumber) || 1,
        showTax,
        showTip,
      };

      const effectiveTaxRate = showTax ? (Number(taxRate) > 0 ? Number(taxRate) : 0.08) : 0;

      if (editingBranch) {
        // En edición: preservar estrictamente el ID y fecha original
        await updateBranchData(editingBranch.id, {
          name: name.trim(),
          nit: nit.trim(),
          address: address.trim(),
          phone: phone.trim(),
          city: city.trim(),
          notes: notes.trim(),
          logoUrl: logoUrl.trim(),
          isActive,
          status: isActive ? 'activa' : 'inactiva',
          taxRate: effectiveTaxRate,
          printConfig,
          receiptConfig,
        });
        showToast(`Sucursal "${name.trim()}" actualizada correctamente`, 'success');
      } else {
        // En creación: generar ID automáticamente
        await createNewBranch({
          name: name.trim(),
          nit: nit.trim(),
          address: address.trim(),
          phone: phone.trim(),
          city: city.trim(),
          notes: notes.trim(),
          logoUrl: logoUrl.trim(),
          taxRate: effectiveTaxRate,
          isActive,
          status: isActive ? 'activa' : 'inactiva',
          printConfig,
          receiptConfig,
        });
        showToast('Nueva sucursal creada con éxito', 'success');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error al guardar la sucursal', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (b: Branch) => {
    if (b.isActive && branches.filter((x) => x.isActive).length <= 1) {
      showToast('No puedes desactivar la única sucursal activa del sistema', 'error');
      return;
    }
    try {
      await updateBranchData(b.id, { isActive: !b.isActive });
      showToast(`Sucursal "${b.name}" ${b.isActive ? 'desactivada' : 'activada'} correctamente`, 'info');
    } catch (err: any) {
      console.error(err);
      showToast('Error al cambiar estado de la sucursal', 'error');
    }
  };

  // Abrir vista previa desde una sucursal existente
  const handleOpenBranchPreview = (b: Branch) => {
    setPreviewBranch(b);
    setPreviewOverrideData(null);
    setIsPreviewModalOpen(true);
  };

  // Abrir vista previa desde los datos en vivo del formulario
  const handleOpenLiveFormPreview = () => {
    setPreviewBranch(editingBranch);
    setPreviewOverrideData({
      name: name.trim() || 'Nombre de la Sucursal',
      nit: nit.trim() || '901.458.920-4',
      address: address.trim() || 'Dirección Comercial',
      phone: phone.trim() || '+57 (602) 237-4589',
      logoUrl,
      printConfig: {
        showLogo,
        showTradeName,
        showNit,
        showAddress,
        showPhone,
        paperWidth,
      },
      resolutionDian,
      footerText,
      prefix,
      currentNumber,
      showTax,
      taxRate: showTax ? (Number(taxRate) > 0 ? Number(taxRate) : 0.08) : 0,
    });
    setIsPreviewModalOpen(true);
  };

  const isUserAdmin = currentUser?.role === 'administrador';

  return (
    <div className="space-y-6">
      {/* Cabecera del Módulo */}
      <div className="bg-[#181818] p-5 sm:p-6 rounded-3xl border border-[#333333] text-[#FFFDF5] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#B77900] to-[#D6A21A] flex items-center justify-center text-[#181818] font-black shadow-lg">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-[#FFFDF5]">
                Administración de Sucursales y Comprobantes
              </h2>
              <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-[#B77900] text-[#181818]">
                Multisucursal
              </span>
            </div>
            <p className="text-xs text-[#a8a29e] mt-0.5">
              Administración de sedes comerciales, logotipo independiente, configuración de tirillas térmicas (58/80 mm) y DIAN.
            </p>
          </div>
        </div>

        {isUserAdmin && (
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs flex items-center gap-2 hover:brightness-110 shadow-lg shadow-[#B77900]/20 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Sucursal</span>
          </button>
        )}
      </div>

      {/* Grid de Sucursales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {branches.map((b) => {
          const isSelected = currentBranch?.id === b.id;
          const config = b.printConfig || DEFAULT_BRANCH_PRINT_CONFIG;
          return (
            <div
              key={b.id}
              className={`rounded-3xl border p-5 transition-all shadow-md relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? 'bg-[#181818] border-[#D6A21A] ring-1 ring-[#D6A21A]/30'
                  : 'bg-[#181818] border-[#333333] hover:border-[#B77900]/60'
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 right-0 bg-gradient-to-l from-[#B77900] to-[#D6A21A] text-[#181818] px-3 py-1 rounded-bl-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow">
                  <Sparkles className="w-3 h-3" />
                  <span>Sede en Operación</span>
                </div>
              )}

              <div>
                {/* Cabecera de la Sucursal con Logotipo */}
                <div className="flex items-start gap-3.5 mb-3.5 pr-28">
                  <div className="w-14 h-14 rounded-2xl bg-[#242424] border border-[#383838] flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                    {b.logoUrl ? (
                      <img
                        src={b.logoUrl}
                        alt={`Logotipo ${b.name}`}
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <Building2 className="w-7 h-7 text-[#D6A21A]/60" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#FFFDF5] leading-snug">{b.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-[#D6A21A] font-semibold mt-0.5">
                      <span>NIT: {b.nit || '901.458.920-4'}</span>
                      <span className="text-[#555] font-normal">•</span>
                      <span className="font-mono text-[10px] text-[#a8a29e]">ID: {b.id}</span>
                    </div>
                    {b.notes && (
                      <p className="text-[11px] text-[#a8a29e] italic mt-1 line-clamp-1">
                        "{b.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Datos de contacto y fiscales */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 py-3 border-y border-[#2a2a2a] text-xs text-[#d6d3d1]">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#B77900] shrink-0" />
                    <span className="truncate">{b.address}{b.city ? `, ${b.city}` : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#B77900] shrink-0" />
                    <span>{b.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Impoconsumo: {((b.receiptConfig?.showTax === false || b.taxRate === 0) ? 0 : ((b.taxRate ?? 0.08) * 100)).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        b.isActive
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-red-950 text-red-400 border border-red-800'
                      }`}
                    >
                      {b.isActive ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Activa</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" />
                          <span>Inactiva (Conserva Histórico)</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Configuración de Impresión de Comprobantes (Los 5 Controles + Papel) */}
                <div className="mt-3 p-3.5 rounded-2xl bg-[#222222] border border-[#2e2e2e] text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-[#D6A21A] flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Configuración de Comprobantes POS</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-mono font-bold bg-[#181818] text-[#D6A21A] border border-[#383838]">
                      Papel: {config.paperWidth || '80mm'}
                    </span>
                  </div>

                  {/* Badges de los 5 controles */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span
                      className={`text-[9.5px] px-2 py-0.5 rounded-md font-medium border flex items-center gap-1 ${
                        config.showLogo
                          ? 'bg-[#18231c] text-emerald-300 border-emerald-700/50'
                          : 'bg-[#201818] text-neutral-500 border-neutral-700/40 line-through'
                      }`}
                    >
                      <ImageIcon className="w-2.5 h-2.5" />
                      <span>Logotipo</span>
                    </span>

                    <span
                      className={`text-[9.5px] px-2 py-0.5 rounded-md font-medium border flex items-center gap-1 ${
                        config.showTradeName
                          ? 'bg-[#18231c] text-emerald-300 border-emerald-700/50'
                          : 'bg-[#201818] text-neutral-500 border-neutral-700/40 line-through'
                      }`}
                    >
                      <Building2 className="w-2.5 h-2.5" />
                      <span>Nombre</span>
                    </span>

                    <span
                      className={`text-[9.5px] px-2 py-0.5 rounded-md font-medium border flex items-center gap-1 ${
                        config.showNit
                          ? 'bg-[#18231c] text-emerald-300 border-emerald-700/50'
                          : 'bg-[#201818] text-neutral-500 border-neutral-700/40 line-through'
                      }`}
                    >
                      <FileText className="w-2.5 h-2.5" />
                      <span>NIT</span>
                    </span>

                    <span
                      className={`text-[9.5px] px-2 py-0.5 rounded-md font-medium border flex items-center gap-1 ${
                        config.showAddress
                          ? 'bg-[#18231c] text-emerald-300 border-emerald-700/50'
                          : 'bg-[#201818] text-neutral-500 border-neutral-700/40 line-through'
                      }`}
                    >
                      <MapPin className="w-2.5 h-2.5" />
                      <span>Dirección</span>
                    </span>

                    <span
                      className={`text-[9.5px] px-2 py-0.5 rounded-md font-medium border flex items-center gap-1 ${
                        config.showPhone
                          ? 'bg-[#18231c] text-emerald-300 border-emerald-700/50'
                          : 'bg-[#201818] text-neutral-500 border-neutral-700/40 line-through'
                      }`}
                    >
                      <Smartphone className="w-2.5 h-2.5" />
                      <span>Celular</span>
                    </span>
                  </div>

                  <div className="pt-1 flex items-center justify-between text-[10px] text-[#a8a29e] border-t border-[#2a2a2a]">
                    <span className="truncate max-w-[200px]">
                      {b.receiptConfig?.resolutionDian || 'Sin resolución registrada'}
                    </span>
                    <span className="font-mono">
                      Prefijo: <strong className="text-[#FFFDF5]">{b.receiptConfig?.prefix || 'COL-'}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Botones de acción de la tarjeta */}
              <div className="mt-4 pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#2a2a2a]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentBranchId(b.id)}
                    disabled={isSelected}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-[#292212] text-[#D6A21A] border border-[#B77900]/40 cursor-default'
                        : 'bg-[#222222] hover:bg-[#2e2e2e] text-[#FFFDF5] border border-[#383838] cursor-pointer'
                    }`}
                  >
                    {isSelected ? '✓ Sede Activa' : 'Cambiar a esta Sede'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenBranchPreview(b)}
                    className="px-2.5 py-1.5 rounded-xl bg-[#242424] hover:bg-[#2f2f2f] text-[#D6A21A] border border-[#383838] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                    title="Vista previa del comprobante"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Vista previa</span>
                  </button>
                </div>

                {isUserAdmin && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(b)}
                      className="p-1.5 rounded-xl bg-[#242424] text-[#D6A21A] hover:bg-[#333333] border border-[#383838] cursor-pointer transition-all"
                      title="Editar datos, logotipo y tirilla"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(b)}
                      className={`p-1.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        b.isActive
                          ? 'bg-red-950/40 text-red-400 border-red-800 hover:bg-red-950'
                          : 'bg-emerald-950/40 text-emerald-400 border-emerald-800 hover:bg-emerald-950'
                      }`}
                      title={b.isActive ? 'Desactivar sucursal (conserva histórico)' : 'Activar sucursal'}
                    >
                      {b.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Crear / Editar Sucursal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-[#181818] border border-[#B77900] rounded-3xl w-full max-w-3xl p-5 sm:p-6 text-[#FFFDF5] shadow-2xl max-h-[92vh] overflow-y-auto">
            
            {/* Cabecera del modal */}
            <div className="flex items-center justify-between pb-3.5 border-b border-[#333333] mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#B77900] to-[#D6A21A] flex items-center justify-center text-[#181818] font-black shadow-md">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-[#FFFDF5]">
                    {editingBranch ? `Editar Sucursal: ${editingBranch.name}` : 'Crear Nueva Sucursal'}
                  </h3>
                  <p className="text-xs text-[#a8a29e]">
                    {editingBranch ? `ID único inmutable: ${editingBranch.id}` : 'El ID único se generará automáticamente'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenLiveFormPreview}
                  className="px-3 py-1.5 rounded-xl bg-[#242424] hover:bg-[#303030] text-[#D6A21A] border border-[#B77900]/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                  title="Abrir vista previa del comprobante en tiempo real"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Vista previa del comprobante</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-[#a8a29e] hover:text-[#FFFDF5] p-1.5 rounded-xl hover:bg-[#262626] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* SECCIÓN 1: INFORMACIÓN DE LA SUCURSAL */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs uppercase font-extrabold text-[#D6A21A] tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" />
                    <span>1. Información Comercial de la Sucursal</span>
                  </h4>
                  {editingBranch?.createdAt && (
                    <span className="text-[10px] text-[#a8a29e] flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Creada: {formatColombiaDateTime(editingBranch.createdAt)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#a8a29e] mb-1">
                      Nombre Comercial de la Sucursal *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Sede Guadalajara de Buga — Salón Principal"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#a8a29e] mb-1">
                      NIT Tributario (Colombia) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="901.458.920-4"
                      value={nit}
                      onChange={(e) => setNit(e.target.value)}
                      className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#a8a29e] mb-1">
                      Celular o Teléfono *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="+57 (602) 237-4589"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#a8a29e] mb-1">
                      Dirección Comercial *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Cl. 4 # 13 - 28, Guadalajara de Buga"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#a8a29e] mb-1">
                      Ciudad o Municipio
                    </label>
                    <input
                      type="text"
                      placeholder="Guadalajara de Buga"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#a8a29e] mb-1">
                      Observaciones de la Sucursal
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Observaciones internas, horarios o especificaciones de operación de esta sede..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-[#242424] border border-[#383838] rounded-xl p-2.5 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#a8a29e] mb-1">
                      Estado de la Sucursal
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIsActive(true)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          isActive
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                            : 'bg-[#242424] text-[#a8a29e] border-[#383838]'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Activa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsActive(false)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          !isActive
                            ? 'bg-red-950 text-red-300 border-red-600 shadow-sm'
                            : 'bg-[#242424] text-[#a8a29e] border-[#383838]'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Inactiva</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#a8a29e] mb-1">
                      Tarifa Impoconsumo (0.08 = 8%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="0.5"
                      value={taxRate}
                      disabled={!showTax}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        const safeVal = isNaN(val) ? 0 : val;
                        setTaxRate(safeVal);
                        if (safeVal === 0) {
                          setShowTax(false);
                        } else {
                          setShowTax(true);
                        }
                      }}
                      className={`w-full bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A] ${
                        !showTax ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    />
                    {!showTax && (
                      <p className="text-[11px] text-amber-400/90 mt-1">
                        Impoconsumo desmarcado: los pedidos de esta sucursal no sumarán impuesto al total.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: CARGA Y ADMINISTRACIÓN DEL LOGOTIPO */}
              <div className="space-y-3 pt-4 border-t border-[#333333]">
                <h4 className="text-xs uppercase font-extrabold text-[#D6A21A] tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4" />
                  <span>2. Logotipo de la Sucursal</span>
                </h4>
                <p className="text-xs text-[#a8a29e]">
                  Cada sucursal gestiona su propio logotipo independiente. Formatos admitidos: PNG, JPG y WEBP (hasta 2.5 MB).
                </p>

                <div className="p-4 rounded-2xl bg-[#222222] border border-[#333333] flex flex-col sm:flex-row items-center gap-5">
                  {/* Vista Previa del Logotipo */}
                  <div className="w-24 h-24 rounded-2xl bg-[#181818] border-2 border-dashed border-[#444] flex items-center justify-center overflow-hidden shrink-0 shadow-inner relative group">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Vista previa logotipo"
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <div className="text-center p-2 text-[#777]">
                        <ImageIcon className="w-6 h-6 mx-auto mb-1 text-[#555]" />
                        <span className="text-[10px] block font-medium">Sin logo</span>
                      </div>
                    )}
                  </div>

                  {/* Acciones de carga / reemplazo / eliminación */}
                  <div className="space-y-2.5 flex-1 w-full text-center sm:text-left">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleLogoFileChange}
                      className="hidden"
                      id="branch-logo-file-input"
                    />

                    <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 rounded-xl bg-[#2a2a2a] hover:bg-[#383838] text-[#FFFDF5] text-xs font-bold border border-[#444] flex items-center gap-2 cursor-pointer transition-all"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#D6A21A]" />
                        <span>{logoUrl ? 'Reemplazar Logotipo' : 'Cargar Imagen desde Dispositivo'}</span>
                      </button>

                      {logoUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-950 text-red-300 border border-red-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar Logotipo</span>
                        </button>
                      )}
                    </div>

                    {logoError ? (
                      <p className="text-xs text-red-400 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{logoError}</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#78716c]">
                        Se conservará el logotipo existente al guardar cambios en otros datos comerciales.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* SECCIÓN 3: CONFIGURACIÓN DE IMPRESIÓN POR SUCURSAL */}
              <div className="space-y-3.5 pt-4 border-t border-[#333333]">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs uppercase font-extrabold text-[#D6A21A] tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-4 h-4" />
                    <span>3. Configuración de Impresión de Comprobantes</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleOpenLiveFormPreview}
                    className="text-xs text-[#D6A21A] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Vista previa en vivo</span>
                  </button>
                </div>
                <p className="text-xs text-[#a8a29e]">
                  Determina con precisión qué elementos aparecen en las tirillas y comprobantes térmicos impresos para esta sucursal.
                </p>

                {/* Selección de Ancho de Papel */}
                <div className="p-3.5 rounded-2xl bg-[#222222] border border-[#333333] space-y-2">
                  <label className="block text-xs font-bold text-[#FFFDF5]">
                    Ancho Predeterminado de Papel Térmico para Comprobantes:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaperWidth('58mm')}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                        paperWidth === '58mm'
                          ? 'bg-[#B77900] text-[#181818] border-[#D6A21A] shadow-md font-black'
                          : 'bg-[#181818] text-[#a8a29e] border-[#383838] hover:border-[#B77900]'
                      }`}
                    >
                      <div className="text-left">
                        <span className="block font-black">58 mm (Estrecho)</span>
                        <span className={`text-[10px] ${paperWidth === '58mm' ? 'text-[#181818]/80' : 'text-[#777]'}`}>
                          Impresoras térmicas compactas
                        </span>
                      </div>
                      {paperWidth === '58mm' && <Check className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaperWidth('80mm')}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                        paperWidth === '80mm'
                          ? 'bg-[#B77900] text-[#181818] border-[#D6A21A] shadow-md font-black'
                          : 'bg-[#181818] text-[#a8a29e] border-[#383838] hover:border-[#B77900]'
                      }`}
                    >
                      <div className="text-left">
                        <span className="block font-black">80 mm (Estándar POS)</span>
                        <span className={`text-[10px] ${paperWidth === '80mm' ? 'text-[#181818]/80' : 'text-[#777]'}`}>
                          Impresoras estándar de restaurante
                        </span>
                      </div>
                      {paperWidth === '80mm' && <Check className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Los 5 Controles Independientes (Interruptores / Checkboxes) */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-[#FFFDF5] block">
                    Elementos Visibles en el Encabezado:
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Control 1: Mostrar logotipo */}
                    <label className="flex items-center justify-between p-3 rounded-xl bg-[#222222] border border-[#333333] hover:border-[#B77900]/60 cursor-pointer transition-all">
                      <div className="flex items-center gap-2.5">
                        <ImageIcon className="w-4 h-4 text-[#D6A21A]" />
                        <span className="text-xs font-semibold text-[#FFFDF5]">Mostrar logotipo</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={showLogo}
                        onChange={(e) => setShowLogo(e.target.checked)}
                        className="w-4 h-4 accent-[#B77900] cursor-pointer"
                      />
                    </label>

                    {/* Control 2: Mostrar nombre comercial */}
                    <label className="flex items-center justify-between p-3 rounded-xl bg-[#222222] border border-[#333333] hover:border-[#B77900]/60 cursor-pointer transition-all">
                      <div className="flex items-center gap-2.5">
                        <Building2 className="w-4 h-4 text-[#D6A21A]" />
                        <span className="text-xs font-semibold text-[#FFFDF5]">Mostrar nombre comercial</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={showTradeName}
                        onChange={(e) => setShowTradeName(e.target.checked)}
                        className="w-4 h-4 accent-[#B77900] cursor-pointer"
                      />
                    </label>

                    {/* Control 3: Mostrar NIT */}
                    <label className="flex items-center justify-between p-3 rounded-xl bg-[#222222] border border-[#333333] hover:border-[#B77900]/60 cursor-pointer transition-all">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-[#D6A21A]" />
                        <span className="text-xs font-semibold text-[#FFFDF5]">Mostrar NIT</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={showNit}
                        onChange={(e) => setShowNit(e.target.checked)}
                        className="w-4 h-4 accent-[#B77900] cursor-pointer"
                      />
                    </label>

                    {/* Control 4: Mostrar dirección */}
                    <label className="flex items-center justify-between p-3 rounded-xl bg-[#222222] border border-[#333333] hover:border-[#B77900]/60 cursor-pointer transition-all">
                      <div className="flex items-center gap-2.5">
                        <MapPin className="w-4 h-4 text-[#D6A21A]" />
                        <span className="text-xs font-semibold text-[#FFFDF5]">Mostrar dirección</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={showAddress}
                        onChange={(e) => setShowAddress(e.target.checked)}
                        className="w-4 h-4 accent-[#B77900] cursor-pointer"
                      />
                    </label>

                    {/* Control 5: Mostrar celular */}
                    <label className="flex items-center justify-between p-3 rounded-xl bg-[#222222] border border-[#333333] hover:border-[#B77900]/60 cursor-pointer transition-all sm:col-span-2">
                      <div className="flex items-center gap-2.5">
                        <Smartphone className="w-4 h-4 text-[#D6A21A]" />
                        <span className="text-xs font-semibold text-[#FFFDF5]">Mostrar celular o teléfono</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={showPhone}
                        onChange={(e) => setShowPhone(e.target.checked)}
                        className="w-4 h-4 accent-[#B77900] cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* Previsualización en vivo integrada del encabezado en el formulario */}
                <div className="p-4 rounded-2xl bg-[#0e0e10] border border-[#2d281e] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-[#D6A21A] flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Encabezado en Vivo ({paperWidth}):</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleOpenLiveFormPreview}
                      className="text-[10px] text-[#FFFDF5] bg-[#242424] hover:bg-[#333] px-2.5 py-1 rounded-lg border border-[#444] cursor-pointer"
                    >
                      Ver Comprobante Completo
                    </button>
                  </div>

                  <div className="bg-[#fffdfa] rounded-xl p-3 shadow-inner max-w-sm mx-auto">
                    <BranchReceiptHeader
                      overrideData={{
                        name,
                        nit,
                        address,
                        phone,
                        logoUrl,
                        printConfig: {
                          showLogo,
                          showTradeName,
                          showNit,
                          showAddress,
                          showPhone,
                          paperWidth,
                        },
                      }}
                      paperWidth={paperWidth}
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 4: PARÁMETROS DIAN Y FACTURACIÓN POS */}
              <div className="space-y-3 pt-4 border-t border-[#333333]">
                <h4 className="text-xs uppercase font-extrabold text-[#D6A21A] tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-4 h-4" />
                  <span>4. Parámetros DIAN y Resolución POS</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#a8a29e] mb-1">
                      Resolución DIAN
                    </label>
                    <input
                      type="text"
                      placeholder="Resolución No. 18764000129 de 2026"
                      value={resolutionDian}
                      onChange={(e) => setResolutionDian(e.target.value)}
                      className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#a8a29e] mb-1">
                      Fecha de Resolución
                    </label>
                    <input
                      type="date"
                      value={resolutionDate}
                      onChange={(e) => setResolutionDate(e.target.value)}
                      className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#a8a29e] mb-1">
                      Prefijo de Factura (ej: BUG-, SUR-)
                    </label>
                    <input
                      type="text"
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value)}
                      className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] font-mono focus:outline-none focus:border-[#D6A21A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#a8a29e] mb-1">
                      Siguiente Número Consecutivo
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={currentNumber}
                      onChange={(e) => setCurrentNumber(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] font-mono focus:outline-none focus:border-[#D6A21A]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#a8a29e] mb-1">
                      Pie de Página del Recibo
                    </label>
                    <input
                      type="text"
                      value={footerText}
                      onChange={(e) => setFooterText(e.target.value)}
                      className="w-full bg-[#242424] border border-[#383838] rounded-xl px-3 py-2 text-xs text-[#FFFDF5] focus:outline-none focus:border-[#D6A21A]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex flex-wrap items-center gap-6">
                    <label className="flex items-center gap-2 text-xs text-[#FFFDF5] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showTax}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setShowTax(checked);
                          if (!checked) {
                            setTaxRate(0);
                          } else if (taxRate === 0) {
                            setTaxRate(0.08);
                          }
                        }}
                        className="accent-[#B77900] w-4 h-4 cursor-pointer"
                      />
                      <span className="font-semibold">Cobrar y discriminar Impoconsumo (8%)</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[#FFFDF5] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showTip}
                        onChange={(e) => setShowTip(e.target.checked)}
                        className="accent-[#B77900] w-4 h-4 cursor-pointer"
                      />
                      <span>Incluir Sugerencia de Propina (10%)</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-[#a8a29e] pl-6">
                    {showTax
                      ? 'Se liquidará y totalizará el impuesto al consumo en los pedidos y comprobantes POS de esta sucursal.'
                      : 'Desmarcado: los pedidos y facturas de esta sucursal NO liquidarán ni totalizarán impoconsumo (tarifa 0%).'}
                  </p>
                </div>
              </div>

              {/* Acciones de pie del modal */}
              <div className="pt-4 border-t border-[#333333] flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleOpenLiveFormPreview}
                  className="px-4 py-2 rounded-xl bg-[#242424] hover:bg-[#303030] border border-[#444] text-xs font-bold text-[#D6A21A] flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Vista Previa del Comprobante</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-[#383838] text-xs font-semibold text-[#a8a29e] hover:bg-[#222] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] font-black text-xs hover:brightness-110 shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting
                      ? 'Guardando...'
                      : editingBranch
                      ? 'Guardar Cambios de Sucursal'
                      : 'Crear Sucursal'}
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal de Vista Previa Térmica Reactiva */}
      {isPreviewModalOpen && (
        <BranchReceiptPreviewModal
          branch={previewBranch}
          overrideData={previewOverrideData}
          onClose={() => setIsPreviewModalOpen(false)}
          onUpdatePrintConfig={(cfg) => {
            // Si la vista previa se abrió desde el formulario, sincronizar los controles
            if (isModalOpen) {
              setShowLogo(cfg.showLogo);
              setShowTradeName(cfg.showTradeName);
              setShowNit(cfg.showNit);
              setShowAddress(cfg.showAddress);
              setShowPhone(cfg.showPhone);
              setPaperWidth(cfg.paperWidth);
            }
          }}
        />
      )}
    </div>
  );
};
