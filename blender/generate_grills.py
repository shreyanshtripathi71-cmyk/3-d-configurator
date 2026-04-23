"""
Blender script — Generate colonial grill for ALL bar types.
Same 2 vertical + 5 horizontal layout, exported as separate files
matching the naming convention: grill_colonial_{barType}.glb

Run: /Applications/Blender.app/Contents/MacOS/Blender --background --python generate_grills.py
"""

import bpy
import bmesh
import os

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'models', 'grills')
os.makedirs(OUT_DIR, exist_ok=True)

# Reference glass area
GLASS_W = 1.0   # Blender X → Three.js X
GLASS_H = 1.4   # Blender Z → Three.js Y

# Colonial: 2 vertical + 5 horizontal
V_COUNT = 2
H_COUNT = 5

# Bar profiles per type
BAR_PROFILES = {
    'flat':     {'width': 0.012, 'depth': 0.005},
    'georgian': {'width': 0.015, 'depth': 0.008},
    'pencil':   {'width': 0.006, 'depth': 0.006},
    'sdl':      {'width': 0.022, 'depth': 0.012},
}


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for m in bpy.data.meshes:
        bpy.data.meshes.remove(m)
    for m in bpy.data.materials:
        bpy.data.materials.remove(m)


def create_material():
    mat = bpy.data.materials.new(name='GrillWhite')
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (0.92, 0.92, 0.92, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.45
    return mat


def create_box(name, width_x, depth_y, height_z, pos_x, pos_y, pos_z, mat):
    """Create a box with exact dimensions using bmesh vertices."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()

    hx, hy, hz = width_x / 2, depth_y / 2, height_z / 2

    v = [
        bm.verts.new((-hx, -hy, -hz)),
        bm.verts.new(( hx, -hy, -hz)),
        bm.verts.new(( hx,  hy, -hz)),
        bm.verts.new((-hx,  hy, -hz)),
        bm.verts.new((-hx, -hy,  hz)),
        bm.verts.new(( hx, -hy,  hz)),
        bm.verts.new(( hx,  hy,  hz)),
        bm.verts.new((-hx,  hy,  hz)),
    ]

    bm.faces.new([v[0], v[1], v[2], v[3]])  # bottom
    bm.faces.new([v[4], v[7], v[6], v[5]])  # top
    bm.faces.new([v[0], v[3], v[7], v[4]])  # left
    bm.faces.new([v[1], v[5], v[6], v[2]])  # right
    bm.faces.new([v[0], v[4], v[5], v[1]])  # back
    bm.faces.new([v[3], v[2], v[6], v[7]])  # front

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = (pos_x, pos_y, pos_z)
    obj.data.materials.append(mat)

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    # Subtle bevel
    bevel = obj.modifiers.new(name='Bevel', type='BEVEL')
    bevel.width = 0.0003
    bevel.segments = 2
    bevel.limit_method = 'ANGLE'
    bpy.ops.object.modifier_apply(modifier='Bevel')
    bpy.ops.object.shade_smooth()
    obj.select_set(False)

    return obj


def build_colonial(bar_type):
    clear_scene()
    mat = create_material()
    profile = BAR_PROFILES[bar_type]
    bar_w = profile['width']
    bar_d = profile['depth']

    # Bars sit just in front of glass (positive Y in Blender = negative Z in Three.js → toward viewer)
    bar_y = bar_d / 2

    # VERTICAL bars: full height, thin in X
    for i in range(1, V_COUNT + 1):
        x = -GLASS_W / 2 + (GLASS_W / (V_COUNT + 1)) * i
        create_box(f'vbar_{i}', bar_w, bar_d, GLASS_H, x, bar_y, 0, mat)

    # HORIZONTAL bars: full width, thin in Z
    for i in range(1, H_COUNT + 1):
        z = -GLASS_H / 2 + (GLASS_H / (H_COUNT + 1)) * i
        create_box(f'hbar_{i}', GLASS_W, bar_d, bar_w, 0, bar_y, z, mat)

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def export_glb(name):
    filepath = os.path.join(OUT_DIR, f'{name}.glb')
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_materials='EXPORT',
    )
    print(f"  ✓ {name}.glb exported")


def main():
    print("\n" + "=" * 50)
    print("  GENERATING COLONIAL GRILLS (all bar types)")
    print("=" * 50)

    for bar_type in BAR_PROFILES:
        print(f"\n  Building: colonial × {bar_type}")
        build_colonial(bar_type)
        export_glb(f'grill_colonial_{bar_type}')

    print("\n  All 4 colonial grill variants generated!")
    print("=" * 50)


if __name__ == '__main__':
    main()
