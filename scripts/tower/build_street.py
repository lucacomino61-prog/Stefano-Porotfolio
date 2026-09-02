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
from mathutils import Vector, Euler

HERE = os.path.dirname(os.path.abspath(__file__))

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
def mat(name, color, rough=0.6, metal=0.0, emit=None, strength=0.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1.0)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit is not None:
        b.inputs['Emission'].default_value = (*emit, 1.0)
        b.inputs['Emission Strength'].default_value = strength
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

def box(name, dims, loc, coll, material, rot=(0, 0, 0)):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(dims), verts=bm.verts)
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
LOT_X = {name: (i - 2) * PITCH for i, (name, _, _) in enumerate(LOTS)}   # centred on the Milano lot
STREET_W = PITCH * 5
ROAD_Y0, ROAD_Y1 = FRONT - 2.6, FRONT - 9.6   # pavement in front of the lots, then the road

# ================================================================ GROUND: pavement, road, back alley
OX = 0.0
box('pavement', (STREET_W + 4, 2.6, 0.28), (0, FRONT - 1.3 - T, -0.16), 'GROUND', M['concrete2'])
box('kerb', (STREET_W + 4, 0.16, 0.14), (0, ROAD_Y0 - T, -0.1), 'GROUND', M['kerb'])
box('road', (STREET_W + 12, ROAD_Y0 - ROAD_Y1, 0.24), (0, (ROAD_Y0 + ROAD_Y1)/2 - T, -0.2), 'GROUND', M['asphalt'])
box('kerbFar', (STREET_W + 12, 0.16, 0.14), (0, ROAD_Y1 - T, -0.1), 'GROUND', M['kerb'])
box('pavementFar', (STREET_W + 12, 1.8, 0.28), (0, ROAD_Y1 - T - 0.9, -0.16), 'GROUND', M['concrete2'])
for i in range(int(STREET_W // 2.6)):
    box(f'roadDash{i}', (1.4, 0.14, 0.012), (-STREET_W/2 + 1.3 + i * 2.6, (ROAD_Y0 + ROAD_Y1)/2 - T, -0.074), 'GROUND', M['white'])
for i in range(9):
    box(f'zebra{i}', (0.5, 3.6, 0.012), (LOT_X['BANK'] + PITCH/2 - 2.4 + i * 0.6, (ROAD_Y0 + ROAD_Y1)/2 - T, -0.074), 'GROUND', M['white'])
box('alley', (STREET_W + 4, 3.0, 0.28), (0, BACK + T + 1.5, -0.16), 'GROUND', M['concrete2'])

# ================================================================ SHELL per lot (four buildings) — the beach lot has no shell
def shell(name, h, wallcol, band, pillar):
    box(f'{name}_floor', (W + 2*T, D + 2*T, 0.3), (0, 0, -0.15), 'SHELL', M['concrete'])
    box(f'{name}_wallBack', (W + 2*T, T, h), (0, BACK + T/2, h/2), 'SHELL', M[wallcol])
    box(f'{name}_wallLeft', (T, D, h), (-W/2 - T/2, 0, h/2), 'SHELL', M[wallcol])
    box(f'{name}_wallRight', (T, D, h), (W/2 + T/2, 0, h/2), 'SHELL', M[wallcol])
    box(f'{name}_roof', (W + 2*T + 0.6, D + 2*T + 0.6, 0.3), (0, 0, h + 0.15), 'SHELL', M['roof'])
    for nm, dims, loc in ((f'{name}_parapetF', (W + 2*T + 0.6, 0.2, 0.5), (0, FRONT - T - 0.2, h + 0.55)),
                          (f'{name}_parapetB', (W + 2*T + 0.6, 0.2, 0.5), (0, BACK + T + 0.2, h + 0.55)),
                          (f'{name}_parapetL', (0.2, D + 2*T + 0.6, 0.5), (-W/2 - T - 0.2, 0, h + 0.55)),
                          (f'{name}_parapetR', (0.2, D + 2*T + 0.6, 0.5), (W/2 + T + 0.2, 0, h + 0.55))):
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
exterior('G', H, ['ac', 'vents', 'stair', 'mural'])
cyl('dishStand', 0.05, 1.2, (3.8, -2.4, H + 0.3 + 0.6), 'DYNAMIC', M['steel'], seg=8)
cyl('dish', 0.55, 0.06, (3.8, -2.4, H + 0.3 + 1.3), 'DYNAMIC', M['white'], seg=18, rot=(math.radians(-55), 0, 0), r2=0.15)
for nm, dims, loc in (('garageScreenHitBox', (1.2, 0.3, 0.7), (RX2, RY2 + 0.22, 1.15)), ('vendHitBox', (0.9, 0.95, 2.0), (VX, VY, 1.0)),
                      ('garageSmallHitBox', (0.6, 0.3, 0.5), (-0.9, -1.15, 1.2)), ('carHitBox', (4.0, 1.9, 1.3), (LX, LY, CZ + 0.5)),
                      ('easelHitBox', (0.7, 0.3, 0.9), (1.9, FRONT - 0.9, 0.5))):
    box(nm, dims, loc, 'HITBOX', M['hitbox'])

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
exterior('B', H, ['ac', 'antenna'])
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
exterior('F', H, ['ac', 'billboard'])
box('pharmaScreenHitBox', (0.7, 0.3, 0.5), (1.5, BACK - 1.75, 1.3), 'HITBOX', M['hitbox'])

# ================================================================ LOT 4 — BAR MARTIRI, Spille (beach bar: hut, deck, sunbeds, umbrellas, pines, sea)
OX = LOT_X['BEACH']; G = 'BEACH'
SAND_D = D + 2*T + 8.0
# sand pad reaching back to the sea, sea planes behind, a foam line where they meet
box('sand', (W + 2*T + GAP, SAND_D, 0.3), (0, SAND_D/2 + FRONT - T, -0.15), G, M['sand'])
box('sandDune', (W + 2*T + GAP, 1.4, 0.5), (0, BACK + T + 0.7, -0.05), G, M['sand'])
box('sea', (W + 2*T + GAP + 14.0, 6.0, 0.22), (6.0, FRONT - T + SAND_D + 3.0, -0.19), G, M['sea'])
box('seaDeep', (W + 2*T + GAP + 18.0, 6.0, 0.2), (8.0, FRONT - T + SAND_D + 9.0, -0.2), G, M['seaDeep'])
box('sandSide', (8.0, SAND_D + 4.0, 0.3), (W/2 + T + GAP/2 + 4.0, SAND_D/2 + FRONT - T + 2.0, -0.15), G, M['sand'])
for i in range(6):
    box(f'foam{i}', (1.3 + (i % 2) * 0.5, 0.25, 0.03), (-4.5 + i * 2.1, FRONT - T + SAND_D + 0.15, -0.07), G, M['foam'])
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

# ================================================================ STREET furniture: sign post (menu), lamp posts, bench, bins, hydrant, cables
OX = 0.0
PX, PY = LOT_X['GARAGE'] - PITCH/2 - 0.6, ROAD_Y0 - 0.9
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
for i, name in enumerate(('GARAGE', 'MILANO', 'BEACH')):
    lx = LOT_X[name] + PITCH/2 - 0.3
    cyl(f'lampPole{i}', 0.06, 4.2, (lx, ROAD_Y0 - 0.5, 2.1), 'EXTERIOR', M['steelDark'], seg=10)
    cyl(f'lampArm{i}', 0.035, 1.3, (lx, ROAD_Y0 - 0.5, 4.0), 'EXTERIOR', M['steelDark'], seg=8, rot=(0, math.pi/2, 0))
    sphere(f'lampGlobeL{i}', 0.24, (lx - 0.65, ROAD_Y0 - 0.5, 4.05), 'EMISSIVE', E['lampLight'])
    sphere(f'lampGlobeR{i}', 0.24, (lx + 0.65, ROAD_Y0 - 0.5, 4.05), 'EMISSIVE', E['lampLight'])
    light(f'streetLamp{i}', 'POINT', (lx, ROAD_Y0 - 0.5, 3.9), 220, (1.0, 0.9, 0.7))
for i, name in enumerate(('BANK', 'FARMACIA')):
    bx = LOT_X[name] - 2.0
    box(f'bench{i}', (1.4, 0.45, 0.06), (bx, ROAD_Y0 + 0.9, 0.45), 'EXTERIOR', M['wood'])
    for k in (-1, 1):
        box(f'benchLeg{i}{k}', (0.06, 0.4, 0.42), (bx + k * 0.6, ROAD_Y0 + 0.9, 0.21), 'EXTERIOR', M['steelDark'])
    cyl(f'bin{i}', 0.22, 0.8, (bx + 1.6, ROAD_Y0 + 0.9, 0.4), 'EXTERIOR', M['green'], seg=12)
cyl('hydrant', 0.12, 0.6, (LOT_X['MILANO'] + 3.0, ROAD_Y0 + 0.7, 0.3), 'EXTERIOR', M['red'], seg=10)
sphere('hydrantCap', 0.14, (LOT_X['MILANO'] + 3.0, ROAD_Y0 + 0.7, 0.62), 'EXTERIOR', M['red'], seg=10, rings=6)
# a parked car on the road in front of the bank
CPX, CPY = LOT_X['BANK'] + 1.0, (ROAD_Y0 + ROAD_Y1)/2 - T + 1.6
box('parkedBody', (3.8, 1.7, 0.55), (CPX, CPY, 0.55), 'EXTERIOR', M['orange'])
box('parkedCabin', (2.0, 1.5, 0.55), (CPX - 0.2, CPY, 1.1), 'EXTERIOR', M['orange'])
box('parkedGlass', (1.8, 1.52, 0.4), (CPX - 0.2, CPY, 1.12), 'EXTERIOR', M['glass'])
for i, (wx, wy) in enumerate([(1.3, -0.9), (1.3, 0.9), (-1.3, -0.9), (-1.3, 0.9)]):
    cyl(f'parkedTyre{i}', 0.34, 0.24, (CPX + wx, CPY + wy, 0.34), 'EXTERIOR', M['rubber'], seg=16, rot=(math.pi/2, 0, 0))
box('parkedHeadL', (0.06, 0.28, 0.12), (CPX + 1.92, CPY - 0.55, 0.65), 'EMISSIVE', E['tubeLight'])
box('parkedHeadR', (0.06, 0.28, 0.12), (CPX + 1.92, CPY + 0.55, 0.65), 'EMISSIVE', E['tubeLight'])
# overhead cables between the lamp posts
for i in range(2):
    x0 = LOT_X[('GARAGE', 'MILANO')[i]] + PITCH/2 - 0.3
    x1 = LOT_X[('MILANO', 'BEACH')[i]] + PITCH/2 - 0.3
    cyl(f'cable{i}', 0.012, x1 - x0, ((x0 + x1)/2, ROAD_Y0 - 0.5, 3.85), 'EXTERIOR', M['black'], seg=4, rot=(0, math.pi/2, 0))

# ---- more street: a traffic light at the crossing (the three lamps are swapped at runtime), a bus shelter on the far
#      pavement, bikes racked at the pharmacy, manholes, a dumpster in the alley, a parking sign by the car, potted
#      plants at the pharmacy door, and bunting on the first cable
TLX, TLY = LOT_X['BANK'] + PITCH/2 + 2.9, ROAD_Y0 + 0.3
cyl('trafficPole', 0.06, 3.3, (TLX, TLY, 1.65), 'EXTERIOR', M['steelDark'], seg=10)
box('trafficPoleBase', (0.36, 0.36, 0.08), (TLX, TLY, 0.04), 'EXTERIOR', M['steelDark'])
box('trafficHead', (0.34, 0.3, 0.92), (TLX, TLY, 3.05), 'EXTERIOR', M['black'])
for nm, z, em in (('trafficRed', 3.33, 'redLED'), ('trafficAmber', 3.05, 'neonOrange'), ('trafficGreen', 2.77, 'greenLED')):
    cyl(nm, 0.1, 0.04, (TLX, TLY - 0.16, z), 'EMISSIVE', E[em], seg=12, rot=(math.pi/2, 0, 0))
    box(nm + 'Hood', (0.26, 0.14, 0.03), (TLX, TLY - 0.2, z + 0.12), 'EXTERIOR', M['black'])
BSX, BSY = LOT_X['MILANO'] + PITCH/2, ROAD_Y1 - T - 0.9
box('busShelterRoof', (3.2, 1.3, 0.08), (BSX, BSY, 2.45), 'EXTERIOR', M['steelDark'])
box('busShelterBack', (3.1, 0.04, 2.0), (BSX, BSY - 0.55, 1.45), 'EXTERIOR', M['glass'])
for i, x in enumerate((-1.55, 1.55)):
    cyl(f'busShelterPost{i}', 0.04, 2.45, (BSX + x, BSY - 0.55, 1.225), 'EXTERIOR', M['steelDark'], seg=8)
    cyl(f'busShelterPostF{i}', 0.04, 2.45, (BSX + x, BSY + 0.55, 1.225), 'EXTERIOR', M['steelDark'], seg=8)
box('busBench', (2.2, 0.4, 0.06), (BSX, BSY - 0.25, 0.5), 'EXTERIOR', M['wood'])
for k in (-1, 1):
    box(f'busBenchLeg{k}', (0.06, 0.36, 0.47), (BSX + k * 0.95, BSY - 0.25, 0.235), 'EXTERIOR', M['steelDark'])
box('busPanel', (0.6, 0.03, 0.9), (BSX - 1.2, BSY - 0.5, 1.5), 'EXTERIOR', M['white'])
cyl('busSignPole', 0.03, 2.9, (BSX + 1.9, BSY + 0.4, 1.45), 'EXTERIOR', M['steelDark'], seg=8)
box('busSign', (0.42, 0.03, 0.42), (BSX + 1.9, BSY + 0.4, 2.7), 'EXTERIOR', M['yellow'])
text_mesh('busSignText', 'BUS', 0.16, (BSX + 1.9, BSY + 0.38, 2.64), 'EXTERIOR', M['black'], extrude=0.004, rot=(math.pi/2, 0, 0))
BKX, BKY = LOT_X['FARMACIA'] + 2.4, ROAD_Y0 + 0.9
for i in range(2):
    rx = BKX + i * 0.9
    for k in (-1, 1):
        cyl(f'bikeRack{i}{k}', 0.025, 0.75, (rx + k * 0.3, BKY, 0.375), 'EXTERIOR', M['steelDark'], seg=8)
    cyl(f'bikeRackTop{i}', 0.025, 0.66, (rx, BKY, 0.75), 'EXTERIOR', M['steelDark'], seg=8, rot=(0, math.pi/2, 0))
for i, col in enumerate(('blue', 'red')):
    bx, by = BKX + 0.45 + i * 0.9, BKY + 0.35
    for k, dy in enumerate((-0.5, 0.5)):
        cyl(f'bikeWheel{i}{k}', 0.32, 0.03, (bx, by + dy, 0.33), 'EXTERIOR', M['rubber'], seg=16, rot=(0, math.pi/2, 0))
        cyl(f'bikeHub{i}{k}', 0.05, 0.05, (bx, by + dy, 0.33), 'EXTERIOR', M['hub'], seg=8, rot=(0, math.pi/2, 0))
    box(f'bikeFrameA{i}', (0.03, 0.55, 0.03), (bx, by + 0.02, 0.62), 'EXTERIOR', M[col], rot=(math.radians(-35), 0, 0))
    box(f'bikeFrameB{i}', (0.03, 0.03, 0.55), (bx, by - 0.12, 0.5), 'EXTERIOR', M[col], rot=(math.radians(15), 0, 0))
    box(f'bikeFrameC{i}', (0.03, 0.03, 0.5), (bx, by + 0.42, 0.55), 'EXTERIOR', M[col], rot=(math.radians(-20), 0, 0))
    box(f'bikeSaddle{i}', (0.08, 0.2, 0.05), (bx, by - 0.25, 0.8), 'EXTERIOR', M['black'])
    box(f'bikeBar{i}', (0.42, 0.03, 0.03), (bx, by + 0.5, 0.85), 'EXTERIOR', M['steel'])
for i, x in enumerate((LOT_X['GARAGE'] + 2.0, LOT_X['MILANO'] - 3.5, LOT_X['FARMACIA'] + 4.0)):
    cyl(f'manhole{i}', 0.32, 0.02, (x, (ROAD_Y0 + ROAD_Y1)/2 - T + 2.2 - (i % 2) * 4.4, -0.07), 'EXTERIOR', M['steelDark'], seg=14)
DX, DY = LOT_X['BANK'] + 2.5, BACK + T + 1.4
box('dumpsterBody', (1.5, 0.9, 1.0), (DX, DY, 0.55), 'EXTERIOR', M['green'])
box('dumpsterLid', (1.54, 0.94, 0.08), (DX, DY, 1.09), 'EXTERIOR', M['pineDark'])
for i, (wx, wy) in enumerate([(-0.6, -0.35), (0.6, -0.35), (-0.6, 0.35), (0.6, 0.35)]):
    cyl(f'dumpsterWheel{i}', 0.08, 0.06, (DX + wx, DY + wy, 0.08), 'EXTERIOR', M['rubber'], seg=8, rot=(math.pi/2, 0, 0))
for i in range(3):
    box(f'binBag{i}', (0.5, 0.45, 0.4), (DX + 1.2 + (i % 2) * 0.4, DY - 0.2 + (i // 2) * 0.4, 0.2 + (0.35 if i == 2 else 0.0)), 'EXTERIOR', M['black'])
PSX, PSY = LOT_X['BANK'] + 3.6, ROAD_Y0 + 0.35
cyl('parkSignPole', 0.03, 2.4, (PSX, PSY, 1.2), 'EXTERIOR', M['steelDark'], seg=8)
box('parkSign', (0.44, 0.03, 0.44), (PSX, PSY, 2.5), 'EXTERIOR', M['blue'])
text_mesh('parkSignText', 'P', 0.28, (PSX, PSY - 0.02, 2.4), 'EXTERIOR', M['white'], extrude=0.004, rot=(math.pi/2, 0, 0))
for i, x in enumerate((LOT_X['FARMACIA'] - 3.9, LOT_X['FARMACIA'] - 2.1)):
    cyl(f'pharmaPot{i}', 0.18, 0.45, (x, FRONT - 0.5, 0.2), 'EXTERIOR', M['wallTerracotta'], seg=10, r2=0.22)
    sphere(f'pharmaPlant{i}', 0.32, (x, FRONT - 0.5, 0.65), 'EXTERIOR', M['pine'], seg=8, rings=6)
x0 = LOT_X['GARAGE'] + PITCH/2 - 0.3; x1 = LOT_X['MILANO'] + PITCH/2 - 0.3
for i in range(int((x1 - x0) / 0.75)):
    pennant(f'pennant{i}', 0.3, 0.34, (x0 + 0.55 + i * 0.75, ROAD_Y0 - 0.5, 3.85 - 0.19), 'EXTERIOR', M[('pink', 'yellow', 'blue', 'green', 'orange')[i % 5]])

# ---- the billboard on the bank's roof: the first screen's name, role and way in, painted at runtime.
#      Nothing here is baked: `heroScreen` is a SCREENS plane and the frame and posts wear a matcap
#      (DYNAMIC), so the words can change without an atlas changing.
BBX, BBY, BBZ = LOT_X['BANK'], YB - 0.9, 3.6 + 0.3
for i, x in enumerate((-3.4, 3.4)):
    cyl(f'heroPost{i}', 0.09, 2.6, (BBX + x, BBY, BBZ + 1.3), 'DYNAMIC', M['steelDark'], seg=10)
box('heroFrame', (8.3, 0.14, 3.9), (BBX, BBY, BBZ + 3.0), 'DYNAMIC', M['black'])
plane('heroScreen', 8.0, 3.6, (BBX, BBY - 0.09, BBZ + 3.0), 'SCREENS', M['screenOff'])
box('heroHitBox', (8.4, 0.5, 4.0), (BBX, BBY, BBZ + 3.0), 'HITBOX', M['hitbox'])

# ================================================================ world, washes, cameras
OX = 0.0
world = bpy.data.worlds.get('World') or bpy.data.worlds.new('World')
scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.012, 0.012, 0.045, 1); bg.inputs['Strength'].default_value = 1.0
light('streetPink', 'AREA', (LOT_X['GARAGE'] - 6, FRONT - 6, 7), 700, (1.0, 0.4, 0.8), size=8.0, rot=(math.radians(-50), 0, math.radians(-30)))
light('streetCyan', 'AREA', (LOT_X['FARMACIA'] + 6, FRONT - 6, 9), 700, (0.3, 0.8, 1.0), size=8.0, rot=(math.radians(-50), 0, math.radians(30)))
light('washBack', 'AREA', (0.0, YB + 6.0, 6.0), 900, (0.3, 0.6, 1.0), size=14.0, rot=(math.radians(-90), 0, 0))
light('washTop', 'AREA', (0.0, 0.0, 12.0), 500, (0.9, 0.8, 1.0), size=30.0)

tgt = bpy.data.objects.new('camTarget', None); scene.collection.objects.link(tgt); tgt.location = (0.0, 0.0, 1.8)
def camera(name, loc, lens):
    cd = bpy.data.cameras.new(name); cd.lens = lens
    cam = bpy.data.objects.new(name, cd); cam.location = loc; scene.collection.objects.link(cam)
    c = cam.constraints.new('TRACK_TO'); c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    return cam
cam = camera('Camera', (-14.0, -42.0, 16.0), 32)
cam2 = camera('CameraBeach', (LOT_X['BEACH'] - 6.0, -16.0, 6.0), 28)
cam3 = camera('CameraBack', (26.0, 30.0, 14.0), 30)
cam4 = camera('CameraAtm', (LOT_X['BANK'] - 2.2, -9.0, 2.4), 45)
cam5 = camera('CameraArcade', (LOT_X['MILANO'] + 0.9, -8.6, 2.2), 45)
scene.camera = cam
for ob in COLL['HITBOX'].objects:
    ob.display_type = 'WIRE'; ob.hide_render = True

counts = {g: len(COLL[g].objects) for g in GROUPS}
verts = sum(len(o.data.vertices) for o in bpy.data.objects if o.type == 'MESH')
print('BUILD OK', counts, 'verts', verts, flush=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'garage.blend'))

scene.render.engine = 'BLENDER_EEVEE'
scene.eevee.use_bloom = True; scene.eevee.bloom_intensity = 0.08; scene.eevee.use_gtao = True
scene.eevee.taa_render_samples = 16
for camname, fn, res, look in (('Camera', 'preview_street.png', (1600, 800), (0.0, 0.0, 1.8)),
                               ('CameraBeach', 'preview_beach.png', (1100, 700), (LOT_X['BEACH'], 2.0, 1.4)),
                               ('CameraBack', 'preview_back.png', (1400, 800), (0.0, 0.0, 1.8)),
                               ('CameraAtm', 'preview_atm.png', (1000, 700), (LOT_X['BANK'] - 4.6, -4.2, 1.2)),
                               ('CameraArcade', 'preview_arcade.png', (1000, 700), (LOT_X['MILANO'] - 1.5, -4.0, 1.3))):
    tgt.location = look
    scene.camera = bpy.data.objects[camname]
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.filepath = os.path.join(HERE, fn)
    bpy.ops.render.render(write_still=True)
tgt.location = (0.0, 0.0, 1.8); scene.camera = cam
bpy.ops.wm.save_mainfile()
print('PREVIEWS OK', flush=True)
