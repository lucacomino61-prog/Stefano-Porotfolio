"""Build Stefano Motor Works as a compact web-ready Blender diorama."""

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

# Architectural shell.
box("ARCH_Floor", (0.0, 1.5, -0.18), (14.0, 10.0, 0.36), CONCRETE, "GARAGE_ARCHITECTURE", 0.08)
box("ARCH_BackWall", (0.0, 6.35, 3.15), (14.0, 0.28, 6.7), CONCRETE_LIGHT, "GARAGE_ARCHITECTURE", 0.03)
box("ARCH_LeftWall", (-6.85, 1.8, 3.15), (0.3, 9.2, 6.7), CONCRETE, "GARAGE_ARCHITECTURE", 0.03)
box("ARCH_RightReturn", (6.85, 4.55, 3.15), (0.3, 3.9, 6.7), CONCRETE, "GARAGE_ARCHITECTURE", 0.03)
box("ARCH_RoofBeamFront", (0.0, -3.22, 6.32), (14.1, 0.34, 0.34), DARK_STEEL, "GARAGE_ARCHITECTURE", 0.04)
box("ARCH_RoofBeamBack", (0.0, 6.1, 6.32), (14.1, 0.28, 0.34), DARK_STEEL, "GARAGE_ARCHITECTURE", 0.04)
for x in (-6.3, -2.1, 2.1, 6.3):
    box(f"ARCH_CeilingRail_{x:+.1f}", (x, 1.5, 6.15), (0.18, 9.1, 0.18), STEEL, "GARAGE_ARCHITECTURE", 0.02)

# Open roller-door frame and slatted door rolled above the opening.
box("ARCH_DoorPost_L", (-4.9, -3.05, 3.0), (0.34, 0.34, 6.0), DARK_STEEL, "GARAGE_ARCHITECTURE", 0.03)
box("ARCH_DoorPost_R", (1.8, -3.05, 3.0), (0.34, 0.34, 6.0), DARK_STEEL, "GARAGE_ARCHITECTURE", 0.03)
box("ARCH_DoorHeader", (-1.55, -3.05, 5.88), (7.05, 0.4, 0.38), DARK_STEEL, "GARAGE_ARCHITECTURE", 0.03)
for i in range(5):
    box(f"ARCH_RollerSlat_{i:02d}", (-1.55, -2.9, 5.52 - i * 0.16), (6.58, 0.1, 0.12), STEEL, "GARAGE_ARCHITECTURE", 0.018)

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
camera_data.lens = 48
camera_data.sensor_width = 36
camera = bpy.data.objects.new("CAM_Hero", camera_data)
camera.location = (13.0, -15.5, 10.2)
look_at(camera, (-0.1, 1.45, 2.05))
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
