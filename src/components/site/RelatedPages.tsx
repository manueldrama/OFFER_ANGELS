// "Related pages" card grid shown at the bottom of SEO content pages,
// between the FAQ and the CTA. Uses the landing FeaturesSection card
// aesthetic (white card, 1px border, hover lift) so it feels native.
//
// The cards link to other published pages of the same type in the same
// language. Empty list → component renders nothing, no awkward "0 related"
// state.

import type { RelatedPageCard } from '../../services/seoPageService';
import type { SupportedLang } from '../../lib/seoConfig';

const PATH_PREFIX: Record<RelatedPageCard['type'], string> = {
    homepage: '',
    comparison: 'compare',
    guide: 'guides',
    solution: 'solutions',
};

interface RelatedPagesProps {
    pages: RelatedPageCard[];
    lang: SupportedLang;
    title: string;
}

export function RelatedPages({ pages, lang, title }: RelatedPagesProps) {
    if (!pages.length) return null;
    return (
        <section className="mt-16 not-prose">
            <h2
                className="text-2xl font-bold tracking-tight text-[#111] mb-6"
                style={{ letterSpacing: '-0.02em' }}
            >
                {title}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
                {pages.map((p) => {
                    const prefix = PATH_PREFIX[p.type];
                    const href = prefix ? `/${lang}/${prefix}/${p.slug}` : `/${lang}`;
                    return (
                        <a
                            key={`${p.type}:${p.slug}`}
                            href={href}
                            className="group block rounded-xl border border-neutral-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                        >
                            {p.hero_image && (
                                <div className="mb-4 aspect-[16/9] overflow-hidden rounded-lg bg-neutral-100">
                                    <img
                                        src={p.hero_image}
                                        alt=""
                                        loading="lazy"
                                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                </div>
                            )}
                            <h3 className="text-base font-semibold text-[#111] leading-snug group-hover:text-[#C41E2A] transition-colors">
                                {p.title}
                            </h3>
                            {(p.intro || p.meta_description) && (
                                <p className="mt-2 text-sm text-neutral-600 leading-relaxed line-clamp-2">
                                    {(p.intro ?? p.meta_description).slice(0, 160)}
                                </p>
                            )}
                        </a>
                    );
                })}
            </div>
        </section>
    );
}
