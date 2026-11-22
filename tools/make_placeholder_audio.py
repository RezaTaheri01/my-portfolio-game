#!/usr/bin/env python3
"""
Generates PLACEHOLDER audio so the game has sound out of the box.

  python tools/make_placeholder_audio.py

Writes public/audio/music/lobby_night.{ogg,mp3} and public/audio/sfx/*.{ogg,mp3}.
Needs numpy and ffmpeg. These are synthesised stand-ins: replace the files
(keeping the names) or change the URLs in src/data/assets.ts when you have real tracks.
"""
import subprocess, tempfile, wave
from pathlib import Path

import numpy as np

SR = 22050
ROOT = Path(__file__).resolve().parent.parent / "public" / "audio"


def to_int16(x: np.ndarray, peak: float = 0.85) -> np.ndarray:
    x = x / max(1e-9, np.max(np.abs(x))) * peak
    return (x * 32767).astype(np.int16)


def encode(name: str, samples: np.ndarray, folder: str) -> None:
    out_dir = ROOT / folder
    out_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        wav_path = Path(tmp) / f"{name}.wav"
        with wave.open(str(wav_path), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes(to_int16(samples).tobytes())
        for codec, ext, extra in (("libvorbis", "ogg", ["-q:a", "2"]), ("libmp3lame", "mp3", ["-q:a", "5"])):
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path), "-c:a", codec, *extra,
                            str(out_dir / f"{name}.{ext}")], check=True)
    print("wrote", folder, name)


def t(seconds: float) -> np.ndarray:
    return np.arange(int(SR * seconds)) / SR


def bell(freq: float, seconds: float, decay: float, gain: float = 1.0) -> np.ndarray:
    x = t(seconds)
    env = np.exp(-x * decay) * np.minimum(1, x * 200)  # click-free attack
    tone = np.sin(2 * np.pi * freq * x) + 0.35 * np.sin(2 * np.pi * freq * 2.01 * x) + 0.12 * np.sin(2 * np.pi * freq * 3.02 * x)
    return gain * env * tone


# ---------------- SFX ----------------

def sfx() -> None:
    encode("dialog_open", np.concatenate([bell(659, 0.18, 14), bell(988, 0.28, 11)])[: int(SR * 0.4)] * 0.8, "sfx")
    encode("dialog_advance", bell(880, 0.09, 40) * 0.7, "sfx")
    encode("dialog_close", np.concatenate([bell(988, 0.12, 16), bell(659, 0.26, 12)]) * 0.8, "sfx")
    encode("near", bell(1175, 0.16, 22) * 0.5, "sfx")
    arp = [bell(f, 0.14, 12) for f in (784, 988, 1319, 1568)]
    seq = np.zeros(int(SR * 0.6))
    for i, n in enumerate(arp):
        s = int(i * 0.07 * SR)
        seq[s : s + len(n)] += n
    encode("collect", seq, "sfx")


# ---------------- Music: 16s seamless loop ----------------

def music() -> None:
    L = 16.0
    x = t(L)
    n = len(x)

    # Slowly breathing pad (integer-Hz tones => whole cycles => loops cleanly).
    pad = np.zeros(n)
    for f, g in ((110, 1.0), (165, 0.6), (220, 0.5), (262, 0.35)):
        lfo = 0.65 + 0.35 * np.sin(2 * np.pi * (1 / 8) * x + f)
        pad += g * lfo * np.sin(2 * np.pi * f * x)
    pad *= 0.22

    # Soft bells on an A-minor pentatonic; tails wrap around the loop point.
    rng = np.random.default_rng(7)
    bells = np.zeros(n)
    scale = [440, 523, 587, 659, 784, 880]
    for start in np.arange(0.5, L, 2.0):
        note = bell(float(rng.choice(scale)), 3.5, 1.6, 0.12)
        s = int(start * SR)
        idx = (np.arange(len(note)) + s) % n
        np.add.at(bells, idx, note)

    # Distant crickets: amplitude-pulsed 4.4 kHz, very quiet.
    chirp = np.sin(2 * np.pi * 4400 * x) * (np.sin(2 * np.pi * 2 * x) > 0.6) * (0.5 + 0.5 * np.sin(2 * np.pi * 28 * x))
    crickets = 0.025 * chirp

    mix = pad + bells + crickets
    fade = int(0.01 * SR)  # tiny edge fade guards against a tick
    mix[:fade] *= np.linspace(0, 1, fade); mix[-fade:] *= np.linspace(1, 0, fade)
    encode("lobby_night", mix, "music")


if __name__ == "__main__":
    sfx()
    music()
