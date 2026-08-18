import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

/**
 * Segment C — Reklama tıklayan ama sistemde lead olarak tanınmayan ziyaretçi.
 * Mevcut LandingPage/guest token girişiyle aynı sözleşmeyi kullanır:
 * `guest_XXXX` token üret → /offer/{token}'a yönlendir; gerisini CustomerOffer
 * + GuestService.upgradeGuestSession halleder (yeni bir akış icat etmez).
 *
 * Ton (cafepaste-master-style.md): TR'de "siz", kısa cümle, fırsat-kaybı
 * çerçeveleme — korku değil. Premium B2B confident.
 */
const RemarketingLanding: React.FC = () => {
    const navigate = useNavigate();
    const [isStarting, setIsStarting] = useState(false);

    const handleStart = () => {
        if (isStarting) return;
        setIsStarting(true);
        // GuestService.startGuestSession ile aynı format — UI tarafından üretilir
        // ki CustomerOffer'ı orijinal landing→guest akışıyla aynı sözleşmede aç.
        const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
        const guestToken = `guest_${rand}`;
        navigate(`/offer/${guestToken}`, { replace: true });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
            {/* Soft brand-toned ambient blobs — premium, sakin */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/5 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

            <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full border border-slate-100 relative z-10">
                <div className="text-center mb-7">
                    <div className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-5">
                        <Sparkles size={12} className="text-amber-500" />
                        Tekrar hoş geldiniz
                    </div>
                    <h1 className="text-[26px] leading-[1.15] font-black text-slate-900 mb-3">
                        Sizi <span className="text-primary">tekrar görmek</span> güzel
                    </h1>
                    <p className="text-slate-500 text-[15px] leading-relaxed">
                        Kapasitemizden size bir yer ayırdık. Teklifinizi 2 dakikada
                        hazırlayıp avantajlı fiyatı görebilirsiniz.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleStart}
                    disabled={isStarting}
                    className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 text-white font-bold py-3.5 rounded-lg hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                >
                    {isStarting ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                            Teklifimi Hazırla
                            <ArrowRight size={16} />
                        </>
                    )}
                </button>

                <p className="text-[11px] text-slate-400 text-center mt-4 leading-relaxed">
                    Kredi kartı bilgisi gerekmez. Teklifi inceledikten sonra siz karar verirsiniz.
                </p>

                <div className="mt-7 pt-5 border-t border-slate-100 text-center">
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                        CAFEPASTE
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RemarketingLanding;
