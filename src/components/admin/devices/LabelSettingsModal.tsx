import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, RotateCcw, Eye } from 'lucide-react';
import { LabelSettings } from '../../../types';
import {
  DEFAULT_LABEL_SETTINGS,
  LABEL_PRESETS,
  getLabelSettings,
  saveLabelSettings,
  generateDeviceZpl,
  fetchLabelPreview,
} from '../../../utils/zplGenerator';
import { useToast } from '../../../contexts/ToastContext';

interface LabelSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE_DEVICE = {
  serial_number: 'CFP26-K7XN-R4HP',
  product_model: 'CP-2400',
  manufactured_at: new Date().toISOString(),
  batch_number: 'B2026-03',
};

export default function LabelSettingsModal({ isOpen, onClose }: LabelSettingsModalProps) {
  const [settings, setSettings] = useState<LabelSettings>(DEFAULT_LABEL_SETTINGS);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { success } = useToast();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setSettings(getLabelSettings());
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const updatePreview = useCallback((s: LabelSettings) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const zpl = generateDeviceZpl(SAMPLE_DEVICE, s);
        const url = await fetchLabelPreview(zpl, s);
        setPreviewUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch {
        // silently fail preview
      } finally {
        setPreviewLoading(false);
      }
    }, 500);
  }, []);

  useEffect(() => {
    if (isOpen) updatePreview(settings);
  }, [isOpen, settings, updatePreview]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const update = (patch: Partial<LabelSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
  };

  const handleSave = () => {
    saveLabelSettings(settings);
    success('Kaydedildi', 'Etiket ayarları güncellendi.');
    onClose();
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_LABEL_SETTINGS });
  };

  if (!isOpen) return null;

  const inputClass = 'w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Etiket Ayarları</h2>
            <p className="text-sm text-slate-500 mt-1">Zebra etiket boyutunu ve tasarımını özelleştirin.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content: Settings + Preview side by side */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Settings */}
            <div className="space-y-5">
              {/* Size Presets */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Etiket Boyutu</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {LABEL_PRESETS.map(p => (
                    <button
                      key={p.label}
                      onClick={() => update({ widthMm: p.widthMm, heightMm: p.heightMm })}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        settings.widthMm === p.widthMm && settings.heightMm === p.heightMm
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Genişlik (mm)</label>
                    <input
                      type="number" min={20} max={150} value={settings.widthMm}
                      onChange={e => update({ widthMm: Math.max(20, Math.min(150, +e.target.value || 60)) })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Yükseklik (mm)</label>
                    <input
                      type="number" min={15} max={120} value={settings.heightMm}
                      onChange={e => update({ heightMm: Math.max(15, Math.min(120, +e.target.value || 40)) })}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* DPI */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">DPI / Çözünürlük</label>
                <div className="flex gap-3">
                  {[{ dpmm: 8, label: '203 DPI (8 dpmm)' }, { dpmm: 12, label: '300 DPI (12 dpmm)' }].map(opt => (
                    <button
                      key={opt.dpmm}
                      onClick={() => update({ dpmm: opt.dpmm })}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                        settings.dpmm === opt.dpmm
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Element Visibility */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Görünen Elemanlar</label>
                <div className="space-y-2">
                  {([
                    { key: 'showBrandName', label: 'Marka Adı' },
                    { key: 'showModel', label: 'Model Bilgisi' },
                    { key: 'showBarcode', label: 'Barkod (Code 128)' },
                    { key: 'showQrCode', label: 'QR Kod' },
                    { key: 'showDate', label: 'Üretim Tarihi' },
                    { key: 'showBatch', label: 'Batch Numarası' },
                  ] as { key: keyof LabelSettings; label: string }[]).map(item => (
                    <label key={item.key} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <span className="text-sm text-slate-600">{item.label}</span>
                      <div
                        onClick={() => update({ [item.key]: !settings[item.key] })}
                        className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                          settings[item.key] ? 'bg-indigo-500' : 'bg-slate-200'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          settings[item.key] ? 'translate-x-4' : 'translate-x-0.5'
                        }`} />
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Brand Text */}
              {settings.showBrandName && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Marka Yazısı</label>
                  <input
                    type="text" value={settings.brandText}
                    onChange={e => update({ brandText: e.target.value })}
                    className={inputClass}
                    placeholder="CAFEPASTE"
                  />
                </div>
              )}

              {/* Font Sizes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Font Boyutları</label>
                <div className="space-y-3">
                  {settings.showBrandName && (
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>Marka</span><span>{settings.brandFontSize}px</span>
                      </div>
                      <input
                        type="range" min={12} max={48} value={settings.brandFontSize}
                        onChange={e => update({ brandFontSize: +e.target.value })}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  )}
                  {settings.showModel && (
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>Model</span><span>{settings.modelFontSize}px</span>
                      </div>
                      <input
                        type="range" min={12} max={36} value={settings.modelFontSize}
                        onChange={e => update({ modelFontSize: +e.target.value })}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  )}
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                      <span>Detay</span><span>{settings.detailFontSize}px</span>
                    </div>
                    <input
                      type="range" min={10} max={28} value={settings.detailFontSize}
                      onChange={e => update({ detailFontSize: +e.target.value })}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Barcode / QR Settings */}
              <div className="grid grid-cols-2 gap-4">
                {settings.showBarcode && (
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                      <span>Barkod Yüksekliği</span><span>{settings.barcodeHeight}</span>
                    </div>
                    <input
                      type="range" min={40} max={120} value={settings.barcodeHeight}
                      onChange={e => update({ barcodeHeight: +e.target.value })}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                )}
                {settings.showQrCode && (
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                      <span>QR Büyüklük</span><span>{settings.qrSize}</span>
                    </div>
                    <input
                      type="range" min={2} max={6} value={settings.qrSize}
                      onChange={e => update({ qrSize: +e.target.value })}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right: Live Preview */}
            <div className="lg:sticky lg:top-0">
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                    <Eye size={15} /> Canlı Önizleme
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    {settings.widthMm}×{settings.heightMm} mm @ {settings.dpmm === 8 ? '203' : '300'} DPI
                  </span>
                </div>
                <div className="flex items-center justify-center min-h-[200px] bg-white rounded-lg border border-slate-100 p-4">
                  {previewLoading ? (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                      <span className="text-xs">Önizleme yükleniyor...</span>
                    </div>
                  ) : previewUrl ? (
                    <img src={previewUrl} alt="Label Preview" className="max-w-full h-auto" />
                  ) : (
                    <span className="text-xs text-slate-400">Önizleme yükleniyor...</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 text-center mt-2">
                  Örnek: CFP26-K7XN-R4HP / CP-2400
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw size={15} /> Varsayılana Dön
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-slate-900 text-white hover:bg-slate-800 text-sm font-medium rounded-md transition-colors flex items-center gap-2"
            >
              <Save size={16} /> Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
