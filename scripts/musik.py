#!/usr/bin/env python3
"""Bereitet die Musikstücke und das Atemgeräusch für die App auf.

Entwicklungswerkzeug für public/audio/music und public/audio/breath (nicht Teil der App, nicht in der CI).
Voraussetzung: Python 3 mit NumPy, ffmpeg mit libopus und libvorbis.

    python3 scripts/musik.py musik <quelle> <ziel.opus>
    python3 scripts/musik.py atem <quelle> <ziel.ogg>

musik: 1,5 s Ein- und 3 s Ausblenden als Sicherung, dann auf −26 LUFS integriert (die Lautheit der
Naturklänge), True Peak höchstens −2 dBTP (ein Begrenzer greift nur, wenn die Verstärkung sonst
darüber führte), Opus 96 kbit/s, Stereo, 48 kHz, ohne Metadaten. Ausgegeben werden Dauer, Größe und
Version (die ersten 10 Hex-Zeichen des SHA-256), so wie sie in content/sounds.json stehen.

atem: Tiefpass bei 4 kHz, Stille an Anfang und Ende weg (alles, was mehr als 30 dB unter der Spitze
liegt), 30 ms Ein- und Ausblenden, −26 LUFS, Mono, Ogg Vorbis. Ausgegeben werden Dauer und Größe.
"""

import argparse
import hashlib
import os
import re
import subprocess
import tempfile

import numpy as np

ZIEL_LUFS = -26.0
ZIEL_TP = -2.0
GRENZE_TP = -2.5  # Begrenzer etwas unter dem Ziel: Opus verschiebt Spitzen beim Kodieren leicht
EIN = 1.5  # s Einblenden (Musik)
AUS = 3.0  # s Ausblenden (Musik)
ATEM_RATE = 48000
ATEM_SCHWELLE = 30.0  # dB unter der Spitze gilt als Stille
ATEM_FENSTER = 0.02  # s, Fenster der Hüllkurve beim Abschneiden
ATEM_RAMPE = 0.03  # s Ein- und Ausblenden (Atem)


def dauer(pfad: str) -> float:
    aus = subprocess.run(
        ['ffprobe', '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', pfad],
        capture_output=True, text=True, check=True,
    )
    return float(aus.stdout.strip())


def messen(pfad: str, filter_kette: str) -> tuple[float, float]:
    """Integrierte Lautheit (LUFS) und True Peak (dBTP) von `pfad` nach `filter_kette`.

    Gemessen mit ebur128 wie bei der Prüfung; loudnorm misst kurze Dateien (das Atemgeräusch) ungenau.
    """
    kette = f'{filter_kette},ebur128=peak=true' if filter_kette else 'ebur128=peak=true'
    aus = subprocess.run(
        ['ffmpeg', '-hide_banner', '-nostats', '-i', pfad, '-af', kette, '-f', 'null', '-'],
        capture_output=True, text=True, check=True,
    )
    zusammenfassung = aus.stderr[aus.stderr.rindex('Summary:'):]
    lufs = re.search(r'I:\s+(-?[\d.]+) LUFS', zusammenfassung)
    spitze = re.search(r'Peak:\s+(-?[\d.]+|-inf) dBFS', zusammenfassung)
    if not lufs or not spitze:
        raise SystemExit(f'Lautheit nicht messbar: {pfad}')
    return float(lufs.group(1)), float(spitze.group(1))


def verstaerkung(lufs: float, tp: float) -> str:
    """Filter, die auf −26 LUFS bringen; ein Begrenzer nur, wenn die Spitze sonst über −2 dBTP stiege."""
    gain = ZIEL_LUFS - lufs
    kette = f'volume={gain:.2f}dB'
    if tp + gain > ZIEL_TP:
        kette += f',alimiter=limit={10 ** (GRENZE_TP / 20):.4f}:level=false'
    return kette


def version(pfad: str) -> str:
    with open(pfad, 'rb') as datei:
        return hashlib.sha256(datei.read()).hexdigest()[:10]


def musik(quelle: str, ziel: str) -> None:
    laenge = dauer(quelle)
    kanten = f'afade=t=in:d={EIN},afade=t=out:st={laenge - AUS:.3f}:d={AUS}'
    lufs, tp = messen(quelle, kanten)
    subprocess.run(
        ['ffmpeg', '-v', 'error', '-y', '-i', quelle, '-vn', '-map_metadata', '-1',
         '-af', f'{kanten},{verstaerkung(lufs, tp)}',
         '-c:a', 'libopus', '-b:a', '96k', '-ar', '48000', '-ac', '2', ziel],
        check=True,
    )
    print(f'{ziel}: {dauer(ziel):.1f} s, {os.path.getsize(ziel)} Byte, Version {version(ziel)}')


def atem(quelle: str, ziel: str) -> None:
    roh = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', quelle, '-af', 'lowpass=f=4000', '-ac', '1', '-ar', str(ATEM_RATE), '-f', 'f32le', '-'],
        capture_output=True, check=True,
    ).stdout
    x = np.frombuffer(roh, np.float32).astype(np.float64)

    # Hüllkurve als gleitender Effektivwert; was mehr als 30 dB unter ihrer Spitze bleibt, ist Stille.
    fenster = int(ATEM_FENSTER * ATEM_RATE)
    huelle = np.sqrt(np.convolve(x ** 2, np.ones(fenster) / fenster, mode='same'))
    laut = np.nonzero(huelle > huelle.max() * 10 ** (-ATEM_SCHWELLE / 20))[0]
    x = x[laut[0]:laut[-1] + 1].copy()

    rampe = int(ATEM_RAMPE * ATEM_RATE)
    x[:rampe] *= np.linspace(0, 1, rampe)
    x[-rampe:] *= np.linspace(1, 0, rampe)

    with tempfile.TemporaryDirectory() as ordner:
        wav = os.path.join(ordner, 'atem.wav')
        subprocess.run(
            ['ffmpeg', '-v', 'error', '-y', '-f', 'f64le', '-ar', str(ATEM_RATE), '-ac', '1', '-i', '-', wav],
            input=x.tobytes(), check=True,
        )
        lufs, tp = messen(wav, '')
        subprocess.run(
            ['ffmpeg', '-v', 'error', '-y', '-i', wav, '-af', verstaerkung(lufs, tp),
             '-ac', '1', '-c:a', 'libvorbis', '-q:a', '5', ziel],
            check=True,
        )
    print(f'{ziel}: {dauer(ziel):.2f} s, {os.path.getsize(ziel)} Byte')


def main() -> None:
    teile = argparse.ArgumentParser(description='Musik und Atemgeräusch für die App aufbereiten')
    art = teile.add_subparsers(dest='art', required=True)
    for name, hilfe in (('musik', 'Musikstück → Opus'), ('atem', 'Atemgeräusch → Ogg Vorbis')):
        befehl = art.add_parser(name, help=hilfe)
        befehl.add_argument('quelle')
        befehl.add_argument('ziel')
    argumente = teile.parse_args()
    (musik if argumente.art == 'musik' else atem)(argumente.quelle, argumente.ziel)


if __name__ == '__main__':
    main()
