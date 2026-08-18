import React from 'react';
import TR from 'country-flag-icons/react/3x2/TR';
import DE from 'country-flag-icons/react/3x2/DE';
import FR from 'country-flag-icons/react/3x2/FR';
import IT from 'country-flag-icons/react/3x2/IT';
import ES from 'country-flag-icons/react/3x2/ES';
import NL from 'country-flag-icons/react/3x2/NL';
import BE from 'country-flag-icons/react/3x2/BE';
import AT from 'country-flag-icons/react/3x2/AT';
import PT from 'country-flag-icons/react/3x2/PT';
import IE from 'country-flag-icons/react/3x2/IE';
import GR from 'country-flag-icons/react/3x2/GR';
import FI from 'country-flag-icons/react/3x2/FI';
import PL from 'country-flag-icons/react/3x2/PL';
import CZ from 'country-flag-icons/react/3x2/CZ';
import HU from 'country-flag-icons/react/3x2/HU';
import RO from 'country-flag-icons/react/3x2/RO';
import BG from 'country-flag-icons/react/3x2/BG';
import SE from 'country-flag-icons/react/3x2/SE';
import DK from 'country-flag-icons/react/3x2/DK';
import NO from 'country-flag-icons/react/3x2/NO';
import CH from 'country-flag-icons/react/3x2/CH';
import GB from 'country-flag-icons/react/3x2/GB';
import US from 'country-flag-icons/react/3x2/US';
import CA from 'country-flag-icons/react/3x2/CA';
import SA from 'country-flag-icons/react/3x2/SA';
import AE from 'country-flag-icons/react/3x2/AE';

/**
 * Gerçek SVG ülke bayrağı.
 *
 * NEDEN EMOJI DEĞİL: Windows'ta emoji bayrakları render edilmiyor. Segoe UI
 * Emoji, bölgesel gösterge dizilerini (🇹🇷) desteklemediğinden tarayıcı iki
 * harfi ("TR") yan yana çiziyor. macOS/iOS'ta doğru görünmesi yanıltıcı —
 * admin panelinin çoğunluğu Windows'ta kullanılıyor.
 *
 * Bayraklar tek tek import ediliyor: paket 250+ ülke içeriyor ama yalnız
 * COUNTRIES'teki 26'sı bundle'a giriyor. Listede olmayan bir ISO kodu
 * (ipapi 🇮🇳/🇧🇷 dönebiliyor) gelirse iki harflik rozete düşülür.
 */
// Paket FlagComponent tipini dışa açmıyor; bir bayraktan türetiyoruz.
type FlagComponent = typeof TR;

const FLAGS: Record<string, FlagComponent> = {
    TR, DE, FR, IT, ES, NL, BE, AT, PT, IE, GR, FI, PL, CZ, HU, RO, BG,
    SE, DK, NO, CH, GB, US, CA, SA, AE,
};

interface CountryFlagProps {
    /** ISO-3166 alpha-2 (büyük/küçük harf farketmez). */
    code?: string | null;
    /** Erişilebilirlik/tooltip metni — genelde ülke adı. */
    title?: string;
    className?: string;
}

// 21×14 = tam 3:2. SVG'ye object-cover işlemez (değiştirilmiş içerik değil),
// oran tutmazsa preserveAspectRatio kenarlarda boşluk bırakır.
export function CountryFlag({ code, title, className = 'h-3.5 w-[21px]' }: CountryFlagProps) {
    const iso = (code || '').trim().toUpperCase();
    const Flag = FLAGS[iso];

    // Bayrağı olmayan kod: harf rozeti. Boş kutu bırakmaktan iyi.
    if (!Flag) {
        return (
            <span
                title={title || iso}
                className={`inline-flex ${className} items-center justify-center rounded-[2px] bg-slate-200 text-[8px] font-bold leading-none text-slate-600`}
            >
                {iso.slice(0, 2) || '??'}
            </span>
        );
    }

    // ring: beyaz ağırlıklı bayraklar (CH, DK, PL) beyaz zeminde kaybolmasın.
    return (
        <Flag
            title={title || iso}
            className={`${className} shrink-0 rounded-[2px] ring-1 ring-inset ring-black/10`}
        />
    );
}
