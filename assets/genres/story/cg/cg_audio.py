"""对白音轨 → 口型曲线。纯标准库，Blender 内与 Node 外都能跑（只依赖 wave/array/math）。

口型不做音素识别，做 RMS 包络：按帧取能量、去噪、归一、平滑。
对中文短句足够读；要逐音素精度是 P2.5 的事。
"""
import array
import math
import wave


def read_wav(path):
    with wave.open(path, 'rb') as w:
        n = w.getnframes()
        sw = w.getsampwidth()
        ch = w.getnchannels()
        sr = w.getframerate()
        raw = w.readframes(n)
    if sw == 2:
        a = array.array('h')
        a.frombytes(raw)
        data = [x / 32768.0 for x in a]
    elif sw == 1:
        a = array.array('B')
        a.frombytes(raw)
        data = [(x - 128) / 128.0 for x in a]
    elif sw == 4:
        a = array.array('i')
        a.frombytes(raw)
        data = [x / 2147483648.0 for x in a]
    else:
        raise ValueError('不支持的采样位宽: %d' % sw)
    if ch > 1:
        data = [sum(data[i:i + ch]) / ch for i in range(0, len(data) - ch + 1, ch)]
    return data, sr


def envelope(path, fps=24, start=0.0, end=None, gate=0.07, knee=0.55, smooth=2):
    """返回每帧 [0,1] 的开口量。gate 以下当静音，knee 以上封顶。"""
    data, sr = read_wav(path)
    dur = len(data) / float(sr)
    if end is None:
        end = dur
    end = min(end, dur)
    frames = max(0, int(round((end - start) * fps)))
    win = max(1, int(sr / float(fps)))
    vals = []
    for f in range(frames):
        a0 = int((start + f / float(fps)) * sr)
        a1 = min(len(data), a0 + win)
        seg = data[a0:a1]
        if not seg:
            vals.append(0.0)
            continue
        vals.append(math.sqrt(sum(x * x for x in seg) / len(seg)))
    peak = max(vals) if vals else 0.0
    if peak <= 0:
        return [0.0] * frames
    out = []
    for v in vals:
        x = v / peak
        if x <= gate:
            out.append(0.0)
        else:
            out.append(min(1.0, (x - gate) / max(1e-6, knee - gate)))
    for _ in range(smooth):
        if len(out) < 3:
            break
        out = [out[0]] + [(out[i - 1] + 2 * out[i] + out[i + 1]) / 4.0 for i in range(1, len(out) - 1)] + [out[-1]]
    return out


def procedural(frames, syllables_per_sec=4.0, fps=24, seed=3):
    """没有音轨时的说话曲线：确定性音节脉冲，供 animation 预演。"""
    out = []
    for f in range(frames):
        t = f / float(fps)
        ph = (t * syllables_per_sec) % 1.0
        pulse = math.sin(math.pi * ph) ** 1.6
        wobble = 0.75 + 0.25 * math.sin(seed + t * 7.1)
        out.append(max(0.0, min(1.0, pulse * wobble)))
    return out
