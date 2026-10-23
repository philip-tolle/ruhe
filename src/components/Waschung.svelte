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
    -webkit-mask-image: linear-gradient(to right, transparent, #000 45%), linear-gradient(to bottom, #000 55%, transparent);
    -webkit-mask-composite: source-in;
    mask-image: linear-gradient(to right, transparent, #000 45%), linear-gradient(to bottom, #000 55%, transparent);
    mask-composite: intersect;
  }

  /* Das Bild ist breiter als die Zone und ragt oben und rechts über sie hinaus, so dass sein dichter rechter
     Teil in der Ecke sitzt. Die Seiten richten sich nach der Höhe (`width: auto`). */
  .waschung img {
    position: absolute;
    top: -15%;
    right: -15%;
    height: 150%;
    width: auto;
    max-width: none;
    user-select: none;
  }

  .lage-1 img {
    transform: scaleX(-1) rotate(6deg);
  }

  .lage-2 img {
    transform: rotate(-12deg);
  }
</style>
