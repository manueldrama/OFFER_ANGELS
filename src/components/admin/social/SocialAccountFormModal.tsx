import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { SocialAccount } from '../../../services/admin/socialMediaService';

interface SocialAccountFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<SocialAccount>) => Promise<void>;
    editingAccount: SocialAccount | null;
}

const PLATFORM_OPTIONS = [
    { value: 'instagram', label: 'Instagram' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'twitter', label: 'X (Twitter)' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'tiktok', label: 'TikTok' },
];

const defaultForm = {
    platform: 'instagram',
    platform_account_name: '',
    platform_account_id: '',
    is_active: true,
};

export default function SocialAccountFormModal({ isOpen, onClose, onSave, editingAccount }: SocialAccountFormModalProps) {
    const [form, setForm] = useState(defaultForm);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        if (editingAccount) {
            setForm({
                platform: editingAccount.platform,
                platform_account_name: editingAccount.platform_account_name,
                platform_account_id: editingAccount.platform_account_id || '',
                is_active: editingAccount.is_active,
            });
        } else {
            setForm({ ...defaultForm });
        }
    }, [isOpen, editingAccount]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!form.platform_account_name.trim()) return;
        setIsSubmitting(true);
        try {
            await onSave(form);
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800">{editingAccount ? 'Hesap Düzenle' : 'Yeni Hesap Ekle'}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                        <X size={16} className="text-slate-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Platform</label>
                        <select
                            value={form.platform}
                            onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                        >
                            {PLATFORM_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Hesap Adı</label>
                        <input
                            type="text"
                            value={form.platform_account_name}
                            onChange={e => setForm(f => ({ ...f, platform_account_name: e.target.value }))}
                            placeholder="@cafepaste"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Platform ID (opsiyonel)</label>
                        <input
                            type="text"
                            value={form.platform_account_id}
                            onChange={e => setForm(f => ({ ...f, platform_account_id: e.target.value }))}
                            placeholder="Opsiyonel"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                        />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.is_active}
                            onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                        />
                        <span className="text-sm text-slate-700">Aktif</span>
                    </label>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer">
                        İptal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSubmitting || !form.platform_account_name.trim()}
                        className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50"
                    >
                        {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                </div>
            </div>
        </div>
    );
}
