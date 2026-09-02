# blender -b garage_baked.blend -P export_usdz.py [-- scale]
# Builds real materials from the baked atlases (the GLB ships none), drops hitboxes/lights/cameras,
# scales the tower to tabletop size and writes public/models/garage.usdz for iOS AR Quick Look / Files.
import bpy, os, sys, zipfile

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SCALE = float(argv[0]) if argv else 1 / 40   # 15 m tower -> ~38 cm on a table

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(bpy.data.filepath)))
TEX_DIR = os.path.join(ROOT, 'public', 'textures', 'baked')
OUT = os.path.join(ROOT, 'public', 'models', 'garage.usdz')

def log(*a): print('[usdz]', *a, flush=True)

BAKED = {'shellJoined': 'shellBaked', 'groundJoined': 'groundBaked', 'garageJoined': 'garageBaked',
         'bankJoined': 'bankBaked', 'milanoJoined': 'milanoBaked', 'farmaciaJoined': 'farmaciaBaked', 'beachJoined': 'beachBaked', 'exteriorJoined': 'exteriorBaked'}
# flat colours for the un-baked parts (same values as src/main.js)
PAL = {'pink': (1.0, 0.18, 0.84), 'blue': (0.0, 0.87, 1.0), 'yellow': (1.0, 0.96, 0.41), 'green': (0.12, 1.0, 0.32),
       'warm': (1.0, 0.95, 0.84), 'red': (1.0, 0.07, 0.17), 'led': (0.0, 1.0, 0.33), 'orange': (1.0, 0.32, 0.0),
       'white': (1.0, 1.0, 1.0), 'black': (0.01, 0.01, 0.01)}
import re
EMISSIVE = [(re.compile(p), c) for p, c in [
    (r'^(neonPink|ledStripBench)$', 'pink'), (r'^(neonBlue|neonBlueSpille|storageLight|vendLight)$', 'blue'), (r'^neonOrangeBar$', 'orange'),
    (r'^[GBMF]win[LRB]\d+Pane$', 'warm'), (r'^[GBMF]lamp[LRB]Bulb$|^FbillboardLamp\d$|^MroofBulb\d$|^deckBulb\d+$|^lampGlobe[LR]\d$|^parkedHead[LR]$', 'warm'), (r'^BantennaLED$', 'red'),
    (r'^(neonYellow|neonYellowBank|poleLight|atmLight|madonnina)$', 'yellow'),
    (r'^(neonGreen|neonGreenFarmacia|neonGreenBar|cross[VH]|ledStripPharma)$', 'green'),
    (r'^(neonWhiteMilano|neonWhiteBar)$', 'white'), (r'^neonRedBar$', 'red'),
    (r'^(tubeLight\d|lampBulb\d|lampGlobe[LR]|carHead[LR]|bankPanel\d|pharmaPanel\d|stringBulb\d)$', 'warm'),
    (r'(redLED|LEDred|carTail[LR]|tellerLED1)$', 'red'), (r'(greenLED|LEDgreen|tellerLED[02])$', 'led')]]
SIGN = re.compile(r'^(garage|bank|milano|farmacia|bar|credits)(Black|Tip|White|Red|Blue|Pink|Green|Orange|Yellow)$')

def flat(name, color, emissive=False, rough=0.6, metal=0.0):
    key = f'usd_{name}'
    m = bpy.data.materials.get(key)
    if m: return m
    m = bpy.data.materials.new(key); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emissive:
        b.inputs['Emission'].default_value = (*color, 1)
        b.inputs['Emission Strength'].default_value = 1.0
    return m

def baked(name):
    key = f'usd_{name}'
    m = bpy.data.materials.get(key)
    if m: return m
    m = bpy.data.materials.new(key); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = 1.0
    b.inputs['Specular'].default_value = 0.0
    tex = nt.nodes.new('ShaderNodeTexImage')
    img = bpy.data.images.get(name + '.png') or bpy.data.images.load(os.path.join(TEX_DIR, name + '.png'))
    img.name = name + '.png'
    tex.image = img
    nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    # the atlas already contains the lighting: feed it as emission too so it reads unlit-ish in Quick Look
    nt.links.new(tex.outputs['Color'], b.inputs['Emission'])
    b.inputs['Emission Strength'].default_value = 0.6
    return m

kept = []
for ob in list(bpy.data.objects):
    if ob.type != 'MESH' or ob.name.endswith('HitBox'):
        bpy.data.objects.remove(ob, do_unlink=True)
        continue
    n = ob.name
    ob.data.materials.clear()
    if n in BAKED:
        ob.data.materials.append(baked(BAKED[n]))
    elif any(r.match(n) for r, _ in EMISSIVE):
        col = next(c for r, c in EMISSIVE if r.match(n))
        ob.data.materials.append(flat(col, PAL[col], emissive=True))
    elif SIGN.match(n):
        part = SIGN.match(n).group(2)
        col = 'black' if part in ('Black', 'Tip') else 'white' if part == 'White' else part.lower()
        ob.data.materials.append(flat('sign_' + col, PAL[col]))
    elif n in ('garageScreen', 'vendScreen', 'garageSmallScreen', 'atmScreen', 'ticketScreen', 'milanoScreen', 'pharmaScreen', 'easelFrontGraphic', 'barScreen'):
        ob.data.materials.append(flat('screen', (0.02, 0.02, 0.03), rough=0.2))
    else:
        ob.data.materials.append(flat('metal', (0.62, 0.66, 0.72), rough=0.35, metal=0.9))
    ob.location = ob.location * SCALE
    ob.scale = ob.scale * SCALE
    kept.append(ob)

bpy.ops.object.select_all(action='DESELECT')
for ob in kept: ob.select_set(True)
bpy.context.view_layer.objects.active = kept[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
log(f'{len(kept)} meshes, scale {SCALE:.4f}')

bpy.ops.wm.usd_export(filepath=OUT, selected_objects_only=True, visible_objects_only=False,
                      export_animation=False, export_hair=False, export_uvmaps=True, export_normals=True,
                      export_materials=True, use_instancing=False, evaluation_mode='RENDER',
                      generate_preview_surface=True, export_textures=True, overwrite_textures=True,
                      relative_paths=True)
size = os.path.getsize(OUT)
with zipfile.ZipFile(OUT) as z:
    names = z.namelist()
log(f'wrote {OUT} ({size/1e6:.1f} MB): {names}')
