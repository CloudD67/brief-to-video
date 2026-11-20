"""cg_film — 长片/分集导演：一张镜头表，按镜搭景、按全局帧号出图（Blender 端）。

短片用一个 film.py 搭一个场景就够了；分集/长片要把很多镜拼起来，
每镜的布景、角色、机位都不同，还要能断点续渲、抽帧、出封面、对台词。

  import cg_film as F
  film = F.Film('留一碗', samples=16)
  film.add('s1', 6.0, wide,   note='雨夜面摊全景', bake=True,
           cast={'yao': 'apron'}, light='key-left')
  film.add('s2', 4.0, close,  note='老板抬头')
  film.run()

时间基准：每镜内部仍用本地帧（1 起），跨镜的成片帧号由导演算，输出仍从
frame_0000.png 连续编号，encode.js 不用改。渲染范围/抽帧/封面都按成片秒数：
  --from/--to  只渲某段（跨镜自动切换布景）
  --at         抽帧到 stills/
  --resume     跳过已存在且 >1KB 的帧，整镜都渲过就直接不搭景
  --poster     全片后追加 out/poster.png

对白：cg/voice.json + tools/cg-voice.js 生成的 assets/voice/ 逐句 wav，
build(ctx) 里 ctx['lines'][who] 即该镜的台词（含口型包络与本地起始帧）。
"""
import json
import os
import time

import bpy

import cg_kit as K


def _env(name, default=None):
    v = os.environ.get(name)
    return default if v in (None, '') else v


def _env_float(name, default):
    try:
        return float(_env(name, default))
    except (TypeError, ValueError):
        return float(default)


def _env_int(name, default):
    return int(round(_env_float(name, default)))


class Film:
    def __init__(self, title, fps=None, width=None, height=None, samples=None,
                 engine=None, voice_json='cg/voice.json', voice_dir='assets/voice',
                 label='film', project_root=None, lines=None):
        self.title = title
        self.fps = _env_int('CG_FPS', fps or 24)
        self.width = _env_int('CG_WIDTH', width or 1920)
        self.height = _env_int('CG_HEIGHT', height or 1080)
        self.samples = _env_int('CG_SAMPLES', samples or 24)
        self.engine = _env('CG_ENGINE', engine or 'EEVEE').upper()
        if project_root is None:
            project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.project_root = os.path.abspath(project_root)
        self.out = os.environ.get('CG_OUT') or os.path.join(self.project_root, 'frames')
        self.from_sec = _env_float('CG_FROM', 0.0)
        self.to_sec = _env_float('CG_TO', 0.0)
        at = _env('CG_AT')
        self.at = [float(x) for x in at.split(',') if x.strip()] if at else None
        poster = _env('CG_POSTER')
        self.poster_sec = float(poster) if poster is not None else None
        self.resume = _env('CG_RESUME', '0') == '1'
        self.save_blend = _env('CG_SAVE_BLEND', '0') == '1'
        self.label = label
        self.voice_json = os.path.join(self.project_root, voice_json) if voice_json else None
        self.voice_dir = os.path.join(self.project_root, voice_dir)
        self.shots = []
        self._cursor = 0
        if lines is not None:
            self._voice = {'voices': {}, 'lines': [dict({'id': i + 1}, **l) for i, l in enumerate(lines)]}
        else:
            self._voice = self._read_json(self.voice_json, {'voices': {}, 'lines': []}) if self.voice_json else {'voices': {}, 'lines': []}
        self._spoken = self._read_spoken()
        self._scene = None
        self._current = None

    # ------------------------------------------------------------ 镜头表

    def add(self, sid, sec, build, note='', bake=False, samples=None,
            motion_blur=False, shutter=0.45, exposure=None, cast=None,
            light='key-left', weight='standard'):
        """加一镜。build(ctx) 负责搭景/摆角色/机位，帧数从 ctx['frames'] 取。

        bake=True 的镜头在搭完后按帧步进一次，给粒子/刚体建缓存
        （有雨、烟、水花的镜头都要开）。cast 用来做跨镜连续性检查，
        light 是主光方向标签，服装与光向在本集里变了会被 validate 点名。
        """
        if any(s['id'] == sid for s in self.shots):
            raise ValueError('镜头 id 重复: ' + sid)
        frames = max(1, int(round(float(sec) * self.fps)))
        shot = dict(
            id=sid, sec=frames / float(self.fps), frames=frames,
            start_frame=self._cursor, start=self._cursor / float(self.fps),
            build=build, note=note, bake=bool(bake),
            samples=int(samples or self.samples), motion_blur=bool(motion_blur),
            shutter=float(shutter),
            exposure=None if exposure is None else float(exposure),
            cast=dict(cast or {}), light=light, weight=weight)
        self.shots.append(shot)
        self._cursor += frames
        return shot

    @property
    def total_frames(self):
        return self._cursor

    @property
    def duration(self):
        return self._cursor / float(self.fps)

    def shot_by_id(self, sid):
        for s in self.shots:
            if s['id'] == sid:
                return s
        return None

    def shot_at(self, sec):
        f = int(round(float(sec) * self.fps))
        for s in self.shots:
            if s['start_frame'] <= f < s['start_frame'] + s['frames']:
                return s
        return self.shots[-1] if self.shots else None

    # ------------------------------------------------------------ 对白

    @staticmethod
    def _read_json(path, fallback):
        if not os.path.exists(path):
            return fallback
        try:
            with open(path, encoding='utf-8') as fh:
                return json.load(fh)
        except Exception as e:
            print('CG_VOICE_SKIP json', path, e, flush=True)
            return fallback

    def _read_spoken(self):
        items = self._read_json(os.path.join(self.voice_dir, 'lines.json'), [])
        if not isinstance(items, list):
            return {}
        return {int(x.get('id', 0)): x for x in items if isinstance(x, dict)}

    def voice_lines(self, sid):
        """本镜台词，按角色分组：{who: [{id,at,local,start_frame,curve,text,spoken}]}。

        先跑 tools/cg-voice.js 才有 wav；没有音频时退回程序化口型脉冲，
        空镜镜头拿不到台词也不受影响。
        """
        import cg_audio as A
        shot = self.shot_by_id(sid)
        out = {}
        if shot is None:
            return out
        for line in self._voice.get('lines', []):
            if (line.get('shot') or '') != sid:
                continue
            lid = int(line.get('id', 0))
            meta = self._spoken.get(lid, {})
            at = float(line.get('at', shot['start']))
            local = at - shot['start']
            curve = None
            wav = meta.get('file') or os.path.join(self.voice_dir, 'line-%02d.wav' % lid)
            if not os.path.isabs(wav):
                wav = os.path.join(self.project_root, wav)
            if os.path.exists(wav):
                try:
                    curve = A.envelope(wav, fps=self.fps, start=0, end=None,
                                       gate=0.06, knee=0.52)
                except Exception as e:
                    print('CG_VOICE_SKIP', lid, e, flush=True)
            if curve is None:
                frames = int(round(float(meta.get('spoken') or line.get('dur') or 2.2) * self.fps))
                curve = A.procedural(max(1, frames), fps=self.fps, seed=3 + lid)
            out.setdefault(line.get('who') or 'narrator', []).append(dict(
                id=lid, at=at, local=local,
                start_frame=int(round(local * self.fps)) + 1,
                curve=curve, text=line.get('text', ''),
                spoken=len(curve) / float(self.fps)))
        return out

    # ------------------------------------------------------------ 校验

    def validate(self):
        issues = []
        cast_seen = {}
        light_seen = None
        for shot in self.shots:
            for key, value in shot['cast'].items():
                if key in cast_seen and cast_seen[key][1] != value:
                    issues.append('造型不连续：%s 在 %s 是「%s」，在 %s 变成了「%s」'
                                  % (key, cast_seen[key][0], cast_seen[key][1], shot['id'], value))
                cast_seen[key] = (shot['id'], value)
            if light_seen and shot['light'] != light_seen[1]:
                issues.append('主光方向变了：%s 是 %s，%s 是 %s（有意为之请在文档里注明）'
                              % (light_seen[0], light_seen[1], shot['id'], shot['light']))
            light_seen = light_seen or (shot['id'], shot['light'])
        ids = {s['id'] for s in self.shots}
        for line in self._voice.get('lines', []):
            sid = line.get('shot')
            if sid not in ids:
                issues.append('台词 %s 指向不存在的镜头 %s' % (line.get('id'), sid))
                continue
            shot = self.shot_by_id(sid)
            local = float(line.get('at', 0)) - shot['start']
            if local < -0.05 or local > shot['sec'] + 0.02:
                issues.append('台词 %s 在 %s 的 %.2fs，不在镜头 %.1f-%.1fs 内'
                              % (line.get('id'), sid, local, 0, shot['sec']))
        if self._voice.get('lines') and not self._spoken:
            print('CG_CONTINUITY_WARN 台词还没有配音（先跑 node tools/cg-voice.js）：本片用程序化口型',
                  flush=True)
        if issues:
            for msg in issues:
                print('CG_CONTINUITY_WARN', msg, flush=True)
            print('CG_CONTINUITY', 'warn', len(issues), flush=True)
        else:
            print('CG_CONTINUITY', 'ok', len(self.shots), 'shots', flush=True)
        return issues

    # ------------------------------------------------------------ 渲染

    def _build(self, shot):
        K.reset()
        scene = K.setup_scene(self.width, self.height, self.fps, shot['frames'],
                              samples=shot['samples'], engine=self.engine,
                              exposure=shot['exposure'] if shot['exposure'] is not None else 0.0,
                              motion_blur=shot['motion_blur'], shutter=shot['shutter'])
        ctx = dict(film=self, shot=shot, scene=scene, frames=shot['frames'],
                   fps=self.fps, sec=shot['sec'], lines=self.voice_lines(shot['id']))
        print('CG_SHOT', shot['id'], shot['frames'], round(shot['start'], 2), flush=True)
        t0 = time.perf_counter()
        info = shot['build'](ctx) or {}
        if shot['bake']:
            import cg_vfx as V
            V.bake(scene, shot['frames'], fps=self.fps, label=shot['id'])
        build_s = time.perf_counter() - t0
        self._scene, self._current = scene, shot
        return scene, info or {}, build_s

    def _render(self, scene, shot, global_frame, path):
        local = global_frame - shot['start_frame'] + 1
        scene.frame_set(local)
        scene.render.filepath = path
        t0 = time.perf_counter()
        bpy.ops.render.render(write_still=True)
        return time.perf_counter() - t0

    def _keep(self, path):
        return self.resume and os.path.exists(path) and os.path.getsize(path) > 1024

    def run(self):
        if not self.shots:
            raise ValueError('镜头表是空的：先 film.add(...)')
        self.validate()
        os.makedirs(self.out, exist_ok=True)
        artifact = os.path.join(self.project_root, 'out')
        os.makedirs(artifact, exist_ok=True)
        manifest = {
            'title': self.title, 'fps': self.fps,
            'resolution': [self.width, self.height], 'duration': self.duration,
            'frames': self.total_frames,
            'shots': [{k: s[k] for k in ('id', 'start', 'start_frame', 'frames', 'sec',
                                         'note', 'cast', 'light', 'weight')}
                      for s in self.shots],
        }
        with open(os.path.join(artifact, self.label + '-manifest.json'), 'w', encoding='utf-8') as fh:
            json.dump(manifest, fh, indent=2, ensure_ascii=False)
        print('CG_FILM', self.title, self.total_frames, round(self.duration, 2), len(self.shots),
              flush=True)

        report = {
            'title': self.title, 'fps': self.fps,
            'resolution': [self.width, self.height],
            'engine': 'BLENDER_EEVEE' if self.engine == 'EEVEE' else 'CYCLES',
            'samples': self.samples, 'duration': self.duration,
            'frames': self.total_frames, 'shots': manifest['shots'],
            'mode': 'stills' if self.at else 'frames',
            'frames_rendered': 0, 'times': [], 'shot_times': {},
        }

        if self.at:
            report['frames_rendered'] = self._render_stills(report)
        else:
            report['frames_rendered'] = self._render_frames(report)
        if self.poster_sec is not None:
            self._render_poster(report)

        report['avg_s'] = (round(sum(report['times']) / len(report['times']), 3)
                           if report['times'] else 0)
        with open(os.path.join(artifact, self.label + '-report.json'), 'w', encoding='utf-8') as fh:
            json.dump(report, fh, indent=2, ensure_ascii=False)
        print('CG_REPORT', json.dumps({
            'title': self.title, 'mode': report['mode'],
            'frames_rendered': report['frames_rendered'],
            'avg_s': report['avg_s'],
            'shot_times': report['shot_times'],
        }, ensure_ascii=False), flush=True)
        return report

    def _render_frames(self, report):
        start = int(round(self.from_sec * self.fps))
        end = int(round((self.to_sec or self.duration) * self.fps))
        end = min(self.total_frames, max(start, end))
        rendered = 0
        for shot in self.shots:
            lo = max(shot['start_frame'], start)
            hi = min(shot['start_frame'] + shot['frames'], end)
            if hi <= lo:
                continue
            todo = [gf for gf in range(lo, hi)
                    if not self._keep(os.path.join(self.out, 'frame_%04d.png' % gf))]
            if len(todo) != hi - lo:
                print('CG_FILM_SKIP', (hi - lo) - len(todo), flush=True)
            if not todo:
                continue
            scene, info, build_s = self._build(shot)
            shot_t = [build_s]
            for gf in todo:
                path = os.path.join(self.out, 'frame_%04d.png' % gf)
                dt = self._render(scene, shot, gf, path)
                shot_t.append(dt)
                report['times'].append(round(dt, 3))
                print('CG_FRAME', gf, path, round(dt, 3), flush=True)
                rendered += 1
            report['shot_times'][shot['id']] = {
                'frames': len(todo), 'build_s': round(build_s, 3),
                'avg_s': round(sum(shot_t[1:]) / max(1, len(shot_t) - 1), 3),
            }
            if self.save_blend:
                bpy.ops.wm.save_as_mainfile(
                    filepath=os.path.join(os.path.dirname(self.out.rstrip(os.sep)),
                                          'out', '%s-%s.blend' % (self.label, shot['id'])))
        return rendered

    def _render_stills(self, report):
        still_dir = os.path.join(os.path.dirname(os.path.abspath(self.out.rstrip(os.sep))), 'stills')
        os.makedirs(still_dir, exist_ok=True)
        groups = {}
        for t in self.at:
            shot = self.shot_at(t)
            groups.setdefault(shot['id'], []).append((t, shot))
        rendered = 0
        for shot in self.shots:
            items = groups.get(shot['id'])
            if not items:
                continue
            todo = [(t, s) for t, s in items
                    if not self._keep(os.path.join(still_dir, 'still_%.2f.png' % t))]
            if len(todo) != len(items):
                print('CG_FILM_SKIP', len(items) - len(todo), flush=True)
            if not todo:
                continue
            scene, info, _ = self._build(shot)
            for t, s in todo:
                gf = s['start_frame'] + int(round(t * self.fps)) - int(round(s['start'] * self.fps))
                dt = self._render(scene, s, gf, os.path.join(still_dir, 'still_%.2f.png' % t))
                report['times'].append(round(dt, 3))
                print('CG_FRAME', gf, os.path.join(still_dir, 'still_%.2f.png' % t),
                      round(dt, 3), flush=True)
                rendered += 1
        return rendered

    def _render_poster(self, report):
        shot = self.shot_at(self.poster_sec)
        if shot is None:
            return
        if self._current is not shot:
            self._build(shot)
        gf = shot['start_frame'] + int(round(self.poster_sec * self.fps)) - int(round(shot['start'] * self.fps))
        path = os.path.join(self.project_root, 'out', 'poster.png')
        os.makedirs(os.path.dirname(path), exist_ok=True)
        dt = self._render(self._scene, shot, gf, path)
        print('CG_POSTER', path, round(dt, 3), flush=True)
        report['poster'] = {'path': path, 'at': round(self.poster_sec, 2), 's': round(dt, 3)}
