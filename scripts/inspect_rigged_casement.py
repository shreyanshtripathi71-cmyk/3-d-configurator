"""Inspect the current rigged casement GLB to understand its state."""
import bpy
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
GLB_PATH = os.path.join(PROJECT_DIR, 'public', 'windows', 'casement', 'components',
                        'CasementWindow_Rigged_v2.glb')

bpy.ops.wm.read_factory_settings(use_empty=True)
print(f"\n{'='*70}\nINSPECTING: {GLB_PATH}\n{'='*70}\n")
bpy.ops.import_scene.gltf(filepath=GLB_PATH)

armatures = [o for o in bpy.data.objects if o.type == 'ARMATURE']
meshes = [o for o in bpy.data.objects if o.type == 'MESH']

print(f"Armatures: {len(armatures)}")
for arm in armatures:
    print(f"\n  Armature: {arm.name!r}")
    print(f"    Location: {tuple(round(v,4) for v in arm.location)}")
    print(f"    Rotation: {tuple(round(v,4) for v in arm.rotation_euler)}")
    print(f"    Scale:    {tuple(round(v,4) for v in arm.scale)}")
    print(f"    Bones: {len(arm.data.bones)}")
    for bone in arm.data.bones:
        head = arm.matrix_world @ bone.head_local
        tail = arm.matrix_world @ bone.tail_local
        print(f"      {bone.name!r}: head=({head.x:+.4f},{head.y:+.4f},{head.z:+.4f}) "
              f"tail=({tail.x:+.4f},{tail.y:+.4f},{tail.z:+.4f})")

print(f"\nMeshes: {len(meshes)}")
for m in meshes:
    print(f"\n  Mesh: {m.name!r}")
    print(f"    Vertices: {len(m.data.vertices)}")
    print(f"    Materials: {[mat.name for mat in m.data.materials]}")
    print(f"    Vertex groups: {[g.name for g in m.vertex_groups]}")
    parent = m.parent.name if m.parent else 'None'
    print(f"    Parent: {parent}")
    mods = [(mod.name, mod.type) for mod in m.modifiers]
    print(f"    Modifiers: {mods}")

    coords = [m.matrix_world @ v.co for v in m.data.vertices]
    if coords:
        mn = (min(c.x for c in coords), min(c.y for c in coords), min(c.z for c in coords))
        mx = (max(c.x for c in coords), max(c.y for c in coords), max(c.z for c in coords))
        print(f"    World bounds X[{mn[0]:+.4f},{mx[0]:+.4f}] "
              f"Y[{mn[1]:+.4f},{mx[1]:+.4f}] Z[{mn[2]:+.4f},{mx[2]:+.4f}]")
        print(f"    Size XYZ: ({mx[0]-mn[0]:.4f}, {mx[1]-mn[1]:.4f}, {mx[2]-mn[2]:.4f})")

    # Sample weights
    if m.vertex_groups:
        weight_summary = {}
        for v in m.data.vertices:
            for g in v.groups:
                gname = m.vertex_groups[g.group].name
                weight_summary.setdefault(gname, []).append(g.weight)
        print("    Weight summary:")
        for gname, weights in weight_summary.items():
            print(f"      {gname!r}: {len(weights)} verts, "
                  f"avg={sum(weights)/len(weights):.3f}, "
                  f"max={max(weights):.3f}")

print(f"\n{'='*70}\nDONE\n{'='*70}\n")
