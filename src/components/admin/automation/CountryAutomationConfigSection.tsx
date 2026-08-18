import React, { useEffect, useState } from 'react';
import { Globe, Save, Phone, Clock as ClockIcon, RefreshCw } from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';
import { useToast } from '../../../contexts/ToastContext';

// Desteklenen ülkeler — bayrak + tam ad ile
const SUPPORTED_COUNTRIES: Array<{ code: string; flag: string; label: string; defaultTz: string }> = [
    { code: 'TR', flag: '🇹🇷', label: 'Türkiye', defaultTz: 'Europe/Istanbul' },
    { code: 'DE', flag: '🇩🇪', label: 'Almanya', defaultTz: 'Europe/Berlin' },
    { code: 'AT', flag: '🇦🇹', label: 'Avusturya', defaultTz: 'Europe/Berlin' },
    { code: 'CH', flag: '🇨🇭', label: 'İsviçre', defaultTz: 'Europe/Berlin' },
    { code: 'FR', flag: '🇫🇷', label: 'Fransa', defaultTz: 'Europe/Paris' },
    { code: 'BE', flag: '🇧🇪', label: 'Belçika', defaultTz: 'Europe/Paris' },
    { code: 'NL', flag: '🇳🇱', label: 'Hollanda', defaultTz: 'Europe/Paris' },
    { code: 'IT', flag: '🇮🇹', label: 'İtalya', defaultTz: 'Europe/Rome' },
    { code: 'ES', flag: '🇪🇸', label: 'İspanya', defaultTz: 'Europe/Madrid' },
    { code: 'PT', flag: '🇵🇹', label: 'Portekiz', defaultTz: 'Europe/Madrid' },
    { code: 'GB', flag: '🇬🇧', label: 'İngiltere', defaultTz: 'Europe/London' },
    { code: 'IE', flag: '🇮🇪', label: 'İrlanda', defaultTz: 'Europe/London' },
    { code: 'GR', flag: '🇬🇷', label: 'Yunanistan', defaultTz: 'Europe/Athens' },
    { code: 'PL', flag: '🇵🇱', label: 'Polonya', defaultTz: 'Europe/Warsaw' },
    { code: 'US', flag: '🇺🇸', label: 'ABD', defaultTz: 'America/New_York' },
    { code: 'CA', flag: '🇨🇦', label: 'Kanada', defaultTz: 'America/Toronto' },
    { code: 'SA', flag: '🇸🇦', label: 'Suudi Arabistan', defaultTz: 'Asia/Riyadh' },
    { code: 'AE', flag: '🇦🇪', label: 'BAE', defaultTz: 'Asia/Dubai' },
];

const TIMEZONE_OPTIONS = [
    'Europe/Istanbul', 'Europe/Berlin', 'Europe/Paris', 'Europe/Rome',
    'Europe/Madrid', 'Europe/London', 'Europe/Athens', 'Europe/Warsaw',
    'Europe/Prague', 'Europe/Budapest', 'Europe/Bucharest', 'Europe/Sofia',
    'Europe/Stockholm', 'Europe/Copenhagen', 'Europe/Oslo', 'Europe/Helsinki',
    'America/New_York', 'America/Toronto', 'Asia/Riyadh', 'Asia/Dubai',
];

interface CountryConfig {
    country_code: string;
    whatsapp_phone_id: string;
    timezone: string;
    working_hours_enabled: boolean;
    working_hours_start: string;
    working_hours_end: string;
}

export function CountryAutomationConfigSection() {
    const { success, error } = useToast();
    const [configs, setConfigs] = useState<Record<string, CountryConfig>>({});
    const [loading, setLoading] = useState(true);
    const [savingCode, setSavingCode] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('country_payment_settings')
                .select('country_code,whatsapp_phone_id,timezone,working_hours_enabled,working_hours_start,working_hours_end');
            const map: Record<string, CountryConfig> = {};
            (data || []).forEach((row: any) => {
                const code = row.country_code?.toUpperCase();
                if (!code) return;
                map[code] = {
                    country_code: code,
                    whatsapp_phone_id: row.whatsapp_phone_id || '',
                    timezone: row.timezone || SUPPORTED_COUNTRIES.find(c => c.code === code)?.defaultTz || 'Europe/Istanbul',
                    working_hours_enabled: row.working_hours_enabled ?? true,
                    working_hours_start: row.working_hours_start || '09:00',
                    working_hours_end: row.working_hours_end || '20:00',
                };
            });
            setConfigs(map);
        } catch (err: any) {
            console.warn('[CountryAutomationConfig] load failed', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const updateLocal = (code: string, patch: Partial<CountryConfig>) => {
        setConfigs(prev => {
            const current = prev[code] || {
                country_code: code,
                whatsapp_phone_id: '',
                timezone: SUPPORTED_COUNTRIES.find(c => c.code === code)?.defaultTz || 'Europe/Istanbul',
                working_hours_enabled: true,
                working_hours_start: '09:00',
                working_hours_end: '20:00',
            };
            return { ...prev, [code]: { ...current, ...patch } };
        });
    };

    const saveCountry = async (code: string) => {
        const cfg = configs[code];
        if (!cfg) return;
        setSavingCode(code);
        try {
            // Upsert — sadece bu satır için
            const { error: upErr } = await supabase
                .from('country_payment_settings')
                .upsert({
                    country_code: code,
                    whatsapp_phone_id: cfg.whatsapp_phone_id || null,
                    timezone: cfg.timezone,
                    working_hours_enabled: cfg.working_hours_enabled,
                    working_hours_start: cfg.working_hours_start,
                    working_hours_end: cfg.working_hours_end,
                    is_active: true,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'country_code' });
            if (upErr) throw upErr;
            success('Kaydedildi', `${code} otomasyon ayarları güncellendi.`);
        } catch (err: any) {
            error('Hata', err?.message || 'Kaydedilemedi.');
        } finally {
            setSavingCode(null);
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Globe size={16} className="text-indigo-600" />
                    <h3 className="font-semibold text-slate-800 text-sm">Ülke Bazlı Otomasyon Ayarları</h3>
                    <span className="text-xs text-slate-500 ml-2">{Object.keys(configs).length} / {SUPPORTED_COUNTRIES.length} yapılandırılmış</span>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-md transition-colors disabled:opacity-50"
                    title="Yenile"
                >
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                <p className="text-xs text-slate-600">
                    Her ülke için: WhatsApp gönderim numarası (Meta phone_id), zaman dilimi, çalışma saatleri.
                    Otomasyon cron'u lead'in ülkesine göre buradan okur — saat dışıysa gönderim yapmaz.
                </p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider sticky left-0 bg-slate-50 min-w-[140px]">Ülke</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider min-w-[180px]">
                                <Phone size={11} className="inline mr-1" /> Phone ID (Meta)
                            </th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider min-w-[160px]">
                                <ClockIcon size={11} className="inline mr-1" /> Zaman Dilimi
                            </th>
                            <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-600 uppercase tracking-wider">Aktif</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider">Çalışma Saatleri</th>
                            <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-600 uppercase tracking-wider w-24"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {SUPPORTED_COUNTRIES.map(country => {
                            const cfg = configs[country.code] || {
                                country_code: country.code,
                                whatsapp_phone_id: '',
                                timezone: country.defaultTz,
                                working_hours_enabled: true,
                                working_hours_start: '09:00',
                                working_hours_end: '20:00',
                            };
                            const isConfigured = !!cfg.whatsapp_phone_id;
                            return (
                                <tr key={country.code} className={isConfigured ? '' : 'opacity-60'}>
                                    <td className="px-3 py-2.5 sticky left-0 bg-white">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{country.flag}</span>
                                            <div>
                                                <p className="text-xs font-semibold text-slate-800">{country.label}</p>
                                                <p className="text-[10px] font-mono text-slate-400">{country.code}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="text"
                                            value={cfg.whatsapp_phone_id}
                                            onChange={(e) => updateLocal(country.code, { whatsapp_phone_id: e.target.value })}
                                            placeholder="938205312719802"
                                            className="w-full px-2 py-1.5 text-xs font-mono border border-slate-200 rounded bg-white focus:border-indigo-400 focus:outline-none"
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <select
                                            value={cfg.timezone}
                                            onChange={(e) => updateLocal(country.code, { timezone: e.target.value })}
                                            className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded bg-white focus:border-indigo-400 focus:outline-none"
                                        >
                                            {TIMEZONE_OPTIONS.map(tz => (
                                                <option key={tz} value={tz}>{tz}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={cfg.working_hours_enabled}
                                                onChange={() => updateLocal(country.code, { working_hours_enabled: !cfg.working_hours_enabled })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </td>
                                    <td className="px-2 py-2">
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="time"
                                                disabled={!cfg.working_hours_enabled}
                                                value={cfg.working_hours_start}
                                                onChange={(e) => updateLocal(country.code, { working_hours_start: e.target.value })}
                                                className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded bg-white focus:border-indigo-400 focus:outline-none disabled:bg-slate-50 disabled:opacity-60"
                                            />
                                            <span className="text-slate-400 text-xs">—</span>
                                            <input
                                                type="time"
                                                disabled={!cfg.working_hours_enabled}
                                                value={cfg.working_hours_end}
                                                onChange={(e) => updateLocal(country.code, { working_hours_end: e.target.value })}
                                                className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded bg-white focus:border-indigo-400 focus:outline-none disabled:bg-slate-50 disabled:opacity-60"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                        <button
                                            onClick={() => saveCountry(country.code)}
                                            disabled={savingCode === country.code}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-50"
                                        >
                                            <Save size={11} />
                                            {savingCode === country.code ? '...' : 'Kaydet'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
