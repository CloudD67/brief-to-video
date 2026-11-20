"""夜面 · 5 秒真实感测试镜头（CG 赛道示范）。

雨夜面摊的特写：真实 HDRI + PBR、程序化碗面、霓虹、体积蒸汽、粒子雨。
用 cg_kit 搭景，不依赖任何外部模型；素材只用到 CC0 的 HDRI 与沥青贴图。

  node tools/cg-render.js --at 2.5        # 单帧抽检
  node tools/cg-render.js                 # 5 秒全片 → frames/
  node encode.js                          # 成片 → out/final.mp4
"""
import os
import sys
import math

import bpy
import bmesh

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import cg_kit as K  # noqa: E402

DURATION = 5.0
FPS = int(os.environ.get('CG_FPS', 24))
WIDTH = int(os.environ.get('CG_WIDTH', 1920))
HEIGHT = int(os.environ.get('CG_HEIGHT', 1080))
SAMPLES = int(os.environ.get('CG_SAMPLES', 24))
ENGINE = os.environ.get('CG_ENGINE', 'EEVEE')
OUT = os.environ.get('CG_OUT') or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frames')
FROM = float(os.environ.get('CG_FROM', 0))
TO = float(os.environ.get('CG_TO', DURATION))
AT = os.environ.get('CG_AT')
POSTER = os.environ.get('CG_POSTER')

LIB = os.environ.get('CG_ASSETS') or os.path.expanduser('~/.qoder/tools/cg-library')


def asset(rel):
    path = os.path.join(LIB, rel)
    if not os.path.exists(path):
        raise FileNotFoundError('缺少 CC0 素材: ' + path + '\n运行 scripts/fetch-cg-assets.sh（Windows: scripts/fetch-cg-assets.ps1），或设置 CG_ASSETS 指向素材库。')
    return path


FRAMES = int(round(DURATION * FPS))

K.reset()
scene = K.setup_scene(WIDTH, HEIGHT, FPS, FRAMES, samples=SAMPLES, engine=ENGINE)

# ---------- 世界 ----------
K.hdri_world(asset('hdri/cobblestone_street_night_2k.hdr'),
             strength=0.07, rotation_deg=95, saturation=0.45, value=0.95)

# ---------- 地面：湿沥青 ----------
bpy.ops.mesh.primitive_plane_add(size=24, location=(0, 0, 0))
ground = bpy.context.object
ground.name = 'WetAsphalt'
gm, _, _ = K.pbr_textured(
    'WetAsphalt',
    asset('pbr/asphalt_04/asphalt_04_diff_1k.jpg'),
    asset('pbr/asphalt_04/asphalt_04_rough_1k.jpg'),
    asset('pbr/asphalt_04/asphalt_04_nor_gl_1k.jpg'),
    asset('pbr/asphalt_04/asphalt_04_ao_1k.jpg'),
    uv_scale=(5, 5, 1), roughness_range=(0.12, 0.55), coat=0.35)
ground.data.materials.append(gm)

# ---------- 后墙：砖 ----------
bpy.ops.mesh.primitive_plane_add(size=7, location=(0, 1.75, 1.55), rotation=(math.pi / 2, 0, 0))
wall = bpy.context.object
wall.name = 'BackWallTiles'
wm, wnt, wb, _ = K.material('BackWallTiles', roughness=0.52)
K.S(wb, 'Roughness', 0.52)
tc = wnt.nodes.new('ShaderNodeTexCoord')
mp = wnt.nodes.new('ShaderNodeMapping')
K.S(mp, 'Scale', (4.0, 4.0, 1.0))
wnt.links.new(tc.outputs['UV'], mp.inputs['Vector'])
brick = wnt.nodes.new('ShaderNodeTexBrick')
K.S(brick, 'Scale', 5.0); K.S(brick, 'Mortar Size', 0.022); K.S(brick, 'Mortar Smooth', 0.15)
K.S(brick, 'Brick Width', 0.55); K.S(brick, 'Row Height', 0.24)
K.S(brick, 'Color1', (0.075, 0.058, 0.045, 1)); K.S(brick, 'Color2', (0.040, 0.031, 0.027, 1))
K.S(brick, 'Mortar', (0.014, 0.012, 0.010, 1))
wnt.links.new(mp.outputs['Vector'], brick.inputs['Vector'])
wnt.links.new(brick.outputs['Color'], wb.inputs['Base Color'])
K.noise_detail(wnt, wb, scale=30, detail=6, strength=0.35, distance=0.015)
wall.data.materials.append(wm)

# ---------- 档口台面 ----------
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.95))
counter = bpy.context.object
counter.name = 'Counter'
counter.scale = (2.2, 0.92, 0.10)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bev = counter.modifiers.new('Bevel', 'BEVEL'); bev.width = 0.012; bev.segments = 3
bpy.ops.object.shade_smooth()
cm, cnt, cb, _ = K.material('SteelCounter', (0.085, 0.090, 0.095, 1), metallic=1.0, roughness=0.29, coat=0.18, coat_rough=0.10)
K.noise_detail(cnt, cb, scale=16, detail=5, strength=0.13, distance=0.002, rough=(0.16, 0.42))
counter.data.materials.append(cm)

bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.995))
mat = bpy.context.object
mat.name = 'ServiceMat'
mat.scale = (0.70, 0.48, 0.012)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
mbv = mat.modifiers.new('Bevel', 'BEVEL'); mbv.width = 0.008; mbv.segments = 2
mm, _, _, _ = K.material('ServiceMatCloth', (0.135, 0.030, 0.022, 1), roughness=0.58)
mat.data.materials.append(mm)

bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.46, 0.48))
panel = bpy.context.object
panel.name = 'CounterFront'
panel.scale = (2.2, 0.06, 0.96)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
pm, _, _, _ = K.material('DarkSteel', (0.06, 0.055, 0.05, 1), metallic=0.8, roughness=0.35)
panel.data.materials.append(pm)

# ---------- 背景：木架与酒瓶 ----------
sm, _, _, _ = K.material('ShelfWood', (0.055, 0.035, 0.020, 1), roughness=0.55)
bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.56, 1.66, 1.18))
shelf = bpy.context.object
shelf.name = 'Shelf'; shelf.scale = (0.78, 0.16, 0.035)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
shelf.data.materials.append(sm)

glass, _, _, _ = K.material('BottleGlass', (0.018, 0.055, 0.038, 1), roughness=0.12, coat=0.4)
label, _, _, _ = K.material('BottleLabel', (0.55, 0.42, 0.25, 1), roughness=0.5)
for bx in (-0.80, -0.64, -0.48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.026, depth=0.19, location=(bx, 1.66, 1.29))
    bpy.context.object.data.materials.append(glass)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.009, depth=0.055, location=(bx, 1.66, 1.41))
    bpy.context.object.data.materials.append(glass)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.0265, depth=0.055, location=(bx, 1.66, 1.30))
    bpy.context.object.data.materials.append(label)

# ---------- 纸灯笼与灯泡 ----------
lantern_m, _, lan_em = K.emission_material('PaperLantern', (1.0, 0.52, 0.22, 1), 2.5)
bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.10, location=(-0.62, 1.32, 1.70))
lant = bpy.context.object; lant.name = 'PaperLantern'; lant.scale.z = 1.15
lant.data.materials.append(lantern_m)
K.point_light('LanternLight', (-0.62, 1.30, 1.70), 12, (1.0, 0.48, 0.20), radius=0.10)
K.point_light('SteamKey', (0.08, -0.12, 1.96), 16, (1.0, 0.74, 0.48), radius=0.22)

cu = bpy.data.curves.new('LanternWire', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.002
sp = cu.splines.new('POLY'); sp.points.add(1)
sp.points[0].co = (-0.62, 1.32, 2.4, 1); sp.points[1].co = (-0.62, 1.32, 1.80, 1)
wire = bpy.data.objects.new('LanternWire', cu)
bpy.context.collection.objects.link(wire)

bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.055, location=(0.52, -0.18, 2.02))
bulb_m, _, _ = K.emission_material('Bulb', (1.0, 0.62, 0.30, 1), 5)
bpy.context.object.data.materials.append(bulb_m)

# ---------- 碗 ----------
profile = [(0.000, 0.000), (0.035, 0.003), (0.070, 0.018), (0.100, 0.050),
           (0.125, 0.090), (0.138, 0.125), (0.142, 0.145)]
bm = bmesh.new()
vs = [bm.verts.new((r, 0, z)) for r, z in profile]
es = [bm.edges.new((vs[i], vs[i + 1])) for i in range(len(vs) - 1)]
bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(0, 0, 1), dvec=(0, 0, 0),
               angle=math.tau, steps=72, use_merge=True)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new('Bowl'); bm.to_mesh(me); bm.free()
bowl = bpy.data.objects.new('Bowl', me)
bpy.context.collection.objects.link(bowl)
bowl.location = (0, 0, 1.0)
sol = bowl.modifiers.new('Solidify', 'SOLIDIFY'); sol.thickness = 0.006; sol.offset = -1
sub = bowl.modifiers.new('Subsurf', 'SUBSURF'); sub.levels = 2; sub.render_levels = 2
for p in me.polygons:
    p.use_smooth = True
bm2, bnt, bb, _ = K.material('Ceramic', (0.80, 0.76, 0.68, 1), roughness=0.24, coat=0.55, coat_rough=0.08)
K.noise_detail(bnt, bb, scale=90, detail=4, strength=0.05, distance=0.001)
bowl.data.materials.append(bm2)

# ---------- 汤与面 ----------
bpy.ops.mesh.primitive_circle_add(vertices=72, radius=0.128, fill_type='NGON', location=(0, 0, 1.118))
broth = bpy.context.object
broth.name = 'Broth'
brm, brnt, brb, _ = K.material('Broth', (0.30, 0.085, 0.025, 1), roughness=0.10)
K.S(brb, 'Transmission Weight', 0.22); K.S(brb, 'IOR', 1.33)
K.S(brb, 'Coat Weight', 0.7); K.S(brb, 'Coat Roughness', 0.03)
K.S(brb, 'Subsurface Weight', 0.12)
K.S(brb, 'Subsurface Radius', (0.20, 0.08, 0.03)); K.S(brb, 'Subsurface Scale', 0.05)
brn = brnt.nodes.new('ShaderNodeTexNoise'); brn.noise_dimensions = '4D'
K.S(brn, 'Scale', 9); K.S(brn, 'Detail', 5); K.S(brn, 'Roughness', 0.6)
brn.inputs['W'].default_value = 0.0; brn.inputs['W'].keyframe_insert(data_path='default_value', frame=1)
brn.inputs['W'].default_value = 1.2; brn.inputs['W'].keyframe_insert(data_path='default_value', frame=FRAMES)
brbump = brnt.nodes.new('ShaderNodeBump'); K.S(brbump, 'Strength', 0.16); K.S(brbump, 'Distance', 0.002)
brnt.links.new(brn.outputs['Fac'], brbump.inputs['Height'])
brnt.links.new(brbump.outputs['Normal'], brb.inputs['Normal'])
broth.data.materials.append(brm)

noodle_m, _, _, _ = K.material('Noodle', (0.82, 0.70, 0.40, 1), roughness=0.38)
for k in range(6):
    cu = bpy.data.curves.new('Noodle%d' % k, 'CURVE')
    cu.dimensions = '3D'; cu.resolution_u = 14
    cu.bevel_depth = 0.0032; cu.bevel_resolution = 2; cu.use_fill_caps = True
    sp = cu.splines.new('POLY'); npts = 46; sp.points.add(npts - 1)
    ph = k * 0.7
    for i in range(npts):
        a = ph + i * 0.20
        r = 0.022 + 0.078 * (i / (npts - 1))
        x = math.cos(a) * r * (1 + 0.10 * math.sin(i * 0.9 + k))
        y = math.sin(a) * r * (1 + 0.10 * math.cos(i * 0.7 + k))
        z = 0.002 + 0.004 * math.sin(i * 0.55 + k * 1.3)
        sp.points[i].co = (x, y, z, 1)
    ob = bpy.data.objects.new('Noodle%d' % k, cu)
    bpy.context.collection.objects.link(ob)
    ob.location = (0, 0, 1.122)
    ob.data.materials.append(noodle_m)

green, _, green_bsdf, _ = K.material('Scallion', (0.10, 0.36, 0.10, 1), roughness=0.35)
K.S(green_bsdf, 'Subsurface Weight', 0.25)
red, _, red_bsdf, _ = K.material('ChiliOil', (0.55, 0.10, 0.015, 1), roughness=0.08, coat=0.8, coat_rough=0.02)
K.S(red_bsdf, 'Coat Weight', 0.8)
for i in range(14):
    a = i * 2.4; r = 0.028 + (i % 5) * 0.024
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.0035, depth=0.012,
                                        location=(math.cos(a) * r, math.sin(a) * r, 1.124))
    o = bpy.context.object; o.rotation_euler = (0.4, 0.2, a)
    o.data.materials.append(green)
for i in range(7):
    a = i * 1.7 + 0.4; r = 0.035 + (i % 4) * 0.028
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.0065,
                                        location=(math.cos(a) * r, math.sin(a) * r, 1.122))
    o = bpy.context.object; o.scale.z = 0.35
    o.data.materials.append(red)

wood, wdnt, wdb, _ = K.material('Wood', (0.20, 0.105, 0.045, 1), roughness=0.42)
wn = wdnt.nodes.new('ShaderNodeTexNoise'); K.S(wn, 'Scale', 40); K.S(wn, 'Detail', 6)
wbump = wdnt.nodes.new('ShaderNodeBump'); K.S(wbump, 'Strength', 0.12); K.S(wbump, 'Distance', 0.001)
wdnt.links.new(wn.outputs['Fac'], wbump.inputs['Height'])
wdnt.links.new(wbump.outputs['Normal'], wdb.inputs['Normal'])
for i, yoff in enumerate((-0.030, 0.030)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.004, depth=0.34,
                                        location=(0.020, yoff, 1.149 + i * 0.004))
    o = bpy.context.object
    o.rotation_euler = (math.pi / 2, 0.0, math.radians(28 + i * 3))
    o.data.materials.append(wood)

# ---------- 霓虹 ----------
sign, sign_em = K.neon_text('NeonNightNoodle', '夜面', 0.24, (0.0, 1.62, 1.44), (1.0, 0.12, 0.025, 1), 4.0)
open_sign, open_em = K.neon_text('NeonOpen', '营业中', 0.075, (-0.98, 1.62, 1.31), (0.18, 0.78, 1.0, 1), 2.5)
K.flicker(sign_em, 4.0, [(1, 1.0), (18, 1.0), (19, 0.55), (22, 1.0), (55, 1.0), (57, 0.35), (60, 1.0), (61, 0.8), (64, 1.0), (96, 1.0), (98, 0.6), (101, 1.0), (FRAMES, 1.0)])
K.flicker(open_em, 2.5, [(1, 1.0), (40, 1.0), (42, 0.4), (45, 1.0)])

# ---------- 光 ----------
K.area_light('WarmKey', (0.42, -0.70, 1.92), 15, (1.0, 0.72, 0.46), 0.30, (0, 0, 1.15))
K.area_light('CoolRim', (-0.80, 0.62, 1.72), 1.8, (0.62, 0.75, 0.90), 0.40, (0, 0, 1.15))
K.area_light('NeonFill', (0.15, 1.10, 1.55), 1.6, (1.0, 0.22, 0.06), 0.60, (0, 0, 1.15))
K.area_light('WallWash', (-0.30, 1.02, 2.25), 12, (1.0, 0.50, 0.28), 1.10, (0, 1.75, 1.38))
K.area_light('WarmFill', (-0.45, -0.55, 1.58), 4, (1.0, 0.72, 0.52), 0.55, (0, 0, 1.13))

# ---------- 蒸汽与雨 ----------
K.steam_volume('Steam', loc=(0, 0, 1.33), size=(0.44, 0.44, 0.46), density=5.0,
               frames=(1, FRAMES), fade_z=0.20)
K.rain('Rain', loc=(0, 1.35, 2.7), size=2.6, count=1800,
       drop_radius=0.0015, drop_length=0.12, speed=-6.5, lifetime=34, frames=(1, FRAMES))

# ---------- 机位与合成 ----------
K.camera((0.50, -1.55, 1.52), (0, 0.08, 1.31), lens=65, focus=bowl, fstop=2.0,
         frames=(1, FRAMES), move=(-0.06, 0.13, -0.05), handheld=0.0022)
K.compositor(scene, threshold=0.72, strength=0.55, size=0.38, distortion=0.012, dispersion=0.008)

stills = [float(x) for x in AT.split(',')] if AT else None
report = K.render_frames(scene, OUT, from_sec=FROM, to_sec=TO, fps=FPS,
                         stills=stills,
                         poster=float(POSTER) if POSTER else None,
                         label='night-stand',
                         extra={'film': 'night-stand', 'duration': DURATION,
                                'assets': ['cc0:polyhaven/cobblestone_street_night',
                                           'cc0:polyhaven/asphalt_04']})