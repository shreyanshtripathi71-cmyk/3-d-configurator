"""
Blender script: Rig CasementWindow.gltf with 4 corner control bones.
Frame vertices get edge-only weights (slide but don't deform).
Glass vertices get bilinear weights (stretch proportionally).
Handle vertices get left-frame weights (move with left bar).

Run: /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/rig_casement_v2.py
"""
import bpy
import os
import mathutils

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
GLTF_PATH = os.path.join(PROJECT_DIR, 'public', 'windows', 'casement', 'CasementWindow.gltf')
OUTPUT_PATH = os.path.join(PROJECT_DIR, 'public', 'windows', 'casement', 'components', 'CasementWindow_Rigged_v2.glb')

# Frame zone threshold (fraction of each dimension that is "frame")
FT_X = 0.12   # ~12% of width on each side
FT_Z = 0.06   # ~6% of height on each side

BONE_NAMES = ['Ctrl_Down_Left', 'Ctrl_Down_Right', 'Ctrl_Top_Left', 'Ctrl_Top_Right']


def compute_weights(nx, nz, is_hardware=False):
    """Compute (DL, DR, TL, TR) weights for vertex at normalized pos (nx, nz)."""
    if is_hardware:
        # Handle on left frame bar: weight to DL+TL based on height
        return (1.0 - nz, 0.0, nz, 0.0)

    in_left   = nx < FT_X
    in_right  = nx > (1.0 - FT_X)
    in_bottom = nz < FT_Z
    in_top    = nz > (1.0 - FT_Z)

    # Corners
    if in_left and in_bottom:  return (1.0, 0.0, 0.0, 0.0)
    if in_right and in_bottom: return (0.0, 1.0, 0.0, 0.0)
    if in_left and in_top:     return (0.0, 0.0, 1.0, 0.0)
    if in_right and in_top:    return (0.0, 0.0, 0.0, 1.0)

    # Edge zones (frame bars — slide, don't stretch)
    if in_left:
        t = max(0, min(1, (nz - FT_Z) / max(1.0 - 2*FT_Z, 0.001)))
        return (1.0 - t, 0.0, t, 0.0)
    if in_right:
        t = max(0, min(1, (nz - FT_Z) / max(1.0 - 2*FT_Z, 0.001)))
        return (0.0, 1.0 - t, 0.0, t)
    if in_bottom:
        t = max(0, min(1, (nx - FT_X) / max(1.0 - 2*FT_X, 0.001)))
        return (1.0 - t, t, 0.0, 0.0)
    if in_top:
        t = max(0, min(1, (nx - FT_X) / max(1.0 - 2*FT_X, 0.001)))
        return (0.0, 0.0, 1.0 - t, t)

    # Center zone (glass — bilinear stretch)
    inner_nx = max(0, min(1, (nx - FT_X) / max(1.0 - 2*FT_X, 0.001)))
    inner_nz = max(0, min(1, (nz - FT_Z) / max(1.0 - 2*FT_Z, 0.001)))
    dl = (1.0 - inner_nx) * (1.0 - inner_nz)
    dr = inner_nx * (1.0 - inner_nz)
    tl = (1.0 - inner_nx) * inner_nz
    tr = inner_nx * inner_nz
    return (dl, dr, tl, tr)


# ── Step 1: Clear and Import ──
print("=" * 60)
print("RIGGING CASEMENT WINDOW")
print("=" * 60)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLTF_PATH)

# ── Step 2: Find meshes, apply transforms, compute bounds ──
meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH']
print(f"\nFound {len(meshes)} meshes: {[m.name for m in meshes]}")

# Apply transforms so vertices are in consistent world space
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.select_all(action='DESELECT')

# Compute world-space bounds (Blender Z-up: X=width, Z=height, Y=depth)
all_verts = []
for obj in meshes:
    for v in obj.data.vertices:
        all_verts.append(obj.matrix_world @ v.co)

min_x = min(v.x for v in all_verts)
max_x = max(v.x for v in all_verts)
min_y = min(v.y for v in all_verts)
max_y = max(v.y for v in all_verts)
min_z = min(v.z for v in all_verts)
max_z = max(v.z for v in all_verts)

width = max_x - min_x
height = max_z - min_z
depth_center = (min_y + max_y) / 2.0

print(f"Bounds: X[{min_x:.4f}, {max_x:.4f}] Z[{min_z:.4f}, {max_z:.4f}]")
print(f"Width: {width:.4f}, Height: {height:.4f}")

# ── Step 3: Create Armature with 4 corner bones ──
bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
armature_obj = bpy.context.active_object
armature_obj.name = 'WindowArmature'
armature = armature_obj.data
armature.name = 'WindowArmatureData'

# Remove default bone
for bone in list(armature.edit_bones):
    armature.edit_bones.remove(bone)

# Place bones at window corners (Blender Z-up coords)
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
    print(f"  Bone {name}: ({bx:.4f}, {by:.4f}, {bz:.4f})")

bpy.ops.object.mode_set(mode='OBJECT')

# ── Step 4: Parent each mesh to armature and weight paint ──
for obj in meshes:
    name_lower = obj.name.lower()
    is_hardware = 'handle' in name_lower or 'lock' in name_lower or 'latch' in name_lower
    mesh_type = "HARDWARE" if is_hardware else "FRAME/GLASS"
    print(f"\nWeighting mesh '{obj.name}' ({mesh_type}, {len(obj.data.vertices)} verts)")

    # Create vertex groups
    for bn in BONE_NAMES:
        if bn not in obj.vertex_groups:
            obj.vertex_groups.new(name=bn)

    vg_dl = obj.vertex_groups['Ctrl_Down_Left']
    vg_dr = obj.vertex_groups['Ctrl_Down_Right']
    vg_tl = obj.vertex_groups['Ctrl_Top_Left']
    vg_tr = obj.vertex_groups['Ctrl_Top_Right']
    groups = [vg_dl, vg_dr, vg_tl, vg_tr]

    # Weight paint each vertex
    for v in obj.data.vertices:
        world_pos = obj.matrix_world @ v.co
        # Normalize to [0, 1]
        nx = (world_pos.x - min_x) / width if width > 0 else 0.5
        nz = (world_pos.z - min_z) / height if height > 0 else 0.5
        nx = max(0.0, min(1.0, nx))
        nz = max(0.0, min(1.0, nz))

        weights = compute_weights(nx, nz, is_hardware=is_hardware)

        for i, w in enumerate(weights):
            if w > 0.001:
                groups[i].add([v.index], w, 'REPLACE')
            else:
                groups[i].remove([v.index])

    # Parent to armature (preserve transforms)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    armature_obj.select_set(True)
    bpy.context.view_layer.objects.active = armature_obj
    bpy.ops.object.parent_set(type='ARMATURE_NAME')
    bpy.ops.object.select_all(action='DESELECT')

    print(f"  ✓ Parented to armature with weight groups")

# ── Step 5: Quick validation — move TR bone and check deformation ──
print("\n── Validation: testing bone movement ──")
bpy.context.view_layer.objects.active = armature_obj
bpy.ops.object.mode_set(mode='POSE')
tr_pose = armature_obj.pose.bones.get('Ctrl_Top_Right')
if tr_pose:
    # Move TR bone 0.2 units right and up
    tr_pose.location = (0.2, 0, 0.2)
    bpy.context.view_layer.update()

    # Check if meshes deformed
    for obj in meshes:
        depsgraph = bpy.context.evaluated_depsgraph_get()
        eval_obj = obj.evaluated_get(depsgraph)
        eval_mesh = eval_obj.to_mesh()
        if eval_mesh:
            eval_box = [eval_obj.matrix_world @ v.co for v in eval_mesh.vertices]
            eval_max_x = max(v.x for v in eval_box)
            eval_max_z = max(v.z for v in eval_box)
            orig_max_x = max((obj.matrix_world @ v.co).x for v in obj.data.vertices)
            orig_max_z = max((obj.matrix_world @ v.co).z for v in obj.data.vertices)
            dx = eval_max_x - orig_max_x
            dz = eval_max_z - orig_max_z
            print(f"  {obj.name}: max_x shifted {dx:.4f}, max_z shifted {dz:.4f}")
            eval_obj.to_mesh_clear()

    # Reset
    tr_pose.location = (0, 0, 0)
    bpy.context.view_layer.update()

bpy.ops.object.mode_set(mode='OBJECT')

# ── Step 6: Export as GLB ──
print(f"\n── Exporting to {OUTPUT_PATH} ──")
bpy.ops.export_scene.gltf(
    filepath=OUTPUT_PATH,
    export_format='GLB',
    export_skins=True,
    export_animations=False,
    export_apply=False,
    use_active_collection=False,
)

file_size = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)
print(f"✓ Exported: {file_size:.1f} MB")

# Print bone rest positions for Three.js reference
print("\n── Rest-pose bone positions (for Three.js) ──")
print(f"In Blender (Z-up):")
for name, pos in bone_positions.items():
    print(f"  {name}: ({pos[0]:.4f}, {pos[1]:.4f}, {pos[2]:.4f})")
print(f"In Three.js (Y-up):")
for name, (bx, by, bz) in bone_positions.items():
    print(f"  {name}: ({bx:.4f}, {bz:.4f}, {-by:.4f})")
print(f"\nRest dimensions: width={width:.4f}, height={height:.4f}")
print("DONE!")
