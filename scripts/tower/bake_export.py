# Headless: blender -b garage.blend -P bake_export.py -- [size] [samples]
# Joins each bake group into one mesh, smart-UV-unwraps it, bakes COMBINED lighting with Cycles (CPU)
# into one atlas per group, saves PNGs, then exports a Draco GLB with NO materials (like jesse-zhou.com).
import bpy, os, sys, json, math, time

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SIZE = int(argv[0]) if len(argv) > 0 else 2048
SAMPLES = int(argv[1]) if len(argv) > 1 else 48
ONLY = argv[2].split(',') if len(argv) > 2 else None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(bpy.data.filepath)))
TEX_DIR = os.path.join(ROOT, 'public', 'textures', 'baked')
MODEL_DIR = os.path.join(ROOT, 'public', 'models')
os.makedirs(TEX_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

GROUPS = [('SHELL', 'shellJoined', 'shellBaked'),
          ('GROUND', 'groundJoined', 'groundBaked'),
          ('GARAGE', 'garageJoined', 'garageBaked'),
          ('BANK', 'bankJoined', 'bankBaked'),
          ('MILANO', 'milanoJoined', 'milanoBaked'),
          ('FARMACIA', 'farmaciaJoined', 'farmaciaBaked'),
          ('BEACH', 'beachJoined', 'beachBaked'),
          ('EXTERIOR', 'exteriorJoined', 'exteriorBaked')]
BAKE_COLLS = [g[0] for g in GROUPS]

def log(*a):
    print('[bake]', *a, flush=True)

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.05
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'
scene.cycles.max_bounces = 4
scene.cycles.diffuse_bounces = 3
scene.cycles.glossy_bounces = 2
scene.cycles.caustics_reflective = False
scene.cycles.caustics_refractive = False
scene.cycles.bake_type = 'COMBINED'
b = scene.render.bake
b.use_pass_direct = True
b.use_pass_indirect = True
b.use_pass_color = True
b.use_pass_diffuse = True
b.use_pass_glossy = True
b.use_pass_emit = True
b.use_pass_transmission = False
b.margin = 8
b.margin_type = 'EXTEND'
b.use_selected_to_active = False
b.use_clear = True
scene.render.threads_mode = 'AUTO'

def select_only(objs, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or objs[0]

def join_group(coll_name, joined_name):
    coll = bpy.data.collections.get(coll_name)
    objs = [o for o in coll.objects if o.type == 'MESH'] if coll else []
    if not objs:
        return None
    existing = bpy.data.objects.get(joined_name)
    if existing and len(objs) == 1 and objs[0] is existing:
        return existing
    select_only(objs, objs[0])
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = joined_name
    ob.data.name = joined_name
    # apply transforms so the UV unwrap sees world-space geometry
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob

def unwrap(ob):
    select_only([ob], ob)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.002, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    try:
        bpy.ops.uv.pack_islands(rotate=True, margin=0.003)
    except Exception as e:
        log('pack_islands skipped:', e)
    bpy.ops.object.mode_set(mode='OBJECT')

def attach_bake_image(ob, image):
    for slot in ob.material_slots:
        m = slot.material
        if m is None:
            continue
        nt = m.node_tree
        node = nt.nodes.get('BAKE_TARGET')
        if node is None:
            node = nt.nodes.new('ShaderNodeTexImage')
            node.name = 'BAKE_TARGET'
            node.location = (-600, 400)
        node.image = image
        node.select = True
        nt.nodes.active = node

def bake_group(ob, tex_name):
    image = bpy.data.images.get(tex_name) or bpy.data.images.new(tex_name, SIZE, SIZE, alpha=False, float_buffer=False)
    image.generated_color = (0, 0, 0, 1)
    attach_bake_image(ob, image)
    select_only([ob], ob)
    t0 = time.time()
    bpy.ops.object.bake(type='COMBINED')
    path = os.path.join(TEX_DIR, tex_name + '.png')
    image.filepath_raw = path
    image.file_format = 'PNG'
    image.save()
    log(f'{tex_name}: baked {SIZE}px in {time.time() - t0:.0f}s -> {path}')

manifest = {'size': SIZE, 'samples': SAMPLES, 'groups': {}, 'emissive': [], 'screens': [], 'signs': [], 'hitboxes': [], 'dynamic': []}
t_all = time.time()
for coll_name, joined_name, tex_name in GROUPS:
    # every group is joined + unwrapped so the exported GLB is always complete; ONLY limits which ones get baked
    ob = join_group(coll_name, joined_name)
    if ob is None:
        continue
    log(f'{coll_name}: joined -> {joined_name} ({len(ob.data.vertices)} verts, {len(ob.material_slots)} mats)')
    unwrap(ob)
    manifest['groups'][joined_name] = tex_name + '.png'
    if ONLY and coll_name not in ONLY:
        log(f'{coll_name}: bake skipped (not in ONLY)')
        continue
    bake_group(ob, tex_name)

for key, coll in (('emissive', 'EMISSIVE'), ('screens', 'SCREENS'), ('signs', 'SIGNS'), ('hitboxes', 'HITBOX'), ('dynamic', 'DYNAMIC')):
    manifest[key] = sorted(o.name for o in bpy.data.collections[coll].objects if o.type == 'MESH')

# ---- screens: give every 4-vert plane a 0..1 UV quad (the build helper made no UV layer)
for o in bpy.data.collections['SCREENS'].objects:
    me = o.data
    if len(me.polygons) != 1 or len(me.polygons[0].vertices) != 4:
        continue
    uv = me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
    quad = [(0, 0), (1, 0), (1, 1), (0, 1)]
    for li, loop in enumerate(me.polygons[0].loop_indices):
        uv.data[loop].uv = quad[li]
    log(f'{o.name}: screen UVs written')

# ---- export GLB (Draco, no materials, meshes only)
export_objs = [o for c in BAKE_COLLS + ['EMISSIVE', 'SCREENS', 'SIGNS', 'HITBOX', 'DYNAMIC'] if bpy.data.collections.get(c)
               for o in bpy.data.collections[c].objects if o.type == 'MESH']
for o in export_objs:
    o.hide_render = False
    o.hide_set(False)
select_only(export_objs, export_objs[0])
glb = os.path.join(MODEL_DIR, 'garage.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True,
                          export_materials='NONE', export_apply=True, export_yup=True,
                          export_cameras=False, export_lights=False, export_animations=False,
                          export_normals=True, export_texcoords=True, export_colors=False,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                          export_draco_position_quantization=14, export_draco_normal_quantization=10,
                          export_draco_texcoord_quantization=12)
manifest['glb'] = 'garage.glb'
manifest['glbBytes'] = os.path.getsize(glb)
with open(os.path.join(MODEL_DIR, 'manifest.json'), 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(bpy.data.filepath), 'garage_baked.blend'))
log(f'ALL DONE in {time.time() - t_all:.0f}s; glb {manifest["glbBytes"]} bytes')
