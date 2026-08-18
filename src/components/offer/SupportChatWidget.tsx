// Teklif sayfası destek sohbeti — müşteri-facing.
// Müşteri HİÇBİR yerde "AI/bot/asistan" görmez; sohbet marka kimliğiyle (CAFEPASTE) açılır.
// Bot↔canlı geçişi müşteriye şeffaftır. Bot modunda yalnızca bizim yazdığımız cevap havuzundan
// konuşulur; eşleşme yoksa escalation + canlı ekip. Online'ken AI tamamen kapanır, yetkili yazar.
//
// Tasarım: premium/sakin (Linear/Intercom yönü), sayfayı bloklamayan kompakt kart (masaüstü) /
// ekranı kaplamayan alt sheet (mobil). Müşteri panel açıkken sayfada işlem yapmaya devam edebilir.

import React from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, X, Minus, Send } from 'lucide-react';
import { playPing } from '../../lib/notificationSound';

type Role = 'customer' | 'assistant' | 'agent';
interface Msg { role: Role; text: string; seq?: number; }

interface Props {
    // Offer modu: teklif token'i. Verilmezse "ziyaretçi modu" (landing/blog/portal):
    // konuşma kalıcı tarayıcı kimliğiyle (cafepaste_visitor_id) açılır.
    token?: string;
    step?: 'model_selection' | 'final_offer' | 'all';
    offerNumber?: string;
    customerName?: string;
}

const POLL_MS = 5000;
const POLL_CLOSED_MS = 8000;   // panel kapalıyken daha seyrek poll (proaktif mesajı yakalamak için)
const HEARTBEAT_MS = 20000;    // presence "yaşıyorum" sinyali aralığı
const TYPING_MIN_MS = 750;
const VISITOR_KEY = 'cafepaste_visitor_id'; // analyticsService ile aynı anahtar

// Token yoksa kalıcı ziyaretçi kimliğini oku/üret (analytics ile paylaşılır).
function readVisitorId(): string {
    if (typeof window === 'undefined') return '';
    const gen = () => (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    try {
        let v = localStorage.getItem(VISITOR_KEY);
        if (!v) { v = gen(); localStorage.setItem(VISITOR_KEY, v); }
        return v;
    } catch { return gen(); } // localStorage engelli (gizli sekme) → kalıcı olmayan id ile yine çalış
}

export default function SupportChatWidget({ token, step = 'all' }: Props) {
    // Kapsam: offer (token) ya da ziyaretçi (visitor_id). Konuşma sahipliği buna göre doğrulanır.
    const scopeId = React.useMemo(() => (token ? token : readVisitorId()), [token]);
    const storageScope = token ? token : `v_${scopeId}`;
    // Konuşmanın açıldığı sayfa (agent bağlamı) — sadece ziyaretçi modunda anlamlı.
    const sourcePage = typeof window !== 'undefined' ? window.location.pathname : '';
    const { t, i18n } = useTranslation('offer');
    const tt = (k: string, d: string) => t(`offer:supportChat.${k}`, { defaultValue: d });
    // Aktif teklif dili (offer sayfası i18n.language'i teklif diline göre ayarlıyor)
    const lang = (i18n.language || 'tr').split('-')[0];

    const [ready, setReady] = React.useState(false);          // config yüklendi mi
    const [enabled, setEnabled] = React.useState(false);
    const [title, setTitle] = React.useState('CAFEPASTE Destek');
    const [quick, setQuick] = React.useState<Array<{ id: string; label: string }>>([]);

    const [open, setOpen] = React.useState(false);
    const [messages, setMessages] = React.useState<Msg[]>([]);
    const [input, setInput] = React.useState('');
    const [sending, setSending] = React.useState(false);
    const [typing, setTyping] = React.useState(false);
    const [unread, setUnread] = React.useState(0);
    const [nudge, setNudge] = React.useState(false);       // proaktif dürtü kabarcığı
    const [nudgeAllowed, setNudgeAllowed] = React.useState(true); // admin aç/kapa
    const [scrolling, setScrolling] = React.useState(false); // kaydırırken sönümle
    // Satış modu: backend isim+telefon istediğinde (need_contact) açılan mini-form.
    const [needContact, setNeedContact] = React.useState(false);
    const [contactName, setContactName] = React.useState('');
    const [contactPhone, setContactPhone] = React.useState('');

    const convId = React.useRef<string | null>(
        typeof window !== 'undefined' ? sessionStorage.getItem(`cp_support_conv_${storageScope}`) : null,
    );
    // convId bir ref olduğundan değişimi render/effect tetiklemez; poll'u başlatmak için
    // konuşma hazır olduğunu state ile yansıtırız (proaktif konuşma benimsenince de güncellenir).
    const [convReady, setConvReady] = React.useState<boolean>(!!convId.current);
    const lastSeq = React.useRef(0);
    const openedAt = React.useRef(0); // geçmiş yüklenirken ses çalmamak için
    const scrollRef = React.useRef<HTMLDivElement | null>(null);
    const taRef = React.useRef<HTMLTextAreaElement | null>(null);
    const openRef = React.useRef(open);
    openRef.current = open;

    // 1) Config — ana aç/kapa + başlık + (dile göre) hızlı sorular
    React.useEffect(() => {
        let alive = true;
        fetch(`/api/support/config?lang=${encodeURIComponent(lang)}`)
            .then((r) => r.json())
            .then((d) => {
                if (!alive) return;
                setEnabled(!!d?.enabled);
                setTitle(d?.title || 'CAFEPASTE Destek');
                setNudgeAllowed(d?.nudgeEnabled !== false);
                {
                    // Aynı etiketli çipleri tekilleştir (mükerrer KB kaydı varsa görsel çift olmasın)
                    const seen = new Set<string>();
                    const uniq = (Array.isArray(d?.quick) ? d.quick : []).filter((q: any) => {
                        const key = (q?.label || '').trim().toLocaleLowerCase('tr');
                        if (!key || seen.has(key)) return false;
                        seen.add(key);
                        return true;
                    });
                    setQuick(uniq);
                }
                setReady(true);
            })
            .catch(() => { if (alive) setReady(true); });
        return () => { alive = false; };
    }, [lang]);

    const scrollToBottom = React.useCallback(() => {
        requestAnimationFrame(() => {
            const el = scrollRef.current;
            if (el) el.scrollTop = el.scrollHeight;
        });
    }, []);

    // Yeni yetkili/asistan mesajlarını çek (poll + manuel)
    const pollOnce = React.useCallback(async () => {
        if (!convId.current) return;
        try {
            const scopeQs = token
                ? `offer_token=${encodeURIComponent(token)}`
                : `visitor_id=${encodeURIComponent(scopeId)}`;
            const url = `/api/support/conversation?${scopeQs}&conversation_id=${encodeURIComponent(convId.current)}&after=${lastSeq.current}`;
            const res = await fetch(url);
            if (!res.ok) return;
            const data = await res.json();
            const incoming: Array<{ seq: number; role: Role; text: string }> = data?.messages || [];
            if (incoming.length) {
                lastSeq.current = Math.max(lastSeq.current, ...incoming.map((m) => m.seq));
                setTyping(false);
                setMessages((prev) => [...prev, ...incoming.map((m) => ({ role: m.role, text: m.text, seq: m.seq }))]);
                if (!openRef.current) setUnread((u) => u + incoming.length);
                // Geçmiş geri-yükleme sırasında (açılıştan hemen sonra) ses çalma
                if (Date.now() - openedAt.current > 1200) playPing();
                scrollToBottom();
            }
        } catch { /* sessiz */ }
    }, [token, scopeId, scrollToBottom]);

    // Poll döngüsü — konuşma varsa panel kapalı olsa da çalışır (yetkilinin proaktif
    // mesajını yakalamak için). Açıkken daha sık, kapalıyken daha seyrek.
    React.useEffect(() => {
        if (!convReady) return;
        const id = setInterval(pollOnce, open ? POLL_MS : POLL_CLOSED_MS);
        return () => clearInterval(id);
    }, [open, convReady, pollOnce]);

    // Presence heartbeat — widget açıkken/kapalıyken ~20 sn'de bir "yaşıyorum" sinyali.
    // Admin'in gerçek "çevrimiçi" listesini görmesi + online müşteriye proaktif yazabilmesi için.
    const sendHeartbeat = React.useCallback(() => {
        if (typeof document !== 'undefined' && document.hidden) return; // arka plan sekmesi online sayılmasın
        const payload = token
            ? { offer_token: token, source_page: sourcePage, conversation_id: convId.current, open: openRef.current }
            : { visitor_id: scopeId, source_page: sourcePage, conversation_id: convId.current, open: openRef.current };
        fetch('/api/support/presence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                // Yetkili proaktif konuşma başlattıysa onu benimse → poll başlasın, mesaj gelsin.
                if (d?.conversation_id && !convId.current) {
                    convId.current = d.conversation_id;
                    try { sessionStorage.setItem(`cp_support_conv_${storageScope}`, d.conversation_id); } catch { /* */ }
                    setConvReady(true);
                    pollOnce();
                }
            })
            .catch(() => { /* sessiz */ });
    }, [token, scopeId, sourcePage, storageScope, pollOnce]);

    React.useEffect(() => {
        if (!ready || !enabled) return;
        sendHeartbeat();
        const id = setInterval(sendHeartbeat, HEARTBEAT_MS);
        const onVisible = () => { if (typeof document === 'undefined' || !document.hidden) sendHeartbeat(); };
        window.addEventListener('focus', onVisible);
        if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(id);
            window.removeEventListener('focus', onVisible);
            if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
        };
    }, [ready, enabled, sendHeartbeat]);

    React.useEffect(() => { if (open) { openedAt.current = Date.now(); setUnread(0); setNudge(false); dismissNudge(); scrollToBottom(); } }, [open, scrollToBottom]);

    const dismissNudge = React.useCallback(() => {
        setNudge(false);
        try { sessionStorage.setItem(`cp_support_nudge_${storageScope}`, '1'); } catch { /* */ }
    }, [storageScope]);

    // Proaktif dürtü: admin açıksa, panel hiç açılmadıysa ve oturumda kapatılmadıysa ~4 sn sonra çıkar
    React.useEffect(() => {
        if (!ready || !enabled || !nudgeAllowed) return;
        try { if (sessionStorage.getItem(`cp_support_nudge_${storageScope}`) === '1') return; } catch { /* */ }
        const id = setTimeout(() => { if (!openRef.current) setNudge(true); }, 4000);
        return () => clearTimeout(id);
    }, [ready, enabled, nudgeAllowed, storageScope]);

    // Kaydırma duyarlı sönümleme
    React.useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const onScroll = () => {
            setScrolling(true);
            clearTimeout(timer);
            timer = setTimeout(() => setScrolling(false), 700);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => { window.removeEventListener('scroll', onScroll); clearTimeout(timer); };
    }, []);

    const autoGrow = () => {
        const el = taRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    };

    const send = async (text: string) => {
        const msg = text.trim();
        if (!msg || sending) return;
        setInput('');
        if (taRef.current) taRef.current.style.height = 'auto';
        setMessages((prev) => [...prev, { role: 'customer', text: msg }]);
        setSending(true);
        setTyping(true);
        scrollToBottom();
        const startedAt = Date.now();
        try {
            const res = await fetch('/api/support/assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(
                    token
                        ? { offer_token: token, step, message: msg, conversation_id: convId.current, lang }
                        : { visitor_id: scopeId, source_page: sourcePage, step, message: msg, conversation_id: convId.current, lang },
                ),
            });
            const data = await res.json().catch(() => ({}));
            if (data?.conversation_id) {
                convId.current = data.conversation_id;
                try { sessionStorage.setItem(`cp_support_conv_${storageScope}`, data.conversation_id); } catch { /* */ }
                setConvReady(true);
            }
            // Backend kişiye özel teklif için isim+telefon istiyorsa mini-formu aç.
            if (data?.need_contact) setNeedContact(true);
            // Cevap/yetkili mesajı poll ile gelir (seq'li, tekilleştirme yok). İnsan hissi için
            // kısa "yazıyor…" gecikmesi sonra ilk poll.
            const elapsed = Date.now() - startedAt;
            const wait = Math.max(0, TYPING_MIN_MS - elapsed);
            setTimeout(() => { pollOnce().finally(() => setTyping(false)); }, wait);
        } catch {
            setTyping(false);
            setMessages((prev) => [...prev, { role: 'assistant', text: tt('error', 'Bağlantıda küçük bir aksaklık oldu, bir daha dener misiniz?') }]);
        } finally {
            setSending(false);
        }
    };

    // İletişim mini-formu submit'i — isim+telefon backend'e gider, lead açılır, teklif chat'e gelir.
    const submitContact = async () => {
        const name = contactName.trim();
        const phone = contactPhone.trim();
        if (sending || !phone || phone.replace(/\D/g, '').length < 10) return;
        setSending(true);
        setTyping(true);
        setNeedContact(false);
        const startedAt = Date.now();
        try {
            const res = await fetch('/api/support/assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(
                    token
                        ? { offer_token: token, step, conversation_id: convId.current, lang, contact: { name, phone } }
                        : { visitor_id: scopeId, source_page: sourcePage, step, conversation_id: convId.current, lang, contact: { name, phone } },
                ),
            });
            const data = await res.json().catch(() => ({}));
            if (data?.conversation_id) {
                convId.current = data.conversation_id;
                try { sessionStorage.setItem(`cp_support_conv_${storageScope}`, data.conversation_id); } catch { /* */ }
                setConvReady(true);
            }
            setContactName('');
            setContactPhone('');
            const elapsed = Date.now() - startedAt;
            const wait = Math.max(0, TYPING_MIN_MS - elapsed);
            setTimeout(() => { pollOnce().finally(() => setTyping(false)); }, wait);
        } catch {
            setTyping(false);
            setNeedContact(true); // başarısızsa formu geri göster
        } finally {
            setSending(false);
        }
    };

    if (!ready || !enabled) return null;

    // Hızlı sorular admin'den (config) gelir; teklif dilinde etiketlenir.
    const greeting = tt('greeting', 'Merhaba! Size nasıl yardımcı olabilirim?');

    return (
        <>
            {/* Proaktif dürtü kabarcığı */}
            <AnimatePresence>
                {!open && nudge && !scrolling && (
                    <motion.div
                        key="nudge"
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                        className="fixed z-[45] bottom-[120px] right-[84px] md:bottom-[88px] md:right-[88px]
                                   max-w-[220px] bg-white rounded-2xl rounded-br-md border border-slate-200/80
                                   shadow-[0_18px_50px_rgba(15,23,42,0.30)] pl-3.5 pr-2 py-2.5 flex items-start gap-2"
                    >
                        <button onClick={() => setOpen(true)} className="text-left text-[13px] leading-snug text-slate-700">
                            {tt('nudge', '👋 Sorunuz mu var? Hemen yazın.')}
                        </button>
                        <button onClick={dismissNudge} aria-label={tt('close', 'Kapat')}
                                className="shrink-0 -mt-0.5 text-slate-300 hover:text-slate-600">
                            <X size={15} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Launcher */}
            <AnimatePresence>
                {!open && (
                    <motion.button
                        key="launcher"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                        onClick={() => setOpen(true)}
                        aria-label={tt('open', 'Destek sohbetini aç')}
                        className={`fixed z-[45] bottom-[104px] right-4 md:bottom-6 md:right-6 h-14 w-14 rounded-full
                                   bg-gradient-to-br from-slate-900 to-slate-700 text-white
                                   shadow-[0_18px_50px_rgba(15,23,42,0.45)] ring-1 ring-white/15
                                   flex items-center justify-center group hover:scale-105 active:scale-95 transition-all
                                   ${scrolling ? 'opacity-40 scale-90' : 'opacity-100'}`}
                    >
                        <MessageCircle size={24} className="drop-shadow" />
                        {/* Çevrimiçi nabız */}
                        <span className="absolute top-1.5 right-1.5 h-3 w-3">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
                        </span>
                        {unread > 0 && (
                            <span className="absolute -top-1 -left-1 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white">
                                {unread > 9 ? '9+' : unread}
                            </span>
                        )}
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Panel */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="panel"
                        initial={{ opacity: 0, y: 24, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                        className="fixed z-[46] inset-x-2 bottom-[88px] md:inset-x-auto md:right-6 md:bottom-6
                                   w-auto md:w-[384px] flex flex-col overflow-hidden
                                   rounded-2xl bg-white
                                   border border-slate-200/80 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.45)]
                                   max-h-[64dvh] md:max-h-[72vh]"
                    >

                        {/* Header */}
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-700 text-white">
                            <div className="h-9 w-9 rounded-full bg-white/95 flex items-center justify-center overflow-hidden ring-1 ring-white/30 shrink-0">
                                <img src="/logo.png" alt="CAFEPASTE" className="h-6 w-6 object-contain"
                                     onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[14px] font-semibold leading-tight truncate">{title}</div>
                                <div className="flex items-center gap-1.5 text-[11px] text-emerald-300/90">
                                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                    {tt('online', 'Çevrimiçi')}
                                </div>
                            </div>
                            <button onClick={() => setOpen(false)} aria-label={tt('minimize', 'Küçült')}
                                    className="h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
                                <Minus size={18} />
                            </button>
                            <button onClick={() => setOpen(false)} aria-label={tt('close', 'Kapat')}
                                    className="h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors md:hidden">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Mesajlar */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#FBFAF9]">
                            {/* Karşılama */}
                            <Bubble role="assistant" text={greeting} />
                            {messages.map((m, i) => (
                                <Bubble key={m.seq ?? `local-${i}`} role={m.role} text={m.text} />
                            ))}
                            {typing && <TypingBubble />}
                        </div>

                        {/* Hızlı çipler (admin'den, dile göre) — yalnızca konuşma başında */}
                        {messages.length === 0 && quick.length > 0 && (
                            <div className="px-4 pb-2 flex flex-wrap gap-2 bg-[#FBFAF9]">
                                {quick.map((c) => (
                                    <button key={c.id} onClick={() => send(c.label)}
                                            className="text-[12.5px] px-3 py-1.5 rounded-full border border-slate-200 bg-white
                                                       text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-colors">
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* İletişim mini-formu — backend kişiye özel teklif için isim+telefon istediğinde */}
                        {needContact && (
                            <div className="px-4 pt-3 pb-1 bg-[#FBFAF9] border-t border-slate-100 space-y-2">
                                <input
                                    value={contactName}
                                    onChange={(e) => setContactName(e.target.value)}
                                    placeholder={tt('contactName', 'Adınız')}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13.5px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 transition-colors"
                                />
                                <div className="flex items-center gap-2">
                                    <input
                                        value={contactPhone}
                                        onChange={(e) => setContactPhone(e.target.value)}
                                        inputMode="tel"
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitContact(); } }}
                                        placeholder={tt('contactPhone', 'Telefon numaranız')}
                                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13.5px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 transition-colors"
                                    />
                                    <button
                                        onClick={submitContact}
                                        disabled={sending || contactPhone.replace(/\D/g, '').length < 10}
                                        className="shrink-0 h-9 px-4 rounded-xl bg-slate-900 text-white text-[13px] font-medium
                                                   disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                                    >
                                        {tt('contactSend', 'Gönder')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Girdi */}
                        <div className="border-t border-slate-100 p-2.5 bg-white">
                            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 focus-within:border-slate-400 transition-colors">
                                <textarea
                                    ref={taRef}
                                    value={input}
                                    rows={1}
                                    onChange={(e) => { setInput(e.target.value); autoGrow(); }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
                                    }}
                                    placeholder={tt('placeholder', 'Mesajınızı yazın…')}
                                    className="flex-1 resize-none bg-transparent outline-none text-[14px] text-slate-800 placeholder:text-slate-400 py-1 max-h-[120px]"
                                />
                                <button
                                    onClick={() => send(input)}
                                    disabled={!input.trim() || sending}
                                    aria-label={tt('send', 'Gönder')}
                                    className="h-9 w-9 shrink-0 rounded-full bg-slate-900 text-white flex items-center justify-center
                                               disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

// Mesaj metnindeki URL'leri tıklanabilir linke çevir (teklif linkleri için kritik).
const URL_RE = /(https?:\/\/[^\s<>"']+)/g;
function linkify(text: string, mine: boolean): React.ReactNode[] {
    return text.split(URL_RE).map((part, i) =>
        /^https?:\/\//.test(part) ? (
            <a
                key={i}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className={`underline underline-offset-2 break-all font-medium ${mine ? 'text-white' : 'text-indigo-600 hover:text-indigo-800'}`}
            >
                {part}
            </a>
        ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
        ),
    );
}

function Bubble({ role, text }: { role: Role; text: string }) {
    const mine = role === 'customer';
    return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div
                className={[
                    'max-w-[82%] px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words shadow-sm',
                    mine
                        ? 'bg-slate-900 text-white rounded-2xl rounded-br-md'
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-2xl rounded-bl-md',
                ].join(' ')}
            >
                {linkify(text, mine)}
            </div>
        </div>
    );
}

function TypingBubble() {
    return (
        <div className="flex justify-start">
            <div className="bg-white border border-slate-200/80 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                        <span
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
