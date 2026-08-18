import React from 'react';
import * as LucideIcons from 'lucide-react';

interface IconProps {
  size?: number;
  className?: string;
}

const svgProps = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
});

/** Two cups side by side — dual cup printing */
export const DualCupIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg {...svgProps(size, className)}>
    {/* Sol bardak */}
    <path d="M1.5 6h8l-1 10.5a2 2 0 0 1-2 1.5H4.5a2 2 0 0 1-2-1.5L1.5 6z" />
    <path d="M4 3v2" strokeWidth={1.5} />
    <path d="M6.5 2.5v2.5" strokeWidth={1.5} />
    {/* Sağ bardak */}
    <path d="M14.5 6h8l-1 10.5a2 2 0 0 1-2 1.5h-2a2 2 0 0 1-2-1.5L14.5 6z" />
    {/* Sağ kulp */}
    <path d="M22.5 9a2.5 2.5 0 0 1 0 5" strokeWidth={2} />
    <path d="M17 3v2" strokeWidth={1.5} />
    <path d="M19.5 2.5v2.5" strokeWidth={1.5} />
  </svg>
);

/** Single cup — single cup printing */
export const SingleCupIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg {...svgProps(size, className)}>
    {/* Bardak gövdesi — to-go cup tarzı */}
    <path d="M5.5 6h13l-1.5 12a3 3 0 0 1-3 2.5h-4A3 3 0 0 1 7 18.5L5.5 6z" />
    {/* Kapak */}
    <path d="M4.5 6h15" strokeWidth={2.2} />
    {/* Kapak çıkıntısı */}
    <rect x="7" y="4" width="10" height="2" rx="1" strokeWidth={1.5} />
    {/* Buhar */}
    <path d="M10 2V1" strokeWidth={1.5} />
    <path d="M14 1.5V.5" strokeWidth={1.5} />
  </svg>
);

/** Lightning bolt — speed / fast printing */
export const SpeedIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg {...svgProps(size, className)}>
    <path d="M13 2L4.5 13h6L9 22l9.5-12h-6L13 2z" fill="currentColor" fillOpacity={0.1} />
    <path d="M13 2L4.5 13h6L9 22l9.5-12h-6L13 2z" />
  </svg>
);

/** Sparkle/AI star — AI-powered */
export const AiIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg {...svgProps(size, className)}>
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="currentColor" fillOpacity={0.08} />
    <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
    <path d="M6.34 6.34l1.42 1.42M16.24 16.24l1.42 1.42M6.34 17.66l1.42-1.42M16.24 7.76l1.42-1.42" strokeWidth={1.2} />
  </svg>
);

/** Rocket — high capacity / performance */
export const CapacityIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg {...svgProps(size, className)}>
    <path d="M12 2C12 2 7 7.5 7 13a5 5 0 0 0 10 0c0-5.5-5-11-5-11z" fill="currentColor" fillOpacity={0.06} />
    <path d="M12 2C12 2 7 7.5 7 13a5 5 0 0 0 10 0c0-5.5-5-11-5-11z" />
    <path d="M12 18v4" />
    <path d="M8 22h8" />
    <circle cx="12" cy="13" r="1.5" fill="currentColor" strokeWidth={0} />
  </svg>
);

/** Wi-Fi signal — wireless connectivity */
export const WifiIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg {...svgProps(size, className)}>
    <path d="M2 9.5a14.3 14.3 0 0 1 20 0" />
    <path d="M5.6 12.8a9.6 9.6 0 0 1 12.8 0" />
    <path d="M9 16a5.2 5.2 0 0 1 6 0" />
    <circle cx="12" cy="19.5" r="1.2" fill="currentColor" strokeWidth={0} />
  </svg>
);

/** Coffee bean — coffee content */
export const BeanIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg {...svgProps(size, className)}>
    <ellipse cx="12" cy="12" rx="6" ry="8" fill="currentColor" fillOpacity={0.06} />
    <ellipse cx="12" cy="12" rx="6" ry="8" />
    <path d="M12 4c-1.5 2.5-1.5 5.5 0 8s1.5 5.5 0 8" />
  </svg>
);

/** Touchscreen — touch display */
export const TouchScreenIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg {...svgProps(size, className)}>
    <rect x="5" y="3" width="14" height="18" rx="2" fill="currentColor" fillOpacity={0.04} />
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M12 9.5v-2M12 16.5v-2M9.5 12h-2M16.5 12h-2" strokeWidth={1.2} />
  </svg>
);

/** Map of icon_name strings to custom icons */
const featureIconMap: Record<string, React.FC<IconProps>> = {
  // Lucide name mappings
  'Copy': DualCupIcon,
  'Coffee': SingleCupIcon,
  'Zap': SpeedIcon,
  'Image': AiIcon,
  'Rocket': CapacityIcon,
  'Wifi': WifiIcon,
  'Layers': BeanIcon,
  // Semantic name mappings
  'dual-cup': DualCupIcon,
  'single-cup': SingleCupIcon,
  'speed': SpeedIcon,
  'ai': AiIcon,
  'capacity': CapacityIcon,
  'wifi': WifiIcon,
  'bean': BeanIcon,
  'touchscreen': TouchScreenIcon,
};

/** Label keywords → icon mapping for auto-detection */
const labelIconMap: Array<[RegExp, React.FC<IconProps>]> = [
  [/çift|dual|2 bardak|aynı anda/i, DualCupIcon],
  [/tek bardak|single/i, SingleCupIcon],
  [/saniye|hız|süre|speed|fast/i, SpeedIcon],
  [/ai|yapay zeka|görsel|akıllı/i, AiIcon],
  [/kapasite|bardak\/saat|capacity/i, CapacityIcon],
  [/wi-?fi|kablosuz|bağlantı|iot|wireless/i, WifiIcon],
  [/kahve|bean|çekirdek|içerik|içecek/i, BeanIcon],
  [/ekran|screen|dokunmatik|touch/i, TouchScreenIcon],
];

/** Resolve icon from name, lucide component, or label text */
export function getFeatureIcon(nameOrComponent: any, label?: string): React.FC<IconProps> | null {
  // Direct string lookup
  if (typeof nameOrComponent === 'string' && featureIconMap[nameOrComponent]) {
    return featureIconMap[nameOrComponent];
  }
  // Lucide component — use displayName
  if (typeof nameOrComponent === 'function' || (nameOrComponent && typeof nameOrComponent === 'object')) {
    const dn = nameOrComponent.displayName || nameOrComponent.name;
    if (dn && featureIconMap[dn]) return featureIconMap[dn];
  }
  // Auto-detect from label text
  if (label) {
    for (const [regex, icon] of labelIconMap) {
      if (regex.test(label)) return icon;
    }
  }
  // Fallback: try Lucide icon by name
  if (typeof nameOrComponent === 'string') {
    const lucide = (LucideIcons as any)[nameOrComponent];
    if (lucide) return lucide;
  }
  return null;
}
