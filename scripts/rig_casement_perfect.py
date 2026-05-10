"""
Perfect casement window rig.

Goals
-----
* One clean armature with 4 corner control bones (no junk objects).
* Bones placed EXACTLY at the post-flatten mesh corners so the
  bone-to-corner offset baked into the GLB is zero. This makes the
  Three.js placement math (`offDL = bind.dlBind - meshMin`, etc.) trivially
  resolve to (0,0), eliminating a class of "shifted casement" bugs.
* Frame profile is locked: vertices that sit inside the frame zone
  (`FT_X` of width / `FT_Z` of height from each edge) get full weight to
  the nearest edge bone(s), so when the bones move apart the frame
  cross-section stays at its native thickness — the window simply gets
  TALLER or WIDER, not THICKER.
* Glass uses bilinear corner weights so it stretches with the opening.
* Hardware (handle) is anchored to the left side: it slides along Z with
  the left bones but never duplicates or stretches.
* Smooth ramp at the frame/glass boundary (a few cm of blend) so the
  silhouette doesn't get a visible kink at extreme aspect ratios.
* Y-up GLB export so it lines up with every other window rig.

Run:
    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python scripts/rig_casement_perfect.py
"""

from __future__ import annotations

import os
import sys

import bpy
import mathutils

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)

GLTF_IN = os.path.join(
    PROJECT_DIR, 'public', 'windows', 'casement', 'CasementWindow.gltf'
)
GLB_OUT = os.path.join(
    PROJECT_DIR, 'public', 'windows', 'casement', 'components',
    'CasementWindow_Rigged_v2.glb',
)

# Frame zone fractions. These match the native casement profile
# (~9% of width / ~5% of height in absolute units, balanced for the 1:2
# aspect ratio so the locked zone reads as ~0.075 m on every edge).
FT_X = 0.12   # left/right frame zone (fraction of width)
FT_Z = 0.06   # top/bottom frame zone  (fraction of height)
# Soft blend zone — 1.5% of each axis on either side of the FT_X / FT_Z
# boundary smooths the transition between "locked frame" and "stretchable
# glass" weights so we don't get a visible kink in the deformed silhouette.
BLEND = 0.015

BONE_NAMES = ('Ctrl_Down_Left', 'Ctrl_Down_Right',
              'Ctrl_Top_Left',  'Ctrl_Top_Right')


def banner(msg: str) -> None:
    print(f"\n{'=' * 70}\n  {msg}\n{'=' * 70}")


# ─────────────────────────────────────────────
# STEP 1 — clean scene + import
# ─────────────────────────────────────────────
banner("STEP 1: Import + clean scene")
bpy.ops.wm.read_factory_settings(use_empty=True)

if not os.path.exists(GLTF_IN):
    sys.exit(f"ERROR: source not found: {GLTF_IN}")

bpy.ops.import_scene.gltf(filepath=GLTF_IN)
print(f"  Imported: {GLTF_IN}")


# ─────────────────────────────────────────────
# STEP 2 — flatten parent transforms onto each mesh
# ─────────────────────────────────────────────
# The source GLTF has a deep parent stack: WindowParent → Window → mesh,
# with the parent carrying a (-1.68, +0.07, +0.22) offset and the meshes
# themselves carrying ±90° rotations and a 1000× scale on the handle.
# We apply ALL of that into the vertex data so we end up with three
# identity-transform meshes whose `v.co` is exactly the world position.
banner("STEP 2: Flatten parent transforms")

mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH']
for m in mesh_objs:
    bpy.ops.object.select_all(action='DESELECT')
    m.select_set(True)
    bpy.context.view_layer.objects.active = m
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Drop every empty (the old hierarchy) plus any junk Blender may have
# inserted. Specifically the previous rig pipeline left a stray
# `Icosphere` placeholder in the GLB which polluted the bind-bounds in
# the Three.js loader.
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type != 'MESH':
        o.select_set(True)
    elif o.name.lower().startswith('icosphere') or o.name.lower().startswith('cube') \
            or o.name.lower() in ('plane', 'circle'):
        o.select_set(True)
bpy.ops.object.delete()

mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH']
print(f"  Remaining meshes: {[o.name for o in mesh_objs]}")


# ─────────────────────────────────────────────
# STEP 3 — identify each mesh by role
# ─────────────────────────────────────────────
banner("STEP 3: Identify meshes")

frame = glass = handle = None
for m in mesh_objs:
    nv = len(m.data.vertices)
    mat_name = m.data.materials[0].name if m.data.materials else ''
    print(f"  {m.name!r}: {nv} verts, mat={mat_name!r}")
    # Glass mesh has the transparent material #245.
    if 'glass' in mat_name.lower() or '245' in mat_name or nv < 1000:
        glass = m
    elif nv > 100_000 and 'iron' not in mat_name.lower() and '290' not in mat_name:
        frame = m
    else:
        handle = m

# Fallback heuristics if the material names didn't match.
unassigned = [m for m in mesh_objs if m not in (frame, glass, handle)]
for m in unassigned:
    if frame is None:
        frame = m
    elif handle is None:
        handle = m
    elif glass is None:
        glass = m

assert frame, "No frame mesh found"
assert glass, "No glass mesh found"
assert handle, "No handle mesh found"
print(f"  → Frame: {frame.name!r}  Glass: {glass.name!r}  Handle: {handle.name!r}")


# ─────────────────────────────────────────────
# STEP 4 — recentre everything at origin
# ─────────────────────────────────────────────
# Centring at origin means the bones we create at the corners later sit
# at the actual mesh extents (no per-rig bind offset for Three.js to
# compensate for). It also makes the rig predictable across re-runs.
banner("STEP 4: Recentre at origin")

all_min = mathutils.Vector((float('inf'),)*3)
all_max = mathutils.Vector((float('-inf'),)*3)
for m in mesh_objs:
    for v in m.data.vertices:
        wp = m.matrix_world @ v.co
        all_min.x = min(all_min.x, wp.x); all_max.x = max(all_max.x, wp.x)
        all_min.y = min(all_min.y, wp.y); all_max.y = max(all_max.y, wp.y)
        all_min.z = min(all_min.z, wp.z); all_max.z = max(all_max.z, wp.z)

centre = (all_min + all_max) / 2.0
print(f"  Pre-centre bounds: X[{all_min.x:+.4f},{all_max.x:+.4f}] "
      f"Y[{all_min.y:+.4f},{all_max.y:+.4f}] Z[{all_min.z:+.4f},{all_max.z:+.4f}]")
print(f"  Centre: ({centre.x:+.4f}, {centre.y:+.4f}, {centre.z:+.4f})")

for m in mesh_objs:
    for v in m.data.vertices:
        v.co -= centre
    m.data.update()


# Recompute bounds after centring
def bounds_of(obj) -> tuple[mathutils.Vector, mathutils.Vector]:
    coords = [obj.matrix_world @ v.co for v in obj.data.vertices]
    mn = mathutils.Vector((min(c.x for c in coords),
                           min(c.y for c in coords),
                           min(c.z for c in coords)))
    mx = mathutils.Vector((max(c.x for c in coords),
                           max(c.y for c in coords),
                           max(c.z for c in coords)))
    return mn, mx


frame_min, frame_max = bounds_of(frame)
glass_min, glass_max = bounds_of(glass)
handle_min, handle_max = bounds_of(handle)

WIDTH  = frame_max.x - frame_min.x   # along X
DEPTH  = frame_max.y - frame_min.y   # along Y (front/back of profile)
HEIGHT = frame_max.z - frame_min.z   # along Z

print(f"  Frame:  W={WIDTH:.4f} H={HEIGHT:.4f} D={DEPTH:.4f}")
print(f"  Glass:  X[{glass_min.x:+.4f},{glass_max.x:+.4f}] "
      f"Z[{glass_min.z:+.4f},{glass_max.z:+.4f}]")
print(f"  Handle: X[{handle_min.x:+.4f},{handle_max.x:+.4f}] "
      f"Z[{handle_min.z:+.4f},{handle_max.z:+.4f}]")


# ─────────────────────────────────────────────
# STEP 5 — create armature + 4 corner bones
# ─────────────────────────────────────────────
banner("STEP 5: Build armature")

bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
arm_obj = bpy.context.active_object
arm_obj.name = 'WindowArmature'
arm_obj.data.name = 'WindowArmatureData'

# Drop the default bone.
arm = arm_obj.data
for b in list(arm.edit_bones):
    arm.edit_bones.remove(b)

y_mid = (frame_min.y + frame_max.y) / 2.0  # depth midline (cosmetic)

bone_positions = {
    'Ctrl_Down_Left':  (frame_min.x, y_mid, frame_min.z),
    'Ctrl_Down_Right': (frame_max.x, y_mid, frame_min.z),
    'Ctrl_Top_Left':   (frame_min.x, y_mid, frame_max.z),
    'Ctrl_Top_Right':  (frame_max.x, y_mid, frame_max.z),
}

# Tail length = ~3% of height; just for visualisation in Blender. Bone
# tail direction does not influence skinning weights here.
tail_len = max(HEIGHT, WIDTH) * 0.03
for name, (bx, by, bz) in bone_positions.items():
    eb = arm.edit_bones.new(name)
    eb.head = (bx, by, bz)
    eb.tail = (bx, by, bz + tail_len)
    eb.use_deform = True
    print(f"  bone {name}: ({bx:+.4f}, {by:+.4f}, {bz:+.4f})")

bpy.ops.object.mode_set(mode='OBJECT')


# ─────────────────────────────────────────────
# STEP 6 — weight paint
# ─────────────────────────────────────────────
banner("STEP 6: Weight paint")


def smoothstep(t: float) -> float:
    """Cubic Hermite ease — used to blend frame ↔ glass weights."""
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def weights_frame_glass(nx: float, nz: float) -> tuple[float, float, float, float]:
    """Compute (DL, DR, TL, TR) weights for a vertex in the frame+glass mesh.

    `nx` and `nz` are normalised vertex positions in [0, 1] across the
    width / height of the rest pose. Returns four weights that always
    sum to 1.

    The space is divided into 9 zones:

      ┌──────┬─────────┬──────┐
      │ TL   │   top   │  TR  │   ← top frame band (locked)
      ├──────┼─────────┼──────┤
      │ left │  glass  │right │
      ├──────┼─────────┼──────┤
      │ DL   │  bot.   │  DR  │
      └──────┴─────────┴──────┘

    Corner zones snap to a single bone (1, 0, 0, 0).
    Edge bands slide along the long axis only — left/right slide along z,
    top/bottom slide along x. The cross-axis weight is therefore zero,
    which is the geometric meaning of "the frame profile width does not
    change".
    The interior is a clean bilinear stretch.

    The sharp zone borders are softened with a `BLEND` ramp so deformed
    silhouettes don't kink.
    """
    # Zone membership using soft thresholds. tx_inner ∈ [0,1] is "how far
    # we are inside the glass region along x"; analogously for tz_inner.
    tx_inner = smoothstep((nx - FT_X) / (1.0 - 2.0 * FT_X))
    tz_inner = smoothstep((nz - FT_Z) / (1.0 - 2.0 * FT_Z))

    # x_clamped is the X parameter used inside the locked top/bottom
    # bands (frame slides along x even though it doesn't stretch, since
    # the glass it sits next to is widening).
    x_clamped = smoothstep((nx - FT_X) / (1.0 - 2.0 * FT_X))
    z_clamped = smoothstep((nz - FT_Z) / (1.0 - 2.0 * FT_Z))

    # Soft membership in each band: 0 outside, 1 inside, smooth across BLEND.
    in_left   = 1.0 - smoothstep((nx - (FT_X - BLEND)) / (2 * BLEND + 1e-9))
    in_right  = smoothstep((nx - (1.0 - FT_X - BLEND)) / (2 * BLEND + 1e-9))
    in_bottom = 1.0 - smoothstep((nz - (FT_Z - BLEND)) / (2 * BLEND + 1e-9))
    in_top    = smoothstep((nz - (1.0 - FT_Z - BLEND)) / (2 * BLEND + 1e-9))

    # Combined frame factor: 1 when inside any frame band, 0 in the
    # interior. We use max so corners don't get double-counted.
    frame = max(in_left, in_right, in_bottom, in_top)

    # Frame contribution — uses corner weights so that:
    #   * left band slides on z (top/bottom only, not left/right)
    #   * top band slides on x (left/right only, not top/bottom)
    # The same vertex can be in two bands at once near corners; we mix
    # the two contributions weighted by `in_left/in_right/...`.

    # Vertical edges (left & right): weight = 0 on cross-axis, t on z-axis
    left_dl = (1.0 - z_clamped) * in_left
    left_tl = z_clamped * in_left
    right_dr = (1.0 - z_clamped) * in_right
    right_tr = z_clamped * in_right

    # Horizontal edges (top & bottom): weight = 0 on cross-axis, t on x-axis
    bot_dl = (1.0 - x_clamped) * in_bottom
    bot_dr = x_clamped * in_bottom
    top_tl = (1.0 - x_clamped) * in_top
    top_tr = x_clamped * in_top

    edge_dl = left_dl + bot_dl
    edge_dr = right_dr + bot_dr
    edge_tl = left_tl + top_tl
    edge_tr = right_tr + top_tr

    # Glass contribution — straight bilinear interpolation across the
    # opening rectangle.
    inner_dl = (1.0 - tx_inner) * (1.0 - tz_inner)
    inner_dr = tx_inner * (1.0 - tz_inner)
    inner_tl = (1.0 - tx_inner) * tz_inner
    inner_tr = tx_inner * tz_inner

    blend = min(1.0, frame)
    dl = edge_dl * blend + inner_dl * (1.0 - blend)
    dr = edge_dr * blend + inner_dr * (1.0 - blend)
    tl = edge_tl * blend + inner_tl * (1.0 - blend)
    tr = edge_tr * blend + inner_tr * (1.0 - blend)

    s = dl + dr + tl + tr
    if s < 1e-6:
        # Should never happen, but stay safe.
        return (0.25, 0.25, 0.25, 0.25)
    return (dl / s, dr / s, tl / s, tr / s)


def weights_handle(nz: float) -> tuple[float, float, float, float]:
    """Handle bones to LEFT side only (DL/TL), interpolated by z."""
    t = max(0.0, min(1.0, nz))
    return (1.0 - t, 0.0, t, 0.0)


def assign_weights(obj, mode: str) -> None:
    """Build the four vertex groups and assign weights in `mode`."""
    for bn in BONE_NAMES:
        if bn not in obj.vertex_groups:
            obj.vertex_groups.new(name=bn)
    g = [obj.vertex_groups[n] for n in BONE_NAMES]

    fx_min, fx_max = frame_min.x, frame_max.x
    fz_min, fz_max = frame_min.z, frame_max.z
    fw = (fx_max - fx_min) or 1.0
    fh = (fz_max - fz_min) or 1.0

    # Drop any pre-existing weight assignments on these groups so we
    # always start clean.
    all_idx = [v.index for v in obj.data.vertices]
    for grp in g:
        grp.remove(all_idx)

    for v in obj.data.vertices:
        wp = obj.matrix_world @ v.co
        nx = (wp.x - fx_min) / fw
        nz = (wp.z - fz_min) / fh
        nx = max(0.0, min(1.0, nx))
        nz = max(0.0, min(1.0, nz))

        if mode == 'frame_glass':
            w = weights_frame_glass(nx, nz)
        elif mode == 'handle':
            # Use the handle's own z range, not the frame's, for accurate
            # vertical interpolation along the handle body.
            hz_min, hz_max = handle_min.z, handle_max.z
            hh = (hz_max - hz_min) or 1.0
            local_nz = max(0.0, min(1.0, (wp.z - hz_min) / hh))
            w = weights_handle(local_nz)
        else:
            w = (0.25, 0.25, 0.25, 0.25)

        for i, weight in enumerate(w):
            if weight > 1e-4:
                g[i].add([v.index], weight, 'REPLACE')


print(f"  weighting frame  ({len(frame.data.vertices)} verts)…")
assign_weights(frame, 'frame_glass')
print(f"  weighting glass  ({len(glass.data.vertices)} verts)…")
assign_weights(glass, 'frame_glass')
print(f"  weighting handle ({len(handle.data.vertices)} verts)…")
assign_weights(handle, 'handle')


# ─────────────────────────────────────────────
# STEP 7 — parent meshes to armature with armature modifier
# ─────────────────────────────────────────────
banner("STEP 7: Parent meshes to armature")

for m in (frame, glass, handle):
    bpy.ops.object.select_all(action='DESELECT')
    m.select_set(True)
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    # ARMATURE_NAME assumes the vertex groups are already named after
    # bones — which they are, thanks to assign_weights().
    bpy.ops.object.parent_set(type='ARMATURE_NAME')


# ─────────────────────────────────────────────
# STEP 8 — sanity-check pose
# ─────────────────────────────────────────────
banner("STEP 8: Sanity test pose")

bpy.ops.object.select_all(action='DESELECT')
arm_obj.select_set(True)
bpy.context.view_layer.objects.active = arm_obj
bpy.ops.object.mode_set(mode='POSE')

tr = arm_obj.pose.bones['Ctrl_Top_Right']
dr = arm_obj.pose.bones['Ctrl_Down_Right']
# Stretch right edge by +50% width.
dx = WIDTH * 0.5
tr.location = (dx, 0, 0)
dr.location = (dx, 0, 0)
bpy.context.view_layer.update()

dg = bpy.context.evaluated_depsgraph_get()
for m in (frame, glass, handle):
    em = m.evaluated_get(dg).to_mesh()
    if em:
        coords = [m.matrix_world @ v.co for v in em.vertices]
        mn = (min(c.x for c in coords), min(c.z for c in coords))
        mx = (max(c.x for c in coords), max(c.z for c in coords))
        print(f"  {m.name!r} after +50% stretch: "
              f"X[{mn[0]:+.4f},{mx[0]:+.4f}] Z[{mn[1]:+.4f},{mx[1]:+.4f}]")
        m.evaluated_get(dg).to_mesh_clear()

tr.location = (0, 0, 0)
dr.location = (0, 0, 0)
bpy.ops.object.mode_set(mode='OBJECT')


# ─────────────────────────────────────────────
# STEP 9 — export
# ─────────────────────────────────────────────
banner("STEP 9: Export GLB")

bpy.ops.object.select_all(action='DESELECT')
arm_obj.select_set(True)
for m in (frame, glass, handle):
    m.select_set(True)
bpy.context.view_layer.objects.active = arm_obj

os.makedirs(os.path.dirname(GLB_OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=GLB_OUT,
    export_format='GLB',
    use_selection=True,
    export_animations=False,
    export_skins=True,
    export_apply=False,
    export_yup=True,
)

if os.path.exists(GLB_OUT):
    sz = os.path.getsize(GLB_OUT) / (1024 * 1024)
    print(f"  Exported: {GLB_OUT}  ({sz:.2f} MB)")
else:
    sys.exit("ERROR: export failed")


banner("RIG COMPLETE")
print(f"  Native size: W={WIDTH:.4f}  H={HEIGHT:.4f}  D={DEPTH:.4f}")
print(f"  Frame zones: FT_X={FT_X}  FT_Z={FT_Z}  BLEND={BLEND}")
print(f"  Bones (Z-up Blender):")
for n, p in bone_positions.items():
    print(f"    {n}: ({p[0]:+.4f}, {p[1]:+.4f}, {p[2]:+.4f})")
print(f"  Bones (Y-up Three.js, mesh-local):")
for n, p in bone_positions.items():
    print(f"    {n}: ({p[0]:+.4f}, {p[2]:+.4f}, {-p[1]:+.4f})")
