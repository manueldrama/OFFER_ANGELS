// Shared SEO content-block renderer.
//
// This module is the SINGLE SOURCE OF TRUTH for how a `content_json` block
// turns into markup. Both the public page (src/pages/seo/SeoContentPage.tsx)
// and the admin editor's live-preview panel import `ContentBlock` from here,
// so what an editor sees while writing is byte-for-byte what visitors get.
//
// CSS rules live in seo-components.css (.prose, .callout, .steps, etc). The
// renderer only outputs the right markup; styling happens in CSS.
//
// Extracted verbatim from SeoContentPage.tsx (Faz 1) — behaviour unchanged.

import { Link } from 'react-router-dom';
import { getUiStrings, type SupportedLang } from '../../lib/seoConfig';
import type { SeoContentBlock } from '../../services/seoPageService';
import { richInner } from './RichText';
import { toEmbedUrl } from '../../lib/seoInlineHtml';

// ─── Slug-safe id from heading text — H2 anchor + TOC matching ───────────────
// Exported so SeoContentPage's TOC extractor uses the EXACT same ids as the
// rendered <h2 id> anchors (parity guarantee).
export function slugifyHeading(text: string): string {
    return text
        .toLowerCase()
        .replace(/[çÇ]/g, 'c')
        .replace(/[şŞ]/g, 's')
        .replace(/[ğĞ]/g, 'g')
        .replace(/[üÜ]/g, 'u')
        .replace(/[öÖ]/g, 'o')
        .replace(/[ıİ]/g, 'i')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

// Local copy of the editorial arrow glyph (cta_box uses it). Kept local so this
// module has no dependency back on SeoContentPage.
function ArrowIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 7h8m0 0L8 4m3 3L8 10" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    );
}

// ─── ContentBlock — design-ref class names everywhere ────────────────────────
export function ContentBlock({
    block,
    lang,
}: {
    block: SeoContentBlock;
    lang: SupportedLang;
}) {
    const ui = getUiStrings(lang);

    switch (block.type) {
        case 'heading': {
            const level = Math.min(Math.max((block.level as number) ?? 2, 2), 4);
            const text = (block.text as string) ?? '';
            if (level === 2) {
                return <h2 id={slugifyHeading(text)}>{text}</h2>;
            }
            if (level === 3) return <h3>{text}</h3>;
            return <h4>{text}</h4>;
        }
        case 'paragraph':
            return <p {...richInner((block.text as string) ?? '')} />;
        case 'list': {
            const items = (block.items as string[]) ?? [];
            const ordered = Boolean(block.ordered);
            const List = ordered ? 'ol' : 'ul';
            return (
                <List className="cp-list">
                    {items.map((it, i) => (
                        <li key={i} {...richInner(it)} />
                    ))}
                </List>
            );
        }
        case 'table': {
            const headers = (block.headers as string[]) ?? [];
            const rows = (block.rows as string[][]) ?? [];
            // Karşılaştırma tablolarında CAFEPASTE kolonu "önerilen kolon"
            // olarak vurgulanır (CSS: th/td.is-brand).
            const brandCol = headers.findIndex((h) =>
                (h ?? '').toUpperCase().includes('CAFEPASTE'),
            );
            return (
                <div style={{ overflowX: 'auto' }}>
                    <table>
                        <thead>
                            <tr>
                                {headers.map((h, i) => (
                                    <th
                                        key={i}
                                        className={i === brandCol ? 'is-brand' : undefined}
                                        {...richInner(h)}
                                    />
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, ri) => (
                                <tr key={ri}>
                                    {row.map((c, ci) => (
                                        <td
                                            key={ci}
                                            className={ci === brandCol ? 'is-brand' : undefined}
                                            {...richInner(c)}
                                        />
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }
        case 'stat': {
            // Design-ref doesn't have a dedicated .stat block; we render as
            // a 2-col mini-card pair using inline styles consistent with the
            // editorial tone. Single stat block → single card.
            const value = (block.value as string) ?? '';
            const label = (block.label as string) ?? '';
            const source = (block.source as string) ?? '';
            return (
                <figure
                    style={{
                        margin: 'var(--s7) 0',
                        background: 'var(--paper)',
                        borderRadius: 4,
                        padding: 'var(--s7)',
                        border: '1px solid var(--line)',
                    }}
                >
                    <div
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 'clamp(40px, 6vw, 64px)',
                            fontWeight: 400,
                            letterSpacing: '-0.03em',
                            lineHeight: 1,
                            color: 'var(--ink)',
                        }}
                    >
                        {value}
                    </div>
                    <div
                        style={{
                            fontSize: 'var(--fs-15)',
                            color: 'var(--text-2)',
                            marginTop: 10,
                            lineHeight: 1.5,
                        }}
                    >
                        {label}
                    </div>
                    {source && (
                        <figcaption
                            style={{
                                marginTop: 16,
                                fontSize: 'var(--fs-11)',
                                color: 'var(--text-3)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.12em',
                                fontWeight: 600,
                            }}
                        >
                            {ui.source}: {source}
                        </figcaption>
                    )}
                </figure>
            );
        }
        case 'quote': {
            const text = (block.text as string) ?? '';
            const attribution = (block.attribution as string) ?? '';
            return (
                <blockquote>
                    <span {...richInner(text)} />
                    {attribution && <cite>— {attribution}</cite>}
                </blockquote>
            );
        }
        case 'callout': {
            const text = (block.text as string) ?? '';
            const title =
                (block.title as string) ?? getUiStrings(lang).infoBoxLabel;
            return (
                <div className="callout">
                    <div className="callout__body">
                        <span className="callout__label">{title}</span>
                        <p {...richInner(text)} />
                    </div>
                </div>
            );
        }
        case 'image': {
            const src = (block.src as string) ?? '';
            const alt = (block.alt as string) ?? '';
            const caption = (block.caption as string) ?? '';
            const size = (block.size as string) ?? 'normal';
            if (!src) return null;
            return (
                <figure className={`cp-img cp-img--${size}`}>
                    <img src={src} alt={alt} loading="lazy" decoding="async" />
                    {caption && <figcaption>{caption}</figcaption>}
                </figure>
            );
        }

        // ─── GEO BLOCKS ───────────────────────────────────────────────────────
        case 'ai_answer_summary': {
            // GEO'ya özel kimlik: koyu ink panel (.callout--ai) — TL;DR'dan
            // görsel olarak ayrışır. items[] becomes <ul> inside the body.
            const text = (block.text as string) ?? '';
            const items = (block.items as string[]) ?? [];
            return (
                <div className="callout callout--ai">
                    <div className="callout__body">
                        <span className="callout__label">{ui.aiAnswerSummaryLabel}</span>
                        {text && <p {...richInner(text)} />}
                        {items.length > 0 && (
                            <ul className="callout__list">
                                {items.map((it, i) => <li key={i} {...richInner(it)} />)}
                            </ul>
                        )}
                    </div>
                </div>
            );
        }
        case 'key_takeaways': {
            const items = (block.items as string[]) ?? [];
            if (items.length === 0) return null;
            return (
                <div className="callout">
                    <div className="callout__body">
                        <span className="callout__label">{ui.keyTakeawaysLabel}</span>
                        <ul className="callout__list">
                            {items.map((it, i) => <li key={i} {...richInner(it)} />)}
                        </ul>
                    </div>
                </div>
            );
        }
        case 'info_box': {
            const text = (block.text as string) ?? '';
            const title = (block.title as string) ?? ui.infoBoxLabel;
            return (
                <div className="callout callout--tip">
                    <div className="callout__body">
                        <span className="callout__label">{title}</span>
                        <p {...richInner(text)} />
                    </div>
                </div>
            );
        }
        case 'warning_box': {
            const text = (block.text as string) ?? '';
            const title = (block.title as string) ?? ui.warningBoxLabel;
            return (
                <div className="callout callout--warn">
                    <div className="callout__body">
                        <span className="callout__label">{title}</span>
                        <p {...richInner(text)} />
                    </div>
                </div>
            );
        }
        case 'related_entities': {
            const items = (block.items as Array<{ title?: string; description?: string; href?: string }>) ?? [];
            if (items.length === 0) return null;
            return (
                <section style={{ margin: 'var(--s7) 0' }}>
                    <p className="eyebrow eyebrow--red" style={{ marginBottom: 'var(--s4)' }}>
                        {ui.relatedEntitiesLabel}
                    </p>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: 'var(--s3)',
                        }}
                    >
                        {items.map((it, i) => (
                            <a
                                key={i}
                                href={it.href ?? '#'}
                                style={{
                                    display: 'block',
                                    padding: 'var(--s4) var(--s5)',
                                    background: 'var(--paper)',
                                    border: '1px solid var(--line)',
                                    borderRadius: 'var(--r-md)',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    transition: 'border-color var(--d1)',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--red)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; }}
                            >
                                <strong style={{ fontSize: 'var(--fs-14)', color: 'var(--ink)' }}>
                                    {it.title}
                                </strong>
                                {it.description && (
                                    <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-13)', color: 'var(--text-3)', lineHeight: 1.5 }}>
                                        {it.description}
                                    </p>
                                )}
                            </a>
                        ))}
                    </div>
                </section>
            );
        }
        case 'cta_box': {
            const title = (block.title as string) ?? ui.ctaTitle;
            const body = (block.text as string) ?? ui.ctaBody;
            const buttonLabel = (block.button_label as string) ?? ui.ctaButton;
            const buttonHref = (block.button_href as string) ?? `/${lang}`;
            return (
                <div className="cta-band" style={{ margin: 'var(--s8) 0' }}>
                    <div>
                        <h3>{title}</h3>
                        <p>{body}</p>
                    </div>
                    <div className="cta-band__actions">
                        <Link to={buttonHref} className="btn btn--red">
                            {buttonLabel}
                            <ArrowIcon />
                        </Link>
                    </div>
                </div>
            );
        }
        case 'steps': {
            // Design-ref .steps — numbered process with optional hint per step.
            // block.items: Array<{ title, body, hint }>.
            const items = (block.items as Array<{ title?: string; body?: string; hint?: string }>) ?? [];
            if (items.length === 0) return null;
            return (
                <ol className="steps">
                    {items.map((step, i) => (
                        <li key={i}>
                            {step.title && <h4>{step.title}</h4>}
                            {step.body && <p {...richInner(step.body)} />}
                            {step.hint && <span className="hint">{step.hint}</span>}
                        </li>
                    ))}
                </ol>
            );
        }

        // ─── RICH CMS BLOCKS (Faz 4) ──────────────────────────────────────────
        case 'gallery': {
            const images = (block.images as Array<{ src?: string; alt?: string }>) ?? [];
            if (images.length === 0) return null;
            return (
                <div className="cp-gallery">
                    {images.map((img, i) =>
                        img.src ? (
                            <figure key={i}>
                                <img src={img.src} alt={img.alt ?? ''} loading="lazy" decoding="async" />
                            </figure>
                        ) : null,
                    )}
                </div>
            );
        }
        case 'video': {
            const url = (block.url as string) ?? '';
            const caption = (block.caption as string) ?? '';
            if (!url) return null;
            const embed = toEmbedUrl(url);
            return (
                <figure className="cp-video">
                    <div className="cp-video__frame">
                        {embed ? (
                            <iframe
                                src={embed}
                                title={caption || 'video'}
                                loading="lazy"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        ) : (
                            <video src={url} controls preload="metadata" />
                        )}
                    </div>
                    {caption && <figcaption>{caption}</figcaption>}
                </figure>
            );
        }
        case 'button': {
            const label = (block.label as string) ?? '';
            const href = (block.href as string) ?? '#';
            const style = (block.style as string) === 'dark' ? 'btn--on-dark' : 'btn--red';
            if (!label) return null;
            const internal = href.startsWith('/');
            return (
                <p className="cp-button-row">
                    {internal ? (
                        <Link to={href} className={`btn ${style}`}>
                            {label}
                            <ArrowIcon />
                        </Link>
                    ) : (
                        <a href={href} className={`btn ${style}`} target="_blank" rel="noopener">
                            {label}
                            <ArrowIcon />
                        </a>
                    )}
                </p>
            );
        }
        case 'divider':
            return <hr className="cp-divider" />;
        case 'accordion': {
            const items = (block.items as Array<{ q?: string; a?: string }>) ?? [];
            if (items.length === 0) return null;
            return (
                <div className="cp-accordion">
                    {items.map((it, i) => (
                        <details key={i}>
                            <summary>{it.q}</summary>
                            <div className="cp-accordion__body" {...richInner(it.a ?? '')} />
                        </details>
                    ))}
                </div>
            );
        }
        case 'code': {
            const code = (block.code as string) ?? '';
            const language = (block.language as string) ?? '';
            if (!code) return null;
            return (
                <pre className="cp-code" data-lang={language || undefined}>
                    <code>{code}</code>
                </pre>
            );
        }
        case 'product_card': {
            const title = (block.title as string) ?? '';
            const description = (block.description as string) ?? '';
            const image = (block.image as string) ?? '';
            const price = (block.price as string) ?? '';
            const buttonLabel = (block.button_label as string) ?? ui.ctaButton;
            const buttonHref = (block.button_href as string) ?? `/${lang}`;
            const internal = buttonHref.startsWith('/');
            return (
                <div className="cp-product-card">
                    {image && (
                        <div className="cp-product-card__media">
                            <img src={image} alt={title} loading="lazy" decoding="async" />
                        </div>
                    )}
                    <div className="cp-product-card__body">
                        <p className="cp-product-card__eyebrow">CAFEPASTE</p>
                        {title && <h3>{title}</h3>}
                        {description && <p className="cp-product-card__desc">{description}</p>}
                        {price && <p className="cp-product-card__price">{price}</p>}
                        {internal ? (
                            <Link to={buttonHref} className="btn btn--red">
                                {buttonLabel}
                                <ArrowIcon />
                            </Link>
                        ) : (
                            <a href={buttonHref} className="btn btn--red" target="_blank" rel="noopener">
                                {buttonLabel}
                                <ArrowIcon />
                            </a>
                        )}
                    </div>
                </div>
            );
        }

        default:
            if (typeof block.text === 'string') return <p>{block.text}</p>;
            return null;
    }
}
