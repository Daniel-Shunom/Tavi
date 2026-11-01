# Synthesizes the ad's sound effects into public/sfx/ (original, no third-party samples).
# Soft, rounded sounds that sit under the music: chat blips, air whooshes, a rising chime,
# a UI click and a closing shimmer. Usage, from video/: python capture/make-sfx.py
import wave
from pathlib import Path

import numpy as np

SR = 44100
out = Path(__file__).resolve().parents[1] / 'public' / 'sfx'
out.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)


def t(seconds):
    return np.arange(int(SR * seconds)) / SR


def lowpass(x, cutoff):
    """One-pole low-pass; cutoff may be an array (a sweep)."""
    cutoff = np.broadcast_to(cutoff, x.shape)
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.zeros_like(x)
    prev = 0.0
    for i in range(len(x)):
        prev = (1 - a[i]) * x[i] + a[i] * prev
        y[i] = prev
    return y


def save(name, x, peak=0.6):
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    fade = min(len(x), int(0.004 * SR))
    x[-fade:] *= np.linspace(1, 0, fade)
    data = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(out / f'{name}.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def blip(freq):
    """A water-drop chat blip: a quick upward glide into a soft sine with a short tail."""
    x = t(0.32)
    glide = freq * (1 - 0.18 * np.exp(-x / 0.012))
    phase = 2 * np.pi * np.cumsum(glide) / SR
    env = (1 - np.exp(-x / 0.003)) * np.exp(-x / 0.075)
    tone = np.sin(phase) + 0.18 * np.sin(2 * phase) + 0.05 * np.sin(3 * phase)
    return lowpass(tone * env, 5200)


# A major pentatonic set, so any run of blips sounds musical.
for i, f in enumerate([659.3, 784.0, 880.0, 987.8, 1174.7]):
    save(f'blip-{i}', blip(f), peak=0.5)


def whoosh(seconds, peak_at, lo, hi):
    """Air past the lens: filtered noise whose brightness rises and falls with its loudness."""
    x = t(seconds)
    shape = np.exp(-((x - peak_at) ** 2) / (2 * (seconds / 5) ** 2))
    noise = rng.standard_normal(len(x))
    swept = lowpass(noise, lo + (hi - lo) * shape)
    body = swept - lowpass(swept, 120)
    return body * shape


save('whoosh-soft', whoosh(1.4, 0.8, 300, 2600), peak=0.45)
save('whoosh-long', whoosh(2.6, 1.7, 250, 2200), peak=0.45)


def bell(freq, seconds, decay):
    x = t(seconds)
    env = (1 - np.exp(-x / 0.004)) * np.exp(-x / decay)
    return env * (np.sin(2 * np.pi * freq * x) + 0.3 * np.sin(2 * np.pi * freq * 2.01 * x) * np.exp(-x / (decay / 3)))


def place(dst, src, at):
    i = int(at * SR)
    dst[i : i + len(src)] += src[: len(dst) - i]


# Her arrival: a soft rising swell into a warm, arpeggiated major-seventh chime.
rise = np.zeros(int(SR * 3.2))
place(rise, whoosh(0.9, 0.7, 200, 1800) * 0.6, 0.0)
for k, f in enumerate([523.3, 659.3, 784.0, 987.8, 1046.5]):
    place(rise, bell(f, 2.4, 0.9) * (0.9 - 0.1 * k), 0.75 + 0.06 * k)
save('arrive', lowpass(rise, 7000), peak=0.55)

# UI click: a tiny felt tap.
x = t(0.08)
click = (np.sin(2 * np.pi * 1800 * x) * np.exp(-x / 0.004) + 0.6 * rng.standard_normal(len(x)) * np.exp(-x / 0.0015))
save('click', lowpass(click, 4000), peak=0.4)

# Closing shimmer: high bells scattered over a second, like light catching glass.
shim = np.zeros(int(SR * 2.6))
for k in range(14):
    f = float(rng.choice([1568.0, 1760.0, 1975.5, 2349.3, 2637.0]))
    place(shim, bell(f, 1.4, 0.45) * rng.uniform(0.25, 0.6), 0.07 * k + rng.uniform(0, 0.03))
save('shimmer', lowpass(shim, 9000), peak=0.35)

# Celebration: three blips stacked into a bright little chord.
pop = np.zeros(int(SR * 0.6))
for k, f in enumerate([784.0, 987.8, 1174.7]):
    place(pop, blip(f), 0.05 * k)
save('cheer', pop, peak=0.5)

print('wrote', sorted(p.name for p in out.glob('*.wav')))
