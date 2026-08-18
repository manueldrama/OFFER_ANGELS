/**
 * Helpers that bucket ISO timestamps according to Europe/Istanbul wall-clock,
 * so daily charts, hour-of-day heatmaps, and CSV exports match what the
 * operator sees on the local clock — independent of the browser timezone.
 */

const TZ = 'Europe/Istanbul';

const dateKeyFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

const hourFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', hour12: false,
});

const partsFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** YYYY-MM-DD in Europe/Istanbul. */
export function tzDateKey(iso: string | Date): string {
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    if (isNaN(d.getTime())) return '';
    return dateKeyFmt.format(d);
}

/** 0–23 hour in Europe/Istanbul. */
export function tzHour(iso: string | Date): number {
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    if (isNaN(d.getTime())) return 0;
    const h = hourFmt.format(d);
    const n = parseInt(h, 10);
    return Number.isFinite(n) ? n : 0;
}

/** 0=Sun … 6=Sat, in Europe/Istanbul. */
export function tzDow(iso: string | Date): number {
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    if (isNaN(d.getTime())) return 0;
    const parts = partsFmt.formatToParts(d);
    const wd = parts.find(p => p.type === 'weekday')?.value || '';
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}

export const TURKEY_DOW_LABELS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

const offsetFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    timeZoneName: 'longOffset',
});

function istanbulOffsetMs(at: Date): number {
    const parts = offsetFmt.formatToParts(at);
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+03:00';
    const m = /GMT([+-])(\d{1,2}):?(\d{2})?/.exec(tzName);
    if (!m) return 3 * 60 * 60_000;
    const sign = m[1] === '-' ? -1 : 1;
    const hh = parseInt(m[2], 10);
    const mm = m[3] ? parseInt(m[3], 10) : 0;
    return sign * (hh * 60 + mm) * 60_000;
}

/**
 * Returns the UTC `Date` instant corresponding to 00:00:00 Europe/Istanbul
 * wall-clock for (today - daysAgo). Independent of the browser timezone, so
 * "Bugün" / "7 Gün" windows are always anchored to the operator's local day
 * in Türkiye even if admin opens the panel from a VPN, mobile abroad, etc.
 */
export function istanbulMidnightUTC(daysAgo: number = 0): Date {
    const todayKey = dateKeyFmt.format(new Date());
    const [y, m, d] = todayKey.split('-').map(Number);
    const targetUTC = Date.UTC(y, m - 1, d - daysAgo);
    const offset = istanbulOffsetMs(new Date(targetUTC));
    return new Date(targetUTC - offset);
}
