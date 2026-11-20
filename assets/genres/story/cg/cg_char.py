"""cg_char — 程序化人形：建模 + 手动蒙皮 + 面部 + 表演（Blender 端）。

build() 返回一个 rig 字典（arm/head/jaw/lids/focus…），其余函数都吃这个字典：
  idle(rig, frames)                     呼吸与重心
  look(rig, [(frame, yaw, nod, tilt)])  头转向，度数，nod 正为低头
  blink(rig, [sec, ...])                眨眼（眼皮旋转）
  speak(rig, curve, start_frame=1)      按 cg_audio 的包络驱动下颌/嘴/下唇
  walk(rig, frames, ...) / move(rig, keys)  步态循环与整体走位
  focus(rig)                            跟脸走的对焦空物体

约定：角色局部朝 -Y，脚在 z=0；建完后整体移到 loc。
绑定不用自动权重：逐顶点取最近两根骨的距离反比权重，近端两骨即可。
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

import cg_kit as K


def _bake(obj):
    M = (Matrix.Translation(obj.location) @ obj.rotation_euler.to_matrix().to_4x4()
         @ Matrix.Diagonal((*obj.scale, 1.0)))
    obj.data.transform(M)
    obj.matrix_world = Matrix()
    obj.location = (0, 0, 0)
    obj.rotation_euler = (0, 0, 0)
    obj.scale = (1, 1, 1)
    return obj


def _smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True


def _mat(name, color, rough=0.5, metal=0.0, coat=0.0, sub=0.0, radius=(0.9, 0.35, 0.2), scale=0.02,
         bump=None):
    m, nt, bsdf, _ = K.material(name, color, metallic=metal, roughness=rough, coat=coat)
    if sub:
        K.S(bsdf, 'Subsurface Weight', sub)
        K.S(bsdf, 'Subsurface Radius', radius)
        K.S(bsdf, 'Subsurface Scale', scale)
    if bump:
        K.noise_detail(nt, bsdf, scale=bump[0], detail=bump[1], strength=bump[2],
                       distance=bump[3], rough=bump[4] if len(bump) > 4 else None)
    return m


def _ellipsoid(name, loc, scale, mat, rot=(0, 0, 0), segs=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    o.rotation_euler = rot
    _bake(o)
    o.data.materials.append(mat)
    _smooth(o)
    return o


def _cap(name, scale, cut, mat, segs=32, rings=24):
    """球面前帽：虹膜/瞳孔贴合眼球表面，不悬浮成贴片。"""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=1)
    o = bpy.context.object
    o.name = name
    bm = bmesh.new()
    bm.from_mesh(o.data)
    kill = [f for f in bm.faces if f.calc_center_median().y > cut]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    for v in bm.verts:
        v.co = (v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2])
    bm.to_mesh(o.data)
    bm.free()
    o.data.materials.append(mat)
    _smooth(o)
    return o


def _cone_between(name, p0, p1, r0, r1, mat, segs=20):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    bpy.ops.mesh.primitive_cone_add(vertices=segs, radius1=r0, radius2=r1, depth=d.length,
                                    location=(p0 + p1) / 2)
    o = bpy.context.object
    o.name = name
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    _bake(o)
    o.data.materials.append(mat)
    _smooth(o)
    return o


def _tube(name, pts, radii, mat, segs=24, sub=1, per=7):
    """沿折线平滑扫掠的管道：Catmull-Rom 取中线，半径逐点插值。
    替代「锥体+关节球」拼接：肩/肘/腕是一整片曲面，只有服装结构线，没有模型接缝。"""
    pts = [Vector(p) for p in pts]
    n = len(pts)
    centers, rs = [], []
    for i in range(n - 1):
        p0 = pts[i - 1] if i > 0 else pts[i] - (pts[i + 1] - pts[i])
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < n else pts[i + 1] + (pts[i + 1] - pts[i])
        steps = per + (1 if i == n - 2 else 0)
        for k in range(steps):
            t = k / per
            t2, t3 = t * t, t * t * t
            c = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                       + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
            centers.append(c)
            rs.append(radii[i] * (1 - t) + radii[i + 1] * t)
    tangents = []
    for i in range(len(centers)):
        a = centers[max(0, i - 1)]
        b = centers[min(len(centers) - 1, i + 1)]
        tangents.append((b - a).normalized())
    up = Vector((0, 0, 1))
    if abs(tangents[0].dot(up)) > .95:
        up = Vector((0, 1, 0))
    nrm = tangents[0].cross(up).normalized()
    bm = bmesh.new()
    loops = []
    for i, (c, r, tg) in enumerate(zip(centers, rs, tangents)):
        if i:
            nrm = tangents[i - 1].rotation_difference(tg) @ nrm
        bi = tg.cross(nrm).normalized()
        nrm = bi.cross(tg).normalized()
        loops.append([bm.verts.new(c + (nrm * math.cos(2 * math.pi * j / segs)
                                        + bi * math.sin(2 * math.pi * j / segs)) * r)
                      for j in range(segs)])
    for a, b in zip(loops, loops[1:]):
        for j in range(segs):
            bm.faces.new((a[j], a[(j + 1) % segs], b[(j + 1) % segs], b[j]))
    bm.faces.new(tuple(reversed(loops[0])))
    bm.faces.new(tuple(loops[-1]))
    bm.normal_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    _smooth(o)
    if sub:
        m = o.modifiers.new('Sub', 'SUBSURF')
        m.levels = sub
        m.render_levels = sub
    return o


def _loft(name, rings, mat, segs=28):
    bm = bmesh.new()
    loops = []
    for z, rx, ry, cy in rings:
        loops.append([bm.verts.new((math.cos(2 * math.pi * i / segs) * rx,
                                    math.sin(2 * math.pi * i / segs) * ry + cy, z))
                      for i in range(segs)])
    for a, b in zip(loops, loops[1:]):
        for i in range(segs):
            bm.faces.new((a[i], a[(i + 1) % segs], b[(i + 1) % segs], b[i]))
    bm.faces.new(tuple(reversed(loops[0])))
    bm.faces.new(tuple(loops[-1]))
    bm.normal_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    _smooth(o)
    return o


def _dist_seg(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(1e-9, ab.length_squared)))
    return (p - (a + ab * t)).length


def _bind(obj, arm, bones, power=3.2, top=2):
    groups = {n: obj.vertex_groups.new(name=n) for n in bones}
    segs = []
    for n in bones:
        b = arm.data.bones[n]
        segs.append((n, arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local))
    for v in obj.data.vertices:
        p = obj.matrix_world @ v.co
        ds = sorted((_dist_seg(p, h, t) + 1e-4, n) for n, h, t in segs)[:top]
        ws = [(d ** -power, n) for d, n in ds]
        s = sum(w for w, _ in ws)
        for w, n in ws:
            groups[n].add([v.index], w / s, 'REPLACE')
    mod = obj.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    obj.parent = arm


def _bone_parent(obj, arm, bone_name):
    bpy.context.view_layer.update()
    b = arm.data.bones[bone_name]
    anchor = arm.matrix_world @ b.matrix_local @ Matrix.Translation((0, b.length, 0))
    obj.parent = arm
    obj.parent_type = 'BONE'
    obj.parent_bone = bone_name
    obj.matrix_parent_inverse = anchor.inverted()


def _child(obj, parent):
    bpy.context.view_layer.update()
    pw = parent.matrix_world.copy()
    obj.parent = parent
    obj.matrix_parent_inverse = pw.inverted()


# ---------------------------------------------------------------- armature

def _armature(name, H):
    arm_data = bpy.data.armatures.new(name + 'Arm')
    arm = bpy.data.objects.new(name + 'Rig', arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')

    def z(f):
        return f * H

    spec = [
        ('hips', (0, 0, z(.50)), (0, 0, z(.585)), None, False),
        ('spine', (0, 0, z(.585)), (0, 0, z(.665)), 'hips', True),
        ('chest', (0, 0, z(.665)), (0, 0, z(.80)), 'spine', True),
        ('neck', (0, 0, z(.80)), (0, 0, z(.872)), 'chest', True),
        ('head', (0, 0, z(.872)), (0, 0, z(1.0)), 'neck', True),
    ]
    for s, sx in (('L', 1), ('R', -1)):
        spec += [
            ('shoulder.' + s, (sx * .02 * H, 0, z(.795)), (sx * .105 * H, 0, z(.79)), 'chest', False),
            ('upper_arm.' + s, (sx * .105 * H, 0, z(.79)), (sx * .125 * H, -.03 * H, z(.635)), 'shoulder.' + s, True),
            ('forearm.' + s, (sx * .125 * H, -.03 * H, z(.635)), (sx * .13 * H, -.17 * H, z(.60)), 'upper_arm.' + s, True),
            ('hand.' + s, (sx * .13 * H, -.17 * H, z(.60)), (sx * .13 * H, -.225 * H, z(.595)), 'forearm.' + s, True),
            ('thigh.' + s, (sx * .045 * H, 0, z(.50)), (sx * .048 * H, -.005 * H, z(.28)), 'hips', False),
            ('shin.' + s, (sx * .048 * H, -.005 * H, z(.28)), (sx * .048 * H, 0, z(.05)), 'thigh.' + s, True),
            ('foot.' + s, (sx * .048 * H, 0, z(.05)), (sx * .048 * H, -.10 * H, z(.02)), 'shin.' + s, True),
        ]
    for name_, head, tail, parent, connect in spec:
        eb = arm_data.edit_bones.new(name_)
        eb.head = head
        eb.tail = tail
        if parent:
            eb.parent = arm_data.edit_bones[parent]
            eb.use_connect = connect

    bpy.ops.object.mode_set(mode='OBJECT')
    for b in arm.pose.bones:
        b.rotation_mode = 'XYZ'
    return arm


# ---------------------------------------------------------------- body

def _torso(H, mat):
    rings = [
        (.475 * H, .094 * H, .058 * H, 0),
        (.520 * H, .092 * H, .057 * H, 0),
        (.585 * H, .082 * H, .053 * H, 0),
        (.645 * H, .081 * H, .051 * H, 0),
        (.705 * H, .090 * H, .057 * H, -.002 * H),
        (.755 * H, .100 * H, .063 * H, -.003 * H),
        (.795 * H, .110 * H, .066 * H, -.003 * H),
        (.807 * H, .1072 * H, .0645 * H, -.0025 * H),
        (.818 * H, .0985 * H, .0608 * H, -.002 * H),
        (.827 * H, .0840 * H, .0548 * H, -.0015 * H),
        (.834 * H, .0640 * H, .0455 * H, -.001 * H),
        (.840 * H, .0440 * H, .0360 * H, 0),
        (.846 * H, .0325 * H, .0300 * H, 0),
    ]
    o = _loft('Sweater', rings, mat, segs=32)
    sub = o.modifiers.new('Sub', 'SUBSURF')
    sub.levels = 2
    sub.render_levels = 2
    return o


def _arm_side(H, side, sx, sweater, skin, arm, cols):
    inner = Vector((sx * .012 * H, -.004 * H, .797 * H))
    sh = Vector((sx * .078 * H, -.007 * H, .785 * H))
    el = Vector((sx * .124 * H, -.032 * H, .642 * H))
    wr = Vector((sx * .130 * H, -.170 * H, .602 * H))
    tip = Vector((sx * .130 * H, -.232 * H, .592 * H))
    d = (wr - el).normalized()
    sleeve = _tube('Sleeve.' + side, [inner, sh, el, wr],
                   [.0260 * H, .0296 * H, .0245 * H, .0205 * H], sweater, segs=24)
    pad = _ellipsoid('Shoulder.' + side, (sx * .0755 * H, -.006 * H, .787 * H),
                     (.0335 * H, .0320 * H, .0300 * H), sweater,
                     rot=(0, sx * math.radians(-8), 0), segs=24, rings=14)
    cuff = _tube('Cuff.' + side, [wr - d * .030 * H, wr + d * .007 * H],
                 [.0222 * H, .0216 * H], sweater, segs=24)
    palm = _ellipsoid('Hand.' + side, wr + d * .017 * H,
                      (.0160 * H, .0205 * H, .0126 * H), skin)
    bones = ['shoulder.' + side, 'upper_arm.' + side, 'forearm.' + side, 'hand.' + side]
    parts = [sleeve, pad, cuff, palm]
    for i, (dx, ln) in enumerate(((-.0116, .0112), (-.0039, .0128), (.0039, .0134), (.0116, .0120))):
        f = _ellipsoid('Finger%d.' % i + side,
                       wr + d * (.0345 * H + ln * .55 * H) + Vector((sx * dx * H, 0, -.0022 * H)),
                       (.0031 * H, ln * H, .0064 * H), skin, rot=(-.14, 0, 0))
        parts.append(f)
    thumb = _ellipsoid('Thumb.' + side, wr + Vector((-sx * .014 * H, -.026 * H, -.003 * H)),
                       (.0072 * H, .0150 * H, .0072 * H), skin,
                       rot=(0, 0, sx * math.radians(34)))
    parts.append(thumb)
    for o in parts:
        _bind(o, arm, bones)
    return parts


def _leg_side(H, side, sx, pants, shoe_mat, arm):
    hip = Vector((sx * .045 * H, 0, .50 * H))
    knee = Vector((sx * .048 * H, -.005 * H, .28 * H))
    ankle = Vector((sx * .048 * H, 0, .05 * H))
    leg = _tube('Leg.' + side, [hip, knee, ankle], [.040 * H, .0295 * H, .0215 * H], pants, segs=20)
    shoe = _ellipsoid('Shoe.' + side, (sx * .048 * H, -.030 * H, .026 * H),
                      (.031 * H, .066 * H, .026 * H), shoe_mat)
    parts = [leg, shoe]
    for o in parts:
        _bind(o, arm, ['thigh.' + side, 'shin.' + side, 'foot.' + side])
    return parts


# ---------------------------------------------------------------- head

def _head_mesh(H, skin):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, radius=1)
    o = bpy.context.object
    o.name = 'Head'
    rx, ry, rz = .0452 * H, .0572 * H, .0638 * H
    for v in o.data.vertices:
        nx, ny, nz = v.co
        X, Y, Z = nx * rx, ny * ry, nz * rz
        if nz < -.10:                      # 下颌收窄 + 下半脸略收短
            t = (-nz - .10) / .90
            X *= 1 - .145 * t
            Z *= 1 - .075 * t
            if ny < 0:
                Y *= 1 - .030 * t
        if abs(nx) > .78 and nz > .12:     # 太阳穴略平
            X *= 1 - .025 * (abs(nx) - .78) / .22
        if .15 < nz < .75 and ny < 0:      # 额头略平
            Y *= 1 - .05 * (nz - .15) / .6
        if ny > .55:                       # 后脑
            Y *= 1.03
        if Y < 0:                          # 颧骨 / 眉弓 / 下巴
            d = math.sqrt((abs(X) - .0315 * H) ** 2 + (Z + .012 * H) ** 2)
            if d < .024 * H and Z < .012 * H:
                Y -= .0018 * H * (1 - d / (.024 * H)) ** 1.5
            d = math.sqrt(X ** 2 + (Z - .0135 * H) ** 2)
            if d < .0175 * H and abs(X) < .0175 * H:
                Y -= .0016 * H * (1 - d / (.0175 * H)) ** 2
            d = math.sqrt(X ** 2 + (Z + .048 * H) ** 2)
            if d < .0165 * H:
                Y -= .0022 * H * (1 - d / (.0165 * H)) ** 1.6
        if Y < 0 and abs(X) < .024 * H and -.030 * H < Z < .016 * H:   # 鼻梁直接长在头骨上
            t = max(0.0, min(1.0, (Z + .021 * H) / (.037 * H)))
            low = max(0.0, min(1.0, (Z + .0295 * H) / (.0085 * H)))
            amp = .0125 * H * (1 - t) ** .75 * low
            w = (.0044 + .0081 * (1 - t)) * H
            Y -= amp * math.exp(-(X / w) ** 2)
        v.co = (X, Y, Z)
    o.data.materials.append(skin)
    _smooth(o)
    o.location = (0, 0, .920 * H)
    o.shape_key_add(name='Basis')
    sk = o.shape_key_add(name='jawOpen', from_mix=False)
    hinge = Vector((0, .22 * ry, .06 * rz))
    for v in o.data.vertices:
        p = v.co.copy()
        wz = max(0.0, min(1.0, (-.08 - p.z / rz) / .92)) ** 1.15
        ff = max(0.0, min(1.0, (.35 - p.y / ry) / 1.3)) ** .7
        w = wz * ff
        if w <= .001:
            continue
        a = math.radians(17.0) * w
        d = p - hinge
        y = d.y * math.cos(a) - d.z * math.sin(a)
        z = d.y * math.sin(a) + d.z * math.cos(a)
        sk.data[v.index].co = hinge + Vector((d.x, y, z))
    return o


def _hair(H, hc, mat, short=False):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=64, radius=1)
    o = bpy.context.object
    o.name = 'Hair'
    rx, ry, rz = .0490 * H, .0615 * H, .0730 * H
    cy = .004 * H
    bm = bmesh.new()
    bm.from_mesh(o.data)
    geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, -.60), plane_no=(0, 0, 1))
    geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, -.15), plane_no=(0, .41, 1))
    kill = []
    for f in bm.faces:
        c = f.calc_center_median()
        if c.z < -.60:
            kill.append(f)
        elif c.y < -.05 and c.z + .41 * c.y < -.15:
            kill.append(f)
        elif short and abs(c.y) < .30 and c.z < -.16:   # 帽下短发：侧面只到耳上
            kill.append(f)
        elif short and c.y < .30 and c.z < -.42:
            kill.append(f)
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    for v in bm.verts:
        v.co = (v.co.x * rx, v.co.y * ry + cy, v.co.z * rz + .008 * H)
    bm.to_mesh(o.data)
    bm.free()
    o.data.materials.append(mat)
    _smooth(o)
    sol = o.modifiers.new('Sol', 'SOLIDIFY')
    sol.thickness = .009 * H
    sol.offset = -1
    o.location = hc
    return o


def _beanie(H, hc, mat):
    """毛线帽：球冠 + 卷边，盖住发际线，比程序化头发可信。"""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=64, radius=1)
    o = bpy.context.object
    o.name = 'Beanie'
    rx, ry, rz = .0515 * H, .0640 * H, .0770 * H
    bm = bmesh.new()
    bm.from_mesh(o.data)
    geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, .20), plane_no=(0, .12, 1))
    kill = [f for f in bm.faces if f.calc_center_median().z < .20]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    for v in bm.verts:
        v.co = (v.co.x * rx, v.co.y * ry + .003 * H, v.co.z * rz + .012 * H)
    bm.to_mesh(o.data)
    bm.free()
    o.data.materials.append(mat)
    _smooth(o)
    sol = o.modifiers.new('Sol', 'SOLIDIFY')
    sol.thickness = .008 * H
    sol.offset = -1
    o.location = hc
    o.rotation_euler = (0, math.radians(2.0), 0)

    brim = _loft('BeanieBrim', [(.943 * H, .0482 * H, .0592 * H, -.001 * H),
                                (.951 * H, .0512 * H, .0632 * H, -.001 * H),
                                (.960 * H, .0502 * H, .0620 * H, -.001 * H)], mat, segs=48)
    return o, brim


def _face(H, hc, head, arm, cols):
    """眼睛/眼皮/眉/鼻/嘴，全部以头中心为基准。"""
    eye_r = .0117 * H
    out = {'lids': {}}
    lid_open, lid_shut = -6, 92

    def place(o, off):
        o.location = hc + Vector(off)
        _child(o, head)
        return o

    for s, sx in (('L', 1), ('R', -1)):
        ec = Vector((sx * .0226 * H, -.0448 * H, .0034 * H))
        white = _ellipsoid('Eye.' + s, (0, 0, 0), (eye_r * .94, eye_r * .55, eye_r * .66), cols['eye'],
                           segs=24, rings=12)
        place(white, ec)
        iris = _cap('Iris.' + s, (eye_r * .991, eye_r * .553, eye_r * .669), -.70,
                    cols['iris'], segs=28, rings=20)
        place(iris, ec)
        pupil = _cap('Pupil.' + s, (eye_r * .997, eye_r * .557, eye_r * .673), -.905,
                     cols['pupil'], segs=20, rings=14)
        place(pupil, ec)
        spark = _ellipsoid('Spark.' + s, (0, 0, 0), (eye_r * .075, .0007 * H, eye_r * .075), cols['spark'],
                           segs=12, rings=6)
        place(spark, ec + Vector((-.0019 * H, -eye_r * .52, .0034 * H)))

        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1)
        lid = bpy.context.object
        lid.name = 'Lid.' + s
        bm = bmesh.new()
        bm.from_mesh(lid.data)
        kill = [f for f in bm.faces if f.calc_center_median().z < .38]
        bmesh.ops.delete(bm, geom=kill, context='FACES')
        for v in bm.verts:
            v.co = (v.co.x * eye_r * 1.10, v.co.y * eye_r * .58, v.co.z * eye_r * .697)
        for v in bm.verts:   # 眼睑缘中间高、两端低，形成杏仁形开口
            w = max(0.0, min(1.0, (.62 * eye_r - v.co.z) / (.24 * eye_r)))
            v.co.z += .16 * eye_r * w * max(0.0, 1 - (v.co.x / (eye_r * 1.10)) ** 2)
        bm.to_mesh(lid.data)
        bm.free()
        lid.data.materials.append(cols['skin'])
        _smooth(lid)
        sol = lid.modifiers.new('Sol', 'SOLIDIFY')
        sol.thickness = .0006
        lid.rotation_euler = (math.radians(lid_open), 0, 0)
        place(lid, ec)
        out['lids'][s] = lid

        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1)
        low = bpy.context.object
        low.name = 'LidLow.' + s
        bm = bmesh.new()
        bm.from_mesh(low.data)
        kill = [f for f in bm.faces if f.calc_center_median().z < .34]
        bmesh.ops.delete(bm, geom=kill, context='FACES')
        for v in bm.verts:
            v.co = (v.co.x * eye_r * 1.095, v.co.y * eye_r * .577, v.co.z * eye_r * .694)
        for v in bm.verts:   # 下睑缘同向弯，翻转后成为下弧
            w = max(0.0, min(1.0, (.60 * eye_r - v.co.z) / (.24 * eye_r)))
            v.co.z += .14 * eye_r * w * max(0.0, 1 - (v.co.x / (eye_r * 1.095)) ** 2)
        bm.to_mesh(low.data)
        bm.free()
        low.data.materials.append(cols['skin'])
        _smooth(low)
        sol = low.modifiers.new('Sol', 'SOLIDIFY')
        sol.thickness = .0006
        low.rotation_euler = (math.radians(182), 0, 0)
        place(low, ec)

        lash = _tube('Lash.' + s, [hc + Vector((sx * .0120 * H, -.0512 * H, .0061 * H)),
                                   hc + Vector((sx * .0172 * H, -.0520 * H, .0080 * H)),
                                   hc + Vector((sx * .0223 * H, -.0516 * H, .0090 * H)),
                                   hc + Vector((sx * .0278 * H, -.0520 * H, .0080 * H)),
                                   hc + Vector((sx * .0330 * H, -.0512 * H, .0061 * H))],
                     [.0006 * H, .0009 * H, .0010 * H, .0009 * H, .0006 * H], cols['hair'],
                     segs=10, per=5)
        _child(lash, head)

        brow = _tube('Brow.' + s, [hc + Vector((sx * .0098 * H, -.0558 * H, .0126 * H)),
                                   hc + Vector((sx * .0162 * H, -.0536 * H, .0140 * H)),
                                   hc + Vector((sx * .0230 * H, -.0498 * H, .0145 * H)),
                                   hc + Vector((sx * .0292 * H, -.0444 * H, .0139 * H)),
                                   hc + Vector((sx * .0338 * H, -.0394 * H, .0125 * H))],
                     [.0006 * H, .0013 * H, .0012 * H, .0008 * H, .0004 * H], cols['hair'],
                     segs=14, per=6)
        _child(brow, head)

        ear = _ellipsoid('Ear.' + s, (0, 0, 0), (.0031 * H, .0068 * H, .0118 * H), cols['skin'],
                         segs=20, rings=12)
        ear.rotation_euler = (0, sx * math.radians(-16), sx * math.radians(-8))
        place(ear, (sx * .0442 * H, .0046 * H, -.0062 * H))

    tip = _ellipsoid('NoseTip', (0, 0, 0), (.0072 * H, .0038 * H, .0038 * H), cols['skin'],
                     segs=24, rings=12)
    place(tip, (0, -.0614 * H, -.0168 * H))
    for s, sx in (('L', 1), ('R', -1)):
        wing = _ellipsoid('NoseWing.' + s, (0, 0, 0), (.0033 * H, .0025 * H, .0024 * H), cols['skin'],
                          segs=18, rings=10)
        place(wing, (sx * .0084 * H, -.0548 * H, -.0212 * H))

    cavity = _ellipsoid('MouthIn', (0, 0, 0), (.0140 * H, .0040 * H, .0066 * H), cols['mouth_in'],
                        segs=24, rings=12)
    cavity.scale = (1, 1, .10)
    place(cavity, (0, -.0420 * H, -.0352 * H))

    upper = _tube('LipUp', [hc + Vector((-.0148 * H, -.0464 * H, -.0327 * H)),
                            hc + Vector((-.0078 * H, -.0486 * H, -.0321 * H)),
                            hc + Vector((0, -.0492 * H, -.0317 * H)),
                            hc + Vector((.0078 * H, -.0486 * H, -.0321 * H)),
                            hc + Vector((.0148 * H, -.0464 * H, -.0327 * H))],
                  [.0009 * H, .0020 * H, .0025 * H, .0020 * H, .0009 * H], cols['lips'], segs=16)
    lower = _tube('LipLow', [hc + Vector((-.0136 * H, -.0440 * H, -.0364 * H)),
                             hc + Vector((0, -.0483 * H, -.0354 * H)),
                             hc + Vector((.0136 * H, -.0440 * H, -.0364 * H))],
                  [.0011 * H, .0028 * H, .0011 * H], cols['lips'], segs=16)
    seam = _tube('MouthLine', [hc + Vector((-.0146 * H, -.0462 * H, -.0346 * H)),
                               hc + Vector((0, -.0492 * H, -.0342 * H)),
                               hc + Vector((.0146 * H, -.0462 * H, -.0346 * H))],
                 [.0006 * H, .0008 * H, .0006 * H], cols['mouth_in'], segs=10, per=5)
    for o in (upper, lower, seam):
        _child(o, head)

    neck = _loft('Neck', [(.788 * H, .0360 * H, .0315 * H, -.001 * H),
                          (.812 * H, .0342 * H, .0300 * H, -.002 * H),
                          (.845 * H, .0332 * H, .0296 * H, -.003 * H),
                          (.872 * H, .0332 * H, .0298 * H, -.004 * H),
                          (.900 * H, .0340 * H, .0308 * H, -.004 * H)], cols['skin'], segs=24)
    nsub = neck.modifiers.new('Sub', 'SUBSURF')
    nsub.levels = 1
    nsub.render_levels = 1
    _bind(neck, arm, ['neck', 'chest'])

    tongue = _ellipsoid('Tongue', (0, 0, 0), (.0088 * H, .0028 * H, .0018 * H), cols['tongue'],
                        segs=20, rings=10)
    place(tongue, (0, -.0428 * H, -.0348 * H))

    out.update({'cavity': cavity, 'upper': upper, 'lower': lower, 'neck': neck, 'tongue': tongue,
                'eye_r': eye_r, 'lid_open': lid_open, 'lid_shut': lid_shut})
    return out


def _arc_panel(name, rings, a0, a1, mat, thick, segs=13):
    bm = bmesh.new()
    loops = []
    for ring in rings:
        z, rx, ry = ring[:3]
        ra0, ra1 = (ring[3], ring[4]) if len(ring) > 3 else (a0, a1)
        loops.append([bm.verts.new((math.cos(a) * rx, math.sin(a) * ry, z))
                      for a in [ra0 + (ra1 - ra0) * i / (segs - 1) for i in range(segs)]])
    for a, b in zip(loops, loops[1:]):
        for i in range(segs - 1):
            bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
    bm.normal_update()
    for f in bm.faces:
        c = f.calc_center_median()
        if f.normal.dot(Vector((c.x, c.y, 0))) < 0:
            f.normal_flip()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    _smooth(o)
    sol = o.modifiers.new('Sol', 'SOLIDIFY')
    sol.thickness = thick
    sol.offset = 0
    return o


def _apron(H, mat, arm):
    waist = _arc_panel('Apron', [(.430 * H, .098 * H, .062 * H), (.480 * H, .096 * H, .061 * H),
                                 (.540 * H, .091 * H, .059 * H), (.590 * H, .088 * H, .058 * H),
                                 (.625 * H, .090 * H, .060 * H)],
                       math.radians(198), math.radians(342), mat, .005 * H)
    _bind(waist, arm, ['hips', 'spine', 'chest'])
    bib = _arc_panel('ApronBib', [(.606 * H, .0895 * H, .0580 * H, math.radians(252), math.radians(288)),
                                  (.640 * H, .0900 * H, .0586 * H, math.radians(249), math.radians(291)),
                                  (.680 * H, .0925 * H, .0600 * H, math.radians(245), math.radians(295)),
                                  (.720 * H, .0975 * H, .0630 * H, math.radians(241), math.radians(299)),
                                  (.752 * H, .1020 * H, .0660 * H, math.radians(238), math.radians(302)),
                                  (.768 * H, .1050 * H, .0675 * H, math.radians(236), math.radians(304))],
                     math.radians(244), math.radians(296), mat, .004 * H, segs=11)
    _bind(bib, arm, ['spine', 'chest'])
    rings = [(.755, .1000, .0630, -.0030), (.795, .1100, .0660, -.0030),
             (.807, .1072, .0645, -.0025), (.818, .0985, .0608, -.0020),
             (.827, .0840, .0548, -.0015), (.834, .0640, .0455, -.0010),
             (.840, .0440, .0360, 0.0)]

    def surf_y(z, x):   # 躯干表面（H 单位），贴 3.2mm 外偏
        for (z0, rx0, ry0, o0), (z1, rx1, ry1, o1) in zip(rings, rings[1:]):
            if z0 <= z <= z1:
                t = (z - z0) / (z1 - z0)
                rx = rx0 + (rx1 - rx0) * t
                ry = ry0 + (ry1 - ry0) * t
                off = o0 + (o1 - o0) * t
                r = min(1.0, abs(x) / rx)
                return off - ry * math.sqrt(max(0.0, 1 - r * r)) - .0032
        return 0.0

    for s, sx in (('L', 1), ('R', -1)):   # 颈带贴着胸/肩面，末端藏进领口
        xy = [(.049, .768), (.052, .790), (.054, .807), (.052, .818),
              (.048, .827), (.042, .834), (.034, .840)]
        strap = _tube('ApronStrap.' + s,
                      [(sx * x * H, surf_y(z, x) * H, z * H) for x, z in xy],
                      [.0028 * H, .0032 * H, .0034 * H, .0034 * H,
                       .0032 * H, .0030 * H, .0026 * H],
                      mat, segs=8, per=6)
        _bind(strap, arm, ['chest', 'neck'])
    return waist


def build(name='Figure', loc=(0, 0, 0), height=1.70, yaw=0.0,
          skin=(.38, .215, .175, 1), hair=(.020, .012, .008, 1),
          top=(.150, .045, .028, 1), pants=(.020, .020, .022, 1), lips=(.235, .105, .088, 1),
          apron=(.070, .042, .028, 1), hat=None):
    H = height
    cols = {
        'skin': _mat('Skin', skin, rough=.55, sub=.12, radius=(.9, .32, .18), scale=.09,
                     bump=(75, 5, .028, .00016, (.42, .54))),
        'hair': _mat('Hair', hair, rough=.74, bump=(120, 5, .16, .0009)),
        'sweater': _mat('Sweater', top, rough=.78, bump=(170, 3, .18, .0008)),
        'apron': _mat('Apron', apron, rough=.62, bump=(80, 5, .18, .0008, (.55, .70))),
        'pants': _mat('Pants', pants, rough=.82),
        'lips': _mat('Lips', lips, rough=.36),
        'tongue': _mat('Tongue', (.36, .085, .080, 1), rough=.32),
        'mouth_in': _mat('MouthIn', (.020, .004, .004, 1), rough=.55),
        'eye': _mat('EyeWhite', (.40, .385, .365, 1), rough=.38, coat=.04),
        'iris': _mat('Iris', (.090, .050, .024, 1), rough=.18, coat=.45),
        'pupil': _mat('Pupil', (.005, .004, .004, 1), rough=.15),
        'spark': K.emission_material('Spark', (1, 1, 1, 1), 2.0)[0],
        'shoe': _mat('Shoe', (.028, .022, .018, 1), rough=.55),
    }
    if hat:
        cols['hat'] = _mat('Beanie', hat, rough=.9, bump=(140, 6, .35, .0012))
    arm = _armature(name, H)
    torso = _torso(H, cols['sweater'])
    _bind(torso, arm, ['hips', 'spine', 'chest'])
    collar = _loft('Collar', [(.786 * H, .0505 * H, .0450 * H, 0),
                              (.806 * H, .0452 * H, .0406 * H, 0),
                              (.828 * H, .0392 * H, .0356 * H, 0),
                              (.843 * H, .0364 * H, .0333 * H, 0),
                              (.849 * H, .0358 * H, .0329 * H, 0),
                              (.851 * H, .0349 * H, .0322 * H, 0),
                              (.847 * H, .0342 * H, .0316 * H, 0),
                              (.826 * H, .0336 * H, .0310 * H, 0),
                              (.802 * H, .0344 * H, .0316 * H, 0)], cols['sweater'], segs=48)
    csub = collar.modifiers.new('Sub', 'SUBSURF')
    csub.levels = 1
    csub.render_levels = 1
    _bind(collar, arm, ['chest', 'neck'])
    armL = _arm_side(H, 'L', 1, cols['sweater'], cols['skin'], arm, cols)
    armR = _arm_side(H, 'R', -1, cols['sweater'], cols['skin'], arm, cols)
    legL = _leg_side(H, 'L', 1, cols['pants'], cols['shoe'], arm)
    legR = _leg_side(H, 'R', -1, cols['pants'], cols['shoe'], arm)
    apron_m = _apron(H, cols['apron'], arm)

    head = _head_mesh(H, cols['skin'])
    _bone_parent(head, arm, 'head')
    hc = Vector((0, 0, .920 * H))
    if hat:
        hair_m, brim = _beanie(H, hc, cols['hat'])
        _child(hair_m, head)
        _child(brim, head)
        short = _hair(H, hc, cols['hair'], short=True)
        _child(short, head)
    else:
        hair_m = _hair(H, hc, cols['hair'])
        _child(hair_m, head)
    face = _face(H, hc, head, arm, cols)

    focus = bpy.data.objects.new(name + '-Focus', None)
    bpy.context.collection.objects.link(focus)
    focus.location = hc + Vector((0, -.045 * H, -.02 * H))
    _child(focus, head)

    arm.location = loc
    arm.rotation_euler = (0, 0, yaw)

    return {
        'arm': arm, 'head': head, 'hair': hair_m, 'face': face, 'apron': apron_m,
        'jaw': head.data.shape_keys.key_blocks['jawOpen'],
        'lids': face['lids'], 'mouth': face['cavity'], 'lower_lip': face['lower'],
        'upper_lip': face['upper'], 'focus': focus, 'height': H,
        'tongue': face['tongue'],
        'tongue_base': face['tongue'].location.copy(),
        'mouth_base': face['cavity'].scale.copy(),
        'lower_base': face['lower'].location.copy(),
        'cavity_base': face['cavity'].location.copy(),
        'lid_open': face['lid_open'], 'lid_shut': face['lid_shut'],
    }


# ---------------------------------------------------------------- performance

def idle(rig, frames, fps=24, breath=1.0, sway=1.0, lean=0.0):
    pb = rig['arm'].pose.bones
    for f in range(1, frames + 1, 4):
        t = (f - 1) / float(fps)
        br = math.sin(t * 2 * math.pi * .22)
        sw = math.sin(t * 2 * math.pi * .06)
        pb['chest'].rotation_euler = (math.radians(lean + .9 * breath * br), 0, math.radians(.7 * sway * sw))
        pb['spine'].rotation_euler = (math.radians(.45 * breath * math.sin(t * 2 * math.pi * .22 + .7)),
                                      0, math.radians(.5 * sway * sw))
        pb['hips'].location = (0, .0015 * breath * br, 0)


def pose_arms(rig, shoulder=-8.0, elbow=-34.0, out=0.0):
    pb = rig['arm'].pose.bones
    for s, sx in (('L', 1), ('R', -1)):
        pb['upper_arm.' + s].rotation_euler = (math.radians(shoulder), 0,
                                               math.radians(sx * out))
        pb['forearm.' + s].rotation_euler = (math.radians(elbow), 0, 0)


def look(rig, keys):
    hb = rig['arm'].pose.bones['head']
    for f, yaw, nod, tilt in keys:
        hb.rotation_euler = (math.radians(nod), math.radians(yaw), math.radians(tilt))
        hb.keyframe_insert(data_path='rotation_euler', frame=f)


def blink(rig, times, fps=24, close=3):
    o, c = rig['lid_open'], rig['lid_shut']
    for t in times:
        f = int(round(t * fps)) + 1
        for lid in rig['lids'].values():
            for ff, ang in ((f - 2, o), (f, c), (f + close, o)):
                lid.rotation_euler = (math.radians(ang), 0, 0)
                lid.keyframe_insert(data_path='rotation_euler', frame=ff)


def speak(rig, curve, start_frame=1, gain=1.0, nod=1.0):
    jaw = rig['jaw']
    mouth, lower = rig['mouth'], rig['lower_lip']
    base_s, base_l = rig['mouth_base'], rig['lower_base']
    H = rig['height']
    nb = rig['arm'].pose.bones['neck']
    for i, v in enumerate(curve):
        f = start_frame + i
        vv = min(1.0, max(0.0, v * gain))
        jaw.value = vv
        jaw.keyframe_insert(data_path='value', frame=f)
        mouth.scale = (base_s.x, base_s.y, base_s.z + vv * (1.25 - base_s.z))
        mouth.keyframe_insert(data_path='scale', frame=f)
        mouth.location.z = rig['cavity_base'].z - .0032 * H * vv
        mouth.keyframe_insert(data_path='location', frame=f)
        lower.location = (base_l.x, base_l.y + .0008 * H * vv, base_l.z - .0060 * H * vv)
        lower.keyframe_insert(data_path='location', frame=f)
        tg = rig['tongue']
        tb = rig['tongue_base']
        tg.location = (tb.x, tb.y - .0006 * H * vv, tb.z - .0050 * H * vv)
        tg.keyframe_insert(data_path='location', frame=f)
        if nod:
            nb.rotation_euler = (math.radians(.8 * nod * vv), 0, 0)
            nb.keyframe_insert(data_path='rotation_euler', frame=f)


def walk(rig, frames, fps=24, start=1, phase=0.0, stride=1.0, step_hz=1.55,
         bob=1.0, arm_swing=1.0, lean=2.0, sway=1.0):
    """步态循环：只驱动骨骼，位移和转向用 move()。

    step_hz 是每秒完整步周期；步幅与位移由调用方在 move() 里配平
    （约 step_hz*0.55*H 米/秒）。role 朝 -Y，thigh 负 X 旋转=向前迈。
    """
    pb = rig['arm'].pose.bones
    H = rig['height']
    for f in range(start, start + frames + 1, 2):
        t = (f - start) / float(fps)
        ph = 2 * math.pi * step_hz * t + phase
        s = math.sin(ph)
        thigh = 24.0 * stride
        knee = 32.0 * stride
        for side, sign in (('L', 1), ('R', -1)):
            swing = s * sign
            pb['thigh.' + side].rotation_euler = (math.radians(-thigh * swing), 0, 0)
            bend = knee * max(0.0, -swing)
            pb['shin.' + side].rotation_euler = (math.radians(bend), 0, 0)
            pb['foot.' + side].rotation_euler = (math.radians(-.45 * bend), 0, 0)
            pb['upper_arm.' + side].rotation_euler = (
                math.radians(16.0 * arm_swing * swing), 0, math.radians(-sign * 3.0))
            pb['forearm.' + side].rotation_euler = (
                math.radians(46.0 + 8.0 * max(0.0, swing)), 0, 0)
            for bone in ('thigh.', 'shin.', 'foot.', 'upper_arm.', 'forearm.'):
                pb[bone + side].keyframe_insert(data_path='rotation_euler', frame=f)
        pb['hips'].location = (0, .0035 * H * bob * math.cos(2 * ph), 0)
        pb['hips'].keyframe_insert(data_path='location', frame=f)
        pb['chest'].rotation_euler = (math.radians(lean + 1.2 * math.cos(2 * ph)),
                                      0, math.radians(1.1 * sway * s))
        pb['chest'].keyframe_insert(data_path='rotation_euler', frame=f)


def move(rig, keys):
    """整体走位：[(frame, x, y)] 或 [(frame, x, y, yaw_deg)]，本地帧。"""
    arm = rig['arm']
    for k in keys:
        f, x, y = k[0], k[1], k[2]
        arm.location = (x, y, arm.location.z)
        arm.keyframe_insert(data_path='location', frame=f)
        if len(k) > 3:
            arm.rotation_euler = (0, 0, math.radians(k[3]))
            arm.keyframe_insert(data_path='rotation_euler', frame=f)

