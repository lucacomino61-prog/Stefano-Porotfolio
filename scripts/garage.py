"""Build Stefano Motor Works as a dense cutaway, web-ready Blender diorama."""

from __future__ import annotations

import math
import os

import bpy
from mathutils import Vector


ROOT = "/Users/laura/Stefano/stefano-portfolio-main"
BLEND_OUT = os.path.join(ROOT, "assets/blender/stefano-motor-works.blend")
GLB_OUT = os.path.join(ROOT, "public/models/garage/stefano-motor-works.glb")
PREVIEW_OUT = os.path.join(ROOT, "public/models/garage/stefano-motor-works-preview.png")


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for item in list(datablocks):
            if item.users == 0:
                datablocks.remove(item)


def collection(name: str) -> bpy.types.Collection:
    existing = bpy.data.collections.get(name)
    if existing:
        return existing
    target = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(target)
    return target


COLLECTIONS = {}


def use_collection(name: str) -> bpy.types.Collection:
    target = COLLECTIONS.get(name)
    if target is None:
        target = collection(name)
        COLLECTIONS[name] = target
    return target


def move_to(obj: bpy.types.Object, target_name: str) -> bpy.types.Object:
    target = use_collection(target_name)
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    target.objects.link(obj)
    return obj


def material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float = 0.55,
    metallic: float = 0.0,
    emission: tuple[float, float, float, float] | None = None,
    strength: float = 0.0,
) -> bpy.types.Material:
    found = bpy.data.materials.get(name)
    if found:
        return found
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if emission:
        emission_key = "Emission Color" if "Emission Color" in shader.inputs else "Emission"
        shader.inputs[emission_key].default_value = emission
        if "Emission Strength" in shader.inputs:
            shader.inputs["Emission Strength"].default_value = strength
    return mat


def assign(obj: bpy.types.Object, mat: bpy.types.Material) -> bpy.types.Object:
    if hasattr(obj.data, "materials"):
        obj.data.materials.append(mat)
    return obj


def box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    mat: bpy.types.Material,
    target: str,
    bevel: float = 0.04,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new("edge_softness", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    assign(obj, mat)
    move_to(obj, target)
    return obj


def cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    mat: bpy.types.Material,
    target: str,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    vertices: int = 32,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    move_to(obj, target)
    bevel = obj.modifiers.new("rim_softness", "BEVEL")
    bevel.width = min(radius * 0.08, 0.025)
    bevel.segments = 2
    return obj


def sphere(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    target: str,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    segments: int = 24,
    rings: int = 12,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    move_to(obj, target)
    return obj


def torus(
    name: str,
    location: tuple[float, float, float],
    major: float,
    minor: float,
    mat: bpy.types.Material,
    target: str,
    rotation: tuple[float, float, float] = (math.pi / 2, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=28,
        minor_segments=10,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    move_to(obj, target)
    return obj


def tube(
    name: str,
    points: list[tuple[float, float, float]],
    radius: float,
    mat: bpy.types.Material,
    target: str,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, position in zip(spline.bezier_points, points):
        point.co = position
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    use_collection(target).objects.link(obj)
    assign(obj, mat)
    return obj


def text_object(
    name: str,
    body: str,
    location: tuple[float, float, float],
    size: float,
    mat: bpy.types.Material,
    target: str = "SIGNAGE",
    rotation: tuple[float, float, float] = (math.pi / 2, 0.0, 0.0),
    extrude: float = 0.018,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(name, "FONT")
    curve.body = body
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.size = size
    curve.extrude = extrude
    curve.bevel_depth = 0.004
    curve.bevel_resolution = 2
    obj = bpy.data.objects.new(name, curve)
    obj.location = location
    obj.rotation_euler = rotation
    use_collection(target).objects.link(obj)
    assign(obj, mat)
    return obj


def area_light(name: str, location, energy: float, color, size: float, rotation=(0.0, 0.0, 0.0)):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = color
    data.shape = "RECTANGLE"
    data.size = size
    data.size_y = max(0.2, size * 0.22)
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    obj.rotation_euler = rotation
    use_collection("LIGHTS").objects.link(obj)
    return obj


def point_light(name: str, location, energy: float, color, radius: float = 0.25):
    data = bpy.data.lights.new(name, "POINT")
    data.energy = energy
    data.color = color
    data.shadow_soft_size = radius
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    use_collection("LIGHTS").objects.link(obj)
    return obj


def look_at(obj: bpy.types.Object, point: tuple[float, float, float]) -> None:
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


def transform_group(
    name: str,
    objects: list[bpy.types.Object],
    pivot: tuple[float, float, float],
    target: tuple[float, float, float],
    rotation_z: float = 0.0,
) -> bpy.types.Object:
    """Move a multi-part prop as one object without joining its web meshes."""
    root = bpy.data.objects.new(name, None)
    root.location = pivot
    use_collection("EXTERIOR").objects.link(root)
    bpy.context.view_layer.update()
    for obj in objects:
        if obj is root or obj.parent is not None:
            continue
        world = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_parent_inverse = root.matrix_world.inverted()
        obj.matrix_world = world
    bpy.context.view_layer.update()
    root.rotation_euler.z = rotation_z
    root.location = target
    bpy.context.view_layer.update()
    return root


clear_scene()
for name in (
    "GARAGE_ARCHITECTURE",
    "VEHICLE",
    "LIFT",
    "WORKSTATION",
    "TOOLS",
    "STORAGE",
    "PROPS",
    "SIGNAGE",
    "LIGHTS",
    "INTERACTIVE_OBJECTS",
    "EXTERIOR",
    "ROOFTOP",
    "TECH_LOUNGE",
):
    use_collection(name)

# Palette: cool graphite shell, warm work light, one mechanic-red accent.
CONCRETE = material("concrete", (0.115, 0.13, 0.15, 1), 0.92)
CONCRETE_LIGHT = material("concrete_worn", (0.21, 0.23, 0.24, 1), 0.88)
STEEL = material("steel", (0.19, 0.21, 0.23, 1), 0.33, 0.78)
DARK_STEEL = material("dark_steel", (0.035, 0.042, 0.05, 1), 0.4, 0.72)
BLACK = material("rubber", (0.018, 0.022, 0.026, 1), 0.72)
RED = material("mechanic_red", (0.56, 0.018, 0.024, 1), 0.36, 0.32)
RED_GLOW = material("red_emissive", (0.42, 0.012, 0.016, 1), 0.25, 0.2, (1.0, 0.018, 0.02, 1), 5.5)
WHITE_GLOW = material("shop_light", (0.72, 0.82, 0.96, 1), 0.25, 0.05, (0.62, 0.79, 1.0, 1), 4.0)
WARM_GLOW = material("inspection_light", (1.0, 0.52, 0.16, 1), 0.3, 0.08, (1.0, 0.26, 0.055, 1), 7.0)
YELLOW = material("safety_yellow", (0.95, 0.53, 0.035, 1), 0.48, 0.14)
GLASS = material("glass_dark", (0.035, 0.11, 0.15, 1), 0.12, 0.34)
CAR = material("car_paint", (0.46, 0.012, 0.018, 1), 0.22, 0.72)
CAR_DARK = material("car_trim", (0.015, 0.019, 0.025, 1), 0.2, 0.5)
CHROME = material("polished_tool", (0.48, 0.53, 0.58, 1), 0.18, 0.94)
WOOD = material("worktop", (0.18, 0.105, 0.055, 1), 0.68)
BLUE = material("diagnostic_blue", (0.02, 0.22, 0.46, 1), 0.28, 0.36, (0.02, 0.35, 1.0, 1), 3.0)
OIL = material("waste_oil", (0.01, 0.013, 0.012, 1), 0.11, 0.15)
PAPER = material("paper", (0.72, 0.69, 0.58, 1), 0.9)
WHITE = material("device_white", (0.72, 0.76, 0.8, 1), 0.34, 0.38)
ALUMINUM = material("laptop_aluminum", (0.42, 0.46, 0.5, 1), 0.25, 0.82)
CYAN_GLOW = material("wifi_cyan", (0.018, 0.35, 0.55, 1), 0.23, 0.22, (0.02, 0.72, 1.0, 1), 4.2)
GREEN_GLOW = material("status_green", (0.02, 0.38, 0.15, 1), 0.25, 0.18, (0.03, 1.0, 0.28, 1), 3.6)
ORANGE = material("traffic_orange", (0.95, 0.18, 0.025, 1), 0.56, 0.05)
FABRIC = material("lounge_fabric", (0.075, 0.085, 0.105, 1), 0.96)

# Architectural shell.
box("ARCH_Floor", (0.0, 1.5, -0.18), (14.0, 10.0, 0.36), CONCRETE, "GARAGE_ARCHITECTURE", 0.08)
box("ARCH_BackWall", (0.0, 6.35, 3.15), (14.0, 0.28, 6.7), CONCRETE_LIGHT, "GARAGE_ARCHITECTURE", 0.03)
box("ARCH_LeftWall", (-6.85, 1.8, 3.15), (0.3, 9.2, 6.7), CONCRETE, "GARAGE_ARCHITECTURE", 0.03)
box("ARCH_RightReturn", (6.85, 4.55, 3.15), (0.3, 3.9, 6.7), CONCRETE, "GARAGE_ARCHITECTURE", 0.03)
box("ARCH_RoofBeamFront", (0.0, -3.22, 6.48), (14.1, 0.2, 0.2), DARK_STEEL, "GARAGE_ARCHITECTURE", 0.035)
box("ARCH_RoofBeamBack", (0.0, 6.1, 6.48), (14.1, 0.18, 0.2), DARK_STEEL, "GARAGE_ARCHITECTURE", 0.035)
for x in (-6.3, -2.1, 2.1, 6.3):
    box(f"ARCH_CeilingRail_{x:+.1f}", (x, 1.5, 6.38), (0.11, 9.1, 0.11), STEEL, "GARAGE_ARCHITECTURE", 0.018)

# Ramen-shop-style cutaway roof: enough mass to read as a complete building,
# with the front/centre opened so the portfolio interior remains visible.
box("ARCH_RoofBackSlab", (0.0, 5.1, 6.62), (14.2, 2.55, 0.24), CONCRETE, "GARAGE_ARCHITECTURE", 0.035)
box("ARCH_RoofLeftWing", (-5.9, 1.25, 6.62), (2.25, 5.2, 0.24), CONCRETE, "GARAGE_ARCHITECTURE", 0.035)
box("ARCH_RoofRightWing", (6.0, 3.0, 6.62), (1.95, 3.7, 0.24), CONCRETE, "GARAGE_ARCHITECTURE", 0.035)
for x in (-6.75, 6.75):
    box(f"ARCH_ParapetSide_{x:+.2f}", (x, 3.85, 7.0), (0.22, 5.4, 0.72), DARK_STEEL, "GARAGE_ARCHITECTURE", 0.025)
box("ARCH_ParapetBack", (0.0, 6.22, 7.0), (13.7, 0.22, 0.72), DARK_STEEL, "GARAGE_ARCHITECTURE", 0.025)

# Street edge and service apron make the garage read as an exterior building.
box("EXT_ServiceApron", (0.0, -4.65, -0.08), (15.8, 2.25, 0.2), CONCRETE_LIGHT, "EXTERIOR", 0.045)
box("EXT_Curb", (0.0, -5.86, -0.02), (16.2, 0.32, 0.32), CONCRETE, "EXTERIOR", 0.035)
box("EXT_Road", (0.0, -7.05, -0.22), (19.0, 2.25, 0.18), DARK_STEEL, "EXTERIOR", 0.03)
for x in (-6.7, -2.25, 2.25, 6.7):
    box(f"EXT_RoadMarker_{x:+.2f}", (x, -7.03, -0.115), (2.4, 0.1, 0.025), PAPER, "EXTERIOR", 0.005)

# Open roller-door frame and slatted door rolled above the opening.
box("ARCH_DoorPost_L", (-4.9, -3.05, 3.0), (0.34, 0.34, 6.0), DARK_STEEL, "GARAGE_ARCHITECTURE", 0.03)
box("ARCH_DoorPost_R", (1.8, -3.05, 3.0), (0.34, 0.34, 6.0), DARK_STEEL, "GARAGE_ARCHITECTURE", 0.03)
box("ARCH_DoorHeader", (-1.55, -3.05, 5.9), (7.05, 0.24, 0.22), DARK_STEEL, "GARAGE_ARCHITECTURE", 0.03)
for i in range(5):
    box(f"ARCH_RollerSlat_{i:02d}", (-1.55, -2.9, 5.52 - i * 0.16), (6.58, 0.1, 0.12), STEEL, "GARAGE_ARCHITECTURE", 0.018)

# Layered front fascia and striped canopy echo the compact shop silhouette.
box("EXT_FasciaRightPost", (6.68, -3.05, 2.78), (0.28, 0.34, 5.55), DARK_STEEL, "EXTERIOR", 0.04)
box("EXT_FasciaRightHeader", (4.25, -3.05, 5.15), (4.55, 0.24, 0.24), DARK_STEEL, "EXTERIOR", 0.04)
for index, x in enumerate((2.25, 2.8, 3.35, 3.9, 4.45, 5.0, 5.55, 6.1)):
    box(
        f"EXT_AwningSlat_{index:02d}",
        (x, -3.54, 4.86),
        (0.5, 1.05, 0.1),
        RED if index % 2 == 0 else PAPER,
        "EXTERIOR",
        0.018,
        (math.radians(-7), 0, 0),
    )
box("EXT_AwningRail", (4.18, -4.02, 4.77), (4.5, 0.08, 0.08), DARK_STEEL, "EXTERIOR", 0.015)

# Exterior blade sign, wall lamps and security camera.
box("EXT_BladeBracket", (-6.7, -1.95, 4.35), (0.85, 0.12, 0.12), STEEL, "EXTERIOR", 0.025)
box("EXT_BladeSign", (-7.12, -1.95, 3.68), (0.18, 1.05, 1.5), RED, "EXTERIOR", 0.055)
text_object("EXT_BladeText", "SMW", (-7.24, -1.95, 3.7), 0.28, PAPER, "SIGNAGE", (math.pi / 2, 0, math.pi / 2))
for x in (-4.9, 1.8, 6.5):
    box(f"EXT_WallLamp_{x:+.1f}", (x, -3.3, 4.65), (0.38, 0.34, 0.18), DARK_STEEL, "EXTERIOR", 0.06, (math.radians(-18), 0, 0))
    box(f"EXT_WallLampGlow_{x:+.1f}", (x, -3.49, 4.57), (0.25, 0.04, 0.08), WARM_GLOW, "EXTERIOR", 0.02)
box("EXT_CCTVMount", (6.05, -3.26, 4.45), (0.12, 0.45, 0.12), STEEL, "EXTERIOR", 0.025, (0, 0, 0.35))
box("EXT_CCTV", (6.22, -3.5, 4.3), (0.48, 0.26, 0.25), WHITE, "EXTERIOR", 0.08, (0, 0, 0.35))
cylinder("EXT_CCTVLens", (6.18, -3.65, 4.3), 0.075, 0.04, BLACK, "EXTERIOR", (math.pi / 2, 0, 0), 20)

# Floor markings, drain and oil traces.
box("ARCH_Drain", (-1.45, -1.7, 0.012), (4.8, 0.16, 0.035), DARK_STEEL, "GARAGE_ARCHITECTURE", 0.01)
for i in range(12):
    color = YELLOW if i % 2 == 0 else DARK_STEEL
    box(f"ARCH_SafetyStripe_{i:02d}", (-4.95 + i * 0.56, 4.92, 0.025), (0.52, 0.3, 0.045), color, "GARAGE_ARCHITECTURE", 0.005, (0, 0, -0.32))
for i, (x, y, sx, sy) in enumerate(((-1.4, 1.2, 1.15, 0.62), (-0.4, -0.3, 0.65, 0.38), (3.2, 3.2, 0.82, 0.42))):
    cylinder(f"PROP_OilStain_{i}", (x, y, 0.025), 0.5, 0.018, OIL, "PROPS", vertices=40)
    bpy.context.object.scale.x = sx
    bpy.context.object.scale.y = sy

# Vehicle lift.
for x in (-4.15, 1.15):
    box(f"LIFT_Post_{x:+.2f}", (x, 1.2, 2.25), (0.46, 0.56, 4.5), RED, "LIFT", 0.07)
    box(f"LIFT_Foot_{x:+.2f}", (x, 1.2, 0.16), (1.0, 0.95, 0.24), DARK_STEEL, "LIFT", 0.05)
    box(f"LIFT_Carriage_{x:+.2f}", (x, 1.2, 1.55), (0.62, 0.72, 0.82), STEEL, "LIFT", 0.06)
box("LIFT_TopBridge", (-1.5, 1.2, 4.45), (5.8, 0.4, 0.34), RED, "LIFT", 0.06)
for x in (-3.25, 0.25):
    box(f"LIFT_Arm_{x:+.2f}", (x, 1.15, 0.62), (1.45, 0.19, 0.16), DARK_STEEL, "LIFT", 0.04, (0, 0, 0.12 if x < 0 else -0.12))
    cylinder(f"LIFT_Pad_{x:+.2f}", (x + (0.6 if x < 0 else -0.6), 1.15, 0.76), 0.16, 0.12, BLACK, "LIFT", vertices=24)

# Stylized unbranded performance coupe.
box("VEH_BodyLower", (-1.5, 0.78, 1.0), (3.7, 4.7, 0.68), CAR, "VEHICLE", 0.22)
box("VEH_Hood", (-1.5, -0.78, 1.43), (3.25, 1.55, 0.32), CAR, "VEHICLE", 0.16, (0.04, 0, 0))
box("VEH_Cabin", (-1.5, 1.15, 1.78), (2.75, 2.25, 0.9), CAR, "VEHICLE", 0.28)
box("VEH_Windshield", (-1.5, 0.04, 2.02), (2.34, 0.08, 0.68), GLASS, "VEHICLE", 0.04, (math.radians(24), 0, 0))
box("VEH_RearGlass", (-1.5, 2.2, 1.98), (2.25, 0.08, 0.58), GLASS, "VEHICLE", 0.04, (math.radians(-25), 0, 0))
box("VEH_FrontBumper", (-1.5, -1.63, 0.77), (3.5, 0.28, 0.44), CAR_DARK, "VEHICLE", 0.12)
box("VEH_RearBumper", (-1.5, 3.05, 0.79), (3.45, 0.28, 0.42), CAR_DARK, "VEHICLE", 0.12)
for x in (-3.0, 0.0):
    for y in (-0.55, 2.15):
        torus(f"VEH_Tire_{x:+.1f}_{y:+.1f}", (x, y, 0.78), 0.43, 0.15, BLACK, "VEHICLE")
        cylinder(f"VEH_Wheel_{x:+.1f}_{y:+.1f}", (x, y, 0.78), 0.3, 0.24, CHROME, "VEHICLE", (math.pi / 2, 0, 0), 24)
for x in (-2.45, -0.55):
    box(f"VEH_Headlamp_{x:+.2f}", (x, -1.79, 1.16), (0.52, 0.06, 0.19), WHITE_GLOW, "VEHICLE", 0.05)
box("VEH_LightBar", (-1.5, 3.2, 1.05), (2.5, 0.035, 0.11), RED_GLOW, "VEHICLE", 0.02)

# Workstation and PC hardware.
box("WORK_BenchFrame", (4.0, 4.92, 0.62), (4.3, 1.25, 1.16), DARK_STEEL, "WORKSTATION", 0.08)
box("WORK_BenchTop", (4.0, 4.72, 1.26), (4.5, 1.55, 0.18), WOOD, "WORKSTATION", 0.05)
box("WORK_BackPanel", (4.0, 5.86, 2.2), (4.5, 0.12, 1.75), DARK_STEEL, "WORKSTATION", 0.04)
box("WORK_MonitorBezel", (4.0, 4.76, 2.2), (1.95, 0.22, 1.22), BLACK, "WORKSTATION", 0.12)
box("INT_Monitor_Projects", (4.0, 4.625, 2.2), (1.69, 0.025, 0.94), BLUE, "INTERACTIVE_OBJECTS", 0.03)
box("WORK_MonitorStand", (4.0, 4.9, 1.49), (0.18, 0.32, 0.5), STEEL, "WORKSTATION", 0.04)
box("WORK_MonitorFoot", (4.0, 4.65, 1.31), (0.72, 0.48, 0.08), STEEL, "WORKSTATION", 0.04)
box("WORK_PC_Case", (5.45, 4.72, 1.9), (0.86, 1.08, 1.58), DARK_STEEL, "INTERACTIVE_OBJECTS", 0.1)
box("WORK_PC_Glass", (4.999, 4.72, 1.9), (0.035, 0.86, 1.34), GLASS, "WORKSTATION", 0.02)
for z in (1.52, 1.9, 2.28):
    torus(f"WORK_PC_Fan_{z:.2f}", (5.46, 4.16, z), 0.18, 0.025, RED_GLOW, "WORKSTATION", (math.pi / 2, 0, 0))
box("WORK_Keyboard", (3.62, 3.98, 1.39), (1.35, 0.48, 0.09), BLACK, "INTERACTIVE_OBJECTS", 0.05, (0, 0, 0.02))
box("WORK_Mouse", (4.67, 4.04, 1.42), (0.23, 0.36, 0.13), BLACK, "INTERACTIVE_OBJECTS", 0.09)
box("WORK_DiagnosticScanner", (2.45, 4.28, 1.49), (0.62, 0.42, 0.22), RED, "INTERACTIVE_OBJECTS", 0.08, (0, 0, -0.2))
box("WORK_ScannerScreen", (2.45, 4.08, 1.53), (0.42, 0.02, 0.1), BLUE, "WORKSTATION", 0.01, (0, 0, -0.2))
box("WORK_Coffee", (5.82, 4.1, 1.48), (0.23, 0.23, 0.28), PAPER, "PROPS", 0.05)

# MacBook Air-style mobile workstation, kept unbranded and export friendly.
box("TECH_MacBookBase", (2.92, 4.02, 1.42), (0.92, 0.62, 0.045), ALUMINUM, "TECH_LOUNGE", 0.035)
box("TECH_MacBookKeyboard", (2.92, 3.94, 1.448), (0.69, 0.36, 0.012), BLACK, "TECH_LOUNGE", 0.015)
box("TECH_MacBookScreen", (2.92, 4.31, 1.82), (0.92, 0.05, 0.58), ALUMINUM, "TECH_LOUNGE", 0.045, (math.radians(-9), 0, 0))
box("TECH_MacBookDisplay", (2.92, 4.275, 1.82), (0.78, 0.018, 0.44), BLUE, "TECH_LOUNGE", 0.02, (math.radians(-9), 0, 0))
text_object("TECH_MacBookLabel", "MOBILE BUILD", (2.92, 4.245, 1.81), 0.09, PAPER, "SIGNAGE", (math.pi / 2, 0, 0), 0.008)

# Wi-Fi router with antennas and live-status LEDs.
box("INT_Router_Network", (3.05, 5.72, 3.0), (1.05, 0.48, 0.16), WHITE, "INTERACTIVE_OBJECTS", 0.09)
for index, x in enumerate((2.68, 3.05, 3.42)):
    cylinder(f"TECH_RouterAntenna_{index}", (x, 5.84, 3.36), 0.035, 0.7, DARK_STEEL, "TECH_LOUNGE", (math.radians(-8), 0, 0), 16)
for index, x in enumerate((2.77, 2.95, 3.13, 3.31)):
    sphere(f"TECH_RouterLED_{index}", (x, 5.46, 3.01), (0.035, 0.02, 0.035), GREEN_GLOW, "TECH_LOUNGE", segments=12, rings=6)
text_object("TECH_WifiLabel", "WIFI 6  /  ONLINE", (3.05, 5.42, 3.2), 0.11, CYAN_GLOW, "SIGNAGE")

# Compact console shelf and controller beside the main workstation.
box("TECH_ConsoleShelf", (5.62, 4.12, 1.44), (0.95, 0.7, 0.08), STEEL, "TECH_LOUNGE", 0.025)
box("INT_PlayStation_Projects", (5.62, 4.22, 1.8), (0.16, 0.56, 0.76), WHITE, "INTERACTIVE_OBJECTS", 0.07, (0, 0, -0.08))
box("TECH_ConsoleCore", (5.57, 4.21, 1.8), (0.1, 0.5, 0.68), BLACK, "TECH_LOUNGE", 0.04, (0, 0, -0.08))
sphere("TECH_ControllerBody", (5.2, 3.75, 1.55), (0.34, 0.2, 0.13), WHITE, "TECH_LOUNGE", (0.0, 0.0, -0.12), 20, 10)
for index, x in enumerate((5.0, 5.4)):
    cylinder(f"TECH_ControllerGrip_{index}", (x, 3.74, 1.45), 0.11, 0.34, WHITE, "TECH_LOUNGE", (math.radians(68), 0, 0), 16)
for index, (x, z) in enumerate(((5.33, 1.59), (5.4, 1.54), (5.26, 1.54), (5.33, 1.49))):
    sphere(f"TECH_ControllerButton_{index}", (x, 3.58, z), (0.035, 0.025, 0.035), RED_GLOW if index == 0 else CYAN_GLOW, "TECH_LOUNGE", segments=12, rings=6)

# Full-height arcade cabinet creates a second playful portfolio station.
box("INT_Arcade_Playground", (5.25, 2.65, 1.48), (1.25, 1.18, 2.92), DARK_STEEL, "INTERACTIVE_OBJECTS", 0.13)
box("TECH_ArcadeMarquee", (5.25, 2.02, 2.62), (1.04, 0.08, 0.42), RED_GLOW, "TECH_LOUNGE", 0.055)
text_object("TECH_ArcadeTitle", "ARCADE", (5.25, 1.96, 2.64), 0.19, PAPER, "SIGNAGE")
box("TECH_ArcadeScreen", (5.25, 2.01, 2.0), (0.9, 0.05, 0.72), BLUE, "TECH_LOUNGE", 0.06, (math.radians(-8), 0, 0))
box("TECH_ArcadeDeck", (5.25, 1.95, 1.45), (1.02, 0.52, 0.16), RED, "TECH_LOUNGE", 0.07, (math.radians(-7), 0, 0))
cylinder("TECH_ArcadeStick", (5.05, 1.72, 1.68), 0.045, 0.28, DARK_STEEL, "TECH_LOUNGE", (math.radians(90), 0, 0), 16)
sphere("TECH_ArcadeStickTop", (5.05, 1.62, 1.82), (0.1, 0.1, 0.1), RED_GLOW, "TECH_LOUNGE", segments=16, rings=8)
for index, x in enumerate((5.32, 5.55)):
    sphere(f"TECH_ArcadeButton_{index}", (x, 1.66, 1.62), (0.065, 0.035, 0.065), CYAN_GLOW, "TECH_LOUNGE", segments=12, rings=6)

# Small waiting/gaming corner: sofa, low table, headphones and a radio.
box("TECH_SofaSeat", (3.55, 2.45, 0.55), (2.35, 0.92, 0.38), FABRIC, "TECH_LOUNGE", 0.18)
box("TECH_SofaBack", (3.55, 2.9, 1.12), (2.35, 0.3, 1.05), FABRIC, "TECH_LOUNGE", 0.2, (math.radians(-7), 0, 0))
for x in (2.55, 4.55):
    box(f"TECH_SofaArm_{x:.2f}", (x, 2.42, 0.82), (0.28, 0.98, 0.72), FABRIC, "TECH_LOUNGE", 0.15)
box("TECH_LowTable", (3.55, 1.45, 0.48), (1.55, 0.75, 0.12), WOOD, "TECH_LOUNGE", 0.06)
for x in (3.0, 4.1):
    box(f"TECH_LowTableLeg_{x:.1f}", (x, 1.45, 0.22), (0.1, 0.6, 0.45), DARK_STEEL, "TECH_LOUNGE", 0.025)
torus("TECH_Headphones", (3.55, 1.42, 0.62), 0.18, 0.035, BLACK, "TECH_LOUNGE", (0, 0, 0))
box("TECH_Radio", (4.4, 5.32, 3.56), (0.72, 0.3, 0.42), RED, "TECH_LOUNGE", 0.07)
cylinder("TECH_RadioDial", (4.58, 5.14, 3.58), 0.07, 0.035, CHROME, "TECH_LOUNGE", (math.pi / 2, 0, 0), 16)
box("TECH_RadioDisplay", (4.27, 5.14, 3.6), (0.22, 0.025, 0.1), GREEN_GLOW, "TECH_LOUNGE", 0.01)

# Tool chest and pegboard mapped to skills.
box("TOOLS_Chest", (-5.55, 4.9, 1.1), (1.7, 1.0, 2.1), RED, "TOOLS", 0.08)
for i in range(7):
    box(f"TOOLS_Drawer_{i:02d}", (-5.55, 4.36, 0.38 + i * 0.24), (1.42, 0.06, 0.17), DARK_STEEL, "TOOLS", 0.015)
    box(f"TOOLS_Handle_{i:02d}", (-5.55, 4.31, 0.38 + i * 0.24), (0.72, 0.04, 0.035), CHROME, "TOOLS", 0.008)
box("INT_ToolWall_Skills", (-4.4, 6.08, 3.34), (3.6, 0.14, 2.12), STEEL, "INTERACTIVE_OBJECTS", 0.05)
for row in range(4):
    for col in range(9):
        cylinder(f"TOOLS_Peg_{row}_{col}", (-5.85 + col * 0.36, 5.98, 2.72 + row * 0.42), 0.025, 0.035, BLACK, "TOOLS", (math.pi / 2, 0, 0), 12)
for index, x in enumerate((-5.55, -4.95, -4.35, -3.75, -3.15)):
    box(f"TOOLS_Wrench_{index}", (x, 5.85, 3.34 + (index % 2) * 0.22), (0.12, 0.08, 0.95), CHROME, "TOOLS", 0.04, (0, 0, -0.18 + index * 0.09))
    torus(f"TOOLS_WrenchRing_{index}", (x, 5.79, 2.9 + (index % 2) * 0.22), 0.11, 0.035, CHROME, "TOOLS", (math.pi / 2, 0, 0))
text_object("TOOLS_SkillsLabel", "SKILLS / TOOL INDEX", (-4.4, 5.95, 4.6), 0.26, PAPER)

# Storage, oils, tires and compressor.
for z in (0.45, 1.35, 2.25, 3.15):
    box(f"STORAGE_Shelf_{z:.2f}", (5.9, 5.55, z), (1.55, 1.25, 0.1), STEEL, "STORAGE", 0.025)
for x in (5.25, 6.55):
    box(f"STORAGE_Post_{x:.2f}", (x, 5.55, 1.8), (0.12, 1.25, 3.6), STEEL, "STORAGE", 0.025)
for index, (x, y, z, color) in enumerate(((5.45, 5.4, 0.75, RED), (6.1, 5.4, 0.75, YELLOW), (5.5, 5.4, 1.7, PAPER), (6.15, 5.4, 1.7, RED))):
    cylinder(f"STORAGE_OilCan_{index}", (x, y, z), 0.2, 0.42, color, "STORAGE", vertices=24)
for index in range(4):
    torus(f"STORAGE_Tire_{index}", (5.5 + (index % 2) * 0.75, 5.42, 2.62 + (index // 2) * 0.72), 0.3, 0.12, BLACK, "STORAGE")
cylinder("PROP_OilDrum_Red", (-5.65, 2.85, 0.68), 0.46, 1.28, RED, "PROPS", vertices=32)
cylinder("PROP_OilDrum_Black", (-4.65, 2.85, 0.68), 0.46, 1.28, DARK_STEEL, "PROPS", vertices=32)
for z in (0.23, 0.68, 1.1):
    torus(f"PROP_DrumBand_{z:.2f}", (-5.65, 2.85, z), 0.45, 0.025, CHROME, "PROPS", (0, 0, 0))
box("PROP_CompressorTank", (5.2, 1.18, 0.7), (1.85, 0.75, 0.82), RED, "PROPS", 0.34)
cylinder("PROP_CompressorGauge", (5.2, 0.76, 1.34), 0.16, 0.08, PAPER, "PROPS", (math.pi / 2, 0, 0), 24)
tube("PROP_AirHose", [(5.7, 1.0, 0.7), (6.4, 0.2, 0.35), (5.2, -0.6, 0.2), (4.2, 0.0, 0.24)], 0.035, RED, "PROPS")

# Rooftop silhouette: satellite dish, mesh/Wi-Fi antenna, HVAC and exhaust.
box("ROOF_ServicePad", (-1.8, 5.05, 6.82), (8.8, 1.85, 0.14), CONCRETE_LIGHT, "ROOFTOP", 0.025)
cylinder("ROOF_SatelliteMast", (-4.8, 5.0, 7.65), 0.075, 1.55, STEEL, "ROOFTOP", vertices=20)
sphere("ROOF_SatelliteDish", (-4.8, 4.73, 8.16), (0.82, 0.11, 0.82), WHITE, "ROOFTOP", (math.radians(-28), 0, 0), 28, 14)
torus("ROOF_SatelliteRim", (-4.8, 4.55, 8.28), 0.72, 0.035, STEEL, "ROOFTOP", (math.radians(62), 0, 0))
tube("ROOF_SatelliteFeedArm", [(-4.8, 4.7, 8.05), (-4.8, 4.05, 8.25)], 0.025, DARK_STEEL, "ROOFTOP")
sphere("ROOF_SatelliteReceiver", (-4.8, 4.0, 8.28), (0.09, 0.13, 0.09), RED, "ROOFTOP", segments=16, rings=8)

box("ROOF_RouterRelay", (-3.15, 5.0, 7.15), (0.72, 0.52, 0.28), WHITE, "ROOFTOP", 0.08)
for index, x in enumerate((-3.38, -3.15, -2.92)):
    cylinder(f"ROOF_RelayAntenna_{index}", (x, 5.0, 7.82), 0.035, 1.2, DARK_STEEL, "ROOFTOP", vertices=16)
    sphere(f"ROOF_RelayTip_{index}", (x, 5.0, 8.42), (0.055, 0.055, 0.055), CYAN_GLOW, "ROOFTOP", segments=12, rings=6)

for index, x in enumerate((1.8, 3.55)):
    box(f"ROOF_HVAC_{index}", (x, 5.0, 7.25), (1.35, 1.15, 0.82), STEEL, "ROOFTOP", 0.08)
    torus(f"ROOF_HVACFan_{index}", (x, 4.39, 7.25), 0.31, 0.045, DARK_STEEL, "ROOFTOP", (math.pi / 2, 0, 0))
    for blade in range(4):
        box(f"ROOF_HVACBlade_{index}_{blade}", (x, 4.34, 7.25), (0.5, 0.035, 0.08), DARK_STEEL, "ROOFTOP", 0.015, (0, math.radians(blade * 45), 0))
cylinder("ROOF_ExhaustStack", (5.45, 5.05, 7.72), 0.24, 1.75, STEEL, "ROOFTOP", vertices=24)
cylinder("ROOF_ExhaustCap", (5.45, 5.05, 8.62), 0.38, 0.16, DARK_STEEL, "ROOFTOP", vertices=24)

# Gutter, downpipe, electricity meter and a utility pole with overhead cables.
box("EXT_Gutter", (0.0, -3.26, 6.28), (13.65, 0.18, 0.16), STEEL, "EXTERIOR", 0.025)
cylinder("EXT_Downpipe", (6.54, -3.1, 3.15), 0.075, 6.1, STEEL, "EXTERIOR", vertices=18)
box("EXT_ElectricMeter", (6.45, -3.32, 2.25), (0.52, 0.24, 0.72), CONCRETE_LIGHT, "EXTERIOR", 0.06)
cylinder("EXT_MeterGlass", (6.45, -3.48, 2.38), 0.15, 0.055, GLASS, "EXTERIOR", (math.pi / 2, 0, 0), 24)
cylinder("EXT_UtilityPole", (-8.35, -4.55, 3.7), 0.14, 7.4, WOOD, "EXTERIOR", vertices=20)
box("EXT_UtilityCrossbar", (-8.35, -4.55, 6.75), (1.85, 0.14, 0.16), WOOD, "EXTERIOR", 0.025)
for index, x in enumerate((-8.95, -8.35, -7.75)):
    cylinder(f"EXT_Insulator_{index}", (x, -4.85, 6.95), 0.075, 0.28, GLASS, "EXTERIOR", vertices=16)
    tube(f"EXT_PowerCable_{index}", [(x, -4.55, 7.05), (x + 0.7, -0.8, 6.8), (-5.7 + index * 0.25, 5.9, 7.3)], 0.022, BLACK, "EXTERIOR")

# Exterior hangout/service details: vending machine, bench, tyres, barrels and cones.
box("EXT_VendingMachine", (5.9, -4.35, 1.15), (1.18, 0.85, 2.3), RED, "EXTERIOR", 0.11)
box("EXT_VendingGlass", (5.9, -4.81, 1.42), (0.86, 0.04, 1.38), GLASS, "EXTERIOR", 0.04)
for row in range(3):
    for col in range(3):
        cylinder(f"EXT_VendingCan_{row}_{col}", (5.64 + col * 0.26, -4.86, 1.82 - row * 0.36), 0.075, 0.16, RED if (row + col) % 2 == 0 else CYAN_GLOW, "EXTERIOR", (math.pi / 2, 0, 0), 12)
box("EXT_VendingPanel", (6.3, -4.82, 1.33), (0.18, 0.03, 0.48), BLACK, "EXTERIOR", 0.025)
box("EXT_VendingGlow", (6.3, -4.85, 1.48), (0.1, 0.015, 0.12), GREEN_GLOW, "EXTERIOR", 0.01)

for index in range(3):
    torus(f"EXT_TireStack_{index}", (-5.9, -4.15, 0.32 + index * 0.36), 0.34, 0.13, BLACK, "EXTERIOR", (0, 0, 0))
cylinder("EXT_ServiceDrum", (-4.85, -4.25, 0.65), 0.43, 1.2, RED, "EXTERIOR", vertices=28)
for index, x in enumerate((-3.75, -2.75, 1.55)):
    cylinder(f"EXT_TrafficCone_{index}", (x, -4.7 + (index % 2) * 0.45, 0.34), 0.25, 0.62, ORANGE, "EXTERIOR", vertices=20)
    box(f"EXT_ConeBase_{index}", (x, -4.7 + (index % 2) * 0.45, 0.06), (0.62, 0.62, 0.1), DARK_STEEL, "EXTERIOR", 0.035)

# Fire safety, wall clock, licence plates and ventilation bring lived-in detail.
cylinder("PROP_FireExtinguisher", (6.28, 5.7, 1.2), 0.18, 0.85, RED, "PROPS", vertices=24)
tube("PROP_FireHose", [(6.28, 5.7, 1.55), (6.1, 5.52, 1.72), (6.35, 5.35, 1.82)], 0.025, BLACK, "PROPS")
box("PROP_FirstAid", (5.45, 6.01, 4.45), (0.78, 0.16, 0.62), WHITE, "PROPS", 0.06)
box("PROP_FirstAidH", (5.45, 5.91, 4.45), (0.46, 0.035, 0.12), GREEN_GLOW, "PROPS", 0.01)
box("PROP_FirstAidV", (5.45, 5.91, 4.45), (0.12, 0.035, 0.46), GREEN_GLOW, "PROPS", 0.01)
cylinder("PROP_WallClock", (-6.12, 5.98, 4.95), 0.36, 0.08, PAPER, "PROPS", (math.pi / 2, 0, 0), 28)
for angle in range(0, 360, 30):
    rad = math.radians(angle)
    box(f"PROP_ClockTick_{angle}", (-6.12 + math.sin(rad) * 0.27, 5.91, 4.95 + math.cos(rad) * 0.27), (0.025, 0.02, 0.07), BLACK, "PROPS", 0.005, (0, rad, 0))
box("PROP_ClockHandHour", (-6.12, 5.88, 5.05), (0.025, 0.02, 0.22), BLACK, "PROPS", 0.005, (0, 0, -0.32))
box("PROP_ClockHandMinute", (-6.02, 5.88, 4.95), (0.24, 0.02, 0.025), RED, "PROPS", 0.005, (0, 0, 0.22))
for index, (x, label) in enumerate(((-1.1, "WEB 3D"), (0.0, "REACT"), (1.1, "NEXT JS"))):
    box(f"PROP_Plate_{index}", (x, 6.0, 2.35), (0.9, 0.08, 0.32), PAPER if index != 1 else YELLOW, "PROPS", 0.03)
    text_object(f"PROP_PlateText_{index}", label, (x, 5.94, 2.35), 0.11, BLACK, "SIGNAGE")
torus("PROP_ExhaustFanRing", (-6.72, 3.95, 4.75), 0.56, 0.07, STEEL, "PROPS", (0, math.pi / 2, 0))
for blade in range(4):
    box(f"PROP_ExhaustBlade_{blade}", (-6.62, 3.95, 4.75), (0.08, 0.82, 0.18), DARK_STEEL, "PROPS", 0.04, (math.radians(blade * 45), 0, 0))

# About, experience and contact hotspots integrated as garage objects.
box("INT_Certificate_About", (1.45, 6.08, 3.45), (2.4, 0.12, 1.55), PAPER, "INTERACTIVE_OBJECTS", 0.05)
box("INT_ServiceBoard_Experience", (3.65, 6.08, 4.32), (1.55, 0.12, 1.05), DARK_STEEL, "INTERACTIVE_OBJECTS", 0.04)
for i in range(3):
    box(f"SIGN_JobCard_{i}", (3.65, 5.99, 4.58 - i * 0.3), (1.28, 0.02, 0.18), PAPER if i != 1 else YELLOW, "SIGNAGE", 0.01)
box("INT_Intercom_Contact", (6.25, 6.02, 4.35), (0.55, 0.18, 0.82), RED, "INTERACTIVE_OBJECTS", 0.08)
cylinder("SIGN_IntercomSpeaker", (6.25, 5.9, 4.52), 0.17, 0.05, BLACK, "SIGNAGE", (math.pi / 2, 0, 0), 24)

# Main sign and garage UI labels.
box("INT_GarageSign_Home", (0.0, 6.0, 5.35), (6.9, 0.18, 0.95), DARK_STEEL, "INTERACTIVE_OBJECTS", 0.08)
text_object("SIGN_Main", "STEFANO MOTOR WORKS", (0.0, 5.86, 5.47), 0.52, RED_GLOW)
text_object("SIGN_Sub", "DIGITAL CRAFT  /  DEVELOPMENT  /  3D", (0.0, 5.84, 5.08), 0.16, PAPER)
text_object("SIGN_About", "ABOUT", (1.45, 5.95, 3.45), 0.24, DARK_STEEL)
text_object("SIGN_Experience", "SERVICE LOG", (3.65, 5.94, 4.77), 0.18, PAPER)
text_object("SIGN_Contact", "CONTACT", (6.25, 5.89, 3.84), 0.13, PAPER)

# The added technology lives on the exterior, like the layered fixtures and
# signs on the Ramen Shop reference. The mechanic bay stays readable inside;
# the right façade becomes Stefano's digital display wall.
box("EXT_TechWall", (7.04, 4.35, 3.25), (0.16, 4.45, 4.9), DARK_STEEL, "EXTERIOR", 0.035)
box("EXT_TechWallRedRail", (7.16, 4.35, 5.55), (0.08, 4.12, 0.12), RED_GLOW, "EXTERIOR", 0.02)
for index, z in enumerate((1.2, 2.65, 4.15)):
    box(f"EXT_TechShelf_{index}", (7.48, 4.4, z), (0.82, 4.0, 0.12), STEEL, "EXTERIOR", 0.035)
text_object("EXT_TechWallTitle", "DIGITAL PARTS / OPEN 24H", (7.18, 4.35, 5.15), 0.18, PAPER, "SIGNAGE", (math.pi / 2, 0, math.pi / 2))
torus("EXT_WifiHalo", (7.19, 5.65, 4.75), 0.42, 0.045, CYAN_GLOW, "EXTERIOR", (0, math.pi / 2, 0))
box("EXT_FrontTechPanel_Mobile", (2.8, -3.17, 3.2), (1.35, 0.12, 2.15), STEEL, "EXTERIOR", 0.035)
box("EXT_FrontTechPanel_Router", (4.35, -3.17, 3.85), (1.35, 0.12, 1.25), STEEL, "EXTERIOR", 0.035)
box("EXT_FrontTechPanel_Console", (5.82, -3.17, 3.2), (1.35, 0.12, 2.15), STEEL, "EXTERIOR", 0.035)
box("EXT_FrontTechDisplayRail", (4.35, -3.29, 1.82), (4.45, 0.08, 0.1), RED_GLOW, "EXTERIOR", 0.02)
for x in (2.75, 4.35, 5.95):
    box(f"EXT_FrontDisplayShelf_{x:.2f}", (x, -3.55, 2.4), (1.25, 0.68, 0.1), STEEL, "EXTERIOR", 0.03)
text_object("EXT_FrontTechTitle", "WIFI / MOBILE / CONSOLE", (4.35, -3.3, 4.48), 0.17, CYAN_GLOW, "SIGNAGE")
text_object("EXT_MacBookName", "MACBOOK AIR", (2.8, -3.3, 3.98), 0.105, PAPER, "SIGNAGE")
text_object("EXT_RouterName", "WIFI ROUTER", (4.35, -3.3, 4.27), 0.105, CYAN_GLOW, "SIGNAGE")
text_object("EXT_ConsoleName", "PLAYSTATION", (5.82, -3.3, 3.98), 0.105, PAPER, "SIGNAGE")

workstation_parts = [
    obj
    for obj in bpy.data.objects
    if obj.name.startswith("WORK_") or obj.name == "INT_Monitor_Projects"
]
transform_group(
    "EXT_Display_Workstation",
    workstation_parts,
    (4.0, 4.72, 0.0),
    (7.35, 4.25, 0.25),
    math.pi / 2,
)

transform_group(
    "EXT_Display_MacBookAir",
    [obj for obj in bpy.data.objects if obj.name.startswith("TECH_MacBook")],
    (2.92, 4.1, 1.65),
    (2.8, -3.55, 2.95),
)
transform_group(
    "EXT_Display_WifiRouter",
    [
        obj
        for obj in bpy.data.objects
        if obj.name.startswith("TECH_Router")
        or obj.name == "TECH_WifiLabel"
        or obj.name == "INT_Router_Network"
    ],
    (3.05, 5.6, 3.2),
    (4.35, -3.55, 3.85),
)
transform_group(
    "EXT_Display_GameConsole",
    [
        obj
        for obj in bpy.data.objects
        if obj.name.startswith("TECH_Console")
        or obj.name.startswith("TECH_Controller")
        or obj.name == "INT_PlayStation_Projects"
    ],
    (5.4, 4.0, 1.7),
    (5.82, -3.55, 2.95),
)
transform_group(
    "EXT_Display_Radio",
    [obj for obj in bpy.data.objects if obj.name.startswith("TECH_Radio")],
    (4.4, 5.25, 3.55),
    (5.82, -3.55, 4.05),
)
transform_group(
    "EXT_ArcadeCabinet",
    [
        obj
        for obj in bpy.data.objects
        if obj.name.startswith("TECH_Arcade") or obj.name == "INT_Arcade_Playground"
    ],
    (5.25, 2.3, 0.0),
    (5.25, -4.25, 0.0),
)
transform_group(
    "EXT_GamingLounge",
    [
        obj
        for obj in bpy.data.objects
        if obj.name.startswith("TECH_Sofa")
        or obj.name.startswith("TECH_LowTable")
        or obj.name == "TECH_Headphones"
    ],
    (3.55, 2.3, 0.0),
    (3.45, -4.45, 0.0),
)
transform_group(
    "EXT_VendingRelocated",
    [obj for obj in bpy.data.objects if obj.name.startswith("EXT_Vending")],
    (5.9, -4.35, 0.0),
    (-7.15, -4.35, 0.0),
)

# Ceiling fixtures and task lights.
for index, x in enumerate((-4.3, 0.0, 4.3)):
    box(f"LIGHT_Fixture_{index}", (x, 1.0, 5.92), (2.6, 0.34, 0.12), DARK_STEEL, "LIGHTS", 0.03)
    box(f"LIGHT_Tube_{index}", (x, 0.95, 5.84), (2.25, 0.18, 0.055), WHITE_GLOW, "LIGHTS", 0.02)
    area_light(f"LIGHT_Area_{index}", (x, 1.0, 5.72), 700, (0.58, 0.72, 1.0), 3.2, (0, 0, 0))
point_light("LIGHT_SignGlow", (0.0, 4.9, 5.3), 650, (1.0, 0.025, 0.02), 0.5)
point_light("LIGHT_MonitorGlow", (4.0, 3.85, 2.25), 420, (0.04, 0.27, 1.0), 0.35)
point_light("LIGHT_InspectionWarm", (-0.1, -0.35, 2.4), 520, (1.0, 0.22, 0.055), 0.3)
tube("PROP_InspectionCable", [(0.5, 5.8, 5.8), (0.2, 3.8, 4.4), (-0.1, 1.7, 3.2), (-0.1, -0.35, 2.42)], 0.018, BLACK, "PROPS")
cylinder("PROP_InspectionLamp", (-0.1, -0.35, 2.42), 0.19, 0.18, WARM_GLOW, "PROPS", (math.pi / 2, 0, 0), 24)

# Camera and world.
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1400
scene.render.resolution_y = 850
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = PREVIEW_OUT
scene.render.film_transparent = False
scene.render.image_settings.color_mode = "RGBA"
scene.render.resolution_percentage = 100
scene.world.use_nodes = True
world_shader = scene.world.node_tree.nodes.get("Background")
world_shader.inputs["Color"].default_value = (0.003, 0.006, 0.012, 1)
world_shader.inputs["Strength"].default_value = 0.2

camera_data = bpy.data.cameras.new("CAM_Hero")
camera_data.lens = 52
camera_data.sensor_width = 36
camera = bpy.data.objects.new("CAM_Hero", camera_data)
camera.location = (17.2, -24.4, 13.1)
look_at(camera, (-0.25, 0.85, 2.7))
use_collection("LIGHTS").objects.link(camera)
scene.camera = camera

area_light("LIGHT_Key", (3.0, -5.0, 9.5), 1250, (0.62, 0.74, 1.0), 6.5, (math.radians(20), 0, math.radians(20)))
look_at(bpy.context.scene.objects["LIGHT_Key"], (-1.0, 1.0, 1.2))
area_light("LIGHT_Fill", (-8.0, -2.0, 5.5), 850, (1.0, 0.2, 0.08), 5.0)
look_at(bpy.context.scene.objects["LIGHT_Fill"], (-1.4, 1.0, 1.3))

# Camera-facing viewport so the open Blender window shows the finished scene.
for area in bpy.context.screen.areas:
    if area.type == "VIEW_3D":
        area.spaces.active.region_3d.view_perspective = "CAMERA"
        area.spaces.active.shading.type = "MATERIAL"

# Convert text so it exports consistently to glTF.
for obj in list(bpy.data.objects):
    if obj.type == "FONT":
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.convert(target="MESH")
        obj.select_set(False)

os.makedirs(os.path.dirname(BLEND_OUT), exist_ok=True)
os.makedirs(os.path.dirname(GLB_OUT), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
bpy.ops.export_scene.gltf(
    filepath=GLB_OUT,
    export_format="GLB",
    export_apply=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
)
bpy.ops.render.render(write_still=True)

mesh_count = sum(1 for obj in bpy.data.objects if obj.type == "MESH")
triangle_count = sum(
    len(obj.data.loop_triangles) if (obj.data.calc_loop_triangles() is None) else len(obj.data.loop_triangles)
    for obj in bpy.data.objects
    if obj.type == "MESH"
)
result = {
    "status": "garage_created",
    "blend": BLEND_OUT,
    "glb": GLB_OUT,
    "preview": PREVIEW_OUT,
    "objects": len(bpy.data.objects),
    "meshes": mesh_count,
    "triangles": triangle_count,
}
