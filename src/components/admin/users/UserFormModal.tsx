import React, { useEffect, useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { SalesUser } from '../../../services/admin/usersService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    initialData?: SalesUser | null;
    onSave: (data: { full_name: string; email: string; role: string; is_active: boolean; password?: string; ai_intro?: string }) => Promise<void>;
}

export const UserFormModal: React.FC<Props> = ({ isOpen, onClose, initialData, onSave }) => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('sales_admin');
    const [isActive, setIsActive] = useState(true);
    const [password, setPassword] = useState('');
    const [aiIntro, setAiIntro] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (initialData) {
            setFullName(initialData.full_name || '');
            setEmail(initialData.email || '');
            setRole(initialData.role);
            setIsActive(initialData.is_active);
            setAiIntro((initialData as any).ai_intro || '');
        } else {
            setFullName('');
            setEmail('');
            setRole('sales_admin');
            setIsActive(true);
            setPassword('');
            setAiIntro('');
        }
        setError('');
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim() || !email.trim()) {
            setError('Ad ve e-posta zorunludur.');
            return;
        }
        if (!initialData && password.length < 8) {
            setError('Şifre en az 8 karakter olmalıdır.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await onSave({ full_name: fullName.trim(), email: email.trim(), role, is_active: isActive, password: password || undefined, ai_intro: aiIntro || undefined });
            onClose();
        } catch (err: any) {
            setError(err.message || 'Bir hata oluştu.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">
                        {initialData ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı Ekle'}
                    </h3>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Ad Soyad</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            placeholder="Ahmet Yılmaz"
                            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="ahmet@sirket.com"
                            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                        <select
                            value={role}
                            onChange={e => setRole(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        >
                            <option value="sales_admin">Satış Temsilcisi</option>
                            <option value="support_admin">Servis / Operasyon</option>
                            <option value="technician">Teknisyen</option>
                            <option value="logistics">Lojistik</option>
                            <option value="finance">Finans</option>
                            <option value="super_admin">Süper Admin</option>
                            {/* Personel: admin paneline GIRMEZ, yalniz /team portalini
                                kullanir. Yetkisi role_permissions'ta bos dizidir. */}
                            <option value="employee">Personel (yalnız /team portalı)</option>
                        </select>
                        {role === 'employee' && (
                            <p className="mt-1.5 text-xs text-slate-500">
                                Bu kullanıcı yönetim paneline giremez; giriş yaptığında
                                doğrudan personel portalına (<code>/team</code>) yönlendirilir.
                            </p>
                        )}
                    </div>

                    {/* Password — only for new users */}
                    {!initialData && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Giriş Şifresi</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="En az 8 karakter"
                                    className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(p => !p)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">Temsilci bu şifreyle sisteme giriş yapacak.</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">AI Tanıtım Metni <span className="text-slate-400 font-normal">(opsiyonel)</span></label>
                        <textarea
                            rows={2}
                            value={aiIntro}
                            onChange={e => setAiIntro(e.target.value)}
                            placeholder="Merhaba! Ben Ahmet, kurumsal satış uzmanıyım..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">AI otomatik cevaplamada bu temsilcinin kimliğini tanıtmak için kullanılır.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="is_active"
                            checked={isActive}
                            onChange={e => setIsActive(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <label htmlFor="is_active" className="text-sm font-medium text-slate-700 cursor-pointer">
                            Aktif (Lead atamasına dahil et)
                        </label>
                    </div>

                    {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Kaydediliyor...' : 'Kaydet'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
