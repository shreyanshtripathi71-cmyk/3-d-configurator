"""
Blender script: Rig AwningWindow.glb with the same 4-corner control rig
as scripts/rig_casement_v2.py.

Awning specifics handled here:
  * The source meshes are NOT centred at the origin — they sit offset
    in X and Z. We translate every mesh's data so the overall bounding
    box is centred at (0, 0, 0) before rigging.
  * Mesh names like "Handle Body.*" are misleading — those are frame
    parts (24K+ vertices). The actual glass / hardware split is done
    via vertex count + material (small low-vert mesh with transparent
    material = glass). We do NOT special-case hardware by name; the
    awning crank handle, if present, will be edge-slid like any other
    frame vertex (good enough — the crank is normally on the bottom
    bar and the bottom-bar weighting moves it correctly).
  * Frame zone ratios are tuned for the awning aspect ratio (wider than
    tall): FT_X = 0.10, FT_Z = 0.15.

Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
      --python scripts/rig_awning_v2.py
"""
import bpy
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
GLB_PATH = os.path.join(PROJECT_DIR, 'public', 'windows', 'awning', 'AwningWindow.glb')
OUTPUT_PATH = os.path.join(PROJECT_DIR, 'public', 'windows', 'awning', 'AwningWindow_Rigged_v2.glb')

# Frame-zone fractions — what portion of width/height is "frame".
# Awning is short and wide so the top/bottom frame is a larger fraction
# of the height than the casement uses. The viewer derives its uniform
# clone scale from (FT_X × native_width), so keeping FT_X = 0.10 here vs
# the casement's 0.12 gives the awning a slightly slimmer frame profile
# in scene units — matching real-world awning specs.
FT_X = 0.10
FT_Z = 0.15

# The viewer (WindowViewer.tsx) computes its uniform clone scale from
# the casement rig's native width (0.7621 m). Every other rigged model
# MUST be scaled to that same native width so the same clone-scale math
# produces a frame profile of the right thickness for all window types.
TARGET_NATIVE_WIDTH = 0.7621

BONE_NAMES = ['Ctrl_Down_Left', 'Ctrl_Down_Right', 'Ctrl_Top_Left', 'Ctrl_Top_Right']


def compute_weights(nx, nz, is_hardware=False):
    """Compute (DL, DR, TL, TR) weights for vertex at normalized pos."""
    if is_hardware:
        # Awning crank typically sits on the bottom bar — slide between
        # DL and DR by horizontal position.
        return (1.0 - nx, nx, 0.0, 0.0)

    in_left = nx < FT_X
    in_right = nx > (1.0 - FT_X)
    in_bottom = nz < FT_Z
    in_top = nz > (1.0 - FT_Z)

    if in_left and in_bottom:  return (1.0, 0.0, 0.0, 0.0)
    if in_right and in_bottom: return (0.0, 1.0, 0.0, 0.0)
    if in_left and in_top:     return (0.0, 0.0, 1.0, 0.0)
    if in_right and in_top:    return (0.0, 0.0, 0.0, 1.0)

    if in_left:
        t = max(0, min(1, (nz - FT_Z) / max(1.0 - 2 * FT_Z, 0.001)))
        return (1.0 - t, 0.0, t, 0.0)
    if in_right:
        t = max(0, min(1, (nz - FT_Z) / max(1.0 - 2 * FT_Z, 0.001)))
        return (0.0, 1.0 - t, 0.0, t)
    if in_bottom:
        t = max(0, min(1, (nx - FT_X) / max(1.0 - 2 * FT_X, 0.001)))
        return (1.0 - t, t, 0.0, 0.0)
    if in_top:
        t = max(0, min(1, (nx - FT_X) / max(1.0 - 2 * FT_X, 0.001)))
        return (0.0, 0.0, 1.0 - t, t)

    inner_nx = max(0, min(1, (nx - FT_X) / max(1.0 - 2 * FT_X, 0.001)))
    inner_nz = max(0, min(1, (nz - FT_Z) / max(1.0 - 2 * FT_Z, 0.001)))
    dl = (1.0 - inner_nx) * (1.0 - inner_nz)
    dr = inner_nx * (1.0 - inner_nz)
    tl = (1.0 - inner_nx) * inner_nz
    tr = inner_nx * inner_nz
    return (dl, dr, tl, tr)


print("=" * 60)
print("RIGGING AWNING WINDOW")
print("=" * 60)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB_PATH)

meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH']
print(f"\nFound {len(meshes)} meshes: {[m.name for m in meshes]}")

# ── Step 1: Apply object-level transforms so locations baked in ──
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.select_all(action='DESELECT')

# ── Step 2: Compute bounds and CENTER the model at origin ──
all_verts = []
for obj in meshes:
    for v in obj.data.vertices:
        all_verts.append(obj.matrix_world @ v.co)

if not all_verts:
    raise RuntimeError("No vertices found after import — empty model?")

min_x = min(v.x for v in all_verts); max_x = max(v.x for v in all_verts)
min_y = min(v.y for v in all_verts); max_y = max(v.y for v in all_verts)
min_z = min(v.z for v in all_verts); max_z = max(v.z for v in all_verts)

cx = (min_x + max_x) / 2.0
cy = (min_y + max_y) / 2.0
cz = (min_z + max_z) / 2.0

print(f"Pre-center bounds: X[{min_x:+.4f},{max_x:+.4f}] "
      f"Y[{min_y:+.4f},{max_y:+.4f}] Z[{min_z:+.4f},{max_z:+.4f}]")
print(f"Centering by:      ({-cx:+.4f}, {-cy:+.4f}, {-cz:+.4f})")

import mathutils
shift = mathutils.Matrix.Translation((-cx, -cy, -cz))
for obj in meshes:
    obj.data.transform(shift)
    obj.data.update()

# ── Step 2b: Uniform scale so native width matches casement's ──
# After centering, the awning is roughly 0.60 × 0.30. We scale uniformly
# so that width becomes 0.7621 (matches CasementWindow_Rigged_v2.glb's
# native width). Height and depth scale proportionally — the rest-pose
# height ends up around 0.38, which is irrelevant because the viewer
# always re-poses the bones for the user's actual cell size.
current_width = max_x - min_x
scale_factor = TARGET_NATIVE_WIDTH / current_width if current_width > 0 else 1.0
print(f"Scaling uniformly by {scale_factor:.4f}× to match casement native width "
      f"({TARGET_NATIVE_WIDTH:.4f} m)")
scale_mat = mathutils.Matrix.Scale(scale_factor, 4)
for obj in meshes:
    obj.data.transform(scale_mat)
    obj.data.update()

# Recompute bounds after centering + scaling.
all_verts = []
for obj in meshes:
    for v in obj.data.vertices:
        all_verts.append(obj.matrix_world @ v.co)
min_x = min(v.x for v in all_verts); max_x = max(v.x for v in all_verts)
min_y = min(v.y for v in all_verts); max_y = max(v.y for v in all_verts)
min_z = min(v.z for v in all_verts); max_z = max(v.z for v in all_verts)
width = max_x - min_x
height = max_z - min_z
depth_center = (min_y + max_y) / 2.0

print(f"Post-center+scale bounds: X[{min_x:+.4f},{max_x:+.4f}] "
      f"Y[{min_y:+.4f},{max_y:+.4f}] Z[{min_z:+.4f},{max_z:+.4f}]")
print(f"Width: {width:.4f}, Height: {height:.4f}, Y-mid: {depth_center:.4f}")

# ── Step 3: Build armature with 4 corner bones ──
bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
armature_obj = bpy.context.active_object
armature_obj.name = 'WindowArmature'
armature = armature_obj.data
armature.name = 'WindowArmatureData'
for bone in list(armature.edit_bones):
    armature.edit_bones.remove(bone)

BONE_LEN = 0.05
bone_positions = {
    'Ctrl_Down_Left':  (min_x, depth_center, min_z),
    'Ctrl_Down_Right': (max_x, depth_center, min_z),
    'Ctrl_Top_Left':   (min_x, depth_center, max_z),
    'Ctrl_Top_Right':  (max_x, depth_center, max_z),
}
for name, (bx, by, bz) in bone_positions.items():
    bone = armature.edit_bones.new(name)
    bone.head = (bx, by, bz)
    bone.tail = (bx, by, bz + BONE_LEN)
    bone.use_deform = True
    print(f"  Bone {name}: ({bx:+.4f}, {by:+.4f}, {bz:+.4f})")
bpy.ops.object.mode_set(mode='OBJECT')

# ── Step 4: Weight paint and parent ──
# Hardware detection: only meshes whose name *clearly* indicates an
# operable handle/crank/lock get the bottom-bar slide treatment. The
# awning source uses "Handle Body.*" for frame parts (24K+ verts), so
# we additionally require the mesh to be small (< 1000 verts) before
# we treat it as hardware.
HARDWARE_KEYWORDS = ('handle', 'lock', 'latch', 'crank')

def is_hardware_mesh(obj):
    n = obj.name.lower()
    if not any(k in n for k in HARDWARE_KEYWORDS):
        return False
    return len(obj.data.vertices) < 1000

def is_glass_mesh(obj):
    """A mesh whose first material flags glass (transparent / 'glass'
    in the material name) AND has a small vertex count."""
    if len(obj.data.vertices) > 200:
        return False
    for slot in obj.material_slots:
        m = slot.material
        if not m:
            continue
        nm = m.name.lower()
        if 'glass' in nm or '245' in nm:
            return True
        if hasattr(m, 'diffuse_color') and len(m.diffuse_color) >= 4 and m.diffuse_color[3] < 0.95:
            return True
    return False

for obj in meshes:
    is_hw = is_hardware_mesh(obj)
    is_gl = is_glass_mesh(obj)
    label = "HARDWARE" if is_hw else ("GLASS" if is_gl else "FRAME")
    print(f"\nWeighting '{obj.name}' ({label}, {len(obj.data.vertices)} verts)")

    for bn in BONE_NAMES:
        if bn not in obj.vertex_groups:
            obj.vertex_groups.new(name=bn)
    vg_dl = obj.vertex_groups['Ctrl_Down_Left']
    vg_dr = obj.vertex_groups['Ctrl_Down_Right']
    vg_tl = obj.vertex_groups['Ctrl_Top_Left']
    vg_tr = obj.vertex_groups['Ctrl_Top_Right']
    groups = [vg_dl, vg_dr, vg_tl, vg_tr]

    for v in obj.data.vertices:
        world_pos = obj.matrix_world @ v.co
        nx = (world_pos.x - min_x) / width if width > 0 else 0.5
        nz = (world_pos.z - min_z) / height if height > 0 else 0.5
        nx = max(0.0, min(1.0, nx))
        nz = max(0.0, min(1.0, nz))

        if is_gl:
            # Pure bilinear regardless of position — glass always
            # stretches uniformly.
            dl = (1.0 - nx) * (1.0 - nz)
            dr = nx * (1.0 - nz)
            tl = (1.0 - nx) * nz
            tr = nx * nz
            weights = (dl, dr, tl, tr)
        else:
            weights = compute_weights(nx, nz, is_hardware=is_hw)

        for i, w in enumerate(weights):
            if w > 0.001:
                groups[i].add([v.index], w, 'REPLACE')
            else:
                groups[i].remove([v.index])

    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    armature_obj.select_set(True)
    bpy.context.view_layer.objects.active = armature_obj
    bpy.ops.object.parent_set(type='ARMATURE_NAME')
    bpy.ops.object.select_all(action='DESELECT')

# ── Step 5: Validation — move TR bone, check deformation ──
print("\n── Validation: TR bone +0.2X / +0.2Z ──")
bpy.context.view_layer.objects.active = armature_obj
bpy.ops.object.mode_set(mode='POSE')
tr_pose = armature_obj.pose.bones.get('Ctrl_Top_Right')
if tr_pose:
    tr_pose.location = (0.2, 0, 0.2)
    bpy.context.view_layer.update()
    for obj in meshes:
        depsgraph = bpy.context.evaluated_depsgraph_get()
        eval_obj = obj.evaluated_get(depsgraph)
        eval_mesh = eval_obj.to_mesh()
        if eval_mesh:
            ev = [eval_obj.matrix_world @ v.co for v in eval_mesh.vertices]
            ov = [obj.matrix_world @ v.co for v in obj.data.vertices]
            dx = max(v.x for v in ev) - max(v.x for v in ov)
            dz = max(v.z for v in ev) - max(v.z for v in ov)
            print(f"  {obj.name}: max_x +{dx:.4f}, max_z +{dz:.4f}")
            eval_obj.to_mesh_clear()
    tr_pose.location = (0, 0, 0)
    bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode='OBJECT')

# ── Step 6: Export ──
print(f"\n── Exporting → {OUTPUT_PATH} ──")
bpy.ops.export_scene.gltf(
    filepath=OUTPUT_PATH,
    export_format='GLB',
    export_skins=True,
    export_animations=False,
    export_apply=False,
    use_active_collection=False,
)

if os.path.exists(OUTPUT_PATH):
    file_size = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)
    print(f"✓ Exported: {file_size:.2f} MB")
else:
    print("✗ Export FAILED")

print("\n── Three.js (Y-up) rest bone positions ──")
for name, (bx, by, bz) in bone_positions.items():
    print(f"  {name}: ({bx:+.4f}, {bz:+.4f}, {-by:+.4f})")
print(f"width={width:.4f}, height={height:.4f}, FT_X={FT_X}, FT_Z={FT_Z}")
print("DONE!")
