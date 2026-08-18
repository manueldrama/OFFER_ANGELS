import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { LandingPageSection } from '../../types';
import { P, PrimaryBtn, ease } from './primitives';
import { EditableText, EditableItemText } from './InlineEditable';
import { EditableImage } from './InlineEditableImage';
import { SectionEditControls } from './SectionEditControls';
import LogoMarquee from './LogoMarquee';

/* ── Default Instagram Carousel Fallback ──
 * Used only when CMS items are empty (e.g. first load before DB seed).
 * Real content is sourced from section.items via the admin CMS.
 */
type IgPost = {
    id: string;
    user: string;
    location: string;
    emoji: string;
    image: string;
    mediaType: 'image' | 'video';
    caption: string;
    hashtag: string;
    likes: number;
    objectPos: string;
    itemIndex: number;
};

const DEFAULT_IG_POSTS: IgPost[] = [
    { id: 'def-1', user: 'latte_artisan', location: 'Specialty Coffee Lab', emoji: '☕', image: '/ig-post-1.webp', mediaType: 'image', caption: 'Portrem kahveme basıldı, inanamıyorum!', hashtag: '#CAFEPASTE #LatteArt #CoffeePortrait', likes: 2847, objectPos: 'center 30%', itemIndex: 0 },
    { id: 'def-2', user: 'cocktail_queen', location: 'Soho House Istanbul', emoji: '🍸', image: '/ig-post-2.webp', mediaType: 'image', caption: 'Cheers yazılı kokteyl, gece başka güzel', hashtag: '#Cheers #CocktailArt #SohoHouse', likes: 1523, objectPos: 'center 25%', itemIndex: 1 },
    { id: 'def-3', user: 'luxury_stays', location: 'The Ritz-Carlton', emoji: '🥂', image: '/ig-post-3.webp', mediaType: 'image', caption: 'Ritz-Carlton logolu kokteyl, detaylar her şey', hashtag: '#RitzCarlton #LuxuryDrinks #BrandedCocktail', likes: 3412, objectPos: 'center 30%', itemIndex: 2 },
];

/* ── Floating Heart Animation ── */
interface FloatingHeart {
    id: number;
    x: number;
    size: number;
}

let heartIdCounter = 0;

function FloatingHearts({ hearts }: { hearts: FloatingHeart[] }) {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
            <AnimatePresence>
                {hearts.map(h => (
                    <motion.div
                        key={h.id}
                        initial={{ opacity: 1, y: 0, scale: 0.5, x: h.x }}
                        animate={{ opacity: 0, y: -200, scale: 1.2, x: h.x + (Math.random() - 0.5) * 60 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.4, ease: 'easeOut' }}
                        className="absolute bottom-24"
                        style={{ left: 0 }}
                    >
                        <svg width={h.size} height={h.size} viewBox="0 0 24 24" fill="#FF3040">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

interface HeroSectionProps {
    section: LandingPageSection;
    go: () => void;
    launchLabel: string;
    heroRef: React.RefObject<HTMLElement | null>;
    editMode?: boolean;
    onUpdateField?: (sectionType: string, fieldKey: string, value: string) => void;
    onUpdateItemField?: (sectionType: string, itemIndex: number, fieldKey: string, value: string, nested?: boolean) => void;
    activeLang?: string;
    onTranslateSection?: (sectionId: string, targetLang: string) => Promise<void>;
    onToggleVisibility?: (sectionType: string) => void;
    onMove?: (sectionType: string, direction: 'up' | 'down') => void;
}

export default function HeroSection({ section, go, launchLabel, heroRef, editMode = false, onUpdateField, onUpdateItemField, activeLang = 'tr', onTranslateSection, onToggleVisibility, onMove }: HeroSectionProps) {
    const { t } = useTranslation('offer');
    const E = editMode;
    const upd = onUpdateField || (() => {});
    const updItem = onUpdateItemField || (() => {});
    const baseCfg = (section.config ?? {}) as Record<string, any>;
    const langCfg = ((section.config_i18n ?? {}) as Record<string, Record<string, any>>)[activeLang] ?? {};
    const c = { ...baseCfg, ...langCfg };
    const headline = c.headline ?? 'Her İçeceği';
    const headlineAccent = c.headline_accent ?? 'Pazarlama Aracına';
    const headlineSuffix = c.headline_suffix ?? 'Dönüştürün';
    const subtitle = c.subtitle ?? '';
    const productDesc = c.product_description ?? t('landing.heroProductDesc');
    const ctaLabel = c.cta_label ?? 'Teklif Oluştur';
    const secondaryCtaLabel = c.secondary_cta_label ?? 'Nasıl Çalışır?';
    // Hedef (target) alanlari CEVIRILMEZ — her zaman baz config'ten okunur.
    // Eskiden CMS cevirmeni 'secondary_cta_target' degerini AI ile ceviriyordu
    // (tam-eslesme skip'i kaciriyordu); o yuzden non-TR'de hedef bozulup buton
    // navigateTo() fallback ile go()'ya, yani model secimine gidiyordu. baseCfg'den
    // okuyarak eski bozuk config_i18n verisini de otomatik yok sayiyoruz.
    const ctaTarget: string = baseCfg.cta_target ?? 'go';
    const secondaryCtaTarget: string = baseCfg.secondary_cta_target ?? 'how_it_works';
    // Hero görselleri: mobil ve masaüstü farklı kompozisyon kullanıyor (mobil
    // tam-ekran IG-style, masaüstü sinematik bar). CMS'ten ortak hero_image_url
    // dönüyor ama o değer optimize edilmemiş büyük (5MB+ PNG) olabiliyor; bu
    // yüzden ayrı bir hero_image_desktop_url field'ı varsa ona, yoksa optimize
    // edilmiş yerel /hero-desktop.webp'ye düşüyoruz. Mobil tarafı (carousel)
    // ayrı kanal, oraya dokunmuyoruz.
    const heroImage = c.hero_image_url ?? '/landing.webp';
    const heroImageDesktop = c.hero_image_desktop_url ?? c.hero_image_url ?? '/hero-desktop.webp';
    const heroVideo: string | null = c.hero_video_url ?? null;
    const isVideo = heroVideo && (heroVideo.endsWith('.mp4') || heroVideo.endsWith('.webm') || heroVideo.endsWith('.mov'));
    const brandStatText = c.brand_stat_text ?? '500+ premium mekan büyümeye devam ediyor';
    // Slayt geçiş süresi — admin'den ayarlanabilir, güvenli aralığa clamp edilir
    const slideDurationMs = (() => {
        const raw = Number(c.slide_duration_ms);
        if (!Number.isFinite(raw) || raw <= 0) return 3500;
        return Math.min(15000, Math.max(1500, Math.round(raw)));
    })();
    const brandNames: string[] = c.brand_names ?? ['Hilton', 'Marriott', 'Soho House', 'W Hotels'];
    const showPostHeader: boolean = !c.hide_post_header; // default: show (hide_post_header undefined = false = show)
    // Masaüstü hero rozeti ("<Lansman> · Sınırlı Kontenjan"). Admin'den kapatılabilir;
    // görünürlük dile bağlı olmadığı için baseCfg'den okunur (config_i18n'e sızmasın).
    const showLaunchBadge: boolean = !baseCfg.hide_launch_badge; // default: göster

    const { scrollYProgress } = useScroll({
        target: heroRef,
        offset: ['start start', 'end start'],
    });
    const parallaxY = useTransform(scrollYProgress, [0, 1], ['0%', '20%']);

    const navigateTo = (target: string) => {
        if (!target || target === 'go') { go(); return; }
        const el = document.getElementById(target) || document.querySelector(`[data-section-type="${target}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        } else {
            // Section not present on this page/language — fallback to primary action
            go();
        }
    };

    // Ikincil ("Detaylari Gor") CTA: birden cok yedek hedef dener, ilk bulunana
    // kayar. Hicbiri yoksa SESSIZ kalir — go()'a (model secimi) DUSMEZ. Eskiden
    // masaustu tek hedefe navigateTo() yapip bulamayinca go()'a dusuyordu; bozuk
    // ceviri hedefinde buton yanlislikla model secimine gidiyordu.
    const scrollToSecondary = () => {
        const targets = [secondaryCtaTarget, 'how_it_works', 'stats', 'usage_scenarios', 'testimonials'];
        for (const tg of targets) {
            if (!tg || tg === 'go') continue;
            const el = document.getElementById(tg) || document.querySelector(`[data-section-type="${tg}"]`);
            if (el) { el.scrollIntoView({ behavior: 'smooth' }); return; }
        }
    };

    /* ── Build igPosts from CMS items, fall back to defaults when empty ── */
    const igPosts: IgPost[] = useMemo(() => {
        const items = (section as any).items ?? [];
        const active = items.filter((it: any) => it.is_active !== false);
        if (active.length === 0) return DEFAULT_IG_POSTS;
        return active.map((it: any, i: number) => {
            const extra = (it.extra ?? {}) as any;
            const i18n = ((it.item_i18n ?? it.i18n ?? {}) as any)[activeLang] ?? {};
            const mediaUrl: string = it.media_url ?? extra.media_url ?? '/ig-post-1.webp';
            const detectedType = mediaUrl.match(/\.(mp4|webm|mov)(\?|$)/i) ? 'video' : 'image';
            const mediaType: 'image' | 'video' = (extra.media_type as 'image' | 'video') ?? detectedType;
            const caption: string = (i18n.description ?? it.description ?? '').toString();
            const likesNum = parseInt((extra.likes ?? '0').toString(), 10);
            return {
                id: it.id ?? `it-${i}`,
                user: extra.ig_user ?? 'cafepaste',
                location: extra.ig_location ?? '',
                emoji: extra.emoji ?? '',
                image: mediaUrl,
                mediaType,
                caption,
                hashtag: extra.hashtag ?? '',
                likes: Number.isFinite(likesNum) ? likesNum : 0,
                objectPos: extra.object_pos ?? 'center 30%',
                itemIndex: i,
            };
        });
    }, [section, activeLang]);

    /* ── Carousel auto-rotate (deferred until idle so first paint isn't taxed) ── */
    const [igIdx, setIgIdx] = useState(0);
    // Clamp igIdx if items count changes (admin removed a post)
    useEffect(() => {
        if (igIdx >= igPosts.length) setIgIdx(0);
    }, [igPosts.length, igIdx]);
    useEffect(() => {
        let timer: ReturnType<typeof setInterval> | null = null;
        let cancelled = false;
        const start = () => {
            if (cancelled) return;
            timer = setInterval(() => setIgIdx((prev: number) => (prev + 1) % igPosts.length), slideDurationMs);
        };
        const w = window as Window & {
            requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
            PerformanceObserver?: typeof PerformanceObserver;
        };
        // LCP frame'ini bekle: PerformanceObserver hero görseli boyandığı anı
        // bildirir, sonra rotation interval'ı kuruluyor. Bu sayede CPU sınırlı
        // Android cihazlarda 3.5s'lik ilk swap LCP boyamasıyla çakışmıyor.
        const startAfterLcp = () => {
            if (!w.PerformanceObserver) {
                if (w.requestIdleCallback) w.requestIdleCallback(start, { timeout: 4000 });
                else setTimeout(start, 3500);
                return;
            }
            let triggered = false;
            const fire = () => {
                if (triggered) return;
                triggered = true;
                if (w.requestIdleCallback) w.requestIdleCallback(start, { timeout: 1500 });
                else setTimeout(start, 200);
            };
            try {
                const obs = new w.PerformanceObserver(() => { fire(); obs.disconnect(); });
                obs.observe({ type: 'largest-contentful-paint', buffered: true });
                // Safety net: LCP event never fires (e.g., user navigates away fast)
                setTimeout(fire, 4500);
            } catch {
                setTimeout(fire, 3500);
            }
        };
        startAfterLcp();
        return () => {
            cancelled = true;
            if (timer) clearInterval(timer);
        };
    }, [slideDurationMs]);
    const post = igPosts[igIdx] ?? igPosts[0] ?? DEFAULT_IG_POSTS[0];

    /* ── Heart animation state ── */
    const [isLiked, setIsLiked] = useState(false);
    const [showHeartBurst, setShowHeartBurst] = useState(false);
    const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
    const [displayLikes, setDisplayLikes] = useState(post.likes);

    // Update displayed likes when post changes
    useEffect(() => {
        setDisplayLikes(post.likes);
        setIsLiked(false);
    }, [igIdx, post.likes]);

    // Auto-trigger heart animation periodically — deferred to 5s so the LCP
    // frame and carousel rotation both settle before the first burst hits.
    useEffect(() => {
        let autoHeart: ReturnType<typeof setInterval> | null = null;
        let cancelled = false;
        const start = () => {
            if (cancelled) return;
            autoHeart = setInterval(() => { triggerHeartBurst(); }, 5000);
        };
        const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
        const handle = w.requestIdleCallback
            ? w.requestIdleCallback(start, { timeout: 5000 })
            : setTimeout(start, 5000);
        return () => {
            cancelled = true;
            if (autoHeart) clearInterval(autoHeart);
            if (w.requestIdleCallback && typeof handle === 'number') {
                (window as Window & { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(handle);
            } else {
                clearTimeout(handle as ReturnType<typeof setTimeout>);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const triggerHeartBurst = useCallback(() => {
        setShowHeartBurst(true);
        setTimeout(() => setShowHeartBurst(false), 800);

        // Spawn 3-5 floating hearts
        const count = 3 + Math.floor(Math.random() * 3);
        const newHearts: FloatingHeart[] = Array.from({ length: count }, () => ({
            id: heartIdCounter++,
            x: 30 + Math.random() * 60,
            size: 16 + Math.random() * 14,
        }));
        setFloatingHearts(prev => [...prev, ...newHearts]);
        setTimeout(() => {
            setFloatingHearts(prev => prev.filter(h => !newHearts.includes(h)));
        }, 1600);
    }, []);

    const handleDoubleTap = useCallback(() => {
        if (!isLiked) {
            setIsLiked(true);
            setDisplayLikes(prev => prev + 1);
        }
        triggerHeartBurst();
    }, [isLiked, triggerHeartBurst]);

    const toggleLike = useCallback(() => {
        setIsLiked(prev => {
            setDisplayLikes(l => prev ? l - 1 : l + 1);
            return !prev;
        });
        if (!isLiked) triggerHeartBurst();
    }, [isLiked, triggerHeartBurst]);

    return (
        <section
            ref={heroRef}
            className="relative flex flex-col h-dvh lg:h-auto lg:aspect-[21/9]"
            style={{ background: P.card, overflow: 'hidden' }}
        >
            <SectionEditControls sectionType="hero" sectionId={section.id} isActive={section.is_active} editMode={E} activeLang={activeLang} onToggleVisibility={onToggleVisibility || (() => {})} onMove={onMove || (() => {})} onTranslateSection={onTranslateSection} />
            {/* MOBILE: Full-screen Instagram experience */}
            <div className="absolute inset-0 lg:hidden" style={{ background: '#000' }} />

            <div className="relative z-10 w-full flex flex-col lg:hidden" style={{ height: '100dvh' }}>
                {/* Scrim overlay — top */}
                <div className="absolute inset-0 z-[2] pointer-events-none" style={{
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.15) 8%, rgba(0,0,0,0.05) 18%, transparent 35%)',
                }} />
                {/* Scrim overlay — bottom (covers IG engagement + conversion card) */}
                <div className="absolute bottom-0 inset-x-0 z-[2] pointer-events-none" style={{
                    height: '65%',
                    background: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.98) 25%, rgba(0,0,0,0.88) 50%, rgba(0,0,0,0.5) 75%, transparent 100%)',
                }} />

                {/* ── Full-screen Post Media (background layer — image or video) ── */}
                <div className="absolute inset-0 z-[1] overflow-hidden" onClick={handleDoubleTap}>
                    <AnimatePresence>
                        {post.mediaType === 'video' ? (
                            <motion.video
                                key={`vid-${igIdx}-${post.id}`}
                                src={post.image}
                                autoPlay
                                muted
                                loop
                                playsInline
                                preload="metadata"
                                poster="/landing.webp"
                                className="absolute inset-0 w-full h-full object-cover"
                                style={{ objectPosition: post.objectPos }}
                                initial={igIdx === 0 ? false : { opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.6, ease: 'easeInOut' }}
                            />
                        ) : (
                            <motion.img
                                key={`img-${igIdx}-${post.id}`}
                                src={post.image}
                                alt="CAFEPASTE beverage art"
                                loading={igIdx === 0 ? "eager" : "lazy"}
                                fetchPriority={igIdx === 0 ? "high" : "auto"}
                                decoding="async"
                                className="absolute inset-0 w-full h-full object-cover"
                                style={{ objectPosition: post.objectPos }}
                                // İlk frame anında görünür; sonraki carousel slide'ları cross-fade'le geçer.
                                initial={igIdx === 0 ? false : { opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.6, ease: 'easeInOut' }}
                                onError={(e) => { (e.target as HTMLImageElement).src = '/landing.webp'; }}
                            />
                        )}
                    </AnimatePresence>

                    {/* Double-tap heart burst */}
                    <AnimatePresence>
                        {showHeartBurst && (
                            <motion.div
                                initial={{ scale: 0, opacity: 1 }}
                                animate={{ scale: 1.3, opacity: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                            >
                                <svg width="80" height="80" viewBox="0 0 24 24" fill="white" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}>
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                </svg>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Floating hearts */}
                    <FloatingHearts hearts={floatingHearts} />
                </div>

                <div className="flex flex-col h-full relative z-30">
                    {/* ── Post: User Row ── */}
                    {showPostHeader && (
                    <div className="flex items-center px-5 pt-16 shrink-0">
                        <div className="w-8 h-8 rounded-full shrink-0 mr-3" style={{ background: '#DE2530', border: '1px solid rgba(255,255,255,0.2)' }} />
                        <div className="flex flex-col gap-0.5 flex-1">
                            <AnimatePresence mode="wait">
                                <motion.p key={`user-${igIdx}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3 }} className="text-[14px] font-bold text-white leading-none">
                                    {post.user}
                                </motion.p>
                            </AnimatePresence>
                            <AnimatePresence mode="wait">
                                <motion.p key={`loc-${igIdx}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[12px] leading-none" style={{ color: 'rgba(255,255,255,0.8)' }}>
                                    {post.location}
                                </motion.p>
                            </AnimatePresence>
                        </div>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                    </div>
                    )}

                    {/* ── Spacer — pushes conversion + engagement to bottom ── */}
                    <div className="flex-1 min-h-0" />

                    {/* ── Full-width Conversion Card (sits directly above IG engagement) ── */}
                    <div
                        className="shrink-0"
                        style={{
                            padding: 'clamp(16px,3vh,28px) 20px clamp(14px,2.5vh,22px) 20px',
                        }}
                    >
                        {/* Headline */}
                        <h1 className="font-bold leading-[1.2] tracking-[-0.5px]" style={{ fontSize: 'clamp(14px,5.5vw,28px)', color: '#FFFFFF', marginBottom: 'clamp(10px,2vh,20px)' }}>
                            <EditableText value={headline} sectionType="hero" fieldKey="headline" onUpdate={upd} editMode={E} activeLang={activeLang} tag="span" />{' '}<EditableText value={headlineAccent} sectionType="hero" fieldKey="headline_accent" onUpdate={upd} editMode={E} activeLang={activeLang} tag="span" style={{ color: '#DE2530' }} />{' '}<EditableText value={headlineSuffix} sectionType="hero" fieldKey="headline_suffix" onUpdate={upd} editMode={E} activeLang={activeLang} tag="span" />
                        </h1>

                        {/* Product description — small clarifying line below headline */}
                        {productDesc && (
                            <p
                                className="leading-snug"
                                style={{
                                    fontSize: 'clamp(11px, 2.8vw, 13px)',
                                    color: 'rgba(255,255,255,0.55)',
                                    marginBottom: 'clamp(8px,1.5vh,16px)',
                                }}
                            >
                                <EditableText
                                    value={productDesc}
                                    sectionType="hero"
                                    fieldKey="product_description"
                                    onUpdate={upd}
                                    editMode={E}
                                    activeLang={activeLang}
                                    tag="span"
                                />
                            </p>
                        )}

                        {/* Trust Row — brand text + rotating logo marquee */}
                        <div style={{ marginBottom: 'clamp(12px,2.5vh,24px)' }}>
                            <p className="leading-snug mb-2 text-center" style={{ fontSize: 'clamp(12px,3.2vw,15px)', color: 'rgba(255,255,255,0.8)' }}>
                                <EditableText value={brandStatText} sectionType="hero" fieldKey="brand_stat_text" onUpdate={upd} editMode={E} activeLang={activeLang} tag="span" />
                            </p>
                            <LogoMarquee heightClass="h-7" gapClass="gap-8" durationSec={14} opacityClass="opacity-75" maskWidthClass="w-8" />
                        </div>

                        {/* CTA — dual buttons */}
                        <div className="flex items-stretch gap-2" style={{ marginBottom: 'clamp(8px,1.5vh,16px)' }}>
                            <button
                                onClick={() => navigateTo(ctaTarget)}
                                className="flex-1 flex items-center justify-center gap-1.5 font-semibold cursor-pointer whitespace-nowrap text-center leading-tight overflow-hidden group active:scale-[0.98] transition-transform"
                                style={{
                                    background: P.primary,
                                    color: '#FAFAFA',
                                    boxShadow: '0 8px 32px rgba(196,30,42,0.4)',
                                    borderRadius: 'clamp(12px,3vw,16px)',
                                    padding: 'clamp(12px,1.5vw,20px) clamp(16px,2vw,32px)',
                                    fontSize: 'clamp(14px,1vw,16px)',
                                }}
                            >
                                <span className="truncate"><EditableText value={ctaLabel} sectionType="hero" fieldKey="cta_label" onUpdate={upd} editMode={E} activeLang={activeLang} tag="span" /></span>
                                <ArrowRight size={15} className="shrink-0" />
                            </button>
                            <button
                                onClick={scrollToSecondary}
                                className="flex-1 flex items-center justify-center gap-1.5 font-semibold cursor-pointer whitespace-nowrap text-center leading-tight overflow-hidden group"
                                style={{
                                    background: 'transparent',
                                    border: '1.5px solid rgba(255,255,255,0.35)',
                                    color: 'white',
                                    borderRadius: 'clamp(12px,3vw,16px)',
                                    padding: 'clamp(12px,1.5vw,20px) clamp(16px,2vw,32px)',
                                    fontSize: 'clamp(14px,1vw,16px)',
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="shrink-0"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" /><polygon points="6.5,5 11.5,8 6.5,11" fill="currentColor" /></svg>
                                <span className="truncate"><EditableText value={secondaryCtaLabel} sectionType="hero" fieldKey="secondary_cta_label" onUpdate={upd} editMode={E} activeLang={activeLang} tag="span" /></span>
                            </button>
                        </div>

                    </div>

                </div>
            </div>

            {/* DESKTOP — Cinematic full-background hero */}
            {/* BG video/image layer */}
            <div className="hidden lg:block absolute inset-0">
                {isVideo ? (
                    // preload="metadata": full video'yu hemen indirme — poster
                    // (heroImageDesktop, 47KB WebP) ilk frame'i kapsıyor. Video
                    // dosyası autoPlay başlayınca progressive olarak gelir.
                    // Aksi durumda 5-30MB MP4 ilk paint'le bant genişliği için
                    // yarışırdı; LCP zaten image olduğundan video'yu öne almak
                    // gereksiz.
                    <video
                        src={heroVideo}
                        poster={heroImageDesktop}
                        preload="metadata"
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ objectPosition: 'center 40%' }}
                        autoPlay muted loop playsInline
                    />
                ) : (
                    // <picture> ile AVIF (en küçük, modern tarayıcılar) -> WebP
                    // (yaygın destek) -> JPG/PNG fallback. CMS özel görseli
                    // kullanıldığında <picture> source'ları yine en optimize
                    // yerel WebP/AVIF'i veriyor; eski src sadece son fallback.
                    <picture>
                        {heroImageDesktop === '/hero-desktop.webp' && (
                            <source srcSet="/hero-desktop.avif" type="image/avif" />
                        )}
                        {heroImageDesktop === '/hero-desktop.webp' && (
                            <source srcSet="/hero-desktop.webp" type="image/webp" />
                        )}
                        <img
                            src={heroImageDesktop}
                            alt="CAFEPASTE Beverage Art Creator"
                            loading="eager"
                            fetchPriority="high"
                            decoding="async"
                            className="absolute inset-0 w-full h-full object-cover"
                            style={{ objectPosition: 'center 40%' }}
                            onError={(e) => { (e.target as HTMLImageElement).src = '/hero-desktop.webp'; }}
                        />
                    </picture>
                )}
                {/* Dark gradient overlay — right-to-left fade, darkens behind text on left */}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to left, transparent 0%, rgba(0,0,0,0.3) 30%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.85) 100%)' }} />
            </div>

            {/* Desktop content */}
            <div className="hidden lg:flex relative z-10 items-center w-full h-full max-w-[1280px] mx-auto px-12">
                <div className="max-w-[520px]">
                    {showLaunchBadge && (
                        <div>
                            <span className="inline-flex items-center gap-2 rounded px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase mb-7" style={{ background: 'transparent', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.2)' }}>
                                <motion.div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: P.primary }} animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} />
                                {launchLabel} · {t('landing.limitedSlots')}
                            </span>
                        </div>
                    )}

                    <h1 className="font-bold leading-[1.06] tracking-[-0.03em] mb-5" style={{ fontSize: '3.2rem', color: '#FFFFFF' }}>
                        <EditableText value={headline} sectionType="hero" fieldKey="headline" onUpdate={upd} editMode={E} activeLang={activeLang} tag="span" />{' '}<EditableText value={headlineAccent} sectionType="hero" fieldKey="headline_accent" onUpdate={upd} editMode={E} activeLang={activeLang} tag="span" style={{ color: P.primary }} />{' '}<EditableText value={headlineSuffix} sectionType="hero" fieldKey="headline_suffix" onUpdate={upd} editMode={E} activeLang={activeLang} tag="span" />
                    </h1>

                    <EditableText value={subtitle} sectionType="hero" fieldKey="subtitle" onUpdate={upd} editMode={E} activeLang={activeLang} tag="p" className="text-[18px] leading-[1.7] mb-8" style={{ color: 'rgba(255,255,255,0.75)', maxWidth: 460 }}>
                        <span>{subtitle}</span>
                    </EditableText>

                    <div className="flex gap-3 mb-10">
                        <button
                            onClick={() => navigateTo(ctaTarget)}
                            className="inline-flex items-center justify-center gap-2 font-semibold rounded py-3.5 px-8 min-h-[48px] transition-all duration-200 active:scale-[0.98] cursor-pointer whitespace-nowrap overflow-hidden group"
                            style={{ background: P.primary, color: '#FAFAFA', boxShadow: '0 8px 32px rgba(196,30,42,0.4)', fontSize: 'clamp(13px, 1.2vw, 15px)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = P.primaryHover)}
                            onMouseLeave={e => (e.currentTarget.style.background = P.primary)}
                        >
                            <span className="truncate"><EditableText value={ctaLabel} sectionType="hero" fieldKey="cta_label" onUpdate={upd} editMode={E} activeLang={activeLang} tag="span" /></span>
                            <ArrowRight size={15} className="shrink-0" />
                        </button>
                        <button onClick={scrollToSecondary} className="inline-flex items-center justify-center gap-2 font-semibold rounded py-3.5 px-7 min-h-[48px] transition-all duration-200 cursor-pointer whitespace-nowrap overflow-hidden group" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#FFFFFF', fontSize: 'clamp(13px, 1.2vw, 15px)' }}>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="shrink-0"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" /><polygon points="6.5,5 11.5,8 6.5,11" fill="currentColor" /></svg>
                            <span className="truncate"><EditableText value={secondaryCtaLabel} sectionType="hero" fieldKey="secondary_cta_label" onUpdate={upd} editMode={E} activeLang={activeLang} tag="span" /></span>
                        </button>
                    </div>

                    <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <p className="text-[13px] font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                            <EditableText value={brandStatText} sectionType="hero" fieldKey="brand_stat_text" onUpdate={upd} editMode={E} activeLang={activeLang} tag="span" />
                        </p>
                        <div className="flex items-center gap-3">
                            {[0, 1, 2, 3].map((i) => (
                                <React.Fragment key={i}>
                                    {i > 0 && <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>}
                                    <span className="text-[10px] font-medium uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                                        <EditableText value={c[`hero_cat_${i}`] ?? t(`landing.heroCat${i}`)} sectionType="hero" fieldKey={`hero_cat_${i}`} onUpdate={upd} editMode={E} activeLang={activeLang} tag="span" />
                                    </span>
                                </React.Fragment>
                            ))}
                        </div>
                        <LogoMarquee className="mt-2.5" heightClass="h-10" gapClass="gap-10" durationSec={12} opacityClass="opacity-70" maskWidthClass="w-12" maxWidth={420} />
                    </div>
                </div>
            </div>


        </section>
    );
}
