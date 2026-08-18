// Central SEO configuration — single source of truth for site URL, supported
// languages, default market, and the public route map used by sitemap + hreflang.
// Imported by: sitemap worker route, SEOHead component, schemas.ts.

export const SITE_URL = 'https://cafepaste.com';

export const DEFAULT_LANG = 'tr';

// Hreflang x-default — the version AI engines and search engines fall back to
// when the user's locale doesn't match any of our published languages. English
// is the strongest global fallback because most AI engines are English-trained
// and untargeted markets (e.g., India, Brazil, MENA) understand EN broadly.
// TR market is still directly targeted via tr-TR, so no loss there.
export const X_DEFAULT_LANG: SupportedLang = 'en';

// Languages we publish indexable content in. Keep in sync with Supabase
// `languages` table; this list is the SEO-canonical subset (the table may carry
// in-progress translations that aren't yet ready to be indexed).
export const SUPPORTED_LANGS = ['tr', 'en', 'de', 'fr', 'es', 'it', 'pl'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

// hreflang region hints. `tr` and `pl` don't need a region split; English
// targets both UK and US markets, so we surface generic `en` plus regional
// alternates. Keep the same canonical URL — only the hreflang label changes.
export const HREFLANG_VARIANTS: Record<SupportedLang, string[]> = {
    tr: ['tr', 'tr-TR'],
    en: ['en', 'en-GB', 'en-US'],
    de: ['de', 'de-DE', 'de-AT', 'de-CH'],
    fr: ['fr', 'fr-FR'],
    es: ['es', 'es-ES'],
    it: ['it', 'it-IT'],
    pl: ['pl', 'pl-PL'],
};

export function isSupportedLang(value: string): value is SupportedLang {
    return (SUPPORTED_LANGS as readonly string[]).includes(value);
}

export function localePath(lang: SupportedLang, path: string = ''): string {
    const clean = path.replace(/^\/+/, '');
    return clean ? `/${lang}/${clean}` : `/${lang}`;
}

export function absoluteUrl(path: string): string {
    const clean = path.startsWith('/') ? path : `/${path}`;
    return `${SITE_URL}${clean}`;
}

// UI strings used by the public SEO content pages (SeoContentPage + bot
// prerender). Lives here rather than in i18next/Supabase because these pages
// render before the i18n provider has loaded and the bot path has no i18n
// at all. Keep the keys minimal — every entry must have all 7 languages.
export interface SeoUiStrings {
    home: string;
    backToHome: string;
    notFoundTitle: string; // "Sayfa bulunamadı" / "Page not found"
    notFoundBody: string;
    // Graceful fallback panel shown instead of a dead end when a concept has no
    // page in the current language (slugs are localized, so a shared link can
    // legitimately point at a language that never got the translation).
    notAvailableBody: string;
    availableInLabel: string; // "Şu dillerde mevcut" / "Available in"
    browseSection: string; // "%s bölümüne göz atın" — %s = section label
    backToBlog: string; // "Tüm rehberler" / "All guides"
    breadcrumbComparison: string;
    breadcrumbGuide: string;
    breadcrumbSolution: string;
    breadcrumbGlossary: string;
    breadcrumbResources: string; // "REHBER" / "GUIDE" (hub eyebrow)
    author: string;
    lastUpdated: string;
    faqTitle: string;
    source: string;
    ctaTitle: string;
    ctaBody: string;
    ctaButton: string; // "Modelleri İncele" / "Explore Models" (primary)
    ctaSecondaryButton: string; // "İlgili Rehberi Oku" / "Read Related Guide"
    footerCopy: string;
    relatedTitle: string;
    // GEO / new block labels
    quickAnswerLabel: string; // "KISA CEVAP" / "QUICK ANSWER"
    aiAnswerSummaryLabel: string; // "DOĞRULANMIŞ BİLGİLER" / "VERIFIED FACTS" — GEO özet bloğunun insan-görünür etiketi (AI'dan bahsetmez)
    keyTakeawaysLabel: string; // "TEMEL NOKTALAR" / "KEY TAKEAWAYS"
    infoBoxLabel: string; // "NOT" / "NOTE"
    warningBoxLabel: string; // "DİKKAT" / "WARNING"
    relatedEntitiesLabel: string; // "İLGİLİ TERİMLER" / "RELATED TERMS"
    // Resources hub-specific
    hubTitle: string; // "CAFEPASTE Rehber" / "CAFEPASTE Guide"
    hubSubtitle: string;
    hubSearchPlaceholder: string;
    hubFeaturedLabel: string; // "ÖNE ÇIKAN" / "FEATURED"
    hubReadArticle: string; // "Makaleyi Oku" / "Read article"
    hubReadMore: string; // "Devamını Oku" / "Read more"
    hubEmptyState: string; // "Sonuç bulunamadı." / "No results."
    hubArticleCount: (n: number) => string; // "12 makale" / "12 articles"
    hubTopicClustersTitle: string; // "Konu Kümeleri" / "Topic Clusters"
    hubBottomCtaTitle: string; // "CAFEPASTE İçecek Art Makinesi'ni keşfedin" / "Explore the CAFEPASTE Beverage Art Creator"
    hubBottomCtaBody: string;
    // Chip labels — type filter (row 1)
    chipTypeAll: string;
    chipTypeGlossary: string;
    chipTypeGuide: string;
    chipTypeSolution: string;
    chipTypeComparison: string;
    // Topic chip + cluster labels (row 2 + clusters section)
    topicCoffeePrinting: string;
    topicEdibleInk: string;
    topicQrCup: string;
    topicCocktail: string;
    topicPastry: string;
    topicHoReCa: string;
    topicBrandActivation: string;
    topicBeverageArtCreator: string;
    topicSeoResources: string;
    topicGeoResources: string;
    // Cluster descriptions (1-line each)
    clusterCoffeePrintingDesc: string;
    clusterBeverageArtCreatorDesc: string;
    clusterEdibleInkDesc: string;
    clusterQrCupDesc: string;
    clusterCocktailPastryDesc: string;
    clusterHoReCaDesc: string;
    clusterBrandActivationDesc: string;
    clusterSeoResourcesDesc: string;
    clusterGeoResourcesDesc: string;
    // Chrome strings that used to be `lang === 'tr' ? … : …` binaries —
    // DE/FR/ES/IT/PL readers were getting English mixed into localized pages.
    statGuides: string; // hub stat card "Rehber yazısı" / "Guide articles"
    statGlossary: string;
    statSolutions: string;
    statComparisons: string;
    countArticles: string; // "12 makale" list suffixes (plural)
    countTerms: string;
    countSolutions: string;
    countComparisons: string;
    hubThisWeek: string; // "Bu hafta öne çıkan"
    hubAllGuides: string; // "Tüm rehberler →"
    hubRecentlyAdded: string;
    hubContentSections: string; // eyebrow
    hubBrowseKnowledgeBase: string;
    hubAllArticles: string;
    hubLatestAdditions: string;
    editorsPickPrefix: string; // "Editör Seçimi · " card badge prefix
    itemSingular: string; // "1 içerik" / "1 item"
    itemPlural: string;
    termSingular: string; // glossary letter group "3 terim" / "3 term"
    filterAll: string; // A-Z bar "Hepsi" / "All"
    fromGlossary: string;
    openGlossary: string;
    shareLabel: string;
    copyLabel: string;
    copiedLabel: string;
    upNext: string; // related strip "Sıradaki okuma"
    allResources: string; // related strip "Tüm rehberler" link
    proTipLabel: string; // pro-tip block fallback title (bot prerender + SPA)
}

export const SEO_UI_STRINGS: Record<SupportedLang, SeoUiStrings> = {
    tr: {
        home: 'Ana sayfa',
        backToHome: '← Ana sayfa',
        notFoundTitle: 'Sayfa bulunamadı',
        notFoundBody: 'Aradığınız sayfa bu dilde mevcut değil veya taşınmış olabilir.',
        notAvailableBody: 'Bu içerik henüz bu dilde yayımlanmadı. Aşağıdakiler ilginizi çekebilir.',
        availableInLabel: 'Şu dillerde mevcut',
        browseSection: '%s bölümüne göz atın',
        backToBlog: 'Tüm rehberler',
        breadcrumbComparison: 'Karşılaştırma',
        breadcrumbGuide: 'Rehber',
        breadcrumbSolution: 'Çözüm',
        breadcrumbGlossary: 'Sözlük',
        breadcrumbResources: 'Rehber',
        author: 'Yazar',
        lastUpdated: 'Son güncelleme',
        faqTitle: 'Sık Sorulan Sorular',
        source: 'Kaynak',
        ctaTitle: "CAFEPASTE modellerini keşfedin",
        ctaBody: 'İçecek sanatının markanıza ve günlük operasyonunuza nasıl entegre olduğunu görün.',
        ctaButton: 'Modelleri İncele',
        ctaSecondaryButton: 'İlgili Rehberi Oku',
        footerCopy: 'CAFEPASTE',
        relatedTitle: 'İlgili sayfalar',
        quickAnswerLabel: 'KISA CEVAP',
        aiAnswerSummaryLabel: 'DOĞRULANMIŞ BİLGİLER',
        keyTakeawaysLabel: 'TEMEL NOKTALAR',
        infoBoxLabel: 'NOT',
        warningBoxLabel: 'DİKKAT',
        relatedEntitiesLabel: 'İLGİLİ TERİMLER',
        hubTitle: 'CAFEPASTE Rehber',
        hubSubtitle: 'İçecek sanatı, İçecek Art Makinesi teknolojisi, yenilebilir mürekkep, QR kişiselleştirme ve HoReCa marka deneyimi üzerine uzman içerikler.',
        hubSearchPlaceholder: 'Rehber içinde ara…',
        hubFeaturedLabel: 'ÖNE ÇIKAN',
        hubReadArticle: 'Makaleyi Oku',
        hubReadMore: 'Devamını Oku',
        hubEmptyState: 'Sonuç bulunamadı. Farklı bir filtre veya arama deneyin.',
        hubArticleCount: (n) => `${n} makale`,
        hubTopicClustersTitle: 'Konu Kümeleri',
        hubBottomCtaTitle: "CAFEPASTE İçecek Art Makinesi'ni keşfedin",
        hubBottomCtaBody: 'İçecek sanatının kafeleri, otelleri, etkinlikleri, pasta operasyonlarını ve marka aktivasyonlarını nasıl dönüştürdüğünü görün.',
        chipTypeAll: 'Tümü',
        chipTypeGlossary: 'Sözlük',
        chipTypeGuide: 'Rehber',
        chipTypeSolution: 'Çözüm',
        chipTypeComparison: 'Karşılaştırma',
        topicCoffeePrinting: 'Kahve Baskı',
        topicEdibleInk: 'Yenilebilir Mürekkep',
        topicQrCup: 'QR Bardak',
        topicCocktail: 'Kokteyl',
        topicPastry: 'Pasta',
        topicHoReCa: 'HoReCa',
        topicBrandActivation: 'Marka Aktivasyon',
        topicBeverageArtCreator: 'Beverage Art Creator',
        topicSeoResources: 'SEO',
        topicGeoResources: 'GEO',
        clusterCoffeePrintingDesc: 'Profesyonel kahve baskı makineleri, modeller ve teknik özellikler.',
        clusterBeverageArtCreatorDesc: 'Kategoriyi tanımlayan cihaz: tanım, nasıl çalışır, kim için.',
        clusterEdibleInkDesc: 'Gıda güvenliği, doğal pigmentler ve sertifikasyon.',
        clusterQrCupDesc: 'Müşterinin telefonuyla self-servis kişiselleştirme akışı.',
        clusterCocktailPastryDesc: 'Kokteyl yüzeyinde ve 12 cm pasta yüzeyinde Art uygulama.',
        clusterHoReCaDesc: 'Kafe, otel, restoran ve etkinlik için kullanım senaryoları.',
        clusterBrandActivationDesc: 'Pop-up etkinlik, marka kampanyası ve viral içerik.',
        clusterSeoResourcesDesc: 'Arama motorlarında görünürlük için içerik kaynakları.',
        clusterGeoResourcesDesc: 'AI motorlarında atıf almak için yapı ve format kılavuzları.',
        statGuides: 'Rehber yazısı',
        statGlossary: 'Sözlük terimi',
        statSolutions: 'Sektör çözümü',
        statComparisons: 'Karşılaştırma',
        countArticles: 'makale',
        countTerms: 'terim',
        countSolutions: 'çözüm',
        countComparisons: 'karşılaştırma',
        hubThisWeek: 'Bu hafta öne çıkan',
        hubAllGuides: 'Tüm rehberler',
        hubRecentlyAdded: 'Yakınlarda eklenenler',
        hubContentSections: 'İçerik bölümleri',
        hubBrowseKnowledgeBase: 'Bilgi merkezini gezin.',
        hubAllArticles: 'Tüm yazılar',
        hubLatestAdditions: 'Son eklenenler',
        editorsPickPrefix: 'Editör Seçimi · ',
        itemSingular: 'içerik',
        itemPlural: 'içerik',
        termSingular: 'terim',
        filterAll: 'Hepsi',
        fromGlossary: 'Sözlükten',
        openGlossary: 'Sözlüğe git',
        shareLabel: 'Paylaş',
        copyLabel: 'Kopyala',
        copiedLabel: 'Kopyalandı',
        upNext: 'Sıradaki okuma',
        allResources: 'Tüm rehberler',
        proTipLabel: 'PRO TİP',
    },
    en: {
        home: 'Home',
        backToHome: '← Home',
        notFoundTitle: 'Page not found',
        notFoundBody: 'The page you are looking for is not available in this language or may have moved.',
        notAvailableBody: 'This article has not been published in this language yet. You might find these useful instead.',
        availableInLabel: 'Available in',
        browseSection: 'Browse %s',
        backToBlog: 'All guides',
        breadcrumbComparison: 'Comparison',
        breadcrumbGuide: 'Guide',
        breadcrumbSolution: 'Solution',
        breadcrumbGlossary: 'Glossary',
        breadcrumbResources: 'Guide',
        author: 'By',
        lastUpdated: 'Last updated',
        faqTitle: 'Frequently Asked Questions',
        source: 'Source',
        ctaTitle: 'Explore CAFEPASTE models',
        ctaBody: 'Discover how beverage art can integrate with your brand and daily operation.',
        ctaButton: 'Explore Models',
        ctaSecondaryButton: 'Read Related Guide',
        footerCopy: 'CAFEPASTE',
        relatedTitle: 'Related articles',
        quickAnswerLabel: 'QUICK ANSWER',
        aiAnswerSummaryLabel: 'VERIFIED FACTS',
        keyTakeawaysLabel: 'KEY TAKEAWAYS',
        infoBoxLabel: 'NOTE',
        warningBoxLabel: 'WARNING',
        relatedEntitiesLabel: 'RELATED TERMS',
        hubTitle: 'CAFEPASTE Guide',
        hubSubtitle: 'Expert resources on beverage art creation, Beverage Art Creator technology, edible ink, QR-based personalization, cocktail art, pastry art, and HoReCa brand experience.',
        hubSearchPlaceholder: 'Search the guide…',
        hubFeaturedLabel: 'FEATURED',
        hubReadArticle: 'Read article',
        hubReadMore: 'Read more',
        hubEmptyState: 'No results. Try a different filter or search term.',
        hubArticleCount: (n) => `${n} article${n === 1 ? '' : 's'}`,
        hubTopicClustersTitle: 'Topic clusters',
        hubBottomCtaTitle: 'Explore the CAFEPASTE Beverage Art Creator',
        hubBottomCtaBody: 'Discover how beverage art can support cafés, hotels, events, pastry operations, and brand activations.',
        chipTypeAll: 'All',
        chipTypeGlossary: 'Glossary',
        chipTypeGuide: 'Buyer Guides',
        chipTypeSolution: 'Solutions',
        chipTypeComparison: 'Comparisons',
        topicCoffeePrinting: 'Coffee Printing',
        topicEdibleInk: 'Edible Ink',
        topicQrCup: 'QR Cup',
        topicCocktail: 'Cocktail',
        topicPastry: 'Pastry',
        topicHoReCa: 'HoReCa',
        topicBrandActivation: 'Brand Activation',
        topicBeverageArtCreator: 'Beverage Art Creator',
        topicSeoResources: 'SEO',
        topicGeoResources: 'GEO',
        clusterCoffeePrintingDesc: 'Professional coffee printing machines, models and technical specs.',
        clusterBeverageArtCreatorDesc: 'The category-defining device: definition, how it works, who it is for.',
        clusterEdibleInkDesc: 'Food safety, natural pigments and certification.',
        clusterQrCupDesc: 'Self-service personalization via the customer\'s phone.',
        clusterCocktailPastryDesc: 'Cocktail surfaces and beverage art on pastry up to 12 cm.',
        clusterHoReCaDesc: 'Use cases for cafés, hotels, restaurants and events.',
        clusterBrandActivationDesc: 'Pop-up events, brand campaigns and viral content.',
        clusterSeoResourcesDesc: 'Content frameworks for search engine visibility.',
        clusterGeoResourcesDesc: 'Structure and format guides for AI engine citation.',
        statGuides: 'Guide articles',
        statGlossary: 'Glossary terms',
        statSolutions: 'Solutions',
        statComparisons: 'Comparisons',
        countArticles: 'articles',
        countTerms: 'terms',
        countSolutions: 'solutions',
        countComparisons: 'comparisons',
        hubThisWeek: 'This week featured',
        hubAllGuides: 'All guides',
        hubRecentlyAdded: 'Recently added',
        hubContentSections: 'Content sections',
        hubBrowseKnowledgeBase: 'Browse the knowledge base.',
        hubAllArticles: 'All articles',
        hubLatestAdditions: 'Latest additions',
        editorsPickPrefix: 'Featured · ',
        itemSingular: 'item',
        itemPlural: 'items',
        termSingular: 'term',
        filterAll: 'All',
        fromGlossary: 'From the glossary',
        openGlossary: 'Open glossary',
        shareLabel: 'Share',
        copyLabel: 'Copy',
        copiedLabel: 'Copied',
        upNext: 'Up next',
        allResources: 'All resources',
        proTipLabel: 'PRO TIP',
    },
    de: {
        home: 'Startseite',
        backToHome: '← Startseite',
        notFoundTitle: 'Seite nicht gefunden',
        notFoundBody: 'Die gesuchte Seite ist in dieser Sprache nicht verfügbar oder wurde verschoben.',
        notAvailableBody: 'Dieser Beitrag ist in dieser Sprache noch nicht erschienen. Vielleicht hilft Ihnen eines dieser Themen weiter.',
        availableInLabel: 'Verfügbar in',
        browseSection: '%s durchsuchen',
        backToBlog: 'Alle Leitfäden',
        breadcrumbComparison: 'Vergleich',
        breadcrumbGuide: 'Leitfaden',
        breadcrumbSolution: 'Lösung',
        breadcrumbGlossary: 'Glossar',
        breadcrumbResources: 'Leitfaden',
        author: 'Von',
        lastUpdated: 'Zuletzt aktualisiert',
        faqTitle: 'Häufig gestellte Fragen',
        source: 'Quelle',
        ctaTitle: 'CAFEPASTE Modelle entdecken',
        ctaBody: 'Entdecken Sie, wie sich Getränkekunst in Ihre Marke und Ihren Tagesbetrieb einfügt.',
        ctaButton: 'Modelle ansehen',
        ctaSecondaryButton: 'Zugehörigen Leitfaden lesen',
        footerCopy: 'CAFEPASTE',
        relatedTitle: 'Verwandte Artikel',
        quickAnswerLabel: 'KURZE ANTWORT',
        aiAnswerSummaryLabel: 'VERIFIZIERTE FAKTEN',
        keyTakeawaysLabel: 'KERNAUSSAGEN',
        infoBoxLabel: 'HINWEIS',
        warningBoxLabel: 'WARNUNG',
        relatedEntitiesLabel: 'VERWANDTE BEGRIFFE',
        hubTitle: 'CAFEPASTE Leitfaden',
        hubSubtitle: 'Experten-Ressourcen zu Getränkekunst, Beverage-Art-Creator-Technologie, essbarer Tinte, QR-Personalisierung und HoReCa-Markenerlebnis.',
        hubSearchPlaceholder: 'Im Leitfaden suchen…',
        hubFeaturedLabel: 'EMPFOHLEN',
        hubReadArticle: 'Artikel lesen',
        hubReadMore: 'Mehr lesen',
        hubEmptyState: 'Keine Ergebnisse. Versuchen Sie einen anderen Filter oder Suchbegriff.',
        hubArticleCount: (n) => `${n} Artikel`,
        hubTopicClustersTitle: 'Themen-Cluster',
        hubBottomCtaTitle: 'Entdecken Sie den CAFEPASTE Beverage Art Creator',
        hubBottomCtaBody: 'Erfahren Sie, wie Getränkekunst Cafés, Hotels, Events, Patisserien und Markenaktivierungen unterstützt.',
        chipTypeAll: 'Alle',
        chipTypeGlossary: 'Glossar',
        chipTypeGuide: 'Kaufberatung',
        chipTypeSolution: 'Lösungen',
        chipTypeComparison: 'Vergleiche',
        topicCoffeePrinting: 'Kaffee-Druck',
        topicEdibleInk: 'Essbare Tinte',
        topicQrCup: 'QR-Becher',
        topicCocktail: 'Cocktail',
        topicPastry: 'Patisserie',
        topicHoReCa: 'HoReCa',
        topicBrandActivation: 'Markenaktivierung',
        topicBeverageArtCreator: 'Beverage Art Creator',
        topicSeoResources: 'SEO',
        topicGeoResources: 'GEO',
        clusterCoffeePrintingDesc: 'Professionelle Kaffee-Druckmaschinen, Modelle und technische Daten.',
        clusterBeverageArtCreatorDesc: 'Das kategoriebestimmende Gerät: Definition, Funktionsweise, Zielgruppe.',
        clusterEdibleInkDesc: 'Lebensmittelsicherheit, natürliche Pigmente und Zertifizierung.',
        clusterQrCupDesc: 'Self-Service-Personalisierung über das Smartphone des Kunden.',
        clusterCocktailPastryDesc: 'Getränkekunst auf Cocktail-Oberflächen und Patisserie bis 12 cm.',
        clusterHoReCaDesc: 'Anwendungsfälle für Cafés, Hotels, Restaurants und Events.',
        clusterBrandActivationDesc: 'Pop-up-Events, Markenkampagnen und virale Inhalte.',
        clusterSeoResourcesDesc: 'Content-Frameworks für die Sichtbarkeit in Suchmaschinen.',
        clusterGeoResourcesDesc: 'Struktur- und Format-Leitfäden für KI-Engine-Zitate.',
        statGuides: 'Leitfaden-Artikel',
        statGlossary: 'Glossar-Begriffe',
        statSolutions: 'Lösungen',
        statComparisons: 'Vergleiche',
        countArticles: 'Artikel',
        countTerms: 'Begriffe',
        countSolutions: 'Lösungen',
        countComparisons: 'Vergleiche',
        hubThisWeek: 'Diese Woche im Fokus',
        hubAllGuides: 'Alle Leitfäden',
        hubRecentlyAdded: 'Kürzlich hinzugefügt',
        hubContentSections: 'Inhaltsbereiche',
        hubBrowseKnowledgeBase: 'Durchstöbern Sie die Wissensbasis.',
        hubAllArticles: 'Alle Artikel',
        hubLatestAdditions: 'Neueste Beiträge',
        editorsPickPrefix: 'Redaktionstipp · ',
        itemSingular: 'Eintrag',
        itemPlural: 'Einträge',
        termSingular: 'Begriff',
        filterAll: 'Alle',
        fromGlossary: 'Aus dem Glossar',
        openGlossary: 'Zum Glossar',
        shareLabel: 'Teilen',
        copyLabel: 'Kopieren',
        copiedLabel: 'Kopiert',
        upNext: 'Als Nächstes',
        allResources: 'Alle Ressourcen',
        proTipLabel: 'PROFI-TIPP',
    },
    fr: {
        home: 'Accueil',
        backToHome: '← Accueil',
        notFoundTitle: 'Page introuvable',
        notFoundBody: 'La page que vous recherchez n’est pas disponible dans cette langue ou a été déplacée.',
        notAvailableBody: 'Cet article n’a pas encore été publié dans cette langue. Ces contenus pourraient vous intéresser.',
        availableInLabel: 'Disponible en',
        browseSection: 'Parcourir %s',
        backToBlog: 'Tous les guides',
        breadcrumbComparison: 'Comparaison',
        breadcrumbGuide: 'Guide',
        breadcrumbSolution: 'Solution',
        breadcrumbGlossary: 'Glossaire',
        breadcrumbResources: 'Guide',
        author: 'Par',
        lastUpdated: 'Dernière mise à jour',
        faqTitle: 'Questions fréquentes',
        source: 'Source',
        ctaTitle: 'Découvrez les modèles CAFEPASTE',
        ctaBody: "Voyez comment l'art de la boisson s'intègre à votre marque et à votre opération quotidienne.",
        ctaButton: 'Voir les modèles',
        ctaSecondaryButton: 'Lire le guide associé',
        footerCopy: 'CAFEPASTE',
        relatedTitle: 'Articles liés',
        quickAnswerLabel: 'RÉPONSE RAPIDE',
        aiAnswerSummaryLabel: 'FAITS VÉRIFIÉS',
        keyTakeawaysLabel: 'POINTS CLÉS',
        infoBoxLabel: 'NOTE',
        warningBoxLabel: 'ATTENTION',
        relatedEntitiesLabel: 'TERMES LIÉS',
        hubTitle: 'Guide CAFEPASTE',
        hubSubtitle: "Ressources expertes sur l'art de la boisson, la technologie Beverage Art Creator, l'encre comestible, la personnalisation QR et l'expérience de marque HoReCa.",
        hubSearchPlaceholder: 'Rechercher dans le guide…',
        hubFeaturedLabel: 'À LA UNE',
        hubReadArticle: "Lire l'article",
        hubReadMore: 'Lire plus',
        hubEmptyState: 'Aucun résultat. Essayez un autre filtre ou une autre recherche.',
        hubArticleCount: (n) => `${n} article${n === 1 ? '' : 's'}`,
        hubTopicClustersTitle: 'Clusters de sujets',
        hubBottomCtaTitle: 'Découvrez le Beverage Art Creator CAFEPASTE',
        hubBottomCtaBody: "Découvrez comment l'art de la boisson soutient cafés, hôtels, événements, opérations de pâtisserie et activations de marque.",
        chipTypeAll: 'Tous',
        chipTypeGlossary: 'Glossaire',
        chipTypeGuide: "Guides d'achat",
        chipTypeSolution: 'Solutions',
        chipTypeComparison: 'Comparaisons',
        topicCoffeePrinting: 'Impression café',
        topicEdibleInk: 'Encre comestible',
        topicQrCup: 'Verre QR',
        topicCocktail: 'Cocktail',
        topicPastry: 'Pâtisserie',
        topicHoReCa: 'HoReCa',
        topicBrandActivation: 'Activation de marque',
        topicBeverageArtCreator: 'Beverage Art Creator',
        topicSeoResources: 'SEO',
        topicGeoResources: 'GEO',
        clusterCoffeePrintingDesc: 'Imprimantes à café professionnelles, modèles et spécifications.',
        clusterBeverageArtCreatorDesc: "L'appareil qui définit la catégorie : définition, fonctionnement, public.",
        clusterEdibleInkDesc: 'Sécurité alimentaire, pigments naturels et certification.',
        clusterQrCupDesc: 'Personnalisation en libre-service via le téléphone du client.',
        clusterCocktailPastryDesc: "Art de la boisson sur surfaces de cocktail et pâtisserie jusqu'à 12 cm.",
        clusterHoReCaDesc: 'Cas d\'usage pour cafés, hôtels, restaurants et événements.',
        clusterBrandActivationDesc: 'Événements pop-up, campagnes de marque et contenus viraux.',
        clusterSeoResourcesDesc: 'Cadres de contenu pour la visibilité des moteurs de recherche.',
        clusterGeoResourcesDesc: "Guides de structure et format pour la citation par les moteurs IA.",
        statGuides: 'Articles guides',
        statGlossary: 'Termes du glossaire',
        statSolutions: 'Solutions',
        statComparisons: 'Comparatifs',
        countArticles: 'articles',
        countTerms: 'termes',
        countSolutions: 'solutions',
        countComparisons: 'comparatifs',
        hubThisWeek: 'À la une cette semaine',
        hubAllGuides: 'Tous les guides',
        hubRecentlyAdded: 'Ajouts récents',
        hubContentSections: 'Sections de contenu',
        hubBrowseKnowledgeBase: 'Parcourez la base de connaissances.',
        hubAllArticles: 'Tous les articles',
        hubLatestAdditions: 'Derniers ajouts',
        editorsPickPrefix: 'Choix de la rédaction · ',
        itemSingular: 'élément',
        itemPlural: 'éléments',
        termSingular: 'terme',
        filterAll: 'Tout',
        fromGlossary: 'Extrait du glossaire',
        openGlossary: 'Ouvrir le glossaire',
        shareLabel: 'Partager',
        copyLabel: 'Copier',
        copiedLabel: 'Copié',
        upNext: 'À lire ensuite',
        allResources: 'Toutes les ressources',
        proTipLabel: 'ASTUCE PRO',
    },
    es: {
        home: 'Inicio',
        backToHome: '← Inicio',
        notFoundTitle: 'Página no encontrada',
        notFoundBody: 'La página que buscas no está disponible en este idioma o se ha movido.',
        notAvailableBody: 'Este artículo aún no se ha publicado en este idioma. Quizá te interesen estos contenidos.',
        availableInLabel: 'Disponible en',
        browseSection: 'Explorar %s',
        backToBlog: 'Todas las guías',
        breadcrumbComparison: 'Comparación',
        breadcrumbGuide: 'Guía',
        breadcrumbSolution: 'Solución',
        breadcrumbGlossary: 'Glosario',
        breadcrumbResources: 'Guía',
        author: 'Por',
        lastUpdated: 'Última actualización',
        faqTitle: 'Preguntas frecuentes',
        source: 'Fuente',
        ctaTitle: 'Descubre los modelos CAFEPASTE',
        ctaBody: 'Descubre cómo el arte para bebidas se integra con tu marca y operación diaria.',
        ctaButton: 'Ver modelos',
        ctaSecondaryButton: 'Leer guía relacionada',
        footerCopy: 'CAFEPASTE',
        relatedTitle: 'Artículos relacionados',
        quickAnswerLabel: 'RESPUESTA RÁPIDA',
        aiAnswerSummaryLabel: 'DATOS VERIFICADOS',
        keyTakeawaysLabel: 'PUNTOS CLAVE',
        infoBoxLabel: 'NOTA',
        warningBoxLabel: 'AVISO',
        relatedEntitiesLabel: 'TÉRMINOS RELACIONADOS',
        hubTitle: 'Guía CAFEPASTE',
        hubSubtitle: 'Recursos expertos sobre arte para bebidas, tecnología Beverage Art Creator, tinta comestible, personalización QR y experiencia de marca HoReCa.',
        hubSearchPlaceholder: 'Buscar en la guía…',
        hubFeaturedLabel: 'DESTACADO',
        hubReadArticle: 'Leer artículo',
        hubReadMore: 'Leer más',
        hubEmptyState: 'Sin resultados. Prueba otro filtro o búsqueda.',
        hubArticleCount: (n) => `${n} artículo${n === 1 ? '' : 's'}`,
        hubTopicClustersTitle: 'Clústeres de temas',
        hubBottomCtaTitle: 'Descubre el Beverage Art Creator de CAFEPASTE',
        hubBottomCtaBody: 'Descubre cómo el arte para bebidas apoya a cafeterías, hoteles, eventos, operaciones de pastelería y activaciones de marca.',
        chipTypeAll: 'Todos',
        chipTypeGlossary: 'Glosario',
        chipTypeGuide: 'Guías de compra',
        chipTypeSolution: 'Soluciones',
        chipTypeComparison: 'Comparaciones',
        topicCoffeePrinting: 'Impresión café',
        topicEdibleInk: 'Tinta comestible',
        topicQrCup: 'Vaso QR',
        topicCocktail: 'Cóctel',
        topicPastry: 'Pastelería',
        topicHoReCa: 'HoReCa',
        topicBrandActivation: 'Activación de marca',
        topicBeverageArtCreator: 'Beverage Art Creator',
        topicSeoResources: 'SEO',
        topicGeoResources: 'GEO',
        clusterCoffeePrintingDesc: 'Impresoras profesionales de café, modelos y especificaciones técnicas.',
        clusterBeverageArtCreatorDesc: 'El dispositivo que define la categoría: definición, funcionamiento, público.',
        clusterEdibleInkDesc: 'Seguridad alimentaria, pigmentos naturales y certificación.',
        clusterQrCupDesc: 'Personalización en autoservicio a través del teléfono del cliente.',
        clusterCocktailPastryDesc: 'Arte para bebidas en superficies de cóctel y pastelería hasta 12 cm.',
        clusterHoReCaDesc: 'Casos de uso para cafeterías, hoteles, restaurantes y eventos.',
        clusterBrandActivationDesc: 'Eventos pop-up, campañas de marca y contenido viral.',
        clusterSeoResourcesDesc: 'Marcos de contenido para la visibilidad en motores de búsqueda.',
        clusterGeoResourcesDesc: 'Guías de estructura y formato para la cita en motores de IA.',
        statGuides: 'Artículos de guía',
        statGlossary: 'Términos del glosario',
        statSolutions: 'Soluciones',
        statComparisons: 'Comparativas',
        countArticles: 'artículos',
        countTerms: 'términos',
        countSolutions: 'soluciones',
        countComparisons: 'comparativas',
        hubThisWeek: 'Destacado esta semana',
        hubAllGuides: 'Todas las guías',
        hubRecentlyAdded: 'Añadidos recientemente',
        hubContentSections: 'Secciones de contenido',
        hubBrowseKnowledgeBase: 'Explora la base de conocimiento.',
        hubAllArticles: 'Todos los artículos',
        hubLatestAdditions: 'Últimas incorporaciones',
        editorsPickPrefix: 'Selección del editor · ',
        itemSingular: 'elemento',
        itemPlural: 'elementos',
        termSingular: 'término',
        filterAll: 'Todo',
        fromGlossary: 'Del glosario',
        openGlossary: 'Abrir el glosario',
        shareLabel: 'Compartir',
        copyLabel: 'Copiar',
        copiedLabel: 'Copiado',
        upNext: 'A continuación',
        allResources: 'Todos los recursos',
        proTipLabel: 'CONSEJO PRO',
    },
    it: {
        home: 'Home',
        backToHome: '← Home',
        notFoundTitle: 'Pagina non trovata',
        notFoundBody: 'La pagina che cerchi non è disponibile in questa lingua o è stata spostata.',
        notAvailableBody: 'Questo articolo non è ancora stato pubblicato in questa lingua. Potrebbero interessarti questi contenuti.',
        availableInLabel: 'Disponibile in',
        browseSection: 'Esplora %s',
        backToBlog: 'Tutte le guide',
        breadcrumbComparison: 'Confronto',
        breadcrumbGuide: 'Guida',
        breadcrumbSolution: 'Soluzione',
        breadcrumbGlossary: 'Glossario',
        breadcrumbResources: 'Guida',
        author: 'Di',
        lastUpdated: 'Ultimo aggiornamento',
        faqTitle: 'Domande frequenti',
        source: 'Fonte',
        ctaTitle: 'Scopri i modelli CAFEPASTE',
        ctaBody: "Scopri come la beverage art si integra con il tuo brand e la tua operatività quotidiana.",
        ctaButton: 'Vedi i modelli',
        ctaSecondaryButton: 'Leggi la guida correlata',
        footerCopy: 'CAFEPASTE',
        relatedTitle: 'Articoli correlati',
        quickAnswerLabel: 'RISPOSTA RAPIDA',
        aiAnswerSummaryLabel: 'FATTI VERIFICATI',
        keyTakeawaysLabel: 'PUNTI CHIAVE',
        infoBoxLabel: 'NOTA',
        warningBoxLabel: 'ATTENZIONE',
        relatedEntitiesLabel: 'TERMINI CORRELATI',
        hubTitle: 'Guida CAFEPASTE',
        hubSubtitle: "Risorse di esperti su arte delle bevande, tecnologia Beverage Art Creator, inchiostro commestibile, personalizzazione QR ed esperienza brand HoReCa.",
        hubSearchPlaceholder: 'Cerca nella guida…',
        hubFeaturedLabel: 'IN EVIDENZA',
        hubReadArticle: "Leggi l'articolo",
        hubReadMore: 'Leggi di più',
        hubEmptyState: 'Nessun risultato. Prova un altro filtro o ricerca.',
        hubArticleCount: (n) => `${n} articol${n === 1 ? 'o' : 'i'}`,
        hubTopicClustersTitle: 'Cluster di argomenti',
        hubBottomCtaTitle: 'Scopri il Beverage Art Creator CAFEPASTE',
        hubBottomCtaBody: "Scopri come la beverage art supporta caffetterie, hotel, eventi, operazioni di pasticceria e attivazioni di brand.",
        chipTypeAll: 'Tutti',
        chipTypeGlossary: 'Glossario',
        chipTypeGuide: "Guide all'acquisto",
        chipTypeSolution: 'Soluzioni',
        chipTypeComparison: 'Confronti',
        topicCoffeePrinting: 'Stampa caffè',
        topicEdibleInk: 'Inchiostro commestibile',
        topicQrCup: 'Bicchiere QR',
        topicCocktail: 'Cocktail',
        topicPastry: 'Pasticceria',
        topicHoReCa: 'HoReCa',
        topicBrandActivation: 'Attivazione brand',
        topicBeverageArtCreator: 'Beverage Art Creator',
        topicSeoResources: 'SEO',
        topicGeoResources: 'GEO',
        clusterCoffeePrintingDesc: 'Stampanti professionali per caffè, modelli e specifiche tecniche.',
        clusterBeverageArtCreatorDesc: 'Il dispositivo che definisce la categoria: definizione, funzionamento, pubblico.',
        clusterEdibleInkDesc: 'Sicurezza alimentare, pigmenti naturali e certificazione.',
        clusterQrCupDesc: 'Personalizzazione self-service tramite il telefono del cliente.',
        clusterCocktailPastryDesc: 'Beverage art su superfici di cocktail e pasticceria fino a 12 cm.',
        clusterHoReCaDesc: 'Casi d\'uso per caffetterie, hotel, ristoranti ed eventi.',
        clusterBrandActivationDesc: 'Eventi pop-up, campagne di brand e contenuti virali.',
        clusterSeoResourcesDesc: 'Framework di contenuti per la visibilità nei motori di ricerca.',
        clusterGeoResourcesDesc: "Guide di struttura e formato per la citazione nei motori IA.",
        statGuides: 'Articoli guida',
        statGlossary: 'Termini del glossario',
        statSolutions: 'Soluzioni',
        statComparisons: 'Confronti',
        countArticles: 'articoli',
        countTerms: 'termini',
        countSolutions: 'soluzioni',
        countComparisons: 'confronti',
        hubThisWeek: 'In evidenza questa settimana',
        hubAllGuides: 'Tutte le guide',
        hubRecentlyAdded: 'Aggiunti di recente',
        hubContentSections: 'Sezioni di contenuto',
        hubBrowseKnowledgeBase: 'Esplora la base di conoscenza.',
        hubAllArticles: 'Tutti gli articoli',
        hubLatestAdditions: 'Ultime aggiunte',
        editorsPickPrefix: "Scelta dell'editor · ",
        itemSingular: 'elemento',
        itemPlural: 'elementi',
        termSingular: 'termine',
        filterAll: 'Tutti',
        fromGlossary: 'Dal glossario',
        openGlossary: 'Apri il glossario',
        shareLabel: 'Condividi',
        copyLabel: 'Copia',
        copiedLabel: 'Copiato',
        upNext: 'Da leggere dopo',
        allResources: 'Tutte le risorse',
        proTipLabel: 'CONSIGLIO PRO',
    },
    pl: {
        home: 'Strona główna',
        backToHome: '← Strona główna',
        notFoundTitle: 'Nie znaleziono strony',
        notFoundBody: 'Strona, której szukasz, nie jest dostępna w tym języku lub została przeniesiona.',
        notAvailableBody: 'Ten artykuł nie został jeszcze opublikowany w tym języku. Poniższe treści mogą Cię zainteresować.',
        availableInLabel: 'Dostępne w językach',
        browseSection: 'Przeglądaj: %s',
        backToBlog: 'Wszystkie przewodniki',
        breadcrumbComparison: 'Porównanie',
        breadcrumbGuide: 'Przewodnik',
        breadcrumbSolution: 'Rozwiązanie',
        breadcrumbGlossary: 'Słownik',
        breadcrumbResources: 'Przewodnik',
        author: 'Autor',
        lastUpdated: 'Ostatnia aktualizacja',
        faqTitle: 'Najczęściej zadawane pytania',
        source: 'Źródło',
        ctaTitle: 'Odkryj modele CAFEPASTE',
        ctaBody: 'Zobacz, jak beverage art integruje się z Twoją marką i codzienną operacją.',
        ctaButton: 'Zobacz modele',
        ctaSecondaryButton: 'Przeczytaj powiązany przewodnik',
        footerCopy: 'CAFEPASTE',
        relatedTitle: 'Powiązane artykuły',
        quickAnswerLabel: 'SZYBKA ODPOWIEDŹ',
        aiAnswerSummaryLabel: 'ZWERYFIKOWANE FAKTY',
        keyTakeawaysLabel: 'KLUCZOWE WNIOSKI',
        infoBoxLabel: 'UWAGA',
        warningBoxLabel: 'OSTRZEŻENIE',
        relatedEntitiesLabel: 'POWIĄZANE TERMINY',
        hubTitle: 'Przewodnik CAFEPASTE',
        hubSubtitle: 'Eksperckie zasoby na temat sztuki napojów, technologii Beverage Art Creator, jadalnego atramentu, personalizacji QR i doświadczenia marki HoReCa.',
        hubSearchPlaceholder: 'Szukaj w przewodniku…',
        hubFeaturedLabel: 'WYRÓŻNIONE',
        hubReadArticle: 'Czytaj artykuł',
        hubReadMore: 'Czytaj więcej',
        hubEmptyState: 'Brak wyników. Spróbuj innego filtra lub zapytania.',
        hubArticleCount: (n) => `${n} artykuł${n === 1 ? '' : (n >= 2 && n <= 4 ? 'y' : 'ów')}`,
        hubTopicClustersTitle: 'Klastry tematyczne',
        hubBottomCtaTitle: 'Odkryj CAFEPASTE Beverage Art Creator',
        hubBottomCtaBody: 'Zobacz, jak beverage art wspiera kawiarnie, hotele, eventy, operacje cukiernicze i aktywacje marki.',
        chipTypeAll: 'Wszystkie',
        chipTypeGlossary: 'Słownik',
        chipTypeGuide: 'Przewodniki zakupowe',
        chipTypeSolution: 'Rozwiązania',
        chipTypeComparison: 'Porównania',
        topicCoffeePrinting: 'Druk kawy',
        topicEdibleInk: 'Jadalny atrament',
        topicQrCup: 'Kubek QR',
        topicCocktail: 'Koktajl',
        topicPastry: 'Cukiernictwo',
        topicHoReCa: 'HoReCa',
        topicBrandActivation: 'Aktywacja marki',
        topicBeverageArtCreator: 'Beverage Art Creator',
        topicSeoResources: 'SEO',
        topicGeoResources: 'GEO',
        clusterCoffeePrintingDesc: 'Profesjonalne drukarki do kawy, modele i specyfikacje techniczne.',
        clusterBeverageArtCreatorDesc: 'Urządzenie definiujące kategorię: definicja, działanie, dla kogo.',
        clusterEdibleInkDesc: 'Bezpieczeństwo żywności, naturalne pigmenty i certyfikacja.',
        clusterQrCupDesc: 'Personalizacja samoobsługowa przez telefon klienta.',
        clusterCocktailPastryDesc: 'Beverage art na powierzchniach koktajli i cukiernictwie do 12 cm.',
        clusterHoReCaDesc: 'Zastosowania dla kawiarni, hoteli, restauracji i eventów.',
        clusterBrandActivationDesc: 'Wydarzenia pop-up, kampanie marki i wirusowe treści.',
        clusterSeoResourcesDesc: 'Ramy treści dla widoczności w wyszukiwarkach.',
        clusterGeoResourcesDesc: 'Przewodniki struktury i formatu dla cytowań w silnikach AI.',
        statGuides: 'Artykuły przewodnika',
        statGlossary: 'Hasła słownika',
        statSolutions: 'Rozwiązania',
        statComparisons: 'Porównania',
        countArticles: 'artykuły',
        countTerms: 'hasła',
        countSolutions: 'rozwiązania',
        countComparisons: 'porównania',
        hubThisWeek: 'Wyróżnione w tym tygodniu',
        hubAllGuides: 'Wszystkie przewodniki',
        hubRecentlyAdded: 'Ostatnio dodane',
        hubContentSections: 'Sekcje treści',
        hubBrowseKnowledgeBase: 'Przeglądaj bazę wiedzy.',
        hubAllArticles: 'Wszystkie artykuły',
        hubLatestAdditions: 'Najnowsze dodatki',
        editorsPickPrefix: 'Wybór redakcji · ',
        itemSingular: 'pozycja',
        itemPlural: 'pozycje',
        termSingular: 'hasło',
        filterAll: 'Wszystkie',
        fromGlossary: 'Ze słownika',
        openGlossary: 'Otwórz słownik',
        shareLabel: 'Udostępnij',
        copyLabel: 'Kopiuj',
        copiedLabel: 'Skopiowano',
        upNext: 'Czytaj dalej',
        allResources: 'Wszystkie zasoby',
        proTipLabel: 'PRO TIP',
    },
};

export function getUiStrings(lang: SupportedLang): SeoUiStrings {
    return SEO_UI_STRINGS[lang];
}

// Category eyebrow translations for the H2 section header pattern. Each H2's
// text is matched against a multilingual regex set (CATEGORY_PATTERNS) to
// pick a category key (DEFINITION / HOW / WHO / ...), then the matching
// label is pulled from EYEBROW_LABELS for the current language. Same logic
// runs on the SPA renderer (SeoContentPage) and the bot prerender so the
// markup is consistent.

export type EyebrowCategory =
    | 'DEFINITION'
    | 'HOW'
    | 'WHO'
    | 'WHY'
    | 'CRITERIA'
    | 'BENEFITS'
    | 'ROI'
    | 'COST'
    | 'EXAMPLE'
    | 'FAQ'
    | 'CONCLUSION'
    | 'SECTION';

// Order matters — first regex that matches wins. More specific patterns
// (definitions, how-to) come before broader ones (benefits, cost).
const CATEGORY_PATTERNS: Array<[EyebrowCategory, RegExp]> = [
    ['DEFINITION', /(nedir|tanım|what\s*is|definition|was\s*ist|qu['']est[-\s]?ce|qué\s*es|definición|cos['']è|definizione|czym\s*jest|definicja)/i],
    ['HOW', /(nasıl|how\s*does|how\s*to|how\s*it\s*works|adım|step|wie\s*funktion|funktioniert|comment\s*fonctionne|cómo\s*funciona|come\s*funziona|jak\s*działa)/i],
    ['WHO', /(kim|kimler|who\s*uses|who\s*is|hedef|audience|für\s*wen|wer\s*nutzt|pour\s*qui|qui\s*utilise|para\s*quién|para\s*quien|per\s*chi|dla\s*kogo)/i],
    ['WHY', /(neden|why|warum|pourquoi|por\s*qué|por\s*que|perché|dlaczego)/i],
    ['CRITERIA', /(dikkat|kriter|criteria|consideration|seçim|choose|auswahl|kriterien|critères|criteres|criterios|criteri|kryteria|kryteri)/i],
    ['BENEFITS', /(fayda|benefit|avantaj|yarar|vorteil|avantage|beneficio|vantagg|korzyść|korzysc)/i],
    ['ROI', /(roi|geri\s*ödeme|return\s*on|amortyzacj|amortis|amortissement|ammortamento)/i],
    ['COST', /(maliyet|fiyat|cost|price|kosten|coût|cout|coste|costo|koszt|cena)/i],
    ['EXAMPLE', /(örnek|example|case\s*study|case\s*example|beispiel|exemple|ejemplo|esempio|przykład|przyklad)/i],
    ['FAQ', /(soru|faq|frequently|fragen|preguntas|domande|pytania|questions)/i],
    ['CONCLUSION', /(özet|sonuç|verdict|summary|conclusion|fazit|conclusión|conclusione|wniosek|podsumowanie)/i],
];

const EYEBROW_LABELS: Record<SupportedLang, Record<EyebrowCategory, string>> = {
    tr: { DEFINITION: 'TANIM', HOW: 'NASIL ÇALIŞIR', WHO: 'KİMLER', WHY: 'NEDEN', CRITERIA: 'KRİTERLER', BENEFITS: 'FAYDALAR', ROI: 'ROI', COST: 'MALİYET', EXAMPLE: 'ÖRNEK', FAQ: 'SORULAR', CONCLUSION: 'SONUÇ', SECTION: 'BÖLÜM' },
    en: { DEFINITION: 'DEFINITION', HOW: 'HOW IT WORKS', WHO: 'WHO IT\'S FOR', WHY: 'WHY', CRITERIA: 'CRITERIA', BENEFITS: 'BENEFITS', ROI: 'ROI', COST: 'COST', EXAMPLE: 'EXAMPLE', FAQ: 'QUESTIONS', CONCLUSION: 'CONCLUSION', SECTION: 'SECTION' },
    de: { DEFINITION: 'DEFINITION', HOW: 'SO FUNKTIONIERT\'S', WHO: 'FÜR WEN', WHY: 'WARUM', CRITERIA: 'KRITERIEN', BENEFITS: 'VORTEILE', ROI: 'ROI', COST: 'KOSTEN', EXAMPLE: 'BEISPIEL', FAQ: 'FRAGEN', CONCLUSION: 'FAZIT', SECTION: 'ABSCHNITT' },
    fr: { DEFINITION: 'DÉFINITION', HOW: 'COMMENT ÇA MARCHE', WHO: 'POUR QUI', WHY: 'POURQUOI', CRITERIA: 'CRITÈRES', BENEFITS: 'AVANTAGES', ROI: 'ROI', COST: 'COÛT', EXAMPLE: 'EXEMPLE', FAQ: 'QUESTIONS', CONCLUSION: 'CONCLUSION', SECTION: 'SECTION' },
    es: { DEFINITION: 'DEFINICIÓN', HOW: 'CÓMO FUNCIONA', WHO: 'PARA QUIÉN', WHY: 'POR QUÉ', CRITERIA: 'CRITERIOS', BENEFITS: 'BENEFICIOS', ROI: 'ROI', COST: 'COSTE', EXAMPLE: 'EJEMPLO', FAQ: 'PREGUNTAS', CONCLUSION: 'CONCLUSIÓN', SECTION: 'SECCIÓN' },
    it: { DEFINITION: 'DEFINIZIONE', HOW: 'COME FUNZIONA', WHO: 'PER CHI', WHY: 'PERCHÉ', CRITERIA: 'CRITERI', BENEFITS: 'VANTAGGI', ROI: 'ROI', COST: 'COSTO', EXAMPLE: 'ESEMPIO', FAQ: 'DOMANDE', CONCLUSION: 'CONCLUSIONE', SECTION: 'SEZIONE' },
    pl: { DEFINITION: 'DEFINICJA', HOW: 'JAK TO DZIAŁA', WHO: 'DLA KOGO', WHY: 'DLACZEGO', CRITERIA: 'KRYTERIA', BENEFITS: 'KORZYŚCI', ROI: 'ROI', COST: 'KOSZT', EXAMPLE: 'PRZYKŁAD', FAQ: 'PYTANIA', CONCLUSION: 'WNIOSEK', SECTION: 'SEKCJA' },
};

/** Derive the category eyebrow label for an H2 heading in the page's language.
 *  Used by both the SPA renderer and the bot prerender so the markup matches. */
export function deriveEyebrow(h2: string, lang: SupportedLang): string {
    const t = (h2 || '').toLowerCase();
    for (const [cat, re] of CATEGORY_PATTERNS) {
        if (re.test(t)) return EYEBROW_LABELS[lang][cat];
    }
    return EYEBROW_LABELS[lang].SECTION;
}

// Static routes eligible for indexing. Dynamic routes (comparisons, guides,
// solution pages) are added by the sitemap generator from the Supabase
// `seo_pages` table once the CMS is live.
export interface StaticRoute {
    path: string; // path *without* lang prefix, leading slash
    priority: number; // 0.0 - 1.0
    changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
    /** Bu rotanın yayınlandığı diller. Verilmezse SUPPORTED_LANGS'in tamamı
     *  kullanılır (varsayılan davranış). Yasal sayfalar yalnızca Türkçe
     *  yazıldığı için sitemap'e 7 dilin hepsiyle girmemeli — aksi halde
     *  crawler'a aynı Türkçe metni 7 ayrı URL olarak sunmuş oluruz. */
    langs?: SupportedLang[];
}

/** Genel erişime açık Türkçe yasal sayfalar. Tek liste; hem sitemap kayıtlarını
 *  hem footer linklerini besler ki ikisi birbirinden ayrışmasın. */
export const LEGAL_PAGES: Array<{ path: string; label: string }> = [
    { path: '/mesafeli-satis-sozlesmesi', label: 'Mesafeli Satış Sözleşmesi' },
    { path: '/on-bilgilendirme-formu', label: 'Ön Bilgilendirme Formu' },
    { path: '/iade-ve-iptal-kosullari', label: 'İade ve İptal Koşulları' },
    { path: '/teslimat-ve-kargo', label: 'Teslimat ve Kargo' },
];

export const STATIC_ROUTES: StaticRoute[] = [
    { path: '/', priority: 1.0, changefreq: 'weekly' },
    // Blog ana sayfası — yeni canonical hub (PR 11 migration). /resources
    // legacy URL'i _worker.ts'te 301 ile bu URL'ye çevriliyor; sitemap
    // sadece yeni URL'i yayınlar.
    { path: '/blog', priority: 0.9, changefreq: 'weekly' },
    // SEO content type index pages — /blog/ ağacının altında. /glossary,
    // /guides, /solutions, /compare eski URL'leri de 301 ile yeni
    // /blog/{section} URL'lerine çevrilir.
    { path: '/blog/glossary', priority: 0.8, changefreq: 'weekly' },
    { path: '/blog/guides', priority: 0.8, changefreq: 'weekly' },
    { path: '/blog/solutions', priority: 0.8, changefreq: 'weekly' },
    { path: '/blog/compare', priority: 0.8, changefreq: 'weekly' },
    // Yasal sayfalar — sadece Türkçe. Düşük öncelik + yıllık değişim: indeksin
    // içinde olmaları yeterli, sıralama hedefi değiller.
    ...LEGAL_PAGES.map(({ path }): StaticRoute => ({
        path,
        priority: 0.3,
        changefreq: 'yearly',
        langs: ['tr'],
    })),
];

/**
 * Footer'da gösterilecek yasal linkler.
 *
 * Yalnızca Türkçe döner: sayfaların içeriği Türkçe yazıldı ve Türk tüketici
 * mevzuatına özgü. Diğer dillerde boş dizi döndüğü için footer'ın link satırı
 * hiç render edilmez (SiteFooter zaten `links.length > 0` kontrolü yapıyor).
 *
 * Ödeme kuruluşları site onayında bu linklerin her sayfadan erişilebilir
 * olmasını arıyor; tek kaynaktan servis edilmesi altı ayrı footer çağrısında
 * listenin ayrışmasını engelliyor.
 */
export function legalFooterLinks(lang: string | null | undefined): Array<{ label: string; href: string }> {
    const code = (lang || '').split('-')[0].toLowerCase();
    if (code !== 'tr') return [];
    return LEGAL_PAGES.map(({ path, label }) => ({ label, href: path }));
}

// Topic clusters used by the /:lang/resources hub. Each topic key maps to
// (a) a chip label in SEO_UI_STRINGS, (b) a 1-line cluster description in
// SEO_UI_STRINGS, and (c) a multilingual regex pattern that inferTopics()
// runs against the slug + title to decide which topics apply to a page.
//
// Topics are inferred (not stored) in the first release: keeping the page
// model unchanged avoids a Supabase schema migration. Pattern matching is
// conservative — a page can have 0 or multiple topics, and `topicBeverageArtCreator`
// is the catch-all so the "All" + cluster-click filtering still returns
// results when the slug doesn't match anything specific.
export type TopicKey =
    | 'coffeePrinting'
    | 'edibleInk'
    | 'qrCup'
    | 'cocktail'
    | 'pastry'
    | 'horeca'
    | 'brandActivation'
    | 'beverageArtCreator'
    | 'seoResources'
    | 'geoResources';

export const TOPIC_KEYS: readonly TopicKey[] = [
    'coffeePrinting',
    'edibleInk',
    'qrCup',
    'cocktail',
    'pastry',
    'horeca',
    'brandActivation',
    'beverageArtCreator',
    'seoResources',
    'geoResources',
] as const;

// Multilingual regex patterns covering tr/en/de/fr/es/it/pl word stems.
// Order matters lightly: more specific topics (qr-cup, edible-ink) come
// before broader ones (beverage-art-creator) so a slug like
// "qr-bardak-sistemi" is tagged as qrCup, not just beverageArtCreator.
const TOPIC_PATTERNS: Array<[TopicKey, RegExp]> = [
    ['qrCup', /(qr-?(bardak|cup|becher|verre|vaso|bicchiere|kubek)|qr[\s-]?bardak|qr[\s-]?cup)/i],
    ['edibleInk', /(yenilebilir|edible|essbar|comestible|jadalny|atrament|tinta|encre|inchiostro|m[uü]rekkep|ink|tint|gida|food[\s-]?safe|gunsel)/i],
    ['cocktail', /(kokteyl|cocktail|koktajl)/i],
    ['pastry', /(pasta|pastane|pastry|bakery|pasticceria|patisserie|pasteler|piekarn|wypiek|cake|torta|tort)/i],
    ['horeca', /(otel|hotel|restoran|restaurant|cafe|kafe|hotel|horeca|ristorante)/i],
    ['brandActivation', /(brand|marka|aktivasyon|activation|aktywacja|attivazion|event|etkinlik|veranstaltung|événement|evento)/i],
    ['coffeePrinting', /(kahve|coffee|kaffee|café|caf[èé]|caffè|kawa|baski|baskı|druck|impression|impresion|impresión|stampa|druk|print|yazici|yazıcı|drukark)/i],
    ['beverageArtCreator', /(beverage[\s-]?art|icecek[\s-]?sanat|içecek[\s-]?sanat|getr[aä]nke[\s-]?kunst|art[\s-]?boisson|arte[\s-]?bebida|arte[\s-]?bevande|art[\s-]?napoj|napoj[oó]w)/i],
    ['seoResources', /(seo[\s-]?(resource|kaynak|ressource|risorsa|recurso|zasob))/i],
    ['geoResources', /(geo[\s-]?(resource|kaynak|ressource|risorsa|recurso|zasob)|aeo|ai[\s-]?(search|engine))/i],
];

/** Infer which topic clusters a page belongs to from its slug and title.
 *  Returns a (possibly empty) list of TopicKeys. Used by SeoResourcesHub
 *  to power the topic chip filter and cluster cards without requiring a
 *  Supabase schema change. Conservative: matches stem patterns only. */
export function inferTopics(slug: string, title: string): TopicKey[] {
    const haystack = `${slug || ''} ${title || ''}`.toLowerCase();
    const hits: TopicKey[] = [];
    for (const [key, re] of TOPIC_PATTERNS) {
        if (re.test(haystack)) hits.push(key);
    }
    // Every content page belongs to beverageArtCreator at a minimum since
    // the whole site is about the category — but only add as fallback if
    // no other topic matched, to keep cluster cards meaningful.
    if (hits.length === 0) hits.push('beverageArtCreator');
    return hits;
}
