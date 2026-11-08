import React, { useState } from 'react';
import { Product, PrepStation } from '../../types';
import { formatProductPrice } from '../../utils/productUtils';
import {
  Clock,
  Flame,
  Sparkles,
  ShoppingBag,
  Bike,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Plus,
  Layers,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  UtensilsCrossed,
  Lock,
} from 'lucide-react';

interface ProductCardProps {
  product: Product;
  prepStations: PrepStation[];
  onCustomize: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete?: (product: Product) => void;
  onToggleStatus?: (product: Product) => void;
  canManage?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  prepStations,
  onCustomize,
  onEdit,
  onDelete,
  onToggleStatus,
  canManage = true,
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [imageError, setImageError] = useState<boolean>(false);

  const prepStation = prepStations.find((s) => s.id === product.prepStationId);
  const hasCustomImages = Boolean(product.images && product.images.length > 0);
  const images = hasCustomImages ? product.images! : [];

  const hasVariants = product.variants && product.variants.length > 0;
  const isAgotado = product.status === 'agotado';
  const isInactivo = product.status === 'inactivo' || !product.isAvailableForSale;
  const isDailyMenu = Boolean(product.isDailyMenu || product.id === 'prod-almuerzo-del-dia');

  return (
    <div
      className={`group relative flex flex-col rounded-2xl bg-[#1e1e1e] border transition-all duration-200 overflow-hidden shadow-lg hover:shadow-2xl hover:border-[#B77900]/70 ${
        isDailyMenu
          ? 'border-[#B77900]/60 ring-1 ring-[#D6A21A]/30 bg-[#1e1a14]'
          : isInactivo
          ? 'opacity-65 border-[#333333]'
          : isAgotado
          ? 'border-red-900/40 bg-[#1e1818]'
          : 'border-[#2d2d2d]'
      }`}
    >
      {/* Visual Image Header (reducido 50%) */}
      <div className="relative w-full h-22 bg-[#141414] overflow-hidden select-none">
        {hasCustomImages && !imageError ? (
          <img
            src={images[activeImageIndex] || images[0]}
            alt={product.name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#151515] text-[#777]">
            <UtensilsCrossed className="w-7 h-7 mb-1 opacity-40 text-[#D6A21A]" />
            <span className="text-[10px] font-medium text-zinc-400">Sin fotografía</span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e1e] via-transparent to-black/30 pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
            {/* SKU Badge */}
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black tracking-wide border shadow-sm transition-all sku-badge bg-[#292212] text-[#D6A21A] border-[#B77900]/60">
              {product.sku || 'SIN-SKU'}
            </span>

            {/* Prep Station Badge */}
            {prepStation && (
              <span
                className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-sm flex items-center gap-1"
                style={{ backgroundColor: prepStation.color || '#ea580c' }}
                title={`Estación de preparación: ${prepStation.name}`}
              >
                <Flame className="w-3 h-3" />
                <span>{prepStation.code}</span>
              </span>
            )}
          </div>

          {/* Status Badge */}
          <div className="pointer-events-auto">
            {isDailyMenu ? (
              <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-500 to-[#D6A21A] text-[#181818] border border-[#B77900] text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <Sparkles className="w-3 h-3 text-[#181818] fill-current" />
                <span>Menú del Día</span>
              </span>
            ) : isAgotado ? (
              <span className="px-2 py-0.5 rounded-md bg-red-950/90 text-red-300 border border-red-700/60 text-[10px] font-black uppercase tracking-wider">
                Agotado
              </span>
            ) : isInactivo ? (
              <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px] font-black uppercase tracking-wider">
                Inactivo
              </span>
            ) : product.isCombo ? (
              <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-600 to-[#D6A21A] text-[#181818] text-[10px] font-black uppercase tracking-wider shadow">
                COMBO
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 text-[10px] font-bold">
                Activo
              </span>
            )}
          </div>
        </div>

        {/* Thumbnails if multiple images (up to 3) */}
        {images.length > 1 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm p-1 rounded-lg">
            {images.slice(0, 3).map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIndex(idx);
                }}
                className={`w-4 h-4 rounded-full overflow-hidden border transition-all ${
                  activeImageIndex === idx
                    ? 'border-[#D6A21A] scale-110'
                    : 'border-white/30 opacity-60 hover:opacity-100'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Estimated Prep Time */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-sm prep-time-badge bg-[#181818]/90 text-[#e7e5e4] border-[#383838]">
          <Clock className="w-3 h-3 text-[#D6A21A]" />
          <span>{product.prepTimeMinutes || 15} min</span>
        </div>
      </div>

      {/* Card Content */}
      <div className="flex flex-col flex-1 p-3.5 justify-between">
        <div>
          {/* Category & Branch Row */}
          <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
            <span className="font-medium text-[#D6A21A]/90 truncate">
              {product.categoryName || 'Gastronomía'}
            </span>
            <div className="flex items-center gap-1.5 text-[10px]">
              {product.isAvailableForDelivery && (
                <span title="Disponible para domicilio" className="text-emerald-400">
                  <Bike className="w-3.5 h-3.5" />
                </span>
              )}
              {product.isVisibleInMenu ? (
                <span title="Visible en Menú POS" className="text-zinc-400">
                  <Eye className="w-3.5 h-3.5" />
                </span>
              ) : (
                <span title="Oculto en Menú" className="text-amber-500">
                  <EyeOff className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
          </div>

          {/* Product Name */}
          <h3
            className="font-bold text-sm text-[#FFFDF5] group-hover:text-[#D6A21A] transition-colors line-clamp-1 cursor-pointer"
            onClick={() => (isDailyMenu ? onCustomize(product) : onEdit(product))}
            title={product.name}
          >
            {product.name}
          </h3>

          {/* Description */}
          <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed min-h-[2rem]">
            {product.description}
          </p>

          {isDailyMenu && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span className="px-2 py-0.5 rounded-md bg-[#292212] text-[#D6A21A] border border-[#B77900]/40 text-[9.5px] font-semibold">
                Sopa · Principio · Carne · 3 Acompañamientos · Bebida
              </span>
            </div>
          )}
        </div>

        {/* Footer: Price, Variants Info, and Actions */}
        <div className="mt-3 pt-2.5 border-t border-[#2a2a2a] flex items-center justify-between">
          <div>
            <div className="text-[10px] text-zinc-400">
              {hasVariants ? 'Desde' : isDailyMenu ? 'Menú Base' : 'Precio'}
            </div>
            <div className="text-base font-black text-[#D6A21A]">
              {formatProductPrice(product.price)}
            </div>
            {hasVariants && (
              <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                <Layers className="w-3 h-3 text-[#B77900]" />
                {product.variants.length} variantes
              </span>
            )}
            {product.isCombo && product.comboConfig && (
              <span className="text-[10px] text-emerald-400 font-bold block">
                ¡Ahorro ${product.comboConfig.savingsCOP?.toLocaleString('es-CO')}!
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {isDailyMenu ? (
              <>
                <span
                  className="px-2 py-1 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-400 text-[10px] font-bold flex items-center gap-1 shadow-sm"
                  title="Producto protegido: No editable ni borrable como producto regular. Sus parámetros se eligen al seleccionarlo."
                >
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span className="hidden sm:inline">Protegido</span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCustomize(product);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 via-[#D6A21A] to-[#B77900] text-[#181818] hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
                  title="Seleccionar y elegir parámetros establecidos del Menú del Día"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                  <span>Seleccionar Menú</span>
                </button>
              </>
            ) : (
              <>
                {canManage && onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(product);
                    }}
                    className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/80 text-red-400 hover:text-red-200 border border-red-800/40 transition-colors cursor-pointer"
                    title="Eliminar producto permanentemente"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onEdit(product)}
                  className="px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-[#B77900] to-[#D6A21A] text-[#181818] hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
