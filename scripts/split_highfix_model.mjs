/**
 * Split HighFixWindow_DoubleGlazing.gltf into clean components:
 *   1. sash_or_other.glb = ONLY the frame (Layer:067.001)
 *   2. glass.glb = ONLY the glass pane (Object104.001)
 */
import fs from 'fs';
import path from 'path';

const INPUT_DIR = path.resolve('public/windows/high-fix');
const OUTPUT_DIR = path.resolve('public/windows/high-fix/components');

const gltf = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, 'HighFixWindow_DoubleGlazing.gltf'), 'utf8'));
const binData = fs.readFileSync(path.join(INPUT_DIR, 'HighFixWindow_DoubleGlazing.bin'));

console.log('Original high-fix model:');
console.log(`  Nodes: ${gltf.nodes.length}`);
console.log(`  Meshes: ${gltf.meshes.length}`);
console.log(`  Materials: ${gltf.materials.length}`);
console.log(`  Binary: ${binData.length} bytes`);

function buildGLB(gltfJson, binBuffer) {
  const jsonStr = JSON.stringify(gltfJson);
  const jsonBuf = Buffer.from(jsonStr, 'utf8');
  const jsonPadding = (4 - (jsonBuf.length % 4)) % 4;
  const paddedJsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jsonPadding, 0x20)]);
  const binPadding = (4 - (binBuffer.length % 4)) % 4;
  const paddedBinBuf = Buffer.concat([binBuffer, Buffer.alloc(binPadding, 0x00)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0);
  header.writeUInt32LE(2, 4);
  const totalLen = 12 + 8 + paddedJsonBuf.length + 8 + paddedBinBuf.length;
  header.writeUInt32LE(totalLen, 8);
  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(paddedJsonBuf.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4);
  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(paddedBinBuf.length, 0);
  binChunkHeader.writeUInt32LE(0x004E4942, 4);
  return Buffer.concat([header, jsonChunkHeader, paddedJsonBuf, binChunkHeader, paddedBinBuf]);
}

// High-fix structure:
// Nodes: 0=Node_1 (empty), 1=Node_5 (empty), 2=Object104 (mesh 0=glass), 
//        3=Node_1.001 (→child 2), 4=Layer:067 (mesh 1=frame), 5=Node_3.001 (→child 4)
// Scene root nodes: [0, 1, 3, 5]
// Mesh 0 (Object104.001) = Glass, uses accessors 0-2, bufferViews 0-2, material 0 (#245)
// Mesh 1 (Layer:067.001) = Frame, uses accessors 3-8, bufferViews 3-8, materials 1-2 (#233, #290)

// =============================================
// 1. FRAME (sash_or_other.glb)
// =============================================
// Frame = Mesh 1 (Layer:067.001), nodes 4 (Layer:067) + 5 (Node_3.001)
// Accessors 3-8, BufferViews 3-8, Materials 1-2
// BV3: offset=1296,     len=3362328
// BV4: offset=3363624,  len=3362328
// BV5: offset=6725952,  len=3723600
// BV6: offset=10449552, len=182652
// BV7: offset=10632204, len=182652
// BV8: offset=10814856, len=93552
const frameStart = 1296;
const frameEnd = 10814856 + 93552; // = 10908408
const frameBin = binData.subarray(frameStart, frameEnd);

const frameBufferViews = gltf.bufferViews.slice(3, 9).map(bv => ({
  ...bv,
  byteOffset: bv.byteOffset - frameStart,
}));

const frameAccessors = gltf.accessors.slice(3, 9).map(acc => ({
  ...acc,
  bufferView: acc.bufferView - 3,
}));

const frameMeshes = [{
  name: "Layer:067.001",
  primitives: [
    { attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 },
    { attributes: { POSITION: 3, NORMAL: 4 }, indices: 5, material: 1 },
  ],
}];

const frameGltf = {
  asset: gltf.asset,
  extensionsUsed: ["KHR_materials_clearcoat", "KHR_materials_specular"],
  scene: 0,
  scenes: [{ name: "Scene", nodes: [1] }],
  nodes: [
    { mesh: 0, name: "Layer:067", scale: gltf.nodes[4].scale },
    { children: [0], name: "Node_3.001", rotation: gltf.nodes[5].rotation, scale: gltf.nodes[5].scale, translation: gltf.nodes[5].translation },
  ],
  materials: [gltf.materials[1], gltf.materials[2]], // #233 and #290
  meshes: frameMeshes,
  accessors: frameAccessors,
  bufferViews: frameBufferViews,
  buffers: [{ byteLength: frameBin.length }],
};

const frameGLB = buildGLB(frameGltf, frameBin);

// =============================================
// 2. GLASS (glass.glb)
// =============================================
// Glass = Mesh 0 (Object104.001), nodes 2 (Object104) + 3 (Node_1.001)
// Accessors 0-2, BufferViews 0-2, Material 0 (#245)
// BV0: offset=0,    len=576
// BV1: offset=576,  len=576
// BV2: offset=1152, len=144
const glassBin = binData.subarray(0, 1296);

const glassGltf = {
  asset: gltf.asset,
  extensionsUsed: ["KHR_materials_transmission", "KHR_materials_ior"],
  scene: 0,
  scenes: [{ name: "Scene", nodes: [1] }],
  nodes: [
    { mesh: 0, name: "Object104", scale: gltf.nodes[2].scale },
    { children: [0], name: "Node_1.001", rotation: gltf.nodes[3].rotation, translation: gltf.nodes[3].translation },
  ],
  materials: [gltf.materials[0]], // #245
  meshes: [{ name: "Object104.001", primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
  accessors: gltf.accessors.slice(0, 3),
  bufferViews: gltf.bufferViews.slice(0, 3),
  buffers: [{ byteLength: glassBin.length }],
};

const glassGLB = buildGLB(glassGltf, glassBin);

// =============================================
// 3. WRITE OUTPUT
// =============================================
const backupDir = path.join(OUTPUT_DIR, 'backup');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

const existingSash = path.join(OUTPUT_DIR, 'sash_or_other.glb');
const existingGlass = path.join(OUTPUT_DIR, 'glass.glb');
if (fs.existsSync(existingSash)) fs.copyFileSync(existingSash, path.join(backupDir, 'sash_or_other.glb.bak'));
if (fs.existsSync(existingGlass)) fs.copyFileSync(existingGlass, path.join(backupDir, 'glass.glb.bak'));

fs.writeFileSync(existingSash, frameGLB);
fs.writeFileSync(existingGlass, glassGLB);

console.log('\n✅ High-fix components created:');
console.log(`   sash_or_other.glb: ${frameGLB.length} bytes (frame only)`);
console.log(`   glass.glb:         ${glassGLB.length} bytes (glass only)`);
console.log(`   Backups saved to:  ${backupDir}`);
