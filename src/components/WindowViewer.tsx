'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { Colour } from '@/data/windows';
import { HEAVY_MODELS } from '@/data/windows';

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
}

interface WindowViewerProps {
  modelPath: string;
  typeId: string;
  colour: Colour;
  dimensions?: { width: string; height: string };
  onLoaded?: () => void;
  controlsRef?: React.MutableRefObject<ViewerControlsAPI | null>;
}

export default function WindowViewer({
  modelPath,
  typeId,
  colour,
  dimensions,
  onLoaded,
  controlsRef,
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
  const colourRef = useRef(colour);
  const dimensionsRef = useRef(dimensions);
  const loadingRef = useRef<HTMLDivElement>(null);
  const loadingTextRef = useRef<HTMLSpanElement>(null);

  colourRef.current = colour;
  dimensionsRef.current = dimensions;

  // Initialize Three.js scene (runs once)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.shadowMap.autoUpdate = false;

    // Scene — pure white background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    // Camera
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, 0.3, 4.8);

    // Controls
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

    // Lights — stronger for better contrast
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const hemiLight = new THREE.HemisphereLight(0xf0f0ff, 0x9999a0, 0.7);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);

    // Key light — strong directional with visible shadow
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(3, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 25;
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.bias = -0.0003;
    keyLight.shadow.normalBias = 0.02;
    keyLight.shadow.radius = 5;
    scene.add(keyLight);

    // Fill light — cooler, from opposite side
    const fillLight = new THREE.DirectionalLight(0xe0e8ff, 0.9);
    fillLight.position.set(-5, 4, -3);
    scene.add(fillLight);

    // Rim/back light — warm glow to define edges
    const rimLight = new THREE.DirectionalLight(0xffeedd, 0.7);
    rimLight.position.set(0, 3, -6);
    scene.add(rimLight);

    // Bottom fill light — lifts shadows on underside
    const bottomFill = new THREE.DirectionalLight(0xdde0e8, 0.3);
    bottomFill.position.set(0, -3, 2);
    scene.add(bottomFill);

    // Ground shadow — subtle
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.ShadowMaterial({ opacity: 0.08 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.8;
    ground.receiveShadow = true;
    scene.add(ground);

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
    const topP = new THREE.Mesh(panelGeo, bright);
    topP.position.set(0, 20, 0);
    topP.rotation.x = Math.PI / 2;
    envScene.add(topP);
    const sideP = new THREE.Mesh(panelGeo, dim);
    sideP.position.set(15, 5, 5);
    sideP.lookAt(0, 0, 0);
    envScene.add(sideP);
    const backP = new THREE.Mesh(panelGeo, dim);
    backP.position.set(0, 5, -15);
    backP.lookAt(0, 0, 0);
    envScene.add(backP);
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    skyGeo.dispose(); skyMat.dispose(); panelGeo.dispose(); bright.dispose(); dim.dispose();

    // GLTF Loader
    const gltfLoader = new GLTFLoader();
    try {
      const draco = new DRACOLoader();
      draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/libs/draco/gltf/');
      draco.setDecoderConfig({ type: 'js' });
      gltfLoader.setDRACOLoader(draco);
    } catch (e) {
      console.warn('DRACO loader not available:', e);
    }
    loaderRef.current = gltfLoader;

    // Event handlers
    canvas.addEventListener('pointerdown', () => startDamping(60));
    canvas.addEventListener('pointerup', () => startDamping(30));
    canvas.addEventListener('wheel', () => { requestRender(); startDamping(30); }, { passive: true });

    // Resize
    const onResize = () => {
      const wrap = canvas.parentElement;
      if (!wrap) return;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      requestRender();
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(onResize, 80);
    };
    window.addEventListener('resize', debouncedResize);
    const ro = new ResizeObserver(debouncedResize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    onResize();

    // Store refs
    sceneRef.current = {
      renderer,
      scene,
      camera,
      controls,
      frameMaterials: [],
      currentModel: null,
      dimGroup: null,
      animId: null,
      needsRender: true,
      dampingFrames: 0,
      keyLight,
    };

    // Render loop
    let rafId: number;
    const renderLoop = () => {
      rafId = requestAnimationFrame(renderLoop);
      const s = sceneRef.current;
      if (!s) return;
      // Sync ref-based flags from external effects (color change, etc.)
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

  // Expose controls API
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
        s.controls.update();
        requestRender();
        if (t < 1) s.animId = requestAnimationFrame(tick);
        else { s.animId = null; startDamping(30); }
      };
      s.animId = requestAnimationFrame(tick);
    };

    const orbitIncrement = (dAz: number, dPol: number) => {
      const sph = new THREE.Spherical().setFromVector3(
        s.camera.position.clone().sub(s.controls.target)
      );
      sph.theta += dAz;
      sph.phi = Math.max(0.1, Math.min(Math.PI - 0.1, sph.phi + dPol));
      const p = new THREE.Vector3().setFromSpherical(sph).add(s.controls.target);
      animateTo([p.x, p.y, p.z], [s.controls.target.x, s.controls.target.y, s.controls.target.z], 300);
    };

    controlsRef.current = {
      zoomIn: () => {
        const d = s.camera.position.clone().sub(s.controls.target).normalize();
        s.camera.position.addScaledVector(d, -0.5);
        s.controls.update();
        requestRender();
        startDamping(30);
      },
      zoomOut: () => {
        const d = s.camera.position.clone().sub(s.controls.target).normalize();
        s.camera.position.addScaledVector(d, 0.5);
        s.controls.update();
        requestRender();
        startDamping(30);
      },
      rotateUp: () => orbitIncrement(0, -0.25),
      rotateDown: () => orbitIncrement(0, 0.25),
      rotateLeft: () => orbitIncrement(-0.25, 0),
      rotateRight: () => orbitIncrement(0.25, 0),
      resetView: () => animateTo([0, 0.3, 4.8], [0, 0, 0]),
      isoView: () => animateTo([2.5, 1.8, 3], [0, 0, 0]),
    };
  }, [controlsRef]);

  // Load model when modelPath changes
  useEffect(() => {
    const s = sceneRef.current;
    const loader = loaderRef.current;
    if (!s || !loader) return;

    const isHeavy = HEAVY_MODELS.has(typeId);

    // Show loading
    if (loadingRef.current) loadingRef.current.style.opacity = '1';
    if (loadingRef.current) loadingRef.current.style.pointerEvents = 'auto';
    if (loadingTextRef.current) loadingTextRef.current.textContent = 'Loading model...';

    // Remove old model
    if (s.currentModel) {
      s.scene.remove(s.currentModel);
      s.currentModel = null;
    }
    s.frameMaterials = [];

    const placeModel = (srcScene: THREE.Group) => {
      // Clone
      const model = srcScene.clone(true);
      model.traverse((c) => {
        if (!(c as THREE.Mesh).isMesh) return;
        const mesh = c as THREE.Mesh;
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map((m) => m.clone())
          : mesh.material.clone();
      });

      // Scale and center — smaller model
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = 2.5 / Math.max(size.x, size.y, size.z);
      model.scale.setScalar(scale);
      model.position.sub(center.multiplyScalar(scale));
      const box2 = new THREE.Box3().setFromObject(model);
      model.position.sub(box2.getCenter(new THREE.Vector3()));

      // Setup shadows and materials
      if (isHeavy) {
        s.keyLight.castShadow = false;
        s.renderer.shadowMap.enabled = false;
      } else {
        s.keyLight.castShadow = true;
        s.renderer.shadowMap.enabled = true;
      }

      const frameMats: THREE.MeshStandardMaterial[] = [];
      model.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;
        mesh.castShadow = !isHeavy;
        mesh.receiveShadow = !isHeavy;
        mesh.frustumCulled = true;
        if (mesh.geometry) mesh.geometry.computeBoundingSphere();

        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((mat) => {
          const m = mat as THREE.MeshStandardMaterial;
          if (m.isMeshStandardMaterial) {
            m.envMapIntensity = isHeavy ? 0.5 : 1.0;
          }
          const phys = m as THREE.MeshPhysicalMaterial;
          const isGlass =
            (phys.transmission && phys.transmission > 0) ||
            (m.transparent && m.opacity < 0.5);
          const nameL = (m.name || '').toLowerCase();
          const childL = (mesh.name || '').toLowerCase();
          const isHandle =
            m.metalness > 0.5 ||
            nameL.includes('handle') ||
            childL.includes('handle') ||
            nameL.includes('#290');
          if (!isGlass && !isHandle) frameMats.push(m);
        });
      });

      s.frameMaterials = frameMats;
      s.currentModel = model;
      s.scene.add(model);

      // ── 3D Dimension Lines (attached to model) ──
      // Remove old dimension group
      if (s.dimGroup) {
        s.scene.remove(s.dimGroup);
        s.dimGroup = null;
      }

      if (dimensionsRef.current) {
        const dimGroup = new THREE.Group();
        const finalBox = new THREE.Box3().setFromObject(model);
        const min = finalBox.min;
        const max = finalBox.max;
        const lineMat = new THREE.LineBasicMaterial({ color: 0x888888, linewidth: 1 });
        const offset = 0.15; // gap from model edge
        const tickLen = 0.08;

        // Helper: create a text sprite
        const makeTextSprite = (text: string) => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          canvas.width = 128;
          canvas.height = 48;
          ctx.clearRect(0, 0, 128, 48);
          ctx.font = '600 28px Inter, Arial, sans-serif';
          ctx.fillStyle = '#777777';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, 64, 24);
          const tex = new THREE.CanvasTexture(canvas);
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
          const sprite = new THREE.Sprite(mat);
          sprite.scale.set(0.5, 0.19, 1);
          return sprite;
        };

        // Helper: line from points
        const makeLine = (pts: THREE.Vector3[]) => {
          const geo = new THREE.BufferGeometry().setFromPoints(pts);
          return new THREE.Line(geo, lineMat);
        };

        // ── HEIGHT line (left side) ──
        const hx = min.x - offset;
        // Main vertical line
        dimGroup.add(makeLine([new THREE.Vector3(hx, min.y, 0), new THREE.Vector3(hx, max.y, 0)]));
        // Top tick
        dimGroup.add(makeLine([new THREE.Vector3(hx - tickLen, max.y, 0), new THREE.Vector3(hx + tickLen, max.y, 0)]));
        // Bottom tick
        dimGroup.add(makeLine([new THREE.Vector3(hx - tickLen, min.y, 0), new THREE.Vector3(hx + tickLen, min.y, 0)]));
        // Label
        const hLabel = makeTextSprite(dimensionsRef.current.height);
        hLabel.position.set(hx - 0.22, (min.y + max.y) / 2, 0);
        dimGroup.add(hLabel);

        // ── WIDTH line (bottom) ──
        const wy = min.y - offset;
        // Main horizontal line
        dimGroup.add(makeLine([new THREE.Vector3(min.x, wy, 0), new THREE.Vector3(max.x, wy, 0)]));
        // Left tick
        dimGroup.add(makeLine([new THREE.Vector3(min.x, wy - tickLen, 0), new THREE.Vector3(min.x, wy + tickLen, 0)]));
        // Right tick
        dimGroup.add(makeLine([new THREE.Vector3(max.x, wy - tickLen, 0), new THREE.Vector3(max.x, wy + tickLen, 0)]));
        // Label
        const wLabel = makeTextSprite(dimensionsRef.current.width);
        wLabel.position.set((min.x + max.x) / 2, wy - 0.18, 0);
        dimGroup.add(wLabel);

        dimGroup.renderOrder = 999;
        s.dimGroup = dimGroup;
        s.scene.add(dimGroup);
      }

      // Apply current colour
      const c = new THREE.Color(colourRef.current.hex);
      frameMats.forEach((m) => { m.color.copy(c); m.needsUpdate = true; });

      if (!isHeavy) {
        s.renderer.compile(s.scene, s.camera);
        s.renderer.shadowMap.needsUpdate = true;
      }

      s.needsRender = true;
      s.dampingFrames = 30;

      // Hide loading
      if (loadingRef.current) loadingRef.current.style.opacity = '0';
      if (loadingRef.current) loadingRef.current.style.pointerEvents = 'none';

      onLoaded?.();
    };

    // Check cache
    if (cacheRef.current[modelPath]) {
      placeModel(cacheRef.current[modelPath]);
      return;
    }

    // Load fresh
    loader.load(
      modelPath,
      (gltf) => {
        cacheRef.current[modelPath] = gltf.scene;
        placeModel(gltf.scene);
      },
      (xhr) => {
        if (xhr.total && loadingTextRef.current) {
          loadingTextRef.current.textContent =
            'Loading... ' + Math.round((xhr.loaded / xhr.total) * 100) + '%';
        }
      },
      (err) => {
        console.error('Model load error:', err);
        if (loadingTextRef.current) loadingTextRef.current.textContent = 'Error loading model';
        setTimeout(() => {
          if (loadingRef.current) loadingRef.current.style.opacity = '0';
          if (loadingRef.current) loadingRef.current.style.pointerEvents = 'none';
        }, 2000);
      }
    );
  }, [modelPath, typeId, onLoaded]);

  // Apply colour changes
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const c = new THREE.Color(colour.hex);
    s.frameMaterials.forEach((m) => { m.color.copy(c); m.needsUpdate = true; });
    s.needsRender = true;
  }, [colour]);

  return (
    <div style={{ width: '100%', aspectRatio: '1/1', position: 'relative', background: '#fff' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }}
      />
      <div
        ref={loadingRef}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(250,250,250,0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          transition: 'opacity 0.4s',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            border: '3px solid #e5e5e5',
            borderTopColor: '#333',
            borderRadius: '50%',
            animation: 'viewerSpin 0.7s linear infinite',
          }}
        />
        <span
          ref={loadingTextRef}
          style={{ marginTop: 12, fontSize: 12, color: '#999', fontWeight: 500 }}
        >
          Loading model...
        </span>
        <style>{`@keyframes viewerSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
