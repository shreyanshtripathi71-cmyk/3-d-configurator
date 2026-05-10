"""
Import the artist's casement.fbx (high-quality Maya-rigged casement),
clean it up, and export it as the new
public/windows/casement/components/CasementWindow_Rigged_v2.glb.

Cleanup:
  * Drop the unparented `Handle_Center` floater (Maya viewport gizmo).
  * Rename bones from `Ctrl_*_JT` → `Ctrl_*` so the names match the
    rest of the rigged pipeline (rig_casement_v2.py / WindowViewer.tsx).
  * Rename matching vertex groups on every mesh.
  * Apply all transforms (bakes the 0.01 Maya scale and 90° rotation
    into the mesh data → identity transforms in the exported GLB).
  * Centre the model at world origin.
  * Uniformly scale so native width = 0.7621 m (matches casement-v2
    standard so the viewer's clone-scale math works unchanged).

Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
      --python scripts/import_artist_casement.py
"""
import bpy
import mathutils
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
FBX_PATH = os.path.join(PROJECT_DIR, 'casement.fbx')
OUTPUT_PATH = os.path.join(
    PROJECT_DIR, 'public', 'windows', 'casement', 'components',
    'CasementWindow_Rigged_v2.glb')

TARGET_NATIVE_WIDTH = 0.7621  # matches casement-v2 standard

BONE_RENAMES = {
    'Ctrl_Top_Left_JT':   'Ctrl_Top_Left',
    'Ctrl_Top_Right_JT':  'Ctrl_Top_Right',
    'Ctrl_Down_Left_JT':  'Ctrl_Down_Left',
    'Ctrl_Down_Right_JT': 'Ctrl_Down_Right',
}

DROP_OBJECTS = {'Handle_Center'}

print("=" * 60)
print("IMPORTING ARTIST CASEMENT  →  CasementWindow_Rigged_v2.glb")
print("=" * 60)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=FBX_PATH)

# ── Step 1: Drop floater objects ──
for name in list(DROP_OBJECTS):
    obj = bpy.data.objects.get(name)
    if obj:
        print(f"Dropping unparented object: {name!r}")
        bpy.data.objects.remove(obj, do_unlink=True)

# ── Step 2: Rename bones in the armature ──
armature_obj = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
if not armature_obj:
    raise RuntimeError("No armature found in casement.fbx")
print(f"\nArmature: {armature_obj.name!r}")

bpy.context.view_layer.objects.active = armature_obj
bpy.ops.object.mode_set(mode='EDIT')
for old_name, new_name in BONE_RENAMES.items():
    eb = armature_obj.data.edit_bones.get(old_name)
    if eb:
        print(f"  Bone rename: {old_name!r} → {new_name!r}")
        eb.name = new_name
    else:
        print(f"  WARN: bone {old_name!r} not found")
bpy.ops.object.mode_set(mode='OBJECT')

# ── Step 3: Rename matching vertex groups on every mesh ──
print("\nRenaming vertex groups on meshes…")
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for obj in meshes:
    for old_name, new_name in BONE_RENAMES.items():
        vg = obj.vertex_groups.get(old_name)
        if vg:
            vg.name = new_name
            print(f"  {obj.name}: {old_name!r} → {new_name!r}")

# ── Step 4: First bake — apply Maya scale + rotation into mesh+bone data ──
# Select armature + all meshes, apply transforms once. After this, the
# armature is at origin with identity transform and bones are at their
# real-world positions in armature-local space.
bpy.ops.object.select_all(action='DESELECT')
armature_obj.select_set(True)
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = armature_obj
print("\n[bake 1/2] Applying Maya scale + rotation into mesh + bone data…")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.select_all(action='DESELECT')

# ── Step 5: Compute bounds, then centre + uniform-scale via the armature
#           object transform (so meshes AND bones follow consistently) ──
all_verts = []
for obj in meshes:
    for v in obj.data.vertices:
        all_verts.append(obj.matrix_world @ v.co)
if not all_verts:
    raise RuntimeError("No mesh vertices after import — empty model?")

min_x = min(v.x for v in all_verts); max_x = max(v.x for v in all_verts)
min_y = min(v.y for v in all_verts); max_y = max(v.y for v in all_verts)
min_z = min(v.z for v in all_verts); max_z = max(v.z for v in all_verts)
print(f"Post-bake bounds: X[{min_x:+.4f},{max_x:+.4f}] "
      f"Y[{min_y:+.4f},{max_y:+.4f}] Z[{min_z:+.4f},{max_z:+.4f}]")

cx = (min_x + max_x) / 2.0
cy = (min_y + max_y) / 2.0
cz = (min_z + max_z) / 2.0
current_width = max_x - min_x
scale_factor = TARGET_NATIVE_WIDTH / current_width if current_width > 0 else 1.0

print(f"Centering offset: ({-cx:+.4f}, {-cy:+.4f}, {-cz:+.4f})")
print(f"Uniform scale ×{scale_factor:.4f} "
      f"({current_width:.4f}m → {TARGET_NATIVE_WIDTH:.4f}m)")

# Apply the centre+scale through the armature OBJECT transform. Meshes
# are parented to the armature so they inherit the transform, then the
# second bake collapses everything into clean mesh+bone data.
armature_obj.location = (-cx * scale_factor, -cy * scale_factor, -cz * scale_factor)
armature_obj.scale = (scale_factor, scale_factor, scale_factor)

# ── Step 6: Second bake — apply centering+scaling into mesh + bone data ──
bpy.ops.object.select_all(action='DESELECT')
armature_obj.select_set(True)
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = armature_obj
print("[bake 2/2] Applying centre + scale into mesh + bone data…")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.select_all(action='DESELECT')

arm_data = armature_obj.data

# Recompute final bounds.
all_verts = []
for obj in meshes:
    for v in obj.data.vertices:
        all_verts.append(obj.matrix_world @ v.co)
min_x = min(v.x for v in all_verts); max_x = max(v.x for v in all_verts)
min_y = min(v.y for v in all_verts); max_y = max(v.y for v in all_verts)
min_z = min(v.z for v in all_verts); max_z = max(v.z for v in all_verts)
print(f"\nFinal bounds: X[{min_x:+.4f},{max_x:+.4f}] "
      f"Y[{min_y:+.4f},{max_y:+.4f}] Z[{min_z:+.4f},{max_z:+.4f}]")
print(f"Width: {max_x-min_x:.4f}, Height: {max_z-min_z:.4f}, "
      f"Depth: {max_y-min_y:.4f}")

# ── Step 6: Verify bones land at the corners ──
print("\nFinal bone rest positions (should sit at the 4 corners):")
for b in arm_data.bones:
    head = b.head_local
    print(f"  {b.name:<20} head=({head.x:+.4f}, {head.y:+.4f}, {head.z:+.4f})")

# ── Step 7: Sanity test — move TR bone, verify deformation ──
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
            print(f"  {obj.name}: max_x +{dx:+.4f}, max_z +{dz:+.4f}")
            eval_obj.to_mesh_clear()
    tr_pose.location = (0, 0, 0)
    bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode='OBJECT')

# ── Step 8: Export as GLB ──
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
    sz = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)
    print(f"✓ Exported: {sz:.2f} MB")
else:
    print("✗ Export FAILED")

print("DONE!")
