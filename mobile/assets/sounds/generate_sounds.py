#!/usr/bin/env python3
"""Generates the three custom notification sound files referenced by
mobile/app.json's expo-notifications plugin config and mobile/src/notifications.ts's
SOUND_FILES map (gentle-paw.wav, bell.wav, ping.wav).

These are synthesized tones (no external audio assets/network calls), kept
deliberately short (well under a second) since a notification sound only
needs to be recognizable, not musical. Pure stdlib (wave + math) — no
numpy dependency required.

Re-run with `python3 generate_sounds.py` from this directory if the sounds
ever need regenerating.
"""
import math
import struct
import wave

SAMPLE_RATE = 44100


def envelope(t, duration, attack=0.01, release=0.08):
    """Simple attack/release envelope so tones don't click at start/end."""
    if t < attack:
        return t / attack
    remaining = duration - t
    if remaining < release:
        return max(0.0, remaining / release)
    return 1.0


def sine_note(freq, duration, amplitude=0.5, harmonics=None):
    """Renders `duration` seconds of a sine tone (plus optional weighted
    harmonics for a richer/bell-like timbre) as a list of float samples in
    [-1, 1]."""
    harmonics = harmonics or [(1, 1.0)]
    n = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = envelope(t, duration)
        value = 0.0
        for mult, weight in harmonics:
            value += weight * math.sin(2 * math.pi * freq * mult * t)
        value /= sum(w for _, w in harmonics)
        samples.append(amplitude * env * value)
    return samples


def write_wav(path, samples):
    with wave.open(path, 'w') as f:
        f.setnchannels(1)
        f.setsampwidth(2)  # 16-bit PCM
        f.setframerate(SAMPLE_RATE)
        frames = b''.join(struct.pack('<h', max(-32767, min(32767, int(s * 32767)))) for s in samples)
        f.writeframes(frames)


def silence(duration):
    return [0.0] * int(SAMPLE_RATE * duration)


# "Nazik pati sesi" — two soft, low, quick notes (like two gentle paw taps),
# longer release so it doesn't sound abrupt.
gentle_paw = (
    sine_note(220, 0.11, amplitude=0.35, harmonics=[(1, 1.0), (2, 0.25)])
    + silence(0.05)
    + sine_note(196, 0.14, amplitude=0.3, harmonics=[(1, 1.0), (2, 0.25)])
)
write_wav('gentle-paw.wav', gentle_paw)

# "Zil" — a classic bell/chime: fundamental plus a few inharmonic-ish
# overtones and a longer decay, evoking a small doorbell/chime.
bell = sine_note(
    880, 0.55, amplitude=0.4,
    harmonics=[(1, 1.0), (2, 0.5), (2.76, 0.25), (4.07, 0.12)],
)
write_wav('bell.wav', bell)

# "Ping" — a short, bright, single high tone.
ping = sine_note(1318, 0.18, amplitude=0.45, harmonics=[(1, 1.0), (3, 0.15)])
write_wav('ping.wav', ping)

print('Wrote gentle-paw.wav, bell.wav, ping.wav')
