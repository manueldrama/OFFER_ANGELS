import React from 'react';
import { Link } from 'react-router-dom';
import type { NavItem } from './navConfig';
import type { NavBadge } from './navBadges';

type Props = {
    item: NavItem;
    isActive: boolean;
    badge: NavBadge | null;
    /**
     * card   — kategorisi olmayan üst düzey satır; grup başlıklarıyla aynı kart dili.
     * nested — açılmış bir grubun içindeki satır. Kart DEĞİL: 15 item'lı bir grup
     *          açıldığında 15 kart üst üste binince menü okunamaz hale geliyor;
     *          iç satırlar sade tutulup kart dili yalnız üst düzeye bırakıldı.
     */
    variant: 'card' | 'nested';
    /** Mobil drawer'ı kapatır. Grup başlığı bunu ÇAĞIRMAZ, yalnız gezinme çağırır. */
    onNavigate: () => void;
    innerRef?: React.Ref<HTMLAnchorElement>;
};

export function SidebarItem({ item, isActive, badge, variant, onNavigate, innerRef }: Props) {
    const Icon = item.icon;
    const isCard = variant === 'card';

    const className = isCard
        ? `flex items-center gap-3 px-3 py-2.5 rounded-xl border text-[13px] font-medium transition-all duration-100 cursor-pointer ${
              isActive
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
          }`
        : `flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-100 cursor-pointer min-h-[38px] ${
              isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`;

    const iconClass = isActive
        ? 'text-white shrink-0'
        : isCard
          ? 'text-slate-400 shrink-0'
          : 'text-slate-300 shrink-0';

    const body = (
        <>
            <Icon size={isCard ? 17 : 15} className={iconClass} />
            <span className="flex-1 min-w-0 truncate">{item.label}</span>
        </>
    );

    if (item.external) {
        return (
            <a
                href={item.path}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onNavigate}
                className={className}
                title={item.label}
            >
                {body}
            </a>
        );
    }

    return (
        <Link
            to={badge ? badge.targetPath : item.path}
            ref={innerRef}
            onClick={onNavigate}
            className={className}
            title={item.label}
        >
            {body}
            {badge && (
                <span
                    className={`min-w-[20px] px-1.5 h-5 inline-flex items-center justify-center rounded-full text-[11px] font-semibold shrink-0 ${
                        badge.danger
                            ? isActive
                                ? 'bg-rose-400 text-rose-950'
                                : 'bg-rose-50 text-rose-600 border border-rose-100'
                            : isActive
                              ? 'bg-emerald-400 text-emerald-950'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    }`}
                    title={badge.title}
                >
                    {badge.count}
                </span>
            )}
        </Link>
    );
}
