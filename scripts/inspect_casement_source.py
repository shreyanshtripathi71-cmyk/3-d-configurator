"""Deep inspection of source CasementWindow.gltf - hierarchy, transforms, bounds."""
import bpy
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
GLTF = os.path.join(PROJECT_DIR, 'public', 'windows', 'casement', 'CasementWindow.gltf')

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLTF)

print(f"\n{'='*80}\nSOURCE CASEMENT GLTF INSPECTION\n{'='*80}\n")

print("HIERARCHY (raw, with transforms):")
def print_tree(obj, depth=0):
    indent = "  " * depth
    loc = tuple(round(v, 4) for v in obj.location)
    rot = tuple(round(v, 4) for v in obj.rotation_quaternion) if obj.rotation_mode == 'QUATERNION' else \
          tuple(round(v, 4) for v in obj.rotation_euler)
    sca = tuple(round(v, 4) for v in obj.scale)
    print(f"{indent}{obj.type:8s} {obj.name!r}")
    print(f"{indent}  loc={loc}  rot={rot}  scale={sca}")
    if obj.type == 'MESH':
        coords = [v.co for v in obj.data.vertices]
        if coords:
            mn = (min(c.x for c in coords), min(c.y for c in coords), min(c.z for c in coords))
            mx = (max(c.x for c in coords), max(c.y for c in coords), max(c.z for c in coords))
            print(f"{indent}  local bounds X[{mn[0]:+.4f},{mx[0]:+.4f}] Y[{mn[1]:+.4f},{mx[1]:+.4f}] Z[{mn[2]:+.4f},{mx[2]:+.4f}]")
        wcoords = [obj.matrix_world @ v.co for v in obj.data.vertices]
        if wcoords:
            mn = (min(c.x for c in wcoords), min(c.y for c in wcoords), min(c.z for c in wcoords))
            mx = (max(c.x for c in wcoords), max(c.y for c in wcoords), max(c.z for c in wcoords))
            print(f"{indent}  world bounds X[{mn[0]:+.4f},{mx[0]:+.4f}] Y[{mn[1]:+.4f},{mx[1]:+.4f}] Z[{mn[2]:+.4f},{mx[2]:+.4f}]")
            print(f"{indent}  world size = ({mx[0]-mn[0]:.4f}, {mx[1]-mn[1]:.4f}, {mx[2]-mn[2]:.4f})")
    for ch in obj.children:
        print_tree(ch, depth + 1)

roots = [o for o in bpy.data.objects if o.parent is None]
for r in roots:
    print_tree(r)

# After applying all transforms (including parent), what do the bounds look like?
print("\n" + "="*80)
print("AFTER FLATTENING TRANSFORMS (parent_clear KEEP_TRANSFORM + transform_apply)")
print("="*80)

bpy.ops.object.select_all(action='DESELECT')
mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH']
for m in mesh_objs:
    m.select_set(True)
    bpy.context.view_layer.objects.active = m
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Now delete empties
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type == 'EMPTY':
        o.select_set(True)
bpy.ops.object.delete()

print(f"\nRemaining objects: {len(bpy.data.objects)}")
all_min = [float('inf')]*3
all_max = [float('-inf')]*3
for m in [o for o in bpy.data.objects if o.type == 'MESH']:
    coords = [m.matrix_world @ v.co for v in m.data.vertices]
    mn = (min(c.x for c in coords), min(c.y for c in coords), min(c.z for c in coords))
    mx = (max(c.x for c in coords), max(c.y for c in coords), max(c.z for c in coords))
    print(f"\n  {m.name!r}  ({len(m.data.vertices)} verts)")
    print(f"    materials: {[mat.name for mat in m.data.materials]}")
    print(f"    world X[{mn[0]:+.4f},{mx[0]:+.4f}] size={mx[0]-mn[0]:.4f}")
    print(f"    world Y[{mn[1]:+.4f},{mx[1]:+.4f}] size={mx[1]-mn[1]:.4f}")
    print(f"    world Z[{mn[2]:+.4f},{mx[2]:+.4f}] size={mx[2]-mn[2]:.4f}")
    for i in range(3):
        all_min[i] = min(all_min[i], (mn[0], mn[1], mn[2])[i])
        all_max[i] = max(all_max[i], (mx[0], mx[1], mx[2])[i])

print(f"\nOVERALL world bounds:")
print(f"  X[{all_min[0]:+.4f},{all_max[0]:+.4f}] size={all_max[0]-all_min[0]:.4f}")
print(f"  Y[{all_min[1]:+.4f},{all_max[1]:+.4f}] size={all_max[1]-all_min[1]:.4f}")
print(f"  Z[{all_min[2]:+.4f},{all_max[2]:+.4f}] size={all_max[2]-all_min[2]:.4f}")
center = ((all_min[0]+all_max[0])/2, (all_min[1]+all_max[1])/2, (all_min[2]+all_max[2])/2)
print(f"  center: ({center[0]:+.4f}, {center[1]:+.4f}, {center[2]:+.4f})")

print(f"\n{'='*80}\nDONE\n{'='*80}\n")
