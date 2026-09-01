"""
The room shell, modelled headlessly and exported as one GLB.

Built in three.js coordinates and converted on the way out: the glTF exporter
turns Blender (x, y, z) into glTF (x, z, -y), so a three-space point (tx,ty,tz)
is authored here as Blender (tx, -tz, ty). Every number below is therefore the
number the scene already uses, in metres, which is what makes this a drop-in
for the primitives it replaces rather than a re-measure of the room.

No textures and no booleans. The window opening is framed by four wall pieces
rather than cut, because a boolean that fails leaves a hole nobody can see
until the light leaks through it.
"""
import bpy, bmesh, sys, os

bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, hex_rgb, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    r = int(hex_rgb[0:2], 16) / 255
    g = int(hex_rgb[2:4], 16) / 255
    bl = int(hex_rgb[4:6], 16) / 255
    # glTF stores base colour linear; Blender's viewport value is linear too.
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    b.inputs["Base Color"].default_value = (lin(r), lin(g), lin(bl), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = 0
    return m

FLOOR = mat("room.floor", "19191b", 0.90)
WALL  = mat("room.wall",  "111113", 0.96)
SIDE  = mat("room.side",  "151517", 0.94)
TRIM  = mat("room.trim",  "1b1b1e", 0.85)

parts = []

def box(name, centre, size, material):
    """centre and size in THREE space, metres."""
    tx, ty, tz = centre
    sx, sy, sz = size
    bpy.ops.mesh.primitive_cube_add(size=2, location=(tx, -tz, ty))
    o = bpy.context.object
    o.name = name
    o.scale = (sx / 2, sz / 2, sy / 2)   # three (x,y,z) -> blender (x,z,y)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    parts.append(o)
    return o

# --- floor -----------------------------------------------------------------
box("floor", (0, -1.28, 0), (14, 0.12, 12), FLOOR)

# --- back wall, built around the window opening ----------------------------
# opening: x -3.9..-1.2, y -0.07..2.83, wall plane z = -3.15, depth 0.12
box("wall.back.jamb.l", (-4.70, 1.65, -3.15), (1.60, 5.80, 0.12), WALL)
box("wall.back.jamb.r", ( 2.15, 1.65, -3.15), (6.70, 5.80, 0.12), WALL)
box("wall.back.sill",   (-2.55, -0.66, -3.15), (2.70, 1.18, 0.12), WALL)
box("wall.back.lintel", (-2.55, 3.69, -3.15), (2.70, 1.72, 0.12), WALL)

# --- side walls. The right one is the whole point: the room had none, which
#     is how you could see out of it. -----------------------------------------
box("wall.side.l", (-5.30, 1.20, 0), (0.12, 5.00, 8.00), SIDE)
box("wall.side.r", ( 5.30, 1.20, 0), (0.12, 5.00, 8.00), SIDE)

# --- skirting: the join between wall and floor, which is what stops a room
#     reading as a box with a picture of a wall on it ------------------------
box("trim.skirt.back", (0, -1.15, -3.06), (11.00, 0.14, 0.06), TRIM)
box("trim.skirt.l", (-5.235, -1.15, 0), (0.06, 0.14, 8.00), TRIM)
box("trim.skirt.r", ( 5.235, -1.15, 0), (0.06, 0.14, 8.00), TRIM)

# --- window reveal: the opening has depth now, so the glass sits in a hole
#     rather than on a wall ---------------------------------------------------
box("trim.reveal.head", (-2.55, 2.800, -3.06), (2.70, 0.06, 0.18), TRIM)
box("trim.reveal.sill", (-2.55, -0.040, -3.04), (2.70, 0.06, 0.22), TRIM)
box("trim.reveal.l",    (-3.870, 1.38, -3.06), (0.06, 2.90, 0.18), TRIM)
box("trim.reveal.r",    (-1.230, 1.38, -3.06), (0.06, 2.90, 0.18), TRIM)

# --- one mesh, so this is fewer draw calls than the primitives it replaces ---
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
room = bpy.context.object
room.name = "room"

me = room.data
tris = sum(len(p.vertices) - 2 for p in me.polygons)
bb = [room.matrix_world @ v.co for v in me.vertices]
xs = [v.x for v in bb]; ys = [v.y for v in bb]; zs = [v.z for v in bb]

out = sys.argv[sys.argv.index('--') + 1]
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB',
                          export_apply=True, export_materials='EXPORT')

print("ROOM_TRIS", tris)
print("ROOM_VERTS", len(me.vertices))
print("ROOM_MATS", len(me.materials), [m.name for m in me.materials])
# report bounds back in three space: blender (x,y,z) -> three (x, z, -y)
print("ROOM_BOUNDS_THREE x=%.2f..%.2f y=%.2f..%.2f z=%.2f..%.2f" % (
    min(xs), max(xs), min(zs), max(zs), -max(ys), -min(ys)))
print("ROOM_BYTES", os.path.getsize(out))
