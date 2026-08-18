/**
 * Pano kutucuklarının İÇ durumları — yükleniyor / boş / hata.
 *
 * Neden ayrı bir bileşen: `src/components/ui/EmptyState.tsx` sayfa seviyesi içindir;
 * kendi `bg-white border border-dashed rounded-lg` kabuğu ve `p-12` dolgusu vardır.
 * Zaten kart olan bir widget'ın içine konunca iç içe kart + aşırı dikey boşluk çıkar.
 * Bu yüzden 13 widget bugüne dek kendi boş durumunu elle çizdi (6 farklı işaretleme,
 * 5 farklı skeleton). Burası o işin tek yeri.
 *
 * ASIL AMAÇ hata durumudur. Panodaki widget'lar Supabase çağrılarında `error`'ü hiç
 * okumuyordu (`const { data } = await supabase…`), dolayısıyla 400 dönen bir sorgu
 * `data: null` → boş liste → "her şey yolunda" boş durumu olarak görünüyordu.
 * Gerçek vaka: UrgentDepositsWidget `leads.whatsapp_number` diye var olmayan bir kolon
 * seçiyordu; PostgREST tüm sorguyu 42703 ile reddediyor, kutucuk ise yeşil tik ve
 * "Tüm kaporalar güvende" gösteriyordu. Süresi dolmuş kapora operatöre hiç ulaşmadı.
 *
 * Bu yüzden `error` görsel olarak `empty`den KESİN ayrışır (rose paleti + yeniden dene).
 * Hata asla sükûnet gibi görünmemelidir.
 */

import React from 'react';
import { AlertTriangle, RefreshCw, type LucideIcon } from 'lucide-react';

type WidgetStateProps =
    | { kind: 'loading'; rows?: number }
    | { kind: 'empty'; icon: LucideIcon; title: string; description?: string; iconClassName?: string }
    | { kind: 'error'; onRetry?: () => void; detail?: string };

export const WidgetState: React.FC<WidgetStateProps> = (props) => {
    if (props.kind === 'loading') {
        const rows = props.rows ?? 3;
        return (
            <div className="space-y-2 px-1">
                {Array.from({ length: rows }, (_, i) => (
                    <div key={i} className="h-12 rounded-lg bg-slate-50 animate-pulse" />
                ))}
            </div>
        );
    }

    if (props.kind === 'empty') {
        const { icon: Icon, title, description, iconClassName } = props;
        return (
            <div className="text-center py-8">
                <Icon size={28} className={`mx-auto mb-2 ${iconClassName || 'text-slate-300'}`} />
                <p className="text-[12px] text-slate-500 font-semibold">{title}</p>
                {description && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
                )}
            </div>
        );
    }

    // kind === 'error'
    // `detail` teşhis içindir (PostgREST mesajı gibi) — uzun olabileceği için kırpılır.
    // Operatör aksiyonu "Yeniden dene"dir; teknik metin ikincil kalır.
    const detail = props.detail && props.detail.length > 120
        ? props.detail.slice(0, 117) + '…'
        : props.detail;

    return (
        <div className="text-center py-6 px-3">
            <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-2">
                <AlertTriangle size={16} className="text-rose-500" />
            </div>
            <p className="text-[12px] text-rose-700 font-semibold">Veri yüklenemedi</p>
            {detail && (
                <p className="text-[10.5px] text-rose-400 mt-1 break-words leading-snug">{detail}</p>
            )}
            {props.onRetry && (
                <button
                    type="button"
                    onClick={props.onRetry}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-rose-200 text-rose-700 bg-white hover:bg-rose-50 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                    <RefreshCw size={11} /> Yeniden dene
                </button>
            )}
        </div>
    );
};
