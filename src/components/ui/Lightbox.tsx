import { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

// Ortak görsel büyütme katmanı — PortalService'teki ad-hoc overlay'in
// paylaşılan hâli (o dosyaya DOKUNULMADI: müşteri-facing, canlı leadler
// akarken sıfır-risk tercih edilir). ESC kapatır, ok tuşları gezer.

export interface LightboxItem {
    url: string;
    name?: string;
}

export function Lightbox({ items, index, onClose, onNavigate }: {
    items: LightboxItem[];
    index: number;
    onClose: () => void;
    onNavigate: (nextIndex: number) => void;
}) {
    const item = items[index];

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1);
            if (e.key === 'ArrowRight' && index < items.length - 1) onNavigate(index + 1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [index, items.length, onClose, onNavigate]);

    if (!item) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center" onClick={onClose}>
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10"
                aria-label="Kapat"
            >
                <X size={22} />
            </button>

            {items.length > 1 && (
                <p className="absolute top-5 left-1/2 -translate-x-1/2 text-white/60 text-[13px] font-semibold tabular-nums">
                    {index + 1} / {items.length}
                </p>
            )}

            {index > 0 && (
                <button
                    onClick={e => { e.stopPropagation(); onNavigate(index - 1); }}
                    className="absolute left-3 p-2.5 rounded-full text-white/70 hover:text-white hover:bg-white/10"
                    aria-label="Önceki"
                >
                    <ChevronLeft size={26} />
                </button>
            )}
            {index < items.length - 1 && (
                <button
                    onClick={e => { e.stopPropagation(); onNavigate(index + 1); }}
                    className="absolute right-3 p-2.5 rounded-full text-white/70 hover:text-white hover:bg-white/10"
                    aria-label="Sonraki"
                >
                    <ChevronRight size={26} />
                </button>
            )}

            <img
                src={item.url}
                alt={item.name || ''}
                onClick={e => e.stopPropagation()}
                className="max-w-[92vw] max-h-[88vh] object-contain rounded-lg"
            />
            {item.name && (
                <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-[12px] max-w-[80vw] truncate">
                    {item.name}
                </p>
            )}
        </div>
    );
}
