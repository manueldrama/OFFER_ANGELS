import { supabase } from '../../lib/supabase/client';

// ─── Offer Page Theme Config ──────────────────────────────────────────────────
export interface OfferThemeConfig {
    // Colors
    primary: string;
    primaryDark: string;
    background: string;
    surface: string;
    surfaceElevated: string;
    text: string;
    textMuted: string;
    border: string;
    cta: string;
    ctaText: string;
    ctaHover: string;
    accent: string;
    accentLight: string;
    success: string;
    // Typography
    fontHeading: string;
    fontBody: string;
    fontSizeBase: string;
    fontWeightHeading: string;
    letterSpacing: string;
    // Layout
    layout: 'tabs' | 'sidebar' | 'hero-scroll' | 'two-column'; // masaüstü layout tipi
    containerMaxWidth: string;
    sectionSpacing: string;
    // Shape & Effects
    radius: string;
    radiusLg: string;
    radiusCard: string;
    shadow: string;
    shadowCard: string;
    shadowBtn: string;
    // Navbar
    navbarBg: string;
    navbarBorder: string;
    navbarStyle: 'floating' | 'sticky' | 'transparent';
    // Cards
    cardStyle: 'flat' | 'elevated' | 'outlined' | 'glass';
    cardBg: string;
    cardBorder: string;
    // Buttons
    btnStyle: 'filled' | 'pill' | 'sharp' | 'ghost-border';
    btnRadius: string;
    // Animations
    animationSpeed: 'none' | 'fast' | 'normal' | 'slow';
    // Background decorations
    bgDecoration: 'none' | 'gradient-mesh' | 'dots' | 'noise' | 'aurora';
}

// ─── Admin Panel Theme Config ─────────────────────────────────────────────────
export interface AdminThemeConfig {
    // Sidebar
    sidebarBg: string;
    sidebarText: string;
    sidebarTextMuted: string;
    sidebarActive: string;
    sidebarActiveBg: string;
    sidebarHover: string;
    sidebarBorder: string;
    sidebarWidth: string;
    sidebarStyle: 'dark' | 'light' | 'colored';
    // Main area
    mainBg: string;
    cardBg: string;
    cardBorder: string;
    cardRadius: string;
    // Accent
    accent: string;
    accentDark: string;
    accentLight: string;
    // Typography
    fontFamily: string;
    // Table
    tableHeaderBg: string;
    tableRowHover: string;
    // Status colors
    statusNew: string;
    statusActive: string;
    statusWon: string;
    statusLost: string;
}

export interface ThemeConfig {
    offer: OfferThemeConfig;
    admin: AdminThemeConfig;
}

export interface AppTheme {
    id: string;
    name: string;
    description: string | null;
    scope: 'offer' | 'admin' | 'both';
    config: ThemeConfig;
    preview_colors: { color: string; label: string }[];
    is_builtin: boolean;
    created_at: string;
    updated_at: string;
}

// ─── Default theme values (used as fallback) ──────────────────────────────────
export const DEFAULT_OFFER_THEME: OfferThemeConfig = {
    primary: '#6366F1',
    primaryDark: '#4F46E5',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    text: '#0F172A',
    textMuted: '#64748B',
    border: '#E2E8F0',
    cta: '#6366F1',
    ctaText: '#FFFFFF',
    ctaHover: '#4F46E5',
    accent: '#F59E0B',
    accentLight: '#FEF3C7',
    success: '#10B981',
    fontHeading: 'inherit',
    fontBody: 'inherit',
    fontSizeBase: '16px',
    fontWeightHeading: '700',
    letterSpacing: 'normal',
    layout: 'tabs',
    containerMaxWidth: '1200px',
    sectionSpacing: '2rem',
    radius: '12px',
    radiusLg: '20px',
    radiusCard: '16px',
    shadow: '0 4px 24px rgba(0,0,0,0.08)',
    shadowCard: '0 2px 12px rgba(0,0,0,0.06)',
    shadowBtn: '0 2px 8px rgba(99,102,241,0.25)',
    navbarBg: 'rgba(255,255,255,0.95)',
    navbarBorder: '#E2E8F0',
    navbarStyle: 'sticky',
    cardStyle: 'elevated',
    cardBg: '#FFFFFF',
    cardBorder: '#E2E8F0',
    btnStyle: 'filled',
    btnRadius: '12px',
    animationSpeed: 'normal',
    bgDecoration: 'none',
};

export const DEFAULT_ADMIN_THEME: AdminThemeConfig = {
    sidebarBg: '#1E1B4B',
    sidebarText: '#C7D2FE',
    sidebarTextMuted: '#818CF8',
    sidebarActive: '#4F46E5',
    sidebarActiveBg: 'rgba(99,102,241,0.2)',
    sidebarHover: 'rgba(255,255,255,0.07)',
    sidebarBorder: 'rgba(255,255,255,0.05)',
    sidebarWidth: '256px',
    sidebarStyle: 'dark',
    mainBg: '#F1F5F9',
    cardBg: '#FFFFFF',
    cardBorder: '#E2E8F0',
    cardRadius: '16px',
    accent: '#6366F1',
    accentDark: '#4F46E5',
    accentLight: '#EEF2FF',
    fontFamily: 'inherit',
    tableHeaderBg: '#F8FAFC',
    tableRowHover: '#F8FAFC',
    statusNew: '#3B82F6',
    statusActive: '#10B981',
    statusWon: '#8B5CF6',
    statusLost: '#EF4444',
};

// ─── Service ──────────────────────────────────────────────────────────────────
export const ThemeService = {
    async listThemes(): Promise<AppTheme[]> {
        const { data, error } = await supabase
            .from('app_themes')
            .select('*')
            .order('is_builtin', { ascending: false })
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []) as AppTheme[];
    },

    async getTheme(id: string): Promise<AppTheme | null> {
        const { data, error } = await supabase
            .from('app_themes')
            .select('*')
            .eq('id', id)
            .single();
        if (error) return null;
        return data as AppTheme;
    },

    async getActiveSetting(key: 'active_offer_theme' | 'active_admin_theme'): Promise<string> {
        const { data } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', key)
            .single();
        return data?.value || 'default';
    },

    async setActiveSetting(key: 'active_offer_theme' | 'active_admin_theme', themeId: string): Promise<void> {
        const { error } = await supabase
            .from('app_settings')
            .upsert({ key, value: themeId, updated_at: new Date().toISOString() });
        if (error) throw error;
    },

    async getActiveThemes(): Promise<{ offerTheme: AppTheme | null; adminTheme: AppTheme | null }> {
        const [offerThemeId, adminThemeId] = await Promise.all([
            ThemeService.getActiveSetting('active_offer_theme'),
            ThemeService.getActiveSetting('active_admin_theme'),
        ]);
        const [offerTheme, adminTheme] = await Promise.all([
            ThemeService.getTheme(offerThemeId),
            ThemeService.getTheme(adminThemeId),
        ]);
        return { offerTheme, adminTheme };
    },

    async createTheme(data: Omit<AppTheme, 'id' | 'created_at' | 'updated_at' | 'is_builtin'>): Promise<AppTheme> {
        const { data: created, error } = await supabase
            .from('app_themes')
            .insert({ ...data, is_builtin: false })
            .select()
            .single();
        if (error) throw error;
        return created as AppTheme;
    },

    async updateTheme(id: string, data: Partial<Omit<AppTheme, 'id' | 'created_at' | 'is_builtin'>>): Promise<void> {
        const { error } = await supabase
            .from('app_themes')
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('is_builtin', false);
        if (error) throw error;
    },

    async deleteTheme(id: string): Promise<void> {
        const { error } = await supabase
            .from('app_themes')
            .delete()
            .eq('id', id)
            .eq('is_builtin', false);
        if (error) throw error;
    },
};
