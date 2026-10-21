# موسيقى خلفية أصلية للألعاب: إيقاع خليجي خفيف (دُم/تك) ولحن عود بمقام حجاز
import numpy as np
import wave

SR = 44100
BPM = 104
BEAT = 60 / BPM
BARS = 8
LEN = int(SR * BEAT * 4 * BARS)
rng = np.random.default_rng(7)
out = np.zeros(LEN)


def add(sig, t, gain=1.0):
    i = int(t * SR)
    n = min(len(sig), LEN - i)
    if n > 0:
        out[i:i + n] += sig[:n] * gain


def env(n, a=0.002, d=0.25):
    t = np.arange(n) / SR
    return np.minimum(t / a, 1) * np.exp(-t / d)


def doum():
    n = int(SR * 0.45)
    t = np.arange(n) / SR
    f = 70 + 60 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.18)


def tak(bright=1.0):
    n = int(SR * 0.12)
    noise = rng.standard_normal(n)
    noise = np.diff(noise, prepend=0) * bright + noise * (1 - bright) * 0.3
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 420 * t) * 0.4
    return (noise * 0.35 + tone) * env(n, 0.001, 0.03)


def clap():
    n = int(SR * 0.2)
    s = np.zeros(n)
    for k, off in enumerate([0, 0.008, 0.017]):
        i = int(off * SR)
        m = n - i
        s[i:] += rng.standard_normal(m) * env(m, 0.0005, 0.02 + 0.03 * (k == 2))
    return np.diff(s, prepend=0) * 0.5


def oud(freq, dur=0.9):
    # Karplus-Strong: وتر مقروص
    n = int(SR * dur)
    p = int(SR / freq)
    buf = rng.uniform(-1, 1, p)
    buf = np.convolve(buf, np.ones(3) / 3, mode='same')
    y = np.zeros(n)
    for i in range(n):
        y[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
    return y * env(n, 0.003, 0.6)


def pad(freq, dur):
    n = int(SR * dur)
    t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * freq * h * t) / h for h in (1, 2, 3))
    a = np.minimum(t / 0.6, 1) * np.minimum((dur - t) / 0.6, 1)
    return s * a


# مقام حجاز على ري: D Eb F# G A Bb C D
D4 = 293.66
H = [0, 1, 4, 5, 7, 8, 10, 12]
note = lambda deg, octv=0: D4 * 2 ** ((H[deg % 7] + 12 * (deg // 7) + 12 * octv) / 12)

# الإيقاع: دُم . تك تك | دُم دُم تك . (كل بار ٨ ثُمن)
pattern = ['D', None, 'T', 't', 'D', 'D', 'T', None]
eighth = BEAT / 2
for bar in range(BARS):
    for k, h in enumerate(pattern):
        t = (bar * 8 + k) * eighth
        if h == 'D':
            add(doum(), t, 0.9)
        elif h == 'T':
            add(tak(1.0), t, 0.55)
        elif h == 't':
            add(tak(0.6), t, 0.35)
    # تصفيق على ٢ و٤ بالنص التاني
    if bar >= 4:
        add(clap(), (bar * 8 + 2) * eighth, 0.45)
        add(clap(), (bar * 8 + 6) * eighth, 0.45)

# اللحن (درجات المقام، None سكتة)، كل خانة ثُمن
melody = [
    0, None, 2, 3, 4, None, 3, 2,
    1, None, 2, None, 0, None, None, None,
    4, None, 5, 4, 3, None, 2, 3,
    4, None, None, 2, 1, None, 0, None,
    7, None, 6, 5, 4, None, 5, 4,
    3, None, 2, 3, 4, None, None, None,
    5, 4, 3, 2, 1, None, 2, 1,
    0, None, None, None, 0, None, None, None,
]
for i, d in enumerate(melody):
    if d is not None:
        add(oud(note(d)), i * eighth, 0.5)
        add(oud(note(d, 1), 0.5), i * eighth + 0.01, 0.12)

# أرضية هادية: الأساس كل بارين
for bar in range(0, BARS, 2):
    root = [0, 0, 4, 0][(bar // 2) % 4]
    add(pad(note(root, -1), BEAT * 8), bar * BEAT * 4, 0.06)

# ريفيرب بسيط (صدى)
for d, g in [(0.083, 0.25), (0.13, 0.18), (0.21, 0.12)]:
    k = int(d * SR)
    out[k:] += out[:-k] * g * 0.5

# حلقة سلسة: نلف الذيل لأول المقطع
tail = int(SR * 0.6)
out[:tail] += out[-tail:] * np.linspace(1, 0, tail) * 0  # الذيل قصير، الإيقاع بيبلش من جديد
out /= np.max(np.abs(out)) * 1.15
pcm = (out * 32767).astype(np.int16)
with wave.open('game-music.wav', 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(LEN / SR, 'seconds')
