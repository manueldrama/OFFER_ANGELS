import React from 'react';
import { Check, ArrowRight, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Product } from '../../types';
import { EditableI18nText } from '../landing/EditableI18nText';
import { EditableTableText } from '../landing/EditableTableText';
import { EditableTableImage } from '../landing/EditableTableImage';

interface ProductCardProps {
    product: Product;
    isSelected: boolean;
    hasSelection?: boolean;
    onSelect: (id: string) => void;
    onConfirm?: (product: Product) => void;
    onInspect?: () => void;
    categoryLabel: string;
    isRecommended?: boolean;
}

const ProductCard = React.forwardRef<HTMLLabelElement, ProductCardProps>(({
    product,
    isSelected,
    hasSelection,
    onSelect,
    onConfirm,
    onInspect,
    categoryLabel,
    isRecommended
}, ref) => {
    const { t } = useTranslation(['offer']);

    // Legacy fallback for when DB fields aren't populated yet
    const isPro = product.id === 'pro' || product.name.toLowerCase().includes('pro');

    // Data-driven values with legacy fallbacks
    const recommended = product.isRecommended ?? isRecommended ?? false;
    const tags = product.use_case_tags && product.use_case_tags.length > 0
        ? product.use_case_tags
        : undefined; // Don't show tags section if no tags defined
    const speed = product.speed || (isPro ? '10s' : '15s');
    const capacityVal = product.capacity || (isPro ? '2x' : '1x');
    const capacityLbl = product.capacityLabel || (isPro ? t('offer:productCard.dualCup') : t('offer:productCard.singleCup'));

    // Visual weight for recommended product
    const isHighlighted = recommended || isPro;

    return (
        <label
            ref={ref}
            onClick={() => onSelect(product.id)}
            className={`relative flex flex-col cursor-pointer transition-all duration-300 overflow-hidden outline-none h-full rounded-lg md:rounded-md border
                ${isSelected
                    ? 'bg-white border-primary/20 z-10 shadow-[0_4px_20px_-4px_rgba(196,30,42,0.12)] md:-translate-y-1'
                    : hasSelection
                        ? 'bg-white/90 border-transparent opacity-70 md:blur-[0.5px] shadow-sm'
                        : 'bg-white border-slate-200/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.1)] hover:border-slate-300 md:hover:-translate-y-0.5'
                } ${isHighlighted ? 'md:flex-[1.08]' : 'md:flex-1'}`}

            style={!isSelected && !hasSelection ? { boxShadow: 'none' } : {}}
        >
            <input type="radio" name="model" className="sr-only" checked={isSelected} readOnly />

            {/* ──────── DESKTOP ONLY LAYOUT ──────── */}
            <div className="hidden md:flex flex-col h-full">
                {/* Image Section */}
                <div className="ofc-ms-img relative w-full aspect-video shrink-0 overflow-hidden bg-slate-900 rounded-t-md max-h-[30vh]">
                    <EditableTableImage
                        table="products"
                        rowId={product.id}
                        field="desktop_image"
                        src={product.desktopImage || product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />

                    {/* Recommended Badge */}
                    {(recommended || isPro) && (
                        <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-md bg-primary text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
                            {product.customBadge || t('offer:models.recommended')}
                        </div>
                    )}

                    {/* Selection Circle */}
                    <div className={`absolute top-4 right-4 z-10 w-[26px] h-[26px] rounded-full flex items-center justify-center transition-all duration-300 border-2 ${isSelected
                        ? 'bg-primary border-primary text-white'
                        : 'bg-white/90 border-slate-200 text-transparent'
                        }`}>
                        <Check size={14} strokeWidth={3} className={isSelected ? 'opacity-100' : 'opacity-0'} />
                    </div>
                </div>

                <div className="ofc-ms-body px-6 py-5 flex flex-col flex-1">
                    <div className="ofc-ms-titleblock mb-4 text-left">
                        <EditableTableText
                            table="products"
                            rowId={product.id}
                            field="name"
                            value={product.name}
                            tag="h3"
                            className="text-[18px] font-bold text-slate-900 tracking-tight leading-tight mb-1"
                        />
                        <EditableTableText
                            table="products"
                            rowId={product.id}
                            field="subtitle"
                            value={product.tagline || product.subtitle}
                            tag="p"
                            className="text-[12px] font-medium text-slate-400"
                        />
                    </div>

                    {/* Feature Tags — data-driven */}
                    {tags && tags.length > 0 && (
                        <div className="ofc-ms-tags flex gap-2 mb-6">
                            {tags.map((tag, i) => (
                                <div
                                    key={i}
                                    className={`ofc-ms-tag flex-1 h-9 rounded-md flex items-center justify-center font-bold text-[11px] transition-colors ${
                                        tag.active
                                            ? 'bg-primary/5 text-primary'
                                            : 'bg-slate-50 text-slate-300 line-through'
                                    }`}
                                >
                                    {tag.label}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="ofc-ms-stats grid grid-cols-2 border-t border-slate-100 pt-5 mb-6 flex-shrink-0">
                        <div className="flex flex-col items-center justify-center text-center">
                            <span className="font-extrabold text-slate-900 leading-none mb-1 tabular-nums tracking-tight text-[18px]">{speed}</span>
                            <span className="font-semibold text-slate-400 text-[10px]"><EditableI18nText i18nKey="offer:productCard.printSpeed" value={t('offer:productCard.printSpeed')} /></span>
                        </div>
                        <div className="flex flex-col items-center justify-center text-center border-l border-slate-100">
                            <span className="font-extrabold text-slate-900 leading-none mb-1 tabular-nums tracking-tight text-[18px]">{capacityVal}</span>
                            <span className="font-semibold text-slate-400 text-[10px]">{capacityLbl}</span>
                        </div>
                    </div>

                    {/* CTA — sadece Cihazı İncele. Müşteri ürün hikâyesi içine girmeden fiyata atlayamaz. */}
                    <div className="mt-auto space-y-2">
                        <div className="flex gap-2">
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (onInspect) onInspect();
                                }}
                                className={`ofc-ms-cta flex-1 py-3 px-4 rounded-md flex items-center justify-center gap-2 text-white font-bold transition-all duration-300 active:scale-[0.98] border border-primary text-sm ${isSelected
                                    ? 'bg-primary shadow-md shadow-primary/20'
                                    : 'bg-primary hover:bg-primary/90'
                                    }`}
                            >
                                <EditableI18nText i18nKey="offer:models.inspectButton" value={t('offer:models.inspectButton')} />
                            </button>
                        </div>

                        {/* Urgency Text */}
                        <div className="flex items-center justify-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            <span className="text-[11px] font-medium text-primary"><EditableI18nText i18nKey="offer:models.launchUrgency" value={t('offer:models.launchUrgency')} /></span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ──────── MOBILE ONLY LAYOUT ──────── */}
            <div className="md:hidden flex flex-col">
                {/* Image */}
                <div className="relative w-full aspect-video overflow-hidden bg-slate-100 rounded-t-lg">
                    <EditableTableImage
                        table="products"
                        rowId={product.id}
                        field="image"
                        src={product.desktopImage || product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />
                    {/* Recommended badge */}
                    {(recommended || isPro) && (
                        <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md bg-primary text-white text-[9px] font-bold uppercase tracking-wider shadow-sm">
                            {product.customBadge || t('offer:models.recommended')}
                        </div>
                    )}
                    {/* Selection check */}
                    <div className={`absolute top-3 right-3 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${isSelected
                        ? 'bg-primary border-primary text-white'
                        : 'bg-white/80 border-slate-200 text-transparent'
                    }`}>
                        <Check size={12} strokeWidth={3} className={isSelected ? 'opacity-100' : 'opacity-0'} />
                    </div>
                </div>

                {/* Content */}
                <div className="px-4 py-3 flex flex-col gap-2 items-center text-center">
                    <div>
                        <h3 className="text-[15px] font-bold text-slate-900 leading-tight">
                            <EditableTableText
                                table="products"
                                rowId={product.id}
                                field="name"
                                value={product.name}
                            />
                            {product.subtitle && (
                                <span className="text-slate-300 font-normal mx-1.5">|</span>
                            )}
                            {product.subtitle && (
                                <EditableTableText
                                    table="products"
                                    rowId={product.id}
                                    field="subtitle"
                                    value={product.subtitle}
                                    className="text-[12px] font-medium text-slate-400"
                                />
                            )}
                        </h3>
                    </div>

                    <div className="w-full border-t border-slate-100" />

                    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-sm ${isHighlighted
                        ? 'bg-orange-50 text-orange-600 border border-orange-100/50'
                        : 'bg-indigo-50 text-indigo-600 border border-indigo-100/50'
                    }`}>
                        {product.tagline || categoryLabel}
                    </span>

                    {/* Feature Tags — mobile */}
                    {tags && tags.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap justify-center">
                            {tags.map((tag, i) => (
                                <span
                                    key={i}
                                    className={`px-2 py-0.5 rounded text-[9px] font-semibold ${
                                        tag.active
                                            ? 'bg-primary/5 text-primary'
                                            : 'bg-slate-50 text-slate-300 line-through'
                                    }`}
                                >
                                    {tag.label}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Specs row */}
                    <div className="flex items-center justify-center gap-4">
                        <div className="flex items-baseline gap-1">
                            <span className="font-extrabold text-slate-900 text-[15px] tabular-nums">{speed}</span>
                            <span className="font-medium text-slate-400 text-[9px]"><EditableI18nText i18nKey="offer:productCard.printSpeed" value={t('offer:productCard.printSpeed')} /></span>
                        </div>
                        <span className="text-slate-200">|</span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-extrabold text-slate-900 text-[15px] tabular-nums">{capacityVal}</span>
                            <span className="font-medium text-slate-400 text-[9px]">{capacityLbl}</span>
                        </div>
                    </div>

                    {/* Urgency */}
                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-primary">
                        <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                        <EditableI18nText i18nKey="offer:productCard.launchStockUrgency" value={t('offer:productCard.launchStockUrgency')} />
                    </div>

                    {/* CTA — her zaman görünür birincil buton. Kartın tıklanabilir olduğunu netleştirir; tek dokunuş incelemeye götürür. */}
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onInspect) onInspect();
                        }}
                        className="w-full mt-1 py-3 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm shadow-primary/30 active:scale-[0.98] transition-all"
                    >
                        <EditableI18nText i18nKey="offer:models.inspectButton" value={t('offer:models.inspectButton')} />
                        <ArrowRight size={14} />
                    </button>
                </div>
            </div>
        </label >
    );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
