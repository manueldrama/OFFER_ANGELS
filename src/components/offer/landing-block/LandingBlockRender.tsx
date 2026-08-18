import React from 'react';
import InstagramMarquee from '../../landing/InstagramMarquee';
import { useLandingContent } from '../../../hooks/useLandingContent';
import { DEFAULT_SECTIONS as LANDING_DEFAULT_SECTIONS } from '../../../data/landingDefaults';

interface LandingBlockRenderProps {
  /** 'landing_instagram' | 'landing_stats' */
  type: string;
  /** Mobile bleed gerekli mi (PDP içinde varsayilan false; FinalOffer'da true). */
  bleed?: boolean;
}

// Landing page section'larini (Instagram akisi, Istatistikler) PDP ve final teklif
// sayfalarinda yeniden kullanmak icin shared renderer. Veri landing CMS'inden
// (useLandingContent) gelir; urune ozel veri girisi yoktur.
export const LandingBlockRender: React.FC<LandingBlockRenderProps> = ({ type, bleed = false }) => {
  const { sections: landingSections } = useLandingContent();
  const pool = (landingSections && landingSections.length > 0) ? landingSections : LANDING_DEFAULT_SECTIONS;
  const instagramSec = pool.find((s: any) => s.section_type === 'instagram_feed' && s.is_active !== false);
  const statsSec = pool.find((s: any) => s.section_type === 'stats' && s.is_active !== false);

  const bleedClass = bleed ? '-mx-3.5 md:mx-0' : '';

  if (type === 'landing_instagram') {
    return (
      <div className={`${bleedClass} bg-white rounded-lg border border-slate-100 py-4 overflow-hidden`}>
        {instagramSec?.config?.title && (
          <div className="text-center px-4 mb-3">
            {instagramSec.config.eyebrow && (
              <span className="text-[9px] font-bold text-primary uppercase tracking-[0.15em]">
                {instagramSec.config.eyebrow as string}
              </span>
            )}
            <h3 className="text-[20px] font-[800] text-slate-900 tracking-tight leading-tight mt-0.5">
              {instagramSec.config.title as string}
            </h3>
          </div>
        )}
        <InstagramMarquee section={instagramSec ?? undefined} embedded />
      </div>
    );
  }

  if (type === 'landing_stats') {
    const items = statsSec?.items ?? [];
    const cfg = (statsSec?.config ?? {}) as any;
    if (items.length === 0) return null;
    return (
      <div className={`${bleedClass} bg-white rounded-lg border border-slate-100 px-4 py-6`}>
        {(cfg.title || cfg.title_accent) && (
          <div className="text-center mb-4">
            <h3 className="text-[20px] font-[800] text-slate-900 tracking-tight leading-tight">
              {cfg.title as string}{' '}
              {cfg.title_accent && <span className="text-primary">{cfg.title_accent as string}</span>}
            </h3>
            {cfg.subtitle && (
              <p className="text-[12px] text-slate-500 leading-snug mt-1.5 max-w-md mx-auto">
                {cfg.subtitle as string}
              </p>
            )}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          {items.slice(0, 3).map((s: any, i: number) => {
            const prefix = (s.extra?.prefix as string) ?? '';
            const suffix = (s.extra?.suffix as string) ?? '';
            return (
              <div
                key={s.id || i}
                className="flex flex-col items-center text-center rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-4"
              >
                <p className="text-[24px] md:text-[28px] font-[800] text-slate-900 leading-none tracking-tight tabular-nums">
                  {prefix}{s.value_text ?? ''}{suffix}
                </p>
                <p className="text-[10px] md:text-[11px] font-semibold text-slate-500 leading-tight mt-2">
                  {s.title}
                </p>
              </div>
            );
          })}
        </div>
        {cfg.badge_text && (
          <p className="text-[10px] text-slate-400 font-medium text-center mt-3 leading-snug">
            {cfg.badge_text as string}
          </p>
        )}
      </div>
    );
  }

  return null;
};
