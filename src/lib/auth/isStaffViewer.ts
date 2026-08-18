import { supabase } from '../supabase/client';

/**
 * Müşteri teklif sayfaları (/offer/:token) anonim açılır — gerçek müşterilerin
 * hiçbir zaman Supabase auth oturumu olmaz. Sadece admin paneli açık olan
 * personelin aktif bir oturumu vardır. Dolayısıyla teklif sayfasında aktif
 * oturumu OLAN ziyaretçi bir "iç kullanıcı"dır (admin/satışçı kendisi).
 *
 * Bu kişinin görüntüleme ve etkileşimleri lead skorunu, görüntüleme sayısını
 * (👁), otomasyon kurallarını ve reklam pikselini KIRLETMEMELİDİR — aksi halde
 * personelin teklif sayfalarına kendi bakışları açılma sayısını şişirip lead'i
 * yanlışlıkla "Sıcak" yapar.
 *
 * getSession() ağ çağrısı yapmaz (token'ı localStorage'dan okur), bu yüzden
 * her etkinlikte çağrılması ucuzdur.
 */
export async function isStaffViewer(): Promise<boolean> {
    try {
        const { data } = await supabase.auth.getSession();
        return !!data.session?.user;
    } catch {
        // Oturum okunamazsa müşteri varsay — gerçek müşteri etkinliği kaybolmasın.
        return false;
    }
}
