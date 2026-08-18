import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown } from 'lucide-react';

const LANGUAGES = [
    { code: 'tr', label: 'Türkçe' },
    { code: 'en', label: 'English' },
    { code: 'ru', label: 'Русский' },
    { code: 'ar', label: 'العربية' },
    { code: 'de', label: 'Deutsch' }
];

export function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    const currentLang = (i18n.language || 'tr').split('-')[0].toLowerCase();
    const currentLabel = LANGUAGES.find(l => l.code === currentLang)?.label || currentLang.toUpperCase();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const changeLanguage = (code: string) => {
        i18n.changeLanguage(code);
        setIsOpen(false);
    };

    const textColor = dark ? 'text-white/90 hover:text-white' : 'text-slate-700 hover:text-black';
    const bgColor = dark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-slate-200';
    const itemHover = dark ? 'hover:bg-white/10' : 'hover:bg-slate-100';

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold tracking-widest rounded-full border transition-all duration-300 ${dark ? 'border-white/10 hover:border-white/30 bg-white/5' : 'border-slate-200 hover:border-slate-300 bg-black/5'} ${textColor}`}
            >
                <Globe size={14} className={dark ? "opacity-70" : "opacity-50"} />
                <span className="uppercase">{currentLang}</span>
                <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className={`absolute right-0 top-full mt-2 w-32 rounded-xl border shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 ${bgColor}`}>
                    <div className="flex flex-col p-1">
                        {LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => changeLanguage(lang.code)}
                                className={`flex items-center px-3 py-2 text-[12px] font-medium rounded-lg transition-colors text-left ${currentLang === lang.code ? (dark ? 'bg-white/10 text-white' : 'bg-slate-100 text-black') : (dark ? 'text-white/70 ' + itemHover : 'text-slate-600 ' + itemHover)}`}
                            >
                                {lang.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
