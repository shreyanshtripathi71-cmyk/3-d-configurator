import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gltfPath = path.resolve(__dirname, '../public/windows/casement/CasementWindow.gltf');

// Minimal file loading for Node.js
const fileLoader = {
  load(url, onLoad) {
    const fullPath = path.resolve(path.dirname(gltfPath), url);
    const data = fs.readFileSync(fullPath);
    onLoad(data.buffer);
  }
};

const loader = new GLTFLoader();
loader.setResourcePath(path.dirname(gltfPath) + '/');

const gltfData = fs.readFileSync(gltfPath, 'utf8');
const json = JSON.parse(gltfData);

// Parse the buffers manually
const bufferUri = json.buffers[0].uri;
const bufferPath = path.resolve(path.dirname(gltfPath), bufferUri);
const bufferData = fs.readFileSync(bufferPath);

// Use the Three.js GLTFParser
loader.parse(bufferData.buffer, path.dirname(gltfPath) + '/', (gltf) => {
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);

  const fullBox = new THREE.Box3().setFromObject(scene);
  console.log('Full model bounds:');
  console.log('  min:', fullBox.min.x.toFixed(4), fullBox.min.y.toFixed(4), fullBox.min.z.toFixed(4));
  console.log('  max:', fullBox.max.x.toFixed(4), fullBox.max.y.toFixed(4), fullBox.max.z.toFixed(4));
  const fullSize = fullBox.getSize(new THREE.Vector3());
  const fullCenter = fullBox.getCenter(new THREE.Vector3());
  console.log('  size:', fullSize.x.toFixed(4), fullSize.y.toFixed(4), fullSize.z.toFixed(4));
  console.log('  center:', fullCenter.x.toFixed(4), fullCenter.y.toFixed(4), fullCenter.z.toFixed(4));

  scene.traverse((child) => {
    if (!child.isMesh) return;
    const mesh = child;
    const bb = new THREE.Box3().setFromObject(mesh);
    const sz = bb.getSize(new THREE.Vector3());
    const ct = bb.getCenter(new THREE.Vector3());
    
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const matNames = mats.map(m => m.name || '(unnamed)');
    const isGlass = mats.some(m => m.transparent || m.opacity < 0.9 || (m.name && m.name.includes('245')));
    
    console.log(`\nMesh: ${mesh.name} | Material: ${matNames.join(',')} | Glass: ${isGlass}`);
    console.log(`  world bounds: [${bb.min.x.toFixed(4)}, ${bb.max.x.toFixed(4)}] x [${bb.min.y.toFixed(4)}, ${bb.max.y.toFixed(4)}] x [${bb.min.z.toFixed(4)}, ${bb.max.z.toFixed(4)}]`);
    console.log(`  size: ${sz.x.toFixed(4)} x ${sz.y.toFixed(4)} x ${sz.z.toFixed(4)}`);
    console.log(`  center: ${ct.x.toFixed(4)}, ${ct.y.toFixed(4)}, ${ct.z.toFixed(4)}`);
  });

  // Now compute glass-only bounds
  const glassBox = new THREE.Box3();
  let glassFound = false;
  scene.traverse((child) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const isGlass = mats.some(m => m.transparent || m.opacity < 0.9 || (m.name && m.name.includes('245')));
    if (isGlass) {
      glassBox.expandByObject(child);
      glassFound = true;
    }
  });

  if (glassFound) {
    const gs = glassBox.getSize(new THREE.Vector3());
    const gc = glassBox.getCenter(new THREE.Vector3());
    console.log('\n=== GLASS BOUNDS ===');
    console.log('  size:', gs.x.toFixed(4), gs.y.toFixed(4), gs.z.toFixed(4));
    console.log('  center:', gc.x.toFixed(4), gc.y.toFixed(4), gc.z.toFixed(4));
    console.log('  offset from model center:', (gc.x - fullCenter.x).toFixed(4), (gc.y - fullCenter.y).toFixed(4), (gc.z - fullCenter.z).toFixed(4));
    console.log('  glass/model ratio W:', (gs.x / fullSize.x).toFixed(4), 'H:', (gs.y / fullSize.y).toFixed(4));
  }
}, (err) => {
  console.error('Parse error:', err);
});
