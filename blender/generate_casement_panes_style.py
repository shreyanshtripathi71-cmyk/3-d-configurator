"""
Blender script — Procedural Casement Window (panes.com-inspired design language)

Builds a clean, modern, slim-profile casement window from scratch.
Inspired by visual reference of panes.com vinyl casement (NOT a copy of their
asset — this is original geometry built from real-world dimensions).

Design language:
  - Slim flat outer frame profile (3 1/4" depth, ~2 1/4" face width)
  - Even slimmer sash frame inside, with mitered welded look
  - Recessed double-pane glass
  - Folding handle on the right interior
  - Two visible hinges on the left side
  - White vinyl materials + glass + brushed metal hardware
  - Mesh names tagged so WindowViewer auto-classifier picks the right
    materials (frame / glass / handle).

Default outer dimensions: 35"W × 49"H × 3 1/4"D (matching panes.com default).

Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
      --python blender/generate_casement_panes_style.py
"""

import bpy
import bmesh
import math
import os
from mathutils import Vector

# ─── Paths ───────────────────────────────────────────────────────────────────
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(PROJECT_ROOT, 'public', 'windows', 'casement')
OUT_GLB = os.path.join(OUT_DIR, 'CasementWindow_PanesStyle.glb')

# ─── Dimensions (meters; 1" = 0.0254m) ───────────────────────────────────────
INCH = 0.0254
W = 35.0 * INCH       # outer width  (~0.889 m)
H = 49.0 * INCH       # outer height (~1.245 m)
D = 3.25 * INCH       # frame depth front-to-back (~0.0826 m, panes.com spec)

# Outer frame (the static structural frame mounted in the wall)
OUTER_FACE = 2.25 * INCH        # face thickness visible from front/back
OUTER_REBATE_DEPTH = 0.5 * INCH # depth of inner step where sash seats
OUTER_REBATE_WIDTH = 0.55 * INCH

# Sash (the moving part holding the glass)
SASH_GAP = 0.10 * INCH          # operable gap between outer frame and sash
SASH_FACE = 1.75 * INCH         # slimmer than outer frame
SASH_DEPTH = 2.50 * INCH        # sash thickness front-to-back
# Sash sits across most of the outer frame depth, slightly proud of the front
# (typical for outward-opening casement) and inset from the back so trim/jambs
# read cleanly on the interior. Centre of sash in Y:
SASH_Y_OFFSET = 0.20 * INCH     # +Y = forward (exterior) bias

# Glass
GLASS_THICK = 0.875 * INCH      # 7/8" double-pane (panes.com spec)
GLASS_INSET_FRONT = 0.40 * INCH # how far back from sash front the glass sits

# Hardware
HANDLE_W = 1.0 * INCH
HANDLE_H = 4.5 * INCH
HANDLE_D = 0.55 * INCH
HANDLE_LEVER_LEN = 3.0 * INCH
HANDLE_LEVER_THICK = 0.30 * INCH

HINGE_RADIUS = 0.45 * INCH
HINGE_LEN = 3.0 * INCH
HINGE_INSET_TOP = 4.0 * INCH    # from top edge
HINGE_INSET_BOT = 4.0 * INCH    # from bottom edge


# ─── Utilities ───────────────────────────────────────────────────────────────
def log(msg):
    print(f"  {msg}")


def banner(msg):
    print("\n" + "=" * 60)
    print(f"  {msg}")
    print("=" * 60 + "\n")


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for col in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures,
                bpy.data.images, bpy.data.textures):
        for item in list(col):
            col.remove(item)


def new_bm():
    return bmesh.new()


def bm_to_obj(bm, name, mat=None):
    """Finalize a bmesh to a new mesh object in the scene."""
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj


def add_box(bm, cx, cy, cz, sx, sy, sz):
    """Add an axis-aligned box centered at (cx,cy,cz) with size (sx,sy,sz)."""
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    verts = [
        bm.verts.new((cx - hx, cy - hy, cz - hz)),
        bm.verts.new((cx + hx, cy - hy, cz - hz)),
        bm.verts.new((cx + hx, cy + hy, cz - hz)),
        bm.verts.new((cx - hx, cy + hy, cz - hz)),
        bm.verts.new((cx - hx, cy - hy, cz + hz)),
        bm.verts.new((cx + hx, cy - hy, cz + hz)),
        bm.verts.new((cx + hx, cy + hy, cz + hz)),
        bm.verts.new((cx - hx, cy + hy, cz + hz)),
    ]
    bm.faces.new([verts[0], verts[1], verts[2], verts[3]])  # bottom
    bm.faces.new([verts[7], verts[6], verts[5], verts[4]])  # top
    bm.faces.new([verts[0], verts[4], verts[5], verts[1]])  # front (-Y)
    bm.faces.new([verts[2], verts[6], verts[7], verts[3]])  # back  (+Y)
    bm.faces.new([verts[0], verts[3], verts[7], verts[4]])  # left  (-X)
    bm.faces.new([verts[1], verts[5], verts[6], verts[2]])  # right (+X)


def add_cylinder(bm, cx, cy, cz, radius, length, segs=24, axis='Y'):
    """Add a cylinder centered at (cx,cy,cz). Axis = 'X','Y','Z'."""
    half = length / 2
    ring_a = []
    ring_b = []
    for i in range(segs):
        a = (i / segs) * math.tau
        ca, sa = math.cos(a), math.sin(a)
        if axis == 'Y':
            ra = bm.verts.new((cx + radius * ca, cy - half, cz + radius * sa))
            rb = bm.verts.new((cx + radius * ca, cy + half, cz + radius * sa))
        elif axis == 'X':
            ra = bm.verts.new((cx - half, cy + radius * ca, cz + radius * sa))
            rb = bm.verts.new((cx + half, cy + radius * ca, cz + radius * sa))
        else:  # 'Z'
            ra = bm.verts.new((cx + radius * ca, cy + radius * sa, cz - half))
            rb = bm.verts.new((cx + radius * ca, cy + radius * sa, cz + half))
        ring_a.append(ra)
        ring_b.append(rb)
    for i in range(segs):
        j = (i + 1) % segs
        bm.faces.new([ring_a[i], ring_b[i], ring_b[j], ring_a[j]])
    # caps
    bm.faces.new(list(reversed(ring_a)))
    bm.faces.new(ring_b)


# ─── Materials ───────────────────────────────────────────────────────────────
def make_material(name, base_color, roughness=0.6, metallic=0.0,
                  transmission=0.0, ior=1.45, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if not bsdf:
        return mat
    bsdf.inputs['Base Color'].default_value = (*base_color, alpha)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    # Names of transmission/IoR sockets vary across Blender versions; guard.
    for sock_name, val in (('Transmission Weight', transmission),
                           ('Transmission', transmission),
                           ('IOR', ior),
                           ('Alpha', alpha)):
        if sock_name in bsdf.inputs:
            bsdf.inputs[sock_name].default_value = val
    if alpha < 1.0:
        mat.blend_method = 'BLEND'
    return mat


def setup_materials():
    """All material names follow what WindowViewer's classifier expects."""
    mats = {}
    # White vinyl frame — gets auto-tinted by the user's exterior colour picker
    mats['frame'] = make_material(
        'CasementFrame', base_color=(0.93, 0.93, 0.91),
        roughness=0.55, metallic=0.0,
    )
    # Glass — viewer detects "glass" in name OR transparent material
    mats['glass'] = make_material(
        'CasementGlass', base_color=(0.85, 0.92, 0.95),
        roughness=0.05, metallic=0.0,
        transmission=0.95, ior=1.52, alpha=0.18,
    )
    # Hardware — viewer detects metalness > 0.5 OR "handle"/"#290" in name
    mats['handle'] = make_material(
        'CasementHandle_#290', base_color=(0.78, 0.78, 0.80),
        roughness=0.30, metallic=0.85,
    )
    return mats


# ─── Geometry builders ───────────────────────────────────────────────────────
def build_outer_frame(mat):
    """
    Hollow rectangular tube forming the wall-mounted outer frame, with a
    rebate (step) on the inner front edge where the sash seats. Built as
    one mesh so the viewer's face-normal split (front → exterior, back →
    interior) gets a clean inside/outside distinction.
    """
    bm = new_bm()
    hw, hh = W / 2, H / 2
    inner_w = W - 2 * OUTER_FACE
    inner_h = H - 2 * OUTER_FACE
    rebate_w = inner_w + 2 * OUTER_REBATE_WIDTH
    rebate_h = inner_h + 2 * OUTER_REBATE_WIDTH

    # ── 4 frame bars (top, bottom, left, right) — built as boxes,
    # dimensions slightly overlap at the corners; we'll dissolve interior
    # faces if needed by relying on remove_doubles below.
    # bottom bar
    add_box(bm, 0, 0, -hh + OUTER_FACE / 2,
            W, D, OUTER_FACE)
    # top bar
    add_box(bm, 0, 0, hh - OUTER_FACE / 2,
            W, D, OUTER_FACE)
    # left bar (between top and bottom, fills the side)
    add_box(bm, -hw + OUTER_FACE / 2, 0, 0,
            OUTER_FACE, D, H - 2 * OUTER_FACE)
    # right bar
    add_box(bm, hw - OUTER_FACE / 2, 0, 0,
            OUTER_FACE, D, H - 2 * OUTER_FACE)

    # ── Rebate step on the inner front edge — a thin inner ring set
    # back from the front face, giving the multi-chamber profile look.
    # Built as four thin bars surrounding the sash opening.
    rebate_z_offset = D / 2 - OUTER_REBATE_DEPTH / 2  # centred just inside front
    # bottom rebate bar
    add_box(bm, 0, rebate_z_offset, -inner_h / 2 - OUTER_REBATE_WIDTH / 2,
            rebate_w, OUTER_REBATE_DEPTH, OUTER_REBATE_WIDTH)
    # top rebate bar
    add_box(bm, 0, rebate_z_offset, inner_h / 2 + OUTER_REBATE_WIDTH / 2,
            rebate_w, OUTER_REBATE_DEPTH, OUTER_REBATE_WIDTH)
    # left rebate bar
    add_box(bm, -inner_w / 2 - OUTER_REBATE_WIDTH / 2, rebate_z_offset, 0,
            OUTER_REBATE_WIDTH, OUTER_REBATE_DEPTH, inner_h)
    # right rebate bar
    add_box(bm, inner_w / 2 + OUTER_REBATE_WIDTH / 2, rebate_z_offset, 0,
            OUTER_REBATE_WIDTH, OUTER_REBATE_DEPTH, inner_h)

    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.normal_update()
    obj = bm_to_obj(bm, 'Frame_Outer', mat)
    return obj


def build_sash(mat):
    """
    Slimmer rectangular hollow tube that holds the glass — sits inside
    the outer frame's rebate. Uses mitered-looking corners (achieved by
    overlapping bars; cleaned with remove_doubles).
    """
    bm = new_bm()
    sash_outer_w = W - 2 * OUTER_FACE - 2 * SASH_GAP
    sash_outer_h = H - 2 * OUTER_FACE - 2 * SASH_GAP
    sash_inner_w = sash_outer_w - 2 * SASH_FACE
    sash_inner_h = sash_outer_h - 2 * SASH_FACE
    # Sash sits across most of the outer frame depth, slightly biased
    # forward so it reads as "proud" of the exterior face (typical
    # outward-opening casement profile).
    sash_y_center = SASH_Y_OFFSET

    # bottom sash bar
    add_box(bm, 0, sash_y_center, -sash_outer_h / 2 + SASH_FACE / 2,
            sash_outer_w, SASH_DEPTH, SASH_FACE)
    # top sash bar
    add_box(bm, 0, sash_y_center, sash_outer_h / 2 - SASH_FACE / 2,
            sash_outer_w, SASH_DEPTH, SASH_FACE)
    # left sash bar
    add_box(bm, -sash_outer_w / 2 + SASH_FACE / 2, sash_y_center, 0,
            SASH_FACE, SASH_DEPTH, sash_outer_h - 2 * SASH_FACE)
    # right sash bar
    add_box(bm, sash_outer_w / 2 - SASH_FACE / 2, sash_y_center, 0,
            SASH_FACE, SASH_DEPTH, sash_outer_h - 2 * SASH_FACE)

    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.normal_update()
    obj = bm_to_obj(bm, 'Frame_Sash', mat)
    # Stash inner glass dims as custom props so glass builder can read them
    obj['_glass_w'] = sash_inner_w + 0.30 * INCH  # slight overlap behind sash face
    obj['_glass_h'] = sash_inner_h + 0.30 * INCH
    obj['_sash_y_center'] = sash_y_center
    return obj


def build_glass(sash_obj, mat):
    """Single glazing plane (visually reads as the IGU)."""
    gw = sash_obj['_glass_w']
    gh = sash_obj['_glass_h']
    sy = sash_obj['_sash_y_center']
    # Glass sits slightly forward of sash centre to look set into the front
    glass_y = sy - SASH_DEPTH / 2 + GLASS_INSET_FRONT + GLASS_THICK / 2

    bm = new_bm()
    add_box(bm, 0, glass_y, 0, gw, GLASS_THICK, gh)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.normal_update()
    return bm_to_obj(bm, 'Glass_Pane', mat)


def build_handle(mat):
    """Folding handle on the right interior side of the sash."""
    bm = new_bm()
    sash_outer_w = W - 2 * OUTER_FACE - 2 * SASH_GAP
    sash_y_center = SASH_Y_OFFSET
    # Mounted on the back face of the sash (interior side), near right vertical bar
    handle_x = sash_outer_w / 2 - SASH_FACE - HANDLE_W / 2 - 0.25 * INCH
    handle_y = sash_y_center - SASH_DEPTH / 2 - HANDLE_D / 2  # behind sash (interior)
    handle_z = 0.0  # vertically centred

    # Base plate
    add_box(bm, handle_x, handle_y, handle_z, HANDLE_W, HANDLE_D, HANDLE_H)
    # Folding lever (in stowed position — folded down vertically)
    lever_x = handle_x
    lever_y = handle_y - HANDLE_D / 2 - HANDLE_LEVER_THICK / 2
    lever_z = handle_z - HANDLE_H / 4  # offset slightly down
    add_box(bm, lever_x, lever_y, lever_z,
            HANDLE_LEVER_THICK * 1.2, HANDLE_LEVER_THICK,
            HANDLE_LEVER_LEN)
    # Pivot pin (small cylinder) — purely cosmetic detail
    add_cylinder(bm, handle_x, handle_y - HANDLE_D / 2,
                 handle_z + HANDLE_H / 4, HANDLE_LEVER_THICK / 1.5,
                 HANDLE_LEVER_THICK * 1.5, segs=12, axis='Y')

    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.normal_update()
    return bm_to_obj(bm, 'Handle_Folding', mat)


def build_hinges(mat):
    """Two visible hinge pivots on the left side of the sash."""
    bm = new_bm()
    sash_outer_w = W - 2 * OUTER_FACE - 2 * SASH_GAP
    # Hinge sits on the interface between the outer frame and sash on the left,
    # near the front (exterior) face since casements open outward.
    hinge_x = -sash_outer_w / 2 - SASH_GAP / 2 - HINGE_RADIUS * 0.6
    hinge_y = SASH_Y_OFFSET + SASH_DEPTH / 2 - HINGE_LEN / 2 - 0.05 * INCH

    # Top hinge
    z_top = H / 2 - OUTER_FACE - HINGE_INSET_TOP
    add_cylinder(bm, hinge_x, hinge_y, z_top, HINGE_RADIUS, HINGE_LEN,
                 segs=20, axis='Y')
    # Bottom hinge
    z_bot = -H / 2 + OUTER_FACE + HINGE_INSET_BOT
    add_cylinder(bm, hinge_x, hinge_y, z_bot, HINGE_RADIUS, HINGE_LEN,
                 segs=20, axis='Y')

    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.normal_update()
    return bm_to_obj(bm, 'Hinges', mat)


# ─── Build pipeline ──────────────────────────────────────────────────────────
def main():
    banner("CASEMENT — PANES.COM-INSPIRED PROCEDURAL BUILD")
    log(f"Outer dims: {W/INCH:.2f}\" × {H/INCH:.2f}\" × {D/INCH:.2f}\"")
    log(f"Output: {OUT_GLB}")

    log("[1/6] Clearing scene...")
    clear_scene()

    log("[2/6] Creating materials...")
    mats = setup_materials()

    log("[3/6] Building outer frame...")
    outer = build_outer_frame(mats['frame'])
    log(f"      verts={len(outer.data.vertices)}  faces={len(outer.data.polygons)}")

    log("[4/6] Building sash + glass...")
    sash = build_sash(mats['frame'])
    glass = build_glass(sash, mats['glass'])
    log(f"      sash verts={len(sash.data.vertices)}  glass verts={len(glass.data.vertices)}")

    log("[5/6] Building hardware (handle + hinges)...")
    handle = build_handle(mats['handle'])
    hinges = build_hinges(mats['handle'])
    log(f"      handle verts={len(handle.data.vertices)}  hinges verts={len(hinges.data.vertices)}")

    # Smooth shade hinges (cylindrical) and handle pivot only — the rest
    # should stay flat for crisp panes.com-style edges.
    for obj in (hinges,):
        bpy.context.view_layer.objects.active = obj
        for f in obj.data.polygons:
            f.use_smooth = True

    # Compute final bounds for verification
    all_meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    total_verts = sum(len(o.data.vertices) for o in all_meshes)
    log(f"      Total mesh objects: {len(all_meshes)}, total verts: {total_verts}")

    # Bounds check
    big = Vector((float('inf'), float('inf'), float('inf')))
    bmin = Vector((float('inf'),) * 3)
    bmax = Vector((-float('inf'),) * 3)
    for o in all_meshes:
        for v in o.data.vertices:
            wv = o.matrix_world @ v.co
            for i in range(3):
                if wv[i] < bmin[i]:
                    bmin[i] = wv[i]
                if wv[i] > bmax[i]:
                    bmax[i] = wv[i]
    log(f"      Bounds X: [{bmin.x:.4f}, {bmax.x:.4f}]  W={bmax.x-bmin.x:.4f} m"
        f" ({(bmax.x-bmin.x)/INCH:.2f}\")")
    log(f"      Bounds Y: [{bmin.y:.4f}, {bmax.y:.4f}]  D={bmax.y-bmin.y:.4f} m"
        f" ({(bmax.y-bmin.y)/INCH:.2f}\")")
    log(f"      Bounds Z: [{bmin.z:.4f}, {bmax.z:.4f}]  H={bmax.z-bmin.z:.4f} m"
        f" ({(bmax.z-bmin.z)/INCH:.2f}\")")

    log(f"[6/6] Exporting GLB to {OUT_GLB}...")
    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    # Apply transforms so the exporter writes clean local-space verts
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Note: we export with Y-up so it matches the existing project convention
    # (WindowViewer expects Y-up; the rest of the casement files use it too).
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_materials='EXPORT',
        export_yup=True,
        export_normals=True,
        # Light Draco compression keeps the file tiny while preserving quality
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
    )

    if os.path.exists(OUT_GLB):
        size_kb = os.path.getsize(OUT_GLB) / 1024
        log(f"      ✓ Exported successfully ({size_kb:.1f} KB)")
    else:
        log("      ✗ EXPORT FAILED")

    banner("DONE")


if __name__ == '__main__':
    main()
