import { useEffect, useCallback, useState } from 'react';

/**
 * Hook that enables visual editing preview mode on the landing page.
 * When ?preview=true is in the URL:
 * - Adds hover highlights to sections
 * - Sends click events to parent editor via postMessage
 * - Listens for scroll/highlight commands from parent
 */
export function usePreviewMode() {
    const isPreview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'true';
    const [activeSection, setActiveSection] = useState<string | null>(null);

    useEffect(() => {
        if (!isPreview) return;

        // Inject preview styles
        const style = document.createElement('style');
        style.id = 'cms-preview-styles';
        style.textContent = `
            [data-section-type] {
                position: relative;
                transition: outline 0.15s ease, outline-offset 0.15s ease;
                cursor: pointer;
            }
            [data-section-type]:hover {
                outline: 2px solid rgba(99, 102, 241, 0.5) !important;
                outline-offset: -2px;
            }
            [data-section-type]:hover::after {
                content: attr(data-section-type);
                position: absolute;
                top: 4px;
                left: 4px;
                background: rgba(99, 102, 241, 0.9);
                color: white;
                font-size: 10px;
                font-weight: 600;
                font-family: system-ui, sans-serif;
                padding: 2px 8px;
                border-radius: 4px;
                z-index: 9999;
                pointer-events: none;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            [data-section-type].cms-active {
                outline: 2px solid rgba(99, 102, 241, 0.8) !important;
                outline-offset: -2px;
            }
            [data-section-type].cms-active::before {
                content: '';
                position: absolute;
                inset: 0;
                background: rgba(99, 102, 241, 0.04);
                pointer-events: none;
                z-index: 1;
            }
        `;
        document.head.appendChild(style);

        // Click handler — notify parent editor
        const handleClick = (e: MouseEvent) => {
            const sectionEl = (e.target as HTMLElement).closest('[data-section-type]');
            if (!sectionEl) return;

            const sectionType = sectionEl.getAttribute('data-section-type');
            if (!sectionType) return;

            e.preventDefault();
            e.stopPropagation();

            // Highlight active
            document.querySelectorAll('[data-section-type].cms-active').forEach(el => el.classList.remove('cms-active'));
            sectionEl.classList.add('cms-active');

            // Notify parent
            window.parent.postMessage({ type: 'CMS_SECTION_CLICKED', sectionType }, '*');
        };

        // Listen for messages from parent
        const handleMessage = (e: MessageEvent) => {
            if (e.data?.type === 'CMS_HIGHLIGHT_SECTION') {
                document.querySelectorAll('[data-section-type].cms-active').forEach(el => el.classList.remove('cms-active'));
                if (e.data.sectionType) {
                    const el = document.querySelector(`[data-section-type="${e.data.sectionType}"]`);
                    if (el) {
                        el.classList.add('cms-active');
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            }
        };

        document.addEventListener('click', handleClick, true);
        window.addEventListener('message', handleMessage);

        return () => {
            document.removeEventListener('click', handleClick, true);
            window.removeEventListener('message', handleMessage);
            style.remove();
        };
    }, [isPreview]);

    return { isPreview };
}
