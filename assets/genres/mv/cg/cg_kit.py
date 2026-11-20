"""cg_kit — Blender 5.x 程序化 CG 镜头的通用底座（Blender 端）。

用法：电影工程里的 cg/film.py 导入本文件，按镜头搭景、摆机位、渲帧。
所有函数只负责"搭"，不负责"讲"；故事、空间、光线仍由 film.py 决定。

渲染约定：
  - 时间轴以秒写，帧号从 1 开始；frame 1 = 第 0 秒。
  - render_frames() 输出 frame_0000.png 起的连续帧，供故事管线 encode.js 直接编码。
"""
import bpy
import json
import math
import os
import sys
import time
from mathutils import Vector


# ---------------------------------------------------------------- scene

def reset():
    """清空默认场景（Cube / Light / Camera），否则会得到一块白色台面。"""
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.cameras, bpy.data.lights):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def setup_scene(width=1920, height=1080, fps=24, frame_end=120, samples=24,
                engine='EEVEE', exposure=0.0, motion_blur=True, shutter=0.45,
                view_transform='AgX', look=None):
    scene = bpy.context.scene
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.fps = fps
    scene.frame_start = 1
    scene.frame_end = frame_end
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.image_settings.color_depth = '8'
    scene.render.image_settings.compression = 15
    scene.render.use_motion_blur = motion_blur
    scene.render.motion_blur_shutter = shutter
    scene.render.engine = 'BLENDER_EEVEE' if engine.upper() == 'EEVEE' else 'CYCLES'
    if scene.render.engine == 'BLENDER_EEVEE':
        scene.eevee.taa_render_samples = samples
        _set(scene.eevee, 'use_raytracing', True)
        _set(scene.eevee, 'volumetric_tile_size', '8')
        _set(scene.eevee, 'volumetric_samples', 32)
        _set(scene.eevee, 'volumetric_start', 0.4)
        _set(scene.eevee, 'volumetric_end', 8.0)
        _set(scene.eevee, 'use_volumetric_shadows', False)
    else:
        scene.cycles.samples = samples
        scene.cycles.use_denoising = True
        _setup_cycles_device(scene)
    scene.view_settings.view_transform = view_transform
    if look:
        try:
            scene.view_settings.look = look
        except Exception as e:
            print('CG_LOOK_SKIP', e)
    scene.view_settings.exposure = exposure
    return scene


def _setup_cycles_device(scene):
    """CYCLES 设备：macOS -> Metal，Windows -> OptiX / CUDA / HIP（按顺序探测）。
    CG_DEVICE=cpu 强制 CPU；auto 时找不到 GPU 就安静回落到 CPU。
    只写显卡偏好，不改采样与画质参数。"""
    want = (os.environ.get('CG_DEVICE') or 'auto').lower()
    if want == 'cpu':
        scene.cycles.device = 'CPU'
        print('CG_DEVICE cpu (forced)', flush=True)
        return
    prefs = bpy.context.preferences.addons['cycles'].preferences
    if hasattr(prefs, 'refresh_devices'):
        try:
            prefs.refresh_devices()
        except Exception:
            pass
    if sys.platform == 'darwin':
        backends = [('METAL', 'Metal')]
    elif sys.platform == 'win32':
        backends = [('OPTIX', 'OptiX'), ('CUDA', 'CUDA'), ('HIP', 'HIP')]
    else:
        backends = [('CUDA', 'CUDA'), ('HIP', 'HIP'), ('ONEAPI', 'oneAPI')]
    for name, label in backends:
        try:
            prefs.compute_device_type = name
            prefs.get_devices()
        except Exception as e:
            print('CG_DEVICE_SKIP', name, e, flush=True)
            continue
        gpus = [d for d in prefs.devices if getattr(d, 'type', 'CPU') != 'CPU']
        if not gpus:
            continue
        for d in prefs.devices:
            d.use = getattr(d, 'type', 'CPU') != 'CPU'
        scene.cycles.device = 'GPU'
        print('CG_DEVICE', label, 'gpus=' + str(len(gpus)), flush=True)
        return
    scene.cycles.device = 'CPU'
    print('CG_DEVICE cpu (no GPU backend available)', flush=True)


def _set(owner, name, value):
    if hasattr(owner, name):
        try:
            setattr(owner, name, value)
        except Exception as e:
            print('CG_SET_SKIP', name, e)


def set_float(node, name, value):
    sock = node.inputs.get(name)
    if sock is None:
        print('CG_MISSING_INPUT', node.name, name)
        return None
    sock.default_value = value
    return sock


S = set_float


# ---------------------------------------------------------------- world

def hdri_world(path, strength=0.07, rotation_deg=95, saturation=0.45, value=0.95):
    world = bpy.data.worlds.new('World'); bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    env = nt.nodes.new('ShaderNodeTexEnvironment')
    env.image = bpy.data.images.load(path, check_existing=True)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    S(mp, 'Rotation', (0, 0, math.radians(rotation_deg)))
    nt.links.new(tc.outputs['Generated'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], env.inputs['Vector'])
    hue = nt.nodes.new('ShaderNodeHueSaturation')
    S(hue, 'Saturation', saturation); S(hue, 'Value', value)
    nt.links.new(env.outputs['Color'], hue.inputs['Color'])
    S(bg, 'Strength', strength)
    nt.links.new(hue.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    return world


# ---------------------------------------------------------------- materials

def material(name, color=(0.5, 0.5, 0.5, 1), metallic=0.0, roughness=0.5, coat=0.0,
             coat_rough=0.1, emission=None, emission_strength=0.0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    S(bsdf, 'Base Color', color)
    S(bsdf, 'Metallic', metallic)
    S(bsdf, 'Roughness', roughness)
    if coat:
        S(bsdf, 'Coat Weight', coat); S(bsdf, 'Coat Roughness', coat_rough)
    if emission:
        S(bsdf, 'Emission Color', emission)
        S(bsdf, 'Emission Strength', emission_strength)
    if alpha < 1.0:
        S(bsdf, 'Alpha', alpha)
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return m, nt, bsdf, out


def emission_material(name, color=(1.0, 0.6, 0.3, 1), strength=3.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    S(em, 'Color', color); S(em, 'Strength', strength)
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m, nt, em


def pbr_textured(name, diff_path, rough_path=None, normal_path=None, ao_path=None,
                 uv_scale=(1, 1, 1), roughness_range=(0.12, 0.55), coat=0.0):
    m, nt, bsdf, _ = material(name)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping'); S(mp, 'Scale', uv_scale)
    nt.links.new(tc.outputs['UV'], mp.inputs['Vector'])

    def image(path, colorspace):
        n = nt.nodes.new('ShaderNodeTexImage')
        n.image = bpy.data.images.load(path, check_existing=True)
        n.image.colorspace_settings.name = colorspace
        nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
        return n

    diff = image(diff_path, 'sRGB')
    if ao_path:
        ao = image(ao_path, 'Non-Color')
        mix = nt.nodes.new('ShaderNodeMixRGB'); mix.blend_type = 'MULTIPLY'; S(mix, 'Fac', 1.0)
        nt.links.new(diff.outputs['Color'], mix.inputs[1])
        nt.links.new(ao.outputs['Color'], mix.inputs[2])
        nt.links.new(mix.outputs['Color'], bsdf.inputs['Base Color'])
    else:
        nt.links.new(diff.outputs['Color'], bsdf.inputs['Base Color'])
    if rough_path:
        rough = image(rough_path, 'Non-Color')
        mr = nt.nodes.new('ShaderNodeMapRange')
        S(mr, 'From Min', 0.0); S(mr, 'From Max', 1.0)
        S(mr, 'To Min', roughness_range[0]); S(mr, 'To Max', roughness_range[1])
        nt.links.new(rough.outputs['Color'], mr.inputs['Value'])
        nt.links.new(mr.outputs['Result'], bsdf.inputs['Roughness'])
    if normal_path:
        nor = image(normal_path, 'Non-Color')
        nm = nt.nodes.new('ShaderNodeNormalMap'); S(nm, 'Strength', 0.55)
        nt.links.new(nor.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    if coat:
        S(bsdf, 'Coat Weight', coat); S(bsdf, 'Coat Roughness', 0.08)
    return m, nt, bsdf


def noise_detail(nt, bsdf, scale=30.0, detail=6, strength=0.3, distance=0.01, rough=None):
    noise = nt.nodes.new('ShaderNodeTexNoise')
    S(noise, 'Scale', scale); S(noise, 'Detail', detail)
    bump = nt.nodes.new('ShaderNodeBump')
    S(bump, 'Strength', strength); S(bump, 'Distance', distance)
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    if rough:
        mr = nt.nodes.new('ShaderNodeMapRange')
        S(mr, 'From Min', 0.2); S(mr, 'From Max', 0.8)
        S(mr, 'To Min', rough[0]); S(mr, 'To Max', rough[1])
        nt.links.new(noise.outputs['Fac'], mr.inputs['Value'])
        nt.links.new(mr.outputs['Result'], bsdf.inputs['Roughness'])
    return noise


# ---------------------------------------------------------------- lights

def area_light(name, loc, energy, color, size, target):
    bpy.ops.object.light_add(type='AREA', location=loc)
    o = bpy.context.object; o.name = name
    o.data.energy = energy; o.data.color = color; o.data.size = size
    o.rotation_euler = (Vector(target) - o.location).to_track_quat('-Z', 'Y').to_euler()
    return o


def point_light(name, loc, energy, color, radius=0.1):
    bpy.ops.object.light_add(type='POINT', location=loc)
    o = bpy.context.object; o.name = name
    o.data.energy = energy; o.data.color = color; o.data.shadow_soft_size = radius
    return o


# ---------------------------------------------------------------- neon text

FONT_CANDIDATES = [
    '/System/Library/Fonts/Hiragino Sans GB.ttc',
    '/System/Library/Fonts/STHeiti Medium.ttc',
]


def neon_text(name, body, size, loc, color, strength, rotation=(math.pi / 2, 0, 0),
              extrude=0.004, bevel=0.005, align='CENTER'):
    font = None
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            font = bpy.data.fonts.load(path)
            break
    bpy.ops.object.text_add(location=loc, rotation=rotation)
    o = bpy.context.object; o.name = name
    o.data.body = body
    if font:
        o.data.font = font
    o.data.size = size
    o.data.extrude = extrude
    o.data.bevel_depth = bevel
    o.data.bevel_resolution = 2
    o.data.align_x = align
    o.data.align_y = 'CENTER'
    o.data.space_character = 1.05
    m, _, em = emission_material(name + 'Mat', color, strength)
    o.data.materials.append(m)
    return o, em


def flicker(em, base, keys):
    for frame, mul in keys:
        S(em, 'Strength', base * mul)
        em.inputs['Strength'].keyframe_insert(data_path='default_value', frame=frame)


# ---------------------------------------------------------------- volume / particles

def steam_volume(name, loc=(0, 0, 1.33), size=(0.44, 0.44, 0.46), density=5.0,
                 frames=(1, 120), noise_scale=9.0, drift=2.4, color=(1.0, 0.96, 0.9),
                 absorption=(0.85, 0.82, 0.78), anisotropy=0.45,
                 ramp=(0.42, 0.66), fade_z=0.20, inset=0.05):
    """碗口蒸汽：底部密、向上散，侧面羽化，4D 噪波随时间翻卷。

    size 是体积盒尺寸；fade_z 是对象空间里密度衰减到 0 的高度（默认略高于盒中心）。
    """
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object; obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    m = bpy.data.materials.new(name + 'Mat'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')

    vol = nt.nodes.new('ShaderNodeVolumePrincipled')
    S(vol, 'Color', (*color, 1))
    S(vol, 'Anisotropy', anisotropy)
    S(vol, 'Absorption Color', (*absorption, 1))
    nt.links.new(vol.outputs['Volume'], out.inputs['Volume'])

    noise = nt.nodes.new('ShaderNodeTexNoise'); noise.noise_dimensions = '4D'
    S(noise, 'Scale', noise_scale); S(noise, 'Detail', 8)
    S(noise, 'Roughness', 0.66); S(noise, 'Distortion', 0.6)
    w = noise.inputs['W']
    w.default_value = 0.0; w.keyframe_insert(data_path='default_value', frame=frames[0])
    w.default_value = drift; w.keyframe_insert(data_path='default_value', frame=frames[1])

    ramp_node = nt.nodes.new('ShaderNodeValToRGB')
    ramp_node.color_ramp.elements[0].position = ramp[0]
    ramp_node.color_ramp.elements[1].position = ramp[1]
    nt.links.new(noise.outputs['Fac'], ramp_node.inputs['Fac'])

    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs['Vector'])
    nt.links.new(tc.outputs['Object'], noise.inputs['Vector'])

    def mask(axis, fmin, fmax, absolute):
        src = sep.outputs[axis]
        if absolute:
            ax = nt.nodes.new('ShaderNodeMath'); ax.operation = 'ABSOLUTE'
            nt.links.new(src, ax.inputs[0]); src = ax.outputs['Value']
        mr = nt.nodes.new('ShaderNodeMapRange')
        S(mr, 'From Min', fmin); S(mr, 'From Max', fmax)
        S(mr, 'To Min', 1.0); S(mr, 'To Max', 0.0)
        nt.links.new(src, mr.inputs['Value'])
        return mr

    mx = mask('X', inset, size[0] / 2 - 0.005, True)
    my = mask('Y', inset, size[1] / 2 - 0.005, True)
    mzA = mask('Z', -size[2] / 2, -0.02, False)
    mzB = mask('Z', 0.06, fade_z, False)

    def mul(a, b):
        node = nt.nodes.new('ShaderNodeMath'); node.operation = 'MULTIPLY'
        nt.links.new(a, node.inputs[0]); nt.links.new(b, node.inputs[1])
        return node

    m1 = mul(ramp_node.outputs['Color'], mx.outputs['Result'])
    m2 = mul(m1.outputs['Value'], my.outputs['Result'])
    m2b = mul(m2.outputs['Value'], mzA.outputs['Result'])
    m3 = mul(m2b.outputs['Value'], mzB.outputs['Result'])
    m4 = nt.nodes.new('ShaderNodeMath'); m4.operation = 'MULTIPLY'
    m4.inputs[1].default_value = density
    nt.links.new(m3.outputs['Value'], m4.inputs[0])
    nt.links.new(m4.outputs['Value'], vol.inputs['Density'])
    obj.data.materials.append(m)
    obj.visible_shadow = False
    return obj


def rain(name='Rain', loc=(0, 1.35, 2.7), size=2.6, count=1800, drop_radius=0.0015,
         drop_length=0.12, speed=-6.5, lifetime=34, frames=(1, 120), emission=0.8,
         color=(0.35, 0.45, 0.58), seed=7):
    drop_m, _, _, _ = material(name + 'DropMat', (*color, 1), roughness=0.1,
                               emission=(0.45, 0.62, 0.82, 1), emission_strength=emission)
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=drop_radius, depth=drop_length,
                                        location=(0, 0, -50))
    drop = bpy.context.object; drop.name = name + 'Drop'
    drop.data.materials.append(drop_m)
    try:
        drop.visible_shadow = False
    except Exception:
        pass
    bpy.ops.mesh.primitive_plane_add(size=size, location=loc)
    emitter = bpy.context.object; emitter.name = name + 'Emitter'
    emitter.show_instancer_for_render = False
    emitter.show_instancer_for_viewport = False
    mod = emitter.modifiers.new('Rain', 'PARTICLE_SYSTEM')
    ps = mod.particle_system.settings
    ps.count = count
    ps.frame_start = 1 - lifetime
    ps.frame_end = frames[1]
    ps.lifetime = lifetime
    ps.emit_from = 'FACE'
    ps.distribution = 'RAND'
    ps.normal_factor = speed
    ps.factor_random = 0.8
    ps.physics_type = 'NEWTON'
    ps.mass = 1.0
    ps.brownian_factor = 0.02
    ps.drag_factor = 0.0
    ps.render_type = 'OBJECT'
    ps.instance_object = drop
    ps.particle_size = 1.0
    ps.size_random = 0.7
    ps.use_rotations = False
    ps.use_scale_instance = True
    mod.particle_system.seed = seed
    return emitter


# ---------------------------------------------------------------- camera

def camera(loc, target, lens=65, focus=None, fstop=2.0, frames=(1, 120),
           move=None, handheld=0.0022, aperture_blades=7):
    """机位；move 是终点相对起点的位移 (dx, dy, dz)，用缓动在整段镜头里推进。"""
    bpy.ops.object.camera_add(location=loc)
    cam = bpy.context.object
    bpy.context.scene.camera = cam
    cam.data.lens = lens
    if focus is not None:
        cam.data.dof.use_dof = True
        cam.data.dof.focus_object = focus
        cam.data.dof.aperture_fstop = fstop
        cam.data.dof.aperture_blades = aperture_blades
    start = Vector(loc)
    end = start + Vector(move or (0, 0, 0))
    tgt = Vector(target)
    f0, f1 = frames
    for f in range(f0, f1 + 1, 4):
        t = (f - f0) / max(1, (f1 - f0))
        e = t * t * (3 - 2 * t)
        base = start.lerp(end, e)
        hh = handheld * (math.sin(t * 9.0) + 0.55 * math.sin(t * 23.0))
        cam.location = base + Vector((hh, hh * 0.6, hh * 0.4))
        cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam.keyframe_insert(data_path='location', frame=f)
        cam.keyframe_insert(data_path='rotation_euler', frame=f)
    return cam


# ---------------------------------------------------------------- compositor

def compositor(scene, threshold=0.72, strength=0.55, size=0.38,
               distortion=0.012, dispersion=0.008):
    scene.use_nodes = True
    tree = bpy.data.node_groups.new('CGComp', 'CompositorNodeTree')
    tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    scene.compositing_node_group = tree
    rl = tree.nodes.new('CompositorNodeRLayers')
    glare = tree.nodes.new('CompositorNodeGlare')
    S(glare, 'Type', 'Fog Glow'); S(glare, 'Quality', 'High')
    S(glare, 'Threshold', threshold); S(glare, 'Strength', strength); S(glare, 'Size', size)
    lens = tree.nodes.new('CompositorNodeLensdist')
    S(lens, 'Distortion', distortion); S(lens, 'Dispersion', dispersion)
    out = tree.nodes.new('NodeGroupOutput')
    tree.links.new(rl.outputs['Image'], glare.inputs['Image'])
    tree.links.new(glare.outputs['Image'], lens.inputs['Image'])
    tree.links.new(lens.outputs['Image'], out.inputs['Image'])
    return tree


# ---------------------------------------------------------------- render

def render_frames(scene, out_dir, from_sec=0.0, to_sec=None, fps=24,
                  stills=None, poster=None, label='cg', extra=None):
    """渲帧：frame_0000.png 对应第 0 秒；stills 传秒数列表时只抽帧到 stills/。"""
    os.makedirs(out_dir, exist_ok=True)
    project_root = os.path.dirname(os.path.abspath(out_dir.rstrip(os.sep)))
    artifact_dir = os.path.join(project_root, 'out')
    os.makedirs(artifact_dir, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(artifact_dir, label + '.blend'))
    times = []
    report = {
        'version': bpy.app.version_string,
        'engine': scene.render.engine,
        'resolution': [scene.render.resolution_x, scene.render.resolution_y],
        'fps': fps,
        'samples': scene.eevee.taa_render_samples if scene.render.engine == 'BLENDER_EEVEE' else scene.cycles.samples,
    }
    if extra:
        report.update(extra)
    resume = os.environ.get('CG_RESUME') == '1'

    def render_one(blender_frame, path):
        if resume and os.path.exists(path) and os.path.getsize(path) > 1024:
            print('CG_SKIP', blender_frame, path, flush=True)
            return
        scene.frame_set(blender_frame)
        scene.render.filepath = path
        t0 = time.perf_counter()
        bpy.ops.render.render(write_still=True)
        dt = time.perf_counter() - t0
        times.append(round(dt, 3))
        print('CG_FRAME', blender_frame, path, round(dt, 3), flush=True)

    if stills:
        still_dir = os.path.join(os.path.dirname(out_dir.rstrip('/')), 'stills')
        os.makedirs(still_dir, exist_ok=True)
        for t in stills:
            f = int(round(t * fps)) + 1
            render_one(f, os.path.join(still_dir, 'still_%.2f.png' % t))
        report['mode'] = 'stills'
    else:
        to_sec = scene.frame_end / fps if to_sec is None else to_sec
        f0 = int(round(from_sec * fps)) + 1
        f1 = min(scene.frame_end, int(round(to_sec * fps)))
        for f in range(f0, f1 + 1):
            render_one(f, os.path.join(out_dir, 'frame_%04d.png' % (f - 1)))
        report['mode'] = 'frames'
        report['range'] = [from_sec, to_sec]
        report['blender_frames'] = [f0, f1]

    if poster is not None and not stills:
        pf = max(1, min(scene.frame_end, int(round(poster * fps)) + 1))
        scene.frame_set(pf)
        path = os.path.join(artifact_dir, 'poster.png')
        scene.render.filepath = path
        t0 = time.perf_counter()
        bpy.ops.render.render(write_still=True)
        dt = time.perf_counter() - t0
        print('CG_POSTER', path, round(dt, 3), flush=True)
        report['poster'] = {'path': path, 'at': round(poster, 2), 's': round(dt, 3)}

    report['frames_rendered'] = len(times)
    report['times'] = times
    report['avg_s'] = round(sum(times) / len(times), 3) if times else 0
    report_path = os.path.join(artifact_dir, label + '-report.json')
    with open(report_path, 'w') as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)
    print('CG_REPORT', json.dumps(report, ensure_ascii=False), flush=True)
    return report