import { supabase } from '../../lib/supabase/client';
import { PricingRule } from '../../types';
import { ruleMatchesContext, pickBestRule, resolveRulePair } from '../../lib/pricingRules';

export interface PricingResolutionContext {
    product_id?: string;
    product_package_id?: string;
    campaign_id?: string;
    country_code?: string;
    market_code?: string;
    currency_code?: string; // Optional filter to strictly enforce currency
}

export const PricingResolutionService = {
    /**
     * Resolves the most specific pricing rule (both full_price and deposit) for a given product or package 
     * based on the context (campaign, country, market).
     */
    async resolvePrices(context: PricingResolutionContext) {
        if (!context.product_id && !context.product_package_id) {
            throw new Error('[PricingResolutionService] Must provide either product_id or product_package_id');
        }

        // We fetch ALL active rules that could possibly match the requested product/package.
        let query = supabase.from('pricing_rules').select('*').eq('is_active', true);

        // Target Product OR Package
        if (context.product_package_id) {
            query = query.eq('product_package_id', context.product_package_id);
        } else if (context.product_id) {
            query = query.eq('product_id', context.product_id).is('product_package_id', null);
        }

        const { data, error } = await query;
        if (error) {
            console.error('[PricingResolutionService] Rules fetch failed:', error);
            throw error;
        }

        const rules = data as PricingRule[];

        // Eşleştirme + özgüllük seçimi src/lib/pricingRules'a delege edilir (worker'daki
        // remarketing yeniden-fiyatlama da AYNI modülü kullanır — tek doğruluk noktası).
        console.log('[Pricing] context=', context, ' candidate rules=', rules.map(r => ({
            country: r.country_code, market: r.market_code, campaign: r.campaign_id, currency: r.currency_code, type: r.price_type, amount: r.amount,
        })));
        const pair = resolveRulePair(rules, context);
        console.log('[Pricing] resolved=', {
            fullPrice: pair.fullPrice ? { country: pair.fullPrice.country_code, market: pair.fullPrice.market_code, amount: pair.fullPrice.amount } : null,
            deposit: pair.deposit ? { country: pair.deposit.country_code, campaign: pair.deposit.campaign_id, amount: pair.deposit.amount } : null,
        });
        return pair;
    },

    /**
     * Batch resolver — resolves the effective full_price rule for many products in
     * a SINGLE query. Used by the manual offer drawer so the product list shows the
     * real country/campaign-aware prices instead of the legacy products row.
     *
     * A `full_price` pricing_rules row carries TWO prices:
     *   - `amount`        → liste fiyatı (list price)
     *   - `launch_amount` → lansman/satış fiyatı (launch price, nullable)
     *
     * Returns a map of product_id → { listPrice, salePrice }. salePrice falls back
     * to listPrice when the rule has no launch_amount. Products with no matching
     * rule are omitted (caller falls back to the legacy products columns).
     */
    async resolveFullPricesForProducts(
        productIds: string[],
        context: { country_code?: string; market_code?: string; campaign_id?: string; currency_code?: string } = {}
    ): Promise<Record<string, { listPrice: number; salePrice: number }>> {
        const result: Record<string, { listPrice: number; salePrice: number }> = {};
        if (!productIds || productIds.length === 0) return result;

        const { data, error } = await supabase
            .from('pricing_rules')
            .select('*')
            .eq('is_active', true)
            .eq('price_type', 'full_price')
            .is('product_package_id', null)
            .in('product_id', productIds);

        if (error) {
            console.error('[PricingResolutionService] batch fetch failed:', error);
            return result;
        }

        const rules = (data || []) as PricingRule[];
        const now = new Date();

        // Group context-matching rules by product (matching logic = shared pricingRules lib).
        const byProduct = new Map<string, PricingRule[]>();
        for (const r of rules) {
            if (!r.product_id) continue;
            if (!ruleMatchesContext(r, context, now)) continue;
            const arr = byProduct.get(r.product_id) || [];
            arr.push(r);
            byProduct.set(r.product_id, arr);
        }

        // For each product pick the most specific rule (specificity, then DB priority).
        for (const [productId, candidates] of byProduct) {
            const best = pickBestRule(candidates);
            if (best && typeof best.amount === 'number' && best.amount > 0) {
                const listPrice = best.amount;
                const salePrice = (typeof best.launch_amount === 'number' && best.launch_amount > 0)
                    ? best.launch_amount
                    : best.amount;
                result[productId] = { listPrice, salePrice };
            }
        }

        return result;
    }
};

// calculateSpecificity artık src/lib/pricingRules.ts'te yaşıyor (worker ile paylaşılır).
