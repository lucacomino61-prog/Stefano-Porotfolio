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

CUBE = 14.0
HALF = CUBE / 2
# Each room is recessed into the cube and looks out through its own face, so a
# face IS the room's open front rather than a lid it stands on. The first
# arrangement stood them on the faces instead, and every side of the cube then
# showed that room's roof: a roof is not a place.
#
# A room is 7 deep, and recessed from its own face it reaches exactly the
# centre. 14 is therefore the tightest the cube can be: opposite rooms meet
# back to back, their two back walls overlapping by their own thickness where
# nobody can see either of them. Any smaller and one room's floor comes through
# the other's ceiling; any larger and the faces turn into letterbox slots in a
# monolith, which is what 16 looked like.
#
# Two kinds of face, because there are two kinds of place.
#
# Four of these are interiors: a room with walls and a roof, which only reads
# if you are looking into it. Those are recessed behind their face, and the
# face is the opening — 'recess'.
#
# The other two are outdoors. A beach and a public square are a floor with
# things standing on it and no ceiling at all, so recessing one turns its sand
# into a wall you look at edge-on, which is exactly what the top face did on
# the first attempt. Those sit on top of their face instead and are read from
# above — 'stand'. The cube ends up a beach on the lid, a square underneath,
# and four shopfronts round the sides.
#
# Second entry: for 'recess', which way is up inside that room; for 'stand',
# which way it opens. Both are tangents of the face, so each place carries its
# own gravity and the cube as a whole has none.
FACES = {
    'GARAGE':   ((0, -1, 0), (0, 0, 1),  'recess'),
    'BANK':     ((1, 0, 0),  (0, 0, 1),  'recess'),
    'MILANO':   ((0, 1, 0),  (0, 0, 1),  'recess'),
    'FARMACIA': ((-1, 0, 0), (0, 0, 1),  'recess'),
    'BEACH':    ((0, 0, 1),  (0, -1, 0), 'stand'),
    'PIAZZA':   ((0, 0, -1), (0, 1, 0),  'stand'),
}
# How tall the opening has to be to clear what stands behind it, per face.
OPENING = {'GARAGE': 5.6, 'BANK': 5.2, 'MILANO': 5.4, 'FARMACIA': 5.0, 'BEACH': 6.4, 'PIAZZA': 7.2}
OPEN_W = 11.2

def _basis(key):
    normal, tangent, mode = FACES[key]
    n = Vector(normal).normalized()
    t = Vector(tangent).normalized()
    if mode == 'recess':
        z = t          # the room's up becomes a tangent of the face
        y = -n         # it opens along -y, and that has to point outward
    else:
        z = n          # the place stands on the face, so its up IS the normal
        y = -t         # and it opens along the tangent it was given
    x = y.cross(z)     # follows, and is what keeps the basis right-handed
    return n, t, x, y, z

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

# ================================================================ GROUND: the cube the six places stand on
OX = 0.0
# One solid block. The faces are the ground of each diorama, so this is the
# only "floor" in the scene and every lot's own floor slab sits flush on it.
# Six frames rather than one block with holes in it. A frame is four slabs
# round an opening, which is a boolean the hard way but without the boolean:
# the shape is trivially correct and it bakes without the seams a cut solid
# leaves along its cut edges.
def _slab(name, size, centre, x, y, z, coll, material):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    made = bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                           offset=CHAMFER, offset_type='OFFSET', segments=CHAMFER_SEG,
                           profile=0.5, affect='EDGES', clamp_overlap=True)
    for f in made['faces']: f.smooth = True
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    rot = Matrix(((x.x, y.x, z.x, 0.0), (x.y, y.y, z.y, 0.0), (x.z, y.z, z.z, 0.0), (0.0, 0.0, 0.0, 1.0)))
    ob.matrix_world = Matrix.Translation(centre) @ rot
    COLL[coll].objects.link(ob)
    return ob

WALL_T = 0.5
for _key in FACES:
    _n, _t, _x, _y, _z = _basis(_key)
    _r = _x                      # across the face
    _up = _z if FACES[_key][2] == 'recess' else _y
    if FACES[_key][2] == 'stand':
        # No opening to frame: this face is the ground the place stands on.
        _slab(f'{_key}Deck', (CUBE, CUBE, WALL_T), _n * (HALF - WALL_T / 2), _r, _up, _n, 'GROUND', M['slab'])
        continue
    _oh = OPENING[_key]
    _mid = _n * (HALF - WALL_T / 2)
    _side = (CUBE - OPEN_W) / 2
    _band = (CUBE - _oh) / 2
    for _nm, _size, _off in (
            (f'{_key}FrameTop',   (CUBE, _band, WALL_T), _up * (_oh / 2 + _band / 2)),
            (f'{_key}FrameBottom',(CUBE, _band, WALL_T), -_up * (_oh / 2 + _band / 2)),
            (f'{_key}FrameLeft',  (_side, _oh, WALL_T),  -_r * (OPEN_W / 2 + _side / 2)),
            (f'{_key}FrameRight', (_side, _oh, WALL_T),  _r * (OPEN_W / 2 + _side / 2))):
        _slab(_nm, _size, _mid + _off, _r, _up, _n, 'GROUND', M['slab'])
    # A reveal round the opening: the frame is half a metre thick and saying so
    # is what stops the cube reading as printed cardboard.
    _slab(f'{_key}Reveal', (OPEN_W + 0.36, _oh + 0.36, 0.14),
          _n * (HALF + 0.07), _r, _up, _n, 'GROUND', M['concrete2'])

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

_fresh()   # everything above is the cube itself and stays where it is

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
exterior('G', H, ['ac', 'vents', 'stair', 'mural', 'utility'])
cyl('dishStand', 0.05, 1.2, (3.8, -2.4, H + 0.3 + 0.6), 'DYNAMIC', M['steel'], seg=8)
cyl('dish', 0.55, 0.06, (3.8, -2.4, H + 0.3 + 1.3), 'DYNAMIC', M['white'], seg=18, rot=(math.radians(-55), 0, 0), r2=0.15)
for nm, dims, loc in (('garageScreenHitBox', (1.2, 0.3, 0.7), (RX2, RY2 + 0.22, 1.15)), ('vendHitBox', (0.9, 0.95, 2.0), (VX, VY, 1.0)),
                      ('garageSmallHitBox', (0.6, 0.3, 0.5), (-0.9, -1.15, 1.2)), ('carHitBox', (4.0, 1.9, 1.3), (LX, LY, CZ + 0.5)),
                      ('easelHitBox', (0.7, 0.3, 0.9), (1.9, FRONT - 0.9, 0.5))):
    box(nm, dims, loc, 'HITBOX', M['hitbox'])

face('GARAGE', 4.0)

# ================================================================ LOT 1 — RAIFFEISEN BANK
OX = LOT_X['BANK']; H = 3.6; G = 'BANK'
shell(G, H, 'wallBankGrey', 'black', 'wallBankGrey')
box('bankFloor', (W, D, 0.02), (0, 0, 0.01), G, M['marble'])
box('bankCarpet', (5.0, 3.5, 0.015), (-1.0, -0.5, 0.02), G, M['bankYellow'])
for i, x in enumerate((-3.0, -1.0, 1.0, 3.0)):
    box(f'bankMullion{i}', (0.08, 0.08, H - 0.7), (x, FRONT + 0.05, (H - 0.7)/2), G, M['black'])
box('bankDoorFrame', (1.3, 0.1, 2.3), (2.0, FRONT + 0.05, 1.15), G, M['black'])
box('bankCounter', (5.0, 0.8, 1.1), (0.0, BACK - 1.6, 0.55), G, M['black'])
box('bankCounterTop', (5.1, 0.9, 0.06), (0.0, BACK - 1.6, 1.13), G, M['bankYellow'])
box('bankCounterGlass', (5.0, 0.03, 0.9), (0.0, BACK - 1.95, 1.6), G, M['glass'])
for i, x in enumerate((-1.6, 0.0, 1.6)):
    box(f'tellerMon{i}', (0.45, 0.04, 0.3), (x, BACK - 1.75, 1.35), G, M['black'])
    box(f'tellerLED{i}', (0.05, 0.02, 0.05), (x, BACK - 1.78, 1.55), 'EMISSIVE', E['greenLED'] if i != 1 else E['redLED'])
    box(f'tellerChair{i}', (0.45, 0.45, 0.08), (x, BACK - 0.9, 0.5), G, M['steelDark'])
box('bankLogoBand', (W - 1.0, 0.04, 0.9), (0, BACK - 0.03, 2.5), G, M['bankYellow'])
text_mesh('bankNameWall', 'RAIFFEISEN', 0.42, (0, BACK - 0.06, 2.33), G, M['black'], extrude=0.01, rot=(math.pi/2, 0, 0))
box('atmBody', (0.7, 0.55, 1.7), (-W/2 + 0.36, -0.5, 0.85), G, M['wallBankGrey'])
box('atmFace', (0.05, 0.5, 0.6), (-W/2 + 0.72, -0.5, 1.25), G, M['black'])
plane('atmScreen', 0.36, 0.28, (-W/2 + 0.75, -0.5, 1.3), 'SCREENS', M['screenOff'], rot=(0, 0, math.pi/2))
box('atmSlot', (0.04, 0.3, 0.03), (-W/2 + 0.73, -0.5, 0.95), G, M['steel'])
box('atmLight', (0.03, 0.5, 0.04), (-W/2 + 0.73, -0.5, 1.66), 'EMISSIVE', E['neonYellow'])
cyl('vaultDoor', 0.9, 0.2, (W/2 - 0.12, 1.5, 1.3), G, M['steel'], seg=24, rot=(0, math.pi/2, 0))
cyl('vaultWheel', 0.35, 0.08, (W/2 - 0.26, 1.5, 1.3), 'DYNAMIC', M['steelDark'], seg=12, rot=(0, math.pi/2, 0))
for k in range(4):
    box(f'vaultSpoke{k}', (0.06, 0.7 if k % 2 == 0 else 0.06, 0.06 if k % 2 == 0 else 0.7), (W/2 - 0.3, 1.5, 1.3), 'DYNAMIC', M['steelDark'])
for i in range(4):
    box(f'waitSeat{i}', (0.55, 0.55, 0.08), (-3.3 + i * 0.7, -2.2, 0.45), G, M['bankYellow'])
    box(f'waitBack{i}', (0.55, 0.08, 0.5), (-3.3 + i * 0.7, -1.95, 0.72), G, M['bankYellow'])
    box(f'waitLeg{i}', (0.5, 0.5, 0.4), (-3.3 + i * 0.7, -2.2, 0.2), G, M['black'])
for i in range(3):
    cyl(f'queuePost{i}', 0.04, 1.0, (0.5 + i * 1.2, -1.2, 0.5), G, M['steel'], seg=8)
    cyl(f'queueBase{i}', 0.18, 0.04, (0.5 + i * 1.2, -1.2, 0.02), G, M['steelDark'], seg=12)
    if i < 2: box(f'queueRope{i}', (1.1, 0.03, 0.03), (1.1 + i * 1.2, -1.2, 0.95), G, M['red'])
cyl('plantPot', 0.28, 0.5, (3.8, -2.6, 0.25), G, M['black'], seg=12)
sphere('plantBall', 0.45, (3.8, -2.6, 1.0), G, M['green'], seg=10, rings=7)
box('ticketMachine', (0.4, 0.3, 1.3), (3.9, 0.5, 0.65), G, M['bankYellow'])
plane('ticketScreen', 0.28, 0.2, (3.9 - 0.16, 0.5, 1.15), 'SCREENS', M['screenOff'])
for i, (x, y) in enumerate([(-2.5, -1.0), (0, -1.0), (2.5, -1.0), (-2.5, 1.5), (0, 1.5), (2.5, 1.5)]):
    box(f'bankPanel{i}', (1.2, 0.6, 0.03), (x, y, H - 0.03), 'EMISSIVE', E['tubeLight'])
text_mesh('neonYellowBank', 'RAIFFEISEN BANK', 0.42, (0.0, FRONT - 0.23, H - 0.45), 'EMISSIVE', E['neonYellow'], extrude=0.02, rot=(math.pi/2, 0, 0))
light('b_fill', 'AREA', (0, 0, H - 0.4), 320, (1.0, 0.97, 0.85), size=6.0)
light('b_counter', 'POINT', (0, 1.5, 2.5), 140, (1.0, 0.85, 0.4))
light('b_front', 'AREA', (0, FRONT - 2.0, 2.0), 150, (1.0, 0.9, 0.5), size=5.0, rot=(math.radians(-70), 0, 0))
exterior('B', H, ['ac', 'antenna', 'utility'])
for nm, dims, loc in (('atmHitBox', (0.5, 0.7, 1.2), (-W/2 + 0.6, -0.5, 1.2)), ('ticketHitBox', (0.5, 0.4, 1.3), (3.9, 0.5, 0.65))):
    box(nm, dims, loc, 'HITBOX', M['hitbox'])
# --- the street-side cash machine: a kiosk on the pavement, back to the left pillar, screen to the road.
#     `atmOutScreen` is one of the three screens the site walks up to (the others: garageScreen, arcadeScreen).
AX, AY = -W/2 - T/2, FRONT - 0.65
box('atmOutBody', (0.9, 0.6, 1.9), (AX, AY, 0.93), G, M['wallBankGrey'])
box('atmOutFascia', (0.94, 0.64, 0.3), (AX, AY, 2.02), G, M['bankYellow'])
text_mesh('atmOutText', 'BANKOMAT', 0.12, (AX, AY - 0.33, 1.965), G, M['black'], extrude=0.005, rot=(math.pi/2, 0, 0))
box('atmOutCanopy', (1.06, 0.7, 0.05), (AX, AY - 0.12, 2.2), G, M['black'])
box('atmOutFace', (0.78, 0.04, 0.58), (AX, AY - 0.31, 1.32), G, M['black'])
plane('atmOutScreen', 0.46, 0.34, (AX, AY - 0.336, 1.33), 'SCREENS', M['screenOff'])
box('atmOutLight', (0.7, 0.03, 0.04), (AX, AY - 0.315, 1.72), 'EMISSIVE', E['neonYellow'])
box('atmOutKeypad', (0.38, 0.05, 0.22), (AX, AY - 0.315, 0.9), G, M['steel'])
for i in range(12):
    box(f'atmOutKey{i}', (0.07, 0.02, 0.038), (AX - 0.1 + (i % 3) * 0.1, AY - 0.345, 0.965 - (i // 3) * 0.05), G, M['white'] if i < 9 else M['yellow'])
box('atmOutCardSlot', (0.28, 0.03, 0.04), (AX - 0.12, AY - 0.315, 0.68), G, M['steel'])
box('atmOutLEDgreen', (0.04, 0.02, 0.04), (AX + 0.22, AY - 0.32, 0.68), 'EMISSIVE', E['greenLED'])
box('atmOutCashSlot', (0.42, 0.03, 0.07), (AX, AY - 0.315, 0.45), G, M['black'])
box('atmOutStep', (1.1, 0.8, 0.04), (AX, AY - 0.1, 0.0), G, M['kerb'])
light('b_atm', 'POINT', (AX, AY - 0.9, 1.7), 30, (1.0, 0.85, 0.5))
box('atmOutHitBox', (1.0, 0.8, 2.3), (AX, AY - 0.05, 1.05), 'HITBOX', M['hitbox'])

face('BANK', 3.6)

# ================================================================ LOT 2 — MILANO
OX = LOT_X['MILANO']; H = 3.8; G = 'MILANO'
shell(G, H, 'wallCream', 'wallTerracotta', 'wallCream')
box('milanoFloor', (W, D, 0.02), (0, 0, 0.01), G, M['wallTerracotta'])
box('milanoRug', (3.0, 2.0, 0.015), (1.5, -0.8, 0.02), G, M['italyRed'])
arch_wall('milanoArcade', W, H - 0.7, 0.3, (0, FRONT + 0.1, 0), G, M['wallTerracotta'], arches=3, aw=2.0, ah=2.4)
box('milanoTerrace', (W + 0.6, 1.4, 0.12), (0, FRONT - 0.8, 0.06), G, M['marble'])
for i in range(19):
    cyl(f'baluster{i}', 0.04, 0.9, (-W/2 + 0.2 + i * 0.5, FRONT - 1.45, 0.55), G, M['marble'], seg=8)
box('terraceRail', (W + 0.6, 0.08, 0.06), (0, FRONT - 1.45, 1.02), G, M['marble'])
for i, (x, h) in enumerate([(-3.0, 1.2), (-2.0, 1.6), (-1.0, 2.0), (0.0, 2.6), (1.0, 2.0), (2.0, 1.6), (3.0, 1.2)]):
    cyl(f'spire{i}', 0.16, h, (x, BACK - 0.12, 0.6 + h/2), G, M['marble'], seg=8, r2=0.02)
    if i == 3: sphere('madonnina', 0.12, (x, BACK - 0.12, 0.6 + h + 0.1), 'EMISSIVE', E['neonYellow'])
box('duomoBase', (7.0, 0.2, 0.6), (0, BACK - 0.12, 0.3), G, M['marble'])
for i, (mm, x) in enumerate([('italyGreen', -1.0), ('white', 0.0), ('italyRed', 1.0)]):
    box(f'tricolore{i}', (1.0, 0.03, 0.35), (x, BACK - 0.03, H - 0.5), G, M[mm])
box('barCounter', (0.7, 3.0, 1.0), (-W/2 + 0.7, 0.8, 0.5), G, M['woodDark'])
box('barTop', (0.8, 3.1, 0.05), (-W/2 + 0.7, 0.8, 1.02), G, M['marble'])
box('espressoMachine', (0.5, 0.6, 0.45), (-W/2 + 0.7, 1.6, 1.27), G, M['italyRed'])
box('espressoTop', (0.5, 0.6, 0.05), (-W/2 + 0.7, 1.6, 1.52), G, M['steel'])
for i in range(4):
    cyl(f'cup{i}', 0.05, 0.06, (-W/2 + 0.55 + (i % 2) * 0.25, 0.2 + (i // 2) * 0.25, 1.08), G, M['white'], seg=8)
box('barBackShelf', (0.3, 3.0, 1.8), (-W/2 + 0.15, 0.8, 1.9), G, M['woodDark'])
for i in range(6):
    cyl(f'bottle{i}', 0.06, 0.3, (-W/2 + 0.2, -0.4 + i * 0.45, 1.35), G, M['italyGreen' if i % 3 == 0 else 'italyRed' if i % 3 == 1 else 'yellow'], seg=8)
text_mesh('caffeSign', 'CAFFÈ', 0.3, (-W/2 + 0.32, 0.8, 2.9), G, M['italyRed'], extrude=0.01, rot=(math.pi/2, 0, math.pi/2))
for i, (x, y) in enumerate([(0.5, 0.5), (2.5, 0.5), (1.5, -1.8)]):
    cyl(f'cafeTable{i}', 0.45, 0.04, (x, y, 0.75), G, M['marble'], seg=16)
    cyl(f'cafeLeg{i}', 0.04, 0.72, (x, y, 0.36), G, M['black'], seg=8)
    for k, (dx, dy) in enumerate([(0.6, 0), (-0.6, 0)]):
        box(f'cafeChair{i}_{k}', (0.4, 0.4, 0.04), (x + dx, y + dy, 0.45), G, M['italyGreen' if (i + k) % 2 else 'italyRed'])
        box(f'cafeChairBack{i}_{k}', (0.04, 0.4, 0.45), (x + dx + (0.18 if dx > 0 else -0.18), y + dy, 0.68), G, M['italyGreen' if (i + k) % 2 else 'italyRed'])
box('vespaBody', (1.2, 0.45, 0.4), (2.5, FRONT - 0.8, 0.45), 'DYNAMIC', M['italyRed'])
box('vespaSeat', (0.5, 0.3, 0.12), (2.3, FRONT - 0.8, 0.7), 'DYNAMIC', M['black'])
cyl('vespaWheelF', 0.18, 0.1, (3.05, FRONT - 0.8, 0.3), 'DYNAMIC', M['rubber'], seg=12, rot=(math.pi/2, 0, 0))
cyl('vespaWheelB', 0.18, 0.1, (1.95, FRONT - 0.8, 0.3), 'DYNAMIC', M['rubber'], seg=12, rot=(math.pi/2, 0, 0))
cyl('vespaBar', 0.03, 0.6, (3.0, FRONT - 0.8, 0.95), 'DYNAMIC', M['steel'], seg=8, rot=(math.pi/2, 0, 0))
for i in range(3):
    cyl(f'mannequin{i}', 0.16, 1.3, (W/2 - 0.7, -1.5 + i * 1.2, 0.95), G, M['pink' if i == 1 else 'white'], seg=10, r2=0.1)
    sphere(f'mannequinHead{i}', 0.14, (W/2 - 0.7, -1.5 + i * 1.2, 1.75), G, M['white'], seg=10, rings=7)
    cyl(f'mannequinBase{i}', 0.25, 0.3, (W/2 - 0.7, -1.5 + i * 1.2, 0.15), G, M['black'], seg=10)
box('menuBoardBody', (0.05, 1.2, 0.8), (W/2 - 0.04, 2.0, 2.0), G, M['black'])
plane('milanoScreen', 1.1, 0.7, (W/2 - 0.075, 2.0, 2.0), 'SCREENS', M['screenOff'], rot=(0, 0, -math.pi/2))
for i in range(9):
    sphere(f'stringBulb{i}', 0.07, (-4.0 + i * 1.0, -0.3 + math.sin(i) * 0.3, H - 0.35), 'EMISSIVE', E['lampLight'], seg=8, rings=6)
cyl('stringWire', 0.008, W, (0, -0.3, H - 0.3), G, M['black'], seg=4, rot=(0, math.pi/2, 0))
text_mesh('neonWhiteMilano', 'MILANO', 0.5, (0.0, FRONT - 0.23, H - 0.45), 'EMISSIVE', E['neonWhite'], extrude=0.02, rot=(math.pi/2, 0, 0))
box('neonGreenBar', (0.9, 0.03, 0.06), (-0.95, FRONT - 0.23, H - 0.62), 'EMISSIVE', E['neonGreen'])
box('neonWhiteBar', (0.9, 0.03, 0.06), (0.0, FRONT - 0.23, H - 0.62), 'EMISSIVE', E['neonWhite'])
box('neonRedBar', (0.9, 0.03, 0.06), (0.95, FRONT - 0.23, H - 0.62), 'EMISSIVE', E['neonRed'])
light('m_fill', 'AREA', (0, 0, H - 0.4), 300, (1.0, 0.85, 0.7), size=6.0)
light('m_bar', 'POINT', (-3.5, 0.8, 2.4), 160, (1.0, 0.6, 0.3))
light('m_front', 'AREA', (0, FRONT - 2.5, 2.0), 150, (1.0, 0.7, 0.5), size=5.0, rot=(math.radians(-70), 0, 0))
exterior('M', H, ['tank', 'balcony', 'bulbs'])
for nm, dims, loc in (('milanoScreenHitBox', (0.3, 1.3, 0.9), (W/2 - 0.1, 2.0, 2.0)), ('vespaHitBox', (1.4, 0.7, 1.0), (2.5, FRONT - 0.8, 0.5))):
    box(nm, dims, loc, 'HITBOX', M['hitbox'])
# --- the arcade cabinet under the arcade: on the terrace, back to the pier between the first two arches, screen to the road.
#     `arcadeScreen` is walked up to like the reception monitor; the games run on it.
CX, CY = -1.5, -3.6 - 0.35
box('arcadeBody', (0.72, 0.7, 1.85), (CX, CY, 0.12 + 0.925), G, M['black'])
box('arcadeSideL', (0.012, 0.56, 1.5), (CX - 0.365, CY, 1.0), G, M['purple'])
box('arcadeSideR', (0.012, 0.56, 1.5), (CX + 0.365, CY, 1.0), G, M['purple'])
box('arcadeMarquee', (0.76, 0.5, 0.3), (CX, CY - 0.12, 2.1), G, M['black'])
box('neonPinkArcade', (0.66, 0.02, 0.2), (CX, CY - 0.375, 2.1), 'EMISSIVE', E['neonPink'])
text_mesh('arcadeMarqueeText', 'ARCADE', 0.13, (CX, CY - 0.39, 2.045), G, M['black'], extrude=0.004, rot=(math.pi/2, 0, 0))
box('arcadeBezel', (0.68, 0.04, 0.56), (CX, CY - 0.36, 1.45), G, M['steelDark'])
plane('arcadeScreen', 0.54, 0.4, (CX, CY - 0.385, 1.45), 'SCREENS', M['screenOff'])
box('arcadeDeck', (0.72, 0.36, 0.06), (CX, CY - 0.5, 1.03), G, M['steelDark'])
cyl('arcadeStick', 0.012, 0.09, (CX - 0.17, CY - 0.52, 1.1), G, M['steel'], seg=6)
sphere('arcadeStickBall', 0.032, (CX - 0.17, CY - 0.52, 1.16), G, M['red'], seg=8, rings=6)
for i, col in enumerate(('red', 'yellow', 'blue')):
    cyl(f'arcadeBtn{i}', 0.028, 0.025, (CX + 0.02 + i * 0.085, CY - 0.52, 1.07), G, M[col], seg=10)
box('arcadeCoinDoor', (0.22, 0.02, 0.18), (CX, CY - 0.36, 0.62), G, M['steel'])
box('arcadeLEDred', (0.03, 0.02, 0.03), (CX + 0.15, CY - 0.365, 0.66), 'EMISSIVE', E['redLED'])
light('m_arcade', 'POINT', (CX, CY - 0.9, 1.7), 30, (1.0, 0.35, 0.85))
box('arcadeHitBox', (0.8, 0.9, 2.4), (CX, CY - 0.1, 1.2), 'HITBOX', M['hitbox'])

face('MILANO', 3.8)

# ================================================================ LOT 3 — FARMACIA
OX = LOT_X['FARMACIA']; H = 3.4; G = 'FARMACIA'
shell(G, H, 'wallMint', 'pharmaGreen', 'wallMint')
box('pharmaFloor', (W, D, 0.02), (0, 0, 0.01), G, M['white'])
box('pharmaSill', (W, 0.3, 0.7), (0, FRONT + 0.05, 0.35), G, M['pharmaGreen'])
for i, x in enumerate((-1.5, 1.5)):
    box(f'pharmaMullion{i}', (0.08, 0.1, H - 1.4), (x, FRONT + 0.05, 0.7 + (H - 1.4)/2), G, M['white'])
box('pharmaDoorFrame', (1.2, 0.1, 2.3), (-3.0, FRONT + 0.05, 1.15), G, M['pharmaGreen'])
box('pharmaCounter', (3.6, 0.7, 1.0), (0.5, BACK - 1.6, 0.5), G, M['pharmaGreen'])
box('pharmaCounterTop', (3.7, 0.8, 0.05), (0.5, BACK - 1.6, 1.02), G, M['white'])
box('pharmaMonBody', (0.5, 0.04, 0.35), (1.5, BACK - 1.75, 1.3), G, M['black'])
plane('pharmaScreen', 0.46, 0.3, (1.5, BACK - 1.775, 1.3), 'SCREENS', M['screenOff'])
cyl('pharmaJar', 0.1, 0.25, (-0.4, BACK - 1.7, 1.17), G, M['glass'], seg=10)
for i, z in enumerate((0.6, 1.3, 2.0, 2.7)):
    box(f'pharmaShelfBack{i}', (W - 1.0, 0.35, 0.04), (0, BACK - 0.2, z), G, M['white'])
    for j in range(12):
        col = ['blue', 'red', 'italyGreen', 'yellow', 'pink', 'orange'][(i + j) % 6]
        box(f'medBox{i}_{j}', (0.28, 0.2, 0.32 + (j % 3) * 0.06), (-3.6 + j * 0.65, BACK - 0.22, z + 0.2), G, M[col])
for side, sx in (('L', -1), ('R', 1)):
    for i, z in enumerate((0.7, 1.5, 2.3)):
        box(f'pharmaShelf{side}{i}', (0.35, 4.0, 0.04), (sx * (W/2 - 0.2), -0.5, z), G, M['white'])
        for j in range(7):
            col = ['pharmaGreen', 'white', 'blue', 'pink'][(i + j) % 4]
            cyl(f'medBottle{side}{i}_{j}', 0.08, 0.28, (sx * (W/2 - 0.2), -2.2 + j * 0.57, z + 0.16), G, M[col], seg=8)
box('gondola', (2.0, 0.6, 1.2), (-0.5, -0.8, 0.6), G, M['white'])
for j in range(6):
    box(f'gondolaBox{j}', (0.25, 0.2, 0.3), (-1.3 + j * 0.32, -0.8, 1.35), G, M[['pharmaGreen', 'blue', 'red'][j % 3]])
box('scale', (0.4, 0.4, 0.08), (3.2, -2.0, 0.04), G, M['white'])
cyl('scalePost', 0.04, 1.2, (3.2, -1.85, 0.6), G, M['pharmaGreen'], seg=8)
box('scaleHead', (0.3, 0.1, 0.3), (3.2, -1.85, 1.25), G, M['white'])
box('crossV', (0.3, 0.06, 1.0), (-3.2, FRONT - 0.3, H - 0.45), 'EMISSIVE', E['neonGreen'])
box('crossH', (1.0, 0.06, 0.3), (-3.2, FRONT - 0.3, H - 0.45), 'EMISSIVE', E['neonGreen'])
text_mesh('neonGreenFarmacia', 'FARMACIA', 0.46, (0.8, FRONT - 0.23, H - 0.45), 'EMISSIVE', E['neonGreen'], extrude=0.02, rot=(math.pi/2, 0, 0))
for i, (x, y) in enumerate([(-2.5, -1.0), (0, -1.0), (2.5, -1.0), (-2.5, 1.5), (0, 1.5), (2.5, 1.5)]):
    box(f'pharmaPanel{i}', (1.2, 0.6, 0.03), (x, y, H - 0.03), 'EMISSIVE', E['tubeLight'])
box('ledStripPharma', (3.5, 0.02, 0.02), (0.5, BACK - 1.97, 1.0), 'EMISSIVE', E['neonGreen'])
light('f_fill', 'AREA', (0, 0, H - 0.4), 380, (0.9, 1.0, 0.95), size=6.0)
light('f_front', 'AREA', (0, FRONT - 2.5, 2.0), 160, (0.5, 1.0, 0.7), size=5.0, rot=(math.radians(-70), 0, 0))
exterior('F', H, ['ac', 'billboard', 'utility'])
box('pharmaScreenHitBox', (0.7, 0.3, 0.5), (1.5, BACK - 1.75, 1.3), 'HITBOX', M['hitbox'])

face('FARMACIA', 3.4)

# ================================================================ LOT 4 — BAR MARTIRI, Spille (beach bar: hut, deck, sunbeds, umbrellas, pines, sea)
OX = LOT_X['BEACH']; G = 'BEACH'
# The beach was authored as the open end of a street, so its sea ran 30 units
# wide and 9 deep into empty space. A face is 12 across and the room next door
# starts at the edge of it, so the horizon has to come in: sand to a foam line,
# then two bands of water, all inside the plot. FACE_W leaves the lip visible.
FACE_W = 11.0
SAND_D = 7.25
box('sand', (FACE_W, SAND_D, 0.3), (0, SAND_D/2 + FRONT - T, -0.15), G, M['sand'])
box('sea', (FACE_W, 1.6, 0.22), (0, 4.3, -0.19), G, M['sea'])
box('seaDeep', (FACE_W, 1.0, 0.2), (0, 5.5, -0.2), G, M['seaDeep'])
for i in range(6):
    box(f'foam{i}', (1.3 + (i % 2) * 0.5, 0.25, 0.03), (-4.5 + i * 2.1, 3.55, -0.07), G, M['foam'])
# wooden deck + the bar hut with a straw roof
box('deck', (7.0, 5.0, 0.16), (0, 0.5, 0.08), G, M['woodPale'])
for i in range(14):
    box(f'deckPlank{i}', (7.0, 0.06, 0.012), (0, -1.9 + i * 0.36, 0.17), G, M['woodDark'])
box('hutBase', (4.0, 2.4, 1.05), (0, 1.9, 0.68), G, M['wood'])
box('hutTop', (4.2, 2.6, 0.06), (0, 1.9, 1.24), G, M['woodPale'])
for i, (x, y) in enumerate([(-1.9, 0.75), (1.9, 0.75), (-1.9, 3.05), (1.9, 3.05)]):
    cyl(f'hutPost{i}', 0.09, 3.0, (x, y, 1.5), G, M['woodDark'], seg=8)
box('hutBackWall', (4.0, 0.12, 2.4), (0, 3.1, 1.35), G, M['woodDark'])
for i in range(7):
    cyl(f'bottleBar{i}', 0.05, 0.3, (-1.5 + i * 0.5, 2.9, 1.55), G, M[['turquoise', 'orange', 'yellow', 'italyGreen'][i % 4]], seg=8)
box('bottleShelf', (3.6, 0.25, 0.04), (0, 2.9, 1.38), G, M['woodPale'])
box('iceCreamCase', (1.2, 0.6, 0.5), (1.2, 1.4, 1.5), G, M['white'])
box('iceCreamGlass', (1.2, 0.62, 0.3), (1.2, 1.4, 1.9), G, M['glass'])
for i in range(5):
    cyl(f'gelato{i}', 0.08, 0.1, (0.75 + i * 0.22, 1.35, 1.8), G, M[['pink', 'yellow', 'turquoise', 'italyGreen', 'orange'][i]], seg=8)
box('coffeeMachineBar', (0.5, 0.5, 0.4), (-1.2, 2.5, 1.5), G, M['red'])
cone_roof('strawRoof', 3.4, 1.6, (0, 1.9, 3.0 + 0.8), G, M['straw'], seg=12)
for k in range(12):
    a = k * math.pi * 2 / 12
    box(f'strawFringe{k}', (0.9, 0.12, 0.3), (math.cos(a) * 3.1, 1.9 + math.sin(a) * 3.1, 2.95), G, M['straw'], rot=(0, 0, a))
text_mesh('barSignWood', 'BAR MARTIRI', 0.42, (0, 3.02, 2.15), G, M['white'], extrude=0.01, rot=(math.pi/2, 0, 0))
box('barSignWoodBoard', (3.4, 0.04, 0.7), (0, 3.05, 2.3), G, M['woodPale'])
# menu board (screen) on the left post, neon over the roof, string lights around the deck
box('menuBoardBar', (0.06, 0.9, 0.7), (-2.0, 1.5, 1.9), G, M['woodDark'])
plane('barScreen', 0.8, 0.6, (-2.05, 1.5, 1.9), 'SCREENS', M['screenOff'], rot=(0, 0, math.pi/2))
text_mesh('neonOrangeBar', 'BAR MARTIRI', 0.5, (0, 1.9 - 3.4, 3.35), 'EMISSIVE', E['neonOrange'], extrude=0.02, rot=(math.pi/2, 0, 0))
text_mesh('neonBlueSpille', 'SPILLE', 0.3, (0, 1.9 - 3.4, 2.85), 'EMISSIVE', E['neonBlue'], extrude=0.015, rot=(math.pi/2, 0, 0))
box('barSignBacking', (4.2, 0.05, 1.3), (0, 1.9 - 3.4 + 0.05, 3.1), G, M['black'])
for i in range(12):
    a = i * math.pi * 2 / 12
    sphere(f'deckBulb{i}', 0.07, (math.cos(a) * 3.6, 0.5 + math.sin(a) * 2.7, 2.6 - abs(math.sin(a)) * 0.15), 'EMISSIVE', E['lampLight'], seg=8, rings=6)
# sunbeds + umbrellas on the sand, a shower, a lifeguard chair
for i in range(6):
    sx, sy = -4.2 + (i % 3) * 3.0, 6.0 + (i // 3) * 2.6
    box(f'sunbed{i}', (0.7, 1.9, 0.08), (sx, sy, 0.35), G, M['white' if i % 2 else 'turquoise'])
    box(f'sunbedBack{i}', (0.7, 0.08, 0.5), (sx, sy + 0.9, 0.62), G, M['white' if i % 2 else 'turquoise'], rot=(math.radians(-25), 0, 0))
    for k, (dx, dy) in enumerate([(-0.3, -0.85), (0.3, -0.85), (-0.3, 0.85), (0.3, 0.85)]):
        box(f'sunbedLeg{i}_{k}', (0.05, 0.05, 0.3), (sx + dx, sy + dy, 0.16), G, M['woodDark'])
    if i % 2 == 0:
        cyl(f'umbrellaPole{i}', 0.03, 2.4, (sx + 1.0, sy, 1.2), G, M['woodDark'], seg=6)
        cone_roof(f'umbrella{i}', 1.4, 0.7, (sx + 1.0, sy, 2.55), G, M['straw'], seg=10)
cyl('showerPost', 0.05, 2.4, (4.6, 3.0, 1.2), G, M['steel'], seg=8)
cyl('showerHead', 0.18, 0.05, (4.6, 3.25, 2.4), G, M['steel'], seg=10)
box('showerTray', (0.8, 0.8, 0.06), (4.6, 3.0, 0.03), G, M['woodDark'])
box('lifeguardSeat', (0.7, 0.7, 0.08), (-5.2, 5.0, 2.0), G, M['white'])
for k, (dx, dy) in enumerate([(-0.3, -0.3), (0.3, -0.3), (-0.3, 0.3), (0.3, 0.3)]):
    box(f'lifeguardLeg{k}', (0.06, 0.06, 2.0), (-5.2 + dx, 5.0 + dy, 1.0), G, M['woodDark'])
box('lifeguardBack', (0.7, 0.06, 0.6), (-5.2, 5.3, 2.35), G, M['red'])
# the pines of Rruga e Pishave along the pavement side of the lot + a palm
for i, (px, py) in enumerate([(-5.4, -1.8), (5.4, -1.8), (-5.4, 2.5), (5.4, 2.5)]):
    cyl(f'pineTrunk{i}', 0.14, 2.2, (px, py, 1.1), G, M['woodDark'], seg=8)
    cyl(f'pineTop{i}', 1.4, 2.4, (px, py, 3.2), G, M['pine'], seg=8, r2=0.1)
    cyl(f'pineMid{i}', 1.1, 1.6, (px, py, 2.4), G, M['pineDark'], seg=8, r2=0.2)
cyl('palmTrunk', 0.12, 3.6, (3.6, 6.8, 1.8), G, M['wood'], seg=8, rot=(math.radians(-8), math.radians(6), 0))
for k in range(7):
    a = k * math.pi * 2 / 7
    box(f'palmLeaf{k}', (2.0, 0.35, 0.06), (3.6 + math.cos(a) * 0.9, 6.8 + math.sin(a) * 0.9, 3.6 - 0.2), G, M['pine'], rot=(0, math.radians(-25), a))
# beach-side lighting for the bake
light('s_hut', 'POINT', (0, 1.9, 2.4), 260, (1.0, 0.75, 0.4))
light('s_deck', 'AREA', (0, 0.5, 3.4), 300, (1.0, 0.85, 0.6), size=6.0)
light('s_sea', 'AREA', (0, FRONT - T + SAND_D + 3.0, 5.0), 400, (0.4, 0.9, 1.0), size=10.0)
light('s_front', 'AREA', (0, FRONT - 3.0, 3.0), 250, (1.0, 0.6, 0.4), size=6.0, rot=(math.radians(-60), 0, 0))
for nm, dims, loc in (('barScreenHitBox', (0.3, 1.0, 0.9), (-2.0, 1.5, 1.9)), ('barHitBox', (4.4, 2.8, 2.6), (0, 1.9, 1.5))):
    box(nm, dims, loc, 'HITBOX', M['hitbox'])

face('BEACH', 2.6)

# ================================================================ FACE 5 — PIAZZA: the way in, and the directory
# The sixth face is the one that is not a business: a small square with the
# board that names the other five, the billboard that greets you, and the
# street furniture that used to be spread down a road nobody stands on any
# more. Same local frame as every lot, so face() places it like the rest.
OX = 0.0
box('piazzaFloor', (W + 2*T, D + 2*T, 0.18), (0, 0, 0.09), 'EXTERIOR', M['concrete2'])
box('piazzaInlay', (5.4, 3.2, 0.04), (0, -0.4, 0.2), 'EXTERIOR', M['concrete'])

# ---- the directory. These six hitbox names are the site's menu: renaming one
#      silently removes a destination, so they are spelled out rather than built.
PX, PY = -3.15, -0.9
cyl('signPole', 0.06, 4.0, (PX, PY, 2.0), 'EXTERIOR', M['steelDark'], seg=10)
box('signPoleBase', (0.5, 0.5, 0.1), (PX, PY, 0.05), 'EXTERIOR', M['steelDark'])
box('poleLight', (0.14, 0.14, 0.2), (PX, PY, 4.1), 'EMISSIVE', E['neonYellow'])
signs = [('garage',   'GARAGE',      'pink',   3.65, 1),
         ('bank',     'BANK',        'yellow', 3.15, -1),
         ('milano',   'MILANO',      'red',    2.65, 1),
         ('farmacia', 'FARMACIA',    'green',  2.15, -1),
         ('bar',      'BAR MARTIRI', 'orange', 1.65, 1),
         ('credits',  'CREDITS',     'blue',   1.15, -1)]
for key, label, col, z, side in signs:
    cx = PX + side * 0.55
    box(f'{key}Black', (1.05, 0.08, 0.34), (cx, PY, z), 'SIGNS', M['black'])
    box(f'{key}{col.capitalize()}', (0.98, 0.02, 0.27), (cx, PY - 0.05, z), 'SIGNS', M[col])
    text_mesh(f'{key}White', label, 0.15 if len(label) > 8 else 0.16, (cx, PY - 0.065, z - 0.06), 'SIGNS', M['white'], extrude=0.004, rot=(math.pi/2, 0, 0))
    box(f'{key}HitBox', (1.1, 0.25, 0.4), (cx, PY, z), 'HITBOX', M['hitbox'])
    box(f'{key}Tip', (0.18, 0.08, 0.34), (cx + side * 0.6, PY, z), 'SIGNS', M['black'], rot=(0, math.radians(45), 0))

# ---- a lamp, so the square has its own light rather than borrowing the washes
cyl('lampPole0', 0.06, 4.2, (3.5, -2.4, 2.1), 'EXTERIOR', M['steelDark'], seg=10)
cyl('lampArm0', 0.035, 1.3, (3.5, -2.4, 4.0), 'EXTERIOR', M['steelDark'], seg=8, rot=(0, math.pi/2, 0))
sphere('lampGlobeL0', 0.24, (2.85, -2.4, 4.05), 'EMISSIVE', E['lampLight'])
sphere('lampGlobeR0', 0.24, (4.15, -2.4, 4.05), 'EMISSIVE', E['lampLight'])
light('streetLamp0', 'POINT', (3.5, -2.4, 3.9), 220, (1.0, 0.9, 0.7))

# ---- the traffic light. Its three lamps are swapped at runtime, so the names
#      trafficRed / trafficAmber / trafficGreen are load-bearing.
TLX, TLY = 4.1, 1.2
cyl('trafficPole', 0.07, 3.2, (TLX, TLY, 1.6), 'EXTERIOR', M['steelDark'], seg=10)
box('trafficBody', (0.34, 0.3, 1.0), (TLX, TLY - 0.2, 3.0), 'EXTERIOR', M['black'], chamfer=0.06)
for i, (nm, dz) in enumerate((('trafficRed', 0.32), ('trafficAmber', 0.0), ('trafficGreen', -0.32))):
    cyl(nm, 0.1, 0.06, (TLX, TLY - 0.37, 3.0 + dz), 'EMISSIVE', E['redLED'], seg=12, rot=(math.pi/2, 0, 0))

# ---- somewhere to sit, something to throw away, something parked
box('bench0', (1.6, 0.45, 0.06), (0.4, -2.6, 0.55), 'EXTERIOR', M['wood'])
for k in (-1, 1):
    box(f'benchLeg{k}', (0.1, 0.42, 0.5), (0.4 + k * 0.65, -2.6, 0.3), 'EXTERIOR', M['steelDark'])
box('benchBack', (1.6, 0.07, 0.42), (0.4, -2.82, 0.79), 'EXTERIOR', M['wood'])
cyl('bin0', 0.26, 0.8, (1.9, -2.6, 0.5), 'EXTERIOR', M['steelDark'], seg=12)
cyl('binLid0', 0.29, 0.07, (1.9, -2.6, 0.93), 'EXTERIOR', M['steel'], seg=12)
DX, DY = 3.3, 2.5
box('dumpsterBody', (1.5, 0.9, 1.0), (DX, DY, 0.6), 'EXTERIOR', M['green'], chamfer=0.06)
box('dumpsterLid', (1.54, 0.94, 0.08), (DX, DY, 1.14), 'EXTERIOR', M['pineDark'])
for i, (wx, wy) in enumerate([(-0.6, -0.35), (0.6, -0.35), (-0.6, 0.35), (0.6, 0.35)]):
    cyl(f'dumpsterWheel{i}', 0.08, 0.06, (DX + wx, DY + wy, 0.13), 'EXTERIOR', M['rubber'], seg=8, rot=(math.pi/2, 0, 0))
for i, col in enumerate(('red', 'blue')):
    bx, by = -1.9 + i * 0.9, 2.4
    for k, dy in enumerate((-0.5, 0.5)):
        cyl(f'bikeWheel{i}{k}', 0.32, 0.03, (bx, by + dy, 0.42), 'EXTERIOR', M['rubber'], seg=16, rot=(0, math.pi/2, 0))
        cyl(f'bikeHub{i}{k}', 0.05, 0.05, (bx, by + dy, 0.42), 'EXTERIOR', M['hub'], seg=8, rot=(0, math.pi/2, 0))
    box(f'bikeFrameA{i}', (0.03, 0.55, 0.03), (bx, by + 0.02, 0.71), 'EXTERIOR', M[col], rot=(math.radians(-35), 0, 0))
    box(f'bikeFrameB{i}', (0.03, 0.03, 0.55), (bx, by - 0.12, 0.59), 'EXTERIOR', M[col], rot=(math.radians(15), 0, 0))
    box(f'bikeSaddle{i}', (0.08, 0.2, 0.05), (bx, by - 0.25, 0.89), 'EXTERIOR', M['black'])
    box(f'bikeBar{i}', (0.42, 0.03, 0.03), (bx, by + 0.5, 0.94), 'EXTERIOR', M['steel'])
for i, x in enumerate((-4.0, 4.0)):
    cyl(f'piazzaPot{i}', 0.22, 0.5, (x, -3.0, 0.34), 'EXTERIOR', M['wallTerracotta'], seg=12, r2=0.27)
    sphere(f'piazzaPlant{i}', 0.38, (x, -3.0, 0.86), 'EXTERIOR', M['pine'], seg=8, rings=6)

# ---- the billboard: the visitor's name, role and way in, painted at runtime.
#      Nothing here is baked — heroScreen is a SCREENS plane and the frame and
#      posts wear a matcap, so the words change without an atlas changing.
BBX, BBY, BBZ = 0.0, 3.0, 0.0
for i, x in enumerate((-3.4, 3.4)):
    cyl(f'heroPost{i}', 0.09, 2.6, (BBX + x, BBY, BBZ + 1.3), 'DYNAMIC', M['steelDark'], seg=10)
box('heroFrame', (8.3, 0.14, 3.9), (BBX, BBY, BBZ + 4.5), 'DYNAMIC', M['black'])
plane('heroScreen', 8.0, 3.6, (BBX, BBY - 0.09, BBZ + 4.5), 'SCREENS', M['screenOff'])
box('heroHitBox', (8.4, 0.5, 4.0), (BBX, BBY, BBZ + 4.5), 'HITBOX', M['hitbox'])

face('PIAZZA', 3.4)

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
WASH = HALF + 9.0
for _nm, _pos, _rot, _energy, _col, _size in (
        ('washPink',  (-WASH, -WASH, 7.0),  (math.radians(-52), 0, math.radians(-38)), 4200, (1.0, 0.40, 0.80), 12.0),
        ('washCyan',  (WASH, -WASH, 8.0),   (math.radians(-52), 0, math.radians(38)),  4200, (0.30, 0.80, 1.00), 12.0),
        ('washTop',   (0.0, 0.0, WASH),     (0, 0, 0),                                 3000, (0.90, 0.85, 1.00), 22.0),
        ('washUnder', (0.0, 0.0, -WASH),    (math.radians(180), 0, 0),                 2200, (0.45, 0.55, 0.95), 22.0),
        ('washBack',  (0.0, WASH, 5.0),     (math.radians(-90), 0, 0),                 3000, (0.35, 0.60, 1.00), 16.0),
        ('washLeft',  (-WASH, 3.0, 3.0),    (math.radians(-90), 0, math.radians(-90)), 2600, (1.00, 0.75, 0.55), 14.0),
        ('washRight', (WASH, 3.0, 3.0),     (math.radians(-90), 0, math.radians(90)),  2600, (0.70, 0.80, 1.00), 14.0)):
    light(_nm, 'AREA', _pos, _energy, _col, size=_size, rot=_rot)

# A fill standing off each opening, aimed in.
#
# On the street the washes fell straight onto the open shopfronts. Recessed
# behind half a metre of frame they no longer reach, and an interior lit only
# by its own lamps bakes to an atlas that is black three metres in — which is
# most of the room. These sit outside each opening and throw light back into
# it, doing the job the sky used to do for a building with a front on a road.
#
# Named faceFill* because lighting.py has to leave them alone: they are not
# shop lights that go out in daylight, they are the daylight.
for _key, _tint in (('GARAGE', (1.00, 0.72, 0.95)), ('BANK', (1.00, 0.94, 0.78)),
                    ('MILANO', (1.00, 0.86, 0.86)), ('FARMACIA', (0.80, 1.00, 0.90))):
    _n, _t, _x, _y, _z = _basis(_key)
    # Just INSIDE the opening, not outside it. An area light emits from one
    # side only, so from here it reaches the back of the room and cannot touch
    # the facade at all. Outside, it washed the cube's outer walls to near
    # white and took the night with it.
    _at = _n * (HALF - 0.62)
    _look = Vector((0.0, 0.0, -1.0)).rotation_difference(-_n).to_euler()
    light(f'faceFill{_key}', 'AREA', tuple(_at), 260, _tint, size=6.0, rot=tuple(_look))

tgt = bpy.data.objects.new('camTarget', None); scene.collection.objects.link(tgt); tgt.location = (0.0, 0.0, 0.0)
def camera(name, loc, lens):
    cd = bpy.data.cameras.new(name); cd.lens = lens
    cam = bpy.data.objects.new(name, cd); cam.location = loc; scene.collection.objects.link(cam)
    c = cam.constraints.new('TRACK_TO'); c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    return cam
# The wide shot is a three-quarter corner: the only angle that shows three
# faces at once, which is the whole reason the places are on a cube.
cam = camera('Camera', (-26.0, -30.0, 22.0), 34)
cam2 = camera('CameraBeach', (2.0, -14.0, 26.0), 34)
cam3 = camera('CameraBack', (28.0, 26.0, 18.0), 34)
cam4 = camera('CameraAtm', (24.0, -12.0, 9.0), 42)
cam5 = camera('CameraArcade', (-10.0, -24.0, 9.0), 42)
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
tgt.location = (0.0, 0.0, 1.8); scene.camera = cam
bpy.ops.wm.save_mainfile()
print('PREVIEWS OK', flush=True)
