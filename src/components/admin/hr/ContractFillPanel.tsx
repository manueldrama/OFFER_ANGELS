import { useMemo, useState } from 'react';
import { UserCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
    buildHrContractVars, fillContractPlaceholders, type PlaceholderDef,
} from '../../../lib/hr/contractPlaceholders';
import { employeeDisplayName, type HrEmployeeWithUser, type HrKpiConfig } from '../../../types/hr';
import { HrCompanyService } from '../../../services/admin/hr/hrCompanyService';

// "Çalışan Seç ve Doldur" — şablonu final metne çevirir.
//
// ŞABLON BOZULMAZ: doldurma her zaman metnin bir KOPYASI üzerinde çalışır;
// sonuç çağıran ekrana verilir, şablon kaydı değişmez.
//
// EKSİK ALAN GİZLENMEZ: doldurulamayan yer tutucu metinde OLDUĞU GİBİ kalır ve
// burada listelenir. Sessizce boş bırakılsaydı "T.C. Kimlik No: " satırı imzaya
// öyle giderdi.

interface Props {
    employees: HrEmployeeWithUser[];
    kpiConfig: HrKpiConfig | null;
    templateHtml: string;
    /** Doldurulmuş metin + kullanılan değerlerin snapshot'ı. */
    onFilled: (result: {
        html: string;
        vars: Record<string, string>;
        employee: HrEmployeeWithUser;
        missing: PlaceholderDef[];
    }) => void;
    actionLabel?: string;
}

export default function ContractFillPanel({
    employees, kpiConfig, templateHtml, onFilled, actionLabel = 'Doldur',
}: Props) {
    const [employeeId, setEmployeeId] = useState('');
    const [missing, setMissing] = useState<PlaceholderDef[] | null>(null);
    const [filledFor, setFilledFor] = useState<string | null>(null);

    const selected = useMemo(
        () => employees.find(e => e.employee_id === employeeId) ?? null,
        [employees, employeeId],
    );

    const hasBody = !!templateHtml?.replace(/<[^>]*>/g, '').trim();

    const [running, setRunning] = useState(false);

    const run = async () => {
        if (!selected) return;
        setRunning(true);
        try {
            // İşveren kişinin ÜLKESİNDEN çözülür — global tek şirketten değil.
            // Kayıt yoksa null gider ve şirket alanları eksik olarak listelenir.
            const company = await HrCompanyService.forCountry(selected.work_country).catch(() => null);
            const vars = buildHrContractVars({ employee: selected, kpiConfig, company });
            const { html, missing: left } = fillContractPlaceholders(templateHtml, vars);
            setMissing(left);
            setFilledFor(selected.employee_id);
            onFilled({ html, vars, employee: selected, missing: left });
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className="border border-slate-200 rounded-lg bg-white">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-slate-500" />
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Çalışan Seç ve Doldur
                </h4>
            </div>

            <div className="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={employeeId}
                        onChange={e => { setEmployeeId(e.target.value); setMissing(null); setFilledFor(null); }}
                        className="flex-1 min-w-[200px] text-sm px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-slate-900 bg-white"
                    >
                        <option value="">Çalışan seçin…</option>
                        {employees.map(e => (
                            <option key={e.employee_id} value={e.employee_id}>
                                {employeeDisplayName(e)}{e.job_title ? ` — ${e.job_title}` : ''}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button" onClick={() => void run()} disabled={!selected || !hasBody || running}
                        className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {actionLabel}
                    </button>
                </div>

                {!hasBody && (
                    <p className="text-[11px] text-slate-500">Önce sözleşme metnini yazın veya AI ile üretin.</p>
                )}

                {missing !== null && filledFor === employeeId && (
                    missing.length === 0 ? (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <p className="text-[12px] text-emerald-800">
                                Tüm alanlar dolduruldu. Metin gönderime hazır.
                            </p>
                        </div>
                    ) : (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-[12px] text-amber-800">
                                <p className="font-semibold mb-1">
                                    {missing.length} alan doldurulamadı — bu bilgiler sistemde kayıtlı değil:
                                </p>
                                <ul className="list-disc pl-4 space-y-0.5">
                                    {missing.map(p => <li key={p.token}>{p.description}</li>)}
                                </ul>
                                <p className="mt-2 text-amber-700">
                                    Personel kartından bu bilgileri girip tekrar doldurabilir, ya da metinde
                                    kalan yer tutucuları elle düzeltebilirsiniz. Düzeltilmezse sözleşmede
                                    <code className="mx-1 px-1 bg-amber-100 rounded">{'{{...}}'}</code>
                                    olarak görünür.
                                </p>
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
