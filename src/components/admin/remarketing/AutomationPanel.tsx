// Remarketing Otomasyonu paneli — kural listesi + aç/kapa + yeni kural formu.
//
// Kurallar 15dk cron'unda değerlendirilir (functions/api/remarketing/automation.ts):
// uygun leadlerle NORMAL bir kampanya oluşturulur ("Oto:" öneki) → gönderim, geçmiş
// ve huni mevcut altyapıdan akar. Bir lead bir kuraldan varsayılan hayatta 1 kez
// mesaj alır; günlük tavan + global durdurma anahtarı + dry-run güvenlik supapları.

import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Loader2, Plus, Power, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';
import { useToast } from '../../../contexts/ToastContext';
import {
    AdminRemarketingAutomationService,
    type RemarketingAutomationRule,
    type RemarketingAutomationRuleInput,
} from '../../../services/admin/remarketingService';
import { guideParamMapFor } from './TemplateGuidePanel';

type WaTemplate = { name: string; body: string; language: string };
type CampaignOpt = { id: string; name: string; validUntil: string | null };

const SEGMENT_OPTS = [
    { value: 'fresh_expired', label: 'Teklifi taze dolmuş (dolalı ≤ X gün)' },
    { value: 'offer_live_unpaid', label: 'Teklifi aktif, bitişine ≤ X gün' },
] as const;

const CONTENT_OPTS = [
    { value: 'same_extend', label: 'Aynı teklif + süre uzatma' },
    { value: 'urgency', label: 'Kısa süreli aciliyet' },
    { value: 'reprice_same_model', label: 'Aynı model, güncel kampanya fiyatı' },
] as const;

const PARAM_OPTS = [
    { value: 'name', label: 'Müşteri adı' },
    { value: 'customer_salutation', label: 'Müşteri adı + Bey/Hanım (otomatik hitap)' },
    { value: 'days_left', label: 'Teklifin kalan gün sayısı (otomatik)' },
    { value: 'campaign_name', label: 'Teklifin kampanya adı (otomatik)' },
    { value: 'offer_number', label: 'Teklif numarası' },
    { value: 'offer_link', label: 'Teklif kısa kodu' },
    { value: 'model_names', label: 'Teklifteki model adları' },
    { value: 'current_month', label: 'İçinde bulunulan ay' },
    { value: 'next_month', label: 'Gelecek ay' },
];

function countPlaceholders(body: string): number {
    const m = body.match(/\{\{\s*\d+\s*\}\}/g);
    if (!m) return 0;
    const nums = m.map((x) => Number(x.replace(/[^\d]/g, '')));
    return nums.length ? Math.max(...nums) : 0;
}

const AutomationPanel: React.FC = () => {
    const { success, error: toastError } = useToast();
    const [rules, setRules] = useState<RemarketingAutomationRule[]>([]);
    const [globalEnabled, setGlobalEnabled] = useState(true);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [segment, setSegment] = useState<'fresh_expired' | 'offer_live_unpaid'>('fresh_expired');
    const [windowDays, setWindowDays] = useState(3);
    const [contentType, setContentType] = useState<'same_extend' | 'urgency' | 'reprice_same_model'>('same_extend');
    const [extendDays, setExtendDays] = useState(3);
    const [urgencyHours, setUrgencyHours] = useState(48);
    const [targetCampaignId, setTargetCampaignId] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [paramMap, setParamMap] = useState<Record<string, string>>({ '1': 'name' });
    const [dailyCap, setDailyCap] = useState(50);
    const [repeatAfterDays, setRepeatAfterDays] = useState<string>(''); // '' = asla tekrar
    const [dryRun, setDryRun] = useState(true);

    const [templates, setTemplates] = useState<WaTemplate[]>([]);
    const [campaigns, setCampaigns] = useState<CampaignOpt[]>([]);

    const selectedTemplate = useMemo(() => templates.find((t) => t.name === templateName) || null, [templates, templateName]);
    const placeholderCount = selectedTemplate ? countPlaceholders(selectedTemplate.body) : 0;

    const load = async () => {
        setLoading(true);
        try {
            const [r, g] = await Promise.all([
                AdminRemarketingAutomationService.listRules(),
                AdminRemarketingAutomationService.getGlobalEnabled(),
            ]);
            setRules(r);
            setGlobalEnabled(g);
        } catch {
            setRules([]);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { void load(); }, []);

    // Form açılınca şablon + kampanya listelerini getir (sihirbazla aynı kaynaklar).
    useEffect(() => {
        if (!showForm) return;
        void (async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch('/api/whatsapp/templates', {
                    headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
                });
                const body = await res.json().catch(() => ({}));
                const meta: WaTemplate[] = (body.templates || []).map((t: any) => ({ name: t.name, body: t.body || '', language: t.language || 'tr' }));
                const { data: local } = await supabase
                    .from('whatsapp_templates').select('name, content, language').eq('is_active', true).order('name');
                const db: WaTemplate[] = (local || []).map((t: any) => ({ name: t.name, body: t.content || '', language: t.language || 'tr' }));
                const merged: WaTemplate[] = [];
                for (const t of [...meta, ...db]) {
                    if (!merged.some((x) => x.name === t.name)) merged.push(t);
                }
                setTemplates(merged);
                if (merged.length && !templateName) {
                    setTemplateName(merged[0].name);
                    const prefill = guideParamMapFor(merged[0].name);
                    if (prefill) setParamMap(prefill);
                }
            } catch { setTemplates([]); }
            try {
                const { data } = await supabase
                    .from('campaigns').select('id, name, valid_until').eq('is_active', true)
                    .order('created_at', { ascending: false });
                setCampaigns((data || []).map((c: any) => ({ id: c.id, name: c.name || 'Kampanya', validUntil: c.valid_until ?? null })));
            } catch { setCampaigns([]); }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showForm]);

    const toggleGlobal = async () => {
        try {
            await AdminRemarketingAutomationService.setGlobalEnabled(!globalEnabled);
            setGlobalEnabled(!globalEnabled);
            success(!globalEnabled ? 'Otomasyon açıldı' : 'Otomasyon DURDURULDU', !globalEnabled ? 'Aktif kurallar tekrar çalışacak.' : 'Hiçbir kural çalışmayacak (kurallar silinmedi).');
        } catch (err: any) {
            toastError('Anahtar değiştirilemedi', err?.message || '');
        }
    };

    const toggleRule = async (rule: RemarketingAutomationRule) => {
        setBusyId(rule.id);
        try {
            await AdminRemarketingAutomationService.updateRule(rule.id, { is_active: !rule.is_active });
            setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
        } catch (err: any) {
            toastError('Kural güncellenemedi', err?.message || '');
        } finally { setBusyId(null); }
    };

    const removeRule = async (rule: RemarketingAutomationRule) => {
        if (!window.confirm(`"${rule.name}" kuralı silinsin mi? (Gönderim geçmişi/loglar silinir; bu kuraldan mesaj almış leadler tekrar hedeflenebilir hale gelir)`)) return;
        setBusyId(rule.id);
        try {
            await AdminRemarketingAutomationService.deleteRule(rule.id);
            setRules((prev) => prev.filter((r) => r.id !== rule.id));
        } catch (err: any) {
            toastError('Kural silinemedi', err?.message || '');
        } finally { setBusyId(null); }
    };

    const saveRule = async () => {
        if (!name.trim()) { toastError('İsim gerekli', 'Kurala kısa bir isim verin.'); return; }
        if (!templateName) { toastError('Şablon seçin', 'Onaylı bir Meta şablonu seçmelisiniz.'); return; }
        if (contentType === 'reprice_same_model' && !targetCampaignId) {
            toastError('Kampanya seçin', 'Güncel fiyat için hedef kampanya zorunlu.'); return;
        }
        // Şablonun tüm slotları dolu olmalı (Meta boş parametreyi reddeder).
        const fullMap: Record<string, string> = {};
        for (let i = 1; i <= placeholderCount; i++) {
            const v = paramMap[String(i)] ?? 'name';
            if (!v.trim()) { toastError('Değişken eksik', `{{${i}}} için değer seçin/yazın.`); return; }
            fullMap[String(i)] = v;
        }
        const input: RemarketingAutomationRuleInput = {
            name: name.trim(),
            is_active: false, // yeni kural KAPALI doğar — admin bilinçli açar
            segment,
            window_days: Math.max(1, windowDays || 3),
            content_type: contentType,
            extend_days: contentType === 'same_extend' ? (extendDays || 3) : null,
            urgency_hours: contentType === 'urgency' ? (urgencyHours || 48) : null,
            target_campaign_id: targetCampaignId || null,
            template_name: templateName,
            template_language: selectedTemplate?.language || 'tr',
            template_params_map: fullMap,
            daily_cap: Math.max(1, dailyCap || 50),
            repeat_after_days: repeatAfterDays.trim() ? Math.max(1, Number(repeatAfterDays)) : null,
            dry_run: dryRun,
        };
        setSaving(true);
        try {
            await AdminRemarketingAutomationService.createRule(input);
            success('Kural kaydedildi', 'Kural KAPALI oluşturuldu — listeden açtığında çalışmaya başlar.');
            setShowForm(false);
            setName('');
            await load();
        } catch (err: any) {
            toastError('Kural kaydedilemedi', err?.message || '');
        } finally { setSaving(false); }
    };

    return (
        <div className="rounded-2xl border border-violet-100 bg-violet-50/30 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-medium text-violet-900">
                    <Bot className="h-4 w-4 text-violet-500" /> Remarketing Otomasyonu
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowForm((v) => !v)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50">
                        <Plus className="h-3.5 w-3.5" /> Yeni kural
                    </button>
                    <button onClick={() => void toggleGlobal()}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${globalEnabled
                            ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                            : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'}`}>
                        <Power className="h-3.5 w-3.5" /> {globalEnabled ? 'Tüm otomasyonu durdur' : 'Otomasyonu aç'}
                    </button>
                </div>
            </div>
            {!globalEnabled && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    <AlertTriangle className="h-3.5 w-3.5" /> Otomasyon global olarak DURDURULDU — hiçbir kural çalışmıyor.
                </div>
            )}
            <p className="text-xs text-violet-900/60">
                Kural açıkken sunucu her gün uygun leadleri bulup otomatik kampanya oluşturur ("Oto:" öneki — geçmişte görünür ve ölçülür).
                Bir lead bir kuraldan varsayılan olarak <b>hayatta 1 kez</b> mesaj alır; günlük tavan ve tüm eleme korumaları (opt-out, engelli, günde-1-mesaj) aynen geçerlidir.
            </p>

            {loading ? (
                <div className="text-xs text-gray-400 py-3 flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Kurallar yükleniyor…</div>
            ) : rules.length === 0 && !showForm ? (
                <div className="text-xs text-gray-400 py-2">Henüz kural yok. "Yeni kural" ile başlayın.</div>
            ) : (
                <div className="divide-y divide-violet-100 rounded-xl bg-white border border-violet-100">
                    {rules.map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-gray-900 truncate">{r.name}</span>
                                    {r.dry_run && <span className="px-1.5 py-0.5 rounded border border-sky-200 bg-sky-50 text-sky-700 text-[11px]">Kuru çalışma</span>}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {SEGMENT_OPTS.find((s) => s.value === r.segment)?.label.replace('X', String(r.window_days)) || r.segment}
                                    {' · '}{CONTENT_OPTS.find((c) => c.value === r.content_type)?.label || r.content_type}
                                    {' · '}Şablon: {r.template_name}
                                    {' · '}Günlük ≤{r.daily_cap}
                                    {r.repeat_after_days ? ` · ${r.repeat_after_days} günde bir tekrar` : ' · lead başına 1 kez'}
                                    {r.last_run_at ? ` · son koşu ${new Date(r.last_run_at).toLocaleString('tr-TR')}` : ''}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => void toggleRule(r)} disabled={busyId === r.id}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${r.is_active ? 'bg-violet-600' : 'bg-gray-200'}`}
                                    title={r.is_active ? 'Kural açık — kapat' : 'Kural kapalı — aç'}>
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${r.is_active ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                                </button>
                                <button onClick={() => void removeRule(r)} disabled={busyId === r.id}
                                    className="rounded-lg p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showForm && (
                <div className="rounded-xl bg-white border border-violet-100 p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block text-sm">
                            <span className="text-gray-600">Kural adı</span>
                            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="örn. Taze dolmuşlara uzatma"
                                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
                        </label>
                        <label className="block text-sm">
                            <span className="text-gray-600">Hedef kitle</span>
                            <select value={segment} onChange={(e) => setSegment(e.target.value as any)}
                                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 bg-white">
                                {SEGMENT_OPTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </label>
                        <label className="block text-sm">
                            <span className="text-gray-600">Pencere (X gün)</span>
                            <input type="number" min={1} value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))}
                                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
                        </label>
                        <label className="block text-sm">
                            <span className="text-gray-600">İçerik</span>
                            <select value={contentType} onChange={(e) => setContentType(e.target.value as any)}
                                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 bg-white">
                                {CONTENT_OPTS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                        </label>
                        {contentType === 'same_extend' && (
                            <label className="block text-sm">
                                <span className="text-gray-600">Süre uzatma (gün)</span>
                                <input type="number" min={1} value={extendDays} onChange={(e) => setExtendDays(Number(e.target.value))}
                                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
                            </label>
                        )}
                        {contentType === 'urgency' && (
                            <label className="block text-sm">
                                <span className="text-gray-600">Geçerlilik (saat)</span>
                                <input type="number" min={1} value={urgencyHours} onChange={(e) => setUrgencyHours(Number(e.target.value))}
                                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
                            </label>
                        )}
                        {(contentType === 'reprice_same_model') && (
                            <label className="block text-sm">
                                <span className="text-gray-600">Hedef kampanya <span className="text-rose-500">*</span></span>
                                <select value={targetCampaignId} onChange={(e) => setTargetCampaignId(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 bg-white">
                                    <option value="">— Kampanya seçin —</option>
                                    {campaigns.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}{c.validUntil ? ` — bitiş ${new Date(c.validUntil).toLocaleDateString('tr-TR')}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                        <label className="block text-sm">
                            <span className="text-gray-600">Şablon</span>
                            <select value={templateName} onChange={(e) => { setTemplateName(e.target.value); setParamMap(guideParamMapFor(e.target.value) || { '1': 'name' }); }}
                                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 bg-white">
                                {templates.length === 0 && <option value="">Yükleniyor…</option>}
                                {templates.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.language})</option>)}
                            </select>
                            {selectedTemplate && <span className="mt-1 block text-xs text-gray-400 line-clamp-2">{selectedTemplate.body}</span>}
                        </label>
                        <label className="block text-sm">
                            <span className="text-gray-600">Günlük tavan</span>
                            <input type="number" min={1} value={dailyCap} onChange={(e) => setDailyCap(Number(e.target.value))}
                                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
                        </label>
                        <label className="block text-sm">
                            <span className="text-gray-600">Tekrar (gün, boş = asla)</span>
                            <input type="number" min={1} value={repeatAfterDays} onChange={(e) => setRepeatAfterDays(e.target.value)}
                                placeholder="boş = lead başına 1 kez"
                                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
                        </label>
                    </div>

                    {placeholderCount > 0 && (
                        <div className="space-y-2">
                            <span className="text-xs font-medium text-gray-600">Şablon değişkenleri</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {Array.from({ length: placeholderCount }, (_, i) => String(i + 1)).map((slot) => {
                                    const val = paramMap[slot] ?? 'name';
                                    const known = PARAM_OPTS.some((p) => p.value === val);
                                    return (
                                        <div key={slot} className="flex items-center gap-2 text-sm">
                                            <span className="text-xs text-gray-400 w-10">{'{{'}{slot}{'}}'}</span>
                                            <select value={known ? val : '__custom__'}
                                                onChange={(e) => setParamMap((prev) => ({ ...prev, [slot]: e.target.value === '__custom__' ? '' : e.target.value }))}
                                                className="rounded-lg border border-gray-200 px-2 py-1.5 bg-white text-xs">
                                                {PARAM_OPTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                                                <option value="__custom__">Özel sabit metin…</option>
                                            </select>
                                            {!known && (
                                                <input value={val} onChange={(e) => setParamMap((prev) => ({ ...prev, [slot]: e.target.value }))}
                                                    placeholder="sabit metin" className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} className="h-4 w-4" />
                        <span>Kuru çalışma (Meta'ya mesaj gitmez — önce böyle test et)</span>
                    </label>

                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Vazgeç</button>
                        <button onClick={() => void saveRule()} disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 text-white px-4 py-2 text-sm hover:bg-violet-700 disabled:opacity-50">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Kuralı kaydet (kapalı başlar)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AutomationPanel;
