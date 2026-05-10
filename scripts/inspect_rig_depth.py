"""Load both rigged GLBs and report mesh bounds + transforms in their
armature-root-local space — so we can see exactly what the WindowViewer
sees in measureBindMap."""
import bpy
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)


def inspect_glb(label, path):
    print("\n" + "=" * 60)
    print(f"INSPECTING (in three.js Y-up convention): {label}")
    print(f"  {path}")
    print("=" * 60)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)

    # Find armature
    armature_objs = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    print(f"Armatures: {[a.name for a in armature_objs]}")
    if armature_objs:
        arm = armature_objs[0]
        print(f"  arm.location = {tuple(round(v,4) for v in arm.location)}")
        print(f"  arm.scale    = {tuple(round(v,4) for v in arm.scale)}")
        for b in arm.data.bones:
            head = b.head_local
            print(f"  bone {b.name:<20} head=({head.x:+.4f}, {head.y:+.4f}, {head.z:+.4f})")

    # In Blender (Z-up), depth is along Y axis.
    # In three.js (Y-up after GLTF), depth is along Z axis (sign flipped).
    # So three.js Z range = (-blender_max_Y, -blender_min_Y).

    print("\nMeshes:")
    blender_y_min = float('inf')
    blender_y_max = float('-inf')
    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue
        loc = tuple(round(v, 4) for v in obj.location)
        rot = tuple(round(v, 4) for v in obj.rotation_euler)
        sca = tuple(round(v, 4) for v in obj.scale)
        print(f"  {obj.name!r}: loc={loc} rot={rot} scale={sca}")

        if not obj.data.vertices:
            continue
        # Both raw mesh-local and world bounds
        local_min_y = min(v.co.y for v in obj.data.vertices)
        local_max_y = max(v.co.y for v in obj.data.vertices)
        world_coords = [obj.matrix_world @ v.co for v in obj.data.vertices]
        wmin_y = min(c.y for c in world_coords)
        wmax_y = max(c.y for c in world_coords)
        blender_y_min = min(blender_y_min, wmin_y)
        blender_y_max = max(blender_y_max, wmax_y)
        print(f"     blender Y (depth):  local=[{local_min_y:+.4f},{local_max_y:+.4f}]  "
              f"world=[{wmin_y:+.4f},{wmax_y:+.4f}]")

    print(f"\nOverall Blender Y range: [{blender_y_min:+.4f}, {blender_y_max:+.4f}]")
    print(f"  → three.js Z range (= -Blender Y, reordered): "
          f"[{-blender_y_max:+.4f}, {-blender_y_min:+.4f}]")
    print(f"  → three.js Z centre = {(-blender_y_max + -blender_y_min) / 2:+.4f}")
    print(f"  → three.js Z front  = {-blender_y_min:+.4f}  (= -Blender min Y)")


inspect_glb("CASEMENT", os.path.join(PROJECT_DIR, 'public', 'windows', 'casement', 'components', 'CasementWindow_Rigged_v2.glb'))
inspect_glb("PICTURE",  os.path.join(PROJECT_DIR, 'public', 'windows', 'picture',   'PictureWindow_Rigged_v2.glb'))
print("\nDONE")
