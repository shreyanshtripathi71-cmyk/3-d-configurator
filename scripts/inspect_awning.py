"""Quick inspection of AwningWindow.glb — reports mesh names, bounds,
parent chain, and any non-identity transforms so we know what the rig
script has to deal with."""
import bpy
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
GLB_PATH = os.path.join(PROJECT_DIR, 'public', 'windows', 'awning', 'AwningWindow.glb')

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB_PATH)

print("=" * 60)
print("AWNING WINDOW INSPECTION")
print("=" * 60)

print("\nAll objects:")
for obj in bpy.data.objects:
    parent = obj.parent.name if obj.parent else "<none>"
    print(f"  {obj.type:<8} {obj.name!r:<40} parent={parent!r}")
    print(f"           loc={tuple(round(v,4) for v in obj.location)} "
          f"rot={tuple(round(v,4) for v in obj.rotation_euler)} "
          f"scale={tuple(round(v,4) for v in obj.scale)}")

print("\nMeshes (world bounds):")
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
    print(f"     X[{mn[0]:+.4f},{mx[0]:+.4f}]  "
          f"Y[{mn[1]:+.4f},{mx[1]:+.4f}]  "
          f"Z[{mn[2]:+.4f},{mx[2]:+.4f}]")

print("\nOverall bounds:")
print(f"  X[{total_min[0]:+.4f},{total_max[0]:+.4f}]  size={total_max[0]-total_min[0]:.4f}")
print(f"  Y[{total_min[1]:+.4f},{total_max[1]:+.4f}]  size={total_max[1]-total_min[1]:.4f}")
print(f"  Z[{total_min[2]:+.4f},{total_max[2]:+.4f}]  size={total_max[2]-total_min[2]:.4f}")

dims = [total_max[i] - total_min[i] for i in range(3)]
sorted_axes = sorted(enumerate(dims), key=lambda x: -x[1])
labels = ['X', 'Y', 'Z']
print(f"\nDominant axes (largest first): "
      f"{labels[sorted_axes[0][0]]}={sorted_axes[0][1]:.3f}, "
      f"{labels[sorted_axes[1][0]]}={sorted_axes[1][1]:.3f}, "
      f"{labels[sorted_axes[2][0]]}={sorted_axes[2][1]:.3f}")
print("=" * 60)
