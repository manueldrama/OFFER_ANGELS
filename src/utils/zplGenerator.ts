/**
 * ZPL Label Generator for Zebra Printers
 * Generates ZPL II format labels for CAFEPASTE device tracking.
 * Supports configurable label size, element visibility, and styling.
 */

import { LabelSettings } from '../types';

interface DeviceLabelData {
  serial_number: string;
  product_model: string;
  manufactured_at?: string | null;
  batch_number?: string | null;
  qrUrl?: string;
}

// ── Default Settings ──────────────────────────────────────────

export const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  widthMm: 60,
  heightMm: 40,
  dpmm: 8,
  showBrandName: true,
  showModel: true,
  showBarcode: true,
  showQrCode: true,
  showDate: true,
  showBatch: true,
  brandText: 'CAFEPASTE',
  brandFontSize: 28,
  modelFontSize: 20,
  detailFontSize: 18,
  barcodeHeight: 80,
  qrSize: 4,
};

const STORAGE_KEY = 'cafepaste_label_settings';

// ── Settings Persistence ──────────────────────────────────────

export function getLabelSettings(): LabelSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_LABEL_SETTINGS, ...JSON.parse(raw) };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_LABEL_SETTINGS };
}

export function saveLabelSettings(settings: LabelSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// ── Label Size Presets ────────────────────────────────────────

export const LABEL_PRESETS = [
  { label: '40×25 mm', widthMm: 40, heightMm: 25 },
  { label: '60×40 mm', widthMm: 60, heightMm: 40 },
  { label: '80×50 mm', widthMm: 80, heightMm: 50 },
  { label: '100×60 mm', widthMm: 100, heightMm: 60 },
] as const;

// ── ZPL Generation ────────────────────────────────────────────

/**
 * Generate ZPL for a single device label with configurable settings.
 * Element positions are calculated dynamically based on visibility.
 */
export function generateDeviceZpl(
  device: DeviceLabelData,
  settings?: LabelSettings
): string {
  const s = settings || getLabelSettings();
  const serial = device.serial_number || 'NO-SERIAL';
  const model = device.product_model || 'UNKNOWN';
  const date = device.manufactured_at
    ? new Date(device.manufactured_at).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  const batch = device.batch_number || '';
  const qrData = device.qrUrl || `https://cafepaste.com/device/${serial}`;

  const pw = Math.round(s.widthMm * s.dpmm);
  const ll = Math.round(s.heightMm * s.dpmm);
  const margin = Math.round(pw * 0.04); // ~4% margin

  const lines: string[] = [
    '^XA',
    '^CI28',
    `^PW${pw}`,
    `^LL${ll}`,
    '^LH0,0',
    '',
    '~SD20',
  ];

  let y = Math.round(ll * 0.04); // start ~4% from top

  // Brand name
  if (s.showBrandName) {
    lines.push(`^FO${margin},${y}^A0N,${s.brandFontSize},${s.brandFontSize}^FD${s.brandText}^FS`);
    y += s.brandFontSize + Math.round(s.brandFontSize * 0.3);
  }

  // Model
  if (s.showModel) {
    lines.push(`^FO${margin},${y}^A0N,${s.modelFontSize},${s.modelFontSize}^FDModel: ${model}^FS`);
    y += s.modelFontSize + Math.round(s.modelFontSize * 0.4);
  }

  // Barcode (Code 128)
  if (s.showBarcode) {
    const barcodeModuleWidth = Math.max(1, Math.round(pw / 300));
    lines.push(`^FO${margin},${y}^BY${barcodeModuleWidth},2,${s.barcodeHeight}^BCN,${s.barcodeHeight},Y,N,N^FD${serial}^FS`);
    y += s.barcodeHeight + Math.round(s.barcodeHeight * 0.35);
  }

  // Bottom info line: batch + date
  const hasBottomInfo = (s.showBatch && batch) || s.showDate;
  if (hasBottomInfo) {
    let infoText = '';
    if (s.showBatch && batch) infoText += `Batch: ${batch}`;
    if (s.showBatch && batch && s.showDate) infoText += '  ';
    if (s.showDate) infoText += date;
    lines.push(`^FO${margin},${y}^A0N,${s.detailFontSize},${s.detailFontSize}^FD${infoText}^FS`);
    y += s.detailFontSize + 5;
  }

  // QR Code (positioned at bottom-right)
  if (s.showQrCode) {
    const qrDotSize = Math.round(pw * s.qrSize / 120);
    const qrTotalSize = qrDotSize * 25; // approximate QR module count
    const qrX = Math.max(margin, pw - qrTotalSize - margin);
    const qrY = Math.max(margin, ll - qrTotalSize - margin);
    lines.push(`^FO${qrX},${qrY}^BQN,2,${s.qrSize}^FDLA,${qrData}^FS`);
  }

  lines.push('', '^XZ');
  return lines.join('\n');
}

/**
 * Generate ZPL for multiple device labels (concatenated).
 */
export function generateBulkZpl(devices: DeviceLabelData[], settings?: LabelSettings): string {
  const s = settings || getLabelSettings();
  return devices.map(d => generateDeviceZpl(d, s)).join('\n');
}

/**
 * Trigger browser download of ZPL content as a .zpl file.
 */
export function downloadZpl(content: string, filename: string = 'labels.zpl'): void {
  const blob = new Blob([content], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Get Labelary API preview URL for a ZPL label.
 */
export function getLabelaryPreviewUrl(
  zpl: string,
  dpmm: number = 8,
  widthInches: number = 2.4,
  heightInches: number = 1.6
): string {
  const encoded = encodeURIComponent(zpl);
  return `https://api.labelary.com/v1/printers/${dpmm}dpmm/labels/${widthInches}x${heightInches}/0/${encoded}`;
}

/**
 * Fetch a preview image from Labelary API and return as blob URL.
 * Uses settings dimensions if not explicitly provided.
 */
export async function fetchLabelPreview(
  zpl: string,
  settings?: LabelSettings
): Promise<string> {
  const s = settings || getLabelSettings();
  const widthInches = +(s.widthMm / 25.4).toFixed(2);
  const heightInches = +(s.heightMm / 25.4).toFixed(2);

  const response = await fetch(
    `https://api.labelary.com/v1/printers/${s.dpmm}dpmm/labels/${widthInches}x${heightInches}/0/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: zpl,
    }
  );

  if (!response.ok) throw new Error('Etiket önizleme yüklenemedi');

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
