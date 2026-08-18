import React, { useState, useRef, useCallback } from 'react';
import { Monitor, Smartphone, Tablet, RefreshCw, ExternalLink } from 'lucide-react';

interface EditorPreviewPanelProps {
    lang: string;
    onRefresh?: () => void;
}

const DEVICES = [
    { id: 'mobile', label: 'Mobil', icon: Smartphone, width: 390, height: 844 },
    { id: 'tablet', label: 'Tablet', icon: Tablet, width: 768, height: 1024 },
    { id: 'desktop', label: 'Masaustu', icon: Monitor, width: 1440, height: 900 },
] as const;

export function EditorPreviewPanel({ lang, onRefresh }: EditorPreviewPanelProps) {
    const [device, setDevice] = useState<typeof DEVICES[number]>(DEVICES[0]);
    const [iframeKey, setIframeKey] = useState(0);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const lpUrl = `${window.location.origin}/lp?preview=true&lang=${lang}`;

    const handleRefresh = useCallback(() => {
        setIframeKey(k => k + 1);
        onRefresh?.();
    }, [onRefresh]);

    const sendMessage = useCallback((message: any) => {
        iframeRef.current?.contentWindow?.postMessage(message, '*');
    }, []);

    const scrollToSection = useCallback((sectionType: string) => {
        sendMessage({ type: 'CMS_SCROLL_TO_SECTION', sectionType });
    }, [sendMessage]);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-1">
                    {DEVICES.map(d => {
                        const Icon = d.icon;
                        return (
                            <button
                                key={d.id}
                                onClick={() => setDevice(d)}
                                className={`p-1.5 rounded-md transition-colors ${device.id === d.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                                title={d.label}
                            >
                                <Icon size={16} />
                            </button>
                        );
                    })}
                </div>

                <span className="text-[10px] text-slate-400 font-mono">
                    {device.width}x{device.height}
                </span>

                <div className="flex items-center gap-1">
                    <button onClick={handleRefresh} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors" title="Yenile">
                        <RefreshCw size={14} />
                    </button>
                    <a href="/lp" target="_blank" rel="noopener" className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors" title="Yeni sekmede ac">
                        <ExternalLink size={14} />
                    </a>
                </div>
            </div>

            {/* Iframe container */}
            <div className="flex-1 overflow-auto flex justify-center items-start p-4">
                <div
                    className="bg-white rounded-lg shadow-lg overflow-hidden border border-slate-200 shrink-0"
                    style={{
                        width: device.id === 'desktop' ? '100%' : `${device.width}px`,
                        maxWidth: '100%',
                        height: device.id === 'desktop' ? '100%' : `${device.height}px`,
                    }}
                >
                    <iframe
                        ref={iframeRef}
                        key={iframeKey}
                        src={lpUrl}
                        title="Landing Page Preview"
                        className="w-full h-full border-0"
                        style={device.id !== 'desktop' ? {
                            width: `${device.width}px`,
                            height: `${device.height}px`,
                        } : undefined}
                    />
                </div>
            </div>
        </div>
    );
}

// Export a way to send messages from parent components
export function usePreviewMessaging(iframeRef: React.RefObject<HTMLIFrameElement | null>) {
    const sendMessage = useCallback((message: any) => {
        iframeRef.current?.contentWindow?.postMessage(message, '*');
    }, [iframeRef]);

    return {
        scrollToSection: (sectionType: string) => sendMessage({ type: 'CMS_SCROLL_TO_SECTION', sectionType }),
        refreshPreview: () => sendMessage({ type: 'CMS_REFRESH' }),
    };
}
