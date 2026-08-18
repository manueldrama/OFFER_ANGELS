// Creator card used in the token-gated venue directory. Dark, elegant, photo-led
// — reads as a curated profile, not a marketplace listing.

import { MapPin, Star, Camera } from 'lucide-react';
import { A } from './AngelsShell';
import type { AngelCreator } from '../../types/angels';

export function CreatorCard({
    creator,
    onOpen,
}: {
    creator: AngelCreator;
    onOpen: () => void;
}) {
    const cover = creator.profile_image || creator.gallery_images[0] || null;
    return (
        <button
            type="button"
            onClick={onOpen}
            className="group text-left flex flex-col overflow-hidden transition-all duration-200"
            style={{
                background: A.surface,
                border: `1px solid ${A.border}`,
                borderRadius: 16,
                cursor: 'pointer',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.borderColor = A.borderStrong;
                e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.borderColor = A.border;
                e.currentTarget.style.transform = '';
            }}
        >
            <div className="relative w-full" style={{ aspectRatio: '4/5', background: A.surfaceElevated }}>
                {cover ? (
                    <img src={cover} alt={creator.full_name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ color: A.textGhost }}>
                        <Camera size={28} />
                    </div>
                )}
                {creator.is_featured && (
                    <span
                        className="absolute top-3 left-3 inline-flex items-center gap-1 font-semibold uppercase"
                        style={{
                            fontSize: 10,
                            letterSpacing: '0.12em',
                            padding: '5px 9px',
                            borderRadius: 9999,
                            background: 'rgba(209,28,42,0.9)',
                            color: '#fff',
                        }}
                    >
                        <Star size={11} fill="currentColor" /> Featured
                    </span>
                )}
            </div>

            <div className="p-4">
                <h3 className="font-semibold" style={{ fontSize: 16, color: A.text, letterSpacing: '-0.01em' }}>
                    {creator.full_name}
                </h3>
                <div className="flex items-center gap-3 mt-1.5" style={{ color: A.textMuted, fontSize: 13 }}>
                    {creator.city && (
                        <span className="inline-flex items-center gap-1">
                            <MapPin size={12} />
                            {creator.city}
                            {creator.country ? `, ${creator.country}` : ''}
                        </span>
                    )}
                </div>
                {creator.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {creator.categories.slice(0, 3).map(c => (
                            <span
                                key={c}
                                style={{
                                    fontSize: 11.5,
                                    padding: '3px 9px',
                                    borderRadius: 9999,
                                    border: `1px solid ${A.border}`,
                                    color: A.textSecondary,
                                }}
                            >
                                {c}
                            </span>
                        ))}
                        {creator.categories.length > 3 && (
                            <span style={{ fontSize: 11.5, padding: '3px 4px', color: A.textGhost }}>
                                +{creator.categories.length - 3}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </button>
    );
}
