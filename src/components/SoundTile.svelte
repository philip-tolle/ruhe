<script lang="ts">
  // Eine Kachel unter „Klänge“: ein Naturklang oder ein Musikstück. Ein Musikstück wird gestreamt; ohne
  // Netz ist es nur spielbar, wenn es offline gespeichert ist (wie eine Meditation), sonst gesperrt mit
  // Hinweis. Gespeichert trägt es das Zeichen „offline gespeichert“, und beim ersten Abspielen wird es
  // im Hintergrund gespeichert.
  import { engine } from '../lib/audio/engine'
  import { audio } from '../lib/audio/engine-store.svelte'
  import { backgroundMotiv } from '../lib/content/motive'
  import { startable } from '../lib/meditation/guided-view'
  import { offline } from '../lib/offline/status.svelte'
  import { soundTileTitle, type Background } from '../lib/sounds/catalog'
  import { absoluteMusicUrl, saveBackgroundForOffline } from '../lib/ui/offline-ui.svelte'
  import Motiv from './Motiv.svelte'
  import OfflineMark from './OfflineMark.svelte'

  let { sound }: { sound: Background } = $props()

  // Nur Musik hat einen Offline-Stand; Naturklänge liegen im Precache.
  const url = $derived(sound.kind === 'music' ? absoluteMusicUrl(sound, location.href) : null)
  const saved = $derived(url === null ? undefined : offline.saved[url])

  const volume = $derived(audio.snap.volumes[sound.id])
  const active = $derived(volume !== undefined)
  const loading = $derived(audio.snap.loading.includes(sound.id))
  // Ein ladender Klang zählt als gedrückt: ein weiterer Tipp bricht ihn ab.
  const pressed = $derived(active || loading)
  // Gesperrt wird nur, was nicht läuft: Ein Stück, das beim Wegfall des Netzes klingt, bleibt auf seiner
  // Kachel stoppbar. Der Hinweis ersetzt dann auch eine Ladefehler-Meldung.
  const unavailable = $derived(url !== null && !pressed && !startable(saved, offline.online))
  const failed = $derived(audio.snap.errors.includes(sound.id) && !active && !loading && !unavailable)
  const hintId = $derived(`offline-${sound.id}`)

  const errorId = $derived(`fehler-${sound.id}`)

  function toggle() {
    // Vor dem Antippen gemerkt: Die Engine meldet den neuen Stand sofort, `pressed` gilt danach schon für ihn.
    const starting = !pressed
    // Die Engine hält ihren Zustand selbst konsistent; ein Fehler von play() soll nicht in die Konsole.
    engine.toggle(sound.id).catch(() => {})
    if (starting) saveBackgroundForOffline(sound.id)
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
    aria-describedby={unavailable ? hintId : failed ? errorId : undefined}
    disabled={unavailable}
    class:roomy={active || failed}
    onclick={toggle}
  >
    <span class="motif"><Motiv id={backgroundMotiv(sound.id)} size={128} /></span>
    <span class="label">
      <span class="title">{soundTileTitle(sound.title)}</span>
      {#if saved === true}
        <span class="saved"><OfflineMark /></span>
      {/if}
      {#if unavailable}
        <span class="unavailable" id={hintId}>Nicht offline verfügbar</span>
      {/if}
    </span>
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
    border: 1px solid var(--gold-line);
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

  /* Das Häkchen „offline gespeichert“ leise unter dem Titel, in der gedämpften Textfarbe. */
  .saved {
    display: block;
    margin-top: 4px;
    color: var(--text-muted);
  }

  /* Gesperrt (ohne Netz, nicht gespeichert): Motiv und Titel treten zurück, der Hinweis bleibt gut lesbar. */
  button:disabled {
    cursor: default;
  }

  button:disabled .motif,
  button:disabled .title {
    opacity: 0.55;
  }

  .unavailable {
    display: block;
    margin-top: 4px;
    color: var(--text-muted);
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.25;
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
