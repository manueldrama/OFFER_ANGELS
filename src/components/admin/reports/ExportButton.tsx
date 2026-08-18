import React from 'react';

export function ExportButton({ data, filename, label = 'CSV İndir' }: { data: any[], filename: string, label?: string }) {
    const handleExport = () => {
        if (!data || data.length === 0) return;

        // Flatten the JS object array
        const keys = Object.keys(data[0]);
        const commaSeparatedString = [
            keys.join(','),
            ...data.map(row => keys.map(k => `"${String(row[k]).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([commaSeparatedString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);

        link.setAttribute("href", url);
        link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <button
            onClick={handleExport}
            disabled={!data || data.length === 0}
            className="px-3 py-1.5 bg-white border border-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-50 font-medium disabled:opacity-50"
        >
            {label}
        </button>
    );
}
