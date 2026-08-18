import React from 'react';
import {
    Zap, MessageSquare, Image, MousePointer2, LayoutGrid,
    Clock, GitBranch, Dice5, Tag, Globe
} from 'lucide-react';
import type { FlowNodeType } from '../../../types/chatbot';

interface PaletteItem {
    type: FlowNodeType;
    label: string;
    icon: any;
    color: string;
    group: string;
}

const PALETTE_ITEMS: PaletteItem[] = [
    // Tetikleyiciler
    { type: 'trigger', label: 'Tetikleyici', icon: Zap, color: 'bg-green-500', group: 'Tetikleyici' },
    // Aksiyon
    { type: 'sendMessage', label: 'Mesaj Gönder', icon: MessageSquare, color: 'bg-blue-500', group: 'Aksiyonlar' },
    { type: 'sendImage', label: 'Görsel Gönder', icon: Image, color: 'bg-indigo-500', group: 'Aksiyonlar' },
    { type: 'sendButton', label: 'Butonlu Mesaj', icon: MousePointer2, color: 'bg-cyan-500', group: 'Aksiyonlar' },
    { type: 'sendCarousel', label: 'Carousel', icon: LayoutGrid, color: 'bg-violet-500', group: 'Aksiyonlar' },
    // Mantık
    { type: 'delay', label: 'Bekleme', icon: Clock, color: 'bg-amber-500', group: 'Mantık' },
    { type: 'condition', label: 'Koşul (If/Else)', icon: GitBranch, color: 'bg-orange-500', group: 'Mantık' },
    { type: 'randomSplit', label: 'Rastgele Dağılım', icon: Dice5, color: 'bg-pink-500', group: 'Mantık' },
    // İşlem
    { type: 'tagSubscriber', label: 'Etiket Ekle/Çıkar', icon: Tag, color: 'bg-teal-500', group: 'İşlemler' },
    { type: 'httpRequest', label: 'HTTP İsteği', icon: Globe, color: 'bg-slate-600', group: 'İşlemler' },
];

interface NodePaletteProps {
    onDragStart: (type: FlowNodeType, defaultData: Record<string, any>) => void;
}

const DEFAULT_DATA: Record<FlowNodeType, Record<string, any>> = {
    trigger: { nodeType: 'trigger', label: 'Tetikleyici', triggerType: 'keyword', keywords: [], matchType: 'contains' },
    sendMessage: { nodeType: 'sendMessage', label: 'Mesaj Gönder', message: '' },
    sendImage: { nodeType: 'sendImage', label: 'Görsel Gönder', imageUrl: '', caption: '' },
    sendButton: { nodeType: 'sendButton', label: 'Butonlu Mesaj', message: '', buttons: [{ id: 'btn_1', title: 'Buton 1' }] },
    sendCarousel: { nodeType: 'sendCarousel', label: 'Carousel', elements: [{ title: 'Kart 1' }] },
    delay: { nodeType: 'delay', label: 'Bekleme', duration: 5, unit: 'minutes' },
    condition: { nodeType: 'condition', label: 'Koşul', field: 'last_input', operator: 'contains', value: '' },
    randomSplit: { nodeType: 'randomSplit', label: 'A/B Test', splits: [{ id: 'a', percentage: 50, label: 'A' }, { id: 'b', percentage: 50, label: 'B' }] },
    tagSubscriber: { nodeType: 'tagSubscriber', label: 'Etiket Ekle', action: 'add', tags: [] },
    httpRequest: { nodeType: 'httpRequest', label: 'API Çağrısı', method: 'POST', url: '', headers: {}, body: '' },
};

export default function NodePalette({ onDragStart }: NodePaletteProps) {
    const groups = [...new Set(PALETTE_ITEMS.map(i => i.group))];

    return (
        <div className="w-56 bg-white border-r border-slate-200 overflow-y-auto p-3 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Node Ekle</h3>
            {groups.map(group => (
                <div key={group}>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{group}</p>
                    <div className="space-y-1">
                        {PALETTE_ITEMS.filter(i => i.group === group).map(item => (
                            <div
                                key={item.type}
                                draggable
                                onDragStart={e => {
                                    e.dataTransfer.setData('application/chatbot-node', JSON.stringify({ type: item.type, data: DEFAULT_DATA[item.type] }));
                                    e.dataTransfer.effectAllowed = 'move';
                                    onDragStart(item.type, DEFAULT_DATA[item.type]);
                                }}
                                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
                            >
                                <div className={`p-1.5 rounded-md ${item.color}`}>
                                    <item.icon className="w-3.5 h-3.5 text-white" />
                                </div>
                                <span className="text-xs font-medium text-slate-700">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
