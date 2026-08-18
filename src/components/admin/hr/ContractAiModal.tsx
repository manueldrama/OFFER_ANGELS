import { useRef, useState } from 'react';
import { X, Sparkles, Upload, Loader2, AlertTriangle, FileText } from 'lucide-react';
import { HrContractAiService, type HrContractAiMode } from '../../../services/admin/hr/hrContractAiService';
import { importDocx, normalizeSampleText, SAMPLE_MAX_CHARS } from '../../../lib/hr/docxImport';
import type { ContractType, EngagementType, HrKpiConfig } from '../../../types/hr';
import { CONTRACT_TYPE_LABEL } from '../../../pages/admin/hr/_shared';

// AI ile sözleşme üretme modalı.
//
// ÜÇ MOD:
//   generate     — sıfırdan, mevzuat checklist'ine göre
//   from_sample  — İK'nın kendi örnek sözleşmesinden türeterek
//   improve      — editördeki mevcut metni rafine ederek
//
// Örnek sözleşme TARAYICIDA metne çevrilir; dosya sunucuya gitmez. Yalnızca
// çıkarılan metin AI isteğine eklenir ve şablonun source_sample alanına
// yazılır (hangi örnekten türediği sonradan görülebilsin).

interface Props {
    open: boolean;
    onClose: () => void;
    contractType: ContractType;
    /** null = ülke belirtilmemiş → TR profili ve Türkçe. */
    countryCode?: string | null;
    /** 'contractor' → iş kanunu yerine hizmet sözleşmesi çerçevesi. */
    engagementType?: EngagementType | null;
    kpiConfig: HrKpiConfig | null;
    /** Editördeki mevcut metin — "İyileştir" modu için. */
    currentHtml: string;
    onApply: (result: { title: string; bodyHtml: string; sampleText: string | null; warning: string | null }) => void;
}

const BTN_PRIMARY = 'px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2';
const BTN_GHOST = 'px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50';

export default function ContractAiModal({
    open, onClose, contractType, countryCode = null, engagementType = null,
    kpiConfig, currentHtml, onApply,
}: Props) {
    const [mode, setMode] = useState<HrContractAiMode>('generate');
    const [sampleText, setSampleText] = useState('');
    const [sampleName, setSampleName] = useState<string | null>(null);
    const [sampleNote, setSampleNote] = useState<string | null>(null);
    const [instructions, setInstructions] = useState('');
    const [includeBonus, setIncludeBonus] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    if (!open) return null;

    const handleFile = async (file: File | undefined) => {
        if (!file) return;
        setError(null);
        setBusy(true);
        try {
            const imported = await importDocx(file);
            setSampleText(imported.text);
            setSampleName(file.name);
            const notes: string[] = [];
            if (imported.truncated) notes.push(`Metin ${SAMPLE_MAX_CHARS.toLocaleString('tr-TR')} karaktere kırpıldı.`);
            if (imported.warnings.length) notes.push(`${imported.warnings.length} öğe dönüştürülemedi (resim/nesne olabilir).`);
            setSampleNote(notes.join(' ') || null);
            setMode('from_sample');
        } catch (e: any) {
            setError(e?.message || 'Dosya okunamadı.');
        } finally {
            setBusy(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const handlePaste = (raw: string) => {
        const { text, truncated } = normalizeSampleText(raw);
        setSampleText(text);
        setSampleName(null);
        setSampleNote(truncated ? `Metin ${SAMPLE_MAX_CHARS.toLocaleString('tr-TR')} karaktere kırpıldı.` : null);
    };

    const run = async () => {
        setError(null);
        setBusy(true);
        try {
            const result = await HrContractAiService.generate({
                mode,
                contractType,
                countryCode: countryCode || undefined,
                engagementType,
                sourceHtml: mode === 'improve' ? currentHtml : undefined,
                sampleText: mode === 'from_sample' ? sampleText : undefined,
                instructions: instructions.trim() || undefined,
                includeBonusClause: includeBonus,
                kpiConfig,
            });

            // Sızıntı denetimi: model yer tutucuları doldurmuş olabilir.
            const warning = result.placeholder_count === 0
                ? 'AI metinde hiç yer tutucu bırakmadı. Uydurma isim/tutar yazmış olabilir — göndermeden önce metni gözden geçirin.'
                : null;

            onApply({
                title: result.title,
                bodyHtml: result.body_html,
                sampleText: mode === 'from_sample' && sampleText ? sampleText : null,
                warning,
            });
            onClose();
        } catch (e: any) {
            setError(e?.message || 'AI üretimi başarısız.');
        } finally {
            setBusy(false);
        }
    };

    const canRun = !busy
        && (mode !== 'from_sample' || sampleText.trim().length > 200)
        && (mode !== 'improve' || currentHtml.replace(/<[^>]*>/g, '').trim().length > 0);

    const MODES: { key: HrContractAiMode; label: string; desc: string }[] = [
        { key: 'generate', label: 'Sıfırdan oluştur', desc: 'İş Kanunu zorunlu maddelerine göre yeni metin' },
        { key: 'from_sample', label: 'Örnekten türet', desc: 'Kendi sözleşmenizin üslubunu ve düzenini örnek alır' },
        { key: 'improve', label: 'Mevcut metni iyileştir', desc: 'Editördeki metnin yapısını koruyarak rafine eder' },
    ];

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-slate-900" />
                        <h3 className="text-sm font-semibold text-slate-900">
                            AI ile {CONTRACT_TYPE_LABEL[contractType]} Taslağı
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
                </div>

                <div className="p-5 space-y-5">
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[12px] text-amber-800 leading-relaxed">
                            <strong>Çıktı taslaktır.</strong> 4857 sayılı İş Kanunu'na tabi bir sözleşme hukukçu
                            incelemesi gerektirir. Şablon pasif oluşturulur; siz aktifleştirmeden hiçbir çalışana gönderilemez.
                            <br />
                            <span className="text-amber-700">
                                AI'ya çalışan bilgisi gönderilmez — metin yer tutucularla üretilir, gerçek veriler
                                gönderim anında tarayıcıda doldurulur.
                            </span>
                        </p>
                    </div>

                    <div className="space-y-2">
                        {MODES.map(m => (
                            <label key={m.key}
                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${mode === m.key ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                <input type="radio" checked={mode === m.key} onChange={() => setMode(m.key)} className="mt-0.5" />
                                <span>
                                    <span className="block text-sm font-medium text-slate-900">{m.label}</span>
                                    <span className="block text-[11px] text-slate-500">{m.desc}</span>
                                </span>
                            </label>
                        ))}
                    </div>

                    {mode === 'from_sample' && (
                        <div className="space-y-2 p-3 rounded-lg border border-slate-200 bg-slate-50">
                            <div className="flex items-center gap-2">
                                <button type="button" className={BTN_GHOST} onClick={() => fileRef.current?.click()} disabled={busy}>
                                    <Upload className="w-3.5 h-3.5 inline mr-1.5" />Word (.docx) yükle
                                </button>
                                <input ref={fileRef} type="file" accept=".docx" className="hidden"
                                    onChange={e => handleFile(e.target.files?.[0])} />
                                {sampleName && (
                                    <span className="text-[11px] text-slate-600 inline-flex items-center gap-1">
                                        <FileText className="w-3 h-3" />{sampleName}
                                    </span>
                                )}
                            </div>
                            <textarea
                                value={sampleText}
                                onChange={e => handlePaste(e.target.value)}
                                rows={6}
                                placeholder="…veya örnek sözleşme metnini buraya yapıştırın."
                                className="w-full text-[12px] p-2.5 border border-slate-200 rounded-lg outline-none focus:border-slate-900 font-mono"
                            />
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-500">
                                    {sampleText.length.toLocaleString('tr-TR')} karakter
                                    {sampleText.trim().length > 0 && sampleText.trim().length <= 200 && ' — en az 200 karakter gerekir'}
                                </span>
                                {sampleNote && <span className="text-amber-700">{sampleNote}</span>}
                            </div>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                Örnek metin AI'ya gönderilir ve şablonun kaynağı olarak saklanır. Başka bir şirketin
                                sözleşmesini yüklüyorsanız gizlilik/telif açısından bu bilinçli bir karar olmalıdır.
                                Örnekteki gerçek isim ve tutarlar metne taşınmaz, yerlerine yer tutucu konur.
                            </p>
                        </div>
                    )}

                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${includeBonus ? 'border-slate-900 bg-slate-50' : 'border-slate-200'} ${!kpiConfig ? 'opacity-50 pointer-events-none' : ''}`}>
                        <input type="checkbox" checked={includeBonus && !!kpiConfig}
                            onChange={e => setIncludeBonus(e.target.checked)} className="mt-0.5" />
                        <span>
                            <span className="block text-sm font-medium text-slate-900">Performans primi maddesi ekle</span>
                            <span className="block text-[11px] text-slate-500">
                                {kpiConfig
                                    ? 'KPI bileşenleri ve prim bantları sisteminizden okunup metne işlenir. Prim tavanı kişiye göre değiştiği için yer tutucu kalır.'
                                    : 'KPI yapılandırması bulunamadı — önce İK Ayarları\'ndan yapılandırın.'}
                            </span>
                        </span>
                    </label>

                    <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                            Ek talimat (opsiyonel)
                        </label>
                        <textarea
                            value={instructions}
                            onChange={e => setInstructions(e.target.value)}
                            rows={3}
                            placeholder="Örn: Uzaktan çalışma maddesi ekle. Rekabet yasağı 1 yıl ve sadece İstanbul için olsun."
                            className="w-full text-sm p-2.5 border border-slate-200 rounded-lg outline-none focus:border-slate-900"
                        />
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-[12px] text-rose-700">{error}</div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
                    <button onClick={onClose} className={BTN_GHOST} disabled={busy}>Vazgeç</button>
                    <button onClick={run} disabled={!canRun} className={BTN_PRIMARY}>
                        {busy
                            ? <><Loader2 className="w-4 h-4 animate-spin" />Üretiliyor…</>
                            : <><Sparkles className="w-4 h-4" />Taslağı Üret</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
