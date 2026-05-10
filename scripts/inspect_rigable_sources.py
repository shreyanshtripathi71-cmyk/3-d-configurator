"""Inspect the source models for the rig-able single-frame window types
(picture, high-fix, fixed) so we know what the generic rig script has to
deal with."""
import bpy
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)


def inspect(label, src_path):
    print("\n" + "=" * 60)
    print(f"INSPECTING: {label}  ({src_path})")
    print("=" * 60)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if not os.path.exists(src_path):
        print(f"FILE NOT FOUND: {src_path}")
        return
    try:
        if src_path.endswith('.fbx'):
            bpy.ops.import_scene.fbx(filepath=src_path)
        else:
            bpy.ops.import_scene.gltf(filepath=src_path)
    except Exception as e:
        print(f"Import FAILED: {e}")
        return

    objs = list(bpy.data.objects)
    armatures = [o for o in objs if o.type == 'ARMATURE']
    meshes = [o for o in objs if o.type == 'MESH']
    print(f"Objects: {len(objs)} total ({len(meshes)} meshes, {len(armatures)} armatures)")

    has_non_identity = False
    for obj in objs[:25]:
        loc = tuple(round(v, 4) for v in obj.location)
        rot = tuple(round(v, 4) for v in obj.rotation_euler)
        sca = tuple(round(v, 4) for v in obj.scale)
        if any(v != 0 for v in loc) or any(v != 0 for v in rot) or any(v != 1 for v in sca):
            has_non_identity = True
        parent = obj.parent.name if obj.parent else "<none>"
        print(f"  {obj.type:<8} {obj.name!r:<40} parent={parent!r}  "
              f"loc={loc} rot={rot} scale={sca}")

    if has_non_identity:
        print("  ⚠ has non-identity object transforms (will need transform_apply)")

    total_min = [float('inf')] * 3
    total_max = [float('-inf')] * 3
    for obj in meshes:
        if not obj.data.vertices:
            continue
        coords = [obj.matrix_world @ v.co for v in obj.data.vertices]
        for c in coords:
            for i, axis in enumerate((c.x, c.y, c.z)):
                total_min[i] = min(total_min[i], axis)
                total_max[i] = max(total_max[i], axis)

    if total_min[0] == float('inf'):
        print("(no mesh data)")
        return

    dims = [total_max[i] - total_min[i] for i in range(3)]
    labels = ['X', 'Y', 'Z']
    print(f"\nWorld bounds:")
    for i in range(3):
        print(f"  {labels[i]}[{total_min[i]:+.4f},{total_max[i]:+.4f}]  size={dims[i]:.4f}")

    sorted_axes = sorted(zip(labels, dims), key=lambda x: -x[1])
    print(f"  Dominant: {sorted_axes[0][0]}={sorted_axes[0][1]:.3f}, "
          f"{sorted_axes[1][0]}={sorted_axes[1][1]:.3f}, "
          f"{sorted_axes[2][0]}={sorted_axes[2][1]:.3f}")

    is_centered = all(abs(total_min[i] + total_max[i]) < 0.001 for i in range(3))
    print(f"  Centered at origin: {'yes' if is_centered else 'NO (needs centering)'}")


inspect("PICTURE",  os.path.join(PROJECT_DIR, 'public', 'windows', 'picture', 'PictureWindow_Model_1.gltf'))
inspect("HIGH-FIX", os.path.join(PROJECT_DIR, 'public', 'windows', 'high-fix', 'HighFixWindow_DoubleGlazing.gltf'))
print("\nDONE")
