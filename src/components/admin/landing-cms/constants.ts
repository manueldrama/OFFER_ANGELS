import {
    Globe, BarChart3, HelpCircle, Layers, Calculator,
    Building2, Sparkles, ImageIcon, MessageSquareQuote, Megaphone, Instagram, MousePointerClick,
    Menu, ListTree, Smartphone,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface SectionTemplate {
    type: string;
    label: string;
    icon: LucideIcon;
}

export const SECTION_TEMPLATES: SectionTemplate[] = [
    { type: 'hero', label: 'Ana Sayfa (Hero)', icon: Globe },
    { type: 'stats', label: 'İstatistikler', icon: BarChart3 },
    { type: 'instagram_feed', label: 'Instagram Akışı', icon: Instagram },
    { type: 'how_it_works', label: 'Nasıl Çalışır?', icon: HelpCircle },
    { type: 'usage_scenarios', label: 'Kullanım Senaryoları', icon: Layers },
    { type: 'revenue_model', label: 'Gelir Modeli', icon: BarChart3 },
    { type: 'roi_calculator', label: 'ROI Hesaplayıcı', icon: Calculator },
    { type: 'use_cases', label: 'Kullanım Alanları', icon: Building2 },
    { type: 'features', label: 'Özellikler', icon: Sparkles },
    { type: 'visual_proof', label: 'Görsel Kanıt', icon: ImageIcon },
    { type: 'testimonials', label: 'Müşteri Sonuçları', icon: MessageSquareQuote },
    { type: 'header_nav', label: 'Header (Üst Menü)', icon: Menu },
    { type: 'footer_cta', label: 'Footer CTA', icon: Megaphone },
    { type: 'footer_nav', label: 'Footer (Alt Menü)', icon: ListTree },
    { type: 'faq', label: 'Sıkça Sorulanlar', icon: HelpCircle },
    { type: 'lead_capture_popup', label: 'Lead Capture Popup', icon: MousePointerClick },
    { type: 'sticky_mobile_cta', label: 'Mobil Sticky CTA Bar', icon: Smartphone },
];

export const LANGUAGE_COLORS: Record<string, string> = {
    tr: 'border-l-red-500',
    en: 'border-l-blue-500',
    de: 'border-l-amber-500',
    fr: 'border-l-violet-500',
    es: 'border-l-orange-500',
    pl: 'border-l-rose-500',
    it: 'border-l-emerald-500',
    ro: 'border-l-cyan-500',
};

export const LANGUAGE_DOT_COLORS: Record<string, string> = {
    tr: 'bg-red-500',
    en: 'bg-blue-500',
    de: 'bg-amber-500',
    fr: 'bg-violet-500',
    es: 'bg-orange-500',
    pl: 'bg-rose-500',
    it: 'bg-emerald-500',
    ro: 'bg-cyan-500',
};
