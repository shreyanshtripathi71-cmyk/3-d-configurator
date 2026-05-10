"""Inspect casement.fbx and grilles.fbx — meshes, armature, materials,
bounds — so we can decide how to integrate them."""
import bpy
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)


def inspect(label, fbx_path):
    print("\n" + "=" * 60)
    print(f"INSPECTING: {label}  ({fbx_path})")
    print("=" * 60)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.ops.import_scene.fbx(filepath=fbx_path)
    except Exception as e:
        print(f"FBX import FAILED: {e}")
        return

    print("\nObjects:")
    for obj in bpy.data.objects:
        parent = obj.parent.name if obj.parent else "<none>"
        print(f"  {obj.type:<8} {obj.name!r:<40} parent={parent!r}")
        loc = tuple(round(v, 4) for v in obj.location)
        rot = tuple(round(v, 4) for v in obj.rotation_euler)
        sca = tuple(round(v, 4) for v in obj.scale)
        print(f"           loc={loc}  rot={rot}  scale={sca}")
        if obj.type == 'ARMATURE':
            arm = obj.data
            print(f"           bones ({len(arm.bones)}):")
            for b in arm.bones:
                print(f"             - {b.name!r:<30} parent={b.parent.name if b.parent else '-'}")
        if obj.type == 'MESH' and obj.modifiers:
            for m in obj.modifiers:
                tgt = getattr(m, 'object', None)
                tgt_name = tgt.name if tgt else '-'
                print(f"           modifier: {m.type} target={tgt_name!r}")
        if obj.type == 'MESH':
            vgs = [vg.name for vg in obj.vertex_groups]
            if vgs:
                print(f"           vertex groups: {vgs}")

    print("\nMesh bounds (world):")
    total_min = [float('inf')] * 3
    total_max = [float('-inf')] * 3
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    for obj in meshes:
        if not obj.data.vertices:
            continue
        coords = [obj.matrix_world @ v.co for v in obj.data.vertices]
        mn = (min(c.x for c in coords), min(c.y for c in coords), min(c.z for c in coords))
        mx = (max(c.x for c in coords), max(c.y for c in coords), max(c.z for c in coords))
        for i in range(3):
            total_min[i] = min(total_min[i], mn[i])
            total_max[i] = max(total_max[i], mx[i])
        mats = [s.material.name if s.material else "None" for s in obj.material_slots]
        print(f"  {obj.name!r}: verts={len(obj.data.vertices)} mats={mats}")
        print(f"     X[{mn[0]:+.4f},{mx[0]:+.4f}] "
              f"Y[{mn[1]:+.4f},{mx[1]:+.4f}] "
              f"Z[{mn[2]:+.4f},{mx[2]:+.4f}]")

    if total_min[0] == float('inf'):
        print("  (no mesh data)")
        return
    print("\nOverall bounds:")
    for i, label_axis in enumerate(['X', 'Y', 'Z']):
        print(f"  {label_axis}[{total_min[i]:+.4f},{total_max[i]:+.4f}]  "
              f"size={total_max[i]-total_min[i]:.4f}")

    print("\nMaterials:")
    for mat in bpy.data.materials:
        col = tuple(round(c, 3) for c in mat.diffuse_color) if hasattr(mat, 'diffuse_color') else None
        print(f"  {mat.name!r}  diffuse={col}  use_nodes={mat.use_nodes}")


inspect("CASEMENT", os.path.join(PROJECT_DIR, 'casement.fbx'))
inspect("GRILLES",  os.path.join(PROJECT_DIR, 'grilles.fbx'))
print("\nDONE")
