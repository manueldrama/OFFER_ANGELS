import {
    ImageIcon, Zap, ShieldCheck, Smartphone, Wifi, RotateCcw,
    QrCode, UploadCloud, Printer, Camera, Building2, Sparkles,
    Share2, Award, Coffee, Users, TrendingUp, Globe,
    Check, ChevronDown, ArrowRight, Minus, Plus,
    Star, Heart, MessageCircle, MapPin, Clock, Package,
    UtensilsCrossed, Cake, Wine, PartyPopper, Hotel,
    type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
    ImageIcon, Image: ImageIcon,
    Zap,
    ShieldCheck,
    Smartphone,
    Wifi,
    RotateCcw,
    QrCode,
    UploadCloud,
    Printer,
    Camera,
    Building2,
    Sparkles,
    Share2,
    Award,
    Coffee,
    Users,
    TrendingUp,
    Globe,
    Check,
    ChevronDown,
    ArrowRight,
    Minus,
    Plus,
    Star,
    Heart,
    MessageCircle,
    MapPin,
    Clock,
    Package,
    UtensilsCrossed,
    Cake,
    Wine,
    PartyPopper,
    Hotel,
};

export function resolveIcon(name: string | null | undefined): LucideIcon | null {
    if (!name) return null;
    return ICON_MAP[name] ?? null;
}

export const AVAILABLE_ICONS = Object.keys(ICON_MAP);
