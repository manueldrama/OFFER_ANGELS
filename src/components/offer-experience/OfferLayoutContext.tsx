import React, { createContext, useContext } from 'react';
import type { OfferLayoutRow } from '../../hooks/useOfferLayout';

// Layout objesini agacta down-pass etmek icin lightweight context.
// CustomerOffer.tsx en uste useOfferLayout cagiriyor, sonra OfferLayoutProvider
// ile FinalOfferView'i sariyoruz; herhangi bir alt component <OfferText>
// kullanarak content'i okuyabiliyor.

const OfferLayoutContext = createContext<OfferLayoutRow | null>(null);

export function OfferLayoutProvider({
    layout,
    children,
}: {
    layout: OfferLayoutRow | null;
    children: React.ReactNode;
}) {
    return (
        <OfferLayoutContext.Provider value={layout}>
            {children}
        </OfferLayoutContext.Provider>
    );
}

export function useOfferLayoutContent() {
    const layout = useContext(OfferLayoutContext);
    return (fieldId: string, fallback: string): string => {
        const v = layout?.content?.[fieldId];
        if (typeof v === 'string' && v.trim()) return v;
        return fallback;
    };
}

/**
 * Substitute {{varName}} tokens in a string with values from a vars map.
 * Unmatched tokens are kept as-is so admins editing a string in the editor
 * see the literal "{{listPrice}}" placeholder rather than a blank.
 */
function applyTemplateVars(text: string, vars?: Record<string, string | number>): string {
    if (!vars || !text.includes('{{')) return text;
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const v = vars[key];
        return v === undefined || v === null ? match : String(v);
    });
}

// Inline helper: text override + fallback + template var substitution.
// CustomerOffer.tsx'te <OfferText fieldId="warn_title" fallback={t('...')}
// vars={{listPrice: fpc(x), discountAmount: fpc(y)}} /> yazilabilir.
// Admin DB'de "Liste fiyati {{listPrice}} olacak" gibi placeholder yazarsa
// veya hicbir override yoksa (fallback'te placeholder varsa) — gercek
// degerlerle doldurulur. Layout null/field bos ise fallback render edilir.
export function OfferText({
    fieldId,
    fallback,
    vars,
}: {
    fieldId: string;
    fallback: string;
    vars?: Record<string, string | number>;
}) {
    const getContent = useOfferLayoutContent();
    return <>{applyTemplateVars(getContent(fieldId, fallback), vars)}</>;
}
