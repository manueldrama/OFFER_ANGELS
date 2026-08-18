import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BellRing, Check, MessageSquare, CheckCircle2, CalendarClock, Phone, Trash2, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../../../../lib/supabase/client';
import { leadRemindersService } from '../../../../services/admin/leadRemindersService';
import { useReminderAlertsContext } from '../../../../contexts/ReminderAlertsContext';
import { relativeReminderLabel, absoluteReminderLabel, isOverdue, normalizePhone } from '../../../../lib/reminderTime';

// Dashboard hatırlatma widget'ı — zil popover'ının kalıcı, panelde duran hali.
//
// Veri AdminLayout'taki tek useReminderAlerts örneğinden context ile gelir; bu
// yüzden burada poll/realtime/bip YOKTUR (bkz. ReminderAlertsContext). Kapsam da
// oradan miras alınır: super_admin tümünü, sales_admin yalnız kendi leadlerinin ve
// kendi oluşturduğu hatırlatmaları görür — widget ek bir filtre uygulamaz.
//
// Aynı bileşen hem yönetici dashboard'unda (sürüklenebilir grid) hem satış
// temsilcisi panelinde kullanılır; görünen içerik role göre kendiliğinden ayrışır.

/** Widget'ta gösterilecek en fazla satır — gerisi "Tümünü gör" ile. */
const MAX_ROWS = 6;

// Hatırlatmalar sayfasındaki hazır erteleme süreleriyle BİREBİR aynı — aynı işi
// iki ekranda farklı seçeneklerle yapmak kafa karıştırır.
const RESCHEDULE_PRESETS: { label: string; ms: number }[] = [
    { label: '+1 saat', ms: 60 * 60 * 1000 },
    { label: '+1 gün', ms: 24 * 60 * 60 * 1000 },
    { label: '+3 gün', ms: 3 * 24 * 60 * 60 * 1000 },
    { label: '+1 hafta', ms: 7 * 24 * 60 * 60 * 1000 },
];

/** Date → datetime-local input değeri (yerel saat, saniyesiz). */
function toLocalInputValue(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RemindersWidget() {
    const alerts = useReminderAlertsContext();
    const [busyId, setBusyId] = useState<string | null>(null);
    const [leadNotes, setLeadNotes] = useState<Record<string, string>>({});
    const [dateOpenFor, setDateOpenFor] = useState<string | null>(null);
    const dateRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const items = alerts?.items ?? [];
    const visible = useMemo(() => items.slice(0, MAX_ROWS), [items]);

    // Görünen satırların lead'leri. Bağımlılık olarak dizinin kendisi değil bu
    // string kullanılır: alerts 60sn'de bir yeni dizi kimliğiyle geldiği için
    // dizi bağımlılığı gereksiz sorgu döngüsü açardı.
    const noteLeadIds = visible.map(r => r.lead?.id).filter(Boolean).join(',');

    // Hatırlatmanın kendi notu boşsa (çoğu otomatik kayıtta boştur) müşterinin
    // son ekip notunu yedek bağlam olarak göster — operatör aramadan önce "bu
    // kişiyle en son ne konuşulmuş" bilgisini panelden çıkmadan görsün.
    useEffect(() => {
        const ids = noteLeadIds ? noteLeadIds.split(',') : [];
        if (ids.length === 0) { setLeadNotes({}); return; }
        let cancelled = false;
        (async () => {
            const { data, error } = await supabase
                .from('lead_notes')
                .select('lead_id, note_content, created_at')
                .in('lead_id', ids)
                .eq('is_system_generated', false)
                .order('created_at', { ascending: false });
            if (cancelled) return;
            // Bu sorgu YEDEK bağlam getirir; başarısız olursa hatırlatmalar yine
            // listelenir, yalnızca son not satırı boş kalır. Bu yüzden widget'ı
            // hata durumuna DÜŞÜRMEZ — ama sessiz de kalmaz.
            if (error) console.error('[RemindersWidget] lead note lookup failed:', error);
            const map: Record<string, string> = {};
            (data || []).forEach((n: any) => {
                // İlk görülen (en yeni) not kazanır.
                if (n.lead_id && !map[n.lead_id] && n.note_content) map[n.lead_id] = n.note_content;
            });
            setLeadNotes(map);
        })();
        return () => { cancelled = true; };
    }, [noteLeadIds]);

    // Tarih seçici dışına tıklanınca kapansın.
    useEffect(() => {
        if (!dateOpenFor) return;
        const onClick = (e: MouseEvent) => {
            if (dateRef.current && !dateRef.current.contains(e.target as Node)) setDateOpenFor(null);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [dateOpenFor]);

    // Provider yoksa (admin layout dışı render) sessizce yok ol.
    if (!alerts) return null;

    const { openCount, dueCount, loading, refresh } = alerts;

    const runAction = async (id: string, fn: () => Promise<void>) => {
        setBusyId(id);
        try {
            await fn();
            refresh();
        } catch (e: any) {
            // Widget kendi toast'ını açmaz; hata nadirdir ve liste tazelendiğinde
            // kayıt hâlâ duruyorsa kullanıcı zaten görür.
            console.error('[RemindersWidget] action failed:', e?.message || e);
        } finally {
            setBusyId(null);
        }
    };

    // Silme KALICI (hard delete) ve "tamamlandı"dan farklı: kayıt tamamen gider,
    // geçmişte de görünmez. Beş küçük butonun arasında yanlış tıklama gerçek bir
    // risk olduğu için onay istenir.
    const handleDelete = (id: string, name: string) => {
        if (!window.confirm(`"${name}" hatırlatması silinsin mi?\n\nBu işlem geri alınamaz. Takibi tamamladıysanız silmek yerine "Tamamlandı" işaretleyin — kayıt geçmişte kalır.`)) return;
        void runAction(id, () => leadRemindersService.remove(id));
    };

    const handleReschedule = (id: string, iso: string) => {
        setDateOpenFor(null);
        void runAction(id, () => leadRemindersService.reschedule(id, iso));
    };

    const goToChat = (phone: string | null | undefined) => {
        const p = normalizePhone(phone);
        navigate(p ? `/admin/whatsapp-chat?phone=${encodeURIComponent(p)}` : '/admin/whatsapp-chat');
    };

    const hasDue = dueCount > 0;
    const hasAny = openCount > 0;

    return (
        <div
            className={`bg-white border rounded-xl p-4 h-full flex flex-col ${
                hasDue ? 'border-rose-200 ring-1 ring-rose-100/60' : 'border-slate-200'
            }`}
        >
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            hasDue ? 'bg-rose-50 text-rose-600'
                                : hasAny ? 'bg-amber-50 text-amber-600'
                                : 'bg-slate-50 text-slate-400'
                        }`}
                    >
                        <BellRing size={16} />
                    </div>
                    <div>
                        <h3 className="text-[13px] font-bold text-slate-900 leading-tight">Hatırlatmalar</h3>
                        <p className="text-[11px] text-slate-500 leading-tight">
                            {hasDue ? `${dueCount} gecikmiş · ${openCount} açık` : 'Planlanan takipleriniz'}
                        </p>
                    </div>
                </div>
                {hasAny && (
                    <span
                        className={`px-2 py-0.5 rounded-full text-white text-[11px] font-bold ${
                            hasDue ? 'bg-rose-500' : 'bg-amber-500'
                        }`}
                    >
                        {openCount > 99 ? '99+' : openCount}
                    </span>
                )}
            </div>

            <div className="flex-1 -mx-1">
                {loading ? (
                    <div className="space-y-2 px-1">
                        {[0, 1, 2].map(i => <div key={i} className="h-12 rounded-lg bg-slate-50 animate-pulse" />)}
                    </div>
                ) : !hasAny ? (
                    <div className="text-center py-8">
                        <CheckCircle2 size={28} className="mx-auto text-emerald-400 mb-2" />
                        <p className="text-[12px] text-slate-500 font-semibold">Bekleyen hatırlatma yok</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Takip listeniz temiz</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {visible.map(r => {
                            const overdue = isOverdue(r.remind_at);
                            const name = r.lead?.customer_name || r.lead?.phone_number || 'İsimsiz müşteri';
                            const phone = r.lead?.phone_number;
                            const busy = busyId === r.id;
                            // Hatırlatmanın kendi notu öncelikli; yoksa müşterinin son
                            // ekip notu "Son not:" etiketiyle yedek bağlam olur.
                            const ownNote = r.note?.trim();
                            const fallbackNote = r.lead?.id ? leadNotes[r.lead.id]?.trim() : '';
                            return (
                                <div key={r.id} className={`px-1 py-2 ${overdue ? 'bg-rose-50/40' : ''}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        {/* Hatırlatma satırı hatırlatma merkezine gider —
                                            müşteri kartına değil. Filtre, satırın durumuyla
                                            eşleşir ki açılan sayfada kayıt görünür olsun. */}
                                        <Link
                                            to={`/admin/reminders?filter=${overdue ? 'overdue' : 'all'}`}
                                            className="min-w-0 flex-1 hover:opacity-80 transition-opacity"
                                        >
                                            <p className="text-[12.5px] font-semibold text-slate-800 truncate leading-tight">
                                                {name}
                                            </p>
                                            <p className={`text-[10.5px] font-medium mt-0.5 ${overdue ? 'text-rose-600' : 'text-slate-500'}`}>
                                                {relativeReminderLabel(r.remind_at)} · {absoluteReminderLabel(r.remind_at)}
                                            </p>
                                            {phone && (
                                                <span className="inline-flex items-center gap-1 text-[10.5px] text-slate-400 mt-0.5">
                                                    <Phone size={9} /> {phone}
                                                </span>
                                            )}
                                            {ownNote ? (
                                                <p className="text-[10.5px] text-slate-600 mt-0.5 break-words line-clamp-2">{ownNote}</p>
                                            ) : fallbackNote ? (
                                                <p className="text-[10.5px] text-slate-400 mt-0.5 break-words line-clamp-2">
                                                    <span className="font-medium text-slate-400">Son not:</span> {fallbackNote}
                                                </p>
                                            ) : null}
                                        </Link>
                                        <div className="flex items-center gap-0.5 shrink-0">
                                            {phone && (
                                                <a
                                                    href={`tel:${phone}`}
                                                    title="Ara"
                                                    className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                >
                                                    <Phone size={13} />
                                                </a>
                                            )}
                                            <button
                                                onClick={() => goToChat(phone)}
                                                title="Sohbete git"
                                                className="p-1 rounded-md text-slate-400 hover:text-primary hover:bg-slate-100 transition-colors"
                                            >
                                                <MessageSquare size={13} />
                                            </button>
                                            {/* Tarih değiştir — hazır süreler + serbest tarih/saat.
                                                Hatırlatmalar sayfasında serbest seçim yok; en çok
                                                ihtiyaç duyulan yer burası olduğu için eklendi. */}
                                            <div className="relative">
                                                <button
                                                    onClick={() => setDateOpenFor(dateOpenFor === r.id ? null : r.id)}
                                                    disabled={busy}
                                                    title="Tarihi değiştir"
                                                    className="p-1 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-40"
                                                >
                                                    <CalendarClock size={13} />
                                                </button>
                                                {dateOpenFor === r.id && (
                                                    <div
                                                        ref={dateRef}
                                                        className="absolute right-0 top-full mt-1 z-30 w-44 bg-white rounded-lg shadow-xl border border-slate-200 py-1"
                                                    >
                                                        {RESCHEDULE_PRESETS.map(p => (
                                                            <button
                                                                key={p.label}
                                                                onClick={() => handleReschedule(r.id, new Date(Date.now() + p.ms).toISOString())}
                                                                className="w-full text-left px-3 py-1.5 text-[12px] text-slate-600 hover:bg-slate-50"
                                                            >
                                                                {p.label}
                                                            </button>
                                                        ))}
                                                        <div className="border-t border-slate-100 mt-1 pt-1.5 px-2 pb-1">
                                                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                                                                Tarih seç
                                                            </p>
                                                            <input
                                                                type="datetime-local"
                                                                defaultValue={toLocalInputValue(new Date(r.remind_at))}
                                                                onChange={e => {
                                                                    const v = e.target.value;
                                                                    if (!v) return;
                                                                    const d = new Date(v);
                                                                    if (isNaN(d.getTime())) return;
                                                                    handleReschedule(r.id, d.toISOString());
                                                                }}
                                                                className="w-full text-[11px] border border-slate-200 rounded px-1.5 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-primary/30"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => runAction(r.id, () => leadRemindersService.markDone(r.id))}
                                                disabled={busy}
                                                title="Tamamlandı"
                                                className="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40"
                                            >
                                                {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                            </button>
                                            {/* Yıkıcı aksiyon — sol kenarlıkla ayrıldı ki yanlışlıkla
                                                tıklanmasın; ayrıca onay ister. */}
                                            <button
                                                onClick={() => handleDelete(r.id, name)}
                                                disabled={busy}
                                                title="Sil"
                                                className="ml-0.5 pl-1.5 border-l border-slate-200 p-1 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {hasAny && (
                <Link
                    to="/admin/reminders?filter=overdue"
                    className="mt-2 -mb-1 flex items-center justify-center gap-1 pt-2 border-t border-slate-100 text-[11.5px] font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                    {openCount > MAX_ROWS ? `Tümünü gör (${openCount})` : 'Tümünü gör'} <ArrowRight size={12} />
                </Link>
            )}
        </div>
    );
}
