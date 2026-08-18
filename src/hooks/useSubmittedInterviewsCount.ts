import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAdminRealtime } from './useAdminRealtime';

/**
 * İncelenmeyi bekleyen online mülakat sayısı (status='submitted').
 *
 * NEDEN VAR: Aday mülakatını gönderdiğinde sunucu satırı 'submitted' yapıyordu
 * ve BAŞKA HİÇBİR ŞEY olmuyordu. İK'nın öğrenmesinin tek yolu aday listesini
 * açıp satıra tıklayıp mülakat paneline inmekti — iki tık derinde ve tesadüfe
 * bağlı. Gönderilen mülakat günlerce fark edilmeden bekleyebiliyordu.
 *
 * TEK SAYAÇ, ÜÇ YÜZEY: kenar çubuğu rozeti, katlanmış grup noktası ve İK
 * panosundaki kart bu SAYIYI paylaşır. AdminLayout'un kendi notu bunu şart
 * koşuyor: ayrı ayrı hesaplanırsa katlanmış grup yanlış sinyal verir.
 *
 * KENDİLİĞİNDEN TEMİZLENİR: İK değerlendirme yazınca DB trigger'ı
 * (hr_interview_sync_avg) durumu 'submitted' → 'reviewed' yapar; ayrıca bir
 * "okundu" alanı ya da elle temizleme YOKTUR. Yani sayaç "yapılacak iş"i
 * gösterir, "görülmemiş bildirim"i değil.
 *
 * REALTIME ÖNKOŞULU: hr_interview_invites'ın supabase_realtime yayınında
 * olması gerekir (20260825a migration). Yayına eklenmemiş bir tabloda abonelik
 * SESSİZCE hiç tetiklenmez — hata da vermez. Rozet güncellenmiyorsa önce oraya
 * bakın. RLS zaten hr_is_manager() ile kilitli; yayın üyeliği veri sızdırmaz.
 */
export function useSubmittedInterviewsCount(enabled: boolean = true): number {
    const [count, setCount] = useState(0);

    const refresh = useCallback(async () => {
        const { count: c, error } = await supabase
            .from('hr_interview_invites')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'submitted');
        // İK yetkisi olmayan kullanıcıda RLS satır döndürmez ve sayı 0 kalır —
        // hata gösterilmez, çünkü bu bir yetki durumu, arıza değil.
        if (!error) setCount(c ?? 0);
    }, []);

    useEffect(() => {
        if (!enabled) return;
        void refresh();
    }, [refresh, enabled]);

    useAdminRealtime(enabled ? ['hr_interview_invites'] : [], refresh);

    return count;
}
