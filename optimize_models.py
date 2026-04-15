#!/usr/bin/env python3
"""
3D Model Optimizer — Decimates heavy GLTF models to reduce vertex count.

Reduces models from millions of vertices down to a target count,
making them load and render much faster in the browser.

Usage:
    python3 optimize_models.py

Requirements:
    pip install trimesh numpy fast-simplification
"""

import os
import sys
import time
import json
import shutil
import trimesh
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WINDOWS_DIR = os.path.join(BASE_DIR, 'windows')

# Models with bin files > this size (MB) are considered heavy and will be optimized
HEAVY_THRESHOLD_MB = 50

# Target: reduce each mesh so total model stays around this many faces
TARGET_TOTAL_FACES = 300_000

def get_model_info(model_dir):
    """Get GLTF path and bin file size for a model directory."""
    gltf_path = None
    bin_size = 0
    for f in os.listdir(model_dir):
        if f.endswith('.gltf'):
            gltf_path = os.path.join(model_dir, f)
        if f.endswith('.bin'):
            bin_size = os.path.getsize(os.path.join(model_dir, f))
    return gltf_path, bin_size

def optimize_model(gltf_path, target_faces=TARGET_TOTAL_FACES):
    """Load a GLTF scene, decimate all meshes, and export as GLB."""
    print(f'  Loading scene...')
    t0 = time.time()
    scene = trimesh.load(gltf_path)
    load_time = time.time() - t0
    print(f'  Loaded in {load_time:.1f}s')

    if not hasattr(scene, 'geometry') or len(scene.geometry) == 0:
        print(f'  WARNING: No geometry found, skipping')
        return None

    # Count total faces
    total_faces = 0
    geom_info = []
    for name, geom in scene.geometry.items():
        if hasattr(geom, 'faces'):
            nf = len(geom.faces)
            nv = len(geom.vertices)
            total_faces += nf
            geom_info.append((name, nf, nv, geom))
            
    print(f'  {len(geom_info)} meshes, {total_faces:,} total faces')

    if total_faces <= target_faces:
        print(f'  Already under target ({target_faces:,}), skipping')
        return None

    reduction_ratio = target_faces / total_faces
    print(f'  Reduction ratio: {reduction_ratio:.4f} ({100*(1-reduction_ratio):.1f}% reduction)')

    # Decimate each mesh proportionally
    t0 = time.time()
    for name, nf, nv, geom in geom_info:
        mesh_target = max(int(nf * reduction_ratio), 100)
        if nf <= mesh_target:
            continue
        try:
            simplified = geom.simplify_quadric_decimation(face_count=mesh_target)
            scene.geometry[name] = simplified
            print(f'    {name}: {nf:,} -> {len(simplified.faces):,} faces')
        except Exception as e:
            print(f'    {name}: decimation failed ({e}), keeping original')

    dec_time = time.time() - t0
    new_total = sum(len(g.faces) for g in scene.geometry.values() if hasattr(g, 'faces'))
    print(f'  Decimation done in {dec_time:.1f}s: {total_faces:,} -> {new_total:,} faces')

    return scene

def main():
    print('=' * 60)
    print('3D Model Optimizer')
    print('=' * 60)

    # Scan for heavy models
    models = []
    for d in sorted(os.listdir(WINDOWS_DIR)):
        model_dir = os.path.join(WINDOWS_DIR, d)
        if not os.path.isdir(model_dir):
            continue
        gltf_path, bin_size = get_model_info(model_dir)
        if not gltf_path:
            continue
        bin_mb = bin_size / (1024 * 1024)
        status = 'HEAVY' if bin_mb > HEAVY_THRESHOLD_MB else 'ok'
        print(f'  {d:20s}: {bin_mb:8.1f} MB  [{status}]')
        if bin_mb > HEAVY_THRESHOLD_MB:
            models.append((d, gltf_path, bin_mb))

    if not models:
        print('\nNo heavy models found. All models are already optimized!')
        return

    print(f'\nFound {len(models)} heavy model(s) to optimize.')
    print('This may take several minutes for large models.\n')

    for name, gltf_path, bin_mb in models:
        print(f'\n--- Optimizing: {name} ({bin_mb:.0f} MB) ---')
        model_dir = os.path.dirname(gltf_path)
        
        try:
            scene = optimize_model(gltf_path)
            if scene is None:
                continue

            # Backup original files
            backup_dir = os.path.join(model_dir, 'original_backup')
            if not os.path.exists(backup_dir):
                os.makedirs(backup_dir)
                for f in os.listdir(model_dir):
                    if f == 'original_backup':
                        continue
                    src = os.path.join(model_dir, f)
                    if os.path.isfile(src):
                        shutil.copy2(src, os.path.join(backup_dir, f))
                print(f'  Backed up originals to {backup_dir}/')

            # Export as GLB (single file, more efficient than gltf+bin)
            glb_path = os.path.splitext(gltf_path)[0] + '_optimized.glb'
            scene.export(glb_path, file_type='glb')
            new_size = os.path.getsize(glb_path) / (1024 * 1024)
            print(f'  Exported: {glb_path}')
            print(f'  Size: {bin_mb:.0f} MB -> {new_size:.1f} MB ({100*(1-new_size/bin_mb):.0f}% smaller)')

        except MemoryError:
            print(f'  ERROR: Not enough RAM to process this model.')
            print(f'  Try closing other apps and running again.')
        except Exception as e:
            print(f'  ERROR: {e}')

    print('\n' + '=' * 60)
    print('Done! Optimized models saved with _optimized.glb suffix.')
    print('Update the GLTF paths in index.html to use the new files.')
    print('=' * 60)

if __name__ == '__main__':
    main()
