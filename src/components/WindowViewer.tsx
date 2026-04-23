'use client';

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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

    const addDimLines = (target: THREE.Group, dimGroup: THREE.Group) => {
      if (!dimensionsRef.current) return;
      const fb = new THREE.Box3().setFromObject(target);
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
          files: ['AwningWindow.gltf'],
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

            // Place a clone in each cell of this type
            for (const cb of cells) {
              const cellGroup = refGroup.clone(true);
              cellGroup.position.set(-refCenter.x, -refCenter.y, -refCenter.z);

              const scaleX = cb.w / refSize.x;
              const scaleY = cb.h / refSize.y;

              const pivot = new THREE.Group();
              pivot.add(cellGroup);
              pivot.scale.set(scaleX, scaleY, fixedZScale);
              pivot.position.set(cb.x, cb.y, 0);
              windowGroup.add(pivot);

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
  }, [modelPath, typeId, onLoaded, gridKey, interiorColorHex]);

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
