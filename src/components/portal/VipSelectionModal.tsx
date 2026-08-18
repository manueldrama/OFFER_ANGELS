import React from 'react';
import { X, ShieldCheck, Zap, Clock, Truck, Check, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VipSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (amount: number, packageType: string) => void;
}

export default function VipSelectionModal({ isOpen, onClose, onSelect }: VipSelectionModalProps) {
    const pkg = {
        name: 'VIP Servis Önceliği',
        price: 2499,
        period: 'Yıllık',
        features: [
            { icon: <Zap size={18} />, text: '7/24 Öncelikli Teknik Destek' },
            { icon: <Clock size={18} />, text: 'Aynı Gün Servis Garantisi' },
            { icon: <Truck size={18} />, text: 'Ücretsiz Express Kargo' },
            { icon: <Star size={18} />, text: '%15 Sarf Malzeme İndirimi' },
            { icon: <ShieldCheck size={18} />, text: 'Yıllık Ücretsiz Bakım' }
        ]
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/40 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white w-full max-w-lg rounded-none sm:rounded-xl shadow-2xl overflow-hidden border border-slate-100 max-h-screen sm:max-h-[90vh] overflow-y-auto"
                >
                    <div className="relative p-5 sm:p-8">
                        {/* Decorative Background */}
                        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl"></div>
                        
                        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-slate-50 rounded-full transition-colors z-10">
                            <X size={20} className="text-slate-400" />
                        </button>

                        <div className="text-center mb-10">
                            <div className="w-20 h-20 bg-indigo-600 text-white rounded-lg flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-600/20 ring-8 ring-indigo-50">
                                <ShieldCheck size={40} />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{pkg.name}</h2>
                            <p className="text-slate-500 mt-2 font-medium">Cihazınız her zaman çalışır durumda kalsın.</p>
                        </div>

                        <div className="space-y-4 mb-10">
                            {pkg.features.map((feature, i) => (
                                <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100 hover:border-indigo-100 hover:bg-white transition-all group">
                                    <div className="w-10 h-10 bg-white text-indigo-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                        {feature.icon}
                                    </div>
                                    <span className="text-sm font-bold text-slate-700">{feature.text}</span>
                                    <Check size={16} className="ml-auto text-green-500" />
                                </div>
                            ))}
                        </div>

                        <div className="bg-slate-900 rounded-lg p-8 text-white text-center relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="flex items-baseline justify-center gap-1 mb-6">
                                    <span className="text-sm font-bold opacity-60">₺</span>
                                    <span className="text-5xl font-black tracking-tighter">{pkg.price.toLocaleString('tr-TR')}</span>
                                    <span className="text-sm font-bold opacity-60">/ {pkg.period}</span>
                                </div>
                                <button 
                                    onClick={() => onSelect(pkg.price, 'vip_priority')}
                                    className="w-full bg-white text-slate-900 font-black py-4 rounded-lg hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 shadow-xl active:scale-[0.98]"
                                >
                                    Hemen VIP Ol
                                    <Zap size={18} className="text-indigo-600 fill-indigo-600" />
                                </button>
                                <p className="text-[10px] text-slate-500 font-bold uppercase mt-4 tracking-widest">GÜVENLİ ÖDEME %100 GARANTİ</p>
                            </div>
                            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl"></div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
