import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Phone } from 'lucide-react';

interface PhoneQrPopoverProps {
    /** Ham telefon numarası (ör. "905338112416"). */
    phone: string;
    /** Tetikleyici görünüm (kapalı satırdaki telefon span'i). */
    children: React.ReactNode;
}

/** Sadece rakamlar — tel: ve kopyalama için E.164 tabanı. */
function onlyDigits(raw: string): string {
    return raw.replace(/\D/g, '');
}

/** Türkiye formatı görünüm: +90 5XX XXX XX XX (uymazsa ham + ile döner). */
function prettyPhone(digits: string): string {
    if (digits.length === 12 && digits.startsWith('90')) {
        const n = digits.slice(2); // 5XXXXXXXXX
        return `+90 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 8)} ${n.slice(8, 10)}`;
    }
    return `+${digits}`;
}

const CARD_WIDTH = 220;
const GAP = 8;

export function PhoneQrPopover({ phone, children }: PhoneQrPopoverProps) {
    const digits = onlyDigits(phone);
    const tel = `tel:+${digits}`;
    const pretty = prettyPhone(digits);

    const triggerRef = useRef<HTMLSpanElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [open, setOpen] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [copied, setCopied] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number; above: boolean }>({
        top: 0,
        left: 0,
        above: false,
    });

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
        const cardHeight = 280; // yaklaşık (numara + QR + ipucu)
        const spaceBelow = window.innerHeight - r.bottom;
        const above = spaceBelow < cardHeight + GAP && r.top > cardHeight + GAP;
        let left = r.left;
        // ekran sağ kenarına taşmasın
        if (left + CARD_WIDTH > window.innerWidth - GAP) {
            left = window.innerWidth - CARD_WIDTH - GAP;
        }
        if (left < GAP) left = GAP;
        const top = above ? r.top - GAP - cardHeight : r.bottom + GAP;
        setPos({ top, left, above });
    }, []);

    const doOpen = useCallback(() => {
        clearCloseTimer();
        computePosition();
        setOpen(true);
    }, [computePosition]);

    const scheduleClose = useCallback(() => {
        if (pinned) return;
        clearCloseTimer();
        closeTimer.current = setTimeout(() => setOpen(false), 150);
    }, [pinned]);

    const handleTriggerClick = (e: React.MouseEvent) => {
        // satırı açmasın / dnd tetiklemesin
        e.stopPropagation();
        if (pinned) {
            setPinned(false);
            setOpen(false);
        } else {
            setPinned(true);
            doOpen();
        }
    };

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(`+${digits}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* pano erişimi yoksa sessiz geç */
        }
    };

    // pinned iken: dışarı tıklama + Esc ile kapan; scroll/resize'da konumu güncelle
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

    return (
        <>
            <span
                ref={triggerRef}
                onMouseEnter={doOpen}
                onMouseLeave={scheduleClose}
                onClick={handleTriggerClick}
                className="inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-slate-600"
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
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-[15px] font-semibold tabular-nums text-slate-900">
                                <Phone size={14} className="shrink-0 text-emerald-600" />
                                {pretty}
                            </span>
                            <button
                                onClick={handleCopy}
                                title="Numarayı kopyala"
                                className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                            >
                                {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                            </button>
                        </div>

                        <div className="mt-3 flex justify-center rounded-lg bg-white">
                            <QRCodeSVG value={tel} size={160} level="M" marginSize={2} />
                        </div>

                        <p className="mt-2.5 text-center text-[11px] leading-snug text-slate-400">
                            Telefonun kamerasıyla tarat → arama ekranı açılır
                        </p>
                    </div>,
                    document.body,
                )}
        </>
    );
}
