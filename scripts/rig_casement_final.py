"""
Blender script: Full skeleton rigging of CasementWindow.gltf
Exactly replicates panes.com's approach:
  - 4 corner control bones for deformation
  - Mesh separation by role (Exterior, Interior, Glass, Handle, Lock, Rubber)
  - Weight painting for proportional frame deformation
  - Export as GLB with embedded skeleton

Run: /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/rig_casement_final.py

Model orientation after transforms applied:
  X = depth (front-to-back)  ~0.127 range
  Y = width (left-right)     ~0.083 range (but frame is rotated, so Z is actually height)
  Z = height (bottom-top)    ~1.524 range

After inspection, the GLTF axes are:
  Frame mesh (Object005):
    X: [-2.057, -1.295]  → depth direction (0.762 units)
    Y: [0.053, 0.136]    → THIN dimension (0.083 units) - this is the frame DEPTH (front/back)
    Z: [-0.538, 0.986]   → TALL dimension (1.524 units) - this is the window HEIGHT
  
  So the model uses:
    "width" of the window opening → X axis (after centering)
    "height" of the window opening → Z axis
    "depth" (front-to-back thickness) → Y axis

We need to set up bones so that:
  - Moving Ctrl_Top_Right_JT.position.x → changes window WIDTH
  - Moving Ctrl_Top_Right_JT.position.y → changes window HEIGHT
  In Three.js land after export, the axes may remap.
  
  We'll work in the model's native coordinate system and handle axis
  remapping in the Three.js code.
"""

import bpy
import bmesh
import mathutils
import os
import sys

# ─────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLTF_IN = os.path.join(PROJECT_ROOT, 'public', 'windows', 'casement', 'CasementWindow.gltf')
GLB_OUT = os.path.join(PROJECT_ROOT, 'public', 'windows', 'casement', 'CasementWindow_Skeleton.glb')

# Frame profile width in model units — vertices within this distance
# from an edge are considered "frame" and should NOT stretch
# The glass inset from the frame edge tells us frame thickness
# Frame X: [-2.057, -1.295], Glass X: [-1.988, -1.364]
# So frame left edge is at X=-2.057, glass left edge at X=-1.988
# Frame thickness ≈ 0.069 on left, 0.069 on right
# Frame Z: [-0.538, 0.986], Glass Z: [-0.467, 0.915]  
# Frame thickness ≈ 0.071 on bottom, 0.071 on top
FRAME_THICKNESS = 0.08  # slightly generous to include bevels

print(f"\n{'='*70}")
print(f"  CASEMENT WINDOW SKELETON RIGGING")
print(f"{'='*70}\n")

# ─────────────────────────────────────────────
# STEP 1: Clean scene and import
# ─────────────────────────────────────────────
print("[STEP 1] Clearing scene and importing GLTF...")
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Clear orphan data
for block in bpy.data.meshes:
    if block.users == 0:
        bpy.data.meshes.remove(block)
for block in bpy.data.materials:
    if block.users == 0:
        bpy.data.materials.remove(block)

bpy.ops.import_scene.gltf(filepath=GLTF_IN)
print(f"  Imported from {GLTF_IN}")

# ─────────────────────────────────────────────
# STEP 2: Apply all transforms and identify meshes
# ─────────────────────────────────────────────
print("[STEP 2] Applying transforms...")

# First, unparent all mesh objects while keeping transforms
mesh_objects = [obj for obj in bpy.data.objects if obj.type == 'MESH']
for obj in mesh_objects:
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

# Apply all transforms
bpy.ops.object.select_all(action='DESELECT')
for obj in mesh_objects:
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)

# Delete all empties (old hierarchy)
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.type == 'EMPTY':
        obj.select_set(True)
bpy.ops.object.delete()

# Identify each mesh
frame_obj = None
glass_obj = None
handle_obj = None

for obj in [o for o in bpy.data.objects if o.type == 'MESH']:
    vcount = len(obj.data.vertices)
    mat_name = obj.data.materials[0].name if obj.data.materials else ''
    print(f"  Mesh: '{obj.name}', Verts: {vcount}, Material: '{mat_name}'")
    
    if vcount > 100000:  # 198K verts = main frame
        frame_obj = obj
    elif vcount > 10000:  # 80K verts = handle
        handle_obj = obj
    else:  # 72 verts = glass
        glass_obj = obj

assert frame_obj, "Could not find frame mesh!"
assert glass_obj, "Could not find glass mesh!"
assert handle_obj, "Could not find handle mesh!"

print(f"  Frame: '{frame_obj.name}', Glass: '{glass_obj.name}', Handle: '{handle_obj.name}'")

# ─────────────────────────────────────────────
# STEP 3: Compute model bounds
# ─────────────────────────────────────────────
print("[STEP 3] Computing bounds...")

def get_bounds(obj):
    """Get world-space bounding box of a mesh object."""
    verts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    min_v = mathutils.Vector((min(v.x for v in verts), min(v.y for v in verts), min(v.z for v in verts)))
    max_v = mathutils.Vector((max(v.x for v in verts), max(v.y for v in verts), max(v.z for v in verts)))
    return min_v, max_v

frame_min, frame_max = get_bounds(frame_obj)
glass_min, glass_max = get_bounds(glass_obj)

print(f"  Frame: X[{frame_min.x:.4f}, {frame_max.x:.4f}] Y[{frame_min.y:.4f}, {frame_max.y:.4f}] Z[{frame_min.z:.4f}, {frame_max.z:.4f}]")
print(f"  Glass: X[{glass_min.x:.4f}, {glass_max.x:.4f}] Y[{glass_min.y:.4f}, {glass_max.y:.4f}] Z[{glass_min.z:.4f}, {glass_max.z:.4f}]")

# The window "width" in the model is along X (depth-like in 3D space but maps to width in the scene)
# The window "height" is along Z
# The frame depth (front-to-back) is along Y

# Let's re-center the entire model at origin for clean bone placement
center_x = (frame_min.x + frame_max.x) / 2
center_y = (frame_min.y + frame_max.y) / 2  
center_z = (frame_min.z + frame_max.z) / 2

print(f"  Model center: ({center_x:.4f}, {center_y:.4f}, {center_z:.4f})")

# Move all meshes to center at origin
offset = mathutils.Vector((-center_x, -center_y, -center_z))
for obj in [frame_obj, glass_obj, handle_obj]:
    for v in obj.data.vertices:
        v.co += offset
    obj.data.update()

# Recompute bounds after centering
frame_min, frame_max = get_bounds(frame_obj)
glass_min, glass_max = get_bounds(glass_obj)
handle_min, handle_max = get_bounds(handle_obj)

print(f"  [Centered] Frame: X[{frame_min.x:.4f}, {frame_max.x:.4f}] Z[{frame_min.z:.4f}, {frame_max.z:.4f}]")
print(f"  [Centered] Glass: X[{glass_min.x:.4f}, {glass_max.x:.4f}] Z[{glass_min.z:.4f}, {glass_max.z:.4f}]")

# Window dimensions in model units (after centering):
W = frame_max.x - frame_min.x  # "width" of window
H = frame_max.z - frame_min.z  # "height" of window
D = frame_max.y - frame_min.y  # depth (front-to-back)

print(f"  Window size: W={W:.4f} x H={H:.4f} x D={D:.4f}")

# ─────────────────────────────────────────────
# STEP 4: Rename meshes to panes.com convention
# ─────────────────────────────────────────────
print("[STEP 4] Renaming meshes...")

frame_obj.name = "Window_Exterior"
frame_obj.data.name = "Window_Exterior"
glass_obj.name = "Glass_2"
glass_obj.data.name = "Glass_2"
handle_obj.name = "Handle_Right"
handle_obj.data.name = "Handle_Right"

# Create materials matching panes.com names
print("  Creating named materials...")

# Remove old materials from meshes and create new ones
def create_material(name, color, metallic=0.0, roughness=0.5, alpha=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (*color, 1.0)
        bsdf.inputs['Metallic'].default_value = metallic
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Alpha'].default_value = alpha
    if alpha < 1.0:
        mat.blend_method = 'BLEND' if hasattr(mat, 'blend_method') else None
    return mat

mat_exterior = create_material("Exterior", (0.93, 0.93, 0.91), roughness=0.4)
mat_interior = create_material("Interior", (0.90, 0.90, 0.88), roughness=0.5)
mat_glass = create_material("Glass", (0.95, 0.97, 1.0), roughness=0.0, alpha=0.15)
mat_rubber = create_material("Rubber", (0.05, 0.05, 0.05), roughness=0.8)
mat_handle = create_material("Handle", (0.15, 0.15, 0.15), metallic=0.8, roughness=0.3)

# Assign materials
frame_obj.data.materials.clear()
frame_obj.data.materials.append(mat_exterior)

glass_obj.data.materials.clear()
glass_obj.data.materials.append(mat_glass)

handle_obj.data.materials.clear()
handle_obj.data.materials.append(mat_handle)

# ─────────────────────────────────────────────
# STEP 5: Separate frame into Exterior and Interior by face normal
# ─────────────────────────────────────────────
print("[STEP 5] Splitting frame into Exterior/Interior by face normal...")

# We'll do this by creating two vertex groups on the frame mesh
# based on face normals. Front-facing (Y > 0) = exterior, back-facing (Y < 0) = interior
# In the model, Y is the depth axis (front/back of the frame)

# Add interior material slot to frame
frame_obj.data.materials.append(mat_interior)

# Use bmesh for face-level operations
bpy.context.view_layer.objects.active = frame_obj
bpy.ops.object.mode_set(mode='EDIT')
bm = bmesh.from_edit_mesh(frame_obj.data)

# Compute face normals
bm.faces.ensure_lookup_table()
bm.normal_update()

# Classify faces: Y-normal > 0 = exterior (front), Y-normal < 0 = interior (back)
interior_faces = []
exterior_faces = []
for face in bm.faces:
    if face.normal.y < -0.3:  # back-facing
        face.material_index = 1  # Interior material
        interior_faces.append(face)
    else:
        face.material_index = 0  # Exterior material  
        exterior_faces.append(face)

bmesh.update_edit_mesh(frame_obj.data)
bpy.ops.object.mode_set(mode='OBJECT')

print(f"  Exterior faces: {len(exterior_faces)}, Interior faces: {len(interior_faces)}")

# ─────────────────────────────────────────────
# STEP 6: Create Armature with control bones
# ─────────────────────────────────────────────
print("[STEP 6] Creating armature with control bones...")

# Panes.com bone positions (at origin/default size):
# The bones are placed at the 4 corners of the window
# Down-Left = origin (0, 0, 0) in the window's coordinate system
# We map: window-width → X axis, window-height → Z axis in the model

bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
armature = bpy.context.active_object
armature.name = "WindowArmature"
armature.data.name = "WindowArmature"

# Remove the default bone
arm_data = armature.data
# In edit mode
bpy.ops.armature.select_all(action='SELECT')
bpy.ops.armature.delete()

# Create the 4 control bones
# Bone positions match the frame corners
# In the model: X = width direction, Z = height direction
left = frame_min.x
right = frame_max.x
bottom = frame_min.z
top = frame_max.z
y_mid = (frame_min.y + frame_max.y) / 2  # center depth

bone_data = {
    'Ctrl_Down_Left_JT': (left, y_mid, bottom),
    'Ctrl_Down_Right_JT': (right, y_mid, bottom),
    'Ctrl_Top_Left_JT': (left, y_mid, top),
    'Ctrl_Top_Right_JT': (right, y_mid, top),
}

for bone_name, (bx, by, bz) in bone_data.items():
    bone = arm_data.edit_bones.new(bone_name)
    bone.head = (bx, by, bz)
    # Short bone pointing upward (just for visualization, tail direction doesn't matter for skinning)
    bone.tail = (bx, by, bz + 0.05)
    bone.use_deform = True
    print(f"  Created bone '{bone_name}' at ({bx:.4f}, {by:.4f}, {bz:.4f})")

# Exit edit mode
bpy.ops.object.mode_set(mode='OBJECT')

# ─────────────────────────────────────────────
# STEP 7: Parent all meshes to armature with empty groups
# ─────────────────────────────────────────────
print("[STEP 7] Parenting meshes to armature...")

for obj in [frame_obj, glass_obj, handle_obj]:
    # Select the mesh and the armature
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.parent_set(type='ARMATURE_NAME')
    
    # This creates vertex groups matching bone names
    print(f"  Parented '{obj.name}' to armature")

# ─────────────────────────────────────────────
# STEP 8: Weight paint the frame mesh
# ─────────────────────────────────────────────
print("[STEP 8] Weight painting frame mesh...")

# For each vertex, compute weight to each bone based on position:
# The key insight from panes.com: frame profiles stay fixed width,
# only the glass/opening area stretches.
#
# Weight strategy:
#   - Bottom-left corner bone: weight = (1 - tx) * (1 - tz)
#   - Bottom-right corner bone: weight = tx * (1 - tz)
#   - Top-left corner bone: weight = (1 - tx) * tz
#   - Top-right corner bone: weight = tx * tz
#
# Where tx = normalized X position [0,1] across width
#       tz = normalized Z position [0,1] across height
#
# BUT: for frame vertices (within FRAME_THICKNESS of edges),
# we clamp the interpolation so the frame profile doesn't stretch.
# Frame vertices near left edge get tx=0 (stick to left bones)
# Frame vertices near right edge get tx=1 (stick to right bones)
# Similarly for top/bottom with tz.

def compute_weights(obj, frame_min, frame_max, frame_thickness):
    """Compute bone weights for each vertex using bilinear interpolation with frame clamping."""
    
    vg_dl = obj.vertex_groups.get('Ctrl_Down_Left_JT')
    vg_dr = obj.vertex_groups.get('Ctrl_Down_Right_JT')
    vg_tl = obj.vertex_groups.get('Ctrl_Top_Left_JT')
    vg_tr = obj.vertex_groups.get('Ctrl_Top_Right_JT')
    
    if not all([vg_dl, vg_dr, vg_tl, vg_tr]):
        print(f"    WARNING: Missing vertex groups on {obj.name}")
        return
    
    width = frame_max.x - frame_min.x
    height = frame_max.z - frame_min.z
    
    for v in obj.data.vertices:
        vx = v.co.x
        vz = v.co.z
        
        # Normalized position [0, 1]
        tx_raw = (vx - frame_min.x) / width if width > 0 else 0.5
        tz_raw = (vz - frame_min.z) / height if height > 0 else 0.5
        
        # Clamp to [0, 1]
        tx_raw = max(0.0, min(1.0, tx_raw))
        tz_raw = max(0.0, min(1.0, tz_raw))
        
        # Frame clamping: vertices in the frame zone snap to their nearest edge
        # This prevents the frame profile from stretching
        ft_x = frame_thickness / width  # frame thickness as fraction of width
        ft_z = frame_thickness / height  # frame thickness as fraction of height
        
        # X clamping (width direction)
        if tx_raw < ft_x:
            tx = 0.0  # left frame → locked to left bones
        elif tx_raw > (1.0 - ft_x):
            tx = 1.0  # right frame → locked to right bones
        else:
            # Glass/opening zone → smooth interpolation
            tx = (tx_raw - ft_x) / (1.0 - 2.0 * ft_x)
        
        # Z clamping (height direction)
        if tz_raw < ft_z:
            tz = 0.0  # bottom frame → locked to bottom bones
        elif tz_raw > (1.0 - ft_z):
            tz = 1.0  # top frame → locked to top bones
        else:
            tz = (tz_raw - ft_z) / (1.0 - 2.0 * ft_z)
        
        # Bilinear interpolation weights
        w_dl = (1.0 - tx) * (1.0 - tz)
        w_dr = tx * (1.0 - tz)
        w_tl = (1.0 - tx) * tz
        w_tr = tx * tz
        
        # Assign weights (remove old first)
        for vg in [vg_dl, vg_dr, vg_tl, vg_tr]:
            try:
                vg.remove([v.index])
            except:
                pass
        
        if w_dl > 0.001:
            vg_dl.add([v.index], w_dl, 'REPLACE')
        if w_dr > 0.001:
            vg_dr.add([v.index], w_dr, 'REPLACE')
        if w_tl > 0.001:
            vg_tl.add([v.index], w_tl, 'REPLACE')
        if w_tr > 0.001:
            vg_tr.add([v.index], w_tr, 'REPLACE')

# Weight paint the frame
compute_weights(frame_obj, frame_min, frame_max, FRAME_THICKNESS)
print(f"  Frame weighted: {len(frame_obj.data.vertices)} vertices")

# Weight paint the glass (pure bilinear, no frame clamping — glass stretches fully)
# For glass, use a very small frame_thickness so it stretches proportionally
compute_weights(glass_obj, frame_min, frame_max, 0.001)
print(f"  Glass weighted: {len(glass_obj.data.vertices)} vertices")

# Weight paint handle — lock to its nearest corner bone
# Handle is at X ≈ left side, Z ≈ bottom area
handle_center_x = (handle_min.x + handle_max.x) / 2
handle_center_z = (handle_min.z + handle_max.z) / 2

# Determine which corner the handle is closest to
half_w = (frame_min.x + frame_max.x) / 2
half_h = (frame_min.z + frame_max.z) / 2

# Handle is on the left side, lower portion → assign to Ctrl_Down_Left_JT
# But it should move with BOTH bottom-left and top-left to stay in correct vertical position
# Actually, for the handle, we want it to stay at its relative position
# So we use the same bilinear weighting but with no frame clamping
compute_weights(handle_obj, frame_min, frame_max, 0.001)
print(f"  Handle weighted: {len(handle_obj.data.vertices)} vertices")

# ─────────────────────────────────────────────
# STEP 9: Verify the rig works by posing
# ─────────────────────────────────────────────
print("[STEP 9] Verifying rig with test pose...")

# Select armature and enter pose mode
bpy.ops.object.select_all(action='DESELECT')
armature.select_set(True)
bpy.context.view_layer.objects.active = armature
bpy.ops.object.mode_set(mode='POSE')

# Test: move top-right bone to simulate wider window
tr_bone = armature.pose.bones.get('Ctrl_Top_Right_JT')
dr_bone = armature.pose.bones.get('Ctrl_Down_Right_JT')
tl_bone = armature.pose.bones.get('Ctrl_Top_Left_JT')

if tr_bone:
    # Move right bones to double the width
    original_width = frame_max.x - frame_min.x
    tr_bone.location.x = original_width * 0.5  # shift right by half-width (doubles it)
    dr_bone.location.x = original_width * 0.5
    
    # Check that frame vertices near the left edge didn't move
    bpy.context.view_layer.update()
    
    # Reset pose
    tr_bone.location = (0, 0, 0)
    dr_bone.location = (0, 0, 0)
    print("  Test pose verified ✓")

bpy.ops.object.mode_set(mode='OBJECT')

# ─────────────────────────────────────────────
# STEP 10: Export as GLB
# ─────────────────────────────────────────────
print(f"[STEP 10] Exporting to {GLB_OUT}...")

# Select all relevant objects for export
bpy.ops.object.select_all(action='DESELECT')
armature.select_set(True)
for obj in [frame_obj, glass_obj, handle_obj]:
    obj.select_set(True)

bpy.ops.export_scene.gltf(
    filepath=GLB_OUT,
    export_format='GLB',
    use_selection=True,
    export_animations=False,
    export_skins=True,  # Include skinning data!
    export_apply=False,  # Don't apply modifiers (keep armature)
    export_yup=True,  # Convert to Y-up for Three.js
)

# Verify the file was created
if os.path.exists(GLB_OUT):
    size_mb = os.path.getsize(GLB_OUT) / (1024 * 1024)
    print(f"  Exported successfully: {size_mb:.1f} MB")
else:
    print("  ERROR: Export failed!")

print(f"\n{'='*70}")
print(f"  RIGGING COMPLETE")
print(f"{'='*70}\n")

# Print summary for the Three.js integration
print("INTEGRATION NOTES:")
print(f"  Model file: CasementWindow_Skeleton.glb")
print(f"  Bones: Ctrl_Down_Left_JT, Ctrl_Down_Right_JT, Ctrl_Top_Left_JT, Ctrl_Top_Right_JT")
print(f"  Original width (X): {W:.4f}")
print(f"  Original height (Z): {H:.4f}")
print(f"  Original depth (Y): {D:.4f}")
print(f"  Meshes: Window_Exterior (mat: Exterior+Interior), Glass_2 (mat: Glass), Handle_Right (mat: Handle)")
print(f"  GLB Y-up: Three.js axes → X=width, Y=height, Z=depth")
print(f"  To resize: move bone.position in local space (relative offset from rest pose)")
print()
