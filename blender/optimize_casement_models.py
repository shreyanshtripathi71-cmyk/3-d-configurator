"""
Blender script — Optimize casement window models
Decimates high-poly meshes and exports with Draco compression.

Handles: 1H1V (original), 2H1V, 2H2V

Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python blender/optimize_casement_models.py
"""

import bpy
import mathutils
import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CASEMENT_DIR = os.path.join(PROJECT_ROOT, 'public', 'windows', 'casement')

# Decimate ratio: 0.1 = keep 10% of polygons (198K → ~20K per frame)
# Handle gets less aggressive decimation since it's more detailed
FRAME_DECIMATE = 0.10
HANDLE_DECIMATE = 0.08  # handles need more detail for the metallic look
GLASS_DECIMATE = 1.0     # glass is already low-poly (72 verts), no decimation

# Models to optimize
MODELS = [
    ('CasementWindow.gltf', 'Casement_1H1V_optimized.glb'),
    ('Casement_2H1V.glb', 'Casement_2H1V_optimized.glb'),
    ('Casement_2H2V.glb', 'Casement_2H2V_optimized.glb'),
]

print(f"\n{'='*60}")
print(f"  CASEMENT MODEL OPTIMIZER")
print(f"  Decimate + Draco Compression")
print(f"{'='*60}\n")


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for b in list(bpy.data.meshes): bpy.data.meshes.remove(b)
    for b in list(bpy.data.materials): bpy.data.materials.remove(b)
    for b in list(bpy.data.armatures): bpy.data.armatures.remove(b)


def classify_mesh(obj):
    """Classify a mesh as frame, handle, or glass based on vertex count and material."""
    vc = len(obj.data.vertices)
    mat_name = obj.data.materials[0].name.lower() if obj.data.materials else ''
    name_lower = obj.name.lower()

    if 'glass' in name_lower or 'glass' in mat_name or vc < 500:
        return 'glass'
    elif 'handle' in name_lower or 'lock' in name_lower or 'hinge' in name_lower or \
         mat_name.startswith('material #290') or (vc > 10000 and vc < 150000):
        # Handle meshes: metallic material (#290) or named handle/lock
        if obj.data.materials:
            mat = obj.data.materials[0]
            if mat.use_nodes:
                bsdf = mat.node_tree.nodes.get('Principled BSDF')
                if bsdf and bsdf.inputs['Metallic'].default_value > 0.5:
                    return 'handle'
        if 'handle' in name_lower or 'lock' in name_lower or 'hinge' in name_lower:
            return 'handle'
        # Large vertex count without metallic = frame
        return 'frame'
    else:
        return 'frame'


def decimate_mesh(obj, ratio, name_hint=""):
    """Apply decimate modifier to reduce polygon count."""
    if ratio >= 1.0:
        return len(obj.data.vertices), len(obj.data.vertices)

    orig_verts = len(obj.data.vertices)
    if orig_verts < 100:
        return orig_verts, orig_verts  # skip tiny meshes

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    # Add decimate modifier
    dec = obj.modifiers.new(name='Decimate', type='DECIMATE')
    dec.decimate_type = 'COLLAPSE'
    dec.ratio = ratio
    # Use vertex groups to preserve edges (optional)
    dec.use_collapse_triangulate = False

    # Apply the modifier
    bpy.ops.object.modifier_apply(modifier='Decimate')

    new_verts = len(obj.data.vertices)
    obj.select_set(False)

    print(f"      {name_hint}: {orig_verts:,} → {new_verts:,} verts ({new_verts/orig_verts*100:.1f}%)")
    return orig_verts, new_verts


def process_model(input_file, output_file):
    """Load, decimate, and export a model."""
    input_path = os.path.join(CASEMENT_DIR, input_file)
    output_path = os.path.join(CASEMENT_DIR, output_file)

    if not os.path.exists(input_path):
        print(f"  ⚠ Skipping {input_file} — file not found")
        return

    orig_size = os.path.getsize(input_path) / (1024 * 1024)
    print(f"\n  Processing: {input_file} ({orig_size:.1f} MB)")

    # Clear and import
    clear_scene()

    if input_file.endswith('.gltf'):
        bpy.ops.import_scene.gltf(filepath=input_path)
    else:
        bpy.ops.import_scene.gltf(filepath=input_path)

    # Flatten hierarchy
    mesh_objects = [o for o in bpy.data.objects if o.type == 'MESH']
    for obj in mesh_objects:
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.select_set(False)

    # Remove empties
    bpy.ops.object.select_all(action='DESELECT')
    for obj in list(bpy.data.objects):
        if obj.type == 'EMPTY':
            obj.select_set(True)
    bpy.ops.object.delete()

    # Decimate each mesh based on type
    mesh_objects = [o for o in bpy.data.objects if o.type == 'MESH']
    total_orig = 0
    total_new = 0

    print(f"    Decimating {len(mesh_objects)} meshes...")
    for obj in mesh_objects:
        mesh_type = classify_mesh(obj)
        if mesh_type == 'frame':
            ratio = FRAME_DECIMATE
        elif mesh_type == 'handle':
            ratio = HANDLE_DECIMATE
        else:
            ratio = GLASS_DECIMATE

        orig, new = decimate_mesh(obj, ratio, f"{obj.name} ({mesh_type})")
        total_orig += orig
        total_new += new

    print(f"    Total: {total_orig:,} → {total_new:,} verts ({total_new/total_orig*100:.1f}%)")

    # Smooth shading on all meshes
    for obj in [o for o in bpy.data.objects if o.type == 'MESH']:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.shade_smooth()
        obj.select_set(False)

    # Export with Draco compression
    print(f"    Exporting with Draco compression...")
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_materials='EXPORT',
        export_yup=True,
        # Draco compression
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )

    if os.path.exists(output_path):
        new_size = os.path.getsize(output_path) / (1024 * 1024)
        reduction = (1 - new_size / orig_size) * 100
        print(f"    ✓ {output_file}: {new_size:.2f} MB (was {orig_size:.1f} MB, {reduction:.0f}% smaller)")
    else:
        print(f"    ✗ Export failed!")


# Process all models
for inp, out in MODELS:
    process_model(inp, out)

print(f"\n{'='*60}")
print(f"  OPTIMIZATION COMPLETE")
print(f"{'='*60}\n")

# Summary
print("  Generated optimized models:")
for _, out in MODELS:
    path = os.path.join(CASEMENT_DIR, out)
    if os.path.exists(path):
        size = os.path.getsize(path) / (1024 * 1024)
        print(f"    {out}: {size:.2f} MB")
print()
