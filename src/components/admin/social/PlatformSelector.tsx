import React from 'react';

const PLATFORMS = [
    { key: 'instagram', label: 'Instagram', color: 'bg-gradient-to-r from-purple-500 to-pink-500', textColor: 'text-white' },
    { key: 'facebook', label: 'Facebook', color: 'bg-blue-600', textColor: 'text-white' },
    { key: 'twitter', label: 'X (Twitter)', color: 'bg-black', textColor: 'text-white' },
    { key: 'linkedin', label: 'LinkedIn', color: 'bg-blue-700', textColor: 'text-white' },
    { key: 'tiktok', label: 'TikTok', color: 'bg-gradient-to-r from-cyan-500 to-pink-500', textColor: 'text-white' },
] as const;

interface PlatformSelectorProps {
    selected: string[];
    onChange: (platforms: string[]) => void;
    disabled?: boolean;
}

export default function PlatformSelector({ selected, onChange, disabled }: PlatformSelectorProps) {
    const toggle = (key: string) => {
        if (disabled) return;
        onChange(
            selected.includes(key)
                ? selected.filter(k => k !== key)
                : [...selected, key]
        );
    };

    return (
        <div className="flex flex-wrap gap-2">
            {PLATFORMS.map(p => {
                const active = selected.includes(p.key);
                return (
                    <button
                        key={p.key}
                        type="button"
                        onClick={() => toggle(p.key)}
                        disabled={disabled}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 border cursor-pointer ${
                            active
                                ? `${p.color} ${p.textColor} border-transparent shadow-sm`
                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {p.label}
                    </button>
                );
            })}
        </div>
    );
}

export { PLATFORMS };
