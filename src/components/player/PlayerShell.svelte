<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import ConfirmDialog from '../ConfirmDialog.svelte'
  import SessionDone from './SessionDone.svelte'
  import { engine, type ProgramSnapshot } from '../../lib/audio/engine'
  import { audio, togglePause } from '../../lib/audio/engine-store.svelte'
  import { openLayer } from '../../lib/ui/layers.svelte'
  import { clearDone, type SessionDoneInfo } from '../../lib/ui/session-ui.svelte'

  // Rahmen der Vollbild-Player (Timer, Atemübung): Titel, Pause/Beenden, Hinweis „Zum Starten tippen“,
  // Rückfrage bei der Zurück-Geste und der Abschluss. Die Art der Sitzung zeichnet ihre Laufansicht
  // selbst (`children`). Eine Instanz zeigt beide Ansichten: Die Engine meldet das Ergebnis und den
  // neuen Stand im selben Aufruf, also behält der Player beim Übergang seine Ebene.
  let {
    label,
    run,
    done,
    confirmTitle,
    continueLabel,
    children,
  }: {
    /** Name des Dialogs für Screenreader. */
    label: string
    /** Das laufende Programm; `null`, wenn nur noch der Abschluss zu sehen ist. */
    run: ProgramSnapshot | null
    done: SessionDoneInfo | null
    confirmTitle: string
    /** Beschriftung von „Abbrechen“ in der Rückfrage: die Übung geht weiter. */
    continueLabel: string
    children: Snippet
  } = $props()

  const running = $derived(run !== null)

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

  // Ein schneller zweiter Tipp auf „Starten“ (Doppeltipp) landete sonst auf „Pause“ oder „Beenden“,
  // die sich gerade an dieselbe Stelle gelegt haben: Die Knöpfe nehmen Tipps erst nach kurzer Zeit
  // an, sichtbar sind sie sofort. Ein reiner Anzeige-Timer, nicht das Ende des Einblendens (bei
  // reduzierter Bewegung gibt es keins).
  const ARM_MS = 400
  let armed = $state(false)

  onMount(() => {
    title?.focus()
    closeLayer = openLayer(onBack)
    const arming = setTimeout(() => (armed = true), ARM_MS)
    return () => {
      clearTimeout(arming)
      closeLayer()
    }
  })

  function end() {
    engine.endProgram().catch(() => {})
  }
</script>

<div class="player" role="dialog" aria-modal="true" aria-label={label}>
  {#if run}
    <h2 class="title" tabindex="-1" bind:this={title}>{run.title}</h2>

    {@render children()}

    {#if audio.snap.needsTap}
      <p class="hint" role="status">Zum Starten tippen</p>
    {/if}

    <div class="controls">
      <button type="button" class="button" disabled={!armed} onclick={togglePause}>
        {audio.snap.state === 'playing' ? 'Pause' : 'Weiter'}
      </button>
      <button type="button" class="button secondary" disabled={!armed} onclick={end}>Beenden</button>
    </div>
  {:else if done}
    <SessionDone kind={done.kind} seconds={done.seconds} counted={done.counted} onDone={clearDone} />
  {/if}
</div>

<!-- Neben dem Player statt darin: eigene Ebene über ihm (Dialog 30 > Player 15). -->
{#if confirming && running}
  <ConfirmDialog
    title={confirmTitle}
    confirmLabel="Beenden"
    cancelLabel={continueLabel}
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
    overflow-x: hidden; /* was über den Rand leuchtet (der Schein des Atemkreises), verschiebt nichts */
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .title {
    padding: 0 8px;
    font-size: 1.375rem;
    text-align: center;
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
