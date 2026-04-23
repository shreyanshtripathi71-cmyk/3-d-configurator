/**
 * Split PictureWindow_Model_1.gltf into clean components:
 *   1. sash_or_other.glb = ONLY the frame (Layer:070 mesh)
 *   2. glass.glb = ONLY the glass panes (Object108 + Object109)
 * 
 * This creates proper components from the ORIGINAL picture window model,
 * NOT copied from the single-hung model.
 */
import fs from 'fs';
import path from 'path';

const INPUT_DIR = path.resolve('public/windows/picture');
const OUTPUT_DIR = path.resolve('public/windows/picture/components');

// Read the original GLTF
const gltf = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, 'PictureWindow_Model_1.gltf'), 'utf8'));
const binData = fs.readFileSync(path.join(INPUT_DIR, 'PictureWindow_Model_1.bin'));

console.log('Original model:');
console.log(`  Nodes: ${gltf.nodes.length}`);
console.log(`  Meshes: ${gltf.meshes.length}`);
console.log(`  Materials: ${gltf.materials.length}`);
console.log(`  Binary: ${binData.length} bytes`);

/**
 * Build a GLB file from a GLTF JSON + binary buffer
 */
function buildGLB(gltfJson, binBuffer) {
  const jsonStr = JSON.stringify(gltfJson);
  const jsonBuf = Buffer.from(jsonStr, 'utf8');
  
  // Pad JSON to 4-byte alignment
  const jsonPadding = (4 - (jsonBuf.length % 4)) % 4;
  const paddedJsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jsonPadding, 0x20)]); // space padding
  
  // Pad binary to 4-byte alignment  
  const binPadding = (4 - (binBuffer.length % 4)) % 4;
  const paddedBinBuf = Buffer.concat([binBuffer, Buffer.alloc(binPadding, 0x00)]);
  
  // GLB header: magic + version + length
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0); // 'glTF'
  header.writeUInt32LE(2, 4);           // version 2
  const totalLen = 12 + 8 + paddedJsonBuf.length + 8 + paddedBinBuf.length;
  header.writeUInt32LE(totalLen, 8);
  
  // JSON chunk header
  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(paddedJsonBuf.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4); // 'JSON'
  
  // BIN chunk header
  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(paddedBinBuf.length, 0);
  binChunkHeader.writeUInt32LE(0x004E4942, 4); // 'BIN\0'
  
  return Buffer.concat([header, jsonChunkHeader, paddedJsonBuf, binChunkHeader, paddedBinBuf]);
}

// =============================================
// 1. CREATE FRAME (sash_or_other.glb)
// =============================================
// Frame = Mesh 0 (Layer:070) with nodes 0 (WindowParent) and 2 (Node_1 → child 1 = Layer:070)
// Uses accessors 0-5, bufferViews 0-5, materials 0-1

// Extract binary data for the frame
// BufferViews 0-5:
//   0: offset=0,       length=186204   (positions primitive 0)
//   1: offset=186204,  length=186204   (normals primitive 0)
//   2: offset=372408,  length=93648    (indices primitive 0)
//   3: offset=466056,  length=3199884  (positions primitive 1)
//   4: offset=3665940, length=3199884  (normals primitive 1)
//   5: offset=6865824, length=3548640  (indices primitive 1)
const frameDataEnd = 6865824 + 3548640; // = 10414464
const frameBin = binData.subarray(0, frameDataEnd);

const frameGltf = {
  asset: gltf.asset,
  extensionsUsed: ["KHR_materials_clearcoat", "KHR_materials_specular"],
  scene: 0,
  scenes: [{ name: "Scene", nodes: [0, 2] }], // WindowParent + Node_1
  nodes: [
    gltf.nodes[0], // WindowParent
    gltf.nodes[1], // Layer:070 (mesh 0)
    { ...gltf.nodes[2], children: [1] }, // Node_1 → child is Layer:070
  ],
  materials: [gltf.materials[0], gltf.materials[1]], // Materials #290 and #233
  meshes: [gltf.meshes[0]], // Only Layer:070
  accessors: gltf.accessors.slice(0, 6), // Accessors 0-5
  bufferViews: gltf.bufferViews.slice(0, 6), // BufferViews 0-5
  buffers: [{ byteLength: frameBin.length }], // No URI for GLB
};

const frameGLB = buildGLB(frameGltf, frameBin);

// =============================================
// 2. CREATE GLASS (glass.glb)
// =============================================
// Glass = Mesh 1 (Object108) and Mesh 2 (Object109)
// Nodes: 4 (Node_3 → child 3 = Object108) and 6 (Node_5 → child 5 = Object109)
// Uses accessors 6-10, bufferViews 6-10, material 2

// Extract binary data for the glass
// BufferViews 6-10:
//   6: offset=10414464, length=288   (positions Object108)
//   7: offset=10414752, length=288   (normals Object108)
//   8: offset=10415040, length=72    (indices - shared)
//   9: offset=10415112, length=288   (positions Object109)
//  10: offset=10415400, length=288   (normals Object109)
const glassDataStart = 10414464;
const glassDataEnd = 10415400 + 288; // = 10415688
const glassBin = binData.subarray(glassDataStart, glassDataEnd);

// Rebase buffer views to start from 0
const glassBufferViews = gltf.bufferViews.slice(6, 11).map(bv => ({
  ...bv,
  byteOffset: bv.byteOffset - glassDataStart,
}));

// Rebase accessors to point to new bufferView indices (0-4 instead of 6-10)
const glassAccessors = gltf.accessors.slice(6, 11).map(acc => ({
  ...acc,
  bufferView: acc.bufferView - 6,
}));

// Rebase mesh primitive accessors and material indices
const glassMeshes = [
  {
    name: "Object108",
    primitives: [{
      attributes: { POSITION: 0, NORMAL: 1 }, // Originally 6, 7
      indices: 2, // Originally 8
      material: 0,
    }],
  },
  {
    name: "Object109",
    primitives: [{
      attributes: { POSITION: 3, NORMAL: 4 }, // Originally 9, 10
      indices: 2, // Shares index buffer (originally 8)
      material: 0,
    }],
  },
];

// Rebase node mesh references
const glassNodes = [
  { // Object108 (originally node 3)
    mesh: 0,
    name: "Object108",
    scale: gltf.nodes[3].scale,
  },
  { // Node_3 (originally node 4)
    children: [0],
    name: "Node_3",
    rotation: gltf.nodes[4].rotation,
    translation: gltf.nodes[4].translation,
  },
  { // Object109 (originally node 5)
    mesh: 1,
    name: "Object109",
    scale: gltf.nodes[5].scale,
  },
  { // Node_5 (originally node 6)
    children: [2],
    name: "Node_5",
    rotation: gltf.nodes[6].rotation,
    translation: gltf.nodes[6].translation,
  },
];

const glassGltf = {
  asset: gltf.asset,
  extensionsUsed: ["KHR_materials_transmission", "KHR_materials_ior"],
  scene: 0,
  scenes: [{ name: "Scene", nodes: [1, 3] }], // Node_3 and Node_5
  nodes: glassNodes,
  materials: [gltf.materials[2]], // Only Material #245 (glass)
  meshes: glassMeshes,
  accessors: glassAccessors,
  bufferViews: glassBufferViews,
  buffers: [{ byteLength: glassBin.length }],
};

const glassGLB = buildGLB(glassGltf, glassBin);

// =============================================
// 3. WRITE OUTPUT FILES
// =============================================
// Backup existing components
const backupDir = path.join(OUTPUT_DIR, 'backup');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

const existingSash = path.join(OUTPUT_DIR, 'sash_or_other.glb');
const existingGlass = path.join(OUTPUT_DIR, 'glass.glb');
if (fs.existsSync(existingSash)) {
  fs.copyFileSync(existingSash, path.join(backupDir, 'sash_or_other.glb.bak'));
}
if (fs.existsSync(existingGlass)) {
  fs.copyFileSync(existingGlass, path.join(backupDir, 'glass.glb.bak'));
}

fs.writeFileSync(existingSash, frameGLB);
fs.writeFileSync(existingGlass, glassGLB);

console.log('\n✅ Components created:');
console.log(`   sash_or_other.glb: ${frameGLB.length} bytes (frame only)`);
console.log(`   glass.glb:         ${glassGLB.length} bytes (glass panes only)`);
console.log(`   Backups saved to:  ${backupDir}`);
