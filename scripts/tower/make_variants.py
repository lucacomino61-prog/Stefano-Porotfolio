"""
Write the day blend beside the night one, so both are openable.

lighting.py switches an already-built scene between the two, but a switch that
only exists inside a bake run is not something anyone can look at. This applies
it and saves, so `garage_day.blend` opens in Blender showing the daylight rig
and `garage.blend` stays exactly as build_street.py authored it.

    blender -b assets/blender/garage.blend -P scripts/tower/make_variants.py
"""
import bpy, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lighting

HERE = os.path.dirname(bpy.data.filepath)

lighting.apply('day')

# Cycles in the viewport, so opening the file shows the bake's lighting rather
# than Eevee's approximation of it — the point of opening it is to judge light.
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for device in prefs.devices:
        device.use = True
    scene.cycles.device = 'GPU'
except Exception as exc:
    print('[variants] GPU unavailable:', exc)

scene.cycles.preview_samples = 24

out = os.path.join(HERE, 'garage_day.blend')
bpy.ops.wm.save_as_mainfile(filepath=out)
print('[variants] wrote', out)

lights = [o for o in bpy.data.objects if o.type == 'LIGHT']
sun = bpy.data.objects.get('sun_day')
print('[variants] lights in scene:', len(lights))
print('[variants] sun present:', sun is not None, '| hidden in render:', sun.hide_render if sun else '-')
