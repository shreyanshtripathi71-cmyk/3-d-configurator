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
  LOW_E_COATINGS,
  GAS_TYPES,
  SPACER_TYPES,
  TINT_FROSTING_OPTIONS,
  SECURITY_GLASS_OPTIONS,
  HARDWARE_TYPES,
  HARDWARE_COLORS,
  OPENING_DIRECTIONS,
  SCREEN_TYPES,
  SPECIAL_GLAZING_OPTIONS,
  GRILL_PATTERNS,
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
      'iron-ore-697': 'Iron Ore', 'commercial-brown-424': 'Brown',
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
                  cellType: c.windowType as 'awning' | 'picture' | 'fixed' | 'casement',
                })),
                selectedCellId: config.selectedCellId,
              }}
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
                <ConfigDropdown label="Hardware Type" options={HARDWARE_TYPES} value={selectedCell.hardwareType}
                  onChange={(v) => updateCell(selectedCell.id, { hardwareType: v })} />
                <div style={{ height: 8 }} />
                <ConfigDropdown label="Hardware Colour" options={HARDWARE_COLORS} value={selectedCell.hardwareColor}
                  onChange={(v) => updateCell(selectedCell.id, { hardwareColor: v })} />
                <div style={{ height: 8 }} />
                {selectedCell.windowType !== 'picture' && (
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
                <ConfigDropdown label="Do you require grills?" options={GRILL_PATTERNS} value={selectedCell.grillPattern}
                  onChange={(v) => updateCell(selectedCell.id, { grillPattern: v })} />
                {selectedCell.grillPattern !== 'none' && (
                  <div className={styles.grillCountRow}>
                    <div className={styles.grillCountField}>
                      <span className={styles.grillCountLabel}>Vertical</span>
                      <input type="number" className={styles.grillCountInput} value={selectedCell.grillVertical}
                        onChange={(e) => quickUpdateCell(selectedCell.id, { grillVertical: parseInt(e.target.value) || 1 })} min={1} max={10} />
                    </div>
                    <div className={styles.grillCountField}>
                      <span className={styles.grillCountLabel}>Horizontal</span>
                      <input type="number" className={styles.grillCountInput} value={selectedCell.grillHorizontal}
                        onChange={(e) => quickUpdateCell(selectedCell.id, { grillHorizontal: parseInt(e.target.value) || 1 })} min={1} max={10} />
                    </div>
                  </div>
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
