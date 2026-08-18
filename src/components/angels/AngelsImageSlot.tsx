// Visual slot used across the Angels invite page — the equivalent of the
// reference design's <image-slot>. Renders a CAFEPASTE brand image when one is
// provided, otherwise an elegant dark placeholder (never an empty gray box).

import { ImageIcon } from 'lucide-react';
import { A, FONT_BODY } from './AngelsShell';

export function AngelsImageSlot({
    src,
    alt = '',
    placeholder = 'CAFEPASTE beverage art',
    radius = 22,
    height,
    aspect,
    shape = 'rounded',
}: {
    src?: string | null;
    alt?: string;
    placeholder?: string;
    radius?: number;
    height?: number | string;
    aspect?: string;
    shape?: 'rounded' | 'circle' | 'rect';
}) {
    const br = shape === 'circle' ? '50%' : shape === 'rect' ? 0 : radius;
    const common: React.CSSProperties = {
        width: '100%',
        height: height ?? (aspect ? undefined : '100%'),
        aspectRatio: aspect,
        borderRadius: br,
        objectFit: 'cover',
        display: 'block',
        border: `1px solid ${A.border}`,
    };

    if (src) {
        return <img src={src} alt={alt} style={{ ...common, boxShadow: '0 40px 90px -30px rgba(0,0,0,0.8)' }} />;
    }

    return (
        <div
            style={{
                ...common,
                background:
                    'radial-gradient(120% 120% at 70% 0%, rgba(209,28,42,0.14), transparent 55%), linear-gradient(160deg, #16161a, #0c0c0f)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                color: A.textGhost,
                fontFamily: FONT_BODY,
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
            }}
        >
            <span
                style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    background: A.redSoft,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: A.redText,
                }}
            >
                <ImageIcon size={20} />
            </span>
            <span style={{ fontSize: 12.5, letterSpacing: '0.04em' }}>{placeholder}</span>
        </div>
    );
}
