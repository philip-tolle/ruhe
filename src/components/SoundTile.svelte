<script lang="ts">
  import { engine } from '../lib/audio/engine'
  import { audio } from '../lib/audio/engine-store.svelte'
  import type { SoundDef } from '../lib/sounds/catalog'
  import { SOUND_ICONS } from './icons'

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
    aria-pressed={pressed}
    aria-busy={loading ? 'true' : undefined}
    aria-describedby={failed ? errorId : undefined}
    class:roomy={active || failed}
    onclick={toggle}
  >
    <svg
      viewBox="0 0 24 24"
      width="30"
      height="30"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={SOUND_ICONS[sound.id]} />
    </svg>
    <span class="title">{sound.title}</span>
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
    position: relative;
    display: flex;
    min-height: 120px;
    border: 1px solid var(--surface-border);
    border-radius: 24px;
    background: linear-gradient(160deg, rgb(238 240 250 / 0.09), rgb(238 240 250 / 0.03));
  }

  .tile.active {
    border-color: var(--accent);
    background: linear-gradient(160deg, rgb(242 201 138 / 0.17), rgb(242 201 138 / 0.05));
    box-shadow: 0 0 30px rgb(242 201 138 / 0.18);
  }

  button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 0;
    padding: 12px 10px;
    border: 0;
    border-radius: inherit;
    background: none;
    color: var(--text-muted);
    text-align: center;
  }

  /* Platz für Regler bzw. Fehlertext; der Inhalt rückt nach oben, die Kachel bleibt gleich hoch. */
  button.roomy {
    padding-bottom: 56px;
  }

  .tile.active button {
    color: var(--accent);
  }

  .title {
    color: var(--text);
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1.25;
    overflow-wrap: anywhere;
    hyphens: auto;
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
    inset: auto 10px 6px;
    width: calc(100% - 20px);
  }

  @media (prefers-reduced-motion: no-preference) {
    .tile {
      transition:
        border-color 0.3s ease,
        box-shadow 0.4s ease;
    }

    button {
      transition:
        color 0.3s ease,
        padding-bottom 0.3s ease;
    }

    button[aria-busy='true'] svg {
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
