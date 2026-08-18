import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import type { WhatsAppFailureAlert } from '../../hooks/useWhatsAppFailureAlert';

// Her admin sayfasının üstünde duran global sağlık bandı. WhatsApp gönderimi
// sessizce çökerse (token süresi, şablon hatası vb.) operatör panele girer
// girmez kırmızı bir uyarı görür. Kapatılabilir; ancak YENİ başarısızlık
// geldiğinde (count artınca) yeniden belirir — böylece sorun gözden kaçmaz.

const DISMISS_KEY = 'cafepaste_wa_fail_dismissed_count';

function readDismissed(): number {
    try {
        return Number(sessionStorage.getItem(DISMISS_KEY) || '0');
    } catch {
        return 0;
    }
}

/** error_message genelde Meta'nın uzun JSON/cümlesi — kısa ve okunur tut. */
function shortError(raw: string | null): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    // Meta hata kodu (#190, #132000 ...) varsa öne çıkar.
    const codeMatch = trimmed.match(/\(?#(\d{3,6})\)?/);
    const code = codeMatch ? `#${codeMatch[1]} · ` : '';
    const text = trimmed.length > 140 ? trimmed.slice(0, 140) + '…' : trimmed;
    return code + text;
}

export function WhatsAppHealthBanner({ alert }: { alert: WhatsAppFailureAlert }) {
    const [dismissedCount, setDismissedCount] = useState<number>(readDismissed);

    // Yeni başarısızlık geldiyse (count > kapatılan sayı) tekrar göster.
    const visible = !alert.loading && alert.count > 0 && alert.count > dismissedCount;
    if (!visible) return null;

    const dismiss = () => {
        setDismissedCount(alert.count);
        try {
            sessionStorage.setItem(DISMISS_KEY, String(alert.count));
        } catch {
            /* sessionStorage yoksa sessiz geç */
        }
    };

    const errLine = shortError(alert.lastError);

    return (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 shadow-sm">
            <div className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                    <AlertTriangle size={17} />
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-[13px] font-semibold text-rose-900">
                            WhatsApp gönderim sorunu
                        </span>
                        <span className="text-[13px] text-rose-700">
                            Son 24 saatte <strong className="font-semibold">{alert.count}</strong> mesaj müşterilere ulaşmadı.
                        </span>
                    </div>

                    {errLine && (
                        <p className="mt-1 truncate text-[12px] text-rose-600/90" title={alert.lastError ?? undefined}>
                            Son hata{alert.lastTemplate ? ` (${alert.lastTemplate})` : ''}: {errLine}
                        </p>
                    )}

                    <Link
                        to="/admin/whatsapp?status=failed"
                        className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-rose-700 hover:text-rose-900 transition-colors"
                    >
                        Gönderim loglarını aç
                        <ArrowRight size={13} />
                    </Link>
                </div>

                <button
                    onClick={dismiss}
                    aria-label="Uyarıyı kapat"
                    title="Kapat (yeni başarısızlıkta tekrar görünür)"
                    className="shrink-0 rounded-md p-1 text-rose-400 hover:bg-rose-100 hover:text-rose-700 transition-colors"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}
