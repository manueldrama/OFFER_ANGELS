// Mülakat inceleme ekranı — İK cevapları izler ve puanlar.
//
// TASARIM KARARLARI
//   1) AI PUANI İNSAN KARARIYLA AYNI ALANA YAZILMAZ. Yazılı cevaplarda AI
//      tavsiyesi ayrı bir rozet olarak görünür; yıldızlar insanındır.
//   2) 'locked' bir boşluk değil SİNYALDİR: aday soruyu gördü, cevap gelmedi.
//   3) MÜLAKAT PUANI hr_candidates.rating'e OTOMATİK GİTMEZ. "Aday
//      değerlendirmesine aktar" ayrı ve bilinçli bir eylemdir; o kolonun tek
//      sahibi hr_candidate_sync_rating() trigger'ıdır.
//   4) Video imzalı URL ile ve tembel yüklenir; her izleme KVKK denetimine düşer.

import { useCallback, useEffect, useState } from 'react';
import {
    AlertTriangle, ChevronLeft, ChevronRight, Download, Eye, Loader2,
    RotateCcw, Star, Trash2, UserCheck,
} from 'lucide-react';
import { HrInterviewService } from '../../../services/admin/hr/hrInterviewService';
import { useToast } from '../../../contexts/ToastContext';
import type {
    EvaluationRecommendation, HrInterviewAnswer, HrInterviewInvite,
    InterviewSnapshotQuestion,
} from '../../../types/hr';
import { INTERVIEW_ANSWER_META, Chip } from '../../../pages/admin/hr/_shared';

const BTN = 'px-3 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 transition-colors';
const BTN_PRIMARY = `${BTN} bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40`;
const BTN_GHOST = `${BTN} border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40`;
const SECTION = 'text-[11px] font-bold uppercase tracking-wider text-slate-400';

const RECOMMENDATION_LABEL: Record<EvaluationRecommendation, string> = {
    strong_yes: 'Kesinlikle olumlu',
    yes: 'Olumlu',
    maybe: 'Kararsız',
    no: 'Olumsuz',
};

interface Props {
    invite: HrInterviewInvite;
    candidateId: string;
    onChanged?: () => void;
}

export default function InterviewReviewPanel({ invite, candidateId, onChanged }: Props) {
    const { success, error: toastError } = useToast();

    const [answers, setAnswers] = useState<HrInterviewAnswer[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    const [mediaMime, setMediaMime] = useState<string | null>(null);
    const [mediaLoading, setMediaLoading] = useState(false);

    const [scores, setScores] = useState<Record<string, number>>({});
    const [overall, setOverall] = useState(3);
    const [recommendation, setRecommendation] = useState<EvaluationRecommendation | ''>('');
    const [comment, setComment] = useState('');

    const questions: InterviewSnapshotQuestion[] = Array.isArray(invite.questions) ? invite.questions : [];

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [rows, reviews] = await Promise.all([
                HrInterviewService.listAnswers(invite.id),
                HrInterviewService.listReviews(invite.id),
            ]);
            setAnswers(rows);
            // Kendi önceki değerlendirmem varsa formu onunla doldur.
            const mine = reviews[0];
            if (mine) {
                setScores(mine.scores || {});
                setOverall(mine.overall);
                setRecommendation((mine.recommendation ?? '') as EvaluationRecommendation | '');
                setComment(mine.comment ?? '');
            }
        } catch (e: any) {
            toastError('Yüklenemedi', e?.message);
        } finally {
            setLoading(false);
        }
    }, [invite.id, toastError]);

    useEffect(() => { void load(); }, [load]);

    const openAnswer = async (answer: HrInterviewAnswer) => {
        setActiveId(answer.id);
        setMediaUrl(null);
        setMediaMime(null);
        if (answer.answer_type !== 'video' || !answer.storage_path) return;

        setMediaLoading(true);
        try {
            const res = await HrInterviewService.getAnswerUrl(answer);
            setMediaUrl(res.url);
            setMediaMime(res.mime_type);
        } catch (e: any) {
            toastError('Video açılamadı', e?.message);
        } finally {
            setMediaLoading(false);
        }
    };

    const reopen = async (answer: HrInterviewAnswer) => {
        if (!window.confirm(
            'Bu soruya yeniden çekim hakkı verilecek. Mevcut kaydı silinecek ve mülakat ' +
            'yeniden açılacak. Devam edilsin mi?',
        )) return;
        setBusy(true);
        try {
            await HrInterviewService.reopenAnswer(answer);
            success('Yeniden hak verildi', 'Aday bu soruyu tekrar cevaplayabilir.');
            setActiveId(null);
            setMediaUrl(null);
            await load();
            onChanged?.();
        } catch (e: any) {
            toastError('İşlem başarısız', e?.message);
        } finally {
            setBusy(false);
        }
    };

    const purge = async () => {
        if (!window.confirm(
            'Bu mülakatın tüm videoları KALICI olarak silinecek. Puanlar, yorumlar ve ' +
            'değerlendirme kaydı korunur. Devam edilsin mi?',
        )) return;
        setBusy(true);
        try {
            const res = await HrInterviewService.purgeInvite(invite.id);
            success('Videolar silindi', `${res.removed} kayıt kaldırıldı.`);
            setMediaUrl(null);
            await load();
            onChanged?.();
        } catch (e: any) {
            toastError('Silinemedi', e?.message);
        } finally {
            setBusy(false);
        }
    };

    const saveReview = async () => {
        setBusy(true);
        try {
            await HrInterviewService.upsertReview({
                invite_id: invite.id,
                scores,
                overall,
                recommendation: recommendation || null,
                comment: comment.trim() || null,
            });
            success('Değerlendirme kaydedildi');
            onChanged?.();
        } catch (e: any) {
            toastError('Kaydedilemedi', e?.message);
        } finally {
            setBusy(false);
        }
    };

    const promote = async () => {
        if (!window.confirm(
            'Bu mülakat değerlendirmesi adayın genel puanına işlenecek. Aday puanı ' +
            'tüm değerlendirmelerin ortalamasından yeniden hesaplanır. Devam edilsin mi?',
        )) return;
        setBusy(true);
        try {
            await HrInterviewService.promoteToCandidateEvaluation({
                candidate_id: candidateId,
                overall,
                recommendation: recommendation || null,
                comment: comment.trim() || null,
            });
            success('Aday değerlendirmesine aktarıldı');
            onChanged?.();
        } catch (e: any) {
            toastError('Aktarılamadı', e?.message);
        } finally {
            setBusy(false);
        }
    };

    const active = answers.find(a => a.id === activeId) ?? null;
    const activeQuestion = active
        ? questions.find(q => q.order === active.question_order) ?? null
        : null;

    /**
     * Cevaplar soru sırasına göre — gezinme bunun üzerinden yürür.
     * `answers` listesinin geliş sırasına güvenilmez; sıralı bir mülakatta
     * "sonraki" demek "sonraki SORU" demektir.
     */
    const ordered = [...answers].sort((a, b) => a.question_order - b.question_order);
    const activeIdx = ordered.findIndex(a => a.id === activeId);

    /**
     * İK bu ekrana İZLEMEYE gelir; "soldan bir cevap seçin" boş durumu
     * gereksiz bir tıklama daha isteyip ekranı boş bırakıyordu. İlk cevap
     * kendiliğinden açılır.
     *
     * NOT: bu, imzalı URL üretir ve her izleme gibi KVKK denetimine düşer.
     * Bilinçli: inceleme sayfasını açmak zaten bir izlemedir.
     */
    useEffect(() => {
        if (loading || activeId || ordered.length === 0) return;
        void openAnswer(ordered[0]);
        // openAnswer kasten bağımlılık değil: her render'da yeni kimlik alır
        // ve efekti sonsuz döngüye sokardı.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, activeId, ordered.length]);

    /** Snapshot'ta metni boş kalmış soru — adaya hiç gösterilmedi. */
    const promptOf = (q: InterviewSnapshotQuestion) => {
        const text = q.prompt?.[invite.language_code]
            || Object.values(q.prompt || {}).find(v => (v || '').trim())
            || '';
        return { text: text.trim(), empty: !text.trim() };
    };

    if (loading) {
        return <div className="text-sm text-slate-400 py-10 text-center">Yükleniyor…</div>;
    }

    return (
        // OYNATICI SOLDA VE BÜYÜK — eskiden sağda ~460px'lik bir kutuydu ve
        // İK "net göremiyorum" diyordu. Bölünme `xl`de: `lg`de admin kenar
        // çubuğu düşüldükten sonra içerik ~770px kalıyor ve oynatıcı yine
        // küçülüyordu.
        <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr] items-start">
            {/* ── Sol: oynatıcı ──────────────────────────────────────────────── */}
            <div className="xl:sticky xl:top-4 space-y-3">
                {/* SORU METNİ OYNATICININ ÜSTÜNDE.
                    Eskiden videoyu izlerken sorunun ne olduğu HİÇBİR YERDE
                    yazmıyordu; İK cevabı dinlerken soruyu hatırlamak ya da
                    öbür kolona bakmak zorundaydı. */}
                {active && activeQuestion && (() => {
                    const { text, empty } = promptOf(activeQuestion);
                    return (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                {activeQuestion.order}. Soru
                                <span className="ml-2 font-semibold normal-case tracking-normal text-slate-500">
                                    {active.answer_type === 'video' ? 'video cevap' : 'yazılı cevap'}
                                </span>
                            </p>
                            <p className={`text-[14px] leading-snug ${empty ? 'text-slate-400 italic' : 'text-slate-900'}`}>
                                {empty ? 'Bu sorunun metni boş — adaya gösterilmedi.' : text}
                            </p>
                        </div>
                    );
                })()}

                {!active ? (
                    <div className="border border-slate-200 rounded-xl p-12 text-center">
                        <Eye size={24} strokeWidth={1.5} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm text-slate-500">Bu mülakatta gösterilecek cevap yok.</p>
                    </div>
                ) : active.answer_type === 'text' ? (
                    <div className="border border-slate-200 rounded-xl p-5">
                        <p className="text-[14px] leading-relaxed text-slate-900 whitespace-pre-wrap">
                            {active.text_answer || '—'}
                        </p>
                    </div>
                ) : active.status === 'purged' ? (
                    <div className="border border-slate-200 rounded-xl p-12 text-center">
                        <Trash2 size={24} strokeWidth={1.5} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm text-slate-500">Saklama süresi dolduğu için video silinmiş.</p>
                    </div>
                ) : mediaLoading ? (
                    <div className="border border-slate-200 rounded-xl p-12 text-center">
                        <Loader2 size={20} className="mx-auto animate-spin text-slate-400" />
                    </div>
                ) : mediaUrl ? (
                    <div className="space-y-2">
                        <video
                            key={active.id}
                            src={mediaUrl}
                            controls
                            autoPlay={false}
                            playsInline
                            className="w-full rounded-xl bg-slate-900 aspect-video object-contain"
                        />
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[11.5px] text-slate-400">
                                {active.duration_seconds ? `${active.duration_seconds} sn` : ''}
                                {active.mime_type ? ` · ${active.mime_type}` : ''}
                            </p>
                            {/* Codec parçalanması gerçek: aday VP9 webm çeker, Safari
                                siyah oynatıcı gösterir. İndirme her zaman çalışır. */}
                            <a href={mediaUrl} download className={BTN_GHOST}>
                                <Download size={14} /> İndir
                            </a>
                        </div>
                        {mediaMime?.includes('webm') && (
                            <div className="flex gap-2 border border-slate-200 rounded-xl p-2.5">
                                <AlertTriangle size={14} className="shrink-0 mt-0.5 text-slate-400" />
                                <p className="text-[11.5px] leading-relaxed text-slate-500">
                                    Bu kayıt WebM biçiminde. Safari'de oynatılamayabilir — Chrome/Edge
                                    kullanın veya indirin.
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="border border-slate-200 rounded-xl p-12 text-center">
                        <p className="text-sm text-slate-500">
                            {active.status === 'locked'
                                ? 'Aday bu soruyu gördü ancak cevap göndermedi.'
                                : 'Bu cevaba ait kayıt yok.'}
                        </p>
                    </div>
                )}

                {/* Sıralı gezinme — mülakat sıralı bir akış; her cevap için
                    listeye dönüp tıklamak gerekmemeli. */}
                {ordered.length > 1 && (
                    <div className="flex items-center justify-between gap-2">
                        <button type="button" className={BTN_GHOST}
                            disabled={activeIdx <= 0}
                            onClick={() => void openAnswer(ordered[activeIdx - 1])}
                        >
                            <ChevronLeft size={14} /> Önceki
                        </button>
                        <span className="text-[12px] text-slate-400 tabular-nums">
                            {activeIdx + 1} / {ordered.length}
                        </span>
                        <button type="button" className={BTN_GHOST}
                            disabled={activeIdx < 0 || activeIdx >= ordered.length - 1}
                            onClick={() => void openAnswer(ordered[activeIdx + 1])}
                        >
                            Sonraki <ChevronRight size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* ── Sağ: cevap listesi ve puanlama ─────────────────────────────── */}
            <div className="space-y-2">
                <div className={SECTION}>Cevaplar</div>

                {questions.map(q => {
                    const a = answers.find(x => x.question_order === q.order);
                    const { text: prompt, empty: promptEmpty } = promptOf(q);
                    const questionKey = q.question_id ?? String(q.order);

                    return (
                        <div
                            key={q.order}
                            className={`border rounded-xl p-3 transition-colors ${
                                active?.question_order === q.order ? 'border-slate-900' : 'border-slate-200'
                            }`}
                        >
                            <button type="button"
                                onClick={() => { if (a) void openAnswer(a); }}
                                disabled={!a}
                                className="w-full text-left flex items-start justify-between gap-2 mb-2 cursor-pointer disabled:cursor-default"
                            >
                                <p className={`text-[13px] leading-snug min-w-0 ${promptEmpty ? 'text-slate-400 italic' : 'text-slate-900'}`}>
                                    <span className="text-slate-400 mr-1.5">{q.order}.</span>
                                    {/* Metni boş soru artık adaya GÖNDERİLMİYOR. İK'nın
                                        gördüğü soru sayısı ile adayınki arasındaki farkın
                                        sebebi budur ve yazılı olmalı — yoksa "cevap nerede"
                                        diye aranır. */}
                                    {promptEmpty ? 'Metni boş — adaya gösterilmedi' : prompt}
                                </p>
                                {a && <Chip meta={INTERVIEW_ANSWER_META[a.status]} />}
                            </button>

                            {a?.attempt_no && a.attempt_no > 1 && (
                                <p className="text-[11.5px] text-amber-700 mb-2">
                                    İK yeniden hak verdi ({a.attempt_no}. deneme)
                                </p>
                            )}

                            {a?.ai_score != null && (
                                <p className="text-[11.5px] text-sky-700 mb-2">
                                    AI tavsiyesi: {a.ai_score}/5{a.ai_note ? ` — ${a.ai_note}` : ''}
                                </p>
                            )}

                            <div className="flex items-center justify-between gap-2">
                                {/* Yıldızlar İNSANIN — AI puanı buraya asla yazılmaz. */}
                                <div className="flex items-center gap-0.5">
                                    {[1, 2, 3, 4, 5].map(n => (
                                        <button type="button"
                                            key={n}
                                            onClick={() => setScores(s => ({ ...s, [questionKey]: n }))}
                                            className="p-0.5 cursor-pointer"
                                            title={`${n} yıldız`}
                                        >
                                            <Star
                                                size={15}
                                                className={(scores[questionKey] ?? 0) >= n
                                                    ? 'fill-amber-400 text-amber-400'
                                                    : 'text-slate-300'}
                                            />
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-center gap-1">
                                    {/* "Aç" düğmesi kaldırıldı: satırın kendisi açıyor
                                        (yukarıdaki button). İki ayrı tıklama hedefi
                                        gereksizdi. */}
                                    {a && a.answer_type === 'video' && a.status !== 'purged' && (
                                        <button type="button"
                                            className={BTN_GHOST}
                                            disabled={busy}
                                            onClick={() => void reopen(a)}
                                            title="Bu soruya yeniden hak ver"
                                        >
                                            <RotateCcw size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Genel değerlendirme */}
                <div className="border border-slate-200 rounded-xl p-3 mt-4 space-y-3">
                    <div className={SECTION}>Genel Değerlendirme</div>

                    <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(n => (
                            <button type="button" key={n} onClick={() => setOverall(n)} className="p-0.5 cursor-pointer">
                                <Star size={20} className={overall >= n ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
                            </button>
                        ))}
                    </div>

                    <select
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-900"
                        value={recommendation}
                        onChange={e => setRecommendation(e.target.value as EvaluationRecommendation | '')}
                    >
                        <option value="">Tavsiye seçin…</option>
                        {(Object.keys(RECOMMENDATION_LABEL) as EvaluationRecommendation[]).map(k => (
                            <option key={k} value={k}>{RECOMMENDATION_LABEL[k]}</option>
                        ))}
                    </select>

                    <textarea
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-900 resize-y"
                        rows={3}
                        placeholder="Yorumunuz…"
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                    />

                    <button type="button" className={`${BTN_PRIMARY} w-full justify-center`} disabled={busy} onClick={() => void saveReview()}>
                        {busy ? <Loader2 size={14} className="animate-spin" /> : null} Kaydet
                    </button>

                    <div className="flex gap-2">
                        <button type="button" className={`${BTN_GHOST} flex-1 justify-center`} disabled={busy} onClick={() => void promote()}>
                            <UserCheck size={14} /> Aday değerlendirmesine aktar
                        </button>
                        <button type="button"
                            className={`${BTN_GHOST} text-rose-600 border-rose-200 hover:bg-rose-50`}
                            disabled={busy || !!invite.purged_at}
                            onClick={() => void purge()}
                            title="Videoları şimdi sil"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>

                    <p className="text-[11.5px] text-slate-400">
                        “Aday değerlendirmesine aktar” bu puanı adayın genel puanına işler.
                        Mülakat puanı kendi başına aday puanını değiştirmez.
                    </p>
                </div>
            </div>
        </div>
    );
}
