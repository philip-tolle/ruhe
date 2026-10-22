#!/usr/bin/env python3
"""Stellt ein gemaltes Motiv vor flacher Grundfarbe frei und speichert es als WebP mit Alpha.

Entwicklungswerkzeug für die Motive unter public/images/motive (nicht Teil der App, nicht in der CI).
Voraussetzung: Python 3 mit Pillow und NumPy.

    python3 scripts/freistellen.py <quelle.png> <ziel.webp> --crop x,y,b,h --size N

Ablauf: Ausschnitt nehmen; Hintergrund = vom Rand her zusammenhängende Fläche nahe der Randfarbe;
im Kantenband (4 px) Alpha aus dem Farbabstand schätzen und die Grundfarbe herausrechnen; auf das
Motiv beschneiden, quadratisch auffüllen, auf N × N verkleinern, als WebP (Qualität 82) speichern.
"""

import argparse

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

NAHE = 38  # Farbabstand, bis zu dem ein Pixel als Hintergrund gilt
KANTE = 90.0  # Farbabstand, ab dem ein Kantenpixel voll deckt
BAND = 9  # Kantenband (MaxFilter-Größe; 9 entspricht 4 px)
QUALITAET = 82


def freistellen(quelle: Image.Image) -> Image.Image:
    bild = np.asarray(quelle.convert('RGB')).astype(np.float64)
    hoehe, breite, _ = bild.shape
    rand = np.concatenate([bild[0], bild[-1], bild[:, 0], bild[:, -1]])
    grund = np.median(rand, axis=0)
    abstand = np.sqrt(((bild - grund) ** 2).sum(axis=2))

    # Vom Rand her zusammenhängende, grundfarbnahe Fläche markieren (Wert 128).
    maske = Image.fromarray(np.where(abstand < NAHE, 255, 0).astype(np.uint8), 'L').copy()
    pixel = maske.load()
    randpunkte = (
        [(x, 0) for x in range(breite)]
        + [(x, hoehe - 1) for x in range(breite)]
        + [(0, y) for y in range(hoehe)]
        + [(breite - 1, y) for y in range(hoehe)]
    )
    for punkt in randpunkte:
        if pixel[punkt] == 255:
            ImageDraw.floodfill(maske, punkt, 128)
    hintergrund = np.asarray(maske) == 128

    hintergrund_bild = Image.fromarray(np.where(hintergrund, 255, 0).astype(np.uint8), 'L')
    band = (np.asarray(hintergrund_bild.filter(ImageFilter.MaxFilter(BAND))) == 255) & ~hintergrund

    alpha = np.ones((hoehe, breite))
    alpha[hintergrund] = 0.0
    alpha[band] = np.clip(abstand[band] / KANTE, 0.0, 1.0)
    alpha = np.asarray(
        Image.fromarray((alpha * 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(0.6))
    ).astype(np.float64) / 255

    # Grundfarbe aus halbdeckenden Kantenpixeln herausrechnen, damit kein dunkler Saum bleibt.
    deckung = np.clip(alpha, 1e-3, 1.0)[..., None]
    farbe = np.clip((bild - (1 - deckung) * grund) / deckung, 0, 255)
    return Image.fromarray(np.dstack([farbe, alpha * 255]).astype(np.uint8), 'RGBA')


def zuschneiden(motiv: Image.Image, groesse: int) -> Image.Image:
    rahmen = motiv.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if rahmen is None:
        raise SystemExit('Kein Motiv gefunden: Ausschnitt prüfen')
    motiv = motiv.crop(rahmen)
    seite = max(motiv.size)
    quadrat = Image.new('RGBA', (seite, seite), (0, 0, 0, 0))
    quadrat.paste(motiv, ((seite - motiv.size[0]) // 2, (seite - motiv.size[1]) // 2))
    return quadrat.resize((groesse, groesse), Image.LANCZOS)


def main() -> None:
    teile = argparse.ArgumentParser(description='Motiv freistellen und als WebP speichern')
    teile.add_argument('quelle')
    teile.add_argument('ziel')
    teile.add_argument('--crop', required=True, help='x,y,breite,höhe im Quellbild')
    teile.add_argument('--size', required=True, type=int, help='Kantenlänge des Ergebnisses in px')
    argumente = teile.parse_args()

    x, y, b, h = (int(wert) for wert in argumente.crop.split(','))
    quelle = Image.open(argumente.quelle).crop((x, y, x + b, y + h))
    ergebnis = zuschneiden(freistellen(quelle), argumente.size)
    ergebnis.save(argumente.ziel, 'WEBP', quality=QUALITAET, method=6)


if __name__ == '__main__':
    main()
