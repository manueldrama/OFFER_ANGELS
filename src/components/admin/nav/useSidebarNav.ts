import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    navGroups, isNavItemActive, isNavItemVisible, applyGroupOrder, toCanonicalPath,
    type NavGroup,
} from './navConfig';

const STORAGE_KEY = 'cafepaste_admin_nav_open_groups';
const ORDER_KEY = 'cafepaste_admin_nav_group_order';

function readStoredKeys(key: string): string[] | null {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : null;
    } catch {
        return null;
    }
}


type Params = {
    role: string | null;
    canAccess: (role: string | null, pageKey: string) => boolean;
    pathname: string;
    searchQuery: string;
};

/**
 * Sol menünün tüm türetilmiş durumu tek yerde.
 *
 * Menü ~14 grup / ~100 satır taşıyor; hepsi birden açıkken sidebar 4-5 ekran
 * boyunca kayıyordu. Burada iki şey yapılıyor:
 *   1) İZİN FİLTRESİ  — rolün göremeyeceği item'lar ve item'ı kalmayan gruplar düşer.
 *      Bu filtre hem panelin hem ikon rayının TEK kaynağıdır; ikisi ayrışırsa
 *      ray'da tıklandığında boş açılan grup çıkardı.
 *   2) KATLAMA DURUMU — yalnız aktif grup açık başlar, tercih localStorage'da kalır.
 */
export function useSidebarNav({ role, canAccess, pathname, searchQuery }: Params) {
    // Kullanıcının sürükleyerek belirlediği grup sırası.
    const [groupOrder, setGroupOrderState] = useState<string[]>(() => readStoredKeys(ORDER_KEY) ?? []);

    useEffect(() => {
        try {
            if (groupOrder.length === 0) localStorage.removeItem(ORDER_KEY);
            else localStorage.setItem(ORDER_KEY, JSON.stringify(groupOrder));
        } catch {
            /* kota dolu / private mode — sıra kalıcı olmasa da menü çalışır */
        }
    }, [groupOrder]);

    const setGroupOrder = useCallback((keys: string[]) => setGroupOrderState(keys), []);
    /** Varsayılana dön: kayıt silinir, navConfig'teki kod sırası geri gelir. */
    const resetGroupOrder = useCallback(() => setGroupOrderState([]), []);

    // ── 1) İzin filtresi ────────────────────────────────────────────────────
    const permittedGroups: NavGroup[] = useMemo(() => {
        const allowed = navGroups
            .map((group) => ({
                ...group,
                // Kural navConfig'te — sayfa içi kısayol ızgaraları da aynısını
                // kullanır; kopyalanırsa iki yer ayrışır.
                items: group.items.filter((item) => isNavItemVisible(item, role, canAccess)),
            }))
            .filter((group) => group.items.length > 0);
        return applyGroupOrder(allowed, groupOrder);
    }, [role, canAccess, groupOrder]);

    // ── 2) Aktif grup ───────────────────────────────────────────────────────
    // Adres /team tabanında olabilir; menü yolları kanonik (/admin) uzayda
    // yazılı. Karşılaştırmadan önce kanonikleştirilir — aksi hâlde çalışan
    // panelinde hiçbir grup aktif görünmezdi.
    const canonicalPath = toCanonicalPath(pathname);
    const activeGroupKey = useMemo(() => {
        const found = permittedGroups.find((group) =>
            group.items.some((item) => isNavItemActive(item, group.key, canonicalPath))
        );
        return found?.key ?? null;
    }, [permittedGroups, canonicalPath]);

    // ── 3) Arama filtresi ───────────────────────────────────────────────────
    // Grup ETİKETİ de eşleşme sayılır ("finans" yazınca tüm Finans grubu gelsin).
    const query = searchQuery.trim().toLocaleLowerCase('tr');
    const searching = query.length > 0;

    const displayGroups: NavGroup[] = useMemo(() => {
        if (!searching) return permittedGroups;
        return permittedGroups
            .map((group) => {
                const groupLabel = (group.label ?? '').toLocaleLowerCase('tr');
                if (groupLabel.includes(query)) return group;
                return {
                    ...group,
                    items: group.items.filter((item) =>
                        item.label.toLocaleLowerCase('tr').includes(query)
                    ),
                };
            })
            .filter((group) => group.items.length > 0);
    }, [permittedGroups, searching, query]);

    // ── 4) Katlama durumu ───────────────────────────────────────────────────
    const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
        const stored = readStoredKeys(STORAGE_KEY);
        if (stored) return new Set(stored);
        return new Set<string>();
    });

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...openGroups]));
        } catch {
            /* kota dolu / private mode — katlama tercihi kalıcı olmasa da menü çalışır */
        }
    }, [openGroups]);

    // Rota değişince o rotanın grubu kendiliğinden açılır. Diğerleri KAPANMAZ:
    // kullanıcı bilerek iki grubu birden açık bıraktıysa o tercih korunur.
    const lastOpenedForRoute = useRef<string | null>(null);
    useEffect(() => {
        if (!activeGroupKey) return;
        if (lastOpenedForRoute.current === activeGroupKey) return;
        lastOpenedForRoute.current = activeGroupKey;
        setOpenGroups((prev) => (prev.has(activeGroupKey) ? prev : new Set(prev).add(activeGroupKey)));
    }, [activeGroupKey]);

    const isGroupOpen = useCallback(
        (group: NavGroup) => {
            // Başlıksız kök grup (Kontrol Paneli / Canlı İzleme) katlanmaz.
            if (group.label === null) return true;
            // Arama sırasında katlama durumu yok sayılır; eşleşen her grup açılır.
            if (searching) return true;
            return openGroups.has(group.key);
        },
        [openGroups, searching]
    );

    // Başlık tıklaması: serbest toggle — birden fazla grup açık kalabilir.
    const toggleGroup = useCallback((key: string) => {
        setOpenGroups((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }, []);

    return {
        permittedGroups,
        displayGroups,
        activeGroupKey,
        searching,
        isGroupOpen,
        toggleGroup,
        groupOrder,
        setGroupOrder,
        resetGroupOrder,
    };
}
