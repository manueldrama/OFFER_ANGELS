import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check, ChevronRight, MapPin, Search, ArrowRight, Upload, ArrowLeft, Phone, User, Plus, Minus,
  FileText, Settings, Rocket, FileCheck, ShieldCheck, Mail, Globe, Building2, Coffee, Store,
  UserPlus, FileSignature, ChevronDown, CheckCircle2, PlayCircle, Shield, Zap, Image as ImageIcon,
  Video, Link2, CreditCard, Clock, Calendar, PieChart, Info, AlertTriangle, HelpCircle, Layers,
  Copy, Palmtree, Cake, Cookie, PartyPopper, ShoppingBag, Briefcase, Wifi, Download, Ticket,
  MessageCircle, Package, Users, TrendingUp,
} from 'lucide-react';
import { EditableI18nText } from '../../landing/EditableI18nText';
import { getFeatureIcon } from '../../icons/FeatureIcons';
import { useOfferLocale } from '../../../contexts/OfferLocaleContext';
import { formatPrice } from '../../../utils/currency';
import type { Product, ProductDetailSection } from '../../../types';

// PDP'deki yerel helper'lar — copy to keep this component self-contained.
const isMediaVideo = (url?: string | null) => {
  if (!url) return false;
  const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.m4v'];
  return videoExts.some(ext => url.toLowerCase().includes(ext));
};

const renderTitleWithHighlight = (text: string | null | undefined): React.ReactNode => {
  if (!text) return null;
  const parts = text.split(/(\{.*?\})/g);
  return parts.map((part, index) => {
    if (part.startsWith('{') && part.endsWith('}')) {
      return <span key={index} className="text-primary">{part.slice(1, -1)}</span>;
    }
    return part;
  });
};

const ICON_MAP: Record<string, any> = {
  Check, ChevronRight, MapPin, Search, ArrowRight, Upload, ArrowLeft, Phone, User, Plus, Minus,
  FileText, Settings, Rocket, FileCheck, ShieldCheck, Mail, Globe, Building2, Coffee, Store,
  UserPlus, FileSignature, ChevronDown, CheckCircle2, PlayCircle, Shield, Zap, Image: ImageIcon,
  Video, Link2, CreditCard, Clock, Calendar, PieChart, Info, AlertTriangle, HelpCircle, Layers,
  Copy, Palmtree, Cake, Cookie, PartyPopper, ShoppingBag, Briefcase, Wifi, Download, Ticket,
  MessageCircle, Package, Users, TrendingUp,
};

const getIcon = (name: string | null | undefined, Fallback: any) => {
  if (!name) return Fallback;
  return ICON_MAP[name] || Fallback;
};

interface SectionRendererProps {
  section: ProductDetailSection;  // override'lar applied geliyor (applyFinalOfferOverrides)
  product: Product;
  context?: 'pdp' | 'final-offer';
}

export const SectionRenderer: React.FC<SectionRendererProps> = ({ section: sec, product, context = 'final-offer' }) => {
  const { t } = useTranslation('offer');
  const sType = sec.section_type;
  const sItems: any[] = (sec.items || []) as any[];
  const hideHeader = sec.hide_header_mobile === true;
  const bg = sec.bg_color_mobile || undefined;

  // ── features
  if (sType === 'features') {
    return (
      <div className="py-6 relative z-10 rounded-lg" style={{ background: bg || '#F8FAFC' }}>
        {!hideHeader && (
          <div className="text-center px-4 mb-4">
            <span className="text-[9px] font-bold text-primary uppercase tracking-[0.15em]">{sec.eyebrow || 'ÖNE ÇIKANLAR'}</span>
            <h3 className="text-[20px] font-[800] text-slate-900 tracking-tight leading-tight mt-0.5">{sec.title || 'Neden Bu Model?'}</h3>
          </div>
        )}
        <div className="grid px-4 gap-0" style={{ gridTemplateColumns: `repeat(${Math.min(sItems.length, 4)}, 1fr)` }}>
          {sItems.slice(0, 4).map((feat: any, i: number) => {
            const label = feat.title || feat.label;
            const CustomIcon = getFeatureIcon(feat.icon_name || feat.icon, label);
            const bigValue = feat.icon_value || feat.value_text || '';
            return (
              <div key={feat.id || i} className="flex flex-col items-center text-center py-3 relative">
                {i > 0 && <div className="absolute left-0 top-[20%] bottom-[20%] w-px bg-slate-200" />}
                {CustomIcon && (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <CustomIcon size={20} className="text-primary" />
                  </div>
                )}
                {bigValue && <span className="text-[18px] font-[800] text-slate-900 leading-none tracking-tight">{bigValue}</span>}
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.12em] mt-1 leading-tight px-1">{label}</span>
              </div>
            );
          })}
        </div>
        {sItems.some((f: any) => f.description) && (
          <div className="px-4 mt-3 space-y-2">
            {sItems.filter((f: any) => f.description).map((feat: any, i: number) => {
              const label = feat.title || feat.label;
              const CustomIcon = getFeatureIcon(feat.icon_name || feat.icon, label);
              return (
                <div key={feat.id || `desc-${i}`} className="flex items-start gap-3 bg-white rounded-lg border border-slate-100 p-3">
                  {CustomIcon && (
                    <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center shrink-0 mt-0.5">
                      <CustomIcon size={16} className="text-primary" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="text-[12px] font-bold text-slate-900 leading-tight">{renderTitleWithHighlight(label)}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{renderTitleWithHighlight(feat.description)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── features_desktop (PRO) — Horizontal scroll cards
  if (sType === 'features_desktop') {
    return (
      <div className="py-6 relative z-10 rounded-lg" style={{ background: bg || '#F8FAFC' }}>
        {!hideHeader && (
          <div className="text-center px-4 mb-4">
            <span className="text-[9px] font-bold text-primary uppercase tracking-[0.15em]">{sec.eyebrow || 'ÖNE ÇIKANLAR'}</span>
            <h3 className="text-[20px] font-[800] text-slate-900 tracking-tight leading-tight mt-0.5">{sec.title || 'Neden Bu Model?'}</h3>
          </div>
        )}
        <div className="flex gap-3 px-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1">
          {sItems.map((feat: any, i: number) => {
            const label = feat.title || feat.label;
            const CustomIcon = getFeatureIcon(feat.icon_name || feat.icon, label);
            const eyebrow = (typeof feat.icon === 'string' ? feat.icon : feat.icon_name) || '';
            const desc = feat.description;
            return (
              <div key={feat.id || i} className="flex-shrink-0 snap-start w-[75vw] max-w-[280px] bg-white border border-slate-100 rounded-lg overflow-hidden shadow-sm">
                {feat.media_url ? (
                  <div className="w-full aspect-[16/10] overflow-hidden bg-slate-100 relative">
                    <img src={feat.media_url} alt={label} className="w-full h-full object-cover" />
                  </div>
                ) : CustomIcon && (
                  <div className="w-full py-5 flex items-center justify-center bg-slate-50">
                    <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                      <CustomIcon size={22} className="text-primary" />
                    </div>
                  </div>
                )}
                <div className="p-3.5">
                  {eyebrow && <span className="text-[9px] font-bold text-primary uppercase tracking-wider">{eyebrow}</span>}
                  <h4 className="text-[13px] font-bold text-slate-900 leading-tight mt-0.5">{renderTitleWithHighlight(label)}</h4>
                  {desc && <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-3">{renderTitleWithHighlight(desc)}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── audience — 2-col cards
  if (sType === 'audience') {
    return (
      <div className="px-4 py-6 rounded-lg" style={{ background: bg || '#F8FAFC' }}>
        {!hideHeader && (
          <div className="text-center mb-4">
            <span className="text-[9px] font-bold text-primary uppercase tracking-[0.15em]">{sec.eyebrow || 'KIMLER İÇİN UYGUN?'}</span>
            <h3 className="text-[20px] font-[800] text-slate-900 tracking-tight leading-tight mt-0.5">{sec.title || 'Kimler İçin Uygun?'}</h3>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          {sItems.slice(0, 6).map((item: any, i: number) => {
            const DynIcon = item.icon ? (typeof item.icon === 'string' ? getIcon(item.icon, User) : item.icon) : User;
            return (
              <div key={item.id || i} className="bg-white rounded-lg overflow-hidden border border-slate-100 shadow-sm">
                {item.media_url ? (
                  <div className="aspect-[4/3] w-full overflow-hidden">
                    <img src={item.media_url} alt={item.title || ''} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-[4/3] w-full bg-slate-100 flex items-center justify-center">
                    {typeof DynIcon === 'function' ? <DynIcon size={24} className="text-slate-300" /> : null}
                  </div>
                )}
                <div className="p-2.5">
                  <h4 className="font-bold text-slate-900 text-[11px] leading-tight">{item.title}</h4>
                  {item.description && <p className="text-[9px] text-slate-400 mt-0.5 leading-tight line-clamp-2">{item.description}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── how_it_works
  if (sType === 'how_it_works') {
    const fallbackImages = ['/ig-post-1.webp', '/ig-post-2.webp', '/ig-post-3.webp'];
    return (
      <div className="py-6 rounded-lg" style={{ background: bg || '#FFFFFF' }}>
        {!hideHeader && (
          <div className="text-center px-4 mb-4">
            <span className="text-[9px] font-bold text-primary uppercase tracking-[0.15em]">{sec.eyebrow || 'Adım Adım'}</span>
            <h3 className="text-[20px] font-[800] text-slate-900 tracking-tight leading-tight mt-0.5">{sec.title || t('offer:configurator.howItWorks')}</h3>
          </div>
        )}
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 items-stretch px-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {sItems.map((step: any, idx: number) => {
            const StepIcon = (() => { try { const n = (typeof step.icon_name === 'string' && step.icon_name) || (typeof step.icon === 'string' && step.icon) || ''; return n ? getIcon(n, null) : null; } catch { return null; } })();
            const imageSrc = step.media_url || fallbackImages[idx % fallbackImages.length];
            return (
              <div key={step.id || idx} className="snap-start shrink-0 overflow-hidden" style={{ width: 'clamp(240px, 70vw, 380px)' }}>
                <div className="rounded-lg border overflow-hidden flex flex-col h-full" style={{ borderColor: '#E5E5E5', background: '#FFFFFF' }}>
                  <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/10' }}>
                    {isMediaVideo(imageSrc) ? (
                      <video src={imageSrc} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline />
                    ) : (
                      <img src={imageSrc} alt={step.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    <div className="absolute top-3 left-3 w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold text-white" style={{ background: '#C41E2A' }}>
                      {idx + 1}
                    </div>
                  </div>
                  <div className="p-3 flex flex-col shrink-0">
                    {StepIcon && (
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: '#FEF2F2' }}>
                        <StepIcon size={18} style={{ color: '#C41E2A' }} />
                      </div>
                    )}
                    <h4 className="font-bold text-[15px] mb-1 leading-tight" style={{ color: '#111111' }}>{step.title}</h4>
                    <p className="text-[12px] leading-snug" style={{ color: '#737373' }}>{step.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── faq (basit accordion — SmartFaqSearch yerine local accordion)
  if (sType === 'faq') {
    return <FaqBlock sec={sec} sItems={sItems} hideHeader={hideHeader} bg={bg} t={t} />;
  }

  // ── specs — 2-col value grid
  if (sType === 'specs') {
    return (
      <div className="px-4 py-6 rounded-lg" style={{ background: bg || '#FFFFFF' }}>
        {!hideHeader && (
          <div className="text-center mb-4">
            <h3 className="text-[20px] font-[800] text-slate-900 tracking-tight leading-tight">{sec.title || t('offer:configurator.technicalSpecs')}</h3>
          </div>
        )}
        {sItems.length > 0 && (
          <div className="grid grid-cols-2">
            {sItems.map((spec: any, idx: number) => {
              const v = spec.value_text || '';
              const k = spec.title || '';
              const row = Math.floor(idx / 2);
              const isLastRow = row === Math.floor((sItems.length - 1) / 2);
              return (
                <div
                  key={spec.id || idx}
                  className="flex flex-col items-center justify-center text-center py-4 relative"
                  style={{
                    borderBottom: isLastRow ? 'none' : '1px solid #F1F1F1',
                    borderRight: idx % 2 === 0 ? '1px solid #F1F1F1' : 'none',
                  }}
                >
                  <span className="text-[15px] font-[800] text-slate-900 leading-none tracking-tight">{v}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em] mt-1.5">{k}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── box_contents
  if (sType === 'box_contents') {
    return (
      <div className="px-4 py-6 rounded-lg" style={{ background: bg || '#F8FAFC' }}>
        {!hideHeader && (
          <h3 className="text-[20px] font-[800] text-slate-900 tracking-tight leading-tight mb-3 text-center">{sec.title || t('offer:configurator.boxContent')}</h3>
        )}
        <div className="bg-white rounded-lg border border-slate-100 p-4 space-y-2.5">
          {sItems.map((item: any) => (
            <div key={item.id} className="flex items-center gap-3 text-[12px] text-slate-700">
              <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0"><Check size={10} /></div>
              {item.title || item.description}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── roi_calculator (kendi state'i)
  if (sType === 'roi_calculator') {
    return <RoiBlock sec={sec} hideHeader={hideHeader} bg={bg} t={t} product={product} />;
  }

  // ── usage_scenarios — Instagram-style cards
  if (sType === 'usage_scenarios') {
    const scenarioItems = sItems.filter((i: any) => i.is_active !== false);
    if (scenarioItems.length === 0) return null;
    const igDefaults = [
      { user: 'selfie.latte.girl', location: 'Velvet & Roast Co.', color: '#DE2530', drinkType: 'Kahve' },
      { user: 'brandeddrinks.co', location: 'Copper House Bistro', color: '#1A73E8', drinkType: 'Kahve' },
      { user: 'happybirthdaycup', location: 'Bloom Garden Cafe', color: '#7C3AED', drinkType: 'Pasta' },
      { user: 'greencup.official', location: 'The Mossy Branch Club', color: '#0F9D58', drinkType: 'Matcha' },
      { user: 'nightpour.bar', location: 'Noir Lounge & Spirits', color: '#F4A234', drinkType: 'Kokteyl' },
      { user: 'morningespresso', location: 'Aurum Breakfast Club', color: '#DE2530', drinkType: 'Espresso' },
    ];
    return (
      <div className="flex flex-col py-6 rounded-lg" style={{ background: bg || '#FBFAF9' }}>
        {!hideHeader && (
          <div className="shrink-0 px-6 flex flex-col items-center text-center mb-4">
            <p className="text-[9px] font-bold text-primary uppercase tracking-[0.15em] mb-1">{sec.eyebrow || 'Kullanım Senaryoları'}</p>
            <h3 className="text-[20px] font-[800] text-slate-900 tracking-tight leading-tight mt-1 mb-1">{sec.title || 'Mekanınız İçin Değer Yaratın'}</h3>
            {sec.sub_text && <p className="text-[12px] leading-snug" style={{ color: '#737373' }}>{sec.sub_text}</p>}
          </div>
        )}
        <div className="px-6">
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {scenarioItems.map((s: any, i: number) => {
              const def = igDefaults[i % igDefaults.length];
              const imgSrc = s.media_url;
              const drinkType = (s.extra?.drink_type as string) || def.drinkType;
              const igUser = (s.extra?.ig_user as string) || def.user;
              const igLocation = (s.extra?.ig_location as string) || def.location;
              return (
                <div key={s.id || i} className="shrink-0 snap-start flex flex-col" style={{ width: 'clamp(200px, 55vw, 240px)' }}>
                  <div className="overflow-hidden flex flex-col" style={{ background: '#fff', borderRadius: 12, border: '1px solid #dbdbdb' }}>
                    <div className="flex items-center gap-2.5 px-2.5 py-2 shrink-0">
                      <div className="shrink-0 rounded-full p-[2px]" style={{ background: 'linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)' }}>
                        <div className="rounded-full overflow-hidden" style={{ width: 32, height: 32, background: '#fff', padding: 1.5 }}>
                          <div className="w-full h-full rounded-full overflow-hidden">
                            {imgSrc ? <img src={imgSrc} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-white text-[13px]" style={{ background: def.color }}>{igUser[0]?.toUpperCase()}</div>}
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold leading-tight truncate" style={{ color: '#262626', fontSize: 12 }}>{igUser}</p>
                        <p className="leading-tight truncate" style={{ color: '#8e8e8e', fontSize: 10 }}>{igLocation}</p>
                      </div>
                    </div>
                    {imgSrc ? (
                      <div className="w-full overflow-hidden shrink-0 relative" style={{ aspectRatio: '1/1' }}>
                        <img src={imgSrc} alt={s.title ?? ''} loading="lazy" className="w-full h-full object-cover" />
                        {drinkType && <span className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded text-white font-semibold text-[11px]" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)' }}>{drinkType}</span>}
                      </div>
                    ) : (
                      <div className="w-full shrink-0 flex items-center justify-center" style={{ aspectRatio: '1/1', background: '#fafafa' }}><span className="text-[11px] font-bold" style={{ color: '#8e8e8e' }}>Görsel Yok</span></div>
                    )}
                  </div>
                  <div className="mt-2.5 px-1">
                    {s.title && <p className="font-bold leading-snug" style={{ color: '#111111', fontSize: 14 }}>{s.title}</p>}
                    {s.description && <p className="leading-snug mt-0.5 line-clamp-2" style={{ color: '#737373', fontSize: 12 }}>{s.description}</p>}
                    {s.extra?.highlight && (
                      <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-1 rounded font-bold text-[12px]" style={{ background: '#FEF2F2', color: '#C41E2A' }}>
                        <TrendingUp size={11} /> {s.extra.highlight as string}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── visual_proof
  if (sType === 'visual_proof') {
    const visualItems = sItems.filter((i: any) => i.is_active !== false);
    const visualUrls = visualItems.map((i: any) => i.media_url).filter(Boolean);
    if (visualUrls.length === 0) return null;
    return (
      <div className="px-6 py-6 rounded-lg" style={{ background: bg || '#FFFFFF' }}>
        <div className="shrink-0 flex flex-col items-center text-center mb-4">
          <p className="text-[9px] font-bold text-primary uppercase tracking-[0.15em] mb-1">{sec.eyebrow || 'Görsel Kanıt'}</p>
          <h3 className="text-[20px] font-[800] text-slate-900 tracking-tight leading-tight mt-1 mb-1">{sec.title || 'Her İçeceğe Çalışır'}</h3>
          {sec.sub_text && <p className="text-[14px] leading-snug" style={{ color: '#737373' }}>{sec.sub_text}</p>}
        </div>
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-2 px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {visualUrls.map((url: string, idx: number) => (
            <div key={idx} className="shrink-0 snap-start">
              <div className="rounded-full overflow-hidden" style={{ width: 'clamp(120px, 32vw, 180px)', height: 'clamp(120px, 32vw, 180px)', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '3px solid rgba(0,0,0,0.04)' }}>
                <img src={url} alt={`Görsel ${idx + 1}`} loading="lazy" draggable={false} className="w-full h-full object-cover" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── video_gallery
  if (sType === 'video_gallery') {
    return (
      <div className="px-4 py-6 rounded-lg" style={{ background: bg || '#FFFFFF' }}>
        {!hideHeader && <h3 className="text-[20px] font-[800] text-slate-900 tracking-tight leading-tight mb-3 text-center">{sec.title || t('offer:configurator.videoGallery')}</h3>}
        {sItems.length > 0 ? (
          <div className="space-y-3">
            {sItems.map((vid: any) => (
              <div key={vid.id} className="w-full aspect-video bg-slate-900 rounded-lg overflow-hidden">
                {vid.media_url ? <iframe src={vid.media_url} className="w-full h-full" frameBorder="0" allowFullScreen /> : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-500"><PlayCircle size={40} className="mb-3 opacity-50" /></div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 bg-slate-50 rounded-lg border border-slate-100 text-slate-400">
            <PlayCircle size={32} className="mb-2 opacity-50" />
            <p className="text-[11px] font-medium">Video galeri yakında</p>
          </div>
        )}
      </div>
    );
  }

  // ── image_gallery
  if (sType === 'image_gallery') {
    return (
      <div className="px-4 py-6 rounded-lg" style={{ background: bg || '#F8FAFC' }}>
        {!hideHeader && <h3 className="text-[20px] font-[800] text-slate-900 tracking-tight leading-tight mb-3 text-center">{sec.title || t('offer:configurator.samplePrints')}</h3>}
        {sItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5">
            {sItems.map((img: any) => (
              <div key={img.id} className="aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                <img src={img.media_url || ''} alt={img.title || ''} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 bg-slate-50 rounded-lg border border-slate-100 text-slate-400">
            <ImageIcon size={32} className="mb-2 opacity-50" />
            <p className="text-[11px] font-medium">Art örnekleri yakında</p>
          </div>
        )}
      </div>
    );
  }

  return null;
};

// ── Sub-component: FAQ accordion (basit local accordion)
const FaqBlock: React.FC<{ sec: ProductDetailSection; sItems: any[]; hideHeader: boolean; bg: string | undefined; t: any }> = ({ sec, sItems, hideHeader, bg, t }) => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div className="px-6 py-6 rounded-lg" style={{ background: bg || '#FFFFFF' }}>
      {!hideHeader && (
        <div className="text-center mb-5">
          <p className="text-[9px] font-bold text-primary uppercase tracking-[0.15em] mb-1">{sec.eyebrow || 'Sık Sorulan Sorular'}</p>
          <h3 className="text-[20px] font-[800] text-slate-900 tracking-tight leading-tight mt-1">{sec.title || t('offer:configurator.faq')}</h3>
          {sec.sub_text && <p className="text-[13px] leading-relaxed mt-1" style={{ color: '#737373' }}>{sec.sub_text}</p>}
        </div>
      )}
      <div className="space-y-2">
        {sItems.map((f: any, i: number) => (
          <div key={f.id || i} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="w-full px-4 py-3 flex items-center justify-between text-left gap-3"
            >
              <span className="text-[13px] font-bold text-slate-900">{f.title}</span>
              <ChevronDown size={16} className={`text-slate-400 transition-transform ${openIdx === i ? 'rotate-180' : ''}`} />
            </button>
            {openIdx === i && f.description && (
              <div className="px-4 pb-3 text-[12px] text-slate-600 leading-relaxed border-t border-slate-100 pt-3">{f.description}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Sub-component: ROI Calculator (self-contained state)
const RoiBlock: React.FC<{ sec: ProductDetailSection; hideHeader: boolean; bg: string | undefined; t: any; product: Product }> = ({ sec, hideHeader, bg, t, product }) => {
  const { language, currency: localeCurrency } = useOfferLocale();
  const productLaunch = (product as any).launch_price || product.price || 0;
  const fp = (amount: number) => formatPrice(amount, ((product as any).currency || localeCurrency) as any, language);

  // Defaults
  const defaultPriceMin = 30, defaultPriceMax = 200, defaultPriceStep = 5;
  const [roiDailyCustomers, setRoiDailyCustomers] = useState(150);
  const [roiAvgPrice, setRoiAvgPrice] = useState(50);

  const projection = useMemo(() => {
    const upliftRate = 0.3; // %30 ek müşteri (modelle uyumlu varsayım)
    const dailyExtra = roiDailyCustomers * upliftRate * roiAvgPrice;
    const monthly = Math.round(dailyExtra * 30);
    const yearly = monthly * 12;
    const newCustomers = Math.round(roiDailyCustomers * upliftRate * 30);
    const amortizeMonths = monthly > 0 ? Math.ceil(productLaunch / monthly) : 0;
    return { monthly, yearly, newCustomers, amortizeMonths };
  }, [roiDailyCustomers, roiAvgPrice, productLaunch]);

  return (
    <div className="px-6 py-6 rounded-lg" style={{ background: bg || '#FFFFFF' }}>
      {!hideHeader && (
        <div className="text-center mb-4">
          <p className="text-[9px] font-bold text-primary uppercase tracking-[0.15em] mb-1">{sec.eyebrow || 'ROI Hesaplayıcı'}</p>
          <h3 className="text-[20px] font-[800] text-slate-900 tracking-tight leading-tight mt-1 mb-1">{sec.title || 'Yatırımın Geri Dönüşü'}</h3>
          {sec.sub_text && <p className="text-[13px] leading-relaxed" style={{ color: '#737373' }}>{sec.sub_text}</p>}
        </div>
      )}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E5E5E5' }}>
        <div className="p-6 space-y-6" style={{ borderBottom: '1px solid #E5E5E5' }}>
          {([
            { label: 'Günlük müşteri sayısı', value: roiDailyCustomers, set: setRoiDailyCustomers, min: 50, max: 500, step: 10, display: `${roiDailyCustomers} müşteri`, icon: <Users size={14} style={{ color: '#737373' }} /> },
            { label: 'Ortalama içecek fiyatı', value: roiAvgPrice, set: setRoiAvgPrice, min: defaultPriceMin, max: defaultPriceMax, step: defaultPriceStep, display: fp(roiAvgPrice), icon: <Coffee size={14} style={{ color: '#737373' }} /> },
          ] as const).map((s, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: '#111111' }}>{s.icon}{s.label}</span>
                <span className="text-[13px] font-bold rounded px-3 py-1" style={{ background: '#FBFAF9', color: '#111111' }}>{s.display}</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => s.set((v: number) => Math.max(s.min, v - s.step))} className="w-8 h-8 rounded-full border flex items-center justify-center" style={{ borderColor: '#E5E5E5' }}><Minus size={13} /></button>
                <input type="range" min={s.min} max={s.max} step={s.step} value={s.value} onChange={e => s.set(Number(e.target.value))} className="flex-1" />
                <button onClick={() => s.set((v: number) => Math.min(s.max, v + s.step))} className="w-8 h-8 rounded-full border flex items-center justify-center" style={{ borderColor: '#E5E5E5' }}><Plus size={13} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 grid grid-cols-2 gap-2" style={{ background: '#FAFAFA' }}>
          {[
            { label: 'Aylık ek gelir', value: fp(projection.monthly), highlight: true },
            { label: 'Yıllık ek gelir', value: fp(projection.yearly), highlight: false },
            { label: 'Yeni müşteri/ay', value: `+${projection.newCustomers}`, highlight: false },
            { label: 'Amortisman', value: projection.amortizeMonths > 0 ? `${projection.amortizeMonths} ay` : '—', highlight: false },
          ].map((o, i) => (
            <div key={i} className="rounded p-3 flex flex-col"
              style={{ background: o.highlight ? '#FEF2F2' : '#FFFFFF', border: o.highlight ? '1px solid rgba(196,30,42,0.15)' : '1px solid #E5E5E5' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#737373' }}>{o.label}</p>
              <p className="font-bold leading-none text-[16px]" style={{ color: o.highlight ? '#C41E2A' : '#111111' }}>{o.value}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-center mt-3" style={{ color: '#737373' }}>Projeksiyonlar tahmindir, gerçek sonuçlar değişebilir.</p>
    </div>
  );
};
