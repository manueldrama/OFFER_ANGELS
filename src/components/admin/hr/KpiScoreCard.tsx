// Çalışanın kendi KPI kartı — "Benim Sayfam"da tam, ana panelde özet hâliyle.
//
// NEDEN ORTAK BİLEŞEN: Aynı skor iki ekranda gösteriliyor. İki ayrı kopya
// olsaydı biri güncellenip diğeri unutulur, temsilci iki farklı sayı görürdü.
//
// TASARIM AMACI: Temsilciyi hareket ettiren mevcut skor değil, EŞİĞE NE KADAR
// KALDIĞIDIR. Bu yüzden halkanın yanında bonus eşiği çizgisi ve "şu puana
// ulaşırsan şu kadar" satırı var.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { withBase } from '../nav/navConfig';
import { usePanelBase } from '../../../contexts/PanelBaseContext';
import {
    bonusEligibility, computeBonus, resolveEmployeeBonus, COMPONENT_PURPOSE,
    type BonusScaleBand, type ComponentResult, type KpiScoreResult,
} from '../../../lib/hr/kpiScoring';
import type { CountryBonusDefault } from '../../../lib/hr/kpiScoring';
import type { HrKpiConfig } from '../../../types/hr';
import { HrCompanyService } from '../../../services/admin/hr/hrCompanyService';
import { hrMoney } from '../../../pages/admin/hr/_shared';

interface Props {
    score: KpiScoreResult;
    config: HrKpiConfig;
    /**
     * Çalışanın kendi profili — kişiye özel bonus tavanı varsa oradan okunur.
     * Verilmezse global varsayılan kullanılır.
     */
    employee?: {
        max_monthly_bonus?: number | null;
        bonus_currency?: string | null;
        /** Ülke bonus varsayılanının çözülmesi için (20260901a). */
        work_country?: string | null;
    } | null;
    /** compact: ana panel özeti (bileşen listesi yok, link var). */
    variant?: 'full' | 'compact';
}

/** Skora göre ton — bonus bantlarıyla uyumlu eşikler. */
function toneFor(score: number | null) {
    if (score == null) return { ring: '#94a3b8', text: 'text-slate-500', label: 'HENÜZ VERİ YOK', chip: 'bg-slate-100 text-slate-600' };
    if (score >= 95) return { ring: '#059669', text: 'text-emerald-600', label: 'MÜKEMMEL', chip: 'bg-emerald-100 text-emerald-700' };
    if (score >= 90) return { ring: '#10b981', text: 'text-emerald-600', label: 'ÇOK İYİ', chip: 'bg-emerald-100 text-emerald-700' };
    if (score >= 80) return { ring: '#f59e0b', text: 'text-amber-600', label: 'İYİ', chip: 'bg-amber-100 text-amber-700' };
    if (score >= 70) return { ring: '#f97316', text: 'text-orange-600', label: 'SINIRDA', chip: 'bg-orange-100 text-orange-700' };
    return { ring: '#e11d48', text: 'text-rose-600', label: 'GELİŞTİRİLMELİ', chip: 'bg-rose-100 text-rose-700' };
}

/**
 * SVG halka gösterge — 0-100 arası skoru yay olarak çizer.
 *
 * `size` compact varyant için küçülür: kart bir ızgara sütununa sığmalı,
 * halkanın kendisi kartın yüksekliğini belirlememeli.
 */
function ScoreRing({ score, color, size = 132 }: { score: number | null; color: string; size?: number }) {
    const pct = Math.max(0, Math.min(100, score ?? 0));
    const R = 52;
    const C = 2 * Math.PI * R;
    const scale = size / 132;
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg viewBox="0 0 132 132" className="w-full h-full -rotate-90">
                <circle cx="66" cy="66" r={R} fill="none" stroke="#e2e8f0" strokeWidth="11" />
                <circle
                    cx="66" cy="66" r={R} fill="none" stroke={color} strokeWidth="11"
                    strokeLinecap="round"
                    strokeDasharray={`${(pct / 100) * C} ${C}`}
                    style={{ transition: 'stroke-dasharray .5s ease' }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-bold text-slate-900 leading-none tabular-nums"
                    style={{ fontSize: `${Math.round(30 * scale)}px` }}>
                    {score != null ? Math.round(score) : '—'}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">/ 100</span>
            </div>
        </div>
    );
}

/** Bonus eşiği çubuğu — mevcut skor ve bonusun başladığı nokta. */
function ThresholdBar({ rounded, thresholdMin, color }: {
    rounded: number; thresholdMin: number; color: string;
}) {
    return (
        <div>
            <div className="relative h-2 rounded-full bg-slate-100">
                <div className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${Math.min(rounded, 100)}%`, background: color }} />
                <div className="absolute -top-1 h-4 w-[2px] bg-slate-400"
                    style={{ left: `${thresholdMin}%` }} />
            </div>
            <div className="relative mt-1 text-[11px] text-slate-400">
                <span>0</span>
                <span className="absolute -translate-x-1/2 whitespace-nowrap"
                    style={{ left: `${thresholdMin}%` }}>
                    bonus eşiği {thresholdMin}
                </span>
                <span className="absolute right-0">100</span>
            </div>
        </div>
    );
}

function ComponentRow({ c }: { c: ComponentResult }) {
    const pct = c.achievement != null ? c.achievement * 100 : 0;
    const bar = pct >= 100 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-500' : pct >= 40 ? 'bg-orange-500' : 'bg-rose-500';

    return (
        <div className={`grid grid-cols-12 gap-3 items-center px-5 py-3 border-t border-slate-100 ${c.na ? 'opacity-55' : ''}`}>
            <div className="col-span-12 sm:col-span-5">
                <p className="text-[13.5px] font-semibold text-slate-800">{c.label}</p>
                <p className="text-[11.5px] text-slate-400">{COMPONENT_PURPOSE[c.key]}</p>
            </div>

            <div className="col-span-8 sm:col-span-4">
                {c.na ? (
                    <span className="inline-block text-[11.5px] text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
                        bu ay ölçülecek kayıt yok
                    </span>
                ) : (
                    <>
                        <p className="text-[12.5px] text-slate-600 tabular-nums mb-1">
                            {c.numerator} / {c.denominator}
                            {c.targetRate ? <span className="text-slate-400"> · hedef %{c.targetRate}</span> : null}
                        </p>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                    </>
                )}
            </div>

            <div className="col-span-4 sm:col-span-3 text-right">
                {c.na ? (
                    <span className="text-slate-300 text-[15px]">—</span>
                ) : (
                    <span className="text-[17px] font-bold text-slate-900 tabular-nums">
                        {c.points.toFixed(1)}
                        <span className="text-[12px] text-slate-400 font-semibold"> / {c.weight}</span>
                    </span>
                )}
            </div>
        </div>
    );
}

export function KpiScoreCard({ score, config, employee, variant = 'full' }: Props) {
    const base = usePanelBase();
    const total = score.totalScore;
    const tone = toneFor(total);
    const scale = (config.bonus_scale ?? []) as BonusScaleBand[];

    // ÜLKE VARSAYILANI — kart kendi başına çözer.
    // Çağıranlar (ana panel, /team, KPI listesi) tam çalışan profili geçiyor;
    // her birine ayrı ülke sorgusu ekletmek üç yerde aynı kodu yazdırırdı.
    // Tek satırlık okuma, kur bilgisi yanlış göstermekten ucuz.
    const [countryDefault, setCountryDefault] = useState<CountryBonusDefault | null>(null);
    useEffect(() => {
        const cc = employee?.work_country;
        if (!cc) { setCountryDefault(null); return; }
        let cancelled = false;
        void HrCompanyService.forCountry(cc)
            .then(c => {
                if (cancelled) return;
                setCountryDefault(c ? {
                    max_monthly_bonus: c.max_monthly_bonus,
                    currency: c.default_currency,
                } : null);
            })
            .catch(() => { if (!cancelled) setCountryDefault(null); });
        return () => { cancelled = true; };
    }, [employee?.work_country]);

    // Zincir: kişiye özel → ülke → global. Çözüm tek yerde
    // (resolveEmployeeBonus) ki ekran ile prim hesabı farklı sayı üretmesin.
    const { maxBonus, currency, source } = useMemo(
        () => resolveEmployeeBonus(employee, config, countryDefault),
        [employee, config, countryDefault],
    );

    const bonus = useMemo(() => computeBonus({
        kpiScore: total,
        maxBonus,
        scale,
    }), [total, maxBonus, scale]);

    // Bonusun başladığı ilk eşik — çubuk üzerinde işaretlenir.
    const firstPayingBand = useMemo(
        () => [...scale].sort((a, b) => a.min - b.min).find(b => b.pct > 0) ?? null,
        [scale],
    );

    // Bir sonraki bant: "ne kadar kaldı" sorusunun cevabı.
    const rounded = total == null ? 0 : Math.round(total);
    const nextBand = useMemo(
        () => [...scale].sort((a, b) => a.min - b.min)
            .find(b => b.min > rounded && b.pct > bonus.eligibilityPct) ?? null,
        [scale, rounded, bonus.eligibilityPct],
    );

    const hasBonus = maxBonus > 0;

    // ── COMPACT — ana paneldeki ızgaraya giren DİKEY kart.
    //
    // Eskiden compact da full ile aynı yatay düzeni kullanıyordu: tam genişlik
    // kaplayan, 132px halkalı, üç paragraflık bir şerit. Panelin en üstünde
    // bir ekran boyu yer yiyordu ve asıl iş (hatırlatmalar, leadler) katlanın
    // altına düşüyordu. Burada kart bir sütuna sığar: halka küçülür, açıklama
    // metni düşer, bonus tek satıra iner.
    if (variant === 'compact') {
        return (
            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-4 flex flex-col items-center text-center gap-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 self-start">
                        Bu Ay KPI Durumum
                    </p>
                    <ScoreRing score={total} color={tone.ring} size={104} />
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${tone.chip}`}>
                        {tone.label}
                    </span>
                    {hasBonus && firstPayingBand && (
                        <div className="w-full mt-1">
                            <ThresholdBar rounded={rounded} thresholdMin={firstPayingBand.min} color={tone.ring} />
                        </div>
                    )}
                </div>

                {hasBonus && (
                    <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-center">
                        <p className="text-[12.5px] text-slate-700">
                            Bonus hakkınız <strong className="text-slate-900">%{bonus.eligibilityPct}</strong>
                            {' · '}
                            <strong className="text-slate-900">{hrMoney(bonus.finalBonus, currency)}</strong>
                        </p>
                        {nextBand && (
                            <p className="text-[12px] text-emerald-700 mt-0.5 font-medium">
                                {nextBand.min} puanda %{nextBand.pct} ({hrMoney(maxBonus * (nextBand.pct / 100), currency)})
                            </p>
                        )}
                    </div>
                )}

                {/* Kırılım "Benim Alanım > Özet"tedir; link bulunulan panel
                    tabanına çevrilir — temsilci /team'de kalır, yönetici
                    /admin'de. Sabit '/admin/me' olsaydı temsilci her
                    tıklamada yönlendirme sıçraması yaşardı. */}
                <Link to={withBase('/admin/me', base)}
                    className="mt-auto flex items-center justify-between px-4 py-2.5 border-t border-slate-100 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                    Bileşen kırılımını gör
                    <ArrowRight size={14} />
                </Link>
            </section>
        );
    }

    // ── FULL — /team özet sekmesi.
    return (
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-5">
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Bu Ay KPI Durumum
                    </p>
                    <p className="text-[12.5px] text-slate-500 mt-1 leading-relaxed">
                        Ay içinde canlı hesaplanır, ay kapanınca kesinleşir.
                        {score.appliedWeight > 0 && score.appliedWeight < 100 &&
                            ` Bu ay ${score.appliedWeight} puanlık bölüm ölçülebildi; skor 100'e göre ölçeklendi.`}
                    </p>

                    {hasBonus && firstPayingBand && (
                        <div className="mt-4">
                            <ThresholdBar rounded={rounded} thresholdMin={firstPayingBand.min} color={tone.ring} />
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-center gap-2">
                    <ScoreRing score={total} color={tone.ring} />
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${tone.chip}`}>
                        {tone.label}
                    </span>
                </div>
            </div>

            {/* Bileşen kırılımı KENDİ İÇİNDE kayar.
                Altı bileşen alt alta açıldığında kart iki ekran boyu oluyordu ve
                altındaki hiçbir şey görünmüyordu. Kırılım burada okunabilir
                kalır, sayfa da kartın esiri olmaz. */}
            {score.components.length > 0 && (
                <div className="max-h-[300px] overflow-y-auto">
                    {score.components.map(c => <ComponentRow key={c.key} c={c} />)}
                </div>
            )}

            {hasBonus && (
                <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                    <p className="text-[13.5px] text-slate-800">
                        Bu skorla performans bonusu hakkınız{' '}
                        <strong>%{bonus.eligibilityPct}</strong> — tahmini{' '}
                        <strong>{hrMoney(bonus.finalBonus, currency)}</strong>
                    </p>
                    {nextBand && (
                        <p className="text-[13px] text-emerald-700 mt-1 font-medium">
                            {nextBand.min} puana ulaşırsanız hakkınız %{nextBand.pct} olur
                            {' '}({hrMoney(maxBonus * (nextBand.pct / 100), currency)}).
                        </p>
                    )}
                    <p className="text-[11.5px] text-slate-400 mt-1.5">
                        Tahminidir. Kesin tutar ay kapanıp İK onayladığında belirlenir.
                        {/* Tavanın NEREDEN geldiği yazılır: yedi ülkeli bir
                            şirkette "bu rakam neden EUR" sorusunun cevabı
                            ekranda durmalı, İK'nın aklında değil. */}
                        {source === 'country' && ' Tavan: ülke varsayılanı.'}
                        {source === 'employee' && ' Tavan: kişiye özel.'}
                    </p>
                </div>
            )}
        </section>
    );
}

/** Eşik yüzdesini dışarıya da açar (ana panel rozeti gibi yerlerde işe yarar). */
export { bonusEligibility };
