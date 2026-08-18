// /angels/venue/discover — küratörlü creator keşfi.
// Featured şerit (yalnız Spotlight/admin-featured) + filtreler + kart ızgarası.
// Sıralama: alaka baskın, Spotlight ince boost (angelsRanking). Etiket dili
// sakin: "Spotlight" / "Featured" — asla "Sponsored/Ad".

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles } from 'lucide-react';
import { A } from '../../../components/angels/AngelsShell';
import {
    AngelsDashboardShell, AngelsPageHeader, AngelsEmpty, AngelsChip,
} from '../../../components/angels/dashboard/AngelsDashboard';
import {
    AngelsPortalVenueService, type DirectoryCreator, type ActivePromotion,
} from '../../../services/angels/angelsPortalVenueService';
import { rankCreators, featuredStrip, type RankedCreator } from '../../../services/angels/angelsRanking';
import { SPOTLIGHT_CITIES, VENUE_TYPES, CREATOR_TIERS } from '../../../types/angelsPlatform';

const selectStyle: React.CSSProperties = {
    background: A.surface, border: `1px solid ${A.border}`, color: A.text,
    borderRadius: 10, padding: '10px 12px', fontSize: 13.5, outline: 'none',
};

function CreatorTile({ c, onOpen }: { c: RankedCreator; onOpen: (c: RankedCreator) => void }) {
    return (
        <button
            onClick={() => onOpen(c)}
            className="text-left rounded-xl overflow-hidden cursor-pointer transition-transform hover:-translate-y-0.5"
            style={{ background: A.surface, border: `1px solid ${A.border}` }}
        >
            <div className="relative" style={{ aspectRatio: '4 / 5', background: A.surfaceElevated }}>
                {c.profile_image ? (
                    <img
                        src={c.profile_image}
                        alt={c.display_name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Sparkles size={22} style={{ color: A.textGhost }} />
                    </div>
                )}
                {(c._promotion || c.is_featured) && (
                    <span
                        className="absolute top-3 left-3 rounded-full px-2.5 py-1"
                        style={{
                            background: 'rgba(12,12,12,0.75)', backdropFilter: 'blur(8px)',
                            border: `1px solid ${c._promotion ? 'rgba(212,170,80,0.4)' : A.borderStrong}`,
                            color: c._promotion ? '#D8B65C' : A.textSecondary,
                            fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                        }}
                    >
                        {c._promotion ? 'Spotlight' : 'Featured'}
                    </span>
                )}
            </div>
            <div className="p-4">
                <p style={{ color: A.text, fontSize: 15, fontWeight: 700 }}>{c.display_name}</p>
                <p style={{ color: A.redText, fontSize: 12.5, fontWeight: 600, marginTop: 2 }}>@{c.instagram}</p>
                <p style={{ color: A.textMuted, fontSize: 12.5, marginTop: 6 }}>
                    {[c.city, c.country].filter(Boolean).join(', ') || '—'}
                </p>
                {c.categories?.length > 0 && (
                    <p style={{ color: A.textGhost, fontSize: 12, marginTop: 6 }}>
                        {c.categories.slice(0, 3).join(' · ')}
                    </p>
                )}
            </div>
        </button>
    );
}

export default function VenueDiscover() {
    const navigate = useNavigate();
    const [creators, setCreators] = useState<DirectoryCreator[]>([]);
    const [promotions, setPromotions] = useState<ActivePromotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [city, setCity] = useState('');
    const [venueType, setVenueType] = useState('');
    const [tier, setTier] = useState('');
    const [search, setSearch] = useState('');
    const impressionsSent = useRef(false);

    useEffect(() => {
        Promise.all([
            AngelsPortalVenueService.getDirectory(),
            AngelsPortalVenueService.getActivePromotions(),
        ]).then(([cs, ps]) => {
            setCreators(cs);
            setPromotions(ps);
        }).finally(() => setLoading(false));
    }, []);

    const ranked = useMemo(() => {
        let rows = rankCreators(creators, promotions, { city: city || null, venueType: venueType || null });
        if (tier) rows = rows.filter(c => c.tier === tier);
        if (search.trim()) {
            const qq = search.trim().toLowerCase();
            rows = rows.filter(c =>
                c.display_name.toLowerCase().includes(qq) ||
                c.instagram.toLowerCase().includes(qq) ||
                (c.city || '').toLowerCase().includes(qq));
        }
        return rows;
    }, [creators, promotions, city, venueType, tier, search]);

    const featured = useMemo(() => featuredStrip(ranked), [ranked]);

    // Impression kaydı — oturum başına bir kez, ilk render'da görünen promosyonlar
    useEffect(() => {
        if (impressionsSent.current || loading) return;
        const ids = ranked.slice(0, 24).map(c => c._promotion?.id).filter(Boolean) as string[];
        if (!ids.length) return;
        try {
            const key = 'angels_imp_sent';
            if (sessionStorage.getItem(key)) return;
            sessionStorage.setItem(key, '1');
        } catch { /* noop */ }
        impressionsSent.current = true;
        AngelsPortalVenueService.recordImpressions([...new Set(ids)]);
    }, [ranked, loading]);

    function openCreator(c: RankedCreator) {
        if (c._promotion) AngelsPortalVenueService.recordClick(c._promotion.id);
        navigate(`/venue/creators/${c.id}`, { state: { promotionId: c._promotion?.id || null } });
    }

    return (
        <AngelsDashboardShell area="venue">
            <AngelsPageHeader
                eyebrow="Curated Network"
                title="Discover Creators"
                description="Selected creators, curated by CAFEPASTE Angels. Collaboration requests are managed through the platform."
            />

            {/* Filtreler */}
            <div className="flex flex-wrap gap-3 mb-8">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: A.textGhost }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search creators…"
                        className="w-full rounded-[10px] pl-10 pr-3.5"
                        style={{ ...selectStyle, width: '100%', paddingLeft: 38, height: 42 }}
                    />
                </div>
                <select value={city} onChange={e => setCity(e.target.value)} style={selectStyle}>
                    <option value="">All cities</option>
                    {SPOTLIGHT_CITIES.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                </select>
                <select value={venueType} onChange={e => setVenueType(e.target.value)} style={selectStyle}>
                    <option value="">All venue types</option>
                    {VENUE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select value={tier} onChange={e => setTier(e.target.value)} style={selectStyle}>
                    <option value="">All tiers</option>
                    {CREATOR_TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
            </div>

            {/* Featured şerit */}
            {featured.length > 0 && (
                <div className="mb-9">
                    <div className="flex items-center gap-2 mb-4">
                        <Sparkles size={14} style={{ color: '#D8B65C' }} />
                        <p style={{
                            color: A.textSecondary, fontSize: 11.5, fontWeight: 700,
                            letterSpacing: '0.14em', textTransform: 'uppercase',
                        }}>
                            Featured Creators
                        </p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                        {featured.map(c => <CreatorTile key={c.id} c={c} onOpen={openCreator} />)}
                    </div>
                </div>
            )}

            {/* Ana ızgara */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 rounded-full animate-spin"
                        style={{ border: `3px solid ${A.border}`, borderTopColor: A.red }} />
                </div>
            ) : ranked.length === 0 ? (
                <AngelsEmpty
                    icon={Search}
                    title="No creators match your filters"
                    hint="Try broadening your search — new creators join the network regularly."
                />
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                    {ranked.map(c => <CreatorTile key={c.id} c={c} onOpen={openCreator} />)}
                </div>
            )}

            <p className="mt-8" style={{ color: A.textGhost, fontSize: 12, lineHeight: 1.7 }}>
                <AngelsChip tone="neutral">Private network</AngelsChip>
                <span className="ml-2">
                    Contact details are never shared directly. All collaborations are managed through CAFEPASTE Angels.
                </span>
            </p>
        </AngelsDashboardShell>
    );
}
