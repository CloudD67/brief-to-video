"""paper — 3D 纸剧场套件（Blender 端）。

MV 的 3D 引擎不是写实 CG，而是一座**纸搭的微缩剧场**：所有景片都是带厚度的
纸剪切件，分层站在真实三维空间里，由台灯光照、由真景深摄影。引擎只换渲染方式，
分镜节拍、歌词、音乐与交付契约沿用 2D 剪纸 MV。

用法（mv3d.py）：
  import paper as P
  sky = P.sheet('Sky', 3.0, 1.4, P.paper_mat('SkyMat', '#2b3f63'), loc=(0, 0.5, 0.7))
  sea = P.wave('Sea', 3.0, 0.05, P.paper_mat('SeaMat', '#14283f'), ...)
  girl = P.figure('stand', 0.20, loc=(-0.2, 0, 0.0), dir=1, ink=ink)
  P.key_sin(girl['root'], frames, loc=(0, 0, 0.0015), rot=(0, 0, 0.01), speed=1.5)

约定：
  - 纸面朝镜头（-Y 方向），纸厚沿 +Y；剪切件多边形画在 XZ 平面，单位米。
  - 每张纸都有切边材质（rim）：solidify 的 rim 用浅色「纸芯」，这是剪纸的白边。
  - 微缩尺度：纸人 0.15–0.35m，景片 0.5–3m；f/1.8–2.8 的近距机位才像微缩摄影。
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

import cg_kit as K

S = K.set_float


# ---------------------------------------------------------------- 颜色 / 材质

def hex_rgb(text):
    """'#173450' → 线性 RGB（Principled 的 Base Color 是线性空间）。"""
    h = str(text).lstrip('#')
    if len(h) != 6:
        raise ValueError('颜色必须是 #rrggbb：' + str(text))
    raw = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]

    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return tuple(lin(c) for c in raw)


def paper_mat(name, color, rough=0.88, fiber=1.0, mottle=0.16, sheen=0.18):
    """纸张：两种近色的纸浆斑驳 + 纤维凹凸 + 一点织物反光。color 可以是 hex 或 RGB。"""
    rgb = hex_rgb(color) if isinstance(color, str) else tuple(color)
    m, nt, bsdf, _ = K.material(name, (*rgb, 1), roughness=rough)
    if sheen:
        S(bsdf, 'Sheen Weight', sheen)
        S(bsdf, 'Sheen Roughness', 0.6)

    tc = nt.nodes.new('ShaderNodeTexCoord')
    # 大尺度纸浆斑驳：两色在 [0,1] 内轻微起伏，不是渐变滤镜
    mot = nt.nodes.new('ShaderNodeTexNoise')
    S(mot, 'Scale', 7.0); S(mot, 'Detail', 4.0); S(mot, 'Roughness', 0.55)
    nt.links.new(tc.outputs['Object'], mot.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    lo = tuple(max(0.0, c * (1.0 - mottle)) for c in rgb)
    hi = tuple(min(1.0, c * (1.0 + mottle * 0.5)) for c in rgb)
    ramp.color_ramp.elements[0].color = (*lo, 1)
    ramp.color_ramp.elements[1].color = (*hi, 1)
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[1].position = 0.72
    nt.links.new(mot.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])

    # 纤维：细噪波只做凹凸，不动颜色
    fib = nt.nodes.new('ShaderNodeTexNoise')
    S(fib, 'Scale', 110.0 * fiber); S(fib, 'Detail', 6.0); S(fib, 'Roughness', 0.6)
    nt.links.new(tc.outputs['Object'], fib.inputs['Vector'])
    bump = nt.nodes.new('ShaderNodeBump')
    S(bump, 'Strength', 0.22); S(bump, 'Distance', 0.0012)
    nt.links.new(fib.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return m


def edge_mat(name='PaperEdge', color='#e8ddc4'):
    """纸芯色：剪切件侧壁。比纸面浅、略粗，读成「白卡纸的切边」。"""
    m, nt, bsdf, _ = K.material(name, (*hex_rgb(color), 1), roughness=0.72)
    K.noise_detail(nt, bsdf, scale=160, detail=4, strength=0.18, distance=0.0015)
    return m


def glow_mat(name, color, strength=2.0):
    m, nt, em = K.emission_material(name, (*hex_rgb(color), 1), strength)
    return m


def beam_mat(name, color='#ffc473', strength=0.55, alpha=0.10):
    """光束 = 一张卷起来的半透明纸：近端浓、远端散。必须背面剔除，否则双面叠加成实心楔形。"""
    m, nt, bsdf, _ = K.material(name, (*hex_rgb(color), 1), roughness=0.55,
                                emission=(*hex_rgb(color), 1), emission_strength=strength,
                                alpha=alpha)
    try:
        m.surface_render_method = 'BLENDED'
    except Exception:
        try:
            m.blend_method = 'BLEND'
        except Exception:
            pass
    m.use_backface_culling = True
    return m


# ---------------------------------------------------------------- 基础件

def _link(obj):
    bpy.context.collection.objects.link(obj)
    return obj


def _solid(obj, mat, edge, depth, bevel):
    obj.data.materials.append(mat)
    if edge is not None:
        obj.data.materials.append(edge)
    solid = obj.modifiers.new('PaperDepth', 'SOLIDIFY')
    solid.thickness = depth
    solid.offset = 0.0
    solid.use_rim = True
    solid.material_offset = 0
    solid.material_offset_rim = 1 if edge is not None else 0
    if bevel:
        bev = obj.modifiers.new('PaperEdge', 'BEVEL')
        bev.width = bevel
        bev.segments = 2
        bev.limit_method = 'ANGLE'
        bev.angle_limit = math.radians(40)
    return obj


def _poly_mesh(name, pts):
    mesh = bpy.data.meshes.new(name + 'Mesh')
    bm = bmesh.new()
    verts = [bm.verts.new((x, 0.0, z)) for (x, z) in pts]
    try:
        face = bm.faces.new(verts)
        bmesh.ops.triangulate(bm, faces=[face])
    except ValueError:
        pass
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def object_of(name, mesh, loc=(0, 0, 0), rot=(0, 0, 0)):
    obj = bpy.data.objects.new(name, mesh)
    _link(obj)
    obj.location = loc
    obj.rotation_euler = rot
    return obj


def cut(name, pts, mat, edge=None, depth=0.005, loc=(0, 0, 0), rot=(0, 0, 0), bevel=0.0012):
    """一张剪切纸片：pts 是 XZ 平面的闭合轮廓 [(x,z), …]，沿 +Y 给厚度。"""
    obj = object_of(name, _poly_mesh(name, pts), loc, rot)
    return _solid(obj, mat, edge, depth, bevel)


def pivot(name, loc, parent=None):
    e = bpy.data.objects.new(name, None)
    _link(e)
    e.empty_display_size = 0.02
    e.location = loc
    if parent is not None:
        e.parent = parent
    return e


def child(obj, parent):
    obj.parent = parent
    return obj


def sheet(name, w, h, mat, loc=(0, 0, 0), rot=(0, 0, 0), bow=0.012, seg=(14, 9)):
    """大幅景片：微弯的纸幕，弓背朝镜头，边缘光会顺着弧度走。"""
    nx, nz = seg
    verts = []
    for iz in range(nz + 1):
        tz = iz / nz
        for ix in range(nx + 1):
            tx = ix / nx
            x = (tx - 0.5) * w
            z = (tz - 0.5) * h
            y = bow * math.sin(math.pi * tx) * math.sin(math.pi * tz)
            verts.append((x, y, z))
    faces = []
    for iz in range(nz):
        for ix in range(nx):
            a = iz * (nx + 1) + ix
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    mesh = bpy.data.meshes.new(name + 'Mesh')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = object_of(name, mesh, loc, rot)
    _solid(obj, mat, None, 0.0018, 0)
    return obj


def wave(name, w, amp, mat, edge, loc=(0, 0, 0), rot=(0, 0, 0), cycles=2.2,
         phase=0.0, base=0.05, seg=28, depth=0.006):
    """波浪条：上缘起伏的纸带。多条不同深度 + 不同相位 = 真视差的海面。"""
    pts = []
    for i in range(seg + 1):
        t = i / seg
        x = (t - 0.5) * w
        z = amp * math.sin(2 * math.pi * cycles * t + phase) * (0.65 + 0.35 * math.sin(3.1 * math.pi * t + phase * 1.7))
        pts.append((x, z + base))
    pts.append((w / 2, -base))
    pts.append((-w / 2, -base))
    return cut(name, pts, mat, edge, depth=depth, loc=loc, rot=rot, bevel=0.0009)


def cone_beam(name, start, end, r_near=0.02, r_far=0.30, mat=None, depth=None):
    """从灯口射出的锥形光束（纸做的光）。start 灯口，end 远端。"""
    a = Vector(start)
    b = Vector(end)
    d = b - a
    length = d.length
    mid = a + d * 0.5
    bpy.ops.mesh.primitive_cone_add(vertices=28, radius1=r_near, radius2=r_far,
                                    depth=length, location=mid)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    if mat is not None:
        obj.data.materials.append(mat)
    obj.visible_shadow = False
    return obj


def beam_swing(name, start, end, r_near=0.015, r_far=0.26, mat=None,
               frames=(1, 75), sweep=5.0, speed=1.0, phase=0.0):
    """挂在灯口枢轴上的光束：底端固定，整条缓慢扫动。

    锥体几何沿局部 +Z 从灯口长出，再挂到位于灯口的空物体上；
    枢轴绕 Y 摆动即可在画面里读出「光在扫海」。
    """
    s = Vector(start)
    d = Vector(end) - s
    pv = pivot(name + 'Pivot', tuple(s))
    obj = cone_beam(name, (0, 0, 0), tuple(d), r_near=r_near, r_far=r_far, mat=mat)
    obj.data.transform(Matrix.Translation((0, 0, d.length / 2)))
    obj.parent = pv
    obj.location = (0, 0, 0)
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    f0, f1 = frames
    for f in range(f0, f1 + 1, 5):
        t = (f - f0) / max(1, f1 - f0)
        pv.rotation_euler = (0, math.radians(sweep) * math.sin(2 * math.pi * (t * speed + phase)), 0)
        pv.keyframe_insert('rotation_euler', frame=f)
    return obj, pv


def disc(name, r, mat, edge=None, depth=0.004, loc=(0, 0, 0), rot=(0, 0, 0), bevel=0.0008, seg=40):
    """圆片：月亮 / 太阳 / 光斑。"""
    pts = [(r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg))
           for i in range(seg)]
    return cut(name, pts, mat, edge, depth=depth, loc=loc, rot=rot, bevel=bevel)


def world(color='#0a1018', strength=0.32):
    w = bpy.data.worlds.new('PaperWorld')
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    S(bg, 'Color', (*hex_rgb(color), 1))
    S(bg, 'Strength', strength)
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    return w


# ---------------------------------------------------------------- 纸人

def _mirror(pts, flip):
    return [(-x if flip else x, z) for (x, z) in pts]


STAND = [
    (-0.105, 0.00), (-0.118, 0.06), (-0.112, 0.16), (-0.100, 0.26),
    (-0.082, 0.38), (-0.078, 0.48), (-0.092, 0.56), (-0.088, 0.62),
    (-0.050, 0.678), (-0.012, 0.690), (0.030, 0.682), (0.058, 0.646),
    (0.070, 0.596), (0.058, 0.556), (0.044, 0.508), (0.066, 0.420),
    (0.086, 0.300), (0.098, 0.170), (0.104, 0.060), (0.092, 0.00)
]

WALK = [
    (-0.108, 0.00), (-0.120, 0.14), (-0.108, 0.30), (-0.090, 0.44),
    (-0.080, 0.54), (-0.088, 0.60), (-0.052, 0.676), (-0.010, 0.690),
    (0.032, 0.680), (0.060, 0.644), (0.072, 0.596), (0.060, 0.550),
    (0.048, 0.500), (0.072, 0.400), (0.070, 0.300), (0.150, 0.276),
    (0.158, 0.240), (0.086, 0.240), (0.092, 0.130), (0.080, 0.014),
    (0.050, 0.010), (0.046, 0.130), (0.010, 0.246), (-0.042, 0.250),
    (-0.042, 0.120), (-0.060, 0.020), (-0.086, 0.014)
]

RUN = [
    (-0.120, 0.00), (-0.128, 0.14), (-0.108, 0.30), (-0.078, 0.44),
    (-0.070, 0.54), (-0.088, 0.60), (-0.046, 0.678), (-0.004, 0.690),
    (0.036, 0.676), (0.066, 0.636), (0.082, 0.590), (0.070, 0.545),
    (0.056, 0.500), (0.096, 0.420), (0.128, 0.330), (0.196, 0.300),
    (0.208, 0.264), (0.136, 0.262), (0.108, 0.180), (0.086, 0.030),
    (0.052, 0.020), (0.070, 0.150), (0.030, 0.250), (-0.030, 0.256),
    (-0.052, 0.140), (-0.104, 0.028), (-0.126, 0.020)
]

REACH = [
    (-0.105, 0.00), (-0.118, 0.06), (-0.112, 0.16), (-0.100, 0.26),
    (-0.082, 0.38), (-0.078, 0.48), (-0.092, 0.56), (-0.088, 0.62),
    (-0.050, 0.678), (-0.012, 0.690), (0.030, 0.682), (0.058, 0.646),
    (0.070, 0.596), (0.058, 0.556), (0.046, 0.508), (0.062, 0.400),
    (0.080, 0.280), (0.092, 0.160), (0.098, 0.060), (0.088, 0.00)
]

HEAD = [
    (-0.056, 0.742), (-0.062, 0.796), (-0.050, 0.842), (-0.020, 0.868),
    (0.018, 0.872), (0.050, 0.856), (0.064, 0.828), (0.074, 0.806),
    (0.060, 0.798), (0.054, 0.780), (0.036, 0.762), (0.026, 0.700),
    (-0.010, 0.700), (-0.028, 0.738)
]

BUN = [
    (-0.072, 0.764), (-0.099, 0.776), (-0.111, 0.800), (-0.099, 0.824),
    (-0.072, 0.836), (-0.045, 0.824), (-0.033, 0.800), (-0.045, 0.776)
]

SLEEP = [
    (-0.130, 0.000), (-0.140, 0.060), (-0.128, 0.130), (-0.170, 0.168),
    (-0.238, 0.178), (-0.250, 0.144), (-0.196, 0.130), (-0.150, 0.100),
    (-0.116, 0.040), (-0.080, 0.030), (-0.052, 0.070), (0.020, 0.082),
    (0.076, 0.090), (0.118, 0.130), (0.128, 0.196), (0.112, 0.260),
    (0.070, 0.300), (0.020, 0.312), (-0.026, 0.300), (-0.040, 0.330),
    (-0.086, 0.338), (-0.112, 0.312), (-0.104, 0.270), (-0.084, 0.240),
    (-0.098, 0.180), (-0.120, 0.120), (-0.146, 0.070)
]

MAN = [
    (-0.120, 0.00), (-0.130, 0.08), (-0.118, 0.24), (-0.100, 0.40),
    (-0.094, 0.52), (-0.108, 0.60), (-0.104, 0.66), (-0.070, 0.700),
    (-0.034, 0.710), (0.010, 0.702), (0.044, 0.672), (0.058, 0.630),
    (0.046, 0.590), (0.030, 0.548), (0.048, 0.470), (0.062, 0.360),
    (0.070, 0.220), (0.076, 0.080), (0.064, 0.00)
]

MAN_HEAD = [
    (-0.066, 0.756), (-0.074, 0.812), (-0.058, 0.856), (-0.020, 0.878),
    (0.020, 0.876), (0.052, 0.854), (0.062, 0.826), (0.072, 0.818),
    (0.056, 0.812), (0.050, 0.792), (0.030, 0.772), (0.024, 0.700),
    (-0.016, 0.700), (-0.036, 0.748)
]

MAN_CAP = [
    (-0.090, 0.846), (-0.030, 0.884), (0.030, 0.888), (0.062, 0.872),
    (0.106, 0.862), (0.108, 0.846), (0.062, 0.840), (-0.020, 0.838)
]

BUST = [
    (-0.300, -0.180), (-0.310, -0.060), (-0.260, 0.020), (-0.210, 0.060),
    (-0.180, 0.100), (-0.150, 0.160), (-0.140, 0.230), (-0.155, 0.300),
    (-0.145, 0.372), (-0.108, 0.432), (-0.062, 0.474), (-0.016, 0.500),
    (0.034, 0.506), (0.082, 0.490), (0.110, 0.456), (0.128, 0.420),
    (0.132, 0.396), (0.122, 0.372), (0.152, 0.334), (0.130, 0.318),
    (0.142, 0.300), (0.138, 0.278), (0.120, 0.262), (0.126, 0.240),
    (0.104, 0.212), (0.088, 0.196), (0.080, 0.150), (0.112, 0.100),
    (0.176, 0.040), (0.228, -0.020), (0.240, -0.180)
]

BUST_BUN = [
    (-0.112, 0.358), (-0.142, 0.370), (-0.154, 0.400), (-0.142, 0.430),
    (-0.112, 0.442), (-0.082, 0.430), (-0.070, 0.400), (-0.082, 0.370)
]

BACK = [
    (-0.150, 0.000), (-0.158, 0.080), (-0.146, 0.200),
    (-0.138, 0.330), (-0.148, 0.470), (-0.184, 0.540),
    (-0.182, 0.586), (-0.138, 0.630), (-0.120, 0.664),
    (-0.060, 0.692), (0.060, 0.692),
    (0.120, 0.664), (0.138, 0.630), (0.182, 0.586),
    (0.184, 0.540), (0.148, 0.470), (0.138, 0.330),
    (0.146, 0.200), (0.158, 0.080), (0.150, 0.000),
    (0.060, 0.000), (0.062, 0.120), (0.046, 0.240),
    (-0.046, 0.240), (-0.062, 0.120), (-0.060, 0.000)
]

BACKHEAD = [
    (-0.055, 0.700), (-0.070, 0.748), (-0.062, 0.806), (-0.030, 0.846),
    (0.030, 0.846), (0.062, 0.806), (0.070, 0.748), (0.055, 0.700)
]

BACKBUN = [
    (-0.044, 0.798), (-0.052, 0.828), (-0.028, 0.860), (0.028, 0.860),
    (0.052, 0.828), (0.044, 0.798)
]


def figure(pose, h, loc=(0, 0, 0), dir=1, ink=None, edge=None, depth=0.004):
    """纸人：单张剪影（walk/run/stand/reach/sleep/back）+ 头。返回 root / head / arm / arms。

    pose='reach' / 'wipe' 时手臂是独立件，挂在 pivot 上，可以真的抬起来；
    pose='press' 是从背面双手按在玻璃上的姿势，两条手臂各自上抬。
    dir=-1 时左右翻转（面向左）；'back' / 'press' 是正背面，不翻转。
    """
    flip = dir < 0 and pose not in ('back', 'press')
    root = pivot('Fig_' + pose, loc)
    back = pose in ('back', 'press')

    body_pts = {'stand': STAND, 'walk': WALK, 'run': RUN, 'reach': REACH,
                'wipe': REACH, 'sleep': SLEEP, 'man': MAN,
                'back': BACK, 'press': BACK}[pose]
    body = cut('FigBody', _mirror(body_pts, flip), ink, edge, depth=depth, bevel=0.003)
    body.scale = (h, h, h)
    body.parent = root

    head = None
    if pose != 'sleep':
        if pose == 'man':
            hp = MAN_HEAD
        elif back:
            hp = BACKHEAD
        else:
            hp = HEAD
        head = cut('FigHead', _mirror(hp, flip), ink, edge,
                   depth=depth * 1.02, bevel=0.003)
        head.parent = root
        head.scale = (h, h, h)
        head.location = (0, -0.0015, 0.0)
        if pose == 'man':
            cap = cut('FigCap', _mirror(MAN_CAP, flip), ink, edge,
                      depth=depth * 1.05, bevel=0.003)
            cap.parent = root
            cap.scale = (h, h, h)
            cap.location = (0, -0.003, 0)
        else:
            bun_pts = BACKBUN if back else BUN
            bun = cut('FigBun', _mirror(bun_pts, flip), ink, edge,
                      depth=depth * 1.05, bevel=0.003)
            bun.parent = root
            bun.scale = (h, h, h)
            bun.location = (0, -0.003, 0)

    arm = None
    arm_pivot = None
    arms = []
    if pose in ('reach', 'wipe'):
        shoulder = ((0.03 if flip else -0.03) * h, -0.005, 0.60 * h)
        arm_pivot = pivot('FigArmPivot', (0, 0, 0), parent=root)
        arm_pivot.location = shoulder
        arm_pts = [(-0.014, 0.0), (0.014, 0.0), (0.012, -0.130), (0.008, -0.190),
                   (-0.008, -0.190), (-0.012, -0.130)]
        arm = cut('FigArm', arm_pts, ink, edge, depth=depth * 0.9, bevel=0.002)
        arm.parent = arm_pivot
        arm.scale = (h, h, h)
        lift = math.radians(-118 if pose == 'reach' else -70)
        arm_pivot.rotation_euler = (0, -lift if flip else lift, 0)
    elif pose == 'press':
        for side in (-1, 1):
            shoulder = (side * 0.072 * h, -0.006, 0.60 * h)
            arm_pivot = pivot('FigArmPivot', (0, 0, 0), parent=root)
            arm_pivot.location = shoulder
            arm_pts = [(-0.013, 0.0), (0.013, 0.0), (0.011, -0.120), (0.007, -0.180),
                       (-0.007, -0.180), (-0.011, -0.120)]
            piece = cut('FigArm', arm_pts, ink, edge, depth=depth * 0.9, bevel=0.002)
            piece.parent = arm_pivot
            piece.scale = (h, h, h)
            hand = cut('FigHand', [(-0.020, -0.180), (0.020, -0.180),
                                   (0.024, -0.206), (0.010, -0.220), (-0.012, -0.218),
                                   (-0.022, -0.200)],
                       ink, edge, depth=depth * 0.92, bevel=0.0016)
            hand.parent = arm_pivot
            hand.scale = (h, h, h)
            arm_pivot.rotation_euler = (0, side * math.radians(150), 0)
            arms.append(arm_pivot)

    return dict(root=root, head=head, arm=arm, arm_pivot=arm_pivot, arms=arms)


def bust(h, loc=(0, 0, 0), dir=1, ink=None, edge=None, tear=None):
    """胸像：特写用的头肩剪影（侧脸）。tear 给一滴纸泪。

    发髻不描奶油纸边：它必须是轮廓上的一个凸起，而不是贴上去的圆片。
    """
    flip = dir < 0
    root = pivot('Bust', loc)
    body = cut('BustBody', _mirror(BUST, flip), ink, edge, depth=0.006, bevel=0.0012)
    body.parent = root
    body.scale = (h, h, h)
    bun = cut('BustBun', _mirror(BUST_BUN, flip), ink, None, depth=0.006, bevel=0.0012)
    bun.parent = root
    bun.scale = (h, h, h)
    bun.location = (0, -0.0015, 0)
    drop = None
    if tear:
        drop = cut('Tear', [(-0.004, 0.0), (0.004, 0.0), (0.009, -0.012), (0.009, -0.026),
                            (0.004, -0.036), (0.0, -0.039), (-0.004, -0.036),
                            (-0.009, -0.026), (-0.009, -0.012)],
                   tear, None, depth=0.0012, bevel=0.0004)
        drop.parent = root
        drop.scale = (h, h, h)
        drop.location = (0.070 * h * (-1 if flip else 1), -0.012, 0.350 * h)
    return dict(root=root, head=body, tear=drop)


# ---------------------------------------------------------------- 道具

PALM = [(-0.058, -0.055), (-0.062, 0.000), (-0.052, 0.038), (-0.020, 0.048),
        (0.020, 0.048), (0.052, 0.038), (0.062, 0.000), (0.058, -0.055),
        (0.030, -0.070), (-0.030, -0.070)]

THUMB = [(0.046, 0.028), (0.078, 0.012), (0.092, -0.020), (0.082, -0.048),
         (0.058, -0.040), (0.048, -0.006)]

WRIST = [(-0.026, -0.062), (0.026, -0.062), (0.030, -0.170), (-0.030, -0.170)]

FINGERS = [  # (基部 x, 宽, 长, 张开角)
    (-0.040, 0.021, 0.070, -12), (-0.013, 0.022, 0.082, -4),
    (0.014, 0.022, 0.078, 4), (0.041, 0.020, 0.062, 13)
]


def _finger_pts(x0, w, ln, ang):
    ca, sa = math.cos(ang), math.sin(ang)

    def T(x, z):
        return (x0 + x * ca - z * sa, 0.030 + x * sa + z * ca)

    return [T(-w / 2, 0), T(w / 2, 0), T(w / 2, ln * 0.78), T(w * 0.38, ln),
            T(-w * 0.38, ln), T(-w / 2, ln * 0.78)]


def pressed_hands(spread=0.150, z=0.30, y=0.0, s=1.0, tilt=8,
                  ink=None, edge=None, depth=0.004):
    """正对镜头的两只手掌压在玻璃上（掌心 + 四指 + 拇指 + 小臂）。返回 root / hands。"""
    root = pivot('PressedHands', (0, y, z))
    hands = []
    for side in (-1, 1):
        h = pivot('Hand', (side * spread, 0, 0), parent=root)
        h.rotation_euler = (0, side * math.radians(tilt), 0)
        for nm, pts, d in (('Palm', PALM, depth),
                           ('Wrist', WRIST, depth * 0.9),
                           ('Thumb', THUMB, depth * 0.95)):
            part = cut('Hand' + nm, _mirror(pts, side < 0), ink, edge,
                       depth=d, bevel=0.002)
            part.parent = h
        for i, (fx, fw, fl, fa) in enumerate(FINGERS):
            part = cut('HandFinger%d' % i,
                       _mirror(_finger_pts(fx, fw, fl, math.radians(fa)), side < 0),
                       ink, edge, depth=depth * 0.95, bevel=0.002)
            part.parent = h
        hands.append(h)
    return dict(root=root, hands=hands)


def boat(s, loc=(0, 0, 0), rot=(0, 0, 0), hull=None, sail=None, edge=None,
         lantern=False, lantern_mat=None):
    """纸船：船壳 + 桅杆 + 帆。s 是船长（米）。返回 root / hull / lantern。"""
    root = pivot('Boat', loc)
    root.rotation_euler = rot
    hull_pts = [(-0.5, 0.06), (-0.42, -0.02), (0.30, -0.05), (0.50, 0.02),
                (0.46, 0.07), (0.10, 0.09), (-0.30, 0.10)]
    body = cut('BoatHull', hull_pts, hull, edge, depth=0.004, bevel=0.001)
    body.parent = root
    body.scale = (s, s, s)
    mast = cut('BoatMast', [(-0.007, 0.08), (0.007, 0.08), (0.005, 0.60), (-0.005, 0.60)],
               hull, edge, depth=0.003, bevel=0.0006)
    mast.parent = root
    mast.scale = (s, s, s)
    sail_pts = [(0.010, 0.10), (0.010, 0.52), (0.30, 0.14)]
    sail_mesh = cut('BoatSail', sail_pts, sail, edge, depth=0.0025, bevel=0.0006)
    sail_mesh.parent = root
    sail_mesh.scale = (s, s, s)
    lamp = None
    if lantern:
        lamp = cut('BoatLantern', [(-0.03, 0), (0.03, 0), (0.026, 0.075), (0, 0.09), (-0.026, 0.075)],
                   lantern_mat, edge, depth=0.003, bevel=0.0006)
        lamp.parent = root
        lamp.scale = (s, s, s)
        lamp.location = (0.34 * s, -0.02, 0.10 * s)
    return dict(root=root, hull=body, mast=mast, sail=sail_mesh, lantern=lamp)


def lighthouse(loc=(0, 0, 0), h=0.75, paper=None, edge=None, trim=None, glass=None,
               lamp_color='#ffd9a0', lit=True):
    """灯塔：礁石 + 塔身 + 灯室 + 灯。返回 root / lamp(点光) / glow / lamp_pos。"""
    root = pivot('Tower', loc)
    rock_pts = [(-0.30, 0.00), (-0.26, 0.09), (-0.16, 0.15), (-0.06, 0.17),
                (0.06, 0.16), (0.18, 0.12), (0.28, 0.05), (0.32, 0.00)]
    rock = cut('TowerRock', rock_pts, paper, edge, depth=0.018, bevel=0.002)
    rock.parent = root
    rock.scale = (h, h, h)

    tower_pts = [(-0.085, 0.14), (-0.062, 0.72), (-0.078, 0.74), (-0.082, 0.78),
                 (-0.055, 0.80), (0.055, 0.80), (0.082, 0.78), (0.078, 0.74),
                 (0.062, 0.72), (0.085, 0.14)]
    tower = cut('TowerBody', tower_pts, paper, edge, depth=0.010, bevel=0.0018)
    tower.parent = root
    tower.scale = (h, h, h)

    band = cut('TowerBand', [(-0.066, 0.44), (0.066, 0.44), (0.069, 0.50), (-0.069, 0.50)],
               trim, edge, depth=0.011, bevel=0.0008)
    band.parent = root
    band.scale = (h, h, h)

    room = cut('TowerRoom', [(-0.052, 0.80), (0.052, 0.80), (0.052, 0.855), (-0.052, 0.855)],
               glass, edge, depth=0.010, bevel=0.0008)
    room.parent = root
    room.scale = (h, h, h)

    roof_pts = [(-0.070, 0.855), (0.070, 0.855), (0.0, 0.925)]
    roof = cut('TowerRoof', roof_pts, trim, edge, depth=0.010, bevel=0.001)
    roof.parent = root
    roof.scale = (h, h, h)

    lamp_pos = (loc[0], loc[1] - 0.02, loc[2] + 0.828 * h)
    glow = cut('TowerGlow', [(-0.020, 0), (0.020, 0), (0.020, 0.030), (-0.020, 0.030)],
               glow_mat('TowerGlowMat', lamp_color, 4.5) if lit else glass, None,
               depth=0.006, bevel=0.0008)
    glow.parent = root
    glow.scale = (h, h, h)
    glow.location = (0, -0.012, 0.798 * h)

    light = (K.point_light('TowerLamp', lamp_pos, 3.0, (1.0, 0.66, 0.32), radius=0.02)
             if lit else None)
    return dict(root=root, lamp=light, glow=glow, lamp_pos=lamp_pos)


def lamp_lantern(loc=(0, 0, 0), scale=1.0, glass=None, metal=None, edge=None,
                 light_color=(1.0, 0.62, 0.26)):
    """手提油灯 / 桌面灯：金属框 + 玻璃罩 + 火焰 + 点光。返回 root / light / flame。"""
    if glass is None:
        glass = paper_mat('LanternGlass', '#3d2a1c', mottle=0.10, sheen=0.22)
    if metal is None:
        metal = paper_mat('LanternMetal', '#14100d', mottle=0.08, sheen=0.12)
    if edge is None:
        edge = edge_mat()
    root = pivot('Lantern', loc)
    body = cut('LanternBody', [(-0.032, 0), (0.032, 0), (0.038, 0.02), (0.030, 0.145),
                               (-0.030, 0.145), (-0.038, 0.02)],
               glass, edge, depth=0.032, bevel=0.0008)
    body.parent = root
    body.scale = (scale, scale, scale)
    frame = cut('LanternFrame', [(-0.040, 0.145), (0.040, 0.145), (0.028, 0.185),
                                 (0.0, 0.198), (-0.028, 0.185)],
                metal, edge, depth=0.034, bevel=0.0006)
    frame.parent = root
    frame.scale = (scale, scale, scale)
    base = cut('LanternBase', [(-0.044, 0.0), (0.044, 0.0), (0.040, -0.018), (-0.040, -0.018)],
               metal, edge, depth=0.036, bevel=0.0006)
    base.parent = root
    base.scale = (scale, scale, scale)
    for i, bx in enumerate((-0.024, 0.0, 0.024)):
        bar = cut('LanternMullion%d' % i,
                  [(bx - 0.0035, 0.022), (bx + 0.0035, 0.022),
                   (bx + 0.0035, 0.144), (bx - 0.0035, 0.144)],
                  metal, None, depth=0.004, bevel=0.0004)
        bar.parent = root
        bar.scale = (scale, scale, scale)
        bar.location = (0, -0.017, 0)
    flame = cut('Flame', [(-0.010, 0.028), (-0.014, 0.056), (-0.006, 0.086), (0.0, 0.100),
                          (0.008, 0.080), (0.012, 0.050), (0.006, 0.030)],
                glow_mat('LanternFlame', '#ffca7a', 14.0), None, depth=0.014, bevel=0.0006)
    flame.parent = root
    flame.scale = (scale, scale, scale)
    flame.location = (0, -0.008, 0.030 * scale)
    light = K.point_light('LanternLight', (loc[0], loc[1] - 0.05, loc[2] + 0.085 * scale),
                          2.4 * scale, light_color, radius=0.03)
    return dict(root=root, light=light, flame=flame, glow_pos=light.location)


def flame(loc=(0, 0, 0), scale=1.0, strength=4.0, color='#ffb45e'):
    """独立的火苗（近景手心里的那一朵）：外焰 + 内芯两层纸。返回 root / light / flame。"""
    root = pivot('FlameRoot', loc)
    pts = [(-0.020, 0.0), (-0.028, 0.030), (-0.020, 0.062), (-0.008, 0.086),
           (0.0, 0.108), (0.010, 0.080), (0.020, 0.050), (0.018, 0.022),
           (0.008, 0.004)]
    body = cut('FlameCut', pts, glow_mat('FlameMat', color, strength), None,
               depth=0.012, bevel=0.0006)
    body.parent = root
    body.scale = (scale, scale, scale)
    core_pts = [(x * 0.55, 0.012 + (z - 0.004) * 0.52) for (x, z) in pts]
    core = cut('FlameCore', core_pts, glow_mat('FlameCoreMat', '#ffe6b0', strength * 1.9),
               None, depth=0.013, bevel=0.0004)
    core.parent = root
    core.scale = (scale, scale, scale)
    core.location = (0, -0.0035, 0)
    light = K.point_light('FlameLight', (loc[0], loc[1] - 0.03, loc[2] + 0.05 * scale),
                          1.5 * scale, (1.0, 0.58, 0.24), radius=0.02)
    return dict(root=root, light=light, flame=body, core=core)


def text_paper(name, body, size, loc, mat, rot=(math.pi / 2, 0, 0), extrude=0.004,
               bevel=0.0012, align='CENTER'):
    """纸字：片头 / 片尾的标题。用系统字体挤出成纸片。"""
    font = None
    for path in K.FONT_CANDIDATES:
        try:
            font = bpy.data.fonts.load(path)
            break
        except Exception:
            continue
    bpy.ops.object.text_add(location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    if font is not None:
        obj.data.font = font
    obj.data.size = size
    obj.data.extrude = extrude
    obj.data.bevel_depth = bevel
    obj.data.bevel_resolution = 1
    obj.data.align_x = align
    obj.data.align_y = 'CENTER'
    obj.data.space_character = 1.06
    obj.data.materials.append(mat)
    return obj


# ---------------------------------------------------------------- 动效

def key_sin(obj, frames, loc=(0, 0, 0), rot=(0, 0, 0), speed=1.0, phase=0.0, step=4):
    """正弦呼吸/摇曳：对所有帧打 key，保证镜内每一帧都在动。"""
    f0, f1 = int(frames[0]), int(frames[1])
    base_loc = tuple(obj.location)
    base_rot = tuple(obj.rotation_euler)
    for f in range(f0, f1 + 1, step):
        t = (f - f0) / max(1, (f1 - f0))
        s = math.sin(2 * math.pi * (t * speed + phase))
        obj.location = (base_loc[0] + loc[0] * s, base_loc[1] + loc[1] * s, base_loc[2] + loc[2] * s)
        obj.rotation_euler = (base_rot[0] + rot[0] * s, base_rot[1] + rot[1] * s, base_rot[2] + rot[2] * s)
        obj.keyframe_insert(data_path='location', frame=f)
        obj.keyframe_insert(data_path='rotation_euler', frame=f)
    obj.location = base_loc
    obj.rotation_euler = base_rot


def key_slide(obj, frames, delta, step=4, ease=True):
    """平移：整段镜头里从起点走到终点的位移（走路、船靠岸）。"""
    f0, f1 = int(frames[0]), int(frames[1])
    base = tuple(obj.location)
    for f in range(f0, f1 + 1, step):
        t = (f - f0) / max(1, (f1 - f0))
        e = t * t * (3 - 2 * t) if ease else t
        obj.location = (base[0] + delta[0] * e, base[1] + delta[1] * e, base[2] + delta[2] * e)
        obj.keyframe_insert(data_path='location', frame=f)
    obj.location = base


def key_rot(obj, frames, axis='Y', a0=0.0, a1=0.0, step=4, ease=True):
    f0, f1 = int(frames[0]), int(frames[1])
    base = tuple(obj.rotation_euler)
    idx = 'XYZ'.index(axis)
    for f in range(f0, f1 + 1, step):
        t = (f - f0) / max(1, (f1 - f0))
        e = t * t * (3 - 2 * t) if ease else t
        ang = a0 + (a1 - a0) * e
        rot = list(base)
        rot[idx] = ang
        obj.rotation_euler = rot
        obj.keyframe_insert(data_path='rotation_euler', frame=f)
    obj.rotation_euler = base


def key_energy(light, frames, base, amp=0.35, speed=3.0, step=3, seed=0.0,
               ramp=None):
    """火光：确定性的多频闪烁；ramp=(f0_energy, f1_energy) 时叠加线性升降。"""
    f0, f1 = int(frames[0]), int(frames[1])
    for f in range(f0, f1 + 1, step):
        t = (f - f0) / max(1, (f1 - f0))
        flick = 0.62 * math.sin(t * 41.0 + seed) + 0.38 * math.sin(t * 67.0 + seed * 2.3)
        level = base
        if ramp is not None:
            level = ramp[0] + (ramp[1] - ramp[0]) * (t * t * (3 - 2 * t))
        light.data.energy = max(0.0, level * (1 + amp * flick))
        light.data.keyframe_insert(data_path='energy', frame=f)


def key_scale(obj, frames, base=1.0, amp=0.08, speed=3.0, step=3, seed=0.0):
    f0, f1 = int(frames[0]), int(frames[1])
    b = tuple(obj.scale)
    for f in range(f0, f1 + 1, step):
        t = (f - f0) / max(1, (f1 - f0))
        s = 1 + amp * (0.6 * math.sin(t * 39.0 + seed) + 0.4 * math.sin(t * 63.0 + seed * 1.7))
        obj.scale = (b[0] * s, b[1] * s, b[2] * s)
        obj.keyframe_insert(data_path='scale', frame=f)
    obj.scale = b


def visibility(obj, frames, on=True):
    """用可见性真值做遮挡开关（纸片戏里换景的手法是「翻片」）。"""
    for f in (int(frames[0]), int(frames[1])):
        obj.hide_render = not on
        obj.hide_viewport = not on
        obj.keyframe_insert(data_path='hide_render', frame=f)
        obj.keyframe_insert(data_path='hide_viewport', frame=f)


# ---------------------------------------------------------------- 环境

def rain(name='Rain', loc=(0, 1.6, 2.4), size=3.0, count=900, drop_radius=0.0012,
         drop_length=0.075, speed=-5.5, lifetime=40, frames=(1, 75), emission=0.10,
         color=(0.55, 0.62, 0.72), seed=7):
    """纸剧场里的雨：细长雨丝。布朗运动归零，否则雨会走成发光的 S 形。"""
    emitter = K.rain(name, loc=loc, size=size, count=count, drop_radius=drop_radius,
                     drop_length=drop_length, speed=speed, lifetime=lifetime,
                     frames=frames, emission=emission, color=color, seed=seed)
    for ps in emitter.particle_systems:
        ps.settings.brownian_factor = 0.0
        ps.settings.render_type = 'OBJECT'
    return emitter


def fog_band(name, w, h, mat, loc=(0, 0, 0), rot=(0, 0, 0), alpha=0.55):
    """一条纸雾：半透明的横向纸带，叠三层就有雾的纵深。"""
    m, nt, bsdf, _ = K.material(name + 'Mat', (*hex_rgb('#c9d4d8'), 1), roughness=0.9, alpha=alpha)
    try:
        m.surface_render_method = 'BLENDED'
    except Exception:
        pass
    obj = sheet(name, w, h, m, loc=loc, rot=rot, bow=0.02, seg=(10, 2))
    obj.visible_shadow = False
    return obj
