"""
Blender script: Inspect the CasementWindow.gltf model structure.
Run via: /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/inspect_casement.py
"""
import bpy
import sys
import os
import json

# Clear default scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Import the GLTF
gltf_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                         'public', 'windows', 'casement', 'CasementWindow.gltf')
print(f"\n{'='*60}")
print(f"Importing: {gltf_path}")
print(f"{'='*60}\n")

bpy.ops.import_scene.gltf(filepath=gltf_path)

# Apply all transforms so we see real-world coordinates
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.select_set(False)

print("\n" + "="*60)
print("MODEL STRUCTURE ANALYSIS")
print("="*60)

# List all objects
print("\n--- ALL OBJECTS ---")
for obj in bpy.data.objects:
    print(f"  Name: '{obj.name}'  Type: {obj.type}  Parent: {obj.parent.name if obj.parent else 'None'}")
    if obj.type == 'MESH':
        mesh = obj.data
        print(f"    Vertices: {len(mesh.vertices)}")
        print(f"    Faces: {len(mesh.polygons)}")
        print(f"    Materials: {[m.name for m in mesh.materials]}")
        
        # Compute bounding box in world space
        bbox = [obj.matrix_world @ v.co for v in mesh.vertices]
        if bbox:
            min_x = min(v.x for v in bbox)
            max_x = max(v.x for v in bbox)
            min_y = min(v.y for v in bbox)
            max_y = max(v.y for v in bbox)
            min_z = min(v.z for v in bbox)
            max_z = max(v.z for v in bbox)
            print(f"    Bounds X: [{min_x:.6f}, {max_x:.6f}]  Width:  {max_x - min_x:.6f}")
            print(f"    Bounds Y: [{min_y:.6f}, {max_y:.6f}]  Height: {max_y - min_y:.6f}")
            print(f"    Bounds Z: [{min_z:.6f}, {max_z:.6f}]  Depth:  {max_z - min_z:.6f}")
    elif obj.type == 'EMPTY':
        print(f"    Location: ({obj.location.x:.6f}, {obj.location.y:.6f}, {obj.location.z:.6f})")

# Materials analysis
print("\n--- MATERIALS ---")
for mat in bpy.data.materials:
    print(f"  Material: '{mat.name}'")
    if mat.use_nodes:
        for node in mat.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                bc = node.inputs['Base Color'].default_value
                print(f"    Base Color: ({bc[0]:.4f}, {bc[1]:.4f}, {bc[2]:.4f}, {bc[3]:.4f})")
                print(f"    Metallic: {node.inputs['Metallic'].default_value:.4f}")
                print(f"    Roughness: {node.inputs['Roughness'].default_value:.4f}")
                if 'Alpha' in node.inputs:
                    print(f"    Alpha: {node.inputs['Alpha'].default_value:.4f}")

# Compute overall model bounds
print("\n--- OVERALL MODEL BOUNDS ---")
all_verts = []
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        for v in obj.data.vertices:
            wv = obj.matrix_world @ v.co
            all_verts.append(wv)

if all_verts:
    min_x = min(v.x for v in all_verts)
    max_x = max(v.x for v in all_verts)
    min_y = min(v.y for v in all_verts)
    max_y = max(v.y for v in all_verts)
    min_z = min(v.z for v in all_verts)
    max_z = max(v.z for v in all_verts)
    print(f"  Total X: [{min_x:.6f}, {max_x:.6f}]  Width:  {max_x - min_x:.6f}")
    print(f"  Total Y: [{min_y:.6f}, {max_y:.6f}]  Height: {max_y - min_y:.6f}")
    print(f"  Total Z: [{min_z:.6f}, {max_z:.6f}]  Depth:  {max_z - min_z:.6f}")
    print(f"  Center: ({(min_x+max_x)/2:.6f}, {(min_y+max_y)/2:.6f}, {(min_z+max_z)/2:.6f})")

print("\n" + "="*60)
print("INSPECTION COMPLETE")
print("="*60 + "\n")
