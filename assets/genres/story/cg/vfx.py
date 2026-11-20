"""P3 · VFX 与物理检验镜头（5 秒示范）。

收摊后的巷口：门帘被风掀动，炉火忽明忽暗，两罐饮料从搁板滚落在地，
水洼里溅起两簇水花。四类效果一次全开：

  布料  cloth_flag()   门帘 + 阵风 + 抖动，PBD 构建时解算并烘进 shape key
  火烟  flame_volume() 程序化火焰体积 + 闪烁点光
  刚体  rigid_world() / rigid_body() / can()  罐子滚落、弹跳、滚动
  粒子  splash()       水花爆发，固定 seed

  node tools/cg-render.js --file cg/vfx.py --at 1.2,2.6,4.4   # 抽检
  node tools/cg-render.js --file cg/vfx.py                    # 5 秒 → frames/
"""
import math
import os
import sys

import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import cg_kit as K  # noqa: E402
import cg_vfx as V  # noqa: E402

DURATION = 5.0
FPS = int(os.environ.get('CG_FPS', 24))
WIDTH = int(os.environ.get('CG_WIDTH', 1920))
HEIGHT = int(os.environ.get('CG_HEIGHT', 1080))
SAMPLES = int(os.environ.get('CG_SAMPLES', 24))
ENGINE = os.environ.get('CG_ENGINE', 'EEVEE')
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('CG_OUT') or os.path.join(HERE, '..', 'frames')
FROM = float(os.environ.get('CG_FROM', 0))
TO = float(os.environ.get('CG_TO', DURATION))
AT = os.environ.get('CG_AT')
POSTER = os.environ.get('CG_POSTER')
LIB = os.environ.get('CG_ASSETS') or os.path.expanduser('~/.qoder/tools/cg-library')
FRAMES = int(round(DURATION * FPS))


def asset(rel):
    path = os.path.join(LIB, rel)
    if not os.path.exists(path):
        raise FileNotFoundError('缺少 CC0 素材: ' + path)
    return path


K.reset()
scene = K.setup_scene(WIDTH, HEIGHT, FPS, FRAMES, samples=SAMPLES, engine=ENGINE)
K.hdri_world(asset('hdri/cobblestone_street_night_2k.hdr'),
             strength=0.05, rotation_deg=95, saturation=0.45, value=0.95)

# ---------- 地面与墙 ----------
bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
ground = bpy.context.object
ground.name = 'Ground'
gm, _, _ = K.pbr_textured(
    'WetAsphalt',
    asset('pbr/asphalt_04/asphalt_04_diff_1k.jpg'),
    asset('pbr/asphalt_04/asphalt_04_rough_1k.jpg'),
    asset('pbr/asphalt_04/asphalt_04_nor_gl_1k.jpg'),
    asset('pbr/asphalt_04/asphalt_04_ao_1k.jpg'),
    uv_scale=(5, 5, 1), roughness_range=(0.12, 0.55), coat=0.35)
ground.data.materials.append(gm)

bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 1.85, 1.7), rotation=(math.pi / 2, 0, 0))
wall = bpy.context.object
wall.name = 'BrickWall'
wm, wnt, wb, _ = K.material('Brick', roughness=0.55)
tc = wnt.nodes.new('ShaderNodeTexCoord')
mp = wnt.nodes.new('ShaderNodeMapping')
K.S(mp, 'Scale', (4.0, 4.0, 1.0))
wnt.links.new(tc.outputs['UV'], mp.inputs['Vector'])
brick = wnt.nodes.new('ShaderNodeTexBrick')
K.S(brick, 'Scale', 5.0); K.S(brick, 'Mortar Size', 0.022); K.S(brick, 'Mortar Smooth', 0.15)
K.S(brick, 'Brick Width', 0.55); K.S(brick, 'Row Height', 0.24)
K.S(brick, 'Color1', (0.062, 0.047, 0.038, 1)); K.S(brick, 'Color2', (0.030, 0.024, 0.021, 1))
K.S(brick, 'Mortar', (0.011, 0.010, 0.008, 1))
wnt.links.new(mp.outputs['Vector'], brick.inputs['Vector'])
wnt.links.new(brick.outputs['Color'], wb.inputs['Base Color'])
K.noise_detail(wnt, wb, scale=26, detail=6, strength=0.3, distance=0.012)
wall.data.materials.append(wm)

# ---------- 门帘与横杆 ----------
pole_m, _, _, _ = K.material('Pole', (0.045, 0.043, 0.042, 1), metallic=0.85, roughness=0.45)
for sx in (-1, 1):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.019, depth=1.9,
                                        location=(sx * 1.02, 1.70, 0.95))
    bpy.context.object.name = 'BannerPole' + ('L' if sx < 0 else 'R')
    bpy.context.object.data.materials.append(pole_m)
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.013, depth=2.10,
                                    location=(0, 1.70, 1.865), rotation=(0, math.pi / 2, 0))
bpy.context.object.name = 'BannerRod'
bpy.context.object.data.materials.append(pole_m)

cloth_m, cnt, cb, _ = K.material('ClothRed', (0.34, 0.045, 0.030, 1), roughness=0.88)
K.noise_detail(cnt, cb, scale=55, detail=5, strength=0.22, distance=0.0015)
banner = V.cloth_flag('Banner', loc=(0, 1.70, 1.645), size=(1.90, 0.46),
                      mat=cloth_m, frames=(1, FRAMES), fps=FPS, nx=36, ny=16,
                      wind=(4.0, 1.4), seed=4, thickness=0.0018)

# ---------- 搁板与罐子 ----------
bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.72, 1.66, 1.20))
shelf = bpy.context.object
shelf.name = 'Shelf'
shelf.scale = (0.52, 0.40, 0.022)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
wood, wdd_nt, wdd_b, _ = K.material('ShelfWood', (0.085, 0.052, 0.030, 1), roughness=0.7)
K.noise_detail(wdd_nt, wdd_b, scale=20, detail=5, strength=0.3, distance=0.004)
shelf.data.materials.append(wood)
for sx in (-0.86, -0.58):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(sx, 1.77, 1.10))
    br = bpy.context.object
    br.name = 'ShelfBracket'
    br.scale = (0.02, 0.16, 0.16)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    br.data.materials.append(pole_m)

V.rigid_world(scene, frame_end=FRAMES)
for o in (ground, shelf):
    V.rigid_body(o, kind='PASSIVE')

label_m, _, _, _ = K.material('CanLabel', (0.55, 0.10, 0.02, 1), roughness=0.5)
# CanA 横躺、重心压在搁板前缘：靠自重翻下去，落地弹跳滚动；CanB 立着不动
V.rigid_body(V.can('CanA', (-0.80, 1.450, 1.247), r=0.034, h=0.11,
                  rot=(math.pi / 2, 0.10, 0.30), label=label_m),
             mass=0.38, friction=0.42, restitution=0.34)
V.rigid_body(V.can('CanB', (-0.64, 1.72, 1.266), r=0.034, h=0.11, label=label_m),
             mass=0.38, friction=0.42, restitution=0.30)

# ---------- 炉子 ----------
rust, rnt, rb, _ = K.material('RustBarrel', (0.070, 0.038, 0.026, 1), metallic=0.55,
                              roughness=0.62)
K.noise_detail(rnt, rb, scale=14, detail=6, strength=0.35, distance=0.003, rough=(0.35, 0.75))
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.235, depth=0.52,
                                    location=(0.82, 1.24, 0.26))
barrel = bpy.context.object
barrel.name = 'Brazier'
barrel.data.materials.append(rust)
bev = barrel.modifiers.new('Bevel', 'BEVEL')
bev.width = 0.008
bev.segments = 2
bpy.ops.mesh.primitive_torus_add(major_radius=0.235, minor_radius=0.012,
                                 location=(0.82, 1.24, 0.52), major_segments=32,
                                 minor_segments=8)
rim = bpy.context.object
rim.name = 'BrazierRim'
rim.data.materials.append(rust)

fire, flick = V.flame_volume('Fire', loc=(0.82, 1.24, 1.02), size=(0.40, 0.40, 0.95),
                             frames=(1, FRAMES), intensity=9.0, density=3.6,
                             seed=6, drift=4.2, hotspot=0.34,
                             fire=(1.0, 0.32, 0.05), smoke=(0.045, 0.034, 0.028))
coal_m, _, _ = K.emission_material('CoalBed', (1.0, 0.26, 0.045, 1), 4.5)
bpy.ops.mesh.primitive_circle_add(vertices=32, radius=0.185, fill_type='NGON',
                                  location=(0.82, 1.24, 0.505))
bpy.context.object.name = 'CoalBed'
bpy.context.object.data.materials.append(coal_m)
K.point_light('FireLight', (0.82, 1.24, 0.66), 46, (1.0, 0.42, 0.12), radius=0.16)
fire_light = bpy.data.objects['FireLight']
keys = [(1, 46), (6, 30), (12, 52), (19, 36), (27, 55), (34, 33), (41, 50),
        (52, 38), (63, 54), (74, 34), (86, 50), (98, 40), (110, 52), (FRAMES, 44)]
for f, e in keys:
    fire_light.data.energy = e
    fire_light.data.keyframe_insert('energy', frame=f)

# ---------- 水洼与水花 ----------
V.puddle('Puddle', (0.10, 1.00, 0.0), radius=0.24, rot=0.4)
V.splash('SplashA', (0.10, 1.00, 0.012), frame_start=26, count=900, speed=2.1,
         spread=0.6, frames=(1, FRAMES), seed=9, radius=0.0045)
V.splash('SplashB', (0.10, 1.00, 0.012), frame_start=58, count=700, speed=1.8,
         spread=0.7, frames=(1, FRAMES), seed=13, radius=0.0045)

# ---------- 光 ----------
K.area_light('WarmKey', (-0.85, 0.55, 2.35), 26, (1.0, 0.74, 0.50), 0.7, (0.1, 1.35, 1.0))
K.area_light('CoolRim', (0.75, 2.05, 2.15), 8, (0.50, 0.66, 1.0), 0.5, (0.0, 1.3, 1.2))
K.area_light('WallWash', (-0.35, 1.55, 2.5), 7, (1.0, 0.50, 0.28), 1.1, (0, 1.85, 1.3))
K.area_light('FireFill', (0.75, 0.65, 0.95), 5, (1.0, 0.45, 0.16), 0.5, (0.8, 1.25, 0.7))
K.point_light('ShelfLamp', (-0.92, 1.32, 1.66), 14, (1.0, 0.60, 0.34), radius=0.05)

sign, sign_em = K.neon_text('NeonNight', '夜面', 0.16, (1.58, 1.83, 1.74),
                            (1.0, 0.14, 0.03, 1), 4.5)
K.flicker(sign_em, 4.5, [(1, 1.0), (30, 1.0), (32, 0.4), (35, 1.0),
                         (84, 1.0), (86, 0.5), (89, 1.0), (FRAMES, 1.0)])

# ---------- 雨与机位 ----------
K.rain('Rain', loc=(0.1, 1.0, 2.75), size=2.2, count=700,
       drop_radius=0.0009, drop_length=0.07, speed=-6.2, lifetime=40,
       frames=(1, FRAMES), emission=0.18, color=(0.18, 0.24, 0.34))

K.camera((-1.50, -2.45, 1.12), (0.10, 1.35, 0.88), lens=33,
         frames=(1, FRAMES), move=(0.02, 0.20, 0.02), handheld=0.0016)
K.compositor(scene, threshold=0.78, strength=0.55, size=0.4, distortion=0.01, dispersion=0.006)

# ---------- 烘焙物理，再渲 ----------
V.bake(scene, FRAMES, fps=FPS, label='vfx-demo')

stills = [float(x) for x in AT.split(',')] if AT else None
report = K.render_frames(scene, OUT, from_sec=FROM, to_sec=TO, fps=FPS,
                         stills=stills,
                         poster=float(POSTER) if POSTER else None,
                         label='vfx', extra={'film': 'vfx', 'duration': DURATION})
