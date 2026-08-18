// /angels/thank-you — confirmation after a creator submits their profile.
// Content is admin-editable via /admin/angels/content (angels_page_sections);
// with no DB rows it renders the defaults in angelsDefaultContent.ts unchanged.

import { CheckCircle2 } from 'lucide-react';
import { AngelsShell, AngelsEyebrow, A } from '../../components/angels/AngelsShell';
import { useAngelsContent } from '../../hooks/useAngelsContent';

export default function AngelsThankYou() {
    const { getSection } = useAngelsContent('thank_you');

    const main = getSection('main');
    const nextSteps = getSection('next_steps');

    return (
        <AngelsShell maxWidth={560} wordmarkSize="lg">
            <div className="text-center flex flex-col items-center">
                {main && (
                    <>
                        <span
                            className="inline-flex items-center justify-center mb-7"
                            style={{ width: 64, height: 64, borderRadius: 9999, background: A.redSoft, color: A.red }}
                        >
                            <CheckCircle2 size={32} />
                        </span>
                        <AngelsEyebrow>{main.config.eyebrow}</AngelsEyebrow>
                        <h1 className="font-bold" style={{ fontSize: 'clamp(1.5rem, 5.5vw, 2.25rem)', letterSpacing: '-0.02em' }}>
                            {main.config.title}
                        </h1>
                        <p style={{ color: A.textSecondary, lineHeight: 1.65, fontSize: 16, marginTop: 16, maxWidth: 460 }}>
                            {main.config.body}
                        </p>
                    </>
                )}
                {nextSteps && nextSteps.items.length > 0 && (
                    <div
                        className="w-full mt-9 text-left"
                        style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 16, padding: '20px 22px' }}
                    >
                        <p className="font-semibold" style={{ fontSize: 14, marginBottom: 10 }}>
                            {nextSteps.config.title}
                        </p>
                        <ol className="flex flex-col gap-2.5" style={{ color: A.textMuted, fontSize: 14, lineHeight: 1.5 }}>
                            {nextSteps.items.map((step, i) => (
                                <li key={step.id ?? i}>
                                    {i + 1} · {step.title}
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
            </div>
        </AngelsShell>
    );
}
