"""P3 · VFX 与物理套件（确定性预设）。

四类效果：

  cloth_flag()     布料旗帜/门帘：内置 PBD 求解器离线算好每一帧，
                   烘进 shape key 姿态（Blender 5.3 无头模式下 Cloth 修改器不步进，
                   所以布料自己解算；解析在构建时完成，不需要 bake）
  flame_volume()   火/烟体积：程序化噪声体积，4D 噪声与自发光随时间翻卷，无流体缓存
  rigid_world()    刚体世界：gravity / 子步 / 缓存范围；rigid_body() 给物体加主动/被动
  splash()         水花粒子：单次爆发式粒子，固定 seed，object 实例化成水珠

确定性约定：所有随机量来自固定 seed；刚体/粒子由 bake(scene) 从第 1 帧顺序步进，
布料在构建时按帧数一次解算。同一份脚本每次生成的帧序列一致。
渲染前必须先 bake()，否则刚体与粒子停在初始帧。

  python: import cg_vfx as V
          V.bake(scene, frame_end)
"""
import math

import bmesh
import bpy
from mathutils import Vector

import cg_kit as K


# ---------------------------------------------------------------- 物理烘焙

def bake(scene, frame_end, fps=24, label='vfx'):
    """从第 1 帧顺序步进到 frame_end，烘焙刚体/粒子缓存（布料无需）。

    必须在渲染之前调用一次；先渲染再烘会得到静止的第一帧。
    """
    scene.frame_set(1)
    for f in range(2, int(frame_end) + 1):
        scene.frame_set(f)
    print('CG_BAKE', label, 'frames 1..%d @%dfps' % (frame_end, fps), flush=True)


# ---------------------------------------------------------------- 布料

def _cloth_mesh(name, w, h, nx, ny, ripple=0.004):
    bm = bmesh.new()
    rows = []
    for j in range(ny + 1):
        z = -h / 2 + h * j / ny
        row = []
        for i in range(nx + 1):
            x = -w / 2 + w * i / nx
            y = ripple * math.sin(i * 0.7 + j * 0.4) * (j / ny)
            row.append(bm.verts.new((x, y, z)))
        rows.append(row)
    for j in range(ny):
        for i in range(nx):
            bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
    bm.normal_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return me


def _sim_cloth(w, h, nx, ny, frame_count, fps, wind, seed, pin,
               iters=5, stiffness=0.92, gravity=9.81):
    """PBD 布片：结构/剪切/弯曲距离约束 + 顶边钉住 + 阵风。返回逐帧位置。"""
    cols, rows = nx + 1, ny + 1

    def at(i, j):
        return j * cols + i

    rest = [Vector((-w / 2 + w * i / nx, 0.0, -h / 2 + h * j / ny))
            for j in range(rows) for i in range(cols)]
    cons = []

    def add(a, b, k):
        cons.append((a, b, k, (rest[a] - rest[b]).length))

    for j in range(rows):
        for i in range(cols):
            if i < nx:
                add(at(i, j), at(i + 1, j), 1.0)
            if j < ny:
                add(at(i, j), at(i, j + 1), 1.0)
            if i < nx and j < ny:
                add(at(i, j), at(i + 1, j + 1), 0.6)
                add(at(i + 1, j), at(i, j + 1), 0.6)
            if i < nx - 1:
                add(at(i, j), at(i + 2, j), 0.16)
            if j < ny - 1:
                add(at(i, j), at(i, j + 2), 0.16)

    pins = ({at(i, ny) for i in range(cols)} if pin == 'top'
            else {at(0, j) for j in range(rows)})
    pos = [p.copy() for p in rest]
    prev = [p.copy() for p in rest]
    out = [[p.copy() for p in pos]]
    dt = 1.0 / fps
    sub = 2
    hs = dt / sub
    wstr, wturb = (wind or (0, 0))
    for f in range(1, frame_count):
        t = f * dt
        for _ in range(sub):
            for k in range(len(pos)):
                if k in pins:
                    continue
                zf = 1.0 - (rest[k].z + h / 2) / h
                gust = 0.55 + 0.45 * math.sin(6.1 * t + 2.1 * rest[k].x + seed)
                acc = Vector((0.0, 0.0, -gravity))
                acc.y -= wstr * (0.35 + 0.65 * zf) * gust
                acc.x -= wstr * 0.22 * math.sin(2.1 * t + 1.1 * rest[k].z + seed)
                acc.x += wturb * math.sin(5.1 * t + 24.0 * rest[k].z + 17.0 * rest[k].x + 1.7 * seed)
                acc.z += 0.5 * wturb * math.sin(6.7 * t + 21.0 * rest[k].x + seed)
                vel = (pos[k] - prev[k]) * 0.985
                prev[k] = pos[k].copy()
                pos[k] = pos[k] + vel + acc * (hs * hs)
            for _ in range(iters):
                for a, b, k, L in cons:
                    d = pos[b] - pos[a]
                    ln = d.length
                    if ln < 1e-9:
                        continue
                    corr = d * ((ln - L) / ln * 0.5 * k * stiffness)
                    if a not in pins:
                        pos[a] += corr
                    if b not in pins:
                        pos[b] -= corr
        out.append([p.copy() for p in pos])
    return out


def _bake_pose_keys(obj, poses, frame0=1):
    """把逐帧位置烘成 shape key：每帧一个 key，相邻帧之间线性过渡。"""
    try:
        bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
    except Exception:
        pass
    obj.shape_key_add(name='Basis', from_mix=False)
    for i, pose in enumerate(poses):
        sk = obj.shape_key_add(name='p%03d' % i, from_mix=False)
        flat = [c for p in pose for c in (p.x, p.y, p.z)]
        sk.data.foreach_set('co', flat)
        f = frame0 + i
        for val, frame in ((0.0, f - 1), (1.0, f), (0.0, f + 1)):
            sk.value = val
            sk.keyframe_insert('value', frame=frame)


def cloth_flag(name, loc=(0, 0, 0), size=(0.95, 0.5), rot=(0, 0, 0), mat=None,
               frames=(1, 120), fps=24, nx=22, ny=14, pin='top',
               wind=(3.0, 0.7), seed=3, thickness=0.0016):
    """一块被钉住一条边的布。pin='top' 顶边固定，或用 'left' 固定左边。

    wind=(主风, 湍流) 是沿 -Y（朝镜头）的风加速度量级；构建时解算
    frames[1]-frames[0] 帧并存进 shape key，无需 bake，渲染逐帧可复现。
    """
    w, h = size
    count = int(frames[1] - frames[0]) + 1
    poses = _sim_cloth(w, h, nx, ny, count, fps, wind, seed, pin)
    me = _cloth_mesh(name, w, h, nx, ny, ripple=0.0)
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rot
    if mat is None:
        mat, _, _, _ = K.material(name + 'Mat', (0.55, 0.10, 0.055, 1), roughness=0.85)
    me.materials.append(mat)
    _bake_pose_keys(obj, poses, frame0=frames[0])

    sol = obj.modifiers.new('Sol', 'SOLIDIFY')
    sol.thickness = thickness
    sol.offset = 0
    return obj


# ---------------------------------------------------------------- 火 / 烟

def flame_volume(name, loc=(0, 0, 0.7), size=(0.5, 0.5, 0.95), frames=(1, 120),
                 intensity=7.0, density=3.2, seed=3, drift=3.2, hotspot=0.35,
                 fire=(1.0, 0.30, 0.05), smoke=(0.035, 0.026, 0.022)):
    """程序化火焰 + 烟：底部橙红发光，向上翻卷成深色烟，4D 噪声沿时间上升。"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    m = bpy.data.materials.new(name + 'Mat')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    vol = nt.nodes.new('ShaderNodeVolumePrincipled')
    nt.links.new(vol.outputs['Volume'], out.inputs['Volume'])
    K.S(vol, 'Anisotropy', 0.3)
    K.S(vol, 'Absorption Color', (0.05, 0.04, 0.035, 1))

    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs['Vector'])

    # 高度 0..1（底部到顶部）
    hz = nt.nodes.new('ShaderNodeMapRange')
    K.S(hz, 'From Min', -size[2] / 2)
    K.S(hz, 'From Max', size[2] / 2)
    K.S(hz, 'To Min', 0.0)
    K.S(hz, 'To Max', 1.0)
    nt.links.new(sep.outputs['Z'], hz.inputs['Value'])

    def noise4d(scale, detail, rough, deltas, w_end):
        n = nt.nodes.new('ShaderNodeTexNoise')
        n.noise_dimensions = '4D'
        K.S(n, 'Scale', scale)
        K.S(n, 'Detail', detail)
        K.S(n, 'Roughness', rough)
        K.S(n, 'Distortion', 0.55)
        mp = nt.nodes.new('ShaderNodeMapping')
        K.S(mp, 'Location', deltas)
        nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
        nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
        w = n.inputs['W']
        w.default_value = 0.0
        w.keyframe_insert(data_path='default_value', frame=frames[0])
        w.default_value = w_end
        w.keyframe_insert(data_path='default_value', frame=frames[1])
        return n

    core = noise4d(10.5, 8, 0.62, (0, 0, 0), drift)
    wisps = noise4d(20.0, 5, 0.6, (9.0, 0, 0), drift * 1.7)

    def mrange(src, a, b, c=0.0, d=1.0):
        mr = nt.nodes.new('ShaderNodeMapRange')
        K.S(mr, 'From Min', a)
        K.S(mr, 'From Max', b)
        K.S(mr, 'To Min', c)
        K.S(mr, 'To Max', d)
        nt.links.new(src, mr.inputs['Value'])
        return mr

    # 边缘羽化
    def edge(axis, half):
        ab = nt.nodes.new('ShaderNodeMath')
        ab.operation = 'ABSOLUTE'
        nt.links.new(sep.outputs[axis], ab.inputs[0])
        return mrange(ab.outputs['Value'], half * 0.45, half, 1.0, 0.0)

    ex = edge('X', size[0] / 2)
    ey = edge('Y', size[1] / 2)
    # 底部密度高、顶部渐隐（火焰形状）
    vert = mrange(hz.outputs['Result'], 0.0, 1.0, 1.0, 0.0)

    def mul(a, b, extra=None):
        node = nt.nodes.new('ShaderNodeMath')
        node.operation = 'MULTIPLY'
        nt.links.new(a, node.inputs[0])
        nt.links.new(b, node.inputs[1])
        if extra is not None:
            node.inputs[1].default_value = extra
        return node

    base = mrange(core.outputs['Fac'], 0.42, 0.64, 0.0, 1.0)
    d1 = mul(base.outputs['Result'], ex.outputs['Result'])
    d2 = mul(d1.outputs['Value'], ey.outputs['Result'])
    d3 = mul(d2.outputs['Value'], vert.outputs['Result'])
    d4 = mul(d3.outputs['Value'], base.outputs['Result'])
    dens = nt.nodes.new('ShaderNodeMath')
    dens.operation = 'MULTIPLY'
    dens.inputs[1].default_value = density
    nt.links.new(d4.outputs['Value'], dens.inputs[0])
    nt.links.new(dens.outputs['Value'], vol.inputs['Density'])

    # 火焰颜色：底部炽热 → 顶部烟色
    col = nt.nodes.new('ShaderNodeValToRGB')
    cr = col.color_ramp
    cr.elements[0].position = 0.0
    cr.elements[0].color = (*fire, 1)
    cr.elements[1].position = hotspot
    cr.elements[1].color = (*smoke, 1)
    e2 = cr.elements.new(0.72)
    e2.color = (*[c * 0.45 for c in smoke], 1)
    nt.links.new(hz.outputs['Result'], col.inputs['Fac'])
    nt.links.new(col.outputs['Color'], vol.inputs['Emission Color'])
    K.S(vol, 'Color', (0.5, 0.42, 0.36, 1))

    glow = mrange(hz.outputs['Result'], 0.0, hotspot * 1.35, 1.0, 0.0)
    wisp = mrange(wisps.outputs['Fac'], 0.35, 0.7, 0.35, 1.0)
    g1 = mul(glow.outputs['Result'], wisp.outputs['Result'])
    g2 = mul(g1.outputs['Value'], d3.outputs['Value'])
    val = nt.nodes.new('ShaderNodeValue')
    val.outputs[0].default_value = 1.0
    val.name = name + 'Flicker'
    base_f = intensity
    keys = [(frames[0], 1.0), (frames[0] + 5, 0.72), (frames[0] + 11, 1.12),
            (frames[0] + 18, 0.85), (frames[0] + 26, 1.18), (frames[0] + 33, 0.78)]
    span = frames[1] - frames[0]
    for i, (f, v) in enumerate(keys):
        val.outputs[0].default_value = v
        val.outputs[0].keyframe_insert('default_value', frame=f)
    # 后半段用同型的低幅抖动续上
    for i in range(8):
        f = frames[0] + 36 + int((span - 36) * i / 8)
        v = 0.86 + 0.28 * math.sin(i * 2.3 + seed)
        val.outputs[0].default_value = v
        val.outputs[0].keyframe_insert('default_value', frame=f)
    g3 = mul(g2.outputs['Value'], val.outputs[0])
    em = nt.nodes.new('ShaderNodeMath')
    em.operation = 'MULTIPLY'
    em.inputs[1].default_value = base_f
    nt.links.new(g3.outputs['Value'], em.inputs[0])
    nt.links.new(em.outputs['Value'], vol.inputs['Emission Strength'])

    obj.data.materials.append(m)
    obj.visible_shadow = False
    return obj, val


# ---------------------------------------------------------------- 刚体

def rigid_world(scene, frame_end=120, substeps=12, iterations=20):
    if scene.rigidbody_world is None:
        bpy.ops.rigidbody.world_add()
    rbw = scene.rigidbody_world
    rbw.substeps_per_frame = substeps
    rbw.solver_iterations = iterations
    rbw.point_cache.frame_start = 1
    rbw.point_cache.frame_end = int(frame_end)
    scene.use_gravity = True
    return rbw


def rigid_body(obj, kind='ACTIVE', mass=0.4, friction=0.55, restitution=0.28,
               shape='CONVEX_HULL', linear_damping=0.15, angular_damping=0.25):
    """Blender 5.x 无初速度 API：起始姿态和重力决定运动，靠摆放给出方向。"""
    bpy.context.view_layer.objects.active = obj
    for o in bpy.context.selected_objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.ops.rigidbody.object_add(type=kind)
    rb = obj.rigid_body
    rb.collision_shape = shape if kind == 'ACTIVE' else 'MESH'
    if kind == 'ACTIVE':
        rb.mass = mass
        rb.friction = friction
        rb.restitution = restitution
        rb.linear_damping = linear_damping
        rb.angular_damping = angular_damping
    return rb


def can(name, loc, r=0.033, h=0.092, mat=None, label=None, rot=(0, 0, 0)):
    """一罐饮料：铝皮罐身 + 一圈纸标，返回罐身物体。"""
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=r, depth=h, location=loc)
    body = bpy.context.object
    body.name = name
    body.rotation_euler = rot
    if mat is None:
        mat, _, _, _ = K.material(name + 'Alu', (0.55, 0.56, 0.58, 1), metallic=1.0,
                                  roughness=0.28)
    body.data.materials.append(mat)
    bev = body.modifiers.new('Bevel', 'BEVEL')
    bev.width = 0.0035
    bev.segments = 2
    if label is not None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=r + 0.0006,
                                            depth=h * 0.62, location=loc)
        band = bpy.context.object
        band.name = name + 'Label'
        band.rotation_euler = rot
        band.data.materials.append(label)
        band.parent = body
        band.matrix_parent_inverse = body.matrix_world.inverted()
    return body


# ---------------------------------------------------------------- 水花

WATER = None


def _water_mat():
    global WATER
    if WATER is None:
        WATER, _, _, _ = K.material('WaterDrop', (0.62, 0.72, 0.80, 1), roughness=0.05,
                                    emission=(0.35, 0.45, 0.55, 1), emission_strength=0.25)
    return WATER


def splash(name, loc, frame_start=28, count=140, speed=1.9, spread=0.9,
           frames=(1, 120), seed=5, radius=0.0016):
    """水花：从 loc 的小圆盘向上爆发的粒子，受重力回落，实例化成水珠。"""
    drop_m = _water_mat()
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=radius,
                                         location=(0, 0, -40))
    drop = bpy.context.object
    drop.name = name + 'Drop'
    drop.data.materials.append(drop_m)
    try:
        drop.visible_shadow = False
    except Exception:
        pass

    bpy.ops.mesh.primitive_circle_add(vertices=16, radius=0.02, fill_type='NGON',
                                      location=loc)
    emitter = bpy.context.object
    emitter.name = name + 'Emitter'
    emitter.show_instancer_for_render = False
    emitter.show_instancer_for_viewport = False

    mod = emitter.modifiers.new('Splash', 'PARTICLE_SYSTEM')
    ps = mod.particle_system.settings
    ps.count = count
    ps.frame_start = frame_start
    ps.frame_end = frame_start + 2
    ps.lifetime = 14
    ps.lifetime_random = 0.4
    ps.emit_from = 'FACE'
    ps.distribution = 'RAND'
    ps.normal_factor = speed
    ps.factor_random = spread
    ps.physics_type = 'NEWTON'
    ps.mass = 1.0
    ps.brownian_factor = 0.35
    ps.drag_factor = 0.12
    ps.render_type = 'OBJECT'
    ps.instance_object = drop
    ps.particle_size = 1.0
    ps.size_random = 0.7
    ps.use_rotations = False
    ps.use_scale_instance = True
    mod.particle_system.seed = seed
    emitter.particle_systems[0].point_cache.frame_start = frames[0]
    emitter.particle_systems[0].point_cache.frame_end = frames[1]
    return emitter


def puddle(name, loc, radius=0.3, rot=0.0, lift=0.004):
    """水洼：深色镜面圆片，alpha 用径向渐变 + 噪声打散边缘。

    硬边圆片在地面上会读成"贴了一片纸/一个洞"；水洼的真实感来自
    边缘渐隐和镜面反光，所以这里不用几何修边，直接用 alpha。
    """
    m, nt, bsdf, _ = K.material(name + 'Mat', (0.020, 0.024, 0.030, 1), roughness=0.04,
                                coat=1.0,
                                emission=(0.10, 0.14, 0.19, 1), emission_strength=0.30)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sub = nt.nodes.new('ShaderNodeVectorMath')
    sub.operation = 'SUBTRACT'
    sub.inputs[1].default_value = (0.5, 0.5, 0.5)
    nt.links.new(tc.outputs['Generated'], sub.inputs[0])
    ln = nt.nodes.new('ShaderNodeVectorMath')
    ln.operation = 'LENGTH'
    nt.links.new(sub.outputs['Vector'], ln.inputs[0])
    rng = nt.nodes.new('ShaderNodeMapRange')
    K.S(rng, 'From Min', 0.34)
    K.S(rng, 'From Max', 0.50)
    K.S(rng, 'To Min', 1.0)
    K.S(rng, 'To Max', 0.0)
    nt.links.new(ln.outputs['Value'], rng.inputs['Value'])
    noi = nt.nodes.new('ShaderNodeTexNoise')
    K.S(noi, 'Scale', 6.0)
    K.S(noi, 'Detail', 3.0)
    nt.links.new(tc.outputs['Generated'], noi.inputs['Vector'])
    mot = nt.nodes.new('ShaderNodeMath')
    mot.operation = 'MULTIPLY_ADD'
    mot.inputs[1].default_value = 0.22
    mot.inputs[2].default_value = 0.78
    nt.links.new(noi.outputs['Fac'], mot.inputs[0])
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    nt.links.new(rng.outputs['Result'], mul.inputs[0])
    nt.links.new(mot.outputs['Value'], mul.inputs[1])
    nt.links.new(mul.outputs['Value'], bsdf.inputs['Alpha'])
    if hasattr(m, 'surface_render_method'):
        m.surface_render_method = 'BLENDED'

    bpy.ops.mesh.primitive_circle_add(vertices=48, radius=radius, fill_type='NGON',
                                      location=(loc[0], loc[1], loc[2] + lift))
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler[2] = rot
    obj.data.materials.append(m)
    return obj
