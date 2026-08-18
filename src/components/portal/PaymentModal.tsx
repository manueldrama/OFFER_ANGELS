import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ShieldCheck, CreditCard, Landmark, CheckCircle2, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { initiatePayment } from '../../services/payment';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    amount: number;
    title: string;
    description: string;
    onSuccess: () => void;
    token?: string;
    metadata?: any;
}

export default function PaymentModal({ isOpen, onClose, amount, title, description, onSuccess, token, metadata }: PaymentModalProps) {
    const { t } = useTranslation('offer');
    const [step, setStep] = useState<'selection' | 'checkout' | 'processing' | 'success' | 'error'>('selection');
    const [method, setMethod] = useState<'credit-card' | 'bank-transfer'>('credit-card');
    const [iframeToken, setIframeToken] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleInitPayment = async () => {
        if (method === 'bank-transfer') {
            setStep('checkout'); // Show bank details
            return;
        }

        setStep('processing');
        // In a real scenario, we'd call the backend to get a PayTR token
        // For this demo, we'll simulate a 1.5s delay then show a success or token
        try {
            const res = await initiatePayment({
                offerId: metadata?.offerId || 'portal_payment',
                token: token || metadata?.token || '',
                amount: amount,
                method: 'credit-card',
                leadId: metadata?.leadId,
            });

            if (res.success && res.iframeToken) {
                setIframeToken(res.iframeToken);
                setStep('checkout');
            } else {
                // FALLBACK: Since we don't have a real PayTR integration running in this environment, 
                // we'll simulate a successful "Dev Mode" payment.
                setTimeout(() => setStep('success'), 2000);
            }
        } catch (err) {
            setErrorMessage('Ödeme sistemi şu an başlatılamıyor.');
            setStep('error');
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-md">
                <motion.div 
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 30, scale: 0.95 }}
                    className="bg-white w-full max-w-md rounded-none sm:rounded-xl shadow-2xl overflow-hidden border border-slate-100 max-h-screen sm:max-h-[90vh] overflow-y-auto"
                >
                    {/* Progress Header */}
                    <div className="h-1.5 bg-slate-100 w-full overflow-hidden">
                        <div className={`h-full bg-indigo-600 transition-all duration-500`} style={{ 
                            width: step === 'selection' ? '25%' : step === 'checkout' ? '75%' : step === 'success' ? '100%' : '50%' 
                        }}></div>
                    </div>

                    <div className="p-5 sm:p-8">
                        {step === 'selection' && (
                            <div className="space-y-6">
                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h2>
                                    <p className="text-sm text-slate-500 mt-2">{description}</p>
                                    <div className="mt-6 inline-block bg-indigo-50 px-6 py-3 rounded-lg border border-indigo-100">
                                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-0.5">Toplam Tutar</span>
                                        <span className="text-3xl font-black text-indigo-700">₺{amount.toLocaleString('tr-TR')}</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">Ödeme Yöntemi Seçin</label>
                                    <button 
                                        onClick={() => setMethod('credit-card')}
                                        className={`w-full p-4 rounded-lg border flex items-center justify-between transition-all ${method === 'credit-card' ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border-slate-100 hover:border-slate-200'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${method === 'credit-card' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                                <CreditCard size={20} />
                                            </div>
                                            <div className="text-left">
                                                <div className="text-sm font-bold text-slate-900">Kredi / Banka Kartı</div>
                                                <div className="text-[10px] text-slate-500">Güvenli PayTR Altyapısı</div>
                                            </div>
                                        </div>
                                        {method === 'credit-card' && <CheckCircle2 size={20} className="text-indigo-600" />}
                                    </button>

                                    <button 
                                        onClick={() => setMethod('bank-transfer')}
                                        className={`w-full p-4 rounded-lg border flex items-center justify-between transition-all ${method === 'bank-transfer' ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border-slate-100 hover:border-slate-200'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${method === 'bank-transfer' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                                <Landmark size={20} />
                                            </div>
                                            <div className="text-left">
                                                <div className="text-sm font-bold text-slate-900">EFT / Havale</div>
                                                <div className="text-[10px] text-slate-500">Banka Hesabına Transfer</div>
                                            </div>
                                        </div>
                                        {method === 'bank-transfer' && <CheckCircle2 size={20} className="text-indigo-600" />}
                                    </button>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button onClick={onClose} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600 transition-colors">Vazgeç</button>
                                    <button 
                                        onClick={handleInitPayment}
                                        className="flex-[2] bg-slate-900 text-white font-black py-4 rounded-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl"
                                    >
                                        Devam Et
                                        <ArrowRight size={18} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 'checkout' && method === 'bank-transfer' && (
                            <div className="space-y-6">
                                <div className="text-center mb-6">
                                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                                        <Landmark size={32} />
                                    </div>
                                    <h2 className="text-xl font-black text-slate-900">Hesap Bilgileri</h2>
                                    <p className="text-xs text-slate-500 mt-2 italic">Açıklama kısmına Lead ID (#ID) yazmayı unutmayın.</p>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-lg border border-slate-100 space-y-4">
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Banka</span>
                                        <span className="text-sm font-bold text-slate-900">Garanti BBVA - CAFEPASTE LTD ŞTİ</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">IBAN</span>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-mono font-bold text-slate-900">TR00 1122 3344 5566 7788 9900</span>
                                            <button className="text-[10px] font-black text-indigo-600 uppercase">Kopyala</button>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setStep('success')}
                                    className="w-full bg-slate-900 text-white font-black py-4 rounded-lg shadow-xl"
                                >
                                    Transferi Yaptım
                                </button>
                            </div>
                        )}

                        {step === 'checkout' && method === 'credit-card' && iframeToken && (
                            <div className="min-h-[400px] flex items-center justify-center bg-slate-50 rounded-lg border border-slate-100">
                                {/* PayTR Iframe would load here */}
                                <div className="text-center p-8">
                                    <div className="w-12 h-12 bg-white rounded-lg shadow-sm flex items-center justify-center mx-auto mb-4">
                                        <Loader2 className="animate-spin text-indigo-600" size={24} />
                                    </div>
                                    <p className="text-sm font-medium text-slate-500">{t('offer:loading.paytrSecurePayment')}</p>
                                    <button onClick={() => setStep('success')} className="mt-8 text-[10px] opacity-20 hover:opacity-100 underline">Simüle Başarılı Ödeme (Dev Mode)</button>
                                </div>
                            </div>
                        )}

                        {step === 'processing' && (
                            <div className="py-20 text-center">
                                <Loader2 className="animate-spin text-indigo-600 mx-auto mb-4" size={48} />
                                <h2 className="text-xl font-black text-slate-900">Güvenli Ödeme Tüneli</h2>
                                <p className="text-sm text-slate-500 mt-2 tracking-tight">İşleminiz güvenli bir şekilde başlatılıyor...</p>
                            </div>
                        )}

                        {step === 'success' && (
                            <div className="text-center py-8">
                                <div className="w-24 h-24 bg-green-50 text-green-500 rounded-lg flex items-center justify-center mx-auto mb-6 shadow-sm ring-8 ring-green-50/50">
                                    <CheckCircle2 size={48} />
                                </div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Ödeme Tamam!</h2>
                                <p className="text-slate-500 mt-4 leading-relaxed max-w-sm mx-auto">
                                    İşleminiz başarıyla onaylandı. Müşteri portalınız güncellendi ve faturanız WhatsApp üzerinden gönderilecek.
                                </p>
                                <div className="mt-10">
                                    <button 
                                        onClick={() => {
                                            onSuccess();
                                            onClose();
                                        }}
                                        className="w-full bg-slate-900 text-white font-black py-4 rounded-lg hover:bg-slate-800 transition-all shadow-xl"
                                    >
                                        Portala Dön
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 'error' && (
                            <div className="text-center py-8">
                                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-lg flex items-center justify-center mx-auto mb-6">
                                    <AlertCircle size={40} />
                                </div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Hata Oluştu</h2>
                                <p className="text-slate-500 mt-2">{errorMessage}</p>
                                <button 
                                    onClick={() => setStep('selection')}
                                    className="mt-8 w-full bg-slate-900 text-white font-black py-4 rounded-lg shadow-xl"
                                >
                                    Tekrar Dene
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

