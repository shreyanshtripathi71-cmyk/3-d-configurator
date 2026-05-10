"""
Blender script — Casement Window 2H×1V
Uses the ACTUAL original CasementWindow.gltf model:
  - Import the original high-quality model
  - Center it, duplicate all meshes
  - Mirror one copy in X (so handles face inward toward center)
  - Place them side by side to form a 2-pane casement window
  - The touching frame edges naturally form the center mullion

This preserves ALL original geometry quality (198K vert frame, 80K vert handle).

Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python blender/generate_casement_2h1v.py
"""

import bpy
import bmesh
import mathutils
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLTF_IN = os.path.join(PROJECT_ROOT, 'public', 'windows', 'casement', 'CasementWindow.gltf')
GLB_OUT = os.path.join(PROJECT_ROOT, 'public', 'windows', 'casement', 'Casement_2H1V.glb')

print(f"\n{'='*60}")
print(f"  CASEMENT 2H×1V — From Original Model")
print(f"{'='*60}\n")

# ─── Step 1: Clear & Import ──────────────────────────────
print("[1] Clearing scene & importing original model...")
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for b in list(bpy.data.meshes): bpy.data.meshes.remove(b)
for b in list(bpy.data.materials): bpy.data.materials.remove(b)

bpy.ops.import_scene.gltf(filepath=GLTF_IN)
print(f"    Imported: {GLTF_IN}")

# ─── Step 2: Flatten hierarchy & apply transforms ────────
print("[2] Flattening hierarchy...")
mesh_objects = [o for o in bpy.data.objects if o.type == 'MESH']

for obj in mesh_objects:
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)

# Remove empties
bpy.ops.object.select_all(action='DESELECT')
for obj in list(bpy.data.objects):
    if obj.type == 'EMPTY':
        obj.select_set(True)
bpy.ops.object.delete()

# ─── Step 3: Identify meshes ─────────────────────────────
print("[3] Identifying meshes...")
frame_obj = glass_obj = handle_obj = None
for obj in [o for o in bpy.data.objects if o.type == 'MESH']:
    vc = len(obj.data.vertices)
    mat_name = obj.data.materials[0].name if obj.data.materials else ''
    print(f"    '{obj.name}' — {vc} verts, mat: '{mat_name}'")
    if vc > 100000:
        frame_obj = obj
    elif vc > 10000:
        handle_obj = obj
    else:
        glass_obj = obj

assert frame_obj and glass_obj and handle_obj, "Missing meshes!"

# ─── Step 4: Center at origin ────────────────────────────
print("[4] Centering model at origin...")

def get_bounds(obj):
    verts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    mn = mathutils.Vector((min(v.x for v in verts), min(v.y for v in verts), min(v.z for v in verts)))
    mx = mathutils.Vector((max(v.x for v in verts), max(v.y for v in verts), max(v.z for v in verts)))
    return mn, mx

# Use frame bounds as reference
fmin, fmax = get_bounds(frame_obj)
center = (fmin + fmax) / 2
offset = -center

for obj in [frame_obj, glass_obj, handle_obj]:
    for v in obj.data.vertices:
        v.co += offset
    obj.data.update()

# Recompute bounds
fmin, fmax = get_bounds(frame_obj)
gmin, gmax = get_bounds(glass_obj)
hmin, hmax = get_bounds(handle_obj)

W = fmax.x - fmin.x  # ~0.762
H = fmax.z - fmin.z  # ~1.524
D = fmax.y - fmin.y  # ~0.083

print(f"    Frame: X[{fmin.x:.4f}, {fmax.x:.4f}] W={W:.4f}")
print(f"    Frame: Z[{fmin.z:.4f}, {fmax.z:.4f}] H={H:.4f}")
print(f"    Handle center X: {(hmin.x+hmax.x)/2:.4f}")
print(f"    Glass: X[{gmin.x:.4f}, {gmax.x:.4f}]")

# Handle is on the LEFT side (negative X). In the original model:
#   Handle center X ≈ -0.094 (left of center 0)
# For a 2H1V casement, we want handles near the CENTER (inward):
#   RIGHT pane: use original as-is (handle already on left = toward center)
#   LEFT pane: mirror in X (flips handle from left to right = toward center)

# ─── Step 5: Create RIGHT pane (original, shifted right) ─
print("[5] Creating RIGHT pane (original, shift +X)...")

shift_right = W / 2  # shift by half-width so left edge sits at X=0

# Rename originals as "right" pane
frame_obj.name = "Frame_Right"
glass_obj.name = "Glass_Right"
handle_obj.name = "Handle_Right"

for obj in [frame_obj, glass_obj, handle_obj]:
    for v in obj.data.vertices:
        v.co.x += shift_right
    obj.data.update()

# ─── Step 6: Create LEFT pane (mirrored, shifted left) ───
print("[6] Creating LEFT pane (mirror + shift -X)...")

def duplicate_and_mirror(src_obj, new_name, shift_x):
    """Duplicate mesh, mirror in X, shift."""
    new_mesh = src_obj.data.copy()
    new_obj = bpy.data.objects.new(new_name, new_mesh)
    bpy.context.collection.objects.link(new_obj)

    # Copy materials
    new_obj.data.materials.clear()
    for mat in src_obj.data.materials:
        new_obj.data.materials.append(mat)

    # Mirror in X and shift
    for v in new_obj.data.vertices:
        # The source is already shifted right by shift_right
        # First un-shift, then mirror, then shift left
        orig_x = v.co.x - shift_right  # back to centered
        v.co.x = -orig_x + shift_x     # mirror and shift left

    # Flip normals (mirroring reverses winding)
    new_obj.data.update()
    bpy.context.view_layer.objects.active = new_obj
    new_obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.flip_normals()
    bpy.ops.object.mode_set(mode='OBJECT')
    new_obj.select_set(False)

    return new_obj

shift_left = -W / 2

frame_left = duplicate_and_mirror(frame_obj, "Frame_Left", shift_left)
glass_left = duplicate_and_mirror(glass_obj, "Glass_Left", shift_left)
handle_left = duplicate_and_mirror(handle_obj, "Handle_Left", shift_left)

# ─── Step 7: Final centering ─────────────────────────────
print("[7] Final centering at origin...")

all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
all_verts = []
for obj in all_mesh:
    for v in obj.data.vertices:
        all_verts.append(obj.matrix_world @ v.co)

total_min = mathutils.Vector((min(v.x for v in all_verts), min(v.y for v in all_verts), min(v.z for v in all_verts)))
total_max = mathutils.Vector((max(v.x for v in all_verts), max(v.y for v in all_verts), max(v.z for v in all_verts)))
total_center = (total_min + total_max) / 2
final_offset = -total_center

for obj in all_mesh:
    for v in obj.data.vertices:
        v.co += final_offset
    obj.data.update()

# Print final stats
all_verts2 = []
for obj in all_mesh:
    for v in obj.data.vertices:
        all_verts2.append(obj.matrix_world @ v.co)

fmin2 = mathutils.Vector((min(v.x for v in all_verts2), min(v.y for v in all_verts2), min(v.z for v in all_verts2)))
fmax2 = mathutils.Vector((max(v.x for v in all_verts2), max(v.y for v in all_verts2), max(v.z for v in all_verts2)))

print(f"\n    Final bounds:")
print(f"      X: [{fmin2.x:.4f}, {fmax2.x:.4f}]  W = {fmax2.x-fmin2.x:.4f}")
print(f"      Y: [{fmin2.y:.4f}, {fmax2.y:.4f}]  D = {fmax2.y-fmin2.y:.4f}")
print(f"      Z: [{fmin2.z:.4f}, {fmax2.z:.4f}]  H = {fmax2.z-fmin2.z:.4f}")
print(f"      Total objects: {len(all_mesh)}")
for obj in all_mesh:
    print(f"        '{obj.name}' — {len(obj.data.vertices)} verts")

# ─── Step 8: Apply transforms & export ───────────────────
print(f"\n[8] Exporting to {GLB_OUT}...")

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

os.makedirs(os.path.dirname(GLB_OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=GLB_OUT,
    export_format='GLB',
    use_selection=False,
    export_apply=True,
    export_materials='EXPORT',
    export_yup=True,
)

if os.path.exists(GLB_OUT):
    size_mb = os.path.getsize(GLB_OUT) / (1024 * 1024)
    print(f"    ✓ Exported: {size_mb:.2f} MB")
else:
    print("    ✗ Export FAILED!")

print(f"\n{'='*60}")
print(f"  COMPLETE — Casement_2H1V.glb")
print(f"{'='*60}\n")
