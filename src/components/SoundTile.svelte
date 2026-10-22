<script lang="ts">
  import { engine } from '../lib/audio/engine'
  import { audio } from '../lib/audio/engine-store.svelte'
  import { soundMotiv } from '../lib/content/motive'
  import { soundTileTitle, type SoundDef } from '../lib/sounds/catalog'
  import Motiv from './Motiv.svelte'

  let { sound }: { sound: SoundDef } = $props()

  const volume = $derived(audio.snap.volumes[sound.id])
  const active = $derived(volume !== undefined)
  const loading = $derived(audio.snap.loading.includes(sound.id))
  const failed = $derived(audio.snap.errors.includes(sound.id) && !active && !loading)
  // Ein ladender Klang zählt als gedrückt: ein weiterer Tipp bricht ihn ab.
  const pressed = $derived(active || loading)

  const errorId = $derived(`fehler-${sound.id}`)

  function toggle() {
    // Die Engine hält ihren Zustand selbst konsistent; ein Fehler von play() soll nicht in die Konsole.
    engine.toggle(sound.id).catch(() => {})
  }

  function setVolume(event: Event & { currentTarget: HTMLInputElement }) {
    engine.setVolume(sound.id, event.currentTarget.valueAsNumber)
  }
</script>

<div class="tile" class:active>
  <button
    type="button"
    aria-label={sound.title}
    aria-pressed={pressed}
    aria-busy={loading ? 'true' : undefined}
    aria-describedby={failed ? errorId : undefined}
    class:roomy={active || failed}
    onclick={toggle}
  >
    <span class="motif"><Motiv id={soundMotiv(sound.id)} size={128} /></span>
    <span class="label"><span class="title">{soundTileTitle(sound.title)}</span></span>
  </button>

  {#if failed}
    <p class="error" id={errorId} role="status">Konnte nicht geladen werden</p>
  {/if}

  {#if volume !== undefined}
    <input
      type="range"
      class="range"
      aria-label="Lautstärke {sound.title}"
      aria-valuetext="{Math.round(volume * 100)} %"
      min="0"
      max="1"
      step="0.01"
      value={volume}
      style:--v={volume}
      oninput={setVolume}
    />
  {/if}
</div>

<style>
  .tile {
    /* Länge des Auslaufs im Verlauf hinter dem Titel; der Titel steht darunter, auf der vollen Farbe. */
    --tile-fade: 20px;
    /* Abstand des Reglers zum unteren Rand, und der Platz, den der Titel ihm lässt: Abstand + 48 px Höhe
       des Reglers (`.range` in app.css) + 12 px Luft zum Titel. */
    --slider-bottom: 6px;
    --slider-room: calc(var(--slider-bottom) + 48px + 12px);

    position: relative;
    display: flex;
    min-height: 196px;
    border: 1px solid var(--surface-border);
    border-radius: 24px;
    background: linear-gradient(160deg, rgb(238 240 250 / 0.09), rgb(238 240 250 / 0.03));
  }

  .tile.active {
    border-color: var(--accent);
    background: linear-gradient(
      160deg,
      color-mix(in srgb, var(--accent) 17%, transparent),
      color-mix(in srgb, var(--accent) 5%, transparent)
    );
    box-shadow: 0 0 30px color-mix(in srgb, var(--accent) 18%, transparent);
  }

  /* Zwei Ebenen in einer Gitterzelle: oben das Motiv, unten der Titel auf seinem Verlauf. Der Rand des
     Knopfes schneidet den Verlauf rund ab; sein Fokusring liegt außerhalb und bleibt sichtbar. */
  button {
    flex: 1;
    display: grid;
    grid-template-areas: 'stack';
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
    padding: 0;
    border: 0;
    border-radius: inherit;
    overflow: hidden;
    background: none;
    color: var(--text);
    text-align: center;
  }

  button > * {
    grid-area: stack;
  }

  .motif {
    justify-self: center;
    align-self: start;
    margin-top: 10px;
  }

  .label {
    align-self: end;
    padding: var(--tile-fade) 10px 10px;
    background: linear-gradient(to bottom, transparent, var(--tile-scrim) var(--tile-fade));
  }

  /* Platz für Regler bzw. Fehlertext: Der Titel rückt nach oben, der Verlauf reicht weiter bis zum Kachelrand
     und trägt auch den Regler. Die Kachel bleibt gleich hoch. */
  button.roomy .label {
    padding-bottom: var(--slider-room);
  }

  /* Umbruch nur an Leerzeichen und den weichen Trennstellen aus `soundTileTitle` (mit Trennstrich), wie bei den
     Atem-Kacheln; `anywhere` fängt nur ab, was bei extremer Schrift gar nicht mehr passt, statt es abzuschneiden. */
  .title {
    display: block;
    color: var(--text);
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1.25;
    overflow-wrap: anywhere;
    hyphens: manual;
  }

  .error {
    position: absolute;
    inset: auto 12px 12px;
    color: #f4b5a8;
    font-size: 0.8125rem;
    line-height: 1.3;
    text-align: center;
    pointer-events: none;
  }

  /* Aussehen des Reglers: Klasse `range` in app.css; hier nur seine Lage in der Kachel. */
  input[type='range'] {
    position: absolute;
    inset: auto 10px var(--slider-bottom);
    width: calc(100% - 20px);
  }

  @media (prefers-reduced-motion: no-preference) {
    .tile {
      transition:
        border-color 0.3s ease,
        box-shadow 0.4s ease;
    }

    .label {
      transition: padding-bottom 0.3s ease;
    }

    button[aria-busy='true'] .motif {
      animation: tile-pulse 1.6s ease-in-out infinite;
    }

    @keyframes tile-pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.35;
      }
    }
  }
</style>
