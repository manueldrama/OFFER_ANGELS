// Görev yüzeyinin tasarım sabitleri — Linear/Asana kompozisyon dili,
// CAFEPASTE paleti: kılcal çizgiler (slate-200), 8-12px dolgular, 6-12px
// radius, düşük font ağırlıkları, süs yok. Sınıf çorbası TEK kaynaktan;
// composer/çekmece/filtre çubuğu buradan tüketir.

/** Kompakt özellik pill'i (composer + çekmece): h-7, kılcal çizgi. */
export const PILL =
    'h-7 px-2 rounded-md border border-slate-200 hover:border-slate-300 bg-white ' +
    'text-[12px] font-medium text-slate-600 inline-flex items-center gap-1.5 ' +
    'cursor-pointer transition-colors whitespace-nowrap';

/** Dolu (seçili) pill — değer taşıyan hâl. */
export const PILL_ACTIVE =
    'h-7 px-2 rounded-md border border-slate-300 bg-slate-50 ' +
    'text-[12px] font-medium text-slate-800 inline-flex items-center gap-1.5 ' +
    'cursor-pointer transition-colors whitespace-nowrap';

/** Pill altındaki açılır menü paneli. */
export const MENU_PANEL =
    'absolute left-0 top-full mt-1 z-[70] rounded-lg border border-slate-200 ' +
    'shadow-xl bg-white py-1 min-w-[180px]';

/** Menü satırı. */
export const MENU_ITEM =
    'w-full px-3 py-1.5 text-left text-[12.5px] text-slate-700 hover:bg-slate-50 ' +
    'inline-flex items-center gap-2 cursor-pointer';

/** Hayalet düğme (Vazgeç, ikincil aksiyonlar). */
export const GHOST_BTN =
    'h-8 px-3 rounded-md text-[12.5px] font-medium text-slate-500 ' +
    'hover:bg-slate-100 hover:text-slate-700 cursor-pointer transition-colors ' +
    'inline-flex items-center gap-1.5';

/** Birincil düğme — marka kırmızısı, kompakt. */
export const PRIMARY_BTN =
    'h-9 px-4 rounded-md bg-primary hover:bg-primary-dark text-white ' +
    'text-[13px] font-semibold cursor-pointer transition-colors ' +
    'inline-flex items-center gap-1.5 disabled:opacity-40';

/** Kompakt select/input (filtre çubuğu). */
export const COMPACT_SELECT =
    'h-8 border border-slate-200 rounded-md px-2.5 text-[12.5px] outline-none ' +
    'focus:border-slate-400 bg-white text-slate-700';
