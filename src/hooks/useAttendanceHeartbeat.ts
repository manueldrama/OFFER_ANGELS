import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase/client';
import { sectionForPath } from '../lib/hr/adminSections';

// Puantaj sinyali — admin paneli açıkken düzenli aralıklarla çalışır.
//
// NEDEN LOGIN OLAYI DEĞİL: Supabase oturumu kalıcıdır; personel haftada bir kez
// login olur. Login olayı mesai ölçemez, bu yüzden düzenli sinyal gerekir.
//
// İKİ AYRI ÖLÇÜ:
//   auto_active_minutes → sekme görünürdü
//   interaction_minutes → GERÇEKTEN klavye/fare hareketi vardı
// İkisinin farkı "açık ama boşta" süresidir. Yalnız görünürlüğe bakılsaydı
// bilgisayarını açık bırakan personel tam mesai yapmış görünürdü.
//
// GÜVENLİK: hr_attendance_ping() employee_id ALMAZ, auth.uid() kullanır — kimse
// başkası adına mesai bildiremez (bkz. 20260819c migration, INVARIANT A).
//
// KVKK: Sunucuya yalnızca BÖLÜM anahtarı gider (crm, catalog…), hangi sayfada
// olduğu değil. Tuş içerikleri veya tıklama koordinatları HİÇBİR ŞEKİLDE
// toplanmaz; yalnızca "son etkileşim ne zaman oldu" zaman damgası tutulur.
//
// SESSİZ ÇALIŞIR: İK profili olmayan kullanıcıda fonksiyon hiçbir şey yapmaz.
// Puantaj yan bir özelliktir, paneli asla bloke etmemeli.

const PING_INTERVAL_MS = 5 * 60 * 1000;   // 5 dakika
/** Arka plandaki sekme sinyal atmaz — açık unutulan tarayıcı mesai sayılmasın. */
const MIN_GAP_MS = 60 * 1000;
/**
 * Bu süre boyunca hiç etkileşim olmadıysa "boşta" sayılır.
 * Sunucudaki activity_idle_minutes ile aynı amaca hizmet eder; istemci tarafında
 * ping başına tek bir bayrağa indirgemek için burada da bir eşik gerekir.
 */
const IDLE_THRESHOLD_MS = 5 * 60 * 1000;
/** Etkileşim olayları çok sık tetiklenir; ref güncellemesi throttle edilir. */
const INTERACTION_THROTTLE_MS = 15 * 1000;

const INTERACTION_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'] as const;

export function useAttendanceHeartbeat(enabled = true, pathname?: string) {
    const lastPingRef = useRef(0);
    const lastInteractionRef = useRef(0);
    const lastInteractionWriteRef = useRef(0);
    // pathname her rota değişiminde değişir; effect'i yeniden kurmamak için ref'te tutulur.
    const pathnameRef = useRef(pathname);
    pathnameRef.current = pathname;

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;

        const markInteraction = () => {
            const now = Date.now();
            if (now - lastInteractionWriteRef.current < INTERACTION_THROTTLE_MS) return;
            lastInteractionWriteRef.current = now;
            lastInteractionRef.current = now;
        };

        // İlk yükleme kullanıcının orada olduğunun kanıtıdır.
        lastInteractionRef.current = Date.now();

        for (const evt of INTERACTION_EVENTS) {
            window.addEventListener(evt, markInteraction, { passive: true });
        }

        const ping = async () => {
            if (cancelled) return;
            if (document.visibilityState !== 'visible') return;
            const now = Date.now();
            if (now - lastPingRef.current < MIN_GAP_MS) return;
            lastPingRef.current = now;

            const { data: { session } } = await supabase.auth.getSession();
            if (!session || cancelled) return;

            const interacted = now - lastInteractionRef.current < IDLE_THRESHOLD_MS;
            const section = sectionForPath(pathnameRef.current);

            // Hata yutulur: puantaj yan bir özelliktir, paneli etkilememeli.
            // (rpc() bir sorgu kurucusudur; .catch() zincirlenemez, await edilir.)
            try {
                await supabase.rpc('hr_attendance_ping', {
                    p_section: section,
                    p_interacted: interacted,
                });
            } catch {
                // sessiz
            }
        };

        void ping();
        const timer = window.setInterval(() => { void ping(); }, PING_INTERVAL_MS);
        const onVisible = () => { void ping(); };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
            for (const evt of INTERACTION_EVENTS) {
                window.removeEventListener(evt, markInteraction);
            }
        };
    }, [enabled]);
}
