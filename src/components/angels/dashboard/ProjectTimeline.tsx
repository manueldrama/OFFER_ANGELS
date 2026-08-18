// Proje durum akışı — dikey stepper. cancelled/disputed ayrı banner'la gösterilir.

import { Check } from 'lucide-react';
import { A } from '../AngelsShell';
import type { ProjectStatus } from '../../../types/angelsPlatform';

const FLOW: { key: ProjectStatus; label: string; hint?: string }[] = [
    { key: 'payment_pending', label: 'Payment Pending', hint: 'Awaiting payment via CAFEPASTE Angels' },
    { key: 'payment_received', label: 'Payment Received' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'content_submitted', label: 'Content Submitted' },
    { key: 'under_review', label: 'Under Review' },
    { key: 'completed', label: 'Completed' },
];

export function ProjectTimeline({ status }: { status: ProjectStatus }) {
    if (status === 'cancelled' || status === 'disputed') {
        return (
            <div
                className="rounded-xl px-4 py-3.5"
                style={{ background: A.redSoft, border: `1px solid ${A.redLine}` }}
            >
                <p style={{ color: A.redText, fontSize: 14, fontWeight: 600 }}>
                    {status === 'cancelled' ? 'This project was cancelled.' : 'This project is in dispute.'}
                </p>
                <p style={{ color: A.textMuted, fontSize: 12.5, marginTop: 3 }}>
                    The CAFEPASTE Angels team is handling the next steps.
                </p>
            </div>
        );
    }

    const idx = Math.max(0, FLOW.findIndex(s => s.key === (status === 'proposal_accepted' ? 'payment_pending' : status)));

    return (
        <div className="flex flex-col">
            {FLOW.map((step, i) => {
                const done = i < idx;
                const current = i === idx;
                return (
                    <div key={step.key} className="flex gap-3.5">
                        <div className="flex flex-col items-center">
                            <span
                                className="flex items-center justify-center rounded-full shrink-0"
                                style={{
                                    width: 22, height: 22,
                                    background: done ? A.red : current ? A.redSoft : A.surface,
                                    border: `1.5px solid ${done || current ? A.red : A.borderStrong}`,
                                }}
                            >
                                {done && <Check size={12} color="#fff" />}
                                {current && <span style={{ width: 7, height: 7, borderRadius: '50%', background: A.red }} />}
                            </span>
                            {i < FLOW.length - 1 && (
                                <span style={{ width: 1.5, flex: 1, minHeight: 18, background: done ? A.red : A.border }} />
                            )}
                        </div>
                        <div className="pb-4">
                            <p style={{
                                color: current ? A.text : done ? A.textSecondary : A.textGhost,
                                fontSize: 13.5, fontWeight: current ? 700 : 500, lineHeight: '22px',
                            }}>
                                {step.label}
                            </p>
                            {current && step.hint && (
                                <p style={{ color: A.textGhost, fontSize: 12 }}>{step.hint}</p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
