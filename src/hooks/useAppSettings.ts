import { useState, useEffect, createContext, useContext } from 'react';
import { AppSettingsService, AppSettings } from '../services/admin/appSettingsService';

const DEFAULT_SETTINGS: AppSettings = {
    timezone: 'Europe/Istanbul',
    date_format: 'dd.MM.yyyy',
    time_format: '24h',
    language: 'tr',
    // Ayar okunamadan render edilen ilk frame'de de linkler görünsün — yasal
    // zorunluluk, ağ gecikmesi yüzünden gizlenmemeli.
    legal_footer_links_enabled: 'true',
};

// Global singleton so all components share the same settings
let globalSettings: AppSettings = DEFAULT_SETTINGS;
let loaded = false;
const listeners = new Set<(s: AppSettings) => void>();

async function loadSettings() {
    if (loaded) return globalSettings;
    try {
        globalSettings = await AppSettingsService.get();
        loaded = true;
        listeners.forEach(fn => fn(globalSettings));
    } catch {
        // keep defaults
    }
    return globalSettings;
}

// Pre-load on import
loadSettings();

export function useAppSettings() {
    const [settings, setSettings] = useState<AppSettings>(globalSettings);

    useEffect(() => {
        // If already loaded, set immediately
        if (loaded) setSettings(globalSettings);
        // Subscribe to future updates
        listeners.add(setSettings);
        // Trigger load if not done
        if (!loaded) loadSettings();
        return () => { listeners.delete(setSettings); };
    }, []);

    const updateSettings = async (updates: Partial<AppSettings>) => {
        const updated = await AppSettingsService.update(updates);
        globalSettings = updated;
        listeners.forEach(fn => fn(updated));
        return updated;
    };

    const refetch = async () => {
        AppSettingsService.clearCache();
        loaded = false;
        await loadSettings();
    };

    return { settings, updateSettings, refetch };
}

// ─── Date formatting utilities ───

export function formatDate(date: string | Date | null | undefined, settings?: AppSettings): string {
    if (!date) return '—';
    const s = settings ?? globalSettings;
    try {
        return new Intl.DateTimeFormat(s.language === 'tr' ? 'tr-TR' : 'en-US', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: s.timezone,
        }).format(new Date(date));
    } catch {
        return new Date(date).toLocaleDateString('tr-TR');
    }
}

export function formatDateTime(date: string | Date | null | undefined, settings?: AppSettings): string {
    if (!date) return '—';
    const s = settings ?? globalSettings;
    try {
        return new Intl.DateTimeFormat(s.language === 'tr' ? 'tr-TR' : 'en-US', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: s.time_format === '12h',
            timeZone: s.timezone,
        }).format(new Date(date));
    } catch {
        return new Date(date).toLocaleString('tr-TR');
    }
}

export function formatTime(date: string | Date | null | undefined, settings?: AppSettings): string {
    if (!date) return '—';
    const s = settings ?? globalSettings;
    try {
        return new Intl.DateTimeFormat(s.language === 'tr' ? 'tr-TR' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: s.time_format === '12h',
            timeZone: s.timezone,
        }).format(new Date(date));
    } catch {
        return new Date(date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }
}

export function formatRelativeDate(date: string | Date | null | undefined): string {
    if (!date) return '—';
    const now = new Date();
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins} dk önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays < 7) return `${diffDays} gün önce`;
    return formatDate(date);
}
