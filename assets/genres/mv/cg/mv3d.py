"""《把灯留着》· 3D 纸剧场版分镜（Blender 端）。

和 js/film.js 同一张 24 镜表、同一套歌词节拍：主歌黄昏 → 副歌风暴 →
桥段黎明 → 尾声重逢。区别只在渲染：纸人有厚度、海有前后层、台灯有真光影、
镜头有真景深，但一切仍是纸剪的——没有写实材质，只有纸芯白边和纸浆纹。

画面由 cg_film 导演按镜搭景：K.reset() 清场 → setup_scene → build(ctx)。
每镜 2.5s @30fps = 75 帧，全片 1800 帧。
"""
import math
import os
import sys

import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import cg_film as F  # noqa: E402
import cg_kit as K  # noqa: E402
import paper as P  # noqa: E402

SHOT = 2.5

MOODS = {
    'dusk': dict(
        sky=('#2f466b', '#7a6785', '#e0a173'), cloud='#8a7f92',
        sea=('#152738', '#1d334c', '#28425f', '#33506f'),
        key=(1.0, 0.70, 0.48), key_e=110, rim=(1.0, 0.62, 0.40), rim_e=150,
        fill=(0.45, 0.58, 0.85), fill_e=28, world='#101a2a', world_e=0.32, exposure=0.35),
    'night': dict(
        sky=('#0b1526', '#152238', '#25344e'), cloud='#34435e',
        sea=('#0a1524', '#101e31', '#182a40', '#20344d'),
        key=(0.55, 0.68, 0.95), key_e=65, rim=(0.62, 0.76, 1.0), rim_e=125,
        fill=(0.30, 0.40, 0.62), fill_e=18, world='#070d17', world_e=0.22, exposure=0.25),
    'storm': dict(
        sky=('#0a111c', '#161f2b', '#2a3341'), cloud='#3c4654',
        sea=('#0c151f', '#16232f', '#1f2e3c', '#283a4a'),
        key=(0.62, 0.72, 0.86), key_e=55, rim=(0.72, 0.82, 0.95), rim_e=105,
        fill=(0.35, 0.45, 0.60), fill_e=16, world='#060a10', world_e=0.18, exposure=0.15),
    'dawn': dict(
        sky=('#5d7095', '#c08d82', '#f2cfa0'), cloud='#e0b49a',
        sea=('#16283e', '#203650', '#2c4562', '#3a5674'),
        key=(1.0, 0.80, 0.60), key_e=140, rim=(1.0, 0.70, 0.45), rim_e=170,
        fill=(0.55, 0.65, 0.85), fill_e=32, world='#131c2b', world_e=0.35, exposure=0.45),
}


# ---------------------------------------------------------------- 基础

def ink():
    return P.paper_mat('Ink', '#0a0f16', rough=0.9, mottle=0.10, sheen=0.10)


def cream():
    return P.paper_mat('Cream', '#f2e2c4', mottle=0.10, sheen=0.14)


def edge():
    return P.edge_mat()


def dark_rim(color='#33241a'):
    """厚件（地板 / 灯座 / 木箱）的纸芯：不能拿奶油白，否则变成白塑料块。"""
    return P.paper_mat('Rim_' + color[1:], color, rough=0.82, mottle=0.12)


def rect(x0, z0, x1, z1):
    return [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]


CLOUD = [(-0.50, 0.00), (-0.47, 0.30), (-0.33, 0.52), (-0.16, 0.44),
         (-0.05, 0.68), (0.10, 0.60), (0.20, 0.40), (0.36, 0.46),
         (0.47, 0.26), (0.50, 0.00)]


def paper_cloud(name, w, color, loc):
    """撕纸云：一条起伏的纸带，带纸芯白边，不再用整张薄板当云。"""
    pts = [(x * w, z * w * 0.20) for (x, z) in CLOUD]
    return P.cut(name, pts, P.paper_mat(name + 'Mat', color, mottle=0.10, sheen=0.10),
                 edge(), depth=0.004, loc=loc, bevel=0.0012)


def rig(mood, key=1.0, rim=1.0, fill=1.0):
    m = MOODS[mood]
    P.world(m['world'], m['world_e'])
    K.area_light('Key', (-1.7, -1.5, 1.65), m['key_e'] * key, m['key'], 1.3, (0.05, 0.6, 0.38))
    K.area_light('Rim', (0.9, 2.5, 1.55), m['rim_e'] * rim, m['rim'], 0.9, (0.0, 0.7, 0.45))
    K.area_light('Fill', (1.6, -1.9, 0.95), m['fill_e'] * fill, m['fill'], 1.7, (0.0, 0.5, 0.35))


def focus(pos):
    return P.pivot('FocusPoint', pos)


def cam(ctx, loc, target, lens=50, focus_obj=None, fstop=2.8, move=(0, 0, 0), handheld=0.0012):
    return K.camera(loc, target, lens=lens, focus=focus_obj, fstop=fstop,
                    frames=(1, ctx['frames']), move=move, handheld=handheld)


def drift(obj, frames, delta=(0, 0, 0), bob=0.0, rock=0.0, speed=1.2, phase=0.0, step=3):
    """同时做位移和呼吸：走路、划船、漂移都用它，避免两个 key 函数打架。"""
    f0, f1 = int(frames[0]), int(frames[1])
    base = tuple(obj.location)
    brot = tuple(obj.rotation_euler)
    for f in range(f0, f1 + 1, step):
        t = (f - f0) / max(1, f1 - f0)
        e = t * t * (3 - 2 * t)
        s = math.sin(2 * math.pi * (t * speed + phase))
        obj.location = (base[0] + delta[0] * e,
                        base[1] + delta[1] * e,
                        base[2] + delta[2] * e + bob * s)
        obj.rotation_euler = (brot[0], brot[1] + rock * s, brot[2])
        obj.keyframe_insert(data_path='location', frame=f)
        obj.keyframe_insert(data_path='rotation_euler', frame=f)
    obj.location = base
    obj.rotation_euler = brot


# ---------------------------------------------------------------- 天空 / 海

def sky_stage(mood, moon=False, sun=False, clouds=0, y=1.9, moon_x=0.62):
    m = MOODS[mood]
    P.sheet('SkyTop', 9.0, 0.86, P.paper_mat('SkyTopMat', m['sky'][0], mottle=0.08, fiber=0.5),
            loc=(0, y, 0.88), bow=0.03, seg=(26, 9))
    P.sheet('SkyMid', 9.0, 0.46, P.paper_mat('SkyMidMat', m['sky'][1], mottle=0.10, fiber=0.5),
            loc=(0, y - 0.03, 0.52), bow=0.026, seg=(26, 8))
    P.sheet('SkyLow', 9.0, 0.34, P.paper_mat('SkyLowMat', m['sky'][2], mottle=0.12, fiber=0.5),
            loc=(0, y - 0.06, 0.30), bow=0.02, seg=(26, 8))
    if moon:
        halo = P.disc('MoonHalo', 0.085, P.glow_mat('MoonHaloMat', '#9fb6d8', 0.9),
                      depth=0.003, loc=(moon_x, y - 0.09, 0.97))
        halo.visible_shadow = False
        orb = P.disc('Moon', 0.042, P.glow_mat('MoonMat', '#e8e2c8', 3.2),
                     depth=0.004, loc=(moon_x, y - 0.10, 0.97))
        orb.visible_shadow = False
    if sun:
        halo = P.disc('SunHalo', 0.11, P.glow_mat('SunHaloMat', '#f5b47a', 1.2),
                      depth=0.003, loc=(-0.62, y - 0.09, 0.44))
        halo.visible_shadow = False
        orb = P.disc('Sun', 0.052, P.glow_mat('SunMat', '#ffd9a2', 5.0),
                     depth=0.004, loc=(-0.62, y - 0.10, 0.44))
        orb.visible_shadow = False
    for i in range(int(clouds)):
        c = paper_cloud('Cloud%d' % i, 0.95 - i * 0.22, m['cloud'],
                        loc=(-0.55 + i * 0.82, y - 0.13 - i * 0.015, 0.74 - i * 0.06))
        P.key_slide(c, (1, 75), (0.14 if i % 2 == 0 else -0.11, 0, 0), step=6)


def sea_stage(mood, storm=False, y0=0.18, z=0.02, amp=1.0, near=False):
    m = MOODS[mood]
    # 海平面是一张高一点的纸条：它的上缘就是地平线，不能让天空纸条和海水之间漏黑。
    P.sheet('SeaBack', 9.0, 0.32, P.paper_mat('SeaBackMat', m['sea'][0], mottle=0.10, fiber=1.2),
            loc=(0, y0 + 1.02, 0.10), bow=0.012, seg=(26, 6))
    waves = []
    for i in range(4):
        mat = P.paper_mat('SeaMat%d' % i, m['sea'][i], mottle=0.14, fiber=1.4)
        a = (0.034 - i * 0.004) * (2.0 if storm else 1.0) * amp
        wave = P.wave('Sea%d' % i, 9.0, a, mat, edge(), loc=(0, y0 + i * 0.30, z),
                      cycles=5.5 if not storm else 6.5, phase=i * 1.7, base=a + 0.02, seg=64)
        P.key_sin(wave, (1, 75), loc=(0, 0, 0.004 + i * 0.0008),
                  speed=(1.1 if not storm else 2.1), phase=i * 0.23, step=3)
        waves.append(wave)
    if near:
        # 近景浪只能是一条浪脊，不能是 0.2 高的立板——相机压低时它会变成一堵蓝墙。
        for j, (dy, top) in enumerate(((0.34, 0.085), (0.60, 0.050))):
            mat = P.paper_mat('SeaNearMat%d' % j, m['sea'][3 - j], mottle=0.16, fiber=1.6)
            a = 0.030 * (1.6 if storm else 1.0) * amp
            base = 0.07
            sheet = P.wave('SeaNear%d' % j, 9.0, a, mat, edge(),
                           loc=(0, y0 - dy, top - base),
                           cycles=3.1 - j * 0.7, phase=0.6 + j * 1.3, base=base, seg=48)
            P.key_sin(sheet, (1, 75), loc=(0, 0, 0.005),
                      speed=(1.0 if not storm else 1.9), phase=0.7 + j * 0.3, step=3)
            waves.append(sheet)
    return waves


def town_stage(mood, y=1.55, z=0.10, lit=6):
    m = MOODS[mood]
    pts = [(-1.7, 0.00), (-1.7, 0.12), (-1.44, 0.12), (-1.44, 0.20), (-1.28, 0.20),
           (-1.28, 0.13), (-1.04, 0.13), (-1.04, 0.25), (-0.88, 0.25), (-0.88, 0.16),
           (-0.60, 0.16), (-0.60, 0.27), (-0.42, 0.27), (-0.42, 0.15), (-0.18, 0.15),
           (-0.18, 0.22), (0.02, 0.22), (0.02, 0.11), (0.22, 0.11), (0.22, 0.20),
           (0.48, 0.20), (0.48, 0.13), (0.74, 0.13), (0.74, 0.19), (1.02, 0.19),
           (1.02, 0.10), (1.34, 0.10), (1.34, 0.15), (1.7, 0.15), (1.7, 0.00)]
    pts = [(x * 1.5, zz) for (x, zz) in pts]
    town = P.cut('Town', pts, P.paper_mat('TownMat', m['sky'][0], mottle=0.08, sheen=0.04),
                 edge(), depth=0.012, loc=(0, y, z), bevel=0.0012)
    dots = [(-1.36, 0.130), (-1.10, 0.150), (-0.70, 0.185), (-0.30, 0.180),
            (0.30, 0.150), (0.80, 0.150), (1.18, 0.115)]
    dots = [(x * 1.5, zz) for (x, zz) in dots]
    warm = P.glow_mat('TownWin', '#ffbf72', 2.2)
    for i, (x, zz) in enumerate(dots[:lit]):
        d = P.cut('TownWin%d' % i, rect(-0.008, 0, 0.008, 0.012), warm, None,
                  depth=0.002, loc=(x, y - 0.09, z + zz), bevel=0)
        d.visible_shadow = False
    return town


def lighthouse_far(mood, loc=(1.28, 1.45, 0.14), h=0.46, lit=False):
    return P.lighthouse(loc, h=h, lit=lit,
                        paper=P.paper_mat('FarTower', '#0d1622', mottle=0.06),
                        edge=edge(), trim=P.paper_mat('FarTrim', '#1c2a38', mottle=0.06),
                        glass=P.paper_mat('FarGlass', '#2a3c50', mottle=0.04))


def gull(loc, s=1.0, mat=None, frames=(1, 75), phase=0.0):
    pts = [(-1.0, 0.0), (-0.45, 0.42), (0.0, 0.14), (0.45, 0.42), (1.0, 0.0),
           (0.48, 0.10), (0.0, -0.08), (-0.48, 0.10)]
    g = P.cut('Gull', [(x * 0.035 * s, z * 0.035 * s) for (x, z) in pts],
              mat or cream(), edge(), depth=0.002, loc=loc, bevel=0.0006)
    P.key_scale(g, frames, amp=0.12, speed=3.4, seed=phase)
    P.key_sin(g, frames, loc=(0.01, 0, 0.004), speed=0.8, phase=phase, step=4)
    return g


def rain(ctx, loc=(0, 1.4, 2.3), size=3.2, count=650, speed=-6.0):
    return P.rain('Rain', loc=loc, size=size, count=count, drop_radius=0.0012,
                  drop_length=0.07, speed=speed, lifetime=34, frames=(1, ctx['frames']),
                  emission=0.10, seed=11)


# ---------------------------------------------------------------- 码头 / 室内

def pier_stage(mood, z=0.0):
    wood = P.paper_mat('PierWood', '#241d19', mottle=0.20, fiber=1.3, sheen=0.10)
    dark = P.paper_mat('PierDark', '#161210', mottle=0.14)
    P.cut('Deck', rect(-0.95, 0.0, 0.95, 0.045), wood, edge(), depth=0.12,
          loc=(0, -0.10, z), bevel=0.0015)
    P.cut('DeckLip', rect(-0.95, 0.0, 0.95, 0.012), dark, None, depth=0.13,
          loc=(0, -0.105, z - 0.048), bevel=0.0006)
    for i, x in enumerate((-0.78, -0.34, 0.10, 0.54, 0.88)):
        P.cut('Post%d' % i, rect(x - 0.022, -0.52, x + 0.022, 0.005), dark, edge(),
              depth=0.05, loc=(0, -0.04 - i * 0.015, z), bevel=0.001)
    P.cut('Bollard', rect(-0.60, 0.045, -0.545, 0.150), dark, edge(), depth=0.055,
          loc=(0, -0.06, z), bevel=0.0018)
    P.cut('BollardCap', rect(-0.618, 0.150, -0.527, 0.168), dark, edge(), depth=0.06,
          loc=(0, -0.06, z), bevel=0.0018)
    if mood is not None:
        lant = P.lamp_lantern((-0.5725, -0.055, z + 0.169), scale=0.55)
        P.key_energy(lant['light'], (1, 75), 0.75, amp=0.30, speed=2.4, seed=0.7)
        P.key_scale(lant['flame'], (1, 75), amp=0.10, speed=3.4, seed=1.1)
        P.key_sin(lant['root'], (1, 75), rot=(0, 0.012, 0), speed=0.9, step=4)
        return lant
    return None


def room_stage(mood, wall='#241a16', trim='#3a2a20', y=1.10, window=True, haze=None):
    wall_mat = P.paper_mat('RoomWall', wall, mottle=0.16, fiber=0.8, sheen=0.06)
    trim_mat = P.paper_mat('RoomTrim', trim, mottle=0.12)
    floor = P.paper_mat('RoomFloor', '#191210', mottle=0.18)
    P.cut('Floor', rect(-1.3, -0.06, 1.3, 0.02), floor, dark_rim('#2b1e17'), depth=0.5,
          loc=(0, 0.2, 0.0), bevel=0.0)
    if not window:
        P.cut('Wall', rect(-1.3, 0.0, 1.3, 1.08), wall_mat, edge(), depth=0.05,
              loc=(0, y, 0.0), bevel=0.0018)
        return None
    if haze:
        # 夜里窗玻璃如果背后没有一层光晕，窗洞就是一块死黑——观众会以为窗户没渲出来。
        glow = P.disc('WindowHaze', 0.95, P.glow_mat('WindowHazeMat', haze, 0.30),
                      depth=0.002, loc=(0, y + 0.74, 0.37), seg=48)
        glow.visible_shadow = False
    P.cut('WallL', rect(-1.3, 0.0, -0.30, 1.08), wall_mat, edge(), depth=0.05,
          loc=(0, y, 0.0), bevel=0.0018)
    P.cut('WallR', rect(0.30, 0.0, 1.3, 1.08), wall_mat, edge(), depth=0.05,
          loc=(0, y, 0.0), bevel=0.0018)
    P.cut('WallTop', rect(-0.30, 0.66, 0.30, 1.08), wall_mat, edge(), depth=0.05,
          loc=(0, y, 0.0), bevel=0.0018)
    P.cut('WallLow', rect(-0.30, 0.0, 0.30, 0.10), wall_mat, edge(), depth=0.05,
          loc=(0, y, 0.0), bevel=0.0018)
    P.cut('JambL', rect(-0.322, 0.10, -0.288, 0.685), trim_mat, edge(), depth=0.07,
          loc=(0, y - 0.05, 0.0), bevel=0.0016)
    P.cut('JambR', rect(0.288, 0.10, 0.322, 0.685), trim_mat, edge(), depth=0.07,
          loc=(0, y - 0.05, 0.0), bevel=0.0016)
    P.cut('Head', rect(-0.34, 0.662, 0.34, 0.700), trim_mat, edge(), depth=0.075,
          loc=(0, y - 0.05, 0.0), bevel=0.0016)
    P.cut('Sill', rect(-0.35, 0.078, 0.35, 0.108), trim_mat, edge(), depth=0.10,
          loc=(0, y - 0.055, 0.0), bevel=0.0016)
    mullion = P.cut('Mullion', rect(-0.009, 0.10, 0.009, 0.672), trim_mat, edge(),
                    depth=0.045, loc=(0, y - 0.045, 0.0), bevel=0.0008)
    P.cut('Transom', rect(-0.30, 0.398, 0.30, 0.416), trim_mat, edge(), depth=0.045,
          loc=(0, y - 0.045, 0.0), bevel=0.0008)
    return mullion


def room_sea(mood, storm=False, y0=1.32, far_y=1.86, z_shift=0.12):
    m = MOODS[mood]
    P.sheet('RoomSkyTop', 2.0, 0.62, P.paper_mat('RSkyTop', m['sky'][0], mottle=0.08),
            loc=(0, far_y, 0.70 - z_shift), bow=0.02)
    P.sheet('RoomSkyLow', 2.0, 0.34, P.paper_mat('RSkyLow', m['sky'][2], mottle=0.10),
            loc=(0, far_y - 0.02, 0.34 - z_shift), bow=0.016)
    for i in range(3):
        mat = P.paper_mat('RSea%d' % i, m['sea'][i + 1], mottle=0.12)
        w = P.wave('RSea%d' % i, 1.9, (0.022 - i * 0.005) * (1.7 if storm else 1.0), mat, edge(),
                   loc=(0, y0 + i * 0.20, 0.18 - z_shift), cycles=2.6 if not storm else 3.2,
                   phase=i * 1.4, base=0.02, seg=24)
        P.key_sin(w, (1, 75), loc=(0, 0, 0.003), speed=2.2 if storm else 1.2, phase=i * 0.3, step=3)


def room_rain(ctx, loc=(0.0, 1.55, 1.15), size=1.4, count=260):
    return P.rain('WindowRain', loc=loc, size=size, count=count, drop_radius=0.0009,
                  drop_length=0.05, speed=-5.0, lifetime=30, frames=(1, ctx['frames']),
                  emission=0.12, seed=5)


def back_arm(fig, h, side, ink_mat, edge_mat, lift_deg=138):
    pv = P.pivot('BackArm', (0, 0, 0), parent=fig['root'])
    pv.location = (side * 0.075 * h, -0.006, 0.60 * h)
    pts = [(-0.013, 0.0), (0.013, 0.0), (0.011, -0.115), (0.007, -0.170),
           (-0.007, -0.170), (-0.011, -0.115)]
    arm = P.cut('BackArmCut', pts, ink_mat, edge_mat, depth=0.0036, bevel=0.002)
    arm.parent = pv
    arm.scale = (h, h, h)
    hand = P.cut('BackHand', [(-0.019, -0.168), (0.019, -0.168), (0.023, -0.196),
                              (0.009, -0.209), (-0.012, -0.207), (-0.021, -0.190)],
                 ink_mat, edge_mat, depth=0.0037, bevel=0.0016)
    hand.parent = pv
    hand.scale = (h, h, h)
    pv.rotation_euler = (0, -side * math.radians(lift_deg), 0)
    return pv


# ---------------------------------------------------------------- 道具组

def lantern_rig(loc, scale=1.0, energy=2.2, seed=1.0):
    lant = P.lamp_lantern(loc, scale=scale)
    lant['light'].data.energy = energy
    P.key_energy(lant['light'], (1, 75), energy, amp=0.30, speed=3.2, seed=seed)
    P.key_scale(lant['flame'], (1, 75), amp=0.10, speed=4.0, seed=seed)
    P.key_sin(lant['root'], (1, 75), rot=(0, 0.010, 0), speed=1.1, phase=seed, step=4)
    return lant


def tower_rig(mood, loc=(0.42, 1.25, -0.04), h=0.88, energy=3.0, beam=True, beam_to=(-1.5, 0.9, 0.62)):
    m = MOODS[mood]
    tower = P.lighthouse(loc, h=h, lit=energy > 0.4,
                         paper=P.paper_mat('TowerPaper', '#15222f', mottle=0.10, sheen=0.12),
                         edge=edge(),
                         trim=P.paper_mat('TowerTrim', '#0c141d', mottle=0.08),
                         glass=P.paper_mat('TowerGlass', '#2f3947', mottle=0.05))
    if tower['lamp'] is not None:
        tower['lamp'].data.energy = energy
        P.key_energy(tower['lamp'], (1, 75), energy, amp=0.16, speed=2.2, seed=0.4)
    beam_obj = pv = None
    if beam:
        beam_obj, pv = P.beam_swing('Beam', tower['lamp_pos'], beam_to,
                                    r_near=0.010, r_far=0.085,
                                    mat=P.beam_mat('BeamMat', '#ffe0a4', 0.80, 0.12),
                                    frames=(1, 75), sweep=4.5, speed=0.55, phase=0.1)
    return tower, beam_obj, pv


def splash(name, loc, s=0.16, mat=None, frames=(1, 75), phase=0.0):
    pts = [(-1.0, 0.0), (-0.62, 0.42), (-0.30, 0.90), (-0.06, 0.45), (0.10, 1.05),
           (0.34, 0.52), (0.62, 0.80), (0.70, 0.30), (0.98, 0.18), (0.55, 0.05),
           (0.0, 0.12), (-0.55, 0.04)]
    obj = P.cut(name, [(x * s, z * s) for (x, z) in pts], mat or cream(), edge(),
                depth=0.004, loc=loc, bevel=0.001)
    P.key_scale(obj, frames, amp=0.14, speed=3.6, seed=phase)
    return obj


HAND_PALM = [(-0.034, 0.000), (0.034, 0.000), (0.042, 0.026), (0.034, 0.052),
             (0.012, 0.060), (-0.014, 0.058), (-0.036, 0.044), (-0.042, 0.018)]


def _hand(side, spread, y, z, ink_mat, edge_mat, lean):
    """一只捧火的手（掌 + 四指 + 拇指）；side=+1 时整体镜像成右手。"""
    pv = P.pivot('HandPiv', (side * spread, y, z))
    if side > 0:
        pv.scale = (-1.0, 1.0, 1.0)
    pv.rotation_euler = (0, math.radians(lean) * (-1 if side > 0 else 1), 0)
    palm = P.cut('HandPalm', HAND_PALM, ink_mat, edge_mat, depth=0.006, bevel=0.0024)
    palm.parent = pv
    for i, (fx, ang, ln) in enumerate(((-0.026, 22, 0.038), (-0.009, 16, 0.052),
                                       (0.008, 10, 0.050), (0.025, 5, 0.040))):
        w = 0.0125
        finger = P.cut('HandFinger%d' % i,
                       [(-w / 2, 0.0), (w / 2, 0.0), (w / 2, ln - 0.008),
                        (0.004, ln), (-0.005, ln - 0.002), (-w / 2, ln - 0.008)],
                       ink_mat, edge_mat, depth=0.0052, bevel=0.0022)
        finger.parent = pv
        finger.location = (fx, -0.002, 0.048)
        finger.rotation_euler = (0, math.radians(ang), 0)
    thumb = P.cut('HandThumb',
                  [(-0.0075, 0.0), (0.0075, 0.0), (0.0070, 0.024),
                   (0.002, 0.033), (-0.004, 0.032), (-0.0075, 0.022)],
                  ink_mat, edge_mat, depth=0.0054, bevel=0.002)
    thumb.parent = pv
    thumb.location = (0.032, -0.004, 0.008)
    thumb.rotation_euler = (0, math.radians(58), 0)
    return pv


def hands(frames, spread=0.08, z=0.0, y=0.096, ink_mat=None, edge_mat=None, lean=9):
    """两只捧火的手：手腕在画面下缘，指节向火倾，随火一起呼吸。"""
    ink_mat = ink_mat or ink()
    edge_mat = edge_mat or edge()
    left = _hand(-1, spread, y, z, ink_mat, edge_mat, lean)
    right = _hand(1, spread, y, z, ink_mat, edge_mat, lean)
    P.key_sin(left, frames, loc=(-0.0035, 0, 0.0015), rot=(0, -0.018, 0), speed=1.15, phase=0.1, step=4)
    P.key_sin(right, frames, loc=(0.0035, 0, 0.0015), rot=(0, -0.018, 0), speed=1.15, phase=0.55, step=4)
    return left, right


def bokeh(y=1.2, z=0.4):
    warm = P.glow_mat('BokehWarm', '#ffc67a', 2.2)
    cool = P.glow_mat('BokehCool', '#9fb8d8', 1.5)
    haze = P.disc('BokehHaze', 0.55, P.glow_mat('BokehHazeMat', '#2c1f18', 0.35),
                  depth=0.002, loc=(0.0, y + 0.1, z - 0.02), seg=48)
    haze.visible_shadow = False
    for i, (x, zz, r, m) in enumerate([
            (-0.55, 0.55, 0.020, warm), (-0.30, 0.44, 0.014, cool),
            (0.18, 0.62, 0.022, warm), (0.42, 0.38, 0.016, cool),
            (0.66, 0.56, 0.012, warm), (-0.66, 0.30, 0.014, cool),
            (0.02, 0.70, 0.010, warm)]):
        d = P.disc('Bokeh%d' % i, r, m, depth=0.002, loc=(x, y, zz))
        d.visible_shadow = False
        P.key_sin(d, (1, 75), loc=(0.006, 0, 0.004), speed=0.5 + i * 0.1, phase=i * 0.4, step=6)


# ---------------------------------------------------------------- 24 镜

def s01(ctx):
    """黄昏港口，她走进画面；纸字标题浮在海上。"""
    rig('dusk')
    sky_stage('dusk', clouds=2)
    town_stage('dusk', y=1.72, z=0.12, lit=6)
    sea_stage('dusk', y0=0.34)
    pier_stage('dusk')
    lighthouse_far('dusk')
    g = gull((-0.30, 1.30, 0.70), s=1.0)
    girl = P.figure('walk', 0.215, loc=(-0.55, 0.10, 0.045), dir=1, ink=ink(), edge=edge())
    drift(girl['root'], (1, ctx['frames']), delta=(0.42, 0, 0), bob=0.0025, rock=0.012,
          speed=1.6, phase=0.1)
    title = P.text_paper('Title', '把 灯 留 着', 0.105, (0.0, -0.10, 0.76), cream(),
                         extrude=0.005, bevel=0.0014)
    P.key_sin(title, (1, ctx['frames']), loc=(0, 0, 0.004), rot=(0, 0, 0.006), speed=0.9, step=4)
    cam(ctx, (-0.45, -2.25, 0.44), (0.02, 0.9, 0.38), lens=52,
        focus_obj=focus((-0.18, 0.2, 0.18)), fstop=3.2, move=(0.16, 0, 0.012))


def s02(ctx):
    """码头中景：她站定，船在远处晃。"""
    rig('dusk')
    sky_stage('dusk', clouds=1)
    sea_stage('dusk', y0=0.32)
    pier_stage('dusk')
    lighthouse_far('dusk', loc=(1.35, 1.5, 0.10), h=0.40)
    girl = P.figure('stand', 0.245, loc=(-0.22, 0.12, 0.045), dir=1, ink=ink(), edge=edge())
    P.key_sin(girl['root'], (1, ctx['frames']), rot=(0, 0.012, 0), speed=0.8, step=4)
    boat = P.boat(0.24, loc=(0.52, 1.00, 0.09), rot=(0, 0.02, 0), hull=ink(), sail=cream(),
                  edge=edge(), lantern=True, lantern_mat=P.glow_mat('BoatLamp', '#ffc070', 2.6))
    drift(boat['root'], (1, ctx['frames']), delta=(0.20, 0, 0), bob=0.005, rock=0.035,
          speed=1.5, phase=0.35)
    for i, gx in enumerate((-0.05, 0.25)):
        gull((gx, 1.35, 0.68 + i * 0.05), s=0.9, phase=i * 0.6)
    cam(ctx, (-0.50, -1.55, 0.33), (-0.08, 0.55, 0.24), lens=46,
        focus_obj=focus((-0.22, 0.16, 0.16)), fstop=2.6, move=(0.07, 0, 0.004))


def s03(ctx):
    """胸像特写：黄昏侧脸，发髻被风推了一下。"""
    rig('dusk', key=0.9)
    sky_stage('dusk')
    sea_stage('dusk', y0=0.30)
    b = P.bust(0.66, loc=(0.0, 0.42, 0.0), dir=1, ink=ink(), edge=edge())
    P.key_sin(b['root'], (1, ctx['frames']), rot=(0, 0.012, 0), loc=(0, 0, 0.002),
              speed=0.85, phase=0.2, step=4)
    K.area_light('FaceRim', (0.55, 0.92, 0.52), 55, (1.0, 0.74, 0.48), 0.30,
                 (0.02, 0.42, 0.30))
    cam(ctx, (-0.06, -0.95, 0.34), (0.03, 0.42, 0.31), lens=68,
        focus_obj=focus((0.03, 0.40, 0.31)), fstop=2.0, move=(0.03, 0, 0.004))


def s04(ctx):
    """灯塔全景：天黑了，她提着灯沿石岸走向塔下，塔还黑着。"""
    rig('night', key=1.1, rim=1.3)
    sky_stage('night', moon=True, clouds=1, moon_x=-0.60)
    sea_stage('night', y0=0.30, near=True)
    town_stage('night', y=1.64, z=0.09, lit=3)
    tower, _, _ = tower_rig('night', energy=0.0, beam=False)
    girl = P.figure('walk', 0.26, loc=(-0.62, 0.30, 0.035), dir=1, ink=ink(), edge=edge())
    drift(girl['root'], (1, ctx['frames']), delta=(0.30, 0, 0), bob=0.0028, rock=0.012,
          speed=1.7, phase=0.1)
    lant = P.lamp_lantern((-0.60, 0.285, 0.105), scale=0.30)
    lant['light'].data.energy = 1.6
    P.key_energy(lant['light'], (1, ctx['frames']), 1.6, amp=0.30, speed=2.4, seed=0.6)
    P.key_scale(lant['flame'], (1, ctx['frames']), amp=0.10, speed=3.4, seed=1.1)
    drift(lant['root'], (1, ctx['frames']), delta=(0.30, 0, 0), bob=0.0035, rock=0.06,
          speed=1.7, phase=0.1)
    cam(ctx, (-0.85, -2.05, 0.34), (0.25, 1.05, 0.30), lens=54,
        focus_obj=focus((-0.35, 0.30, 0.22)), fstop=3.0, move=(0.05, 0, 0.02))


def s05(ctx):
    """灯室：她举着火靠近灯芯，火点亮。"""
    rig('night', key=0.8, rim=0.9)
    room_stage('night', wall='#221912', haze='#22344e')
    room_sea('night')
    P.cut('Pedestal', rect(-0.13, 0.0, 0.13, 0.36), P.paper_mat('PedestalMat', '#2c211a', mottle=0.16),
          dark_rim('#3a2a1e'), depth=0.24, loc=(0.16, 0.55, 0.0), bevel=0.0018)
    P.cut('PedestalTop', rect(-0.15, 0.36, 0.15, 0.385), P.paper_mat('PedestalTopMat', '#3a2b21', mottle=0.12),
          dark_rim('#46311f'), depth=0.26, loc=(0.16, 0.55, 0.0), bevel=0.0018)
    lant = P.lamp_lantern((0.16, 0.47, 0.385), scale=0.95)
    P.key_energy(lant['light'], (1, ctx['frames']), 0.02, amp=0.05, ramp=(0.02, 2.6), seed=0.9)
    P.key_scale(lant['flame'], (1, ctx['frames']), amp=0.12, speed=4.2, seed=1.4)
    girl = P.figure('reach', 0.62, loc=(0.02, 0.30, 0.02), dir=1, ink=ink(), edge=edge())
    P.key_rot(girl['arm_pivot'], (1, ctx['frames']), axis='Y', a0=0.0,
              a1=math.radians(-118), step=4)
    P.key_sin(girl['root'], (1, ctx['frames']), rot=(0, 0.008, 0), speed=0.8, step=4)
    cam(ctx, (-0.58, -1.16, 0.36), (0.02, 0.42, 0.30), lens=52,
        focus_obj=focus((0.10, 0.40, 0.44)), fstop=2.4, move=(0.04, 0, 0.008))


def s06(ctx):
    """极近景：双手护着火。"""
    rig('night', key=0.5, rim=0.9)
    bokeh(y=1.3, z=0.42)
    hands((1, ctx['frames']), spread=0.082, z=0.0, y=0.096, lean=11)
    f = P.flame((0.0, 0.10, 0.032), scale=0.72, strength=3.2)
    P.key_energy(f['light'], (1, ctx['frames']), 1.2, amp=0.45, speed=4.5, seed=0.3)
    P.key_scale(f['flame'], (1, ctx['frames']), amp=0.14, speed=5.2, seed=0.9)
    P.key_sin(f['root'], (1, ctx['frames']), rot=(0, 0.04, 0), speed=1.7, phase=0.2, step=3)
    cam(ctx, (0.0, -0.80, 0.16), (0.0, 0.10, 0.075), lens=70,
        focus_obj=focus((0.0, 0.10, 0.08)), fstop=2.0, move=(0.006, 0, -0.005), handheld=0.0008)


def s07(ctx):
    """灯塔光束扫海，船在光里。"""
    rig('night', rim=1.3)
    sky_stage('night', moon=True, clouds=1)
    haze = P.disc('HorizonHaze', 0.55, P.glow_mat('HorizonHazeMat', '#26374e', 0.34),
                  depth=0.002, loc=(0.30, 1.60, 0.24), seg=40)
    haze.visible_shadow = False
    sea_stage('night', y0=0.26, near=True)
    tower, _, _ = tower_rig('night', loc=(0.46, 1.12, -0.02), h=0.92, energy=3.2,
                            beam_to=(-1.20, 0.50, 0.30))
    boat = P.boat(0.32, loc=(-0.72, 0.58, 0.09), rot=(0, 0.02, 0),
                  hull=ink(), sail=cream(), edge=edge(), lantern=True,
                  lantern_mat=P.glow_mat('BoatLamp', '#ffc070', 2.6))
    drift(boat['root'], (1, ctx['frames']), delta=(-0.12, 0, 0), bob=0.009, rock=0.05,
          speed=1.3, phase=0.5)
    cam(ctx, (-0.30, -2.30, 0.38), (0.10, 1.00, 0.36), lens=44,
        focus_obj=focus((0.0, 0.8, 0.22)), fstop=3.0, move=(0.05, 0, 0.02))


def s08(ctx):
    """窗内：她背对镜头，看海上的那点灯。"""
    rig('night', key=0.9, rim=0.8, fill=1.6)
    room_stage('night', wall='#241b14')
    room_sea('night')
    haze = P.disc('WindowHaze', 0.95, P.glow_mat('WindowHazeMat', '#22344e', 0.55),
                  depth=0.002, loc=(0.02, 1.84, 0.24))
    haze.visible_shadow = False
    moon = P.disc('WindowMoon', 0.020, P.glow_mat('WindowMoonMat', '#e6ecf5', 2.8),
                  depth=0.003, loc=(0.17, 1.83, 0.47))
    moon.visible_shadow = False
    halo = P.disc('WindowMoonHalo', 0.045, P.glow_mat('WindowMoonHaloMat', '#9fb6d8', 0.8),
                  depth=0.002, loc=(0.17, 1.835, 0.47))
    halo.visible_shadow = False
    for i, (sx, sz) in enumerate(((-0.16, 0.55), (0.03, 0.60), (-0.05, 0.38))):
        star = P.disc('Star%d' % i, 0.004, P.glow_mat('StarMat%d' % i, '#dfe6ee', 1.6),
                      depth=0.002, loc=(sx, 1.845, sz), seg=12)
        star.visible_shadow = False
    boat = P.boat(0.13, loc=(0.10, 1.42, 0.26), rot=(0, 0.02, 0), hull=ink(), sail=ink(),
                  edge=edge(), lantern=True, lantern_mat=P.glow_mat('FarBoatLamp', '#ffc070', 2.2))
    drift(boat['root'], (1, ctx['frames']), delta=(0.06, 0, 0), bob=0.004, rock=0.04,
          speed=1.2, phase=0.2)
    chest = P.paper_mat('ChestMat', '#2a1d15', mottle=0.18, fiber=1.0)
    P.cut('Chest', rect(-0.72, 0.0, -0.42, 0.19), chest, dark_rim('#3a2a1c'), depth=0.16,
          loc=(0, 0.62, 0.0), bevel=0.002)
    P.cut('ChestTop', rect(-0.74, 0.19, -0.40, 0.205),
          P.paper_mat('ChestTopMat', '#38271c', mottle=0.12), dark_rim('#46311f'), depth=0.17,
          loc=(0, 0.62, 0.0), bevel=0.002)
    lant = P.lamp_lantern((-0.56, 0.58, 0.205), scale=0.62)
    P.key_energy(lant['light'], (1, ctx['frames']), 2.2, amp=0.18, speed=2.6, seed=0.5)
    P.key_scale(lant['flame'], (1, ctx['frames']), amp=0.10, speed=3.6, seed=1.2)
    girl = P.figure('back', 0.52, loc=(-0.10, 0.55, 0.02), dir=1, ink=ink(), edge=edge())
    P.key_sin(girl['root'], (1, ctx['frames']), rot=(0, 0.006, 0), speed=0.7, step=4)
    cam(ctx, (0.0, -1.25, 0.34), (0.0, 0.55, 0.30), lens=48,
        focus_obj=focus((0.0, 0.55, 0.30)), fstop=2.2, move=(0.03, 0, 0.004))


def s09(ctx):
    """风暴海面全景：浪起来，船在浪里。"""
    rig('storm', rim=1.4)
    sky_stage('storm', clouds=2)
    sea_stage('storm', y0=0.24, amp=1.3, near=True)
    rain(ctx, loc=(0, 1.5, 2.4), size=3.4, count=700)
    boat = P.boat(0.30, loc=(0.22, 0.82, 0.10), rot=(0, 0.05, 0),
                  hull=ink(), sail=cream(), edge=edge(), lantern=True,
                  lantern_mat=P.glow_mat('BoatLamp', '#ffb864', 2.2))
    drift(boat['root'], (1, ctx['frames']), delta=(0.10, 0, 0), bob=0.016, rock=0.10,
          speed=1.8, phase=0.4)
    cam(ctx, (-0.12, -2.20, 0.32), (0.10, 0.9, 0.28), lens=44,
        focus_obj=focus((0.15, 0.8, 0.18)), fstop=2.8, move=(0.05, 0, 0.010), handheld=0.003)


def s10(ctx):
    """风暴里她的脸：风把鬓发吹乱，眼睛盯着海。"""
    rig('storm', key=0.8, rim=1.6)
    sky_stage('storm', clouds=2)
    sea_stage('storm', y0=0.30)
    b = P.bust(0.68, loc=(0.0, 0.40, 0.0), dir=-1, ink=ink(), edge=edge())
    P.key_sin(b['root'], (1, ctx['frames']), rot=(0, 0.022, 0), loc=(0, 0, 0.003),
              speed=1.4, phase=0.1, step=3)
    flare = K.point_light('Flare', (-0.5, 0.05, 0.45), 1.1, (1.0, 0.62, 0.32), radius=0.02)
    K.area_light('FaceRim', (-0.60, 0.86, 0.55), 50, (0.80, 0.88, 1.0), 0.28,
                 (0.02, 0.40, 0.30))
    P.key_energy(flare, (1, ctx['frames']), 0.7, amp=0.4, speed=3.6, seed=0.6)
    cam(ctx, (-0.05, -0.92, 0.34), (0.04, 0.40, 0.31), lens=76,
        focus_obj=focus((0.03, 0.38, 0.31)), fstop=1.9, move=(0.02, 0, 0.007), handheld=0.0018)


def s11(ctx):
    """灯室里风从窗缝灌进来，灯焰压低，她去扶灯。"""
    rig('storm', key=0.7, rim=0.9)
    room_stage('storm', wall='#20170f', haze='#26313c')
    room_sea('storm')
    room_rain(ctx)
    P.cut('Pedestal', rect(-0.13, 0.0, 0.13, 0.36), P.paper_mat('PedestalMat', '#2c211a', mottle=0.16),
          dark_rim('#3a2a1e'), depth=0.24, loc=(0.16, 0.55, 0.0), bevel=0.0018)
    P.cut('PedestalTop', rect(-0.15, 0.36, 0.15, 0.385), P.paper_mat('PedestalTopMat', '#3a2b21', mottle=0.12),
          dark_rim('#46311f'), depth=0.26, loc=(0.16, 0.55, 0.0), bevel=0.0018)
    lant = P.lamp_lantern((0.16, 0.47, 0.385), scale=0.95)
    P.key_energy(lant['light'], (1, ctx['frames']), 2.7, amp=0.45, speed=4.6, seed=0.8)
    P.key_scale(lant['flame'], (1, ctx['frames']), amp=0.20, speed=5.0, seed=1.1)
    P.key_sin(lant['root'], (1, ctx['frames']), rot=(0, 0.03, 0), speed=2.0, step=3)
    girl = P.figure('reach', 0.62, loc=(0.02, 0.30, 0.02), dir=1, ink=ink(), edge=edge())
    P.key_sin(girl['arm_pivot'], (1, ctx['frames']), rot=(0, 0.05, 0), speed=2.4, step=3)
    P.key_sin(girl['root'], (1, ctx['frames']), rot=(0, 0.012, 0), speed=1.2, step=4)
    cam(ctx, (-0.56, -1.14, 0.36), (0.02, 0.42, 0.30), lens=52,
        focus_obj=focus((0.10, 0.40, 0.44)), fstop=2.2, move=(0.03, 0, 0.006), handheld=0.002)


def s12(ctx):
    """灯塔全景：风暴里光束横扫，浪拍礁石。"""
    rig('storm', rim=1.6)
    sky_stage('storm', clouds=2)
    sea_stage('storm', y0=0.26, amp=1.5, near=True)
    rain(ctx, loc=(0, 1.4, 2.4), size=3.4, count=650, speed=-6.5)
    tower, _, _ = tower_rig('storm', loc=(0.36, 1.22, -0.03), h=0.90, energy=3.4,
                            beam_to=(-1.45, 0.55, 0.55))
    splash('SprayA', (0.05, 0.62, 0.02), s=0.13, phase=0.2)
    splash('SprayB', (0.30, 0.70, 0.00), s=0.10, phase=1.4)
    cam(ctx, (-0.65, -1.85, 0.10), (0.34, 1.10, 0.42), lens=50,
        focus_obj=focus((0.32, 1.0, 0.40)), fstop=2.8, move=(-0.05, 0, 0.05), handheld=0.004)


def s13(ctx):
    """极近景：风暴里双手把火护到只剩一线。"""
    rig('storm', key=0.4, rim=0.7)
    bokeh(y=1.2, z=0.36)
    hands((1, ctx['frames']), spread=0.052, z=0.0, y=0.096, lean=13)
    f = P.flame((0.0, 0.10, 0.034), scale=0.52, strength=2.6)
    P.key_energy(f['light'], (1, ctx['frames']), 0.9, amp=0.55, speed=6.0, seed=0.7)
    P.key_scale(f['flame'], (1, ctx['frames']), amp=0.20, speed=6.5, seed=1.3)
    P.key_sin(f['root'], (1, ctx['frames']), rot=(0, 0.08, 0), speed=2.6, phase=0.4, step=3)
    cam(ctx, (0.0, -0.76, 0.16), (0.0, 0.10, 0.075), lens=72,
        focus_obj=focus((0.0, 0.10, 0.08)), fstop=2.2, move=(-0.005, 0, 0.004), handheld=0.003)


def s14(ctx):
    """巨浪压过来，船几乎竖起来。"""
    rig('storm', key=0.6, rim=1.4)
    # 风暴里船和浪面都掉进黑水：各给一盏低强度边光，把它们从背景里抠出来。
    K.area_light('BoatRim', (0.62, 0.10, 1.35), 32, (0.72, 0.82, 1.0), 0.9, (0.30, 0.85, 0.20))
    K.area_light('WaveRim', (-0.9, -0.2, 1.0), 26, (0.60, 0.72, 0.95), 1.2, (-0.45, 0.35, 0.25))
    sky_stage('storm', clouds=2)
    sea_stage('storm', y0=0.22, amp=1.6, near=True)
    rain(ctx, loc=(0, 1.3, 2.4), size=3.4, count=700, speed=-7.0)
    pts = [(-0.95, 0.0), (-0.68, 0.05), (-0.52, 0.24), (-0.34, 0.38), (-0.14, 0.44),
           (0.02, 0.32), (0.06, 0.14), (0.16, 0.0)]
    giant = P.cut('GiantWave', pts, P.paper_mat('GiantMat', '#26405a', mottle=0.16), cream(),
                  depth=0.008, loc=(-0.28, 0.35, 0.04), bevel=0.0014)
    P.key_sin(giant, (1, ctx['frames']), loc=(0, 0, 0.03), rot=(0, -0.06, 0), speed=1.1, step=3)
    splash('CrestA', (-0.35, 0.36, 0.40), s=0.17, phase=0.5)
    splash('CrestB', (-0.56, 0.36, 0.30), s=0.11, phase=1.2)
    boat = P.boat(0.32, loc=(0.30, 0.85, 0.19), rot=(0, 0.18, 0),
                  hull=ink(), sail=cream(), edge=edge(), lantern=True,
                  lantern_mat=P.glow_mat('BoatLamp', '#ffb864', 2.4))
    drift(boat['root'], (1, ctx['frames']), delta=(0.05, 0, 0.02), bob=0.018, rock=0.12,
          speed=1.6, phase=0.2)
    cam(ctx, (-0.10, -1.75, 0.08), (0.05, 0.75, 0.24), lens=40,
        focus_obj=focus((0.2, 0.7, 0.18)), fstop=2.8, move=(0.02, 0, 0.006), handheld=0.004)


def s15(ctx):
    """窗内：她抬手抹掉玻璃上的雨水。"""
    rig('storm', key=0.6)
    room_stage('storm', wall='#1a1712', haze='#3a5064')
    room_sea('storm')
    room_rain(ctx)
    girl = P.figure('back', 0.54, loc=(-0.06, 0.58, 0.02), dir=1, ink=ink(), edge=edge())
    arm = back_arm(girl, 0.54, side=-1, ink_mat=ink(), edge_mat=edge(), lift_deg=150)
    P.key_rot(arm, (1, ctx['frames']), axis='Y', a0=math.radians(-150),
              a1=math.radians(-92), step=4)
    P.key_sin(girl['root'], (1, ctx['frames']), rot=(0, 0.008, 0), speed=0.9, step=4)
    cam(ctx, (0.02, -1.18, 0.34), (0.0, 0.58, 0.31), lens=50,
        focus_obj=focus((0.0, 0.58, 0.34)), fstop=2.2, move=(0.04, 0, 0.006))


def s16(ctx):
    """特写：她下了决心，火光在眼里。"""
    rig('storm', key=0.8, rim=1.3)
    sky_stage('storm')
    sea_stage('storm', y0=0.30)
    b = P.bust(0.80, loc=(0.0, 0.42, 0.0), dir=1, ink=ink(), edge=edge())
    P.key_sin(b['root'], (1, ctx['frames']), rot=(0, 0.010, 0), speed=0.9, phase=0.3, step=4)
    # 火光不能只是打灯：眼窝里贴一滴自发光的心火，剪影才有「眼里有火」。
    glint = P.disc('EyeGlint', 0.0045, P.glow_mat('EyeGlintMat', '#ffd39a', strength=3.2),
                   None, depth=0.0012, loc=(0.100, 0.4135, 0.294), seg=20)
    P.key_scale(glint, (1, ctx['frames']), amp=0.10, speed=4.0, seed=0.7)
    # 暖光必须从身后低处来：正面打灯会把黑纸打成一张褐色脸。
    fire = K.area_light('FireKey', (0.36, 0.64, 0.10), 9, (1.0, 0.58, 0.28), 0.30,
                        (0.09, 0.42, 0.29))
    P.key_energy(fire, (1, ctx['frames']), 9, amp=0.35, speed=5.0, seed=0.2)
    K.area_light('FaceRim', (0.60, 0.90, 0.50), 30, (0.72, 0.82, 1.0), 0.30,
                 (0.02, 0.42, 0.30))
    cam(ctx, (0.10, -0.78, 0.30), (0.03, 0.42, 0.30), lens=80,
        focus_obj=focus((0.09, 0.42, 0.30)), fstop=2.0, move=(0.012, 0, 0.006))


def s17(ctx):
    """天快亮了：灯塔还亮着，海雾散开。"""
    rig('dawn', rim=1.4)
    sky_stage('dawn', sun=True, clouds=1)
    sea_stage('dawn', y0=0.28, near=True)
    tower, _, _ = tower_rig('dawn', loc=(0.50, 1.22, -0.03), h=0.86, energy=2.2,
                            beam_to=(-1.35, 0.55, 0.52))
    P.fog_band('FogA', 8.0, 0.16, None, loc=(0, 0.55, 0.12), alpha=0.30)
    P.fog_band('FogB', 8.0, 0.12, None, loc=(0, 1.05, 0.18), alpha=0.24)
    for i, gx in enumerate((-0.35, 0.05)):
        gull((gx, 1.25, 0.75 + i * 0.04), s=0.9, phase=i * 0.8)
    cam(ctx, (-0.70, -2.05, 0.16), (0.30, 1.05, 0.38), lens=52,
        focus_obj=focus((0.35, 1.0, 0.40)), fstop=3.0, move=(0.05, 0, 0.10))


def s18(ctx):
    """灯室：她靠着灯睡着了，天光从窗子进来。"""
    rig('dawn', key=1.1)
    room_stage('dawn', wall='#2a201a')
    room_sea('dawn')
    P.cut('Pedestal', rect(-0.13, 0.0, 0.13, 0.36), P.paper_mat('PedestalMat', '#2c211a', mottle=0.16),
          dark_rim('#3a2a1e'), depth=0.24, loc=(0.30, 0.55, 0.0), bevel=0.0018)
    P.cut('PedestalTop', rect(-0.15, 0.36, 0.15, 0.385), P.paper_mat('PedestalTopMat', '#3a2b21', mottle=0.12),
          dark_rim('#46311f'), depth=0.26, loc=(0.30, 0.55, 0.0), bevel=0.0018)
    lant = P.lamp_lantern((0.30, 0.47, 0.385), scale=1.0)
    P.key_energy(lant['light'], (1, ctx['frames']), 0.55, amp=0.30, speed=2.2, seed=1.3)
    P.key_scale(lant['flame'], (1, ctx['frames']), amp=0.12, speed=3.0, seed=0.9)
    # 她睡在灯下的长凳上：没有凳子，躺姿会在画面底部读成一块石头。
    P.cut('BenchSeat', rect(-0.38, 0.155, 0.32, 0.200), P.paper_mat('BenchMat', '#33251c', mottle=0.14),
          dark_rim('#452f21'), depth=0.20, loc=(0.0, 0.40, 0.0), bevel=0.0016)
    for bx in (-0.30, 0.18):
        P.cut('BenchLeg', rect(-0.022, 0.0, 0.022, 0.155), P.paper_mat('BenchLegMat', '#2a1e16', mottle=0.10),
              None, depth=0.10, loc=(bx, 0.42, 0.0), bevel=0.0012)
    # 睡着的她：抱膝坐在灯下，额头枕在膝上。放倒的站姿会读成木板，所以这里直接画坐姿。
    sleeper = P.pivot('Sleeper', (0.0, 0.0, 0.0))
    sit = P.cut('SitBody', [(-0.020, 0.205), (-0.150, 0.238), (-0.180, 0.295), (-0.185, 0.340),
                            (-0.150, 0.358), (-0.100, 0.312), (0.018, 0.262), (0.052, 0.207),
                            (0.074, 0.295), (0.074, 0.365), (0.040, 0.412), (-0.010, 0.418),
                            (-0.045, 0.400), (0.000, 0.300), (0.000, 0.240)],
                  ink(), edge(), depth=0.006, bevel=0.002, loc=(0, 0.345, 0))
    sit.parent = sleeper
    ring = lambda r: [(r * math.cos(i * math.pi / 7), r * math.sin(i * math.pi / 7)) for i in range(14)]
    head = P.cut('SitHead', ring(0.052), ink(), None, depth=0.006, bevel=0.002,
                 loc=(-0.110, 0.340, 0.372))
    head.parent = sleeper
    bun = P.cut('SitBun', ring(0.026), ink(), None, depth=0.006, bevel=0.002,
                loc=(-0.072, 0.342, 0.408))
    bun.parent = sleeper
    P.key_sin(sleeper, (1, ctx['frames']), loc=(0, 0, 0.0015), speed=0.5, step=5)
    cam(ctx, (-0.16, -0.64, 0.40), (0.02, 0.38, 0.31), lens=56,
        focus_obj=focus((-0.02, 0.35, 0.33)), fstop=2.2, move=(-0.03, 0, 0.005))


def s19(ctx):
    """极近景：火光低下去，她的手摊开护着最后一点热。"""
    rig('dawn', key=0.9, rim=0.8)
    bokeh(y=1.25, z=0.42)
    hands((1, ctx['frames']), spread=0.098, z=0.0, y=0.096, lean=6)
    f = P.flame((0.0, 0.10, 0.030), scale=0.58, strength=2.4)
    P.key_energy(f['light'], (1, ctx['frames']), 0.8, amp=0.35, speed=2.6, seed=1.6)
    P.key_scale(f['flame'], (1, ctx['frames']), amp=0.10, speed=3.2, seed=0.4)
    cam(ctx, (0.0, -0.68, 0.17), (0.0, 0.10, 0.075), lens=72,
        focus_obj=focus((0.0, 0.10, 0.08)), fstop=2.4, move=(0.008, 0, 0.005))


def s20(ctx):
    """海面：雾里传来汽笛，船朝码头驶来；她在岸边挥手。"""
    rig('dawn', rim=1.5)
    sky_stage('dawn', sun=True)
    sea_stage('dawn', y0=0.26)
    fog_a = P.fog_band('FogA', 8.0, 0.18, None, loc=(0, 1.05, 0.14), alpha=0.34)
    fog_b = P.fog_band('FogB', 8.0, 0.14, None, loc=(0, 0.55, 0.10), alpha=0.26)
    P.key_slide(fog_a, (1, ctx['frames']), (0.25, 0, 0), step=5)
    P.key_slide(fog_b, (1, ctx['frames']), (-0.20, 0, 0), step=5)
    boat = P.boat(0.28, loc=(0.52, 0.95, 0.08), rot=(0, 0.02, 0),
                  hull=ink(), sail=cream(), edge=edge(), lantern=True,
                  lantern_mat=P.glow_mat('BoatLamp', '#ffc070', 2.8))
    drift(boat['root'], (1, ctx['frames']), delta=(-0.34, 0, 0), bob=0.005, rock=0.03,
          speed=1.2, phase=0.3)
    pier_stage(None)
    wave_girl = P.figure('stand', 0.23, loc=(0.28, 0.10, 0.045), dir=1, ink=ink(), edge=edge())
    arm = back_arm(wave_girl, 0.23, side=1, ink_mat=ink(), edge_mat=edge(), lift_deg=142)
    P.key_sin(arm, (1, ctx['frames']), rot=(0, 0.16, 0), speed=3.2, step=3)
    P.key_sin(wave_girl['root'], (1, ctx['frames']), rot=(0, 0.010, 0), speed=0.9, step=4)
    gull((-0.15, 1.30, 0.78), s=1.0, phase=0.2)
    cam(ctx, (-0.55, -1.95, 0.30), (0.10, 0.80, 0.28), lens=46,
        focus_obj=focus((0.15, 0.55, 0.22)), fstop=3.0, move=(0.08, 0, 0.008))


def s21(ctx):
    """窗内：她把双手按在玻璃上，船进了港。"""
    rig('dawn', key=1.1, rim=1.5)
    room_stage('dawn', wall='#2a201a')
    room_sea('dawn')
    boat = P.boat(0.15, loc=(0.14, 1.45, 0.24), rot=(0, 0.0, 0), hull=ink(), sail=cream(),
                  edge=edge(), lantern=True, lantern_mat=P.glow_mat('FarBoatLamp', '#ffc070', 2.6))
    drift(boat['root'], (1, ctx['frames']), delta=(-0.10, 0, 0), bob=0.004, rock=0.03,
          speed=1.1, phase=0.6)
    palms = P.pressed_hands(spread=0.145, z=0.24, y=1.005, s=1.0, tilt=7,
                            ink=ink(), edge=edge())
    P.key_sin(palms['root'], (1, ctx['frames']), loc=(0, 0.004, 0.0015), speed=0.55, step=4)
    for i, h in enumerate(palms['hands']):
        P.key_sin(h, (1, ctx['frames']), rot=(0, 0.006 * (1 if i else -1), 0),
                  speed=0.5, phase=i * 0.15, step=5)
    cam(ctx, (0.0, -0.30, 0.30), (0.0, 1.00, 0.25), lens=62,
        focus_obj=focus((0.0, 1.0, 0.26)), fstop=2.0, move=(0.0, 0.03, 0.004),
        handheld=0.0008)


def s22(ctx):
    """码头：船靠了岸，父亲跑下船，她站在原地。"""
    rig('dawn', rim=1.4)
    sky_stage('dawn', sun=True)
    sea_stage('dawn', y0=0.30)
    pier_stage('dawn')
    boat = P.boat(0.26, loc=(0.72, 0.95, 0.08), rot=(0, 0.02, 0),
                  hull=ink(), sail=cream(), edge=edge(), lantern=True,
                  lantern_mat=P.glow_mat('BoatLamp', '#ffc070', 2.6))
    drift(boat['root'], (1, ctx['frames']), delta=(-0.06, 0, 0), bob=0.004, rock=0.03,
          speed=1.3, phase=0.1)
    girl = P.figure('stand', 0.235, loc=(-0.26, 0.12, 0.045), dir=1, ink=ink(), edge=edge())
    P.key_sin(girl['root'], (1, ctx['frames']), rot=(0, 0.012, 0), speed=0.9, step=4)
    father = P.figure('man', 0.265, loc=(0.55, 0.16, 0.045), dir=-1, ink=ink(), edge=edge())
    drift(father['root'], (1, ctx['frames']), delta=(-0.46, 0, 0), bob=0.006, rock=-0.05,
          speed=2.2, phase=0.2)
    cam(ctx, (-0.42, -1.70, 0.31), (0.10, 0.60, 0.23), lens=46,
        focus_obj=focus((0.05, 0.35, 0.18)), fstop=2.8, move=(0.07, 0, 0.005))


def s23(ctx):
    """特写：她笑了，一滴泪才落下来。"""
    rig('dawn', key=1.1, rim=1.2)
    sky_stage('dawn', sun=True)
    sea_stage('dawn', y0=0.30)
    b = P.bust(0.70, loc=(0.0, 0.42, 0.0), dir=-1, ink=ink(), edge=edge(), tear=cream())
    P.key_sin(b['root'], (1, ctx['frames']), rot=(0, 0.010, 0), speed=0.8, step=4)
    K.area_light('FaceRim', (0.66, 0.90, 0.58), 70, (1.0, 0.78, 0.52), 0.30,
                 (0.02, 0.42, 0.36))
    if b['tear'] is not None:
        P.key_slide(b['tear'], (1, ctx['frames']), (0, 0, -0.022), step=4)
    cam(ctx, (-0.02, -0.88, 0.34), (0.02, 0.40, 0.31), lens=82,
        focus_obj=focus((0.02, 0.38, 0.31)), fstop=2.0, move=(0.012, 0, 0.006))


def s24(ctx):
    """片尾：两个人在码头上，船安静地停着；纸字浮起来。"""
    rig('dawn', rim=1.3)
    sky_stage('dawn', sun=True, clouds=1)
    town_stage('dawn', y=1.72, z=0.12, lit=5)
    sea_stage('dawn', y0=0.32)
    pier_stage('dawn')
    boat = P.boat(0.24, loc=(0.48, 0.95, 0.08), rot=(0, 0.02, 0),
                  hull=ink(), sail=cream(), edge=edge(), lantern=True,
                  lantern_mat=P.glow_mat('BoatLamp', '#ffc070', 2.4))
    drift(boat['root'], (1, ctx['frames']), delta=(-0.06, 0, 0), bob=0.004, rock=0.025,
          speed=1.0, phase=0.4)
    girl = P.figure('stand', 0.215, loc=(-0.16, 0.12, 0.045), dir=1, ink=ink(), edge=edge())
    man = P.figure('man', 0.225, loc=(-0.30, 0.14, 0.05), dir=1, ink=ink(), edge=edge())
    for fig, ph in ((girl, 0.0), (man, 0.5)):
        P.key_sin(fig['root'], (1, ctx['frames']), rot=(0, 0.010, 0), speed=0.75, phase=ph, step=4)
    end = P.text_paper('EndCard', '灯 亮 着\n就 有 人 回 来', 0.062, (0.0, -0.10, 0.61),
                       cream(), extrude=0.004, bevel=0.0012)
    P.key_sin(end, (1, ctx['frames']), loc=(0, 0, 0.004), rot=(0, 0, 0.005), speed=0.8, step=4)
    cam(ctx, (-0.35, -2.30, 0.42), (0.02, 0.9, 0.34), lens=50,
        focus_obj=focus((-0.05, 0.25, 0.18)), fstop=3.4, move=(0, -0.18, 0.008))


# ---------------------------------------------------------------- 镜头表

FILM = F.Film('把灯留着 · 3D 纸剧场', samples=16, label='mv3d', voice_json=None)

SHOTS = [
    ('s01', s01, '黄昏港口 · 她走来 · 纸字标题', False, 0.35),
    ('s02', s02, '码头中景 · 她望向海上的船', False, 0.35),
    ('s03', s03, '胸像特写 · 黄昏侧脸', False, 0.42),
    ('s04', s04, '灯塔全景 · 她提灯走向塔下', False, 0.40),
    ('s05', s05, '灯室 · 点亮灯芯', False, 0.40),
    ('s06', s06, '极近景 · 双手护火', False, 0.32),
    ('s07', s07, '灯塔光束扫海 · 船在光里', False, 0.38),
    ('s08', s08, '窗内背影 · 海上的那点灯', False, 0.34),
    ('s09', s09, '风暴海面全景 · 浪起', True, 0.32),
    ('s10', s10, '风暴胸像 · 她盯着海', False, 0.40),
    ('s11', s11, '灯室 · 风灌进来，她扶灯', True, 0.36),
    ('s12', s12, '灯塔全景 · 光束横扫风暴', True, 0.40),
    ('s13', s13, '极近景 · 双手合拢护火', False, 0.22),
    ('s14', s14, '巨浪压来 · 船身竖起', True, 0.34),
    ('s15', s15, '窗内 · 她抹掉玻璃上的雨', True, 0.32),
    ('s16', s16, '特写 · 下了决心', False, 0.40),
    ('s17', s17, '黎明灯塔 · 雾散', False, 0.48),
    ('s18', s18, '灯室 · 她睡着了', False, 0.50),
    ('s19', s19, '极近景 · 火低下去', False, 0.48),
    ('s20', s20, '海面 · 汽笛，船进港，她挥手', False, 0.50),
    ('s21', s21, '窗内 · 双手按住玻璃，船进港', False, 0.52),
    ('s22', s22, '码头 · 父亲跑回来', False, 0.50),
    ('s23', s23, '特写 · 她笑了，泪落', False, 0.52),
    ('s24', s24, '片尾 · 灯亮着，就有人回来', False, 0.50),
]

for sid, fn, note, bake, exposure in SHOTS:
    FILM.add(sid, SHOT, fn, note=note, bake=bake, exposure=exposure,
             motion_blur=True, shutter=0.4, light='key-left', weight='standard')

FILM.run()
