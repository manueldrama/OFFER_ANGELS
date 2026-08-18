import React from 'react';
import { BRAND_LOGOS } from '../../data/brandLogos';

// Yeniden kullanılabilir "kayan logo" şeridi. Landing hero, Final Offer Hero ve
// Customer Offer sayfalarındaki 5 ayrı kopyanın yerine geçer; logolar tek kaynaktan
// (BRAND_LOGOS) gelir. Görsel davranış (kayma, kenar fade, grayscale silüet) korunur;
// boyut/hız/opaklık prop'larla her çağrı yerine göre ayarlanır.
//
// Grayscale görünüm: koyu arka planda `brightness(0) invert(1)` logoyu beyaz silüete
// çevirir; opacity ile gri tona iner. Logolar SVG ya da şeffaf PNG/WebP olabilir.

interface LogoMarqueeProps {
    /** Tailwind yükseklik class'ı, ör. 'h-7' | 'h-10' */
    heightClass?: string;
    /** Logolar arası boşluk, ör. 'gap-8' | 'gap-10' */
    gapClass?: string;
    /** Tam tur süresi (saniye) */
    durationSec?: number;
    /** Şerit opaklığı, ör. 'opacity-75' */
    opacityClass?: string;
    /** Kenar fade genişliği, ör. 'w-8' | 'w-12' */
    maskWidthClass?: string;
    /** Opsiyonel max genişlik (px) */
    maxWidth?: number;
    /** Kenar fade rengi (arka plana göre) */
    fadeColor?: string;
    /** Dış sarmalayıcıya ek class, ör. 'mt-2.5' */
    className?: string;
}

export default function LogoMarquee({
    heightClass = 'h-7',
    gapClass = 'gap-8',
    durationSec = 14,
    opacityClass = 'opacity-75',
    maskWidthClass = 'w-8',
    maxWidth,
    fadeColor = '#000000',
    className = '',
}: LogoMarqueeProps) {
    return (
        <div className={`relative overflow-hidden ${className}`} style={maxWidth ? { maxWidth } : undefined}>
            {/* Soldan / sağdan fade */}
            <div
                className={`absolute left-0 top-0 bottom-0 ${maskWidthClass} z-10 pointer-events-none`}
                style={{ background: `linear-gradient(to right, ${fadeColor}, transparent)` }}
            />
            <div
                className={`absolute right-0 top-0 bottom-0 ${maskWidthClass} z-10 pointer-events-none`}
                style={{ background: `linear-gradient(to left, ${fadeColor}, transparent)` }}
            />
            {/* Kayan şerit — liste iki kez render edilir (seamless loop) */}
            <div
                className={`flex items-center ${gapClass} ${opacityClass}`}
                style={{ filter: 'brightness(0) invert(1)', width: 'max-content', animation: `logoMarquee ${durationSec}s linear infinite` }}
            >
                {[0, 1].map(copy => (
                    <React.Fragment key={copy}>
                        {BRAND_LOGOS.map((logo, i) => (
                            <img key={`${copy}-${i}`} src={logo.src} alt={logo.alt} className={`${heightClass} shrink-0`} />
                        ))}
                    </React.Fragment>
                ))}
            </div>
            <style>{`@keyframes logoMarquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
        </div>
    );
}
