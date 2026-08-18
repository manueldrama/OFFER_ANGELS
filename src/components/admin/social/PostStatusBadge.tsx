import React from 'react';

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
    draft: { label: 'Taslak', bg: 'bg-slate-100', text: 'text-slate-600' },
    scheduled: { label: 'Zamanlandı', bg: 'bg-blue-50', text: 'text-blue-700' },
    publishing: { label: 'Yayınlanıyor', bg: 'bg-amber-50', text: 'text-amber-700' },
    published: { label: 'Yayında', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    failed: { label: 'Başarısız', bg: 'bg-red-50', text: 'text-red-700' },
    cancelled: { label: 'İptal', bg: 'bg-gray-100', text: 'text-gray-500' },
};

export default function PostStatusBadge({ status }: { status: string }) {
    const s = STATUS_MAP[status] || STATUS_MAP.draft;
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
            {s.label}
        </span>
    );
}
