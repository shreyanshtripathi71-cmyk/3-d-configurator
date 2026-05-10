"""
Generic rigging script for single-frame rectangular window models.

Builds a 4-corner control rig (Ctrl_Down_Left, Ctrl_Down_Right,
Ctrl_Top_Left, Ctrl_Top_Right) on top of any GLTF/GLB/FBX source,
producing a *_Rigged_v2.glb that drops into WindowViewer's rigged path.

Handles the gotchas we've been hitting:
  * Parent EMPTY hierarchies with mirrored (-1) scale → bakes each
    mesh's full world matrix directly into vertex data and reverses
    triangle winding when the matrix has negative determinant.
  * Mesh data at Maya/3ds export 0.001 scale → folded into the bake.
  * Wrong dominant axis → detects the (width, depth, height) ordering
    and rotates mesh data so X = width, Z = height, Y = depth.
  * Off-origin source → centres after the bake.
  * Width mismatch with casement-v2 standard (0.7621 m) → uniform-
    scales so the viewer's clone-scale math works unchanged.

Run for one window:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
      --python scripts/rig_window_v2.py -- \
      --in  public/windows/picture/PictureWindow_Model_1.gltf \
      --out public/windows/picture/PictureWindow_Rigged_v2.glb \
      --ftx 0.07 --ftz 0.04 --hardware none

Or use the BATCH list at the bottom — single Blender invocation, all
rig-able window types in one shot.
"""
import argparse
import math
import os
import sys

import bpy
import bmesh
import mathutils

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)

BONE_NAMES = ['Ctrl_Down_Left', 'Ctrl_Down_Right',
              'Ctrl_Top_Left', 'Ctrl_Top_Right']
DEFAULT_TARGET_WIDTH = 0.7621


# ──────────────────────────────────────────────────────────────────────
# Argument parsing (Blender-style: everything after `--`)
# ──────────────────────────────────────────────────────────────────────
def parse_args(argv):
    if '--' in argv:
        argv = argv[argv.index('--') + 1:]
    else:
        argv = []
    p = argparse.ArgumentParser(description="Rig a single-frame window model.")
    p.add_argument('--in', dest='input', required=True,
                   help="Source path (relative to project root or absolute).")
    p.add_argument('--out', dest='output', required=True,
                   help="Output GLB path (relative to project root or absolute).")
    p.add_argument('--ftx', type=float, default=0.10,
                   help="Frame-zone fraction along width (each side).")
    p.add_argument('--ftz', type=float, default=0.06,
                   help="Frame-zone fraction along height (top/bottom).")
    p.add_argument('--target-width', type=float, default=DEFAULT_TARGET_WIDTH,
                   help="Uniform-scale so native width equals this (metres).")
    p.add_argument('--hardware', choices=['none', 'left', 'right', 'bottom', 'center'],
                   default='none',
                   help="Where the operable hardware sits — controls weight rule.")
    p.add_argument('--hw-keywords', default='handle,lock,latch,crank',
                   help="Comma-separated mesh-name keywords that mark hardware.")
    p.add_argument('--hw-max-verts', type=int, default=2000,
                   help="Mesh must have <= this many verts to count as hardware "
                        "(stops 'Handle Body' frame parts being treated as hardware).")
    p.add_argument('--label', default=None, help="Friendly label for log output.")
    return p.parse_args(argv)


def resolve_path(p):
    if os.path.isabs(p):
        return p
    return os.path.normpath(os.path.join(PROJECT_DIR, p))


# ──────────────────────────────────────────────────────────────────────
# Weight functions — same edge-slide + bilinear pattern as the casement
# ──────────────────────────────────────────────────────────────────────
def compute_frame_weights(nx, nz, ftx, ftz):
    """Edge-slide along bars, bilinear in glass area."""
    in_left = nx < ftx
    in_right = nx > (1.0 - ftx)
    in_bottom = nz < ftz
    in_top = nz > (1.0 - ftz)

    if in_left and in_bottom:  return (1.0, 0.0, 0.0, 0.0)
    if in_right and in_bottom: return (0.0, 1.0, 0.0, 0.0)
    if in_left and in_top:     return (0.0, 0.0, 1.0, 0.0)
    if in_right and in_top:    return (0.0, 0.0, 0.0, 1.0)

    if in_left:
        t = max(0.0, min(1.0, (nz - ftz) / max(1.0 - 2 * ftz, 1e-6)))
        return (1.0 - t, 0.0, t, 0.0)
    if in_right:
        t = max(0.0, min(1.0, (nz - ftz) / max(1.0 - 2 * ftz, 1e-6)))
        return (0.0, 1.0 - t, 0.0, t)
    if in_bottom:
        t = max(0.0, min(1.0, (nx - ftx) / max(1.0 - 2 * ftx, 1e-6)))
        return (1.0 - t, t, 0.0, 0.0)
    if in_top:
        t = max(0.0, min(1.0, (nx - ftx) / max(1.0 - 2 * ftx, 1e-6)))
        return (0.0, 0.0, 1.0 - t, t)

    inner_nx = max(0.0, min(1.0, (nx - ftx) / max(1.0 - 2 * ftx, 1e-6)))
    inner_nz = max(0.0, min(1.0, (nz - ftz) / max(1.0 - 2 * ftz, 1e-6)))
    return (
        (1.0 - inner_nx) * (1.0 - inner_nz),
        inner_nx       * (1.0 - inner_nz),
        (1.0 - inner_nx) * inner_nz,
        inner_nx       * inner_nz,
    )


def compute_glass_weights(nx, nz):
    """Pure bilinear — glass always stretches uniformly."""
    return (
        (1.0 - nx) * (1.0 - nz),
        nx       * (1.0 - nz),
        (1.0 - nx) * nz,
        nx       * nz,
    )


def compute_hardware_weights(nx, nz, position):
    """Hardware rides on a single bar, doesn't stretch."""
    if position == 'left':
        return (1.0 - nz, 0.0, nz, 0.0)
    if position == 'right':
        return (0.0, 1.0 - nz, 0.0, nz)
    if position == 'bottom':
        return (1.0 - nx, nx, 0.0, 0.0)
    if position == 'center':
        return compute_glass_weights(nx, nz)
    # 'none' — no operable hardware; treat any tagged hardware as frame.
    return None


# ──────────────────────────────────────────────────────────────────────
# Geometry helpers
# ──────────────────────────────────────────────────────────────────────
def bake_world_into_mesh(obj):
    """Apply the object's full world matrix to its mesh data, then reset
    the object transform to identity. Reverses triangle winding when the
    matrix has a negative determinant (mirrored parents)."""
    if obj.type != 'MESH' or not obj.data:
        return False
    world = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world = mathutils.Matrix.Identity(4)
    obj.data.transform(world)
    obj.data.update()
    if world.determinant() < 0:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        for face in bm.faces:
            face.normal_flip()
        bm.normal_update()
        bm.to_mesh(obj.data)
        bm.free()
    return world.determinant() < 0


def collect_meshes():
    return [o for o in bpy.data.objects if o.type == 'MESH']


def world_bounds(meshes):
    mn = [float('inf')] * 3
    mx = [float('-inf')] * 3
    for obj in meshes:
        for v in obj.data.vertices:
            wp = obj.matrix_world @ v.co
            for i, val in enumerate((wp.x, wp.y, wp.z)):
                mn[i] = min(mn[i], val)
                mx[i] = max(mx[i], val)
    if mn[0] == float('inf'):
        return None
    return mn, mx


def transform_all_meshes(meshes, mat):
    for obj in meshes:
        obj.data.transform(mat)
        obj.data.update()


def detect_axis_remap(mn, mx):
    """If the dominant axis is not Z (height) and second-largest is X
    (width), return a rotation matrix that rotates mesh data so:
      largest axis  → Z (height)
      second-largest → X (width)
      smallest      → Y (depth)
    Returns None when the orientation is already correct."""
    dims = [mx[i] - mn[i] for i in range(3)]
    order = sorted(range(3), key=lambda i: -dims[i])  # axes from largest to smallest
    largest, second, smallest = order
    if largest == 2 and second == 0:
        return None  # already X = width, Z = height, Y = depth
    # Build a permutation matrix that maps (current axes) → (target axes).
    # Target: source[largest] → world Z, source[second] → world X, source[smallest] → world Y.
    perm = mathutils.Matrix(((0, 0, 0, 0),
                             (0, 0, 0, 0),
                             (0, 0, 0, 0),
                             (0, 0, 0, 1)))
    perm[2][largest] = 1   # Z row gets largest axis
    perm[0][second]  = 1   # X row gets second-largest
    perm[1][smallest] = 1  # Y row gets smallest
    return perm


# ──────────────────────────────────────────────────────────────────────
# Main rigging routine
# ──────────────────────────────────────────────────────────────────────
def rig_window(args):
    in_path = resolve_path(args.input)
    out_path = resolve_path(args.output)
    label = args.label or os.path.basename(in_path)

    print("\n" + "=" * 60)
    print(f"RIGGING: {label}")
    print(f"  in  → {in_path}")
    print(f"  out → {out_path}")
    print(f"  FT_X={args.ftx}  FT_Z={args.ftz}  hardware={args.hardware}")
    print("=" * 60)

    if not os.path.exists(in_path):
        print(f"✗ Source not found: {in_path}")
        return False

    bpy.ops.wm.read_factory_settings(use_empty=True)

    ext = os.path.splitext(in_path)[1].lower()
    try:
        if ext == '.fbx':
            bpy.ops.import_scene.fbx(filepath=in_path)
        else:
            bpy.ops.import_scene.gltf(filepath=in_path)
    except Exception as e:
        print(f"✗ Import failed: {e}")
        return False

    # ── Step 1: Bake each mesh's world matrix into its data ──
    # This dissolves any parent EMPTY hierarchy with mirrored scales,
    # which is the root cause of the picture-window rotation issues.
    meshes = collect_meshes()
    print(f"\n[1] Baking world transforms on {len(meshes)} meshes…")
    flipped_count = 0
    for obj in meshes:
        if bake_world_into_mesh(obj):
            flipped_count += 1
    if flipped_count:
        print(f"  Reversed winding on {flipped_count} mirrored mesh(es)")

    # Drop any EMPTY parents now that their transforms are baked in.
    for obj in list(bpy.data.objects):
        if obj.type == 'EMPTY':
            bpy.data.objects.remove(obj, do_unlink=True)

    meshes = collect_meshes()
    if not meshes:
        print("✗ No mesh data after import")
        return False

    bounds = world_bounds(meshes)
    if not bounds:
        print("✗ No vertex data")
        return False
    mn, mx = bounds
    dims = [mx[i] - mn[i] for i in range(3)]
    print(f"  Post-bake bounds: X={dims[0]:.4f}  Y={dims[1]:.4f}  Z={dims[2]:.4f}")

    # ── Step 2: Axis remap if dominant axes aren't (X width, Z height) ──
    remap = detect_axis_remap(mn, mx)
    if remap is not None:
        print(f"[2] Axis remap needed (largest={dims.index(max(dims))})…")
        transform_all_meshes(meshes, remap)
        bounds = world_bounds(meshes)
        mn, mx = bounds
        dims = [mx[i] - mn[i] for i in range(3)]
        print(f"  Post-remap bounds: X={dims[0]:.4f}  Y={dims[1]:.4f}  Z={dims[2]:.4f}")
    else:
        print(f"[2] Axis already correct (Z dominant, X second).")

    # ── Step 3: Centre at origin ──
    cx = (mn[0] + mx[0]) / 2.0
    cy = (mn[1] + mx[1]) / 2.0
    cz = (mn[2] + mx[2]) / 2.0
    if any(abs(v) > 1e-4 for v in (cx, cy, cz)):
        print(f"[3] Centering by ({-cx:+.4f}, {-cy:+.4f}, {-cz:+.4f})…")
        transform_all_meshes(meshes, mathutils.Matrix.Translation((-cx, -cy, -cz)))
        bounds = world_bounds(meshes)
        mn, mx = bounds
    else:
        print("[3] Already centred.")

    # ── Step 4: Uniform scale to target native width ──
    width = mx[0] - mn[0]
    scale = args.target_width / width if width > 0 else 1.0
    if abs(scale - 1.0) > 1e-3:
        print(f"[4] Uniform scale ×{scale:.4f} ({width:.4f}m → {args.target_width:.4f}m)")
        transform_all_meshes(meshes, mathutils.Matrix.Scale(scale, 4))
        bounds = world_bounds(meshes)
        mn, mx = bounds
    else:
        print(f"[4] Native width already at target ({width:.4f}m).")

    width = mx[0] - mn[0]
    height = mx[2] - mn[2]
    depth_centre = (mn[1] + mx[1]) / 2.0
    print(f"  Final bounds:  X[{mn[0]:+.4f},{mx[0]:+.4f}]  "
          f"Y[{mn[1]:+.4f},{mx[1]:+.4f}]  Z[{mn[2]:+.4f},{mx[2]:+.4f}]")
    print(f"  Width={width:.4f}  Height={height:.4f}  Depth={mx[1]-mn[1]:.4f}")

    # ── Step 5: Build the 4-corner armature ──
    print("[5] Building armature…")
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    armature_obj = bpy.context.active_object
    armature_obj.name = 'WindowArmature'
    armature_obj.data.name = 'WindowArmatureData'
    for bone in list(armature_obj.data.edit_bones):
        armature_obj.data.edit_bones.remove(bone)

    bone_positions = {
        'Ctrl_Down_Left':  (mn[0], depth_centre, mn[2]),
        'Ctrl_Down_Right': (mx[0], depth_centre, mn[2]),
        'Ctrl_Top_Left':   (mn[0], depth_centre, mx[2]),
        'Ctrl_Top_Right':  (mx[0], depth_centre, mx[2]),
    }
    for name, (bx, by, bz) in bone_positions.items():
        b = armature_obj.data.edit_bones.new(name)
        b.head = (bx, by, bz)
        b.tail = (bx, by, bz + 0.05)
        b.use_deform = True
    bpy.ops.object.mode_set(mode='OBJECT')

    # ── Step 6: Weight + parent every mesh to the armature ──
    print("[6] Weighting + parenting meshes…")
    hw_keywords = [k.strip().lower() for k in args.hw_keywords.split(',') if k.strip()]

    def classify(obj):
        nm = obj.name.lower()
        # Glass: small mesh with a transparent / "glass"-named material,
        # or mesh name starts with "glass".
        if nm.startswith('glass') or nm.startswith('window_glass'):
            return 'glass'
        for slot in obj.material_slots:
            m = slot.material
            if m and ('glass' in m.name.lower() or '245' in m.name.lower()):
                return 'glass'
            if m and hasattr(m, 'diffuse_color') and len(m.diffuse_color) >= 4 \
               and m.diffuse_color[3] < 0.95:
                return 'glass'
        # Hardware: name keyword AND vertex count below threshold.
        if any(k in nm for k in hw_keywords) and len(obj.data.vertices) <= args.hw_max_verts:
            return 'hardware'
        return 'frame'

    for obj in meshes:
        kind = classify(obj)
        for bn in BONE_NAMES:
            if bn not in obj.vertex_groups:
                obj.vertex_groups.new(name=bn)
        groups = [obj.vertex_groups[bn] for bn in BONE_NAMES]

        for v in obj.data.vertices:
            wp = obj.matrix_world @ v.co
            nx = max(0.0, min(1.0, (wp.x - mn[0]) / width  if width  > 0 else 0.5))
            nz = max(0.0, min(1.0, (wp.z - mn[2]) / height if height > 0 else 0.5))

            if kind == 'glass':
                weights = compute_glass_weights(nx, nz)
            elif kind == 'hardware':
                hw = compute_hardware_weights(nx, nz, args.hardware)
                weights = hw if hw is not None else compute_frame_weights(nx, nz, args.ftx, args.ftz)
            else:
                weights = compute_frame_weights(nx, nz, args.ftx, args.ftz)

            for i, w in enumerate(weights):
                if w > 0.001:
                    groups[i].add([v.index], w, 'REPLACE')
                else:
                    groups[i].remove([v.index])

        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        armature_obj.select_set(True)
        bpy.context.view_layer.objects.active = armature_obj
        bpy.ops.object.parent_set(type='ARMATURE_NAME')
        bpy.ops.object.select_all(action='DESELECT')
        print(f"  {obj.name:<30} → {kind:<8} ({len(obj.data.vertices)} verts)")

    # ── Step 7: Export ──
    print(f"[7] Exporting → {out_path}")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        export_skins=True,
        export_animations=False,
        export_apply=False,
        use_active_collection=False,
    )
    if os.path.exists(out_path):
        sz = os.path.getsize(out_path) / (1024 * 1024)
        print(f"✓ Exported: {sz:.2f} MB")
        return True
    print("✗ Export failed")
    return False


# ──────────────────────────────────────────────────────────────────────
# Batch mode (when no `--in/--out` provided): rig the whole standard set
# ──────────────────────────────────────────────────────────────────────
BATCH_RECIPES = [
    {
        'label': 'PICTURE',
        'input':  'public/windows/picture/PictureWindow_Model_1.gltf',
        'output': 'public/windows/picture/PictureWindow_Rigged_v2.glb',
        'ftx': 0.07, 'ftz': 0.04, 'hardware': 'none',
    },
    {
        'label': 'HIGH-FIX',
        'input':  'public/windows/high-fix/HighFixWindow_DoubleGlazing.gltf',
        'output': 'public/windows/high-fix/HighFixWindow_Rigged_v2.glb',
        'ftx': 0.07, 'ftz': 0.04, 'hardware': 'none',
    },
    {
        'label': 'FIXED (alias of picture)',
        'input':  'public/windows/picture/PictureWindow_Model_1.gltf',
        'output': 'public/windows/picture/FixedWindow_Rigged_v2.glb',
        'ftx': 0.07, 'ftz': 0.04, 'hardware': 'none',
    },
]


def run_batch():
    ok, fail = 0, 0
    for recipe in BATCH_RECIPES:
        ns = argparse.Namespace(
            input=recipe['input'],
            output=recipe['output'],
            ftx=recipe.get('ftx', 0.10),
            ftz=recipe.get('ftz', 0.06),
            target_width=recipe.get('target_width', DEFAULT_TARGET_WIDTH),
            hardware=recipe.get('hardware', 'none'),
            hw_keywords=recipe.get('hw_keywords', 'handle,lock,latch,crank'),
            hw_max_verts=recipe.get('hw_max_verts', 2000),
            label=recipe.get('label'),
        )
        if rig_window(ns):
            ok += 1
        else:
            fail += 1
    print("\n" + "=" * 60)
    print(f"BATCH DONE — {ok} ok, {fail} failed")
    print("=" * 60)


if __name__ == '__main__':
    if '--' in sys.argv:
        run_batch_mode = False
    else:
        run_batch_mode = True

    if run_batch_mode:
        run_batch()
    else:
        args = parse_args(sys.argv)
        rig_window(args)
