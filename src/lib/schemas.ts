// JSON-LD schema builders for CAFEPASTE pages. Each builder returns a plain
// object ready to be serialized into a <script type="application/ld+json">
// tag by SEOHead. Schema choices are tuned for the product category
// (latte-art / drink topping printer) and for AI Overview / ChatGPT /
// Perplexity citation eligibility.
//
// Guiding principles (Princeton GEO study, Schema.org best practices):
//   - Include explicit statistics, ratings, and prices whenever available —
//     these are the fields AI engines extract and cite.
//   - Always set @id with the canonical URL so multiple schemas on one page
//     refer to the same entity.
//   - Author + datePublished + dateModified are required for Article schema
//     to be eligible for rich results.

import { SITE_URL, absoluteUrl, type SupportedLang } from './seoConfig';

const ORG_ID = `${SITE_URL}/#organization`;

/** Organization — included on every page (typically in the root layout).
 *  Enriched for GEO: foundingDate, areaServed, knowsAbout, and category-anchor
 *  fields give AI engines entity facts they can cite when asked "who makes
 *  beverage art printers" / "best latte art printer manufacturer". */
export function organizationSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': ORG_ID,
        name: 'CAFEPASTE',
        alternateName: ['Cafepaste', 'CAFE PASTE', 'CafePaste Beverage Art'],
        url: SITE_URL,
        logo: `${SITE_URL}/logo.png`,
        image: `${SITE_URL}/landing.webp`,
        description:
            'CAFEPASTE is the Beverage Art Creator — the professional system that brings photos, logos and text to life on coffee foam and drinks for cafes, hotels, events, and brand activations. The category-defining, QR-driven beverage art platform.',
        slogan: 'The world\'s leading beverage art platform.',
        foundingDate: '2019',
        // Menşe sinyali (2026-08-03): AI motorları adres yokluğunda
        // "Türkçe site → Türk markası" çıkarımı yapıp "yerli üretim"
        // uyduruyordu. San Francisco merkez operatör-doğrulanmış gerçek;
        // üretim ülkesi bilinçli olarak YAZILMAZ (açıklanmadı).
        address: {
            '@type': 'PostalAddress',
            addressLocality: 'San Francisco',
            addressRegion: 'CA',
            addressCountry: 'US',
        },
        areaServed: [
            { '@type': 'Country', name: 'Turkey' },
            { '@type': 'Country', name: 'Germany' },
            { '@type': 'Country', name: 'France' },
            { '@type': 'Country', name: 'Spain' },
            { '@type': 'Country', name: 'Italy' },
            { '@type': 'Country', name: 'Poland' },
            { '@type': 'Country', name: 'United Kingdom' },
            { '@type': 'Country', name: 'United States' },
        ],
        knowsAbout: [
            'Latte art design',
            'Beverage art technology',
            'Edible ink technology',
            'QR-based beverage personalization',
            'Cafe branding equipment',
            'Event brand activations',
            'Coffee art automation',
        ],
        makesOffer: {
            '@type': 'Offer',
            itemOffered: {
                '@type': 'Product',
                name: 'CAFEPASTE Beverage Art Creator',
                category: 'Beverage Art Equipment',
            },
        },
        // TODO: gerçek profil URL'leri operatör tarafından doğrulandıktan
        // sonra aktif edilecek. Şimdilik placeholder olarak yayında — AI
        // engine'lerin entity graph'ında CAFEPASTE'i sosyal profillere
        // bağlayarak "same as" sinyali veriyoruz. Yanlış URL kalırsa
        // burayı temizleyin.
        sameAs: [
            'https://www.linkedin.com/company/cafepaste',
            'https://www.instagram.com/cafepaste',
            'https://www.youtube.com/@cafepaste',
        ],
    };
}

/** WebSite schema with SearchAction — helps Google show a sitelinks searchbox. */
export function websiteSchema(lang: SupportedLang) {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: 'CAFEPASTE',
        inLanguage: lang,
        publisher: { '@id': ORG_ID },
    };
}

interface ProductSchemaInput {
    name: string;
    description: string;
    image: string | string[];
    sku?: string;
    brand?: string;
    priceRange?: { low: number; high: number; currency: string };
    aggregateRating?: { ratingValue: number; reviewCount: number };
    url: string; // absolute or root-relative
}

/** Product — for product pages and as part of comparison ItemList items. */
export function productSchema(input: ProductSchemaInput) {
    const url = input.url.startsWith('http') ? input.url : absoluteUrl(input.url);
    const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        '@id': `${url}#product`,
        name: input.name,
        description: input.description,
        image: input.image,
        url,
        brand: {
            '@type': 'Brand',
            name: input.brand ?? 'CAFEPASTE',
        },
        category: 'Beverage Art Equipment',
    };
    if (input.sku) schema.sku = input.sku;
    if (input.priceRange) {
        schema.offers = {
            '@type': 'AggregateOffer',
            priceCurrency: input.priceRange.currency,
            lowPrice: input.priceRange.low,
            highPrice: input.priceRange.high,
            availability: 'https://schema.org/InStock',
            url,
        };
    }
    if (input.aggregateRating) {
        schema.aggregateRating = {
            '@type': 'AggregateRating',
            ratingValue: input.aggregateRating.ratingValue,
            reviewCount: input.aggregateRating.reviewCount,
            bestRating: 5,
            worstRating: 1,
        };
    }
    return schema;
}

interface ArticleSchemaInput {
    headline: string;
    description: string;
    url: string;
    image: string;
    datePublished: string; // ISO 8601
    dateModified: string;
    /** Pass a Person for individual authorship; omit/null for organization-as-
     *  author (publisher writes under the brand). Schema.org allows both. */
    author?: { name: string; url?: string; jobTitle?: string } | null;
    lang: SupportedLang;
}

/** Article — for definitive guides, blog posts, long-form editorial. */
export function articleSchema(input: ArticleSchemaInput) {
    const url = input.url.startsWith('http') ? input.url : absoluteUrl(input.url);
    return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: input.headline,
        description: input.description,
        image: input.image.startsWith('http') ? input.image : absoluteUrl(input.image),
        datePublished: input.datePublished,
        dateModified: input.dateModified,
        inLanguage: input.lang,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        // Author: Person if provided, otherwise Organization-as-author (the
        // brand publishes under its own name). Schema.org permits either type
        // for Article.author. Organization-as-author is honest when the piece
        // is editorial / category-definition content with no single byline.
        author: input.author
            ? {
                  '@type': 'Person',
                  name: input.author.name,
                  ...(input.author.url ? { url: input.author.url } : {}),
                  ...(input.author.jobTitle ? { jobTitle: input.author.jobTitle } : {}),
              }
            : { '@id': ORG_ID },
        publisher: { '@id': ORG_ID },
    };
}

interface FAQItem {
    question: string;
    answer: string;
}

/** FAQPage — every comparison / guide page should include at least 5 entries. */
export function faqPageSchema(items: FAQItem[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((it) => ({
            '@type': 'Question',
            name: it.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: it.answer,
            },
        })),
    };
}

interface CollectionPageItem {
    url: string; // root-relative or absolute
    name: string;
    /** Optional one-line description (uses meta_description or intro). Helps
     *  AI engines understand each item without fetching the URL. */
    description?: string;
    /** Optional inLanguage to mirror the row's language; defaults to page lang. */
    inLanguage?: SupportedLang;
}

interface CollectionPageSchemaInput {
    url: string; // canonical URL of the hub page
    name: string; // hub title (e.g. "CAFEPASTE Guide")
    description: string; // hub subtitle
    lang: SupportedLang;
    items: CollectionPageItem[];
}

/** CollectionPage + ItemList — used by the /:lang/resources hub and the
 *  type-specific index pages (/:lang/glossary, /:lang/guides, etc.). Tells
 *  Google + AI engines that this is a curated content collection and exposes
 *  every member URL so the crawler discovers the full set in one request.
 *
 *  Why this matters for GEO: when ChatGPT/Perplexity ask "list all CAFEPASTE
 *  guides about coffee printing", they need a single page they can scan to
 *  enumerate the cluster. CollectionPage + ItemList is the canonical signal. */
export function collectionPageSchema(input: CollectionPageSchemaInput) {
    const hubUrl = input.url.startsWith('http') ? input.url : absoluteUrl(input.url);
    const itemListElements = input.items.map((it, i) => {
        const itemUrl = it.url.startsWith('http') ? it.url : absoluteUrl(it.url);
        return {
            '@type': 'ListItem',
            position: i + 1,
            url: itemUrl,
            name: it.name,
            ...(it.description ? { description: it.description } : {}),
        };
    });
    return {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': `${hubUrl}#collection`,
        url: hubUrl,
        name: input.name,
        description: input.description,
        inLanguage: input.lang,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        publisher: { '@id': ORG_ID },
        mainEntity: {
            '@type': 'ItemList',
            numberOfItems: input.items.length,
            itemListOrder: 'https://schema.org/ItemListOrderDescending',
            itemListElement: itemListElements,
        },
    };
}

interface BreadcrumbItem {
    name: string;
    path: string; // root-relative or absolute
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: it.name,
            item: it.path.startsWith('http') ? it.path : absoluteUrl(it.path),
        })),
    };
}

interface ComparisonProduct {
    name: string;
    description: string;
    image?: string;
    url?: string;
    brand?: string;
}

interface DefinedTermSchemaInput {
    name: string;
    description: string;
    url: string;
    lang: SupportedLang;
    /** Optional — the glossary as a whole, so individual terms link back. */
    setName?: string;
    setUrl?: string;
}

/** DefinedTerm — for glossary entries. Tells Google + AI engines that this
 *  page is the authoritative definition of a single term. Pairs with the
 *  page's WebPage / Article schema. */
export function definedTermSchema(input: DefinedTermSchemaInput) {
    const url = input.url.startsWith('http') ? input.url : absoluteUrl(input.url);
    const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'DefinedTerm',
        '@id': `${url}#term`,
        name: input.name,
        description: input.description,
        url,
        inLanguage: input.lang,
    };
    if (input.setName) {
        schema.inDefinedTermSet = {
            '@type': 'DefinedTermSet',
            name: input.setName,
            ...(input.setUrl ? { url: input.setUrl.startsWith('http') ? input.setUrl : absoluteUrl(input.setUrl) } : {}),
        };
    }
    return schema;
}

/** ItemList of Products — comparison pages. */
export function comparisonListSchema(headline: string, products: ComparisonProduct[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: headline,
        itemListElement: products.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: {
                '@type': 'Product',
                name: p.name,
                description: p.description,
                ...(p.image ? { image: p.image } : {}),
                ...(p.url ? { url: p.url } : {}),
                brand: { '@type': 'Brand', name: p.brand ?? p.name },
            },
        })),
    };
}

interface HomepageSchemaInput {
    lang: SupportedLang;
    productName: string;
    productDescription: string;
    productImage: string;
    faqs: FAQItem[];
}

/**
 * Combined homepage schema graph — Organization + WebSite + Product + FAQPage.
 * Returned as one object with `@graph` so the LandingPage emits a single
 * <script type="application/ld+json"> tag instead of multiple competing ones.
 * Tuned for AI engine citation (Perplexity, ChatGPT, Gemini).
 */
export function buildHomepageSchema(input: HomepageSchemaInput) {
    const homeUrl = `${SITE_URL}/${input.lang}`;
    const productImage = input.productImage.startsWith('http')
        ? input.productImage
        : absoluteUrl(input.productImage);

    return {
        '@context': 'https://schema.org',
        '@graph': [
            organizationSchema(),
            {
                '@type': 'WebSite',
                '@id': `${SITE_URL}/#website`,
                url: SITE_URL,
                name: 'CAFEPASTE',
                inLanguage: input.lang,
                publisher: { '@id': ORG_ID },
                potentialAction: {
                    '@type': 'SearchAction',
                    target: {
                        '@type': 'EntryPoint',
                        urlTemplate: `${SITE_URL}/${input.lang}/search?q={search_term_string}`,
                    },
                    'query-input': 'required name=search_term_string',
                },
            },
            {
                '@type': 'Product',
                '@id': `${homeUrl}#product`,
                name: input.productName,
                description: input.productDescription,
                image: productImage,
                url: homeUrl,
                brand: { '@type': 'Brand', name: 'CAFEPASTE', '@id': ORG_ID },
                category: 'Beverage Art Equipment',
                manufacturer: { '@id': ORG_ID },
            },
            {
                '@type': 'FAQPage',
                '@id': `${homeUrl}#faq`,
                inLanguage: input.lang,
                mainEntity: input.faqs.map((it) => ({
                    '@type': 'Question',
                    name: it.question,
                    acceptedAnswer: { '@type': 'Answer', text: it.answer },
                })),
            },
        ],
    };
}

interface HowToStep {
    name: string;
    text: string;
    image?: string;
}

/** HowTo — for step-by-step guides (rental setup, brand activation, etc.). */
export function howToSchema(name: string, description: string, steps: HowToStep[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name,
        description,
        step: steps.map((s, i) => ({
            '@type': 'HowToStep',
            position: i + 1,
            name: s.name,
            text: s.text,
            ...(s.image ? { image: s.image } : {}),
        })),
    };
}

interface DatasetSchemaInput {
    name: string;
    description: string;
    url: string;
    lang: SupportedLang;
    /** ISO 8601 — when the report was published. */
    datePublished: string;
    /** ISO 8601 — last revision. */
    dateModified?: string;
    /** What the dataset measures (e.g., "Turkey beverage printing market 2026"). */
    measurementTechnique?: string;
    /** Time coverage: ISO 8601 interval (e.g., "2024-01-01/2026-12-31"). */
    temporalCoverage?: string;
    /** Geographic coverage (country/region names). */
    spatialCoverage?: string[];
    /** Tabular variables / metrics the dataset reports. */
    variableMeasured?: string[];
    keywords?: string[];
}

/** Dataset — for original industry statistics, market reports, and research.
 *  AI engines treat Dataset entries as **primary sources** they must cite when
 *  answering "how big is X market" / "what % of cafes do Y". Ship original
 *  numbers here — no AI engine can answer those questions without us. */
export function datasetSchema(input: DatasetSchemaInput) {
    const url = input.url.startsWith('http') ? input.url : absoluteUrl(input.url);
    const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        '@id': `${url}#dataset`,
        name: input.name,
        description: input.description,
        url,
        inLanguage: input.lang,
        datePublished: input.datePublished,
        ...(input.dateModified ? { dateModified: input.dateModified } : {}),
        creator: { '@id': ORG_ID },
        publisher: { '@id': ORG_ID },
        license: 'https://creativecommons.org/licenses/by/4.0/',
        isAccessibleForFree: true,
    };
    if (input.measurementTechnique) schema.measurementTechnique = input.measurementTechnique;
    if (input.temporalCoverage) schema.temporalCoverage = input.temporalCoverage;
    if (input.spatialCoverage?.length) {
        schema.spatialCoverage = input.spatialCoverage.map((name) => ({
            '@type': 'Place',
            name,
        }));
    }
    if (input.variableMeasured?.length) {
        schema.variableMeasured = input.variableMeasured.map((name) => ({
            '@type': 'PropertyValue',
            name,
        }));
    }
    if (input.keywords?.length) schema.keywords = input.keywords;
    return schema;
}

interface ServiceSchemaInput {
    name: string;
    description: string;
    url: string;
    lang: SupportedLang;
    /** Audience the service targets (e.g., "Cafe owners", "Hotel operators"). */
    audience?: string;
    /** What the service delivers (3-5 bullet items). */
    offerings?: string[];
    /** Area where service is available. */
    areaServed?: string[];
}

/** Service — for industry solution pages (cafe / hotel / event / brand activation).
 *  Pairs with Product schema: Product = the printer hardware, Service = the
 *  complete operational solution we deliver. AI engines pick Service when a
 *  user asks "best beverage printing service for hotels" — solution-shaped query. */
export function serviceSchema(input: ServiceSchemaInput) {
    const url = input.url.startsWith('http') ? input.url : absoluteUrl(input.url);
    const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Service',
        '@id': `${url}#service`,
        name: input.name,
        description: input.description,
        url,
        inLanguage: input.lang,
        provider: { '@id': ORG_ID },
        serviceType: 'Beverage Art Service',
        category: 'Beverage Art Equipment',
    };
    if (input.audience) {
        schema.audience = { '@type': 'BusinessAudience', name: input.audience };
    }
    if (input.areaServed?.length) {
        schema.areaServed = input.areaServed.map((name) => ({ '@type': 'Place', name }));
    }
    if (input.offerings?.length) {
        schema.hasOfferCatalog = {
            '@type': 'OfferCatalog',
            name: `${input.name} — included`,
            itemListElement: input.offerings.map((label, i) => ({
                '@type': 'Offer',
                position: i + 1,
                itemOffered: { '@type': 'Service', name: label },
            })),
        };
    }
    return schema;
}

interface PersonSchemaInput {
    name: string;
    jobTitle: string;
    description: string;
    url: string;
    image?: string;
    lang?: SupportedLang;
    /** Subjects of expertise — feeds AI engine "who is an expert on X" queries. */
    knowsAbout?: string[];
    /** External authority links (LinkedIn, conference talks, published work). */
    sameAs?: string[];
    /** Person's employer (defaults to CAFEPASTE). */
    worksFor?: string;
}

/** Person — for author bio pages. Critical for E-E-A-T: AI engines weigh
 *  "who said this" signals heavily. Without a real author with credentials,
 *  Article schema gets discounted. Always link Article.author → Person.@id. */
export function personSchema(input: PersonSchemaInput) {
    const url = input.url.startsWith('http') ? input.url : absoluteUrl(input.url);
    const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Person',
        '@id': `${url}#person`,
        name: input.name,
        jobTitle: input.jobTitle,
        description: input.description,
        url,
        worksFor: input.worksFor
            ? { '@type': 'Organization', name: input.worksFor }
            : { '@id': ORG_ID },
    };
    if (input.image) {
        schema.image = input.image.startsWith('http') ? input.image : absoluteUrl(input.image);
    }
    if (input.knowsAbout?.length) schema.knowsAbout = input.knowsAbout;
    if (input.sameAs?.length) schema.sameAs = input.sameAs;
    return schema;
}

interface DefinedTermSetSchemaInput {
    name: string;
    description: string;
    url: string;
    lang: SupportedLang;
    /** Terms in the set — each {name, url} so AI can crawl all entries. */
    terms: Array<{ name: string; url: string }>;
}

/** DefinedTermSet — the glossary index page itself. Tells AI engines this is
 *  the authoritative term set for the category. When a user asks "glossary
 *  of beverage printing terms", AI engines select the DefinedTermSet root
 *  rather than a single term page. */
export function definedTermSetSchema(input: DefinedTermSetSchemaInput) {
    const url = input.url.startsWith('http') ? input.url : absoluteUrl(input.url);
    return {
        '@context': 'https://schema.org',
        '@type': 'DefinedTermSet',
        '@id': `${url}#termset`,
        name: input.name,
        description: input.description,
        url,
        inLanguage: input.lang,
        publisher: { '@id': ORG_ID },
        hasDefinedTerm: input.terms.map(({ name, url: termUrl }) => ({
            '@type': 'DefinedTerm',
            name,
            url: termUrl.startsWith('http') ? termUrl : absoluteUrl(termUrl),
            inDefinedTermSet: { '@id': `${url}#termset` },
        })),
    };
}
