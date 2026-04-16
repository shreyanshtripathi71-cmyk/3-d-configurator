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
 */

import * as THREE from 'three';

/* ═══════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════ */

export type CellType = 'awning' | 'picture' | 'fixed' | 'casement' | 'highfix';

export interface CellDef {
  row: number;
  col: number;
  type: CellType;
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
}

export interface ProceduralWindowResult {
  group: THREE.Group;
  frameMaterials: THREE.MeshStandardMaterial[];
}

/* ═══════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════ */

const FRAME_OUTER = 0.065;
const MULLION_F   = 0.04;
const FRAME_DEPTH = 0.18;
const SASH_DEPTH  = 0.035;
const GLASS_THICK = 0.010;

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

  // Exterior frame material
  const frameMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xdcdcdc),
    roughness: 0.35,
    metalness: 0.0,
    envMapIntensity: 0.7,
  });
  frameMats.push(frameMat);

  // Interior frame material — uses interiorColor if set, else same as exterior
  const intMat = opts.interiorColor
    ? new THREE.MeshStandardMaterial({
        color: opts.interiorColor.clone(),
        roughness: 0.35,
        metalness: 0.0,
        envMapIntensity: 0.7,
      })
    : frameMat;
  if (opts.interiorColor) frameMats.push(intMat);

  const frameEdgeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xc8c8c8),
    roughness: 0.4,
    metalness: 0.0,
  });
  frameMats.push(frameEdgeMat);

  const sashMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xe2e2e2),
    roughness: 0.3,
    metalness: 0.0,
    envMapIntensity: 0.6,
  });
  frameMats.push(sashMat);

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xd4e8f0),
    transparent: true,
    opacity: 0.35,
    roughness: 0.05,
    metalness: 0.0,
    transmission: 0.85,
    ior: 1.52,
    thickness: 0.5,
    envMapIntensity: 1.2,
    side: THREE.DoubleSide,
    depthWrite: false,
    clearcoat: 0.3,
    clearcoatRoughness: 0.1,
  });

  const gasketMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x3a3a3a),
    roughness: 0.8,
    metalness: 0.0,
  });

  const hwMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x2a2a2a),
    roughness: 0.25,
    metalness: 0.6,
  });

  /* ─── Geometry Helper ─── */
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  /**
   * Split bar: creates TWO boxes — front half (exterior) + back half (interior).
   * This is the core of the dual-color frame system.
   */
  const splitBar = (x: number, y: number, w: number, h: number) => {
    // Front half (exterior) — centered at z = +halfD/2
    box(x, y, halfD / 2, w, h, halfD, frameMat);
    // Back half (interior) — centered at z = -halfD/2
    box(x, y, -halfD / 2, w, h, halfD, intMat);
  };

  const hw = W / 2;
  const hh = H / 2;
  const frontZ = depth / 2;
  const backZ = -depth / 2;

  /* ═════════════════════════════════════
     1. OUTER FRAME (4 split bars)
     ═════════════════════════════════════ */
  splitBar(0, hh - frameW / 2, W, frameW);                     // Top
  splitBar(0, -hh + frameW / 2, W, frameW);                    // Bottom
  splitBar(-hw + frameW / 2, 0, frameW, H - 2 * frameW);       // Left
  splitBar(hw - frameW / 2, 0, frameW, H - 2 * frameW);        // Right

  // Front-face edge highlight (exterior)
  const edgeT = 0.008;
  const edgeFZ = frontZ + edgeT / 2;
  box(0, hh - edgeT / 2, edgeFZ, W + edgeT, edgeT, edgeT, frameEdgeMat);
  box(0, -hh + edgeT / 2, edgeFZ, W + edgeT, edgeT, edgeT, frameEdgeMat);
  box(-hw - edgeT / 2, 0, edgeFZ, edgeT, H, edgeT, frameEdgeMat);
  box(hw + edgeT / 2, 0, edgeFZ, edgeT, H, edgeT, frameEdgeMat);

  // Back-face edge highlight (interior color)
  const edgeBZ = backZ - edgeT / 2;
  box(0, hh - edgeT / 2, edgeBZ, W + edgeT, edgeT, edgeT, intMat);
  box(0, -hh + edgeT / 2, edgeBZ, W + edgeT, edgeT, edgeT, intMat);
  box(-hw - edgeT / 2, 0, edgeBZ, edgeT, H, edgeT, intMat);
  box(hw + edgeT / 2, 0, edgeBZ, edgeT, H, edgeT, intMat);

  /* ═════════════════════════════════════
     2. CELL POSITIONS
     ═════════════════════════════════════ */
  const innerW = W - 2 * frameW;
  const innerH = H - 2 * frameW;
  const usableH = innerH - (rows - 1) * mullionW;
  const cellH = usableH / rows;

  const getRowCellW = (row: number) => {
    const rc = getRowCols(row);
    return (innerW - (rc - 1) * mullionW) / rc;
  };

  const getCellBounds = (row: number, col: number) => {
    const cW = getRowCellW(row);
    const y0 = -hh + frameW + row * (cellH + mullionW);
    const y1 = y0 + cellH;
    const x0 = -hw + frameW + col * (cW + mullionW);
    const x1 = x0 + cW;
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: cW, h: cellH, left: x0, right: x1, bottom: y0, top: y1 };
  };

  /* ═════════════════════════════════════
     3. TRANSOMS (horizontal dividers — split bars)
     ═════════════════════════════════════ */
  for (let r = 1; r < rows; r++) {
    const ty = -hh + frameW + r * cellH + (r - 0.5) * mullionW;
    splitBar(0, ty, innerW, mullionW);
  }

  /* ═════════════════════════════════════
     4. MULLIONS (vertical dividers — split bars, per row)
     ═════════════════════════════════════ */
  for (let r = 0; r < rows; r++) {
    const rc = getRowCols(r);
    const cW = getRowCellW(r);
    const rBot = -hh + frameW + r * (cellH + mullionW);
    const rTop = rBot + cellH;
    for (let c = 1; c < rc; c++) {
      const mx = -hw + frameW + c * cW + (c - 0.5) * mullionW;
      splitBar(mx, (rBot + rTop) / 2, mullionW, cellH);
    }
  }

  /* ═════════════════════════════════════
     5. PER-CELL: Sash + Glass + Labels + Indicators + Hardware
     ═════════════════════════════════════ */

  for (const cell of cells) {
    const { row, col, type } = cell;
    const b = getCellBounds(row, col);
    const isAwning = type === 'awning';
    const isCasement = type === 'casement';
    const isOperable = isAwning || isCasement;

    // ── SASH — EXTERIOR (front face, operable cells) ──
    const sashW = Math.max(mullionW * 0.6, 0.03);
    if (isOperable) {
      const sz = frontZ + sashD / 2;
      box(b.x, b.top - sashW / 2, sz, b.w, sashW, sashD, sashMat);
      box(b.x, b.bottom + sashW / 2, sz, b.w, sashW, sashD, sashMat);
      box(b.left + sashW / 2, b.y, sz, sashW, b.h - 2 * sashW, sashD, sashMat);
      box(b.right - sashW / 2, b.y, sz, sashW, b.h - 2 * sashW, sashD, sashMat);

      // Gasket strip
      const gasketT = 0.004;
      const gsInset = sashW;
      box(b.x, b.top - gsInset - gasketT / 2, sz, b.w - 2 * sashW, gasketT, sashD * 0.5, gasketMat);
      box(b.x, b.bottom + gsInset + gasketT / 2, sz, b.w - 2 * sashW, gasketT, sashD * 0.5, gasketMat);
    }

    // ── INTERIOR GLASS STOP (thin trim on back face — uses intMat) ──
    const stopW = sashW * 0.4;
    const stopD = 0.012;
    const stopZ = backZ - stopD / 2;
    box(b.x, b.top - stopW / 2, stopZ, b.w, stopW, stopD, intMat);
    box(b.x, b.bottom + stopW / 2, stopZ, b.w, stopW, stopD, intMat);
    box(b.left + stopW / 2, b.y, stopZ, stopW, b.h - 2 * stopW, stopD, intMat);
    box(b.right - stopW / 2, b.y, stopZ, stopW, b.h - 2 * stopW, stopD, intMat);

    // ── GLASS PANE ──
    const glassInset = isOperable ? sashW + 0.005 : 0.015;
    const gW = b.w - 2 * glassInset;
    const gH = b.h - 2 * glassInset;
    if (gW > 0 && gH > 0) {
      const glassGeo = new THREE.BoxGeometry(gW, gH, GLASS_THICK);
      const gm = glassMat.clone();
      const glassMesh = new THREE.Mesh(glassGeo, gm);
      glassMesh.position.set(b.x, b.y, 0);
      glassMesh.renderOrder = 1;
      group.add(glassMesh);
    }

    // ── OPENING INDICATOR (dashed V-triangle for awning) ──
    if (isAwning) {
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

        const lPts = [new THREE.Vector3(b.x - indW / 2, b.y - indH / 2, indZ), new THREE.Vector3(b.x, b.y + indH / 2, indZ)];
        const lGeo = new THREE.BufferGeometry().setFromPoints(lPts);
        const lLine = new THREE.Line(lGeo, dashMat);
        lLine.computeLineDistances();
        group.add(lLine);

        const rPts = [new THREE.Vector3(b.x + indW / 2, b.y - indH / 2, indZ), new THREE.Vector3(b.x, b.y + indH / 2, indZ)];
        const rGeo = new THREE.BufferGeometry().setFromPoints(rPts);
        const rLine = new THREE.Line(rGeo, dashMat);
        rLine.computeLineDistances();
        group.add(rLine);
      }
    }

    // ── HARDWARE — EXTERIOR ──
    if (isAwning) {
      const hwZ = frontZ + sashD + 0.006;
      const hW = Math.min(b.w * 0.10, 0.15);
      const hH = Math.min(b.h * 0.025, 0.03);
      const hwD = 0.012;

      const crankY = b.bottom + sashW + hH * 1.5;
      box(b.x, crankY, hwZ, hW * 1.5, hH, hwD, hwMat);

      const armLen = hW * 1.2;
      const armR = hH * 0.25;
      const armGeo = new THREE.CylinderGeometry(armR, armR, armLen, 6);
      armGeo.rotateZ(Math.PI / 2);
      const arm = new THREE.Mesh(armGeo, hwMat);
      arm.position.set(b.x + hW * 0.6, crankY, hwZ + 0.003);
      arm.castShadow = true;
      group.add(arm);

      const knobR = armR * 1.5;
      const knobGeo = new THREE.SphereGeometry(knobR, 8, 6);
      const knob = new THREE.Mesh(knobGeo, hwMat);
      knob.position.set(b.x + hW * 0.6 + armLen / 2, crankY, hwZ + 0.003);
      knob.castShadow = true;
      group.add(knob);

      const latchH = Math.min(b.h * 0.04, 0.05);
      const latchW2 = hH * 0.4;
      const latchD = hwD;
      const latchY = b.y - b.h * 0.12;
      box(b.left + sashW * 0.4, latchY, hwZ, latchW2, latchH, latchD, hwMat);
      box(b.right - sashW * 0.4, latchY, hwZ, latchW2, latchH, latchD, hwMat);
    }

    // ── HARDWARE — INTERIOR (small lock on back) ──
    if (isOperable) {
      const intHwZ = backZ - stopD - 0.004;
      const lockW = Math.min(b.w * 0.06, 0.08);
      const lockH = Math.min(b.h * 0.02, 0.025);
      const lockD = 0.006;
      box(b.x, b.bottom + stopW + lockH, intHwZ, lockW, lockH, lockD, hwMat);
    }

    // ── CELL LABEL (W1.1, W2.1, etc.) — prominent, panes.com style ──
    const labelId = `W${row + 1}.${col + 1}`;
    const labelScale = Math.min(b.w, b.h) * 0.18;  // 18% of cell size — large and readable
    const labelSprite = makeLabel(labelId, labelScale);
    labelSprite.position.set(b.x, b.y + b.h * 0.15, frontZ + sashD + 0.015);
    group.add(labelSprite);
  }

  /* ═════════════════════════════════════
     6. DIMENSION LINES
     ═════════════════════════════════════ */
  const dimMat = new THREE.LineBasicMaterial({ color: 0x888888, linewidth: 1 });
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
  const wLabel = makeLabel(`${Math.round(totalW)}"`, 0.1);
  wLabel.position.set(0, wy - 0.08, dimZ);
  group.add(wLabel);

  // Per-cell width (bottom row)
  const brc = getRowCols(0);
  if (brc > 1) {
    const cW = getRowCellW(0);
    const cwY = wy + 0.06;
    for (let c = 0; c < brc; c++) {
      const x0 = -hw + frameW + c * (cW + mullionW);
      const x1 = x0 + cW;
      addLine(group, dimMat, [x0, cwY, dimZ], [x1, cwY, dimZ]);
      addLine(group, dimMat, [x0, cwY - tickLen * 0.5, dimZ], [x0, cwY + tickLen * 0.5, dimZ]);
      addLine(group, dimMat, [x1, cwY - tickLen * 0.5, dimZ], [x1, cwY + tickLen * 0.5, dimZ]);
      const l = makeLabel(`${Math.round(totalW / brc)}"`, 0.07);
      l.position.set((x0 + x1) / 2, cwY + 0.04, dimZ);
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
  const hLabel = makeLabel(`${Math.round(totalH)}"`, 0.1);
  hLabel.position.set(hx - 0.08, 0, dimZ);
  group.add(hLabel);

  // Per-row height
  if (rows > 1) {
    const rhX = hx + 0.06;
    for (let r = 0; r < rows; r++) {
      const y0 = -hh + frameW + r * (cellH + mullionW);
      const y1 = y0 + cellH;
      addLine(group, dimMat, [rhX, y0, dimZ], [rhX, y1, dimZ]);
      addLine(group, dimMat, [rhX - tickLen * 0.5, y0, dimZ], [rhX + tickLen * 0.5, y0, dimZ]);
      addLine(group, dimMat, [rhX - tickLen * 0.5, y1, dimZ], [rhX + tickLen * 0.5, y1, dimZ]);
      const l = makeLabel(`${Math.round(totalH / rows)}"`, 0.07);
      l.position.set(rhX - 0.06, (y0 + y1) / 2, dimZ);
      group.add(l);
    }
  }

  /* ═════════════════════════════════════
     7. CENTER
     ═════════════════════════════════════ */
  const bbox = new THREE.Box3().setFromObject(group);
  const center = bbox.getCenter(new THREE.Vector3());
  group.position.sub(center);

  return { group, frameMaterials: frameMats };
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
