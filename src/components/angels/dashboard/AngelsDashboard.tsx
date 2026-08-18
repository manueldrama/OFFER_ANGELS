// CAFEPASTE Angels — login'li panel (venue + creator) ortak kabuğu ve
// dark dashboard primitifleri. Onaylı Angels görsel dili AYNEN devam eder:
// #0C0C0C zemin, #171717 yüzeyler, ince #262626 kenarlar, tek kırmızı ana CTA,
// altın YALNIZCA wordmark'ta. SaaS/panel kalıbı değil, "private desk" hissi.

import React, { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Search, MessageSquare, FolderCheck, CreditCard, Settings,
    User, Inbox, FileText, Sparkles, Wallet, LogOut, Menu, X, ChevronDown,
} from 'lucide-react';
import { A, FONT_BODY, AngelsKeyframes, useAngelsFonts, AngelsWordmark } from '../AngelsShell';
import { useAngelsAuth } from '../AngelsAuthProvider';
import { creatorDisplayName } from '../../../types/angelsPlatform';
import type {
    PlatformRequestStatus, ProposalStatus, ProjectStatus,
    PaymentStatus, PayoutStatus, PromotionStatus,
} from '../../../types/angelsPlatform';

// ─────────────────────────────────────────────────────────────────────────────
// Navigasyon
// ─────────────────────────────────────────────────────────────────────────────
interface NavItem { to: string; end?: boolean; icon: React.ComponentType<{ size?: number | string }>; label: string }

const VENUE_NAV: NavItem[] = [
    { to: '/venue', end: true, icon: LayoutDashboard, label: 'Overview' },
    { to: '/venue/discover', icon: Search, label: 'Discover Creators' },
    { to: '/venue/requests', icon: MessageSquare, label: 'Requests & Proposals' },
    { to: '/venue/projects', icon: FolderCheck, label: 'Projects' },
    { to: '/venue/payments', icon: CreditCard, label: 'Payments' },
    { to: '/venue/settings', icon: Settings, label: 'Settings' },
];

const CREATOR_NAV: NavItem[] = [
    { to: '/creator', end: true, icon: LayoutDashboard, label: 'Overview' },
    { to: '/creator/profile', icon: User, label: 'My Profile' },
    { to: '/creator/requests', icon: Inbox, label: 'Requests' },
    { to: '/creator/proposals', icon: FileText, label: 'Proposals' },
    { to: '/creator/projects', icon: FolderCheck, label: 'Projects' },
    { to: '/creator/payments', icon: Wallet, label: 'Payouts' },
    { to: '/creator/spotlight', icon: Sparkles, label: 'Angels Spotlight' },
];

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
    return (
        <nav className="flex flex-col gap-1">
            {items.map(item => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className="group flex items-center gap-3 rounded-lg px-3.5 py-2.5 transition-colors"
                    style={({ isActive }) => ({
                        color: isActive ? A.text : A.textSecondary,
                        background: isActive ? A.surfaceElevated : 'transparent',
                        borderLeft: `2px solid ${isActive ? A.red : 'transparent'}`,
                        fontSize: 14,
                        fontWeight: isActive ? 600 : 500,
                    })}
                >
                    <item.icon size={17} />
                    {item.label}
                </NavLink>
            ))}
        </nav>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell
// ─────────────────────────────────────────────────────────────────────────────
export function AngelsDashboardShell({
    area,
    children,
}: {
    area: 'venue' | 'creator';
    children: React.ReactNode;
}) {
    useAngelsFonts();
    const navigate = useNavigate();
    const {
        account, signOut, venueMemberships, creatorMemberships,
        activeCreatorId, setActiveCreatorId,
    } = useAngelsAuth();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [switcherOpen, setSwitcherOpen] = useState(false);

    const items = area === 'venue' ? VENUE_NAV : CREATOR_NAV;
    const contextName = useMemo(() => {
        if (area === 'venue') return venueMemberships[0]?.venue?.name || account?.email || '';
        const active = creatorMemberships.find(m => m.creator_id === activeCreatorId) || creatorMemberships[0];
        return creatorDisplayName(active?.creator) || account?.email || '';
    }, [area, venueMemberships, creatorMemberships, activeCreatorId, account]);

    const isManager = area === 'creator' && creatorMemberships.length > 1;

    async function handleSignOut() {
        await signOut();
        navigate('/login', { replace: true });
    }

    const sidebar = (
        <div className="flex flex-col h-full">
            <div className="px-4 pt-6 pb-7">
                <a href="/" className="block w-[150px]">
                    <AngelsWordmark size="sm" className="w-full h-auto" />
                </a>
                <p
                    className="mt-1.5"
                    style={{
                        color: A.textGhost, fontSize: 8.5, letterSpacing: '0.2em',
                        textTransform: 'uppercase', fontWeight: 600,
                    }}
                >
                    A Private Creator Network
                </p>
            </div>
            <div className="px-3 flex-1 overflow-y-auto">
                <NavList items={items} onNavigate={() => setDrawerOpen(false)} />
            </div>
            <div className="px-3 pb-5 pt-4" style={{ borderTop: `1px solid ${A.border}` }}>
                {isManager && (
                    <div className="relative mb-2">
                        <button
                            onClick={() => setSwitcherOpen(o => !o)}
                            className="w-full flex items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 cursor-pointer"
                            style={{ background: A.surface, border: `1px solid ${A.border}`, color: A.textSecondary, fontSize: 13 }}
                        >
                            <span className="truncate">{contextName}</span>
                            <ChevronDown size={15} />
                        </button>
                        {switcherOpen && (
                            <div
                                className="absolute bottom-full mb-2 left-0 right-0 rounded-lg overflow-hidden z-20"
                                style={{ background: A.surfaceElevated, border: `1px solid ${A.borderStrong}` }}
                            >
                                {creatorMemberships.map(m => (
                                    <button
                                        key={m.creator_id}
                                        onClick={() => { setActiveCreatorId(m.creator_id); setSwitcherOpen(false); }}
                                        className="w-full text-left px-3.5 py-2.5 cursor-pointer"
                                        style={{
                                            color: m.creator_id === activeCreatorId ? A.text : A.textSecondary,
                                            fontSize: 13,
                                            fontWeight: m.creator_id === activeCreatorId ? 600 : 400,
                                            background: 'transparent',
                                            border: 'none',
                                        }}
                                    >
                                        {creatorDisplayName(m.creator)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                <div className="flex items-center justify-between gap-2 px-1">
                    <div className="min-w-0">
                        <p className="truncate" style={{ color: A.text, fontSize: 13, fontWeight: 600 }}>{contextName}</p>
                        <p className="truncate" style={{ color: A.textGhost, fontSize: 11.5 }}>{account?.email}</p>
                    </div>
                    <button
                        onClick={() => { void handleSignOut(); }}
                        title="Sign out"
                        className="p-2 rounded-lg cursor-pointer shrink-0"
                        style={{ color: A.textMuted, background: 'transparent', border: 'none' }}
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div
            className="angels-shell min-h-[100dvh] w-full"
            style={{ background: A.bg, color: A.text, fontFamily: FONT_BODY }}
        >
            <AngelsKeyframes />

            {/* Masaüstü sidebar */}
            <aside
                className="hidden lg:flex fixed inset-y-0 left-0 w-[248px] flex-col z-30"
                style={{ background: '#101010', borderRight: `1px solid ${A.border}` }}
            >
                {sidebar}
            </aside>

            {/* Mobil üst bar */}
            <header
                className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3"
                style={{
                    background: 'rgba(12,12,12,0.85)',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)',
                    borderBottom: `1px solid ${A.border}`,
                }}
            >
                <a href="/" className="block w-[130px]">
                    <AngelsWordmark size="sm" className="w-full h-auto" />
                </a>
                <button
                    onClick={() => setDrawerOpen(true)}
                    className="p-2 rounded-lg cursor-pointer"
                    style={{ color: A.text, background: 'transparent', border: `1px solid ${A.border}` }}
                >
                    <Menu size={18} />
                </button>
            </header>

            {/* Mobil drawer */}
            {drawerOpen && (
                <div className="lg:hidden fixed inset-0 z-50 flex">
                    <div
                        className="flex-1"
                        style={{ background: 'rgba(0,0,0,0.6)' }}
                        onClick={() => setDrawerOpen(false)}
                    />
                    <div
                        className="w-[276px] h-full relative"
                        style={{ background: '#101010', borderLeft: `1px solid ${A.border}` }}
                    >
                        <button
                            onClick={() => setDrawerOpen(false)}
                            className="absolute top-4 right-4 p-1.5 rounded-lg cursor-pointer z-10"
                            style={{ color: A.textMuted, background: 'transparent', border: 'none' }}
                        >
                            <X size={18} />
                        </button>
                        {sidebar}
                    </div>
                </div>
            )}

            {/* İçerik */}
            <main className="lg:pl-[248px]">
                <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-7 py-7 sm:py-10">
                    {children}
                </div>
            </main>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sayfa başlığı
// ─────────────────────────────────────────────────────────────────────────────
export function AngelsPageHeader({
    eyebrow,
    title,
    description,
    action,
}: {
    eyebrow?: string;
    title: string;
    description?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
            <div>
                {eyebrow && (
                    <p style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.2em',
                        color: A.red, textTransform: 'uppercase', marginBottom: 8,
                    }}>
                        {eyebrow}
                    </p>
                )}
                <h1 style={{ color: A.text, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>
                    {title}
                </h1>
                {description && (
                    <p style={{ color: A.textSecondary, fontSize: 14, marginTop: 6, lineHeight: 1.6, maxWidth: 560 }}>
                        {description}
                    </p>
                )}
            </div>
            {action}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Kart + stat
// ─────────────────────────────────────────────────────────────────────────────
export function AngelsCard({
    children,
    className = '',
    padding = 'p-5 sm:p-6',
}: {
    children: React.ReactNode;
    className?: string;
    padding?: string;
}) {
    return (
        <div
            className={`rounded-xl ${padding} ${className}`}
            style={{ background: A.surface, border: `1px solid ${A.border}` }}
        >
            {children}
        </div>
    );
}

export function AngelsStatCard({
    label,
    value,
    hint,
    icon: Icon,
}: {
    label: string;
    value: React.ReactNode;
    hint?: string;
    icon?: React.ComponentType<{ size?: number | string; style?: React.CSSProperties }>;
}) {
    return (
        <div
            className="rounded-xl p-5"
            style={{ background: A.surface, border: `1px solid ${A.border}` }}
        >
            <div className="flex items-center justify-between mb-3">
                <p style={{
                    color: A.textMuted, fontSize: 11.5, fontWeight: 600,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                    {label}
                </p>
                {Icon && <Icon size={16} style={{ color: A.textGhost }} />}
            </div>
            <p style={{ color: A.text, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {value}
            </p>
            {hint && <p style={{ color: A.textGhost, fontSize: 12, marginTop: 8 }}>{hint}</p>}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tablo
// ─────────────────────────────────────────────────────────────────────────────
export function AngelsTable({
    headers,
    children,
}: {
    headers: (string | React.ReactNode)[];
    children: React.ReactNode;
}) {
    return (
        <div
            className="rounded-xl overflow-x-auto"
            style={{ background: A.surface, border: `1px solid ${A.border}` }}
        >
            <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 560 }}>
                <thead>
                    <tr style={{ borderBottom: `1px solid ${A.border}` }}>
                        {headers.map((h, i) => (
                            <th
                                key={i}
                                className="text-left px-4 py-3"
                                style={{
                                    color: A.textMuted, fontSize: 11, fontWeight: 600,
                                    letterSpacing: '0.08em', textTransform: 'uppercase',
                                }}
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>{children}</tbody>
            </table>
        </div>
    );
}

export function AngelsTr({
    children,
    onClick,
}: {
    children: React.ReactNode;
    onClick?: () => void;
}) {
    const [hover, setHover] = useState(false);
    return (
        <tr
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                borderBottom: `1px solid ${A.border}`,
                background: hover && onClick ? '#1d1d1d' : 'transparent',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'background 0.12s',
            }}
        >
            {children}
        </tr>
    );
}

export function AngelsTd({
    children,
    align = 'left',
    className = '',
}: {
    children: React.ReactNode;
    align?: 'left' | 'right';
    className?: string;
}) {
    return (
        <td
            className={`px-4 py-3.5 ${className}`}
            style={{ color: A.textSecondary, fontSize: 13.5, textAlign: align, whiteSpace: 'nowrap' }}
        >
            {children}
        </td>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Boş durum
// ─────────────────────────────────────────────────────────────────────────────
export function AngelsEmpty({
    icon: Icon,
    title,
    hint,
    action,
}: {
    icon?: React.ComponentType<{ size?: number | string; style?: React.CSSProperties }>;
    title: string;
    hint?: string;
    action?: React.ReactNode;
}) {
    return (
        <div
            className="rounded-xl flex flex-col items-center justify-center text-center px-6 py-14"
            style={{ background: A.surface, border: `1px dashed ${A.borderStrong}` }}
        >
            {Icon && <Icon size={26} style={{ color: A.textGhost, marginBottom: 14 }} />}
            <p style={{ color: A.text, fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{title}</p>
            {hint && <p style={{ color: A.textMuted, fontSize: 13.5, lineHeight: 1.6, maxWidth: 380 }}>{hint}</p>}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Durum çipleri — İngilizce etiket haritaları (portal tarafı)
// ─────────────────────────────────────────────────────────────────────────────
type ChipTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'gold';

const TONE_STYLES: Record<ChipTone, { bg: string; color: string; border: string }> = {
    neutral: { bg: 'rgba(163,163,163,0.10)', color: '#A3A3A3', border: 'rgba(163,163,163,0.25)' },
    info:    { bg: 'rgba(96,165,250,0.10)',  color: '#7FB4F5', border: 'rgba(96,165,250,0.25)' },
    warning: { bg: 'rgba(245,158,11,0.10)',  color: '#E8AE54', border: 'rgba(245,158,11,0.25)' },
    success: { bg: 'rgba(52,199,123,0.10)',  color: '#5BC48F', border: 'rgba(52,199,123,0.25)' },
    danger:  { bg: 'rgba(196,30,42,0.12)',   color: '#FF5A66', border: 'rgba(196,30,42,0.3)' },
    gold:    { bg: 'rgba(212,170,80,0.10)',  color: '#D8B65C', border: 'rgba(212,170,80,0.3)' },
};

export function AngelsChip({ tone = 'neutral', children }: { tone?: ChipTone; children: React.ReactNode }) {
    const s = TONE_STYLES[tone];
    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
            style={{
                background: s.bg, color: s.color, border: `1px solid ${s.border}`,
                fontSize: 11.5, fontWeight: 600, letterSpacing: '0.02em', whiteSpace: 'nowrap',
            }}
        >
            {children}
        </span>
    );
}

export const REQUEST_STATUS_CHIP: Record<PlatformRequestStatus, { label: string; tone: ChipTone }> = {
    draft: { label: 'Draft', tone: 'neutral' },
    request_sent: { label: 'Sent', tone: 'info' },
    admin_review: { label: 'In Review', tone: 'warning' },
    sent_to_creator: { label: 'With Creator', tone: 'info' },
    creator_reviewing: { label: 'Creator Reviewing', tone: 'info' },
    proposal_sent: { label: 'Proposal Received', tone: 'gold' },
    revision_requested: { label: 'Changes Requested', tone: 'warning' },
    declined: { label: 'Declined', tone: 'danger' },
    expired: { label: 'Expired', tone: 'neutral' },
    accepted: { label: 'Accepted', tone: 'success' },
};

export const PROPOSAL_STATUS_CHIP: Record<ProposalStatus, { label: string; tone: ChipTone }> = {
    draft: { label: 'Draft', tone: 'neutral' },
    sent: { label: 'Sent', tone: 'info' },
    viewed: { label: 'Viewed', tone: 'info' },
    revision_requested: { label: 'Changes Requested', tone: 'warning' },
    accepted: { label: 'Accepted', tone: 'success' },
    declined: { label: 'Declined', tone: 'danger' },
    expired: { label: 'Expired', tone: 'neutral' },
};

export const PROJECT_STATUS_CHIP: Record<ProjectStatus, { label: string; tone: ChipTone }> = {
    proposal_accepted: { label: 'Proposal Accepted', tone: 'info' },
    payment_pending: { label: 'Payment Pending', tone: 'warning' },
    payment_received: { label: 'Payment Received', tone: 'success' },
    confirmed: { label: 'Confirmed', tone: 'success' },
    scheduled: { label: 'Scheduled', tone: 'info' },
    in_progress: { label: 'In Progress', tone: 'info' },
    content_submitted: { label: 'Content Submitted', tone: 'gold' },
    under_review: { label: 'Under Review', tone: 'warning' },
    completed: { label: 'Completed', tone: 'success' },
    cancelled: { label: 'Cancelled', tone: 'danger' },
    disputed: { label: 'Disputed', tone: 'danger' },
};

export const PAYMENT_STATUS_CHIP: Record<PaymentStatus, { label: string; tone: ChipTone }> = {
    pending: { label: 'Pending', tone: 'warning' },
    paid: { label: 'Paid', tone: 'success' },
    failed: { label: 'Failed', tone: 'danger' },
    refunded: { label: 'Refunded', tone: 'neutral' },
    partially_refunded: { label: 'Partially Refunded', tone: 'neutral' },
};

export const PAYOUT_STATUS_CHIP: Record<PayoutStatus, { label: string; tone: ChipTone }> = {
    pending: { label: 'Pending', tone: 'warning' },
    ready: { label: 'Ready', tone: 'info' },
    sent: { label: 'Sent', tone: 'success' },
    failed: { label: 'Failed', tone: 'danger' },
    cancelled: { label: 'Cancelled', tone: 'neutral' },
};

export const PROMOTION_STATUS_CHIP: Record<PromotionStatus, { label: string; tone: ChipTone }> = {
    draft: { label: 'Draft', tone: 'neutral' },
    pending_payment: { label: 'Payment Pending', tone: 'warning' },
    paid: { label: 'Paid', tone: 'info' },
    pending_admin_review: { label: 'In Review', tone: 'warning' },
    scheduled: { label: 'Scheduled', tone: 'info' },
    active: { label: 'Active', tone: 'success' },
    paused: { label: 'Paused', tone: 'neutral' },
    completed: { label: 'Completed', tone: 'neutral' },
    rejected: { label: 'Rejected', tone: 'danger' },
    refunded: { label: 'Refunded', tone: 'neutral' },
};
