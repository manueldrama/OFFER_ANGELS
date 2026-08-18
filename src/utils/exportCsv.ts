/**
 * Convert an array of plain objects to a CSV blob and trigger a browser download.
 * Quotes any field that contains a comma, newline, double-quote, or starts with =/+/-/@
 * (RFC 4180 + spreadsheet-injection guard).
 */
export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>, columns?: string[]): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!rows.length) {
        const blob = new Blob([''], { type: 'text/csv;charset=utf-8;' });
        triggerDownload(filename, blob);
        return;
    }
    const cols = columns || Object.keys(rows[0]);
    const lines: string[] = [];
    lines.push(cols.map(escapeCell).join(','));
    for (const r of rows) {
        lines.push(cols.map(c => escapeCell(r[c])).join(','));
    }
    // BOM so Excel opens UTF-8 correctly.
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(filename, blob);
}

function escapeCell(v: unknown): string {
    if (v == null) return '';
    let s = String(v);
    // Defuse formula injection.
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function triggerDownload(filename: string, blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
