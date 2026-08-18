import React from 'react';
import {
    Box, ShieldCheck, Truck, FileCheck, Verified, AlertTriangle,
    TrendingUp, Calculator, CreditCard, Banknote, Clock4,
    CheckCircle2, Check, Plus, Minus, Layers, ArrowLeftRight,
} from 'lucide-react';
import { Editable } from '../Editable';

// Visual language matches CustomerOffer.tsx as closely as possible while using
// mock data — primary red (#C41E2A) via `text-primary`/`bg-primary`, rounded-md,
// shadow-sm, font-extrabold + tabular-nums for numbers, slate-100/200 borders.
// All editable text wrapped in <Editable id="..." />.

type BlockProps = unknown;

// ─── Product card — mirrors CustomerOffer product card top section ────────
export function ProductBlock(_: BlockProps) {
    return (
        <div className="overflow-hidden rounded-md border border-slate-100 bg-white shadow-sm">
            <div className="flex gap-4 p-4">
                {/* Square product image — 96x96 like the real card */}
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md border border-slate-100 bg-slate-50 p-2">
                    <Box size={42} className="text-slate-300" strokeWidth={1.5} />
                </div>
                {/* Title + subtitle + description + tags */}
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                    <h3 className="truncate text-[16px] font-bold leading-tight tracking-tight text-slate-900">
                        <Editable id="product_name" />
                    </h3>
                    <p className="mt-1 text-[12px] font-medium leading-tight text-slate-400">
                        <Editable id="product_cat" />
                    </p>
                    <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                        <Editable id="product_seg" />
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        <Editable
                            id="tag1"
                            className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary"
                        />
                        <Editable
                            id="tag2"
                            className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Countdown — mirrors OfferCountdown band (label + 4 cells + capacity) ─
export function CountdownBlock(_: BlockProps) {
    const cells = [
        { v: '04', label: 'GÜN' },
        { v: '22', label: 'SAAT' },
        { v: '10', label: 'DAKİKA' },
        { v: '40', label: 'SANİYE' },
    ];
    return (
        <div className="rounded-md border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                <Editable id="countdown_label" />
            </div>
            <div className="mt-3 flex items-center gap-1.5">
                {cells.map((c, i) => (
                    <React.Fragment key={i}>
                        <div className="flex flex-col items-center">
                            <div className="grid h-[38px] w-[52px] place-items-center rounded-lg border border-slate-200 bg-gradient-to-b from-white to-slate-100 text-[18px] font-extrabold tabular-nums text-slate-800 shadow-[0_2px_4px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]">
                                {c.v}
                            </div>
                            <span className="mt-1 text-[8px] font-bold uppercase tracking-wide text-slate-400">{c.label}</span>
                        </div>
                        {i < cells.length - 1 && (
                            <span className="-mx-0.5 text-base font-bold text-slate-200">:</span>
                        )}
                    </React.Fragment>
                ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                        className="h-full rounded-full"
                        style={{ width: '30%', background: 'linear-gradient(90deg, #fca5a5 0%, #ef4444 45%, #b91c1c 100%)' }}
                    />
                </div>
                <Editable id="progress_label" className="whitespace-nowrap text-[10px] font-bold text-slate-500" />
            </div>
        </div>
    );
}

// ─── Price block — mirrors CustomerOffer card footer (bg-slate-50 + stepper + savings pill) ─
export function PriceBlock(_: BlockProps) {
    return (
        <div className="rounded-md border border-slate-100 bg-slate-50 px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                {/* Left: list price + qty stepper */}
                <div className="flex min-w-0 shrink flex-col justify-center">
                    <div className="mb-2">
                        <Editable id="list_price_label" className="mb-1 block text-[10px] font-semibold leading-none text-slate-400" />
                        <span className="text-[13px] font-semibold leading-none tabular-nums text-slate-400 line-through">
                            190.000 €
                        </span>
                    </div>
                    <div className="flex h-9 w-fit items-center gap-2 rounded-md border border-slate-200 bg-white px-1 py-0.5">
                        <button className="flex h-full w-8 items-center justify-center rounded-md bg-slate-50 text-slate-400">
                            <Minus size={11} strokeWidth={3} />
                        </button>
                        <span className="w-6 text-center text-xs font-bold tabular-nums text-slate-900">1</span>
                        <button className="flex h-full w-8 items-center justify-center rounded-md bg-primary/5 text-primary">
                            <Plus size={11} strokeWidth={3} />
                        </button>
                    </div>
                </div>
                {/* Right: launch price + savings pill */}
                <div className="flex min-w-0 shrink flex-col items-end justify-center text-right">
                    <Editable id="launch_price_label" className="mb-1 block text-[10px] font-bold leading-none text-primary" />
                    <span className="mb-2 whitespace-nowrap text-[22px] font-extrabold leading-none tracking-tight tabular-nums text-slate-900">
                        150.000 €
                    </span>
                    <span className="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-md border border-emerald-600/20 bg-emerald-600/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 shadow-sm">
                        <CheckCircle2 size={10} strokeWidth={3} className="shrink-0" />
                        <Editable id="savings_label" />
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── Suggestions — mirrors CustomerOffer "Birlikte Önerilenler" card ──────
export function SuggestionsBlock(_: BlockProps) {
    return (
        <div className="overflow-hidden rounded-md border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-2.5">
                <Editable id="suggestions_title" className="text-[12px] font-bold tracking-tight text-slate-700" />
                <Editable id="suggestions_action" className="text-[10px] font-bold text-primary" />
            </div>
            <div className="divide-y divide-slate-50">
                {[
                    { name: 'Bakım Paketi · 1 Yıl', price: '4.800 €' },
                    { name: 'Su Filtreleme Sistemi', price: '2.400 €' },
                ].map((it, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex flex-col">
                            <span className="text-[11px] font-bold leading-tight text-slate-700">{it.name}</span>
                            <span className="text-[10px] font-bold leading-tight text-slate-400">+{it.price}</span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-md border border-slate-100 bg-slate-50 p-0.5">
                            <button className="flex h-6 w-6 items-center justify-center rounded border border-slate-100 bg-white text-slate-400">
                                <Minus size={10} strokeWidth={3} />
                            </button>
                            <span className="w-4 text-center text-[11px] font-bold tabular-nums text-slate-800">0</span>
                            <button className="flex h-6 w-6 items-center justify-center rounded border border-slate-100 bg-white text-slate-400">
                                <Plus size={10} strokeWidth={3} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Totals — mirrors CustomerOffer summary card (rounded-t-[12px], border-t, neg shadow) ─
export function TotalsBlock(_: BlockProps) {
    return (
        <div className="space-y-3 rounded-t-[12px] border-t border-slate-100 bg-white p-5 shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center justify-between text-[13px] font-medium text-slate-400">
                <Editable id="subtotal_label" className="uppercase tracking-wider" />
                <span className="font-bold text-slate-900 tabular-nums">150.000 €</span>
            </div>
            <div className="flex items-center justify-between pb-1 text-[13px] font-medium text-slate-400">
                <Editable id="tax_label" className="uppercase tracking-wider" />
                <span className="font-bold text-slate-900 tabular-nums">28.500 €</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <Editable id="grand_label" className="text-[13px] font-bold uppercase tracking-widest text-slate-900" />
                <span className="text-lg font-extrabold tracking-tight tabular-nums text-slate-900">178.500 €</span>
            </div>
        </div>
    );
}

// ─── ROI banner — mirrors CustomerOffer roi block ─────────────────────────
export function RoiBlock(_: BlockProps) {
    return (
        <div className="rounded-md border border-slate-100 bg-slate-50 p-4 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-emerald-600">
                    <TrendingUp size={18} />
                </div>
                <div className="min-w-0 flex-1">
                    <Editable id="roi_title" className="block text-[13px] font-bold leading-tight text-slate-900" multiline />
                    <Editable id="roi_sub" className="mt-0.5 block text-[11px] font-medium leading-tight text-slate-400" multiline />
                </div>
                <button className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-3 py-2 text-[11px] font-bold text-slate-700 shadow-sm">
                    <Calculator size={13} className="text-primary" />
                    <Editable id="roi_cta" />
                </button>
            </div>
        </div>
    );
}

// ─── Warning strip — mirrors CustomerOffer loss framing ────────────────────
export function WarnBlock(_: BlockProps) {
    return (
        <div className="flex items-start gap-3 rounded-md border border-slate-100 bg-white p-4 shadow-sm">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-primary/10 bg-primary/5 text-primary">
                <AlertTriangle size={18} />
            </div>
            <div className="min-w-0 flex-1">
                <Editable id="warn_title" className="block text-[14px] font-bold leading-tight text-slate-900" multiline />
                <Editable id="warn_body" className="mt-1.5 block text-[11px] font-medium leading-relaxed text-slate-400" multiline />
            </div>
        </div>
    );
}

// ─── Payment / Reservation — mirrors CustomerOffer elevated-card UI ───────
// Selected option lifts (translateY-1) + primary border + shadow, others are
// plain bordered cards. No trailing CheckCircle — selection signaled by elevation.
export function PaymentBlock(_: BlockProps) {
    return (
        <div className="rounded-md border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 pb-3 pt-4">
                <Editable id="payment_title" className="text-[11px] font-bold uppercase tracking-wider text-slate-400" />
            </div>
            <div className="space-y-2 border-t border-slate-100 p-3">
                {/* Selected (elevated) — primary border, shadow, -translate-y-1 */}
                <div className="relative -translate-y-1 rounded-lg border border-slate-200 bg-white p-4 shadow-[0_14px_32px_-10px_rgba(15,23,42,0.20),0_4px_10px_-4px_rgba(15,23,42,0.10)]">
                    <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                            <CreditCard size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <Editable id="pay1_name" className="text-[14px] font-bold text-slate-900" />
                                <Editable id="recommended_badge" className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500" />
                            </div>
                            <Editable id="pay1_detail" className="mt-0.5 block text-[12px] font-medium text-slate-400" multiline />
                        </div>
                    </div>
                </div>
                {/* Other option — plain (dimmed in real UI when hasSelection) */}
                <div className="rounded-lg border border-slate-100 bg-white p-4 opacity-60">
                    <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-primary">
                            <CreditCard size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <Editable id="pay2_name" className="block text-[14px] font-bold text-slate-700" />
                            <Editable id="pay2_detail" className="mt-0.5 block text-[12px] font-medium text-slate-400" />
                        </div>
                        <div className="shrink-0 text-right">
                            <p className="text-[16px] font-bold tabular-nums text-slate-900">173.250 €</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Toplam</p>
                        </div>
                    </div>
                </div>
                {/* Installment */}
                <div className="rounded-lg border border-slate-100 bg-white p-4 opacity-60">
                    <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-indigo-600">
                            <Clock4 size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <Editable id="pay3_name" className="text-[14px] font-bold text-slate-700" />
                                <Editable id="pay3_tag" className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500" />
                            </div>
                            <Editable id="pay3_detail" className="mt-0.5 block text-[12px] font-medium text-slate-400" />
                        </div>
                        <div className="shrink-0 text-right">
                            <p className="text-[16px] font-bold tabular-nums text-slate-900">34.620 €</p>
                            <Editable id="pay3_amount_label" className="block text-[10px] font-bold uppercase tracking-wider text-slate-400" />
                        </div>
                    </div>
                </div>
                {/* Bank transfer */}
                <div className="rounded-lg border border-slate-100 bg-white p-4 opacity-60">
                    <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-emerald-600">
                            <Banknote size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <Editable id="pay4_name" className="block text-[14px] font-bold text-slate-700" />
                            <Editable id="pay4_detail" className="mt-0.5 block text-[12px] font-medium text-emerald-700" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Trust — mirrors CustomerOffer trust block (3-col + alt 2-col info row) ─
export function TrustBlock(_: BlockProps) {
    return (
        <div className="rounded-md border border-slate-100 bg-white p-3 shadow-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
                <div className="flex flex-col items-center gap-1">
                    <ShieldCheck size={15} className="text-emerald-500" />
                    <Editable id="trust1" className="text-[10px] font-bold uppercase leading-tight tracking-wider text-slate-500" />
                </div>
                <div className="flex flex-col items-center gap-1">
                    <FileCheck size={15} className="text-primary" />
                    <Editable id="trust2" className="text-[10px] font-bold uppercase leading-tight tracking-wider text-slate-500" />
                </div>
                <div className="flex flex-col items-center gap-1">
                    <Truck size={15} className="text-slate-400" />
                    <Editable id="trust3" className="text-[10px] font-bold uppercase leading-tight tracking-wider text-slate-500" />
                </div>
            </div>
        </div>
    );
}

// ─── Info strips — paired launch/delivery values ──────────────────────────
export function InfoStripsBlock(_: BlockProps) {
    return (
        <div className="rounded-md border border-slate-100 bg-white p-3 shadow-sm">
            <div className="grid grid-cols-2 divide-x divide-slate-100 text-center">
                <div className="py-0.5">
                    <Editable id="info1_label" className="block text-[9px] font-bold uppercase tracking-wider text-slate-400" />
                    <Editable id="info1_val" className="text-[11px] font-bold text-slate-700" />
                </div>
                <div className="py-0.5">
                    <Editable id="info2_label" className="block text-[9px] font-bold uppercase tracking-wider text-slate-400" />
                    <Editable id="info2_val" className="text-[11px] font-bold text-slate-700" />
                </div>
            </div>
        </div>
    );
}

// ─── Approved offer — verified header + 2-col customer/validity grid ──────
export function ApprovedBlock(_: BlockProps) {
    return (
        <div className="rounded-md border border-slate-100 bg-slate-50 p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    <Verified size={13} className="text-primary" />
                    <Editable id="approved_label" />
                </span>
                <span className="font-mono text-[11px] font-bold tracking-tight text-slate-500">
                    #CFP-2605-5726-292
                </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
                    <span className="block text-[13px] font-bold leading-tight text-slate-900">Ertuğrul Sağlık</span>
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">CAFEPASTE TEST</span>
                </div>
                <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
                    <Editable id="validity_label" className="mb-0.5 block text-[9px] font-bold uppercase tracking-widest text-slate-400" />
                    <span className="block text-[12px] font-bold uppercase leading-tight tabular-nums text-slate-900">
                        12 HAZ 2026
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── Consent — KVKK / GTC checkbox ─────────────────────────────────────────
export function ConsentBlock(_: BlockProps) {
    return (
        <div className="flex items-center gap-3 rounded-md border border-slate-100 bg-white p-4 shadow-sm">
            <div className="grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 border-primary bg-primary">
                <Check size={11} className="text-white" strokeWidth={3.5} />
            </div>
            <Editable id="consent_text" className="text-[12px] font-medium leading-relaxed text-slate-500" multiline />
        </div>
    );
}

// ─── Placeholder for library blocks ────────────────────────────────────────
export function PlaceholderBlock({ title, hint }: { title: string; hint: string }) {
    return (
        <div className="rounded-md border-2 border-dashed border-slate-200 bg-slate-50/60 p-5 text-center">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</div>
            <div className="mt-1 text-[11px] text-slate-400">{hint}</div>
            <div className="mt-3 inline-flex items-center gap-1 text-[10px] text-slate-400">
                <ArrowLeftRight size={11} /> Şablon — içerik şeması Faz 2'de gelecek
            </div>
        </div>
    );
}
