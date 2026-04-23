/* ══════════════════════════════════════════════════════════════
   Configurator Data — Options, Defaults & Pricing
   ══════════════════════════════════════════════════════════════ */

/* ─── Types ─── */
export interface ConfigOption {
  value: string;
  label: string;
  icon?: string;
  priceAddon?: number;
  description?: string;
}

/* ─── Window Cell (per-unit in grid) ─── */
export interface WindowCell {
  id: string;        // "W1.1", "W2.1", etc.
  row: number;       // 0-indexed
  col: number;       // 0-indexed
  windowType: string;
  sashSize: string;
  height: number;    // individual height for this row
  hardwareType: string;
  hardwareColor: string;
  openingDirection: string;
  screenType: string;
  egressHardware: boolean;
  specialGlazing: string;
  grillPattern: string;     // 'none' | 'colonial' | 'prairie' | etc.
  grillBarType: string;     // 'flat' | 'georgian' | 'pencil' | 'sdl'
  grillBarSize: string;     // '11/16' | '1'
  grillColor: string;       // 'white' | 'match-interior' | 'match-exterior'
  grillVertical: number;    // vertical bar count (for colonial)
  grillHorizontal: number;  // horizontal bar count (for colonial)
  // Prairie-specific options
  prairieHBarLayout: string;  // 'top-and-bottom' | 'top-only' | 'bottom-only' | 'centered' | 'none'
  prairieVBarLayout: string;  // 'left-and-right' | 'left-only' | 'right-only' | 'centered' | 'none'
  prairieHBarDaylight: number; // distance from edge in inches
  prairieVBarDaylight: number; // distance from edge in inches
  prairieBarSpacing: number;   // grille bar spacing in inches
  prairieLadderHead: number;   // ladder rungs at top
  prairieLadderSill: number;   // ladder rungs at bottom
  prairieLadderLeft: number;   // ladder rungs at left
  prairieLadderRight: number;  // ladder rungs at right
  prairieHSupportBars: number; // horizontal support bars
  prairieVSupportBars: number; // vertical support bars
  // Ladder-specific
  ladderBarSpacing: number;    // grille bar spacing in inches (distance from top)
}

/* ─── Per-row config (panes.com: each row can have different horizontal count) ─── */
export interface RowConfig {
  row: number;
  horizontalCount: number;
}

/* ─── Grid Configuration ─── */
export interface GridConfig {
  verticalCount: number;     // rows (1-4)
  horizontalCount: number;   // overall/default columns (1-4)
  rowConfigs: RowConfig[];   // per-row overrides
  cells: WindowCell[];
}

/* ─── Wizard Step ─── */
export type WizardStep = 'dimensions' | 'vertical' | 'horizontal' | 'done';

/* ─── Overall Config State ─── */
export interface ConfigState {
  // Wizard
  wizardStep: WizardStep;

  // Dimensions (whole opening)
  measurementType: string;
  frameWidth: number;
  frameHeight: number;

  // Grid
  grid: GridConfig;
  selectedCellId: string; // which cell is being edited

  // Whole Opening (shared across all cells)
  exteriorColor: string;
  interiorColor: string;
  addFoam: boolean;
  brickmould: string;
  nailingFin: string;

  // Glass Options (shared)
  glazingType: string;
  glassThickness: string;
  lowECoating1: string;
  lowECoating2: string;
  gasType: string;
  spacerType: string;
  spacerColor: string;
  tintFrosting: string;
  securityGlass: string;

  // Interior Options (shared)
  interiorJamb: boolean;
  interiorReturns: boolean;

  // Cart
  description: string;
  quantity: number;
}

/* ─── Dimension Constraints per Window Type ─── */
export interface DimensionConstraints {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}

export const WINDOW_CONSTRAINTS: Record<string, DimensionConstraints> = {
  awning: { minWidth: 19.125, maxWidth: 72, minHeight: 12, maxHeight: 68 },
  casement: { minWidth: 14, maxWidth: 36, minHeight: 24, maxHeight: 72 },
  picture: { minWidth: 12, maxWidth: 96, minHeight: 12, maxHeight: 96 },
  'high-fix': { minWidth: 12, maxWidth: 96, minHeight: 12, maxHeight: 96 },
  'single-hung': { minWidth: 19.5, maxWidth: 44, minHeight: 30, maxHeight: 72 },
  'double-hung': { minWidth: 19.5, maxWidth: 44, minHeight: 30, maxHeight: 72 },
  'single-slider': { minWidth: 36, maxWidth: 72, minHeight: 18, maxHeight: 60 },
  'double-slider': { minWidth: 48, maxWidth: 96, minHeight: 18, maxHeight: 60 },
  'end-vent': { minWidth: 48, maxWidth: 96, minHeight: 18, maxHeight: 60 },
};

/* ─── Model paths per window type ─── */
export const WINDOW_MODEL_PATHS: Record<string, string> = {
  awning: '/windows/awning/AwningWindow.gltf',
  casement: '/windows/casement/CasementWindow.gltf',
  picture: '/windows/picture/PictureWindow_Model_1.gltf',
  'high-fix': '/windows/high-fix/HighFixWindow_DoubleGlazing.gltf',
  'single-hung': '/windows/single-hung/SingleHungWindow_optimized.glb',
  'double-hung': '/windows/double-hung/DoubleHungWindow_optimized.glb',
  'single-slider': '/windows/single-slider/SingleSliderWindow_optimized.glb',
  'double-slider': '/windows/double-slider/DoubleSliderWindow_optimized.glb',
  'end-vent': '/windows/end-vent/End Vent Slider Window_Model_1_optimized.glb',
};

/* ─── Helper: Create a default WindowCell ─── */
export function createDefaultCell(
  row: number,
  col: number,
  windowType: string,
  height: number,
  colsInRow: number, // total columns in this row (for reversed numbering)
): WindowCell {
  // Panes.com: W1.1 = rightmost cell, numbering goes right-to-left
  const reversedCol = colsInRow - col;
  return {
    id: `W${row + 1}.${reversedCol}`,
    row,
    col,
    windowType,
    sashSize: 'even-split',
    height,
    hardwareType: 'premium-classic',
    hardwareColor: 'white-137',
    openingDirection: windowType === 'picture' || windowType === 'high-fix' ? 'fixed' : 'right',
    screenType: 'regular',
    egressHardware: false,
    specialGlazing: 'default',
    grillPattern: 'none',
    grillBarType: 'flat',
    grillBarSize: '5/16',
    grillColor: 'white',
    grillVertical: Math.max(1, Math.round(height * (colsInRow || 1) / 12)),
    grillHorizontal: Math.max(1, Math.round(height / 12)),
    // Prairie defaults
    prairieHBarLayout: 'top-and-bottom',
    prairieVBarLayout: 'left-and-right',
    prairieHBarDaylight: 5.0,
    prairieVBarDaylight: 5.0,
    prairieBarSpacing: 5,
    prairieLadderHead: 0,
    prairieLadderSill: 0,
    prairieLadderLeft: 0,
    prairieLadderRight: 0,
    prairieHSupportBars: 0,
    prairieVSupportBars: 0,
    // Ladder defaults
    ladderBarSpacing: 16,
  };
}

/* ─── Helper: Build grid cells (supports per-row column counts) ─── */
export function buildGridCells(
  verticalCount: number,
  horizontalCount: number,
  totalHeight: number,
  baseWindowType: string,
  rowConfigs?: RowConfig[],
): WindowCell[] {
  const rowHeight = Math.round((totalHeight / verticalCount) * 1000) / 1000;
  const cells: WindowCell[] = [];

  for (let r = 0; r < verticalCount; r++) {
    // Per-row column count (from rowConfigs or default)
    const rowCfg = rowConfigs?.find(rc => rc.row === r);
    const colsForRow = rowCfg ? rowCfg.horizontalCount : horizontalCount;

    for (let c = 0; c < colsForRow; c++) {
      // Panes.com: bottom row (row 0) = base window type, upper rows = picture
      const cellType = r === 0 ? baseWindowType : 'picture';
      cells.push(createDefaultCell(r, c, cellType, rowHeight, colsForRow));
    }
  }

  return cells;
}

/* ─── Helper: Build default rowConfigs ─── */
export function buildDefaultRowConfigs(verticalCount: number, defaultHorizontal: number): RowConfig[] {
  return Array.from({ length: verticalCount }, (_, r) => ({
    row: r,
    horizontalCount: defaultHorizontal,
  }));
}

/* ─── Helper: Max vertical count based on height (smart constraint) ─── */
export function getMaxVertical(frameHeight: number): number {
  // Minimum 24 inches per row — ensures each window cell has reasonable proportions
  // and the GLTF model doesn't get distorted from extreme scaling
  if (frameHeight <= 0) return 1;
  const max = Math.floor(frameHeight / 24);
  return Math.max(1, Math.min(4, max));
}

/* ─── Helper: Max horizontal count based on width ─── */
export function getMaxHorizontal(frameWidth: number): number {
  // Minimum 18 inches per column — ensures each window cell has reasonable proportions
  if (frameWidth <= 0) return 1;
  const max = Math.floor(frameWidth / 18);
  return Math.max(1, Math.min(4, max));
}

/* ─── Helper: Rebuild cells for a single row when its horizontal count changes ─── */
export function rebuildRowCells(
  existingCells: WindowCell[],
  row: number,
  newHorizontalCount: number,
  totalHeight: number,
  verticalCount: number,
  baseWindowType: string,
): WindowCell[] {
  const rowHeight = Math.round((totalHeight / verticalCount) * 1000) / 1000;
  // Keep cells from other rows
  const otherCells = existingCells.filter(c => c.row !== row);
  // Build new cells for this row
  const newRowCells: WindowCell[] = [];
  for (let c = 0; c < newHorizontalCount; c++) {
    // Bottom row (row 0) = base type, upper rows = picture
    const cellType = row === 0 ? baseWindowType : 'picture';
    newRowCells.push(createDefaultCell(row, c, cellType, rowHeight, newHorizontalCount));
  }
  // Merge and sort: other rows + this row's new cells
  return [...otherCells, ...newRowCells].sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);
}

/* ─── Default State ─── */
export function createDefaultConfig(windowType: string): ConfigState {
  return {
    wizardStep: 'dimensions',

    measurementType: 'frame-size',
    frameWidth: 0,
    frameHeight: 0,

    grid: {
      verticalCount: 1,
      horizontalCount: 1,
      rowConfigs: [],
      cells: [],
    },
    selectedCellId: 'W1.1',

    exteriorColor: 'white-137',
    interiorColor: 'white-137',
    addFoam: false,
    brickmould: 'none',
    nailingFin: 'none',

    glazingType: 'double-pane',
    glassThickness: '3mm',
    lowECoating1: 'climaguard-80-70',
    lowECoating2: 'none',
    gasType: 'argon',
    spacerType: 'warm-edge',
    spacerColor: 'black',
    tintFrosting: 'none',
    securityGlass: 'none',

    interiorJamb: false,
    interiorReturns: false,

    description: '',
    quantity: 1,
  };
}

/* ─── Option Lists ─── */

export const MEASUREMENT_TYPES: ConfigOption[] = [
  { value: 'frame-size', label: 'Frame Size', description: 'Measure the frame opening' },
  { value: 'brickmould-size', label: 'Brickmould Size', description: 'Measure to brickmould edges' },
  { value: 'rough-opening', label: 'Rough Opening', description: 'Measure the rough opening' },
];

export const FRAME_COLORS: ConfigOption[] = [
  { value: 'white-137', label: 'White 137', icon: '⬜', priceAddon: 0, description: 'Standard' },
  { value: 'almond-532', label: 'Almond 532', icon: '🟫', priceAddon: 0, description: 'Standard' },
  { value: 'black-525', label: 'Black 525', icon: '⬛', priceAddon: 59.22, description: 'Premium' },
  { value: 'iron-ore-697', label: 'Iron Ore 697', icon: '🔘', priceAddon: 59.22, description: 'Premium' },
  { value: 'commercial-brown-424', label: 'Commercial Brown 424', icon: '🟤', priceAddon: 59.22, description: 'Premium' },
];

export const BRICKMOULD_OPTIONS: ConfigOption[] = [
  { value: 'none', label: 'No Brickmould', priceAddon: 0 },
  { value: '1.5-inch', label: '1-1/2" Brickmould', priceAddon: 15.00 },
  { value: '1.75-inch', label: '1-3/4" Brickmould', priceAddon: 18.50 },
  { value: '2.5-inch', label: '2-1/2" Brickmould', priceAddon: 24.00 },
  { value: '4-inch', label: '4" Brickmould', priceAddon: 32.00 },
];

export const NAILING_FIN_OPTIONS: ConfigOption[] = [
  { value: 'no', label: 'No', priceAddon: 0 },
  { value: 'yes', label: 'Yes', priceAddon: 6.64 },
];

export const GLAZING_TYPES: ConfigOption[] = [
  { value: 'double-pane', label: 'Double Pane Glass', icon: '🪟', priceAddon: 0 },
  { value: 'triple-pane', label: 'Triple Pane Glass', icon: '🪟', priceAddon: 47.50 },
];

export const LOW_E_COATINGS: ConfigOption[] = [
  { value: 'none', label: 'None', priceAddon: 0 },
  { value: 'climaguard-80-70', label: 'ClimaGuard 80/70 (Single)', priceAddon: 0, description: 'Standard' },
  { value: 'climaguard-72-57', label: 'ClimaGuard 72/57 (Single)', priceAddon: 8.00 },
  { value: 'climaguard-70-36', label: 'ClimaGuard 70/36 (Double)', priceAddon: 22.00 },
];

export const GAS_TYPES: ConfigOption[] = [
  { value: 'air', label: 'Air (No Gas)', priceAddon: 0 },
  { value: 'argon', label: 'Argon', priceAddon: 0, description: 'Standard' },
  { value: 'krypton', label: 'Krypton', priceAddon: 35.00 },
];

export const SPACER_TYPES: ConfigOption[] = [
  { value: 'standard', label: 'Standard Spacer', priceAddon: 0 },
  { value: 'warm-edge', label: 'Endur® Warm-Edge Spacer', priceAddon: 0, description: 'Standard' },
  { value: 'super-spacer', label: 'Super Spacer', priceAddon: 12.00 },
];

export const GLASS_THICKNESS_OPTIONS: ConfigOption[] = [
  { value: '3mm', label: '3mm', priceAddon: 0, description: 'Standard' },
  { value: '4mm', label: '4mm', priceAddon: 8.50 },
  { value: '5mm', label: '5mm', priceAddon: 15.00 },
];

export const TINT_FROSTING_OPTIONS: ConfigOption[] = [
  { value: 'none', label: 'None', priceAddon: 0 },
  { value: 'bronze-tint', label: 'Bronze Tint', priceAddon: 28.00 },
  { value: 'grey-tint', label: 'Grey Tint', priceAddon: 28.00 },
  { value: 'frosted', label: 'Frost', priceAddon: 35.00 },
];

export const SECURITY_GLASS_OPTIONS: ConfigOption[] = [
  { value: 'none', label: 'None', priceAddon: 0 },
  { value: 'laminated', label: 'Laminated', priceAddon: 65.00 },
];

export const SPACER_COLOR_OPTIONS: ConfigOption[] = [
  { value: 'black', label: 'Black', priceAddon: 0 },
  { value: 'grey', label: 'Grey', priceAddon: 0 },
];

/* ─── Per-Cell Options ─── */

export const AWNING_TYPES: ConfigOption[] = [
  { value: 'awning', label: 'Awning Window', icon: '🏠' },
  { value: 'picture', label: 'Picture Window', icon: '🖼️' },
];

export const CASEMENT_TYPES: ConfigOption[] = [
  { value: 'casement', label: 'Casement Window', icon: '🪟' },
  { value: 'picture', label: 'Picture Window', icon: '🖼️' },
];

export function getWindowTypeOptions(baseType: string): ConfigOption[] {
  switch (baseType) {
    case 'awning': return AWNING_TYPES;
    case 'casement': return CASEMENT_TYPES;
    default: return [{ value: baseType, label: baseType.charAt(0).toUpperCase() + baseType.slice(1) + ' Window' }];
  }
}

export const SASH_SIZE_OPTIONS: ConfigOption[] = [
  { value: 'even-split', label: 'Even Split', priceAddon: 0, description: 'Standard' },
  { value: 'oriole-split', label: 'Oriole Split', priceAddon: 13.29 },
  { value: 'cottage-split', label: 'Cottage Split', priceAddon: 13.29 },
];

export const HARDWARE_COLORS: ConfigOption[] = [
  { value: 'white-137', label: 'White 137', icon: '⬜', priceAddon: 0 },
  { value: 'almond', label: 'Almond', icon: '🟫', priceAddon: 0 },
  { value: 'black', label: 'Black', icon: '⬛', priceAddon: 8.00 },
];

export const OPENING_DIRECTIONS: ConfigOption[] = [
  { value: 'left', label: 'Left Hand', icon: '◀️' },
  { value: 'right', label: 'Right Hand', icon: '▶️' },
  { value: 'fixed', label: 'Fixed (No Opening)', icon: '⏹️' },
];

export const SCREEN_TYPES: ConfigOption[] = [
  { value: 'regular', label: 'Regular Screen', priceAddon: 0, description: 'Standard' },
  { value: 'heavy-duty', label: 'Heavy Duty Screen', priceAddon: 6.64 },
  { value: 'none', label: 'No Screen', priceAddon: -1.33 },
];

export const SPECIAL_GLAZING_OPTIONS: ConfigOption[] = [
  { value: 'default', label: 'Default Glazing', priceAddon: 0 },
  { value: 'tempered-both', label: '3mm Tempered - Both Panes', priceAddon: 15.94 },
];

export const GRILL_REQUIRE_OPTIONS: ConfigOption[] = [
  { value: 'no', label: 'No', priceAddon: 0 },
  { value: 'yes', label: 'Yes', priceAddon: 0 },
];

export const GRILL_PATTERNS: ConfigOption[] = [
  { value: 'none', label: 'No', icon: '⊠', priceAddon: 0 },
  { value: 'colonial', label: 'Colonial', icon: '▦', priceAddon: 0, description: 'Evenly-spaced grid pattern' },
  { value: 'prairie', label: 'Prairie', icon: '⊞', priceAddon: 0, description: 'Perimeter bars with open center' },
  { value: 'ladder', label: 'Ladder', icon: '☰', priceAddon: 0, description: 'Horizontal bars only' },
  { value: 'diamond', label: 'Diamond', icon: '◇', priceAddon: 0, description: 'Diagonal crossing bars' },
];

export const GRILL_BAR_TYPES: ConfigOption[] = [
  { value: 'georgian', label: 'Georgian', priceAddon: 0, description: 'Standard profile bar' },
  { value: 'flat', label: 'Flat', priceAddon: -79.49, description: 'Flat profile bar' },
  { value: 'pencil', label: 'Pencil', priceAddon: 42.01, description: 'Thin rounded profile' },
  { value: 'sdl', label: 'SDL', priceAddon: 308.45, description: 'Simulated Divided Lite — bars on both sides of glass' },
];

export const GRILL_BAR_SIZES: ConfigOption[] = [
  { value: '5/16', label: '5/16"', priceAddon: 370.05, description: 'Thinnest profile' },
  { value: '5/8', label: '5/8"', priceAddon: 370.05, description: 'Medium profile' },
  { value: '1', label: '1"', priceAddon: 370.05, description: 'Standard width' },
];

export const GRILL_COLORS: ConfigOption[] = [
  { value: 'white', label: 'White', priceAddon: 0 },
  { value: 'brass', label: 'Brass', priceAddon: 120.67 },
  { value: 'pewter', label: 'Pewter', priceAddon: 120.67 },
  { value: 'black', label: 'Black', priceAddon: 120.67 },
];

/* ─── Prairie-specific layout options ─── */
export const PRAIRIE_H_BAR_LAYOUTS: ConfigOption[] = [
  { value: 'top-and-bottom', label: 'Top & Bottom' },
  { value: 'top-only', label: 'Top Only' },
  { value: 'bottom-only', label: 'Bottom Only' },
  { value: 'centered', label: 'Centered' },
  { value: 'none', label: 'None' },
];

export const PRAIRIE_V_BAR_LAYOUTS: ConfigOption[] = [
  { value: 'left-and-right', label: 'Left & Right' },
  { value: 'left-only', label: 'Left Only' },
  { value: 'right-only', label: 'Right Only' },
  { value: 'centered', label: 'Centered' },
  { value: 'none', label: 'None' },
];

/* Legacy — kept for backward compat */
export const GRILL_PATTERN_TYPES = GRILL_PATTERNS;

/* ─── Energy Ratings ─── */
export interface EnergyRatings {
  er: number;
  shgc: number;
  vt: number;
  uFactorIP: number;
  uFactorSI: number;
  nrcanModel: string;
  nrcanRef: string;
  mostEfficient: boolean;
  meetsEgress: boolean;
}

export function computeEnergyRatings(config: ConfigState, cell: WindowCell): EnergyRatings {
  let er = 34;
  let shgc = 0.47;
  let vt = 0.52;
  let uFactorIP = 1.53;
  let uFactorSI = 0.27;

  if (config.glazingType === 'triple-pane') {
    er = 42; shgc = 0.28; vt = 0.40; uFactorIP = 1.05; uFactorSI = 0.19;
  }
  if (config.lowECoating1 === 'climaguard-72-57') { shgc -= 0.05; er += 2; }
  else if (config.lowECoating1 === 'climaguard-70-36') { shgc -= 0.12; er += 4; }
  if (config.gasType === 'krypton') { er += 3; uFactorIP -= 0.15; uFactorSI -= 0.03; }
  else if (config.gasType === 'air') { er -= 8; uFactorIP += 0.25; uFactorSI += 0.05; }
  if (config.addFoam) { er += 2; uFactorIP -= 0.05; uFactorSI -= 0.01; }
  if (config.tintFrosting === 'grey-tint' || config.tintFrosting === 'bronze-tint') { shgc -= 0.08; vt -= 0.10; }
  else if (config.tintFrosting === 'frosted') { vt -= 0.25; }

  const mostEfficient = er >= 40;
  const meetsEgress = config.frameWidth >= 20 && cell.height >= 24;

  const glazeCode = config.glazingType === 'triple-pane' ? '3' : '2';
  const typeCode = cell.windowType === 'awning' ? 'AW' : cell.windowType === 'casement' ? 'CA' : 'PW';
  const nrcanModel = `PWM-${typeCode}-${glazeCode},CL-3,8071(${glazeCode})-16AR97SP`;
  const hashBase = config.frameWidth * 1000 + cell.height * 100 + er * 10 + (config.glazingType === 'triple-pane' ? 5 : 0);
  const nrcanRef = `Nr10905-${35751 + (hashBase % 60000)}798-ES5`;

  return {
    er: Math.round(er),
    shgc: Math.round(shgc * 100) / 100,
    vt: Math.round(vt * 100) / 100,
    uFactorIP: Math.round(uFactorIP * 100) / 100,
    uFactorSI: Math.round(uFactorSI * 100) / 100,
    nrcanModel, nrcanRef, mostEfficient, meetsEgress,
  };
}

/* ─── Price Calculator ─── */
export interface PriceBreakdownItem {
  label: string;
  amount: number;
}

export function calculatePrice(
  config: ConfigState,
  basePrice: number,
): { total: number; breakdown: PriceBreakdownItem[] } {
  const breakdown: PriceBreakdownItem[] = [];
  const cellCount = config.grid.cells.length || 1;

  // Base price per cell
  breakdown.push({ label: `Base Window Price (×${cellCount})`, amount: Math.round(basePrice * cellCount * 100) / 100 });

  // Size adjustment
  const sizeMultiplier = (config.frameWidth * config.frameHeight) / (35 * 35);
  if (sizeMultiplier > 1) {
    const sizeAddon = basePrice * (sizeMultiplier - 1) * 0.3;
    breakdown.push({ label: 'Size Adjustment', amount: Math.round(sizeAddon * 100) / 100 });
  }

  // Shared options  
  const extColor = FRAME_COLORS.find(c => c.value === config.exteriorColor);
  if (extColor?.priceAddon) breakdown.push({ label: `Exterior: ${extColor.label}`, amount: extColor.priceAddon * cellCount });
  const intColor = FRAME_COLORS.find(c => c.value === config.interiorColor);
  if (intColor?.priceAddon) breakdown.push({ label: `Interior: ${intColor.label}`, amount: intColor.priceAddon * cellCount });
  if (config.addFoam) breakdown.push({ label: 'Foam Injection', amount: 22.00 * cellCount });

  const brick = BRICKMOULD_OPTIONS.find(b => b.value === config.brickmould);
  if (brick?.priceAddon) breakdown.push({ label: `Brickmould`, amount: brick.priceAddon });
  const nail = NAILING_FIN_OPTIONS.find(n => n.value === config.nailingFin);
  if (nail?.priceAddon) breakdown.push({ label: `Nailing Fin`, amount: nail.priceAddon });

  const glaze = GLAZING_TYPES.find(g => g.value === config.glazingType);
  if (glaze?.priceAddon) breakdown.push({ label: `Triple Pane`, amount: glaze.priceAddon * cellCount });
  const glass = GLASS_THICKNESS_OPTIONS.find(g => g.value === config.glassThickness);
  if (glass?.priceAddon) breakdown.push({ label: `Glass: ${glass.label}`, amount: glass.priceAddon * cellCount });
  const lowe1 = LOW_E_COATINGS.find(l => l.value === config.lowECoating1);
  if (lowe1?.priceAddon) breakdown.push({ label: `Low-E: ${lowe1.label}`, amount: lowe1.priceAddon * cellCount });
  const lowe2 = LOW_E_COATINGS.find(l => l.value === config.lowECoating2);
  if (lowe2?.priceAddon) breakdown.push({ label: `Low-E 2nd Pane`, amount: lowe2.priceAddon * cellCount });
  const gas = GAS_TYPES.find(g => g.value === config.gasType);
  if (gas?.priceAddon) breakdown.push({ label: `Gas: ${gas.label}`, amount: gas.priceAddon * cellCount });
  const tint = TINT_FROSTING_OPTIONS.find(t => t.value === config.tintFrosting);
  if (tint?.priceAddon) breakdown.push({ label: `Tint: ${tint.label}`, amount: tint.priceAddon * cellCount });
  const sec = SECURITY_GLASS_OPTIONS.find(s => s.value === config.securityGlass);
  if (sec?.priceAddon) breakdown.push({ label: `Security Glass`, amount: sec.priceAddon * cellCount });

  // Per-cell options
  for (const cell of config.grid.cells) {
    const prefix = cellCount > 1 ? `${cell.id} ` : '';
    const sash = SASH_SIZE_OPTIONS.find(s => s.value === cell.sashSize);
    if (sash?.priceAddon) breakdown.push({ label: `${prefix}Sash: ${sash.label}`, amount: sash.priceAddon });
    const hwc = HARDWARE_COLORS.find(h => h.value === cell.hardwareColor);
    if (hwc?.priceAddon) breakdown.push({ label: `${prefix}Handle & Lock`, amount: hwc.priceAddon });
    const scr = SCREEN_TYPES.find(s => s.value === cell.screenType);
    if (scr && scr.priceAddon !== 0) breakdown.push({ label: `${prefix}Screen`, amount: scr.priceAddon! });
    const spec = SPECIAL_GLAZING_OPTIONS.find(s => s.value === cell.specialGlazing);
    if (spec?.priceAddon) breakdown.push({ label: `${prefix}Special Glazing`, amount: spec.priceAddon });
    if (cell.egressHardware) breakdown.push({ label: `${prefix}Egress Hardware`, amount: 18.00 });
    if (cell.grillPattern && cell.grillPattern !== 'none') {
      const grillPat = GRILL_PATTERNS.find(g => g.value === cell.grillPattern);
      if (grillPat?.priceAddon) breakdown.push({ label: `${prefix}Grills (${grillPat.label})`, amount: grillPat.priceAddon });
      const grillBar = GRILL_BAR_TYPES.find(g => g.value === cell.grillBarType);
      if (grillBar && grillBar.priceAddon !== undefined && grillBar.priceAddon !== 0) breakdown.push({ label: `${prefix}Grill Bar: ${grillBar.label}`, amount: grillBar.priceAddon });
      const grillSize = GRILL_BAR_SIZES.find(g => g.value === cell.grillBarSize);
      if (grillSize?.priceAddon) breakdown.push({ label: `${prefix}Grill Bar Size: ${grillSize.label}`, amount: grillSize.priceAddon });
      const grillCol = GRILL_COLORS.find(g => g.value === cell.grillColor);
      if (grillCol?.priceAddon) breakdown.push({ label: `${prefix}Grill Color: ${grillCol.label}`, amount: grillCol.priceAddon });
    }
  }

  const total = Math.round(breakdown.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  return { total, breakdown };
}
