import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, ArrowRight, X } from 'lucide-react';

// Her admin sayfasının üstünde duran hatırlatma bandı: gecikmiş (vakti geçmiş)
// hatırlatma varsa operatör panele girer girmez kırmızı bir uyarı görür.
// WhatsAppHealthBanner ile birebir aynı kalıp — kapatılabilir, ama gecikmiş
// sayısı ARTINCA tekrar belirir (yeni gecikme gözden kaçmasın).

const DISMISS_KEY = 'cafepaste_reminder_due_dismissed_count';

function readDismissed(): number {
    try { return Number(sessionStorage.getItem(DISMISS_KEY) || '0'); } catch { return 0; }
}

export function RemindersDueBanner({ dueCount, loading }: { dueCount: number; loading: boolean }) {
    const [dismissedCount, setDismissedCount] = useState<number>(readDismissed);

    const visible = !loading && dueCount > 0 && dueCount > dismissedCount;
    if (!visible) return null;

    const dismiss = () => {
        setDismissedCount(dueCount);
        try { sessionStorage.setItem(DISMISS_KEY, String(dueCount)); } catch { /* sessiz geç */ }
    };

    return (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 shadow-sm">
            <div className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                    <AlarmClock size={17} />
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-[13px] font-semibold text-rose-900">Bekleyen hatırlatma</span>
                        <span className="text-[13px] text-rose-700">
                            <strong className="font-semibold">{dueCount}</strong> hatırlatmanın zamanı geldi/geçti.
                        </span>
                    </div>
                    <Link
                        to="/admin/reminders?filter=overdue"
                        className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-rose-700 hover:text-rose-900 transition-colors"
                    >
                        Hatırlatmaları aç
                        <ArrowRight size={13} />
                    </Link>
                </div>

                <button
                    onClick={dismiss}
                    aria-label="Uyarıyı kapat"
                    title="Kapat (yeni gecikmede tekrar görünür)"
                    className="shrink-0 rounded-md p-1 text-rose-400 hover:bg-rose-100 hover:text-rose-700 transition-colors"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}
