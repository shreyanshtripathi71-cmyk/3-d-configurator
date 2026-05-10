"""Clean the stray Icosphere (and other non-window) meshes out of the
existing rigged GLBs and re-export. Run once after detecting the issue
in scripts/inspect_rig_depth.py."""
import bpy
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)

TARGETS = [
    'public/windows/casement/components/CasementWindow_Rigged_v2.glb',
    'public/windows/awning/AwningWindow_Rigged_v2.glb',
    'public/windows/picture/PictureWindow_Rigged_v2.glb',
    'public/windows/picture/FixedWindow_Rigged_v2.glb',
    'public/windows/high-fix/HighFixWindow_Rigged_v2.glb',
]

# Genuine Blender-default mesh names that should never be in a window
# rig. Generic names like "Cube" / "Sphere" are NOT in this list — the
# artist's source files legitimately use them.
JUNK_EXACT_NAMES = {'icosphere', 'monkey'}

# The four bone names every window rig is built around. A mesh that has
# none of these as vertex groups isn't part of the rig and gets removed.
RIG_BONE_NAMES = {'Ctrl_Down_Left', 'Ctrl_Down_Right',
                  'Ctrl_Top_Left', 'Ctrl_Top_Right'}


def looks_like_junk(obj) -> bool:
    n = obj.name.lower()
    if n in JUNK_EXACT_NAMES:
        return True
    # Anything not weighted to ANY of our four control bones is junk.
    has_rig_weight = any(vg.name in RIG_BONE_NAMES for vg in obj.vertex_groups)
    return not has_rig_weight


def clean(path: str):
    abs_path = os.path.join(PROJECT_DIR, path)
    if not os.path.exists(abs_path):
        print(f"  ✗ not found: {path}")
        return False

    print(f"\n── {path} ──")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=abs_path)

    removed = []
    for obj in list(bpy.data.objects):
        if obj.type != 'MESH':
            continue
        if looks_like_junk(obj):
            removed.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)

    if not removed:
        print(f"  (no junk found)")
        return True
    print(f"  Removed {len(removed)} junk mesh(es): {removed}")

    bpy.ops.export_scene.gltf(
        filepath=abs_path,
        export_format='GLB',
        export_skins=True,
        export_animations=False,
        export_apply=False,
        use_active_collection=False,
    )
    sz = os.path.getsize(abs_path) / (1024 * 1024)
    print(f"  ✓ Re-exported: {sz:.2f} MB")
    return True


print("=" * 60)
print("CLEANING JUNK MESHES OUT OF RIGGED GLBs")
print("=" * 60)
for t in TARGETS:
    clean(t)
print("\nDONE")
