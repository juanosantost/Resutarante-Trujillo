import React, { useState, useRef } from 'react';
import { useAuth, DEFAULT_RECEIPT_CONFIG } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Branch, ReceiptConfig, BranchPrintConfig, DEFAULT_BRANCH_PRINT_CONFIG, PaperWidth, KitchenFontSize, LogoSize } from '../../types';
import { BranchReceiptHeader } from '../common/BranchReceiptHeader';
import { BranchReceiptPreviewModal, PreviewPosMode } from '../modals/BranchReceiptPreviewModal';
import { formatColombiaDateTime } from '../../utils/calculations';
import {
  clampPosFontSize,
  resolveBranchPrintConfig,
  MIN_POS_FONT_SIZE,
  MAX_POS_FONT_SIZE,
} from '../../utils/printConfigUtils';
import {
  validateLogoFile,
  compressLogoImage,
  estimateDataUrlSizeBytes,
  formatByteSize,
} from '../../utils/imageUtils';
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
  ChefHat,
  Type,
  Minus,
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
  const [city, setCity] = useState<string>('Restrepo (Valle)');
  const [notes, setNotes] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [taxRate, setTaxRate] = useState<number>(0.08);

  // Form state: Logotipo
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoError, setLogoError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state: Configuración de impresión de comprobantes (POS Cobro & POS Cocina)
  const [posConfigTab, setPosConfigTab] = useState<PreviewPosMode>('cobro');
  const [showLogo, setShowLogo] = useState<boolean>(true);
  const [logoSize, setLogoSize] = useState<LogoSize>('mediano');
  const [showTradeName, setShowTradeName] = useState<boolean>(true);
  const [showNit, setShowNit] = useState<boolean>(true);
  const [showAddress, setShowAddress] = useState<boolean>(true);
  const [showPhone, setShowPhone] = useState<boolean>(true);
  const [paperWidth, setPaperWidth] = useState<PaperWidth>('80mm');
  const [kitchenFontSize, setKitchenFontSize] = useState<KitchenFontSize>('extragrande');
  const [includeKitchenPrices, setIncludeKitchenPrices] = useState<boolean>(false);
  const [receiptTitleFontSize, setReceiptTitleFontSize] = useState<number>(16);
  const [receiptBodyFontSize, setReceiptBodyFontSize] = useState<number>(12);
  const [kitchenTitleFontSize, setKitchenTitleFontSize] = useState<number>(22);
  const [kitchenBodyFontSize, setKitchenBodyFontSize] = useState<number>(22);
  const [kitchenShowHeader, setKitchenShowHeader] = useState<boolean>(true);

  // Form state: Configuración DIAN
  const [headerText, setHeaderText] = useState<string>('SISTEMA COLMENA RESTAURANTE');
  const [footerText, setFooterText] = useState<string>('¡Gracias por su visita! Propina voluntaria según Ley 1935 de 2018.');
  const [resolutionDian, setResolutionDian] = useState<string>('Resolución DIAN No. 18764000129 de 2026');
  const [resolutionDate, setResolutionDate] = useState<string>('2026-01-15');
  const [prefix, setPrefix] = useState<string>('RES-');
  const [currentNumber, setCurrentNumber] = useState<number>(101);
  const [showTax, setShowTax] = useState<boolean>(true);
  const [showTip, setShowTip] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Estado para la vista previa modal
  const [previewBranch, setPreviewBranch] = useState<Branch | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [previewOverrideData, setPreviewOverrideData] = useState<any>(null);
  const [previewInitialMode, setPreviewInitialMode] = useState<PreviewPosMode>('cobro');

  const openCreateModal = () => {
    setEditingBranch(null);
    setName('');
    setNit('901.458.920-4');
    setAddress('');
    setPhone('+57 (602) 237-4589');
    setCity('Restrepo (Valle)');
    setNotes('');
    setIsActive(true);
    setTaxRate(0.08);

    // Reset logotipo
    setLogoUrl('');
    setLogoError('');

    // Reset controles de impresión
    setPosConfigTab('cobro');
    setShowLogo(true);
    setLogoSize('mediano');
    setShowTradeName(true);
    setShowNit(true);
    setShowAddress(true);
    setShowPhone(true);
    setPaperWidth('80mm');
    setKitchenFontSize('extragrande');
    setIncludeKitchenPrices(false);
    setReceiptTitleFontSize(16);
    setReceiptBodyFontSize(12);
    setKitchenTitleFontSize(22);
    setKitchenBodyFontSize(22);
    setKitchenShowHeader(true);

    // Reset DIAN
    setHeaderText('SISTEMA COLMENA RESTAURANTE');
    setFooterText('¡Gracias por su visita! Restrepo (Valle). Propina voluntaria según Ley 1935 de 2018.');
    setResolutionDian('Resolución DIAN No. 18764000129 de 2026');
    setResolutionDate('2026-01-15');
    setPrefix('RES-');
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
    setCity(b.city && !b.city.includes('Buga') ? b.city : 'Restrepo (Valle)');
    setNotes(b.notes || '');
    setIsActive(b.isActive ?? true);
    const isTaxActive = b.receiptConfig?.showTax !== false && b.taxRate !== 0;
    setTaxRate(isTaxActive ? (b.taxRate ?? 0.08) : 0);

    // Logotipo
    setLogoUrl(b.logoUrl || '');
    setLogoError('');

    // Impresión y Preferencias POS (Cobro y Cocina)
    const resolvedPrint = resolveBranchPrintConfig(b.printConfig);
    setPosConfigTab('cobro');
    setShowLogo(resolvedPrint.showLogo);
    setLogoSize(resolvedPrint.logoSize);
    setShowTradeName(resolvedPrint.showTradeName);
    setShowNit(resolvedPrint.showNit);
    setShowAddress(resolvedPrint.showAddress);
    setShowPhone(resolvedPrint.showPhone);
    setPaperWidth(resolvedPrint.paperWidth);
    setKitchenFontSize(resolvedPrint.kitchenFontSize);
    setIncludeKitchenPrices(resolvedPrint.includeKitchenPrices);
    setReceiptTitleFontSize(resolvedPrint.receiptTitleFontSize);
    setReceiptBodyFontSize(resolvedPrint.receiptBodyFontSize);
    setKitchenTitleFontSize(resolvedPrint.kitchenTitleFontSize);
    setKitchenBodyFontSize(resolvedPrint.kitchenBodyFontSize);
    setKitchenShowHeader(resolvedPrint.kitchenShowHeader);

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

  // Manejo de carga de logotipo con validación de tipo y compresión automática
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoError('');
    const file = e.target.files?.[0];
    if (!file) return;

    // Validación de formatos aceptados: PNG, JPG, JPEG, WEBP
    const validation = validateLogoFile(file);
    if (!validation.isValid) {
      const err = validation.error || 'Formato no compatible. Únicamente se aceptan imágenes en formato PNG, JPG o WEBP.';
      setLogoError(err);
      showToast(err, 'error');
      return;
    }

    try {
      showToast('Optimizando logotipo para comprobantes térmicos...', 'info');
      const { dataUrl, sizeBytes } = await compressLogoImage(file, {
        maxWidth: 360,
        maxHeight: 180,
        quality: 0.85,
        maxSizeBytes: 100 * 1024,
      });

      setLogoUrl(dataUrl);
      showToast(`Logotipo optimizado (${formatByteSize(sizeBytes)}) listo para guardar`, 'success');
    } catch (err: any) {
      console.error('Error optimizando logotipo:', err);
      const msg = err?.message || 'No fue posible procesar el archivo seleccionado.';
      setLogoError(msg);
      showToast(msg, 'error');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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

    // Validación de seguridad para Firestore: garantizar que el logotipo no exceda el límite de documento
    if (logoUrl.trim()) {
      const logoSizeBytes = estimateDataUrlSizeBytes(logoUrl.trim());
      if (logoSizeBytes > 350_000) {
        showToast(
          `El logotipo es demasiado pesado (${formatByteSize(logoSizeBytes)}) para guardarse en la base de datos. Por favor vuelve a cargarlo para que se optimice automáticamente.`,
          'warning'
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const derivedKitchenPreset: KitchenFontSize =
        kitchenTitleFontSize >= 21 ? 'extragrande' : kitchenTitleFontSize >= 17 ? 'grande' : 'compacto';

      const printConfig: BranchPrintConfig = {
        showLogo,
        logoSize,
        showTradeName,
        showNit,
        showAddress,
        showPhone,
        paperWidth,
        kitchenFontSize: derivedKitchenPreset,
        includeKitchenPrices,
        receiptTitleFontSize: clampPosFontSize(receiptTitleFontSize, 16),
        receiptBodyFontSize: clampPosFontSize(receiptBodyFontSize, 12),
        kitchenTitleFontSize: clampPosFontSize(kitchenTitleFontSize, 22),
        kitchenBodyFontSize: clampPosFontSize(kitchenBodyFontSize, 22),
        kitchenShowHeader,
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
  const handleOpenBranchPreview = (b: Branch, mode: PreviewPosMode = 'cobro') => {
    setPreviewBranch(b);
    setPreviewOverrideData(null);
    setPreviewInitialMode(mode);
    setIsPreviewModalOpen(true);
  };

  // Abrir vista previa desde los datos en vivo del formulario
  const handleOpenLiveFormPreview = (mode?: PreviewPosMode) => {
    setPreviewBranch(editingBranch);
    setPreviewInitialMode(mode || posConfigTab);
    setPreviewOverrideData({
      name: name.trim() || 'Nombre de la Sucursal',
      nit: nit.trim() || '901.458.920-4',
      address: address.trim() || 'Dirección Comercial',
      phone: phone.trim() || '+57 (602) 237-4589',
      logoUrl,
      printConfig: {
        showLogo,
        logoSize,
        showTradeName,
        showNit,
        showAddress,
        showPhone,
        paperWidth,
        kitchenFontSize,
        includeKitchenPrices,
        receiptTitleFontSize,
        receiptBodyFontSize,
        kitchenTitleFontSize,
        kitchenBodyFontSize,
        kitchenShowHeader,
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
          const config = resolveBranchPrintConfig(b.printConfig);
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
                      <span>Logotipo{config.showLogo ? ` (${config.logoSize || 'mediano'})` : ''}</span>
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

                    <span
                      className="text-[9.5px] px-2 py-0.5 rounded-md font-medium border flex items-center gap-1 bg-[#18231c] text-emerald-300 border-emerald-700/50"
                      title="Tamaños de letra para POS de Cobro (Títulos / Textos)"
                    >
                      <Receipt className="w-2.5 h-2.5" />
                      <span>Cobro: {config.receiptTitleFontSize}/{config.receiptBodyFontSize} pts</span>
                    </span>

                    <span
                      className="text-[9.5px] px-2 py-0.5 rounded-md font-medium border flex items-center gap-1 bg-[#292212] text-[#D6A21A] border-[#B77900]/40"
                      title="Tamaños de letra para POS de Cocina (Títulos / Textos)"
                    >
                      <ChefHat className="w-2.5 h-2.5" />
                      <span>Cocina: {config.kitchenTitleFontSize}/{config.kitchenBodyFontSize} pts</span>
                    </span>

                    <span
                      className={`text-[9.5px] px-2 py-0.5 rounded-md font-medium border flex items-center gap-1 ${
                        config.kitchenShowHeader
                          ? 'bg-[#292212] text-[#D6A21A] border-[#B77900]/40'
                          : 'bg-[#18231c] text-emerald-300 border-emerald-700/50'
                      }`}
                      title="Incluir datos y logotipo del local en el ticket de cocina"
                    >
                      <Building2 className="w-2.5 h-2.5" />
                      <span>
                        {config.kitchenShowHeader
                          ? 'Con info local cocina'
                          : 'Sin info local cocina (ahorro papel)'}
                      </span>
                    </span>

                    <span
                      className={`text-[9.5px] px-2 py-0.5 rounded-md font-medium border flex items-center gap-1 ${
                        config.includeKitchenPrices
                          ? 'bg-[#292212] text-[#D6A21A] border-[#B77900]/40'
                          : 'bg-[#201818] text-neutral-400 border-neutral-700/40'
                      }`}
                      title="Mostrar precios unitarios en el ticket de cocina"
                    >
                      <Receipt className="w-2.5 h-2.5" />
                      <span>{config.includeKitchenPrices ? 'Con precios cocina' : 'Sin precios cocina'}</span>
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
                      className="px-2.5 py-1.5 rounded-xl bg-[#242424] text-[#D6A21A] hover:bg-[#333333] border border-[#383838] cursor-pointer transition-all flex items-center gap-1.5 text-xs font-bold"
                      title="Configurar datos de la sucursal, tickets POS y preferencias de cocina"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Configurar Sede & Tickets</span>
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
                  onClick={() => handleOpenLiveFormPreview(posConfigTab)}
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
                      placeholder="Ej: Sede Restrepo (Valle) — Salón Principal"
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
                      placeholder="Cl. 10 # 8 - 20, Restrepo (Valle)"
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
                      placeholder="Restrepo (Valle)"
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
                  Cada sucursal gestiona su propio logotipo independiente. Se optimiza y redimensiona automáticamente para impresoras térmicas POS y almacenamiento en base de datos.
                </p>

                <div className="p-4 rounded-2xl bg-[#222222] border border-[#333333] flex flex-col sm:flex-row items-center gap-5">
                  {/* Vista Previa del Logotipo */}
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className="w-24 h-24 rounded-2xl bg-[#181818] border-2 border-dashed border-[#444] flex items-center justify-center overflow-hidden shadow-inner relative group">
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
                    {logoUrl && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-[10px] font-bold">
                        {formatByteSize(estimateDataUrlSizeBytes(logoUrl))}
                      </span>
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

                {/* Selector de Tamaño del Logotipo en Comprobantes */}
                <div className="p-3.5 rounded-2xl bg-[#222222] border border-[#333333] space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <label className="text-xs font-bold text-[#FFFDF5] flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-[#D6A21A]" />
                      <span>Tamaño del Logotipo en Comprobantes Térmicos:</span>
                    </label>
                    <span className="text-[11px] font-bold text-[#D6A21A] capitalize">
                      {logoSize === 'pequeno' ? 'Pequeño (Discreto)' : logoSize === 'mediano' ? 'Mediano (Equilibrado)' : 'Grande (Destacado)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#a8a29e]">
                    Ajusta las dimensiones del logotipo en las tirillas y facturas POS para que se aprecie con el tamaño deseado.
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { id: 'pequeno', label: 'Pequeño', desc: 'Discreto (48–64px)' },
                      { id: 'mediano', label: 'Mediano', desc: 'Equilibrado (80–112px)' },
                      { id: 'grande', label: 'Grande', desc: 'Destacado (128–176px)' },
                    ].map((sz) => (
                      <button
                        key={sz.id}
                        type="button"
                        onClick={() => setLogoSize(sz.id as LogoSize)}
                        className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                          logoSize === sz.id
                            ? 'bg-[#B77900] text-[#181818] border-[#D6A21A] font-black shadow-md'
                            : 'bg-[#181818] text-[#a8a29e] border-[#383838] hover:border-[#B77900]'
                        }`}
                      >
                        <span className="block font-black">{sz.label}</span>
                        <span className={`text-[10px] block mt-0.5 ${logoSize === sz.id ? 'text-[#181818]/90 font-bold' : 'text-[#777]'}`}>
                          {sz.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* SECCIÓN 3: CONFIGURACIÓN POS POR SUCURSAL (COBRO Y COCINA) */}
              <div className="space-y-4 pt-4 border-t border-[#333333]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs uppercase font-extrabold text-[#D6A21A] tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-4 h-4" />
                      <span>3. Configuración POS (Cobro y Cocina)</span>
                    </h4>
                    <p className="text-xs text-[#a8a29e] mt-0.5">
                      Configura por separado el formato y los puntos de letra para POS de Cobro y POS de Cocina.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenLiveFormPreview(posConfigTab)}
                    className="px-3 py-1.5 rounded-xl bg-[#242424] hover:bg-[#303030] border border-[#B77900]/50 text-xs text-[#D6A21A] font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Abrir Vista Previa y Ajustar</span>
                  </button>
                </div>

                {/* Selector de Sub-módulo POS: Cobro vs Cocina */}
                <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[#121214] border border-[#2d2d2d]">
                  <button
                    type="button"
                    onClick={() => setPosConfigTab('cobro')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      posConfigTab === 'cobro'
                        ? 'bg-[#B77900] text-[#181818] font-black shadow-md'
                        : 'text-[#a8a29e] hover:text-[#FFFDF5]'
                    }`}
                  >
                    <Receipt className="w-4 h-4" />
                    <span>POS de Cobro ({receiptTitleFontSize}/{receiptBodyFontSize} pts)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosConfigTab('cocina')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      posConfigTab === 'cocina'
                        ? 'bg-[#B77900] text-[#181818] font-black shadow-md'
                        : 'text-[#a8a29e] hover:text-[#FFFDF5]'
                    }`}
                  >
                    <ChefHat className="w-4 h-4" />
                    <span>POS de Cocina ({kitchenTitleFontSize}/{kitchenBodyFontSize} pts)</span>
                  </button>
                </div>

                {/* Selección de Ancho de Papel Térmico */}
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

                {posConfigTab === 'cobro' ? (
                  <div className="space-y-4">
                    {/* Tipografía POS de Cobro */}
                    <div className="p-3.5 rounded-2xl bg-[#222222] border border-[#333333] space-y-3">
                      <span className="text-xs font-bold text-[#FFFDF5] flex items-center gap-1.5">
                        <Type className="w-4 h-4 text-[#D6A21A]" />
                        <span>Tamaños de Letra en Puntos — POS de Cobro (Factura)</span>
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-[#181818] border border-[#333333] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#FFFDF5]">Títulos (Cobro)</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setReceiptTitleFontSize((v) => clampPosFontSize(v - 1, v))}
                                className="w-6 h-6 rounded bg-[#242424] border border-[#3a3a3a] flex items-center justify-center cursor-pointer"
                                aria-label="Disminuir títulos cobro"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min={MIN_POS_FONT_SIZE}
                                max={MAX_POS_FONT_SIZE}
                                value={receiptTitleFontSize}
                                onChange={(e) =>
                                  setReceiptTitleFontSize(clampPosFontSize(Number(e.target.value), receiptTitleFontSize))
                                }
                                className="w-11 bg-[#242424] border border-[#3a3a3a] rounded text-center text-xs font-mono font-black text-[#D6A21A] py-0.5"
                              />
                              <button
                                type="button"
                                onClick={() => setReceiptTitleFontSize((v) => clampPosFontSize(v + 1, v))}
                                className="w-6 h-6 rounded bg-[#242424] border border-[#3a3a3a] flex items-center justify-center cursor-pointer"
                                aria-label="Aumentar títulos cobro"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {[14, 16, 18, 20, 22].map((pt) => (
                              <button
                                key={pt}
                                type="button"
                                onClick={() => setReceiptTitleFontSize(pt)}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                                  receiptTitleFontSize === pt
                                    ? 'bg-[#B77900] text-[#181818] border-[#D6A21A] font-black'
                                    : 'bg-[#222222] text-[#a8a29e] border-[#383838]'
                                }`}
                              >
                                {pt} pts
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-[#181818] border border-[#333333] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#FFFDF5]">Textos Normales (Cobro)</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setReceiptBodyFontSize((v) => clampPosFontSize(v - 1, v))}
                                className="w-6 h-6 rounded bg-[#242424] border border-[#3a3a3a] flex items-center justify-center cursor-pointer"
                                aria-label="Disminuir textos cobro"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min={MIN_POS_FONT_SIZE}
                                max={MAX_POS_FONT_SIZE}
                                value={receiptBodyFontSize}
                                onChange={(e) =>
                                  setReceiptBodyFontSize(clampPosFontSize(Number(e.target.value), receiptBodyFontSize))
                                }
                                className="w-11 bg-[#242424] border border-[#3a3a3a] rounded text-center text-xs font-mono font-black text-[#D6A21A] py-0.5"
                              />
                              <button
                                type="button"
                                onClick={() => setReceiptBodyFontSize((v) => clampPosFontSize(v + 1, v))}
                                className="w-6 h-6 rounded bg-[#242424] border border-[#3a3a3a] flex items-center justify-center cursor-pointer"
                                aria-label="Aumentar textos cobro"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {[10, 12, 13, 14, 16].map((pt) => (
                              <button
                                key={pt}
                                type="button"
                                onClick={() => setReceiptBodyFontSize(pt)}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                                  receiptBodyFontSize === pt
                                    ? 'bg-[#B77900] text-[#181818] border-[#D6A21A] font-black'
                                    : 'bg-[#222222] text-[#a8a29e] border-[#383838]'
                                }`}
                              >
                                {pt} pts
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Los 5 Controles Independientes del Encabezado */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-[#FFFDF5] block">
                        Elementos Visibles en el Encabezado:
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Control 1: Mostrar logotipo con selector de tamaño */}
                        <div className="p-3 rounded-xl bg-[#222222] border border-[#333333] space-y-2">
                          <label className="flex items-center justify-between cursor-pointer">
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
                          {showLogo && (
                            <div className="pt-2 border-t border-[#333333] space-y-1">
                              <div className="flex justify-between items-center text-[10px] text-[#a8a29e]">
                                <span className="text-[#D6A21A] font-bold">Tamaño de Impresión:</span>
                                <span className="capitalize text-[#FFFDF5] font-semibold">{logoSize}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-1">
                                {[
                                  { id: 'pequeno', label: 'Pequeño' },
                                  { id: 'mediano', label: 'Mediano' },
                                  { id: 'grande', label: 'Grande' },
                                ].map((sz) => (
                                  <button
                                    key={sz.id}
                                    type="button"
                                    onClick={() => setLogoSize(sz.id as LogoSize)}
                                    className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                      logoSize === sz.id
                                        ? 'bg-[#B77900] text-[#181818] border-[#D6A21A] font-black shadow-sm'
                                        : 'bg-[#181818] text-[#a8a29e] border-[#383838] hover:border-[#B77900]'
                                    }`}
                                  >
                                    {sz.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

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
                  </div>
                ) : (
                  /* CONFIGURACIÓN INDEPENDIENTE: POS DE COCINA */
                  <div className="p-3.5 rounded-2xl bg-[#222222] border border-[#333333] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-bold text-[#FFFDF5] flex items-center gap-1.5">
                        <ChefHat className="w-4 h-4 text-[#D6A21A]" />
                        <span>Configuración de Impresión — POS de Cocina</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setKitchenBodyFontSize(kitchenTitleFontSize)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#181818] border border-[#B77900]/50 text-[#D6A21A] hover:bg-[#2a2a2a] cursor-pointer"
                      >
                        Igualar textos a {kitchenTitleFontSize} pts
                      </button>
                    </div>
                    <p className="text-[11px] text-[#a8a29e]">
                      Ajusta en puntos el tamaño de títulos (platos, mesa, orden) y textos normales (acompañamientos, notas, mesero y pie) en el ticket de cocina.
                    </p>

                    <label className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[#181818] border border-[#B77900]/40 hover:border-[#D6A21A] cursor-pointer transition-all">
                      <div className="flex items-start gap-2.5">
                        <Building2 className="w-4 h-4 text-[#D6A21A] shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs font-bold text-[#FFFDF5] block">
                            Incluir información del local en el ticket de cocina
                          </span>
                          <span className="text-[10px] text-[#a8a29e] block mt-0.5">
                            Muestra logotipo, nombre comercial, NIT, dirección y celular. Desactívalo para ahorrar papel en cada comanda.
                          </span>
                          <span
                            className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              kitchenShowHeader
                                ? 'bg-[#292212] text-[#D6A21A] border-[#B77900]/40'
                                : 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                            }`}
                          >
                            {kitchenShowHeader
                              ? 'Imprime datos del local'
                              : 'Ahorro de papel activo (sin datos del local)'}
                          </span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={kitchenShowHeader}
                        onChange={(e) => setKitchenShowHeader(e.target.checked)}
                        className="w-4 h-4 accent-[#B77900] cursor-pointer mt-0.5 shrink-0"
                      />
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-[#181818] border border-[#333333] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#FFFDF5]">Títulos (Cocina)</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setKitchenTitleFontSize((v) => clampPosFontSize(v - 1, v))}
                              className="w-6 h-6 rounded bg-[#242424] border border-[#3a3a3a] flex items-center justify-center cursor-pointer"
                              aria-label="Disminuir títulos cocina"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min={MIN_POS_FONT_SIZE}
                              max={MAX_POS_FONT_SIZE}
                              value={kitchenTitleFontSize}
                              onChange={(e) =>
                                setKitchenTitleFontSize(clampPosFontSize(Number(e.target.value), kitchenTitleFontSize))
                              }
                              className="w-11 bg-[#242424] border border-[#3a3a3a] rounded text-center text-xs font-mono font-black text-[#D6A21A] py-0.5"
                            />
                            <button
                              type="button"
                              onClick={() => setKitchenTitleFontSize((v) => clampPosFontSize(v + 1, v))}
                              className="w-6 h-6 rounded bg-[#242424] border border-[#3a3a3a] flex items-center justify-center cursor-pointer"
                              aria-label="Aumentar títulos cocina"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {[16, 18, 20, 22, 24, 26].map((pt) => (
                            <button
                              key={pt}
                              type="button"
                              onClick={() => setKitchenTitleFontSize(pt)}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                                kitchenTitleFontSize === pt
                                  ? 'bg-[#B77900] text-[#181818] border-[#D6A21A] font-black'
                                  : 'bg-[#222222] text-[#a8a29e] border-[#383838]'
                              }`}
                            >
                              {pt} pts
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-[#181818] border border-[#333333] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#FFFDF5]">Textos Normales (Cocina)</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setKitchenBodyFontSize((v) => clampPosFontSize(v - 1, v))}
                              className="w-6 h-6 rounded bg-[#242424] border border-[#3a3a3a] flex items-center justify-center cursor-pointer"
                              aria-label="Disminuir textos cocina"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min={MIN_POS_FONT_SIZE}
                              max={MAX_POS_FONT_SIZE}
                              value={kitchenBodyFontSize}
                              onChange={(e) =>
                                setKitchenBodyFontSize(clampPosFontSize(Number(e.target.value), kitchenBodyFontSize))
                              }
                              className="w-11 bg-[#242424] border border-[#3a3a3a] rounded text-center text-xs font-mono font-black text-[#D6A21A] py-0.5"
                            />
                            <button
                              type="button"
                              onClick={() => setKitchenBodyFontSize((v) => clampPosFontSize(v + 1, v))}
                              className="w-6 h-6 rounded bg-[#242424] border border-[#3a3a3a] flex items-center justify-center cursor-pointer"
                              aria-label="Aumentar textos cocina"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {[16, 18, 20, 22, 24, 26].map((pt) => (
                            <button
                              key={pt}
                              type="button"
                              onClick={() => setKitchenBodyFontSize(pt)}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                                kitchenBodyFontSize === pt
                                  ? 'bg-[#B77900] text-[#181818] border-[#D6A21A] font-black'
                                  : 'bg-[#222222] text-[#a8a29e] border-[#383838]'
                              }`}
                            >
                              {pt} pts
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <label className="flex items-center justify-between p-3 rounded-xl bg-[#181818] border border-[#333333] hover:border-[#B77900]/60 cursor-pointer transition-all">
                      <div className="flex items-center gap-2.5">
                        <Receipt className="w-4 h-4 text-[#D6A21A]" />
                        <div>
                          <span className="text-xs font-semibold text-[#FFFDF5] block">
                            Incluir precios de venta en el ticket de cocina
                          </span>
                          <span className="text-[10px] text-[#a8a29e]">
                            Desactivado por defecto para que cocina solo vea insumos y cantidades
                          </span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={includeKitchenPrices}
                        onChange={(e) => setIncludeKitchenPrices(e.target.checked)}
                        className="w-4 h-4 accent-[#B77900] cursor-pointer"
                      />
                    </label>
                  </div>
                )}

                {/* Previsualización en vivo integrada del modelo de ejemplo seleccionado */}
                <div className="p-4 rounded-2xl bg-[#0e0e10] border border-[#2d281e] space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold text-[#D6A21A] flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" />
                      <span>
                        {posConfigTab === 'cobro'
                          ? `Modelo POS de Cobro (${paperWidth} · ${receiptTitleFontSize}/${receiptBodyFontSize} pts):`
                          : `Modelo POS de Cocina (${paperWidth} · ${kitchenTitleFontSize}/${kitchenBodyFontSize} pts · ${
                              kitchenShowHeader ? 'Con info local' : 'Sin info local / ahorro papel'
                            }):`}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenLiveFormPreview(posConfigTab)}
                      className="text-[10px] text-[#FFFDF5] bg-[#242424] hover:bg-[#333] px-2.5 py-1 rounded-lg border border-[#444] cursor-pointer"
                    >
                      Expandir Vista Previa y Probar Impresión
                    </button>
                  </div>

                  {posConfigTab === 'cobro' ? (
                    <div
                      className="bg-[#fffdfa] text-black font-mono rounded-xl p-3.5 shadow-inner max-w-sm mx-auto space-y-2"
                      style={{ fontSize: `${receiptBodyFontSize}px`, lineHeight: 1.3 }}
                    >
                      <BranchReceiptHeader
                        overrideData={{
                          name,
                          nit,
                          address,
                          phone,
                          logoUrl,
                          printConfig: {
                            showLogo,
                            logoSize,
                            showTradeName,
                            showNit,
                            showAddress,
                            showPhone,
                            paperWidth,
                          },
                        }}
                        paperWidth={paperWidth}
                        titleFontSize={receiptTitleFontSize}
                        bodyFontSize={receiptBodyFontSize}
                      />
                      <div className="border-t border-dotted border-gray-300 pt-2 space-y-1">
                        <div className="flex justify-between font-bold">
                          <span>1x Hamburguesa Colmena</span>
                          <span>$ 32.000 COP</span>
                        </div>
                        <div
                          className="flex justify-between font-black border-t border-dotted border-gray-300 pt-1"
                          style={{ fontSize: `${receiptTitleFontSize}px` }}
                        >
                          <span>TOTAL:</span>
                          <span>$ 32.000 COP</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="bg-[#fffdfa] text-black font-mono rounded-xl p-3.5 shadow-inner max-w-sm mx-auto space-y-2"
                      style={{ fontSize: `${kitchenBodyFontSize}px`, lineHeight: 1.25 }}
                    >
                      {kitchenShowHeader && (
                        <div className="border-b border-dotted border-gray-300 pb-2">
                          <BranchReceiptHeader
                            overrideData={{
                              name,
                              nit,
                              address,
                              phone,
                              logoUrl,
                              printConfig: {
                                showLogo,
                                logoSize,
                                showTradeName,
                                showNit,
                                showAddress,
                                showPhone,
                                paperWidth,
                              },
                            }}
                            paperWidth={paperWidth}
                            titleFontSize={kitchenTitleFontSize}
                            bodyFontSize={kitchenBodyFontSize}
                          />
                        </div>
                      )}
                      <div
                        className="text-center font-black uppercase"
                        style={{ fontSize: `${kitchenTitleFontSize}px`, lineHeight: 1.2 }}
                      >
                        *** COMANDA DE COCINA ***
                      </div>
                      <div
                        className="text-center font-black uppercase"
                        style={{ fontSize: `${kitchenTitleFontSize}px`, lineHeight: 1.2 }}
                      >
                        MESA 4
                      </div>
                      <div className="border-y border-dotted border-gray-300 py-1 space-y-0.5">
                        <div className="flex flex-wrap justify-between gap-x-2">
                          <span className="font-bold">ORDEN:</span>
                          <span className="font-black" style={{ fontSize: `${kitchenTitleFontSize}px` }}>
                            #120
                          </span>
                        </div>
                        <div className="flex flex-wrap justify-between gap-x-2">
                          <span className="font-bold">MESERO:</span>
                          <span className="font-bold">Carlos Mendoza</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div
                          className="font-black uppercase"
                          style={{ fontSize: `${kitchenTitleFontSize}px`, lineHeight: 1.2 }}
                        >
                          1X MENÚ DEL DÍA
                        </div>
                        <div className="pl-3 font-bold">› Sopa de Pastas Casera</div>
                        <div className="pl-3 font-bold">› Pechuga a la Plancha</div>
                        <div className="p-1.5 border border-dotted border-gray-300 font-bold">
                          <span
                            className="block font-black"
                            style={{ fontSize: `${kitchenTitleFontSize}px`, lineHeight: 1.2 }}
                          >
                            ¡OJO COCINA!:
                          </span>
                          <span>SIN CEBOLLA</span>
                        </div>
                      </div>
                    </div>
                  )}
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
                  onClick={() => handleOpenLiveFormPreview(posConfigTab)}
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
          initialMode={previewInitialMode}
          onClose={() => setIsPreviewModalOpen(false)}
          onUpdatePrintConfig={(cfg) => {
            // Si la vista previa se abrió desde el formulario, sincronizar todos los controles
            if (isModalOpen) {
              setShowLogo(cfg.showLogo);
              if (cfg.logoSize) setLogoSize(cfg.logoSize);
              setShowTradeName(cfg.showTradeName);
              setShowNit(cfg.showNit);
              setShowAddress(cfg.showAddress);
              setShowPhone(cfg.showPhone);
              setPaperWidth(cfg.paperWidth);
              if (typeof cfg.includeKitchenPrices === 'boolean') {
                setIncludeKitchenPrices(cfg.includeKitchenPrices);
              }
              if (typeof cfg.kitchenShowHeader === 'boolean') {
                setKitchenShowHeader(cfg.kitchenShowHeader);
              }
              if (typeof cfg.receiptTitleFontSize === 'number') {
                setReceiptTitleFontSize(cfg.receiptTitleFontSize);
              }
              if (typeof cfg.receiptBodyFontSize === 'number') {
                setReceiptBodyFontSize(cfg.receiptBodyFontSize);
              }
              if (typeof cfg.kitchenTitleFontSize === 'number') {
                setKitchenTitleFontSize(cfg.kitchenTitleFontSize);
              }
              if (typeof cfg.kitchenBodyFontSize === 'number') {
                setKitchenBodyFontSize(cfg.kitchenBodyFontSize);
              }
            }
          }}
          onSavePrintConfig={
            !isModalOpen && previewBranch
              ? async (cfg) => {
                  const normalized = resolveBranchPrintConfig(cfg);
                  await updateBranchData(previewBranch.id, { printConfig: normalized });
                  showToast(
                    `Configuración POS de "${previewBranch.name}" guardada correctamente`,
                    'success'
                  );
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
