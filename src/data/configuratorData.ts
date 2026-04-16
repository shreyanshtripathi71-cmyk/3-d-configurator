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
  height: number;    // individual height for this row
  hardwareType: string;
  hardwareColor: string;
  openingDirection: string;
  screenType: string;
  egressHardware: boolean;
  specialGlazing: string;
  grillPattern: string;
  grillVertical: number;
  grillHorizontal: number;
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
  lowECoating1: string;
  lowECoating2: string;
  gasType: string;
  spacerType: string;
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
  awning:        { minWidth: 19.125, maxWidth: 72, minHeight: 12, maxHeight: 68 },
  casement:      { minWidth: 14,     maxWidth: 36, minHeight: 24, maxHeight: 72 },
  picture:       { minWidth: 12,     maxWidth: 96, minHeight: 12, maxHeight: 96 },
  'high-fix':    { minWidth: 12,     maxWidth: 96, minHeight: 12, maxHeight: 96 },
  'single-hung': { minWidth: 19.5,   maxWidth: 44, minHeight: 30, maxHeight: 72 },
  'double-hung': { minWidth: 19.5,   maxWidth: 44, minHeight: 30, maxHeight: 72 },
  'single-slider': { minWidth: 36,   maxWidth: 72, minHeight: 18, maxHeight: 60 },
  'double-slider': { minWidth: 48,   maxWidth: 96, minHeight: 18, maxHeight: 60 },
  'end-vent':    { minWidth: 48,     maxWidth: 96, minHeight: 18, maxHeight: 60 },
};

/* ─── Model paths per window type ─── */
export const WINDOW_MODEL_PATHS: Record<string, string> = {
  awning:        '/windows/awning/AwningWindow.gltf',
  casement:      '/windows/casement/CasementWindow.gltf',
  picture:       '/windows/picture/PictureWindow_Model_1.gltf',
  'high-fix':    '/windows/high-fix/HighFixWindow_DoubleGlazing.gltf',
  'single-hung': '/windows/single-hung/SingleHungWindow_optimized.glb',
  'double-hung': '/windows/double-hung/DoubleHungWindow_optimized.glb',
  'single-slider': '/windows/single-slider/SingleSliderWindow_optimized.glb',
  'double-slider': '/windows/double-slider/DoubleSliderWindow_optimized.glb',
  'end-vent':    '/windows/end-vent/End Vent Slider Window_Model_1_optimized.glb',
};

/* ─── Helper: Create a default WindowCell ─── */
export function createDefaultCell(
  row: number,
  col: number,
  windowType: string,
  height: number,
): WindowCell {
  return {
    id: `W${row + 1}.${col + 1}`,
    row,
    col,
    windowType,
    height,
    hardwareType: 'premium-classic',
    hardwareColor: 'white',
    openingDirection: windowType === 'picture' || windowType === 'high-fix' ? 'fixed' : 'right',
    screenType: 'regular',
    egressHardware: false,
    specialGlazing: 'default',
    grillPattern: 'none',
    grillVertical: 1,
    grillHorizontal: 1,
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
      // Panes.com: only W1.1 (row 0, last col) = awning, everything else = picture
      // W1.1 in panes = bottom-right = row 0, col (colsForRow-1)
      const isW1_1 = (r === 0 && c === colsForRow - 1);
      const cellType = isW1_1 ? baseWindowType : 'picture';
      cells.push(createDefaultCell(r, c, cellType, rowHeight));
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
  // Minimum ~12 inches per row (panes.com logic)
  if (frameHeight <= 0) return 1;
  const max = Math.floor(frameHeight / 12);
  return Math.max(1, Math.min(4, max));
}

/* ─── Helper: Max horizontal count based on width ─── */
export function getMaxHorizontal(frameWidth: number): number {
  if (frameWidth <= 0) return 1;
  const max = Math.floor(frameWidth / 12);
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
    // W1.1 (row 0, last col) = base type, everything else = picture
    const isW1_1 = (row === 0 && c === newHorizontalCount - 1);
    const cellType = isW1_1 ? baseWindowType : 'picture';
    newRowCells.push(createDefaultCell(row, c, cellType, rowHeight));
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
    lowECoating1: 'climaguard-80-70',
    lowECoating2: 'none',
    gasType: 'argon',
    spacerType: 'warm-edge',
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
  { value: '2-inch', label: '2" Brickmould', priceAddon: 18.50 },
  { value: '3-inch', label: '3" Brickmould', priceAddon: 24.00 },
];

export const NAILING_FIN_OPTIONS: ConfigOption[] = [
  { value: 'none', label: 'No Nailing Fin', priceAddon: 0 },
  { value: 'snap-in', label: 'Snap-in Nailing Fin', priceAddon: 12.00 },
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

export const TINT_FROSTING_OPTIONS: ConfigOption[] = [
  { value: 'none', label: 'No Tint or Frosting', priceAddon: 0 },
  { value: 'grey-tint', label: 'Grey Tint', priceAddon: 28.00 },
  { value: 'bronze-tint', label: 'Bronze Tint', priceAddon: 28.00 },
  { value: 'frosted', label: 'Frosted / Obscure', priceAddon: 35.00 },
  { value: 'rain-glass', label: 'Rain Glass', priceAddon: 42.00 },
];

export const SECURITY_GLASS_OPTIONS: ConfigOption[] = [
  { value: 'none', label: 'No Security Glass', priceAddon: 0 },
  { value: 'tempered', label: 'Tempered Glass', priceAddon: 45.00 },
  { value: 'laminated', label: 'Laminated Glass', priceAddon: 65.00 },
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

export const HARDWARE_TYPES: ConfigOption[] = [
  { value: 'premium-classic', label: 'Premium Classic', priceAddon: 0 },
  { value: 'slimline', label: 'Slimline', priceAddon: 15.00 },
];

export const HARDWARE_COLORS: ConfigOption[] = [
  { value: 'white', label: 'White', icon: '⬜', priceAddon: 0 },
  { value: 'black', label: 'Black', icon: '⬛', priceAddon: 8.00 },
  { value: 'brushed-nickel', label: 'Brushed Nickel', icon: '🔘', priceAddon: 48.75 },
];

export const OPENING_DIRECTIONS: ConfigOption[] = [
  { value: 'left', label: 'Left Hand', icon: '◀️' },
  { value: 'right', label: 'Right Hand', icon: '▶️' },
  { value: 'fixed', label: 'Fixed (No Opening)', icon: '⏹️' },
];

export const SCREEN_TYPES: ConfigOption[] = [
  { value: 'none', label: 'No Screen', priceAddon: 0 },
  { value: 'regular', label: 'Regular Screen', priceAddon: 0, description: 'Standard' },
  { value: 'bettervue', label: 'BetterVue Screen', priceAddon: 25.00 },
];

export const SPECIAL_GLAZING_OPTIONS: ConfigOption[] = [
  { value: 'default', label: 'Default Glazing', priceAddon: 0 },
  { value: 'noise-reduction', label: 'Noise Reduction', priceAddon: 55.00 },
  { value: 'impact-resistant', label: 'Impact Resistant', priceAddon: 85.00 },
];

export const GRILL_PATTERNS: ConfigOption[] = [
  { value: 'none', label: 'No Grills', priceAddon: 0 },
  { value: 'colonial', label: 'Colonial', priceAddon: 32.00 },
  { value: 'prairie', label: 'Prairie', priceAddon: 32.00 },
  { value: 'georgian', label: 'Georgian', priceAddon: 38.00 },
  { value: 'sdl', label: 'SDL (Simulated Divided Lite)', priceAddon: 55.00 },
];

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
    const hw = HARDWARE_TYPES.find(h => h.value === cell.hardwareType);
    if (hw?.priceAddon) breakdown.push({ label: `${prefix}Hardware`, amount: hw.priceAddon });
    const hwc = HARDWARE_COLORS.find(h => h.value === cell.hardwareColor);
    if (hwc?.priceAddon) breakdown.push({ label: `${prefix}Hardware Color`, amount: hwc.priceAddon });
    const scr = SCREEN_TYPES.find(s => s.value === cell.screenType);
    if (scr?.priceAddon) breakdown.push({ label: `${prefix}Screen`, amount: scr.priceAddon });
    const spec = SPECIAL_GLAZING_OPTIONS.find(s => s.value === cell.specialGlazing);
    if (spec?.priceAddon) breakdown.push({ label: `${prefix}Special Glazing`, amount: spec.priceAddon });
    if (cell.egressHardware) breakdown.push({ label: `${prefix}Egress Hardware`, amount: 18.00 });
    const grill = GRILL_PATTERNS.find(g => g.value === cell.grillPattern);
    if (grill?.priceAddon) breakdown.push({ label: `${prefix}Grills`, amount: grill.priceAddon });
  }
  
  const total = Math.round(breakdown.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  return { total, breakdown };
}
