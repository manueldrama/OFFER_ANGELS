import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock } from 'lucide-react';
import { VisitHistoryService, type VisitEntry } from '../../services/admin/visitHistoryService';
import { eventDotColor, eventLabel } from '../../lib/activityEvents';
import { formatDate, formatTime } from '../../hooks/useAppSettings';

interface VisitHistoryPopoverProps {
    /** Ziyaretleri lead üzerinden çözer; yoksa token'a düşer. */
    leadId?: string | null;
    token?: string | null;
    /** Tetikleyici görünüm ("N. kez geldi" rozeti). */
    children: React.ReactNode;
}

const CARD_WIDTH = 280;
const CARD_HEIGHT = 340; // yaklaşık — konum hesabı için
const GAP = 8;

/** Gün başlığı: Bugün / Dün / 22.07.2026 (uygulama saat dilimiyle). */
function dayLabelOf(iso: string): string {
    const day = formatDate(iso);
    const now = new Date();
    if (day === formatDate(now)) return 'Bugün';
    if (day === formatDate(new Date(now.getTime() - 86_400_000))) return 'Dün';
    return day;
}

/**
 * "N. kez geldi" rozetine hover/tık ile açılan Ziyaret Geçmişi kartı —
 * müşterinin her gelişini tarih+saat olarak listeler. Veri, akışın 100-olay
 * penceresinden bağımsız olarak hedefli sorguyla (tam geçmiş) çekilir.
 * Mekanik PhoneQrPopover ile aynı: hover-aç, tıkla-sabitle, Esc/dışarı kapat.
 */
export function VisitHistoryPopover({ leadId, token, children }: VisitHistoryPopoverProps) {
    const triggerRef = useRef<HTMLSpanElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fetchedRef = useRef(false);

    const [open, setOpen] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [loading, setLoading] = useState(false);
    const [visits, setVisits] = useState<VisitEntry[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

    const clearCloseTimer = () => {
        if (closeTimer.current) {
            clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }
    };

    const computePosition = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const spaceBelow = window.innerHeight - r.bottom;
        const above = spaceBelow < CARD_HEIGHT + GAP && r.top > CARD_HEIGHT + GAP;
        let left = r.left;
        if (left + CARD_WIDTH > window.innerWidth - GAP) left = window.innerWidth - CARD_WIDTH - GAP;
        if (left < GAP) left = GAP;
        const top = above ? r.top - GAP - CARD_HEIGHT : r.bottom + GAP;
        setPos({ top, left });
    }, []);

    const loadVisits = useCallback(async () => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        setLoading(true);
        try {
            const res = await VisitHistoryService.fetch({ leadId, token });
            setVisits(res.visits);
            setHasMore(res.hasMore);
        } catch {
            fetchedRef.current = false; // sonraki açılışta yeniden dene
        } finally {
            setLoading(false);
        }
    }, [leadId, token]);

    const doOpen = useCallback(() => {
        clearCloseTimer();
        computePosition();
        setOpen(true);
        void loadVisits();
    }, [computePosition, loadVisits]);

    const scheduleClose = useCallback(() => {
        if (pinned) return;
        clearCloseTimer();
        closeTimer.current = setTimeout(() => setOpen(false), 150);
    }, [pinned]);

    const handleTriggerClick = (e: React.MouseEvent) => {
        // satırı açmasın / başka tıklama davranışı tetiklemesin
        e.stopPropagation();
        if (pinned) {
            setPinned(false);
            setOpen(false);
        } else {
            setPinned(true);
            doOpen();
        }
    };

    // dışarı tıklama + Esc ile kapan; scroll/resize'da konumu güncelle
    useEffect(() => {
        if (!open) return;
        const onDocMouseDown = (ev: MouseEvent) => {
            const t = ev.target as Node;
            if (cardRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
            setPinned(false);
            setOpen(false);
        };
        const onKey = (ev: KeyboardEvent) => {
            if (ev.key === 'Escape') {
                setPinned(false);
                setOpen(false);
            }
        };
        const onReflow = () => computePosition();
        document.addEventListener('mousedown', onDocMouseDown);
        document.addEventListener('keydown', onKey);
        window.addEventListener('scroll', onReflow, true);
        window.addEventListener('resize', onReflow);
        return () => {
            document.removeEventListener('mousedown', onDocMouseDown);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', onReflow, true);
            window.removeEventListener('resize', onReflow);
        };
    }, [open, computePosition]);

    useEffect(() => () => clearCloseTimer(), []);

    // Sorgulanacak anahtar yoksa (isim-bazlı anonim giriş) tetikleyici sade kalır.
    if (!leadId && !token) return <>{children}</>;

    // Gün başlıklarıyla grupla (liste zaten desc sıralı geliyor).
    const groups: { label: string; items: VisitEntry[] }[] = [];
    for (const v of visits) {
        const label = dayLabelOf(v.at);
        const last = groups[groups.length - 1];
        if (last && last.label === label) last.items.push(v);
        else groups.push({ label, items: [v] });
    }

    return (
        <>
            <span
                ref={triggerRef}
                onMouseEnter={doOpen}
                onMouseLeave={scheduleClose}
                onClick={handleTriggerClick}
                className="inline-flex cursor-pointer"
            >
                {children}
            </span>

            {open &&
                createPortal(
                    <div
                        ref={cardRef}
                        onMouseEnter={clearCloseTimer}
                        onMouseLeave={scheduleClose}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: 'fixed',
                            top: pos.top,
                            left: pos.left,
                            width: CARD_WIDTH,
                            zIndex: 60,
                            animation: 'cpFadeIn .18s ease',
                        }}
                        className="rounded-xl border border-slate-200 bg-white shadow-xl"
                    >
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
                            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-800">
                                <CalendarClock size={13} className="shrink-0 text-indigo-500" />
                                Ziyaret Geçmişi
                            </span>
                            {!loading && visits.length > 0 && (
                                <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                                    {hasMore ? `${visits.length}+` : visits.length} ziyaret
                                </span>
                            )}
                        </div>

                        <div className="max-h-[280px] overflow-y-auto px-4 py-2.5">
                            {loading ? (
                                <div className="space-y-2 py-1">
                                    {[0, 1, 2].map((i) => (
                                        <div key={i} className="h-4 animate-pulse rounded bg-slate-100" />
                                    ))}
                                </div>
                            ) : visits.length === 0 ? (
                                <p className="py-3 text-center text-[11px] text-slate-400">Ziyaret kaydı bulunamadı.</p>
                            ) : (
                                groups.map((g) => (
                                    <div key={g.label} className="mb-2 last:mb-0">
                                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                            {g.label}
                                        </p>
                                        <div className="space-y-1">
                                            {g.items.map((v) => (
                                                <div key={v.id} className="flex items-center gap-2 text-[11px]">
                                                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${eventDotColor(v.event_type)}`} />
                                                    <span className="font-semibold tabular-nums text-slate-700">{formatTime(v.at)}</span>
                                                    <span className="truncate text-slate-500">{eventLabel(v.event_type)}</span>
                                                    {v.collapsed > 1 && (
                                                        <span className="shrink-0 text-[10px] text-slate-400">· {v.collapsed} olay</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {hasMore && !loading && (
                            <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">
                                Son {visits.length} ziyaret gösteriliyor
                            </p>
                        )}
                    </div>,
                    document.body,
                )}
        </>
    );
}
