// Admin-side CRUD for the SEO content tables (seo_pages, seo_authors).
// Drafts and unpublished rows are readable here because the admin client is
// authenticated; RLS only hides them from the public read path.

import { supabase } from '../../lib/supabase/client';
import { SUPPORTED_LANGS, SITE_URL, type SupportedLang } from '../../lib/seoConfig';
import type { SeoPage, SeoPageType, SeoAuthor, SeoContentBlock } from '../seoPageService';
import type { RoadmapEntry } from '../../lib/seoRoadmap';
import { SEO_ROADMAP } from '../../lib/seoRoadmap';
import { findGroupBySlug, type SeoGroupType } from '../../lib/seoSlugGroups';

// "İnsan Denetimi" (QA) sonuç tipleri — review-draft endpoint ile aynı şema.
export type SeoQaField = 'title' | 'meta_description' | 'intro' | 'h1' | 'block' | 'faq';
export type SeoQaIssueType =
    | 'ai_pattern' | 'eeat' | 'factual' | 'terminology' | 'thin' | 'grammar' | 'tone' | 'structure';

export interface SeoQaIssue {
    field: SeoQaField;
    block_index?: number;
    severity: 'error' | 'warning' | 'info';
    type: SeoQaIssueType;
    description: string;  // TR
    suggestion?: string;
}

export interface SeoQaReport {
    humanness_score: number;
    quality_score: number;
    summary: string;
    issues: SeoQaIssue[];
}

// Path prefix per SEO page type — mirrors the public router. Used to build
// the {/lang/prefix/slug} string we store in seo_redirects so the Worker can
// look up redirects by exact path match.
const REDIRECT_PATH_PREFIX: Record<SeoPageType, string> = {
    homepage: '',
    comparison: 'compare',
    guide: 'guides',
    solution: 'solutions',
    glossary: 'glossary',
};

function buildRedirectPath(lang: SupportedLang, type: SeoPageType, slug: string): string {
    if (type === 'homepage') return `/${lang}`;
    // Canonical /blog/ shape. Rows written before the /blog migration carry the
    // legacy `/{lang}/{prefix}/{slug}` form; functions/seo/redirects.ts looks up
    // both so those keep working.
    return `/${lang}/blog/${REDIRECT_PATH_PREFIX[type]}/${slug}`;
}

// Heuristic: does this slug look Turkish? Used by the create() guard so a
// programmatic creator (roadmap/suggestion/import script) never silently
// ships a TR slug on a non-TR row. Kept loose — false positives are cheap
// (we'll auto-translate) but false negatives create another audit candidate.
function slugLooksTurkish(s: string): boolean {
    return /(makinesi|sanat|icecek|sutu|baskisi|kahve-|yenilebilir|murekkep|gida|bardak|nedir|baskili|hicbir|ozel|kafe|otel|kisisellestirme|misafir|deneyim|nasil-secilir|geri-donus|kapsamli-rehber)/i.test(s);
}

// Maps the SEO page type to its public URL path segment. Homepage lives at
// the language root, everything else nests under a /<segment>/<slug> path.
const PAGE_PATH_SEGMENT: Record<SeoPageType, string> = {
    homepage: '',
    comparison: 'compare',
    guide: 'guides',
    solution: 'solutions',
    glossary: 'glossary',
};

/** Build the canonical public URL for a seo_pages row. */
function buildPublicUrl(row: { type: SeoPageType; language: SupportedLang; slug: string }): string {
    const segment = PAGE_PATH_SEGMENT[row.type];
    if (row.type === 'homepage') {
        return `${SITE_URL}/${row.language}`;
    }
    return `${SITE_URL}/${row.language}/${segment}/${row.slug}`;
}

/**
 * Fire-and-forget IndexNow notification. We intentionally do NOT await/throw
 * from callers — IndexNow being down should never block a publish operation
 * from finishing in the admin UI. The endpoint logs its own outcome.
 */
function notifyIndexNowFireAndForget(urls: string[]): void {
    if (urls.length === 0) return;
    // Don't await — we want this to run in the background. The session token
    // is fetched inside the async IIFE so no static secret is baked in.
    void (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        await fetch('/api/internal/indexnow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ urls }),
        });
    })().catch(() => {
        // Silent — we don't surface IndexNow failures to the admin UI.
    });
}

export interface SeoPageRow extends SeoPage {
    // Admin rows surface drafts too. The base type uses a union; here we keep
    // the same shape but allow `created_at` for sorting in the list view.
    created_at?: string;
}

export interface SeoPageListItem {
    id: string;
    slug: string;
    type: SeoPageType;
    language: SupportedLang;
    title: string;
    status: 'draft' | 'published';
    updated_at: string;
    published_at: string | null;
}

export interface SeoPageInput {
    slug: string;
    type: SeoPageType;
    language: SupportedLang;
    title: string;
    meta_description: string;
    h1?: string | null;
    intro?: string | null;
    content_json: unknown[];
    schema_json?: unknown | null;
    hero_image?: string | null;
    author_id?: string | null;
    competitors?: unknown[];
    faq?: unknown[];
    status: 'draft' | 'published';
    show_visual_strip?: boolean;
    show_instagram?: boolean;
}

export const SeoAdminService = {
    async list(filters?: {
        type?: SeoPageType;
        language?: SupportedLang;
        status?: 'draft' | 'published';
        search?: string;
    }): Promise<SeoPageListItem[]> {
        let query = supabase
            .from('seo_pages')
            .select('id, slug, type, language, title, status, updated_at, published_at')
            .order('updated_at', { ascending: false });
        if (filters?.type) query = query.eq('type', filters.type);
        if (filters?.language) query = query.eq('language', filters.language);
        if (filters?.status) query = query.eq('status', filters.status);
        if (filters?.search) query = query.ilike('title', `%${filters.search}%`);
        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []) as SeoPageListItem[];
    },

    async get(id: string): Promise<SeoPageRow | null> {
        const { data, error } = await supabase
            .from('seo_pages')
            .select('*, author:seo_authors(*)')
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        return (data as SeoPageRow) ?? null;
    },

    /**
     * Look up a row by its (slug, type, language) — used for conflict
     * detection in create/update so the UI can give a meaningful "this slug
     * is already in use" error instead of the raw Postgres unique-constraint
     * message.
     */
    async findByCanonical(slug: string, type: SeoPageType, language: SupportedLang): Promise<Pick<SeoPageRow, 'id' | 'status' | 'title' | 'slug' | 'type' | 'language'> | null> {
        const { data } = await supabase
            .from('seo_pages')
            .select('id, status, title, slug, type, language')
            .eq('slug', slug)
            .eq('type', type)
            .eq('language', language)
            .maybeSingle();
        return data as Pick<SeoPageRow, 'id' | 'status' | 'title' | 'slug' | 'type' | 'language'> | null;
    },

    async create(input: SeoPageInput, options?: { onConflict?: 'fail' | 'overwriteDraft' }): Promise<SeoPageRow> {
        // Last-line defense: any caller (editor, roadmap, suggestion, future
        // import scripts) that tries to insert a non-TR row whose slug looks
        // Turkish gets auto-translated here. Editor catches this earlier with
        // a confirm() dialog; the service-layer check covers programmatic
        // creators that bypass the UI.
        let slug = input.slug;
        if (
            input.type !== 'homepage' &&
            input.language !== 'tr' &&
            slugLooksTurkish(slug)
        ) {
            try {
                const fixed = await this.translateSlug({
                    sourceSlug: slug,
                    sourceLang: 'tr',
                    targetLang: input.language,
                    sourceTitle: input.title || undefined,
                });
                if (fixed && fixed !== slug) {
                    console.log(`[seo create] auto-translated TR-ish slug "${slug}" → "${fixed}" for ${input.language}`);
                    slug = fixed;
                }
            } catch (e) {
                console.error('[seo create] slug auto-translate failed; using original', (e as Error).message);
            }
        }

        // Conflict guard: same (slug, type, language) cannot exist twice.
        // If a row already exists we surface a structured error the UI can
        // catch and offer "open existing" or "overwrite draft" actions —
        // much better than the Postgres unique-constraint string.
        const existing = await this.findByCanonical(slug, input.type, input.language);
        if (existing) {
            if (existing.status === 'published') {
                const err = new Error(
                    `Bu sayfa zaten yayında: ${existing.title || existing.slug} (${existing.language.toUpperCase()}). ` +
                    `Yeni sayfa oluşturmak yerine var olanı düzenle.`,
                ) as Error & { code?: string; existingId?: string };
                err.code = 'SLUG_CONFLICT_PUBLISHED';
                err.existingId = existing.id;
                throw err;
            }
            // Draft collision: caller can opt to overwrite via options.
            if (options?.onConflict === 'overwriteDraft') {
                return this.update(existing.id, { ...input, slug });
            }
            const err = new Error(
                `Bu slug+dil zaten taslak olarak var: ${existing.title || existing.slug}. ` +
                `Üzerine yazmak için "Taslağı güncelle"yi seç.`,
            ) as Error & { code?: string; existingId?: string };
            err.code = 'SLUG_CONFLICT_DRAFT';
            err.existingId = existing.id;
            throw err;
        }

        const payload = {
            ...input,
            slug,
            // Stamp published_at when going live so sitemap lastmod is accurate.
            published_at: input.status === 'published' ? new Date().toISOString() : null,
        };
        const { data, error } = await supabase
            .from('seo_pages')
            .insert(payload)
            .select('*, author:seo_authors(*)')
            .single();
        if (error) throw error;
        const row = data as SeoPageRow;
        // Ping IndexNow whenever we publish a new page directly — drafts don't
        // get a URL yet so we skip them.
        if (row.status === 'published') {
            notifyIndexNowFireAndForget([
                buildPublicUrl({ type: row.type, language: row.language, slug: row.slug }),
            ]);
        }
        return row;
    },

    async update(id: string, input: Partial<SeoPageInput>): Promise<SeoPageRow> {
        // If transitioning draft → published for the first time, set published_at.
        const updates: Record<string, unknown> = { ...input };
        // Pull existing row once — we need it for (a) the first-publish stamp
        // and (b) detecting slug changes so we can register a 301 redirect.
        const existing = await this.get(id);
        if (input.status === 'published' && existing && !existing.published_at) {
            updates.published_at = new Date().toISOString();
        }

        // Conflict guard: renaming a slug to something already used by ANOTHER
        // row at the same (type, language) would trip the unique constraint.
        // Catch it before the DB call so the UI can show a friendly message
        // pointing at the conflicting row.
        if (
            existing &&
            input.slug &&
            input.slug !== existing.slug &&
            input.type !== 'homepage'
        ) {
            const targetType = (input.type ?? existing.type) as SeoPageType;
            const targetLang = (input.language ?? existing.language) as SupportedLang;
            const clash = await this.findByCanonical(input.slug, targetType, targetLang);
            if (clash && clash.id !== id) {
                const err = new Error(
                    `Bu slug zaten kullanılıyor: ${clash.title || clash.slug} (${targetLang.toUpperCase()}, ${clash.status === 'published' ? 'yayında' : 'taslak'}). ` +
                    `Farklı bir slug seç veya çakışan satırı önce sil.`,
                ) as Error & { code?: string; existingId?: string };
                err.code = 'SLUG_RENAME_CONFLICT';
                err.existingId = clash.id;
                throw err;
            }
        }

        const { data, error } = await supabase
            .from('seo_pages')
            .update(updates)
            .eq('id', id)
            .select('*, author:seo_authors(*)')
            .single();
        if (error) throw error;
        const row = data as SeoPageRow;

        // Slug change on a previously-published row → keep the old URL alive
        // by inserting a 301 redirect. Skipped when:
        //   - row was never published (drafts have no public URL yet)
        //   - slug didn't actually change
        //   - homepage (slug is fixed by router contract)
        if (existing && existing.status === 'published' && existing.type !== 'homepage') {
            if (row.slug !== existing.slug) {
                await this.registerRedirect({
                    oldLang: existing.language,
                    oldType: existing.type,
                    oldSlug: existing.slug,
                    newLang: row.language,
                    newType: row.type,
                    newSlug: row.slug,
                    seoPageId: id,
                });
            }
        }

        // Notify IndexNow on every published-save (covers both first-publish and
        // edits to an already-live page). Bing treats repeat pings on the same
        // URL as a "recrawl this" signal, which is exactly what we want after
        // editing live content. Includes the old URL too when the slug just
        // changed, so search engines refresh both ends of the redirect.
        if (row.status === 'published') {
            const urls: string[] = [
                buildPublicUrl({ type: row.type, language: row.language, slug: row.slug }),
            ];
            if (existing && existing.status === 'published' && existing.slug !== row.slug && existing.type !== 'homepage') {
                urls.push(buildPublicUrl({ type: existing.type, language: existing.language, slug: existing.slug }));
            }
            notifyIndexNowFireAndForget(urls);
        }

        return row;
    },

    /**
     * Manuel yedek: tüm published sayfaların URL'lerini toplayıp IndexNow'a
     * tek batch'te yollar. Otomatik tetik düşerse veya toplu içerik importu
     * sonrası reindex gerekirse admin bu butona basar.
     */
    async pingAllPublishedToIndexNow(): Promise<{
        submitted: number;
        bing: { status: number; body: string };
        yandex: { status: number; body: string };
    }> {
        const { data, error } = await supabase
            .from('seo_pages')
            .select('slug, type, language, status')
            .eq('status', 'published');
        if (error) throw error;
        const urls = (data ?? []).map((r) =>
            buildPublicUrl({
                type: r.type as SeoPageType,
                language: r.language as SupportedLang,
                slug: r.slug as string,
            }),
        );
        if (urls.length === 0) {
            throw new Error('Yayında sayfa yok.');
        }
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch('/api/internal/indexnow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ urls }),
        });
        if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(err.error ?? `IndexNow ping failed (${res.status})`);
        }
        return (await res.json()) as Awaited<ReturnType<typeof this.pingAllPublishedToIndexNow>>;
    },

    /**
     * Insert a 301 redirect row so the public Worker keeps serving the old
     * URL. Fire-and-forget from the caller's perspective: errors are logged
     * but not thrown, so a redirect-table outage doesn't block the actual
     * page update. The DB trigger collapses chains automatically.
     */
    async registerRedirect(input: {
        oldLang: SupportedLang;
        oldType: SeoPageType;
        oldSlug: string;
        newLang: SupportedLang;
        newType: SeoPageType;
        newSlug: string;
        seoPageId?: string | null;
    }): Promise<void> {
        const oldPath = buildRedirectPath(input.oldLang, input.oldType, input.oldSlug);
        const newPath = buildRedirectPath(input.newLang, input.newType, input.newSlug);
        if (oldPath === newPath) return;
        try {
            const { error } = await supabase
                .from('seo_redirects')
                .upsert(
                    {
                        old_path: oldPath,
                        new_path: newPath,
                        seo_page_id: input.seoPageId ?? null,
                        active: true,
                    },
                    { onConflict: 'old_path' },
                );
            if (error) {
                console.error('[seo_redirects] upsert failed', error.message);
            }
        } catch (e) {
            console.error('[seo_redirects] unexpected', (e as Error).message);
        }
    },

    async remove(id: string): Promise<void> {
        const { error } = await supabase.from('seo_pages').delete().eq('id', id);
        if (error) throw error;
    },

    // Authors --------------------------------------------------------------

    async listAuthors(): Promise<SeoAuthor[]> {
        const { data, error } = await supabase
            .from('seo_authors')
            .select('*')
            .order('name', { ascending: true });
        if (error) throw error;
        return (data ?? []) as SeoAuthor[];
    },

    async createAuthor(input: Omit<SeoAuthor, 'id'>): Promise<SeoAuthor> {
        const { data, error } = await supabase
            .from('seo_authors')
            .insert(input)
            .select('*')
            .single();
        if (error) throw error;
        return data as SeoAuthor;
    },

    async updateAuthor(id: string, patch: Partial<Omit<SeoAuthor, 'id'>>): Promise<SeoAuthor> {
        const { data, error } = await supabase
            .from('seo_authors')
            .update(patch)
            .eq('id', id)
            .select('*')
            .single();
        if (error) throw error;
        return data as SeoAuthor;
    },

    /** Hard delete an author row. seo_pages.author_id is set to NULL by
     *  the ON DELETE SET NULL FK so existing pages keep working (byline
     *  just disappears). Callers should warn the user when the author
     *  is in use; the DB cascade is non-destructive but the byline loss
     *  is invisible from the deletion modal otherwise. */
    async deleteAuthor(id: string): Promise<void> {
        const { error } = await supabase
            .from('seo_authors')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    /** Count how many seo_pages rows reference an author — used by the
     *  delete confirm modal so admins can see "this author has X published
     *  byline(s)" before they nuke the row. */
    async countAuthorUsage(id: string): Promise<number> {
        const { count, error } = await supabase
            .from('seo_pages')
            .select('id', { count: 'exact', head: true })
            .eq('author_id', id);
        if (error) throw error;
        return count ?? 0;
    },

    // Roadmap status & generation -----------------------------------------

    /**
     * Snapshot of every (entry slug, language) pair → its current status.
     * Returned shape: `{ [slug]: { [lang]: { id, status } } }`. Only includes
     * rows that exist in the DB; absent entries are "missing" by default.
     *
     * Looks up by slug+type to avoid collisions between the same slug across
     * different page types (e.g. a hypothetical `home` guide vs the homepage).
     */
    async getRoadmapStatus(): Promise<
        Record<string, Record<string, { id: string; status: 'draft' | 'published' }>>
    > {
        const { data, error } = await supabase
            .from('seo_pages')
            .select('id, slug, type, language, status');
        if (error) throw error;
        const map: Record<string, Record<string, { id: string; status: 'draft' | 'published' }>> = {};
        for (const row of data ?? []) {
            const r = row as { id: string; slug: string; type: SeoPageType; language: SupportedLang; status: 'draft' | 'published' };
            // Key by `type:slug` so the same slug under different types doesn't collide.
            const key = `${r.type}:${r.slug}`;
            map[key] ??= {};
            map[key][r.language] = { id: r.id, status: r.status };
        }
        return map;
    },

    /**
     * Create a draft row from a roadmap entry by calling the AI generator
     * with the entry's pre-filled target query + audience hint, then
     * inserting the resulting JSON straight into seo_pages with status='draft'.
     * Returns the new row so the UI can navigate to its editor.
     *
     * Throws on AI failure or DB error — caller should toast.
     */
    async generateFromRoadmap(entry: RoadmapEntry, lang: SupportedLang): Promise<SeoPageRow> {
        const draft = await this.generateDraft({
            type: entry.type,
            lang,
            targetQuery: entry.target_query[lang],
            audienceHint: entry.audience_hint,
            notes: entry.notes,
        });

        // Homepage slug is fixed; for other types use the AI's slug as a fallback
        // when the roadmap doesn't have a per-language slug filled in.
        const slug = entry.type === 'homepage'
            ? 'home'
            : entry.slug[lang] || draft.slug;

        const payload: SeoPageInput = {
            slug,
            type: entry.type,
            language: lang,
            title: draft.title,
            meta_description: draft.meta_description,
            h1: draft.h1,
            intro: draft.intro,
            content_json: draft.content_json,
            competitors: entry.type === 'comparison' ? draft.competitors : [],
            faq: draft.faq,
            status: 'draft',
        };

        // If a row already exists for this (slug, language, type) — typically
        // because the user is regenerating after a partial bulk run — update
        // the existing draft in place instead of erroring on the unique
        // constraint. Only overwrites drafts; published rows are left alone
        // to protect live content.
        const existing = await supabase
            .from('seo_pages')
            .select('id, status')
            .eq('slug', slug)
            .eq('type', entry.type)
            .eq('language', lang)
            .maybeSingle();
        if (existing.data) {
            if (existing.data.status === 'published') {
                throw new Error('Bu sayfa zaten yayında. Üzerine yazmak için önce editor\'dan düzenleyin.');
            }
            return this.update(existing.data.id, payload);
        }

        return this.create(payload);
    },

    /**
     * Calculate the E-E-A-T score (0-4) for a page. Mirrors the rule documented
     * in the plan. Used in both the editor (live indicator) and the roadmap UI.
     *
     *   Experience       — at least one stat block with a non-empty `source`
     *   Expertise        — author_id present
     *   Authoritativeness— at least one outbound markdown link in any block text
     *   Trustworthiness  — published with an updated_at timestamp
     */
    calculateEeatScore(page: Pick<SeoPage, 'content_json' | 'status' | 'updated_at'> & {
        author_id?: string | null;
        author?: SeoAuthor | null;
    }): number {
        let score = 0;
        const blocks = (page.content_json ?? []) as SeoContentBlock[];

        if (blocks.some((b) => b.type === 'stat' && typeof b.source === 'string' && b.source.trim().length > 0)) {
            score++;
        }
        if (page.author_id || page.author) {
            score++;
        }
        // Outbound link counts whether authored as a markdown link
        // [text](https://…) (legacy) or an inline <a href="https://…"> mark
        // (Faz 2 inline editor). Scan every string the block carries — text,
        // list items, table cells — not just `text`.
        const outboundLink = /\[[^\]]+\]\(https?:\/\/[^)]+\)|<a\s+[^>]*href=["']https?:\/\//i;
        const blockHasOutbound = (b: SeoContentBlock): boolean => {
            const strings: string[] = [];
            if (typeof b.text === 'string') strings.push(b.text);
            if (Array.isArray(b.items)) {
                for (const it of b.items as unknown[]) {
                    if (typeof it === 'string') strings.push(it);
                }
            }
            if (Array.isArray(b.rows)) {
                for (const row of b.rows as unknown[]) {
                    if (Array.isArray(row)) {
                        for (const cell of row) if (typeof cell === 'string') strings.push(cell);
                    }
                }
            }
            return strings.some((s) => outboundLink.test(s));
        };
        if (blocks.some(blockHasOutbound)) {
            score++;
        }
        if (page.status === 'published' && page.updated_at) {
            score++;
        }
        return score;
    },

    /** Supported languages convenience export — used by the roadmap UI to
     *  generate the column header set without re-importing seoConfig. */
    supportedLangs(): readonly SupportedLang[] {
        return SUPPORTED_LANGS;
    },

    // AI product context ---------------------------------------------------

    /**
     * Product description used by the SEO AI generators (full draft + per-block
     * regenerate). Stored as a single text blob under app_settings.key =
     * 'seo_ai_product_context'. The admin UI exposes a textarea so the user
     * can paste the verified facts about CAFEPASTE without touching code.
     *
     * Returns an empty string when no value is set yet — the AI prompts fall
     * back to their built-in generic context.
     */
    async getAiProductContext(): Promise<string> {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'seo_ai_product_context')
            .maybeSingle();
        if (error || !data) return '';
        return typeof data.value === 'string' ? data.value : '';
    },

    async setAiProductContext(value: string): Promise<void> {
        const { error } = await supabase
            .from('app_settings')
            .upsert({ key: 'seo_ai_product_context', value }, { onConflict: 'key' });
        if (error) throw error;
    },

    /**
     * Serbest yazım talimatları (genel + dile-özel). Ürün bağlamından ayrı:
     * burası "nasıl yazılsın" kuralları (ton, kaçınılacak kalıplar, dile özel
     * biçim). app_settings.key='seo_writing_instructions', JSON {general,perLang}.
     */
    async getSeoWritingInstructions(): Promise<{ general: string; perLang: Record<string, string> }> {
        const { data } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'seo_writing_instructions')
            .maybeSingle();
        const raw = data?.value;
        if (!raw) return { general: '', perLang: {} };
        try {
            const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return { general: (obj?.general || '').toString(), perLang: obj?.perLang || {} };
        } catch {
            return { general: raw.toString(), perLang: {} };
        }
    },

    async setSeoWritingInstructions(data: { general: string; perLang: Record<string, string> }): Promise<void> {
        const value = JSON.stringify({ general: data.general || '', perLang: data.perLang || {} });
        const { error } = await supabase
            .from('app_settings')
            .upsert({ key: 'seo_writing_instructions', value }, { onConflict: 'key' });
        if (error) throw error;
    },

    /**
     * Regenerate a single content block via AI. Used by the per-block "AI ile
     * değiştir" button in the editor — keeps the rest of the page intact and
     * rewrites just the targeted block, optionally with a free-form style hint
     * from the user ("daha kısa", "soru-cevap formatında", etc).
     */
    async regenerateBlock(input: {
        // Any structured block type — the AI endpoint rewrites by shape, not a
        // fixed enum (widened in Faz 4 when new CMS blocks were added).
        blockType: string;
        currentBlock: Record<string, unknown>;
        pageType: SeoPageType;
        lang: SupportedLang;
        pageTitle?: string;
        pageIntro?: string;
        targetQuery?: string;
        styleHint?: string;
    }): Promise<Record<string, unknown>> {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch('/api/internal/ai/seo/regenerate-block', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(input),
        });
        if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(err.error ?? `Block regeneration failed (${res.status})`);
        }
        const body = (await res.json()) as { block: Record<string, unknown> };
        return body.block;
    },

    // AI topic suggestions -------------------------------------------------

    /**
     * Ask the AI to propose N new page topics that the brand hasn't covered.
     * The caller passes the slugs already in the roadmap + the seo_pages table
     * so the model can avoid duplicates. Returns plain-data suggestions —
     * inserting them as drafts is a separate step (see `generateFromSuggestion`).
     */
    async suggestTopics(input: {
        existing: string[];
        lang: SupportedLang;
        count?: number;
        focus?: string;
    }): Promise<Array<{
        type: 'guide' | 'solution' | 'glossary';
        label: string;
        slug: string;
        target_query: string;
        audience_hint: string;
        rationale: string;
    }>> {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch('/api/internal/ai/seo/suggest-topics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(input),
        });
        if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(err.error ?? `Topic suggestion failed (${res.status})`);
        }
        const body = (await res.json()) as { suggestions: Awaited<ReturnType<typeof this.suggestTopics>> };
        return body.suggestions;
    },

    /**
     * Generate a full draft page from an AI-suggested topic and insert it as a
     * draft row. Reuses `generateDraft` under the hood, then writes to seo_pages
     * with the suggestion's slug/type. Mirrors `generateFromRoadmap` but for
     * topics that don't live in the static roadmap file.
     */
    async generateFromSuggestion(suggestion: {
        type: 'guide' | 'solution' | 'glossary';
        label: string;
        slug: string;
        target_query: string;
        audience_hint: string;
    }, lang: SupportedLang): Promise<SeoPageRow> {
        const draft = await this.generateDraft({
            type: suggestion.type,
            lang,
            targetQuery: suggestion.target_query,
            audienceHint: suggestion.audience_hint,
        });

        const slug = suggestion.slug || draft.slug;
        const payload: SeoPageInput = {
            slug,
            type: suggestion.type,
            language: lang,
            title: draft.title,
            meta_description: draft.meta_description,
            h1: draft.h1,
            intro: draft.intro,
            content_json: draft.content_json,
            competitors: [],
            faq: draft.faq,
            status: 'draft',
        };

        const existing = await supabase
            .from('seo_pages')
            .select('id, status')
            .eq('slug', slug)
            .eq('type', suggestion.type)
            .eq('language', lang)
            .maybeSingle();
        if (existing.data) {
            if (existing.data.status === 'published') {
                throw new Error('Bu sayfa zaten yayında. Üzerine yazmak için önce editor\'dan düzenleyin.');
            }
            return this.update(existing.data.id, payload);
        }
        return this.create(payload);
    },

    // AI slug translation --------------------------------------------------

    /**
     * Translate a slug from one locale to another. Used by the editor's
     * "dile çevir" button and the auto-translate effect when the language
     * dropdown changes. Server-side endpoint enforces ASCII kebab-case
     * output and handles diacritic stripping.
     *
     * Returns the translated slug. Throws on AI/network failure — caller
     * should toast and leave the field untouched.
     */
    async translateSlug(input: {
        sourceSlug: string;
        sourceLang: SupportedLang;
        targetLang: SupportedLang;
        sourceTitle?: string;
    }): Promise<string> {
        if (input.sourceLang === input.targetLang) return input.sourceSlug;
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch('/api/internal/ai/seo/translate-slug', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(input),
        });
        if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(err.error ?? `Slug translation failed (${res.status})`);
        }
        const body = (await res.json()) as { slug: string };
        return body.slug;
    },

    // Bulk slug audit & fix ------------------------------------------------

    /**
     * Scan `seo_pages` for rows whose slug doesn't match the row's language.
     * A slug is considered mis-localized when:
     *   1. A roadmap entry exists for the same page type whose `slug[lang]`
     *      equals the row's slug under a DIFFERENT language (i.e. the slug
     *      was copied from another locale without translation).
     *   2. OR no roadmap match, but the row's slug contains non-ASCII chars
     *      that don't match what the target language would produce.
     *
     * Returns the list of suspect rows + the proposed corrected slug. Caller
     * (admin UI) confirms before applying.
     */
    async auditSlugLocalization(): Promise<Array<{
        id: string;
        type: SeoPageType;
        currentSlug: string;
        currentLang: SupportedLang;
        title: string;
        status: 'draft' | 'published';
        proposedSlug: string;
        source: 'roadmap' | 'ai-fallback';
    }>> {
        const { data, error } = await supabase
            .from('seo_pages')
            .select('id, slug, type, language, title, status');
        if (error) throw error;
        const rows = (data ?? []) as Array<{
            id: string;
            slug: string;
            type: SeoPageType;
            language: SupportedLang;
            title: string;
            status: 'draft' | 'published';
        }>;

        // Build reverse lookup: for each (type, slug-value), which langs is
        // that slug the canonical roadmap slug for?
        const roadmapBySlug = new Map<string, { entry: RoadmapEntry; lang: SupportedLang }[]>();
        for (const entry of SEO_ROADMAP) {
            for (const lang of SUPPORTED_LANGS) {
                const s = entry.slug[lang];
                if (!s) continue;
                const key = `${entry.type}:${s}`;
                const arr = roadmapBySlug.get(key);
                const item = { entry, lang };
                if (arr) arr.push(item);
                else roadmapBySlug.set(key, [item]);
            }
        }

        const suspects: Array<{
            id: string;
            type: SeoPageType;
            currentSlug: string;
            currentLang: SupportedLang;
            title: string;
            status: 'draft' | 'published';
            proposedSlug: string;
            source: 'roadmap' | 'ai-fallback';
        }> = [];

        console.log(`[slug-audit] scanning ${rows.length} rows`);
        console.log('[slug-audit] distinct languages:', [...new Set(rows.map((r) => r.language))]);

        // Build a (type, slug) → all rows sharing that exact slug across
        // languages. If a slug is shared by 2+ rows AND none of them is the
        // "canonical TR slug", then everyone except the row whose language
        // matches the slug's language fingerprint gets flagged.
        const slugUsage = new Map<string, typeof rows>();
        for (const r of rows) {
            const k = `${r.type}:${r.slug}`;
            const arr = slugUsage.get(k);
            if (arr) arr.push(r);
            else slugUsage.set(k, [r]);
        }
        // Show every (type, slug) group that has more than one row — this
        // is the multi-language-collision set the audit is supposed to flag.
        const collisions = [...slugUsage.entries()].filter(([, arr]) => arr.length > 1);
        console.log(`[slug-audit] (type, slug) groups with >1 rows: ${collisions.length}`);
        collisions.forEach(([k, arr]) => {
            console.log(`  ${k} → langs: ${arr.map((r) => r.language).join(', ')}`);
        });
        // Show ALL non-TR rows whose slug is shared by a TR row.
        const trSlugs = new Set(rows.filter((r) => r.language === 'tr').map((r) => `${r.type}:${r.slug}`));
        const nonTrUsingTrSlug = rows.filter((r) => r.language !== 'tr' && trSlugs.has(`${r.type}:${r.slug}`));
        console.log(`[slug-audit] non-TR rows reusing a TR slug: ${nonTrUsingTrSlug.length}`);
        nonTrUsingTrSlug.slice(0, 10).forEach((r) => console.log(`  ${r.language}:${r.type}/${r.slug}`));

        // Turkish-specific token regex — catches slugs that *look* Turkish
        // regardless of which language row they sit under.
        const trTokens = /(makinesi|sanat|icecek|sutu|baskisi|kahve-|yenilebilir|murekkep|gida|bardak|nedir|baskili|hicbir|ozel|kafe|otel|kisisellestirme|misafir|deneyim|geri|donus|sure|hakkinda|bilmeniz|gereken|nasil|calisir|kapsamli|rehber|secilir)/i;

        // Language-specific token regex — quick check whether a slug
        // already reads as its target language (so we don't translate a
        // perfectly fine DE slug back into something else).
        const langTokens: Partial<Record<SupportedLang, RegExp>> = {
            de: /(maschine|kunst|tinte|druck|kaffee|getraenke|essbar|loehnt|sich|fragen|leitfaden)/i,
            en: /(machine|art|ink|printing|coffee|beverage|guide|edible|overview|comprehensive|how-to|return|invest)/i,
            fr: /(machine|art|encre|impression|cafe|boisson|guide|comestible|machine-a|investissement)/i,
            es: /(maquina|arte|tinta|impresion|cafe|bebida|guia|comestible|cafeteria|retorno|inversion)/i,
            it: /(macchina|arte|inchiostro|stampa|caffe|bevanda|guida|commestibile|cafeteria|ritorno|investimento)/i,
            pl: /(maszyna|sztuka|tusz|druk|kawa|napoj|przewodnik|jadalny|kawiarnia|zwrot|inwestycji)/i,
        };

        for (const row of rows) {
            if (row.type === 'homepage') continue;
            if (row.language === 'tr') continue; // TR rows are the reference
            const key = `${row.type}:${row.slug}`;

            // ---- Step 1 — roadmap is the most authoritative signal ------
            // Look up the roadmap entry whose canonical slug for some lang
            // matches this row's slug. Three sub-cases:
            //   (a) Roadmap entry has the SAME slug across all 7 languages
            //       → it's a universal/foreign term (espresso, cold-brew,
            //       latte-art). Skip; legitimate in every language.
            //   (b) Roadmap entry has a canonical slug for the row's
            //       language and it equals the row's slug → correct, skip.
            //   (c) Roadmap entry has a DIFFERENT canonical for this lang →
            //       row needs to be re-slugged. Flag with that canonical
            //       as the proposed value (deterministic, no AI needed).
            const matches = roadmapBySlug.get(key);
            if (matches) {
                const entry = matches[0].entry;
                const uniqueSlugs = new Set(Object.values(entry.slug));
                const isUniversalSlug = uniqueSlugs.size === 1;
                if (isUniversalSlug) continue;

                const canonicalForThisLang = entry.slug[row.language];
                if (canonicalForThisLang && canonicalForThisLang === row.slug) continue;

                if (canonicalForThisLang && canonicalForThisLang !== row.slug) {
                    suspects.push({
                        id: row.id,
                        type: row.type,
                        currentSlug: row.slug,
                        currentLang: row.language,
                        title: row.title,
                        status: row.status,
                        proposedSlug: canonicalForThisLang,
                        source: 'roadmap',
                    });
                    continue;
                }
                // Roadmap entry exists but no per-lang slug defined → fall
                // through to AI fallback paths.
            }

            // ---- Step 2 — DB-collision signal ---------------------------
            // The same (type, slug) is used by both this row AND a TR row.
            // That's the classic "copy-pasted from TR row" footprint, even
            // if the slug doesn't trip the TR-token regex. Strongest
            // evidence after roadmap.
            const sharedRows = slugUsage.get(key) ?? [];
            const hasTrSibling = sharedRows.some((r) => r.language === 'tr');
            if (hasTrSibling) {
                suspects.push({
                    id: row.id,
                    type: row.type,
                    currentSlug: row.slug,
                    currentLang: row.language,
                    title: row.title,
                    status: row.status,
                    proposedSlug: '',
                    source: 'ai-fallback',
                });
                continue;
            }

            // ---- Step 3 — slug literally contains Turkish morphemes ----
            // No TR sibling but the slug still reads as Turkish ("nedir",
            // "baskisi", "makinesi"). Flag for AI translation.
            if (trTokens.test(row.slug)) {
                suspects.push({
                    id: row.id,
                    type: row.type,
                    currentSlug: row.slug,
                    currentLang: row.language,
                    title: row.title,
                    status: row.status,
                    proposedSlug: '',
                    source: 'ai-fallback',
                });
                continue;
            }

            // ---- Step 4 — does the slug at least read as the target
            // language? --------------------------------------------------
            // If a row passes all the above (no roadmap, no TR sibling,
            // no TR tokens) AND the slug doesn't match the target language
            // regex either, it's neither here nor there — flag for AI
            // review. This catches e.g. an EN slug saved on an FR row.
            const targetLangRegex = langTokens[row.language];
            if (targetLangRegex && !targetLangRegex.test(row.slug)) {
                suspects.push({
                    id: row.id,
                    type: row.type,
                    currentSlug: row.slug,
                    currentLang: row.language,
                    title: row.title,
                    status: row.status,
                    proposedSlug: '',
                    source: 'ai-fallback',
                });
            }
            // Otherwise the slug looks native to the row's language — trust it.
        }
        console.log(`[slug-audit] suspects found: ${suspects.length}`);
        return suspects;
    },

    /**
     * Apply slug fixes from `auditSlugLocalization`. For AI-fallback suspects
     * with an empty proposed slug, calls translateSlug() to fill it in.
     * Only mutates draft rows by default — pass `includePublished: true` to
     * override (will break live URLs!).
     *
     * Returns per-row outcome so the UI can show a result table.
     */
    async applySlugFixes(
        suspects: Array<{
            id: string;
            type: SeoPageType;
            currentSlug: string;
            currentLang: SupportedLang;
            title: string;
            status: 'draft' | 'published';
            proposedSlug: string;
            source: 'roadmap' | 'ai-fallback';
        }>,
        options?: { includePublished?: boolean },
    ): Promise<Array<{ id: string; ok: boolean; newSlug?: string; reason?: string }>> {
        const results: Array<{ id: string; ok: boolean; newSlug?: string; reason?: string }> = [];
        const includePublished = options?.includePublished ?? false;

        for (const s of suspects) {
            if (s.status === 'published' && !includePublished) {
                results.push({ id: s.id, ok: false, reason: 'Published — kullanıcı atladı' });
                continue;
            }
            let newSlug = s.proposedSlug;
            if (!newSlug && s.source === 'ai-fallback') {
                try {
                    newSlug = await this.translateSlug({
                        sourceSlug: s.currentSlug,
                        sourceLang: 'tr',
                        targetLang: s.currentLang,
                        sourceTitle: s.title || undefined,
                    });
                } catch (e) {
                    results.push({ id: s.id, ok: false, reason: `AI çeviri hatası: ${(e as Error).message}` });
                    continue;
                }
            }
            if (!newSlug || newSlug === s.currentSlug) {
                results.push({ id: s.id, ok: false, reason: 'Önerilen slug boş veya aynı' });
                continue;
            }
            // Guard against unique-constraint collision: skip if the target
            // (type, language, slug) already exists for another row.
            const existing = await supabase
                .from('seo_pages')
                .select('id')
                .eq('type', s.type)
                .eq('language', s.currentLang)
                .eq('slug', newSlug)
                .neq('id', s.id)
                .maybeSingle();
            if (existing.data) {
                results.push({ id: s.id, ok: false, reason: `Çakışma: ${newSlug} zaten ${s.currentLang.toUpperCase()} için kullanılıyor` });
                continue;
            }
            const { error: updErr } = await supabase
                .from('seo_pages')
                .update({ slug: newSlug })
                .eq('id', s.id);
            if (updErr) {
                results.push({ id: s.id, ok: false, reason: updErr.message });
                continue;
            }
            // Published rows need a 301 redirect so the old URL keeps serving.
            // Draft rows skip this — they have no public URL yet. We also ping
            // IndexNow for both the new and old URL so Bing+Yandex refresh.
            if (s.status === 'published') {
                await this.registerRedirect({
                    oldLang: s.currentLang,
                    oldType: s.type,
                    oldSlug: s.currentSlug,
                    newLang: s.currentLang,
                    newType: s.type,
                    newSlug,
                    seoPageId: s.id,
                });
                notifyIndexNowFireAndForget([
                    buildPublicUrl({ type: s.type, language: s.currentLang, slug: newSlug }),
                    buildPublicUrl({ type: s.type, language: s.currentLang, slug: s.currentSlug }),
                ]);
            }
            results.push({ id: s.id, ok: true, newSlug });
        }
        return results;
    },

    // AI draft -------------------------------------------------------------

    async generateDraft(input: {
        type: SeoPageType;
        lang: SupportedLang;
        targetQuery: string;
        competitorHint?: string;
        audienceHint?: string;
        notes?: string;
    }): Promise<{
        slug: string;
        title: string;
        meta_description: string;
        h1: string;
        intro: string;
        content_json: unknown[];
        competitors: unknown[];
        faq: unknown[];
        hero_image_suggestion: string;
    }> {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch('/api/internal/ai/seo/generate-draft', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(input),
        });
        if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as {
                error?: string;
                providerStatus?: number | null;
                providerError?: string | null;
            };
            // Map the most common provider failures to operator-friendly
            // messages. Quota-exceeded is by far the most frequent — show
            // exactly where to fix it instead of dumping the raw upstream blob.
            const errBody = (err.providerError || '').toLowerCase();
            if (err.providerStatus === 429 && errBody.includes('quota')) {
                throw new Error(
                    'OpenAI kotan/krediin bitmiş. https://platform.openai.com/account/billing ' +
                    'sayfasından kredi yükle, ya da Anthropic Claude\'a geç (ANTHROPIC_API_KEY + AI_PROVIDER=claude).',
                );
            }
            if (err.providerStatus === 429) {
                throw new Error('AI provider rate-limit (429). Birkaç dakika bekle ve tekrar dene.');
            }
            if (err.providerStatus === 401 || err.providerStatus === 403) {
                throw new Error('AI provider API key geçersiz veya yetkisiz. Cloudflare env değişkenlerini kontrol et.');
            }
            // Fallback: raw status + body snippet for unfamiliar errors.
            const extra: string[] = [];
            if (err.providerStatus) extra.push(`upstream ${err.providerStatus}`);
            if (err.providerError) extra.push(err.providerError.slice(0, 200));
            const detail = extra.length ? ` — ${extra.join(' | ')}` : '';
            throw new Error((err.error ?? `Draft generation failed (${res.status})`) + detail);
        }
        const body = (await res.json()) as { draft: Awaited<ReturnType<typeof this.generateDraft>> };
        return body.draft;
    },

    /**
     * "İnsan Denetimi" — bir SEO sayfasını AI editör gibi denetler. AI-kalıbı,
     * E-E-A-T boşluğu, terim/gramer hatalarını bulur; humanness + quality skoru
     * ve tek tıkla uygulanabilir düzeltme önerileri döndürür.
     */
    async reviewDraft(input: {
        lang: SupportedLang;
        type: SeoPageType;
        title?: string;
        meta_description?: string;
        h1?: string;
        intro?: string;
        content_json?: unknown[];
        faq?: { question?: string; answer?: string }[];
    }): Promise<SeoQaReport> {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch('/api/internal/ai/seo/review-draft', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(input),
        });
        if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(err.error ?? `Denetim başarısız (${res.status})`);
        }
        const body = (await res.json()) as { report: SeoQaReport };
        return body.report;
    },

    /**
     * Translate an existing seo_pages row into one or more target languages.
     * Backend creates a new draft row per target language so the operator can
     * review before publishing each market. Returns per-language results so
     * the UI can show "translated 5/6" with the failing language(s).
     */
    async translatePage(input: {
        sourcePageId: string;
        targetLangs: SupportedLang[];
    }): Promise<{
        sourcePageId: string;
        translated: number;
        failed: number;
        results: Array<{ lang: string; ok: boolean; id?: string; error?: string }>;
    }> {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch('/api/internal/ai/seo/translate-page', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(input),
        });
        if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(err.error ?? `Translation failed (${res.status})`);
        }
        return (await res.json()) as Awaited<ReturnType<typeof this.translatePage>>;
    },

    /**
     * Published pages that belong to NO translation group.
     *
     * Slugs are localized per language and `seo_pages` has no link between
     * translations, so cross-language resolution runs off the static map in
     * src/lib/seoSlugGroups.ts. Content authored in the admin after that file
     * was last updated lands outside it — those pages still render fine, but a
     * language switch falls back to the section index instead of the equivalent
     * article, and their hreflang cluster is a singleton.
     *
     * This is the drift list: everything here needs a group added to
     * seoSlugGroups.ts (or a group_key value, once the 20260816 migration is
     * applied). Read-only.
     */
    async auditTranslationGroups(): Promise<Array<{
        id: string;
        type: SeoPageType;
        slug: string;
        language: SupportedLang;
        title: string;
    }>> {
        const { data, error } = await supabase
            .from('seo_pages')
            .select('id, slug, type, language, title')
            .eq('status', 'published')
            .neq('type', 'homepage');
        if (error) throw error;
        const rows = (data ?? []) as Array<{
            id: string;
            slug: string;
            type: SeoPageType;
            language: SupportedLang;
            title: string;
        }>;
        return rows.filter(
            (r) => !findGroupBySlug(r.type as SeoGroupType, r.slug),
        );
    },
};
