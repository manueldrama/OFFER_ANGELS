import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';

// Editor'un yazdigi offer_experience_layouts tablosundan SADECE OKUMA yapan
// musteri-side hook. Admin servisi (offerExperienceLayoutsService) write
// operasyonlari da yapiyor; bu hook customer flow icin tek yonlu okuma.
//
// RLS notu: offer_experience_layouts tablosu su an sadece admin rollerine
// SELECT izni veriyor (migration 20260507). Production'da musteriler bu
// hook ile veri okuyamayacak — fetch null doner, CustomerOffer fallback'e
// duser (mevcut hardcoded JSX). Admin browser'da login iken layout'u
// gorur. Public okuma icin ileride ayri bir RLS policy + status sutunu
// gerekecek (Phase 2 wiring).

export interface OfferLayoutRow {
    id: string;
    campaign_id: string | null;
    language_code: string;
    blocks: any[];
    content: Record<string, string>;
    /** Mobil gorunum icin bagimsiz blok id siralamasi. Bos ise [...left, ...right] fallback. */
    mobile_order: string[];
    version: number;
    updated_at: string;
}

export function useOfferLayout(campaignId: string | null | undefined, languageCode: string = 'tr') {
    const [layout, setLayout] = useState<OfferLayoutRow | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        const fetchLayout = async () => {
            // 1. Once kampanyaya-ozgu layout
            if (campaignId) {
                const { data: specific } = await supabase
                    .from('offer_experience_layouts')
                    .select('*')
                    .eq('campaign_id', campaignId)
                    .eq('language_code', languageCode)
                    .maybeSingle();
                if (!cancelled && specific) {
                    setLayout(specific as OfferLayoutRow);
                    setLoading(false);
                    return;
                }
            }

            // 2. Global fallback
            const { data: global } = await supabase
                .from('offer_experience_layouts')
                .select('*')
                .is('campaign_id', null)
                .eq('language_code', languageCode)
                .maybeSingle();
            if (!cancelled) {
                setLayout((global as OfferLayoutRow) ?? null);
                setLoading(false);
            }
        };

        fetchLayout().catch(err => {
            console.warn('useOfferLayout fetch failed:', err);
            if (!cancelled) setLoading(false);
        });

        return () => { cancelled = true; };
    }, [campaignId, languageCode]);

    return { layout, loading };
}
