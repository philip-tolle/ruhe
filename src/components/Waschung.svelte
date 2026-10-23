<script lang="ts">
  import { waschUrl, type WaschFarbe, type WaschLage } from '../lib/content/waschungen'

  // Eine gemalte Waschung als Schmuck in der oberen rechten Ecke einer Karte. Das `span` ist die Zone: Sie füllt
  // nur diese Ecke (Maße aus `--wash-w` und `--wash-h`, von der Karte gesetzt, sonst 40 % × 100 %), schneidet das
  // Bild ab, und eine Maske blendet es zum linken und unteren Rand der Zone weich aus – am Rand ist nichts mehr zu sehen.
  // Die Karte muss `position: relative; overflow: hidden; isolation: isolate` haben, ihren Inhalt mit
  // `position: relative; z-index: 1` über die Zone legen und ihren Text aus der Zone heraushalten. Text steht
  // nur auf einer deckenden Fläche (etwa einem Linienknopf) in der Zone.
  // Lage 0: wie gemalt, 1: gespiegelt und um 6° gedreht, 2: um −12° gedreht. Das Bild ist Schmuck: `alt=""`.
  let { farbe, lage = 0 }: { farbe: WaschFarbe; lage?: WaschLage } = $props()
</script>

<span class="waschung lage-{lage}" aria-hidden="true"><img src={waschUrl(farbe)} alt="" decoding="async" draggable="false" /></span>

<style>
  .waschung {
    position: absolute;
    top: 0;
    right: 0;
    width: var(--wash-w, 40%);
    height: var(--wash-h, 100%);
    overflow: hidden;
    pointer-events: none;
    z-index: 0;
    opacity: var(--wash-opacity, 0.35);
    /* Weich eingeblendet (Stufen etwa wie smoothstep): Ein gerader Verlauf setzte am Zonenrand mit einem Knick ein,
       den das Auge als senkrechte Kante sieht. */
    --waschung-maske: linear-gradient(
        to right,
        transparent,
        rgb(0 0 0 / 0.06) 10%,
        rgb(0 0 0 / 0.22) 20%,
        rgb(0 0 0 / 0.5) 31%,
        rgb(0 0 0 / 0.8) 42%,
        #000 55%
      ),
      linear-gradient(
        to bottom,
        #000 40%,
        rgb(0 0 0 / 0.8) 52%,
        rgb(0 0 0 / 0.5) 65%,
        rgb(0 0 0 / 0.22) 78%,
        rgb(0 0 0 / 0.06) 89%,
        transparent
      );
    -webkit-mask-image: var(--waschung-maske);
    -webkit-mask-composite: source-in;
    mask-image: var(--waschung-maske);
    mask-composite: intersect;
    /* Nicht kacheln: Bei einer Zone mit Bruchteil-Breite käme sonst das deckende rechte Ende des Verlaufs am linken
       Rand wieder hervor, als heller Strich von einem Pixel. */
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    /* Liegt der linke oder untere Rand der Zone zwischen zwei Gerätepixeln, ließ Chromium dort eine Pixelspalte des
       Bildes an der Maske vorbei. Dort ist die Maske ohnehin durchsichtig: 1 px abschneiden. */
    clip-path: inset(0 0 1px 1px);
  }

  /* Abgestimmt auf Zonen von flach (Listeneintrag 104 × 76 px) bis hoch und schmal (Ecke einer Kachel): Das Bild
     richtet sich nach der Breite der Zone (dreifach, mindestens 220 px), die Höhe folgt dem Bild. So sitzt in jeder
     Zone derselbe dichte Ausschnitt als Wolke oben rechts, statt dass eine hohe Zone das Bild aufbläht und nur den
     ausfransenden Rand zeigt. Der Versatz in Prozent des Bildes schiebt es oben und rechts über die Zone hinaus:
     Lage 0 zeigt etwa das zweite Drittel von rechts. Gespiegelt und gedreht wird um die Bildmitte; Lage 1 zeigt
     damit den dichten linken Teil des Bildes, Lage 2 hebt den rechten leicht an. */
  .waschung img {
    position: absolute;
    top: 0;
    right: 0;
    width: max(300%, 220px);
    height: auto;
    max-width: none;
    transform: translate(10%, -14%);
    user-select: none;
  }

  .lage-1 img {
    transform: translate(10%, -14%) scaleX(-1) rotate(6deg);
  }

  .lage-2 img {
    transform: translate(10%, -14%) rotate(-12deg);
  }
</style>
