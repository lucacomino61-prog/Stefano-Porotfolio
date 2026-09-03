def shift(dx=0.0, dy=0.0, dz=0.0):
    """Move everything built since the last call.

    Lets a block be authored in whatever coordinates are convenient — the
    forecourt is written as if it stood at the origin — and then put where it
    belongs, without every line inside it carrying the same offset.
    """
    for ob in _fresh():
        ob.location.x += dx
        ob.location.y += dy
        ob.location.z += dz

# Five buildings side by side along a road, organised like jesse-zhou.com's ramen shop:
#   lot 0  GARAGE     mechanic workshop
#   lot 1  BANK       Raiffeisen bank branch (yellow / black)
#   lot 2  MILANO     Milan café / fashion (arcade, tricolore, Duomo cut-out)
#   lot 3  FARMACIA   pharmacy (green cross)
#   lot 4  BEACH      Bar Martiri, the beach bar at Spille (Rruga e Pishave): wooden bar hut with a straw roof,
#                     deck, sunbeds + umbrellas, pines, the sea behind
# bake groups (one 2048 atlas each): SHELL, GROUND, GARAGE, BANK, MILANO, FARMACIA, BEACH, EXTERIOR
# not baked: EMISSIVE (bloom), SCREENS (swapped textures), SIGNS + HITBOX (menu), DYNAMIC (matcap, animated)
# run:  blender -b -P build_street.py   (saves garage.blend next to this file, renders previews)
import bpy, bmesh, math, os
from mathutils import Vector, Euler, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
# The blend the bake and the site both read lives with the other art sources,
# not beside the script that writes it. This wrote garage.blend into
# scripts/tower/ while every reader looked in assets/blender/, so a rebuild
# silently changed nothing anyone loaded.
ROOT = os.path.dirname(os.path.dirname(HERE))
BLEND_DIR = os.path.join(ROOT, 'assets', 'blender')
PREVIEW_DIR = os.path.join(ROOT, 'assets', 'blender', 'previews')
os.makedirs(BLEND_DIR, exist_ok=True); os.makedirs(PREVIEW_DIR, exist_ok=True)

bpy.ops.wm.read_homefile(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
for m in list(bpy.data.materials): bpy.data.materials.remove(m)

GROUPS = ['SHELL', 'GROUND', 'GARAGE', 'BANK', 'MILANO', 'FARMACIA', 'BEACH', 'EXTERIOR', 'EMISSIVE', 'SCREENS', 'SIGNS', 'HITBOX', 'DYNAMIC', 'LIGHTS']
COLL = {}
for g in GROUPS:
    c = bpy.data.collections.new(g); scene.collection.children.link(c); COLL[g] = c

# ---------------------------------------------------------------- materials
MATS = {}

def _socket(node, *names):
    """The first of these sockets the running Blender actually has.

    Blender 4.0 renamed a set of Principled BSDF inputs — 'Emission' became
    'Emission Color' among them — so a script written against 3.x dies on the
    lookup rather than on anything to do with what it is building. Asking for
    the new name first and falling back keeps one script working on both.
    """
    for n in names:
        if n in node.inputs:
            return node.inputs[n]
    raise KeyError(f'{node.name}: none of {names} exist; sockets are {[i.name for i in node.inputs]}')

def mat(name, color, rough=0.6, metal=0.0, emit=None, strength=0.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    _socket(b, 'Base Color').default_value = (*color, 1.0)
    _socket(b, 'Roughness').default_value = rough
    _socket(b, 'Metallic').default_value = metal
    if emit is not None:
        _socket(b, 'Emission Color', 'Emission').default_value = (*emit, 1.0)
        _socket(b, 'Emission Strength').default_value = strength
    m.diffuse_color = (*color, 1.0); MATS[name] = m; return m

M = {k: mat(k, *v) for k, v in {
    'concrete':  ((0.30, 0.31, 0.48), 0.8),
    'concrete2': ((0.24, 0.20, 0.42), 0.85),
    'asphalt':   ((0.09, 0.09, 0.14), 0.95),
    'kerb':      ((0.55, 0.55, 0.62), 0.8),
    'wallPurple':((0.32, 0.16, 0.66), 0.75),
    'wallMagenta':((0.80, 0.12, 0.48), 0.7),
    'wallCream': ((0.96, 0.88, 0.70), 0.8),
    'wallBankGrey':((0.36, 0.36, 0.42), 0.8),
    'wallMint':  ((0.62, 0.92, 0.80), 0.8),
    'wallTerracotta':((0.85, 0.42, 0.28), 0.8),
    'coral':     ((0.96, 0.34, 0.20), 0.8),
    'roof':      ((0.10, 0.14, 0.52), 0.85),
    'slab':      ((0.18, 0.20, 0.40), 0.85),
    'steel':     ((0.70, 0.78, 0.90), 0.3, 0.8),
    'steelDark': ((0.22, 0.30, 0.55), 0.45, 0.7),
    'rubber':    ((0.05, 0.05, 0.10), 0.9),
    'hub':       ((0.85, 0.88, 0.95), 0.3, 0.9),
    'yellow':    ((1.00, 0.74, 0.05), 0.5),
    'bankYellow':((1.00, 0.82, 0.00), 0.45),
    'red':       ((0.92, 0.06, 0.12), 0.45),
    'blue':      ((0.10, 0.38, 0.98), 0.5),
    'orange':    ((1.00, 0.42, 0.04), 0.5),
    'white':     ((0.95, 0.95, 0.98), 0.6),
    'wood':      ((0.90, 0.48, 0.16), 0.65),
    'woodDark':  ((0.62, 0.26, 0.10), 0.7),
    'woodPale':  ((0.86, 0.70, 0.45), 0.7),
    'straw':     ((0.88, 0.72, 0.36), 0.9),
    'sand':      ((0.93, 0.82, 0.58), 0.9),
    'sea':       ((0.05, 0.55, 0.70), 0.15, 0.1),
    'seaDeep':   ((0.02, 0.28, 0.55), 0.2, 0.1),
    'foam':      ((0.90, 0.97, 1.00), 0.6),
    'pine':      ((0.10, 0.40, 0.22), 0.8),
    'pineDark':  ((0.06, 0.28, 0.16), 0.8),
    'turquoise': ((0.10, 0.80, 0.78), 0.5),
    'carPaint':  ((0.04, 0.80, 0.90), 0.25, 0.3),
    'glass':     ((0.10, 0.14, 0.30), 0.1, 0.5),
    'purple':    ((0.86, 0.10, 0.78), 0.55),
    'pink':      ((0.98, 0.20, 0.62), 0.5),
    'green':     ((0.12, 0.85, 0.42), 0.55),
    'pharmaGreen':((0.05, 0.62, 0.32), 0.55),
    'italyGreen':((0.00, 0.55, 0.27), 0.5),
    'italyRed':  ((0.81, 0.10, 0.15), 0.5),
    'marble':    ((0.92, 0.92, 0.90), 0.35),
    'black':     ((0.03, 0.03, 0.06), 0.7),
    'screenOff': ((0.02, 0.02, 0.03), 0.2),
    'hitbox':    ((1.0, 0.0, 0.0), 1.0),
}.items()}
E = {
    'neonPink':   mat('neonPink',   (1, 0.2, 0.8),  emit=(1.0, 0.12, 0.72), strength=12),
    'neonBlue':   mat('neonBlue',   (0.2, 0.9, 1),  emit=(0.0, 0.85, 1.0),  strength=12),
    'neonYellow': mat('neonYellow', (1, 0.95, 0.4), emit=(1.0, 0.85, 0.2),  strength=10),
    'neonGreen':  mat('neonGreen',  (0.3, 1, 0.5),  emit=(0.1, 1.0, 0.35),  strength=10),
    'neonRed':    mat('neonRed',    (1, 0.3, 0.3),  emit=(1.0, 0.1, 0.15),  strength=10),
    'neonWhite':  mat('neonWhite',  (1, 1, 1),      emit=(1.0, 0.97, 0.9),  strength=8),
    'neonOrange': mat('neonOrange', (1, 0.6, 0.3),  emit=(1.0, 0.45, 0.1),  strength=10),
    'tubeLight':  mat('tubeLight',  (1, 1, 1),      emit=(1.0, 0.95, 0.85), strength=3),
    'lampLight':  mat('lampLight',  (1, 1, 1),      emit=(1.0, 0.9, 0.7),   strength=5),
    'redLED':     mat('redLED',     (1, 0.1, 0.1),  emit=(1.0, 0.05, 0.1),  strength=15),
    'greenLED':   mat('greenLED',   (0.2, 1, 0.3),  emit=(0.1, 1.0, 0.25),  strength=15),
    'windowLit':  mat('windowLit',  (1, 0.85, 0.6), emit=(1.0, 0.75, 0.45), strength=4),
    'wallLamp':   mat('wallLamp',   (1, 1, 0.9),    emit=(1.0, 0.85, 0.6),  strength=8),
}

# ---------------------------------------------------------------- mesh helpers (all positions are offset by the current lot origin OX)
OX = 0.0
def _finish(name, bm, coll, material, loc=(0, 0, 0), rot=(0, 0, 0)):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); ob.location = (loc[0] + OX, loc[1], loc[2]); ob.rotation_euler = Euler(rot)
    if material is not None: me.materials.append(material)
    COLL[coll].objects.link(ob); return ob

# Every edge is chamfered, and that is most of the look.
#
# A cube with true 90-degree edges has nothing for light to do at the corner:
# two faces meet at one value each and the join is a hard line that reads as
# untextured CG no matter how good the bake is. A chamfer gives the corner a
# third, narrow face at an angle to both, so it catches a highlight from the
# neon on one side and stays in shadow on the other. That thin bright line
# along every edge is what makes a stylised block read as a modelled object.
#
# A rounded fillet, not a flat cut. Two segments plus smooth shading across
# them (see shade_soft at the end of the build) is what reads as a turned edge:
# three narrow faces stepping around the corner, shaded as one continuous
# curve, so the highlight travels along the edge instead of stopping dead on it.
# Two rather than four because every extra segment is more faces competing for
# room in the same 2048 atlas, and past two the bake loses more to island
# packing than the silhouette gains.
CHAMFER = 0.09
CHAMFER_MIN = 0.004     # below this the cut is under a pixel in the bake
CHAMFER_SEG = 2

def box(name, dims, loc, coll, material, rot=(0, 0, 0), chamfer=None):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(dims), verts=bm.verts)
    # Hitboxes are collision volumes nobody sees; rounding them only adds
    # vertices to the ray test. Everything else gets the fillet.
    if coll != 'HITBOX':
        want = CHAMFER if chamfer is None else chamfer
        # Never eat more than a quarter of the thinnest side, or a road marking
        # 12mm thick becomes a lozenge and a windowpane collapses on itself.
        width = min(want, min(abs(d) for d in dims) * 0.25)
        if width >= CHAMFER_MIN:
            made = bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                                   offset=width, offset_type='OFFSET', segments=CHAMFER_SEG,
                                   profile=0.5, affect='EDGES', clamp_overlap=True)
            # Smooth the bevel, and ONLY the bevel.
            #
            # Shading every face smooth looks right on a 30cm prop and destroys
            # anything large. A face's shading normal is interpolated from its
            # corners, and on a beveled box every corner normal is tilted 45
            # degrees into the round — so on the 14m lid of the cube that tilt
            # got interpolated across the whole surface, the lid stopped facing
            # up, and it rendered black under a light directly above it.
            #
            # Restricting it to the faces the bevel created keeps the flat
            # surfaces flat and honest, and still sweeps the highlight round
            # the corner, which was the only reason to smooth anything.
            for face in made['faces']:
                face.smooth = True
    return _finish(name, bm, coll, material, loc, rot)

def cyl(name, r, h, loc, coll, material, seg=16, rot=(0, 0, 0), r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=(r if r2 is None else r2), depth=h)
    return _finish(name, bm, coll, material, loc, rot)

def sphere(name, r, loc, coll, material, seg=12, rings=8):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    return _finish(name, bm, coll, material, loc)

def plane(name, w, h, loc, coll, material, rot=(0, 0, 0)):
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in [(-w/2, 0, -h/2), (w/2, 0, -h/2), (w/2, 0, h/2), (-w/2, 0, h/2)]]
    f = bm.faces.new(v); uv = bm.loops.layers.uv.new('UVMap')
    for loop, t in zip(f.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]): loop[uv].uv = t
    return _finish(name, bm, coll, material, loc, rot)

def pennant(name, w, h, loc, coll, material):
    """a hanging triangle, both faces, so the bunting reads from the road and from the alley"""
    bm = bmesh.new()
    for order in ((0, 1, 2), (0, 2, 1)):
        pts = [(-w/2, 0, h/2), (0, 0, -h/2), (w/2, 0, h/2)]
        bm.faces.new([bm.verts.new(pts[i]) for i in order])
    return _finish(name, bm, coll, material, loc)

def cone_roof(name, r, h, loc, coll, material, seg=10):
    """hollow-looking straw cone: a cone plus a slightly smaller darker cone underneath"""
    cyl(name, r, h, loc, coll, material, seg=seg, r2=0.05)
    return cyl(name + 'Under', r - 0.08, h - 0.1, (loc[0], loc[1], loc[2] - 0.08), coll, M['woodDark'], seg=seg, r2=0.04)

def arch_wall(name, w, h, t, loc, coll, material, arches=3, aw=1.4, ah=2.2):
    pitch = w / arches; pw = pitch - aw
    bm = bmesh.new()
    for cx in [(-w/2 + pitch * (i + 0.5)) for i in range(arches)]:
        for sx in (-1, 1):
            r = bmesh.ops.create_cube(bm, size=1.0)
            bmesh.ops.scale(bm, vec=Vector((pw/2, t, ah)), verts=r['verts'])
            bmesh.ops.translate(bm, vec=Vector((cx + sx * (aw/2 + pw/4), 0, ah/2)), verts=r['verts'])
    r = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector((w, t, h - ah)), verts=r['verts'])
    bmesh.ops.translate(bm, vec=Vector((0, 0, ah + (h - ah)/2)), verts=r['verts'])
    for cx in [(-w/2 + pitch * (i + 0.5)) for i in range(arches)]:
        r = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=Vector((0.25, t + 0.06, 0.3)), verts=r['verts'])
        bmesh.ops.translate(bm, vec=Vector((cx, 0, ah + 0.15)), verts=r['verts'])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
    return _finish(name, bm, coll, material, loc)

def text_mesh(name, body, size, loc, coll, material, extrude=0.02, rot=(0, 0, 0), align='CENTER'):
    cu = bpy.data.curves.new(name + '_curve', type='FONT')
    cu.body = body; cu.size = size; cu.extrude = extrude; cu.align_x = align; cu.resolution_u = 4
    ob = bpy.data.objects.new(name, cu); ob.location = (loc[0] + OX, loc[1], loc[2]); ob.rotation_euler = Euler(rot)
    COLL[coll].objects.link(ob)
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target='MESH')
    ob = bpy.context.view_layer.objects.active; ob.name = name
    ob.data.materials.clear(); ob.data.materials.append(material)
    return ob

def light(name, kind, loc, energy, color=(1, 1, 1), size=1.0, rot=(0, 0, 0)):
    ld = bpy.data.lights.new(name, kind); ld.energy = energy; ld.color = color
    if kind == 'AREA': ld.size = size
    if kind == 'POINT': ld.shadow_soft_size = 0.4
    ob = bpy.data.objects.new(name, ld); ob.location = (loc[0] + OX, loc[1], loc[2]); ob.rotation_euler = Euler(rot)
    COLL['LIGHTS'].objects.link(ob); return ob

# ---------------------------------------------------------------- street layout
W, D = 9.0, 7.0          # every lot: interior width / depth
T = 0.25
FRONT, BACK = -D/2, D/2
GAP = 2.6                 # alley between buildings
PITCH = W + 2*T + GAP     # lot to lot
LOTS = [('GARAGE', 4.0, 'wallPurple'), ('BANK', 3.6, 'wallBankGrey'), ('MILANO', 3.8, 'wallCream'), ('FARMACIA', 3.4, 'wallMint'), ('BEACH', 0.0, None)]
# Six faces, six places. Every diorama is still authored in exactly the frame
# it always was — floor at z=0, open side toward -y — and is then rotated onto
# the face it belongs to once it is finished. Nothing inside a lot knows or
# cares where it ended up, which is why none of the interiors below changed.
#
# The lots therefore all build at the origin now, on top of each other, and are
# separated afterwards. LOT_X survives as zeroes rather than being deleted
# because the interiors reference it constantly.
LOT_X = {name: 0.0 for name, _, _ in LOTS}
STREET_W = PITCH * 5

_placed = set()

def _fresh():
    """Every object built since the last time this was asked."""
    new = [o for o in bpy.data.objects if o.name not in _placed]
    for o in new:
        _placed.add(o.name)
    return new

def face(key, height):
    """Rotate everything built since the last face() onto this cube face.

    The rotation is assembled from where the lot's own axes have to end up
    rather than written as three Euler angles, because the angles are only
    obvious for one of the six and wrong-by-a-sign for the rest. Local +z (the
    lot's up) becomes the face normal; local -y (the side it opens toward)
    becomes the face's chosen tangent; local +x follows from those two, which
    is what keeps the basis right-handed and the text unmirrored.
    """
    n, t, x, y, z = _basis(key)
    rot = Matrix(((x.x, y.x, z.x, 0.0),
                  (x.y, y.y, z.y, 0.0),
                  (x.z, y.z, z.z, 0.0),
                  (0.0, 0.0, 0.0, 1.0)))
    # Slide back so the room's open front (local y = FRONT) lands on the face,
    # then down its own up-axis so it is centred in the opening rather than
    # sitting on the sill with all the empty room above it.
    if FACES[key][2] == 'recess':
        # Slide back so the open front (local y = FRONT) lands on the face,
        # then down its own up-axis so it is centred in the opening rather
        # than sitting on the sill with the empty room above it.
        placement = Matrix.Translation(n * (HALF + FRONT) - t * (height / 2)) @ rot
    else:
        # Standing: the floor is the face, so there is nothing to centre.
        placement = Matrix.Translation(n * HALF) @ rot
    moved = _fresh()
    for ob in moved:
        ob.matrix_world = placement @ ob.matrix_world
    print(f'[cube] {key}: {len(moved)} {FACES[key][2]} on face {tuple(FACES[key][0])}', flush=True)
ROAD_Y0, ROAD_Y1 = FRONT - 2.6, FRONT - 9.6   # pavement in front of the lots, then the road

# ================================================================ GROUND: the plot the shop stands on
OX = 0.0
# One shop on one corner. The road exists to give the building something to
# face and to catch its neon, not to be travelled: it runs off frame both ways
# and nothing stands on the far side of it.
# Compact on purpose. A wide plot with a deep road put half the frame on empty
# tarmac and pushed the shop — the only thing here — into the distance. The
# pavement is now just deep enough to stand on and the road just wide enough to
# read as one, so the building fills the shot.
PLOT_W = W + 2*T + 1.6
ROAD_Y0, ROAD_Y1 = FRONT - 2.5, FRONT - 6.6
box('pavement', (PLOT_W, 2.5, 0.28), (0, FRONT - 1.25 - T, -0.16), 'GROUND', M['concrete2'])
box('kerb', (PLOT_W, 0.16, 0.14), (0, ROAD_Y0 - T, -0.1), 'GROUND', M['kerb'])
box('road', (PLOT_W + 10, ROAD_Y0 - ROAD_Y1, 0.24), (0, (ROAD_Y0 + ROAD_Y1)/2 - T, -0.2), 'GROUND', M['asphalt'])
box('kerbFar', (PLOT_W + 10, 0.16, 0.14), (0, ROAD_Y1 - T, -0.1), 'GROUND', M['kerb'])
box('pavementFar', (PLOT_W + 10, 1.2, 0.28), (0, ROAD_Y1 - T - 0.6, -0.16), 'GROUND', M['concrete2'])
for i in range(5):
    box(f'roadDash{i}', (1.4, 0.14, 0.012), (-PLOT_W/2 + 1.3 + i * 2.6, (ROAD_Y0 + ROAD_Y1)/2 - T, -0.074), 'GROUND', M['white'])
box('alley', (PLOT_W, 1.4, 0.28), (0, BACK + T + 0.7, -0.16), 'GROUND', M['concrete2'])
cyl('manhole0', 0.32, 0.02, (-2.2, ROAD_Y0 - 1.6, -0.07), 'GROUND', M['steelDark'], seg=14)

# ================================================================ SHELL per lot (four buildings) — the beach lot has no shell
def shell(name, h, wallcol, band, pillar):
    box(f'{name}_floor', (W + 2*T, D + 2*T, 0.3), (0, 0, -0.15), 'SHELL', M['concrete'])
    box(f'{name}_wallBack', (W + 2*T, T, h), (0, BACK + T/2, h/2), 'SHELL', M[wallcol])
    box(f'{name}_wallLeft', (T, D, h), (-W/2 - T/2, 0, h/2), 'SHELL', M[wallcol])
    box(f'{name}_wallRight', (T, D, h), (W/2 + T/2, 0, h/2), 'SHELL', M[wallcol])
    # The cornice. A roof slab flush with the walls gives a building the
    # silhouette of a shoebox; the overhang is what turns the top edge into a
    # shelf that throws a hard shadow down the facade, and that shadow is the
    # line the eye reads as "roof". OVER is horizontal only — every roof prop
    # in exterior() is placed relative to `h + 0.3`, so the slab's thickness
    # and its top face have to stay exactly where they are.
    OVER = 1.1
    box(f'{name}_roof', (W + 2*T + OVER, D + 2*T + OVER, 0.3), (0, 0, h + 0.15), 'SHELL', M['roof'])
    # The fascia hanging under the lip: the underside of an overhang is never
    # the same value as its top, and a thin darker band there is what sells the
    # slab as having thickness rather than being a decal on the skyline.
    for nm, dims, loc in ((f'{name}_fasciaF', (W + 2*T + OVER, 0.14, 0.16), (0, FRONT - T - OVER/2 + 0.07, h - 0.05)),
                          (f'{name}_fasciaL', (0.14, D + 2*T + OVER, 0.16), (-W/2 - T - OVER/2 + 0.07, 0, h - 0.05)),
                          (f'{name}_fasciaR', (0.14, D + 2*T + OVER, 0.16), (W/2 + T + OVER/2 - 0.07, 0, h - 0.05))):
        box(nm, dims, loc, 'SHELL', M[pillar])
    P = W/2 + T + OVER/2 - 0.1
    for nm, dims, loc in ((f'{name}_parapetF', (W + 2*T + OVER, 0.2, 0.5), (0, FRONT - T - OVER/2 + 0.1, h + 0.55)),
                          (f'{name}_parapetB', (W + 2*T + OVER, 0.2, 0.5), (0, BACK + T + OVER/2 - 0.1, h + 0.55)),
                          (f'{name}_parapetL', (0.2, D + 2*T + OVER, 0.5), (-P, 0, h + 0.55)),
                          (f'{name}_parapetR', (0.2, D + 2*T + OVER, 0.5), (P, 0, h + 0.55))):
        box(nm, dims, loc, 'SHELL', M[band])
    box(f'{name}_facadeBand', (W + 2*T + 0.6, 0.35, 0.7), (0, FRONT - 0.05, h - 0.35), 'SHELL', M[band])
    box(f'{name}_pillarL', (0.5, 0.5, h), (-W/2 - T/2, FRONT - 0.1, h/2), 'SHELL', M[pillar])
    box(f'{name}_pillarR', (0.5, 0.5, h), (W/2 + T/2, FRONT - 0.1, h/2), 'SHELL', M[pillar])

# ================================================================ EXTERIOR helpers (per lot)
XL = -W/2 - T; XR = W/2 + T; YB = BACK + T
def window(name, face, along, z, w=1.0, h=1.3, lit=False):
    if face == 'L':
        box(f'{name}Frame', (0.1, w + 0.16, h + 0.16), (XL - 0.03, along, z), 'EXTERIOR', M['steelDark'])
        box(f'{name}Pane', (0.04, w, h), (XL - 0.06, along, z), 'EMISSIVE' if lit else 'EXTERIOR', E['windowLit'] if lit else M['glass'])
        box(f'{name}Sill', (0.22, w + 0.3, 0.06), (XL - 0.09, along, z - h/2 - 0.05), 'EXTERIOR', M['marble'])
    elif face == 'R':
        box(f'{name}Frame', (0.1, w + 0.16, h + 0.16), (XR + 0.03, along, z), 'EXTERIOR', M['steelDark'])
        box(f'{name}Pane', (0.04, w, h), (XR + 0.06, along, z), 'EMISSIVE' if lit else 'EXTERIOR', E['windowLit'] if lit else M['glass'])
        box(f'{name}Sill', (0.22, w + 0.3, 0.06), (XR + 0.09, along, z - h/2 - 0.05), 'EXTERIOR', M['marble'])
    else:
        box(f'{name}Frame', (w + 0.16, 0.1, h + 0.16), (along, YB + 0.03, z), 'EXTERIOR', M['steelDark'])
        box(f'{name}Pane', (w, 0.04, h), (along, YB + 0.06, z), 'EMISSIVE' if lit else 'EXTERIOR', E['windowLit'] if lit else M['glass'])
        box(f'{name}Sill', (w + 0.3, 0.22, 0.06), (along, YB + 0.09, z - h/2 - 0.05), 'EXTERIOR', M['marble'])

def wall_lamp(name, face, along, z):
    if face == 'L':
        box(f'{name}Base', (0.1, 0.22, 0.22), (XL - 0.05, along, z), 'EXTERIOR', M['steelDark']); bulb, lp = (XL - 0.16, along, z), (XL - 0.5, along, z - 0.1)
    elif face == 'R':
        box(f'{name}Base', (0.1, 0.22, 0.22), (XR + 0.05, along, z), 'EXTERIOR', M['steelDark']); bulb, lp = (XR + 0.16, along, z), (XR + 0.5, along, z - 0.1)
    else:
        box(f'{name}Base', (0.22, 0.1, 0.22), (along, YB + 0.05, z), 'EXTERIOR', M['steelDark']); bulb, lp = (along, YB + 0.16, z), (along, YB + 0.5, z - 0.1)
    sphere(f'{name}Bulb', 0.09, bulb, 'EMISSIVE', E['wallLamp'], seg=10, rings=6)
    light(f'{name}Light', 'POINT', lp, 45, (1.0, 0.8, 0.55))

def exterior(name, h, extras):
    """windows on both sides + back, lamps, drainpipes, AC, roof gear; extras = list of feature keys"""
    zc = h * 0.55
    for j, y in enumerate((-2.0, 0.6)):
        window(f'{name}winL{j}', 'L', y, zc, w=0.9, h=1.2, lit=(j % 2 == 0))
        window(f'{name}winR{j}', 'R', y, zc, w=0.9, h=1.2, lit=(j % 2 == 1))
    for j, x in enumerate((-3.0, -1.0, 1.0, 3.0)):
        window(f'{name}winB{j}', 'B', x, zc, lit=(j % 3 == 0))
    wall_lamp(f'{name}lampL', 'L', 2.6, h - 0.6)
    wall_lamp(f'{name}lampR', 'R', -2.6, h - 0.6)
    wall_lamp(f'{name}lampB', 'B', -4.0, h - 0.7)
    cyl(f'{name}drainL', 0.06, h + 0.4, (XL - 0.1, YB - 0.2, (h + 0.4)/2), 'EXTERIOR', M['steelDark'], seg=8)
    cyl(f'{name}drainR', 0.06, h + 0.4, (XR + 0.1, FRONT - 0.2, (h + 0.4)/2), 'EXTERIOR', M['steelDark'], seg=8)
    for j, x in enumerate((-2.2, 2.2)):
        box(f'{name}acOut{j}', (0.8, 0.35, 0.6), (x, YB + 0.28, 0.9), 'EXTERIOR', M['white'])
        cyl(f'{name}acFan{j}', 0.22, 0.04, (x, YB + 0.47, 0.9), 'EXTERIOR', M['steelDark'], seg=14, rot=(math.pi/2, 0, 0))
        box(f'{name}acBracket{j}', (0.9, 0.4, 0.04), (x, YB + 0.28, 0.58), 'EXTERIOR', M['steelDark'])
    if 'tank' in extras:
        cyl(f'{name}waterTank', 0.7, 1.4, (-2.6, 1.6, h + 0.3 + 0.7), 'EXTERIOR', M['steelDark'], seg=18)
    if 'ac' in extras:
        box(f'{name}acUnit', (1.4, 1.0, 0.8), (2.5, 1.2, h + 0.3 + 0.4), 'EXTERIOR', M['steel'])
        box(f'{name}acGrille', (1.2, 0.05, 0.6), (2.5, 0.68, h + 0.3 + 0.4), 'EXTERIOR', M['steelDark'])
    if 'vents' in extras:
        cyl(f'{name}ventPipe', 0.12, 1.6, (-0.5, 2.4, h + 0.3 + 0.8), 'EXTERIOR', M['steel'], seg=10)
        cyl(f'{name}ventCap', 0.22, 0.12, (-0.5, 2.4, h + 0.3 + 1.6), 'EXTERIOR', M['steelDark'], seg=10)
    if 'antenna' in extras:
        cyl(f'{name}antennaMast', 0.04, 3.0, (-3.8, -2.0, h + 0.3 + 1.5), 'EXTERIOR', M['steel'], seg=8)
        for i in range(4):
            box(f'{name}antennaBar{i}', (0.6 - i * 0.1, 0.03, 0.03), (-3.8, -2.0, h + 1.5 + i * 0.4), 'EXTERIOR', M['steel'])
        box(f'{name}antennaLED', (0.08, 0.08, 0.08), (-3.8, -2.0, h + 3.4), 'EMISSIVE', E['redLED'])
    if 'billboard' in extras:
        box(f'{name}billboardPost0', (0.12, 0.12, 2.6), (-1.2, YB - 0.4, h + 1.3), 'EXTERIOR', M['steelDark'])
        box(f'{name}billboardPost1', (0.12, 0.12, 2.6), (1.2, YB - 0.4, h + 1.3), 'EXTERIOR', M['steelDark'])
        box(f'{name}billboardBack', (4.0, 0.08, 1.8), (0, YB - 0.4, h + 2.4), 'EXTERIOR', M['black'])
        plane(f'{name}billboard', 3.8, 1.6, (0, YB - 0.45, h + 2.4), 'EXTERIOR', M['purple'])
        text_mesh(f'{name}billboardText', 'OPEN LATE', 0.5, (0, YB - 0.47, h + 2.2), 'EXTERIOR', M['yellow'], extrude=0.01, rot=(math.pi/2, 0, 0))
        for i in range(2):
            box(f'{name}billboardLampArm{i}', (0.05, 0.5, 0.05), (-1.2 + i * 2.4, YB - 0.7, h + 3.35), 'EXTERIOR', M['steelDark'])
            box(f'{name}billboardLamp{i}', (0.25, 0.12, 0.12), (-1.2 + i * 2.4, YB - 0.95, h + 3.3), 'EMISSIVE', E['wallLamp'])
            light(f'{name}billboardLight{i}', 'SPOT', (-1.2 + i * 2.4, YB - 0.95, h + 3.3), 120, (1.0, 0.9, 0.8), rot=(math.radians(60), 0, 0))
    if 'bulbs' in extras:
        for i in range(8):
            sphere(f'{name}roofBulb{i}', 0.07, (-4.2 + i * 1.2, FRONT - 0.3, h + 0.9 - abs(i - 3.5) * 0.04), 'EMISSIVE', E['lampLight'], seg=8, rings=6)
        cyl(f'{name}roofWire', 0.008, W + 1.0, (0, FRONT - 0.3, h + 0.95), 'EXTERIOR', M['black'], seg=4, rot=(0, math.pi/2, 0))
    if 'stair' in extras:
        for s in range(10):
            box(f'{name}stair{s}', (0.9, 0.3, 0.05), (XR + 0.9, 2.0 - s * 0.36, h - 0.3 - s * 0.34), 'EXTERIOR', M['steelDark'])
        box(f'{name}stairRail', (0.04, 3.6, 0.04), (XR + 1.35, 0.4, h - 0.1), 'EXTERIOR', M['steelDark'], rot=(math.radians(43), 0, 0))
        box(f'{name}landing', (1.2, 1.4, 0.08), (XR + 0.9, 2.6, h - 0.1), 'EXTERIOR', M['steelDark'])
    if 'balcony' in extras:
        box(f'{name}balcL', (1.4, 3.2, 0.12), (XL - 0.7, 0.0, 1.9), 'EXTERIOR', M['marble'])
        box(f'{name}balcLRail', (0.05, 3.2, 1.0), (XL - 1.4, 0.0, 2.4), 'EXTERIOR', M['steelDark'])
        for k in range(3):
            box(f'{name}planter{k}', (0.35, 0.7, 0.3), (XL - 1.15, -1.0 + k * 1.0, 2.1), 'EXTERIOR', M['wallTerracotta'])
            sphere(f'{name}plant{k}', 0.3, (XL - 1.15, -1.0 + k * 1.0, 2.45), 'EXTERIOR', M['green' if k != 1 else 'pink'], seg=8, rings=6)
    if 'utility' in extras:
        # The battery pack on the alley wall, and the clutter that collects
        # under it. This is the thing Jesse Zhou's ramen shop is actually made
        # of: the shop is the subject, but what makes it read as a real address
        # is the metering, the conduit and the crates nobody designed. Services
        # go on the side wall, because that is where a building puts them.
        UY = -3.0
        # The pack itself. Deeply rounded — at this size the silhouette is the
        # only thing doing the recognising, so the corner radius is the detail.
        box(f'{name}powerPack', (0.17, 0.78, 1.18), (XL - 0.085, UY, 1.55), 'EXTERIOR', M['white'], chamfer=0.16)
        box(f'{name}powerFace', (0.03, 0.60, 0.94), (XL - 0.18, UY, 1.55), 'EXTERIOR', M['slab'], chamfer=0.10)
        box(f'{name}powerVent', (0.04, 0.46, 0.06), (XL - 0.19, UY, 1.06), 'EXTERIOR', M['steelDark'])
        box(f'{name}powerLED', (0.03, 0.07, 0.07), (XL - 0.20, UY + 0.22, 1.92), 'EMISSIVE', E['greenLED'])
        for i, dy in enumerate((-0.22, 0.22)):
            cyl(f'{name}powerConduit{i}', 0.028, 0.95, (XL - 0.10, UY + dy, 0.48), 'EXTERIOR', M['steel'], seg=8)
        box(f'{name}powerMeter', (0.14, 0.42, 0.34), (XL - 0.07, UY, 0.86), 'EXTERIOR', M['steelDark'], chamfer=0.03)
        box(f'{name}powerBase', (0.30, 0.90, 0.10), (XL - 0.15, UY, 0.05), 'EXTERIOR', M['concrete'])
        for i, (dy, r, hh, col) in enumerate(((1.05, 0.15, 0.86, 'orange'), (1.42, 0.13, 0.70, 'steel'))):
            cyl(f'{name}bottle{i}', r, hh, (XL - 0.30, dy, hh / 2), 'EXTERIOR', M[col], seg=14)
            cyl(f'{name}bottleCap{i}', r * 0.45, 0.12, (XL - 0.30, dy, hh + 0.06), 'EXTERIOR', M['steelDark'], seg=10)
        for i, (dy, dz, sz) in enumerate(((-1.10, 0.22, 0.44), (-1.10, 0.66, 0.42), (-0.62, 0.20, 0.40))):
            box(f'{name}crate{i}', (sz, sz, sz), (XL - 0.34, dy, dz), 'EXTERIOR',
                M['wood' if i % 2 == 0 else 'woodDark'], chamfer=0.035)
        cyl(f'{name}cableCoil', 0.20, 0.09, (XL - 0.16, 2.1, 1.9), 'EXTERIOR', M['black'], seg=14, rot=(0, math.pi/2, 0))
    if 'mural' in extras:
        for i, (yy, zz, col) in enumerate([(-2.4, 1.0, 'pink'), (-2.4, 2.4, 'blue'), (-1.4, 1.7, 'yellow'), (2.6, 1.4, 'orange'), (2.6, 2.7, 'green')]):
            plane(f'{name}mural{i}', 0.9, 1.1, (XL - 0.02, yy, zz), 'EXTERIOR', M[col], rot=(0, 0, -math.pi/2))

# ================================================================ LOT 0 — GARAGE
OX = LOT_X['GARAGE']; H = 4.0; G = 'GARAGE'; Z = 0.0
shell(G, H, 'wallPurple', 'coral', 'coral')
for x in (-1.9, 3.1):
    box(f'bayLine{x}', (0.08, D - 1.0, 0.012), (x + 0.6, 0.2, 0.006), G, M['yellow'])
for i in range(9):
    box(f'hazard{i}', (0.45, 0.12, 0.012), (-4.0 + i * 1.0, FRONT + 0.25, 0.006), G, M['yellow'] if i % 2 == 0 else M['black'])
box('wainBack', (W, 0.03, 1.2), (0, BACK - 0.015, 0.6), G, M['wallMagenta'])
box('wainLeft', (0.03, D, 1.2), (-W/2 + 0.015, 0, 0.6), G, M['wallMagenta'])
box('wainRight', (0.03, D, 1.2), (W/2 - 0.015, 0, 0.6), G, M['wallMagenta'])
cyl('rollDoor', 0.28, W - 0.6, (0, FRONT + 0.05, H - 1.0), G, M['steelDark'], seg=20, rot=(0, math.pi/2, 0))
for i in range(10):
    box(f'doorSlat{i}', (W - 0.6, 0.03, 0.05), (0, FRONT + 0.05 - 0.29, H - 1.25 + i * 0.045), G, M['steel'])
for i, y in enumerate((-2.0, -0.6, 1.4)):
    cyl(f'ceilPipe{i}', 0.07, W - 0.3, (0, y, H - 0.22), G, M['steel'], seg=10, rot=(0, math.pi/2, 0))
for i, x in enumerate((-3.6, 2.9)):
    cyl(f'ceilPipeY{i}', 0.05, D - 0.4, (x, 0, H - 0.30), G, M['steelDark'], seg=10, rot=(math.pi/2, 0, 0))
box('beamFlangeTop', (W, 0.28, 0.04), (0, 0.4, H - 0.02), G, M['steelDark'])
box('beamWeb', (W, 0.04, 0.3), (0, 0.4, H - 0.17), G, M['steelDark'])
box('beamFlangeBot', (W, 0.28, 0.04), (0, 0.4, H - 0.34), G, M['steelDark'])
LX, LY = 1.2, 0.3
for sx in (-1, 1):
    box(f'liftPost{sx}', (0.32, 0.55, 3.7), (LX + sx * 1.55, LY, 1.85), G, M['yellow'])
    box(f'liftBase{sx}', (0.7, 0.9, 0.06), (LX + sx * 1.55, LY, 0.03), G, M['steelDark'])
    box(f'liftCarriage{sx}', (0.36, 0.3, 0.7), (LX + sx * 1.45, LY, 1.05), G, M['steelDark'])
    for sy in (-1, 1):
        box(f'liftArm{sx}{sy}', (1.0, 0.12, 0.1), (LX + sx * 0.95, LY + sy * 0.55, 0.78), G, M['steelDark'], rot=(0, 0, sy * sx * 0.55))
box('liftCross', (3.5, 0.3, 0.2), (LX, LY, 3.62), G, M['yellow'])
box('liftControl', (0.14, 0.3, 0.4), (LX - 1.75, LY + 0.15, 1.5), G, M['steelDark'])
box('liftLEDgreen', (0.03, 0.06, 0.06), (LX - 1.83, LY + 0.22, 1.62), 'EMISSIVE', E['greenLED'])
box('liftLEDred', (0.03, 0.06, 0.06), (LX - 1.83, LY + 0.08, 1.62), 'EMISSIVE', E['redLED'])
CZ = 0.9
box('carBody', (3.9, 1.75, 0.55), (LX, LY, CZ + 0.3), G, M['carPaint'])
box('carBodyLow', (3.4, 1.55, 0.2), (LX, LY, CZ + 0.1), G, M['steelDark'])
box('carCabin', (2.0, 1.55, 0.6), (LX - 0.2, LY, CZ + 0.85), G, M['carPaint'])
box('carGlassF', (0.3, 1.4, 0.45), (LX + 0.82, LY, CZ + 0.83), G, M['glass'], rot=(0, math.radians(-30), 0))
box('carGlassB', (0.3, 1.4, 0.45), (LX - 1.22, LY, CZ + 0.83), G, M['glass'], rot=(0, math.radians(30), 0))
box('carGlassL', (1.7, 0.04, 0.42), (LX - 0.2, LY - 0.78, CZ + 0.85), G, M['glass'])
box('carGlassR', (1.7, 0.04, 0.42), (LX - 0.2, LY + 0.78, CZ + 0.85), G, M['glass'])
box('carBumperF', (0.2, 1.7, 0.25), (LX + 2.0, LY, CZ + 0.2), G, M['steelDark'])
box('carBumperB', (0.2, 1.7, 0.25), (LX - 2.0, LY, CZ + 0.2), G, M['steelDark'])
box('carHeadL', (0.06, 0.3, 0.14), (LX + 1.97, LY - 0.6, CZ + 0.42), 'EMISSIVE', E['tubeLight'])
box('carHeadR', (0.06, 0.3, 0.14), (LX + 1.97, LY + 0.6, CZ + 0.42), 'EMISSIVE', E['tubeLight'])
box('carTailL', (0.06, 0.3, 0.12), (LX - 1.97, LY - 0.6, CZ + 0.42), 'EMISSIVE', E['redLED'])
box('carTailR', (0.06, 0.3, 0.12), (LX - 1.97, LY + 0.6, CZ + 0.42), 'EMISSIVE', E['redLED'])
for i, (wx, wy) in enumerate([(1.3, -0.95), (1.3, 0.95), (-1.3, -0.95), (-1.3, 0.95)]):
    cyl(f'carTyre{i}', 0.34, 0.24, (LX + wx, LY + wy, CZ + 0.02), G, M['rubber'], seg=18, rot=(math.pi/2, 0, 0))
    cyl(f'carHub{i}', 0.2, 0.26, (LX + wx, LY + wy, CZ + 0.02), G, M['hub'], seg=12, rot=(math.pi/2, 0, 0))
cyl('spareWheel', 0.34, 0.24, (LX + 2.1, LY - 0.9, 0.34), 'DYNAMIC', M['rubber'], seg=18, rot=(0, math.radians(80), 0))
cyl('spareHub', 0.2, 0.26, (LX + 2.1, LY - 0.9, 0.34), 'DYNAMIC', M['hub'], seg=12, rot=(0, math.radians(80), 0))
TX, TY = -3.4, 2.4
box('toolChestBody', (1.15, 0.62, 1.05), (TX, TY, 0.62), G, M['red'])
box('toolChestTop', (1.2, 0.66, 0.05), (TX, TY, 1.17), G, M['steelDark'])
for i in range(5):
    box(f'drawer{i}', (1.05, 0.03, 0.15), (TX, TY - 0.325, 0.25 + i * 0.185), G, M['red'])
    box(f'drawerHandle{i}', (0.7, 0.03, 0.03), (TX, TY - 0.35, 0.25 + i * 0.185), G, M['steel'])
BX, BY = 0.3, BACK - 0.45
box('benchTop', (3.4, 0.75, 0.07), (BX, BY, 0.92), G, M['wood'])
for sx in (-1, 1):
    for sy in (-1, 1):
        box(f'benchLeg{sx}{sy}', (0.07, 0.07, 0.88), (BX + sx * 1.6, BY + sy * 0.3, 0.44), G, M['steelDark'])
box('benchShelf', (3.3, 0.7, 0.04), (BX, BY, 0.25), G, M['steelDark'])
box('vise', (0.3, 0.2, 0.22), (BX + 1.2, BY - 0.1, 1.07), G, M['steelDark'])
box('pegboard', (3.0, 0.04, 1.3), (BX, BACK - 0.03, 1.85), G, M['woodDark'])
for i in range(6):
    box(f'wrench{i}', (0.06, 0.02, 0.35 + (i % 3) * 0.1), (BX - 1.2 + i * 0.28, BACK - 0.07, 1.85), G, M['steel'])
    box(f'wrenchHead{i}', (0.12, 0.02, 0.08), (BX - 1.2 + i * 0.28, BACK - 0.07, 2.05 + (i % 3) * 0.05), G, M['steel'])
cyl('hoseReel', 0.3, 0.14, (BX + 1.35, BACK - 0.12, 1.85), G, M['orange'], seg=16, rot=(math.pi/2, 0, 0))
CX, CY = 3.6, 2.5
cyl('compTank', 0.32, 1.1, (CX, CY, 0.55), G, M['blue'], seg=16, rot=(0, math.pi/2, 0))
box('compMotor', (0.45, 0.4, 0.4), (CX - 0.1, CY, 1.05), G, M['steelDark'])
cyl('compPump', 0.14, 0.3, (CX + 0.35, CY, 1.05), G, M['steel'], seg=10)
box('compLEDgreen', (0.05, 0.02, 0.05), (CX + 0.05, CY - 0.21, 1.15), 'EMISSIVE', E['greenLED'])
RX = -W/2 + 0.45
for i, z in enumerate((0.55, 1.45, 2.35)):
    box(f'rackShelf{i}', (0.75, 2.6, 0.04), (RX, -0.6, z), G, M['steelDark'])
for sy in (-1, 1):
    for sx in (-1, 1):
        box(f'rackPost{sx}{sy}', (0.05, 0.05, 2.5), (RX + sx * 0.35, -0.6 + sy * 1.28, 1.25), G, M['steelDark'])
n = 0
for i, z in enumerate((0.55, 1.45, 2.35)):
    for j in range(4):
        cyl(f'rackTyre{n}', 0.3, 0.22, (RX, -0.6 - 0.95 + j * 0.63, z + 0.32), G, M['rubber'], seg=16, rot=(0, math.pi/2, 0))
        cyl(f'rackTyreHub{n}', 0.17, 0.23, (RX, -0.6 - 0.95 + j * 0.63, z + 0.32), G, M['hub'], seg=10, rot=(0, math.pi/2, 0))
        n += 1
for i, (dx, dy, mm) in enumerate([(3.9, -2.2, 'blue'), (3.3, -2.5, 'orange'), (3.85, -1.5, 'purple')]):
    cyl(f'drum{i}', 0.29, 0.88, (dx, dy, 0.44), G, M[mm], seg=16)
    cyl(f'drumRim{i}', 0.305, 0.04, (dx, dy, 0.86), G, M['steelDark'], seg=16)
box('jackBody', (0.6, 0.2, 0.12), (-1.2, -2.2, 0.08), G, M['red'])
box('jackHandle', (0.9, 0.04, 0.04), (-1.8, -2.2, 0.28), G, M['steelDark'], rot=(0, math.radians(-25), 0))
for i, (cx, cy) in enumerate([(-2.6, -3.0), (0.2, -3.1)]):
    cyl(f'cone{i}', 0.16, 0.5, (cx, cy, 0.25), G, M['orange'], seg=10, r2=0.03)
    box(f'coneBase{i}', (0.35, 0.35, 0.04), (cx, cy, 0.02), G, M['black'])
    box(f'coneBand{i}', (0.2, 0.2, 0.06), (cx, cy, 0.3), G, M['white'])
box('diagCart', (0.5, 0.45, 0.9), (-0.9, -0.9, 0.45), G, M['steelDark'])
box('diagMonitor', (0.5, 0.06, 0.4), (-0.9, -1.15, 1.2), G, M['black'])
plane('garageSmallScreen', 0.44, 0.34, (-0.9, -1.185, 1.2), 'SCREENS', M['screenOff'])
RX2, RY2 = -3.0, -2.3
box('deskTop', (1.6, 0.8, 0.06), (RX2, RY2, 0.78), G, M['woodDark'])
box('deskFront', (1.6, 0.05, 0.75), (RX2, RY2 - 0.38, 0.375), G, M['wallMagenta'])
box('monitorBody', (0.9, 0.05, 0.55), (RX2, RY2 + 0.25, 1.15), G, M['black'])
box('monitorStand', (0.15, 0.15, 0.3), (RX2, RY2 + 0.28, 0.93), G, M['steelDark'])
plane('garageScreen', 0.84, 0.49, (RX2, RY2 + 0.22, 1.15), 'SCREENS', M['screenOff'])
box('chairSeat', (0.5, 0.5, 0.08), (RX2, RY2 + 0.9, 0.5), G, M['purple'])
box('chairBack', (0.5, 0.08, 0.55), (RX2, RY2 + 1.12, 0.8), G, M['purple'])
VX, VY = W/2 - 0.42, 0.4
box('vendBody', (0.8, 0.85, 1.95), (VX, VY, 0.975), G, M['purple'])
plane('vendScreen', 0.6, 1.3, (VX - 0.455, VY, 1.1), 'SCREENS', M['screenOff'], rot=(0, 0, -math.pi/2))
box('vendLight', (0.03, 0.7, 0.05), (VX - 0.43, VY, 1.9), 'EMISSIVE', E['neonBlue'])
for i, x in enumerate((-2.2, 3.2)):
    cyl(f'fanHousing{i}', 0.42, 0.12, (x, BACK - 0.02, 3.2), G, M['steelDark'], seg=18, rot=(math.pi/2, 0, 0))
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=8, radius1=0.06, radius2=0.06, depth=0.06)
    for k in range(4):
        r = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=Vector((0.1, 0.02, 0.3)), verts=r['verts'])
        bmesh.ops.translate(bm, vec=Vector((0, 0, 0.18)), verts=r['verts'])
        bmesh.ops.rotate(bm, cent=Vector((0, 0, 0)), matrix=Euler((0, k * math.pi/2, 0)).to_matrix(), verts=r['verts'])
    bmesh.ops.rotate(bm, cent=Vector((0, 0, 0)), matrix=Euler((math.pi/2, 0, 0)).to_matrix(), verts=bm.verts)
    _finish(f'fan{i+1}', bm, 'DYNAMIC', M['steel'], (x, BACK - 0.1, 3.2))
for i, (x, y) in enumerate([(-2.6, -1.3), (-2.6, 1.6), (1.2, -1.3), (1.2, 1.6), (3.6, 0.2)]):
    box(f'tubeFixture{i}', (1.3, 0.16, 0.06), (x, y, H - 0.06), G, M['steelDark'])
    box(f'tubeLight{i}', (1.2, 0.08, 0.04), (x, y, H - 0.1), 'EMISSIVE', E['tubeLight'])
for i, x in enumerate((-0.6, 1.2)):
    cyl(f'lampCord{i}', 0.01, 0.9, (x, BY, H - 0.45), G, M['black'], seg=6)
    cyl(f'lampShade{i}', 0.28, 0.25, (x, BY, H - 1.0), G, M['green'], seg=14, r2=0.06)
    cyl(f'lampBulb{i}', 0.12, 0.02, (x, BY, H - 1.13), 'EMISSIVE', E['lampLight'], seg=10)
box('ledStripBench', (3.0, 0.02, 0.02), (BX, BACK - 0.06, 1.19), 'EMISSIVE', E['neonPink'])
text_mesh('neonPink', 'GARAGE', 0.62, (0.0, FRONT - 0.23, H - 0.55), 'EMISSIVE', E['neonPink'], extrude=0.02, rot=(math.pi/2, 0, 0))
box('garageSignBacking', (4.0, 0.06, 0.8), (0.0, FRONT - 0.2, H - 0.36), 'SHELL', M['black'])
text_mesh('neonBlue', 'OPEN 24h', 0.26, (-W/2 - T/2, FRONT - 0.36, 2.9), 'EMISSIVE', E['neonBlue'], extrude=0.015, rot=(math.pi/2, 0, 0))
text_mesh('neonYellow', 'AUTO', 0.36, (W/2 + T/2, FRONT - 0.36, 3.0), 'EMISSIVE', E['neonYellow'], extrude=0.015, rot=(math.pi/2, 0, 0))
text_mesh('neonGreen', 'REPAIR', 0.3, (W/2 + T/2, FRONT - 0.36, 2.5), 'EMISSIVE', E['neonGreen'], extrude=0.015, rot=(math.pi/2, 0, 0))
box('storageDoorFrame', (1.1, 0.1, 2.2), (-3.0, BACK + 0.02, 1.1), G, M['steelDark'])
box('storageLight', (0.95, 0.02, 2.05), (-3.0, BACK - 0.03, 1.05), 'EMISSIVE', E['neonBlue'])
plane('posterTyres', 0.7, 1.0, (-W/2 + 0.03, 1.2, 2.3), G, M['orange'], rot=(0, 0, -math.pi/2))
plane('posterRace', 1.1, 0.7, (W/2 - 0.03, -0.9, 3.3), G, M['red'], rot=(0, 0, math.pi/2))
box('easelBoard', (0.6, 0.04, 0.8), (1.9, FRONT - 0.9, 0.5), G, M['black'], rot=(math.radians(-12), 0, 0))
plane('easelFrontGraphic', 0.5, 0.65, (1.9, FRONT - 0.925, 0.52), 'SCREENS', M['screenOff'], rot=(math.radians(-12), 0, 0))
light('g_fill', 'AREA', (0, 0, H - 0.5), 900, (0.95, 0.9, 1.0), size=6.0)
light('g_front', 'AREA', (0, FRONT - 2.5, 2.5), 400, (1.0, 0.55, 0.85), size=5.0, rot=(math.radians(-70), 0, 0))
light('g_bench', 'POINT', (0.3, 2.3, 2.6), 400, (1.0, 0.7, 0.35))
light('g_lift', 'POINT', (1.2, 0.0, 3.0), 450, (0.5, 0.9, 1.0))
light('g_chest', 'POINT', (-3.2, 1.5, 2.0), 220, (1.0, 0.25, 0.75))
exterior('G', H, ['ac', 'mural', 'utility'])
cyl('dishStand', 0.05, 1.2, (3.8, -2.4, H + 0.3 + 0.6), 'DYNAMIC', M['steel'], seg=8)
cyl('dish', 0.55, 0.06, (3.8, -2.4, H + 0.3 + 1.3), 'DYNAMIC', M['white'], seg=18, rot=(math.radians(-55), 0, 0), r2=0.15)
for nm, dims, loc in (('garageScreenHitBox', (1.2, 0.3, 0.7), (RX2, RY2 + 0.22, 1.15)), ('vendHitBox', (0.9, 0.95, 2.0), (VX, VY, 1.0)),
                      ('garageSmallHitBox', (0.6, 0.3, 0.5), (-0.9, -1.15, 1.2)), ('carHitBox', (4.0, 1.9, 1.3), (LX, LY, CZ + 0.5)),
                      ('easelHitBox', (0.7, 0.3, 0.9), (1.9, FRONT - 0.9, 0.5))):
    box(nm, dims, loc, 'HITBOX', M['hitbox'])

_fresh()   # the shop is done; the forecourt below is authored on its own

# ================================================================ FORECOURT: the pavement in front, and the way in
# The directory used to name five other shops. There is one shop now, so the
# boards name the five things inside it instead — the hitbox keys are unchanged
# because the site maps them to screen views, and renaming one would silently
# remove a destination.
OX = 0.0
PX, PY = -6.7, FRONT - 1.9
cyl('signPole', 0.06, 3.3, (PX, PY, 1.65), 'EXTERIOR', M['steelDark'], seg=10)
box('signPoleBase', (0.5, 0.5, 0.1), (PX, PY, 0.05), 'EXTERIOR', M['steelDark'])
box('poleLight', (0.14, 0.14, 0.2), (PX, PY, 3.4), 'EMISSIVE', E['neonYellow'])
signs = [('garage',   'WORKSHOP', 'pink',   2.92, 1),
         ('bank',     'WORK',     'yellow', 2.50, -1),
         ('milano',   'APPROACH', 'red',    2.08, 1),
         ('farmacia', 'CONTACT',  'green',  1.66, -1),
         ('bar',      'PROCESS',  'orange', 1.24, 1),
         ('credits',  'CREDITS',  'blue',   0.82, -1)]
for key, label, col, z, side in signs:
    cx = PX + side * 0.55
    box(f'{key}Black', (1.05, 0.08, 0.34), (cx, PY, z), 'SIGNS', M['black'])
    box(f'{key}{col.capitalize()}', (0.98, 0.02, 0.27), (cx, PY - 0.05, z), 'SIGNS', M[col])
    text_mesh(f'{key}White', label, 0.15 if len(label) > 8 else 0.16, (cx, PY - 0.065, z - 0.06), 'SIGNS', M['white'], extrude=0.004, rot=(math.pi/2, 0, 0))
    box(f'{key}HitBox', (1.1, 0.25, 0.4), (cx, PY, z), 'HITBOX', M['hitbox'])
    box(f'{key}Tip', (0.18, 0.08, 0.34), (cx + side * 0.6, PY, z), 'SIGNS', M['black'], rot=(0, math.radians(45), 0))

# a lamp over the forecourt, and the traffic light at the kerb
LY = FRONT - 1.9
cyl('lampPole0', 0.06, 4.2, (4.6, LY, 2.1), 'EXTERIOR', M['steelDark'], seg=10)
cyl('lampArm0', 0.035, 1.3, (4.6, LY, 4.0), 'EXTERIOR', M['steelDark'], seg=8, rot=(0, math.pi/2, 0))
sphere('lampGlobeL0', 0.24, (3.95, LY, 4.05), 'EMISSIVE', E['lampLight'])
sphere('lampGlobeR0', 0.24, (5.25, LY, 4.05), 'EMISSIVE', E['lampLight'])
light('streetLamp0', 'POINT', (4.6, LY, 3.9), 260, (1.0, 0.9, 0.7))

# The three lamps are swapped at runtime, so these names are load-bearing.
TLX, TLY = 5.9, ROAD_Y0 - 0.35
cyl('trafficPole', 0.07, 3.2, (TLX, TLY, 1.6), 'EXTERIOR', M['steelDark'], seg=10)
box('trafficBody', (0.34, 0.3, 1.0), (TLX, TLY + 0.2, 3.0), 'EXTERIOR', M['black'], chamfer=0.06)
for nm, dz in (('trafficRed', 0.32), ('trafficAmber', 0.0), ('trafficGreen', -0.32)):
    cyl(nm, 0.1, 0.06, (TLX, TLY + 0.37, 3.0 + dz), 'EMISSIVE', E['redLED'], seg=12, rot=(math.pi/2, 0, 0))

# somewhere to sit, something to throw away, something parked
BY = FRONT - 1.75
box('bench0', (1.5, 0.42, 0.06), (1.5, BY, 0.55), 'EXTERIOR', M['wood'])
for k in (-1, 1):
    box(f'benchLeg{k}', (0.1, 0.4, 0.5), (1.5 + k * 0.6, BY, 0.3), 'EXTERIOR', M['steelDark'])
box('benchBack', (1.5, 0.07, 0.42), (1.5, BY - 0.21, 0.79), 'EXTERIOR', M['wood'])
cyl('bin0', 0.26, 0.8, (2.9, BY, 0.5), 'EXTERIOR', M['steelDark'], seg=12)
cyl('binLid0', 0.29, 0.07, (2.9, BY, 0.93), 'EXTERIOR', M['steel'], seg=12)
for i, col in enumerate(('red', 'blue')):
    bx, by = -3.5 + i * 0.85, FRONT - 1.7
    for k, dy in enumerate((-0.5, 0.5)):
        cyl(f'bikeWheel{i}{k}', 0.32, 0.03, (bx, by + dy, 0.42), 'EXTERIOR', M['rubber'], seg=16, rot=(0, math.pi/2, 0))
        cyl(f'bikeHub{i}{k}', 0.05, 0.05, (bx, by + dy, 0.42), 'EXTERIOR', M['hub'], seg=8, rot=(0, math.pi/2, 0))
    box(f'bikeFrameA{i}', (0.03, 0.55, 0.03), (bx, by + 0.02, 0.71), 'EXTERIOR', M[col], rot=(math.radians(-35), 0, 0))
    box(f'bikeFrameB{i}', (0.03, 0.03, 0.55), (bx, by - 0.12, 0.59), 'EXTERIOR', M[col], rot=(math.radians(15), 0, 0))
    box(f'bikeSaddle{i}', (0.08, 0.2, 0.05), (bx, by - 0.25, 0.89), 'EXTERIOR', M['black'])
    box(f'bikeBar{i}', (0.42, 0.03, 0.03), (bx, by + 0.5, 0.94), 'EXTERIOR', M['steel'])
for i, x in enumerate((-4.4, 4.9)):
    cyl(f'potPlant{i}', 0.22, 0.5, (x, FRONT - 1.4, 0.34), 'EXTERIOR', M['wallTerracotta'], seg=12, r2=0.27)
    sphere(f'potPlantTop{i}', 0.38, (x, FRONT - 1.4, 0.86), 'EXTERIOR', M['pine'], seg=8, rings=6)
cyl('hydrant', 0.14, 0.7, (-4.9, FRONT - 2.0, 0.35), 'EXTERIOR', M['red'], seg=12)
sphere('hydrantCap', 0.15, (-4.9, FRONT - 2.0, 0.72), 'EXTERIOR', M['red'], seg=10, rings=6)

# ---- the billboard on the shop's own roof: name, role and way in, painted at
#      runtime. Nothing here is baked — heroScreen is a SCREENS plane and the
#      frame and posts wear a matcap, so the words change without an atlas.
BBX, BBY, BBZ = 0.0, BACK - 1.0, 4.0 + 0.3
for i, x in enumerate((-2.6, 2.6)):
    cyl(f'heroPost{i}', 0.08, 1.5, (BBX + x, BBY, BBZ + 0.75), 'DYNAMIC', M['steelDark'], seg=10)
box('heroFrame', (6.4, 0.14, 2.9), (BBX, BBY, BBZ + 2.9), 'DYNAMIC', M['black'])
plane('heroScreen', 6.1, 2.6, (BBX, BBY - 0.09, BBZ + 2.9), 'SCREENS', M['screenOff'])
box('heroHitBox', (6.5, 0.5, 3.0), (BBX, BBY, BBZ + 2.9), 'HITBOX', M['hitbox'])

# ================================================================ world, washes, cameras
OX = 0.0
world = bpy.data.worlds.get('World') or bpy.data.worlds.new('World')
scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.020, 0.024, 0.070, 1); bg.inputs['Strength'].default_value = 2.2
# The washes have to work on a solid rather than on a row. A street could be
# lit from the front because it only had a front; a cube has six outsides and
# any face left unlit bakes black, so there is one large soft source standing
# off each axis. Pink and cyan stay opposed for the colour separation the look
# depends on, and the remaining four are dimmer fill: enough that a face is
# never unlit, not so much that everything flattens to the same value.
# Two opposed washes and a top fill, standing off the shopfront. A single
# building only has to be lit from the side it is seen from; the pink and cyan
# stay opposed because that separation is most of the look.
for _nm, _pos, _rot, _energy, _col, _size in (
        ('washPink',  (-11.0, -13.0, 7.0), (math.radians(-52), 0, math.radians(-34)), 1700, (1.0, 0.40, 0.80), 10.0),
        ('washCyan',  (11.0, -13.0, 8.5),  (math.radians(-52), 0, math.radians(34)),  1700, (0.30, 0.80, 1.00), 10.0),
        ('washBack',  (0.0, 11.0, 6.0),    (math.radians(-90), 0, 0),                  700, (0.35, 0.60, 1.00), 12.0),
        ('washTop',   (0.0, -2.0, 14.0),   (0, 0, 0),                                  600, (0.90, 0.85, 1.00), 20.0)):
    light(_nm, 'AREA', _pos, _energy, _col, size=_size, rot=_rot)

tgt = bpy.data.objects.new('camTarget', None); scene.collection.objects.link(tgt); tgt.location = (0.0, 0.0, 0.0)
def camera(name, loc, lens):
    cd = bpy.data.cameras.new(name); cd.lens = lens
    cam = bpy.data.objects.new(name, cd); cam.location = loc; scene.collection.objects.link(cam)
    c = cam.constraints.new('TRACK_TO'); c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    return cam
# The wide shot is a three-quarter corner: the only angle that shows three
# faces at once, which is the whole reason the places are on a cube.
cam = camera('Camera', (-12.5, -20.5, 8.6), 34)
cam2 = camera('CameraBeach', (9.0, -16.0, 6.0), 34)
cam3 = camera('CameraBack', (12.0, 14.0, 9.0), 34)
cam4 = camera('CameraAtm', (-2.2, -9.0, 2.4), 45)
cam5 = camera('CameraArcade', (0.9, -8.6, 2.2), 45)
scene.camera = cam
for ob in COLL['HITBOX'].objects:
    ob.display_type = 'WIRE'; ob.hide_render = True

counts = {g: len(COLL[g].objects) for g in GROUPS}
verts = sum(len(o.data.vertices) for o in bpy.data.objects if o.type == 'MESH')
print('BUILD OK', counts, 'verts', verts, flush=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BLEND_DIR, 'garage.blend'))

# EEVEE for the previews: they exist to check shapes and placement, and Cycles
# would spend minutes doing that properly when seconds of approximation answers
# the question. Both the engine's identifier and half these settings moved in
# 4.2, so ask the build what it has rather than asserting what it should be.
engines = scene.render.bl_rna.properties['engine'].enum_items.keys()
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else 'BLENDER_EEVEE'
for prop, value in (('use_bloom', True), ('bloom_intensity', 0.08), ('use_gtao', True), ('taa_render_samples', 16)):
    if hasattr(scene.eevee, prop):
        setattr(scene.eevee, prop, value)
for camname, fn, res, look in (('Camera', 'preview_street.png', (1600, 800), (0.0, 0.0, 1.8)),
                               ('CameraBeach', 'preview_beach.png', (1100, 700), (LOT_X['BEACH'], 2.0, 1.4)),
                               ('CameraBack', 'preview_back.png', (1400, 800), (0.0, 0.0, 1.8)),
                               ('CameraAtm', 'preview_atm.png', (1000, 700), (LOT_X['BANK'] - 4.6, -4.2, 1.2)),
                               ('CameraArcade', 'preview_arcade.png', (1000, 700), (LOT_X['MILANO'] - 1.5, -4.0, 1.3))):
    tgt.location = look
    scene.camera = bpy.data.objects[camname]
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.filepath = os.path.join(PREVIEW_DIR, fn)
    bpy.ops.render.render(write_still=True)
tgt.location = (0.0, 0.0, 1.9); scene.camera = cam
bpy.ops.wm.save_mainfile()
print('PREVIEWS OK', flush=True)
