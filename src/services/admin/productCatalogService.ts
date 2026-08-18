import { supabase } from '../../lib/supabase/client';
import { CatalogProduct, ProductLocalizedContent, ProductMedia, CatalogProductPackage, ProductPackageLocalizedContent, PricingRule } from '../../types';

export const AdminProductCatalogService = {
    // ---------------------------------------------------------
    // Products
    // ---------------------------------------------------------
    async listProducts(params?: { search?: string; type?: string; activeOnly?: boolean; page?: number; limit?: number }) {
        const { search, type, activeOnly, page = 1, limit = 20 } = params || {};
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase.from('products').select(`
            *,
            localized:product_localized_content(*),
            media:product_media(*)
        `, { count: 'exact' });

        if (activeOnly) query = query.eq('is_active', true);
        if (type && type !== 'all') query = query.eq('product_type', type);
        if (search) query = query.ilike('product_code', `%${search}%`);

        const { data, count, error } = await query
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;
        return { products: data as unknown as CatalogProduct[], count: count || 0 };
    },

    async getProduct(id: string) {
        const { data, error } = await supabase.from('products').select(`
            *,
            localized:product_localized_content(*),
            media:product_media(*),
            packages:product_packages(*, localized:product_package_localized_content(*))
        `).eq('id', id).single();

        if (error) throw error;
        return data as unknown as CatalogProduct;
    },

    async createProduct(productData: Partial<CatalogProduct>, localizedData: Partial<ProductLocalizedContent>[]) {
        const { data: product, error: productError } = await supabase
            .from('products')
            .insert([productData])
            .select()
            .single();

        if (productError) throw productError;

        if (localizedData && localizedData.length > 0) {
            const locContent = localizedData.map(l => ({ ...l, product_id: product.id }));
            const { error: locError } = await supabase.from('product_localized_content').insert(locContent);
            if (locError) {
                console.error('[AdminProductCatalogService] Failed to insert localized content', locError);
            }
        }

        return product as CatalogProduct;
    },

    async updateProduct(id: string, updates: Partial<CatalogProduct>) {
        const { data, error } = await supabase
            .from('products')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as CatalogProduct;
    },

    async upsertProductLocalizedContent(productId: string, entries: Partial<ProductLocalizedContent>[]) {
        const payload = entries.map(e => ({ ...e, product_id: productId }));
        const { data, error } = await supabase
            .from('product_localized_content')
            .upsert(payload, { onConflict: 'product_id,language_code' })
            .select();

        if (error) throw error;
        return data;
    },

    async upsertProductMedia(productId: string, imageUrl: string) {
        if (!imageUrl) return;

        // Yalnızca ESKİ ANA görseli (mobil/liste = sort_order != 99) deaktif et.
        // KRİTİK: sort_order=99 (masaüstü) HARİÇ — aksi halde ana görseli kaydetmek
        // masaüstü görselini de pasife düşürüp siliyordu.
        await supabase
            .from('product_media')
            .update({ is_active: false })
            .eq('product_id', productId)
            .eq('media_type', 'image')
            .neq('sort_order', 99);

        // Insert new image
        const { data, error } = await supabase
            .from('product_media')
            .insert({
                product_id: productId,
                media_type: 'image',
                url: imageUrl,
                is_active: true,
                sort_order: 0
            })
            .select();

        if (error) throw error;
        return data;
    },

    async upsertDesktopMedia(productId: string, imageUrl: string) {
        if (!imageUrl) return;

        // Disable old desktop image (sort_order = 99)
        await supabase
            .from('product_media')
            .update({ is_active: false })
            .eq('product_id', productId)
            .eq('media_type', 'image')
            .eq('sort_order', 99);

        // Insert new desktop image
        const { data, error } = await supabase
            .from('product_media')
            .insert({
                product_id: productId,
                media_type: 'image',
                url: imageUrl,
                is_active: true,
                sort_order: 99
            })
            .select();

        if (error) throw error;
        return data;
    },

    // Ürüne özel WhatsApp pazarlama görseli — final teklif WhatsApp header'ında kullanılır.
    // media_type='whatsapp_marketing' ile saklanır (image kayıtlarına dokunmaz). Ürün başına tek.
    async upsertWhatsAppMarketingImage(productId: string, imageUrl: string) {
        // Eski aktif WhatsApp pazarlama görselini HER DURUMDA deaktif et (sadece bu
        // media_type). Görsel temizlendiyse (imageUrl boş) bu, silme işlemini yapar —
        // önceden `if (!imageUrl) return` erken çıkıp eski görseli aktif bırakıyordu.
        await supabase
            .from('product_media')
            .update({ is_active: false })
            .eq('product_id', productId)
            .eq('media_type', 'whatsapp_marketing');

        // Görsel kaldırıldıysa (boş) yenisini ekleme — yalnızca deaktif edip çık.
        if (!imageUrl) return;

        // Yeni görseli ekle
        const { data, error } = await supabase
            .from('product_media')
            .insert({
                product_id: productId,
                media_type: 'whatsapp_marketing',
                url: imageUrl,
                is_active: true,
                sort_order: 0
            })
            .select();

        if (error) throw error;
        return data;
    },

    async deleteProducts(productIds: string[]) {
        if (!productIds.length) return;
        const { error } = await supabase
            .from('products')
            .delete()
            .in('id', productIds);

        if (error) {
            console.error('[AdminProductCatalogService] Error deleting products:', error);
            throw error;
        }
    },

    // ---------------------------------------------------------
    // Packages
    // ---------------------------------------------------------
    async createPackage(packageData: Partial<CatalogProductPackage>, localizedData: Partial<ProductPackageLocalizedContent>[]) {
        const { data: pkg, error: pkgError } = await supabase
            .from('product_packages')
            .insert([packageData])
            .select()
            .single();

        if (pkgError) throw pkgError;

        if (localizedData && localizedData.length > 0) {
            const locContent = localizedData.map(l => ({ ...l, product_package_id: pkg.id }));
            const { error: locError } = await supabase.from('product_package_localized_content').insert(locContent);
            if (locError) console.error('[AdminProductCatalogService] Failed to insert package localized content', locError);
        }

        return pkg as CatalogProductPackage;
    },

    async updatePackage(id: string, updates: Partial<CatalogProductPackage>) {
        const { data, error } = await supabase.from('product_packages').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data as CatalogProductPackage;
    },

    async upsertPackageLocalizedContent(packageId: string, entries: Partial<ProductPackageLocalizedContent>[]) {
        const payload = entries.map(e => ({ ...e, product_package_id: packageId }));
        const { data, error } = await supabase
            .from('product_package_localized_content')
            .upsert(payload, { onConflict: 'product_package_id,language_code' })
            .select();

        if (error) throw error;
        return data;
    },

    // ---------------------------------------------------------
    // Pricing Rules
    // ---------------------------------------------------------
    async listPricingRules(params?: { productId?: string; packageId?: string; campaignId?: string; activeOnly?: boolean; page?: number; limit?: number }) {
        const { productId, packageId, campaignId, activeOnly, page = 1, limit = 50 } = params || {};
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase.from('pricing_rules').select(`
            *,
            products(product_code),
            product_packages(package_code),
            campaigns(name)
        `, { count: 'exact' });

        if (activeOnly) query = query.eq('is_active', true);
        if (productId) query = query.eq('product_id', productId);
        if (packageId) query = query.eq('product_package_id', packageId);
        if (campaignId) query = query.eq('campaign_id', campaignId);

        const { data, count, error } = await query
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;
        return { rules: data as unknown as PricingRule[], count: count || 0 };
    },

    async createPricingRule(ruleData: Partial<PricingRule>) {
        const { data, error } = await supabase.from('pricing_rules').insert([ruleData]).select().single();
        if (error) throw error;
        return data as PricingRule;
    },

    async updatePricingRule(id: string, updates: Partial<PricingRule>) {
        const { data, error } = await supabase.from('pricing_rules').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data as PricingRule;
    },

    async deletePricingRule(id: string) {
        const { error } = await supabase.from('pricing_rules').delete().eq('id', id);
        if (error) throw error;
        return true;
    }
};
