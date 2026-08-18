import React, { useEffect, useState } from 'react';
import { X, Wand2, RefreshCw, Check, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { apiAssistanceService } from '../../../services/admin/aiAssistanceService';
import { FIELD_META, PersonaFieldKey } from './personaPrompts';

interface Props {
    fieldKey: PersonaFieldKey;
    currentValue: string;
    onApply: (text: string) => void;
    onClose: () => void;
}

type Phase = 'loading-questions' | 'interview' | 'synthesizing' | 'preview' | 'error';

function parseQuestions(raw: string): string[] {
    // Accept "1. ...", "1) ...", "- ..." style listings
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const qs: string[] = [];
    for (const ln of lines) {
        const m = ln.match(/^(?:\d+[.)]\s+|[-*]\s+)(.+)$/);
        if (m) qs.push(m[1].trim());
        else if (ln.endsWith('?')) qs.push(ln);
    }
    return qs.length > 0 ? qs : lines;
}

export const PersonaFieldWizard: React.FC<Props> = ({ fieldKey, currentValue, onApply, onClose }) => {
    const meta = FIELD_META[fieldKey];
    const [phase, setPhase] = useState<Phase>('loading-questions');
    const [questions, setQuestions] = useState<string[]>([]);
    const [answers, setAnswers] = useState<string[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [draft, setDraft] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string>(() => `wizard-${fieldKey}-${Date.now()}`);

    useEffect(() => { loadQuestions(); }, []);

    const loadQuestions = async () => {
        setPhase('loading-questions');
        setError(null);
        try {
            const userMsg = `${meta.questionPrompt}

Mevcut ${meta.label.toLowerCase()} alanı${currentValue.trim() ? ` zaten şu içerikle dolu (referans için):\n"""\n${currentValue.slice(0, 800)}\n"""\nBunu güncellemek/zenginleştirmek için sorular üret.` : ' boş — sıfırdan toplayacak şekilde soru üret.'}`;
            const res = await apiAssistanceService.askAi(userMsg, null, sessionId, [], 'sales');
            const qs = parseQuestions(res.answer);
            if (qs.length === 0) throw new Error('AI soru üretemedi.');
            setQuestions(qs);
            setAnswers(new Array(qs.length).fill(''));
            setCurrentIdx(0);
            setCurrentAnswer('');
            setPhase('interview');
        } catch (e: any) {
            setError(e?.message || 'Soru yüklenemedi');
            setPhase('error');
        }
    };

    const handleNext = () => {
        const updated = [...answers];
        updated[currentIdx] = currentAnswer.trim();
        setAnswers(updated);
        if (currentIdx < questions.length - 1) {
            setCurrentIdx(currentIdx + 1);
            setCurrentAnswer(updated[currentIdx + 1] || '');
        } else {
            synthesize(updated);
        }
    };

    const handleBack = () => {
        if (currentIdx === 0) return;
        const updated = [...answers];
        updated[currentIdx] = currentAnswer;
        setAnswers(updated);
        setCurrentIdx(currentIdx - 1);
        setCurrentAnswer(updated[currentIdx - 1] || '');
    };

    const synthesize = async (finalAnswers: string[]) => {
        setPhase('synthesizing');
        setError(null);
        try {
            const qa = questions
                .map((q, i) => `Soru ${i + 1}: ${q}\nCevap: ${finalAnswers[i] || '(boş)'}`)
                .join('\n\n');
            const userMsg = `${meta.synthesisPrompt}

GİRDİ Q&A:
${qa}`;
            // Yeni sessionId — her sentez bağımsız (10-mesaj limit'i tetiklemesin)
            const synthSessionId = `wizard-synth-${fieldKey}-${Date.now()}`;
            setSessionId(synthSessionId);
            const res = await apiAssistanceService.askAi(userMsg, null, synthSessionId, [], 'sales');
            setDraft(res.answer.trim());
            setPhase('preview');
        } catch (e: any) {
            setError(e?.message || 'Sentez başarısız');
            setPhase('error');
        }
    };

    const handleRegenerate = () => synthesize(answers);

    const handleUse = () => {
        onApply(draft);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-br from-indigo-600 to-violet-700 text-white">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                            <Wand2 size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-200">AI Wizard</p>
                            <p className="text-sm font-semibold truncate">{meta.label}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10" aria-label="Kapat">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5">
                    {phase === 'loading-questions' && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
                            <Loader2 size={28} className="animate-spin text-indigo-500" />
                            <p className="text-sm">AI senin için sorular hazırlıyor...</p>
                        </div>
                    )}

                    {phase === 'interview' && questions.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 transition-all"
                                        style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                                    />
                                </div>
                                <span className="text-xs font-medium text-slate-500">
                                    {currentIdx + 1} / {questions.length}
                                </span>
                            </div>

                            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-4">
                                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">Soru</p>
                                <p className="text-sm text-slate-800 font-medium leading-relaxed">{questions[currentIdx]}</p>
                            </div>

                            <textarea
                                value={currentAnswer}
                                onChange={e => setCurrentAnswer(e.target.value)}
                                placeholder="Cevabını normal konuşma diliyle yaz — AI sonra profesyonel metne çevirecek."
                                rows={6}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                                autoFocus
                            />

                            <div className="flex items-center justify-between mt-4">
                                <button
                                    onClick={handleBack}
                                    disabled={currentIdx === 0}
                                    className="text-sm font-medium text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-2"
                                >
                                    ← Geri
                                </button>
                                <button
                                    onClick={handleNext}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg inline-flex items-center gap-1.5 transition-colors shadow-sm shadow-indigo-200"
                                >
                                    {currentIdx === questions.length - 1 ? (
                                        <>
                                            <Sparkles size={15} />
                                            Üret
                                        </>
                                    ) : (
                                        <>
                                            Sonraki Soru
                                            <ChevronRight size={15} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {phase === 'synthesizing' && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
                            <Loader2 size={28} className="animate-spin text-indigo-500" />
                            <p className="text-sm">AI cevaplarını profesyonel metne sentezliyor...</p>
                        </div>
                    )}

                    {phase === 'preview' && (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles size={15} className="text-indigo-500" />
                                <p className="text-sm font-semibold text-slate-800">Önizleme</p>
                            </div>
                            <p className="text-xs text-slate-500 mb-3">Beğendiysen "Kullan" — istediğin gibi değiştirebilir veya tekrar üretebilirsin.</p>

                            <textarea
                                value={draft}
                                onChange={e => setDraft(e.target.value)}
                                rows={14}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono text-slate-800 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                            />

                            <div className="flex items-center gap-2 mt-4 justify-end">
                                <button
                                    onClick={onClose}
                                    className="text-sm font-medium text-slate-500 hover:text-slate-800 px-3 py-2"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleRegenerate}
                                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg inline-flex items-center gap-1.5"
                                >
                                    <RefreshCw size={14} />
                                    Tekrar Üret
                                </button>
                                <button
                                    onClick={handleUse}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2 rounded-lg inline-flex items-center gap-1.5 shadow-sm shadow-indigo-200"
                                >
                                    <Check size={15} />
                                    Kullan
                                </button>
                            </div>
                        </div>
                    )}

                    {phase === 'error' && (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                            <p className="text-sm font-semibold text-red-700 mb-1">Hata</p>
                            <p className="text-xs text-red-600 mb-3">{error}</p>
                            <button
                                onClick={loadQuestions}
                                className="text-sm font-semibold text-red-700 hover:text-red-800 underline"
                            >
                                Tekrar dene
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PersonaFieldWizard;
