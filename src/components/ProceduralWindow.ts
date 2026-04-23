/**
 * ProceduralWindow.ts
 * ───────────────────
 * Procedural 3D window model — panes.com parity.
 *
 * KEY FEATURE: Every frame bar is split into TWO halves along Z-depth:
 *   - Front half → exterior color (frameMat)
 *   - Back  half → interior color (intMat)
 * This matches panes.com where setting exterior=Black and interior=White
 * creates a frame that is black on the outside and white on the inside.
 *
 * WINDOW TYPE DIFFERENTIATION:
 *   - Casement:      Side-hinged sash, triangle indicator to hinge side, crank handle
 *   - Awning:        Top-hinged sash, inverted V indicator, crank handle
 *   - Picture:       Fixed — no sash, no hardware, no indicator
 *   - Single Hung:   Horizontal meeting rail, bottom slides up (arrow), lock
 *   - Double Hung:   Horizontal meeting rail, both slide (arrows), lock
 *   - Single Slider: Vertical meeting rail, one side slides (arrow), lock
 *   - Double Slider: Vertical meeting rail, both sides slide (arrows), lock
 *   - End Vent:      3-section — fixed center, sliding side vents (arrows)
 *   - High Fix:      Fixed — same as picture
 */

import * as THREE from 'three';

/* ═══════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════ */

export type CellType =
  | 'awning'
  | 'picture'
  | 'fixed'
  | 'casement'
  | 'highfix'
  | 'high-fix'
  | 'single-hung'
  | 'double-hung'
  | 'single-slider'
  | 'double-slider'
  | 'end-vent';

export interface GrillCellConfig {
  pattern: string;         // 'none' | 'colonial' | 'prairie' | 'double-prairie' | 'perimeter' | 'double-perimeter' | 'top-down' | 'bottom-up'
  barType: string;         // 'flat' | 'georgian' | 'pencil' | 'sdl'
  barSize: string;         // '5/16' | '5/8' | '1'
  color?: THREE.Color;     // resolved grill color
  verticalBars: number;    // for colonial: number of vertical bars
  horizontalBars: number;  // for colonial: number of horizontal bars
  // Prairie-specific
  prairieHBarLayout?: string;  // 'top-and-bottom' | 'top-only' | 'bottom-only' | 'centered' | 'none'
  prairieVBarLayout?: string;  // 'left-and-right' | 'left-only' | 'right-only' | 'centered' | 'none'
  prairieHBarDaylight?: number;
  prairieVBarDaylight?: number;
  prairieBarSpacing?: number;
  prairieLadderHead?: number;
  prairieLadderSill?: number;
  prairieLadderLeft?: number;
  prairieLadderRight?: number;
  prairieHSupportBars?: number;
  prairieVSupportBars?: number;
  // Ladder-specific
  ladderBarSpacing?: number;   // distance from top in inches
}

export interface CellDef {
  row: number;
  col: number;
  type: CellType;
  grill?: GrillCellConfig;
}

export interface ProceduralWindowOpts {
  widthInches: number;
  heightInches: number;
  rows: number;
  cols: number;
  cells: CellDef[];
  rowColCounts?: number[];
  frameColor?: THREE.Color;
  interiorColor?: THREE.Color;
  hardwareColor?: THREE.Color;
  /** Cell types that should skip procedural rendering (GLTF models will be placed instead) */
  gltfCellTypes?: CellType[];
}

/** Bounds info for a cell — used to place GLTF models in hybrid mode */
export interface CellBoundsInfo {
  row: number;
  col: number;
  type: CellType;
  /** Center X in scene units */
  x: number;
  /** Center Y in scene units */
  y: number;
  /** Width in scene units */
  w: number;
  /** Height in scene units */
  h: number;
  left: number;
  right: number;
  bottom: number;
  top: number;
}

export interface HardwarePlacement {
  /** Center X position on meeting rail */
  x: number;
  /** Center Y position of meeting rail */
  y: number;
  /** Z position: front face of the sash/rail */
  z: number;
  /** Width of the cell (for scaling) */
  cellW: number;
  /** Height of the cell */
  cellH: number;
  /** Type of window cell */
  type: CellType;
}

export interface ProceduralWindowResult {
  group: THREE.Group;
  frameMaterials: THREE.MeshStandardMaterial[];
  /** Bounds of cells that were skipped (for GLTF model placement) */
  gltfCellBounds: CellBoundsInfo[];
  /** The scene-unit depth of the frame */
  frameDepth: number;
  /** Positions where GLTF hardware should be placed */
  hardwarePlacements: HardwarePlacement[];
}

/* ═══════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════ */

const FRAME_OUTER = 0.12;
const MULLION_F = 0.04;
const FRAME_DEPTH = 0.18;
const SASH_DEPTH = 0.04;   // slightly deeper sash for better 3D look
const GLASS_THICK = 0.012;
/** Super-thin connector (mullion/transom) between cells */
const CONNECTOR_THIN = 0.022;

/* ═══════════════════════════════════════════════
   Main Builder
   ═══════════════════════════════════════════════ */

export function buildProceduralWindow(opts: ProceduralWindowOpts): ProceduralWindowResult {
  const { widthInches: totalW, heightInches: totalH, rows, cols, cells, rowColCounts } = opts;

  const group = new THREE.Group();
  const frameMats: THREE.MeshStandardMaterial[] = [];
  const getRowCols = (row: number) => rowColCounts?.[row] ?? cols;

  // Normalize: largest dim → 3 scene units
  const maxDim = Math.max(totalW, totalH);
  const S = 3.0 / maxDim;
  const W = totalW * S;
  const H = totalH * S;

  const minDim = Math.min(W, H);
  const frameW = Math.max(minDim * FRAME_OUTER, 0.08);
  const mullionW = Math.max(minDim * MULLION_F, 0.05);
  const depth = FRAME_DEPTH;
  const halfD = depth / 2;    // half depth for split bars
  const sashD = SASH_DEPTH;

  /* ─── Materials ─── */

  // Frame color — exterior color from user selection
  const fColor = opts.frameColor ? opts.frameColor.clone() : new THREE.Color(0.80, 0.80, 0.79);
  const fColorDark = fColor.clone().multiplyScalar(0.90);

  // Detect if color is dark (black, brown, iron ore etc.)
  const extBrightness = fColor.r * 0.299 + fColor.g * 0.587 + fColor.b * 0.114;
  const isDarkExterior = extBrightness < 0.45;

  // Main frame — exterior (front face)
  const frameMat = new THREE.MeshPhysicalMaterial({
    color: fColor.clone(),
    roughness: isDarkExterior ? 0.35 : 0.6,
    metalness: isDarkExterior ? 0.15 : 0.0,
    envMapIntensity: isDarkExterior ? 1.0 : 0.4,
    clearcoat: isDarkExterior ? 0.3 : 0.05,
    clearcoatRoughness: isDarkExterior ? 0.2 : 0.5,
  });
  frameMats.push(frameMat);

  // Interior frame — back face (white default when not set, or user-selected interior color)
  const intColor = opts.interiorColor ? opts.interiorColor.clone() : new THREE.Color(0.92, 0.92, 0.91);
  const intMat = new THREE.MeshPhysicalMaterial({
    color: intColor,
    roughness: 0.6,
    metalness: 0.0,
    envMapIntensity: 0.4,
    clearcoat: 0.05,
    clearcoatRoughness: 0.5,
  });
  if (opts.interiorColor || true) frameMats.push(intMat); // always track it

  // Frame edge — slightly darker exterior
  const frameEdgeMat = new THREE.MeshStandardMaterial({
    color: fColorDark.clone(),
    roughness: isDarkExterior ? 0.4 : 0.7,
    metalness: isDarkExterior ? 0.1 : 0.0,
  });

  // Sash frame — same as exterior
  const sashMat = new THREE.MeshPhysicalMaterial({
    color: fColor.clone(),
    roughness: isDarkExterior ? 0.35 : 0.6,
    metalness: isDarkExterior ? 0.15 : 0.0,
    envMapIntensity: isDarkExterior ? 1.0 : 0.4,
    clearcoat: isDarkExterior ? 0.3 : 0.05,
    clearcoatRoughness: isDarkExterior ? 0.2 : 0.5,
  });
  frameMats.push(sashMat);

  // Meeting rail — same as exterior
  const meetingRailMat = new THREE.MeshPhysicalMaterial({
    color: fColor.clone(),
    roughness: isDarkExterior ? 0.35 : 0.6,
    metalness: isDarkExterior ? 0.15 : 0.0,
    envMapIntensity: isDarkExterior ? 1.0 : 0.4,
    clearcoat: isDarkExterior ? 0.3 : 0.05,
    clearcoatRoughness: isDarkExterior ? 0.2 : 0.5,
  });
  frameMats.push(meetingRailMat);

  // Glass — near-pure white, barely visible
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.97, 0.97, 0.97),
    transparent: true,
    opacity: 0.08,
    roughness: 0.0,
    metalness: 0.0,
    transmission: 0.97,
    ior: 1.5,
    thickness: 0.1,
    envMapIntensity: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // Gasket — slightly darker exterior
  const gasketMat = new THREE.MeshStandardMaterial({
    color: fColorDark.clone(),
    roughness: 0.8,
    metalness: 0.0,
  });

  // Hardware — frame color, subtly darker
  const hwMat = new THREE.MeshStandardMaterial({
    color: fColorDark.clone(),
    roughness: 0.5,
    metalness: 0.1,
  });

  /* ─── Geometry Helpers ─── */

  /** Simple box — used for gaskets, hardware, small details */
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => {
    const geo = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    return mesh;
  };

  /**
   * Profiled frame bar — creates a bar with subtle chamfered/beveled edges.
   * Uses ExtrudeGeometry with a rounded rectangle cross-section for realistic PVC vinyl look.
   * The profile is drawn in XY plane (width × depth) and extruded along the bar length.
   */
  const frameBar = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, orient: 'h' | 'v' | 'z' = 'z') => {
    // For very small bars, fall back to simple box
    const minDimBar = Math.min(w, h, d);
    if (minDimBar < 0.01) {
      return box(x, y, z, w, h, d, mat);
    }

    // Determine cross-section dimensions and extrusion length based on orientation
    let profileW: number, profileH: number, extrudeLen: number;
    if (orient === 'h') {
      // Horizontal bar: profile is (height × depth), extrude along X (width)
      profileW = h; profileH = d; extrudeLen = w;
    } else if (orient === 'v') {
      // Vertical bar: profile is (width × depth), extrude along Y (height)
      profileW = w; profileH = d; extrudeLen = h;
    } else {
      // Z-oriented (default box behavior)
      return box(x, y, z, w, h, d, mat);
    }

    // Rounded rectangle cross-section with subtle bevel
    const bevel = Math.min(profileW, profileH) * 0.06; // 6% of smaller dimension
    const hw2 = profileW / 2;
    const hh2 = profileH / 2;

    const shape = new THREE.Shape();
    if (bevel > 0.0005) {
      shape.moveTo(-hw2 + bevel, -hh2);
      shape.lineTo(hw2 - bevel, -hh2);
      shape.quadraticCurveTo(hw2, -hh2, hw2, -hh2 + bevel);
      shape.lineTo(hw2, hh2 - bevel);
      shape.quadraticCurveTo(hw2, hh2, hw2 - bevel, hh2);
      shape.lineTo(-hw2 + bevel, hh2);
      shape.quadraticCurveTo(-hw2, hh2, -hw2, hh2 - bevel);
      shape.lineTo(-hw2, -hh2 + bevel);
      shape.quadraticCurveTo(-hw2, -hh2, -hw2 + bevel, -hh2);
    } else {
      shape.moveTo(-hw2, -hh2);
      shape.lineTo(hw2, -hh2);
      shape.lineTo(hw2, hh2);
      shape.lineTo(-hw2, hh2);
      shape.closePath();
    }

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: extrudeLen,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 3,
    });

    // Reorient: extrusion goes along +Z, we need it along X (horizontal) or Y (vertical)
    if (orient === 'h') {
      // Extruded along Z → rotate to go along X
      geo.rotateY(-Math.PI / 2);
    } else if (orient === 'v') {
      // Extruded along Z → rotate to go along Y
      geo.rotateX(-Math.PI / 2);
    }

    // Center the geometry
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    geo.translate(
      -(bb.min.x + bb.max.x) / 2,
      -(bb.min.y + bb.max.y) / 2,
      -(bb.min.z + bb.max.z) / 2,
    );
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    return mesh;
  };

  /**
   * Split bar: creates TWO profiled bars — exterior (front 50%) + interior (back 50%).
   * Front half = exterior color (visible from outside).
   * Back half = interior color (visible from inside / at an angle).
   * This ensures when you look at the frame from inside or at an angle,
   * the inner-facing surfaces show the interior color.
   */
  const extDepth = depth * 0.50;
  const intDepth = depth * 0.50;
  const splitBar = (x: number, y: number, w: number, h: number) => {
    // Determine bar orientation for correct profile extrusion
    const orient: 'h' | 'v' = w > h ? 'h' : 'v';
    // Exterior (front 50%) — facing the camera at +Z
    frameBar(x, y, depth / 2 - extDepth / 2, w, h, extDepth, frameMat, orient);
    // Interior (back 50%) — away from camera at -Z  
    frameBar(x, y, -(depth / 2 - intDepth / 2), w, h, intDepth, intMat, orient);
  };

  const hw = W / 2;
  const hh = H / 2;
  const frontZ = depth / 2;
  const backZ = -depth / 2;

  /* ═════════════════════════════════════
     1. OUTER FRAME
     ═════════════════════════════════════ 
     GLTF cells: NO procedural outer frame — the GLTF model's own frame IS the window frame.
     Procedural cells: draw the outer frame.
     Multi-cell: thin connector bars (mullions/transoms) between cells.
  */
  const allGltf = cells.every(c => {
    const normType = c.type === 'highfix' ? 'high-fix' : c.type;
    return (opts.gltfCellTypes || []).includes(normType);
  });

  const isMultiCell = rows > 1 || cols > 1;
  // Connector width: super-thin bar between multi-cell windows
  const connectorW = isMultiCell ? CONNECTOR_THIN : 0;

  if (!allGltf) {
    // Procedural outer frame (only for non-GLTF cells)
    splitBar(0, hh - frameW / 2, W, frameW);                     // Top
    splitBar(0, -hh + frameW / 2, W, frameW);                    // Bottom
    splitBar(-hw + frameW / 2, 0, frameW, H - 2 * frameW);       // Left
    splitBar(hw - frameW / 2, 0, frameW, H - 2 * frameW);        // Right
  }

  /* ═════════════════════════════════════
     2. CELL POSITIONS
     ═════════════════════════════════════ */
  const cellInset = allGltf ? 0 : frameW;
  const innerW = W - 2 * cellInset;
  const innerH = H - 2 * cellInset;
  // Use super-thin connector between cells; mullionW only for sub-cell meeting rails
  const useConnector = isMultiCell ? CONNECTOR_THIN : 0;
  const useMullion = allGltf ? useConnector : (useConnector || mullionW);
  const usableH = innerH - (rows - 1) * useConnector;
  const cellH = usableH / rows;

  const getRowCellW = (row: number) => {
    const rc = getRowCols(row);
    return (innerW - (rc - 1) * useConnector) / rc;
  };

  const getCellBounds = (row: number, col: number) => {
    const cW = getRowCellW(row);
    const y0 = -hh + cellInset + row * (cellH + useConnector);
    const y1 = y0 + cellH;
    const x0 = -hw + cellInset + col * (cW + useConnector);
    const x1 = x0 + cW;
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: cW, h: cellH, left: x0, right: x1, bottom: y0, top: y1 };
  };

  /* ═════════════════════════════════════
     3. TRANSOMS (horizontal dividers)
     ═════════════════════════════════════
     Super-thin connector splitBars (exterior+interior color) between rows.
  */
  for (let r = 1; r < rows; r++) {
    const ty = -hh + cellInset + r * cellH + (r - 0.5) * useConnector;
    splitBar(0, ty, innerW + 2 * cellInset, useConnector);
  }

  /* ═════════════════════════════════════
     4. MULLIONS (vertical dividers, per row)
     ═════════════════════════════════════
     Super-thin connector splitBars (exterior+interior color) between columns.
  */
  for (let r = 0; r < rows; r++) {
    const rc = getRowCols(r);
    const cW = getRowCellW(r);
    const rBot = -hh + cellInset + r * (cellH + useConnector);
    const rTop = rBot + cellH;
    for (let c = 1; c < rc; c++) {
      const mx = -hw + cellInset + c * cW + (c - 0.5) * useConnector;
      splitBar(mx, (rBot + rTop) / 2, useConnector, cellH);
    }
  }

  /* ═════════════════════════════════════
     5. PER-CELL: Type-specific rendering
     ═════════════════════════════════════ */

  const gltfCellBounds: CellBoundsInfo[] = [];
  const hardwarePlacements: HardwarePlacement[] = [];
  const gltfTypes = new Set(opts.gltfCellTypes || []);

  for (const cell of cells) {
    const { row, col, type } = cell;
    const b = getCellBounds(row, col);
    const sashW = Math.max(mullionW * 0.6, 0.03);

    // Normalize type
    const normType = type === 'highfix' ? 'high-fix' : type;

    // If this cell type is GLTF-backed, skip procedural rendering
    // Record bounds so the caller can place a GLTF model clone
    if (gltfTypes.has(normType as CellType)) {
      gltfCellBounds.push({
        row, col, type: normType as CellType,
        x: b.x, y: b.y, w: b.w, h: b.h,
        left: b.left, right: b.right, bottom: b.bottom, top: b.top,
      });
      // GLTF cells get grills from buildGrillGroup in WindowViewer — skip here
    } else {
      // Procedural cell rendering
      switch (normType) {
        case 'casement':
          renderCasement(b, sashW);
          break;
        case 'awning':
          renderAwning(b, sashW);
          break;
        case 'single-hung':
          renderSingleHung(b, sashW);
          break;
        case 'double-hung':
          renderDoubleHung(b, sashW);
          break;
        case 'single-slider':
          renderSingleSlider(b, sashW);
          break;
        case 'double-slider':
          renderDoubleSlider(b, sashW);
          break;
        case 'end-vent':
          renderEndVent(b, sashW);
          break;
        case 'picture':
        case 'fixed':
        case 'high-fix':
        default:
          renderFixed(b, sashW);
          break;
      }

      // ── GRILLS — render on glass area if configured (procedural cells only) ──
      // Bars must sit exactly within the inner sash edge.
      // Fixed/picture windows have a thinner sash (sashW*0.6), casement/awning use full sashW.
      if (cell.grill && cell.grill.pattern !== 'none') {
        const isFixedType = normType === 'picture' || normType === 'fixed' || normType === 'high-fix';
        const grillInset = isFixedType
          ? (sashW * 0.6 + 0.004)   // thin sash for fixed/picture types
          : (sashW + 0.005);         // full sash for casement/awning/hung/slider
        const grillGlassW = b.w - 2 * grillInset;
        const grillGlassH = b.h - 2 * grillInset;
        if (grillGlassW > 0 && grillGlassH > 0) {
          renderGrills(b.x, b.y, grillGlassW, grillGlassH, cell.grill);
        }
      }
    }

    // ── CELL LABEL (W1.1, W2.1, etc.) — 3D mesh attached to glass surface ──
    // Panes.com: W1.1 is the RIGHTMOST cell, numbering goes right-to-left
    const rowColCount = getRowCols(row);
    const reversedCol = rowColCount - col; // rightmost = 1, next = 2, etc.
    const labelId = `W${row + 1}.${reversedCol}`;
    const labelScale = Math.min(b.w, b.h) * 0.12;
    const labelMesh = makeLabel3D(labelId, labelScale);
    // Position: well inside the cell bounds using 15% inset to clear any frame type
    // This works for all window types (GLTF thick frames, procedural thin frames)
    const insetX = b.w * 0.10; // 10% from left edge
    const insetY = b.h * 0.10; // 10% from top edge
    const labelAspect = 256 / 80;
    const labelPlaneW = labelScale * labelAspect;
    const labelX = b.left + insetX + labelPlaneW / 2;
    const labelY = b.top - insetY - labelScale / 2;
    labelMesh.position.set(labelX, labelY, 0.001);
    group.add(labelMesh);
  }

  /* ═══════════════════════════════════════
     TYPE RENDERERS
     ═══════════════════════════════════════ */

  /**
   * CASEMENT — Side-hinged window
   * - Sash frame around entire glass area (thicker on exterior)
   * - Triangle indicator: two dashed lines from hinge side corners to center of opening side
   * - Crank handle at bottom center
   * - Gasket strip
   */
  function renderCasement(b: ReturnType<typeof getCellBounds>, sashW: number) {
    // Interior color backing panel
    renderInteriorBacking(b);
    // ── SASH — EXTERIOR (front face, profiled bars) ──
    const sz = frontZ + sashD / 2;
    frameBar(b.x, b.top - sashW / 2, sz, b.w, sashW, sashD, sashMat, 'h');         // top
    frameBar(b.x, b.bottom + sashW / 2, sz, b.w, sashW, sashD, sashMat, 'h');      // bottom
    frameBar(b.left + sashW / 2, b.y, sz, sashW, b.h - 2 * sashW, sashD, sashMat, 'v');  // left
    frameBar(b.right - sashW / 2, b.y, sz, sashW, b.h - 2 * sashW, sashD, sashMat, 'v'); // right

    // Gasket strips
    const gasketT = 0.004;
    const gsInset = sashW;
    box(b.x, b.top - gsInset - gasketT / 2, sz, b.w - 2 * sashW, gasketT, sashD * 0.5, gasketMat);
    box(b.x, b.bottom + gsInset + gasketT / 2, sz, b.w - 2 * sashW, gasketT, sashD * 0.5, gasketMat);

    // Interior glass stop
    renderInteriorStop(b, sashW);

    // Glass pane
    renderGlass(b, sashW, true);

    // ── OPENING INDICATOR — Triangle from hinge side (left) to opposite side center ──
    // Panes.com: Two dashed lines from top-right and bottom-right to center-left (hinge side)
    const indInset = sashW * 1.2;
    const indW = b.w - 2 * indInset;
    const indH = b.h - 2 * indInset;
    const indZ = frontZ + sashD + 0.005;

    if (indW > 0 && indH > 0) {
      const dashMat = new THREE.LineDashedMaterial({
        color: 0x999999,
        dashSize: Math.max(indW * 0.08, 0.03),
        gapSize: Math.max(indW * 0.05, 0.02),
        linewidth: 1,
      });

      // Triangle: vertex on the RIGHT (hinge side), base on the LEFT
      // Upper line: top-left → center-right
      const line1Pts = [
        new THREE.Vector3(b.x - indW / 2, b.y + indH / 2, indZ),
        new THREE.Vector3(b.x + indW / 2, b.y, indZ),
      ];
      const line1Geo = new THREE.BufferGeometry().setFromPoints(line1Pts);
      const line1 = new THREE.Line(line1Geo, dashMat);
      line1.computeLineDistances();
      group.add(line1);

      // Lower line: bottom-left → center-right
      const line2Pts = [
        new THREE.Vector3(b.x - indW / 2, b.y - indH / 2, indZ),
        new THREE.Vector3(b.x + indW / 2, b.y, indZ),
      ];
      const line2Geo = new THREE.BufferGeometry().setFromPoints(line2Pts);
      const line2 = new THREE.Line(line2Geo, dashMat);
      line2.computeLineDistances();
      group.add(line2);
    }

    // ── HARDWARE — Folding crank handle at bottom ──
    const hwZ = frontZ + sashD + 0.006;
    const hW = Math.max(Math.min(b.w * 0.10, 0.15), 0.06);
    const hH = Math.max(Math.min(b.h * 0.025, 0.03), 0.015);
    const hwD = 0.012;
    const crankY = b.bottom + sashW + hH * 1.5;
    box(b.x, crankY, hwZ, hW * 1.5, hH, hwD, hwMat);

    // Arm + knob
    const armLen = hW * 1.2;
    const armR = hH * 0.25;
    const armGeo = new THREE.CylinderGeometry(armR, armR, armLen, 6);
    armGeo.rotateZ(Math.PI / 2);
    const arm = new THREE.Mesh(armGeo, hwMat);
    arm.position.set(b.x + hW * 0.6, crankY, hwZ + 0.003);
    arm.castShadow = false;
    group.add(arm);

    const knobR = armR * 1.5;
    const knobGeo = new THREE.SphereGeometry(knobR, 8, 6);
    const knob = new THREE.Mesh(knobGeo, hwMat);
    knob.position.set(b.x + hW * 0.6 + armLen / 2, crankY, hwZ + 0.003);
    knob.castShadow = false;
    group.add(knob);

    // Interior lock
    renderInteriorLock(b, sashW);
  }

  /**
   * AWNING — Top-hinged window
   * - Sash frame around entire glass area
   * - Inverted V indicator: two dashed lines from bottom corners up to top center
   * - Crank handle at bottom center
   */
  function renderAwning(b: ReturnType<typeof getCellBounds>, sashW: number) {
    // Interior color backing panel
    renderInteriorBacking(b);
    // ── SASH frame (profiled bars) ──
    const sz = frontZ + sashD / 2;
    frameBar(b.x, b.top - sashW / 2, sz, b.w, sashW, sashD, sashMat, 'h');
    frameBar(b.x, b.bottom + sashW / 2, sz, b.w, sashW, sashD, sashMat, 'h');
    frameBar(b.left + sashW / 2, b.y, sz, sashW, b.h - 2 * sashW, sashD, sashMat, 'v');
    frameBar(b.right - sashW / 2, b.y, sz, sashW, b.h - 2 * sashW, sashD, sashMat, 'v');

    // Gasket strips
    const gasketT = 0.004;
    const gsInset = sashW;
    box(b.x, b.top - gsInset - gasketT / 2, sz, b.w - 2 * sashW, gasketT, sashD * 0.5, gasketMat);
    box(b.x, b.bottom + gsInset + gasketT / 2, sz, b.w - 2 * sashW, gasketT, sashD * 0.5, gasketMat);

    // Interior glass stop
    renderInteriorStop(b, sashW);

    // Glass pane
    renderGlass(b, sashW, true);

    // ── OPENING INDICATOR — Inverted V (top-hinged opens from bottom) ──
    const indInset = sashW * 1.2;
    const indW = b.w - 2 * indInset;
    const indH = b.h - 2 * indInset;
    const indZ = frontZ + sashD + 0.005;

    if (indW > 0 && indH > 0) {
      const dashMat = new THREE.LineDashedMaterial({
        color: 0x999999,
        dashSize: Math.max(indW * 0.08, 0.03),
        gapSize: Math.max(indW * 0.05, 0.02),
        linewidth: 1,
      });

      // Left line: bottom-left → top-center
      const lPts = [
        new THREE.Vector3(b.x - indW / 2, b.y - indH / 2, indZ),
        new THREE.Vector3(b.x, b.y + indH / 2, indZ),
      ];
      const lGeo = new THREE.BufferGeometry().setFromPoints(lPts);
      const lLine = new THREE.Line(lGeo, dashMat);
      lLine.computeLineDistances();
      group.add(lLine);

      // Right line: bottom-right → top-center
      const rPts = [
        new THREE.Vector3(b.x + indW / 2, b.y - indH / 2, indZ),
        new THREE.Vector3(b.x, b.y + indH / 2, indZ),
      ];
      const rGeo = new THREE.BufferGeometry().setFromPoints(rPts);
      const rLine = new THREE.Line(rGeo, dashMat);
      rLine.computeLineDistances();
      group.add(rLine);
    }

    // ── HARDWARE — Crank handle at bottom ──
    const hwZ = frontZ + sashD + 0.006;
    const hW = Math.max(Math.min(b.w * 0.10, 0.15), 0.06);
    const hH = Math.max(Math.min(b.h * 0.025, 0.03), 0.015);
    const hwD = 0.012;
    const crankY = b.bottom + sashW + hH * 1.5;
    box(b.x, crankY, hwZ, hW * 1.5, hH, hwD, hwMat);

    const armLen = hW * 1.2;
    const armR = hH * 0.25;
    const armGeo = new THREE.CylinderGeometry(armR, armR, armLen, 6);
    armGeo.rotateZ(Math.PI / 2);
    const arm = new THREE.Mesh(armGeo, hwMat);
    arm.position.set(b.x + hW * 0.6, crankY, hwZ + 0.003);
    arm.castShadow = false;
    group.add(arm);

    const knobR = armR * 1.5;
    const knobGeo = new THREE.SphereGeometry(knobR, 8, 6);
    const knob = new THREE.Mesh(knobGeo, hwMat);
    knob.position.set(b.x + hW * 0.6 + armLen / 2, crankY, hwZ + 0.003);
    knob.castShadow = false;
    group.add(knob);

    // Hinge latch points (left & right)
    const latchH = Math.max(Math.min(b.h * 0.04, 0.05), 0.025);
    const latchW2 = hH * 0.4;
    const latchD = hwD;
    const latchY = b.y - b.h * 0.12;
    box(b.left + sashW * 0.4, latchY, hwZ, latchW2, latchH, latchD, hwMat);
    box(b.right - sashW * 0.4, latchY, hwZ, latchW2, latchH, latchD, hwMat);

    // Interior lock
    renderInteriorLock(b, sashW);
  }

  /**
   * Helper: Render thin sash frame around a rectangular sub-pane.
   * Creates thin border lines on the front face matching panes.com inner sash look.
   */
  function renderSubPaneSash(cx: number, cy: number, w: number, h: number, sw: number) {
    const sz = frontZ + sashD / 2;
    // 4 profiled sash rails with beveled edges
    frameBar(cx, cy + h / 2 - sw / 2, sz, w, sw, sashD, sashMat, 'h');             // top
    frameBar(cx, cy - h / 2 + sw / 2, sz, w, sw, sashD, sashMat, 'h');             // bottom
    frameBar(cx - w / 2 + sw / 2, cy, sz, sw, h - 2 * sw, sashD, sashMat, 'v');    // left
    frameBar(cx + w / 2 - sw / 2, cy, sz, sw, h - 2 * sw, sashD, sashMat, 'v');    // right
  }

  /**
   * SINGLE HUNG — panes.com exact match
   * - Each cell is self-contained: meeting rail splits cell into top (fixed) & bottom (operable)
   * - Both sub-panes have visible sash frames (thin border around each glass pane)
   * - Bottom sub-pane has a bold solid black UP arrow
   * - Cam lock hardware on the meeting rail — realistic half-moon lever style
   * - Meeting rail at exact center of cell for equal top/bottom proportions
   */
  function renderSingleHung(b: ReturnType<typeof getCellBounds>, sashW: number) {
    // Interior color backing panel
    renderInteriorBacking(b);
    const meetRailH = mullionW * 1.1; // meeting rail slightly thicker than mullion for visual weight
    const meetRailY = b.y;            // exact center — panes.com reference shows equal top/bottom panes
    const thinSash = sashW * 0.6;     // slightly thicker sash for visible sub-pane borders

    // ── MEETING RAIL — splitBar (dual-color, same depth as main frame) ──
    splitBar(b.x, meetRailY, b.w, meetRailH);

    // ── Sub-pane dimensions ──
    const topBot = meetRailY + meetRailH / 2;
    const topTop = b.top;
    const botTop = meetRailY - meetRailH / 2;
    const botBot = b.bottom;
    const topH = topTop - topBot;
    const botH = botTop - botBot;
    const topCY = (topBot + topTop) / 2;
    const botCY = (botBot + botTop) / 2;

    // ── TOP sub-pane (fixed): sash frame + glass ──
    renderSubPaneSash(b.x, topCY, b.w, topH, thinSash);
    renderGlassRect(b.x, topCY, b.w - 2 * thinSash - 0.008, topH - 2 * thinSash - 0.008);

    // ── BOTTOM sub-pane (operable): sash frame + glass ──
    renderSubPaneSash(b.x, botCY, b.w, botH, thinSash);
    renderGlassRect(b.x, botCY, b.w - 2 * thinSash - 0.008, botH - 2 * thinSash - 0.008);

    // Interior glass stops for whole cell
    renderInteriorStop(b, sashW);

    // ── SOLID BLACK UP ARROW on bottom sub-pane ──
    const indZ = frontZ + sashD + 0.02;
    const arrowSize = Math.max(Math.min(b.w, botH) * 0.32, 0.10);
    renderSolidArrow(b.x, botCY, indZ, arrowSize, 'up');

    // ── Record hardware placement for GLTF loading ──
    hardwarePlacements.push({ x: b.x, y: meetRailY, z: frontZ + sashD, cellW: b.w, cellH: b.h, type: 'single-hung' });
  }

  /**
   * DOUBLE HUNG — panes.com style
   * - Both sub-panes are operable (top slides down, bottom slides up)
   * - Both have sash frames + directional arrows
   * - Cam lock hardware on the meeting rail
   */
  function renderDoubleHung(b: ReturnType<typeof getCellBounds>, sashW: number) {
    // Interior color backing panel
    renderInteriorBacking(b);
    const meetRailH = mullionW * 1.1;
    const meetRailY = b.y;
    const thinSash = sashW * 0.6;

    // ── MEETING RAIL (splitBar) ──
    splitBar(b.x, meetRailY, b.w, meetRailH);

    // ── Sub-pane dimensions ──
    const topBot = meetRailY + meetRailH / 2;
    const topTop = b.top;
    const botTop = meetRailY - meetRailH / 2;
    const botBot = b.bottom;
    const topH = topTop - topBot;
    const botH = botTop - botBot;
    const topCY = (topBot + topTop) / 2;
    const botCY = (botBot + botTop) / 2;

    // ── TOP sub-pane: sash + glass ──
    renderSubPaneSash(b.x, topCY, b.w, topH, thinSash);
    renderGlassRect(b.x, topCY, b.w - 2 * thinSash - 0.008, topH - 2 * thinSash - 0.008);

    // ── BOTTOM sub-pane: sash + glass ──
    renderSubPaneSash(b.x, botCY, b.w, botH, thinSash);
    renderGlassRect(b.x, botCY, b.w - 2 * thinSash - 0.008, botH - 2 * thinSash - 0.008);

    // Interior glass stops
    renderInteriorStop(b, sashW);

    // ── ARROWS — down on top, up on bottom ──
    const indZ = frontZ + sashD + 0.02;
    const arrowSize = Math.max(Math.min(b.w, Math.min(topH, botH)) * 0.28, 0.08);
    renderSolidArrow(b.x, topCY, indZ, arrowSize, 'down');
    renderSolidArrow(b.x, botCY, indZ, arrowSize, 'up');

    // ── Record hardware placement for GLTF loading ──
    hardwarePlacements.push({ x: b.x, y: meetRailY, z: frontZ + sashD, cellW: b.w, cellH: b.h, type: 'double-hung' });
  }

  /**
   * SINGLE SLIDER — panes.com style
   * - Vertical meeting rail, left fixed, right slides
   * - Both sub-panes have sash frames
   * - Right side has solid right arrow
   */
  function renderSingleSlider(b: ReturnType<typeof getCellBounds>, sashW: number) {
    // Interior color backing panel
    renderInteriorBacking(b);
    const meetRailW = mullionW;
    const meetRailX = b.x;
    const thinSash = sashW * 0.5;

    // ── MEETING RAIL (vertical splitBar) ──
    splitBar(meetRailX, b.y, meetRailW, b.h);

    // ── Sub-pane dimensions ──
    const leftW = meetRailX - meetRailW / 2 - b.left;
    const leftCX = b.left + leftW / 2;
    const rightLeft = meetRailX + meetRailW / 2;
    const rightW = b.right - rightLeft;
    const rightCX = rightLeft + rightW / 2;

    // ── LEFT sub-pane (fixed): sash + glass ──
    renderSubPaneSash(leftCX, b.y, leftW, b.h, thinSash);
    renderGlassRect(leftCX, b.y, leftW - 2 * thinSash - 0.01, b.h - 2 * thinSash - 0.01);

    // ── RIGHT sub-pane (slides): sash + glass ──
    renderSubPaneSash(rightCX, b.y, rightW, b.h, thinSash);
    renderGlassRect(rightCX, b.y, rightW - 2 * thinSash - 0.01, b.h - 2 * thinSash - 0.01);

    // Interior glass stops
    renderInteriorStop(b, sashW);

    // ── SOLID RIGHT ARROW on sliding side ──
    const indZ = frontZ + sashD + 0.005;
    const arrowSize = Math.max(Math.min(rightW, b.h) * 0.28, 0.08);
    renderSolidArrow(rightCX, b.y, indZ, arrowSize, 'right');

    // ── CAM LOCK on meeting rail ──
    const lockW2 = Math.max(meetRailW * 0.6, 0.018);
    const lockH2 = Math.max(Math.min(b.h * 0.04, 0.05), 0.025);
    const lockD = 0.008;
    box(meetRailX, b.y, frontZ + sashD + 0.005, lockW2, lockH2, lockD, hwMat);
  }

  /**
   * DOUBLE SLIDER — panes.com style
   * - Vertical meeting rail, both sides slide
   * - Both sub-panes have sash frames + outward arrows
   */
  function renderDoubleSlider(b: ReturnType<typeof getCellBounds>, sashW: number) {
    // Interior color backing panel
    renderInteriorBacking(b);
    const meetRailW = mullionW;
    const meetRailX = b.x;
    const thinSash = sashW * 0.5;

    // ── MEETING RAIL (vertical splitBar) ──
    splitBar(meetRailX, b.y, meetRailW, b.h);

    // ── Sub-pane dimensions ──
    const leftW = meetRailX - meetRailW / 2 - b.left;
    const leftCX = b.left + leftW / 2;
    const rightLeft = meetRailX + meetRailW / 2;
    const rightW = b.right - rightLeft;
    const rightCX = rightLeft + rightW / 2;

    // ── LEFT sub-pane: sash + glass ──
    renderSubPaneSash(leftCX, b.y, leftW, b.h, thinSash);
    renderGlassRect(leftCX, b.y, leftW - 2 * thinSash - 0.01, b.h - 2 * thinSash - 0.01);

    // ── RIGHT sub-pane: sash + glass ──
    renderSubPaneSash(rightCX, b.y, rightW, b.h, thinSash);
    renderGlassRect(rightCX, b.y, rightW - 2 * thinSash - 0.01, b.h - 2 * thinSash - 0.01);

    // Interior glass stops
    renderInteriorStop(b, sashW);

    // ── ARROWS — outward on both sides ──
    const indZ = frontZ + sashD + 0.005;
    const arrowSize = Math.max(Math.min(Math.min(leftW, rightW), b.h) * 0.25, 0.08);
    renderSolidArrow(leftCX, b.y, indZ, arrowSize, 'left');
    renderSolidArrow(rightCX, b.y, indZ, arrowSize, 'right');

    // ── CAM LOCK on meeting rail ──
    const lockW2 = Math.max(meetRailW * 0.6, 0.018);
    const lockH2 = Math.max(Math.min(b.h * 0.04, 0.05), 0.025);
    const lockD = 0.008;
    box(meetRailX, b.y, frontZ + sashD + 0.005, lockW2, lockH2, lockD, hwMat);
  }

  /**
   * END VENT — panes.com style
   * - Two vertical meeting rails, 3 sections
   * - Center fixed, sides slide inward with sash frames + arrows
   */
  function renderEndVent(b: ReturnType<typeof getCellBounds>, sashW: number) {
    // Interior color backing panel
    renderInteriorBacking(b);
    const sideRatio = 0.25;
    const meetRailW = mullionW;
    const sideW = b.w * sideRatio;
    const centerW = b.w - 2 * sideW - 2 * meetRailW;
    const thinSash = sashW * 0.5;

    const leftRailX = b.left + sideW + meetRailW / 2;
    const rightRailX = b.right - sideW - meetRailW / 2;

    // ── MEETING RAILS (two vertical splitBars) ──
    splitBar(leftRailX, b.y, meetRailW, b.h);
    splitBar(rightRailX, b.y, meetRailW, b.h);

    // ── Sub-pane dimensions ──
    const leftSashW = leftRailX - meetRailW / 2 - b.left;
    const leftCX = b.left + leftSashW / 2;
    const rightSashLeft = rightRailX + meetRailW / 2;
    const rightSashW = b.right - rightSashLeft;
    const rightCX = rightSashLeft + rightSashW / 2;
    const centerLeft = leftRailX + meetRailW / 2;
    const centerRight = rightRailX - meetRailW / 2;
    const centerCX = (centerLeft + centerRight) / 2;

    // ── LEFT sub-pane (slides right): sash + glass ──
    renderSubPaneSash(leftCX, b.y, leftSashW, b.h, thinSash);
    renderGlassRect(leftCX, b.y, leftSashW - 2 * thinSash - 0.01, b.h - 2 * thinSash - 0.01);

    // ── CENTER (fixed): sash + glass ──
    renderSubPaneSash(centerCX, b.y, centerW, b.h, thinSash);
    renderGlassRect(centerCX, b.y, centerW - 2 * thinSash - 0.01, b.h - 2 * thinSash - 0.01);

    // ── RIGHT sub-pane (slides left): sash + glass ──
    renderSubPaneSash(rightCX, b.y, rightSashW, b.h, thinSash);
    renderGlassRect(rightCX, b.y, rightSashW - 2 * thinSash - 0.01, b.h - 2 * thinSash - 0.01);

    // Interior glass stops
    renderInteriorStop(b, sashW);

    // ── ARROWS — inward on side panels ──
    const indZ = frontZ + sashD + 0.005;
    const arrowSize = Math.max(Math.min(leftSashW, b.h) * 0.30, 0.08);
    renderSolidArrow(leftCX, b.y, indZ, arrowSize, 'right');
    renderSolidArrow(rightCX, b.y, indZ, arrowSize, 'left');

    // ── CAM LOCKS on both meeting rails ──
    const lockW2 = Math.max(meetRailW * 0.6, 0.018);
    const lockH2 = Math.max(Math.min(b.h * 0.04, 0.05), 0.025);
    const lockD = 0.008;
    box(leftRailX, b.y, frontZ + sashD + 0.005, lockW2, lockH2, lockD, hwMat);
    box(rightRailX, b.y, frontZ + sashD + 0.005, lockW2, lockH2, lockD, hwMat);
  }

  /**
   * FIXED / PICTURE / HIGH-FIX — No operating hardware
   * - Just frame + glass
   * - No sash on exterior
   * - Interior glass stop only
   */
  function renderFixed(b: ReturnType<typeof getCellBounds>, sashW: number) {
    const thinSash = sashW * 0.6;

    // Interior color backing panel — fills cell area so inside frame shows interior color
    renderInteriorBacking(b);

    // Visible sash frame border (same style as single-hung sub-pane)
    renderSubPaneSash(b.x, b.y, b.w, b.h, thinSash);

    // Interior glass stop
    renderInteriorStop(b, sashW);

    // Glass pane (inside sash frame)
    renderGlassRect(b.x, b.y, b.w - 2 * thinSash - 0.008, b.h - 2 * thinSash - 0.008);
  }

  /* ═══════════════════════════════════════
     SHARED RENDER HELPERS
     ═══════════════════════════════════════ */

  /**
   * Interior backing panel — a flat plane behind the frame/sash bars that shows
   * interior color. This ensures inside the frame only interior color is visible.
   */
  function renderInteriorBacking(b: ReturnType<typeof getCellBounds>) {
    const backingD = 0.005;
    // Place behind the sash bars, within the frame depth
    const backingZ = -depth * 0.15;
    const bgGeo = new THREE.BoxGeometry(b.w, b.h, backingD);
    const bgMesh = new THREE.Mesh(bgGeo, intMat);
    bgMesh.position.set(b.x, b.y, backingZ);
    bgMesh.castShadow = false;
    bgMesh.receiveShadow = false;
    group.add(bgMesh);
  }

  function renderInteriorStop(b: ReturnType<typeof getCellBounds>, sashW: number) {
    const stopW = sashW * 0.4;
    const stopD = 0.012;
    const stopZ = backZ - stopD / 2;
    box(b.x, b.top - stopW / 2, stopZ, b.w, stopW, stopD, intMat);
    box(b.x, b.bottom + stopW / 2, stopZ, b.w, stopW, stopD, intMat);
    box(b.left + stopW / 2, b.y, stopZ, stopW, b.h - 2 * stopW, stopD, intMat);
    box(b.right - stopW / 2, b.y, stopZ, stopW, b.h - 2 * stopW, stopD, intMat);
  }

  function renderGlass(b: ReturnType<typeof getCellBounds>, sashW: number, hasExteriorSash: boolean) {
    const glassInset = hasExteriorSash ? sashW + 0.005 : 0.015;
    const gW = b.w - 2 * glassInset;
    const gH = b.h - 2 * glassInset;
    if (gW > 0 && gH > 0) {
      renderGlassRect(b.x, b.y, gW, gH);
    }
  }

  function renderGlassRect(cx: number, cy: number, w: number, h: number) {
    if (w <= 0 || h <= 0) return;
    const glassGeo = new THREE.BoxGeometry(w, h, GLASS_THICK);
    const gm = glassMat.clone();
    const glassMesh = new THREE.Mesh(glassGeo, gm);
    glassMesh.position.set(cx, cy, 0);
    glassMesh.renderOrder = 1;
    group.add(glassMesh);
  }

  function renderInteriorLock(b: ReturnType<typeof getCellBounds>, sashW: number) {
    const stopW = sashW * 0.4;
    const stopD = 0.012;
    const intHwZ = backZ - stopD - 0.004;
    const lockW = Math.max(Math.min(b.w * 0.06, 0.08), 0.035);
    const lockH = Math.max(Math.min(b.h * 0.02, 0.025), 0.012);
    const lockD = 0.006;
    box(b.x, b.bottom + stopW + lockH, intHwZ, lockW, lockH, lockD, hwMat);
  }

  /**
   * Render cam lock hardware on a meeting rail — exact panes.com match.
   * 
   * From the reference image, the hardware consists of:
   *   1. Two cam lock assemblies positioned symmetrically on the rail
   *      - Flat rectangular base plate on the rail
   *      - Pivot cylinder at the center of the base
   *      - HORIZONTAL lever arm extending to one side (crescent/half-moon shape)
   *      - Small handle/grip at the end of the lever
   *   2. Two tilt latch tabs at the far left and right edges of the rail
   *
   * All hardware is chrome/silver metallic.
   */
  function renderCamLocks(cx: number, railY: number, cellW: number, railH: number) {
    const lockZ = frontZ + sashD + 0.003;

    // WhitePVCMetallic — from GLTF model, white metallic finish
    const camMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.9, 0.9, 0.9),
      roughness: 0.35,
      metalness: 0.5,
      envMapIntensity: 0.9,
    });

    // vray_Iron_Clean0 — from GLTF model, darker metal accent
    const leverAccent = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.5, 0.5, 0.5),
      roughness: 0.3,
      metalness: 0.7,
    });

    const lockSpacing = Math.max(cellW * 0.20, 0.12);

    for (const side of [-1, 1]) {
      const lx = cx + side * lockSpacing;

      // ── 1. Base plate — flat rectangle on the rail ──
      const baseW = Math.max(Math.min(cellW * 0.045, 0.048), 0.025);
      const baseH = Math.max(railH * 0.75, 0.012);
      const baseD = 0.004;
      box(lx, railY, lockZ, baseW, baseH, baseD, camMat);

      // ── 2. Pivot cylinder — small raised cylinder at center of base ──
      const pivotR = Math.max(Math.min(baseW * 0.2, 0.008), 0.004);
      const pivotD = 0.005;
      const pivotGeo = new THREE.CylinderGeometry(pivotR, pivotR, pivotD, 10);
      pivotGeo.rotateX(Math.PI / 2);
      const pivotMesh = new THREE.Mesh(pivotGeo, camMat);
      pivotMesh.position.set(lx, railY, lockZ + baseD / 2 + pivotD / 2);
      pivotMesh.castShadow = false;
      group.add(pivotMesh);

      // ── 3. Horizontal lever arm — extends to the SIDE ──
      const leverLen = Math.max(cellW * 0.06, 0.035);
      const leverH2 = Math.max(railH * 0.35, 0.008);
      const leverD2 = 0.004;
      const leverX = lx + side * (leverLen / 2 + pivotR);
      const leverZ = lockZ + baseD / 2 + pivotD + leverD2 / 2;
      box(leverX, railY, leverZ, leverLen, leverH2, leverD2, leverAccent);

      // ── 4. Handle grip — small wider piece at the end of the lever ──
      const gripW2 = Math.max(leverLen * 0.3, 0.012);
      const gripH2 = Math.max(leverH2 * 1.8, 0.014);
      const gripD2 = Math.max(leverD2 * 1.2, 0.004);
      const gripX = lx + side * (leverLen + pivotR);
      box(gripX, railY, leverZ, gripW2, gripH2, gripD2, camMat);
    }

    // ── 5. Tilt latch tabs at the far edges of the meeting rail ──
    const tiltInset = Math.max(cellW * 0.06, 0.04);
    const tiltW = Math.max(Math.min(cellW * 0.03, 0.035), 0.018);
    const tiltH = Math.max(railH * 0.5, 0.012);
    const tiltD = 0.005;
    const tiltZ = lockZ;

    // Left tilt latch
    box(cx - cellW / 2 + tiltInset, railY, tiltZ, tiltW, tiltH, tiltD, camMat);
    // Small tab extending upward from left tilt latch
    box(cx - cellW / 2 + tiltInset, railY + tiltH * 0.6, tiltZ, tiltW * 0.5, tiltH * 0.5, tiltD, leverAccent);

    // Right tilt latch
    box(cx + cellW / 2 - tiltInset, railY, tiltZ, tiltW, tiltH, tiltD, camMat);
    // Small tab extending upward from right tilt latch
    box(cx + cellW / 2 - tiltInset, railY + tiltH * 0.6, tiltZ, tiltW * 0.5, tiltH * 0.5, tiltD, leverAccent);
  }

  /**
   * Render a SOLID BLACK arrow — pure black, zero lighting, no shadows.
   * MeshBasicMaterial is COMPLETELY unaffected by scene lights.
   */
  function renderSolidArrow(cx: number, cy: number, z: number, size: number, direction: 'up' | 'down' | 'left' | 'right') {
    const arrowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    const s = size;
    const headHalfW = s * 0.48;
    const headH = s * 0.48;
    const shaftHalfW = s * 0.16;
    const shaftH = s * 0.55;
    const totalH = headH + shaftH;

    const shape = new THREE.Shape();
    shape.moveTo(-shaftHalfW, -totalH / 2);
    shape.lineTo(shaftHalfW, -totalH / 2);
    shape.lineTo(shaftHalfW, totalH / 2 - headH);
    shape.lineTo(headHalfW, totalH / 2 - headH);
    shape.lineTo(0, totalH / 2);
    shape.lineTo(-headHalfW, totalH / 2 - headH);
    shape.lineTo(-shaftHalfW, totalH / 2 - headH);
    shape.closePath();

    // Thick extrusion so it's solid from every viewing angle
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false });
    const mesh = new THREE.Mesh(geo, arrowMat);

    mesh.position.set(cx, cy, z - 0.006);
    switch (direction) {
      case 'up': break;
      case 'down': mesh.rotation.z = Math.PI; break;
      case 'left': mesh.rotation.z = Math.PI / 2; break;
      case 'right': mesh.rotation.z = -Math.PI / 2; break;
    }

    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 999;
    group.add(mesh);
  }


  /* ═══════════════════════════════════════
     5b. GRILL RENDERING — All patterns
     ═══════════════════════════════════════
     Grills are 3D bars placed on the glass surface.
     They follow the selected pattern, bar type, and size.
  */

  /**
   * Main grill render dispatcher — called per glass pane.
   * cx,cy = center of the glass area
   * gw,gh = width and height of the glass area (inside sash)
   */
  function renderGrills(
    cx: number, cy: number, gw: number, gh: number,
    grillCfg: GrillCellConfig
  ) {
    if (!grillCfg || grillCfg.pattern === 'none' || gw <= 0 || gh <= 0) return;

    // — Bar type detection —
    const isSDL = grillCfg.barType === 'sdl';
    const isPencil = grillCfg.barType === 'pencil';
    const isGeorgian = grillCfg.barType === 'georgian';

    // ── Bar width: primarily driven by barSize, then bar type modifier ──
    // barSize is the key dimension (matching panes.com 5/16", 5/8", 1" sizes)
    const sizeBaseWidths: Record<string, number> = {
      '5/16': 0.004,   // thinnest
      '5/8': 0.008,    // medium
      '1': 0.014,      // thickest (standard)
    };
    let barW = sizeBaseWidths[grillCfg.barSize] || sizeBaseWidths['5/16'];

    // barType modifier — adjusts profile style, not dramatically
    if (isSDL) barW *= 1.4;           // SDL: thickest — simulated divided lite
    else if (isGeorgian) barW *= 1.0; // Georgian: standard profile
    else if (isPencil) barW *= 0.7;   // Pencil: thin rounded
    else barW *= 0.85;                // Flat: slightly thinner than georgian

    // Bar depth scales with bar width for proportional 3D look
    const barD = Math.max(0.003, barW * 0.6);

    // Z positioning: ON the glass surface. Glass is at Z=0.
    // Grills sit just barely above the glass (like real SDL bars).
    const grillZ = 0.002;

    // Glass area bounds
    const glLeft = cx - gw / 2;
    const glRight = cx + gw / 2;
    const glBottom = cy - gh / 2;
    const glTop = cy + gh / 2;

    // Clipping planes — strictly constrain all bars within the glass rectangle
    const clipPlanes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -glLeft),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), glRight),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -glBottom),
      new THREE.Plane(new THREE.Vector3(0, -1, 0), glTop),
    ];

    // Grill material — uses clipping to never exceed glass bounds
    const grillColor = grillCfg.color || new THREE.Color(0.95, 0.95, 0.95);
    const grillMat = new THREE.MeshPhysicalMaterial({
      color: grillColor.clone(),
      roughness: 0.4,
      metalness: 0.05,
      clippingPlanes: clipPlanes,
      clipShadows: true,
      side: THREE.DoubleSide,
    });
    grillMat.userData = { colorRole: 'grill' };
    frameMats.push(grillMat);

    /** Horizontal bar on glass surface. */
    const hBar = (bx: number, by: number, bw: number) => {
      if (isPencil) {
        const r = barW / 2;
        const geo = new THREE.CylinderGeometry(r, r, bw, 8);
        geo.rotateZ(Math.PI / 2);
        const m = new THREE.Mesh(geo, grillMat);
        m.position.set(bx, by, grillZ);
        m.castShadow = false; m.receiveShadow = false;
        group.add(m);
      } else {
        box(bx, by, grillZ, bw, barW, barD, grillMat);
      }
    };

    /** Vertical bar on glass surface. */
    const vBar = (bx: number, by: number, bh: number) => {
      if (isPencil) {
        const r = barW / 2;
        const geo = new THREE.CylinderGeometry(r, r, bh, 8);
        const m = new THREE.Mesh(geo, grillMat);
        m.position.set(bx, by, grillZ);
        m.castShadow = false; m.receiveShadow = false;
        group.add(m);
      } else {
        box(bx, by, grillZ, barW, bh, barD, grillMat);
      }
    };

    switch (grillCfg.pattern) {
      case 'colonial': {
        const vCount = Math.max(1, grillCfg.verticalBars);
        const hCount = Math.max(1, grillCfg.horizontalBars);
        for (let v = 1; v <= vCount; v++) {
          const x = glLeft + (gw / (vCount + 1)) * v;
          vBar(x, cy, gh);
        }
        for (let h = 1; h <= hCount; h++) {
          const y = glBottom + (gh / (hCount + 1)) * h;
          hBar(cx, y, gw);
        }
        break;
      }
      case 'prairie': {
        // Prairie: bars near the edges forming a perimeter rectangle
        const vCount = Math.max(1, grillCfg.verticalBars);
        const hCount = Math.max(1, grillCfg.horizontalBars);
        const edgeFrac = 0.18;
        for (let v = 1; v <= vCount; v++) {
          const frac = v / (vCount + 1);
          vBar(glLeft + gw * frac, cy, gh);
        }
        for (let h = 1; h <= hCount; h++) {
          const yTop = glTop - gh * edgeFrac * h / hCount;
          const yBot = glBottom + gh * edgeFrac * h / hCount;
          hBar(cx, yTop, gw);
          if (hCount <= 2) hBar(cx, yBot, gw);
        }
        break;
      }
      case 'ladder': {
        // Ladder grill: margin bar at 25% from top + verticals in the top section.
        // horizontalBars = total horizontal lines INCLUDING the margin bar.
        //   1 = just the margin bar (default)
        //   2 = margin bar + 1 divider between top and margin
        //   3 = margin bar + 2 dividers, etc.
        const hTotalL = Math.max(1, grillCfg.horizontalBars);
        const vCountL = Math.max(0, grillCfg.verticalBars);
        // Use ladderBarSpacing (inches) to set margin distance from top
        const ladderSpacingIn = grillCfg.ladderBarSpacing ?? 20;
        const cellHInches = opts.heightInches / opts.rows;
        const spacingFrac = cellHInches > 0 ? Math.min(0.80, Math.max(0.10, ladderSpacingIn / cellHInches)) : 0.40;
        const marginY = glTop - gh * spacingFrac;
        const sectionH = glTop - marginY;

        // Draw the margin bar (always)
        hBar(cx, marginY, gw);

        // Extra dividers between top and margin (hTotal - 1 dividers)
        const extraH = hTotalL - 1;
        if (extraH > 0) {
          for (let h = 1; h <= extraH; h++) {
            const y = marginY + (sectionH / (extraH + 1)) * h;
            hBar(cx, y, gw);
          }
        }

        // Vertical bars span from top edge down to the margin bar
        if (vCountL > 0) {
          const topCY = marginY + sectionH / 2;
          for (let v = 1; v <= vCountL; v++) {
            const x = glLeft + (gw / (vCountL + 1)) * v;
            vBar(x, topCY, sectionH);
          }
        }
        break;
      }
      case 'diamond': {
        // Diamond: diagonal lattice using Horizontal Points (H) and Vertical Points (V)
        // H = TOTAL points on horizontal edges INCLUDING corners
        // V = TOTAL points on vertical edges INCLUDING corners
        // So H=4 means 2 corners + 2 interior = 4 points, dividing edge into 3 segments
        const dH = Math.max(2, grillCfg.horizontalBars);
        const dV = Math.max(2, grillCfg.verticalBars);
        const dStepX = gw / (dH - 1);
        const dStepY = gh / (dV - 1);
        const dL = glLeft, dR = glRight, dB = glBottom, dT = glTop;

        // Clip a ray to the glass rectangle, return [x1,y1,x2,y2] or null
        const clipDiag = (x0: number, y0: number, dx: number, dy: number): [number, number, number, number] | null => {
          let tMin = -1e9, tMax = 1e9;
          if (dx !== 0) { const t1 = (dL - x0) / dx, t2 = (dR - x0) / dx; tMin = Math.max(tMin, Math.min(t1, t2)); tMax = Math.min(tMax, Math.max(t1, t2)); }
          else if (x0 < dL || x0 > dR) return null;
          if (dy !== 0) { const t1 = (dB - y0) / dy, t2 = (dT - y0) / dy; tMin = Math.max(tMin, Math.min(t1, t2)); tMax = Math.min(tMax, Math.max(t1, t2)); }
          else if (y0 < dB || y0 > dT) return null;
          if (tMin >= tMax - 1e-9) return null;
          return [x0 + tMin * dx, y0 + tMin * dy, x0 + tMax * dx, y0 + tMax * dy];
        };
        const addDiagBar = (x1: number, y1: number, x2: number, y2: number) => {
          const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
          if (len < barW * 2) return;
          const ang = Math.atan2(y2 - y1, x2 - x1);
          const g = new THREE.BoxGeometry(len, barW, barD);
          g.rotateZ(ang);
          const m = new THREE.Mesh(g, grillMat);
          m.position.set((x1 + x2) / 2, (y1 + y2) / 2, grillZ);
          m.castShadow = false; m.receiveShadow = false;
          group.add(m);
        };

        // / family (bottom-left to top-right): start from bottom edge + left interior
        for (let k = 0; k < dH; k++) {
          const seg = clipDiag(dL + k * dStepX, dB, dStepX, dStepY);
          if (seg) addDiagBar(seg[0], seg[1], seg[2], seg[3]);
        }
        for (let k = 1; k <= dV - 2; k++) {
          const seg = clipDiag(dL, dB + k * dStepY, dStepX, dStepY);
          if (seg) addDiagBar(seg[0], seg[1], seg[2], seg[3]);
        }
        // \ family (top-left to bottom-right): start from top edge + left interior
        for (let k = 0; k < dH; k++) {
          const seg = clipDiag(dL + k * dStepX, dT, dStepX, -dStepY);
          if (seg) addDiagBar(seg[0], seg[1], seg[2], seg[3]);
        }
        for (let k = 1; k <= dV - 2; k++) {
          const seg = clipDiag(dL, dT - k * dStepY, dStepX, -dStepY);
          if (seg) addDiagBar(seg[0], seg[1], seg[2], seg[3]);
        }
        break;
      }
    }
  }


  /* ═════════════════════════════════════
     6. DIMENSION LINES
     ═════════════════════════════════════ */
  const dimMat = new THREE.LineBasicMaterial({ color: 0xbbbbbb, linewidth: 1 });
  const dimZ = frontZ + 0.02;
  const dimOff = 0.12;
  const tickLen = 0.04;

  // Total width (bottom)
  const wy = -hh - dimOff;
  addLine(group, dimMat, [-hw, wy, dimZ], [hw, wy, dimZ]);
  addLine(group, dimMat, [-hw, wy - tickLen, dimZ], [-hw, wy + tickLen, dimZ]);
  addLine(group, dimMat, [hw, wy - tickLen, dimZ], [hw, wy + tickLen, dimZ]);
  addLine(group, dimMat, [-hw, -hh, dimZ], [-hw, wy, dimZ]);
  addLine(group, dimMat, [hw, -hh, dimZ], [hw, wy, dimZ]);
  const wLabel = makeLabel(`${Math.round(totalW)}"`, 0.15);
  wLabel.position.set(0, wy - 0.10, dimZ);
  group.add(wLabel);

  // Per-cell width (bottom row)
  const brc = getRowCols(0);
  if (brc > 1) {
    const cW = getRowCellW(0);
    const cwY = wy + 0.06;
    for (let c = 0; c < brc; c++) {
      const x0 = -hw + cellInset + c * (cW + useMullion);
      const x1 = x0 + cW;
      addLine(group, dimMat, [x0, cwY, dimZ], [x1, cwY, dimZ]);
      addLine(group, dimMat, [x0, cwY - tickLen * 0.5, dimZ], [x0, cwY + tickLen * 0.5, dimZ]);
      addLine(group, dimMat, [x1, cwY - tickLen * 0.5, dimZ], [x1, cwY + tickLen * 0.5, dimZ]);
      const l = makeLabel(`${Math.round(totalW / brc)}"`, 0.10);
      l.position.set((x0 + x1) / 2, cwY + 0.05, dimZ);
      group.add(l);
    }
  }

  // Total height (left)
  const hx = -hw - dimOff;
  addLine(group, dimMat, [hx, -hh, dimZ], [hx, hh, dimZ]);
  addLine(group, dimMat, [hx - tickLen, -hh, dimZ], [hx + tickLen, -hh, dimZ]);
  addLine(group, dimMat, [hx - tickLen, hh, dimZ], [hx + tickLen, hh, dimZ]);
  addLine(group, dimMat, [-hw, -hh, dimZ], [hx, -hh, dimZ]);
  addLine(group, dimMat, [-hw, hh, dimZ], [hx, hh, dimZ]);
  const hLabel = makeLabel(`${Math.round(totalH)}"`, 0.15);
  hLabel.position.set(hx - 0.10, 0, dimZ);
  group.add(hLabel);

  // Per-row height
  if (rows > 1) {
    const rhX = hx + 0.06;
    for (let r = 0; r < rows; r++) {
      const y0 = -hh + cellInset + r * (cellH + useMullion);
      const y1 = y0 + cellH;
      addLine(group, dimMat, [rhX, y0, dimZ], [rhX, y1, dimZ]);
      addLine(group, dimMat, [rhX - tickLen * 0.5, y0, dimZ], [rhX + tickLen * 0.5, y0, dimZ]);
      addLine(group, dimMat, [rhX - tickLen * 0.5, y1, dimZ], [rhX + tickLen * 0.5, y1, dimZ]);
      const l = makeLabel(`${Math.round(totalH / rows)}"`, 0.10);
      l.position.set(rhX - 0.07, (y0 + y1) / 2, dimZ);
      group.add(l);
    }
  }

  /* ═════════════════════════════════════
     7. CENTER
     ═════════════════════════════════════ */
  const bbox = new THREE.Box3().setFromObject(group);
  const center = bbox.getCenter(new THREE.Vector3());
  group.position.sub(center);

  return { group, frameMaterials: frameMats, gltfCellBounds, frameDepth: depth, hardwarePlacements };
}


/* ═══════════════════════════════════════════════
   Utility: Line
   ═══════════════════════════════════════════════ */
function addLine(parent: THREE.Group, mat: THREE.LineBasicMaterial, from: [number, number, number], to: [number, number, number]) {
  const pts = [new THREE.Vector3(...from), new THREE.Vector3(...to)];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  parent.add(new THREE.Line(geo, mat));
}

/* ═══════════════════════════════════════════════
   Utility: Text label sprite — bold, large, centered
   (kept for dimension labels)
   ═══════════════════════════════════════════════ */
function makeLabel(text: string, scale = 0.1): THREE.Sprite {
  const cvs = document.createElement('canvas');
  const ctx = cvs.getContext('2d')!;
  cvs.width = 256;
  cvs.height = 64;
  ctx.clearRect(0, 0, 256, 64);
  ctx.font = '700 40px Inter, Arial, sans-serif';
  ctx.fillStyle = '#555555';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(cvs);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale * 4, scale, 1);
  return sprite;
}

/* ═══════════════════════════════════════════════
   Utility: 3D text label mesh — fixed to window surface
   Unlike sprites, these rotate with the model and
   appear physically attached to the window glass.
   ═══════════════════════════════════════════════ */
function makeLabel3D(text: string, scale = 0.08): THREE.Mesh {
  const cvs = document.createElement('canvas');
  const ctx = cvs.getContext('2d')!;
  cvs.width = 256;
  cvs.height = 80;
  ctx.clearRect(0, 0, 256, 80);

  // Subtle semi-transparent background — panes.com style
  ctx.font = '600 36px Inter, Arial, sans-serif';
  const tw = ctx.measureText(text).width;
  const pad = 14;
  const bgW = tw + pad * 2;
  const bgH = 38;
  const bgX = (256 - bgW) / 2;
  const bgY = (80 - bgH) / 2;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  const r = 6;
  ctx.moveTo(bgX + r, bgY);
  ctx.lineTo(bgX + bgW - r, bgY);
  ctx.quadraticCurveTo(bgX + bgW, bgY, bgX + bgW, bgY + r);
  ctx.lineTo(bgX + bgW, bgY + bgH - r);
  ctx.quadraticCurveTo(bgX + bgW, bgY + bgH, bgX + bgW - r, bgY + bgH);
  ctx.lineTo(bgX + r, bgY + bgH);
  ctx.quadraticCurveTo(bgX, bgY + bgH, bgX, bgY + bgH - r);
  ctx.lineTo(bgX, bgY + r);
  ctx.quadraticCurveTo(bgX, bgY, bgX + r, bgY);
  ctx.closePath();
  ctx.fill();

  // White text — smaller and lighter
  ctx.font = '600 34px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 40);

  const tex = new THREE.CanvasTexture(cvs);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  // PlaneGeometry so the label is a flat 3D object on the surface
  const aspect = 256 / 80;
  const planeW = scale * aspect;
  const planeH = scale;
  const geo = new THREE.PlaneGeometry(planeW, planeH);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.FrontSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 999;
  return mesh;
}


/* ═══════════════════════════════════════════════
   Standalone Grill Builder — used by WindowViewer
   after GLTF components are placed
   ═══════════════════════════════════════════════ */

/**
 * Build a THREE.Group containing grill bars for a single window cell.
 * Positions are in LOCAL space (centered at 0,0,0).
 * 
 * @param cellW - Width of the glass area in scene units
 * @param cellH - Height of the glass area in scene units
 * @param frameDepth - Total frame depth in scene units (for bar depth)
 * @param grillCfg - Grill configuration
 * @returns THREE.Group with all grill bar geometry, plus array of materials
 */
/**
 * Build a THREE.Group containing high-quality grill bars for a single window cell.
 * 
 * PURELY PROCEDURAL — creates ExtrudeGeometry bars with realistic cross-section
 * profiles per bar type:
 *   - Georgian: classic raised muntin with smooth dome profile
 *   - SDL: stepped lip profile (simulated divided lite)
 *   - Flat: rounded rectangle cross-section
 *   - Pencil: circular cross-section (cylinder)
 * 
 * @param glassW  Exact glass area width in scene units (measured from GLTF glass meshes)
 * @param glassH  Exact glass area height in scene units
 * @param grillCfg  Grill config (pattern, barType, barSize, color, counts)
 * @param cellWidthInches  Cell width in inches — for dynamic bar count scaling
 * @param cellHeightInches Cell height in inches — for dynamic bar count scaling
 */
export function buildGrillGroup(
  glassW: number,
  glassH: number,
  grillCfg: GrillCellConfig,
  cellWidthInches?: number,
  cellHeightInches?: number,
): { group: THREE.Group; materials: THREE.MeshPhysicalMaterial[] } {
  const grillGroup = new THREE.Group();
  grillGroup.name = 'grillBars';
  const materials: THREE.MeshPhysicalMaterial[] = [];

  if (!grillCfg || grillCfg.pattern === 'none' || glassW <= 0 || glassH <= 0) {
    return { group: grillGroup, materials };
  }

  /* ── Resolve grill color ── */
  const grillColor = grillCfg.color || new THREE.Color(0.93, 0.93, 0.91);
  const bright = grillColor.r * 0.299 + grillColor.g * 0.587 + grillColor.b * 0.114;
  const isDark = bright < 0.45;

  /* ── Clipping planes removed — bars are correctly sized, clipping was cutting off right/top ── */

  const grillMat = new THREE.MeshPhysicalMaterial({
    color: grillColor.clone(),
    roughness: isDark ? 0.28 : 0.42,
    metalness: isDark ? 0.12 : 0.02,
    envMapIntensity: isDark ? 1.0 : 0.5,
    clearcoat: 0.18,
    clearcoatRoughness: 0.35,
    side: THREE.DoubleSide,
  });
  grillMat.userData = { colorRole: 'grill' };
  materials.push(grillMat);

  /* ── Bar dimensions — driven by barSize + barType ── */
  const minDim = Math.min(glassW, glassH);
  const barType = grillCfg.barType || 'flat';
  const isSDL = barType === 'sdl';
  const isPencil = barType === 'pencil';
  const isGeorgian = barType === 'georgian';

  const sizeFactors: Record<string, number> = {
    '5/16': 0.50,
    '5/8': 0.75,
    '1': 1.0,
  };
  const sizeFactor = sizeFactors[grillCfg.barSize] || sizeFactors['5/16'];

  let barW: number;
  if (isSDL) barW = minDim * 0.045 * sizeFactor;        // SDL — widest, stepped lip profile
  else if (isGeorgian) barW = minDim * 0.038 * sizeFactor; // Georgian — wide, domed muntin
  else if (isPencil) barW = minDim * 0.014 * sizeFactor;   // Pencil — thin round rod
  else barW = minDim * 0.025 * sizeFactor;                 // Flat — medium, rectangular
  barW = Math.max(barW, 0.006); // minimum visible width

  // Depth (Z protrusion) — Georgian gets more depth for the dome to be visible
  let barD: number;
  if (isGeorgian) barD = Math.max(minDim * 0.014, barW * 1.0);
  else barD = Math.max(minDim * 0.010, barW * 0.80);

  /* ── Dynamic bar count — scales with window size ── */
  let vCount = Math.max(1, grillCfg.verticalBars);
  let hCount = Math.max(1, grillCfg.horizontalBars);
  // Auto-scale: only for colonial, NOT for ladder/prairie/diamond (they have their own logic)
  const isLadder = grillCfg.pattern === 'ladder';
  const isPrairie = grillCfg.pattern === 'prairie';
  const isDiamond = grillCfg.pattern === 'diamond';
  if (cellWidthInches && cellHeightInches && !isLadder && !isPrairie && !isDiamond) {
    // Auto: aim for ~10" pane spacing → bars = round(inches/10) - 1
    const autoV = Math.max(1, Math.round(cellWidthInches / 10) - 1);
    const autoH = Math.max(1, Math.round(cellHeightInches / 10) - 1);
    vCount = Math.max(vCount, autoV);
    hCount = Math.max(hCount, autoH);
  }

  /* ═══════════════════════════════════════════
     Cross-section profile — drawn in XY plane
     X = barW (visible bar width, centered)
     Y = barD (depth protruding from glass, 0 to barD)
     ═══════════════════════════════════════════ */
  function barProfile(): THREE.Shape {
    const s = new THREE.Shape();
    const hw = barW / 2;

    if (isGeorgian) {
      // Raised muntin profile: flat base + smooth dome top
      //        ___
      //       / * \
      //      /     \
      //     |       |
      //     |_______|
      s.moveTo(-hw, 0);
      s.lineTo(hw, 0);
      s.lineTo(hw, barD * 0.30);
      s.bezierCurveTo(
        hw * 0.92, barD * 0.75,
        hw * 0.45, barD,
        0, barD
      );
      s.bezierCurveTo(
        -hw * 0.45, barD,
        -hw * 0.92, barD * 0.75,
        -hw, barD * 0.30
      );
      s.closePath();
    } else if (isSDL) {
      // Simulated Divided Lite: stepped lip
      //     _______
      //    |  ___  |
      //    | |   | |
      //    |_|   |_|
      const lip = Math.max(barW * 0.12, 0.0005);
      s.moveTo(-hw, 0);
      s.lineTo(hw, 0);
      s.lineTo(hw, barD * 0.55);
      s.lineTo(hw - lip, barD * 0.60);
      s.lineTo(hw - lip, barD);
      s.lineTo(-hw + lip, barD);
      s.lineTo(-hw + lip, barD * 0.60);
      s.lineTo(-hw, barD * 0.55);
      s.closePath();
    } else {
      // Flat: rounded rectangle cross-section
      const r = Math.min(hw, barD / 2) * 0.25;
      if (r > 0.0001) {
        s.moveTo(-hw + r, 0);
        s.lineTo(hw - r, 0);
        s.quadraticCurveTo(hw, 0, hw, r);
        s.lineTo(hw, barD - r);
        s.quadraticCurveTo(hw, barD, hw - r, barD);
        s.lineTo(-hw + r, barD);
        s.quadraticCurveTo(-hw, barD, -hw, barD - r);
        s.lineTo(-hw, r);
        s.quadraticCurveTo(-hw, 0, -hw + r, 0);
      } else {
        s.moveTo(-hw, 0); s.lineTo(hw, 0);
        s.lineTo(hw, barD); s.lineTo(-hw, barD);
        s.closePath();
      }
    }
    return s;
  }

  /* ═══════════════════════════════════════════
     Create a single bar mesh with profiled cross-section
     ═══════════════════════════════════════════ */
  function makeBar(length: number, orient: 'h' | 'v'): THREE.Mesh {
    let geo: THREE.BufferGeometry;

    if (isPencil) {
      // Round cross-section — CylinderGeometry
      const r = barW / 2;
      geo = new THREE.CylinderGeometry(r, r, length, 8);
      if (orient === 'h') geo.rotateZ(Math.PI / 2);
      // Cylinder is centered at origin
    } else {
      // Profiled extrusion for Georgian, SDL, Flat
      const shape = barProfile();
      geo = new THREE.ExtrudeGeometry(shape, {
        depth: length,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 6,
      });

      // Shape is in XY (barW × barD), extruded along Z (length).
      // Reorient to final world orientation:
      if (orient === 'h') {
        // Target: X=length, Y=barW, Z=barD
        geo.rotateZ(Math.PI / 2);
        geo.rotateY(-Math.PI / 2);
      } else {
        // Target: X=barW, Y=length, Z=barD
        geo.rotateX(-Math.PI / 2);
      }

      // Center XY, base Z at 0 (bar sits ON the glass)
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      geo.translate(
        -(bb.min.x + bb.max.x) / 2,
        -(bb.min.y + bb.max.y) / 2,
        -bb.min.z
      );
      geo.computeVertexNormals();
    }

    const mesh = new THREE.Mesh(geo, grillMat);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  }

  /* ── Place bar helpers ── */
  const zOff = isPencil ? (barW / 2 + 0.001) : 0.001;

  const hBar = (bx: number, by: number, bw: number) => {
    const mesh = makeBar(bw, 'h');
    mesh.position.set(bx, by, zOff);
    grillGroup.add(mesh);
  };

  const vBar = (bx: number, by: number, bh: number) => {
    const mesh = makeBar(bh, 'v');
    mesh.position.set(bx, by, zOff);
    grillGroup.add(mesh);
  };

  /* ── Glass bounds — caller provides exact glass area dimensions ── */
  const gw = glassW;
  const gh = glassH;
  const L = -gw / 2, R = gw / 2, B = -gh / 2, T = gh / 2;

  /* ── Pattern rendering ── */
  switch (grillCfg.pattern) {
    case 'colonial': {
      for (let i = 1; i <= vCount; i++) vBar(L + (gw / (vCount + 1)) * i, 0, gh);
      for (let i = 1; i <= hCount; i++) hBar(0, B + (gh / (hCount + 1)) * i, gw);
      break;
    }
    case 'prairie': {
      const hLayout = grillCfg.prairieHBarLayout || 'top-and-bottom';
      const vLayout = grillCfg.prairieVBarLayout || 'left-and-right';
      const hDaylightInches = grillCfg.prairieHBarDaylight ?? 3.5;
      const vDaylightInches = grillCfg.prairieVBarDaylight ?? 3.5;
      const ladderHead = grillCfg.prairieLadderHead ?? 0;
      const ladderSill = grillCfg.prairieLadderSill ?? 0;
      const ladderLeft = grillCfg.prairieLadderLeft ?? 0;
      const ladderRight = grillCfg.prairieLadderRight ?? 0;
      const hSupportBars = grillCfg.prairieHSupportBars ?? 0;
      const vSupportBars = grillCfg.prairieVSupportBars ?? 0;

      // Convert inches to scene units (proportional to glass dimensions and cell inches)
      const inchToSceneX = cellWidthInches ? (gw / cellWidthInches) : (gw / 50);
      const inchToSceneY = cellHeightInches ? (gh / cellHeightInches) : (gh / 50);
      const hDaylight = hDaylightInches * inchToSceneY;
      const vDaylight = vDaylightInches * inchToSceneX;

      // ── Main horizontal bars ──
      const hBarPositions: number[] = [];
      if (hLayout === 'top-and-bottom') {
        hBarPositions.push(T - hDaylight, B + hDaylight);
      } else if (hLayout === 'top-only') {
        hBarPositions.push(T - hDaylight);
      } else if (hLayout === 'bottom-only') {
        hBarPositions.push(B + hDaylight);
      } else if (hLayout === 'centered') {
        hBarPositions.push(0);
      }
      for (const y of hBarPositions) hBar(0, y, gw);

      // ── Main vertical bars ──
      const vBarPositions: number[] = [];
      if (vLayout === 'left-and-right') {
        vBarPositions.push(L + vDaylight, R - vDaylight);
      } else if (vLayout === 'left-only') {
        vBarPositions.push(L + vDaylight);
      } else if (vLayout === 'right-only') {
        vBarPositions.push(R - vDaylight);
      } else if (vLayout === 'centered') {
        vBarPositions.push(0);
      }
      for (const x of vBarPositions) vBar(x, 0, gh);

      // ── Ladder rungs (short perpendicular bars from main bar to edge) ──
      // Top ladder rungs: short vertical bars from top h-bar up to top edge
      if (hBarPositions.some(y => y > 0) && ladderHead > 0) {
        const topY = Math.max(...hBarPositions.filter(y => y > 0));
        const ladderLen = T - topY;
        if (ladderLen > barW * 2) {
          for (let i = 1; i <= ladderHead; i++) {
            const lx = L + (gw / (ladderHead + 1)) * i;
            vBar(lx, topY + ladderLen / 2, ladderLen);
          }
        }
      }
      // Bottom ladder
      if (hBarPositions.some(y => y < 0) && ladderSill > 0) {
        const botY = Math.min(...hBarPositions.filter(y => y < 0));
        const ladderLen = botY - B;
        if (ladderLen > barW * 2) {
          for (let i = 1; i <= ladderSill; i++) {
            const lx = L + (gw / (ladderSill + 1)) * i;
            vBar(lx, B + ladderLen / 2, ladderLen);
          }
        }
      }
      // Left ladder
      if (vBarPositions.some(x => x < 0) && ladderLeft > 0) {
        const leftX = Math.min(...vBarPositions.filter(x => x < 0));
        const ladderLen = leftX - L;
        if (ladderLen > barW * 2) {
          for (let i = 1; i <= ladderLeft; i++) {
            const ly = B + (gh / (ladderLeft + 1)) * i;
            hBar(L + ladderLen / 2, ly, ladderLen);
          }
        }
      }
      // Right ladder
      if (vBarPositions.some(x => x > 0) && ladderRight > 0) {
        const rightX = Math.max(...vBarPositions.filter(x => x > 0));
        const ladderLen = R - rightX;
        if (ladderLen > barW * 2) {
          for (let i = 1; i <= ladderRight; i++) {
            const ly = B + (gh / (ladderRight + 1)) * i;
            hBar(rightX + ladderLen / 2, ly, ladderLen);
          }
        }
      }

      // ── Support bars (full-span bars through the center) ──
      if (hSupportBars > 0) {
        for (let i = 1; i <= hSupportBars; i++) {
          hBar(0, B + (gh / (hSupportBars + 1)) * i, gw);
        }
      }
      if (vSupportBars > 0) {
        for (let i = 1; i <= vSupportBars; i++) {
          vBar(L + (gw / (vSupportBars + 1)) * i, 0, gh);
        }
      }
      break;
    }
    case 'ladder': {
      // Ladder grill: margin bar at ladderBarSpacing from top + verticals.
      // horizontalBars = total horizontal lines INCLUDING the margin bar.
      //   1 = just the margin bar (default)
      //   2 = margin bar + 1 divider between top and margin
      //   3 = margin bar + 2 dividers, etc.
      const spacingInches = grillCfg.ladderBarSpacing ?? 16;
      const inchToY = cellHeightInches ? (gh / cellHeightInches) : (gh / 50);
      const marginY = T - spacingInches * inchToY;
      const clampedMarginY = Math.max(marginY, B + barW);
      const sectionH = T - clampedMarginY;
      const hTotalL = Math.max(1, hCount);

      if (sectionH > barW) {
        // Draw the margin bar (always)
        hBar(0, clampedMarginY, gw);

        // Extra dividers between top and margin (hTotal - 1 dividers)
        const extraH = hTotalL - 1;
        if (extraH > 0) {
          for (let i = 1; i <= extraH; i++) {
            const y = clampedMarginY + (sectionH / (extraH + 1)) * i;
            hBar(0, y, gw);
          }
        }
      }

      // Vertical bars span from top edge down to the margin bar
      if (sectionH > barW && vCount > 0) {
        const topSectionCY = clampedMarginY + sectionH / 2;
        for (let i = 1; i <= vCount; i++) {
          vBar(L + (gw / (vCount + 1)) * i, topSectionCY, sectionH);
        }
      }
      break;
    }
    case 'diamond': {
      // Diamond: diagonal lattice using Horizontal Points (H) and Vertical Points (V)
      // H = TOTAL points on horizontal edges INCLUDING corners
      // V = TOTAL points on vertical edges INCLUDING corners
      const dH = Math.max(2, grillCfg.horizontalBars);
      const dV = Math.max(2, grillCfg.verticalBars);
      const dStepX = gw / (dH - 1);
      const dStepY = gh / (dV - 1);

      // Clip a ray to the glass rectangle [L,R] x [B,T], return [x1,y1,x2,y2] or null
      const clipDiag2 = (x0: number, y0: number, dx: number, dy: number): [number, number, number, number] | null => {
        let tMin = -1e9, tMax = 1e9;
        if (dx !== 0) { const t1 = (L - x0) / dx, t2 = (R - x0) / dx; tMin = Math.max(tMin, Math.min(t1, t2)); tMax = Math.min(tMax, Math.max(t1, t2)); }
        else if (x0 < L || x0 > R) return null;
        if (dy !== 0) { const t1 = (B - y0) / dy, t2 = (T - y0) / dy; tMin = Math.max(tMin, Math.min(t1, t2)); tMax = Math.min(tMax, Math.max(t1, t2)); }
        else if (y0 < B || y0 > T) return null;
        if (tMin >= tMax - 1e-9) return null;
        return [x0 + tMin * dx, y0 + tMin * dy, x0 + tMax * dx, y0 + tMax * dy];
      };
      const addDiagBar2 = (x1: number, y1: number, x2: number, y2: number) => {
        const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        if (len < barW * 2) return;
        const ang = Math.atan2(y2 - y1, x2 - x1);
        const geo2 = new THREE.BoxGeometry(len, barW, barD);
        geo2.rotateZ(ang);
        const mesh2 = new THREE.Mesh(geo2, grillMat);
        mesh2.position.set((x1 + x2) / 2, (y1 + y2) / 2, zOff);
        mesh2.castShadow = false; mesh2.receiveShadow = false;
        grillGroup.add(mesh2);
      };

      // / family (bottom-left to top-right): start from bottom edge + left interior
      for (let k = 0; k < dH; k++) {
        const seg = clipDiag2(L + k * dStepX, B, dStepX, dStepY);
        if (seg) addDiagBar2(seg[0], seg[1], seg[2], seg[3]);
      }
      for (let k = 1; k <= dV - 2; k++) {
        const seg = clipDiag2(L, B + k * dStepY, dStepX, dStepY);
        if (seg) addDiagBar2(seg[0], seg[1], seg[2], seg[3]);
      }
      // \ family (top-left to bottom-right): start from top edge + left interior
      for (let k = 0; k < dH; k++) {
        const seg = clipDiag2(L + k * dStepX, T, dStepX, -dStepY);
        if (seg) addDiagBar2(seg[0], seg[1], seg[2], seg[3]);
      }
      for (let k = 1; k <= dV - 2; k++) {
        const seg = clipDiag2(L, T - k * dStepY, dStepX, -dStepY);
        if (seg) addDiagBar2(seg[0], seg[1], seg[2], seg[3]);
      }
      break;
    }
    case 'double-prairie': {
      const ix1 = gw * 0.18, ix2 = gw * 0.32, iy1 = gh * 0.18, iy2 = gh * 0.32;
      vBar(L + ix1, 0, gh); vBar(L + ix2, 0, gh); vBar(R - ix1, 0, gh); vBar(R - ix2, 0, gh);
      hBar(0, B + iy1, gw); hBar(0, B + iy2, gw); hBar(0, T - iy1, gw); hBar(0, T - iy2, gw);
      break;
    }
    case 'perimeter': {
      const px = gw * 0.20, py = gh * 0.20;
      hBar(0, B + py, gw); hBar(0, T - py, gw); vBar(L + px, 0, gh); vBar(R - px, 0, gh);
      break;
    }
    case 'double-perimeter': {
      const px1 = gw * 0.15, px2 = gw * 0.30, py1 = gh * 0.15, py2 = gh * 0.30;
      hBar(0, B + py1, gw); hBar(0, B + py2, gw); hBar(0, T - py1, gw); hBar(0, T - py2, gw);
      vBar(L + px1, 0, gh); vBar(L + px2, 0, gh); vBar(R - px1, 0, gh); vBar(R - px2, 0, gh);
      break;
    }
    case 'top-down': {
      const sy = gh * 0.05, topH = T - sy;
      hBar(0, sy, gw);
      for (let i = 1; i <= vCount; i++) vBar(L + (gw / (vCount + 1)) * i, sy + topH / 2, topH);
      break;
    }
    case 'bottom-up': {
      const sy = -gh * 0.05, botH = sy - B;
      hBar(0, sy, gw);
      for (let i = 1; i <= vCount; i++) vBar(L + (gw / (vCount + 1)) * i, B + botH / 2, botH);
      break;
    }
  }

  return { group: grillGroup, materials };
}

