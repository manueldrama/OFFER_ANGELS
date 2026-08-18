import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ConfirmDialog } from '../../ui/ConfirmDialog';

export interface HrDetailTab {
    key: string;
    label: string;
    /** Sekme etiketinin yanındaki sayı — 0/undefined ise gösterilmez. */
    badge?: number;
    render: () => React.ReactNode;
}

interface Props {
    /** Geri butonunun hedefi. Derin linkle gelen kullanıcı için de çalışsın diye
     *  navigate(-1) DEĞİL, açık bir adres verilir. */
    backTo: string;
    title: string;
    subtitle?: React.ReactNode;
    badges?: React.ReactNode;
    actions?: React.ReactNode;
    /** Aday hattı — personel detayında yoktur. */
    stepper?: React.ReactNode;
    /** Başlığın solundaki avatar (fotoğraf ya da baş harfler). */
    avatar?: React.ReactNode;
    /** Sekmelerin üstündeki özet şeridi — sekme değişince SABİT kalır. */
    metrics?: React.ReactNode;
    /** Başlığın hemen altında tam genişlik uyarı şeridi (yetki, KVKK vb.). */
    banner?: React.ReactNode;

    tabs: HrDetailTab[];
    activeTab: string;
    onTabChange: (key: string) => void;

    /** Kaydedilmemiş değişiklik var — alt çubuk belirir, sayfadan çıkış uyarır. */
    dirty?: boolean;
    saving?: boolean;
    onSave?: () => void;
    onDiscard?: () => void;
}

/**
 * İK detay sayfalarının ortak kabuğu (aday + personel).
 *
 * Eskiden bu içerik 576px'lik bir drawer'a sığdırılmaya çalışılıyordu; 14 bölüm
 * tek bir scroll'da üst üste diziliyordu. Kabuk üç şeyi garanti eder:
 * her zaman görünen bir başlık/aksiyon şeridi, bölümler arası sekme
 * navigasyonu ve değişiklik varken kaybolmayan bir kaydetme çubuğu.
 */
export function HrDetailLayout({
    backTo, title, subtitle, badges, actions, stepper, banner, avatar, metrics,
    tabs, activeTab, onTabChange,
    dirty = false, saving = false, onSave, onDiscard,
}: Props) {
    const navigate = useNavigate();
    const [leaveAsk, setLeaveAsk] = useState(false);

    // Ziyaret edilen sekmeler MOUNT'TA KALIR, yalnız gizlenir.
    //
    // Sebep: personel detayında üç ayrı sekme (İstihdam / Çalışma Düzeni /
    // İletişim) TEK bir kaydetme yüküne besleniyor. Sekme değişince
    // unmount edilseydi, kullanıcının diğer sekmede yazdığı her şey sessizce
    // silinirdi. Aynı koruma, evrak yükleme veya yarım kalmış sözleşme
    // metni için de geçerli.
    //
    // İlk ziyarete kadar hiç render edilmemesi de kazanç: eski çekmece
    // açılır açılmaz davet/mülakat/evrak/sözleşme/değerlendirme sorgularını
    // aynı anda tetikliyordu.
    const [visited, setVisited] = useState<Set<string>>(() => new Set([activeTab]));
    useEffect(() => {
        setVisited(v => (v.has(activeTab) ? v : new Set(v).add(activeTab)));
    }, [activeTab]);

    // Kaydedilmemiş değişiklik koruması. Drawer'da bu hiç yoktu: panel dışına
    // tıklamak yazılan her şeyi sessizce siliyordu.
    //
    // react-router'ın useBlocker'ı BURADA KULLANILAMAZ — uygulama <BrowserRouter>
    // ile kuruluyor, useBlocker ise yalnız data router'da (createBrowserRouter)
    // çalışır. Bu yüzden iki gerçek kaçış yolu ayrı ayrı kapatılır: sekmeyi
    // kapatma/yenileme (beforeunload) ve sayfanın geri butonu (onay modalı).
    useEffect(() => {
        if (!dirty) return;
        const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [dirty]);

    function goBack() {
        if (dirty) { setLeaveAsk(true); return; }
        navigate(backTo);
    }

    return (
        <div className="p-4 sm:p-6 max-w-[1200px] pb-24">
            {/* Başlık şeridi */}
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div className="flex items-start gap-3 min-w-0">
                    <button
                        onClick={goBack}
                        aria-label="Listeye dön"
                        className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors shrink-0 cursor-pointer"
                    >
                        <ArrowLeft size={16} className="text-slate-600" />
                    </button>
                    {avatar}
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl font-bold text-slate-900 truncate">{title}</h1>
                            {badges}
                        </div>
                        {subtitle && (
                            <p className="text-[13px] text-slate-500 mt-1">{subtitle}</p>
                        )}
                    </div>
                </div>
                {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
            </div>

            {banner && <div className="mb-4">{banner}</div>}
            {stepper && <div className="mb-5">{stepper}</div>}

            {/* Metrik şeridi sekmelerin ALTINDA ama gövdenin ÜSTÜNDE durur:
                hangi sekmede olursanız olun adayın temel sayıları görünür.
                Başlığa koysaydık sekme değişiminde göz onu kaybederdi. */}
            {/* Sekmeler — dar ekranda yatay kaydırılır, sarmalanmaz */}
            <div className="border-b border-slate-200 mb-5 overflow-x-auto">
                <div className="flex items-center gap-1 min-w-max">
                    {tabs.map(tab => {
                        const active = tab.key === activeTab;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => onTabChange(tab.key)}
                                className={`relative px-3.5 py-2.5 text-[13.5px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                                    active ? 'text-primary' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <span className="inline-flex items-center gap-1.5">
                                    {tab.label}
                                    {/* Rozet DÜZ SAYI — prototipte dolgulu bir hap
                                        değil, etiketin yanında gri bir sayı. Hap,
                                        sekme etiketiyle yarışıyordu. */}
                                    {!!tab.badge && (
                                        <span className="text-[11px] font-semibold text-slate-400">
                                            {tab.badge}
                                        </span>
                                    )}
                                </span>
                                {active && (
                                    <motion.div
                                        layoutId="hr-detail-tab-underline"
                                        className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary rounded-full"
                                        transition={{ duration: 0.2 }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {metrics && <div className="mb-5">{metrics}</div>}

            {tabs.filter(t => visited.has(t.key)).map(t => (
                <div key={t.key} className={t.key === activeTab ? 'space-y-5' : 'hidden'}>
                    {t.render()}
                </div>
            ))}

            {/* Kaydetme çubuğu — değişiklik varken hep görünür */}
            <AnimatePresence>
                {dirty && onSave && (
                    <motion.div
                        initial={{ y: 60, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 60, opacity: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6 py-3"
                    >
                        <div className="max-w-[1200px] flex items-center justify-end gap-3">
                            <span className="text-[13px] text-slate-500 mr-auto">
                                Kaydedilmemiş değişiklikler var.
                            </span>
                            {onDiscard && (
                                <button
                                    onClick={onDiscard}
                                    disabled={saving}
                                    className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-700 text-[13px] font-semibold cursor-pointer disabled:opacity-50 hover:bg-slate-50"
                                >
                                    Geri al
                                </button>
                            )}
                            <button
                                onClick={onSave}
                                disabled={saving}
                                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-[13px] font-semibold cursor-pointer disabled:opacity-50 hover:bg-slate-800"
                            >
                                {saving ? 'Kaydediliyor…' : 'Kaydet'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ConfirmDialog
                isOpen={leaveAsk}
                title="Kaydedilmemiş değişiklikler"
                description="Listeye dönerseniz yaptığınız değişiklikler kaybolur."
                confirmLabel="Yine de çık"
                cancelLabel="Sayfada kal"
                onConfirm={() => { setLeaveAsk(false); navigate(backTo); }}
                onCancel={() => setLeaveAsk(false)}
            />
        </div>
    );
}
