import { useCallback, useEffect, useMemo, useState } from 'react';
import { Star, Sparkles, Loader2, MessageSquareQuote, Trash2 } from 'lucide-react';
import { HrEvaluationService } from '../../../services/admin/hr/hrEvaluationService';
import {
    EVALUATION_CRITERIA, RECOMMENDATION_META, suggestOverall, fitScoreLabel,
} from '../../../lib/hr/candidateEvaluation';
import { useToast } from '../../../contexts/ToastContext';
import type {
    EvaluationRecommendation, HrCandidate, HrCandidateEvaluation,
} from '../../../types/hr';
import { Chip, TintedBox, formatDateTR } from '../../../pages/admin/hr/_shared';
import { AvatarBox } from '../../../pages/admin/hr/_CandidateHeaderBits';

// Aday değerlendirme paneli.
//
// İKİ KATMAN AYRI DURUR:
//   · AI ön değerlendirmesi — makinenin tavsiyesi, salt okunur
//   · İnsan puanlaması       — kararı veren, değerlendirici başına bir satır
//
// İkisi aynı alana yazılsaydı hangisinin ne olduğu kaybolurdu. hr_candidates.rating
// yalnızca insan puanlarının ortalamasıdır (DB trigger'ı hesaplar).

interface Props {
    candidate: HrCandidate;
    onChanged?: () => void;
}

const STAR_VALUES = [1, 2, 3, 4, 5];

function StarRow({ value, onChange, disabled }: {
    value: number | undefined; onChange: (v: number) => void; disabled?: boolean;
}) {
    return (
        <div className="flex items-center gap-0.5">
            {STAR_VALUES.map(v => (
                <button
                    key={v} type="button" disabled={disabled}
                    onClick={() => onChange(v)}
                    title={`${v} / 5`}
                    className="p-0.5 disabled:cursor-not-allowed"
                >
                    <Star
                        className={`w-4 h-4 ${
                            value != null && v <= value
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-300'}`}
                    />
                </button>
            ))}
            <span className="text-[11px] text-slate-400 ml-1.5 w-8">{value ?? '—'}</span>
        </div>
    );
}

export default function CandidateEvaluationPanel({ candidate, onChanged }: Props) {
    const { success, error: toastError } = useToast();
    const [all, setAll] = useState<HrCandidateEvaluation[]>([]);
    const [mine, setMine] = useState<HrCandidateEvaluation | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [criteria, setCriteria] = useState<Record<string, number>>({});
    const [overall, setOverall] = useState<number | null>(null);
    const [recommendation, setRecommendation] = useState<EvaluationRecommendation | ''>('');
    const [comment, setComment] = useState('');
    /** Genel puana elle dokunulduysa kriter ortalaması artık onu ezmez. */
    const [overallTouched, setOverallTouched] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [list, own] = await Promise.all([
                HrEvaluationService.list(candidate.id),
                HrEvaluationService.mine(candidate.id),
            ]);
            setAll(list);
            setMine(own);
            if (own) {
                setCriteria(own.criteria || {});
                setOverall(own.overall);
                setRecommendation(own.recommendation ?? '');
                setComment(own.comment ?? '');
                setOverallTouched(true);
            }
        } catch (e: any) {
            toastError('Değerlendirmeler yüklenemedi', e?.message);
        } finally {
            setLoading(false);
        }
    }, [candidate.id, toastError]);

    useEffect(() => { void load(); }, [load]);

    const suggested = useMemo(() => suggestOverall(criteria), [criteria]);

    function setCriterion(key: string, value: number) {
        const next = { ...criteria, [key]: value };
        setCriteria(next);
        // Genel puan henüz elle belirlenmediyse kriterlerden türetilir; İK her
        // seferinde aynı sayıyı iki kez girmek zorunda kalmasın.
        if (!overallTouched) setOverall(suggestOverall(next));
    }

    async function save() {
        if (overall == null) {
            toastError('Genel puan gerekli', 'En az bir kriteri puanlayın veya genel puanı seçin.');
            return;
        }
        setSaving(true);
        try {
            await HrEvaluationService.save({
                candidateId: candidate.id,
                criteria, overall,
                recommendation: recommendation || null,
                comment,
            });
            success('Değerlendirmeniz kaydedildi');
            await load();
            onChanged?.();
        } catch (e: any) {
            toastError('Kaydedilemedi', e?.message);
        } finally {
            setSaving(false);
        }
    }

    async function removeMine() {
        if (!mine || !window.confirm('Değerlendirmeniz silinsin mi?')) return;
        setSaving(true);
        try {
            await HrEvaluationService.remove(mine.id);
            setMine(null); setCriteria({}); setOverall(null);
            setRecommendation(''); setComment(''); setOverallTouched(false);
            await load();
            onChanged?.();
        } catch (e: any) {
            toastError('Silinemedi', e?.message);
        } finally {
            setSaving(false);
        }
    }

    const ai = candidate.ai_evaluation;
    const fit = fitScoreLabel(candidate.ai_fit_score);
    const others = all.filter(e => e.id !== mine?.id);

    return (
        <section className="space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Değerlendirme</p>

            {/* AI ön değerlendirmesi — salt okunur */}
{/* AI ÖN DEĞERLENDİRMESİ.
                Skor sağ üstte, çünkü kartın konusu o sayıdır. Güçlü yönler ve
                dikkat edilecekler İKİZ TONLU KUTU olarak yan yana durur —
                eskiden ikisi de düz metin satırıydı ve "artı mı eksi mi"
                ayrımı okurken kayboluyordu. */}
            {(ai || fit) && (
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                                <Sparkles className="w-4 h-4 text-white" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-[13px] font-bold text-slate-800">AI Ön Değerlendirmesi</p>
                                {candidate.ai_evaluated_at && (
                                    <p className="text-[11px] text-slate-400">
                                        {formatDateTR(candidate.ai_evaluated_at)}
                                    </p>
                                )}
                            </div>
                        </div>
                        {candidate.ai_fit_score != null && (
                            <div className="text-right shrink-0">
                                <p className="text-[22px] font-bold text-primary leading-none tabular-nums">
                                    {candidate.ai_fit_score}
                                </p>
                                {fit && <p className="text-[11px] text-slate-400 mt-0.5">{fit.text}</p>}
                            </div>
                        )}
                    </div>

                    <p className="text-[11.5px] text-slate-500">
                        Bu bir <strong>tavsiyedir, karar değildir.</strong> Puanlamayı aşağıdan siz yaparsınız.
                    </p>

                    {ai?.summary && (
                        <p className="text-[13px] text-slate-700 leading-relaxed">{ai.summary}</p>
                    )}

                    {(!!ai?.strengths?.length || !!ai?.concerns?.length) && (
                        <div className="grid gap-2.5 sm:grid-cols-2">
                            {!!ai?.strengths?.length && (
                                <TintedBox title="Güçlü Yönler" tone="success" items={ai.strengths} />
                            )}
                            {!!ai?.concerns?.length && (
                                <TintedBox title="Dikkat Edilecekler" tone="warning" items={ai.concerns} />
                            )}
                        </div>
                    )}

                    {!!ai?.interview_questions?.length && (
                        <details className="text-[12.5px] text-slate-600 group">
                            <summary className="cursor-pointer font-semibold text-primary inline-flex items-center gap-1.5 list-none">
                                <MessageSquareQuote className="w-3.5 h-3.5" />
                                Mülakatta sorulabilecek {ai.interview_questions.length} soru
                                <span className="text-slate-400 group-open:rotate-90 transition-transform">▸</span>
                            </summary>
                            <ul className="list-decimal pl-5 mt-2 space-y-1">
                                {ai.interview_questions.map((q, i) => <li key={i}>{q}</li>)}
                            </ul>
                        </details>
                    )}
                </div>
            )}

            {/* İnsan puanlaması */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            {mine ? 'Değerlendirmeniz' : 'Sizin Puanınız'}
                        </span>
                        {/* Kaç kriterin puanlandığı başlığın parçası: boş
                            yıldızları saymak zorunda kalmadan görünür. */}
                        <span className="ml-1.5 text-[11px] font-semibold text-slate-400">
                            · {EVALUATION_CRITERIA.filter(c => criteria[c.key] != null).length}/{EVALUATION_CRITERIA.length} kriter puanlandı
                        </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        {overall != null && (
                            <span className="text-[22px] font-bold text-primary leading-none tabular-nums">
                                {overall.toFixed(1)}
                            </span>
                        )}
                        {mine && (
                            <button onClick={() => void removeMine()} disabled={saving}
                                className="p-1.5 rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer" title="Sil">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <p className="text-[13px] text-slate-400">Yükleniyor…</p>
                ) : (
                    <>
                        <div className="space-y-1.5">
                            {EVALUATION_CRITERIA.map(c => (
                                <div key={c.key} className="flex items-center justify-between gap-3 py-1">
                                    <div className="min-w-0">
                                        <span className="text-[13px] text-slate-700">{c.label}</span>
                                        <span className="block text-[11px] text-slate-400">{c.hint}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <StarRow value={criteria[c.key]} onChange={v => setCriterion(c.key, v)} disabled={saving} />
                                        {/* Yıldızın yanında sayı: "4/5" okumak,
                                            dolu yıldız saymaktan hızlıdır. */}
                                        <span className="text-[12px] tabular-nums w-7 text-right text-slate-500">
                                            {criteria[c.key] != null ? `${criteria[c.key]}/5` : '—'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                            <div>
                                <span className="text-[13px] font-semibold text-slate-800">Genel Puan</span>
                                {suggested != null && overall !== suggested && (
                                    <button
                                        onClick={() => { setOverall(suggested); setOverallTouched(false); }}
                                        className="block text-[11px] text-slate-500 underline"
                                    >
                                        Kriter ortalaması: {suggested} — uygula
                                    </button>
                                )}
                            </div>
                            <StarRow
                                value={overall ?? undefined}
                                onChange={v => { setOverall(v); setOverallTouched(true); }}
                                disabled={saving}
                            />
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            {(Object.keys(RECOMMENDATION_META) as EvaluationRecommendation[]).map(k => (
                                <button
                                    key={k} type="button" disabled={saving}
                                    onClick={() => setRecommendation(recommendation === k ? '' : k)}
                                    className={`px-2.5 py-1 rounded-lg border text-[12px] font-semibold cursor-pointer ${
                                        recommendation === k
                                            ? 'border-primary text-primary bg-primary/5'
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                                >
                                    {RECOMMENDATION_META[k].label}
                                </button>
                            ))}
                        </div>

                        <textarea
                            rows={2} value={comment} onChange={e => setComment(e.target.value)}
                            placeholder="Gerekçe / mülakat notu (isteğe bağlı)"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-slate-400"
                        />

                        <button
                            onClick={() => void save()} disabled={saving || overall == null}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary text-white text-[13px] font-semibold cursor-pointer disabled:opacity-40"
                        >
                            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {mine ? 'Güncelle' : 'Değerlendirmeyi Kaydet'}
                        </button>
                    </>
                )}
            </div>

            {/* Diğer değerlendiriciler */}
            {others.length > 0 && (
                <div className="space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Diğer Değerlendirmeler ({others.length})
                    </span>
                    {others.map(e => (
                        <div key={e.id} className="rounded-lg border border-slate-100 px-3 py-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                                <AvatarBox name={e.evaluator_name || 'Değerlendirici'} size={26} />
                                <span className="text-[13px] font-semibold text-slate-800">
                                    {e.evaluator_name || 'Değerlendirici'}
                                </span>
                                <span className="inline-flex items-center gap-0.5 text-[12px] text-amber-600">
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />{e.overall}/5
                                </span>
                                {e.recommendation && (
                                    <Chip meta={{
                                        label: RECOMMENDATION_META[e.recommendation].label,
                                        tone: RECOMMENDATION_META[e.recommendation].tone as any,
                                    }} />
                                )}
                                <span className="text-[11px] text-slate-400 ml-auto">{formatDateTR(e.updated_at)}</span>
                            </div>
                            {e.comment && <p className="text-[12.5px] text-slate-600 mt-1">{e.comment}</p>}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
