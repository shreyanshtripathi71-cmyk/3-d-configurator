'use client';

import {
  useState, useRef, useEffect, useMemo, useCallback,
  type ReactNode, type CSSProperties,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { WINDOW_TYPES, COLOURS } from '@/data/windows';
import type { Colour } from '@/data/windows';
import type { ViewerControlsAPI } from '@/components/WindowViewer';
import {
  createDefaultConfig,
  buildGridCells,
  buildDefaultRowConfigs,
  getMaxVertical,
  getMaxHorizontal,
  getMinHorizontal,
  rebuildRowCells,
  MEASUREMENT_TYPES,
  FRAME_COLORS,
  BRICKMOULD_OPTIONS,
  NAILING_FIN_OPTIONS,
  GLAZING_TYPES,
  GLASS_THICKNESS_OPTIONS,
  LOW_E_COATINGS,
  GAS_TYPES,
  SPACER_TYPES,
  SPACER_COLOR_OPTIONS,
  TINT_FROSTING_OPTIONS,
  SECURITY_GLASS_OPTIONS,
  SASH_SIZE_OPTIONS,
  HARDWARE_COLORS,
  OPENING_DIRECTIONS,
  SCREEN_TYPES,
  SPECIAL_GLAZING_OPTIONS,
  GRILL_PATTERNS,
  GRILL_BAR_TYPES,
  GRILL_BAR_SIZES,
  GRILL_COLORS,
  PRAIRIE_H_BAR_LAYOUTS,
  PRAIRIE_V_BAR_LAYOUTS,
  WINDOW_CONSTRAINTS,
  WINDOW_MODEL_PATHS,
  getWindowTypeOptions,
  computeEnergyRatings,
  calculatePrice,
} from '@/data/configuratorData';
import type { ConfigState, WindowCell, RowConfig } from '@/data/configuratorData';
import styles from './page.module.css';

const WindowViewer = dynamic(() => import('@/components/WindowViewer'), {
  ssr: false,
  loading: () => <div style={{ width: '100%', height: '100%' }} />,
});

/* ════════════════════════════════════════════════════════════════
   B2B BUSINESS LOGIC
   ════════════════════════════════════════════════════════════════ */

interface PriceTier { min: number; label: string; discount: number }
const TIER_BREAKS: PriceTier[] = [
  { min: 1,   label: '1–9',   discount: 0    },
  { min: 10,  label: '10–49', discount: 0.05 },
  { min: 50,  label: '50–99', discount: 0.10 },
  { min: 100, label: '100+',  discount: 0.15 },
];
function tierForQty(qty: number): PriceTier {
  for (let i = TIER_BREAKS.length - 1; i >= 0; i--) {
    if (qty >= TIER_BREAKS[i].min) return TIER_BREAKS[i];
  }
  return TIER_BREAKS[0];
}

const DEALER = {
  name: 'Acme Builders Inc.',
  initials: 'AB',
  tier: 'Gold partner',
  accountDiscount: 0.08,
};

function generateSKU(typeId: string, config: ConfigState): string {
  const t = typeId.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase();
  const w = Math.round(config.frameWidth);
  const h = Math.round(config.frameHeight);
  const c = config.exteriorColor.split('-')[0].slice(0, 3).toUpperCase();
  const cells = config.grid.cells.length;
  const glaze = config.glazingType === 'triple-pane' ? 'TPL' : 'DBL';
  const foam = config.addFoam ? 'F' : 'S';
  return `${t}-${w}x${h}-${c}-${cells}C-${glaze}${foam}`;
}

function estimateLeadTime(qty: number, glazingType: string): string {
  const triple = glazingType === 'triple-pane' ? 1 : 0;
  if (qty < 20) return `${2 + triple}–${3 + triple} weeks`;
  if (qty < 100) return `${3 + triple}–${4 + triple} weeks`;
  return `${5 + triple}–${6 + triple} weeks`;
}

interface QuoteLine {
  id: string;
  sku: string;
  title: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  thumbColor: string;
  addedAt: number;
}

/* ════════════════════════════════════════════════════════════════
   ICON SET
   ════════════════════════════════════════════════════════════════ */
type IconName =
  | 'chevron-down' | 'chevron-right' | 'chevron-up' | 'chevron-left'
  | 'arrow-right' | 'plus' | 'minus' | 'check' | 'x'
  | 'maximize' | 'minimize' | 'reset' | 'zoom-in' | 'zoom-out'
  | 'eye' | 'eye-off' | 'cart' | 'bookmark' | 'share' | 'help'
  | 'sparkles' | 'palette' | 'frame' | 'grid' | 'layers' | 'gauge'
  | 'rotate' | 'sun' | 'tag' | 'truck' | 'document' | 'send' | 'copy'
  | 'inbox' | 'bell' | 'package' | 'save' | 'duplicate' | 'briefcase'
  | 'keyboard' | 'check-circle' | 'sliders' | 'cell';

function Icon({ name, size = 16, strokeWidth = 1.7 }: { name: IconName; size?: number; strokeWidth?: number }) {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'chevron-down':  return (<svg {...props}><path d="M6 9l6 6 6-6"/></svg>);
    case 'chevron-up':    return (<svg {...props}><path d="M18 15l-6-6-6 6"/></svg>);
    case 'chevron-right': return (<svg {...props}><path d="M9 18l6-6-6-6"/></svg>);
    case 'chevron-left':  return (<svg {...props}><path d="M15 18l-6-6 6-6"/></svg>);
    case 'arrow-right':   return (<svg {...props}><path d="M5 12h14M13 5l7 7-7 7"/></svg>);
    case 'plus':          return (<svg {...props}><path d="M12 5v14M5 12h14"/></svg>);
    case 'minus':         return (<svg {...props}><path d="M5 12h14"/></svg>);
    case 'check':         return (<svg {...props}><path d="M20 6L9 17l-5-5"/></svg>);
    case 'check-circle':  return (<svg {...props}><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>);
    case 'x':             return (<svg {...props}><path d="M18 6L6 18M6 6l12 12"/></svg>);
    case 'maximize':      return (<svg {...props}><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>);
    case 'minimize':      return (<svg {...props}><path d="M9 3v6H3M21 9h-6V3M9 21v-6H3M21 15h-6v6"/></svg>);
    case 'reset':         return (<svg {...props}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>);
    case 'zoom-in':       return (<svg {...props}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></svg>);
    case 'zoom-out':      return (<svg {...props}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M8 11h6"/></svg>);
    case 'eye':           return (<svg {...props}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>);
    case 'eye-off':       return (<svg {...props}><path d="M9.9 4.24A9.12 9.12 0 0112 4c6.5 0 10 7 10 7a13.16 13.16 0 01-1.67 2.68M6.61 6.61A13.526 13.526 0 002 11s3.5 7 10 7a9.74 9.74 0 005.39-1.61M14.12 14.12a3 3 0 11-4.24-4.24M2 2l20 20"/></svg>);
    case 'cart':          return (<svg {...props}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6"/></svg>);
    case 'bookmark':      return (<svg {...props}><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>);
    case 'share':         return (<svg {...props}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>);
    case 'help':          return (<svg {...props}><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 015.8 1c0 2-3 2.5-3 4.5"/><circle cx="12" cy="17.5" r="0.6" fill="currentColor"/></svg>);
    case 'sparkles':      return (<svg {...props}><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.6L5.5 9l4.6-1.9z"/><path d="M19 14l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7z"/></svg>);
    case 'palette':       return (<svg {...props}><path d="M12 22a10 10 0 110-20c5.5 0 10 4 10 9 0 3-2 5-5 5h-2a2 2 0 00-2 2 2 2 0 01-2 2 1 1 0 01-1-1z"/><circle cx="6.5" cy="11.5" r="1"/><circle cx="9.5" cy="7.5" r="1"/><circle cx="14.5" cy="7.5" r="1"/><circle cx="17.5" cy="11.5" r="1"/></svg>);
    case 'frame':         return (<svg {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>);
    case 'grid':          return (<svg {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18M12 3v18"/></svg>);
    case 'layers':        return (<svg {...props}><path d="M12 2L2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>);
    case 'gauge':         return (<svg {...props}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/><path d="M12 12L8 8"/></svg>);
    case 'rotate':        return (<svg {...props}><path d="M21.5 2v6h-6M2.5 22v-6h6M3.5 9a9 9 0 0114.85-3.36L23 10M.99 14l4.65 4.36A9 9 0 0020.5 15"/></svg>);
    case 'sun':           return (<svg {...props}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>);
    case 'tag':           return (<svg {...props}><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><circle cx="7" cy="7" r="1.4" fill="currentColor"/></svg>);
    case 'truck':         return (<svg {...props}><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7"/><circle cx="6" cy="18" r="2"/><circle cx="19" cy="18" r="2"/></svg>);
    case 'document':      return (<svg {...props}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>);
    case 'send':          return (<svg {...props}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>);
    case 'copy':          return (<svg {...props}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>);
    case 'inbox':         return (<svg {...props}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>);
    case 'bell':          return (<svg {...props}><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/></svg>);
    case 'package':       return (<svg {...props}><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>);
    case 'save':          return (<svg {...props}><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>);
    case 'duplicate':     return (<svg {...props}><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2h2"/></svg>);
    case 'briefcase':     return (<svg {...props}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>);
    case 'keyboard':      return (<svg {...props}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10"/></svg>);
    case 'sliders':       return (<svg {...props}><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>);
    case 'cell':          return (<svg {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>);
  }
}

/* ════════════════════════════════════════════════════════════════
   GRID + GRILL ICONS
   ════════════════════════════════════════════════════════════════ */
function GridIcon({ rows, cols, size = 32 }: { rows: number; cols: number; size?: number }) {
  const pad = 3;
  const inner = size - pad * 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x={pad} y={pad} width={inner} height={inner} rx={2} />
      {Array.from({ length: rows - 1 }, (_, i) => (
        <line key={`r${i}`} x1={pad} y1={pad + (inner / rows) * (i + 1)} x2={pad + inner} y2={pad + (inner / rows) * (i + 1)} />
      ))}
      {Array.from({ length: cols - 1 }, (_, i) => (
        <line key={`c${i}`} x1={pad + (inner / cols) * (i + 1)} y1={pad} x2={pad + (inner / cols) * (i + 1)} y2={pad + inner} />
      ))}
    </svg>
  );
}
function GrillPatternIcon({ pattern, size = 30 }: { pattern: string; size?: number }) {
  const p = 4; const w = size - 2 * p;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.2}>
      <rect x={p} y={p} width={w} height={w} rx={2} strokeWidth={1.4} />
      {pattern === 'colonial' && (<>
        <line x1={p + w/3} y1={p} x2={p + w/3} y2={p + w} />
        <line x1={p + 2*w/3} y1={p} x2={p + 2*w/3} y2={p + w} />
        <line x1={p} y1={p + w/3} x2={p + w} y2={p + w/3} />
        <line x1={p} y1={p + 2*w/3} x2={p + w} y2={p + 2*w/3} />
      </>)}
      {pattern === 'prairie' && (<>
        <line x1={p + w*0.25} y1={p} x2={p + w*0.25} y2={p + w} />
        <line x1={p + w*0.75} y1={p} x2={p + w*0.75} y2={p + w} />
        <line x1={p} y1={p + w*0.25} x2={p + w} y2={p + w*0.25} />
        <line x1={p} y1={p + w*0.75} x2={p + w} y2={p + w*0.75} />
      </>)}
      {pattern === 'ladder' && (<>
        <line x1={p} y1={p + w*0.25} x2={p + w} y2={p + w*0.25} />
        <line x1={p} y1={p + w*0.50} x2={p + w} y2={p + w*0.50} />
        <line x1={p} y1={p + w*0.75} x2={p + w} y2={p + w*0.75} />
      </>)}
      {pattern === 'diamond' && (<>
        <line x1={p + w/2} y1={p} x2={p + w} y2={p + w/2} />
        <line x1={p + w} y1={p + w/2} x2={p + w/2} y2={p + w} />
        <line x1={p + w/2} y1={p + w} x2={p} y2={p + w/2} />
        <line x1={p} y1={p + w/2} x2={p + w/2} y2={p} />
      </>)}
    </svg>
  );
}
function GrillBarTypeIcon({ barType, size = 30 }: { barType: string; size?: number }) {
  const c = size / 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.2}>
      <rect x={4} y={4} width={size - 8} height={size - 8} rx={2} />
      {barType === 'flat'     && (<><line x1={4} y1={c} x2={size-4} y2={c} strokeWidth={2}/><line x1={c} y1={4} x2={c} y2={size-4} strokeWidth={2}/></>)}
      {barType === 'georgian' && (<><rect x={4} y={c-2} width={size-8} height={4} fill="currentColor" opacity={0.25}/><rect x={c-2} y={4} width={4} height={size-8} fill="currentColor" opacity={0.25}/></>)}
      {barType === 'pencil'   && (<><line x1={4} y1={c} x2={size-4} y2={c} strokeLinecap="round"/><line x1={c} y1={4} x2={c} y2={size-4} strokeLinecap="round"/><circle cx={c} cy={c} r={1.6} fill="currentColor" opacity={0.4}/></>)}
      {barType === 'sdl'      && (<><line x1={4} y1={c-1} x2={size-4} y2={c-1}/><line x1={4} y1={c+1} x2={size-4} y2={c+1} strokeDasharray="2 2"/><line x1={c-1} y1={4} x2={c-1} y2={size-4}/><line x1={c+1} y1={4} x2={c+1} y2={size-4} strokeDasharray="2 2"/></>)}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════
   COMMON INPUT COMPONENTS
   ════════════════════════════════════════════════════════════════ */
interface SelectOption {
  value: string;
  label: string;
  icon?: string;
  priceAddon?: number;
  description?: string;
}

function Select({
  value, options, onChange, placeholder, showPriceAddon = true,
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  showPriceAddon?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) || options[0];
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', click);
    return () => document.removeEventListener('mousedown', click);
  }, []);
  return (
    <div className={styles.select} ref={ref}>
      <button
        type="button"
        className={`${styles.selectTrigger} ${open ? styles.selectTriggerOpen : ''}`}
        onClick={() => setOpen(!open)}
      >
        <span className={styles.selectValue}>
          {selected?.icon && <span className={styles.selectIcon}>{selected.icon}</span>}
          {selected?.label || placeholder || 'Select'}
          {showPriceAddon && selected?.priceAddon !== undefined && selected.priceAddon > 0 && (
            <span className={styles.selectAddon}>+${selected.priceAddon.toFixed(2)}</span>
          )}
        </span>
        <span className={`${styles.selectChev} ${open ? styles.selectChevOpen : ''}`}>
          <Icon name="chevron-down" size={14} />
        </span>
      </button>
      {open && (
        <div className={styles.selectMenu}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.selectOpt} ${opt.value === value ? styles.selectOptActive : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.icon && <span className={styles.selectIcon}>{opt.icon}</span>}
              <span className={styles.selectOptInfo}>
                <span className={styles.selectOptLabel}>{opt.label}</span>
                {opt.description && <span className={styles.selectOptDesc}>{opt.description}</span>}
              </span>
              {showPriceAddon && opt.priceAddon !== undefined && opt.priceAddon > 0 && (
                <span className={styles.selectOptPrice}>+${opt.priceAddon.toFixed(2)}</span>
              )}
              {opt.value === value && <span className={styles.selectOptCheck}><Icon name="check" size={14} /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Stepper({
  value, onChange, min = 1, max = 999, step = 1, unit, decimals = 0, compact = false,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  decimals?: number;
  compact?: boolean;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const fmt = (v: number) => decimals > 0 ? v.toFixed(decimals).replace(/\.?0+$/, '') : `${v}`;
  return (
    <div className={`${styles.stepper} ${compact ? styles.stepperCompact : ''}`}>
      <button type="button" className={styles.stepperBtn} onClick={() => onChange(clamp(value - step))} aria-label="decrement">
        <Icon name="minus" size={13} />
      </button>
      <input
        className={styles.stepperInput}
        type="number"
        value={fmt(value)}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) onChange(clamp(n));
          else if (e.target.value === '') onChange(0);
        }}
        step={step}
        min={min}
        max={max}
      />
      {unit && <span className={styles.stepperUnit}>{unit}</span>}
      <button type="button" className={styles.stepperBtn} onClick={() => onChange(clamp(value + step))} aria-label="increment">
        <Icon name="plus" size={13} />
      </button>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}
      onClick={() => onChange(!value)}
      aria-pressed={value}
    >
      <span className={styles.toggleDot} />
    </button>
  );
}

function Swatches({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; hex: string }[];
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <>
      <div className={styles.swatches}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`${styles.swatch} ${value === o.value ? styles.swatchActive : ''}`}
            style={{ background: o.hex } as CSSProperties}
            onClick={() => onChange(o.value)}
            title={o.label}
            aria-label={o.label}
          />
        ))}
      </div>
      {selected && (
        <div className={styles.swatchSelectedName}>
          <span className={styles.pillDot} style={{ background: selected.hex }} />
          <span><strong>{selected.label}</strong></span>
        </div>
      )}
    </>
  );
}

function Field({ label, hint, children }: { label?: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      {label && <span className={styles.fieldLabel}>{label}</span>}
      {children}
      {hint && <span className={styles.fieldHint}>{hint}</span>}
    </div>
  );
}
function Group({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.group}>
      <header className={styles.groupHead}>
        <span className={styles.groupTitle}>{title}</span>
        {action && <span className={styles.groupHelp}>{action}</span>}
      </header>
      {children}
    </section>
  );
}

const FRAME_COLOR_SWATCHES = [
  { value: 'white-137',           label: 'White 137',         hex: '#BCBCB8' },
  { value: 'almond-532',          label: 'Almond 532',        hex: '#C8B89A' },
  { value: 'commercial-brown-424',label: 'Commercial Brown',  hex: '#5C3A21' },
  { value: 'iron-ore-697',        label: 'Iron Ore 697',      hex: '#434343' },
  { value: 'black-525',           label: 'Black 525',         hex: '#1A1A1A' },
];

/* ════════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════════ */
type InspectorTab = 'layout' | 'frame' | 'glass' | 'cell' | 'grilles' | 'energy' | 'spec';

interface SectionMeta {
  id: InspectorTab;
  anchor: string;
  num: number;
  label: string;
  shortLabel: string;
  subtitle: string;
  icon: IconName;
}

const SECTION_CONFIG: SectionMeta[] = [
  { id: 'layout',  anchor: 'sec-layout',  num: 1, label: 'Size & layout',  shortLabel: 'Layout',  subtitle: 'Set the opening size and divide it into panes',          icon: 'grid' },
  { id: 'frame',   anchor: 'sec-frame',   num: 2, label: 'Frame & finish', shortLabel: 'Frame',   subtitle: 'Choose interior and exterior colours, brickmould, depth', icon: 'frame' },
  { id: 'glass',   anchor: 'sec-glass',   num: 3, label: 'Glass',          shortLabel: 'Glass',   subtitle: 'Glazing type, Low-E coatings, gas, and tinting',          icon: 'layers' },
  { id: 'cell',    anchor: 'sec-cell',    num: 4, label: 'Cell options',   shortLabel: 'Cell',    subtitle: 'Hardware, opening direction, and bug screens',           icon: 'cell' },
  { id: 'grilles', anchor: 'sec-grilles', num: 5, label: 'Grilles',        shortLabel: 'Grilles', subtitle: 'Add a grille pattern to the selected pane',              icon: 'sparkles' },
  { id: 'energy',  anchor: 'sec-energy',  num: 6, label: 'Energy ratings', shortLabel: 'Energy',  subtitle: 'NRCAN-derived performance for this build',               icon: 'gauge' },
  { id: 'spec',    anchor: 'sec-spec',    num: 7, label: 'Specifications', shortLabel: 'Spec',    subtitle: 'SKU, lead time, and full spec sheet',                    icon: 'document' },
];

export default function ConfiguratorPage() {
  const params = useParams();
  const router = useRouter();
  const typeId = params.type as string;
  const windowType = WINDOW_TYPES.find((w) => w.id === typeId);

  const [config, setConfig] = useState<ConfigState>(() => createDefaultConfig(typeId || 'awning'));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeStep, setActiveStep] = useState<InspectorTab>('layout');
  const [dimsVisible, setDimsVisible] = useState(true);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [toast, setToast] = useState<{ msg: string; sub?: string } | null>(null);
  const [skuCopied, setSkuCopied] = useState(false);
  const [tiersExpanded, setTiersExpanded] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const controlsRef = useRef<ViewerControlsAPI | null>(null);

  /* ─── B2B: Order, Customer, Project ───
     This configurator is the dealer's order-builder. Everything below
     is shared across the whole order: dealer identity, the quote it's
     attached to, the customer the dealer is quoting for, the project
     site, and the order status (Draft → Quoted → Submitted to factory). */
  const [quoteNumber] = useState('Q-08421');
  const [orderStatus, setOrderStatus] = useState<'draft' | 'quoted' | 'submitted'>('draft');
  const [projectName, setProjectName] = useState('14 Maple St — kitchen retrofit');
  const [poRef, setPoRef] = useState('');
  const [customerName, setCustomerName] = useState('John & Mary Smith');
  const [customerEmail, setCustomerEmail] = useState('john.smith@example.com');
  const [customerPhone, setCustomerPhone] = useState('(416) 555-0148');
  const [customerAddress, setCustomerAddress] = useState('14 Maple St, Toronto ON M4M 1A1');
  const [installDate, setInstallDate] = useState('');

  /* ─── Derived ─── */
  const FRAME_HEX_BY_VALUE: Record<string, string> = useMemo(() =>
    Object.fromEntries(FRAME_COLOR_SWATCHES.map((s) => [s.value, s.hex])), []);

  const viewerColour = useMemo<Colour>(() => {
    const swatch = FRAME_COLOR_SWATCHES.find((s) => s.value === config.exteriorColor);
    if (swatch) return { name: swatch.label, hex: swatch.hex };
    return COLOURS.find((c) => c.name === 'White') || COLOURS[0];
  }, [config.exteriorColor]);

  const interiorColorHex = useMemo(() => FRAME_HEX_BY_VALUE[config.interiorColor] || '#DCDCDC', [config.interiorColor, FRAME_HEX_BY_VALUE]);

  const selectedCell = useMemo(
    () => config.grid.cells.find((c) => c.id === config.selectedCellId) || config.grid.cells[0],
    [config.grid.cells, config.selectedCellId],
  );

  const energyRatings = useMemo(() => {
    if (!selectedCell) return null;
    return computeEnergyRatings(config, selectedCell);
  }, [config, selectedCell]);

  const priceData = useMemo(() => {
    if (!windowType) return { total: 0, breakdown: [] };
    return calculatePrice(config, windowType.priceNum);
  }, [config, windowType]);

  const constraints = useMemo(() => {
    if (!selectedCell) return null;
    return WINDOW_CONSTRAINTS[selectedCell.windowType] || WINDOW_CONSTRAINTS.awning;
  }, [selectedCell]);

  const viewerModelPath = useMemo(() => {
    if (!selectedCell) return windowType?.modelPath || '';
    return WINDOW_MODEL_PATHS[selectedCell.windowType] || windowType?.modelPath || '';
  }, [selectedCell, windowType]);

  /* ─── Tab status indicators ─── */
  // Show a soft dot on tabs that have non-default content (helps dealers
  // see at a glance which sections they've already configured).
  const tabHasCustomization = useMemo(() => {
    const cell = selectedCell;
    return {
      layout: config.grid.verticalCount > 1 || config.grid.horizontalCount > 1,
      frame: config.exteriorColor !== 'white-137' || config.interiorColor !== 'white-137' || config.addFoam,
      glass: config.glazingType === 'triple-pane' || config.lowECoating1 !== 'low-e1' || config.lowECoating2 !== 'low-e1',
      cell: cell ? (cell.egressHardware || cell.specialGlazing !== 'default' || cell.hardwareColor !== 'white-137') : false,
      grilles: cell ? cell.grillPattern !== 'none' : false,
      energy: false,
      spec: false,
    };
  }, [config, selectedCell]);

  /* ─── B2B derived ─── */
  const sku = useMemo(() => generateSKU(typeId, config), [typeId, config]);
  const currentTier = useMemo(() => tierForQty(config.quantity), [config.quantity]);
  const effectiveDiscount = useMemo(
    () => Math.min(0.3, currentTier.discount + DEALER.accountDiscount),
    [currentTier],
  );
  const tieredUnitPrice = useMemo(
    () => priceData.total * (1 - effectiveDiscount),
    [priceData.total, effectiveDiscount],
  );
  const lineTotal = useMemo(() => tieredUnitPrice * config.quantity, [tieredUnitPrice, config.quantity]);
  const leadTime = useMemo(() => estimateLeadTime(config.quantity, config.glazingType), [config.quantity, config.glazingType]);

  const quoteSubtotal = useMemo(() => lines.reduce((s, l) => s + l.lineTotal, 0), [lines]);
  const quoteUnits = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);
  const quoteTax = quoteSubtotal * 0.08;

  /* ─── Updaters ─── */
  const quickUpdate = useCallback((updates: Partial<ConfigState>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateConfig = useCallback((updates: Partial<ConfigState>) => {
    setIsUpdating(true);
    setTimeout(() => {
      setConfig((prev) => ({ ...prev, ...updates }));
      setIsUpdating(false);
    }, 280);
  }, []);

  const quickUpdateCell = useCallback((cellId: string, updates: Partial<WindowCell>) => {
    setConfig((prev) => ({
      ...prev,
      grid: { ...prev.grid, cells: prev.grid.cells.map((c) => c.id === cellId ? { ...c, ...updates } : c) },
    }));
  }, []);

  const updateCell = useCallback((cellId: string, updates: Partial<WindowCell>) => {
    setIsUpdating(true);
    setTimeout(() => {
      setConfig((prev) => ({
        ...prev,
        grid: { ...prev.grid, cells: prev.grid.cells.map((c) => c.id === cellId ? { ...c, ...updates } : c) },
      }));
      setIsUpdating(false);
    }, 280);
  }, []);

  /* ─── Wizard handlers ─── */
  const handleDimensionsSubmit = useCallback(() => {
    if (config.frameWidth > 0 && config.frameHeight > 0) {
      quickUpdate({ wizardStep: 'vertical' });
    }
  }, [config.frameWidth, config.frameHeight, quickUpdate]);

  const handleVerticalSelect = useCallback((count: number) => {
    setConfig((prev) => ({ ...prev, grid: { ...prev.grid, verticalCount: count }, wizardStep: 'horizontal' }));
  }, []);

  const handleHorizontalSelect = useCallback((count: number) => {
    setConfig((prev) => {
      const rowConfigs = buildDefaultRowConfigs(prev.grid.verticalCount, count);
      const cells = buildGridCells(prev.grid.verticalCount, count, prev.frameHeight, typeId, rowConfigs);
      return {
        ...prev,
        grid: { verticalCount: prev.grid.verticalCount, horizontalCount: count, rowConfigs, cells },
        selectedCellId: 'W1.1',
        wizardStep: 'done',
      };
    });
  }, [typeId]);

  const handleVerticalChange = useCallback((count: number) => {
    setConfig((prev) => {
      const baseHCount = prev.grid.horizontalCount || 1;
      const rowConfigs: RowConfig[] = [];
      for (let r = 0; r < count; r++) {
        const existing = prev.grid.rowConfigs.find((rc) => rc.row === r);
        // Newly added rows inherit the existing column count so a 2×3
        // grid stays 2×3 when you add a row, instead of collapsing the
        // top row to 1 column.
        rowConfigs.push({ row: r, horizontalCount: existing ? existing.horizontalCount : baseHCount });
      }
      const cells = buildGridCells(count, baseHCount, prev.frameHeight, typeId, rowConfigs);
      return { ...prev, grid: { verticalCount: count, horizontalCount: baseHCount, rowConfigs, cells }, selectedCellId: 'W1.1' };
    });
  }, [typeId]);

  const handleRowHorizontalChange = useCallback((row: number, newHCount: number) => {
    setConfig((prev) => {
      const newRowConfigs = prev.grid.rowConfigs.map((rc) =>
        rc.row === row ? { ...rc, horizontalCount: newHCount } : rc,
      );
      const newCells = rebuildRowCells(prev.grid.cells, row, newHCount, prev.frameHeight, prev.grid.verticalCount, typeId);
      const maxH = Math.max(...newRowConfigs.map((rc) => rc.horizontalCount));
      return { ...prev, grid: { ...prev.grid, horizontalCount: maxH, rowConfigs: newRowConfigs, cells: newCells } };
    });
  }, [typeId]);

  /* ─── B2B handlers ─── */
  const addToQuote = useCallback(() => {
    if (!windowType) return;
    const colorLabel = FRAME_COLOR_SWATCHES.find((c) => c.value === config.exteriorColor)?.label || 'White';
    const newLine: QuoteLine = {
      id: `LN-${Date.now()}`,
      sku,
      title: `${config.frameWidth}″ × ${config.frameHeight}″ ${windowType.label}`,
      qty: config.quantity,
      unitPrice: tieredUnitPrice,
      lineTotal,
      thumbColor: FRAME_HEX_BY_VALUE[config.exteriorColor] || '#DCDCDC',
      addedAt: Date.now(),
    };
    setLines((prev) => [...prev, newLine]);
    setToast({
      msg: 'Added to quote',
      sub: `${config.quantity}× ${colorLabel} · $${lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    });
    setTimeout(() => setToast(null), 2600);
  }, [windowType, sku, config, tieredUnitPrice, lineTotal, FRAME_HEX_BY_VALUE]);

  const removeLine = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const copySku = useCallback(() => {
    navigator.clipboard?.writeText(sku);
    setSkuCopied(true);
    setTimeout(() => setSkuCopied(false), 1400);
  }, [sku]);

  const handleSave = useCallback(() => {
    setLastSavedAt(Date.now());
    setToast({ msg: 'Build saved', sub: 'Available in Drafts on the dealer portal' });
    setTimeout(() => setToast(null), 2200);
  }, []);

  const handleResetCell = useCallback(() => {
    if (!selectedCell) return;
    quickUpdateCell(selectedCell.id, {
      grillPattern: 'none',
      egressHardware: false,
      specialGlazing: 'default',
      hardwareColor: 'white-137',
      screenType: 'regular',
    });
    setToast({ msg: 'Cell reset', sub: `${selectedCell.id} restored to defaults` });
    setTimeout(() => setToast(null), 1800);
  }, [selectedCell, quickUpdateCell]);

  /* ─── Keyboard shortcuts ─── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') {
        if (e.key === 'Enter') {
          (e.target as HTMLElement).blur();
          if (config.wizardStep === 'dimensions') handleDimensionsSubmit();
        }
        return;
      }
      if (e.key === 'Escape') {
        if (isFullscreen) setIsFullscreen(false);
      }
      if (e.key === 'r' || e.key === 'R') controlsRef.current?.resetView();
      if (e.key === 'f' || e.key === 'F') setIsFullscreen((v) => !v);
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen, config.wizardStep, handleDimensionsSubmit, handleSave]);

  useEffect(() => { if (!windowType) router.replace('/windows'); }, [windowType, router]);

  /* ─── Casement >20" min-horizontal enforcement ───
     The operable row in the WindowViewer is the LAST row (rows - 1) —
     that's the bottom of the rendered window where the casement hinges
     live. Upper rows are transom panes and can stay 1 column. */
  const minHorizontal = getMinHorizontal(config.frameWidth, typeId);
  useEffect(() => {
    if (config.wizardStep !== 'done') return;
    if (minHorizontal <= 1) return;
    const bottomRowIndex = config.grid.verticalCount - 1;
    const bottomRow = config.grid.rowConfigs.find((rc) => rc.row === bottomRowIndex);
    if (!bottomRow || bottomRow.horizontalCount >= minHorizontal) return;
    setConfig((prev) => {
      const newCells = rebuildRowCells(prev.grid.cells, bottomRowIndex, minHorizontal, prev.frameHeight, prev.grid.verticalCount, typeId);
      const newRowConfigs = prev.grid.rowConfigs.map((r) => r.row === bottomRowIndex ? { ...r, horizontalCount: minHorizontal } : r);
      const maxH = Math.max(...newRowConfigs.map((r) => r.horizontalCount));
      return { ...prev, grid: { ...prev.grid, rowConfigs: newRowConfigs, horizontalCount: maxH, cells: newCells } };
    });
  }, [minHorizontal, config.wizardStep, config.grid.rowConfigs, typeId, config.grid.verticalCount]);

  if (!windowType) return null;

  const isWizard = config.wizardStep !== 'done';
  const maxVertical = getMaxVertical(config.frameHeight);
  const maxHorizontal = getMaxHorizontal(config.frameWidth);

  /* ════════════════════════════════════════════════════════════
     WIZARD
     ════════════════════════════════════════════════════════════ */
  if (isWizard) {
    return (
      <div className={styles.scope}>
        <TopBar
          typeId={typeId}
          typeLabel={windowType.label}
          hideQuote
          projectName={projectName}
          onProjectNameChange={setProjectName}
          poRef={poRef}
          onPoRefChange={setPoRef}
        />
        <div className={styles.wizard}>
          <div className={styles.wizardWrap}>
            <span className={styles.wizardEyebrow}>
              <span className={styles.wizardEyebrowDot} /> Step {config.wizardStep === 'dimensions' ? '1' : config.wizardStep === 'vertical' ? '2' : '3'} of 3
            </span>
            <div className={styles.wizardHero}>
              <h1 className={styles.wizardTitle}>{windowType.label} configuration</h1>
              <p className={styles.wizardSubtitle}>
                Enter the opening size, choose the layout, then review frame, glass, cell, grille, energy, and quote details in the configurator workspace.
              </p>
            </div>

            <div className={styles.wizardSteps}>
              {/* STEP 1 */}
              <div className={`${styles.wizardStep} ${config.wizardStep === 'dimensions' ? styles.wizardStepActive : styles.wizardStepDone}`}>
                <div className={styles.wizardStepNum}>{config.wizardStep === 'dimensions' ? '1' : <Icon name="check" size={14} />}</div>
                <div className={styles.wizardStepBody}>
                  <header className={styles.wizardStepHead}>
                    <span className={styles.wizardStepTitle}>Opening size</span>
                    {config.wizardStep !== 'dimensions' && (
                      <>
                        <span className={styles.wizardStepSummary}>{config.frameWidth}″ × {config.frameHeight}″</span>
                        <button className={styles.wizardStepEdit} onClick={() => quickUpdate({ wizardStep: 'dimensions' })}>Edit</button>
                      </>
                    )}
                  </header>
                  {config.wizardStep === 'dimensions' && (
                    <div className={styles.wizardDimensions}>
                      <div className={styles.wizardDimField}>
                        <span className={styles.wizardDimLabel}>Width</span>
                        <div className={styles.wizardDimInputWrap}>
                          <input
                            className={styles.wizardDimInput}
                            type="number"
                            value={config.frameWidth || ''}
                            onChange={(e) => quickUpdate({ frameWidth: parseFloat(e.target.value) || 0 })}
                            placeholder="0"
                            min={10}
                            max={120}
                            step={0.125}
                            autoFocus
                          />
                          <span className={styles.wizardDimUnit}>in</span>
                        </div>
                      </div>
                      <div className={styles.wizardDimX}>×</div>
                      <div className={styles.wizardDimField}>
                        <span className={styles.wizardDimLabel}>Height</span>
                        <div className={styles.wizardDimInputWrap}>
                          <input
                            className={styles.wizardDimInput}
                            type="number"
                            value={config.frameHeight || ''}
                            onChange={(e) => quickUpdate({ frameHeight: parseFloat(e.target.value) || 0 })}
                            placeholder="0"
                            min={10}
                            max={120}
                            step={0.125}
                          />
                          <span className={styles.wizardDimUnit}>in</span>
                        </div>
                      </div>
                      <button
                        className={styles.wizardCta}
                        type="button"
                        onClick={handleDimensionsSubmit}
                        disabled={!(config.frameWidth > 0 && config.frameHeight > 0)}
                      >
                        Continue <Icon name="arrow-right" size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* STEP 2 */}
              <div className={`${styles.wizardStep} ${config.wizardStep === 'vertical' ? styles.wizardStepActive : config.wizardStep === 'horizontal' ? styles.wizardStepDone : styles.wizardStepIdle}`}>
                <div className={styles.wizardStepNum}>{config.wizardStep === 'horizontal' ? <Icon name="check" size={14} /> : '2'}</div>
                <div className={styles.wizardStepBody}>
                  <header className={styles.wizardStepHead}>
                    <span className={styles.wizardStepTitle}>How many windows tall?</span>
                    {config.wizardStep === 'horizontal' && (
                      <>
                        <span className={styles.wizardStepSummary}>{config.grid.verticalCount} {config.grid.verticalCount === 1 ? 'row' : 'rows'}</span>
                        <button className={styles.wizardStepEdit} onClick={() => quickUpdate({ wizardStep: 'vertical' })}>Edit</button>
                      </>
                    )}
                  </header>
                  {config.wizardStep === 'vertical' && (
                    <div className={styles.wizardChoices}>
                      {Array.from({ length: Math.max(1, maxVertical) }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          className={`${styles.wizardChoice} ${config.grid.verticalCount === n ? styles.wizardChoiceActive : ''}`}
                          onClick={() => handleVerticalSelect(n)}
                          type="button"
                        >
                          <GridIcon rows={n} cols={1} size={38} />
                          <span className={styles.wizardChoiceLabel}>{n} row{n > 1 ? 's' : ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* STEP 3 */}
              <div className={`${styles.wizardStep} ${config.wizardStep === 'horizontal' ? styles.wizardStepActive : styles.wizardStepIdle}`}>
                <div className={styles.wizardStepNum}>3</div>
                <div className={styles.wizardStepBody}>
                  <header className={styles.wizardStepHead}>
                    <span className={styles.wizardStepTitle}>How many windows wide?</span>
                  </header>
                  {config.wizardStep === 'horizontal' && (
                    <div className={styles.wizardChoices}>
                      {Array.from({ length: Math.max(1, maxHorizontal) }, (_, i) => i + 1)
                        .filter((n) => n >= minHorizontal)
                        .map((n) => (
                          <button
                            key={n}
                            className={styles.wizardChoice}
                            onClick={() => handleHorizontalSelect(n)}
                            type="button"
                          >
                            <GridIcon rows={1} cols={n} size={38} />
                            <span className={styles.wizardChoiceLabel}>{n} column{n > 1 ? 's' : ''}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
     CONFIGURATOR — B2B order workspace (v8, CPQ-style)
     Like Salesforce/SAP CPQ: compact 3D preview + tabbed dense
     option grids. Every tab shows ALL its options at once in a
     multi-column layout — no scrolling to find a control.
     ════════════════════════════════════════════════════════════ */
  const handleSubmitOrder = () => {
    if (lines.length === 0) return;
    setOrderStatus('submitted');
    setToast({ msg: 'Order sent to factory', sub: `${lines.length} ${lines.length === 1 ? 'line' : 'lines'} · ${quoteNumber}` });
    setTimeout(() => setToast(null), 3000);
  };

  const total = quoteSubtotal + quoteTax;
  const orderUnits = lines.reduce((s, l) => s + l.qty, 0);
  const statusMeta = STATUS_META[orderStatus];
  const colorHex = FRAME_HEX_BY_VALUE[config.exteriorColor] || '#DCDCDC';

  return (
    <div className={`${styles.scope} ${styles.scopeOrder}`}>
      {/* ════ TOP RAIL — single, calm strip ════ */}
      <header className={styles.topRail}>
        <div className={styles.topRailLeft}>
          <Link href="/" className={styles.topBrand}>
            <span className={styles.topBrandMark}>O</span>
            <span className={styles.topBrandText}>OpenSpec</span>
          </Link>
        </div>

        <div className={styles.topRailContext}>
          <span className={styles.topRailDealerAvatar} title={DEALER.name}>{DEALER.initials}</span>
          <span className={styles.topRailValue}>{quoteNumber}</span>
          <span className={styles.topRailDot} />
          <span className={styles.topRailValue}>{customerName || 'Add customer'}</span>
          <span className={`${styles.topRailStatus} ${styles[`orderStatus_${statusMeta.tone}`]}`}>
            <span className={styles.topRailStatusDot} /> {statusMeta.label}
          </span>
        </div>

        <div className={styles.topRailActions}>
          <Link
            href={`/configure/v2/${typeId}`}
            className={styles.topRailAltLink}
            title="Try the OpenSpec Showcase (v2) design"
          >
            <Icon name="sparkles" size={13} /> Variant 2
          </Link>
          <Link
            href={`/configure/v3/${typeId}`}
            className={styles.topRailAltLink}
            title="Try the Nanokad Classic (v3) design"
          >
            <Icon name="sparkles" size={13} /> Variant 3
          </Link>
          <button className={styles.topRailBtn} onClick={handleSave} type="button">
            <Icon name="save" size={14} /> Save draft
          </button>
        </div>
      </header>

      <main className={`${styles.cpq} ${isFullscreen ? styles.cpqFull : ''}`}>
        {/* ════ LEFT: compact 3D preview + buy box (sticky) ════ */}
        <section className={styles.cpqLeft}>
          <div className={`${styles.previewCard} ${isFullscreen ? styles.previewFull : ''}`}>
            <div className={styles.previewCanvasWrap}>
              <WindowViewer
                modelPath={viewerModelPath}
                typeId={selectedCell?.windowType || typeId}
                colour={viewerColour}
                interiorColorHex={interiorColorHex}
                controlsRef={controlsRef}
                dimensions={{ width: `${config.frameWidth}"`, height: `${selectedCell?.height || config.frameHeight}"` }}
                grid={{
                  rows: config.grid.verticalCount,
                  cols: config.grid.horizontalCount,
                  widthInches: config.frameWidth,
                  heightInches: config.frameHeight,
                  rowColCounts: config.grid.rowConfigs?.map((rc) => rc.horizontalCount),
                  cells: config.grid.cells.map((c) => ({
                    row: c.row, col: c.col,
                    modelPath: WINDOW_MODEL_PATHS[c.windowType] || windowType.modelPath,
                    cellType: c.windowType as 'awning' | 'picture' | 'fixed' | 'casement' | 'single-hung' | 'double-hung' | 'single-slider' | 'double-slider' | 'end-vent' | 'high-fix' | 'highfix',
                    grillPattern: c.grillPattern,
                    grillBarType: c.grillBarType,
                    grillBarSize: c.grillBarSize,
                    grillColor: c.grillColor,
                    grillVertical: c.grillVertical,
                    grillHorizontal: c.grillHorizontal,
                    prairieHBarLayout: c.prairieHBarLayout,
                    prairieVBarLayout: c.prairieVBarLayout,
                    prairieHBarDaylight: c.prairieHBarDaylight,
                    prairieVBarDaylight: c.prairieVBarDaylight,
                    prairieBarSpacing: c.prairieBarSpacing,
                    prairieLadderHead: c.prairieLadderHead,
                    prairieLadderSill: c.prairieLadderSill,
                    prairieLadderLeft: c.prairieLadderLeft,
                    prairieLadderRight: c.prairieLadderRight,
                    prairieHSupportBars: c.prairieHSupportBars,
                    prairieVSupportBars: c.prairieVSupportBars,
                    ladderBarSpacing: c.ladderBarSpacing,
                  })),
                  selectedCellId: config.selectedCellId,
                }}
                defaultZoom={8.0}
              />
            </div>

            {/* Tiny type badge — single non-overlapping pill */}
            <span className={styles.previewBadge}>{windowType.label}</span>

            {/* Compact controls — bottom centred pill */}
            <div className={styles.previewControls}>
              <button className={styles.previewControlBtn} onClick={() => controlsRef.current?.zoomOut()} aria-label="Zoom out"><Icon name="zoom-out" size={14} /></button>
              <button className={styles.previewControlBtn} onClick={() => controlsRef.current?.zoomIn()} aria-label="Zoom in"><Icon name="zoom-in" size={14} /></button>
              <span className={styles.previewControlSep} />
              <button className={styles.previewControlBtn} onClick={() => controlsRef.current?.rotateLeft()} aria-label="Rotate left"><Icon name="chevron-left" size={14} /></button>
              <button className={styles.previewControlBtn} onClick={() => controlsRef.current?.rotateRight()} aria-label="Rotate right"><Icon name="chevron-right" size={14} /></button>
              <span className={styles.previewControlSep} />
              <button className={styles.previewControlBtn} onClick={() => controlsRef.current?.resetView()} aria-label="Reset view"><Icon name="reset" size={14} /></button>
              <button
                className={`${styles.previewControlBtn} ${isFullscreen ? styles.previewControlBtnActive : ''}`}
                onClick={() => setIsFullscreen((v) => !v)}
                aria-label="Fullscreen"
              >
                <Icon name={isFullscreen ? 'minimize' : 'maximize'} size={14} />
              </button>
            </div>
          </div>

          {/* Clean meta strip — replaces overlays. Holds dimensions, layout, SKU, cell chips */}
          <div className={styles.previewBar}>
            <div className={styles.previewBarStat}>
              <span className={styles.previewBarStatLabel}>Size</span>
              <strong className={styles.previewBarStatValue}>{config.frameWidth}″ × {config.frameHeight}″</strong>
            </div>
            <span className={styles.previewBarSep} />
            <div className={styles.previewBarStat}>
              <span className={styles.previewBarStatLabel}>Layout</span>
              <strong className={styles.previewBarStatValue}>{config.grid.verticalCount} × {config.grid.horizontalCount}</strong>
            </div>
            <span className={`${styles.previewBarSep} ${styles.previewBarSkuOnly}`} />
            <button className={`${styles.previewBarStat} ${styles.previewBarSkuOnly}`} onClick={copySku} title={skuCopied ? 'Copied!' : 'Copy SKU'} type="button">
              <span className={styles.previewBarStatLabel}>SKU</span>
              <strong className={styles.previewBarStatValue}>
                {sku}
                <Icon name={skuCopied ? 'check' : 'copy'} size={10} />
              </strong>
            </button>
            {config.grid.cells.length > 1 && (
              <>
                <span className={styles.previewBarSep} />
                <div className={styles.previewBarChips} role="group" aria-label="Edit pane">
                  {config.grid.cells.map((c) => (
                    <button
                      key={c.id}
                      className={`${styles.previewBarChip} ${c.id === config.selectedCellId ? styles.previewBarChipActive : ''}`}
                      onClick={() => { quickUpdate({ selectedCellId: c.id }); setActiveStep('cell'); }}
                      type="button"
                      title={`Edit ${c.id}`}
                    >
                      {c.id}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Buy box — minimal: price · lead time · qty · Add to order */}
          <div className={styles.buyBox}>
            <div className={styles.buyBoxPrice}>
              <span className={styles.buyBoxPriceMain}>
                ${tieredUnitPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                <span className={styles.buyBoxPriceUnit}>/ unit</span>
              </span>
              <span className={styles.buyBoxLead}>
                <s>${priceData.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}</s>
                <span className={styles.buyBoxLeadTag}>Save {Math.round(effectiveDiscount * 100)}%</span>
                <span className={styles.buyBoxLeadDot} />
                <Icon name="truck" size={11} /> {leadTime}
              </span>
            </div>

            <div className={styles.buyBoxAdd}>
              <div className={styles.buyBoxQty}>
                <span className={styles.buyBoxQtyLabel}>Qty</span>
                <Stepper value={config.quantity} onChange={(v) => quickUpdate({ quantity: Math.max(1, v) })} min={1} max={9999} compact />
              </div>
              <button className={styles.buyBoxCta} type="button" onClick={addToQuote}>
                <Icon name="plus" size={14} /> Add to order
                <span className={styles.buyBoxCtaTotal}>
                  ${lineTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* ════ RIGHT: tab bar + dense option grid ════ */}
        <section className={styles.cpqRight}>
          <nav className={styles.cpqTabs} aria-label="Configuration categories">
            {SECTION_CONFIG.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`${styles.cpqTab} ${s.id === activeStep ? styles.cpqTabActive : ''} ${tabHasCustomization[s.id] ? styles.cpqTabDone : ''}`}
                onClick={() => setActiveStep(s.id)}
                aria-current={s.id === activeStep ? 'page' : undefined}
              >
                <span className={styles.cpqTabIcon}>
                  {tabHasCustomization[s.id] ? <Icon name="check-circle" size={14} /> : <Icon name={s.icon} size={14} />}
                </span>
                <span className={styles.cpqTabLabel}>{s.shortLabel}</span>
              </button>
            ))}
            <button
              type="button"
              className={`${styles.cpqTab} ${styles.cpqTabExtra} ${activeStep === 'spec' && customerName ? '' : ''}`}
              onClick={() => {
                const el = document.getElementById('cpq-customer-card');
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              title="Jump to customer & project info"
            >
              <span className={styles.cpqTabIcon}><Icon name="briefcase" size={14} /></span>
              <span className={styles.cpqTabLabel}>Customer</span>
            </button>
          </nav>

          <div className={styles.cpqHead}>
            <div>
              <h2 className={styles.cpqHeadTitle}>
                {SECTION_CONFIG.find((s) => s.id === activeStep)?.label}
              </h2>
              <p className={styles.cpqHeadSub}>
                {activeStep === 'cell' && selectedCell
                  ? `Editing ${selectedCell.id} — click another pane in the preview to switch.`
                  : SECTION_CONFIG.find((s) => s.id === activeStep)?.subtitle}
              </p>
            </div>
            {activeStep === 'cell' && selectedCell && (
              <button className={styles.cpqHeadAction} onClick={handleResetCell} type="button">
                <Icon name="reset" size={13} /> Reset pane
              </button>
            )}
          </div>

          <div className={styles.cpqBody}>
            <div className={styles.cpqDenseGrid}>
              {activeStep === 'layout' && (
                <LayoutTab
                  config={config}
                  maxVertical={maxVertical}
                  maxHorizontal={maxHorizontal}
                  minHorizontal={minHorizontal}
                  onChangeVertical={handleVerticalChange}
                  onChangeRowHorizontal={handleRowHorizontalChange}
                  onSelectCell={(id) => quickUpdate({ selectedCellId: id })}
                  onChangeWidth={(v) => quickUpdate({ frameWidth: v })}
                  onChangeHeight={(v) => quickUpdate({ frameHeight: v })}
                  onChangeRowHeight={(row, h) => setConfig((prev) => ({
                    ...prev,
                    grid: { ...prev.grid, cells: prev.grid.cells.map((c) => c.row === row ? { ...c, height: h } : c) },
                  }))}
                  onChangeMeasurementType={(v) => updateConfig({ measurementType: v })}
                />
              )}
              {activeStep === 'frame' && <FrameTab config={config} onUpdate={updateConfig} onQuickUpdate={quickUpdate} />}
              {activeStep === 'glass' && <GlassTab config={config} onUpdate={updateConfig} />}
              {activeStep === 'cell' && selectedCell && (
                <CellTab cell={selectedCell} typeId={typeId} constraints={constraints} onUpdateCell={(updates) => updateCell(selectedCell.id, updates)} />
              )}
              {activeStep === 'grilles' && selectedCell && (
                <GrillesTab cell={selectedCell} config={config} onUpdateCell={(updates) => updateCell(selectedCell.id, updates)} onQuickUpdateCell={(updates) => quickUpdateCell(selectedCell.id, updates)} />
              )}
              {activeStep === 'energy' && energyRatings && selectedCell && (
                <EnergyTab cell={selectedCell} ratings={energyRatings} />
              )}
              {activeStep === 'spec' && (
                <SpecTab
                  config={config}
                  windowTypeLabel={windowType.label}
                  sku={sku}
                  leadTime={leadTime}
                  unitPrice={priceData.total}
                  tieredPrice={tieredUnitPrice}
                />
              )}
            </div>

            {/* Customer & Project — always present at the bottom of the right pane */}
            <section id="cpq-customer-card" className={styles.cpqCustomer}>
              <header className={styles.cpqCustomerHead}>
                <div>
                  <span className={styles.cpqCustomerEyebrow}>Customer & project</span>
                  <h3 className={styles.cpqCustomerTitle}>{customerName || 'Add customer details'}</h3>
                </div>
                <span className={`${styles.cpqCustomerStatus} ${styles[`orderStatus_${statusMeta.tone}`]}`}>
                  <span className={styles.topRailStatusDot} /> {statusMeta.label}
                </span>
              </header>

              <div className={styles.cpqCustomerGrid}>
                <Group title="Customer">
                  <Field label="Customer name">
                    <input className={styles.textInput} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="John & Mary Smith" />
                  </Field>
                  <div className={styles.fieldGrid2}>
                    <Field label="Email">
                      <input className={styles.textInput} type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="customer@email.com" />
                    </Field>
                    <Field label="Phone">
                      <input className={styles.textInput} type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="(416) 555-0148" />
                    </Field>
                  </div>
                  <Field label="Site address">
                    <input className={styles.textInput} value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="14 Maple St, Toronto ON" />
                  </Field>
                </Group>
                <Group title="Project">
                  <Field label="Project name">
                    <input className={styles.textInput} value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="14 Maple St — kitchen retrofit" />
                  </Field>
                  <div className={styles.fieldGrid2}>
                    <Field label="PO reference">
                      <input className={styles.textInput} value={poRef} onChange={(e) => setPoRef(e.target.value)} placeholder="ACME-2026-Q3-0142" />
                    </Field>
                    <Field label="Install date">
                      <input className={styles.textInput} type="date" value={installDate} onChange={(e) => setInstallDate(e.target.value)} />
                    </Field>
                  </div>
                </Group>
              </div>
            </section>
          </div>
        </section>
      </main>

      {/* ════ STICKY BOTTOM ORDER STRIP ════ */}
      <footer className={styles.orderStrip}>
        <div className={styles.orderStripLeft}>
          <span className={styles.orderStripBadge}>{lines.length}</span>
          <div className={styles.orderStripInfo}>
            <span className={styles.orderStripTitle}>
              {lines.length === 0 ? 'No windows yet' : `${lines.length} ${lines.length === 1 ? 'window' : 'windows'} · ${orderUnits} ${orderUnits === 1 ? 'unit' : 'units'}`}
            </span>
            <span className={styles.orderStripSub}>{quoteNumber} · {customerName || 'No customer set'}</span>
          </div>
        </div>

        {lines.length > 0 && (
          <ul className={styles.orderStripItems}>
            {lines.slice(-3).map((line) => (
              <li key={line.id} className={styles.orderStripItem} title={`${line.title} — ${line.qty} × $${line.unitPrice.toFixed(2)}`}>
                <span className={styles.orderStripItemThumb} style={{ background: line.thumbColor }} />
                <span className={styles.orderStripItemLabel}>{line.title.replace(' Casement Window', '').replace(' Awning Window', '').replace(' Picture Window', '')}</span>
                <span className={styles.orderStripItemPrice}>${line.lineTotal.toFixed(0)}</span>
                <button className={styles.orderStripItemRemove} type="button" onClick={() => removeLine(line.id)} aria-label="Remove">
                  <Icon name="x" size={10} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.orderStripRight}>
          <div className={styles.orderStripTotal}>
            <span className={styles.orderStripTotalLabel}>Order total</span>
            <span className={styles.orderStripTotalAmount}>
              ${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <button
            className={styles.orderStripSubmit}
            type="button"
            onClick={handleSubmitOrder}
            disabled={lines.length === 0}
            title={lines.length > 0 ? 'Send order to factory' : 'Add at least one window first'}
          >
            <Icon name="send" size={14} /> Submit to factory
          </button>
        </div>
      </footer>

      {toast && (
        <div className={styles.toast}>
          <span className={styles.toastIcon}><Icon name="check" size={13} /></span>
          <span><span className={styles.toastStrong}>{toast.msg}</span>{toast.sub && <> — {toast.sub}</>}</span>
        </div>
      )}

      {isUpdating && (
        <div className={styles.updating}>
          <div className={styles.updatingPill}>
            <span className={styles.spinnerRing} /> Updating preview…
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   FEED SECTION — a single big block in the right-column scroll.
   Apple/Tesla aesthetic: numbered badge, generous head, clean body.
   No accordion; everything is open. Older users only ever scroll.
   ════════════════════════════════════════════════════════════════ */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function FeedSection({
  num, id, title, subtitle, done, children,
}: {
  num: number;
  id: string;
  title: string;
  subtitle?: string;
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.feedSection}>
      <header className={styles.feedSectionHead}>
        <span className={styles.feedSectionNum}>{num}</span>
        <div className={styles.feedSectionInfo}>
          <h3 className={styles.feedSectionTitle}>{title}</h3>
          {subtitle && <p className={styles.feedSectionSubtitle}>{subtitle}</p>}
        </div>
        {done && (
          <span className={styles.feedSectionDone}>
            <Icon name="check-circle" size={13} /> Done
          </span>
        )}
      </header>
      <div className={styles.feedSectionBody}>{children}</div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════
   TOPBAR
   ════════════════════════════════════════════════════════════════ */
function TopBar({
  typeId, typeLabel, quoteCount = 0, quoteSubtotal = 0, hideQuote, onOpenQuote,
  projectName, onProjectNameChange, poRef, onPoRefChange,
  lastSavedAt, onSave,
}: {
  typeId: string;
  typeLabel: string;
  quoteCount?: number;
  quoteSubtotal?: number;
  hideQuote?: boolean;
  onOpenQuote?: () => void;
  projectName: string;
  onProjectNameChange: (v: string) => void;
  poRef: string;
  onPoRefChange: (v: string) => void;
  lastSavedAt?: number | null;
  onSave?: () => void;
}) {
  const saveLabel = lastSavedAt
    ? 'Saved'
    : 'All changes auto-saved';

  return (
    <header className={styles.topbar}>
      <div className={styles.topLeft}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark}>O</span>
          <span className={styles.brandText}>OpenSpec</span>
        </Link>
        <span className={styles.topDivider} />
        <div className={styles.crumbs}>
          <Link href="/windows">Catalog</Link>
          <span className={styles.crumbDot} />
          <Link href={`/windows/${typeId}`}>{typeLabel}</Link>
          <span className={styles.crumbDot} />
          <span className={styles.crumbCurrent}>Configure</span>
        </div>
      </div>

      {!hideQuote ? (
        <div className={styles.projectContext}>
          <div className={styles.projectField}>
            <Icon name="briefcase" size={13} />
            <span className={styles.projectFieldLabel}>Project</span>
            <input
              className={styles.projectFieldInput}
              placeholder="Untitled project"
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
            />
          </div>
          <div className={styles.projectField}>
            <span className={styles.projectFieldLabel}>PO</span>
            <input
              className={styles.projectFieldInput}
              placeholder="ACME-2026-…"
              value={poRef}
              onChange={(e) => onPoRefChange(e.target.value)}
            />
          </div>
        </div>
      ) : <div />}

      <div className={styles.topRight}>
        {!hideQuote && (
          <>
            <span className={styles.saveStatus} title="Builds are auto-saved to your Drafts">
              <span className={styles.saveStatusDot} />
              {saveLabel}
            </span>
            <button className={styles.iconBtn} onClick={onSave} title="Save build (⌘ S)">
              <Icon name="save" size={14} />
            </button>
            <button className={styles.iconBtn} title="Share">
              <Icon name="share" size={14} />
            </button>
            <button className={styles.iconBtn} title="Notifications">
              <Icon name="bell" size={14} />
              <span className={styles.iconBtnDot} />
            </button>
            <span className={styles.topDivider} />
            <button className={styles.quoteCta} onClick={onOpenQuote} title="Open quote (Q)">
              <Icon name="inbox" size={13} />
              Quote
              <span className={styles.quoteCtaCount}>{quoteCount}</span>
              <span className={styles.quoteCtaTotal}>
                ${quoteSubtotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}

/* ════════════════════════════════════════════════════════════════
   ORDER HEADER — top strip showing dealer + quote # + customer +
   project + status. This is the workspace's identity card; it tells
   the dealer at a glance who's getting the order, what quote they're
   editing, and where in the lifecycle the order is (Draft → Quoted →
   Sent to factory). Always visible.
   ════════════════════════════════════════════════════════════════ */
type OrderStatus = 'draft' | 'quoted' | 'submitted';
const STATUS_META: Record<OrderStatus, { label: string; tone: 'neutral' | 'good' | 'warn' }> = {
  draft:     { label: 'Draft',                tone: 'neutral' },
  quoted:    { label: 'Quoted to customer',   tone: 'warn' },
  submitted: { label: 'Sent to factory',      tone: 'good' },
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function OrderHeader_UNUSED({
  dealer, quoteNumber, customerName, projectName, status,
  lastSavedAt, onSave, onSubmit, canSubmit,
}: {
  dealer: typeof DEALER;
  quoteNumber: string;
  customerName: string;
  projectName: string;
  status: OrderStatus;
  lastSavedAt: number | null;
  onSave: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
}) {
  const statusMeta = STATUS_META[status];
  return (
    <header className={styles.orderHeader}>
      <div className={styles.orderHeaderRow}>
        <Link href="/" className={styles.orderHeaderBrand}>
          <span className={styles.orderHeaderBrandMark}>O</span>
          <span className={styles.orderHeaderBrandText}>OpenSpec</span>
          <span className={styles.orderHeaderBrandRole}>Dealer portal</span>
        </Link>

        <div className={styles.orderHeaderDealer}>
          <span className={styles.orderHeaderDealerAvatar}>{dealer.initials}</span>
          <div className={styles.orderHeaderDealerInfo}>
            <span className={styles.orderHeaderDealerName}>{dealer.name}</span>
            <span className={styles.orderHeaderDealerTier}>{dealer.tier}</span>
          </div>
        </div>

        <div className={styles.orderHeaderActions}>
          <span className={styles.orderHeaderSave}>
            <span className={styles.orderHeaderSaveDot} />
            {lastSavedAt ? 'All changes saved' : 'Auto-saving'}
          </span>
          <button className={styles.orderHeaderBtn} onClick={onSave} type="button">
            <Icon name="save" size={14} /> Save draft
          </button>
          <button
            className={`${styles.orderHeaderBtn} ${styles.orderHeaderBtnPrimary}`}
            onClick={onSubmit}
            type="button"
            disabled={!canSubmit}
            title={canSubmit ? 'Send order to factory' : 'Add at least one line first'}
          >
            <Icon name="send" size={14} /> Submit to factory
          </button>
        </div>
      </div>

      <div className={styles.orderHeaderRow2}>
        <div className={styles.orderHeaderField}>
          <span className={styles.orderHeaderLabel}>Quote</span>
          <strong className={styles.orderHeaderValue}>{quoteNumber}</strong>
        </div>
        <span className={styles.orderHeaderSep} />
        <div className={styles.orderHeaderField}>
          <span className={styles.orderHeaderLabel}>Customer</span>
          <strong className={styles.orderHeaderValue}>{customerName || 'Add customer →'}</strong>
        </div>
        <span className={styles.orderHeaderSep} />
        <div className={styles.orderHeaderField}>
          <span className={styles.orderHeaderLabel}>Project</span>
          <strong className={styles.orderHeaderValue}>{projectName || 'Untitled project'}</strong>
        </div>
        <span className={`${styles.orderHeaderStatusPill} ${styles[`orderStatus_${statusMeta.tone}`]}`}>
          <span className={styles.orderHeaderStatusDot} /> {statusMeta.label}
        </span>
      </div>
    </header>
  );
}

/* ════════════════════════════════════════════════════════════════
   ORDER PANEL — persistent right rail. The dealer's "shopping cart"
   for this order. Shows: customer card (editable), project info,
   the current build's price/qty/CTA, line items, totals, submit.
   ════════════════════════════════════════════════════════════════ */
interface CurrentBuildSummary {
  label: string;
  dims: string;
  unitPrice: number;
  listPrice: number;
  quantity: number;
  lineTotal: number;
  sku: string;
  colorHex: string;
  leadTime: string;
  tier: PriceTier;
  discount: number;
  tiersExpanded: boolean;
  tierBreaks: PriceTier[];
  dealerAccountDiscount: number;
}

function OrderPanel({
  quoteNumber, status, dealer,
  customerName, customerEmail, customerPhone, customerAddress,
  projectName, poRef, installDate,
  onCustomerNameChange, onCustomerEmailChange, onCustomerPhoneChange, onCustomerAddressChange,
  onProjectChange, onPoRefChange, onInstallDateChange,
  currentBuild, onQtyChange, onCopySku, skuCopied, onTiersToggle, onAddBuild,
  lines, onRemoveLine, quoteSubtotal, quoteTax, onSubmit,
}: {
  quoteNumber: string;
  status: OrderStatus;
  dealer: typeof DEALER;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  projectName: string;
  poRef: string;
  installDate: string;
  onCustomerNameChange: (v: string) => void;
  onCustomerEmailChange: (v: string) => void;
  onCustomerPhoneChange: (v: string) => void;
  onCustomerAddressChange: (v: string) => void;
  onProjectChange: (v: string) => void;
  onPoRefChange: (v: string) => void;
  onInstallDateChange: (v: string) => void;

  currentBuild: CurrentBuildSummary;
  onQtyChange: (v: number) => void;
  onCopySku: () => void;
  skuCopied: boolean;
  onTiersToggle: () => void;
  onAddBuild: () => void;

  lines: QuoteLine[];
  onRemoveLine: (id: string) => void;
  quoteSubtotal: number;
  quoteTax: number;
  onSubmit: () => void;
}) {
  const [openCard, setOpenCard] = useState<'customer' | 'project'>('customer');
  const total = quoteSubtotal + quoteTax;
  const orderUnits = lines.reduce((s, l) => s + l.qty, 0);

  return (
    <aside className={styles.orderPanel} aria-label="Order summary">
      {/* Order title */}
      <header className={styles.orderPanelHead}>
        <div className={styles.orderPanelHeadTitle}>
          <span className={styles.orderPanelHeadEyebrow}>Order</span>
          <h3 className={styles.orderPanelHeadNumber}>{quoteNumber}</h3>
        </div>
        <span className={`${styles.orderPanelStatusChip} ${styles[`orderStatus_${STATUS_META[status].tone}`]}`}>
          <span className={styles.orderHeaderStatusDot} />
          {STATUS_META[status].label}
        </span>
      </header>

      {/* Customer card (collapsible for breathing room) */}
      <section className={styles.orderCard}>
        <button
          type="button"
          className={styles.orderCardHead}
          onClick={() => setOpenCard(openCard === 'customer' ? 'project' : 'customer')}
        >
          <span className={styles.orderCardHeadLeft}>
            <span className={styles.orderCardIcon}><Icon name="briefcase" size={13} /></span>
            <span className={styles.orderCardLabel}>Customer</span>
            {!openCard || openCard !== 'customer' ? (
              <span className={styles.orderCardSummary}>{customerName || 'Add customer'}</span>
            ) : null}
          </span>
          <Icon name={openCard === 'customer' ? 'chevron-up' : 'chevron-down'} size={14} />
        </button>
        {openCard === 'customer' && (
          <div className={styles.orderCardBody}>
            <Field label="Customer name">
              <input
                className={styles.textInput}
                value={customerName}
                onChange={(e) => onCustomerNameChange(e.target.value)}
                placeholder="John & Mary Smith"
              />
            </Field>
            <div className={styles.fieldGrid2}>
              <Field label="Email">
                <input
                  className={styles.textInput}
                  type="email"
                  value={customerEmail}
                  onChange={(e) => onCustomerEmailChange(e.target.value)}
                  placeholder="customer@email.com"
                />
              </Field>
              <Field label="Phone">
                <input
                  className={styles.textInput}
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => onCustomerPhoneChange(e.target.value)}
                  placeholder="(416) 555-0148"
                />
              </Field>
            </div>
            <Field label="Site address">
              <input
                className={styles.textInput}
                value={customerAddress}
                onChange={(e) => onCustomerAddressChange(e.target.value)}
                placeholder="14 Maple St, Toronto ON"
              />
            </Field>
          </div>
        )}
      </section>

      {/* Project card (collapsible) */}
      <section className={styles.orderCard}>
        <button
          type="button"
          className={styles.orderCardHead}
          onClick={() => setOpenCard(openCard === 'project' ? 'customer' : 'project')}
        >
          <span className={styles.orderCardHeadLeft}>
            <span className={styles.orderCardIcon}><Icon name="package" size={13} /></span>
            <span className={styles.orderCardLabel}>Project & PO</span>
            {openCard !== 'project' && (
              <span className={styles.orderCardSummary}>{projectName || 'Untitled'}</span>
            )}
          </span>
          <Icon name={openCard === 'project' ? 'chevron-up' : 'chevron-down'} size={14} />
        </button>
        {openCard === 'project' && (
          <div className={styles.orderCardBody}>
            <Field label="Project name">
              <input
                className={styles.textInput}
                value={projectName}
                onChange={(e) => onProjectChange(e.target.value)}
                placeholder="14 Maple St — kitchen retrofit"
              />
            </Field>
            <div className={styles.fieldGrid2}>
              <Field label="PO reference">
                <input
                  className={styles.textInput}
                  value={poRef}
                  onChange={(e) => onPoRefChange(e.target.value)}
                  placeholder="ACME-2026-Q3-0142"
                />
              </Field>
              <Field label="Install date">
                <input
                  className={styles.textInput}
                  type="date"
                  value={installDate}
                  onChange={(e) => onInstallDateChange(e.target.value)}
                />
              </Field>
            </div>
            <div className={styles.orderCardMeta}>
              <span className={styles.orderCardMetaLabel}>Dealer</span>
              <span className={styles.orderCardMetaValue}>{dealer.name}</span>
            </div>
          </div>
        )}
      </section>

      {/* Current build (price + qty + add) — Tesla-style buy box */}
      <section className={styles.orderBuyBox}>
        <header className={styles.orderBuyBoxHead}>
          <span className={styles.orderBuyBoxEyebrow}>Current build</span>
          <span className={styles.orderBuyBoxLead}>
            <Icon name="truck" size={11} /> {currentBuild.leadTime}
          </span>
        </header>
        <div className={styles.orderBuyBoxRow}>
          <span className={styles.orderBuyBoxThumb} style={{ background: currentBuild.colorHex }} />
          <div className={styles.orderBuyBoxBody}>
            <span className={styles.orderBuyBoxTitle}>{currentBuild.dims} {currentBuild.label}</span>
            <button className={styles.orderBuyBoxSku} onClick={onCopySku} type="button" title="Click to copy SKU">
              SKU {currentBuild.sku} <Icon name={skuCopied ? 'check' : 'copy'} size={10} />
            </button>
          </div>
        </div>

        <div className={styles.orderBuyBoxPrice}>
          <span className={styles.orderBuyBoxPriceMain}>
            ${currentBuild.unitPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
          <span className={styles.orderBuyBoxPriceUnit}>/ unit</span>
          <button className={styles.orderBuyBoxTier} onClick={onTiersToggle} type="button">
            {currentBuild.tier.label} · −{Math.round(currentBuild.discount * 100)}%
            <Icon name={currentBuild.tiersExpanded ? 'chevron-up' : 'chevron-down'} size={11} />
          </button>
        </div>

        {currentBuild.tiersExpanded && (
          <div className={styles.orderBuyBoxTiers}>
            {currentBuild.tierBreaks.map((tier) => {
              const totalDisc = Math.min(0.3, tier.discount + currentBuild.dealerAccountDiscount);
              const tierPrice = currentBuild.listPrice * (1 - totalDisc);
              const isActive = tier.min === currentBuild.tier.min;
              return (
                <div
                  key={tier.min}
                  className={`${styles.orderBuyBoxTierRow} ${isActive ? styles.orderBuyBoxTierActive : ''}`}
                >
                  <span>{tier.label}</span>
                  <span>${tierPrice.toFixed(0)} <span className={styles.orderBuyBoxTierDisc}>−{Math.round(totalDisc * 100)}%</span></span>
                </div>
              );
            })}
          </div>
        )}

        <div className={styles.orderBuyBoxAdd}>
          <div className={styles.orderBuyBoxQty}>
            <span className={styles.orderBuyBoxQtyLabel}>Qty</span>
            <Stepper value={currentBuild.quantity} onChange={onQtyChange} min={1} max={9999} compact />
          </div>
          <button className={styles.orderBuyBoxCta} type="button" onClick={onAddBuild}>
            <Icon name="plus" size={14} />
            Add to order · ${currentBuild.lineTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </button>
        </div>
      </section>

      {/* Line items list */}
      <section className={styles.orderLines}>
        <header className={styles.orderLinesHead}>
          <span className={styles.orderLinesTitle}>
            Order items
            <span className={styles.orderLinesCount}>{lines.length}</span>
          </span>
          <span className={styles.orderLinesUnits}>{orderUnits} units</span>
        </header>

        {lines.length === 0 ? (
          <div className={styles.orderLinesEmpty}>
            <div className={styles.orderLinesEmptyIcon}><Icon name="inbox" size={18} /></div>
            <span className={styles.orderLinesEmptyTitle}>No windows added yet</span>
            <span className={styles.orderLinesEmptyText}>
              Configure the window in the centre panel, then tap <strong>Add to order</strong>.
            </span>
          </div>
        ) : (
          <ul className={styles.orderLinesList}>
            {lines.map((line) => (
              <li key={line.id} className={styles.orderLineRow}>
                <span className={styles.orderLineThumb} style={{ background: line.thumbColor }} />
                <div className={styles.orderLineMain}>
                  <span className={styles.orderLineTitle}>{line.title}</span>
                  <span className={styles.orderLineMeta}>
                    {line.qty} × ${line.unitPrice.toFixed(2)} · SKU {line.sku}
                  </span>
                </div>
                <span className={styles.orderLinePrice}>
                  ${line.lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <button
                  className={styles.orderLineRemove}
                  onClick={() => onRemoveLine(line.id)}
                  type="button"
                  aria-label="Remove line"
                >
                  <Icon name="x" size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Totals + submit */}
      <footer className={styles.orderTotals}>
        <div className={styles.orderTotalsRow}>
          <span>Subtotal</span>
          <strong>${quoteSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        </div>
        <div className={styles.orderTotalsRow}>
          <span>Estimated tax (8%)</span>
          <strong>${quoteTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        </div>
        <div className={styles.orderTotalsDivider} />
        <div className={styles.orderTotalsTotal}>
          <span>Total</span>
          <span className={styles.orderTotalsAmount}>
            ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className={styles.orderTotalsActions}>
          <button className={styles.orderTotalsSecondary} type="button">
            <Icon name="document" size={13} /> Export PDF
          </button>
          <button
            className={styles.orderTotalsPrimary}
            type="button"
            onClick={onSubmit}
            disabled={lines.length === 0}
          >
            <Icon name="send" size={13} /> Submit to factory
          </button>
        </div>
      </footer>
    </aside>
  );
}

/* ════════════════════════════════════════════════════════════════
   LAYOUT TAB
   ════════════════════════════════════════════════════════════════ */
function LayoutTab({
  config, maxVertical, maxHorizontal, minHorizontal,
  onChangeVertical, onChangeRowHorizontal, onSelectCell,
  onChangeWidth, onChangeHeight, onChangeRowHeight, onChangeMeasurementType,
}: {
  config: ConfigState;
  maxVertical: number;
  maxHorizontal: number;
  minHorizontal: number;
  onChangeVertical: (n: number) => void;
  onChangeRowHorizontal: (row: number, n: number) => void;
  onSelectCell: (id: string) => void;
  onChangeWidth: (v: number) => void;
  onChangeHeight: (v: number) => void;
  onChangeRowHeight: (row: number, h: number) => void;
  onChangeMeasurementType: (v: string) => void;
}) {
  return (
    <>
      <Group title="Opening">
        <Field label="Measurement type">
          <Select value={config.measurementType} options={MEASUREMENT_TYPES} onChange={onChangeMeasurementType} showPriceAddon={false} />
        </Field>
        <div className={styles.fieldGrid2}>
          <Field label="Width">
            <Stepper value={config.frameWidth} onChange={onChangeWidth} min={10} max={120} step={0.125} unit="in" decimals={3} />
          </Field>
          <Field label="Height">
            <Stepper value={config.frameHeight} onChange={onChangeHeight} min={10} max={120} step={0.125} unit="in" decimals={3} />
          </Field>
        </div>
      </Group>

      <div className={styles.groupHairline} />

      <Group title="Layout">
        {/* Live preview of the resulting grid */}
        <div className={styles.layoutPreview}>
          <span className={styles.layoutPreviewIcon}>
            <GridIcon rows={config.grid.verticalCount} cols={config.grid.horizontalCount} size={28} />
          </span>
          <div className={styles.layoutPreviewBody}>
            <span className={styles.layoutPreviewTitle}>
              {config.grid.verticalCount} × {config.grid.horizontalCount} grid · {config.grid.cells.length} cell{config.grid.cells.length === 1 ? '' : 's'}
            </span>
            <span className={styles.layoutPreviewMeta}>
              {config.frameWidth}″ × {config.frameHeight}″ opening
            </span>
          </div>
        </div>

        <Field label="Rows (windows tall)">
          <div className={styles.gridChoices}>
            {Array.from({ length: Math.max(1, maxVertical) }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                className={`${styles.gridChoice} ${config.grid.verticalCount === n ? styles.gridChoiceActive : ''}`}
                onClick={() => onChangeVertical(n)}
                type="button"
              >
                <span className={styles.gridChoiceIcon}>
                  <GridIcon rows={n} cols={1} size={32} />
                </span>
                <span className={styles.gridChoiceLabel}>{n} row{n > 1 ? 's' : ''}</span>
              </button>
            ))}
          </div>
        </Field>
      </Group>

      <Group title={config.grid.verticalCount > 1 ? 'Per-row breakdown' : 'Columns'}>
        <div className={styles.layoutRows}>
          {Array.from({ length: config.grid.verticalCount }, (_, r) => {
            const rowCfg = config.grid.rowConfigs?.find((rc) => rc.row === r);
            const rowH = rowCfg?.horizontalCount || config.grid.horizontalCount;
            const rowCells = config.grid.cells.filter((c) => c.row === r);
            const cellW = Math.round((config.frameWidth / rowH) * 10) / 10;
            const cellH = rowCells[0]?.height || Math.round((config.frameHeight / config.grid.verticalCount) * 10) / 10;
            // The viewer renders r=0 at the TOP and r=verticalCount-1
            // at the BOTTOM (where the operable casement lives). The
            // bottom row must satisfy structural minimums like
            // "casement >20" must be a pair"; upper transom rows can
            // always go down to 1 column.
            const isBottomRow = r === config.grid.verticalCount - 1;
            const isTopRow = r === 0 && config.grid.verticalCount > 1;
            const rowMinHorizontal = isBottomRow ? minHorizontal : 1;
            const colChoices = Array.from({ length: Math.max(1, maxHorizontal) }, (_, i) => i + 1).filter((n) => n >= rowMinHorizontal);
            const isLocked = isBottomRow && colChoices.length === 1;
            const rowPositionLabel = config.grid.verticalCount === 1
              ? 'Layout'
              : isTopRow ? 'Top row' : isBottomRow ? 'Bottom row' : `Row ${r + 1}`;
            return (
              <div key={r} className={styles.rowCard}>
                <div className={styles.rowCardHead}>
                  <span className={styles.rowCardTitle}>
                    <span className={styles.rowCardTitleBadge}>R{r + 1}</span>
                    {rowPositionLabel}
                  </span>
                  <Stepper value={cellH} onChange={(v) => onChangeRowHeight(r, v)} min={6} max={120} step={0.125} unit="in" decimals={3} compact />
                </div>

                <div className={styles.rowCardSubsection}>
                  <div className={styles.rowCardSubsectionHead}>
                    <span className={styles.rowCardSubsectionLabel}>Columns</span>
                    {isLocked && (
                      <span className={styles.rowCardSubsectionHint} title="Casement sashes wider than 20″ must be paired for structural reasons.">
                        <Icon name="help" size={11} /> Locked at {minHorizontal} for operable row
                      </span>
                    )}
                  </div>
                  <div className={styles.rowCardChoices}>
                    {colChoices.map((n) => (
                      <button
                        key={n}
                        className={`${styles.rowCardChoice} ${rowH === n ? styles.rowCardChoiceActive : ''} ${isLocked ? styles.rowCardChoiceLocked : ''}`}
                        onClick={() => onChangeRowHorizontal(r, n)}
                        type="button"
                        disabled={isLocked}
                      >
                        <GridIcon rows={1} cols={n} size={26} />
                        <span className={styles.rowCardChoiceLabel}>{n} col{n > 1 ? 's' : ''}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.rowCardSubsection}>
                  <span className={styles.rowCardSubsectionLabel}>Cells</span>
                  <div className={styles.rowCardCells} style={{ gridTemplateColumns: `repeat(${Math.min(rowH, 3)}, minmax(0, 1fr))` }}>
                    {rowCells.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`${styles.rowCardCellBtn} ${c.id === config.selectedCellId ? styles.rowCardCellBtnActive : ''}`}
                        onClick={() => onSelectCell(c.id)}
                      >
                        <span className={styles.rowCardCellBtnId}>{c.id}</span>
                        <span className={styles.rowCardCellBtnSize}>{cellW}″ × {cellH}″ · <span style={{ textTransform: 'capitalize' }}>{c.windowType.replace('-', ' ')}</span></span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Group>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   FRAME TAB
   ════════════════════════════════════════════════════════════════ */
function FrameTab({ config, onUpdate, onQuickUpdate }: { config: ConfigState; onUpdate: (u: Partial<ConfigState>) => void; onQuickUpdate: (u: Partial<ConfigState>) => void }) {
  const windowDepth = config.glazingType === 'triple-pane' ? '4.500"' : '3.250"';
  return (
    <>
      <Group title="Exterior colour">
        <Swatches value={config.exteriorColor} options={FRAME_COLOR_SWATCHES} onChange={(v) => onUpdate({ exteriorColor: v })} />
        <Field label="Or pick from full palette">
          <Select value={config.exteriorColor} options={FRAME_COLORS} onChange={(v) => onUpdate({ exteriorColor: v })} />
        </Field>
      </Group>

      <div className={styles.groupHairline} />

      <Group title="Interior colour">
        <Swatches value={config.interiorColor} options={FRAME_COLOR_SWATCHES} onChange={(v) => onUpdate({ interiorColor: v })} />
        <Field label="Or pick from full palette">
          <Select value={config.interiorColor} options={FRAME_COLORS} onChange={(v) => onUpdate({ interiorColor: v })} />
        </Field>
      </Group>

      <div className={styles.groupHairline} />

      <Group title="Frame profile">
        <div className={styles.fieldGrid2}>
          <Field label="Brickmould"><Select value={config.brickmould} options={BRICKMOULD_OPTIONS} onChange={(v) => onUpdate({ brickmould: v })} /></Field>
          <Field label="Snap-in nailing fin"><Select value={config.nailingFin} options={NAILING_FIN_OPTIONS} onChange={(v) => onUpdate({ nailingFin: v })} /></Field>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>
            Foam-injected profile
            <span title="Improves U-factor and energy efficiency"><Icon name="help" size={12} /></span>
          </span>
          <Toggle value={config.addFoam} onChange={(v) => onQuickUpdate({ addFoam: v })} />
        </div>
        <Field label="Window depth" hint="Computed automatically from your glazing choice.">
          <div className={styles.textInput} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 36 }}>
            <span style={{ color: 'var(--ink-mute)', fontSize: 12 }}>Auto</span>
            <span style={{ fontWeight: 700, fontFeatureSettings: '"tnum"' }}>{windowDepth}</span>
          </div>
        </Field>
      </Group>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   GLASS TAB
   ════════════════════════════════════════════════════════════════ */
function GlassTab({ config, onUpdate }: { config: ConfigState; onUpdate: (u: Partial<ConfigState>) => void }) {
  return (
    <>
      <Group title="Glazing">
        <div className={styles.fieldGrid2}>
          <Field label="Glazing type"><Select value={config.glazingType} options={GLAZING_TYPES} onChange={(v) => onUpdate({ glazingType: v })} /></Field>
          <Field label="Glass thickness"><Select value={config.glassThickness} options={GLASS_THICKNESS_OPTIONS} onChange={(v) => onUpdate({ glassThickness: v })} /></Field>
        </div>
      </Group>

      <div className={styles.groupHairline} />

      <Group title="Low-E coatings">
        <div className={styles.fieldGrid2}>
          <Field label="1st pane"><Select value={config.lowECoating1} options={LOW_E_COATINGS} onChange={(v) => onUpdate({ lowECoating1: v })} /></Field>
          <Field label="2nd pane"><Select value={config.lowECoating2} options={LOW_E_COATINGS} onChange={(v) => onUpdate({ lowECoating2: v })} /></Field>
        </div>
      </Group>

      <div className={styles.groupHairline} />

      <Group title="Spacer & gas fill">
        <div className={styles.fieldGrid2}>
          <Field label="Gas type"><Select value={config.gasType} options={GAS_TYPES} onChange={(v) => onUpdate({ gasType: v })} /></Field>
          <Field label="Spacer type"><Select value={config.spacerType} options={SPACER_TYPES} onChange={(v) => onUpdate({ spacerType: v })} /></Field>
        </div>
        <Field label="Spacer colour"><Select value={config.spacerColor} options={SPACER_COLOR_OPTIONS} onChange={(v) => onUpdate({ spacerColor: v })} showPriceAddon={false} /></Field>
      </Group>

      <div className={styles.groupHairline} />

      <Group title="Tint & security">
        <div className={styles.fieldGrid2}>
          <Field label="Tint or frosting"><Select value={config.tintFrosting} options={TINT_FROSTING_OPTIONS} onChange={(v) => onUpdate({ tintFrosting: v })} /></Field>
          <Field label="Security glass"><Select value={config.securityGlass} options={SECURITY_GLASS_OPTIONS} onChange={(v) => onUpdate({ securityGlass: v })} /></Field>
        </div>
      </Group>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   CELL TAB
   ════════════════════════════════════════════════════════════════ */
function CellTab({ cell, typeId, constraints, onUpdateCell }: {
  cell: WindowCell;
  typeId: string;
  constraints: { minWidth: number; maxWidth: number; minHeight: number; maxHeight: number } | null;
  onUpdateCell: (u: Partial<WindowCell>) => void;
}) {
  const isOperable = !['picture', 'high-fix', 'fixed'].includes(cell.windowType);
  return (
    <>
      <div className={styles.selectedCellCard}>
        <span className={styles.selectedCellMark}>{cell.id}</span>
        <div className={styles.selectedCellInfo}>
          <div className={styles.selectedCellTitle}>{cell.windowType.replace('-', ' ')}</div>
          <div className={styles.selectedCellMeta}>{cell.height}″ tall · {cell.openingDirection.replace('-', ' ')}</div>
        </div>
      </div>

      <Group title="Window type">
        <Select value={cell.windowType} options={getWindowTypeOptions(typeId)} onChange={(v) => onUpdateCell({ windowType: v })} showPriceAddon={false} />
        {(['single-hung', 'double-hung'].includes(cell.windowType)) && (
          <Field label="Sash size"><Select value={cell.sashSize} options={SASH_SIZE_OPTIONS} onChange={(v) => onUpdateCell({ sashSize: v })} /></Field>
        )}
        {constraints && (
          <div className={styles.energyMeta}>
            <div className={styles.energyMetaRow}>
              <span className={styles.energyMetaLabel}>Width range</span>
              <span className={styles.energyMetaValue}>{constraints.minWidth}″ – {constraints.maxWidth}″</span>
            </div>
            <div className={styles.energyMetaRow}>
              <span className={styles.energyMetaLabel}>Height range</span>
              <span className={styles.energyMetaValue}>{constraints.minHeight}″ – {constraints.maxHeight}″</span>
            </div>
          </div>
        )}
      </Group>

      <div className={styles.groupHairline} />

      <Group title="Hardware & opening">
        <div className={styles.fieldGrid2}>
          <Field label="Handle & lock colour"><Select value={cell.hardwareColor} options={HARDWARE_COLORS} onChange={(v) => onUpdateCell({ hardwareColor: v })} /></Field>
          {isOperable ? (
            <Field label="Opens from"><Select value={cell.openingDirection} options={OPENING_DIRECTIONS} onChange={(v) => onUpdateCell({ openingDirection: v })} showPriceAddon={false} /></Field>
          ) : <div />}
        </div>
        <Field label="Bug screen"><Select value={cell.screenType} options={SCREEN_TYPES} onChange={(v) => onUpdateCell({ screenType: v })} /></Field>
      </Group>

      <div className={styles.groupHairline} />

      <Group title="Add-ons">
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Egress hardware</span>
          <Toggle value={cell.egressHardware} onChange={(v) => onUpdateCell({ egressHardware: v })} />
        </div>
        <Field label="Special glazing"><Select value={cell.specialGlazing} options={SPECIAL_GLAZING_OPTIONS} onChange={(v) => onUpdateCell({ specialGlazing: v })} /></Field>
      </Group>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   GRILLES TAB
   ════════════════════════════════════════════════════════════════ */
function GrillesTab({ cell, config, onUpdateCell, onQuickUpdateCell }: {
  cell: WindowCell;
  config: ConfigState;
  onUpdateCell: (u: Partial<WindowCell>) => void;
  onQuickUpdateCell: (u: Partial<WindowCell>) => void;
}) {
  const enabled = cell.grillPattern !== 'none';
  return (
    <>
      <div className={styles.selectedCellCard}>
        <span className={styles.selectedCellMark}>{cell.id}</span>
        <div className={styles.selectedCellInfo}>
          <div className={styles.selectedCellTitle}>Grilles</div>
          <div className={styles.selectedCellMeta}>{enabled ? cell.grillPattern : 'None applied'}</div>
        </div>
        <Toggle
          value={enabled}
          onChange={(v) => {
            if (!v) onUpdateCell({ grillPattern: 'none' });
            else {
              const cellWidth = config.frameWidth / (config.grid.horizontalCount || 1);
              const cellHeight = cell.height || config.frameHeight / (config.grid.verticalCount || 1);
              onUpdateCell({
                grillPattern: 'colonial',
                grillVertical: Math.max(1, Math.round(cellWidth / 10) - 1),
                grillHorizontal: Math.max(1, Math.round(cellHeight / 10) - 1),
              });
            }
          }}
        />
      </div>

      {enabled && (
        <>
          <Group title="Pattern">
            <div className={`${styles.tiles} ${styles.tilesCol4}`}>
              {GRILL_PATTERNS.filter((p) => p.value !== 'none').map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`${styles.tile} ${cell.grillPattern === p.value ? styles.tileActive : ''}`}
                  onClick={() => {
                    const updates: Partial<WindowCell> = { grillPattern: p.value };
                    if (p.value === 'prairie') {
                      updates.prairieHBarLayout = 'top-and-bottom';
                      updates.prairieVBarLayout = 'left-and-right';
                      updates.prairieHBarDaylight = 5.0; updates.prairieVBarDaylight = 5.0;
                      updates.prairieBarSpacing = 5;
                      updates.prairieLadderHead = 0; updates.prairieLadderSill = 0;
                      updates.prairieLadderLeft = 0; updates.prairieLadderRight = 0;
                      updates.prairieHSupportBars = 0; updates.prairieVSupportBars = 0;
                    }
                    if (p.value === 'ladder')  { updates.grillHorizontal = 1; updates.grillVertical = 4; updates.ladderBarSpacing = 20; }
                    if (p.value === 'diamond') { updates.grillHorizontal = 4; updates.grillVertical = 4; }
                    onUpdateCell(updates);
                  }}
                  title={p.description || p.label}
                >
                  <span className={styles.tileIcon}><GrillPatternIcon pattern={p.value} /></span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </Group>

          <Group title="Bar profile">
            <div className={`${styles.tiles} ${styles.tilesCol4}`}>
              {GRILL_BAR_TYPES.map((bt) => (
                <button
                  key={bt.value}
                  type="button"
                  className={`${styles.tile} ${cell.grillBarType === bt.value ? styles.tileActive : ''}`}
                  onClick={() => onUpdateCell({ grillBarType: bt.value })}
                >
                  <span className={styles.tileIcon}><GrillBarTypeIcon barType={bt.value} /></span>
                  <span>{bt.label}</span>
                </button>
              ))}
            </div>
          </Group>

          <Group title="Bar size">
            <div className={`${styles.tiles} ${styles.tilesCol3}`}>
              {GRILL_BAR_SIZES.map((sz) => (
                <button
                  key={sz.value}
                  type="button"
                  className={`${styles.tile} ${cell.grillBarSize === sz.value ? styles.tileActive : ''}`}
                  onClick={() => onUpdateCell({ grillBarSize: sz.value })}
                >
                  <span style={{ fontSize: 15, fontWeight: 700, fontFeatureSettings: '"tnum"' }}>{sz.label}</span>
                  {sz.priceAddon ? <span className={styles.tilePrice}>+${sz.priceAddon.toFixed(2)}</span> : <span className={styles.tilePrice}>included</span>}
                </button>
              ))}
            </div>
          </Group>

          <Field label="Grille colour">
            <Select value={cell.grillColor} options={GRILL_COLORS} onChange={(v) => onUpdateCell({ grillColor: v })} />
          </Field>

          {(cell.grillPattern === 'colonial' || cell.grillPattern === 'ladder' || cell.grillPattern === 'diamond') && (
            <Group title={cell.grillPattern === 'diamond' ? 'Points' : 'Lines'}>
              <div className={styles.fieldGrid2}>
                <Field label={cell.grillPattern === 'diamond' ? 'Horizontal points' : 'Horizontal lines'}>
                  <Stepper value={cell.grillHorizontal} onChange={(v) => onQuickUpdateCell({ grillHorizontal: v })} min={1} max={10} />
                </Field>
                <Field label={cell.grillPattern === 'diamond' ? 'Vertical points' : 'Vertical lines'}>
                  <Stepper value={cell.grillVertical} onChange={(v) => onQuickUpdateCell({ grillVertical: v })} min={1} max={10} />
                </Field>
              </div>
              {cell.grillPattern === 'ladder' && (
                <Field label="Bar spacing">
                  <Stepper value={cell.ladderBarSpacing || 16} onChange={(v) => onQuickUpdateCell({ ladderBarSpacing: v })} min={4} max={40} unit="in" />
                </Field>
              )}
            </Group>
          )}

          {cell.grillPattern === 'prairie' && (
            <Group title="Prairie configuration">
              <Field label="Horizontal bar layout"><Select value={cell.prairieHBarLayout || ''} options={PRAIRIE_H_BAR_LAYOUTS} onChange={(v) => onUpdateCell({ prairieHBarLayout: v })} /></Field>
              <Field label="Vertical bar layout"><Select value={cell.prairieVBarLayout || ''} options={PRAIRIE_V_BAR_LAYOUTS} onChange={(v) => onUpdateCell({ prairieVBarLayout: v })} /></Field>
              <div className={styles.fieldGrid2}>
                <Field label="H support bars"><Stepper value={cell.prairieHSupportBars || 0} onChange={(v) => onQuickUpdateCell({ prairieHSupportBars: v })} min={0} max={10} /></Field>
                <Field label="V support bars"><Stepper value={cell.prairieVSupportBars || 0} onChange={(v) => onQuickUpdateCell({ prairieVSupportBars: v })} min={0} max={10} /></Field>
              </div>
              <div className={styles.fieldGrid2}>
                <Field label="H bar daylight"><Stepper value={cell.prairieHBarDaylight || 5} onChange={(v) => onQuickUpdateCell({ prairieHBarDaylight: v })} min={1} max={20} step={0.5} unit="in" decimals={1} /></Field>
                <Field label="V bar daylight"><Stepper value={cell.prairieVBarDaylight || 5} onChange={(v) => onQuickUpdateCell({ prairieVBarDaylight: v })} min={1} max={20} step={0.5} unit="in" decimals={1} /></Field>
              </div>
              <div className={styles.fieldGrid2}>
                <Field label="Ladder count head"><Stepper value={cell.prairieLadderHead || 0} onChange={(v) => onQuickUpdateCell({ prairieLadderHead: v })} min={0} max={10} /></Field>
                <Field label="Ladder count sill"><Stepper value={cell.prairieLadderSill || 0} onChange={(v) => onQuickUpdateCell({ prairieLadderSill: v })} min={0} max={10} /></Field>
              </div>
              <div className={styles.fieldGrid2}>
                <Field label="Ladder count left"><Stepper value={cell.prairieLadderLeft || 0} onChange={(v) => onQuickUpdateCell({ prairieLadderLeft: v })} min={0} max={10} /></Field>
                <Field label="Ladder count right"><Stepper value={cell.prairieLadderRight || 0} onChange={(v) => onQuickUpdateCell({ prairieLadderRight: v })} min={0} max={10} /></Field>
              </div>
            </Group>
          )}
        </>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   ENERGY TAB
   ════════════════════════════════════════════════════════════════ */
interface EnergyData {
  er: number | string; shgc: number | string; vt: number | string;
  uFactorIP: number | string; uFactorSI: number | string;
  nrcanModel: string; nrcanRef: string;
  mostEfficient: boolean; meetsEgress: boolean;
}
function EnergyTab({ cell, ratings }: { cell: WindowCell; ratings: EnergyData }) {
  return (
    <>
      <div className={styles.selectedCellCard}>
        <span className={styles.selectedCellMark}>{cell.id}</span>
        <div className={styles.selectedCellInfo}>
          <div className={styles.selectedCellTitle}>Energy ratings</div>
          <div className={styles.selectedCellMeta}>NRCAN-derived performance</div>
        </div>
      </div>

      <Group title="Performance">
        <div className={styles.energyGrid}>
          <div className={styles.energyCard}><span className={styles.energyCardLabel}>ER</span><span className={styles.energyCardValue}>{ratings.er}</span></div>
          <div className={styles.energyCard}><span className={styles.energyCardLabel}>SHGC</span><span className={styles.energyCardValue}>{ratings.shgc}</span></div>
          <div className={styles.energyCard}><span className={styles.energyCardLabel}>VT</span><span className={styles.energyCardValue}>{ratings.vt}</span></div>
        </div>
      </Group>

      <Group title="U-factor">
        <div className={styles.fieldGrid2}>
          <div className={styles.energyCard}><span className={styles.energyCardLabel}>I-P</span><span className={styles.energyCardValue}>{ratings.uFactorIP}</span></div>
          <div className={styles.energyCard}><span className={styles.energyCardLabel}>SI</span><span className={styles.energyCardValue}>{ratings.uFactorSI}</span></div>
        </div>
      </Group>

      <Group title="NRCAN reference">
        <div className={styles.energyMeta}>
          <div className={styles.energyMetaRow}><span className={styles.energyMetaLabel}>NRCAN model #</span><span className={styles.energyMetaValue}>{ratings.nrcanModel}</span></div>
          <div className={styles.energyMetaRow}><span className={styles.energyMetaLabel}>NRCAN reference #</span><span className={styles.energyMetaValue}>{ratings.nrcanRef}</span></div>
          <div className={styles.energyMetaRow}>
            <span className={styles.energyMetaLabel}>Most efficient 2026</span>
            <span className={`${styles.badge} ${ratings.mostEfficient ? styles.badgeGood : styles.badgeWarn}`}>{ratings.mostEfficient ? 'Yes' : 'No'}</span>
          </div>
          <div className={styles.energyMetaRow}>
            <span className={styles.energyMetaLabel}>Meets egress</span>
            <span className={`${styles.badge} ${ratings.meetsEgress ? styles.badgeGood : styles.badgeWarn}`}>{ratings.meetsEgress ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </Group>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   SPEC TAB
   ════════════════════════════════════════════════════════════════ */
function SpecTab({
  config, windowTypeLabel, sku, leadTime, unitPrice, tieredPrice,
}: {
  config: ConfigState;
  windowTypeLabel: string;
  sku: string;
  leadTime: string;
  unitPrice: number;
  tieredPrice: number;
}) {
  const ext = FRAME_COLOR_SWATCHES.find((c) => c.value === config.exteriorColor)?.label || config.exteriorColor;
  const intColor = FRAME_COLOR_SWATCHES.find((c) => c.value === config.interiorColor)?.label || config.interiorColor;
  const sections: { title: string; rows: [string, string][] }[] = [
    {
      title: 'Identification',
      rows: [
        ['SKU', sku],
        ['Type', windowTypeLabel],
        ['Lead time', leadTime],
      ],
    },
    {
      title: 'Dimensions',
      rows: [
        ['Frame width', `${config.frameWidth}″`],
        ['Frame height', `${config.frameHeight}″`],
        ['Layout', `${config.grid.verticalCount} × ${config.grid.horizontalCount}`],
        ['Cells', `${config.grid.cells.length}`],
      ],
    },
    {
      title: 'Frame',
      rows: [
        ['Exterior colour', ext],
        ['Interior colour', intColor],
        ['Foam injection', config.addFoam ? 'Yes' : 'No'],
        ['Brickmould', config.brickmould],
        ['Nailing fin', config.nailingFin],
      ],
    },
    {
      title: 'Glazing',
      rows: [
        ['Type', config.glazingType],
        ['Thickness', config.glassThickness],
        ['Pane 1 Low-E', config.lowECoating1],
        ['Pane 2 Low-E', config.lowECoating2],
        ['Gas', config.gasType],
        ['Spacer', `${config.spacerType} · ${config.spacerColor}`],
        ['Tint / frosting', config.tintFrosting],
        ['Security glass', config.securityGlass],
      ],
    },
    {
      title: 'Pricing',
      rows: [
        ['MSRP unit', `$${unitPrice.toFixed(2)}`],
        ['Your unit price', `$${tieredPrice.toFixed(2)}`],
        ['Quantity', `${config.quantity}`],
        ['Line total', `$${(tieredPrice * config.quantity).toFixed(2)}`],
      ],
    },
  ];

  return (
    <>
      <div className={styles.selectedCellCard}>
        <span className={styles.selectedCellMark}><Icon name="document" size={14} /></span>
        <div className={styles.selectedCellInfo}>
          <div className={styles.selectedCellTitle}>Specification sheet</div>
          <div className={styles.selectedCellMeta}>Auto-generated for {DEALER.name}</div>
        </div>
      </div>

      {sections.map((sec) => (
        <Group key={sec.title} title={sec.title}>
          <div className={styles.energyMeta}>
            {sec.rows.map(([k, v]) => (
              <div className={styles.energyMetaRow} key={k}>
                <span className={styles.energyMetaLabel}>{k}</span>
                <span className={styles.energyMetaValue}>{v}</span>
              </div>
            ))}
          </div>
        </Group>
      ))}

      <button className={styles.drawerActionSecondary} type="button">
        <Icon name="document" size={13} /> Download spec sheet (PDF)
      </button>
    </>
  );
}
