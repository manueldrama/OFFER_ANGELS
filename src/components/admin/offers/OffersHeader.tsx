import React from 'react';
import { Link2, Plus, Sparkles } from 'lucide-react';

interface OffersHeaderProps {
    onCreate: () => void;
    /** Tüm aktif leadleri AI ile skorla (durumları otomatik sınıflandırır). */
    onScoreAll: () => void;
    /** Toplu skorlama sürüyor mu. */
    scoringAll?: boolean;
}

/** Sayfa başlığı — ikon, başlık, factual alt başlık ve birincil aksiyon. */
export const OffersHeader: React.FC<OffersHeaderProps> = ({ onCreate, onScoreAll, scoringAll }) => (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm shadow-indigo-200">
                <Link2 className="text-white" size={22} />
            </div>
            <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Teklif Linkleri</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                    Müşterilere gönderilen teklif linklerini izleyin, takip edin ve yönetin.
                </p>
            </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
            <button
                onClick={onScoreAll}
                disabled={scoringAll}
                title="Tüm aktif leadleri AI ile skorla — durumları otomatik sınıflandırır"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-slate-700 text-sm font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-60"
            >
                {scoringAll
                    ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                    : <Sparkles size={16} className="text-indigo-600" />}
                {scoringAll ? 'Skorlanıyor…' : 'Tümünü Skorla'}
            </button>
            <button
                onClick={onCreate}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
            >
                <Plus size={16} />
                Yeni Teklif Linki
            </button>
        </div>
    </div>
);
