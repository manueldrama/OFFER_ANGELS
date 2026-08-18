import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { X, Send, Clock, Save, Sparkles, Loader2, Instagram, Facebook, Twitter, Linkedin, Music2, Eye, Smile, MessageSquare, ChevronDown, ChevronUp, ListOrdered, Wand2, Image as ImageIcon } from 'lucide-react';
import type { SocialPost } from '../../../services/admin/socialMediaService';
import { SocialMediaService } from '../../../services/admin/socialMediaService';
import { SocialMediaAiService, AI_LANGUAGES, type AiLanguageCode } from '../../../services/admin/socialMediaAiService';
import { ZernioService } from '../../../services/admin/zernioService';
import { useToast } from '../../../contexts/ToastContext';
import PlatformSelector from './PlatformSelector';
import AiHashtagGenerator from './AiHashtagGenerator';
import MediaUploader from './MediaUploader';
import PostStatusBadge from './PostStatusBadge';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

interface PostComposerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<SocialPost>) => Promise<SocialPost | void>;
    editingPost: SocialPost | null;
}

const CHAR_LIMITS: Record<string, number> = {
    twitter: 280,
    instagram: 2200,
    facebook: 63206,
    linkedin: 3000,
    tiktok: 2200,
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
    instagram: <Instagram size={14} />,
    facebook: <Facebook size={14} />,
    twitter: <Twitter size={14} />,
    linkedin: <Linkedin size={14} />,
    tiktok: <Music2 size={14} />,
};

const PLATFORM_LABELS: Record<string, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    twitter: 'X (Twitter)',
    linkedin: 'LinkedIn',
    tiktok: 'TikTok',
};

const POST_TYPES = [
    { key: 'feed', label: 'Feed', desc: 'Standart gönderi' },
    { key: 'story', label: 'Story', desc: '24 saat görünür' },
    { key: 'reel', label: 'Reel', desc: 'Kısa video' },
    { key: 'carousel', label: 'Carousel', desc: 'Çoklu görsel' },
] as const;

const defaultForm = {
    title: '',
    caption: '',
    hashtags: [] as string[],
    platforms: [] as string[],
    media_urls: [] as string[],
    ai_generated_image_url: '' as string,
    post_type: 'feed' as string,
    first_comment: '',
    platform_captions: {} as Record<string, string>,
    scheduled_for: '',
    status: 'draft' as const,
};

export default function PostComposerModal({ isOpen, onClose, onSave, editingPost }: PostComposerModalProps) {
    const { addToast } = useToast();
    const [form, setForm] = useState(defaultForm);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [publishMode, setPublishMode] = useState<'draft' | 'schedule' | 'now' | 'queue'>('draft');
    const [hashtagInput, setHashtagInput] = useState('');
    const [previewPlatform, setPreviewPlatform] = useState('instagram');
    const [aiCaptionLoading, setAiCaptionLoading] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showPlatformCaptions, setShowPlatformCaptions] = useState(false);
    const [showAiTopicInput, setShowAiTopicInput] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [aiTopicLoading, setAiTopicLoading] = useState(false);
    const [aiImageCaptionLoading, setAiImageCaptionLoading] = useState(false);
    const [aiFirstCommentLoading, setAiFirstCommentLoading] = useState(false);
    const [aiLanguage, setAiLanguage] = useState<AiLanguageCode>('tr');
    const captionRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        if (editingPost) {
            setForm({
                title: editingPost.title || '',
                caption: editingPost.caption,
                hashtags: editingPost.hashtags || [],
                platforms: editingPost.platforms || [],
                media_urls: editingPost.media_urls || [],
                ai_generated_image_url: editingPost.ai_generated_image_url || '',
                post_type: (editingPost as any).post_type || 'feed',
                first_comment: (editingPost as any).first_comment || '',
                platform_captions: (editingPost as any).platform_captions || {},
                scheduled_for: editingPost.scheduled_for ? editingPost.scheduled_for.slice(0, 16) : '',
                status: editingPost.status as any,
            });
            setPublishMode(editingPost.status === 'scheduled' ? 'schedule' : 'draft');
            setPreviewPlatform(editingPost.platforms?.[0] || 'instagram');
        } else {
            setForm({ ...defaultForm });
            setPublishMode('draft');
            setPreviewPlatform('instagram');
        }
        setShowEmojiPicker(false);
        setShowPlatformCaptions(false);
        setShowAiTopicInput(false);
        // Load default AI language from settings
        SocialMediaService.getSetting('social_ai_language').then(lang => {
            if (lang) setAiLanguage(lang as AiLanguageCode);
        }).catch(() => {});
    }, [isOpen, editingPost]);

    if (!isOpen) return null;

    const hasInstagram = form.platforms.includes('instagram');

    const minCharLimit = form.platforms.length > 0
        ? Math.min(...form.platforms.map(p => CHAR_LIMITS[p] || 2200))
        : 2200;

    const captionLength = form.caption.length;
    const isOverLimit = captionLength > minCharLimit;

    const getPreviewCaption = (platform: string) => {
        return form.platform_captions[platform]?.trim() || form.caption;
    };

    const addHashtag = () => {
        const raw = hashtagInput.trim();
        if (!raw) return;
        const tag = raw.startsWith('#') ? raw : `#${raw}`;
        if (tag.length > 1 && !form.hashtags.includes(tag)) {
            setForm(f => ({ ...f, hashtags: [...f.hashtags, tag] }));
        }
        setHashtagInput('');
    };

    const removeHashtag = (tag: string) => {
        setForm(f => ({ ...f, hashtags: f.hashtags.filter(t => t !== tag) }));
    };

    const handleEmojiClick = (emojiData: any) => {
        const emoji = emojiData.emoji;
        const textarea = captionRef.current;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newCaption = form.caption.slice(0, start) + emoji + form.caption.slice(end);
            setForm(f => ({ ...f, caption: newCaption }));
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + emoji.length, start + emoji.length);
            }, 0);
        } else {
            setForm(f => ({ ...f, caption: f.caption + emoji }));
        }
    };

    const handleAiImproveCaption = async () => {
        if (!form.caption.trim()) return;
        setAiCaptionLoading(true);
        try {
            const instruction = aiLanguage === 'tr'
                ? `${form.platforms[0] || 'instagram'} platformu için daha etkili, dikkat çekici ve profesyonel hale getir`
                : `Make it more effective, attention-grabbing and professional for ${form.platforms[0] || 'instagram'}`;
            const improved = await SocialMediaAiService.improveCaption(
                form.caption,
                instruction,
                aiLanguage
            );
            setForm(f => ({ ...f, caption: improved }));
        } catch (e) {
            console.error('[AI Caption]', e);
        } finally {
            setAiCaptionLoading(false);
        }
    };

    const handleAiGenerateCaption = async () => {
        if (!aiTopic.trim()) return;
        setAiTopicLoading(true);
        try {
            const result = await SocialMediaAiService.generatePostSuggestion(
                aiTopic,
                form.platforms.length > 0 ? form.platforms : ['instagram'],
                aiLanguage
            );
            setForm(f => ({
                ...f,
                caption: result.caption,
                hashtags: [...new Set([...f.hashtags, ...result.hashtags])],
            }));
            setShowAiTopicInput(false);
            setAiTopic('');
        } catch (e) {
            console.error('[AI Generate]', e);
        } finally {
            setAiTopicLoading(false);
        }
    };

    const handleAiCaptionFromImage = async () => {
        if (form.media_urls.length === 0) {
            addToast({ type: 'warning', title: 'Önce bir görsel yükleyin' });
            return;
        }
        setAiImageCaptionLoading(true);
        try {
            const platform = form.platforms[0] || 'instagram';
            const caption = await SocialMediaAiService.generateCaptionFromImage(form.media_urls[0], platform, aiLanguage);
            setForm(f => ({ ...f, caption }));
            addToast({ type: 'success', title: 'Görselden caption oluşturuldu' });
        } catch (e: any) {
            console.error('[AI Image Caption]', e);
            addToast({ type: 'error', title: 'Caption oluşturulamadı', message: e?.message });
        } finally {
            setAiImageCaptionLoading(false);
        }
    };

    const handleAiFirstComment = async () => {
        setAiFirstCommentLoading(true);
        try {
            const platform = form.platforms[0] || 'instagram';
            const comment = await SocialMediaAiService.generateFirstComment({
                caption: form.caption,
                platform,
                language: aiLanguage,
            });
            setForm(f => ({ ...f, first_comment: comment }));
            addToast({ type: 'success', title: 'İlk yorum oluşturuldu' });
        } catch (e: any) {
            console.error('[AI First Comment]', e);
            addToast({ type: 'error', title: 'İlk yorum oluşturulamadı', message: e?.message });
        } finally {
            setAiFirstCommentLoading(false);
        }
    };

    const handlePublish = async (mode: 'draft' | 'schedule' | 'now' | 'queue') => {
        if (form.platforms.length === 0) return;
        setIsSubmitting(true);
        try {
            const postData: Partial<SocialPost> = {
                title: form.title || null,
                caption: form.caption,
                hashtags: form.hashtags,
                platforms: form.platforms,
                media_urls: form.media_urls,
                ai_generated_image_url: form.ai_generated_image_url || null,
                post_type: form.post_type as any,
                first_comment: form.first_comment || null,
                platform_captions: form.platform_captions as any,
            };

            if (mode === 'schedule' && form.scheduled_for) {
                postData.status = 'scheduled';
                postData.scheduled_for = new Date(form.scheduled_for).toISOString();
            } else if (mode === 'now' || mode === 'queue') {
                postData.status = 'publishing';
            } else {
                postData.status = 'draft';
            }

            const savedPost = await onSave(postData);
            const postId = (savedPost as any)?.id || editingPost?.id;

            if (mode === 'now' || mode === 'schedule' || mode === 'queue') {
                try {
                    const [apiKey, profileId] = await Promise.all([
                        SocialMediaService.getSetting('social_zernio_api_key'),
                        SocialMediaService.getSetting('social_zernio_profile_id'),
                    ]);
                    if (!apiKey) {
                        addToast({ type: 'error', title: 'Zernio API Key eksik', message: 'Sosyal Medya Ayarları → Zernio API anahtarını girin.' });
                        if (postId) await SocialMediaService.updatePost(postId, { status: 'draft' });
                        onClose();
                        return;
                    }
                    if (!profileId) {
                        addToast({ type: 'error', title: 'Zernio Profile ID eksik', message: 'Sosyal Medya Ayarları → Zernio Profile ID girin.' });
                        if (postId) await SocialMediaService.updatePost(postId, { status: 'draft' });
                        onClose();
                        return;
                    }

                    // Build platform objects with accountIds from social_accounts
                    const accounts = await SocialMediaService.listAccounts();
                    const platformObjs = form.platforms.map(p => {
                        const acc = accounts.find(a => a.platform === p && a.is_active);
                        return { platform: p, accountId: acc?.platform_account_id || '' };
                    }).filter(p => p.accountId);

                    if (platformObjs.length === 0) {
                        addToast({ type: 'error', title: 'Platform hesabı eksik', message: 'Sosyal Medya Ayarları → Platform hesaplarını Zernio Account ID ile ekleyin.' });
                        if (postId) await SocialMediaService.updatePost(postId, { status: 'draft' });
                        onClose();
                        return;
                    }

                    const fullText = [form.caption, form.hashtags.join(' ')].filter(Boolean).join('\n\n');

                    // Build media items
                    const mediaItems = form.media_urls.length > 0
                        ? form.media_urls.map(url => ({
                            url,
                            type: (/\.(mp4|webm|mov|avi)(\?|$)/i.test(url) ? 'video' : 'image') as 'image' | 'video',
                        }))
                        : undefined;

                    // Build custom content per platform
                    const customContent = Object.keys(form.platform_captions).length > 0
                        ? form.platform_captions
                        : undefined;

                    const zernioResult = await ZernioService.createPost(apiKey, {
                        profileId,
                        platforms: platformObjs,
                        content: fullText,
                        publishNow: mode === 'now',
                        scheduledFor: mode === 'schedule' && form.scheduled_for
                            ? new Date(form.scheduled_for).toISOString()
                            : undefined,
                        mediaItems,
                        firstComment: form.first_comment || undefined,
                        customContent,
                    });

                    if (postId) {
                        await SocialMediaService.updatePost(postId, {
                            status: mode === 'schedule' ? 'scheduled' : 'published',
                            published_at: mode !== 'schedule' ? new Date().toISOString() : undefined,
                            zernio_post_id: zernioResult.id,
                            zernio_response: zernioResult,
                        } as any);
                    }
                    addToast({ type: 'success', title: mode === 'schedule' ? 'Post zamanlandı' : 'Post yayınlandı!' });
                } catch (zernioErr: any) {
                    console.error('[Zernio] Publish error:', zernioErr);
                    if (postId) {
                        await SocialMediaService.updatePost(postId, {
                            status: 'failed',
                            error_message: zernioErr?.message || 'Zernio API hatası',
                        });
                    }
                    addToast({ type: 'error', title: 'Yayınlama başarısız', message: zernioErr?.message || 'Zernio API hatası' });
                }
            }

            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    const firstMedia = form.media_urls[0] || null;
    const isMediaVideo = (url: string) => /\.(mp4|webm|mov|avi)(\?|$)/i.test(url);

    const renderMediaPreview = (url: string, className: string) => {
        if (isMediaVideo(url)) {
            return <video src={url} className={className} controls muted playsInline />;
        }
        return <img src={url} alt="" className={className} />;
    };

    /* ─── Preview Renderers ─── */
    const renderInstagramPreview = () => {
        const caption = getPreviewCaption('instagram');
        const isStory = form.post_type === 'story' || form.post_type === 'reel';
        return (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-bold">CP</div>
                    <div className="flex-1">
                        <div className="text-xs font-semibold text-slate-800">cafepaste</div>
                        <div className="text-[10px] text-slate-400">Sponsorlu</div>
                    </div>
                    {form.post_type !== 'feed' && (
                        <span className="text-[9px] font-semibold text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded uppercase">{form.post_type}</span>
                    )}
                </div>
                <div className={`bg-slate-100 flex items-center justify-center ${isStory ? 'aspect-[9/16] max-h-[280px]' : form.post_type === 'carousel' ? 'aspect-square relative' : 'aspect-square'}`}>
                    {firstMedia ? (
                        renderMediaPreview(firstMedia, 'w-full h-full object-cover')
                    ) : (
                        <div className="text-slate-300 text-xs">Görsel ekleyin</div>
                    )}
                    {form.post_type === 'carousel' && form.media_urls.length > 1 && (
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                            1/{form.media_urls.length}
                        </div>
                    )}
                </div>
                <div className="px-3 py-2 flex gap-3">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-700"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-700"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-700"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </div>
                <div className="px-3 pb-3">
                    <p className="text-xs text-slate-800 leading-relaxed">
                        <span className="font-semibold">cafepaste</span>{' '}
                        {caption.slice(0, 150) || 'Paylaşım metni burada görünecek...'}
                        {caption.length > 150 && <span className="text-slate-400"> ...daha fazla</span>}
                    </p>
                    {form.hashtags.length > 0 && (
                        <p className="text-xs text-blue-600 mt-1">{form.hashtags.slice(0, 8).join(' ')}</p>
                    )}
                    {form.first_comment && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                            <p className="text-[11px] text-slate-500">
                                <span className="font-semibold text-slate-700">cafepaste</span>{' '}
                                {form.first_comment.slice(0, 80)}
                                {form.first_comment.length > 80 && '...'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderTwitterPreview = () => {
        const caption = getPreviewCaption('twitter');
        return (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden p-4">
                <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold shrink-0">CP</div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-slate-800">CAFEPASTE</span>
                            <span className="text-xs text-slate-400">@cafepaste · 1sn</span>
                        </div>
                        <p className="text-sm text-slate-800 mt-1 leading-relaxed whitespace-pre-wrap">
                            {(caption + (form.hashtags.length > 0 ? '\n' + form.hashtags.join(' ') : '')).slice(0, 280) || 'Post metni burada görünecek...'}
                        </p>
                        {firstMedia && (
                            <div className="mt-3 rounded-xl overflow-hidden border border-slate-200">
                                {renderMediaPreview(firstMedia!, 'w-full h-36 object-cover')}
                            </div>
                        )}
                        <div className="flex items-center gap-8 mt-3 text-slate-400">
                            <span className="text-[11px]">💬 0</span>
                            <span className="text-[11px]">🔁 0</span>
                            <span className="text-[11px]">❤️ 0</span>
                            <span className="text-[11px]">📊 0</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderLinkedInPreview = () => {
        const caption = getPreviewCaption('linkedin');
        return (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 pt-4 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold">CP</div>
                        <div>
                            <div className="text-sm font-semibold text-slate-800">CAFEPASTE</div>
                            <div className="text-[11px] text-slate-400">Profesyonel Kahve Makinesi Çözümleri · 1sn</div>
                        </div>
                    </div>
                    <p className="text-sm text-slate-700 mt-3 leading-relaxed">
                        {caption.slice(0, 200) || 'Paylaşım metni burada görünecek...'}
                        {caption.length > 200 && <span className="text-slate-400 text-xs"> ...daha fazla göster</span>}
                    </p>
                    {form.hashtags.length > 0 && (
                        <p className="text-xs text-blue-600 mt-2">{form.hashtags.join(' ')}</p>
                    )}
                </div>
                {firstMedia && renderMediaPreview(firstMedia, 'w-full h-40 object-cover')}
                <div className="px-4 py-2 border-t border-slate-100 flex justify-around text-[11px] text-slate-500 font-medium">
                    <span>👍 Beğen</span><span>💬 Yorum</span><span>🔁 Paylaş</span><span>📤 Gönder</span>
                </div>
            </div>
        );
    };

    const renderFacebookPreview = () => {
        const caption = getPreviewCaption('facebook');
        return (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 pt-4 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">CP</div>
                        <div>
                            <div className="text-sm font-semibold text-slate-800">CAFEPASTE</div>
                            <div className="text-[11px] text-slate-400">1sn · 🌐</div>
                        </div>
                    </div>
                    <p className="text-sm text-slate-800 mt-3 leading-relaxed">
                        {caption.slice(0, 250) || 'Paylaşım metni burada görünecek...'}
                        {caption.length > 250 && <span className="text-slate-400"> ...Daha Fazla</span>}
                    </p>
                    {form.hashtags.length > 0 && <p className="text-xs text-blue-600 mt-1.5">{form.hashtags.join(' ')}</p>}
                </div>
                {firstMedia && renderMediaPreview(firstMedia, 'w-full h-44 object-cover')}
                <div className="px-4 py-2 border-t border-slate-100 flex justify-around text-[11px] text-slate-500 font-medium">
                    <span>👍 Beğen</span><span>💬 Yorum Yap</span><span>↗️ Paylaş</span>
                </div>
            </div>
        );
    };

    const renderTikTokPreview = () => {
        const caption = getPreviewCaption('tiktok');
        return (
            <div className="bg-black rounded-xl overflow-hidden aspect-[9/16] max-h-[300px] relative flex items-end">
                {firstMedia ? (
                    renderMediaPreview(firstMedia, 'absolute inset-0 w-full h-full object-cover')
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs">Video önizleme</div>
                )}
                <div className="relative z-10 p-3 bg-gradient-to-t from-black/70 to-transparent w-full">
                    <span className="text-white text-xs font-bold">@cafepaste</span>
                    <p className="text-white text-[11px] leading-relaxed mt-1">{caption.slice(0, 120) || 'Açıklama...'}</p>
                    {form.hashtags.length > 0 && <p className="text-cyan-300 text-[10px] mt-0.5">{form.hashtags.slice(0, 5).join(' ')}</p>}
                    <div className="flex items-center gap-1.5 mt-1.5">
                        <Music2 size={10} className="text-white" />
                        <span className="text-white text-[9px]">Orijinal ses - cafepaste</span>
                    </div>
                </div>
            </div>
        );
    };

    const previewRenderers: Record<string, () => React.ReactNode> = {
        instagram: renderInstagramPreview,
        facebook: renderFacebookPreview,
        twitter: renderTwitterPreview,
        linkedin: renderLinkedInPreview,
        tiktok: renderTikTokPreview,
    };

    const publishModeLabel = publishMode === 'now' ? 'Hemen Yayınla' : publishMode === 'schedule' ? 'Zamanla' : publishMode === 'queue' ? 'Sıraya Ekle' : 'Taslak Kaydet';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-[1100px] mx-4 max-h-[94vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* ─── Header ─── */}
                <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <h3 className="text-base font-bold text-slate-800">
                            {editingPost ? 'Paylaşımı Düzenle' : 'Yeni Paylaşım Oluştur'}
                        </h3>
                        {editingPost && <PostStatusBadge status={editingPost.status} />}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                        <X size={18} className="text-slate-400" />
                    </button>
                </div>

                {/* ─── Body: 2 panels ─── */}
                <div className="flex-1 overflow-hidden flex min-h-0">
                    {/* ═══ LEFT PANEL — Editor ═══ */}
                    <div className="flex-[55] border-r border-slate-100 overflow-y-auto p-5 space-y-4">
                        {/* Title */}
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Başlık (dahili)</label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                placeholder="Paylaşım başlığı (sadece yönetim için)"
                                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                            />
                        </div>

                        {/* Platforms */}
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Platformlar</label>
                            <PlatformSelector
                                selected={form.platforms}
                                onChange={platforms => {
                                    setForm(f => ({ ...f, platforms }));
                                    if (platforms.length > 0 && !platforms.includes(previewPlatform)) {
                                        setPreviewPlatform(platforms[0]);
                                    }
                                }}
                            />
                        </div>

                        {/* Instagram Post Type */}
                        {hasInstagram && (
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Instagram Post Tipi</label>
                                <div className="flex gap-1.5">
                                    {POST_TYPES.map(pt => (
                                        <button
                                            key={pt.key}
                                            type="button"
                                            onClick={() => setForm(f => ({ ...f, post_type: pt.key }))}
                                            className={`flex-1 px-2.5 py-2 rounded-lg text-center transition-all cursor-pointer border ${
                                                form.post_type === pt.key
                                                    ? 'bg-pink-50 border-pink-300 text-pink-700'
                                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="text-xs font-semibold">{pt.label}</div>
                                            <div className="text-[9px] mt-0.5 text-slate-400">{pt.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Caption + Emoji */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Paylaşım Metni</label>
                                    {/* AI Language selector */}
                                    <select
                                        value={aiLanguage}
                                        onChange={e => setAiLanguage(e.target.value as AiLanguageCode)}
                                        className="text-[10px] font-semibold pl-1.5 pr-5 py-0.5 rounded-md border border-slate-200 bg-white text-slate-600 cursor-pointer focus:ring-1 focus:ring-indigo-200 outline-none appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2210%22%20height%3D%2210%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[position:right_4px_center] bg-no-repeat"
                                        title="AI içerik dili"
                                    >
                                        {AI_LANGUAGES.map(l => (
                                            <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setShowAiTopicInput(!showAiTopicInput)}
                                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                                        title="AI ile sıfırdan caption oluştur"
                                    >
                                        <Wand2 size={10} />
                                        AI Yaz
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleAiCaptionFromImage}
                                        disabled={aiImageCaptionLoading || form.media_urls.length === 0}
                                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer disabled:opacity-40"
                                        title="Yüklenen görseli analiz ederek caption oluştur"
                                    >
                                        {aiImageCaptionLoading ? <Loader2 size={10} className="animate-spin" /> : <ImageIcon size={10} />}
                                        Görselden Yaz
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleAiImproveCaption}
                                        disabled={aiCaptionLoading || !form.caption.trim()}
                                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors cursor-pointer disabled:opacity-40"
                                    >
                                        {aiCaptionLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                                        İyileştir
                                    </button>
                                    <span className={`text-[11px] font-medium tabular-nums ${isOverLimit ? 'text-red-500' : 'text-slate-400'}`}>
                                        {captionLength}/{minCharLimit}
                                    </span>
                                </div>
                            </div>

                            {/* AI Topic Input */}
                            {showAiTopicInput && (
                                <div className="flex gap-2 mb-2 p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                                    <input
                                        type="text"
                                        value={aiTopic}
                                        onChange={e => setAiTopic(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAiGenerateCaption())}
                                        placeholder="Konu girin: ör. yeni espresso makinesi tanıtımı"
                                        className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-emerald-200 focus:ring-2 focus:ring-emerald-200 outline-none bg-white"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAiGenerateCaption}
                                        disabled={aiTopicLoading || !aiTopic.trim()}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        {aiTopicLoading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                                        Oluştur
                                    </button>
                                </div>
                            )}

                            <div className="relative">
                                <textarea
                                    ref={captionRef}
                                    value={form.caption}
                                    onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
                                    placeholder="Paylaşım metnini yazın..."
                                    rows={4}
                                    className={`w-full px-3 py-2.5 pr-10 text-sm rounded-xl border focus:ring-2 focus:ring-indigo-200 outline-none resize-none ${
                                        isOverLimit ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-indigo-400'
                                    }`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    className="absolute right-2 top-2 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                                    title="Emoji ekle"
                                >
                                    <Smile size={16} className="text-slate-400" />
                                </button>
                                {showEmojiPicker && (
                                    <div className="absolute right-0 top-full mt-1 z-50">
                                        <Suspense fallback={<div className="p-4 text-xs text-slate-400">Yükleniyor...</div>}>
                                            <EmojiPicker
                                                onEmojiClick={handleEmojiClick}
                                                width={320}
                                                height={360}
                                                searchPlaceholder="Emoji ara..."
                                                previewConfig={{ showPreview: false }}
                                            />
                                        </Suspense>
                                    </div>
                                )}
                            </div>
                            {form.platforms.length > 1 && (
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {form.platforms.map(p => {
                                        const limit = CHAR_LIMITS[p] || 2200;
                                        const over = captionLength > limit;
                                        return (
                                            <span key={p} className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${over ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
                                                {PLATFORM_LABELS[p]}: {captionLength}/{limit}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Platform-specific captions (collapsible) */}
                        {form.platforms.length > 1 && (
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setShowPlatformCaptions(!showPlatformCaptions)}
                                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                    <span className="flex items-center gap-1.5">
                                        <MessageSquare size={13} />
                                        Platforma Özel Metin
                                    </span>
                                    {showPlatformCaptions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                {showPlatformCaptions && (
                                    <div className="px-3.5 pb-3 space-y-2.5 border-t border-slate-100 pt-2.5">
                                        <p className="text-[10px] text-slate-400">Boş bırakırsanız ana metin kullanılır.</p>
                                        {form.platforms.map(p => (
                                            <div key={p}>
                                                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-1">
                                                    {PLATFORM_ICONS[p]}
                                                    {PLATFORM_LABELS[p]}
                                                    <span className="text-[10px] font-normal text-slate-300 tabular-nums">
                                                        {(form.platform_captions[p] || '').length}/{CHAR_LIMITS[p] || 2200}
                                                    </span>
                                                </label>
                                                <textarea
                                                    value={form.platform_captions[p] || ''}
                                                    onChange={e => setForm(f => ({
                                                        ...f,
                                                        platform_captions: { ...f.platform_captions, [p]: e.target.value }
                                                    }))}
                                                    placeholder={`${PLATFORM_LABELS[p]} için özel metin...`}
                                                    rows={2}
                                                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-200 outline-none resize-none"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* First Comment (Instagram) */}
                        {hasInstagram && (
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                                        <MessageSquare size={11} />
                                        İlk Yorum (Instagram)
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={handleAiFirstComment}
                                            disabled={aiFirstCommentLoading}
                                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors cursor-pointer disabled:opacity-40"
                                            title="AI ile etkileşim artırıcı ilk yorum oluştur"
                                        >
                                            {aiFirstCommentLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                                            AI Yorum Yaz
                                        </button>
                                        <span className="text-[10px] text-slate-400 tabular-nums">{form.first_comment.length}/2200</span>
                                    </div>
                                </div>
                                <textarea
                                    value={form.first_comment}
                                    onChange={e => setForm(f => ({ ...f, first_comment: e.target.value }))}
                                    placeholder="Yayınlandıktan sonra otomatik ilk yorum... (etkileşim artırır)"
                                    rows={2}
                                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none resize-none"
                                />
                            </div>
                        )}

                        {/* Hashtags */}
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Etiketler</label>
                            {form.hashtags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                    {form.hashtags.map(tag => (
                                        <span key={tag} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-medium">
                                            {tag}
                                            <button type="button" onClick={() => removeHashtag(tag)} className="hover:text-red-500 cursor-pointer"><X size={9} /></button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-1.5">
                                <input
                                    type="text"
                                    value={hashtagInput}
                                    onChange={e => setHashtagInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addHashtag())}
                                    placeholder="#hashtag"
                                    className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                                />
                                <button type="button" onClick={addHashtag} className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer">Ekle</button>
                            </div>
                            <div className="mt-2">
                                <AiHashtagGenerator
                                    caption={form.caption}
                                    platform={form.platforms[0] || 'instagram'}
                                    currentHashtags={form.hashtags}
                                    onAdd={tags => setForm(f => ({ ...f, hashtags: [...f.hashtags, ...tags] }))}
                                    language={aiLanguage}
                                />
                            </div>
                        </div>

                        {/* Media Uploader */}
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Görseller & Videolar</label>
                            <MediaUploader
                                mediaUrls={form.media_urls}
                                onChange={urls => setForm(f => ({ ...f, media_urls: urls }))}
                            />
                        </div>

                        {/* Publish Mode */}
                        <div className="bg-slate-50/80 rounded-xl p-4 space-y-3">
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Yayın Modu</label>
                            <div className="grid grid-cols-4 gap-1.5">
                                {([
                                    { key: 'draft' as const, label: 'Taslak', desc: 'Kaydet', icon: Save },
                                    { key: 'schedule' as const, label: 'Zamanla', desc: 'Belirli tarihte', icon: Clock },
                                    { key: 'now' as const, label: 'Hemen', desc: 'Şimdi yayınla', icon: Send },
                                    { key: 'queue' as const, label: 'Sıra', desc: 'Sıraya ekle', icon: ListOrdered },
                                ]).map(m => (
                                    <button
                                        key={m.key}
                                        type="button"
                                        onClick={() => setPublishMode(m.key)}
                                        className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                                            publishMode === m.key
                                                ? 'border-indigo-500 bg-indigo-50'
                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                    >
                                        <m.icon size={14} className={publishMode === m.key ? 'text-indigo-600' : 'text-slate-400'} />
                                        <div className="mt-1 text-[11px] font-semibold text-slate-800">{m.label}</div>
                                        <div className="text-[9px] text-slate-400">{m.desc}</div>
                                    </button>
                                ))}
                            </div>
                            {publishMode === 'schedule' && (
                                <input
                                    type="datetime-local"
                                    value={form.scheduled_for}
                                    onChange={e => setForm(f => ({ ...f, scheduled_for: e.target.value }))}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                                />
                            )}
                            {publishMode === 'queue' && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
                                    <ListOrdered size={14} className="text-amber-600" />
                                    <span className="text-[11px] text-amber-700 font-medium">Paylaşım Zernio sırasına eklenecek ve otomatik yayınlanacak.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ═══ RIGHT PANEL — Preview ═══ */}
                    <div className="flex-[45] overflow-y-auto bg-slate-50/50">
                        <div className="p-5 space-y-4">
                            <div className="flex items-center gap-2">
                                <Eye size={14} className="text-slate-400" />
                                <span className="text-xs font-semibold text-slate-600">Canlı Önizleme</span>
                            </div>

                            {/* Platform tabs */}
                            <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 overflow-x-auto">
                                {(form.platforms.length > 0 ? form.platforms : ['instagram']).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setPreviewPlatform(p)}
                                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                                            previewPlatform === p
                                                ? 'bg-white text-slate-800 shadow-sm'
                                                : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        {PLATFORM_ICONS[p]}
                                        {PLATFORM_LABELS[p]}
                                    </button>
                                ))}
                            </div>

                            {/* Preview */}
                            <div className="transition-all duration-200">
                                {previewRenderers[previewPlatform]?.() || renderInstagramPreview()}
                            </div>

                            {/* Media gallery mini */}
                            {form.media_urls.length > 1 && (
                                <div>
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Tüm Görseller ({form.media_urls.length})</span>
                                    <div className="flex gap-1.5 mt-1.5 overflow-x-auto pb-1">
                                        {form.media_urls.map((url, i) => (
                                            <img key={i} src={url} alt="" className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0" />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Post summary */}
                            <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Paylaşım Özeti</span>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span className="text-slate-400">Platformlar</span>
                                        <div className="font-medium text-slate-700 mt-0.5">{form.platforms.length > 0 ? form.platforms.map(p => PLATFORM_LABELS[p]).join(', ') : '—'}</div>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">Post Tipi</span>
                                        <div className="font-medium text-slate-700 mt-0.5 capitalize">{form.post_type}</div>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">Görseller</span>
                                        <div className="font-medium text-slate-700 mt-0.5">{form.media_urls.length} adet</div>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">Etiketler</span>
                                        <div className="font-medium text-slate-700 mt-0.5">{form.hashtags.length} adet</div>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">Karakter</span>
                                        <div className={`font-medium mt-0.5 ${isOverLimit ? 'text-red-500' : 'text-slate-700'}`}>{captionLength}</div>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">İlk Yorum</span>
                                        <div className="font-medium text-slate-700 mt-0.5">{form.first_comment ? 'Var' : '—'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── Footer ─── */}
                <div className="flex justify-between items-center px-6 py-3.5 border-t border-slate-100 shrink-0 bg-white rounded-b-2xl">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer">
                        İptal
                    </button>
                    <div className="flex gap-2">
                        {publishMode !== 'draft' && (
                            <button
                                onClick={() => handlePublish('draft')}
                                disabled={isSubmitting}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                <Save size={13} />
                                Taslak
                            </button>
                        )}
                        <button
                            onClick={() => handlePublish(publishMode)}
                            disabled={isSubmitting || form.platforms.length === 0}
                            className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                        >
                            {publishMode === 'now' && <Send size={13} />}
                            {publishMode === 'schedule' && <Clock size={13} />}
                            {publishMode === 'draft' && <Save size={13} />}
                            {publishMode === 'queue' && <ListOrdered size={13} />}
                            {isSubmitting ? 'İşleniyor...' : publishModeLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
