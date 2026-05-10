'use client';

/* ═══════════════════════════════════════════════════════════════════════════
   OPENSPEC SHOWCASE — v2 alternative configurator (TESLA/APPLE PRODUCT-PAGE STYLE)
   ─────────────────────────────────────────────────────────────────────────
   Completely different from /configure/[type] (the v1 backup) and from the
   landing-page mockup (no browser-chrome, no fake URL bar, no catalog sidebar).
   Layout pattern: STICKY 3D viewer on the left + EDITORIAL scrolling
   configuration on the right, like Tesla's order builder or Apple's Mac
   configurator. Each section is a generously spaced block with a pastel
   left-edge accent (peach · sky · mint · butter · berry) drawn from the
   landing palette.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { WINDOW_TYPES, COLOURS } from '@/data/windows';
import type { Colour } from '@/data/windows';
import type { ViewerControlsAPI } from '@/components/WindowViewer';
import {
  createDefaultConfig,
  BRICKMOULD_OPTIONS,
  GLAZING_TYPES,
  GLASS_THICKNESS_OPTIONS,
  LOW_E_COATINGS,
  GAS_TYPES,
  SPACER_TYPES,
  TINT_FROSTING_OPTIONS,
  HARDWARE_COLORS,
  OPENING_DIRECTIONS,
  SCREEN_TYPES,
  GRILL_PATTERNS,
  GRILL_BAR_TYPES,
  GRILL_BAR_SIZES,
  GRILL_COLORS,
  WINDOW_MODEL_PATHS,
  computeEnergyRatings,
  calculatePrice,
} from '@/data/configuratorData';
import type { ConfigState, WindowCell } from '@/data/configuratorData';
import styles from './page.module.css';

const WindowViewer = dynamic(() => import('@/components/WindowViewer'), {
  ssr: false,
  loading: () => <div style={{ width: '100%', height: '100%' }} />,
});

const DEALER = {
  name: 'Acme Builders Inc.',
  initials: 'AB',
  tier: 'Gold partner',
  accountDiscount: 0.08,
};

const FRAME_PALETTE = [
  { value: 'white-137',            label: 'Chalk',     hex: '#F5F5F7', stroke: '#d2d2d7' },
  { value: 'almond-532',           label: 'Almond',    hex: '#C8B89A' },
  { value: 'commercial-brown-424', label: 'Umber',     hex: '#5C3A21' },
  { value: 'iron-ore-697',         label: 'Slate',     hex: '#434343' },
  { value: 'black-525',            label: 'Obsidian',  hex: '#1d1d1f' },
];

type SectionId = 'frame' | 'glass' | 'hardware' | 'grilles' | 'energy' | 'order';
type SectionAccent = 'peach' | 'sky' | 'mint' | 'butter' | 'berry' | 'graphite';

interface SectionMeta {
  id: SectionId;
  num: string;
  title: string;
  sub: string;
  accent: SectionAccent;
}

const SECTIONS: SectionMeta[] = [
  { id: 'frame',    num: '01', title: 'Frame & finish', sub: 'Pick the colour family. Inside, outside, profile.',           accent: 'peach' },
  { id: 'glass',    num: '02', title: 'Glass package',  sub: 'Layered Low-E, argon fill, spacer, optional tinting.',          accent: 'sky' },
  { id: 'hardware', num: '03', title: 'Hardware',       sub: 'Handle finish, opening direction, screens, egress safety.',     accent: 'mint' },
  { id: 'grilles',  num: '04', title: 'Grilles',        sub: 'Optional internal grilles — colonial, prairie, ladder, diamond.', accent: 'butter' },
  { id: 'energy',   num: '05', title: 'Energy ratings', sub: 'NRCAN-derived performance for the current build.',              accent: 'berry' },
  { id: 'order',    num: '06', title: 'Order summary',  sub: 'Customer, quote, items, totals — submit to factory.',           accent: 'graphite' },
];

/* ─── Inline icon (small subset) ─── */
function Icon({ name, size = 14, strokeWidth = 1.7 }: { name: string; size?: number; strokeWidth?: number }) {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'check':     return (<svg {...props}><path d="M20 6L9 17l-5-5" /></svg>);
    case 'plus':      return (<svg {...props}><path d="M12 5v14M5 12h14" /></svg>);
    case 'minus':     return (<svg {...props}><path d="M5 12h14" /></svg>);
    case 'arrow-r':   return (<svg {...props}><path d="M5 12h14M13 5l7 7-7 7" /></svg>);
    case 'chevron-d': return (<svg {...props}><path d="M6 9l6 6 6-6" /></svg>);
    case 'x':         return (<svg {...props}><path d="M18 6L6 18M6 6l12 12" /></svg>);
    case 'send':      return (<svg {...props}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>);
    case 'save':      return (<svg {...props}><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>);
    case 'truck':     return (<svg {...props}><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7"/><circle cx="6" cy="18" r="2"/><circle cx="19" cy="18" r="2"/></svg>);
    case 'sparkles':  return (<svg {...props}><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.6L5.5 9l4.6-1.9z"/></svg>);
    case 'zoom-in':   return (<svg {...props}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></svg>);
    case 'zoom-out':  return (<svg {...props}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M8 11h6"/></svg>);
    case 'reset':     return (<svg {...props}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>);
    case 'rotate-l':  return (<svg {...props}><path d="M15 18l-6-6 6-6" /></svg>);
    case 'rotate-r':  return (<svg {...props}><path d="M9 18l6-6-6-6" /></svg>);
    default:          return null;
  }
}

/* ─── Tiny primitives ─── */
function PillBtn({
  children, variant = 'glass', onClick, disabled, href,
}: {
  children: React.ReactNode;
  variant?: 'glass' | 'dark' | 'accent' | 'ghost';
  onClick?: () => void;
  disabled?: boolean;
  href?: string;
}) {
  const cls = `${styles.pill} ${styles[`pill_${variant}`]}`;
  if (href) {
    return <Link href={href} className={cls}>{children}</Link>;
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

function Stepper({ value, onChange, min = 1, max = 999, step = 1, unit, decimals = 0, dark }: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  decimals?: number;
  dark?: boolean;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const fmt = (v: number) => decimals > 0 ? v.toFixed(decimals).replace(/\.?0+$/, '') : `${v}`;
  return (
    <div className={`${styles.stepper} ${dark ? styles.stepperDark : ''}`}>
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
      />
      {unit && <span className={styles.stepperUnit}>{unit}</span>}
      <button type="button" className={styles.stepperBtn} onClick={() => onChange(clamp(value + step))} aria-label="increment">
        <Icon name="plus" size={13} />
      </button>
    </div>
  );
}

function NativeSelect({
  value, options, onChange,
}: {
  value: string;
  options: { value: string; label: string; priceAddon?: number }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className={styles.selectWrap}>
      <select className={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}{o.priceAddon ? ` (+$${o.priceAddon.toFixed(0)})` : ''}
          </option>
        ))}
      </select>
      <span className={styles.selectChev}><Icon name="chevron-d" size={13} /></span>
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

interface QuoteLine {
  id: string;
  title: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  thumbColor: string;
  addedAt: number;
}

/* ════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════════════════ */
export default function ConfiguratorV2Page() {
  const params = useParams();
  const router = useRouter();
  const typeId = params.type as string;
  const windowType = WINDOW_TYPES.find((w) => w.id === typeId);

  const [config, setConfig] = useState<ConfigState>(() => {
    const c = createDefaultConfig(typeId || 'awning');
    c.frameWidth = 36;
    c.frameHeight = 60;
    c.wizardStep = 'done';
    return c;
  });
  const [activeSection, setActiveSection] = useState<SectionId>('frame');
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('John & Mary Smith');
  const [customerEmail, setCustomerEmail] = useState('john.smith@example.com');
  const [customerAddress, setCustomerAddress] = useState('14 Maple St, Toronto ON');
  const [poRef, setPoRef] = useState('');
  const [quoteNumber] = useState('Q-08421');
  const controlsRef = useRef<ViewerControlsAPI | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  /* ─── Derived ─── */
  const FRAME_HEX_BY_VALUE: Record<string, string> = useMemo(() =>
    Object.fromEntries(FRAME_PALETTE.map((s) => [s.value, s.hex])), []);

  const viewerColour = useMemo<Colour>(() => {
    const swatch = FRAME_PALETTE.find((s) => s.value === config.exteriorColor);
    if (swatch) return { name: swatch.label, hex: swatch.hex };
    return COLOURS.find((c) => c.name === 'White') || COLOURS[0];
  }, [config.exteriorColor]);

  const interiorColorHex = useMemo(
    () => FRAME_HEX_BY_VALUE[config.interiorColor] || '#F5F5F7',
    [config.interiorColor, FRAME_HEX_BY_VALUE],
  );

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

  const tieredUnitPrice = useMemo(
    () => priceData.total * (1 - DEALER.accountDiscount),
    [priceData.total],
  );
  const lineTotal = useMemo(() => tieredUnitPrice * config.quantity, [tieredUnitPrice, config.quantity]);
  const quoteSubtotal = useMemo(() => lines.reduce((s, l) => s + l.lineTotal, 0), [lines]);
  const quoteTax = quoteSubtotal * 0.08;
  const total = quoteSubtotal + quoteTax;

  const viewerModelPath = useMemo(() => {
    if (!selectedCell) return windowType?.modelPath || '';
    return WINDOW_MODEL_PATHS[selectedCell.windowType] || windowType?.modelPath || '';
  }, [selectedCell, windowType]);

  /* ─── Updaters ─── */
  const update = useCallback((patch: Partial<ConfigState>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateCell = useCallback((cellId: string, patch: Partial<WindowCell>) => {
    setConfig((prev) => ({
      ...prev,
      grid: { ...prev.grid, cells: prev.grid.cells.map((c) => c.id === cellId ? { ...c, ...patch } : c) },
    }));
  }, []);

  const addToOrder = useCallback(() => {
    if (!windowType) return;
    const swatch = FRAME_PALETTE.find((c) => c.value === config.exteriorColor);
    const line: QuoteLine = {
      id: `LN-${Date.now()}`,
      title: `${config.frameWidth}″ × ${config.frameHeight}″ ${windowType.label}`,
      qty: config.quantity,
      unitPrice: tieredUnitPrice,
      lineTotal,
      thumbColor: swatch?.hex || '#F5F5F7',
      addedAt: Date.now(),
    };
    setLines((prev) => [...prev, line]);
    setToast(`Added ${config.quantity}× to order`);
    setTimeout(() => setToast(null), 2400);
  }, [windowType, config, tieredUnitPrice, lineTotal]);

  const removeLine = useCallback((id: string) => setLines((prev) => prev.filter((l) => l.id !== id)), []);

  const jumpTo = useCallback((id: SectionId) => {
    setActiveSection(id);
    const el = sectionRefs.current[id];
    const root = scrollContainerRef.current;
    if (!el || !root) return;
    root.scrollTo({ top: el.offsetTop - 24, behavior: 'smooth' });
  }, []);

  /* ─── Section scroll-spy ─── */
  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top);
        if (visible[0]) {
          const id = (visible[0].target as HTMLElement).dataset.sectionId as SectionId | undefined;
          if (id) setActiveSection(id);
        }
      },
      { root, rootMargin: '-20% 0px -60% 0px' },
    );
    Object.values(sectionRefs.current).forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  useEffect(() => { if (!windowType) router.replace('/windows'); }, [windowType, router]);
  if (!windowType) return null;

  const selectedSwatch = FRAME_PALETTE.find((s) => s.value === config.exteriorColor) || FRAME_PALETTE[0];

  return (
    <div className={styles.scope}>
      <div className={styles.mesh} aria-hidden />

      {/* ════ Floating pill nav ════ */}
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.brand}>
            <span className={styles.brandMark}>O<span className={styles.brandDot} /></span>
            <span className={styles.brandText}>OpenSpec.</span>
          </Link>

          <div className={styles.navContext}>
            <span className={styles.navContextDealer}>{DEALER.initials}</span>
            <span className={styles.navContextQuote}>{quoteNumber}</span>
            <span className={styles.navContextDot} />
            <span className={styles.navContextCustomer}>{customerName}</span>
            <span className={styles.navContextStatus}>
              <span className={styles.navContextStatusDot} /> Draft
            </span>
          </div>

          <div className={styles.navActions}>
            <Link href={`/configure/${typeId}`} className={styles.altLink} title="Variant 1 (CPQ classic)">
              Variant 1
            </Link>
            <Link href={`/configure/v3/${typeId}`} className={styles.altLink} title="Variant 3 (Nanokad)">
              Variant 3
            </Link>
            <PillBtn variant="ghost">
              <Icon name="save" size={13} /> Save draft
            </PillBtn>
          </div>
        </div>
      </header>

      {/* ════ Main split: sticky viewer + scrolling editorial ════ */}
      <main className={styles.shell}>
        {/* LEFT — sticky viewer hero */}
        <aside className={styles.stage}>
          <div className={styles.stageBg} aria-hidden />

          {/* Top floating chip: quote ref + status */}
          <div className={styles.stageChip}>
            <span className={styles.stageChipDot} />
            {quoteNumber} · {DEALER.name}
          </div>

          {/* The 3D model */}
          <div className={styles.stageCanvas}>
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
                })),
                selectedCellId: config.selectedCellId,
              }}
              defaultZoom={8.0}
            />
          </div>

          {/* Compact viewer controls (vertical, right edge) */}
          <div className={styles.stageControls}>
            <button className={styles.stageControlBtn} onClick={() => controlsRef.current?.zoomIn()} aria-label="Zoom in"><Icon name="zoom-in" size={13} /></button>
            <button className={styles.stageControlBtn} onClick={() => controlsRef.current?.zoomOut()} aria-label="Zoom out"><Icon name="zoom-out" size={13} /></button>
            <button className={styles.stageControlBtn} onClick={() => controlsRef.current?.rotateLeft()} aria-label="Rotate left"><Icon name="rotate-l" size={13} /></button>
            <button className={styles.stageControlBtn} onClick={() => controlsRef.current?.rotateRight()} aria-label="Rotate right"><Icon name="rotate-r" size={13} /></button>
            <button className={styles.stageControlBtn} onClick={() => controlsRef.current?.resetView()} aria-label="Reset view"><Icon name="reset" size={13} /></button>
          </div>

          {/* Floating buy box overlay (bottom of viewer) */}
          <div className={styles.buyBox}>
            <div className={styles.buyBoxLeft}>
              <span className={styles.buyBoxEyebrow}>Dealer cost · Tier A</span>
              <div className={styles.buyBoxPriceRow}>
                <span className={styles.buyBoxCurrency}>$</span>
                <span className={styles.buyBoxPrice}>{Math.round(tieredUnitPrice).toLocaleString()}</span>
                <span className={styles.buyBoxUnit}>/ unit</span>
              </div>
              <span className={styles.buyBoxMeta}>
                MSRP ${Math.round(priceData.total).toLocaleString()} · Save {Math.round(DEALER.accountDiscount * 100)}%
              </span>
            </div>
            <div className={styles.buyBoxRight}>
              <Stepper value={config.quantity} onChange={(v) => update({ quantity: Math.max(1, v) })} min={1} max={9999} dark />
              <PillBtn variant="accent" onClick={addToOrder}>
                <Icon name="plus" size={13} /> Add to order
              </PillBtn>
            </div>
          </div>
        </aside>

        {/* RIGHT — editorial scrolling sections */}
        <div className={styles.feed} ref={scrollContainerRef}>
          {/* Hero banner */}
          <header className={styles.hero}>
            <span className={styles.heroEyebrow}>Configuring · {windowType.label}</span>
            <h1 className={styles.heroTitle}>
              {config.frameWidth}″ × {config.frameHeight}″
              <span className={styles.heroTitleAccent}>{windowType.label}.</span>
            </h1>
            <p className={styles.heroSub}>
              For <em className={styles.heroSerif}>{customerName}</em> — every choice below
              updates the live preview on the left.
            </p>

            {/* Section pill nav (lets you jump quickly) */}
            <nav className={styles.jumpNav} aria-label="Jump to section">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`${styles.jumpChip} ${s.id === activeSection ? styles.jumpChipActive : ''}`}
                  onClick={() => jumpTo(s.id)}
                  data-accent={s.accent}
                >
                  <span className={styles.jumpChipNum}>{s.num}</span>
                  {s.title}
                </button>
              ))}
            </nav>
          </header>

          {/* SECTION 01 · Frame & finish */}
          <section
            id="sec-frame"
            className={`${styles.section} ${styles[`section_${SECTIONS[0].accent}`]}`}
            data-section-id="frame"
            ref={(el) => { sectionRefs.current['frame'] = el; }}
          >
            <header className={styles.sectionHead}>
              <span className={styles.sectionNum}>{SECTIONS[0].num}</span>
              <div>
                <h2 className={styles.sectionTitle}>{SECTIONS[0].title}</h2>
                <p className={styles.sectionSub}>{SECTIONS[0].sub}</p>
              </div>
            </header>

            <div className={styles.colorBlock}>
              <span className={styles.colorBlockLabel}>Exterior · {selectedSwatch.label}</span>
              <div className={styles.colorTiles}>
                {FRAME_PALETTE.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => update({ exteriorColor: c.value })}
                    className={`${styles.colorTile} ${config.exteriorColor === c.value ? styles.colorTileActive : ''}`}
                    style={{ background: c.hex, borderColor: c.stroke || 'rgba(15,23,42,0.05)' }}
                  >
                    <span className={styles.colorTileLabel}>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.colorBlock}>
              <span className={styles.colorBlockLabel}>
                Interior · {FRAME_PALETTE.find((c) => c.value === config.interiorColor)?.label || 'Chalk'}
              </span>
              <div className={styles.colorTiles}>
                {FRAME_PALETTE.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => update({ interiorColor: c.value })}
                    className={`${styles.colorTile} ${config.interiorColor === c.value ? styles.colorTileActive : ''}`}
                    style={{ background: c.hex, borderColor: c.stroke || 'rgba(15,23,42,0.05)' }}
                  >
                    <span className={styles.colorTileLabel}>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>
                <span>Brickmould</span>
                <NativeSelect
                  value={config.brickmould}
                  options={BRICKMOULD_OPTIONS}
                  onChange={(v) => update({ brickmould: v })}
                />
              </label>
              <label className={styles.fieldLabel}>
                <span>Foam-injected profile</span>
                <Toggle value={config.addFoam} onChange={(v) => update({ addFoam: v })} />
              </label>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>
                <span>Width</span>
                <Stepper value={config.frameWidth} onChange={(v) => update({ frameWidth: v })} min={10} max={120} step={0.125} unit="in" decimals={3} />
              </label>
              <label className={styles.fieldLabel}>
                <span>Height</span>
                <Stepper value={config.frameHeight} onChange={(v) => update({ frameHeight: v })} min={10} max={120} step={0.125} unit="in" decimals={3} />
              </label>
            </div>
          </section>

          {/* SECTION 02 · Glass package */}
          <section
            id="sec-glass"
            className={`${styles.section} ${styles[`section_${SECTIONS[1].accent}`]}`}
            data-section-id="glass"
            ref={(el) => { sectionRefs.current['glass'] = el; }}
          >
            <header className={styles.sectionHead}>
              <span className={styles.sectionNum}>{SECTIONS[1].num}</span>
              <div>
                <h2 className={styles.sectionTitle}>{SECTIONS[1].title}</h2>
                <p className={styles.sectionSub}>{SECTIONS[1].sub}</p>
              </div>
            </header>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>
                <span>Glazing type</span>
                <NativeSelect value={config.glazingType} options={GLAZING_TYPES} onChange={(v) => update({ glazingType: v })} />
              </label>
              <label className={styles.fieldLabel}>
                <span>Thickness</span>
                <NativeSelect value={config.glassThickness} options={GLASS_THICKNESS_OPTIONS} onChange={(v) => update({ glassThickness: v })} />
              </label>
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>
                <span>Low-E · 1st pane</span>
                <NativeSelect value={config.lowECoating1} options={LOW_E_COATINGS} onChange={(v) => update({ lowECoating1: v })} />
              </label>
              <label className={styles.fieldLabel}>
                <span>Low-E · 2nd pane</span>
                <NativeSelect value={config.lowECoating2} options={LOW_E_COATINGS} onChange={(v) => update({ lowECoating2: v })} />
              </label>
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>
                <span>Gas fill</span>
                <NativeSelect value={config.gasType} options={GAS_TYPES} onChange={(v) => update({ gasType: v })} />
              </label>
              <label className={styles.fieldLabel}>
                <span>Spacer</span>
                <NativeSelect value={config.spacerType} options={SPACER_TYPES} onChange={(v) => update({ spacerType: v })} />
              </label>
            </div>
            <div className={styles.fieldRow}>
              <label className={`${styles.fieldLabel} ${styles.fieldLabelFull}`}>
                <span>Tint or frosting</span>
                <NativeSelect value={config.tintFrosting} options={TINT_FROSTING_OPTIONS} onChange={(v) => update({ tintFrosting: v })} />
              </label>
            </div>
          </section>

          {/* SECTION 03 · Hardware */}
          <section
            id="sec-hardware"
            className={`${styles.section} ${styles[`section_${SECTIONS[2].accent}`]}`}
            data-section-id="hardware"
            ref={(el) => { sectionRefs.current['hardware'] = el; }}
          >
            <header className={styles.sectionHead}>
              <span className={styles.sectionNum}>{SECTIONS[2].num}</span>
              <div>
                <h2 className={styles.sectionTitle}>{SECTIONS[2].title}</h2>
                <p className={styles.sectionSub}>{SECTIONS[2].sub}</p>
              </div>
            </header>
            {selectedCell && (
              <>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>
                    <span>Handle & lock colour</span>
                    <NativeSelect value={selectedCell.hardwareColor} options={HARDWARE_COLORS} onChange={(v) => updateCell(selectedCell.id, { hardwareColor: v })} />
                  </label>
                  <label className={styles.fieldLabel}>
                    <span>Opens from</span>
                    <NativeSelect value={selectedCell.openingDirection} options={OPENING_DIRECTIONS} onChange={(v) => updateCell(selectedCell.id, { openingDirection: v })} />
                  </label>
                </div>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>
                    <span>Bug screen</span>
                    <NativeSelect value={selectedCell.screenType} options={SCREEN_TYPES} onChange={(v) => updateCell(selectedCell.id, { screenType: v })} />
                  </label>
                  <label className={styles.fieldLabel}>
                    <span>Egress hardware</span>
                    <Toggle value={selectedCell.egressHardware} onChange={(v) => updateCell(selectedCell.id, { egressHardware: v })} />
                  </label>
                </div>
              </>
            )}
          </section>

          {/* SECTION 04 · Grilles */}
          <section
            id="sec-grilles"
            className={`${styles.section} ${styles[`section_${SECTIONS[3].accent}`]}`}
            data-section-id="grilles"
            ref={(el) => { sectionRefs.current['grilles'] = el; }}
          >
            <header className={styles.sectionHead}>
              <span className={styles.sectionNum}>{SECTIONS[3].num}</span>
              <div>
                <h2 className={styles.sectionTitle}>{SECTIONS[3].title}</h2>
                <p className={styles.sectionSub}>{SECTIONS[3].sub}</p>
              </div>
            </header>

            {selectedCell && (
              <>
                <div className={styles.patternRow}>
                  {GRILL_PATTERNS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => updateCell(selectedCell.id, { grillPattern: p.value })}
                      className={`${styles.patternTile} ${selectedCell.grillPattern === p.value ? styles.patternTileActive : ''}`}
                    >
                      <span className={styles.patternTileLabel}>{p.label}</span>
                    </button>
                  ))}
                </div>

                {selectedCell.grillPattern !== 'none' && (
                  <>
                    <div className={styles.fieldRow}>
                      <label className={styles.fieldLabel}>
                        <span>Bar type</span>
                        <NativeSelect value={selectedCell.grillBarType} options={GRILL_BAR_TYPES} onChange={(v) => updateCell(selectedCell.id, { grillBarType: v })} />
                      </label>
                      <label className={styles.fieldLabel}>
                        <span>Bar size</span>
                        <NativeSelect value={selectedCell.grillBarSize} options={GRILL_BAR_SIZES} onChange={(v) => updateCell(selectedCell.id, { grillBarSize: v })} />
                      </label>
                    </div>
                    <div className={styles.fieldRow}>
                      <label className={styles.fieldLabel}>
                        <span>Grille colour</span>
                        <NativeSelect value={selectedCell.grillColor} options={GRILL_COLORS} onChange={(v) => updateCell(selectedCell.id, { grillColor: v })} />
                      </label>
                    </div>
                    <div className={styles.fieldRow}>
                      <label className={styles.fieldLabel}>
                        <span>Horizontal lines</span>
                        <Stepper value={selectedCell.grillHorizontal} onChange={(v) => updateCell(selectedCell.id, { grillHorizontal: v })} min={1} max={10} />
                      </label>
                      <label className={styles.fieldLabel}>
                        <span>Vertical lines</span>
                        <Stepper value={selectedCell.grillVertical} onChange={(v) => updateCell(selectedCell.id, { grillVertical: v })} min={1} max={10} />
                      </label>
                    </div>
                  </>
                )}
              </>
            )}
          </section>

          {/* SECTION 05 · Energy */}
          <section
            id="sec-energy"
            className={`${styles.section} ${styles[`section_${SECTIONS[4].accent}`]}`}
            data-section-id="energy"
            ref={(el) => { sectionRefs.current['energy'] = el; }}
          >
            <header className={styles.sectionHead}>
              <span className={styles.sectionNum}>{SECTIONS[4].num}</span>
              <div>
                <h2 className={styles.sectionTitle}>{SECTIONS[4].title}</h2>
                <p className={styles.sectionSub}>{SECTIONS[4].sub}</p>
              </div>
            </header>
            {energyRatings && (
              <div className={styles.energyGrid}>
                <div className={styles.energyTile}>
                  <span className={styles.energyTileLabel}>ER</span>
                  <span className={styles.energyTileValue}>{energyRatings.er}</span>
                </div>
                <div className={styles.energyTile}>
                  <span className={styles.energyTileLabel}>SHGC</span>
                  <span className={styles.energyTileValue}>{energyRatings.shgc}</span>
                </div>
                <div className={styles.energyTile}>
                  <span className={styles.energyTileLabel}>VT</span>
                  <span className={styles.energyTileValue}>{energyRatings.vt}</span>
                </div>
                <div className={styles.energyTile}>
                  <span className={styles.energyTileLabel}>U-factor (I-P)</span>
                  <span className={styles.energyTileValue}>{energyRatings.uFactorIP}</span>
                </div>
                <div className={styles.energyTile}>
                  <span className={styles.energyTileLabel}>U-factor (SI)</span>
                  <span className={styles.energyTileValue}>{energyRatings.uFactorSI}</span>
                </div>
                <div className={styles.energyTile}>
                  <span className={styles.energyTileLabel}>NRCAN ref</span>
                  <span className={styles.energyTileValueSmall}>{energyRatings.nrcanRef}</span>
                </div>
              </div>
            )}
          </section>

          {/* SECTION 06 · Order summary */}
          <section
            id="sec-order"
            className={`${styles.section} ${styles[`section_${SECTIONS[5].accent}`]}`}
            data-section-id="order"
            ref={(el) => { sectionRefs.current['order'] = el; }}
          >
            <header className={styles.sectionHead}>
              <span className={styles.sectionNum}>{SECTIONS[5].num}</span>
              <div>
                <h2 className={styles.sectionTitle}>{SECTIONS[5].title}</h2>
                <p className={styles.sectionSub}>{SECTIONS[5].sub}</p>
              </div>
            </header>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>
                <span>Customer name</span>
                <input className={styles.input} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </label>
              <label className={styles.fieldLabel}>
                <span>Email</span>
                <input className={styles.input} type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
              </label>
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>
                <span>Site address</span>
                <input className={styles.input} value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
              </label>
              <label className={styles.fieldLabel}>
                <span>PO ref</span>
                <input className={styles.input} value={poRef} onChange={(e) => setPoRef(e.target.value)} placeholder="ACME-2026-Q3-0142" />
              </label>
            </div>

            <div className={styles.itemsBlock}>
              <span className={styles.colorBlockLabel}>Items · {lines.length}</span>
              {lines.length === 0 ? (
                <div className={styles.emptyBlock}>
                  No windows added yet. Configure above, then tap <strong>Add to order</strong> in the floating buy box.
                </div>
              ) : (
                <ul className={styles.itemsList}>
                  {lines.map((l) => (
                    <li key={l.id} className={styles.itemRow}>
                      <span className={styles.itemThumb} style={{ background: l.thumbColor }} />
                      <div className={styles.itemInfo}>
                        <span className={styles.itemTitle}>{l.title}</span>
                        <span className={styles.itemMeta}>{l.qty} × ${l.unitPrice.toFixed(2)}</span>
                      </div>
                      <span className={styles.itemPrice}>${l.lineTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                      <button className={styles.itemRemove} type="button" onClick={() => removeLine(l.id)} aria-label="Remove">
                        <Icon name="x" size={11} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.totalsBlock}>
              <div className={styles.totalsRow}><span>Subtotal</span><strong>${quoteSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
              <div className={styles.totalsRow}><span>Tax (8%)</span><strong>${quoteTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
              <div className={styles.totalsDivider} />
              <div className={styles.totalsTotal}>
                <span>Total</span>
                <span className={styles.totalsTotalAmount}>
                  ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <PillBtn variant="dark" disabled={lines.length === 0} onClick={() => setToast('Order sent to factory')}>
                <Icon name="send" size={13} /> Submit order to factory
              </PillBtn>
            </div>
          </section>
        </div>
      </main>

      {toast && (
        <div className={styles.toast}>
          <span className={styles.toastDot} /> {toast}
        </div>
      )}
    </div>
  );
}
