import React, { useEffect, useRef, useState } from 'react';
import { X, Upload, FolderOpen, Link2, Search, RefreshCw, Loader2, Check, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import { LandingPageCmsService } from '../../services/admin/landingPageCmsService';

type Tab = 'upload' | 'gallery' | 'url';
type MediaFilter = 'all' | 'image' | 'video';

interface MediaItem {
    name: string;
    url: string;
    created_at: string;
    kind: 'image' | 'video';
}

interface Props {
    open: boolean;
    initialUrl?: string | null;
    acceptVideo?: boolean;
    onClose: () => void;
    onSelect: (url: string) => void;
}

export function LandingImagePickerModal({ open, initialUrl, acceptVideo, onClose, onSelect }: Props) {
    const [activeTab, setActiveTab] = useState<Tab>('upload');
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Gallery state
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [galleryLoading, setGalleryLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<MediaFilter>(acceptVideo ? 'all' : 'image');
    const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

    // URL tab state
    const [urlInput, setUrlInput] = useState(initialUrl || '');

    useEffect(() => {
        if (open && activeTab === 'gallery' && media.length === 0) {
            loadMedia();
        }
    }, [open, activeTab]);

    const loadMedia = async () => {
        setGalleryLoading(true);
        try {
            const items = await LandingPageCmsService.listLandingMedia();
            setMedia(items);
        } finally {
            setGalleryLoading(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const url = await LandingPageCmsService.uploadImage(file);
            onSelect(url);
        } catch (err) {
            console.error('[ImagePicker] upload failed:', err);
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    if (!open) return null;

    const filtered = media
        .filter(m => filter === 'all' || m.kind === filter)
        .filter(m => !acceptVideo || m.kind === 'image' ? (acceptVideo ? true : m.kind === 'image') : true)
        .filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
                        <ImageIcon size={16} className="text-indigo-500" />
                        Görsel / Video Seç
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-500">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 shrink-0">
                    <TabBtn active={activeTab === 'upload'} onClick={() => setActiveTab('upload')} icon={<Upload size={14} />} label="Bilgisayardan Yükle" />
                    <TabBtn active={activeTab === 'gallery'} onClick={() => setActiveTab('gallery')} icon={<FolderOpen size={14} />} label="Galeriden Seç" />
                    <TabBtn active={activeTab === 'url'} onClick={() => setActiveTab('url')} icon={<Link2 size={14} />} label="URL Yapıştır" />
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {/* === UPLOAD === */}
                    {activeTab === 'upload' && (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-12 bg-slate-50">
                            {uploading ? (
                                <>
                                    <Loader2 size={36} className="text-indigo-400 animate-spin mb-3" />
                                    <p className="text-sm text-slate-500">Yükleniyor...</p>
                                </>
                            ) : (
                                <>
                                    <Upload size={40} className="text-slate-400 mb-3" />
                                    <p className="text-sm text-slate-600 mb-3 font-medium">Bilgisayarınızdan dosya seçin</p>
                                    <p className="text-xs text-slate-400 mb-4">{acceptVideo ? 'Görsel veya video' : 'Sadece görsel'}</p>
                                    <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors">
                                        Dosya Seç
                                        <input
                                            ref={fileRef}
                                            type="file"
                                            accept={acceptVideo ? 'image/*,video/*' : 'image/*'}
                                            onChange={handleUpload}
                                            className="hidden"
                                        />
                                    </label>
                                </>
                            )}
                        </div>
                    )}

                    {/* === GALLERY === */}
                    {activeTab === 'gallery' && (
                        <div className="flex flex-col gap-3">
                            {/* Filter chips + search */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {acceptVideo && (
                                    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                                        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="Tümü" />
                                        <FilterChip active={filter === 'image'} onClick={() => setFilter('image')} label="Görseller" />
                                        <FilterChip active={filter === 'video'} onClick={() => setFilter('video')} label="Videolar" />
                                    </div>
                                )}
                                <div className="relative flex-1 min-w-[180px]">
                                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Dosya adına göre ara..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    />
                                </div>
                                <button
                                    onClick={loadMedia}
                                    disabled={galleryLoading}
                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                                    title="Yenile"
                                >
                                    <RefreshCw size={15} className={galleryLoading ? 'animate-spin' : ''} />
                                </button>
                            </div>

                            {/* Grid */}
                            {galleryLoading ? (
                                <div className="flex flex-col items-center justify-center py-16">
                                    <Loader2 size={28} className="text-indigo-400 animate-spin mb-3" />
                                    <p className="text-sm text-slate-500">Yükleniyor...</p>
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <ImageIcon size={36} className="text-slate-300 mb-2" />
                                    <p className="text-sm text-slate-500 font-medium">
                                        {search ? 'Eşleşme yok' : 'Galeri boş'}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {search ? 'Farklı bir arama deneyin' : 'İlk dosyayı yüklemek için "Bilgisayardan Yükle" sekmesine geç'}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
                                    {filtered.map((m) => (
                                        <button
                                            key={m.name}
                                            onClick={() => setSelectedUrl(m.url === selectedUrl ? null : m.url)}
                                            className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                                selectedUrl === m.url
                                                    ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                                                    : 'border-slate-200 hover:border-indigo-300'
                                            }`}
                                        >
                                            {m.kind === 'video' ? (
                                                <video
                                                    src={m.url}
                                                    className="w-full h-full object-cover"
                                                    muted
                                                    autoPlay
                                                    loop
                                                    playsInline
                                                />
                                            ) : (
                                                <img
                                                    src={m.url}
                                                    alt={m.name}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                            )}
                                            {m.kind === 'video' && (
                                                <div className="absolute top-1 left-1 bg-black/60 text-white rounded px-1 py-0.5 flex items-center gap-1">
                                                    <VideoIcon size={10} />
                                                    <span className="text-[9px] font-semibold">VIDEO</span>
                                                </div>
                                            )}
                                            {selectedUrl === m.url && (
                                                <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center">
                                                    <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                                                        <Check size={16} className="text-white" />
                                                    </div>
                                                </div>
                                            )}
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <p className="text-[9px] text-white truncate">{m.name}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Action */}
                            {filtered.length > 0 && (
                                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                    <p className="text-xs text-slate-400">
                                        {filtered.length} dosya{selectedUrl ? ' · 1 seçili' : ''}
                                    </p>
                                    <button
                                        onClick={() => selectedUrl && onSelect(selectedUrl)}
                                        disabled={!selectedUrl}
                                        className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <Check size={14} />
                                        Kullan
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* === URL === */}
                    {activeTab === 'url' && (
                        <div className="flex flex-col gap-3 py-6">
                            <label className="text-sm font-medium text-slate-700">Dış URL</label>
                            <input
                                type="url"
                                value={urlInput}
                                onChange={e => setUrlInput(e.target.value)}
                                placeholder="https://example.com/image.jpg"
                                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                autoFocus
                            />
                            {urlInput && (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-60 flex items-center justify-center overflow-hidden">
                                    {/\.(mp4|webm|mov)(\?|$)/i.test(urlInput) ? (
                                        <video src={urlInput} className="max-h-56 rounded" muted autoPlay loop playsInline />
                                    ) : (
                                        <img src={urlInput} alt="preview" className="max-h-56 rounded object-contain" />
                                    )}
                                </div>
                            )}
                            <div className="flex justify-end pt-2">
                                <button
                                    onClick={() => urlInput.trim() && onSelect(urlInput.trim())}
                                    disabled={!urlInput.trim()}
                                    className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                                >
                                    <Check size={14} />
                                    Kullan
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors ${
                active
                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/40'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-b-2 border-transparent'
            }`}
        >
            {icon}
            {label}
        </button>
    );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button
            onClick={onClick}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                active ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
        >
            {label}
        </button>
    );
}
