// /venues/angels?t=<token> — token-gated directory of approved (published)
// creators that a CAFEPASTE venue/brand partner can browse and filter. No login;
// the unguessable token in the link is the capability.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import { AngelsShell, AngelsEyebrow, A } from '../../components/angels/AngelsShell';
import { CreatorCard } from '../../components/angels/CreatorCard';
import { useVenueToken, withToken } from '../../components/angels/useVenueToken';
import { AngelsService } from '../../services/angels/angelsService';
import { ANGEL_CATEGORIES } from '../../types/angels';
import type { AngelCreator } from '../../types/angels';
import { useAngelsContent } from '../../hooks/useAngelsContent';
import { applyAngelsTemplate } from '../../utils/angelsTemplate';

export default function VenuesAngelsDirectory() {
    const navigate = useNavigate();
    const { state, venue, token } = useVenueToken();
    const { getSection } = useAngelsContent('venue_directory');
    const intro = getSection('intro')?.config ?? {};
    const gateCopy = getSection('gate_copy')?.config ?? {};

    const [creators, setCreators] = useState<AngelCreator[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [city, setCity] = useState('');
    const [category, setCategory] = useState('');

    useEffect(() => {
        if (state !== 'ok') return;
        let active = true;
        (async () => {
            setLoading(true);
            try {
                const rows = await AngelsService.getPublishedCreators();
                if (active) setCreators(rows);
            } catch (e) {
                console.error('[angels] directory load failed', e);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [state]);

    const cities = useMemo(
        () => Array.from(new Set(creators.map(c => c.city).filter(Boolean))) as string[],
        [creators],
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return creators.filter(c => {
            if (city && c.city !== city) return false;
            if (category && !c.categories.includes(category)) return false;
            if (q && !`${c.full_name} ${c.instagram} ${c.city ?? ''}`.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [creators, search, city, category]);

    if (state === 'loading') {
        return (
            <AngelsShell>
                <div className="flex items-center gap-2" style={{ color: A.textMuted }}>
                    <Loader2 size={18} className="animate-spin" /> {gateCopy.verifying || 'Verifying access…'}
                </div>
            </AngelsShell>
        );
    }

    if (state === 'invalid') {
        return (
            <AngelsShell>
                <div className="text-center">
                    <h1 className="font-bold" style={{ fontSize: 22, marginBottom: 10 }}>
                        {gateCopy.title || 'Private access'}
                    </h1>
                    <p style={{ color: A.textSecondary, maxWidth: 420 }}>
                        {gateCopy.body || 'This area is reserved for CAFEPASTE venue and brand partners. Please use the private link shared by the CAFEPASTE team.'}
                    </p>
                </div>
            </AngelsShell>
        );
    }

    const selectStyle: React.CSSProperties = {
        background: A.surface,
        border: `1px solid ${A.border}`,
        color: A.text,
        borderRadius: 10,
        padding: '10px 13px',
        fontSize: 14,
        outline: 'none',
    };

    return (
        <AngelsShell maxWidth={1100} wordmarkSize="sm" showWordmark>
            <div className="w-full text-center mb-8">
                <AngelsEyebrow>
                    {venue?.name
                        ? applyAngelsTemplate(intro.eyebrow_with_venue || 'Welcome, {{venue}}', { venue: venue.name })
                        : intro.eyebrow_fallback || 'Approved creators'}
                </AngelsEyebrow>
                <h1 className="font-bold" style={{ fontSize: 'clamp(1.4rem, 5vw, 2rem)', letterSpacing: '-0.02em' }}>
                    {intro.title || 'The CAFEPASTE Angels network'}
                </h1>
                <p style={{ color: A.textSecondary, marginTop: 10, fontSize: 15 }}>
                    {intro.subtitle || 'Browse approved creators and request a collaboration. Our team handles every introduction.'}
                </p>
            </div>

            {/* Filters */}
            <div className="w-full flex flex-col sm:flex-row gap-3 mb-7">
                <div className="relative flex-1">
                    <Search
                        size={16}
                        style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: A.textMuted }}
                    />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={intro.search_placeholder || 'Search by name, handle or city'}
                        style={{ ...selectStyle, width: '100%', paddingLeft: 38 }}
                    />
                </div>
                <select value={city} onChange={e => setCity(e.target.value)} style={selectStyle}>
                    <option value="">{intro.all_cities_label || 'All cities'}</option>
                    {cities.map(c => (
                        <option key={c} value={c}>
                            {c}
                        </option>
                    ))}
                </select>
                <select value={category} onChange={e => setCategory(e.target.value)} style={selectStyle}>
                    <option value="">{intro.all_categories_label || 'All categories'}</option>
                    {ANGEL_CATEGORIES.map(c => (
                        <option key={c} value={c}>
                            {c}
                        </option>
                    ))}
                </select>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="w-full flex items-center justify-center py-16" style={{ color: A.textMuted }}>
                    <Loader2 size={20} className="animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div
                    className="w-full text-center py-16"
                    style={{ color: A.textMuted, border: `1px dashed ${A.border}`, borderRadius: 16 }}
                >
                    {intro.empty_text || 'No creators match these filters yet.'}
                </div>
            ) : (
                <div className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filtered.map(c => (
                        <CreatorCard
                            key={c.id}
                            creator={c}
                            onOpen={() => navigate(withToken(`/venues/angels/creators/${c.id}`, token))}
                        />
                    ))}
                </div>
            )}
        </AngelsShell>
    );
}
