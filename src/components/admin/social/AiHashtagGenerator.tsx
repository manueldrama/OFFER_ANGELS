import React, { useState } from 'react';
import { Sparkles, Loader2, Plus, RotateCw } from 'lucide-react';
import { SocialMediaAiService } from '../../../services/admin/socialMediaAiService';

interface AiHashtagGeneratorProps {
    caption: string;
    platform: string;
    currentHashtags: string[];
    onAdd: (hashtags: string[]) => void;
    language?: string;
}

export default function AiHashtagGenerator({ caption, platform, currentHashtags, onAdd, language }: AiHashtagGeneratorProps) {
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [error, setError] = useState('');
    const [topicMode, setTopicMode] = useState(false);
    const [topic, setTopic] = useState('');

    const generate = async () => {
        const text = topicMode ? topic.trim() : caption.trim();
        if (!text) {
            setError(topicMode ? 'Bir konu girin.' : 'Önce bir paylaşım metni yazın.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const tags = await SocialMediaAiService.generateHashtags({
                caption: text,
                platform: platform || 'instagram',
                language,
            });
            const filtered = tags.filter(t => !currentHashtags.includes(t));
            setSuggestions(filtered);
            setSelected(new Set(filtered));
        } catch (e: any) {
            setError(e.message || 'Hashtag oluşturulamadı.');
        } finally {
            setLoading(false);
        }
    };

    const toggleTag = (tag: string) => {
        const next = new Set(selected);
        next.has(tag) ? next.delete(tag) : next.add(tag);
        setSelected(next);
    };

    const addSelected = () => {
        onAdd(Array.from(selected));
        setSuggestions([]);
        setSelected(new Set());
    };

    return (
        <div className="space-y-2.5">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={generate}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                    {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    AI Hashtag Öner
                </button>
                {!caption.trim() && (
                    <button
                        type="button"
                        onClick={() => setTopicMode(!topicMode)}
                        className={`text-[10px] font-medium px-2 py-1 rounded-md transition-colors cursor-pointer ${
                            topicMode ? 'bg-violet-100 text-violet-700' : 'bg-slate-50 text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        {topicMode ? 'Konu modunda' : 'Konu ile oluştur'}
                    </button>
                )}
                {suggestions.length > 0 && (
                    <span className="text-[10px] font-medium text-slate-400">{suggestions.length} öneri</span>
                )}
            </div>

            {/* Topic input when caption is empty */}
            {topicMode && !caption.trim() && (
                <input
                    type="text"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), generate())}
                    placeholder="Konu girin: ör. kahve makinesi bakımı"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-violet-200 focus:ring-2 focus:ring-violet-200 outline-none bg-violet-50/50"
                />
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}

            {suggestions.length > 0 && (
                <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                        {suggestions.map(tag => (
                            <button
                                key={tag}
                                type="button"
                                onClick={() => toggleTag(tag)}
                                className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                                    selected.has(tag)
                                        ? 'bg-violet-100 text-violet-800 border border-violet-300'
                                        : 'bg-slate-100 text-slate-400 border border-slate-200 line-through'
                                }`}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={addSelected}
                            disabled={selected.size === 0}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors cursor-pointer disabled:opacity-50"
                        >
                            <Plus size={12} />
                            Ekle ({selected.size})
                        </button>
                        <button
                            type="button"
                            onClick={generate}
                            disabled={loading}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                        >
                            <RotateCw size={12} />
                            Yeniden
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
