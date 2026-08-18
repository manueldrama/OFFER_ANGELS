import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ThemeService, AppTheme, OfferThemeConfig, AdminThemeConfig, DEFAULT_OFFER_THEME, DEFAULT_ADMIN_THEME } from '../services/admin/themeService';

interface ThemeContextValue {
    offerTheme: AppTheme | null;
    adminTheme: AppTheme | null;
    loading: boolean;
    reload: () => void;
    setOfferThemeId: (id: string) => Promise<void>;
    setAdminThemeId: (id: string) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
    offerTheme: null,
    adminTheme: null,
    loading: true,
    reload: () => {},
    setOfferThemeId: async () => {},
    setAdminThemeId: async () => {},
});

export function useTheme() {
    return useContext(ThemeContext);
}

function applyOfferCSSVars(c: OfferThemeConfig) {
    const r = document.documentElement;
    r.style.setProperty('--theme-primary', c.primary);
    r.style.setProperty('--theme-primary-dark', c.primaryDark);
    r.style.setProperty('--theme-bg', c.background);
    r.style.setProperty('--theme-surface', c.surface);
    r.style.setProperty('--theme-surface-elevated', c.surfaceElevated);
    r.style.setProperty('--theme-text', c.text);
    r.style.setProperty('--theme-text-muted', c.textMuted);
    r.style.setProperty('--theme-border', c.border);
    r.style.setProperty('--theme-cta', c.cta);
    r.style.setProperty('--theme-cta-text', c.ctaText);
    r.style.setProperty('--theme-cta-hover', c.ctaHover);
    r.style.setProperty('--theme-accent', c.accent);
    r.style.setProperty('--theme-accent-light', c.accentLight);
    r.style.setProperty('--theme-success', c.success);
    r.style.setProperty('--theme-radius', c.radius);
    r.style.setProperty('--theme-radius-lg', c.radiusLg);
    r.style.setProperty('--theme-radius-card', c.radiusCard);
    r.style.setProperty('--theme-shadow', c.shadow);
    r.style.setProperty('--theme-shadow-card', c.shadowCard);
    r.style.setProperty('--theme-shadow-btn', c.shadowBtn);
    r.style.setProperty('--theme-navbar-bg', c.navbarBg);
    r.style.setProperty('--theme-navbar-border', c.navbarBorder);
    r.style.setProperty('--theme-card-bg', c.cardBg);
    r.style.setProperty('--theme-card-border', c.cardBorder);
    r.style.setProperty('--theme-btn-radius', c.btnRadius);
    r.style.setProperty('--theme-font-size-base', c.fontSizeBase);
    r.style.setProperty('--theme-font-weight-heading', c.fontWeightHeading);
    r.style.setProperty('--theme-letter-spacing', c.letterSpacing);
    r.style.setProperty('--theme-container-max-width', c.containerMaxWidth);
    r.style.setProperty('--theme-section-spacing', c.sectionSpacing);
    if (c.fontHeading && c.fontHeading !== 'inherit') {
        r.style.setProperty('--theme-font-heading', c.fontHeading);
    }
    if (c.fontBody && c.fontBody !== 'inherit') {
        r.style.setProperty('--theme-font-body', c.fontBody);
    }
    // Layout & style as data attributes for CSS targeting
    document.documentElement.setAttribute('data-offer-layout', c.layout);
    document.documentElement.setAttribute('data-card-style', c.cardStyle);
    document.documentElement.setAttribute('data-btn-style', c.btnStyle);
    document.documentElement.setAttribute('data-bg-decoration', c.bgDecoration);
    document.documentElement.setAttribute('data-animation-speed', c.animationSpeed);
}

function applyAdminCSSVars(c: AdminThemeConfig) {
    const r = document.documentElement;
    r.style.setProperty('--admin-sidebar-bg', c.sidebarBg);
    r.style.setProperty('--admin-sidebar-text', c.sidebarText);
    r.style.setProperty('--admin-sidebar-text-muted', c.sidebarTextMuted);
    r.style.setProperty('--admin-sidebar-active', c.sidebarActive);
    r.style.setProperty('--admin-sidebar-active-bg', c.sidebarActiveBg);
    r.style.setProperty('--admin-sidebar-hover', c.sidebarHover);
    r.style.setProperty('--admin-sidebar-border', c.sidebarBorder);
    r.style.setProperty('--admin-sidebar-width', c.sidebarWidth);
    r.style.setProperty('--admin-main-bg', c.mainBg);
    r.style.setProperty('--admin-card-bg', c.cardBg);
    r.style.setProperty('--admin-card-border', c.cardBorder);
    r.style.setProperty('--admin-card-radius', c.cardRadius);
    r.style.setProperty('--admin-accent', c.accent);
    r.style.setProperty('--admin-accent-dark', c.accentDark);
    r.style.setProperty('--admin-accent-light', c.accentLight);
    r.style.setProperty('--admin-table-header-bg', c.tableHeaderBg);
    r.style.setProperty('--admin-table-row-hover', c.tableRowHover);
    r.style.setProperty('--admin-status-new', c.statusNew);
    r.style.setProperty('--admin-status-active', c.statusActive);
    r.style.setProperty('--admin-status-won', c.statusWon);
    r.style.setProperty('--admin-status-lost', c.statusLost);
    document.documentElement.setAttribute('data-admin-sidebar-style', c.sidebarStyle);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [offerTheme, setOfferTheme] = useState<AppTheme | null>(null);
    const [adminTheme, setAdminTheme] = useState<AppTheme | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const { offerTheme: ot, adminTheme: at } = await ThemeService.getActiveThemes();
            if (ot) { setOfferTheme(ot); applyOfferCSSVars(ot.config.offer); }
            else { applyOfferCSSVars(DEFAULT_OFFER_THEME); }
            if (at) { setAdminTheme(at); applyAdminCSSVars(at.config.admin); }
            else { applyAdminCSSVars(DEFAULT_ADMIN_THEME); }
        } catch {
            applyOfferCSSVars(DEFAULT_OFFER_THEME);
            applyAdminCSSVars(DEFAULT_ADMIN_THEME);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const setOfferThemeId = async (id: string) => {
        await ThemeService.setActiveSetting('active_offer_theme', id);
        const theme = await ThemeService.getTheme(id);
        if (theme) { setOfferTheme(theme); applyOfferCSSVars(theme.config.offer); }
    };

    const setAdminThemeId = async (id: string) => {
        await ThemeService.setActiveSetting('active_admin_theme', id);
        const theme = await ThemeService.getTheme(id);
        if (theme) { setAdminTheme(theme); applyAdminCSSVars(theme.config.admin); }
    };

    return (
        <ThemeContext.Provider value={{ offerTheme, adminTheme, loading, reload: load, setOfferThemeId, setAdminThemeId }}>
            {children}
        </ThemeContext.Provider>
    );
}
