"""
Blender script — Casement Window 2H×2V
Uses the ACTUAL original CasementWindow.gltf model:
  - 4 panes in a 2×2 grid
  - Bottom row (W1.1, W1.2): casement panes WITH handles (mirrored so handles face center)
  - Top row (W2.1, W2.2): fixed/picture panes — same frame + glass, NO handle
  - Touching frame edges form natural mullions and transom bar

Layout (viewer facing window):
  [Top-Left fixed]   [Top-Right fixed]
  [Bot-Left casement] [Bot-Right casement]

Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python blender/generate_casement_2h2v.py
"""

import bpy
import bmesh
import mathutils
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLTF_IN = os.path.join(PROJECT_ROOT, 'public', 'windows', 'casement', 'CasementWindow.gltf')
GLB_OUT = os.path.join(PROJECT_ROOT, 'public', 'windows', 'casement', 'Casement_2H2V.glb')

print(f"\n{'='*60}")
print(f"  CASEMENT 2H×2V — From Original Model")
print(f"{'='*60}\n")

# ─── Step 1: Clear & Import ──────────────────────────────
print("[1] Clearing scene & importing original model...")
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for b in list(bpy.data.meshes): bpy.data.meshes.remove(b)
for b in list(bpy.data.materials): bpy.data.materials.remove(b)

bpy.ops.import_scene.gltf(filepath=GLTF_IN)

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
    if vc > 100000: frame_obj = obj
    elif vc > 10000: handle_obj = obj
    else: glass_obj = obj

assert frame_obj and glass_obj and handle_obj

# ─── Step 4: Center at origin ────────────────────────────
print("[4] Centering model at origin...")

def get_bounds(obj):
    verts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    mn = mathutils.Vector((min(v.x for v in verts), min(v.y for v in verts), min(v.z for v in verts)))
    mx = mathutils.Vector((max(v.x for v in verts), max(v.y for v in verts), max(v.z for v in verts)))
    return mn, mx

fmin, fmax = get_bounds(frame_obj)
center = (fmin + fmax) / 2
offset = -center

for obj in [frame_obj, glass_obj, handle_obj]:
    for v in obj.data.vertices:
        v.co += offset
    obj.data.update()

fmin, fmax = get_bounds(frame_obj)
W = fmax.x - fmin.x  # ~0.762  (single pane width)
H = fmax.z - fmin.z  # ~1.524  (single pane height)
print(f"    Single pane: W={W:.4f}, H={H:.4f}")

# ─── Helper: duplicate mesh with optional mirror and shift ─
def duplicate_mesh(src_obj, new_name, mirror_x, shift_x, shift_z):
    new_mesh = src_obj.data.copy()
    new_obj = bpy.data.objects.new(new_name, new_mesh)
    bpy.context.collection.objects.link(new_obj)
    new_obj.data.materials.clear()
    for mat in src_obj.data.materials:
        new_obj.data.materials.append(mat)

    for v in new_obj.data.vertices:
        x = -v.co.x if mirror_x else v.co.x
        v.co.x = x + shift_x
        v.co.z = v.co.z + shift_z
    new_obj.data.update()

    if mirror_x:
        bpy.context.view_layer.objects.active = new_obj
        new_obj.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.flip_normals()
        bpy.ops.object.mode_set(mode='OBJECT')
        new_obj.select_set(False)

    return new_obj

# ─── Step 5: Create 4 panes ──────────────────────────────
print("[5] Creating panes...")

# Shifts: right column = +W/2, left column = -W/2
#         bottom row = -H/2, top row = +H/2
# Left column is mirrored so handles face center

pane_configs = [
    # (position_name, mirror_x, shift_x, shift_z, include_handle)
    ('BotRight', False, +W/2, -H/2, True),   # casement, handles toward center (left side)
    ('BotLeft',  True,  -W/2, -H/2, True),   # casement, mirrored (handle on right = toward center)
    ('TopRight', False, +W/2, +H/2, False),   # fixed — no handle
    ('TopLeft',  True,  -W/2, +H/2, False),   # fixed — no handle
]

created = []
for pos_name, mirror, sx, sz, include_handle in pane_configs:
    pane_type = "casement" if include_handle else "fixed"
    print(f"    {pos_name} ({pane_type}): mirror={mirror}, shift=({sx:.3f}, {sz:.3f})")

    # Frame (always)
    created.append(duplicate_mesh(frame_obj, f"Frame_{pos_name}", mirror, sx, sz))
    # Glass (always)
    created.append(duplicate_mesh(glass_obj, f"Glass_{pos_name}", mirror, sx, sz))
    # Handle (only for casement panes in bottom row)
    if include_handle:
        created.append(duplicate_mesh(handle_obj, f"Handle_{pos_name}", mirror, sx, sz))

# Remove original template meshes
print("[6] Removing template meshes...")
for obj in [frame_obj, glass_obj, handle_obj]:
    bpy.data.objects.remove(obj, do_unlink=True)

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

# ─── Step 8: Export ───────────────────────────────────────
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
print(f"  COMPLETE — Casement_2H2V.glb")
print(f"{'='*60}\n")
