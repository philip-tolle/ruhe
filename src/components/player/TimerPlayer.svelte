<script lang="ts">
  import { onMount } from 'svelte'
  import ConfirmDialog from '../ConfirmDialog.svelte'
  import SessionDone from './SessionDone.svelte'
  import { engine } from '../../lib/audio/engine'
  import { audio, togglePause } from '../../lib/audio/engine-store.svelte'
  import { timerDisplay } from '../../lib/meditation/timer-view'
  import { formatRemaining } from '../../lib/time/format'
  import { openLayer } from '../../lib/ui/layers.svelte'
  import { clearDone, sessionUi } from '../../lib/ui/session-ui.svelte'

  // App.svelte zeigt den Player, solange ein Timer läuft (Laufansicht) oder sein Abschluss offen ist
  // (die End-Schalen klingen dabei noch aus). Eine Instanz für beide Ansichten: Die Engine meldet das
  // Ergebnis und den neuen Stand im selben Aufruf, also behält der Player beim Übergang seine Ebene.
  const run = $derived.by(() => {
    const program = audio.snap.program
    return program?.kind === 'timer' && !program.ended ? program : null
  })
  const running = $derived(run !== null)
  const done = $derived(sessionUi.done?.kind === 'timer' ? sessionUi.done : null)

  // Anzeigezeit: pro Bild aus der Audio-Uhr gelesen (Pausen zählen nicht). Nur Anzeige; alles
  // Hörbare ist auf der Audio-Uhr eingeplant. In einer verborgenen Seite ruht requestAnimationFrame.
  let elapsed = $state(engine.programElapsed() ?? 0)
  const view = $derived(run ? timerDisplay(run, elapsed) : null)

  $effect(() => {
    if (!running) return
    let frame = requestAnimationFrame(function tick() {
      elapsed = engine.programElapsed() ?? elapsed
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  })

  let confirming = $state(false)
  let title = $state<HTMLElement>()

  // Endet das Programm, während die Rückfrage offen ist, schließt sie sich.
  $effect(() => {
    if (!running) confirming = false
  })

  // Der Player ist eine Ebene. Die Zurück-Geste hat ihren Eintrag schon verbraucht, wenn onBack
  // läuft: In der Laufansicht öffnet er sie sofort wieder (sonst verließe das nächste Zurück die
  // App mitten in der Sitzung) und fragt nach. Im Abschluss schließt Zurück den Player.
  let closeLayer = () => {}

  function onBack() {
    if (running) {
      closeLayer = openLayer(onBack)
      confirming = true
    } else {
      clearDone()
    }
  }

  onMount(() => {
    title?.focus()
    closeLayer = openLayer(onBack)
    return () => closeLayer()
  })

  function end() {
    engine.endProgram().catch(() => {})
  }

  // Ring: Kreis mit Radius R im 200er-Feld, der Fortschritt läuft oben beginnend im Uhrzeigersinn.
  const R = 92
  const CIRCUMFERENCE = 2 * Math.PI * R
</script>

<div class="player" role="dialog" aria-modal="true" aria-label="Meditation">
  {#if run && view}
    <h2 class="title" tabindex="-1" bind:this={title}>{run.title}</h2>

    <div class="dial">
      <svg class="ring" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        <circle class="track" cx="100" cy="100" r={R} />
        {#if view.progress > 0}
          <circle
            class="progress"
            cx="100"
            cy="100"
            r={R}
            transform="rotate(-90 100 100)"
            stroke-dasharray={CIRCUMFERENCE}
            stroke-dashoffset={CIRCUMFERENCE * (1 - view.progress)}
          />
        {/if}
      </svg>
      <div class="readout">
        {#if view.arriving !== null}
          <p class="phase">Ankommen</p>
          <p class="big">{view.arriving}</p>
        {:else}
          <p class="big" role="timer">{formatRemaining(view.remaining)}</p>
        {/if}
      </div>
    </div>

    {#if audio.snap.needsTap}
      <p class="hint" role="status">Zum Starten tippen</p>
    {/if}

    <div class="controls">
      <button type="button" class="button" onclick={togglePause}>
        {audio.snap.state === 'playing' ? 'Pause' : 'Weiter'}
      </button>
      <button type="button" class="button secondary" onclick={end}>Beenden</button>
    </div>
  {:else if done}
    <SessionDone kind={done.kind} seconds={done.seconds} counted={done.counted} onDone={clearDone} />
  {/if}
</div>

<!-- Neben dem Player statt darin: eigene Ebene über ihm (Dialog 30 > Player 15). -->
{#if confirming && running}
  <ConfirmDialog
    title="Meditation beenden?"
    confirmLabel="Beenden"
    cancelLabel="Weiter meditieren"
    onConfirm={() => {
      confirming = false
      end()
    }}
    onCancel={() => {
      confirming = false
      title?.focus()
    }}
  />
{/if}

<style>
  /* Vollbild über allem außer Sheet und Dialog (Reiterleiste 10 < Player 15 < Sheet 20 < Dialog 30),
     mit eigenem ruhigen Abendhimmel. */
  .player {
    position: fixed;
    inset: 0;
    z-index: 15;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    padding: calc(env(safe-area-inset-top, 0px) + 48px) var(--gutter) calc(env(safe-area-inset-bottom, 0px) + 40px);
    background:
      radial-gradient(80% 45% at 50% 42%, rgb(242 201 138 / 0.09), transparent 70%),
      linear-gradient(to bottom, var(--sky-top) 0%, var(--sky-mid) 58%, var(--sky-bottom) 100%);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .title {
    padding: 0 8px;
    font-size: 1.375rem;
    text-align: center;
  }

  .dial {
    display: grid;
    flex: 1;
    place-items: center;
    width: 100%;
    min-height: 0;
  }

  .ring,
  .readout {
    grid-area: 1 / 1;
  }

  .ring {
    width: min(78vw, 46dvh, 320px);
    height: auto;
    overflow: visible;
  }

  .track,
  .progress {
    fill: none;
    stroke-width: 5;
  }

  .track {
    stroke: rgb(238 240 250 / 0.12);
  }

  .progress {
    stroke: var(--accent);
    stroke-linecap: round;
    filter: drop-shadow(0 0 6px rgb(242 201 138 / 0.45));
  }

  .readout {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .phase {
    color: var(--text-muted);
    font-size: 1.125rem;
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .big {
    font-size: clamp(3rem, 15vw, 4.25rem);
    font-weight: 300;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .hint {
    font-weight: 600;
    text-align: center;
  }

  .controls {
    display: flex;
    gap: 12px;
    width: 100%;
    max-width: 400px;
  }

  .controls .button {
    flex: 1 1 0;
    min-height: 56px;
    padding: 0 20px;
  }

  @media (prefers-reduced-motion: no-preference) {
    .player {
      animation: player-in 0.5s ease-out both;
    }

    @keyframes player-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  }
</style>
