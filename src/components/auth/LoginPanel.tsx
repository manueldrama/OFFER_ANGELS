// Ortak giriş yüzeyi — İKİ KAPI, TEK KİMLİK DOĞRULAMA.
//
// NEDEN ORTAK BİLEŞEN:
//   Sistemde iki giriş kapısı var: yönetim (/admin) ve çalışan (/team). İkisi
//   de AYNI Supabase hesabını doğrular; ayrı bir hesap sistemi YOKTUR. Fark
//   yalnızca kapının kime hitap ettiği ve girişten sonra nereye düşüldüğüdür.
//
//   Form iki kez kopyalansaydı, bir gün şifre sıfırlama ya da 2FA eklendiğinde
//   biri güncellenir diğeri unutulurdu — ve unutulan kapı sessizce eski
//   davranışta kalırdı. Doğrulama mantığı bu yüzden tek yerde durur.
//
// BU BİLEŞEN OTURUM DURUMU YÖNETMEZ.
//   Her iki ekran da ProtectedRoute'un fallback'i olarak render edilir; yani
//   buraya gelindiğinde oturumun YOK olduğu ve rol sorgusunun bittiği garanti
//   edilmiştir. Burada ayrıca "oturum var mı" diye bakmak ölü koddur ve iki
//   yerde iki farklı yönlendirme kuralı doğururdu.

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';

const inputCls =
    'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[13.5px] text-slate-900 ' +
    'placeholder-slate-400 outline-none focus:border-slate-400 transition-colors';
const labelCls =
    'text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block';

interface Props {
    /** Kartın üstündeki küçük marka/bağlam etiketi. */
    eyebrow: string;
    title: string;
    subtitle: string;
    /**
     * Giriş başarılı olunca gidilecek yer.
     *
     * Sabit metin: kapı ne olursa olsun aynı ev (çalışan kapısı → /team).
     * Fonksiyon: kapının kendi politikası. `{ reject }` dönerse GİRİŞ İPTAL
     * edilir ve mesaj hata olarak gösterilir — yönetim kapısı çalışanı böyle
     * geri çevirir. (Reddeden taraf oturumu kendisi kapatmalıdır; panel yalnız
     * mesajı gösterir.)
     */
    landing: string | ((userId: string) => Promise<string | { reject: string }>);
    /** Diğer kapıya geçiş bağlantısı gibi alt bilgiler. */
    footer?: React.ReactNode;
}

export function LoginPanel({ eyebrow, title, subtitle, landing, footer }: Props) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Gerçek Supabase Auth — RLS politikaları auth.uid() üzerinden çalışır.
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        const userId = data.user?.id ?? null;
        const target = typeof landing === 'string'
            ? landing
            : userId ? await landing(userId) : '/team';

        // Kapı politikası girişi reddetti (ör. yönetim kapısında çalışan
        // hesabı). Oturum reddeden tarafça kapatıldı; burada yalnız sebep
        // gösterilir ve sayfada kalınır.
        if (typeof target === 'object') {
            setError(target.reject);
            setLoading(false);
            return;
        }

        // DERİN YER İMİ KORUNUR. Bu ekran ProtectedRoute'un fallback'idir:
        // /team/leads'e oturumsuz gelen kişi girişi TAM O ADRESTE yapar.
        // Hedef taban zaten bulunduğumuz tabansa hiç gezinmeyiz — oturum
        // state'e düşünce ProtectedRoute aynı adreste paneli render eder ve
        // kişi tam gitmek istediği sayfada açılır.
        const here = window.location.pathname;
        const samePanel = here === target || here.startsWith(target + '/');
        if (!samePanel) {
            // Taban farklı (ör. eski /login yönlendirmesinden gelinmiş olabilir):
            // TAM SAYFA geçiş — React yönlendirmesi AuthProvider'ın oturum/rol
            // yazmasıyla yarışırdı; tam yükleme durumu kesin temiz bırakır.
            window.location.replace(target);
        }
        // setLoading(false) YOK: ya sayfa gidiyor ya da oturum düşünce bu
        // bileşen kendiliğinden sökülecek; düğme "giriş yapılıyor" kalmalı —
        // aksi hâlde kullanıcı iki kez tıklar.
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center px-4 py-12">
            <div className="w-full max-w-[400px] mx-auto">
                <div className="text-center mb-6">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        {eyebrow}
                    </p>
                    <h1 className="mt-2 text-[22px] font-bold text-slate-900">{title}</h1>
                    <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">{subtitle}</p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-7">
                    <form className="space-y-4" onSubmit={handleLogin}>
                        <div>
                            <label className={labelCls} htmlFor="login-email">E-posta Adresi</label>
                            <input
                                id="login-email"
                                type="email"
                                required
                                autoComplete="username"
                                className={inputCls}
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className={labelCls} htmlFor="login-password">Şifre</label>
                            <input
                                id="login-password"
                                type="password"
                                required
                                autoComplete="current-password"
                                className={inputCls}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>

                        {error && (
                            <p className="text-[12.5px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2.5">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-900 text-white text-[13.5px] font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {loading && <Loader2 size={14} className="animate-spin" />}
                            {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
                        </button>
                    </form>
                </div>

                {footer && (
                    <div className="mt-5 text-center text-[12.5px] text-slate-500">{footer}</div>
                )}
            </div>
        </div>
    );
}
