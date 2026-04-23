'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { WINDOW_TYPES } from '@/data/windows';
import type { Colour } from '@/data/windows';
import { COLOURS } from '@/data/windows';
import type { ViewerControlsAPI } from '@/components/WindowViewer';
import ConfigDropdown from '@/components/ConfigDropdown';
import PriceBreakdown from '@/components/PriceBreakdown';
import {
  createDefaultConfig,
  buildGridCells,
  buildDefaultRowConfigs,
  getMaxVertical,
  getMaxHorizontal,
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
  GRILL_REQUIRE_OPTIONS,
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
import type { ConfigState, WindowCell, WizardStep, RowConfig } from '@/data/configuratorData';
import styles from './page.module.css';

const WindowViewer = dynamic(() => import('@/components/WindowViewer'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', background: '#f9f9f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#999', fontSize: 13 }}>Initializing 3D engine...</span>
    </div>
  ),
});

/* ─── Accordion Section ─── */
function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <>
      <div className={styles.sectionHeader} onClick={() => setIsOpen(!isOpen)}>
        <span className={styles.sectionTitle}>{title}</span>
        <svg className={`${styles.sectionChevron} ${isOpen ? styles.sectionChevronOpen : ''}`}
          viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      {isOpen && <div className={styles.sectionContent}>{children}</div>}
    </>
  );
}

/* ─── Toggle ─── */
function Toggle({ label, value, onChange, helpText }: { label: string; value: boolean; onChange: (v: boolean) => void; helpText?: string }) {
  return (
    <div className={styles.toggleRow}>
      <span className={styles.toggleLabel}>
        {label}
        {helpText && (
          <span style={{ cursor: 'help', opacity: 0.5 }} title={helpText}>
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="#999" strokeWidth="1.5">
              <circle cx="10" cy="10" r="8" />
              <path d="M7.5 7.5a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3" strokeLinecap="round" />
              <circle cx="10" cy="15" r="0.5" fill="#999" />
            </svg>
          </span>
        )}
      </span>
      <button className={`${styles.toggle} ${value ? styles.active : ''}`} onClick={() => onChange(!value)} type="button">
        <div className={styles.toggleDot} />
      </button>
    </div>
  );
}

/* ─── Vertical/Horizontal Grid Selector Icons ─── */
function GridIcon({ count, direction }: { count: number; direction: 'vertical' | 'horizontal' }) {
  const isVert = direction === 'vertical';
  return (
    <svg viewBox="0 0 60 60" width="50" height="50" fill="none" stroke="#999" strokeWidth="1.5">
      <rect x="5" y="5" width="50" height="50" rx="3" />
      {isVert && Array.from({ length: count - 1 }, (_, i) => (
        <line key={i} x1="5" y1={5 + (50 / count) * (i + 1)} x2="55" y2={5 + (50 / count) * (i + 1)} />
      ))}
      {!isVert && Array.from({ length: count - 1 }, (_, i) => (
        <line key={i} x1={5 + (50 / count) * (i + 1)} y1="5" x2={5 + (50 / count) * (i + 1)} y2="55" />
      ))}
    </svg>
  );
}

/* ─── Grill Pattern SVG Icons ─── */
function GrillPatternIcon({ pattern }: { pattern: string }) {
  const s = 50; // viewBox size
  const p = 6;  // padding
  const w = s - 2 * p;
  const h = s - 2 * p;

  return (
    <svg viewBox={`0 0 ${s} ${s}`} width="44" height="44" fill="none" stroke="#666" strokeWidth="1">
      <rect x={p} y={p} width={w} height={h} rx="2" strokeWidth="1.5" />
      {pattern === 'colonial' && (
        <>
          <line x1={p + w / 3} y1={p} x2={p + w / 3} y2={p + h} />
          <line x1={p + 2 * w / 3} y1={p} x2={p + 2 * w / 3} y2={p + h} />
          <line x1={p} y1={p + h / 3} x2={p + w} y2={p + h / 3} />
          <line x1={p} y1={p + 2 * h / 3} x2={p + w} y2={p + 2 * h / 3} />
        </>
      )}
      {pattern === 'prairie' && (
        <>
          <line x1={p + w * 0.25} y1={p} x2={p + w * 0.25} y2={p + h} />
          <line x1={p + w * 0.75} y1={p} x2={p + w * 0.75} y2={p + h} />
          <line x1={p} y1={p + h * 0.25} x2={p + w} y2={p + h * 0.25} />
          <line x1={p} y1={p + h * 0.75} x2={p + w} y2={p + h * 0.75} />
        </>
      )}
      {pattern === 'ladder' && (
        <>
          {/* Horizontal bars only — ladder pattern */}
          <line x1={p} y1={p + h * 0.2} x2={p + w} y2={p + h * 0.2} />
          <line x1={p} y1={p + h * 0.4} x2={p + w} y2={p + h * 0.4} />
          <line x1={p} y1={p + h * 0.6} x2={p + w} y2={p + h * 0.6} />
          <line x1={p} y1={p + h * 0.8} x2={p + w} y2={p + h * 0.8} />
        </>
      )}
      {pattern === 'diamond' && (
        <>
          {/* Diagonal X-crossing bars — diamond pattern */}
          <line x1={p} y1={p} x2={p + w} y2={p + h} />
          <line x1={p + w} y1={p} x2={p} y2={p + h} />
          <line x1={p + w / 2} y1={p} x2={p + w} y2={p + h / 2} />
          <line x1={p} y1={p + h / 2} x2={p + w / 2} y2={p + h} />
          <line x1={p + w / 2} y1={p} x2={p} y2={p + h / 2} />
          <line x1={p + w} y1={p + h / 2} x2={p + w / 2} y2={p + h} />
        </>
      )}
    </svg>
  );
}

/* ─── Grill Bar Type SVG Icons ─── */
function GrillBarTypeIcon({ barType }: { barType: string }) {
  return (
    <svg viewBox="0 0 50 50" width="44" height="44" fill="none" stroke="#666" strokeWidth="1">
      <rect x="6" y="6" width="38" height="38" rx="2" strokeWidth="1.5" />
      {barType === 'flat' && (
        <>
          {/* Thin flat bars */}
          <line x1="6" y1="25" x2="44" y2="25" strokeWidth="2" />
          <line x1="25" y1="6" x2="25" y2="44" strokeWidth="2" />
        </>
      )}
      {barType === 'georgian' && (
        <>
          {/* Wider bars with edge lines = georgian profile */}
          <rect x="6" y="22" width="38" height="6" fill="#ddd" stroke="#666" strokeWidth="0.5" />
          <rect x="22" y="6" width="6" height="38" fill="#ddd" stroke="#666" strokeWidth="0.5" />
        </>
      )}
      {barType === 'pencil' && (
        <>
          {/* Thin rounded lines */}
          <line x1="6" y1="25" x2="44" y2="25" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="25" y1="6" x2="25" y2="44" strokeWidth="1.5" strokeLinecap="round" />
          {/* Dots to show roundness */}
          <circle cx="25" cy="25" r="2" fill="#ccc" stroke="#666" strokeWidth="0.5" />
        </>
      )}
      {barType === 'sdl' && (
        <>
          {/* Double lines = SDL (bars on both sides of glass) */}
          <line x1="6" y1="24" x2="44" y2="24" strokeWidth="1.5" />
          <line x1="6" y1="27" x2="44" y2="27" strokeWidth="1.5" strokeDasharray="2 2" />
          <line x1="24" y1="6" x2="24" y2="44" strokeWidth="1.5" />
          <line x1="27" y1="6" x2="27" y2="44" strokeWidth="1.5" strokeDasharray="2 2" />
        </>
      )}
    </svg>
  );
}

/* ─── Grill Bar Size Preview Icons ─── */
function GrillBarSizeIcon({ size }: { size: string }) {
  const strokeW = size === '5/16' ? 0.8 : size === '5/8' ? 1.8 : 3.0;
  return (
    <svg viewBox="0 0 80 60" width="80" height="60" fill="none" stroke="#999" strokeWidth="1">
      <rect x="4" y="4" width="72" height="52" rx="2" strokeWidth="2" stroke="#bbb" fill="#f5f5f5" />
      <rect x="10" y="10" width="60" height="40" rx="1" strokeWidth="1" stroke="#ccc" fill="#fafafa" />
      <line x1="30" y1="10" x2="30" y2="50" strokeWidth={strokeW} stroke="#888" />
      <line x1="50" y1="10" x2="50" y2="50" strokeWidth={strokeW} stroke="#888" />
      <line x1="10" y1="23" x2="70" y2="23" strokeWidth={strokeW} stroke="#888" />
      <line x1="10" y1="37" x2="70" y2="37" strokeWidth={strokeW} stroke="#888" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN CONFIGURATOR PAGE
   ══════════════════════════════════════════════════════════════ */
export default function ConfiguratorPage() {
  const params = useParams();
  const router = useRouter();
  const typeId = params.type as string;
  const windowType = WINDOW_TYPES.find((w) => w.id === typeId);

  const [config, setConfig] = useState<ConfigState>(() => createDefaultConfig(typeId || 'awning'));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const controlsRef = useRef<ViewerControlsAPI | null>(null);

  // Map color to COLOURS for 3D viewer
  const FRAME_COLOR_HEX: Record<string, string> = {
    'white-137': '#dcdcdc',
    'almond-532': '#c8b89a',
    'black-525': '#1a1a1a',
    'iron-ore-697': '#434343',
    'commercial-brown-424': '#5c3a21',
  };

  const viewerColour = useMemo<Colour>(() => {
    const map: Record<string, string> = {
      'white-137': 'White', 'almond-532': 'Almond', 'black-525': 'Black',
      'iron-ore-697': 'Iron Ore', 'commercial-brown-424': 'Commercial Brown',
    };
    const name = map[config.exteriorColor] || 'White';
    return COLOURS.find((c) => c.name === name) || COLOURS[0];
  }, [config.exteriorColor]);

  // Interior color hex for 3D model (only pass if different from exterior)
  const interiorColorHex = useMemo(() => {
    return FRAME_COLOR_HEX[config.interiorColor] || '#dcdcdc';
  }, [config.interiorColor]);

  // Selected cell
  const selectedCell = useMemo(() => {
    return config.grid.cells.find(c => c.id === config.selectedCellId) || config.grid.cells[0];
  }, [config.grid.cells, config.selectedCellId]);

  // Energy ratings for selected cell
  const energyRatings = useMemo(() => {
    if (!selectedCell) return null;
    return computeEnergyRatings(config, selectedCell);
  }, [config, selectedCell]);

  // Price
  const priceData = useMemo(() => {
    if (!windowType) return { total: 0, breakdown: [] };
    return calculatePrice(config, windowType.priceNum);
  }, [config, windowType]);

  // Constraints for selected cell
  const constraints = useMemo(() => {
    if (!selectedCell) return null;
    return WINDOW_CONSTRAINTS[selectedCell.windowType] || WINDOW_CONSTRAINTS['awning'];
  }, [selectedCell]);

  // Model path for viewer
  const viewerModelPath = useMemo(() => {
    if (!selectedCell) return windowType?.modelPath || '';
    return WINDOW_MODEL_PATHS[selectedCell.windowType] || windowType?.modelPath || '';
  }, [selectedCell, windowType]);

  // Config update helper with flash
  const updateConfig = useCallback((updates: Partial<ConfigState>) => {
    setIsUpdating(true);
    setTimeout(() => {
      setConfig((prev) => ({ ...prev, ...updates }));
      setIsUpdating(false);
    }, 350);
  }, []);

  const quickUpdate = useCallback((updates: Partial<ConfigState>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  // Update a specific cell
  const updateCell = useCallback((cellId: string, updates: Partial<WindowCell>) => {
    setIsUpdating(true);
    setTimeout(() => {
      setConfig((prev) => ({
        ...prev,
        grid: {
          ...prev.grid,
          cells: prev.grid.cells.map(c => c.id === cellId ? { ...c, ...updates } : c),
        },
      }));
      setIsUpdating(false);
    }, 350);
  }, []);

  const quickUpdateCell = useCallback((cellId: string, updates: Partial<WindowCell>) => {
    setConfig((prev) => ({
      ...prev,
      grid: {
        ...prev.grid,
        cells: prev.grid.cells.map(c => c.id === cellId ? { ...c, ...updates } : c),
      },
    }));
  }, []);

  // Wizard step handlers
  const handleDimensionsSubmit = useCallback(() => {
    if (config.frameWidth > 0 && config.frameHeight > 0) {
      quickUpdate({ wizardStep: 'vertical' });
    }
  }, [config.frameWidth, config.frameHeight, quickUpdate]);

  const handleVerticalSelect = useCallback((count: number) => {
    setConfig(prev => ({
      ...prev,
      grid: { ...prev.grid, verticalCount: count },
      wizardStep: 'horizontal',
    }));
  }, []);

  const handleHorizontalSelect = useCallback((count: number) => {
    setConfig(prev => {
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

  // ── Post-wizard: Change vertical count (reconfigures entire grid) ──
  const handleVerticalChange = useCallback((count: number) => {
    setConfig(prev => {
      // Keep current horizontal count as default for all rows
      const hCount = prev.grid.horizontalCount || 1;
      const rowConfigs = buildDefaultRowConfigs(count, hCount);
      const cells = buildGridCells(count, hCount, prev.frameHeight, typeId, rowConfigs);
      return {
        ...prev,
        grid: { verticalCount: count, horizontalCount: hCount, rowConfigs, cells },
        selectedCellId: 'W1.1',
      };
    });
  }, [typeId]);

  // ── Post-wizard: Change horizontal count for a specific row ──
  const handleRowHorizontalChange = useCallback((row: number, newHCount: number) => {
    setConfig(prev => {
      const newRowConfigs = prev.grid.rowConfigs.map(rc =>
        rc.row === row ? { ...rc, horizontalCount: newHCount } : rc
      );
      const newCells = rebuildRowCells(
        prev.grid.cells, row, newHCount,
        prev.frameHeight, prev.grid.verticalCount, typeId
      );
      // Update overall horizontalCount to max across all rows (for viewer cols fallback)
      const maxH = Math.max(...newRowConfigs.map(rc => rc.horizontalCount));
      return {
        ...prev,
        grid: { ...prev.grid, horizontalCount: maxH, rowConfigs: newRowConfigs, cells: newCells },
        selectedCellId: prev.selectedCellId,
      };
    });
  }, [typeId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLElement).blur();
          if (config.wizardStep === 'dimensions') handleDimensionsSubmit();
        }
        return;
      }
      switch (e.key) {
        case 'Escape': if (isFullscreen) setIsFullscreen(false); break;
        case 'r': case 'R': controlsRef.current?.resetView(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen, config.wizardStep, handleDimensionsSubmit]);

  // Redirect if invalid type
  useEffect(() => {
    if (!windowType) router.replace('/windows');
  }, [windowType, router]);

  if (!windowType) return null;

  const windowDepth = config.glazingType === 'triple-pane' ? '4.500"' : '3.250"';
  const isWizard = config.wizardStep !== 'done';

  // Get the max vertical count based on height (smart constraints)
  const maxVertical = getMaxVertical(config.frameHeight);
  const maxHorizontal = getMaxHorizontal(config.frameWidth);

  /* ══════════════════════════════════════════════
     WIZARD PHASE
     ══════════════════════════════════════════════ */
  if (isWizard) {
    return (
      <>
        <div className="breadcrumb">
          <Link href="/">Products</Link><span className="sep">&raquo;</span>
          <Link href="/windows">Vinyl Windows</Link><span className="sep">&raquo;</span>
          <Link href={`/windows/${typeId}`}>{windowType.label} Windows</Link><span className="sep">&raquo;</span>
          <span>Configure</span>
        </div>

        <div className={styles.wizardContainer}>
          <h1 className={styles.wizardTitle}>Build Your Own {windowType.label} Windows</h1>
          
          <div className={styles.wizardLayout}>
            {/* LEFT: Form */}
            <div className={styles.wizardLeft}>
              {/* Step 1: Dimensions */}
              <div className={styles.wizardSection}>
                <div className={styles.wizardSectionHeader}>
                  <span>Whole Opening Details</span>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
                <div className={styles.wizardSectionBody}>
                  <div className={styles.wizardField}>
                    <span className={styles.wizardFieldLabel}>Measurement Type</span>
                    <ConfigDropdown
                      label=""
                      options={MEASUREMENT_TYPES}
                      value={config.measurementType}
                      onChange={(v) => quickUpdate({ measurementType: v })}
                      showPriceAddon={false}
                    />
                  </div>

                  {/* Visual measurement indicator */}
                  <div className={styles.wizardMeasureIcon}>
                    <svg viewBox="0 0 60 40" width="60" height="40" fill="none" stroke="#777" strokeWidth="1.2">
                      <rect x="2" y="2" width="56" height="36" rx="2" />
                      <rect x="6" y="6" width="48" height="28" rx="1" fill="none" strokeDasharray="3 2" />
                    </svg>
                    <span>{config.measurementType === 'frame-size' ? 'Frame Size' : config.measurementType === 'brickmould-size' ? 'Brickmould Size' : 'Rough Opening'}</span>
                  </div>

                  <div className={styles.dimensionRow}>
                    <div className={styles.dimensionField}>
                      <span className={styles.dimensionLabel}>
                        {config.measurementType === 'brickmould-size' ? 'Brickmould Width' : 'Frame Width'}
                      </span>
                      <div className={styles.dimensionInputWrap}>
                        <input
                          type="number"
                          className={styles.dimensionInput}
                          value={config.frameWidth || ''}
                          onChange={(e) => quickUpdate({ frameWidth: parseFloat(e.target.value) || 0 })}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleDimensionsSubmit(); }}
                          placeholder="0.000"
                          min={10}
                          max={120}
                          step={0.125}
                        />
                        <span className={styles.dimensionUnit}>Inches</span>
                      </div>
                    </div>
                    <div className={styles.dimensionField}>
                      <span className={styles.dimensionLabel}>
                        {config.measurementType === 'brickmould-size' ? 'Brickmould Height' : 'Frame Height'}
                      </span>
                      <div className={styles.dimensionInputWrap}>
                        <input
                          type="number"
                          className={styles.dimensionInput}
                          value={config.frameHeight || ''}
                          onChange={(e) => quickUpdate({ frameHeight: parseFloat(e.target.value) || 0 })}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleDimensionsSubmit(); }}
                          placeholder="0.000"
                          min={10}
                          max={120}
                          step={0.125}
                        />
                        <span className={styles.dimensionUnit}>Inches</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Number of Vertical Windows */}
              {(config.wizardStep === 'vertical' || config.wizardStep === 'horizontal') && (
                <div className={`${styles.wizardSection} ${styles.wizardSectionAnimate}`}>
                  <div className={styles.wizardSectionHeader}>
                    <span>Number of Vertical Windows</span>
                    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="#999" strokeWidth="1.5">
                      <circle cx="10" cy="10" r="8" />
                      <path d="M7.5 7.5a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3" strokeLinecap="round" />
                      <circle cx="10" cy="15" r="0.5" fill="#999" />
                    </svg>
                  </div>

                  {config.wizardStep === 'vertical' ? (
                    <div className={styles.wizardGridSelector}>
                      <div className={styles.wizardGridHeader}>
                        Choose the number of windows high for your opening (vertical windows)
                      </div>
                      {Array.from({ length: Math.max(1, maxVertical) }, (_, i) => i + 1).map((count) => (
                        <button
                          key={count}
                          className={`${styles.wizardGridOption} ${config.grid.verticalCount === count ? styles.wizardGridOptionActive : ''}`}
                          onClick={() => handleVerticalSelect(count)}
                          type="button"
                        >
                          <GridIcon count={count} direction="vertical" />
                          <span>{count} Window(s) High</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.wizardGridSelected}>
                      <GridIcon count={config.grid.verticalCount} direction="vertical" />
                      <span>{config.grid.verticalCount} Window(s) High</span>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Number of Horizontal Windows */}
              {config.wizardStep === 'horizontal' && (
                <div className={`${styles.wizardSection} ${styles.wizardSectionAnimate}`}>
                  <div className={styles.wizardSectionHeader}>
                    <span>Number of Horizontal Windows</span>
                    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="#999" strokeWidth="1.5">
                      <circle cx="10" cy="10" r="8" />
                      <path d="M7.5 7.5a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3" strokeLinecap="round" />
                      <circle cx="10" cy="15" r="0.5" fill="#999" />
                    </svg>
                  </div>

                  <div className={styles.wizardGridSelector}>
                    <div className={styles.wizardGridHeader}>
                      Choose the number of windows wide for your opening (horizontal windows)
                    </div>
                    {Array.from({ length: Math.max(1, maxHorizontal) }, (_, i) => i + 1).map((count) => (
                      <button
                        key={count}
                        className={styles.wizardGridOption}
                        onClick={() => handleHorizontalSelect(count)}
                        type="button"
                      >
                        <GridIcon count={count} direction="horizontal" />
                        <span>{count} Window(s) Wide</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Instructions */}
            <div className={styles.wizardRight}>
              <h2 className={styles.wizardWelcomeTitle}>
                Welcome to the Nanokad Window Configurator!
              </h2>
              <p className={styles.wizardWelcomeText}>
                This configurator allows you to customize your window with endless
                possibilities. Don&apos;t worry, it&apos;s very simple to use. If you get stuck, we&apos;re here to
                walk you through the steps!
              </p>

              {config.wizardStep === 'dimensions' && (
                <>
                  <h3 className={styles.wizardStepTitle}>Let&apos;s Begin</h3>
                  <p className={styles.wizardStepText}>
                    Enter the Width and Height of the window you want to configure, and click
                    away.
                  </p>
                </>
              )}

              {config.wizardStep === 'vertical' && (
                <>
                  <h3 className={styles.wizardStepTitle}>Almost there</h3>
                  <p className={styles.wizardStepText}>
                    You can fit multiple windows in your opening. Select how many vertical
                    windows you want to fit into your frame.
                  </p>
                </>
              )}

              {config.wizardStep === 'horizontal' && (
                <>
                  <h3 className={styles.wizardStepTitle}>Last step</h3>
                  <p className={styles.wizardStepText}>
                    Your opening may also be able to fit multiple windows beside each other.
                    Select how many horizontal windows you want to fit into your frame.
                  </p>
                  <p className={styles.wizardStepText} style={{ fontWeight: 600, marginTop: 16 }}>
                    After this step, the entire configurator will open up.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════════════════
     CONFIGURATOR PHASE (three-column layout)
     ══════════════════════════════════════════════ */
  return (
    <>
      <div className="breadcrumb">
        <Link href="/">Products</Link><span className="sep">&raquo;</span>
        <Link href="/windows">Vinyl Windows</Link><span className="sep">&raquo;</span>
        <Link href={`/windows/${typeId}`}>{windowType.label} Windows</Link><span className="sep">&raquo;</span>
        <span>Configure</span>
      </div>

      <div className={styles.configurator}>
        {/* ═══ LEFT: 3D Viewer ═══ */}
        <div className={`${styles.viewerColumn} ${isFullscreen ? styles.viewerFullscreen : ''}`}>
          <div className={styles.viewerArea}>
            <button className={styles.expandBtn} onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? 'Exit Fullscreen' : 'Expand'}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
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
                rowColCounts: config.grid.rowConfigs?.map(rc => rc.horizontalCount),
                cells: config.grid.cells.map(c => ({
                  row: c.row, col: c.col,
                  modelPath: WINDOW_MODEL_PATHS[c.windowType] || windowType.modelPath,
                  cellType: c.windowType as 'awning' | 'picture' | 'fixed' | 'casement' | 'single-hung' | 'double-hung' | 'single-slider' | 'double-slider' | 'end-vent' | 'high-fix' | 'highfix',
                  grillPattern: c.grillPattern,
                  grillBarType: c.grillBarType,
                  grillBarSize: c.grillBarSize,
                  grillColor: c.grillColor,
                  grillVertical: c.grillVertical,
                  grillHorizontal: c.grillHorizontal,
                  // Prairie-specific
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

          <div className={styles.controlsBar}>
            <button className={styles.ctrlBtn} onClick={() => controlsRef.current?.zoomIn()} title="Zoom In">
              <svg viewBox="0 0 24 24" width="20" height="20"><circle cx="11" cy="11" r="8" fill="none" stroke="#333" strokeWidth="2"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="#333" strokeWidth="2"/><line x1="11" y1="8" x2="11" y2="14" stroke="#333" strokeWidth="2"/><line x1="8" y1="11" x2="14" y2="11" stroke="#333" strokeWidth="2"/></svg>
            </button>
            <button className={styles.ctrlBtn} onClick={() => controlsRef.current?.zoomOut()} title="Zoom Out">
              <svg viewBox="0 0 24 24" width="20" height="20"><circle cx="11" cy="11" r="8" fill="none" stroke="#333" strokeWidth="2"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="#333" strokeWidth="2"/><line x1="8" y1="11" x2="14" y2="11" stroke="#333" strokeWidth="2"/></svg>
            </button>
            <span className={styles.ctrlSep} />
            <div className={styles.dpad}>
              <button className={styles.ctrlBtn} onClick={() => controlsRef.current?.rotateUp()} data-pos="top">
                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 19V5" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M5 12l7-7 7 7" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button className={styles.ctrlBtn} onClick={() => controlsRef.current?.rotateLeft()} data-pos="left">
                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M19 12H5" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M12 19l-7-7 7-7" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button className={styles.ctrlBtn} onClick={() => controlsRef.current?.rotateRight()} data-pos="right">
                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 12h14" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M12 5l7 7-7 7" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button className={styles.ctrlBtn} onClick={() => controlsRef.current?.rotateDown()} data-pos="bottom">
                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5v14" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M19 12l-7 7-7-7" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
            <span className={styles.ctrlSep} />
            <button className={styles.ctrlBtn} onClick={() => controlsRef.current?.toggleDimensions()} title="Toggle Measurements">
              <svg viewBox="0 0 24 24" width="20" height="20"><path d="M21 3H3v18" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 3v3M3 7h3M15 3v2M3 15h2" stroke="#333" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
            </button>
            <button className={styles.ctrlBtn} onClick={() => controlsRef.current?.resetView()} title="Reset View">
              <svg viewBox="0 0 24 24" width="20" height="20"><path d="M1 4v6h6" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

          <div className={styles.priceBar}>
            <PriceBreakdown total={priceData.total} breakdown={priceData.breakdown} />
          </div>
        </div>

        {/* ═══ RIGHT AREA: Config sections ═══ */}
        <div className={styles.rightArea}>
          {/* ── Window Configuration — full width spanning both halves ── */}
          <div className={styles.configFullWidth}>
          <Section title="Window Configuration" defaultOpen={true}>
            {/* ── Number of Vertical Windows (dropdown) ── */}
            <div className={styles.verticalDropdown}>
              <label>Number of Vertical Windows</label>
              <span className={styles.helpIcon} title="How many windows high?">?</span>
              <div className={styles.verticalSelect}>
                <GridIcon count={config.grid.verticalCount} direction="vertical" />
                <select
                  value={config.grid.verticalCount}
                  onChange={(e) => handleVerticalChange(parseInt(e.target.value))}
                >
                  {Array.from({ length: Math.max(1, maxVertical) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n} Window(s) High</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Per-row columns (side-by-side layout like panes.com) ── */}
            <div className={styles.windowConfigGrid}>
              {Array.from({ length: config.grid.verticalCount }, (_, r) => {
                const rowCfg = config.grid.rowConfigs?.find(rc => rc.row === r);
                const rowHCount = rowCfg?.horizontalCount || config.grid.horizontalCount;
                const rowCells = config.grid.cells.filter(c => c.row === r);
                const rowCellWidth = Math.round((config.frameWidth / rowHCount) * 1000) / 1000;
                const rowCellHeight = rowCells[0]?.height || Math.round((config.frameHeight / config.grid.verticalCount) * 1000) / 1000;

                return (
                  <div key={r} className={styles.windowConfigColumn}>
                    {/* Row title */}
                    <div className={styles.rowTitleHeader}>Window #{r + 1}</div>

                    {/* Per-row horizontal dropdown */}
                    <div className={styles.rowHorizLabel}>
                      Number of Horizontal Windows
                      <span className={styles.helpIcon} title="How many windows wide for this row?">?</span>
                    </div>
                    <div className={styles.rowHorizWrap}>
                      <GridIcon count={rowHCount} direction="horizontal" />
                      <select
                        value={rowHCount}
                        onChange={(e) => handleRowHorizontalChange(r, parseInt(e.target.value))}
                      >
                        {Array.from({ length: Math.max(1, maxHorizontal) }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>{n} Window(s) Wide</option>
                        ))}
                      </select>
                    </div>

                    {/* "Click on a window below to edit" */}
                    <div className={styles.cellEditLabel}>Click on a window below to edit</div>

                    {/* Cell buttons for this row */}
                    <div className={styles.cellGrid} style={{
                      gridTemplateColumns: `repeat(${rowHCount}, 1fr)`,
                    }}>
                      {rowCells.map((cell) => {
                        const cellTypeLabel = cell.windowType.charAt(0).toUpperCase() + cell.windowType.slice(1);
                        const isSelected = cell.id === config.selectedCellId;
                        return (
                          <button
                            key={cell.id}
                            className={`${styles.cellBtn} ${isSelected ? styles.cellBtnActive : ''}`}
                            onClick={() => quickUpdate({ selectedCellId: cell.id })}
                            type="button"
                          >
                            <span className={styles.cellBtnId}>{cell.id}</span>
                            <span className={styles.cellBtnSize}>
                              {rowCellWidth}&quot; x {rowCellHeight}&quot;
                            </span>
                            <span className={styles.cellBtnType}>{cellTypeLabel}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Per-row height input */}
                    <div className={styles.rowHeightSection}>
                      <div className={styles.rowHeightLabel}>Window #{r + 1} Height</div>
                      <div className={styles.rowHeightWrap}>
                        <input
                          type="number"
                          value={rowCellHeight}
                          onChange={(e) => {
                            const newH = parseFloat(e.target.value) || 0;
                            setConfig(prev => ({
                              ...prev,
                              grid: {
                                ...prev.grid,
                                cells: prev.grid.cells.map(c =>
                                  c.row === r ? { ...c, height: newH } : c
                                ),
                              },
                            }));
                          }}
                          step={0.125}
                        />
                        <span>Inches</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
          </div>{/* end configFullWidth */}

          {/* ── 50/50 Split: Whole Opening Details | Specific Options ── */}
          <div className={styles.configSplitRow}>
            {/* LEFT HALF: Whole Opening Details + Glass Options + Interior Options */}
            <div className={styles.splitLeft}>
          {/* Whole Opening Details */}
          <Section title="Whole Opening Details" defaultOpen={true}>
            <div className={styles.depthBar}>
              Overall Window Depth: <span className={styles.depthValue}>{windowDepth}</span>
            </div>

            <div style={{ marginTop: 12 }}>
              <ConfigDropdown label="Measurement Type" options={MEASUREMENT_TYPES} value={config.measurementType}
                onChange={(v) => updateConfig({ measurementType: v })} showPriceAddon={false} />
            </div>

            <div className={styles.dimensionRow} style={{ marginTop: 16 }}>
              <div className={styles.dimensionField}>
                <span className={styles.dimensionLabel}>Frame Width</span>
                <div className={styles.dimensionInputWrap}>
                  <input type="number" className={styles.dimensionInput} value={config.frameWidth}
                    onChange={(e) => quickUpdate({ frameWidth: parseFloat(e.target.value) || 0 })} min={10} max={120} step={0.125} />
                  <span className={styles.dimensionUnit}>Inches</span>
                </div>
              </div>
              <div className={styles.dimensionField}>
                <span className={styles.dimensionLabel}>Frame Height</span>
                <div className={styles.dimensionInputWrap}>
                  <input type="number" className={styles.dimensionInput} value={config.frameHeight}
                    onChange={(e) => quickUpdate({ frameHeight: parseFloat(e.target.value) || 0 })} min={10} max={120} step={0.125} />
                  <span className={styles.dimensionUnit}>Inches</span>
                </div>
              </div>
            </div>

            <ConfigDropdown label="Exterior Colour" options={FRAME_COLORS} value={config.exteriorColor}
              onChange={(v) => updateConfig({ exteriorColor: v })} helpText="Exterior frame colour" />
            <div style={{ height: 8 }} />
            <ConfigDropdown label="Interior Colour" options={FRAME_COLORS} value={config.interiorColor}
              onChange={(v) => updateConfig({ interiorColor: v })} />

            <div style={{ marginTop: 12 }}>
              <Toggle label="Add Foam to Profile?" value={config.addFoam} onChange={(v) => updateConfig({ addFoam: v })}
                helpText="Improves energy efficiency" />
            </div>
            <ConfigDropdown label="Brickmould" options={BRICKMOULD_OPTIONS} value={config.brickmould}
              onChange={(v) => updateConfig({ brickmould: v })} />
            <div style={{ height: 8 }} />
            <ConfigDropdown label="Snap-in Nailing Fin" options={NAILING_FIN_OPTIONS} value={config.nailingFin}
              onChange={(v) => updateConfig({ nailingFin: v })} />
          </Section>

          <Section title="Glass Options" defaultOpen={true}>
            <ConfigDropdown label="Choose Glazing Type" options={GLAZING_TYPES} value={config.glazingType}
              onChange={(v) => updateConfig({ glazingType: v })} />
            <div style={{ height: 8 }} />
            <ConfigDropdown label="Glass Thickness" options={GLASS_THICKNESS_OPTIONS} value={config.glassThickness}
              onChange={(v) => updateConfig({ glassThickness: v })} />
            <div style={{ height: 8 }} />
            <ConfigDropdown label="1st Pane Low-E Coating" options={LOW_E_COATINGS} value={config.lowECoating1}
              onChange={(v) => updateConfig({ lowECoating1: v })} />
            <div style={{ height: 8 }} />
            <ConfigDropdown label="2nd Pane Low-E Coating" options={LOW_E_COATINGS} value={config.lowECoating2}
              onChange={(v) => updateConfig({ lowECoating2: v })} />
            <div style={{ height: 8 }} />
            <ConfigDropdown label="Select Gas Type" options={GAS_TYPES} value={config.gasType}
              onChange={(v) => updateConfig({ gasType: v })} />
            <div style={{ height: 8 }} />
            <ConfigDropdown label="Spacer Type" options={SPACER_TYPES} value={config.spacerType}
              onChange={(v) => updateConfig({ spacerType: v })} />
            <div style={{ height: 8 }} />
            <ConfigDropdown label="Spacer Colour" options={SPACER_COLOR_OPTIONS} value={config.spacerColor}
              onChange={(v) => updateConfig({ spacerColor: v })} showPriceAddon={false} />
            <div style={{ height: 8 }} />
            <ConfigDropdown label="Tint or Frosting?" options={TINT_FROSTING_OPTIONS} value={config.tintFrosting}
              onChange={(v) => updateConfig({ tintFrosting: v })} />
            <div style={{ height: 8 }} />
            <ConfigDropdown label="Security Glass" options={SECURITY_GLASS_OPTIONS} value={config.securityGlass}
              onChange={(v) => updateConfig({ securityGlass: v })} />
          </Section>

          <Section title="Interior Options" defaultOpen={false}>
            <Toggle label="Interior Jamb?" value={config.interiorJamb} onChange={(v) => updateConfig({ interiorJamb: v })} />
            <Toggle label="Interior Returns" value={config.interiorReturns} onChange={(v) => updateConfig({ interiorReturns: v })} />
          </Section>
            </div>{/* end splitLeft */}

            {/* RIGHT HALF: Window Specific Options */}
            <div className={styles.splitRight}>
          {selectedCell && (
            <>
              <Section title={`${selectedCell.id} Specific Options`} defaultOpen={true}>
                {/* Energy Ratings */}
                {energyRatings && (
                  <div style={{ marginBottom: 16 }}>
                    <div className={styles.wizardFieldLabel} style={{ textAlign: 'center', marginBottom: 8 }}>
                      {selectedCell.id} Energy Ratings
                    </div>
                    <table className={styles.ratingsTable}>
                      <thead><tr><th>ER</th><th>SHGC</th><th>VT</th></tr></thead>
                      <tbody><tr><td>{energyRatings.er}</td><td>{energyRatings.shgc}</td><td>{energyRatings.vt}</td></tr></tbody>
                    </table>
                    <table className={styles.ratingsTable}>
                      <thead><tr><th>U-Factor (I-P)</th><th>U-Factor (SI)</th></tr></thead>
                      <tbody><tr><td>{energyRatings.uFactorIP}</td><td>{energyRatings.uFactorSI}</td></tr></tbody>
                    </table>

                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>NRCAN Model #</span>
                      <span className={styles.infoValue}>{energyRatings.nrcanModel}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Most Efficient 2026</span>
                      <span className={`${styles.infoBadge} ${energyRatings.mostEfficient ? styles.infoBadgeGreen : styles.infoBadgeRed}`}>
                        {energyRatings.mostEfficient ? 'Y' : 'N'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>NRCAN Reference #</span>
                      <span className={styles.infoValue}>{energyRatings.nrcanRef}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Meets Egress</span>
                      <span className={`${styles.infoBadge} ${energyRatings.meetsEgress ? styles.infoBadgeGreen : styles.infoBadgeRed}`}>
                        {energyRatings.meetsEgress ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                )}
              </Section>

              <Section title="Window Type" defaultOpen={true}>
                <ConfigDropdown label="Window Type" options={getWindowTypeOptions(typeId)}
                  value={selectedCell.windowType}
                  onChange={(v) => updateCell(selectedCell.id, { windowType: v })} showPriceAddon={false} />

                {/* Sash Size (for hung/slider types) */}
                {['single-hung', 'double-hung'].includes(selectedCell.windowType) && (
                  <>
                    <div style={{ height: 8 }} />
                    <ConfigDropdown label="Sash Size" options={SASH_SIZE_OPTIONS} value={selectedCell.sashSize}
                      onChange={(v) => updateCell(selectedCell.id, { sashSize: v })} />
                  </>
                )}

                {/* Dimension constraints */}
                {constraints && (
                  <div style={{ marginTop: 12 }}>
                    <div className={styles.dimensionLabel} style={{ textAlign: 'center', marginBottom: 4 }}>Window Width</div>
                    <div className={styles.constraintRow}>
                      <span>Min. Width</span><span>{constraints.minWidth}&quot;</span>
                      <span>Max Width</span><span>{constraints.maxWidth}&quot;</span>
                    </div>
                    <div className={styles.dimensionLabel} style={{ textAlign: 'center', marginBottom: 4, marginTop: 8 }}>Window Height</div>
                    <div className={styles.constraintRow}>
                      <span>Min. Height</span><span>{constraints.minHeight}&quot;</span>
                      <span>Max Height</span><span>{constraints.maxHeight}&quot;</span>
                    </div>
                    <div className={styles.dimensionInputWrap} style={{ marginTop: 8 }}>
                      <input type="number" className={styles.dimensionInput} value={selectedCell.height} readOnly />
                      <span className={styles.dimensionUnit}>Inches</span>
                    </div>
                  </div>
                )}
              </Section>

              <Section title="Hardware" defaultOpen={true}>
                <ConfigDropdown label="Handle & Lock Colour" options={HARDWARE_COLORS} value={selectedCell.hardwareColor}
                  onChange={(v) => updateCell(selectedCell.id, { hardwareColor: v })} />
                <div style={{ height: 8 }} />
                {selectedCell.windowType !== 'picture' && selectedCell.windowType !== 'high-fix' && (
                  <ConfigDropdown label="Opening Direction (Ext. View)" options={OPENING_DIRECTIONS}
                    value={selectedCell.openingDirection}
                    onChange={(v) => updateCell(selectedCell.id, { openingDirection: v })} showPriceAddon={false} />
                )}
              </Section>

              <Section title="Screen" defaultOpen={true}>
                <ConfigDropdown label="Type of Bug Screen" options={SCREEN_TYPES} value={selectedCell.screenType}
                  onChange={(v) => updateCell(selectedCell.id, { screenType: v })} />
              </Section>

              <Section title="Additional Options" defaultOpen={false}>
                <Toggle label="Egress Hardware" value={selectedCell.egressHardware}
                  onChange={(v) => updateCell(selectedCell.id, { egressHardware: v })} />
                <div style={{ height: 8 }} />
                <ConfigDropdown label="Special Glazing Options" options={SPECIAL_GLAZING_OPTIONS}
                  value={selectedCell.specialGlazing}
                  onChange={(v) => updateCell(selectedCell.id, { specialGlazing: v })} />
              </Section>

              <Section title="Grills" defaultOpen={false}>
                <ConfigDropdown label="Do you require grills?" options={GRILL_REQUIRE_OPTIONS}
                  value={selectedCell.grillPattern !== 'none' ? 'yes' : 'no'}
                  onChange={(v) => {
                    if (v === 'no') {
                      updateCell(selectedCell.id, { grillPattern: 'none' });
                    } else {
                      // Auto-calculate grill line counts based on window dimensions
                      const cellWidth = config.frameWidth / (config.grid.horizontalCount || 1);
                      const cellHeight = selectedCell.height || config.frameHeight / (config.grid.verticalCount || 1);
                      const autoV = Math.max(1, Math.round(cellWidth / 10) - 1);
                      const autoH = Math.max(1, Math.round(cellHeight / 10) - 1);
                      updateCell(selectedCell.id, {
                        grillPattern: 'colonial',
                        grillVertical: autoV,
                        grillHorizontal: autoH,
                      });
                    }
                  }} />
                {selectedCell.grillPattern !== 'none' && (
                  <>
                    {/* Grill Pattern */}
                    <div style={{ height: 8 }} />
                    <div className={styles.wizardFieldLabel} style={{ marginBottom: 6 }}>Select a grill pattern</div>
                    <div className={styles.grillPatternGrid}>
                      {GRILL_PATTERNS.filter(p => p.value !== 'none').map((pat) => (
                        <button
                          key={pat.value}
                          className={`${styles.grillPatternBtn} ${selectedCell.grillPattern === pat.value ? styles.grillPatternBtnActive : ''}`}
                          onClick={() => {
                            const updates: Record<string, any> = { grillPattern: pat.value };
                            if (pat.value === 'prairie') {
                              updates.prairieHBarLayout = 'top-and-bottom';
                              updates.prairieVBarLayout = 'left-and-right';
                              updates.prairieHBarDaylight = 5.0;
                              updates.prairieVBarDaylight = 5.0;
                              updates.prairieBarSpacing = 5;
                              updates.prairieLadderHead = 0;
                              updates.prairieLadderSill = 0;
                              updates.prairieLadderLeft = 0;
                              updates.prairieLadderRight = 0;
                              updates.prairieHSupportBars = 0;
                              updates.prairieVSupportBars = 0;
                            }
                            if (pat.value === 'ladder') {
                              updates.grillHorizontal = 1;
                              updates.grillVertical = 4;
                              updates.ladderBarSpacing = 20;
                            }
                            if (pat.value === 'diamond') {
                              updates.grillHorizontal = 4;
                              updates.grillVertical = 4;
                            }
                            updateCell(selectedCell.id, updates);
                          }}
                          title={pat.description || pat.label}
                          type="button"
                        >
                          <GrillPatternIcon pattern={pat.value} />
                          <span>{pat.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Grill Bar Type */}
                    <div style={{ height: 12 }} />
                    <div className={styles.wizardFieldLabel} style={{ marginBottom: 6 }}>Select a grill bar type</div>
                    <div className={styles.grillPatternGrid}>
                      {GRILL_BAR_TYPES.map((bt) => (
                        <button
                          key={bt.value}
                          className={`${styles.grillPatternBtn} ${selectedCell.grillBarType === bt.value ? styles.grillPatternBtnActive : ''}`}
                          onClick={() => updateCell(selectedCell.id, { grillBarType: bt.value })}
                          title={bt.description || bt.label}
                          type="button"
                        >
                          <GrillBarTypeIcon barType={bt.value} />
                          <span>{bt.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Grill Bar Size — visual card selector like panes.com */}
                    <div style={{ height: 12 }} />
                    <div className={styles.wizardFieldLabel} style={{ marginBottom: 6 }}>Select a grill bar size</div>
                    <div className={styles.grillSizeGrid}>
                      {GRILL_BAR_SIZES.map((sz) => (
                        <button
                          key={sz.value}
                          className={`${styles.grillSizeBtn} ${selectedCell.grillBarSize === sz.value ? styles.grillSizeBtnActive : ''}`}
                          onClick={() => updateCell(selectedCell.id, { grillBarSize: sz.value })}
                          title={sz.description || sz.label}
                          type="button"
                        >
                          <GrillBarSizeIcon size={sz.value} />
                          <div className={styles.grillSizeLabel}>{sz.label}</div>
                          {sz.priceAddon ? (
                            <div className={styles.grillSizePrice}>+ ${sz.priceAddon.toFixed(2)}</div>
                          ) : null}
                        </button>
                      ))}
                    </div>

                    {/* Grill Colour */}
                    <div style={{ height: 8 }} />
                    <ConfigDropdown label="Select a grill colour" options={GRILL_COLORS}
                      value={selectedCell.grillColor}
                      onChange={(v) => updateCell(selectedCell.id, { grillColor: v })} />

                    {/* Horizontal Lines & Vertical Lines — for colonial/ladder/diamond */}
                    {(selectedCell.grillPattern === 'colonial' || selectedCell.grillPattern === 'ladder' || selectedCell.grillPattern === 'diamond') && (
                      <>
                        <div style={{ height: 12 }} />
                        <div className={styles.grillCountRow}>
                          <div className={styles.grillCountField}>
                            <label>{selectedCell.grillPattern === 'diamond' ? 'Horizontal Points' : 'Horizontal Lines'}</label>
                            <input type="number" min={1} max={10}
                              key={`hl-${selectedCell.id}-${selectedCell.grillHorizontal}`}
                              defaultValue={selectedCell.grillHorizontal}
                              onFocus={(e) => e.target.select()}
                              onBlur={(e) => quickUpdateCell(selectedCell.id, { grillHorizontal: parseInt(e.target.value) || 1 })}
                              onChange={(e) => { if (e.target.value !== '') quickUpdateCell(selectedCell.id, { grillHorizontal: parseInt(e.target.value) || 1 }); }} />
                          </div>
                          <div className={styles.grillCountField}>
                            <label>{selectedCell.grillPattern === 'diamond' ? 'Vertical Points' : 'Vertical Lines'}</label>
                            <input type="number" min={1} max={10}
                              key={`vl-${selectedCell.id}-${selectedCell.grillVertical}`}
                              defaultValue={selectedCell.grillVertical}
                              onFocus={(e) => e.target.select()}
                              onBlur={(e) => quickUpdateCell(selectedCell.id, { grillVertical: parseInt(e.target.value) || 1 })}
                              onChange={(e) => { if (e.target.value !== '') quickUpdateCell(selectedCell.id, { grillVertical: parseInt(e.target.value) || 1 }); }} />
                          </div>
                        </div>
                        {/* Grille Bar Spacing — ladder only */}
                        {selectedCell.grillPattern === 'ladder' && (
                          <>
                            <div style={{ height: 8 }} />
                            <div className={styles.grillCountRow}>
                              <div className={styles.grillCountField} style={{ flex: 1 }}>
                                <label>Grille Bar Spacing</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <input type="number" min={4} max={40} step={1}
                                    key={`lbs-${selectedCell.id}-${selectedCell.ladderBarSpacing}`}
                                    defaultValue={selectedCell.ladderBarSpacing}
                                    onFocus={(e) => e.target.select()}
                                    onBlur={(e) => quickUpdateCell(selectedCell.id, { ladderBarSpacing: parseInt(e.target.value) || 16 })}
                                    onChange={(e) => { if (e.target.value !== '') quickUpdateCell(selectedCell.id, { ladderBarSpacing: parseInt(e.target.value) || 16 }); }}
                                    style={{ width: '70px' }} />
                                  <span style={{ fontSize: 12, color: '#888' }}>Inches</span>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {/* Prairie-specific controls */}
                    {selectedCell.grillPattern === 'prairie' && (
                      <>
                        <div style={{ height: 12 }} />
                        <ConfigDropdown label="Horizontal Bar Layout" options={PRAIRIE_H_BAR_LAYOUTS}
                          value={selectedCell.prairieHBarLayout}
                          onChange={(v) => updateCell(selectedCell.id, { prairieHBarLayout: v })} />
                        <div style={{ height: 8 }} />
                        <ConfigDropdown label="Vertical Bar Layout" options={PRAIRIE_V_BAR_LAYOUTS}
                          value={selectedCell.prairieVBarLayout}
                          onChange={(v) => updateCell(selectedCell.id, { prairieVBarLayout: v })} />

                        <div style={{ height: 12 }} />
                        <div className={styles.grillCountRow}>
                          <div className={styles.grillCountField}>
                            <label>Horizontal Support Bars</label>
                            <input type="number" min={0} max={10}
                              key={`hsb-${selectedCell.id}-${selectedCell.prairieHSupportBars}`}
                              defaultValue={selectedCell.prairieHSupportBars}
                              onFocus={(e) => e.target.select()}
                              onBlur={(e) => quickUpdateCell(selectedCell.id, { prairieHSupportBars: parseInt(e.target.value) || 0 })}
                              onChange={(e) => { if (e.target.value !== '') quickUpdateCell(selectedCell.id, { prairieHSupportBars: parseInt(e.target.value) || 0 }); }} />
                          </div>
                          <div className={styles.grillCountField}>
                            <label>Vertical Support Bars</label>
                            <input type="number" min={0} max={10}
                              key={`vsb-${selectedCell.id}-${selectedCell.prairieVSupportBars}`}
                              defaultValue={selectedCell.prairieVSupportBars}
                              onFocus={(e) => e.target.select()}
                              onBlur={(e) => quickUpdateCell(selectedCell.id, { prairieVSupportBars: parseInt(e.target.value) || 0 })}
                              onChange={(e) => { if (e.target.value !== '') quickUpdateCell(selectedCell.id, { prairieVSupportBars: parseInt(e.target.value) || 0 }); }} />
                          </div>
                        </div>

                        <div style={{ height: 8 }} />
                        <div className={styles.grillCountRow}>
                          <div className={styles.grillCountField}>
                            <label>H Bar Daylight</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input type="number" min={1} max={20} step={0.5}
                                key={`hbd-${selectedCell.id}-${selectedCell.prairieHBarDaylight}`}
                                defaultValue={selectedCell.prairieHBarDaylight}
                                onFocus={(e) => e.target.select()}
                                onBlur={(e) => quickUpdateCell(selectedCell.id, { prairieHBarDaylight: parseFloat(e.target.value) || 3.5 })}
                                onChange={(e) => { if (e.target.value !== '') quickUpdateCell(selectedCell.id, { prairieHBarDaylight: parseFloat(e.target.value) || 3.5 }); }}
                                style={{ width: '70px' }} />
                              <span style={{ fontSize: 12, color: '#888' }}>Inches</span>
                            </div>
                          </div>
                          <div className={styles.grillCountField}>
                            <label>V Bar Daylight</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input type="number" min={1} max={20} step={0.5}
                                key={`vbd-${selectedCell.id}-${selectedCell.prairieVBarDaylight}`}
                                defaultValue={selectedCell.prairieVBarDaylight}
                                onFocus={(e) => e.target.select()}
                                onBlur={(e) => quickUpdateCell(selectedCell.id, { prairieVBarDaylight: parseFloat(e.target.value) || 3.5 })}
                                onChange={(e) => { if (e.target.value !== '') quickUpdateCell(selectedCell.id, { prairieVBarDaylight: parseFloat(e.target.value) || 3.5 }); }}
                                style={{ width: '70px' }} />
                              <span style={{ fontSize: 12, color: '#888' }}>Inches</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ height: 8 }} />
                        <div className={styles.grillCountRow}>
                          <div className={styles.grillCountField}>
                            <label>Ladder Count Head</label>
                            <input type="number" min={0} max={10}
                              key={`lh-${selectedCell.id}-${selectedCell.prairieLadderHead}`}
                              defaultValue={selectedCell.prairieLadderHead}
                              onFocus={(e) => e.target.select()}
                              onBlur={(e) => quickUpdateCell(selectedCell.id, { prairieLadderHead: parseInt(e.target.value) || 0 })}
                              onChange={(e) => { if (e.target.value !== '') quickUpdateCell(selectedCell.id, { prairieLadderHead: parseInt(e.target.value) || 0 }); }} />
                          </div>
                          <div className={styles.grillCountField}>
                            <label>Ladder Count Sill</label>
                            <input type="number" min={0} max={10}
                              key={`ls-${selectedCell.id}-${selectedCell.prairieLadderSill}`}
                              defaultValue={selectedCell.prairieLadderSill}
                              onFocus={(e) => e.target.select()}
                              onBlur={(e) => quickUpdateCell(selectedCell.id, { prairieLadderSill: parseInt(e.target.value) || 0 })}
                              onChange={(e) => { if (e.target.value !== '') quickUpdateCell(selectedCell.id, { prairieLadderSill: parseInt(e.target.value) || 0 }); }} />
                          </div>
                        </div>
                        <div style={{ height: 4 }} />
                        <div className={styles.grillCountRow}>
                          <div className={styles.grillCountField}>
                            <label>Ladder Count Left</label>
                            <input type="number" min={0} max={10}
                              key={`ll-${selectedCell.id}-${selectedCell.prairieLadderLeft}`}
                              defaultValue={selectedCell.prairieLadderLeft}
                              onFocus={(e) => e.target.select()}
                              onBlur={(e) => quickUpdateCell(selectedCell.id, { prairieLadderLeft: parseInt(e.target.value) || 0 })}
                              onChange={(e) => { if (e.target.value !== '') quickUpdateCell(selectedCell.id, { prairieLadderLeft: parseInt(e.target.value) || 0 }); }} />
                          </div>
                          <div className={styles.grillCountField}>
                            <label>Ladder Count Right</label>
                            <input type="number" min={0} max={10}
                              key={`lr-${selectedCell.id}-${selectedCell.prairieLadderRight}`}
                              defaultValue={selectedCell.prairieLadderRight}
                              onFocus={(e) => e.target.select()}
                              onBlur={(e) => quickUpdateCell(selectedCell.id, { prairieLadderRight: parseInt(e.target.value) || 0 })}
                              onChange={(e) => { if (e.target.value !== '') quickUpdateCell(selectedCell.id, { prairieLadderRight: parseInt(e.target.value) || 0 }); }} />
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </Section>
            </>
          )}
            </div>{/* end splitRight */}
          </div>{/* end configSplitRow */}
        </div>{/* end rightArea */}
      </div>{/* end configurator */}

      {/* Bottom Bar */}
      <div className={styles.bottomBar}>
        <div className={styles.bottomDescription}>
          <input type="text" className={styles.bottomDescInput} placeholder="Description"
            value={config.description} onChange={(e) => quickUpdate({ description: e.target.value })} />
        </div>
        <div className={styles.bottomQty}>
          <span className={styles.bottomQtyLabel}>QTY</span>
          <input type="number" className={styles.bottomQtyInput} value={config.quantity}
            onChange={(e) => quickUpdate({ quantity: parseInt(e.target.value) || 1 })} min={1} max={999} />
        </div>
        <button className={styles.addToCartBtn} type="button">Add to Cart</button>
        <div className={styles.bottomPrice}>${(priceData.total * config.quantity).toFixed(2)}</div>
        <span className={styles.bottomNeedHelp}>Need Help?</span>
      </div>

      {isUpdating && (
        <div className={styles.updatingOverlay}>
          <div className={styles.updatingBox}>
            <div className={styles.updatingSpinner} />
            <div className={styles.updatingText}>Updating. Please wait.</div>
          </div>
        </div>
      )}
    </>
  );
}
