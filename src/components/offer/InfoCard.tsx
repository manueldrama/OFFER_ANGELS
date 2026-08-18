import React from 'react';
import { LucideIcon } from 'lucide-react';

interface InfoCardProps {
    icon: LucideIcon;
    label: string;
    title: string;
    subText: string;
    progressPercentage?: number;
    highlightSubtext?: boolean;
}

const InfoCard = ({
    icon: Icon,
    label,
    title,
    subText,
    progressPercentage,
    highlightSubtext
}: InfoCardProps) => {
    return (
        <div className="p-3 bg-white rounded-md border border-slate-200 shadow-sm flex flex-col gap-2 relative overflow-hidden group hover:border-primary/20 transition-colors">
            <div className="flex items-center gap-1.5 text-slate-500">
                <Icon size={14} className="group-hover:text-primary transition-colors" />
                <span className="text-[10px] uppercase font-bold tracking-wide truncate">{label}</span>
            </div>

            <div className="mt-auto">
                {progressPercentage !== undefined ? (
                    <>
                        <div className="flex justify-between items-baseline mb-1.5">
                            <span className="text-sm font-bold block text-slate-900">{title}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{subText}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${progressPercentage}%` }}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <span className="text-sm font-bold block text-slate-900 truncate mb-0.5">{title}</span>
                        <span className={`text-[10px] font-medium ${highlightSubtext ? 'text-green-600' : 'text-slate-500'}`}>
                            {subText}
                        </span>
                    </>
                )}
            </div>
        </div>
    );
};

export default InfoCard;
