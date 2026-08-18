import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SocialPost } from '../../../services/admin/socialMediaService';
import PostStatusBadge from './PostStatusBadge';

interface SocialCalendarGridProps {
    posts: SocialPost[];
    currentDate: Date;
    onDateChange: (date: Date) => void;
    onPostClick: (post: SocialPost) => void;
}

const PLATFORM_COLORS: Record<string, string> = {
    instagram: 'bg-pink-400',
    facebook: 'bg-blue-500',
    twitter: 'bg-black',
    linkedin: 'bg-blue-700',
    tiktok: 'bg-cyan-500',
};

const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export default function SocialCalendarGrid({ posts, currentDate, onDateChange, onPostClick }: SocialCalendarGridProps) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const calendarDays = useMemo(() => {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        let startDow = firstDay.getDay() - 1; // Mon=0
        if (startDow < 0) startDow = 6;

        const days: { date: Date; isCurrentMonth: boolean }[] = [];

        // Previous month padding
        for (let i = startDow - 1; i >= 0; i--) {
            const d = new Date(year, month, -i);
            days.push({ date: d, isCurrentMonth: false });
        }
        // Current month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push({ date: new Date(year, month, i), isCurrentMonth: true });
        }
        // Next month padding
        const remaining = 7 - (days.length % 7);
        if (remaining < 7) {
            for (let i = 1; i <= remaining; i++) {
                days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
            }
        }

        return days;
    }, [year, month]);

    const postsByDate = useMemo(() => {
        const map: Record<string, SocialPost[]> = {};
        posts.forEach(p => {
            if (!p.scheduled_for) return;
            const key = new Date(p.scheduled_for).toISOString().split('T')[0];
            if (!map[key]) map[key] = [];
            map[key].push(p);
        });
        return map;
    }, [posts]);

    const today = new Date().toISOString().split('T')[0];

    const prevMonth = () => onDateChange(new Date(year, month - 1, 1));
    const nextMonth = () => onDateChange(new Date(year, month + 1, 1));

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                    <ChevronLeft size={18} className="text-slate-500" />
                </button>
                <h3 className="text-sm font-semibold text-slate-800">
                    {MONTH_NAMES[month]} {year}
                </h3>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                    <ChevronRight size={18} className="text-slate-500" />
                </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-slate-100">
                {DAY_NAMES.map(d => (
                    <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold text-slate-400 uppercase">
                        {d}
                    </div>
                ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7">
                {calendarDays.map((day, i) => {
                    const key = day.date.toISOString().split('T')[0];
                    const dayPosts = postsByDate[key] || [];
                    const isToday = key === today;

                    return (
                        <div
                            key={i}
                            className={`min-h-[90px] md:min-h-[110px] p-1.5 border-b border-r border-slate-100 ${
                                !day.isCurrentMonth ? 'bg-slate-50/50' : ''
                            }`}
                        >
                            <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                                isToday ? 'bg-indigo-600 text-white' : day.isCurrentMonth ? 'text-slate-700' : 'text-slate-300'
                            }`}>
                                {day.date.getDate()}
                            </div>

                            <div className="space-y-0.5">
                                {dayPosts.slice(0, 3).map(post => (
                                    <button
                                        key={post.id}
                                        onClick={() => onPostClick(post)}
                                        className="w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer flex items-center gap-1"
                                    >
                                        <div className="flex gap-0.5 shrink-0">
                                            {post.platforms.slice(0, 2).map(pl => (
                                                <div key={pl} className={`w-1.5 h-1.5 rounded-full ${PLATFORM_COLORS[pl] || 'bg-slate-400'}`} />
                                            ))}
                                        </div>
                                        <span className="truncate">{post.title || post.caption.slice(0, 30)}</span>
                                    </button>
                                ))}
                                {dayPosts.length > 3 && (
                                    <div className="text-[10px] text-slate-400 px-1.5">+{dayPosts.length - 3} daha</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
