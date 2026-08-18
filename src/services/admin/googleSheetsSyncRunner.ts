import { supabase } from '../../lib/supabase/client';
import { AdminLeadsService } from './leadsService';
import { AdminOfferLinksService } from './offerLinksService';
import { AdminWhatsAppService } from './whatsappService';
import { GoogleSheetsService, GoogleSheetConnector } from './googleSheetsService';

/**
 * UTILS & TRANSFORMS
 */
export const GS_TRANSFORMS = {
    trim: (val: any) => String(val || '').trim(),
    lowercase: (val: any) => String(val || '').toLowerCase(),
    phone_normalize: (val: any) => {
        const cleaned = String(val || '').replace(/\D/g, '');
        // Assume +90 if starts with 5 and is 10 digits
        if (cleaned.length === 10 && cleaned.startsWith('5')) return `90${cleaned}`;
        // If 11 digits and starts with 05
        if (cleaned.length === 11 && cleaned.startsWith('05')) return `90${cleaned.substring(1)}`;
        return cleaned;
    },
    toBoolean: (val: any) => {
        const s = String(val || '').toLowerCase();
        return ['yes', 'true', '1', 'evet', 'onay'].includes(s);
    }
};

export const GoogleSheetsSyncRunner = {
    /**
     * PROCESS A SINGLE CONNECTOR
     *
     * Cloudflare Worker subrequest sinirina (~1000 / invocation) takilmamak icin
     * backend sync-one bir cagrida en fazla BATCH_LIMIT satir isliyor ve geri
     * kalanlari `stats.rows_remaining` ile bildiriyor. Buyuk sheet'lerde
     * kullanicinin tek tikla tum satirlari islemesi icin response > 0 oldugu
     * surece sync'i tekrar tetikliyoruz. Stat'leri birikimli olarak topluyoruz
     * ki UI'da tek seferde "X lead olusturuldu" gibi dogru ozet gosterilsin.
     */
    async syncConnector(connectorId: string) {
        console.log(`[SyncRunner] Triggering backend sync for ${connectorId}`);

        const MAX_BATCHES = 40; // Paid plan'da BATCH_LIMIT=50 → 40 batch = 2000 satira kadar tek tiklamayla
        const aggregate: any = {
            rows_scanned: 0,
            rows_processed: 0,
            leads_upserted: 0,
            links_generated: 0,
            whatsapp_sent: 0,
            failures: [] as Array<{ row: number; error: string }>,
            rows_remaining: 0,
        };

        const { data: { session } } = await supabase.auth.getSession();

        for (let i = 0; i < MAX_BATCHES; i++) {
            const response = await fetch(`/api/internal/sheets/sync-one?connectorId=${connectorId}&secret=mock-admin-bypass`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` }
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.details || errData.error || 'Backend sync failed');
            }

            const data = await response.json();
            const stats = data.stats || {};

            // rows_scanned son batch'in raporladigi degerdir (sheet'in tum boyutu).
            aggregate.rows_scanned = stats.rows_scanned ?? aggregate.rows_scanned;
            aggregate.rows_processed += stats.rows_processed || 0;
            aggregate.leads_upserted += stats.leads_upserted || 0;
            aggregate.links_generated += stats.links_generated || 0;
            aggregate.whatsapp_sent += stats.whatsapp_sent || 0;
            if (Array.isArray(stats.failures) && stats.failures.length > 0) {
                aggregate.failures.push(...stats.failures);
            }
            aggregate.rows_remaining = stats.rows_remaining || 0;

            if (!stats.rows_remaining || stats.rows_remaining <= 0) break;
        }

        return aggregate;
    },

    /**
     * MOCK: Fetch data from Google Sheets (Kept for frontend "Test" UI only)
     */
    async fetchSheetData(connector: GoogleSheetConnector) {
        console.log(`[SyncRunner] Mock fetching sheet from ${connector.sheet_url}`);
        return {
            headers: ['Ad Soyad', 'Telefon', 'Email', 'Firma', 'Not', 'Opt-in'],
            rows: [] as any[][]
        };
    },

    /**
     * SYNC ALL ENABLED CONNECTORS
     */
    async syncAll() {
        // Trigger backend sync-all
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch('/api/internal/sheets/sync-all?secret=mock-admin-bypass', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session?.access_token ?? ''}`
            }
        });
        if (!response.ok) throw new Error('Sync all failed');
        const data = await response.json();
        return data.results;
    },

    /**
     * RESET CURSOR AND SYNC FROM SCRATCH
     */
    async resetAndSync(connectorId: string) {
        // 1) Reset cursor
        const { data: { session } } = await supabase.auth.getSession();
        const resetRes = await fetch(`/api/internal/sheets/reset-cursor?connectorId=${connectorId}&secret=mock-admin-bypass`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` }
        });
        if (!resetRes.ok) {
            const err = await resetRes.json().catch(() => ({}));
            throw new Error(err.details || err.error || 'Cursor reset failed');
        }

        // 2) Run sync (all rows from scratch)
        return await GoogleSheetsSyncRunner.syncConnector(connectorId);
    }
};
