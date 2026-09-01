"""
The room, with its light baked into a texture.

This is the difference between a 3D scene that looks like a diagram and one
that looks like a photograph of a small room, and it is not a matter of
triangles. A real-time light can tell you which way a surface faces. It cannot
tell you that the corner behind the desk is darker because the desk is in the
way, that the wall under the window carries a smear of daylight, or that the
floor picks up a wash of colour from the rug next to it. Those are the things
the eye reads as "a room", and all of them are the result of light bouncing —
which is a path-tracer's job, done once, offline, and stored in an image.

So Cycles renders the bounce here and writes it to a PNG. At runtime the scene
needs no lights at all: the geometry wears the texture on an unlit material and
draws in one pass. It is both better looking and cheaper than what it replaces,
which is the trade that makes every scene of this kind work.

Run:
    blender --background --python scripts/bake.py -- <out.glb> <out.png> [size] [samples]

Geometry comes from room.py, which stays the single source of the room's shape.
"""
import bpy, sys, os, importlib.util

argv = sys.argv[sys.argv.index('--') + 1:]
OUT_GLB = argv[0]
OUT_PNG = argv[1]
SIZE = int(argv[2]) if len(argv) > 2 else 1024
SAMPLES = int(argv[3]) if len(argv) > 3 else 128

HERE = os.path.dirname(os.path.abspath(__file__))

# room.py exports on import, so it is run with a throwaway target and the scene
# it leaves behind is what gets baked. One definition of the room, two outputs.
spec = importlib.util.spec_from_file_location('room_geometry', os.path.join(HERE, 'room.py'))
room_mod = importlib.util.module_from_spec(spec)
sys.argv = ['blender', '--', os.path.join('/tmp', 'room-geometry.glb')]
spec.loader.exec_module(room_mod)

room = bpy.data.objects['room']
bpy.context.view_layer.objects.active = room
room.select_set(True)

# --- the light, which is the whole point -----------------------------------
#
# Three sources, and each one is doing a job the eye will look for:
# daylight through the window because the room has a window; a soft fill so the
# side away from it is not black; and the monitor, because a screen in a dark
# room is a light source and the desk in front of it should know that.

def area(name, loc, rot, size, energy, colour):
    d = bpy.data.lights.new(name, type='AREA')
    d.energy = energy
    d.size = size
    d.color = colour
    o = bpy.data.objects.new(name, d)
    o.location = loc
    o.rotation_euler = rot
    bpy.context.collection.objects.link(o)
    return o

# Positions are three-space, converted on the way in exactly as room.py does
# it, so every coordinate here is the number the running scene already uses.
def three(x, y, z):
    return (x, -z, y)

# Daylight through the window opening, aimed into the room.
area('daylight', three(-2.55, 1.38, -2.95), (-1.5708, 0, 0), 3.2, 2600, (0.66, 0.77, 1.0))

# Fill from the open side of the cutaway. This was behind the back wall, which
# is why the first bake came out almost black: the room's only real source was
# a window three metres from everything.
area('fill', three(2.4, 3.4, 3.6), (0.75, -0.4, 0), 6.0, 900, (0.74, 0.81, 1.0))

# The monitor. Small, close, and the reason the desk edge catches a rim.
area('screen', three(0.62, 0.42, 0.05), (0, 0, 0), 1.0, 90, (0.80, 0.88, 1.0))

world = bpy.data.worlds.new('room.world')
bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs[0].default_value = (0.10, 0.14, 0.28, 1)
bg.inputs[1].default_value = 2.2

# --- one UV atlas for the whole room ---------------------------------------
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
# Angle-based, with margin enough that the bake does not bleed between islands
# when the texture is sampled with a mip.
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.006)
bpy.ops.object.mode_set(mode='OBJECT')

# --- the target image ------------------------------------------------------
img = bpy.data.images.new('roomBaked', width=SIZE, height=SIZE)
img.colorspace_settings.name = 'sRGB'

for slot in room.material_slots:
    m = slot.material
    nt = m.node_tree
    node = nt.nodes.new('ShaderNodeTexImage')
    node.image = img
    node.select = True
    nt.nodes.active = node   # Cycles bakes into the active image node

# --- bake ------------------------------------------------------------------
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.bake.use_pass_direct = True
scene.render.bake.use_pass_indirect = True
scene.render.bake.margin = 8

try:
    scene.cycles.device = 'GPU'
    bpy.context.preferences.addons['cycles'].preferences.compute_device_type = 'METAL'
    bpy.context.preferences.addons['cycles'].preferences.get_devices()
except Exception as e:
    print('BAKE_DEVICE cpu (%s)' % e)

print('BAKE_START size=%d samples=%d' % (SIZE, SAMPLES))
bpy.ops.object.bake(type='COMBINED')

img.filepath_raw = OUT_PNG
img.file_format = 'PNG'
img.save()
print('BAKE_PNG', OUT_PNG, os.path.getsize(OUT_PNG))

# --- rewire every material to the baked image, unlit ------------------------
#
# Emission rather than a lit BSDF: the light is already in the pixels, and
# lighting them a second time at runtime would double it. glTF has no unlit
# material of its own, so emission is how it survives the export, and the
# viewer reads it as exactly what it is — a surface that needs no lamp.
for slot in room.material_slots:
    m = slot.material
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type not in {'TEX_IMAGE', 'OUTPUT_MATERIAL'}:
            nt.nodes.remove(n)
    tex = next(n for n in nt.nodes if n.type == 'TEX_IMAGE')
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    emit = nt.nodes.new('ShaderNodeEmission')
    emit.inputs['Strength'].default_value = 1.0
    nt.links.new(tex.outputs['Color'], emit.inputs['Color'])
    nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])

for o in list(bpy.data.objects):
    if o.type == 'LIGHT':
        bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format='GLB',
                          export_apply=True, export_materials='EXPORT',
                          export_image_format='AUTO')
print('BAKE_GLB', OUT_GLB, os.path.getsize(OUT_GLB))
