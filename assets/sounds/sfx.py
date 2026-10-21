# مؤثرات صوتية أصلية للألعاب
import numpy as np
import wave

SR = 44100
rng = np.random.default_rng(3)


def t_(dur):
    return np.arange(int(SR * dur)) / SR


def env(n, a=0.002, d=0.1):
    t = np.arange(n) / SR
    return np.minimum(t / a, 1) * np.exp(-t / d)


def tone(f, dur, d=0.15, a=0.003, harm=(1, 0.3, 0.1)):
    t = t_(dur)
    s = sum(g * np.sin(2 * np.pi * f * (k + 1) * t) for k, g in enumerate(harm))
    return s * env(len(t), a, d)


def seq(parts, gap=0.0):
    out = []
    for p in parts:
        out.append(p)
        if gap:
            out.append(np.zeros(int(SR * gap)))
    return np.concatenate(out)


def mix(*items):
    # items: (signal, start_seconds)
    n = max(int(s * SR) + len(x) for x, s in items)
    out = np.zeros(n)
    for x, s in items:
        i = int(s * SR)
        out[i:i + len(x)] += x
    return out


def noise(dur, d=0.03, hp=True):
    n = int(SR * dur)
    x = rng.standard_normal(n)
    if hp:
        x = np.diff(x, prepend=0)
    return x * env(n, 0.0005, d)


sounds = {}
# ضغطة زر
sounds['tap'] = tone(1200, 0.06, 0.012, 0.001, (1, 0.2)) * 0.6
# نزول ورقة
sounds['card'] = mix((noise(0.12, 0.025) * 0.5, 0), (tone(220, 0.1, 0.03, 0.001, (1,)) * 0.3, 0))
# النرد: طقطقات
sounds['dice'] = mix(*[(noise(0.05, 0.012) * (0.7 - i * 0.07) + tone(900 + int(rng.integers(-200, 200)), 0.05, 0.01, 0.001, (1,))[:int(SR*0.05)] * 0.25, i * (0.045 + 0.012 * i))
                       for i in range(8)])
# تحريك قطعة
sounds['move'] = mix((tone(520, 0.12, 0.05, 0.001, (1, 0.5)) * 0.5, 0), (noise(0.05, 0.01) * 0.2, 0))
# دورك
sounds['turn'] = mix((tone(880, 0.35, 0.18), 0), (tone(1318.5, 0.5, 0.25), 0.12)) * 0.45
# صح
sounds['correct'] = mix((tone(784, 0.25, 0.1), 0), (tone(1046.5, 0.4, 0.2), 0.1)) * 0.5
# غلط
t = t_(0.35)
sounds['wrong'] = np.sign(np.sin(2 * np.pi * (220 - 80 * t / 0.35) * t)) * env(len(t), 0.003, 0.15) * 0.18
# تيك للوقت
sounds['tick'] = tone(1600, 0.04, 0.008, 0.0005, (1,)) * 0.4
# ربح: أربيجيو صاعد
win = mix(*[(tone(f, 0.6, 0.35), i * 0.11) for i, f in enumerate([523.25, 659.25, 783.99, 1046.5])],
          (tone(1318.5, 0.9, 0.5) * 0.8, 0.5))
sounds['win'] = win * 0.35
# خسارة: نازل
sounds['lose'] = mix(*[(tone(f, 0.5, 0.3, 0.005, (1, 0.4)), i * 0.18) for i, f in enumerate([392, 349.23, 311.13, 261.63])]) * 0.35
# عملات
sounds['coins'] = mix(*[(tone(2000 + 300 * (i % 3), 0.15, 0.06, 0.0005, (1, 0.5)), i * 0.06) for i in range(6)]) * 0.3


def save(name, x):
    x = np.clip(x, -1, 1)
    pcm = (x * 32767).astype(np.int16)
    with wave.open(f'{name}.wav', 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


# مستوى كل صوت نسبةً لبعض (بعد التطبيع)
LEVEL = {'tap': 0.5, 'card': 0.7, 'dice': 0.8, 'move': 0.7, 'turn': 0.8, 'correct': 0.8, 'wrong': 0.7,
         'tick': 0.5, 'win': 0.9, 'lose': 0.8, 'coins': 0.7}
demo = []
for k, x in sounds.items():
    y = x / np.max(np.abs(x)) * LEVEL[k] * 0.85
    save(k, y)
    demo += [y, np.zeros(int(SR * 0.6))]
save('demo', np.concatenate(demo))
print(list(sounds))
