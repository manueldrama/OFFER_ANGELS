import React, { useState, useMemo, useRef } from 'react';
import { Search, X, Bot, Sparkles, Loader2, RefreshCw, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiAssistanceService } from '../services/admin/aiAssistanceService';

interface FaqItem {
  id: string;
  title: string;
  description: string;
}

interface SmartFaqSearchProps {
  faqItems: FaqItem[];
  productId?: string;
  productName?: string;
  specsData?: Array<{ title: string; value_text: string }>;
  placeholder?: string;
  className?: string;
  accentColor?: string;
}

export default function SmartFaqSearch({
  faqItems,
  productId,
  productName,
  specsData,
  placeholder = 'Sorunuzu yazın...',
  className = '',
  accentColor = '#C41E2A',
}: SmartFaqSearchProps) {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return faqItems;
    const q = query.toLowerCase().trim();
    return faqItems.filter(
      (f) =>
        f.title?.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q)
    );
  }, [query, faqItems]);

  const hasResults = filtered.length > 0;

  const askAi = async () => {
    if (!query.trim() || aiLoading) return;
    setAiLoading(true);
    setAiError(false);
    setAiAnswer(null);
    try {
      const { answer } = await apiAssistanceService.askAi(
        query.trim(),
        null,
        null,
        undefined,
        'faq_assistant',
        {
          productName: productName || undefined,
          productId: productId || undefined,
          faqItems: faqItems.map((f) => ({ title: f.title, description: f.description })),
          specs: specsData || undefined,
        }
      );
      setAiAnswer(answer);
    } catch {
      setAiError(true);
    } finally {
      setAiLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      askAi();
    }
  };

  const clearAll = () => {
    setQuery('');
    setAiAnswer(null);
    setAiError(false);
    setOpenId(null);
    inputRef.current?.focus();
  };

  return (
    <div className={className}>
      {/* Search Bar */}
      <div className="relative mb-4">
        <div
          className="flex items-center gap-2 rounded-xl border bg-white transition-all duration-200"
          style={{
            borderColor: query ? accentColor + '40' : '#E5E5E5',
            boxShadow: query ? `0 0 0 3px ${accentColor}10` : 'none',
            padding: 'clamp(10px, 2.5vw, 14px) clamp(14px, 3.5vw, 20px)',
          }}
        >
          <Search size={18} style={{ color: '#9CA3AF', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setAiAnswer(null);
              setAiError(false);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ fontSize: 'clamp(14px, 3.5vw, 16px)', color: '#111111' }}
          />
          {query && (
            <button onClick={clearAll} className="shrink-0 p-1 rounded-full hover:bg-slate-100 transition-colors">
              <X size={16} style={{ color: '#9CA3AF' }} />
            </button>
          )}
          {query.trim() && (
            <button
              onClick={askAi}
              disabled={aiLoading}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white font-semibold transition-all duration-200 hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
              style={{ background: accentColor, fontSize: '11px' }}
            >
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Asistana Sor
            </button>
          )}
        </div>
      </div>

      {/* AI Answer Card — Premium Glassmorphic */}
      <AnimatePresence>
        {(aiAnswer || aiLoading || aiError) && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: 8 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -4 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className="rounded-2xl mb-4 overflow-hidden relative"
              style={{
                background: 'linear-gradient(145deg, #0F172A 0%, #1E293B 100%)',
                boxShadow: '0 8px 32px -4px rgba(15,23,42,0.25), 0 0 0 1px rgba(255,255,255,0.05)',
              }}
            >
              {/* Ambient glow */}
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 blur-3xl pointer-events-none"
                style={{ background: accentColor, transform: 'translate(30%, -40%)' }} />
              <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full opacity-10 blur-2xl pointer-events-none"
                style={{ background: '#6366F1', transform: 'translate(-30%, 40%)' }} />

              {/* Header bar */}
              <div className="relative flex items-center gap-2.5 px-5 pt-4 pb-2">
                <motion.div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)`,
                    boxShadow: `0 4px 12px ${accentColor}40`,
                  }}
                  animate={aiLoading ? { scale: [1, 1.08, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {aiLoading ? <Sparkles size={14} className="text-white" /> : <Bot size={14} className="text-white" />}
                </motion.div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-white/90 tracking-wide">
                    AI Asistan
                  </span>
                  {aiLoading && (
                    <motion.span
                      className="text-[9px] text-white/40"
                      animate={{ opacity: [0.4, 0.8, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      yanıtlıyor...
                    </motion.span>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="relative px-5 pb-5 pt-1">
                {aiLoading && (
                  <div className="py-3">
                    <div className="space-y-2.5">
                      {[85, 100, 60].map((w, i) => (
                        <motion.div
                          key={i}
                          className="rounded-md"
                          style={{ height: '10px', width: `${w}%`, background: 'rgba(255,255,255,0.06)' }}
                          animate={{ opacity: [0.3, 0.7, 0.3] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {aiAnswer && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="leading-relaxed whitespace-pre-wrap"
                    style={{
                      fontSize: 'clamp(13px, 3.2vw, 15px)',
                      color: 'rgba(255,255,255,0.82)',
                      lineHeight: 1.75,
                    }}
                  >
                    {aiAnswer}
                  </motion.p>
                )}

                {aiError && (
                  <div className="flex items-center gap-3 py-1">
                    <p className="text-sm text-white/40">Cevap üretilemedi.</p>
                    <button
                      onClick={askAi}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                      style={{
                        color: '#FFF',
                        background: `${accentColor}30`,
                        border: `1px solid ${accentColor}50`,
                      }}
                    >
                      <RefreshCw size={11} /> Tekrar Dene
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filtered FAQ List */}
      {query.trim() && !hasResults && !aiAnswer && !aiLoading && (
        <p className="text-center py-4" style={{ fontSize: 'clamp(12px, 3vw, 14px)', color: '#737373' }}>
          Aramanızla eşleşen soru bulunamadı. <button onClick={askAi} className="font-semibold underline" style={{ color: accentColor }}>Asistanımıza sorun</button>
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 2vw, 12px)' }}>
        {filtered.map((faq) => {
          const isOpen = openId === faq.id;
          return (
            <div
              key={faq.id}
              className="rounded-xl overflow-hidden transition-all duration-200"
              style={{
                border: '1px solid #E5E5E5',
                background: isOpen ? `${accentColor}05` : '#FFFFFF',
                borderLeft: isOpen ? `3px solid ${accentColor}` : '1px solid #E5E5E5',
              }}
            >
              <button
                onClick={() => setOpenId(isOpen ? null : faq.id)}
                className="w-full flex justify-between items-center text-left cursor-pointer"
                style={{ padding: 'clamp(14px, 3.5vw, 20px) clamp(16px, 4vw, 24px)' }}
              >
                <span
                  className="font-semibold pr-3"
                  style={{
                    fontSize: 'clamp(14px, 3.5vw, 17px)',
                    color: '#111111',
                  }}
                >
                  {query.trim() ? highlightMatch(faq.title, query) : faq.title}
                </span>
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.25 }}
                  className="shrink-0"
                >
                  <ChevronDown size={16} style={{ color: isOpen ? accentColor : '#737373' }} />
                </motion.div>
              </button>
              <AnimatePresence>
                {isOpen && faq.description && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <p
                      className="leading-relaxed"
                      style={{
                        padding: '0 clamp(16px, 4vw, 24px) clamp(14px, 3.5vw, 20px)',
                        fontSize: 'clamp(13px, 3vw, 16px)',
                        color: '#737373',
                        lineHeight: 1.7,
                      }}
                    >
                      {faq.description}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim() || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase().trim());
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.trim().length);
  const after = text.slice(idx + query.trim().length);
  return (
    <>
      {before}
      <mark style={{ background: '#FEF2F2', color: '#C41E2A', borderRadius: '2px', padding: '0 1px' }}>{match}</mark>
      {after}
    </>
  );
}
