'use client';

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { Colour } from '@/data/windows';
import { HEAVY_MODELS } from '@/data/windows';
import { buildProceduralWindow, buildGrillGroup, type CellType, type GrillCellConfig } from './ProceduralWindow';

/* ─── Types ─── */
export interface ViewerControlsAPI {
  zoomIn: () => void;
  zoomOut: () => void;
  rotateUp: () => void;
  rotateDown: () => void;
  rotateLeft: () => void;
  rotateRight: () => void;
  resetView: () => void;
  isoView: () => void;
  toggleDimensions: () => void;
}

export interface GridCellInfo {
  row: number;
  col: number;
  modelPath: string;
  cellType?: CellType;
  /** Grill configuration for this cell */
  grillPattern?: string;
  grillBarType?: string;
  grillBarSize?: string;
  grillColor?: string;
  grillVertical?: number;
  grillHorizontal?: number;
  // Prairie-specific
  prairieHBarLayout?: string;
  prairieVBarLayout?: string;
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
  ladderBarSpacing?: number;
}

export interface ViewerGridConfig {
  rows: number;
  cols: number;
  cells: GridCellInfo[];
  widthInches?: number;
  heightInches?: number;
  selectedCellId?: string;
  rowColCounts?: number[];
}

interface WindowViewerProps {
  modelPath: string;
  typeId: string;
  colour: Colour;
  interiorColorHex?: string;
  dimensions?: { width: string; height: string };
  onLoaded?: () => void;
  controlsRef?: React.MutableRefObject<ViewerControlsAPI | null>;
  grid?: ViewerGridConfig;
  /** Default camera Z distance — lower = closer/bigger model */
  defaultZoom?: number;
}

export default function WindowViewer({
  modelPath,
  typeId,
  colour,
  interiorColorHex,
  dimensions,
  onLoaded,
  controlsRef,
  grid,
  defaultZoom = 4.8,
}: WindowViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    frameMaterials: THREE.MeshStandardMaterial[];
    currentModel: THREE.Group | null;
    dimGroup: THREE.Group | null;
    animId: number | null;
    needsRender: boolean;
    dampingFrames: number;
    keyLight: THREE.DirectionalLight;
  } | null>(null);
  const loaderRef = useRef<GLTFLoader | null>(null);
  const cacheRef = useRef<Record<string, THREE.Group>>({});
  const grillCacheRef = useRef<Record<string, THREE.Group>>({});
  const colourRef = useRef(colour);
  const dimensionsRef = useRef(dimensions);
  const gridRef = useRef(grid);
  const loadingRef = useRef<HTMLDivElement>(null);
  const loadingTextRef = useRef<HTMLSpanElement>(null);

  colourRef.current = colour;
  dimensionsRef.current = dimensions;
  gridRef.current = grid;

  // Stable key from grid config to trigger reload
  const gridKey = grid
    ? `${grid.rows}x${grid.cols}|${grid.widthInches}x${grid.heightInches}|${grid.cells.map(c => `${c.row},${c.col}:${c.cellType || 'awning'}:${c.grillPattern || 'none'}:${c.grillBarType || 'flat'}:${c.grillBarSize || '11/16'}:${c.grillColor || 'white'}:${c.grillVertical || 1}:${c.grillHorizontal || 1}:${c.prairieHBarLayout || ''}:${c.prairieVBarLayout || ''}:${c.prairieHBarDaylight || 0}:${c.prairieVBarDaylight || 0}:${c.prairieLadderHead || 0}:${c.prairieLadderSill || 0}:${c.prairieLadderLeft || 0}:${c.prairieLadderRight || 0}:${c.prairieHSupportBars || 0}:${c.prairieVSupportBars || 0}:${c.ladderBarSpacing || 16}`).join(';')}`
    : 'none';

  // ═══ Initialize Three.js scene (runs once) ═══
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance', stencil: false, alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;
    renderer.localClippingEnabled = true; // needed for diamond grill clipping
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.shadowMap.autoUpdate = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, 0.3, defaultZoom);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.enablePan = true;
    controls.panSpeed = 0.6;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 1.2;
    controls.minDistance = 0.8;
    controls.maxDistance = 12;
    controls.target.set(0, 0, 0);

    let needsRender = true;
    let dampingFrames = 0;
    const requestRender = () => { needsRender = true; };
    const startDamping = (n = 60) => { dampingFrames = Math.max(dampingFrames, n); requestRender(); };
    controls.addEventListener('change', requestRender);

    // Lights — very soft, flat, high-key (matching panes.com clean look)
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe8e8e8, 0.5);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(2, 6, 5);
    keyLight.castShadow = false;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-4, 4, -2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, 2, -6);
    scene.add(rimLight);

    const bottomFill = new THREE.DirectionalLight(0xf0f0f0, 0.3);
    bottomFill.position.set(0, -3, 2);
    scene.add(bottomFill);

    // Strong front fill for flat, even illumination
    const frontFill = new THREE.DirectionalLight(0xffffff, 0.6);
    frontFill.position.set(0, 0, 10);
    scene.add(frontFill);

    // Shadow ground plane removed — user requested no shadows

    // Environment map
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envScene = new THREE.Scene();
    const skyGeo = new THREE.SphereGeometry(50, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0xe0e5ea) },
        bottomColor: { value: new THREE.Color(0xffffff) },
        offset: { value: 10 },
        exponent: { value: 0.4 },
      },
      vertexShader: `varying vec3 vWorldPosition;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPosition = wp.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
      fragmentShader: `uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }`,
    });
    envScene.add(new THREE.Mesh(skyGeo, skyMat));
    const panelGeo = new THREE.PlaneGeometry(10, 10);
    const bright = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const dim = new THREE.MeshBasicMaterial({ color: 0xd0d0d0, side: THREE.DoubleSide });
    const topP = new THREE.Mesh(panelGeo, bright); topP.position.set(0, 20, 0); topP.rotation.x = Math.PI / 2; envScene.add(topP);
    const sideP = new THREE.Mesh(panelGeo, dim); sideP.position.set(15, 5, 5); sideP.lookAt(0, 0, 0); envScene.add(sideP);
    const backP = new THREE.Mesh(panelGeo, dim); backP.position.set(0, 5, -15); backP.lookAt(0, 0, 0); envScene.add(backP);
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    skyGeo.dispose(); skyMat.dispose(); panelGeo.dispose(); bright.dispose(); dim.dispose();

    // GLTF Loader
    const gltfLoader = new GLTFLoader();
    try {
      const draco = new DRACOLoader();
      draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/libs/draco/gltf/');
      draco.setDecoderConfig({ type: 'js' });
      gltfLoader.setDRACOLoader(draco);
    } catch (e) { console.warn('DRACO loader not available:', e); }
    loaderRef.current = gltfLoader;

    canvas.addEventListener('pointerdown', () => startDamping(60));
    canvas.addEventListener('pointerup', () => startDamping(30));
    canvas.addEventListener('wheel', () => { requestRender(); startDamping(30); }, { passive: true });

    const onResize = () => {
      const wrap = canvas.parentElement;
      if (!wrap) return;
      const w = wrap.clientWidth, h = wrap.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      requestRender();
    };
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedResize = () => { if (resizeTimer) clearTimeout(resizeTimer); resizeTimer = setTimeout(onResize, 80); };
    window.addEventListener('resize', debouncedResize);
    const ro = new ResizeObserver(debouncedResize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    onResize();

    sceneRef.current = {
      renderer, scene, camera, controls, frameMaterials: [],
      currentModel: null, dimGroup: null, animId: null,
      needsRender: true, dampingFrames: 0, keyLight,
    };

    let rafId: number;
    const renderLoop = () => {
      rafId = requestAnimationFrame(renderLoop);
      const s = sceneRef.current;
      if (!s) return;
      if (s.needsRender) { needsRender = true; s.needsRender = false; }
      if (s.dampingFrames > 0) { dampingFrames = Math.max(dampingFrames, s.dampingFrames); s.dampingFrames = 0; }
      if (!needsRender && dampingFrames <= 0 && s.animId === null) return;
      controls.update();
      renderer.render(scene, camera);
      needsRender = false;
      if (dampingFrames > 0) dampingFrames--;
    };
    renderLoop();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', debouncedResize);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      sceneRef.current = null;
    };
  }, []);

  // ═══ Controls API ═══
  useEffect(() => {
    if (!controlsRef || !sceneRef.current) return;
    const s = sceneRef.current;
    const requestRender = () => { s.needsRender = true; };
    const startDamping = (n = 60) => { s.dampingFrames = Math.max(s.dampingFrames, n); requestRender(); };

    const animateTo = (pos: number[], target: number[], dur = 500) => {
      if (s.animId) cancelAnimationFrame(s.animId);
      const sp = s.camera.position.clone();
      const ep = new THREE.Vector3(pos[0], pos[1], pos[2]);
      const st = s.controls.target.clone();
      const et = new THREE.Vector3(target[0], target[1], target[2]);
      const t0 = performance.now();
      const tick = (now: number) => {
        let t = Math.min((now - t0) / dur, 1);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        s.camera.position.lerpVectors(sp, ep, e);
        s.controls.target.lerpVectors(st, et, e);
        s.controls.update(); requestRender();
        if (t < 1) s.animId = requestAnimationFrame(tick);
        else { s.animId = null; startDamping(30); }
      };
      s.animId = requestAnimationFrame(tick);
    };

    const orbitIncrement = (dAz: number, dPol: number) => {
      const sph = new THREE.Spherical().setFromVector3(s.camera.position.clone().sub(s.controls.target));
      sph.theta += dAz;
      sph.phi = Math.max(0.1, Math.min(Math.PI - 0.1, sph.phi + dPol));
      const p = new THREE.Vector3().setFromSpherical(sph).add(s.controls.target);
      animateTo([p.x, p.y, p.z], [s.controls.target.x, s.controls.target.y, s.controls.target.z], 300);
    };

    controlsRef.current = {
      zoomIn: () => { const d = s.camera.position.clone().sub(s.controls.target).normalize(); s.camera.position.addScaledVector(d, -0.5); s.controls.update(); requestRender(); startDamping(30); },
      zoomOut: () => { const d = s.camera.position.clone().sub(s.controls.target).normalize(); s.camera.position.addScaledVector(d, 0.5); s.controls.update(); requestRender(); startDamping(30); },
      rotateUp: () => orbitIncrement(0, -0.25),
      rotateDown: () => orbitIncrement(0, 0.25),
      rotateLeft: () => orbitIncrement(-0.25, 0),
      rotateRight: () => orbitIncrement(0.25, 0),
      resetView: () => animateTo([0, 0.3, defaultZoom], [0, 0, 0]),
      isoView: () => animateTo([2.5, 1.8, 3], [0, 0, 0]),
      toggleDimensions: () => {
        if (!s.currentModel) return;
        // Toggle all Lines, Sprites (dimension labels), and label Meshes
        s.currentModel.traverse((child) => {
          if (child instanceof THREE.Line || child instanceof THREE.Sprite) {
            child.visible = !child.visible;
          }
          // Also toggle 3D label meshes (renderOrder 999)
          if ((child as THREE.Mesh).isMesh && child.renderOrder === 999) {
            child.visible = !child.visible;
          }
        });
        // Also toggle dimGroup if it exists
        if (s.dimGroup) {
          s.dimGroup.visible = !s.dimGroup.visible;
        }
        requestRender();
        startDamping(10);
      },
    };
  }, [controlsRef]);

  // ═══ Load / build model ═══
  useEffect(() => {
    const s = sceneRef.current;
    const loader = loaderRef.current;
    if (!s || !loader) return;

    const isHeavy = HEAVY_MODELS.has(typeId);
    const currentGrid = gridRef.current;
    // Use procedural model when grid is present (any config, including 1×1)
    const useProcedural = !!currentGrid && currentGrid.widthInches && currentGrid.heightInches;

    // Show loading
    if (loadingRef.current) { loadingRef.current.style.opacity = '1'; loadingRef.current.style.pointerEvents = 'auto'; }
    if (loadingTextRef.current) loadingTextRef.current.textContent = 'Building model...';

    // Clear old
    if (s.currentModel) { s.scene.remove(s.currentModel); s.currentModel = null; }
    if (s.dimGroup) { s.scene.remove(s.dimGroup); s.dimGroup = null; }
    s.frameMaterials = [];

    /* ─── Helpers ─── */
    const makeTextSprite = (text: string, fontSize = 28, color = '#777777') => {
      const cvs = document.createElement('canvas');
      const ctx = cvs.getContext('2d')!;
      cvs.width = 192; cvs.height = 64;
      ctx.clearRect(0, 0, 192, 64);
      ctx.font = `600 ${fontSize}px Inter, Arial, sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, 96, 32);
      const tex = new THREE.CanvasTexture(cvs);
      tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.6, 0.2, 1);
      return sprite;
    };

    const dimLineMat = new THREE.LineBasicMaterial({ color: 0x888888, linewidth: 1 });
    const makeLine = (pts: THREE.Vector3[]) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), dimLineMat);

    const addDimLines = (target: THREE.Group, dimGroup: THREE.Group, explicitBounds?: THREE.Box3) => {
      if (!dimensionsRef.current) return;
      // Skinned meshes report their REST-pose bounding box from setFromObject,
      // which won't match the post-skinning silhouette. Allow the caller to
      // pass the true deformed bounds when it knows them.
      const fb = explicitBounds ?? new THREE.Box3().setFromObject(target);
      const mn = fb.min, mx = fb.max;
      const off = 0.15, tk = 0.08;

      const hx = mn.x - off;
      dimGroup.add(makeLine([new THREE.Vector3(hx, mn.y, 0), new THREE.Vector3(hx, mx.y, 0)]));
      dimGroup.add(makeLine([new THREE.Vector3(hx - tk, mx.y, 0), new THREE.Vector3(hx + tk, mx.y, 0)]));
      dimGroup.add(makeLine([new THREE.Vector3(hx - tk, mn.y, 0), new THREE.Vector3(hx + tk, mn.y, 0)]));
      const hL = makeTextSprite(dimensionsRef.current.height);
      hL.position.set(hx - 0.25, (mn.y + mx.y) / 2, 0);
      dimGroup.add(hL);

      const wy = mn.y - off;
      dimGroup.add(makeLine([new THREE.Vector3(mn.x, wy, 0), new THREE.Vector3(mx.x, wy, 0)]));
      dimGroup.add(makeLine([new THREE.Vector3(mn.x, wy - tk, 0), new THREE.Vector3(mn.x, wy + tk, 0)]));
      dimGroup.add(makeLine([new THREE.Vector3(mx.x, wy - tk, 0), new THREE.Vector3(mx.x, wy + tk, 0)]));
      const wL = makeTextSprite(dimensionsRef.current.width);
      wL.position.set((mn.x + mx.x) / 2, wy - 0.2, 0);
      dimGroup.add(wL);
    };

    const finalize = (mats: THREE.MeshStandardMaterial[], zoomDist?: number) => {
      if (isHeavy) { s.keyLight.castShadow = false; s.renderer.shadowMap.enabled = false; }
      else { s.keyLight.castShadow = false; s.renderer.shadowMap.enabled = false; }

      // For procedural windows, colors are already set correctly during construction
      // (exterior + interior split). Only update non-procedural (GLTF) frame materials.
      if (!useProcedural) {
        const c = new THREE.Color(colourRef.current.hex);
        mats.forEach(m => { m.color.copy(c); m.needsUpdate = true; });
      } else {
        // Just trigger updates, don't change colors
        mats.forEach(m => { m.needsUpdate = true; });
      }

      if (!isHeavy) { s.renderer.compile(s.scene, s.camera); s.renderer.shadowMap.needsUpdate = true; }

      if (zoomDist) {
        s.camera.position.set(0, 0.3, zoomDist);
        s.controls.target.set(0, 0, 0);
        s.controls.update();
      }

      s.needsRender = true; s.dampingFrames = 30;
      if (loadingRef.current) { loadingRef.current.style.opacity = '0'; loadingRef.current.style.pointerEvents = 'none'; }
      onLoaded?.();
    };

    /* ═══════════════════════════════════════════
       RIGGED 9-SLICE  (casement / awning / future operable types)
       ═══════════════════════════════════════════
       Each rigged source GLB has 4 corner control bones
       (Ctrl_Down_Left/Right, Ctrl_Top_Left/Right). Frame edge
       vertices are weighted to slide between adjacent corner bones
       (no stretch), so the frame profile thickness stays CONSTANT
       at any window size. Only the glass (centre, bilinear weights)
       actually scales. Handle is anchored to the left frame bones.

       For multi-cell grids, each cell is an independent skinned
       clone. Adjacent cells are placed so their frame edges touch —
       this matches `blender/generate_casement_2h1v.py` where the
       touching frames naturally form the centre mullion.
    */
    // Per-type rigged sources — every rig must share the same 4-bone
    // control armature (Ctrl_Down_Left/Right, Ctrl_Top_Left/Right) and
    // be authored at the same native width (0.7621 m) so the uniform
    // clone-scale math below works uniformly. New types just need an
    // entry here once their *_Rigged_v2.glb is produced by the
    // matching scripts/rig_<type>_v2.py.
    // Cache-bust query string — bump this whenever a *_Rigged_v2.glb is
    // regenerated so browsers refetch instead of serving stale assets.
    const RIG_VERSION = 'v5';
    const withVer = (p: string) => `${p}?${RIG_VERSION}`;

    // Casement now uses the artist-delivered Casement.glb (Maya rig with
    // _JT bone suffixes, mesh authored in inches). Other types keep the
    // procedural *_Rigged_v2.glb rigs (meter-based). Both naming
    // conventions and bind-pose styles are handled below.
    const RIGGED_SOURCE_BY_TYPE: Record<string, string> = {
      casement: '/windows/casement/Casement.glb',
      awning: '/windows/awning/AwningWindow_Rigged_v2.glb',
      picture: '/windows/picture/PictureWindow_Rigged_v2.glb',
      'high-fix': '/windows/high-fix/HighFixWindow_Rigged_v2.glb',
      highfix: '/windows/high-fix/HighFixWindow_Rigged_v2.glb',
      fixed: '/windows/picture/FixedWindow_Rigged_v2.glb',
    };

    // Rigs whose meshes & bones are authored directly in INCHES. For these
    // we skip the meter-based TARGET_FRAME_INCHES rescale and bind bones
    // straight from the rig's inverseBindMatrices (Maya leaves bone
    // local-positions at the origin and encodes the rest pose in IBMs).
    const INCH_BASED_RIG_PATHS = new Set<string>([
      '/windows/casement/Casement.glb',
    ]);
    if (RIGGED_SOURCE_BY_TYPE[typeId] && useProcedural && currentGrid) {
      const baseRigPathRaw = RIGGED_SOURCE_BY_TYPE[typeId];
      const SOURCE_RIGGED = withVer(baseRigPathRaw);
      const isInchBaseRig = INCH_BASED_RIG_PATHS.has(baseRigPathRaw);
      // Upper rows in a vertical stack render as fixed panes. Preferred
      // source is the picture-window rig (purpose-built for fixed panes,
      // slimmer profile). For INCH-based bases (Casement.glb) we reuse
      // the base rig with hardware hidden — the procedural picture rig
      // is meter-based, mixing units would mis-scale the upper cells.
      const PICTURE_RIGGED = withVer('/windows/picture/PictureWindow_Rigged_v2.glb');
      const UPPER_RIGGED = isInchBaseRig ? SOURCE_RIGGED : PICTURE_RIGGED;
      const userW = currentGrid.widthInches!;
      const userH = currentGrid.heightInches!;
      const rows = currentGrid.rows;
      const cols = currentGrid.cols;
      const rowColCounts = currentGrid.rowColCounts;
      const getRowCols = (r: number) => rowColCounts?.[r] ?? cols;

      // Native frame zone fraction for the casement rig (FT_X in
      // scripts/rig_casement_v2.py). Used to derive the uniform clone scale
      // that pins the casement frame profile to TARGET_FRAME_INCHES.
      const NATIVE_FRAME_RATIO_X = 0.12;
      // Equivalent ratio for the artist Maya casement (Casement.glb): the
      // glass starts ~6.83" in from each edge of a 37" rig, so the frame
      // zone is ~18.5% of native width. Hardcoded because IBM-derived
      // glass bounds aren't computed up here and this value is stable
      // for the artist deliverable.
      const INCH_RIG_FRAME_RATIO_X = 0.185;
      // Real-world inch thickness we want the casement frame profile to read as.
      // Constant in inches → varies in scene units only with overall window
      // size (panes.com behaviour: bigger windows have proportionally thinner-
      // looking frames). The picture rig uses the SAME clone scale so its
      // own (thinner) FT_X automatically yields a slimmer frame in scene.
      const TARGET_FRAME_INCHES = 3.0;

      // Build (or reuse) the shared exterior/interior materials so colour
      // updates from the picker propagate to every casement AND picture cell.
      const exteriorColor = new THREE.Color(colourRef.current.hex);
      const extBrightness = exteriorColor.r * 0.299 + exteriorColor.g * 0.587 + exteriorColor.b * 0.114;
      const isDarkExterior = extBrightness < 0.45;
      const interiorCol = interiorColorHex
        ? new THREE.Color(interiorColorHex)
        : new THREE.Color(0.92, 0.92, 0.91);

      const extMat = new THREE.MeshPhysicalMaterial({
        color: exteriorColor.clone(),
        roughness: isDarkExterior ? 0.35 : 0.6,
        metalness: isDarkExterior ? 0.15 : 0.0,
        envMapIntensity: isDarkExterior ? 1.0 : 0.4,
        clearcoat: isDarkExterior ? 0.3 : 0.05,
        clearcoatRoughness: isDarkExterior ? 0.2 : 0.5,
      });
      extMat.userData = { colorRole: 'exterior' };

      const intMat = new THREE.MeshPhysicalMaterial({
        color: interiorCol.clone(),
        roughness: 0.6,
        metalness: 0.0,
        envMapIntensity: 0.4,
        clearcoat: 0.05,
        clearcoatRoughness: 0.5,
      });
      intMat.userData = { colorRole: 'interior' };

      const frameMats: THREE.MeshStandardMaterial[] = [extMat, intMat];

      // ── Material assignment helper ──
      // Two paths:
      //  1. Artist-authored mesh names (Window_Exterior / Window_Interior /
      //     Glass_* / Keeper_* / Washer_* / Between_* / Handle_* / Lock_*).
      //     These come from the high-quality FBX delivery and have the
      //     exterior/interior split + glazing build-up done in Maya.
      //     We just bind the right material slot directly.
      //  2. Generic procedural meshes — fall through to the legacy
      //     face-normal split so older rigs (the procedural picture
      //     window, etc.) still get exterior/interior coloured.
      const applyFrameMaterials = (group: THREE.Group, prepFlag: string) => {
        const flagged = (group as unknown as Record<string, unknown>)[prepFlag];
        if (flagged) return;

        group.traverse(c => {
          const mesh = c as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = false;
          mesh.receiveShadow = false;

          const origMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          const firstMat = origMats[0] as THREE.MeshStandardMaterial | undefined;
          if (!firstMat || !firstMat.color) return;

          const matName = (firstMat.name || '').toLowerCase();
          const meshName = (mesh.name || '').toLowerCase();

          // ── Path 1: artist-authored mesh names ──
          // Direct assignment, no face splitting needed.
          if (meshName === 'window_exterior') {
            mesh.material = extMat;
            return;
          }
          if (meshName === 'window_interior') {
            mesh.material = intMat;
            return;
          }
          if (meshName.startsWith('keeper')) {
            // Glazing bead — reads as interior trim.
            mesh.material = intMat;
            return;
          }
          if (meshName.startsWith('washer') || meshName.startsWith('between')) {
            // Rubber seals / glazing spacers — keep their original dark
            // material so they don't get tinted by the user's frame
            // colour. We tag them as 'trim' so future colour updates
            // know to skip them.
            const trimMat = firstMat.clone();
            trimMat.userData = { colorRole: 'trim' };
            mesh.material = trimMat;
            return;
          }

          // ── Path 2: generic detection (works for both authoring styles) ──
          const isGlass = meshName.startsWith('glass')
            || firstMat.transparent || firstMat.opacity < 0.9
            || matName.includes('glass') || matName.includes('245');
          if (isGlass) {
            const glassMat = firstMat.clone();
            glassMat.transparent = true;
            glassMat.opacity = 0.08;
            glassMat.color.set(0xf8f8f8);
            glassMat.userData = { colorRole: 'glass' };
            mesh.material = glassMat;
            return;
          }

          const isHardware = firstMat.metalness > 0.5
            || matName.includes('handle') || matName.includes('#290')
            || meshName.includes('handle') || meshName.includes('lock');
          if (isHardware) {
            const hwMat = firstMat.clone();
            hwMat.userData = { colorRole: 'hardware' };
            mesh.material = hwMat;
            return;
          }

          // Frame mesh — face-normal split (legacy path for rigs without
          // pre-split exterior/interior meshes).
          const geo = mesh.geometry;
          if (!geo || !geo.index) { mesh.material = extMat; return; }
          const normalAttr = geo.getAttribute('normal');
          if (!normalAttr) { mesh.material = extMat; return; }
          const indexArr = geo.index.array;
          const triCount = indexArr.length / 3;
          mesh.updateMatrixWorld(true);
          const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);

          const extTris: number[] = [];
          const intTris: number[] = [];
          const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
          const fn = new THREE.Vector3();

          for (let t = 0; t < triCount; t++) {
            const i0 = indexArr[t * 3], i1 = indexArr[t * 3 + 1], i2 = indexArr[t * 3 + 2];
            vA.set(normalAttr.getX(i0), normalAttr.getY(i0), normalAttr.getZ(i0));
            vB.set(normalAttr.getX(i1), normalAttr.getY(i1), normalAttr.getZ(i1));
            vC.set(normalAttr.getX(i2), normalAttr.getY(i2), normalAttr.getZ(i2));
            fn.addVectors(vA, vB).add(vC).normalize().applyMatrix3(normalMatrix).normalize();
            if (fn.z < -0.4) intTris.push(t * 3, t * 3 + 1, t * 3 + 2);
            else extTris.push(t * 3, t * 3 + 1, t * 3 + 2);
          }

          if (intTris.length === 0) { mesh.material = extMat; return; }
          if (extTris.length === 0) { mesh.material = intMat; return; }

          const newIdx: number[] = new Array(extTris.length + intTris.length);
          for (let i = 0; i < extTris.length; i++) newIdx[i] = indexArr[extTris[i]];
          for (let i = 0; i < intTris.length; i++) newIdx[extTris.length + i] = indexArr[intTris[i]];

          const newGeo = geo.clone();
          newGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(newIdx), 1));
          newGeo.clearGroups();
          newGeo.addGroup(0, extTris.length, 0);
          newGeo.addGroup(extTris.length, intTris.length, 1);
          mesh.geometry = newGeo;
          mesh.material = [extMat, intMat];
        });

        (group as unknown as Record<string, unknown>)[prepFlag] = true;
      };

      const measureBounds = (group: THREE.Group): THREE.Box3 => {
        const bx = new THREE.Box3();
        group.updateMatrixWorld(true);
        group.traverse(c => { if ((c as THREE.Mesh).isMesh) bx.expandByObject(c); });
        return bx;
      };

      // picSrc may be null when the picture rig failed to load OR when
      // the assembly has no upper rows (single row → no need to even
      // load it). In both cases we transparently fall back to rigSrc
      // for upper-row rendering.
      const buildAssembly = (rigSrc: THREE.Group, picSrc: THREE.Group | null) => {
        applyFrameMaterials(rigSrc, '__rigSrcPrepared');
        if (picSrc) applyFrameMaterials(picSrc, '__pictureRigPrepared');

        // Source bounds for sizing. Both rigged models are exported at the
        // same native scale by the rigging scripts so a single nativeW
        // drives the uniform clone scale.
        const rigBox = measureBounds(rigSrc);
        const rigSize = rigBox.getSize(new THREE.Vector3());
        const nativeRigW = rigSize.x || 0.762;

        // Pre-measure each rig's bone REST positions and mesh corner
        // positions (in armature-local space). The casement rig was
        // exported with its parent-stack translation baked into the bone
        // positions but NOT into the mesh data, so the bones sit far from
        // the mesh corners (e.g. bones at X=-2.06 but mesh corners at
        // X=-0.38). When we move bones to the cell's target corners, we
        // need to keep that bone-vs-corner offset intact, otherwise the
        // mesh ends up shifted by the bone-bind offset (the "casement
        // offset to the right" issue).
        type BindMap = {
          dlBind: THREE.Vector3;
          drBind: THREE.Vector3;
          tlBind: THREE.Vector3;
          trBind: THREE.Vector3;
          meshMin: THREE.Vector3;
          meshMax: THREE.Vector3;
        };
        // Strip the optional Maya-style "_JT" suffix so both naming
        // conventions (Blender procedural rigs use bare names like
        // "Ctrl_Down_Left", the artist Maya casement uses
        // "Ctrl_Down_Left_JT") map to the same logical corner.
        const cleanBoneName = (n: string) => n.replace(/_JT$/, '');

        // Collect IBM-derived rest-world positions per cleaned bone name.
        // Maya rigs leave every bone's local translation at (0,0,0) and
        // bake the bind pose into the inverseBindMatrix, so reading
        // bone.position alone returns 0 and breaks the corner math.
        const collectIbmBinds = (src: THREE.Group): Record<string, THREE.Vector3> => {
          const map: Record<string, THREE.Vector3> = {};
          src.traverse(o => {
            const sm = o as THREE.SkinnedMesh;
            if (!sm.isSkinnedMesh || !sm.skeleton) return;
            const sk = sm.skeleton;
            for (let i = 0; i < sk.bones.length; i++) {
              const cname = cleanBoneName(sk.bones[i].name);
              if (map[cname]) continue;
              const inv = new THREE.Matrix4().copy(sk.boneInverses[i]).invert();
              map[cname] = new THREE.Vector3().setFromMatrixPosition(inv);
            }
          });
          return map;
        };

        // Pick the SHALLOWEST bone with a matching cleaned name. The
        // Maya rig nests duplicate bones (one per skin) deep inside parent
        // chains; we want the chain root so moving it sweeps every nested
        // descendant (and therefore every skin's joint) in lockstep.
        const findShallowestBone = (root: THREE.Object3D, cleanName: string): THREE.Bone | null => {
          let best: THREE.Bone | null = null;
          let bestDepth = Infinity;
          root.traverse(o => {
            const b = o as THREE.Bone;
            if (!b.isBone) return;
            if (cleanBoneName(b.name) !== cleanName) return;
            let depth = 0;
            let p: THREE.Object3D | null = b.parent;
            while (p) { depth++; p = p.parent; }
            if (depth < bestDepth) { best = b; bestDepth = depth; }
          });
          return best;
        };

        const measureBindMap = (src: THREE.Group): BindMap => {
          const bind: BindMap = {
            dlBind: new THREE.Vector3(),
            drBind: new THREE.Vector3(),
            tlBind: new THREE.Vector3(),
            trBind: new THREE.Vector3(),
            meshMin: new THREE.Vector3(Infinity, Infinity, Infinity),
            meshMax: new THREE.Vector3(-Infinity, -Infinity, -Infinity),
          };
          src.updateMatrixWorld(true);

          const ibmBinds = collectIbmBinds(src);

          const cornerSpec: { key: keyof BindMap; clean: string }[] = [
            { key: 'dlBind', clean: 'Ctrl_Down_Left' },
            { key: 'drBind', clean: 'Ctrl_Down_Right' },
            { key: 'tlBind', clean: 'Ctrl_Top_Left' },
            { key: 'trBind', clean: 'Ctrl_Top_Right' },
          ];
          for (const spec of cornerSpec) {
            const b = findShallowestBone(src, spec.clean);
            const target = bind[spec.key] as THREE.Vector3;
            if (b && b.position.lengthSq() > 1e-8) {
              // Procedural Blender rigs: bone.position holds the bind pose.
              target.copy(b.position);
            } else if (ibmBinds[spec.clean]) {
              // Maya rigs (Casement.glb): rest pose lives in the IBM.
              target.copy(ibmBinds[spec.clean]);
            }
          }

          src.traverse(o => {
            const m = o as THREE.Mesh;
            // CRITICAL: only count SKINNED meshes (the actual window
            // parts bound to the rig). Blender's GLTF importer can spawn
            // a stray "Icosphere" placeholder that isn't bound to any
            // bone; including it would blow up the bounds to ±1 and
            // wreck the Z alignment math below.
            const sm = o as THREE.SkinnedMesh;
            if (m.isMesh && m.geometry && sm.isSkinnedMesh) {
              if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
              const bb = m.geometry.boundingBox;
              if (bb) {
                // Use the mesh's transform within the rig root (m.matrixWorld
                // is in src-local space because src sits at world identity
                // when measured) so meshes with non-identity local transforms
                // contribute correct armature-local bounds.
                const tbb = bb.clone().applyMatrix4(m.matrixWorld);
                bind.meshMin.min(tbb.min);
                bind.meshMax.max(tbb.max);
              }
            }
          });
          return bind;
        };
        const rigBind = measureBindMap(rigSrc);
        const picBind = picSrc ? measureBindMap(picSrc) : null;

        // Reuse the base rig's inch/meter classification computed up
        // above (we already used it to pick UPPER_RIGGED).
        const isInchRig = isInchBaseRig;

        // Scene normalisation — matches the procedural builder so units agree
        // with other window types in the same view.
        const maxDimInches = Math.max(userW, userH);
        const S = 3.0 / maxDimInches;
        const W = userW * S;
        const H = userH * S;
        const cellH = H / rows;

        // cloneScale converts rig-local units → scene units. The same
        // formula handles both rig families — the only thing that varies
        // is which frame-ratio constant we feed in:
        //
        //  • Inch-based rigs (Casement.glb): native rig is in inches, frame
        //    zone ≈ 18.5% of rig width.
        //  • Meter-based procedural rigs (*_Rigged_v2.glb): native rig is
        //    in meters, frame zone = 12% of rig width.
        //
        // In both cases (frame_ratio × nativeRigW × cloneScale) ends up
        // equal to TARGET_FRAME_INCHES × S in scene units, so the on-screen
        // frame stays at a CONSTANT real-world thickness regardless of how
        // big the window is — bigger windows therefore look proportionally
        // slimmer-framed (panes.com behaviour).
        const frameRatio = isInchRig ? INCH_RIG_FRAME_RATIO_X : NATIVE_FRAME_RATIO_X;
        const targetFrameScene = TARGET_FRAME_INCHES * S;
        const nativeFrameLocal = frameRatio * nativeRigW;
        const cloneScale = nativeFrameLocal > 1e-6
          ? targetFrameScene / nativeFrameLocal
          : 1;

        const root = new THREE.Group();
        const baseRowIndex = rows - 1;

        const setBoneXY = (bone: THREE.Bone | null, x: number, y: number) => {
          if (!bone) return;
          bone.position.set(x, y, bone.position.z);
        };

        // Shared helper: clone a rigged source, snap its 4 corner bones so
        // the deformed mesh ends up exactly at the requested cell box.
        // Each bone target = (target_corner_armature_local) + (bone_bind -
        // mesh_corner_bind). That offset term cancels out the bind-vs-corner
        // offset baked into the rig (large for the casement, varies for the
        // picture). We also re-anchor the clone in Z so every rig's mesh
        // CENTRE ends up on the same window plane (otherwise the picture
        // rig — whose mesh data sits forward of its bones — pokes out
        // toward the camera while the casement stays back).
        const placeRiggedCell = (
          src: THREE.Group,
          bind: BindMap,
          cellX: number,
          rowYCenter: number,
          cellW: number,
          cellH: number,
          hideHardware: boolean,
          // Optional Z-anchor override. When supplied (typically the
          // base rig's bind-map for a picture-rig upper row), we align
          // this cell so its FRONT face (mesh max Z) sits on the same
          // plane as zAnchorBind's front face — fixes the picture-rig
          // popping forward of a casement base in multi-row stacks.
          zAnchorBind?: BindMap,
          // When true the placed clone is horizontally mirrored. Used
          // for the right pane of a 2-wide casement so its handles/lock
          // end up on the LEFT (interior side meets in the middle) —
          // matches the panes.com schematic where adjacent casement
          // sashes mirror each other.
          mirrorX = false,
        ) => {
          const halfWLocal = cellW / cloneScale / 2;
          const halfHLocal = cellH / cloneScale / 2;

          const mn = bind.meshMin, mx = bind.meshMax;
          const offDL = new THREE.Vector2(bind.dlBind.x - mn.x, bind.dlBind.y - mn.y);
          const offDR = new THREE.Vector2(bind.drBind.x - mx.x, bind.drBind.y - mn.y);
          const offTL = new THREE.Vector2(bind.tlBind.x - mn.x, bind.tlBind.y - mx.y);
          const offTR = new THREE.Vector2(bind.trBind.x - mx.x, bind.trBind.y - mx.y);
          // Z anchoring: by default put this rig's mesh centre on Z=0.
          // When zAnchorBind is provided, push the clone backward so its
          // mesh FRONT face matches zAnchorBind's FRONT face — this is
          // how upper-row picture clones get aligned with the casement
          // base's wall plane (fixes picture-window-pokes-forward).
          let cloneZ: number;
          if (zAnchorBind) {
            const myFrontZ   = mx.z;                                          // front of this rig
            const baseFrontZ = zAnchorBind.meshMax.z;                         // front of base rig
            const baseCenterZ = (zAnchorBind.meshMin.z + zAnchorBind.meshMax.z) / 2;
            const baseZWorld  = -baseCenterZ * cloneScale;                    // where base rig sits
            cloneZ = baseZWorld + (baseFrontZ - myFrontZ) * cloneScale;
          } else {
            const meshCenterZ = (mn.z + mx.z) / 2;
            cloneZ = -meshCenterZ * cloneScale;
          }

          const clone = SkeletonUtils.clone(src);
          // Pick the SHALLOWEST bone matching each corner name (cleaned of
          // the optional "_JT" suffix). For the deeply-nested Maya rig
          // this is the chain root, which propagates the move to every
          // nested duplicate that any individual skin actually binds to.
          const dl = findShallowestBone(clone, 'Ctrl_Down_Left');
          const dr = findShallowestBone(clone, 'Ctrl_Down_Right');
          const tl = findShallowestBone(clone, 'Ctrl_Top_Left');
          const tr = findShallowestBone(clone, 'Ctrl_Top_Right');

          setBoneXY(dl, -halfWLocal + offDL.x, -halfHLocal + offDL.y);
          setBoneXY(dr, +halfWLocal + offDR.x, -halfHLocal + offDR.y);
          setBoneXY(tl, -halfWLocal + offTL.x, +halfHLocal + offTL.y);
          setBoneXY(tr, +halfWLocal + offTR.x, +halfHLocal + offTR.y);

          // Picture-window treatment for non-base rows: hide handle/lock
          // hardware so the cell reads as a fixed window.
          if (hideHardware) {
            clone.traverse(o => {
              const m = o as THREE.Mesh;
              if (!m.isMesh) return;
              const nm = (o.name || '').toLowerCase();
              const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material | undefined;
              const matName = (mat?.name || '').toLowerCase();
              if (nm.includes('handle') || nm.includes('lock') || nm.includes('latch')
                  || matName.includes('handle') || matName.includes('#290')) {
                o.visible = false;
              }
            });
          }

          clone.position.set(cellX, rowYCenter, cloneZ);
          clone.scale.setScalar(cloneScale);
          if (mirrorX) {
            // Negative X scale flips face winding, which would render the
            // mesh inside-out under the default FrontSide cull. Force
            // DoubleSide on every material in this clone so both faces
            // render. We also keep glass alpha untouched (DoubleSide on
            // a transparent material is fine, just costs more fill rate).
            clone.scale.x = -cloneScale;
            clone.traverse(o => {
              const m = o as THREE.Mesh;
              if (!m.isMesh) return;
              const mats = Array.isArray(m.material) ? m.material : [m.material];
              for (const mat of mats) {
                if (mat) (mat as THREE.Material).side = THREE.DoubleSide;
              }
            });
          }
          clone.updateMatrixWorld(true);
          root.add(clone);
        };

        for (let r = 0; r < rows; r++) {
          const rCols = getRowCols(r);
          const cellW = W / rCols;
          const rowYCenter = H / 2 - cellH / 2 - r * cellH;
          const isBaseRow = r === baseRowIndex;
          // Upper rows: prefer the picture rig (purpose-built fixed
          // pane), fall back to the base rig with hardware hidden when
          // picture failed to load. Base row always uses the base rig.
          const usePic = !isBaseRow && picSrc !== null && picBind !== null;
          const cellSrc = usePic ? picSrc! : rigSrc;
          const cellBind = usePic ? picBind! : rigBind;
          // Z-anchor the picture upper-row cells against the base rig
          // so their front faces line up flush with the casement plane.
          const cellZAnchor = usePic ? rigBind : undefined;
          for (let cc = 0; cc < rCols; cc++) {
            const cellX = -W / 2 + cellW / 2 + cc * cellW;
            // Mirror the right pane of a 2-wide casement row so the two
            // sashes hinge on opposite sides and their hardware/locks
            // meet in the middle (matches the panes.com 2H casement
            // schematic). Single-pane and 3+ pane layouts stay
            // un-mirrored — those are typically a fixed centre flanked
            // by a vent on each side, where both vents already point
            // outward by symmetry.
            const mirror = isInchBaseRig && rCols === 2 && cc === 1;
            placeRiggedCell(cellSrc, cellBind, cellX, rowYCenter, cellW, cellH, !isBaseRow, cellZAnchor, mirror);
          }
        }

        // The deformed/scaled cell silhouettes already span (-W/2..+W/2,
        // -H/2..+H/2) thanks to symmetric placement, so no Box3 centring is
        // needed (Box3.setFromObject can't see skinned-mesh deformation).
        const deformedBounds = new THREE.Box3(
          new THREE.Vector3(-W / 2, -H / 2, 0),
          new THREE.Vector3(+W / 2, +H / 2, 0),
        );

        s.frameMaterials = frameMats;
        s.currentModel = root;
        s.scene.add(root);

        const dimGroup = new THREE.Group();
        addDimLines(root, dimGroup, deformedBounds);
        dimGroup.renderOrder = 999;
        s.dimGroup = dimGroup;
        s.scene.add(dimGroup);

        finalize(frameMats);
      };

      // ── Async load the rig source(s), then build ──
      // SOURCE_RIGGED is required (load failure is fatal). UPPER_RIGGED
      // (= the picture rig) is only loaded when the assembly actually
      // has upper rows; its failure falls back to the base rig with
      // hardware hidden, so we treat its load errors as non-fatal.
      const needsUpper = rows > 1 && UPPER_RIGGED !== SOURCE_RIGGED;
      let pending = needsUpper ? 2 : 1;
      let baseScene: THREE.Group | null = null;
      let upperScene: THREE.Group | null = null;
      let baseFailed = false;

      const onAllLoaded = () => {
        if (baseFailed || !baseScene) return;
        buildAssembly(baseScene, upperScene);
      };

      const loadOne = (path: string, optional: boolean,
                      onScene: (g: THREE.Group) => void) => {
        if (cacheRef.current[path]) {
          onScene(cacheRef.current[path]);
          pending--;
          if (pending === 0) onAllLoaded();
          return;
        }
        loader.load(
          path,
          (gltf) => {
            cacheRef.current[path] = gltf.scene;
            onScene(gltf.scene);
            pending--;
            if (pending === 0) onAllLoaded();
          },
          (xhr) => {
            if (xhr.total && loadingTextRef.current) {
              loadingTextRef.current.textContent = 'Loading... ' + Math.round((xhr.loaded / xhr.total) * 100) + '%';
            }
          },
          (err) => {
            if (optional) {
              console.warn(`Optional rigged source failed (${path}), falling back:`, err);
              pending--;
              if (pending === 0) onAllLoaded();
              return;
            }
            baseFailed = true;
            console.error(`Rigged-window assembly load failed (${path}):`, err);
            if (loadingTextRef.current) loadingTextRef.current.textContent = 'Error loading model';
            setTimeout(() => {
              if (loadingRef.current) {
                loadingRef.current.style.opacity = '0';
                loadingRef.current.style.pointerEvents = 'none';
              }
            }, 2000);
          },
        );
      };

      loadOne(SOURCE_RIGGED, false, (g) => { baseScene = g; });
      if (needsUpper) {
        loadOne(UPPER_RIGGED, true, (g) => { upperScene = g; });
      }
      return;
    }

    /* ═══════════════════════════════════════════
       PROCEDURAL MODEL (grid-aware, high quality)
       ═══════════════════════════════════════════ */
    if (useProcedural && currentGrid) {
      const frameCol = new THREE.Color(colourRef.current.hex);

      // Map grid cells to procedural cell definitions (with grill config)
      const frameCol3 = new THREE.Color(colourRef.current.hex);
      const intCol3 = interiorColorHex ? new THREE.Color(interiorColorHex) : new THREE.Color(0.95, 0.95, 0.95);
      const proceduralCells = currentGrid.cells.map(c => {
        // Resolve grill color
        let grillColorResolved: THREE.Color | undefined;
        if (c.grillColor === 'brass') grillColorResolved = new THREE.Color(0.76, 0.63, 0.21);
        else if (c.grillColor === 'pewter') grillColorResolved = new THREE.Color(0.6, 0.6, 0.58);
        else if (c.grillColor === 'black') grillColorResolved = new THREE.Color(0.12, 0.12, 0.12);
        else grillColorResolved = frameCol3.clone(); // white = match frame color

        const grill: GrillCellConfig | undefined = (c.grillPattern && c.grillPattern !== 'none') ? {
          pattern: c.grillPattern,
          barType: c.grillBarType || 'georgian',
          barSize: c.grillBarSize || '1',
          color: grillColorResolved,
          verticalBars: c.grillVertical || 1,
          horizontalBars: c.grillHorizontal || 1,
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
        } : undefined;

        return {
          row: c.row,
          col: c.col,
          type: (c.cellType || 'awning') as CellType,
          grill,
        };
      });

      // ALL window types use GLTF models
      const baseGltfTypes = ['single-hung', 'double-hung', 'single-slider', 'double-slider', 'end-vent', 'awning', 'casement'];
      const gltfTypes = [...baseGltfTypes, 'picture', 'fixed', 'high-fix', 'highfix'];

      const { group: windowGroup, frameMaterials, gltfCellBounds } = buildProceduralWindow({
        widthInches: currentGrid.widthInches!,
        heightInches: currentGrid.heightInches!,
        rows: currentGrid.rows,
        cols: currentGrid.cols,
        cells: proceduralCells,
        rowColCounts: currentGrid.rowColCounts,
        frameColor: frameCol,
        interiorColor: interiorColorHex ? new THREE.Color(interiorColorHex) : undefined,
        gltfCellTypes: gltfTypes as CellType[],
      });

      s.frameMaterials = frameMaterials;
      s.currentModel = windowGroup;
      s.scene.add(windowGroup);

      // ── Component Assembly: load GLTF parts into each cell ──
      // Map each cell type to its component directory and files
      const COMP_MAP: Record<string, { base: string; files: string[] }> = {
        'single-hung': {
          base: '/windows/single-hung/components/',
          files: ['frame.glb', 'sash_or_other.glb', 'meeting_rail.glb', 'hardware.glb', 'glass.glb'],
        },
        'double-hung': {
          base: '/windows/double-hung/components/',
          files: ['sash_or_other.glb', 'meeting_rail.glb', 'hardware.glb', 'glass.glb'],
        },
        'single-slider': {
          base: '/windows/single-slider/components/',
          files: ['sash_or_other.glb', 'meeting_rail_vertical.glb', 'glass.glb'],
        },
        'double-slider': {
          base: '/windows/double-slider/components/',
          files: ['sash_or_other.glb', 'meeting_rail_vertical.glb', 'hardware.glb', 'glass.glb'],
        },
        'end-vent': {
          base: '/windows/end-vent/components/',
          files: ['sash_or_other.glb', 'glass.glb'],
        },
        'awning': {
          base: '/windows/awning/',
          files: ['AwningWindow.glb'],
        },
        'casement': {
          base: '/windows/casement/',
          files: ['CasementWindow.gltf'],
        },
        'picture': {
          base: '/windows/picture/',
          files: ['PictureWindow_Model_1.gltf'],
        },
        'high-fix': {
          base: '/windows/high-fix/',
          files: ['HighFixWindow_DoubleGlazing.gltf'],
        },
        'highfix': {
          base: '/windows/high-fix/',
          files: ['HighFixWindow_DoubleGlazing.gltf'],
        },
        'fixed': {
          base: '/windows/picture/',
          files: ['PictureWindow_Model_1.gltf'],
        },
      };

      if (gltfCellBounds.length > 0) {
        // Group cells by type so we load components once per type
        const cellsByType: Record<string, typeof gltfCellBounds> = {};
        for (const cb of gltfCellBounds) {
          const t = cb.type;
          if (!cellsByType[t]) cellsByType[t] = [];
          cellsByType[t].push(cb);
        }

        for (const [cellType, cells] of Object.entries(cellsByType)) {
          const config = COMP_MAP[cellType];
          if (!config) continue; // No components for this type, skip

          let loadedCount = 0;
          const componentScenes: Record<string, THREE.Group> = {};

          const assembleForType = () => {
            if (loadedCount < config.files.length) return;

            // Exterior color from user selection (visible from front/default view)
            const exteriorColor = new THREE.Color(colourRef.current.hex);
            const exteriorColorDark = exteriorColor.clone().multiplyScalar(0.88);
            // Detect dark exterior for rich material treatment
            const extBrightness = exteriorColor.r * 0.299 + exteriorColor.g * 0.587 + exteriorColor.b * 0.114;
            const isDarkExterior = extBrightness < 0.45;

            // Interior color (visible from back/inside view)
            const intColorHex = interiorColorHex || '#dcdcdc';
            const interiorCol = new THREE.Color(intColorHex);
            const interiorColDark = interiorCol.clone().multiplyScalar(0.88);
            const intBrightness = interiorCol.r * 0.299 + interiorCol.g * 0.587 + interiorCol.b * 0.114;
            const isDarkInterior = intBrightness < 0.45;

            // Merge all loaded components into one reference group
            const refGroup = new THREE.Group();
            for (const name of config.files) {
              const scene = componentScenes[name];
              if (scene) {
                const cloned = scene.clone(true);

                // ── Face-normal-based exterior/interior split ──
                // Reference (panes.com): front face + all side edges = exterior color
                // Only the back face (-Z normals) = interior color
                // This creates the correct two-tone appearance visible when rotating the window

                // Create materials for exterior and interior
                const extFrameMat = new THREE.MeshPhysicalMaterial({
                  color: exteriorColor.clone(),
                  roughness: isDarkExterior ? 0.35 : 0.6,
                  metalness: isDarkExterior ? 0.15 : 0.0,
                  envMapIntensity: isDarkExterior ? 1.0 : 0.4,
                  clearcoat: isDarkExterior ? 0.3 : 0.05,
                  clearcoatRoughness: isDarkExterior ? 0.2 : 0.5,
                });
                extFrameMat.userData = { colorRole: 'exterior' };

                const intFrameMat = new THREE.MeshPhysicalMaterial({
                  color: interiorCol.clone(),
                  roughness: isDarkInterior ? 0.35 : 0.6,
                  metalness: isDarkInterior ? 0.15 : 0.0,
                  envMapIntensity: isDarkInterior ? 1.0 : 0.4,
                  clearcoat: isDarkInterior ? 0.3 : 0.05,
                  clearcoatRoughness: isDarkInterior ? 0.2 : 0.5,
                });
                intFrameMat.userData = { colorRole: 'interior' };

                const extFrameMatDark = new THREE.MeshPhysicalMaterial({
                  color: exteriorColorDark.clone(),
                  roughness: isDarkExterior ? 0.4 : 0.7,
                  metalness: isDarkExterior ? 0.1 : 0.0,
                  envMapIntensity: isDarkExterior ? 0.8 : 0.3,
                });
                extFrameMatDark.userData = { colorRole: 'exterior' };

                const intFrameMatDark = new THREE.MeshPhysicalMaterial({
                  color: interiorColDark.clone(),
                  roughness: isDarkInterior ? 0.4 : 0.7,
                  metalness: isDarkInterior ? 0.1 : 0.0,
                  envMapIntensity: isDarkInterior ? 0.8 : 0.3,
                });
                intFrameMatDark.userData = { colorRole: 'interior' };

                // Compute model bounding box for Z-center reference
                const modelBox = new THREE.Box3().setFromObject(cloned);
                const modelCenter = modelBox.getCenter(new THREE.Vector3());

                // Threshold: only strongly back-facing faces = interior color
                // -0.4 ensures side faces stay exterior colored (like panes.com reference)
                const BACK_NORMAL_THRESHOLD = -0.4;

                const meshesToReplace: { parent: THREE.Object3D; oldMesh: THREE.Mesh; newMeshes: THREE.Mesh[] }[] = [];

                cloned.traverse(c => {
                  if (!(c as THREE.Mesh).isMesh) return;
                  const mesh = c as THREE.Mesh;
                  mesh.castShadow = false;
                  mesh.receiveShadow = false;

                  // Get original material(s)
                  const origMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                  const firstMat = origMats[0] as THREE.MeshStandardMaterial;
                  if (!firstMat || !firstMat.color) return;

                  // Check if it's glass (transparent material)
                  const isGlass = firstMat.transparent || firstMat.opacity < 0.9 ||
                    (firstMat.name && (firstMat.name.toLowerCase().includes('glass') || firstMat.name.includes('245')));

                  // Check if it's hardware/metallic
                  const matName = (firstMat.name || '').toLowerCase();
                  const meshNameLower = (mesh.name || '').toLowerCase();
                  const isHardware = firstMat.metalness > 0.5 || matName.includes('handle') ||
                    matName.includes('lock') || matName.includes('iron') || matName.includes('metal') ||
                    matName.includes('hardware') || matName.includes('#290') ||
                    meshNameLower.includes('handle') || meshNameLower.includes('hardware');

                  if (isGlass) {
                    // Glass: make transparent
                    for (let i = 0; i < origMats.length; i++) {
                      const clonedMat = (origMats[i] as THREE.MeshStandardMaterial).clone();
                      clonedMat.transparent = true;
                      clonedMat.opacity = 0.08;
                      clonedMat.color.set(0xf8f8f8);
                      clonedMat.userData = { ...clonedMat.userData, colorRole: 'glass' };
                      if (Array.isArray(mesh.material)) mesh.material[i] = clonedMat;
                      else mesh.material = clonedMat;
                    }
                    return;
                  }

                  if (isHardware) {
                    // Hardware: keep original appearance
                    for (let i = 0; i < origMats.length; i++) {
                      const clonedMat = (origMats[i] as THREE.MeshStandardMaterial).clone();
                      clonedMat.userData = { ...clonedMat.userData, colorRole: 'hardware' };
                      if (Array.isArray(mesh.material)) mesh.material[i] = clonedMat;
                      else mesh.material = clonedMat;
                    }
                    return;
                  }

                  // ── FRAME MESH: Split geometry by face normal direction ──
                  // Front + sides → exterior color, back → interior color
                  const geo = mesh.geometry;
                  if (!geo || !geo.index) {
                    // Non-indexed geometry or missing: fall back to position-based split
                    const meshBox = new THREE.Box3().setFromObject(mesh);
                    const meshCenterZ = (meshBox.min.z + meshBox.max.z) / 2;
                    const isBack = meshCenterZ < modelCenter.z;
                    const origBrightness = firstMat.color.r * 0.299 + firstMat.color.g * 0.587 + firstMat.color.b * 0.114;
                    const targetMat = isBack
                      ? (origBrightness < 0.3 ? intFrameMatDark : intFrameMat)
                      : (origBrightness < 0.3 ? extFrameMatDark : extFrameMat);
                    mesh.material = targetMat.clone();
                    return;
                  }

                  // For indexed geometry: classify each triangle by its face normal Z component
                  const posAttr = geo.getAttribute('position');
                  const normalAttr = geo.getAttribute('normal');
                  const indexArr = geo.index.array;
                  const triCount = indexArr.length / 3;

                  // We need world-space normals, so apply mesh's world matrix to normals
                  mesh.updateMatrixWorld(true);
                  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);

                  const exteriorTriIndices: number[] = [];
                  const interiorTriIndices: number[] = [];

                  const vA = new THREE.Vector3();
                  const vB = new THREE.Vector3();
                  const vC = new THREE.Vector3();
                  const faceNormal = new THREE.Vector3();

                  for (let t = 0; t < triCount; t++) {
                    const i0 = indexArr[t * 3];
                    const i1 = indexArr[t * 3 + 1];
                    const i2 = indexArr[t * 3 + 2];

                    if (normalAttr) {
                      // Average vertex normals for face normal
                      vA.set(normalAttr.getX(i0), normalAttr.getY(i0), normalAttr.getZ(i0));
                      vB.set(normalAttr.getX(i1), normalAttr.getY(i1), normalAttr.getZ(i1));
                      vC.set(normalAttr.getX(i2), normalAttr.getY(i2), normalAttr.getZ(i2));
                      faceNormal.addVectors(vA, vB).add(vC).normalize();
                    } else {
                      // Compute face normal from positions
                      vA.set(posAttr.getX(i0), posAttr.getY(i0), posAttr.getZ(i0));
                      vB.set(posAttr.getX(i1), posAttr.getY(i1), posAttr.getZ(i1));
                      vC.set(posAttr.getX(i2), posAttr.getY(i2), posAttr.getZ(i2));
                      const edge1 = new THREE.Vector3().subVectors(vB, vA);
                      const edge2 = new THREE.Vector3().subVectors(vC, vA);
                      faceNormal.crossVectors(edge1, edge2).normalize();
                    }

                    // Transform normal to world space
                    faceNormal.applyMatrix3(normalMatrix).normalize();

                    // Classify by face normal direction: 
                    // Front face + all sides = EXTERIOR color
                    // Only strongly back-facing faces = INTERIOR color
                    // Threshold -0.4: side faces with slight backward tilt stay exterior
                    if (faceNormal.z < BACK_NORMAL_THRESHOLD) {
                      interiorTriIndices.push(t * 3, t * 3 + 1, t * 3 + 2);
                    } else {
                      exteriorTriIndices.push(t * 3, t * 3 + 1, t * 3 + 2);
                    }
                  }

                  // If all faces are one side, just set the material directly
                  if (interiorTriIndices.length === 0) {
                    const origBrightness = firstMat.color.r * 0.299 + firstMat.color.g * 0.587 + firstMat.color.b * 0.114;
                    mesh.material = (origBrightness < 0.3 ? extFrameMatDark : extFrameMat).clone();
                    return;
                  }
                  if (exteriorTriIndices.length === 0) {
                    const origBrightness = firstMat.color.r * 0.299 + firstMat.color.g * 0.587 + firstMat.color.b * 0.114;
                    mesh.material = (origBrightness < 0.3 ? intFrameMatDark : intFrameMat).clone();
                    return;
                  }

                  // Build new index buffer with two material groups
                  const newIndices: number[] = [];
                  // Group 0: exterior faces
                  const extStart = 0;
                  for (const idx of exteriorTriIndices) {
                    newIndices.push(indexArr[idx]);
                  }
                  const extCount = exteriorTriIndices.length;
                  // Group 1: interior faces
                  const intStart = newIndices.length;
                  for (const idx of interiorTriIndices) {
                    newIndices.push(indexArr[idx]);
                  }
                  const intCount = interiorTriIndices.length;

                  // Clone geometry and set new index + groups
                  const newGeo = geo.clone();
                  newGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(newIndices), 1));
                  newGeo.clearGroups();
                  newGeo.addGroup(extStart, extCount, 0);
                  newGeo.addGroup(intStart, intCount, 1);

                  // Determine which variant to use based on original brightness
                  const origBrightness = firstMat.color.r * 0.299 + firstMat.color.g * 0.587 + firstMat.color.b * 0.114;
                  const useExtMat = origBrightness < 0.3 ? extFrameMatDark.clone() : extFrameMat.clone();
                  const useIntMat = origBrightness < 0.3 ? intFrameMatDark.clone() : intFrameMat.clone();

                  mesh.geometry = newGeo;
                  mesh.material = [useExtMat, useIntMat];
                });
                refGroup.add(cloned);
              }
            }

            const refBox = new THREE.Box3().setFromObject(refGroup);
            const refSize = refBox.getSize(new THREE.Vector3());
            const refCenter = refBox.getCenter(new THREE.Vector3());

            // Compute fixed Z-scale from full window size
            const maxDim = Math.max(currentGrid.widthInches!, currentGrid.heightInches!);
            const normS = 3.0 / maxDim;
            const totalSceneW = currentGrid.widthInches! * normS;
            const totalSceneH = currentGrid.heightInches! * normS;
            const fixedZScale = Math.min(totalSceneW / refSize.x, totalSceneH / refSize.y);

            // Types that need handle separation (hide handle, add fixed-scale one)
            const handleSepTypes = new Set(['casement', 'awning']);
            const needsHandleSep = handleSepTypes.has(cellType);

            // If handle separation needed, extract the handle mesh from refGroup
            let handleRefMesh: THREE.Mesh | null = null;
            let handleLocalBox: THREE.Box3 | null = null;
            if (needsHandleSep) {
              refGroup.traverse(c => {
                if (!(c as THREE.Mesh).isMesh) return;
                const nm = (c.name || '').toLowerCase();
                if (nm.includes('handle') || nm.includes('lock') || nm.includes('latch')) {
                  handleRefMesh = c as THREE.Mesh;
                }
              });
              if (handleRefMesh) {
                handleLocalBox = new THREE.Box3().setFromObject(handleRefMesh!);
              }
            }

            // Place a clone in each cell of this type
            for (const cb of cells) {
              const cellGroup = refGroup.clone(true);
              cellGroup.position.set(-refCenter.x, -refCenter.y, -refCenter.z);

              const scaleX = cb.w / refSize.x;
              const scaleY = cb.h / refSize.y;

              // Hide handle meshes from the scaled group (will add separately)
              if (needsHandleSep) {
                cellGroup.traverse(c => {
                  if (!(c as THREE.Mesh).isMesh) return;
                  const nm = (c.name || '').toLowerCase();
                  if (nm.includes('handle') || nm.includes('lock') || nm.includes('latch')) {
                    c.visible = false;
                  }
                });
              }

              const pivot = new THREE.Group();
              pivot.add(cellGroup);
              pivot.scale.set(scaleX, scaleY, fixedZScale);
              pivot.position.set(cb.x, cb.y, 0);
              windowGroup.add(pivot);

              // Add a FIXED-SCALE handle for casement/awning
              if (needsHandleSep && handleRefMesh && handleLocalBox) {
                const handleClone = (handleRefMesh as THREE.Mesh).clone(true);
                // Position handle relative to this cell
                const handleCenter = handleLocalBox.getCenter(new THREE.Vector3());
                // Normalize handle position within model bounds [0,1]
                const normHX = (handleCenter.x - refBox.min.x) / refSize.x;
                const normHY = (handleCenter.y - refBox.min.y) / refSize.y;
                // Map to cell position in scene space
                const handleX = cb.x - cb.w / 2 + normHX * cb.w;
                const handleY = cb.y - cb.h / 2 + normHY * cb.h;

                const handlePivot = new THREE.Group();
                handleClone.position.set(
                  -(handleCenter.x),
                  -(handleCenter.y),
                  -(handleCenter.z)
                );
                handlePivot.add(handleClone);
                // Use UNIFORM scale (fixedZScale) so handle keeps proportions
                handlePivot.scale.setScalar(fixedZScale);
                handlePivot.position.set(handleX, handleY, 0);
                windowGroup.add(handlePivot);
              }

              // ── Grills: find EXACT glass position from the placed GLTF model ──
              const matchingCell = proceduralCells.find(pc => pc.row === cb.row && pc.col === cb.col);
              if (matchingCell?.grill && matchingCell.grill.pattern !== 'none') {
                // Force matrix computation so world-space bounds are accurate
                pivot.updateMatrixWorld(true);

                // Find glass meshes by their tagged colorRole
                const pivotGlassBox = new THREE.Box3();
                let pivotHasGlass = false;
                pivot.traverse((child: THREE.Object3D) => {
                  if (!(child as THREE.Mesh).isMesh) return;
                  const mesh = child as THREE.Mesh;
                  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                  if (mats.some(m => (m as any).userData?.colorRole === 'glass')) {
                    pivotGlassBox.expandByObject(mesh);
                    pivotHasGlass = true;
                  }
                });

                // Glass dimensions in world space
                let grillW: number, grillH: number, grillCX: number, grillCY: number, grillZ: number;
                if (pivotHasGlass && !pivotGlassBox.isEmpty()) {
                  const gc = pivotGlassBox.getCenter(new THREE.Vector3());
                  // Use cell bounds — sized to inner sash opening (~84% width, ~93% height)
                  grillW = cb.w * 0.84;
                  grillH = cb.h * 0.93;
                  grillCX = cb.x;
                  grillCY = cb.y;
                  // Recess grills INTO the frame — sit at glass center depth
                  grillZ = gc.z;
                } else {
                  // Fallback: 90% of cell, centered
                  grillW = cb.w * 0.90;
                  grillH = cb.h * 0.90;
                  grillCX = cb.x;
                  grillCY = cb.y;
                  grillZ = 0;
                }

                const cellWInches = currentGrid!.widthInches! / currentGrid!.cols;
                const cellHInches = currentGrid!.heightInches! / currentGrid!.rows;

                const { group: grillGrp, materials: grillMats } = buildGrillGroup(
                  grillW, grillH,
                  matchingCell.grill!,
                  cellWInches, cellHInches
                );
                grillGrp.position.set(grillCX, grillCY, grillZ);
                windowGroup.add(grillGrp);
                s.frameMaterials.push(...grillMats);
              }
            }

            s.needsRender = true;
            s.dampingFrames = 30;
          };

          // Load each component file for this type
          for (const file of config.files) {
            const path = config.base + file;
            if (cacheRef.current[path]) {
              componentScenes[file] = cacheRef.current[path];
              loadedCount++;
              if (loadedCount === config.files.length) assembleForType();
            } else {
              loader.load(
                path,
                gltf => {
                  cacheRef.current[path] = gltf.scene;
                  componentScenes[file] = gltf.scene;
                  loadedCount++;
                  if (loadedCount === config.files.length) assembleForType();
                },
                undefined,
                err => {
                  console.warn(`Component ${file} failed:`, err);
                  loadedCount++;
                  if (loadedCount === config.files.length) assembleForType();
                }
              );
            }
          }
        }
      }


      s.keyLight.castShadow = false;
      s.renderer.shadowMap.enabled = false;
      s.needsRender = true; s.dampingFrames = 30;
      if (loadingRef.current) { loadingRef.current.style.opacity = '0'; loadingRef.current.style.pointerEvents = 'none'; }
      onLoaded?.();
      return;
    }

    /* ═══════════════════════════════════════════
       GLTF MODEL (single window fallback)
       ═══════════════════════════════════════════ */
    if (loadingTextRef.current) loadingTextRef.current.textContent = 'Loading model...';

    const cloneAndSetup = (src: THREE.Group) => {
      const model = src.clone(true);
      model.traverse((c) => {
        if (!(c as THREE.Mesh).isMesh) return;
        const mesh = c as THREE.Mesh;
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : mesh.material.clone();
      });

      const frameMats: THREE.MeshStandardMaterial[] = [];
      model.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;
        mesh.castShadow = false; mesh.receiveShadow = false;
        mesh.frustumCulled = true;
        if (mesh.geometry) mesh.geometry.computeBoundingSphere();

        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((mat) => {
          const m = mat as THREE.MeshStandardMaterial;
          if (m.isMeshStandardMaterial) m.envMapIntensity = isHeavy ? 0.5 : 1.0;
          const phys = m as THREE.MeshPhysicalMaterial;
          const isGlass = (phys.transmission && phys.transmission > 0) || (m.transparent && m.opacity < 0.5);
          const nameL = (m.name || '').toLowerCase();
          const childL = (mesh.name || '').toLowerCase();
          const isHandle = m.metalness > 0.5 || nameL.includes('handle') || childL.includes('handle') || nameL.includes('#290');
          if (!isGlass && !isHandle) frameMats.push(m);
        });
      });

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);
      return { model, frameMats, size };
    };

    const placeSingle = (src: THREE.Group) => {
      const { model, frameMats, size } = cloneAndSetup(src);
      const scale = 2.5 / Math.max(size.x, size.y, size.z);
      model.scale.setScalar(scale);
      const box2 = new THREE.Box3().setFromObject(model);
      model.position.sub(box2.getCenter(new THREE.Vector3()));

      s.frameMaterials = frameMats;
      s.currentModel = model;
      s.scene.add(model);

      const dimGroup = new THREE.Group();
      addDimLines(model, dimGroup);
      dimGroup.renderOrder = 999;
      s.dimGroup = dimGroup;
      s.scene.add(dimGroup);

      finalize(frameMats);
    };

    if (cacheRef.current[modelPath]) { placeSingle(cacheRef.current[modelPath]); return; }
    loader.load(
      modelPath,
      (gltf) => { cacheRef.current[modelPath] = gltf.scene; placeSingle(gltf.scene); },
      (xhr) => { if (xhr.total && loadingTextRef.current) loadingTextRef.current.textContent = 'Loading... ' + Math.round((xhr.loaded / xhr.total) * 100) + '%'; },
      (err) => {
        console.error('Model load error:', err);
        if (loadingTextRef.current) loadingTextRef.current.textContent = 'Error loading model';
        setTimeout(() => { if (loadingRef.current) { loadingRef.current.style.opacity = '0'; loadingRef.current.style.pointerEvents = 'none'; } }, 2000);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelPath, typeId, onLoaded, gridKey]);

  // ═══ Apply colour changes (exterior only — preserve interior) ═══
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const c = new THREE.Color(colour.hex);
    const cDark = c.clone().multiplyScalar(0.88);
    const extBrightness = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
    const isDark = extBrightness < 0.45;

    // 1. Update procedural frame materials (mullions, transoms, splitBars)
    // frameMaterials order: [0]=exterior frame, [1]=interior, [2]=sash, [3]=meeting rail
    s.frameMaterials.forEach((m, i) => {
      if (i === 1) return; // Skip interior material
      m.color.copy(c);
      if ('roughness' in m) {
        m.roughness = isDark ? 0.35 : 0.6;
        m.metalness = isDark ? 0.15 : 0.0;
      }
      m.needsUpdate = true;
    });

    // 2. Update GLTF model materials (tagged during assembly)
    if (s.currentModel) {
      s.currentModel.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          const m = mat as THREE.MeshStandardMaterial;
          if (!m || !m.userData?.colorRole) continue;
          if (m.userData.colorRole === 'exterior') {
            m.color.copy(c);
            m.roughness = isDark ? 0.35 : 0.6;
            m.metalness = isDark ? 0.15 : 0.0;
            m.needsUpdate = true;
          }
          // Interior and hardware/glass materials are left untouched
        }
      });
    }

    s.needsRender = true;
  }, [colour]);

  // ═══ Apply interior colour changes ═══
  // Mirrors the exterior effect above: patches the existing interior
  // materials in place instead of relying on a full model rebuild
  // (which can leave clones pointing at the previous, cached materials).
  useEffect(() => {
    const s = sceneRef.current;
    if (!s || !interiorColorHex) return;
    const c = new THREE.Color(interiorColorHex);

    s.frameMaterials.forEach((m) => {
      if (!m || !m.userData) return;
      if (m.userData.colorRole === 'interior') {
        m.color.copy(c);
        m.needsUpdate = true;
      }
    });

    if (s.currentModel) {
      s.currentModel.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          const m = mat as THREE.MeshStandardMaterial;
          if (!m || !m.userData?.colorRole) continue;
          if (m.userData.colorRole === 'interior') {
            m.color.copy(c);
            m.needsUpdate = true;
          }
        }
      });
    }

    s.needsRender = true;
  }, [interiorColorHex]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#fff' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }} />
      <div ref={loadingRef} style={{
        position: 'absolute', inset: 0, background: 'rgba(250,250,250,0.95)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: 10, transition: 'opacity 0.4s',
      }}>
        <div style={{ width: 36, height: 36, border: '3px solid #e5e5e5', borderTopColor: '#333', borderRadius: '50%', animation: 'viewerSpin 0.7s linear infinite' }} />
        <span ref={loadingTextRef} style={{ marginTop: 12, fontSize: 12, color: '#999', fontWeight: 500 }}>Loading model...</span>
        <style>{`@keyframes viewerSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
