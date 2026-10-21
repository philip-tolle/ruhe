<script lang="ts">
  import PlayerShell from './PlayerShell.svelte'
  import ProgressDial from './ProgressDial.svelte'
  import BalanceSlider from '../BalanceSlider.svelte'
  import SoundSelect from '../SoundSelect.svelte'
  import { engine } from '../../lib/audio/engine'
  import { audio } from '../../lib/audio/engine-store.svelte'
  import { meditationById } from '../../lib/content/catalog'
  import { backgroundVolume, canSeek, guidedDisplay, SEEK_SECONDS } from '../../lib/meditation/guided-view'
  import type { SoundId } from '../../lib/sounds/catalog'
  import { stats, updateSettings } from '../../lib/stats/store.svelte'
  import { formatRemaining } from '../../lib/time/format'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { doneOf, runningProgram } from '../../lib/ui/player-state'
  import { programClock } from '../../lib/ui/program-clock.svelte'

  // App.svelte zeigt den Player, solange eine geführte Meditation läuft (Laufansicht) oder ihr
  // Abschluss offen ist.
  const run = $derived(runningProgram('guided'))
  const done = $derived(doneOf('guided'))

  // Zeitbasis ist die Position in der Datei (`programElapsed()`). Beim Abspielen liest die Anzeige
  // sie pro Bild; in der Pause ruht die Bildschleife, dann gilt die letzte Momentaufnahme der
  // Engine, die auch ein Spulen in der Pause schon enthält.
  const clock = programClock(() => run !== null)
  const elapsed = $derived(audio.snap.state === 'playing' ? clock.elapsed : (run?.elapsed ?? 0))
  // Bis die Länge der Datei bekannt ist, zählt die Länge laut Katalog.
  const catalogLength = $derived(run ? (meditationById(run.ref)?.duration ?? 0) : 0)
  const view = $derived(run ? guidedDisplay(run.length, catalogLength, elapsed) : null)
  const seekable = $derived(run !== null && canSeek(run))

  // Spulen und Hintergrund nehmen Tipps erst kurz nach dem Öffnen an, wie Pause und Beenden.
  const arming = tapArming()

  // Hintergrund und Balance wirken sofort und gelten auch für die nächste Meditation. Die Balance
  // folgt beim Ziehen dem Regler und wird beim Loslassen gespeichert.
  const sound = $derived(stats.data.settings.guidedSound)
  let balance = $state(stats.data.settings.voiceBalance)

  function setSound(id: SoundId | null) {
    engine.setBackground(id, backgroundVolume(balance))
    updateSettings({ guidedSound: id })
  }

  function slideBalance(value: number) {
    balance = value
    engine.setBackground(sound, backgroundVolume(value))
  }

  function saveBalance(value: number) {
    slideBalance(value)
    updateSettings({ voiceBalance: value })
  }

  function seek(delta: number) {
    engine.seek(delta)
  }

  function retry() {
    engine.retryGuided().catch(() => {})
  }
</script>

<!-- Ein Pfeil im Kreis mit der Zahl 15; für „vor“ gespiegelt, die Zahl nicht. -->
{#snippet seekIcon(forward: boolean)}
  <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" focusable="false">
    <g
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      transform={forward ? 'matrix(-1 0 0 1 24 0)' : undefined}
    >
      <path d="M12 3.5A8.5 8.5 0 1 1 4 9.1" />
      <path d="M14.6 1.2 12 3.5l2.6 2.4" />
    </g>
    <text x="12" y="15.4" text-anchor="middle" fill="currentColor" font-size="7.5" font-weight="700">15</text>
  </svg>
{/snippet}

<PlayerShell
  label="Geführte Meditation"
  {run}
  {done}
  confirmTitle="Meditation beenden?"
  continueLabel="Weiter meditieren"
>
  {#if run?.error}
    <div class="error">
      <p role="alert">Die Meditation konnte nicht geladen werden.</p>
      <button type="button" class="button" onclick={retry}>Erneut versuchen</button>
    </div>
  {:else if view}
    <ProgressDial fit progress={view.progress} value={formatRemaining(view.remaining)} />
  {/if}

  <div class="seek">
    <button
      type="button"
      class="seek-button"
      aria-label="15 Sekunden zurück"
      disabled={!arming.armed || !seekable}
      onclick={() => seek(-SEEK_SECONDS)}
    >
      {@render seekIcon(false)}
    </button>
    <button
      type="button"
      class="seek-button"
      aria-label="15 Sekunden vor"
      disabled={!arming.armed || !seekable}
      onclick={() => seek(SEEK_SECONDS)}
    >
      {@render seekIcon(true)}
    </button>
  </div>

  {#snippet footer()}
    <div class="background">
      <div class="sound">
        <span class="label" aria-hidden="true">Klang</span>
        <SoundSelect label="Hintergrundklang" bind:value={() => sound, setSound} disabled={!arming.armed} />
      </div>
      {#if sound !== null}
        <BalanceSlider value={balance} disabled={!arming.armed} onInput={slideBalance} onChange={saveBalance} />
      {/if}
    </div>
  {/snippet}
</PlayerShell>

<style>
  /* Nimmt den Platz des Rings ein, damit die Knöpfe darunter nicht springen. */
  .error {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    min-height: 168px;
    max-width: 400px;
    text-align: center;
  }

  .seek {
    display: flex;
    justify-content: center;
    gap: 48px;
  }

  .seek-button {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    padding: 0;
    border: 1px solid var(--surface-border);
    border-radius: 50%;
    background: var(--surface);
    color: var(--text);
  }

  .seek-button:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .seek-button:not(:disabled):active {
    transform: scale(0.96);
  }

  .background {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 400px;
  }

  .sound {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .label {
    flex: none;
    color: var(--text-muted);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .sound :global(select) {
    flex: 1;
    min-width: 0;
  }

  @media (prefers-reduced-motion: no-preference) {
    .seek-button {
      transition: transform 0.15s ease;
    }
  }
</style>
