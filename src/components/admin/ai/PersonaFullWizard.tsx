import React, { useEffect, useState } from 'react';
import { X, Wand2, ChevronRight, ChevronLeft, Loader2, Sparkles, Check, RefreshCw, Save } from 'lucide-react';
import { apiAssistanceService } from '../../../services/admin/aiAssistanceService';
import { FIELD_META, FIELD_ORDER, PersonaFieldKey } from './personaPrompts';

interface Props {
    initialValues: Record<PersonaFieldKey, string>;
    onApplyAll: (values: Record<PersonaFieldKey, string>) => void;
    onClose: () => void;
}

type Phase = 'brief' | 'field' | 'synthesizing-field' | 'review' | 'error';

const STORAGE_KEY = 'cafepaste_persona_wizard_state';

interface PersistedState {
    brief: string;
    fieldIdx: number;
    answers: Record<PersonaFieldKey, string[]>;
    drafts: Record<PersonaFieldKey, string>;
    questionsCache: Record<PersonaFieldKey, string[]>;
}

function loadPersisted(): PersistedState | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as PersistedState;
    } catch { return null; }
}

function persist(state: PersistedState) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

function clearPersist() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

function parseQuestions(raw: string): string[] {
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const qs: string[] = [];
    for (const ln of lines) {
        const m = ln.match(/^(?:\d+[.)]\s+|[-*]\s+)(.+)$/);
        if (m) qs.push(m[1].trim());
        else if (ln.endsWith('?')) qs.push(ln);
    }
    return qs.length > 0 ? qs : lines;
}

const EMPTY_ANSWERS: Record<PersonaFieldKey, string[]> = FIELD_ORDER.reduce((acc, k) => {
    acc[k] = [];
    return acc;
}, {} as Record<PersonaFieldKey, string[]>);

const EMPTY_DRAFTS: Record<PersonaFieldKey, string> = FIELD_ORDER.reduce((acc, k) => {
    acc[k] = '';
    return acc;
}, {} as Record<PersonaFieldKey, string>);

const EMPTY_QUESTIONS: Record<PersonaFieldKey, string[]> = FIELD_ORDER.reduce((acc, k) => {
    acc[k] = [];
    return acc;
}, {} as Record<PersonaFieldKey, string[]>);

export const PersonaFullWizard: React.FC<Props> = ({ initialValues, onApplyAll, onClose }) => {
    const persisted = loadPersisted();
    const [phase, setPhase] = useState<Phase>(persisted ? 'field' : 'brief');
    const [brief, setBrief] = useState<string>(persisted?.brief || '');
    const [fieldIdx, setFieldIdx] = useState<number>(persisted?.fieldIdx || 0);
    const [questionsCache, setQuestionsCache] = useState<Record<PersonaFieldKey, string[]>>(persisted?.questionsCache || EMPTY_QUESTIONS);
    const [answers, setAnswers] = useState<Record<PersonaFieldKey, string[]>>(persisted?.answers || EMPTY_ANSWERS);
    const [drafts, setDrafts] = useState<Record<PersonaFieldKey, string>>(persisted?.drafts || EMPTY_DRAFTS);
    const [currentAnswerIdx, setCurrentAnswerIdx] = useState(0);
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentField = FIELD_ORDER[fieldIdx];
    const currentMeta = currentField ? FIELD_META[currentField] : null;
    const currentQuestions = currentField ? questionsCache[currentField] : [];

    // Persist progress on any change
    useEffect(() => {
        if (phase === 'brief' && !brief) return; // don't persist empty initial
        persist({ brief, fieldIdx, answers, drafts, questionsCache });
    }, [brief, fieldIdx, answers, drafts, questionsCache, phase]);

    // Load current answer into local state when navigating fields
    useEffect(() => {
        if (phase !== 'field' || !currentField) return;
        const arr = answers[currentField] || [];
        setCurrentAnswerIdx(0);
        setCurrentAnswer(arr[0] || '');
        if (!currentQuestions || currentQuestions.length === 0) {
            loadQuestionsForCurrentField();
        }
    }, [fieldIdx, phase]);

    const submitBrief = () => {
        if (!brief.trim()) {
            setError('Lütfen markanızı kısaca tanıt.');
            return;
        }
        setError(null);
        setPhase('field');
    };

    const loadQuestionsForCurrentField = async () => {
        if (!currentField || !currentMeta) return;
        setLoading(true);
        setError(null);
        try {
            const userMsg = `${currentMeta.questionPrompt}

EK MARKA BAĞLAMI (kullanıcı yazdı): ${brief.trim()}

Mevcut "${currentMeta.label}" alanı${initialValues[currentField]?.trim() ? ` zaten şöyle dolu:\n"""\n${initialValues[currentField].slice(0, 600)}\n"""\nBunu güncellemek/zenginleştirmek için sorular üret.` : ' boş — sıfırdan toplayacak şekilde soru üret.'}`;
            const res = await apiAssistanceService.askAi(userMsg, null, `wizard-q-${currentField}-${Date.now()}`, [], 'sales');
            const qs = parseQuestions(res.answer);
            if (qs.length === 0) throw new Error('AI soru üretemedi.');
            setQuestionsCache(prev => ({ ...prev, [currentField]: qs }));
            setAnswers(prev => ({ ...prev, [currentField]: new Array(qs.length).fill('') }));
            setCurrentAnswerIdx(0);
            setCurrentAnswer('');
        } catch (e: any) {
            setError(e?.message || 'Sorular yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const nextAnswer = () => {
        if (!currentField || !currentQuestions) return;
        const updated = [...(answers[currentField] || [])];
        updated[currentAnswerIdx] = currentAnswer.trim();
        setAnswers(prev => ({ ...prev, [currentField]: updated }));

        if (currentAnswerIdx < currentQuestions.length - 1) {
            setCurrentAnswerIdx(currentAnswerIdx + 1);
            setCurrentAnswer(updated[currentAnswerIdx + 1] || '');
        } else {
            synthesizeCurrentField(updated);
        }
    };

    const prevAnswer = () => {
        if (currentAnswerIdx === 0) {
            // Önceki field'a dön
            if (fieldIdx > 0) {
                if (!currentField) return;
                const updated = [...(answers[currentField] || [])];
                updated[currentAnswerIdx] = currentAnswer;
                setAnswers(prev => ({ ...prev, [currentField]: updated }));
                setFieldIdx(fieldIdx - 1);
            }
            return;
        }
        if (!currentField) return;
        const updated = [...(answers[currentField] || [])];
        updated[currentAnswerIdx] = currentAnswer;
        setAnswers(prev => ({ ...prev, [currentField]: updated }));
        setCurrentAnswerIdx(currentAnswerIdx - 1);
        setCurrentAnswer(updated[currentAnswerIdx - 1] || '');
    };

    const synthesizeCurrentField = async (finalAnswers: string[]) => {
        if (!currentField || !currentMeta) return;
        setPhase('synthesizing-field');
        setError(null);
        try {
            const questions = currentQuestions || [];
            const qa = questions.map((q, i) => `Soru ${i + 1}: ${q}\nCevap: ${finalAnswers[i] || '(boş)'}`).join('\n\n');
            const userMsg = `${currentMeta.synthesisPrompt}

EK MARKA BAĞLAMI: ${brief.trim()}

GİRDİ Q&A:
${qa}`;
            const res = await apiAssistanceService.askAi(userMsg, null, `wizard-synth-${currentField}-${Date.now()}`, [], 'sales');
            setDrafts(prev => ({ ...prev, [currentField]: res.answer.trim() }));

            // Sonraki field'a geç ya da review'a
            if (fieldIdx < FIELD_ORDER.length - 1) {
                setFieldIdx(fieldIdx + 1);
                setPhase('field');
            } else {
                setPhase('review');
            }
        } catch (e: any) {
            setError(e?.message || 'Sentez başarısız');
            setPhase('field');
        }
    };

    const regenerateField = async (field: PersonaFieldKey) => {
        const meta = FIELD_META[field];
        setLoading(true);
        setError(null);
        try {
            const qs = questionsCache[field] || [];
            const ans = answers[field] || [];
            const qa = qs.map((q, i) => `Soru ${i + 1}: ${q}\nCevap: ${ans[i] || '(boş)'}`).join('\n\n');
            const userMsg = `${meta.synthesisPrompt}

EK MARKA BAĞLAMI: ${brief.trim()}

GİRDİ Q&A:
${qa}`;
            const res = await apiAssistanceService.askAi(userMsg, null, `wizard-resynth-${field}-${Date.now()}`, [], 'sales');
            setDrafts(prev => ({ ...prev, [field]: res.answer.trim() }));
        } catch (e: any) {
            setError(e?.message || 'Tekrar üretim başarısız');
        } finally {
            setLoading(false);
        }
    };

    const saveAll = () => {
        onApplyAll(drafts);
        clearPersist();
        onClose();
    };

    const totalProgress = phase === 'review' ? 100 : Math.round(((fieldIdx + (currentAnswerIdx / Math.max(1, currentQuestions?.length || 1))) / FIELD_ORDER.length) * 100);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="px-5 py-4 bg-gradient-to-br from-indigo-600 to-violet-700 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                                <Wand2 size={18} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-200">AI Persona Wizard</p>
                                <p className="text-sm font-semibold truncate">
                                    {phase === 'brief' && 'Adım 1: Marka Brief\'i'}
                                    {(phase === 'field' || phase === 'synthesizing-field') && currentMeta && `Adım ${fieldIdx + 2}: ${currentMeta.label}`}
                                    {phase === 'review' && 'Adım Son: Önizleme & Kaydet'}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10" aria-label="Kapat">
                            <X size={18} />
                        </button>
                    </div>
                    {/* Progress */}
                    <div className="mt-3 h-1.5 bg-white/15 rounded-full overflow-hidden">
                        <div className="h-full bg-white/70 transition-all" style={{ width: `${totalProgress}%` }} />
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5">
                    {phase === 'brief' && (
                        <div>
                            <p className="text-sm text-slate-800 font-medium mb-1">Markanı kısaca tanıt.</p>
                            <p className="text-xs text-slate-500 mb-3">
                                5-10 cümle yeter — AI bunu kullanarak sonraki sorularını senin markana göre uyarlayacak.
                                Örnek: ne yapıyorsun, hangi sektör, ne kadar süredir, ne ile öne çıkıyorsun.
                            </p>
                            <textarea
                                value={brief}
                                onChange={e => setBrief(e.target.value)}
                                rows={10}
                                placeholder="Cafepaste B2B kafe ve otellere İçecek Art Makinesi (Beverage Art Creator) sunuyor. Premium konumlandırma, kurulum + eğitim + 2 yıl garanti dahil..."
                                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                                autoFocus
                            />
                            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
                            <div className="flex items-center justify-end mt-4 gap-2">
                                <button
                                    onClick={onClose}
                                    className="text-sm font-medium text-slate-500 hover:text-slate-800 px-3 py-2"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={submitBrief}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg inline-flex items-center gap-1.5 shadow-sm shadow-indigo-200"
                                >
                                    Başla
                                    <ChevronRight size={15} />
                                </button>
                            </div>
                        </div>
                    )}

                    {phase === 'field' && currentField && currentMeta && (
                        <div>
                            {loading || (currentQuestions || []).length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
                                    <Loader2 size={26} className="animate-spin text-indigo-500" />
                                    <p className="text-sm">AI sorular hazırlıyor...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-500 transition-all"
                                                style={{ width: `${((currentAnswerIdx + 1) / currentQuestions.length) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-medium text-slate-500">
                                            {currentAnswerIdx + 1} / {currentQuestions.length}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2">{currentMeta.label}</p>
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-4">
                                        <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider mb-1">Soru</p>
                                        <p className="text-sm text-slate-800 font-medium leading-relaxed">{currentQuestions[currentAnswerIdx]}</p>
                                    </div>
                                    <textarea
                                        value={currentAnswer}
                                        onChange={e => setCurrentAnswer(e.target.value)}
                                        placeholder="Normal konuşma diliyle cevap ver — AI sonra profesyonel metne çevirecek."
                                        rows={6}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                                        autoFocus
                                    />
                                    {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
                                    <div className="flex items-center justify-between mt-4">
                                        <button
                                            onClick={prevAnswer}
                                            disabled={fieldIdx === 0 && currentAnswerIdx === 0}
                                            className="text-sm font-medium text-slate-500 hover:text-slate-800 disabled:opacity-30 px-3 py-2 inline-flex items-center gap-1"
                                        >
                                            <ChevronLeft size={15} />
                                            Geri
                                        </button>
                                        <button
                                            onClick={nextAnswer}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg inline-flex items-center gap-1.5 shadow-sm shadow-indigo-200"
                                        >
                                            {currentAnswerIdx === currentQuestions.length - 1 ? (
                                                fieldIdx === FIELD_ORDER.length - 1 ? (
                                                    <>
                                                        <Sparkles size={15} />
                                                        Tümünü Üret
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles size={15} />
                                                        Sonraki Alan
                                                    </>
                                                )
                                            ) : (
                                                <>
                                                    Sonraki Soru
                                                    <ChevronRight size={15} />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {phase === 'synthesizing-field' && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
                            <Loader2 size={28} className="animate-spin text-indigo-500" />
                            <p className="text-sm">{currentMeta?.label} sentezleniyor...</p>
                        </div>
                    )}

                    {phase === 'review' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Sparkles size={16} className="text-indigo-500" />
                                <p className="text-sm font-semibold text-slate-800">Tüm alanlar hazır — incele, düzenle, kaydet.</p>
                            </div>
                            <p className="text-xs text-slate-500 mb-3">Her alanın metnini değiştirebilir veya "Tekrar Üret" ile AI'a yeniden yazdırabilirsin.</p>

                            {error && <p className="text-xs text-red-600">{error}</p>}

                            {FIELD_ORDER.map(fk => {
                                const meta = FIELD_META[fk];
                                return (
                                    <div key={fk} className="border border-slate-200 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm font-semibold text-slate-800">{meta.label}</p>
                                            <button
                                                onClick={() => regenerateField(fk)}
                                                disabled={loading}
                                                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 disabled:opacity-50"
                                            >
                                                <RefreshCw size={11} />
                                                Tekrar Üret
                                            </button>
                                        </div>
                                        <textarea
                                            value={drafts[fk] || ''}
                                            onChange={e => setDrafts(prev => ({ ...prev, [fk]: e.target.value }))}
                                            rows={6}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-700 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {phase === 'review' && (
                    <div className="border-t border-slate-100 px-5 py-3 bg-white flex items-center justify-end gap-2">
                        <button
                            onClick={() => { clearPersist(); onClose(); }}
                            className="text-sm font-medium text-slate-500 hover:text-slate-800 px-3 py-2"
                        >
                            İptal
                        </button>
                        <button
                            onClick={saveAll}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2 rounded-lg inline-flex items-center gap-1.5 shadow-sm shadow-indigo-200"
                        >
                            <Save size={15} />
                            Hepsini Kaydet
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PersonaFullWizard;
