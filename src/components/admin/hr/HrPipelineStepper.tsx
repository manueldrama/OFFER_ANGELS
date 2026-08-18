import { Check, type LucideIcon } from 'lucide-react';

export interface PipelineStep {
    key: string;
    label: string;
    icon: LucideIcon;
}

interface Props {
    steps: PipelineStep[];
    /** Hattın üzerindeki mevcut adım. Hat dışı bir durumdaysa (reddedildi) `null` verilir. */
    currentKey: string | null;
    /**
     * Hat dışı sonlanma — "Reddedildi" / "Vazgeçti". Verildiğinde hat soluklaşır
     * ve sağda sebebiyle birlikte rozet gösterilir.
     */
    terminal?: { label: string; reason?: string | null } | null;
    /**
     * Verilirse adımlar TIKLANABİLİR olur — hem ileri hem GERİ.
     *
     * Geri alma neden gerekli: hat tek yönlüydü ve yanlışlıkla ilerletilen bir
     * aday geri çekilemiyordu; tek çare veritabanına elle dokunmaktı. Onay
     * sorma sorumluluğu çağırana aittir (durum değişikliği hr_candidate_events'e
     * yazılır, yani geri alma da geçmişte iz bırakır).
     */
    onStepClick?: (key: string) => void;
}

/**
 * Aday hattının görsel ilerlemesi.
 *
 * Eski drawer'da hat yalnızca "sonraki aşamaya geçir" butonundan ibaretti:
 * adayın nerede olduğu, kaç adım kaldığı hiç görünmüyordu. Görsel dil
 * ServiceRequestDetail'deki durum çubuğuyla aynı — iki ekran arasında
 * kullanıcının yeniden öğrenmesi gereken bir şey olmasın.
 */
export function HrPipelineStepper({ steps, currentKey, terminal, onStepClick }: Props) {
    const currentIndex = currentKey ? steps.findIndex(s => s.key === currentKey) : -1;
    const isTerminal = !!terminal;

    // Çizgi, ilk ve son dairenin MERKEZLERİ arasında uzanır. Her adım eşit
    // genişlikte bir sütun olduğu için merkezler kenarlardan yarım sütun içeride.
    const half = 100 / steps.length / 2;
    const span = 100 - 2 * half;
    const progress = currentIndex > 0 ? (currentIndex / (steps.length - 1)) * span : 0;

    return (
        <div className={`rounded-xl border border-slate-200 bg-white px-5 py-4 ${isTerminal ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-4">
                <div className="relative flex items-center justify-between flex-1 min-w-0">
                    <div
                        className="absolute top-4 h-0.5 bg-slate-100"
                        style={{ left: `${half}%`, right: `${half}%` }}
                    />
                    {!isTerminal && progress > 0 && (
                        <div
                            className="absolute top-4 h-0.5 bg-indigo-500 transition-all duration-500"
                            style={{ left: `${half}%`, width: `${progress}%` }}
                        />
                    )}

                    {steps.map((step, i) => {
                        const isCurrent = !isTerminal && i === currentIndex;
                        const isCompleted = !isTerminal && currentIndex > i;
                        const Icon = step.icon;

                        return (
                            <div key={step.key} className="relative z-10 flex flex-col items-center flex-1 min-w-0">
                                <button
                                    type="button"
                                    disabled={!onStepClick || isCurrent}
                                    onClick={() => onStepClick?.(step.key)}
                                    title={onStepClick && !isCurrent ? `${step.label} aşamasına al` : undefined}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                        onStepClick && !isCurrent ? 'cursor-pointer hover:ring-4 hover:ring-slate-100' : ''
                                    } ${
                                        isCurrent
                                            ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                                            : isCompleted
                                                ? 'bg-emerald-500 text-white'
                                                : 'bg-slate-100 text-slate-400'
                                    }`}>
                                    {isCompleted ? <Check size={14} /> : <Icon size={14} />}
                                </button>
                                <span className={`text-[10.5px] mt-1.5 font-medium text-center truncate max-w-full px-1 ${
                                    isCurrent ? 'text-indigo-700 font-bold'
                                        : isCompleted ? 'text-emerald-700' : 'text-slate-400'
                                }`}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {terminal && (
                    <div className="shrink-0 max-w-[220px] text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-rose-50 text-rose-700 border-rose-200">
                            {terminal.label}
                        </span>
                        {terminal.reason && (
                            <p className="text-[11.5px] text-slate-500 mt-1 line-clamp-2">{terminal.reason}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
