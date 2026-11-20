"""三镜示范（P4）：cg_film 多镜编排 + 角色走位 + 粒子烘焙。

  13 秒，三镜都从零搭景（导演每镜 reset 一次），成片帧号连续；
  台词用内联 lines（不依赖 cg/voice.json），没有配音时口型走程序化脉冲。

  node tools/cg-render.js --file cg/short.py --samples 8 --at 2.0,5.6,10.2
  node tools/cg-render.js --file cg/short.py --samples 16 --resume
"""
import math
import os
import sys

import bmesh
import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import cg_char as C  # noqa: E402
import cg_film as F  # noqa: E402
import cg_kit as K  # noqa: E402

FPS = int(os.environ.get('CG_FPS', 24))
LIB = os.environ.get('CG_ASSETS') or os.path.expanduser('~/.qoder/tools/cg-library')


def asset(rel):
    path = os.path.join(LIB, rel)
    if not os.path.exists(path):
        raise FileNotFoundError('缺少 CC0 素材: ' + path)
    return path


FILM = F.Film('面摊 · 三镜', samples=16, label='short', lines=[
    {'who': 'yao', 'shot': 's2', 'at': 5.4, 'dur': 2.2, 'text': '又淋着来的？坐吧。'},
    {'who': 'yao', 'shot': 's3', 'at': 9.8, 'dur': 2.0, 'text': '一碗，多下葱。'},
])


def stall(n, rain_count=1200, bowl_at=(-0.08, -0.02)):
    """雨夜面摊：每镜重建一份。返回可复用的焦点/物件。"""
    K.hdri_world(asset('hdri/cobblestone_street_night_2k.hdr'),
                 strength=0.05, rotation_deg=95, saturation=0.45, value=0.95)

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

    bpy.ops.mesh.primitive_plane_add(size=7, location=(0, 1.62, 1.6), rotation=(math.pi / 2, 0, 0))
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

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.20, 0.95))
    counter = bpy.context.object
    counter.name = 'Counter'
    counter.scale = (1.9, 0.60, 0.10)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bev = counter.modifiers.new('Bevel', 'BEVEL'); bev.width = 0.012; bev.segments = 3
    bpy.ops.object.shade_smooth()
    cm, cnt, cb, _ = K.material('SteelCounter', (0.085, 0.090, 0.095, 1), metallic=1.0,
                                roughness=0.3, coat=0.15)
    K.noise_detail(cnt, cb, scale=16, detail=5, strength=0.12, distance=0.002, rough=(0.18, 0.44))
    counter.data.materials.append(cm)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.515, 0.48))
    panel = bpy.context.object
    panel.name = 'CounterFront'
    panel.scale = (1.9, 0.05, 0.94)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    pm, _, _, _ = K.material('DarkSteel', (0.055, 0.05, 0.045, 1), metallic=0.7, roughness=0.4)
    panel.data.materials.append(pm)

    profile = [(0.000, 0.000), (0.032, 0.003), (0.066, 0.017), (0.096, 0.048),
               (0.120, 0.086), (0.132, 0.120), (0.136, 0.140)]
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
    bowl.location = (bowl_at[0], bowl_at[1], 1.0)
    sol = bowl.modifiers.new('Solidify', 'SOLIDIFY'); sol.thickness = 0.006; sol.offset = -1
    sub = bowl.modifiers.new('Subsurf', 'SUBSURF'); sub.levels = 2; sub.render_levels = 2
    for p in me.polygons:
        p.use_smooth = True
    bm2, _, _, _ = K.material('Ceramic', (0.78, 0.74, 0.66, 1), roughness=0.25, coat=0.5)
    bowl.data.materials.append(bm2)

    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=0.122, fill_type='NGON',
                                      location=(bowl_at[0], bowl_at[1], 1.116))
    broth = bpy.context.object
    brm, _, brb, _ = K.material('Broth', (0.30, 0.085, 0.025, 1), roughness=0.1)
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
        ob.location = (bowl_at[0], bowl_at[1], 1.12)
        ob.data.materials.append(noodle_m)

    green, _, _, _ = K.material('Scallion', (0.10, 0.36, 0.10, 1), roughness=0.35)
    for i in range(11):
        a = i * 2.4; r = 0.026 + (i % 5) * 0.022
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.0035, depth=0.012,
                                            location=(bowl_at[0] + math.cos(a) * r,
                                                      bowl_at[1] + math.sin(a) * r, 1.122))
        bpy.context.object.rotation_euler = (0.4, 0.2, a)
        bpy.context.object.data.materials.append(green)

    sign, sign_em = K.neon_text('NeonNightNoodle', '夜面', 0.20, (0.26, 1.56, 1.66),
                                (1.0, 0.12, 0.025, 1), 4.0)
    K.flicker(sign_em, 4.0, [(1, 1.0), (int(n * .35), 1.0), (int(n * .35) + 2, 0.5),
                             (int(n * .35) + 5, 1.0), (n, 1.0)])

    lantern_m, _, _ = K.emission_material('PaperLantern', (1.0, 0.52, 0.22, 1), 2.2)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.095,
                                         location=(-0.80, 1.38, 1.82))
    lant = bpy.context.object; lant.name = 'Lantern'; lant.scale.z = 1.12
    lant.data.materials.append(lantern_m)
    K.point_light('LanternLight', (-0.80, 1.34, 1.80), 10, (1.0, 0.48, 0.20), radius=0.10)

    K.area_light('WarmKey', (-0.55, 0.12, 2.02), 20, (1.0, 0.76, 0.52), 0.55, (0.02, 0.55, 1.56))
    K.area_light('CoolRim', (0.62, 1.30, 1.96), 6, (0.52, 0.68, 1.0), 0.45, (0.02, 0.58, 1.55))
    K.area_light('NeonFill', (0.95, 0.80, 1.58), 3, (1.0, 0.24, 0.07), 0.5, (0.0, 0.55, 1.44))
    K.area_light('WarmFill', (0.42, 0.02, 1.40), 4, (1.0, 0.70, 0.50), 0.7, (0.02, 0.55, 1.40))
    K.area_light('WallWash', (-0.25, 1.30, 2.35), 6, (1.0, 0.52, 0.30), 1.0, (0, 1.62, 1.45))

    K.steam_volume('Steam', loc=(bowl_at[0], bowl_at[1], 1.28), size=(0.26, 0.26, 0.42),
                   density=2.4, frames=(1, n), fade_z=0.18, drift=2.0)
    K.rain('Rain', loc=(0.4, 0.5, 2.7), size=3.4, count=rain_count,
           drop_radius=0.0009, drop_length=0.075, speed=-6.0, lifetime=38, frames=(1, n),
           emission=0.22, color=(0.20, 0.26, 0.36))
    return {'bowl': bowl}


def boss(name='Yao'):
    rig = C.build(name, loc=(0.02, 0.55, 0), height=1.72, yaw=0.16,
                  top=(.030, .034, .042, 1), apron=(.055, .032, .020, 1),
                  hat=(.014, .015, .018, 1))
    C.pose_arms(rig, shoulder=-6, elbow=-22)
    return rig


def speech(rig, lines, who, gain=.9):
    for ln in lines.get(who, []):
        C.speak(rig, ln['curve'], start_frame=ln['start_frame'], gain=gain)


# ---------------------------------------------------------------- 镜头

def wide(ctx):
    n, fps = ctx['frames'], ctx['fps']
    stall(n, rain_count=900)
    yao = boss()
    C.idle(yao, n, fps=fps, breath=1.0, sway=.8, lean=2.2)
    C.look(yao, [(1, 14, 6, 1), (int(n * .55), 9, 3, 1), (n, 12, 4, 1)])
    C.blink(yao, [0.8, 2.9], fps=fps)

    girl = C.build('Man', loc=(1.78, -0.98, 0), height=1.58, yaw=math.radians(-88),
                   top=(.045, .050, .062, 1), apron=(.030, .034, .042, 1),
                   pants=(.018, .018, .020, 1))
    C.walk(girl, n, fps=fps, stride=.8, step_hz=1.05, phase=.3)
    C.move(girl, [(1, 1.78, -0.98, -88), (n, 1.00, -0.98, -100)])
    C.blink(girl, [1.2, 3.3], fps=fps)
    C.look(girl, [(1, -8, 2, 0), (int(n * .6), -2, -3, 0), (n, 2, -5, 0)])

    K.camera((2.05, -3.15, 1.80), (0.50, 0.35, 1.28), lens=32, focus=girl['focus'],
             fstop=2.6, frames=(1, n), move=(-0.012, 0.018, -0.005), handheld=0.002)
    K.compositor(ctx['scene'], threshold=0.8, strength=0.5, size=0.4, distortion=0.01, dispersion=0.006)


def close(ctx):
    n, fps = ctx['frames'], ctx['fps']
    stall(n, rain_count=800)
    yao = boss()
    C.idle(yao, n, fps=fps, breath=1.1, sway=.7, lean=2.6)
    C.look(yao, [(1, 10, 8, 1), (int(n * .3), 12, 3, 0), (n, 8, 5, 1)])
    C.blink(yao, [0.6, 2.2, 3.6], fps=fps)
    speech(yao, ctx['lines'], 'yao')

    K.camera((0.46, -1.58, 1.66), (0.01, 0.55, 1.42), lens=58, focus=yao['focus'],
             fstop=2.0, frames=(1, n), move=(0.012, 0.02, -0.004), handheld=0.0012)
    K.compositor(ctx['scene'], threshold=0.8, strength=0.5, size=0.4, distortion=0.01, dispersion=0.006)


def over_shoulder(ctx):
    n, fps = ctx['frames'], ctx['fps']
    stall(n, rain_count=900, bowl_at=(0.24, 0.02))
    yao = boss()
    C.idle(yao, n, fps=fps, breath=1.0, sway=.8, lean=2.4)
    C.look(yao, [(1, 2, 6, 1), (n, -1, 8, 0)])
    C.blink(yao, [1.1, 3.4], fps=fps)
    speech(yao, ctx['lines'], 'yao')

    girl = C.build('Man', loc=(0.50, -0.78, 0), height=1.58, yaw=math.radians(178),
                   top=(.045, .050, .062, 1), apron=(.030, .034, .042, 1),
                   pants=(.018, .018, .020, 1))
    C.idle(girl, n, fps=fps, breath=.9, sway=1.0, lean=1.0)
    C.pose_arms(girl, shoulder=-4, elbow=-16)
    C.look(girl, [(1, -2, -4, 0), (n, -4, -6, 0)])
    C.blink(girl, [1.6, 3.9], fps=fps)

    K.camera((0.05, -2.05, 1.82), (0.02, 0.55, 1.34), lens=40, focus=yao['focus'],
             fstop=2.2, frames=(1, n), move=(-0.008, 0.014, 0.0), handheld=0.0014)
    K.compositor(ctx['scene'], threshold=0.8, strength=0.5, size=0.4, distortion=0.01, dispersion=0.006)


FILM.add('s1', 4.2, wide, note='雨里走近面摊', bake=True,
         cast={'yao': 'beanie-apron', 'man': 'dark-coat'})
FILM.add('s2', 4.2, close, note='老板抬头招呼', bake=True,
         cast={'yao': 'beanie-apron'})
FILM.add('s3', 4.6, over_shoulder, note='过肩：她坐下前', bake=True,
         cast={'yao': 'beanie-apron', 'man': 'dark-coat'})

FILM.run()
