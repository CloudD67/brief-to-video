"""面摊 · 6 秒角色表演测试（P2 示范）。

程序化角色站在面摊后，抬头看向客人并说一句「面好了，趁热吃。」
口型由 say 生成的音轨包络驱动；呼吸、眨眼、头部转向全部关键帧化。

  node tools/cg-render.js --file cg/character.py --at 0.2,1.8,2.6   # 抽检
  node tools/cg-render.js --file cg/character.py                    # 6 秒 → frames/
"""
import math
import os
import subprocess
import sys

import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import cg_audio as A  # noqa: E402
import cg_char as C  # noqa: E402
import cg_kit as K  # noqa: E402

DURATION = 6.0
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
LINE = os.environ.get('CG_VOICE')
FRAMES = int(round(DURATION * FPS))


def asset(rel):
    path = os.path.join(LIB, rel)
    if not os.path.exists(path):
        raise FileNotFoundError('缺少 CC0 素材: ' + path)
    return path


def make_line(path):
    """生成带 1.9s 前导静音的对白；已有音频直接复用，say 挂起时超时放弃。"""
    if os.path.exists(path) and os.path.getsize(path) > 4096:
        return True
    try:
        voices = subprocess.check_output(['say', '-v', '?'], text=True, timeout=10)
        voice = 'Meijia' if 'Meijia' in voices else ('Sinji' if 'Sinji' in voices else None)
        if not voice:
            return False
        subprocess.run(['say', '-v', voice, '-o', path, '--data-format=LEI16@22050',
                        '[[slnc 1900]]面好了，趁热吃。'], check=True, timeout=30)
        return os.path.exists(path)
    except Exception as e:
        print('CG_VOICE_SKIP', e, flush=True)
        return False


K.reset()
scene = K.setup_scene(WIDTH, HEIGHT, FPS, FRAMES, samples=SAMPLES, engine=ENGINE)
K.hdri_world(asset('hdri/cobblestone_street_night_2k.hdr'),
             strength=0.05, rotation_deg=95, saturation=0.45, value=0.95)

# ---------- 墙与地面 ----------
bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
ground = bpy.context.object
ground.name = 'Ground'
gm, _, _ = K.pbr_textured(
    'WetAsphalt',
    asset('pbr/asphalt_04/asphalt_04_diff_1k.jpg'),
    asset('pbr/asphalt_04/asphalt_04_rough_1k.jpg'),
    asset('pbr/asphalt_04/asphalt_04_nor_gl_1k.jpg'),
    asset('pbr/asphalt_04/asphalt_04_ao_1k.jpg'),
    uv_scale=(5, 5, 1), roughness_range=(0.15, 0.6), coat=0.3)
ground.data.materials.append(gm)

bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 1.62, 1.6), rotation=(math.pi / 2, 0, 0))
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
K.S(brick, 'Color1', (0.070, 0.052, 0.040, 1)); K.S(brick, 'Color2', (0.036, 0.028, 0.024, 1))
K.S(brick, 'Mortar', (0.013, 0.011, 0.009, 1))
wnt.links.new(mp.outputs['Vector'], brick.inputs['Vector'])
wnt.links.new(brick.outputs['Color'], wb.inputs['Base Color'])
K.noise_detail(wnt, wb, scale=26, detail=6, strength=0.3, distance=0.012)
wall.data.materials.append(wm)

# ---------- 台面 ----------
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.20, 0.95))
counter = bpy.context.object
counter.name = 'Counter'
counter.scale = (1.9, 0.60, 0.10)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bev = counter.modifiers.new('Bevel', 'BEVEL'); bev.width = 0.012; bev.segments = 3
bpy.ops.object.shade_smooth()
cm, cnt, cb, _ = K.material('SteelCounter', (0.085, 0.090, 0.095, 1), metallic=1.0, roughness=0.3, coat=0.15)
K.noise_detail(cnt, cb, scale=16, detail=5, strength=0.12, distance=0.002, rough=(0.18, 0.44))
counter.data.materials.append(cm)

bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.515, 0.48))
panel = bpy.context.object
panel.name = 'CounterFront'
panel.scale = (1.9, 0.05, 0.94)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
pm, _, _, _ = K.material('DarkSteel', (0.055, 0.05, 0.045, 1), metallic=0.7, roughness=0.4)
panel.data.materials.append(pm)

# ---------- 碗 + 面 ----------
profile = [(0.000, 0.000), (0.032, 0.003), (0.066, 0.017), (0.096, 0.048),
           (0.120, 0.086), (0.132, 0.120), (0.136, 0.140)]
import bmesh  # noqa: E402

bm = bmesh.new()
vs = [bm.verts.new((r, 0, z)) for r, z in profile]
es = [bm.edges.new((vs[i], vs[i + 1])) for i in range(len(vs) - 1)]
bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(0, 0, 1), dvec=(0, 0, 0),
               angle=math.tau, steps=64, use_merge=True)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new('Bowl'); bm.to_mesh(me); bm.free()
bowl = bpy.data.objects.new('Bowl', me)
bpy.context.collection.objects.link(bowl)
bowl.location = (-0.08, -0.02, 1.0)
sol = bowl.modifiers.new('Solidify', 'SOLIDIFY'); sol.thickness = 0.006; sol.offset = -1
sub = bowl.modifiers.new('Subsurf', 'SUBSURF'); sub.levels = 2; sub.render_levels = 2
for p in me.polygons:
    p.use_smooth = True
bm2, bnt, bb, _ = K.material('Ceramic', (0.78, 0.74, 0.66, 1), roughness=0.25, coat=0.5)
bowl.data.materials.append(bm2)

bpy.ops.mesh.primitive_circle_add(vertices=64, radius=0.122, fill_type='NGON',
                                  location=(-0.08, -0.02, 1.116))
broth = bpy.context.object
broth.name = 'Broth'
brm, brnt, brb, _ = K.material('Broth', (0.30, 0.085, 0.025, 1), roughness=0.1)
K.S(brb, 'Coat Weight', 0.7); K.S(brb, 'Coat Roughness', 0.03)
K.S(brb, 'Subsurface Weight', 0.1)
broth.data.materials.append(brm)

noodle_m, _, _, _ = K.material('Noodle', (0.82, 0.70, 0.40, 1), roughness=0.38)
for k in range(4):
    cu = bpy.data.curves.new('Noodle%d' % k, 'CURVE')
    cu.dimensions = '3D'; cu.resolution_u = 12
    cu.bevel_depth = 0.0032; cu.bevel_resolution = 2; cu.use_fill_caps = True
    sp = cu.splines.new('POLY'); npts = 40; sp.points.add(npts - 1)
    ph = k * 0.9
    for i in range(npts):
        a = ph + i * 0.22
        r = 0.020 + 0.072 * (i / (npts - 1))
        sp.points[i].co = (math.cos(a) * r * (1 + 0.1 * math.sin(i * 0.9 + k)),
                           math.sin(a) * r * (1 + 0.1 * math.cos(i * 0.7 + k)),
                           0.002 + 0.004 * math.sin(i * 0.55 + k * 1.3), 1)
    ob = bpy.data.objects.new('Noodle%d' % k, cu)
    bpy.context.collection.objects.link(ob)
    ob.location = (-0.08, -0.02, 1.12)
    ob.data.materials.append(noodle_m)

green, _, _, _ = K.material('Scallion', (0.10, 0.36, 0.10, 1), roughness=0.35)
for i in range(11):
    a = i * 2.4; r = 0.026 + (i % 5) * 0.022
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.0035, depth=0.012,
                                        location=(-0.08 + math.cos(a) * r, -0.02 + math.sin(a) * r, 1.122))
    bpy.context.object.rotation_euler = (0.4, 0.2, a)
    bpy.context.object.data.materials.append(green)

# ---------- 霓虹与灯笼 ----------
sign, sign_em = K.neon_text('NeonNightNoodle', '夜面', 0.20, (0.26, 1.56, 1.66),
                            (1.0, 0.12, 0.025, 1), 4.0)
K.flicker(sign_em, 4.0, [(1, 1.0), (40, 1.0), (42, 0.5), (45, 1.0), (96, 1.0), (98, 0.45), (101, 1.0), (FRAMES, 1.0)])

lantern_m, _, lan_em = K.emission_material('PaperLantern', (1.0, 0.52, 0.22, 1), 2.2)
bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.095,
                                     location=(-0.80, 1.38, 1.82))
lant = bpy.context.object; lant.name = 'Lantern'; lant.scale.z = 1.12
lant.data.materials.append(lantern_m)
K.point_light('LanternLight', (-0.80, 1.34, 1.80), 10, (1.0, 0.48, 0.20), radius=0.10)

# ---------- 角色 ----------
fig = C.build('Ya', loc=(0.02, 0.55, 0), height=1.70, yaw=0.18,
              top=(.034, .038, .048, 1), apron=(.060, .034, .021, 1), hat=(.015, .016, .019, 1))
C.idle(fig, FRAMES, fps=FPS, breath=1.0, sway=0.9, lean=2.2)
C.pose_arms(fig, shoulder=-6, elbow=-22)
C.look(fig, [
    (1, 0, 10, 2), (26, 1, 10, 2), (40, 5, 5, -1), (52, 6, 2, -1),
    (100, 5, 3, -1), (112, 4, 6, 0), (124, 4, 4, 0), (FRAMES, 4, 5, 0),
])
C.blink(fig, [0.9, 2.4, 4.9], fps=FPS)

line_path = LINE or os.path.join(HERE, '..', 'assets', 'cg-line.wav')
os.makedirs(os.path.dirname(os.path.abspath(line_path)), exist_ok=True)
have_line = bool(LINE) or make_line(line_path)
if have_line:
    curve = A.envelope(line_path, fps=FPS, start=0, end=DURATION, gate=0.06, knee=0.5)
else:
    curve = A.procedural(FRAMES, syllables_per_sec=3.2, fps=FPS)
curve = (curve + [0.0] * FRAMES)[:FRAMES]
C.speak(fig, curve, start_frame=1, gain=0.85)

# ---------- 光 ----------
K.area_light('WarmKey', (-0.55, 0.12, 2.02), 20, (1.0, 0.76, 0.52), 0.55, (0.02, 0.55, 1.56))
K.area_light('CoolRim', (0.62, 1.30, 1.96), 6, (0.52, 0.68, 1.0), 0.45, (0.02, 0.58, 1.55))
K.area_light('NeonFill', (0.95, 0.80, 1.58), 3, (1.0, 0.24, 0.07), 0.5, (0.0, 0.55, 1.44))
K.area_light('WarmFill', (0.42, 0.02, 1.40), 4, (1.0, 0.70, 0.50), 0.7, (0.02, 0.55, 1.40))
K.area_light('WallWash', (-0.25, 1.30, 2.35), 6, (1.0, 0.52, 0.30), 1.0, (0, 1.62, 1.45))

# ---------- 蒸汽与雨 ----------
K.steam_volume('Steam', loc=(-0.08, -0.02, 1.28), size=(0.26, 0.26, 0.42), density=2.4,
               frames=(1, FRAMES), fade_z=0.18)
K.rain('Rain', loc=(0.1, 0.70, 2.62), size=2.0, count=900,
       drop_radius=0.0009, drop_length=0.075, speed=-6.0, lifetime=38, frames=(1, FRAMES),
       emission=0.22, color=(0.20, 0.26, 0.36))

# ---------- 机位 ----------
K.camera((0.60, -1.18, 1.58), (0.00, 0.55, 1.33), lens=44, focus=fig['focus'], fstop=2.0,
         frames=(1, FRAMES), move=(0.02, 0.03, -0.01), handheld=0.0015)
K.compositor(scene, threshold=0.8, strength=0.5, size=0.4, distortion=0.01, dispersion=0.006)

stills = [float(x) for x in AT.split(',')] if AT else None
report = K.render_frames(scene, OUT, from_sec=FROM, to_sec=TO, fps=FPS,
                         stills=stills,
                         poster=float(POSTER) if POSTER else None,
                         label='character',
                         extra={'film': 'character', 'duration': DURATION,
                                'voice': os.path.abspath(line_path) if have_line else 'procedural'})
