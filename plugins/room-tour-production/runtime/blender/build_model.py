"""Build a measured, editable interior from the public room-tour plan contract.

This implementation and its procedural texture pixels are original. No customer
plans, private catalogue assets, downloaded meshes or external images are used.
Run with Blender: --background --python build_model.py -- --plan plan.json --out out
"""

import argparse
import json
import math
import random
import sys
from collections import Counter
from pathlib import Path

import bpy
from mathutils import Vector


GLTF_DOC = "https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html"
CYCLES_DOC = "https://docs.blender.org/manual/en/latest/render/cycles/render_settings/sampling.html"
EPS = 1e-6


def strip_png_metadata(path):
    """Keep original PNG pixels/color chunks while removing local render metadata."""
    data = Path(path).read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("Expected PNG preview")
    cleaned = bytearray(data[:8])
    offset = 8
    while offset < len(data):
        length = int.from_bytes(data[offset:offset + 4], "big")
        end = offset + 12 + length
        if end > len(data):
            raise ValueError("Truncated PNG preview")
        kind = data[offset + 4:offset + 8]
        if kind not in (b"tEXt", b"zTXt", b"iTXt", b"eXIf"):
            cleaned.extend(data[offset:end])
        offset = end
    Path(path).write_bytes(cleaned)


def arguments():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--render", action="store_true")
    return parser.parse_args(argv)


def inside(point, polygon):
    x, z = point
    result = False
    previous = polygon[-1]
    for current in polygon:
        ax, az = previous
        bx, bz = current
        if (az > z) != (bz > z) and x < (bx - ax) * (z - az) / (bz - az) + ax:
            result = not result
        previous = current
    return result


def stair_rectangle(stair, margin=0.10):
    a, b = stair["start"], stair["end"]
    half = stair["width"] / 2 + margin
    if abs(a[0] - b[0]) < EPS:
        return (a[0] - half, min(a[1], b[1]) - margin,
                a[0] + half, max(a[1], b[1]) + margin)
    return (min(a[0], b[0]) - margin, a[1] - half,
            max(a[0], b[0]) + margin, a[1] + half)


def generated_image(name, kind, size=512):
    """Generate portable PNG pixels; Blender-only shader noise is not exported."""
    image = bpy.data.images.new(name, width=size, height=size, alpha=False)
    image.file_format = "PNG"
    image.colorspace_settings.name = "sRGB"
    rng = random.Random(318 if kind in ("wood", "grain") else 627)
    pixels = []
    for y in range(size):
        for x in range(size):
            u, v = x / size, y / size
            noise = (rng.random() - 0.5) * 0.032
            if kind in ("wood", "grain"):
                plank = int(v * 6)
                # Grain follows the long board axis U. Small longitudinal drift
                # keeps it organic while V supplies the main fine variation.
                grain = math.sin(v * 155 + math.sin(u * 9) * 1.6)
                fine = math.sin(v * 720 + math.sin(u * 17 + v * 20) * 2.7)
                # The UV repeat is 3 x 1.5 metres: six rows of .25m boards,
                # with 1m end joints staggered between successive rows.
                end_phase = (u * 3 + (plank % 3) / 3.0) % 1
                joint = kind == "wood" and ((v * 6 % 1 < 0.008) or min(end_phase, 1 - end_phase) < 0.003)
                row_shade = (plank % 3 - 1) * 0.022 if kind == "wood" else 0.0
                shade = row_shade + grain * 0.017 + fine * 0.009 + noise * 0.55
                shade -= 0.13 if joint else 0.0
                color = (0.68 + shade, 0.48 + shade * 0.82, 0.29 + shade * 0.56)
            elif kind == "tile":
                grout = (u * 4 % 1 < 0.028) or (v * 4 % 1 < 0.028)
                base = 0.59 if grout else 0.85 + noise
                color = (base, base * 0.985, base * 0.955)
            else:
                weave = (math.sin(x * math.pi / 2) + math.sin(y * math.pi / 2)) * 0.018
                base = 0.75 + weave + noise
                color = (base, base * 0.955, base * 0.90)
            pixels.extend((*[max(0.0, min(1.0, c)) for c in color], 1.0))
    image.pixels.foreach_set(pixels)
    image.update()
    image.pack()
    return image


def material(name, color, roughness, metallic=0.0, image=None, alpha=1.0, transmission=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, alpha)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, alpha)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Alpha"].default_value = alpha
    bsdf.inputs["Transmission Weight"].default_value = transmission
    if alpha < 1:
        mat.surface_render_method = "DITHERED"
    if image is not None:
        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = image
        tex.extension = "REPEAT"
        mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def palette():
    wood = generated_image("Original oak boards", "wood")
    grain = generated_image("Original unjointed oak grain", "grain")
    tile = generated_image("Original ceramic tiles", "tile")
    cloth = generated_image("Original linen weave", "cloth")
    return {
        "wall": material("Warm plaster", (0.89, 0.88, 0.83), 0.83),
        "trim": material("Painted joinery", (0.84, 0.81, 0.72), 0.47),
        "wood": material("UV oak", (1, 1, 1), 0.48, image=wood),
        "grain": material("UV joinery oak", (1, 1, 1), 0.43, image=grain),
        "tile": material("UV ceramic", (1, 1, 1), 0.35, image=tile),
        "cloth": material("UV linen", (1, 1, 1), 0.91, image=cloth),
        "upholstery": material("Sage upholstery", (0.28, 0.37, 0.31), 0.95),
        "ceramic": material("Sanitary porcelain", (0.91, 0.93, 0.92), 0.19),
        "metal": material("Brushed steel", (0.55, 0.59, 0.61), 0.24, 0.90),
        "dark": material("Dark hardware", (0.037, 0.043, 0.048), 0.28, 0.65),
        "quartz": material("Warm quartz", (0.80, 0.80, 0.76), 0.25),
        "glass": material("Clear glazing", (0.79, 0.91, 0.94), 0.09, alpha=0.24, transmission=0.70),
        "water": material("Water", (0.33, 0.66, 0.73), 0.10, alpha=0.76, transmission=0.30),
    }


def tags(obj, floor_id, role, **extra):
    obj["floorId"] = str(floor_id)
    obj["modelRole"] = role
    for key, value in extra.items():
        obj[key] = value
    return obj


def finish(obj, mat, bevel=0.0):
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("Manufactured edge rounding", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        modifier.affect = "EDGES"
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    if obj.type == "MESH":
        for face in obj.data.polygons:
            face.use_smooth = len(face.vertices) > 4 or (bevel > 0 and len(face.vertices) == 4 and face.area < bevel * bevel * 20)
        # Dominant-axis projection uses metres rather than stretching every surface.
        # Floor UV scale is 3m x 1.5m, furniture also preserves physical grain size.
        uv = obj.data.uv_layers.get("UVMap") or obj.data.uv_layers.new(name="UVMap")
        for face in obj.data.polygons:
            axis = max(range(3), key=lambda index: abs(face.normal[index]))
            for loop_index in face.loop_indices:
                vertex = obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
                if axis == 2:
                    uv.data[loop_index].uv = (vertex.x / 3.0, vertex.y / 1.5)
                elif axis == 1:
                    uv.data[loop_index].uv = (vertex.x / 1.5, vertex.z / 3.0)
                else:
                    uv.data[loop_index].uv = (vertex.y / 1.5, vertex.z / 3.0)
    return obj


def cube(name, center, size, mat, floor_id, role, rotation=0, bevel=0.006, **extra):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(center[0], -center[1], center[2]))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler.z = -rotation
    finish(obj, mat, min(bevel, min(size) * 0.24))
    return tags(obj, floor_id, role, **extra)


def sphere(name, center, size, mat, floor_id, role, rotation=0, **extra):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.5,
                                       location=(center[0], -center[1], center[2]))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler.z = -rotation
    finish(obj, mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return tags(obj, floor_id, role, **extra)


def cylinder_between(name, a, b, radius, mat, floor_id, role, **extra):
    start, end = Vector((a[0], -a[1], a[2])), Vector((b[0], -b[1], b[2]))
    delta = end - start
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=radius, depth=delta.length,
                                       location=(start + end) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    finish(obj, mat, min(0.004, radius * 0.2))
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    return tags(obj, floor_id, role, **extra)


def ring(name, center, radii, minor, mat, floor_id, role, **extra):
    bpy.ops.mesh.primitive_torus_add(major_radius=1, minor_radius=minor / max(radii),
                                   major_segments=40, minor_segments=10,
                                   location=(center[0], -center[1], center[2]))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (radii[0], radii[1], max(radii))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(obj, mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return tags(obj, floor_id, role, **extra)


def slab(name, polygon, holes, elevation, thickness, mat, floor_id, role, **extra):
    """Exact orthogonal polygon subtraction, without fragile Boolean modifiers.

    Every polygon/hole coordinate partitions the grid. A cell can never straddle
    an edge, so testing its centre determines the entire cell. Exterior sides and
    the stair opening reveal are generated only where a neighbour is absent.
    """
    xs = sorted(set([p[0] for p in polygon] + [v for hole in holes for v in (hole[0], hole[2])]))
    zs = sorted(set([p[1] for p in polygon] + [v for hole in holes for v in (hole[1], hole[3])]))
    occupied = set()
    for i in range(len(xs) - 1):
        for j in range(len(zs) - 1):
            point = ((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2)
            if inside(point, polygon) and not any(a < point[0] < c and b < point[1] < d for a, b, c, d in holes):
                occupied.add((i, j))
    vertices, faces = [], []

    def quad(points):
        index = len(vertices)
        vertices.extend((x, -z, y) for x, z, y in points)
        faces.append(tuple(range(index, index + 4)))

    low, high = elevation - thickness, elevation
    for i, j in occupied:
        a, b, c, d = xs[i], zs[j], xs[i + 1], zs[j + 1]
        quad([(a, b, high), (a, d, high), (c, d, high), (c, b, high)])
        quad([(a, b, low), (c, b, low), (c, d, low), (a, d, low)])
        if (i - 1, j) not in occupied:
            quad([(a, b, low), (a, d, low), (a, d, high), (a, b, high)])
        if (i + 1, j) not in occupied:
            quad([(c, d, low), (c, b, low), (c, b, high), (c, d, high)])
        if (i, j - 1) not in occupied:
            quad([(c, b, low), (a, b, low), (a, b, high), (c, b, high)])
        if (i, j + 1) not in occupied:
            quad([(a, d, low), (c, d, low), (c, d, high), (a, d, high)])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    finish(obj, mat)
    return tags(obj, floor_id, role, **extra)


def wall_point(wall, offset, side=0):
    a, b = wall["start"], wall["end"]
    length = math.dist(a, b)
    dx, dz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
    return (a[0] + dx * offset - dz * side, a[1] + dz * offset + dx * side)


def wall_box(name, wall, offset, length, side, depth, bottom, height, mat, floor, role, bevel=0.006, **extra):
    point = wall_point(wall, offset, side)
    angle = math.atan2(wall["end"][1] - wall["start"][1], wall["end"][0] - wall["start"][0])
    return cube(name, (*point, floor["elevation"] + bottom + height / 2),
                (length, depth, height), mat, floor["id"], role, rotation=angle, bevel=bevel, **extra)


def build_wall(floor, wall, mats):
    length = math.dist(wall["start"], wall["end"])
    openings = wall.get("openings", [])
    xs = sorted(set([0, length] + [v for opening in openings for v in
                    (opening["offset"], opening["offset"] + opening["width"])]))
    ys = sorted(set([0, floor["wallHeight"]] + [v for opening in openings for v in
                    (opening.get("bottom", 0), opening.get("bottom", 0) + opening["height"])]))
    for i, (a, b) in enumerate(zip(xs, xs[1:])):
        for j, (low, high) in enumerate(zip(ys, ys[1:])):
            middle, height = (a + b) / 2, (low + high) / 2
            if any(o["offset"] < middle < o["offset"] + o["width"] and
                   o.get("bottom", 0) < height < o.get("bottom", 0) + o["height"] for o in openings):
                continue
            wall_box(f"wall:{wall['id']}:{i}:{j}", wall, middle, b - a, 0, wall["thickness"],
                     low, high - low, mats["wall"], floor, "wall", bevel=0, wallId=wall["id"])
        if not any(o["kind"] == "door" and o.get("bottom", 0) < 0.07 and
                   o["offset"] < (a + b) / 2 < o["offset"] + o["width"] for o in openings):
            for sign in (-1, 1):
                wall_box(f"skirting:{wall['id']}:{i}:{sign}", wall, (a + b) / 2, b - a,
                         sign * (wall["thickness"] / 2 + 0.008), 0.016, 0.002, 0.075,
                         mats["trim"], floor, "trim", wallId=wall["id"])
    for opening in openings:
        build_opening(floor, wall, opening, mats)


def build_opening(floor, wall, opening, mats):
    oid, left, width = opening["id"], opening["offset"], opening["width"]
    bottom, height = opening.get("bottom", 0), opening["height"]
    depth = wall["thickness"] + 0.034
    for label, offset in (("left", left + 0.024), ("right", left + width - 0.024)):
        wall_box(f"frame:{oid}:{label}", wall, offset, 0.048, 0, depth,
                 bottom, height, mats["trim"], floor, "trim")
    wall_box(f"frame:{oid}:head", wall, left + width / 2, width, 0, depth,
             bottom + height - 0.048, 0.048, mats["trim"], floor, "trim")
    for sign in (-1, 1):
        for label, offset in (("left", left - 0.02), ("right", left + width + 0.02)):
            wall_box(f"architrave:{oid}:{label}:{sign}", wall, offset, 0.055,
                     sign * (depth / 2 + 0.006), 0.017, bottom, height + 0.07,
                     mats["trim"], floor, "trim")
        wall_box(f"architrave:{oid}:head:{sign}", wall, left + width / 2, width + 0.095,
                 sign * (depth / 2 + 0.006), 0.017, bottom + height + 0.014, 0.056,
                 mats["trim"], floor, "trim")
    if opening["kind"] == "window":
        wall_box(f"frame:{oid}:sill", wall, left + width / 2, width, 0, depth + 0.055,
                 bottom, 0.042, mats["trim"], floor, "trim")
        wall_box(f"window:{oid}:mullion", wall, left + width / 2, 0.036, 0, 0.054,
                 bottom + 0.04, height - 0.08, mats["metal"], floor, "window", openingId=oid)
        for index in range(2):
            pane_width = (width - 0.13) / 2
            wall_box(f"window:{oid}:glass:{index}", wall,
                     left + 0.048 + pane_width / 2 + index * (pane_width + 0.034),
                     pane_width, 0, 0.009, bottom + 0.044, height - 0.091,
                     mats["glass"], floor, "window", openingId=oid)
        return
    sliding = opening.get("operation", "hinged") == "sliding"
    side = wall["thickness"] / 2 + 0.040 if sliding else 0
    wall_box(f"door:{oid}:leaf", wall, left + width / 2, width - 0.08, side, 0.043,
             bottom + 0.015, height - 0.066, mats["grain"], floor, "door", openingId=oid)
    for sign in (-1, 1):
        for panel_index in range(2):
            wall_box(f"door:{oid}:panel:{sign}:{panel_index}", wall, left + width / 2,
                     width - 0.25, side + sign * 0.025, 0.007,
                     bottom + 0.17 + panel_index * (height * 0.43), height * 0.36,
                     mats["grain"], floor, "door", openingId=oid)
    handle_offset = left + (0.13 if opening.get("hinge", "start") == "end" else width - 0.13)
    for sign in (-1, 1):
        wall_box(f"door:{oid}:escutcheon:{sign}", wall, handle_offset, 0.043,
                 side + sign * 0.031, 0.018, bottom + 0.93, 0.075,
                 mats["metal"], floor, "door", openingId=oid)
        wall_box(f"door:{oid}:handle:{sign}", wall, handle_offset - 0.032, 0.105,
                 side + sign * 0.055, 0.025, bottom + 0.956, 0.027,
                 mats["metal"], floor, "door", openingId=oid)
    if sliding:
        direction = opening.get("slide", 1)
        wall_box(f"sliding-rail:{oid}", wall, left + width / 2 + direction * width / 2,
                 width * 2, side, 0.046, bottom + height + 0.05, 0.037,
                 mats["dark"], floor, "trim")
    else:
        hinge_offset = left + (width - 0.024 if opening.get("hinge", "start") == "end" else 0.024)
        point = wall_point(wall, hinge_offset, wall["thickness"] / 2 * opening.get("swing", 1))
        for index, level in enumerate((0.22, height - 0.32)):
            cylinder_between(f"door:{oid}:hinge:{index}",
                             (*point, floor["elevation"] + bottom + level),
                             (*point, floor["elevation"] + bottom + level + 0.10),
                             0.010, mats["metal"], floor["id"], "door", openingId=oid)


class FixtureParts:
    def __init__(self, floor, fixture, mats):
        self.floor, self.fixture = floor, fixture
        # Furniture has continuous timber faces instead of floorboard joints.
        self.mats = {**mats, "wood": mats["grain"]}
        self.width, self.depth, self.height = fixture["size"]
        self.rotation = fixture.get("rotation", 0)
        self.index = 0

    def point(self, point):
        x, z, y = point
        cosine, sine = math.cos(self.rotation), math.sin(self.rotation)
        return (self.fixture["position"][0] + x * cosine - z * sine,
                self.fixture["position"][1] + x * sine + z * cosine,
                self.floor["elevation"] + y)

    def name(self, label):
        self.index += 1
        return f"fixture:{self.fixture['id']}:{label}:{self.index}"

    def box(self, label, point, size, material_key, bevel=0.008):
        return cube(self.name(label), self.point(point), size, self.mats[material_key],
                    self.floor["id"], "fixture", self.rotation, bevel,
                    fixtureId=self.fixture["id"], fixtureType=self.fixture["type"])

    def orb(self, label, point, size, material_key):
        return sphere(self.name(label), self.point(point), size, self.mats[material_key],
                      self.floor["id"], "fixture", self.rotation,
                      fixtureId=self.fixture["id"], fixtureType=self.fixture["type"])

    def pipe(self, label, a, b, radius, material_key="metal"):
        return cylinder_between(self.name(label), self.point(a), self.point(b), radius,
                                self.mats[material_key], self.floor["id"], "fixture",
                                fixtureId=self.fixture["id"], fixtureType=self.fixture["type"])

    def ring(self, label, point, radii, minor, material_key="ceramic"):
        obj = ring(self.name(label), self.point(point), radii, minor, self.mats[material_key],
                   self.floor["id"], "fixture", fixtureId=self.fixture["id"],
                   fixtureType=self.fixture["type"])
        obj.rotation_euler.z = -self.rotation
        return obj


def feet(parts, top, material_key="wood", radius=0.025):
    for x in (-parts.width * 0.40, parts.width * 0.40):
        for z in (-parts.depth * 0.36, parts.depth * 0.36):
            parts.pipe("foot", (x, z, 0.025), (x, z, top), radius, material_key)


def faucet(parts, x, z, bottom, scale=1):
    top = bottom + 0.24 * scale
    parts.pipe("tap-stem", (x, z, bottom), (x, z, top), 0.018 * scale)
    parts.pipe("tap-spout", (x, z, top), (x, z - 0.18 * scale, top), 0.018 * scale)
    parts.pipe("tap-outlet", (x, z - 0.18 * scale, top),
               (x, z - 0.18 * scale, top - 0.045 * scale), 0.018 * scale)
    parts.box("tap-lever", (x + 0.035 * scale, z, bottom + 0.08 * scale),
              (0.08 * scale, 0.025 * scale, 0.018 * scale), "metal")


def recessed_bowl(parts, x, z, width, depth, top, drop, material_key):
    wall = 0.022
    parts.box("bowl-bottom", (x, z, top - drop), (width, depth, wall), material_key, 0.01)
    for side in (-1, 1):
        parts.box("bowl-side", (x + side * width / 2, z, top - drop / 2),
                  (wall, depth, drop), material_key, 0.01)
        parts.box("bowl-side", (x, z + side * depth / 2, top - drop / 2),
                  (width, wall, drop), material_key, 0.01)
    parts.ring("drain", (x, z, top - drop + wall), (0.021, 0.021), 0.004, "metal")


def build_fixture(floor, fixture, mats):
    p = FixtureParts(floor, fixture, mats)
    w, d, h = p.width, p.depth, p.height
    kind = fixture["type"]
    if kind == "sofa":
        feet(p, h * 0.16, "wood", 0.022)
        p.box("base", (0, 0, h * 0.25), (w * 0.92, d * 0.91, h * 0.23), "upholstery", 0.036)
        count = max(2, round(w / 0.7))
        for index in range(count):
            x = -w * 0.41 + w * 0.82 * (index + 0.5) / count
            p.box("seat-cushion", (x, -d * 0.07, h * 0.45), (w * 0.8 / count - 0.012, d * 0.72, h * 0.19), "upholstery", 0.05)
            p.box("back-cushion", (x, d * 0.36, h * 0.72), (w * 0.8 / count - 0.012, d * 0.18, h * 0.51), "upholstery", 0.04)
        for sign in (-1, 1):
            p.box("armrest", (sign * w * 0.46, 0, h * 0.57), (w * 0.095, d * 0.91, h * 0.48), "upholstery", 0.032)
    elif kind == "table":
        feet(p, h - 0.07, "wood", 0.036)
        p.box("table-apron", (0, 0, h - 0.11), (w * 0.86, d * 0.78, 0.12), "wood")
        p.box("tabletop", (0, 0, h - 0.023), (w, d, 0.046), "wood", 0.015)
    elif kind == "bed":
        feet(p, h * 0.24, "wood", 0.033)
        p.box("platform", (0, 0, h * 0.32), (w, d, h * 0.25), "wood", 0.012)
        p.box("mattress", (0, 0, h * 0.62), (w * 0.96, d * 0.94, h * 0.36), "ceramic", 0.065)
        p.box("linen", (0, -d * 0.14, h * 0.81), (w * 0.965, d * 0.65, 0.048), "cloth", 0.025)
        p.box("headboard", (0, d * 0.475, h * 0.54), (w, 0.06, h * 0.89), "wood", 0.015)
        for sign in (-1, 1):
            p.box("pillow", (sign * w * 0.24, d * 0.30, h * 0.84), (w * 0.39, d * 0.20, h * 0.20), "cloth", 0.07)
    elif kind in ("kitchen", "basin"):
        p.box("toe-kick", (0, 0.028, 0.07), (w * 0.96, d * 0.84, 0.14), "dark")
        # A real recess in the worktop is assembled around the sink opening.
        sink_width = min(w * 0.35, 0.55) if kind == "kitchen" else w * 0.65
        sink_depth, sink_x = d * 0.60, -w * 0.20 if kind == "kitchen" else 0
        counter_top = h * 0.80 if kind == "basin" else h * 0.72
        cabinet_top = counter_top - 0.045
        p.box("cabinet-back", (0, d * 0.43, (cabinet_top + 0.14) / 2), (w, d * 0.12, cabinet_top - 0.14), "wood")
        p.box("cabinet-base", (0, 0, 0.15), (w, d * 0.9, 0.032), "wood")
        for side in (-1, 1):
            p.box("cabinet-end", (side * (w / 2 - 0.014), 0, (cabinet_top + 0.14) / 2),
                  (0.028, d * 0.9, cabinet_top - 0.14), "wood")
        count = max(1, round(w / 0.6))
        for index in range(count):
            x = -w / 2 + w * (index + 0.5) / count
            p.box("cabinet-front", (x, -d * 0.45, (cabinet_top + 0.14) / 2), (w / count - 0.008, 0.04, cabinet_top - 0.14), "wood")
            p.box("drawer-front", (x, -d * 0.46, cabinet_top - 0.08), (w / count - 0.01, 0.02, 0.115), "wood")
            p.box("drawer-pull", (x, -d * 0.495, cabinet_top - 0.06), (min(0.15, w / count * 0.6), 0.02, 0.016), "metal")
        left_end, right_start = sink_x - sink_width / 2 - 0.023, sink_x + sink_width / 2 + 0.023
        for label, a, b in (("left", -w / 2, left_end), ("right", right_start, w / 2)):
            if b > a:
                p.box("counter-" + label, ((a + b) / 2, 0, counter_top - 0.023), (b - a, d, 0.046), "quartz")
        for sign in (-1, 1):
            side_depth = (d - sink_depth) / 2 - 0.02
            p.box("counter-edge", (sink_x, sign * (d / 2 - side_depth / 2), counter_top - 0.023),
                  (sink_width + 0.046, side_depth, 0.046), "quartz")
        recessed_bowl(p, sink_x, 0, sink_width, sink_depth, counter_top, 0.15, "metal" if kind == "kitchen" else "ceramic")
        faucet(p, sink_x, d * 0.38, counter_top, 0.8)
        if kind == "kitchen":
            p.box("hob", (w * 0.29, 0, counter_top + 0.011), (w * 0.25, d * 0.73, 0.02), "dark")
            for x in (w * 0.25, w * 0.34):
                for z in (-d * 0.18, d * 0.18):
                    p.ring("burner", (x, z, counter_top + 0.025), (0.065, 0.065), 0.006, "metal")
            # Height includes the tap, no unrequested overhead cabinets are added.
    elif kind == "toilet":
        p.orb("pedestal", (0, -d * 0.12, h * 0.22), (w * 0.65, d * 0.65, h * 0.45), "ceramic")
        p.orb("bowl-shell", (0, -d * 0.12, h * 0.48), (w * 0.98, d * 0.73, h * 0.30), "ceramic")
        p.orb("bowl-inset", (0, -d * 0.14, h * 0.594), (w * 0.55, d * 0.47, h * 0.025), "dark")
        p.ring("seat", (0, -d * 0.13, h * 0.62), (w * 0.40, d * 0.32), min(w, d) * 0.036)
        p.box("cistern", (0, d * 0.33, h * 0.73), (w * 0.94, d * 0.29, h * 0.52), "ceramic", 0.038)
        p.box("cistern-lid", (0, d * 0.33, h * 0.99), (w * 0.96, d * 0.30, 0.018), "ceramic")
        p.orb("flush-button", (0, d * 0.33, h * 1.005), (0.06, 0.04, 0.01), "metal")
    elif kind == "bath":
        recessed_bowl(p, 0, 0, w * 0.86, d * 0.85, h * 0.88, h * 0.66, "ceramic")
        for sign in (-1, 1):
            p.box("tub-long-wall", (0, sign * d * 0.475, h * 0.46), (w, d * 0.095, h * 0.92), "ceramic", 0.028)
            p.box("tub-end-wall", (sign * w * 0.475, 0, h * 0.46), (w * 0.095, d, h * 0.92), "ceramic", 0.028)
        p.box("water", (0, 0, h * 0.54), (w * 0.82, d * 0.81, 0.006), "water", 0.001)
        faucet(p, -w * 0.27, d * 0.42, h * 0.94, 0.7)
    elif kind == "cabinet":
        for sign in (-1, 1):
            p.box("cabinet-side", (sign * (w / 2 - 0.015), 0, h / 2), (0.03, d, h), "wood")
        p.box("cabinet-back", (0, d / 2 - 0.012, h / 2), (w, 0.024, h), "wood")
        for level in (0.04, h * 0.34, h * 0.66, h - 0.02):
            p.box("shelf", (0, 0, level), (w, d, 0.032), "wood")
        for sign in (-1, 1):
            p.box("cabinet-door", (sign * w * 0.25, -d / 2 - 0.008, h / 2), (w / 2 - 0.012, 0.024, h - 0.012), "wood")
            p.box("cabinet-pull", (sign * w * 0.045, -d / 2 - 0.04, h * 0.52), (0.022, 0.024, 0.16), "metal")
    else:
        raise ValueError(f"Unsupported fixture type: {kind}")


def build_stair(stair, floors, mats):
    lower, upper = floors[stair["fromFloor"]], floors[stair["toFloor"]]
    a, b = stair["start"], stair["end"]
    run, rise = math.dist(a, b), upper["elevation"] - lower["elevation"]
    steps, width = stair["steps"], stair["width"]
    dx, dz = (b[0] - a[0]) / run, (b[1] - a[1]) / run
    angle = math.atan2(dz, dx)
    tread, riser = run / steps, rise / steps
    for index in range(steps):
        distance = tread * (index + 0.5)
        point = (a[0] + dx * distance, a[1] + dz * distance)
        height = lower["elevation"] + riser * (index + 1)
        cube(f"stair:{stair['id']}:tread:{index}", (*point, height - 0.020),
             (tread + 0.016, width, 0.04), mats["wood"], lower["id"], "stair", angle,
             stairId=stair["id"])
        riser_point = (a[0] + dx * (index * tread + 0.008), a[1] + dz * (index * tread + 0.008))
        cube(f"stair:{stair['id']}:riser:{index}", (*riser_point, height - riser / 2),
             (0.016, width, riser), mats["trim"], lower["id"], "stair", angle,
             stairId=stair["id"])
    landing = (b[0] + dx * 0.11, b[1] + dz * 0.11)
    cube(f"stair:{stair['id']}:landing", (*landing, upper["elevation"] - 0.020),
         (0.24, width, 0.04), mats["wood"], lower["id"], "stair", angle,
         stairId=stair["id"])
    for side in (-1, 1):
        offset = side * (width / 2 - 0.032)
        points = []
        for index in range(0, steps + 1, max(1, steps // 5)):
            distance = min(index / steps, 1) * run
            point = (a[0] + dx * distance - dz * offset,
                     a[1] + dz * distance + dx * offset)
            base = lower["elevation"] + rise * distance / run
            cylinder_between(f"stair:{stair['id']}:baluster:{side}:{index}",
                             (*point, base), (*point, base + 0.86), 0.012,
                             mats["dark"], lower["id"], "trim", stairId=stair["id"])
            points.append((*point, base + 0.88))
        endpoint = (b[0] - dz * offset, b[1] + dx * offset, upper["elevation"] + 0.88)
        cylinder_between(f"stair:{stair['id']}:handrail:{side}", points[0], endpoint, 0.023,
                         mats["grain"], lower["id"], "trim", stairId=stair["id"])


def lighting_and_camera(plan):
    all_points = [point for floor in plan["floors"] for point in floor["boundary"]]
    xmin, xmax = min(p[0] for p in all_points), max(p[0] for p in all_points)
    zmin, zmax = min(p[1] for p in all_points), max(p[1] for p in all_points)
    top = max(f["elevation"] + f["wallHeight"] for f in plan["floors"])
    scene = bpy.context.scene
    world = bpy.data.worlds.new("Neutral daylight")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.72, 0.80, 0.90, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.38
    for floor in plan["floors"]:
        for index, room in enumerate(floor["rooms"]):
            x, z = room["position"]
            data = bpy.data.lights.new(f"Soft room light {floor['id']}:{index}", "AREA")
            data.energy = 230
            data.shape = "DISK"
            data.size = 1.25
            data.color = (1.0, 0.92, 0.80)
            obj = bpy.data.objects.new(data.name, data)
            bpy.context.collection.objects.link(obj)
            obj.location = (x, -z, floor["elevation"] + floor["wallHeight"] - 0.09)
            tags(obj, floor["id"], "light")
    sun_data = bpy.data.lights.new("Daylight", "SUN")
    sun_data.energy, sun_data.angle = 1.5, 0.12
    sun = bpy.data.objects.new("Daylight", sun_data)
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(26), math.radians(-24), math.radians(-35))
    camera_data = bpy.data.cameras.new("Overview camera")
    camera = bpy.data.objects.new("Overview camera", camera_data)
    bpy.context.collection.objects.link(camera)
    centre = Vector(((xmin + xmax) / 2, -(zmin + zmax) / 2, top * 0.36))
    span = max(xmax - xmin, zmax - zmin, top)
    camera.location = centre + Vector((span * 1.13, -span * 1.3, span * 1.25))
    camera.rotation_euler = (centre - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.type, camera_data.ortho_scale = "ORTHO", span * 1.9
    scene.camera = camera
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 96
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.015
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1100
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "AgX"


def build(plan, out, render=False):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    mats = palette()
    floors = {floor["id"]: floor for floor in plan["floors"]}
    stairs = plan.get("stairs", [])
    holes_record = []
    for floor in plan["floors"]:
        incoming = [stair_rectangle(s) for s in stairs if s["toFloor"] == floor["id"]]
        outgoing = [stair_rectangle(s) for s in stairs if s["fromFloor"] == floor["id"]]
        slab(f"floor:{floor['id']}:substrate", floor["boundary"], incoming,
             floor["elevation"] - 0.025, 0.12, mats["trim"], floor["id"], "floor")
        for room in floor["rooms"]:
            # Material selection is cosmetic and explicitly labelled as a reference finish.
            wet = any(token in room["name"].lower() for token in ("bath", "toilet", "洗", "浴", "トイレ"))
            slab(f"floor:{floor['id']}:{room['id']}", room["polygon"], incoming,
                 floor["elevation"], 0.025, mats["tile"] if wet else mats["wood"],
                 floor["id"], "floor", roomId=room["id"])
        slab(f"ceiling:{floor['id']}", floor["boundary"], outgoing,
             floor["elevation"] + floor["wallHeight"] + 0.06, 0.06,
             mats["wall"], floor["id"], "ceiling")
        holes_record.append({"floorId": floor["id"], "floor": incoming, "ceiling": outgoing})
        for wall in floor["walls"]:
            build_wall(floor, wall, mats)
        for fixture in floor.get("fixtures", []):
            build_fixture(floor, fixture, mats)
    for stair in stairs:
        build_stair(stair, floors, mats)
    lighting_and_camera(plan)
    out.mkdir(parents=True, exist_ok=True)
    # Images are packed in .blend and GLB. Relative output paths are the only references.
    bpy.ops.wm.save_as_mainfile(filepath=str((out / "model.blend").resolve()))
    bpy.ops.export_scene.gltf(filepath=str((out / "model.glb").resolve()),
                              export_format="GLB", export_yup=True, export_extras=True,
                              export_apply=True, export_animations=False,
                              export_cameras=False, export_lights=False,
                              export_texcoords=True, export_normals=True,
                              export_materials="EXPORT", export_image_format="AUTO")
    meshes = [obj for obj in scene.objects if obj.type == "MESH"]
    mesh_roles = Counter(obj.get("modelRole", "unknown") for obj in meshes)
    triangles = sum(len(face.vertices) - 2 for obj in meshes for face in obj.data.polygons)
    manifest = {
        "schemaVersion": "1.0", "builderVersion": "1.0.0", "blenderVersion": bpy.app.version_string,
        "units": "m", "files": {"blend": "model.blend", "glb": "model.glb"},
        "meshCount": len(meshes), "triangles": triangles, "meshRoles": dict(mesh_roles),
        "materialCount": len(mats), "embeddedProceduralImages": 4,
        "stairOpenings": holes_record,
        "movableOpeningIds": sorted({obj["openingId"] for obj in meshes if obj.get("modelRole") == "door"}),
        "quality": {"bevelSegments": 3, "pbr": True, "physicalUvScale": True,
                    "separateJoineryParts": True, "measuredOpenings": True},
        "render": {"engine": "CYCLES", "samples": 96, "adaptiveThreshold": 0.015,
                   "denoiser": "OPENIMAGEDENOISE", "generated": render},
        "sourceDocumentation": [GLTF_DOC, CYCLES_DOC],
        "assumptions": plan.get("assumptions", []),
        "limitations": ["Reference finishes and generic fixtures; no manufacturer dimensions.",
                        "Only orthogonal plans, straight stairs, hinged/sliding doors and fixed windows.",
                        "No roof, landscaping or exterior objects are inferred from a floor plan."],
    }
    if render:
        # An overview cutaway is a display choice; saved editable architecture stays complete.
        hidden = []
        top_floor = max(plan["floors"], key=lambda floor: floor["elevation"])["id"]
        for obj in meshes:
            if obj.get("modelRole") == "ceiling" or (obj.get("floorId") != top_floor and obj.get("modelRole") == "light"):
                hidden.append((obj, obj.hide_render))
                obj.hide_render = True
        scene.render.filepath = str((out / "preview.png").resolve())
        bpy.ops.render.render(write_still=True)
        strip_png_metadata(out / "preview.png")
        for obj, state in hidden:
            obj.hide_render = state
        manifest["files"]["preview"] = "preview.png"
    (out / "quality-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "ok", "meshCount": len(meshes), "triangles": triangles,
                      "movableOpenings": len(manifest["movableOpeningIds"])}))


if __name__ == "__main__":
    args = arguments()
    input_plan = json.loads(args.plan.read_text(encoding="utf-8"))
    if input_plan.get("units") != "m" or input_plan.get("version") != "1.0":
        raise ValueError("Builder requires validated plan contract v1.0 in metres")
    build(input_plan, args.out, args.render)
