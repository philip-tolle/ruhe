#!/usr/bin/env python3
"""Stellt ein gemaltes Motiv vor flacher Grundfarbe frei und speichert es als WebP mit Alpha.

Entwicklungswerkzeug für die Motive unter public/images/motive (nicht Teil der App, nicht in der CI).
Voraussetzung: Python 3 mit Pillow und NumPy.

    python3 scripts/freistellen.py <quelle.png> <ziel.webp> --crop x,y,b,h --size N [--innen F]
    python3 scripts/freistellen.py <quelle.png> <ziel.webp> --schwarz --breite 900

Ablauf: Ausschnitt nehmen; Hintergrund = vom Rand her zusammenhängende Fläche nahe der Randfarbe;
im Kantenband (4 px) Alpha aus dem Farbabstand schätzen und die Grundfarbe herausrechnen; auf das
Motiv beschneiden, quadratisch auffüllen, auf N × N verkleinern, als WebP (Qualität 82) speichern.
Mit --innen F gelten auch eingeschlossene grundfarbnahe Flächen ab F Pixeln als Hintergrund (etwa
zwischen den Säulen einer Sanduhr); ohne die Option bleiben sie stehen (gewollt dunkle Flächen).
--nahe D setzt den Farbabstand, bis zu dem ein Pixel als Hintergrund gilt (Standard 38); ein größerer
Wert nimmt einen zarten gemalten Schein um das Motiv mit weg.

Mit --schwarz (Waschungen der Karten, gemalt auf reinem Schwarz): Deckkraft aus dem hellsten Kanal,
Farbe davon befreit; auf die Waschung beschnitten (nicht quadratisch), auf die Breite N verkleinert,
als WebP (Qualität 76) gespeichert. Ausgegeben wird zur Einschätzung die hellste Farbe der Waschung (99. Perzentil der
vormultiplizierten Helligkeit, also wie sie auf Schwarz erscheint).
"""

import argparse
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

NAHE = 38  # Farbabstand, bis zu dem ein Pixel als Hintergrund gilt
KANTE = 90.0  # Farbabstand, ab dem ein Kantenpixel voll deckt
BAND = 9  # Kantenband (MaxFilter-Größe; 9 entspricht 4 px)
QUALITAET = 82
QUALITAET_WASCHUNG = 76
SCHWARZ_SCHWELLE = 0.04  # Helligkeit, bis zu der ein Pixel als schwarzer Grund gilt


def eingeschlossen(nah: np.ndarray, hintergrund: np.ndarray, mindestens: int) -> np.ndarray:
    """Grundfarbnahe Flächen, die nicht am Rand hängen, mit mindestens `mindestens` Pixeln."""
    hoehe, breite = nah.shape
    offen = nah & ~hintergrund
    gesehen = np.zeros_like(offen)
    ergebnis = np.zeros_like(offen)
    for start_y, start_x in zip(*np.nonzero(offen)):
        if gesehen[start_y, start_x]:
            continue
        flaeche = [(start_y, start_x)]
        gesehen[start_y, start_x] = True
        warteschlange = deque(flaeche)
        while warteschlange:
            py, px = warteschlange.popleft()
            for ny, nx in ((py - 1, px), (py + 1, px), (py, px - 1), (py, px + 1)):
                if 0 <= ny < hoehe and 0 <= nx < breite and offen[ny, nx] and not gesehen[ny, nx]:
                    gesehen[ny, nx] = True
                    flaeche.append((ny, nx))
                    warteschlange.append((ny, nx))
        if len(flaeche) >= mindestens:
            ys, xs = zip(*flaeche)
            ergebnis[list(ys), list(xs)] = True
    return ergebnis


def freistellen(quelle: Image.Image, innen: int | None = None, nahe: float = NAHE) -> Image.Image:
    bild = np.asarray(quelle.convert('RGB')).astype(np.float64)
    hoehe, breite, _ = bild.shape
    rand = np.concatenate([bild[0], bild[-1], bild[:, 0], bild[:, -1]])
    grund = np.median(rand, axis=0)
    abstand = np.sqrt(((bild - grund) ** 2).sum(axis=2))

    # Vom Rand her zusammenhängende, grundfarbnahe Fläche markieren (Wert 128).
    maske = Image.fromarray(np.where(abstand < nahe, 255, 0).astype(np.uint8), 'L').copy()
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
    if innen is not None:
        hintergrund = hintergrund | eingeschlossen(abstand < nahe, hintergrund, innen)

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


def waschung(quelle: Image.Image, breite: int) -> tuple[Image.Image, str]:
    bild = np.asarray(quelle.convert('RGB')).astype(np.float64)
    # Schwarzer Grund: Was heller ist, ist Farbe. Die unterste Spur (Rauschen im Schwarz) zählt nicht.
    deckung = np.clip((bild.max(axis=2) / 255 - SCHWARZ_SCHWELLE) / (1 - SCHWARZ_SCHWELLE), 0.0, 1.0)
    ys, xs = np.nonzero(deckung > 0.03)
    if ys.size == 0:
        raise SystemExit('Keine Waschung gefunden: Bild prüfen')
    oben, unten, links, rechts = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    bild, deckung = bild[oben:unten, links:rechts], deckung[oben:unten, links:rechts]
    farbe = np.clip(bild / np.maximum(deckung, 1e-3)[..., None], 0, 255)

    # Hellste Farbe: so stark scheint die Waschung höchstens durch. Gerechnet mit der vormultiplizierten
    # Farbe (Farbe × Deckkraft, also das, was auf Schwarz zu sehen ist): Mittel der Pixel ab dem
    # 99. Perzentil ihrer Helligkeit. Ohne Vormultiplikation würden halb deckende Ränder zu hell.
    sichtbar = (farbe * deckung[..., None]).reshape(-1, 3)
    hell = sichtbar @ np.array([0.2126, 0.7152, 0.0722])
    auswahl = sichtbar[hell >= np.percentile(hell, 99)].mean(axis=0)
    hellste = '#' + ''.join(f'{round(kanal):02x}' for kanal in auswahl)

    ergebnis = Image.fromarray(np.dstack([farbe, deckung * 255]).astype(np.uint8), 'RGBA')
    hoehe = round(ergebnis.size[1] * breite / ergebnis.size[0])
    return ergebnis.resize((breite, hoehe), Image.LANCZOS), hellste


def main() -> None:
    teile = argparse.ArgumentParser(description='Motiv freistellen und als WebP speichern')
    teile.add_argument('quelle')
    teile.add_argument('ziel')
    teile.add_argument('--crop', help='x,y,breite,höhe im Quellbild (Motive)')
    teile.add_argument('--size', type=int, help='Kantenlänge des Ergebnisses in px (Motive)')
    teile.add_argument('--innen', type=int, help='eingeschlossene Grundfläche ab so vielen Pixeln entfernen (Motive)')
    teile.add_argument('--nahe', type=float, default=NAHE, help=f'Farbabstand zur Grundfarbe, bis zu dem ein Pixel Hintergrund ist (Standard {NAHE})')
    teile.add_argument('--schwarz', action='store_true', help='Waschung auf reinem Schwarz')
    teile.add_argument('--breite', type=int, help='Breite des Ergebnisses in px (Waschungen)')
    argumente = teile.parse_args()

    if argumente.schwarz:
        if argumente.breite is None:
            teile.error('--schwarz braucht --breite')
        ergebnis, hellste = waschung(Image.open(argumente.quelle), argumente.breite)
        ergebnis.save(argumente.ziel, 'WEBP', quality=QUALITAET_WASCHUNG, method=6)
        print(f'{argumente.ziel}: {ergebnis.size[0]}×{ergebnis.size[1]}, hellste {hellste}')
        return

    if argumente.crop is None or argumente.size is None:
        teile.error('Motive brauchen --crop und --size')
    x, y, b, h = (int(wert) for wert in argumente.crop.split(','))
    quelle = Image.open(argumente.quelle).crop((x, y, x + b, y + h))
    ergebnis = zuschneiden(freistellen(quelle, argumente.innen, argumente.nahe), argumente.size)
    ergebnis.save(argumente.ziel, 'WEBP', quality=QUALITAET, method=6)


if __name__ == '__main__':
    main()
