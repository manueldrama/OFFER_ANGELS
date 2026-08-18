import { useEffect } from 'react';

/**
 * Tam ekran katmanlar (modal / slide-over) için ESC ile kapatma + arka plan
 * scroll kilidi.
 *
 * Bu davranış PaymentDetailSlideOver ve AdSessionsDrawer içinde iki kez elle
 * yazılmıştı; İK detay sayfalarının katmanları da aynısına ihtiyaç duyunca
 * ortak kancaya çıkarıldı.
 *
 * `open` false iken hiçbir şey yapmaz — katman koşullu render ediliyorsa bile
 * kancayı üst seviyede çağırmak güvenlidir (hook kuralları bozulmaz).
 */
export function useOverlayDismiss(open: boolean, onClose: () => void) {
    useEffect(() => {
        if (!open) return;

        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, onClose]);
}
