import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EditableI18nText } from '../../landing/EditableI18nText';
import LogoMarquee from '../../landing/LogoMarquee';
import { applyFinalOfferOverrides } from '../../../lib/finalOfferSection';
import type { Product } from '../../../types';

interface FinalOfferHeroProps {
  product: Product;
}

// Müşterinin final teklif sayfasının üst kısmı.
// PDP'deki cinematic hero ile aynı görsel dili kullanır ama final teklif bağlamı için
// CTA'sız, kompakt. Video kaynağı: final_offer_video_url ?? hero_video_url.
export const FinalOfferHero: React.FC<FinalOfferHeroProps> = ({ product }) => {
  const { t } = useTranslation('offer');

  // Override'lar uygulanmış section'lar — admin'in final teklif özel başlık/eyebrow/item edit'leri burada yansır.
  const sections = (product.contentSections || []).map(applyFinalOfferOverrides);
  const heroSec = sections.find(s => s.section_type === 'hero');
  const trustSec = sections.find(s => s.section_type === 'trust_strip');
  const heroItem = heroSec?.items?.[0];
  const title = heroItem?.title || product.name;
  const subtitle = heroItem?.sub_text || product.subtitle;
  const badge = heroItem?.value_text;

  const heroImages = product.pdp_hero_images || [];
  const [imgIdx, setImgIdx] = useState(0);
  const fallbackImage = heroItem?.media_url || product.image;
  const heroImage = heroImages[imgIdx] || fallbackImage;

  // Final teklif videosu PDP videosundan ayrı: önce final_offer_video_url, sonra hero_video_url.
  const videoUrl = product.final_offer_video_url || product.hero_video_url;
  const showVideo = !!videoUrl && imgIdx === 0;

  const trustEnabled = !trustSec || (trustSec as any).visible !== false;

  return (
    <div className="-mx-3.5 -mt-4 md:mx-0 md:mt-0 mb-4 md:rounded-lg md:overflow-hidden md:border md:border-slate-100">
      {/* ── Hero blok ── */}
      {/* Masaüstünde sol kolon ~548px (iki eşit kolon); 400px yükseklikte
          ~1.37:1 dengeli oran verir ve sol kolon yüksekliği sağ kolondaki
          kart listesine yaklaşır. */}
      <div className="relative w-full h-[34dvh] md:h-[400px] overflow-hidden">
        <div className="absolute inset-0">
          {showVideo ? (
            <video
              src={videoUrl}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              poster={fallbackImage || undefined}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : heroImage ? (
            <img
              src={heroImage}
              alt={title}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : null}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0.15) 60%, transparent 75%)',
            }}
          />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-5 pb-6 text-white">
          {badge && (
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">
              {badge}
            </span>
          )}
          <h2 className="text-[20px] md:text-[28px] font-[800] leading-tight tracking-tight mt-1">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[12px] md:text-[14px] font-medium text-white/60 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {/* Thumbnail strip — birden fazla görsel varsa */}
        {heroImages.length > 1 && (
          <div className="absolute top-3 right-3 flex gap-1.5">
            {heroImages.slice(0, 4).map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setImgIdx(i)}
                className={`w-9 h-9 rounded-md overflow-hidden border-2 transition-all ${
                  imgIdx === i ? 'border-white scale-110' : 'border-white/30'
                }`}
                aria-label={`Hero ${i + 1}`}
              >
                <img src={img} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Trust strip ── */}
      {trustEnabled && (
        <>
          <style>{`@keyframes finalOfferMarquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
          <div
            className="relative z-10 overflow-hidden"
            style={{ background: '#000000', padding: '14px 0' }}
          >
            <div className="text-center px-4 mb-2">
              <p
                className="text-[10px] font-semibold"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                <EditableI18nText
                  i18nKey="offer:landing.trustIntro"
                  value={t('offer:landing.trustIntro')}
                />
              </p>
              <div className="flex items-center justify-center gap-2 mt-1">
                {[
                  t('offer:landing.trustCatCafes'),
                  t('offer:landing.trustCatHotels'),
                  t('offer:landing.trustCatRestaurants'),
                  t('offer:landing.trustCatEvents'),
                ].map((cat, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && (
                      <span style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
                    )}
                    <span
                      className="text-[8px] font-semibold uppercase tracking-[0.12em]"
                      style={{ color: 'rgba(255,255,255,0.5)' }}
                    >
                      {cat}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
            <LogoMarquee heightClass="h-7" gapClass="gap-8" durationSec={10} opacityClass="opacity-80" maskWidthClass="w-8" />
          </div>
        </>
      )}

    </div>
  );
};
