import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { ServiceNote } from '../../../types';
import { Send, Lock, MessageCircle, Paperclip, X, Image, Loader2 } from 'lucide-react';

interface ServiceNotesPanelProps {
    requestId: string;
}

const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);

export default function ServiceNotesPanel({ requestId }: ServiceNotesPanelProps) {
    const [notes, setNotes] = useState<ServiceNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [newNote, setNewNote] = useState('');
    const [isInternal, setIsInternal] = useState(false);
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [previewFile, setPreviewFile] = useState<{ file: File; url: string } | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchNotes = async () => {
        const { data } = await supabase
            .from('service_notes')
            .select('*')
            .eq('service_request_id', requestId)
            .order('created_at', { ascending: true });
        setNotes((data || []) as ServiceNote[]);
        setLoading(false);
    };

    useEffect(() => { fetchNotes(); }, [requestId]);

    // Auto-scroll to bottom when notes change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [notes]);

    // Auto-resize textarea
    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNewNote(e.target.value);
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    };

    const uploadFile = async (file: File): Promise<string | null> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 11)}_${Date.now()}.${fileExt}`;
        const filePath = `service-notes/${requestId}/${fileName}`;
        const { error } = await supabase.storage.from('whatsapp_media').upload(filePath, file);
        if (error) { console.error('Upload error:', error); return null; }
        const { data } = supabase.storage.from('whatsapp_media').getPublicUrl(filePath);
        return data.publicUrl;
    };

    const handleSend = async () => {
        if (!newNote.trim() && !previewFile) return;
        setSending(true);
        try {
            let content = newNote.trim();

            // Upload file if attached
            if (previewFile) {
                setUploading(true);
                const url = await uploadFile(previewFile.file);
                if (url) {
                    content = content ? `${content}\n${url}` : url;
                }
                setUploading(false);
            }

            if (content) {
                await supabase.from('service_notes').insert({
                    service_request_id: requestId,
                    author_type: 'admin',
                    content,
                    is_internal: isInternal
                });
            }

            setNewNote('');
            setPreviewFile(null);
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
            fetchNotes();
        } catch { } finally { setSending(false); setUploading(false); }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        setPreviewFile({ file, url });
        e.target.value = '';
    };

    const removePreview = () => {
        if (previewFile) URL.revokeObjectURL(previewFile.url);
        setPreviewFile(null);
    };

    const renderNoteContent = (content: string) => {
        // Check if content contains image URLs — render them as thumbnails
        const lines = content.split('\n');
        return lines.map((line, i) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('http') && isImageUrl(trimmed)) {
                return (
                    <a key={i} href={trimmed} target="_blank" rel="noopener noreferrer" className="block mt-1">
                        <img src={trimmed} alt="Ek" className="max-w-[200px] max-h-[150px] rounded-lg object-cover border border-white/20" />
                    </a>
                );
            }
            if (trimmed.startsWith('http') && /\.(mp4|webm|mov)(\?|$)/i.test(trimmed)) {
                return (
                    <video key={i} src={trimmed} controls className="max-w-[200px] max-h-[150px] rounded-lg mt-1" />
                );
            }
            return <span key={i}>{line}{i < lines.length - 1 && <br />}</span>;
        });
    };

    if (loading) return <div className="text-xs text-slate-400 py-8 text-center">Notlar yükleniyor...</div>;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <MessageCircle size={12} /> Mesajlar & Notlar ({notes.length})
            </h4>

            {/* Messages Area */}
            <div ref={scrollRef} className="max-h-96 overflow-y-auto space-y-3 mb-3 scroll-smooth px-1">
                {notes.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                        <MessageCircle size={32} className="mb-2 opacity-40" />
                        <p className="text-sm font-medium">Henüz mesaj yok</p>
                        <p className="text-xs mt-0.5">Müşteri ile iletişime geçmek için mesaj yazın</p>
                    </div>
                )}
                {notes.map(note => {
                    const isCustomer = note.author_type === 'customer';
                    const isAdmin = note.author_type === 'admin';
                    const isInternalNote = note.is_internal;

                    // Internal notes — centered amber strip
                    if (isInternalNote) {
                        return (
                            <div key={note.id} className="flex justify-center">
                                <div className="max-w-[85%] bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <Lock size={9} className="text-amber-600" />
                                        <span className="text-[9px] font-bold text-amber-700 uppercase">İç Not</span>
                                    </div>
                                    <p className="text-xs text-amber-900 whitespace-pre-wrap">{renderNoteContent(note.content)}</p>
                                    <span className="text-[9px] text-amber-500 mt-1 block">
                                        {new Date(note.created_at || '').toLocaleString('tr-TR')}
                                    </span>
                                </div>
                            </div>
                        );
                    }

                    // Customer messages — left aligned blue bubble
                    if (isCustomer) {
                        return (
                            <div key={note.id} className="flex justify-start">
                                <div className="max-w-[75%]">
                                    <div className="bg-blue-50 border border-blue-100 rounded-2xl rounded-bl-md px-4 py-2.5">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <span className="text-[10px] font-bold text-blue-600 uppercase">Müşteri</span>
                                        </div>
                                        <div className="text-sm text-slate-800 whitespace-pre-wrap">{renderNoteContent(note.content)}</div>
                                    </div>
                                    <span className="text-[9px] text-slate-400 mt-0.5 block ml-2">
                                        {new Date(note.created_at || '').toLocaleString('tr-TR')}
                                    </span>
                                </div>
                            </div>
                        );
                    }

                    // Admin messages — right aligned dark bubble
                    if (isAdmin) {
                        return (
                            <div key={note.id} className="flex justify-end">
                                <div className="max-w-[75%]">
                                    <div className="bg-slate-800 rounded-2xl rounded-br-md px-4 py-2.5">
                                        <div className="text-sm text-white whitespace-pre-wrap">{renderNoteContent(note.content)}</div>
                                    </div>
                                    <span className="text-[9px] text-slate-400 mt-0.5 block text-right mr-2">
                                        {new Date(note.created_at || '').toLocaleString('tr-TR')}
                                    </span>
                                </div>
                            </div>
                        );
                    }

                    // System messages — centered small
                    return (
                        <div key={note.id} className="flex justify-center">
                            <div className="bg-slate-50 border border-slate-100 rounded-full px-4 py-1.5">
                                <span className="text-[10px] text-slate-500">{note.content}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* File Preview */}
            {previewFile && (
                <div className="mb-2 relative inline-flex">
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                        {previewFile.file.type.startsWith('image/') ? (
                            <img src={previewFile.url} alt="Önizleme" className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <Image size={20} className="text-slate-400" />
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={removePreview}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-red-600"
                        >
                            <X size={10} />
                        </button>
                    </div>
                    <span className="text-[10px] text-slate-400 ml-2 self-end truncate max-w-[150px]">{previewFile.file.name}</span>
                </div>
            )}

            {/* Input Area */}
            <div className="flex items-end gap-2 bg-slate-50 rounded-xl p-2 border border-slate-200">
                {/* File upload */}
                <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                    title="Dosya ekle"
                >
                    <Paperclip size={16} />
                </button>

                {/* Text input */}
                <textarea
                    ref={textareaRef}
                    value={newNote}
                    onChange={handleTextareaChange}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder={isInternal ? 'İç not yaz (müşteri göremez)...' : 'Mesaj yaz...'}
                    rows={1}
                    className="flex-1 bg-transparent text-sm resize-none outline-none py-2 px-1 max-h-[120px] placeholder:text-slate-400"
                />

                {/* Internal toggle */}
                <button
                    type="button"
                    onClick={() => setIsInternal(!isInternal)}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all shrink-0 ${
                        isInternal
                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                            : 'bg-white text-slate-400 border border-slate-200 hover:text-slate-500'
                    }`}
                    title={isInternal ? 'İç not (müşteri göremez)' : 'Dış not (müşteri görebilir)'}
                >
                    <Lock size={11} />
                    {isInternal && <span>İÇ</span>}
                </button>

                {/* Send */}
                <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || uploading || (!newNote.trim() && !previewFile)}
                    className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
                >
                    {sending || uploading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
            </div>
        </div>
    );
}
