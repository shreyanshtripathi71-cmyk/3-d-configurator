"""
Blender script: Build a clean procedural picture window and rig it with
4 corner control bones identical to scripts/rig_casement_v2.py.

Why procedural? The original PictureWindow_Model_1.gltf wraps each mesh
(frame, glass front, glass back) in a different parent-node hierarchy
with 90° rotations and a -1 mirror scale. Every flatten attempt we tried
(transform_apply, parent_clear KEEP_TRANSFORM, mesh.data.transform with
the world matrix) ended up emitting a glTF that three.js renders with
the frame and glass on different axes / Z planes. So instead of fighting
that pipeline, this script builds the picture window from primitives at
the same native dimensions as the casement rig:

  * 0.7621 × 1.5247 m world bounds (≈ 30″ × 60″)
  * thinner frame profile than casement (the visible difference)
  * dual glass panes (front + back) for double-glazing transparency
  * 4 corner bones (Ctrl_Down_Left/Right, Ctrl_Top_Left/Right) with
    edge-slide weighting on the frame and bilinear stretch on the glass

Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
      --python scripts/rig_picture_v2.py
"""
import bpy
import bmesh
import mathutils
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
OUTPUT_PATH = os.path.join(
    PROJECT_DIR, 'public', 'windows', 'picture', 'PictureWindow_Rigged_v2.glb')

# Picture-window dimensions match the casement rig's bind pose so a single
# uniform clone scale in three.js works for both models.
WIDTH  = 0.7621      # X (≈ 30″)
HEIGHT = 1.5247      # Z (≈ 60″, Blender Z-up)
DEPTH  = 0.0826      # Y (≈ 3¼″)

# Frame profile — thinner than the casement (FT_X = 0.12 there).
FRAME_THICK_X = 0.07 * WIDTH      # ≈ 2.1″  on each side
FRAME_THICK_Z = 0.04 * HEIGHT     # ≈ 2.4″  on top/bottom
FRAME_DEPTH   = DEPTH * 0.85      # frame profile depth

# Bone weighting fractions used to classify frame vs glass vertices —
# kept identical to scripts/rig_casement_v2.py shape so three.js sees a
# consistent rig.
FT_X = 0.07
FT_Z = 0.04
BONE_NAMES = ['Ctrl_Down_Left', 'Ctrl_Down_Right',
              'Ctrl_Top_Left', 'Ctrl_Top_Right']


def compute_weights(nx, nz):
    in_left = nx < FT_X
    in_right = nx > (1.0 - FT_X)
    in_bottom = nz < FT_Z
    in_top = nz > (1.0 - FT_Z)
    if in_left and in_bottom:
        return (1.0, 0.0, 0.0, 0.0)
    if in_right and in_bottom:
        return (0.0, 1.0, 0.0, 0.0)
    if in_left and in_top:
        return (0.0, 0.0, 1.0, 0.0)
    if in_right and in_top:
        return (0.0, 0.0, 0.0, 1.0)
    if in_left:
        t = max(0, min(1, (nz - FT_Z) / max(1.0 - 2 * FT_Z, 0.001)))
        return (1.0 - t, 0.0, t, 0.0)
    if in_right:
        t = max(0, min(1, (nz - FT_Z) / max(1.0 - 2 * FT_Z, 0.001)))
        return (0.0, 1.0 - t, 0.0, t)
    if in_bottom:
        t = max(0, min(1, (nx - FT_X) / max(1.0 - 2 * FT_X, 0.001)))
        return (1.0 - t, t, 0.0, 0.0)
    if in_top:
        t = max(0, min(1, (nx - FT_X) / max(1.0 - 2 * FT_X, 0.001)))
        return (0.0, 0.0, 1.0 - t, t)
    inner_nx = max(0, min(1, (nx - FT_X) / max(1.0 - 2 * FT_X, 0.001)))
    inner_nz = max(0, min(1, (nz - FT_Z) / max(1.0 - 2 * FT_Z, 0.001)))
    dl = (1.0 - inner_nx) * (1.0 - inner_nz)
    dr = inner_nx * (1.0 - inner_nz)
    tl = (1.0 - inner_nx) * inner_nz
    tr = inner_nx * inner_nz
    return (dl, dr, tl, tr)


# ── Step 0: Reset scene ────────────────────────────────────────────────
print("=" * 60)
print("BUILDING + RIGGING PROCEDURAL PICTURE WINDOW")
print("=" * 60)
bpy.ops.wm.read_factory_settings(use_empty=True)


# ── Step 1: Build the frame as a hollow rectangular profile ───────────
def build_frame_mesh():
    """Outer hollow box minus an inner hollow box → vinyl picture window
    profile with depth FRAME_DEPTH."""
    mesh = bpy.data.meshes.new("Frame")
    obj = bpy.data.objects.new("Frame", mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()

    # Outer box (full size).
    outer = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(WIDTH, FRAME_DEPTH, HEIGHT), verts=outer['verts'])

    # Inner box (slightly smaller in X/Z to leave the frame thickness; same
    # depth so we keep the profile thin in Y). We subtract this from the
    # outer box to leave a hollow frame.
    inner_geom = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(
        bm,
        vec=(WIDTH - 2 * FRAME_THICK_X, FRAME_DEPTH * 1.05, HEIGHT - 2 * FRAME_THICK_Z),
        verts=inner_geom['verts'],
    )

    # We want the inner box hollow → delete its faces so it acts as an
    # opening, then bridge the inner edges with the outer.
    inner_face_indices = {f.index for f in inner_geom['verts'][0].link_faces}
    # Simpler: just delete the inner cube's geometry — what remains is the
    # outer cube. We then create faces ON THE FRONT/BACK of the outer
    # cube that have a rectangular hole cut out.
    bmesh.ops.delete(bm, geom=inner_geom['verts'], context='VERTS')

    # The outer cube is now the only geometry. We need to turn it into a
    # hollow frame by cutting holes in the front and back faces. Easier
    # approach: rebuild the geometry as 8 quads (2 front-facing rings, 2
    # back-facing rings, 4 inner side walls).
    bm.clear()

    halfX, halfY, halfZ = WIDTH / 2, FRAME_DEPTH / 2, HEIGHT / 2
    innerX = halfX - FRAME_THICK_X
    innerZ = halfZ - FRAME_THICK_Z

    def add_ring(y, normal_y):
        """Add a flat rectangular ring (frame face) at depth y. normal_y
        chooses which way the face normal points."""
        # 8 verts — outer corners then inner corners.
        outer = [
            bm.verts.new((-halfX, y, -halfZ)),
            bm.verts.new(( halfX, y, -halfZ)),
            bm.verts.new(( halfX, y,  halfZ)),
            bm.verts.new((-halfX, y,  halfZ)),
        ]
        inner = [
            bm.verts.new((-innerX, y, -innerZ)),
            bm.verts.new(( innerX, y, -innerZ)),
            bm.verts.new(( innerX, y,  innerZ)),
            bm.verts.new((-innerX, y,  innerZ)),
        ]
        # 4 quads forming the ring. Wind so normal points correctly.
        for i in range(4):
            j = (i + 1) % 4
            if normal_y > 0:
                bm.faces.new((outer[i], outer[j], inner[j], inner[i]))
            else:
                bm.faces.new((outer[i], inner[i], inner[j], outer[j]))
        return outer, inner

    front_outer, front_inner = add_ring(+halfY, +1)
    back_outer,  back_inner  = add_ring(-halfY, -1)

    # Side walls — 4 outer (top/bottom/left/right) + 4 inner (the opening
    # walls). Quads connecting front_* to back_*.
    def add_wall(a_front, b_front, b_back, a_back):
        bm.faces.new((a_front, b_front, b_back, a_back))

    # Outer walls (4 sides of the perimeter).
    for i in range(4):
        j = (i + 1) % 4
        add_wall(front_outer[i], front_outer[j], back_outer[j], back_outer[i])
    # Inner walls (the opening) — wind the OTHER way so normals face into
    # the hole.
    for i in range(4):
        j = (i + 1) % 4
        add_wall(front_inner[j], front_inner[i], back_inner[i], back_inner[j])

    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    return obj


def build_glass_mesh(name, y_offset):
    """Flat quad sized to fit just inside the frame opening. We make two
    of these (front and back panes) at slightly different Y depths."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    halfX = (WIDTH - 2 * FRAME_THICK_X) / 2 * 0.99
    halfZ = (HEIGHT - 2 * FRAME_THICK_Z) / 2 * 0.99
    v0 = bm.verts.new((-halfX, y_offset, -halfZ))
    v1 = bm.verts.new(( halfX, y_offset, -halfZ))
    v2 = bm.verts.new(( halfX, y_offset,  halfZ))
    v3 = bm.verts.new((-halfX, y_offset,  halfZ))
    bm.faces.new((v0, v1, v2, v3))
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    return obj


print("\n[1] Building frame and glass meshes…")
frame_obj = build_frame_mesh()
glass_front = build_glass_mesh("Glass_Front", +DEPTH * 0.10)   # in front
glass_back  = build_glass_mesh("Glass_Back",  -DEPTH * 0.10)   # in back

# ── Step 2: Materials ─────────────────────────────────────────────────
def make_material(name, base_color, transparent=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = False
    mat.diffuse_color = base_color
    if transparent:
        # Best-effort transparent material — three.js side overrides it
        # with a proper PhysicalMaterial anyway, so we just need it to
        # carry "glass" in the name for our material-detection heuristic.
        mat.blend_method = 'BLEND'
    return mat


frame_mat = make_material("FrameMaterial", (0.92, 0.92, 0.91, 1.0))
glass_mat = make_material("Glass_245",     (1.0, 1.0, 1.0, 0.18), transparent=True)

frame_obj.data.materials.append(frame_mat)
glass_front.data.materials.append(glass_mat)
glass_back.data.materials.append(glass_mat)

# Sanity-print: vertex counts and bounds.
for obj in (frame_obj, glass_front, glass_back):
    pv = [obj.matrix_world @ v.co for v in obj.data.vertices]
    if not pv:
        continue
    mn = mathutils.Vector((min(v.x for v in pv), min(v.y for v in pv), min(v.z for v in pv)))
    mx = mathutils.Vector((max(v.x for v in pv), max(v.y for v in pv), max(v.z for v in pv)))
    print(f"  {obj.name:14}: verts={len(obj.data.vertices)}  "
          f"X[{mn.x:+.4f},{mx.x:+.4f}] Y[{mn.y:+.4f},{mx.y:+.4f}] Z[{mn.z:+.4f},{mx.z:+.4f}]")

meshes = [frame_obj, glass_front, glass_back]

# ── Step 3: Build armature with 4 corner bones ────────────────────────
print("\n[2] Building armature…")
all_verts = []
for obj in meshes:
    for v in obj.data.vertices:
        all_verts.append(obj.matrix_world @ v.co)
min_x = min(v.x for v in all_verts)
max_x = max(v.x for v in all_verts)
min_y = min(v.y for v in all_verts)
max_y = max(v.y for v in all_verts)
min_z = min(v.z for v in all_verts)
max_z = max(v.z for v in all_verts)
width = max_x - min_x
height = max_z - min_z
depth_center = (min_y + max_y) / 2.0
print(f"  Bounds: X[{min_x:.4f}, {max_x:.4f}]  Z[{min_z:.4f}, {max_z:.4f}]")
print(f"  Width: {width:.4f}, Height: {height:.4f}")

bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
armature_obj = bpy.context.active_object
armature_obj.name = 'WindowArmature'
armature = armature_obj.data
armature.name = 'WindowArmatureData'
for bone in list(armature.edit_bones):
    armature.edit_bones.remove(bone)

BONE_LEN = 0.05
bone_positions = {
    'Ctrl_Down_Left':  (min_x, depth_center, min_z),
    'Ctrl_Down_Right': (max_x, depth_center, min_z),
    'Ctrl_Top_Left':   (min_x, depth_center, max_z),
    'Ctrl_Top_Right':  (max_x, depth_center, max_z),
}
for name, (bx, by, bz) in bone_positions.items():
    bone = armature.edit_bones.new(name)
    bone.head = (bx, by, bz)
    bone.tail = (bx, by, bz + BONE_LEN)
    bone.use_deform = True
    print(f"  Bone {name}: ({bx:+.4f}, {by:+.4f}, {bz:+.4f})")
bpy.ops.object.mode_set(mode='OBJECT')

# ── Step 4: Weight paint & parent each mesh to the armature ───────────
print("\n[3] Weighting + parenting meshes…")
for obj in meshes:
    is_glass = obj.name.lower().startswith('glass')
    label = "GLASS (bilinear)" if is_glass else "FRAME (edge slide)"
    print(f"  '{obj.name}' ({label}, {len(obj.data.vertices)} verts)")

    for bn in BONE_NAMES:
        if bn not in obj.vertex_groups:
            obj.vertex_groups.new(name=bn)
    vg_dl = obj.vertex_groups['Ctrl_Down_Left']
    vg_dr = obj.vertex_groups['Ctrl_Down_Right']
    vg_tl = obj.vertex_groups['Ctrl_Top_Left']
    vg_tr = obj.vertex_groups['Ctrl_Top_Right']
    groups = [vg_dl, vg_dr, vg_tl, vg_tr]

    for v in obj.data.vertices:
        world_pos = obj.matrix_world @ v.co
        nx = (world_pos.x - min_x) / width if width > 0 else 0.5
        nz = (world_pos.z - min_z) / height if height > 0 else 0.5
        nx = max(0.0, min(1.0, nx))
        nz = max(0.0, min(1.0, nz))
        if is_glass:
            dl = (1.0 - nx) * (1.0 - nz)
            dr = nx * (1.0 - nz)
            tl = (1.0 - nx) * nz
            tr = nx * nz
            weights = (dl, dr, tl, tr)
        else:
            weights = compute_weights(nx, nz)
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

# ── Step 5: Sanity validation ─────────────────────────────────────────
print("\n[4] Validation: TR bone +0.2X / +0.2Z…")
bpy.context.view_layer.objects.active = armature_obj
bpy.ops.object.mode_set(mode='POSE')
tr_pose = armature_obj.pose.bones.get('Ctrl_Top_Right')
if tr_pose:
    tr_pose.location = (0.2, 0, 0.2)
    bpy.context.view_layer.update()
    for obj in meshes:
        depsgraph = bpy.context.evaluated_depsgraph_get()
        eval_obj = obj.evaluated_get(depsgraph)
        eval_mesh = eval_obj.to_mesh()
        if eval_mesh:
            ev = [eval_obj.matrix_world @ v.co for v in eval_mesh.vertices]
            ov = [obj.matrix_world @ v.co for v in obj.data.vertices]
            dx = max(v.x for v in ev) - max(v.x for v in ov)
            dz = max(v.z for v in ev) - max(v.z for v in ov)
            print(f"  {obj.name}: max_x +{dx:.4f}, max_z +{dz:.4f}")
            eval_obj.to_mesh_clear()
    tr_pose.location = (0, 0, 0)
    bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode='OBJECT')

# ── Step 6: Export rigged glb ─────────────────────────────────────────
print(f"\n[5] Exporting → {OUTPUT_PATH}")
bpy.ops.export_scene.gltf(
    filepath=OUTPUT_PATH,
    export_format='GLB',
    export_skins=True,
    export_animations=False,
    export_apply=False,
    use_active_collection=False,
)

if os.path.exists(OUTPUT_PATH):
    file_size = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"✓ Exported {file_size:.1f} KB")
else:
    print("✗ Export FAILED!")

print("\n── Three.js Y-up rest bone positions ──")
for name, (bx, by, bz) in bone_positions.items():
    print(f"  {name}: ({bx:+.4f}, {bz:+.4f}, {-by:+.4f})")
print(f"width={width:.4f}, height={height:.4f}, FT_X={FT_X}, FT_Z={FT_Z}")
print("=" * 60)
