"""
Two times of day for the same street.

The street was authored at night: neon, street lamps, and a pink and a cyan wash
raking across the front. That is the look, and nothing here touches it — night
is the scene exactly as build_street.py leaves it.

Day is the same geometry under a different sky. It is not "night plus a sun":
a sun changes what every other light in the scene is for. The lamps and washes
that carry the picture at night become a coloured haze at noon, and the neon
that reads as a sign in the dark reads as a blown highlight in daylight, so both
come down. What is left is a sun, a sky, and the bounce between them.

Applied to an already-built scene rather than during the build, so the same
garage.blend bakes either way and a human opening the file can switch between
them without regenerating anything:

    from lighting import apply
    apply('day')    # or 'night'

Every value the switch touches is stashed on the datablock the first time it is
read, so day is reversible and applying night afterwards restores exactly what
build_street.py authored — not an approximation of it.
"""
import bpy

VARIANTS = ('day', 'night')

# What daylight does to a rig built for darkness.
#
# The lamps stay in the scene rather than being deleted: a shop light is still
# on during the day, it just stops being the reason you can see the shop. These
# are the fractions of their authored energy they keep.
LAMP_KEEP = 0.16
NEON_KEEP = 0.30

SUN_NAME = 'sun_day'
# The fills standing off each opening are not shop lights, they are what the
# sky would be doing if the room had a front on a street. Dimming them to 16%
# with the lamps would bake a daylight variant whose interiors are darker than
# the night one, which is the wrong way round.
FILL_PREFIX = 'faceFill'
DAY_COLLECTION = 'DAY'

# Sky, and the ground bounce under it. Warm enough to read as afternoon rather
# than as an overcast studio, which is what a neutral grey world would give.
DAY_SKY = (0.42, 0.58, 0.86, 1.0)
DAY_SKY_STRENGTH = 1.6
NIGHT_SKY = (0.012, 0.020, 0.055, 1.0)
NIGHT_SKY_STRENGTH = 0.55


def _remember(datablock, key, value):
    """Stash an authored value once, so the switch is reversible."""
    if key not in datablock:
        datablock[key] = value
    return datablock[key]


def _emission_nodes():
    """Every emission input in the scene, with the material it belongs to.

    build_street.py writes emission onto Principled BSDFs rather than Emission
    shaders, so this looks for the strength socket on both.
    """
    for material in bpy.data.materials:
        if not material.use_nodes or material.node_tree is None:
            continue
        for node in material.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED' and 'Emission Strength' in node.inputs:
                yield material, node.inputs['Emission Strength']
            elif node.type == 'EMISSION' and 'Strength' in node.inputs:
                yield material, node.inputs['Strength']


def _world():
    world = bpy.context.scene.world
    if world is None:
        world = bpy.data.worlds.new('street.world')
        bpy.context.scene.world = world
    world.use_nodes = True
    node = world.node_tree.nodes.get('Background')
    if node is None:
        node = next((n for n in world.node_tree.nodes if n.type == 'BACKGROUND'), None)
    return node


def _sun():
    """The one light day adds. Kept in its own collection so it is obvious in
    the outliner which lights belong to which time of day."""
    obj = bpy.data.objects.get(SUN_NAME)
    if obj is not None:
        return obj

    data = bpy.data.lights.new(SUN_NAME, type='SUN')
    data.energy = 4.2
    data.color = (1.0, 0.94, 0.82)
    # A soft-edged sun. Cycles traces the disc, so widening it is what turns a
    # hard architectural shadow into the softer one an afternoon actually casts.
    data.angle = 0.09

    obj = bpy.data.objects.new(SUN_NAME, data)
    obj.rotation_euler = (0.95, 0.0, -0.62)
    obj.location = (0.0, -6.0, 14.0)

    collection = bpy.data.collections.get(DAY_COLLECTION)
    if collection is None:
        collection = bpy.data.collections.new(DAY_COLLECTION)
        bpy.context.scene.collection.children.link(collection)
    collection.objects.link(obj)
    return obj


def apply(variant: str) -> None:
    if variant not in VARIANTS:
        raise ValueError(f'variant must be one of {VARIANTS}, got {variant!r}')

    day = variant == 'day'

    # --- the lamps the street was built with -------------------------------
    for obj in bpy.data.objects:
        if obj.type != 'LIGHT' or obj.name == SUN_NAME or obj.name.startswith(FILL_PREFIX):
            continue
        authored = _remember(obj.data, 'authored_energy', obj.data.energy)
        obj.data.energy = authored * LAMP_KEEP if day else authored

    # --- neon, signs, screens ----------------------------------------------
    for material, socket in _emission_nodes():
        authored = _remember(material, f'authored_emit_{socket.name}', socket.default_value)
        socket.default_value = authored * NEON_KEEP if day else authored

    # --- the sun, and the sky it hangs in ----------------------------------
    sun = _sun()
    sun.hide_render = not day
    sun.hide_viewport = not day

    background = _world()
    if background is not None:
        background.inputs[0].default_value = DAY_SKY if day else NIGHT_SKY
        background.inputs[1].default_value = DAY_SKY_STRENGTH if day else NIGHT_SKY_STRENGTH

    print(f'[lighting] {variant}: lamps x{LAMP_KEEP if day else 1.0}, '
          f'emission x{NEON_KEEP if day else 1.0}, sun {"on" if day else "off"}')
