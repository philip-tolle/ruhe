<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import ConfirmDialog from '../ConfirmDialog.svelte'
  import SessionDone from './SessionDone.svelte'
  import { engine, type ProgramSnapshot } from '../../lib/audio/engine'
  import { audio, togglePause } from '../../lib/audio/engine-store.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { openLayer } from '../../lib/ui/layers.svelte'
  import { clearDone, type SessionDoneInfo } from '../../lib/ui/session-ui.svelte'

  // Rahmen der Vollbild-Player (Timer, Atemübung, geführte Meditation): Titel, Pause/Beenden, Hinweis
  // „Zum Starten tippen“, Rückfrage bei der Zurück-Geste und der Abschluss. Die Art der Sitzung
  // zeichnet ihre Laufansicht selbst (`children`, über den Knöpfen; `footer`, darunter). Eine Instanz
  // zeigt beide Ansichten: Die Engine meldet das Ergebnis und den neuen Stand im selben Aufruf, also
  // behält der Player beim Übergang seine Ebene.
  let {
    label,
    run,
    subtitle,
    done,
    confirmTitle,
    continueLabel,
    children,
    footer,
  }: {
    /** Name des Dialogs für Screenreader. */
    label: string
    /** Das laufende Programm; `null`, wenn nur noch der Abschluss zu sehen ist. */
    run: ProgramSnapshot | null
    /** Zeile unter dem Titel in der Laufansicht, etwa die Beschreibung der Atemübung. */
    subtitle?: string
    done: SessionDoneInfo | null
    confirmTitle: string
    /** Beschriftung von „Abbrechen“ in der Rückfrage: die Übung geht weiter. */
    continueLabel: string
    children: Snippet
    /** Weitere Bedienelemente unter Pause/Beenden, nur in der Laufansicht. */
    footer?: Snippet
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

  // Ein Doppeltipp auf „Starten“ soll nicht auf „Pause“ oder „Beenden“ landen (siehe `tapArming`).
  const arming = tapArming()

  onMount(() => {
    title?.focus()
    closeLayer = openLayer(onBack)
    return () => closeLayer()
  })

  function end() {
    engine.endProgram().catch(() => {})
  }
</script>

<div class="player" role="dialog" aria-modal="true" aria-label={label}>
  {#if run}
    <h2 class="title" tabindex="-1" bind:this={title}>{run.title}</h2>
    {#if subtitle}
      <p class="subtitle">{subtitle}</p>
    {/if}

    {@render children()}

    {#if audio.snap.needsTap}
      <p class="hint" role="status">Zum Starten tippen</p>
    {/if}

    <div class="controls">
      <!-- Mit Ladefehler heißt „Weiter“ dasselbe wie „Erneut versuchen“ des Players; das ist dort die Hauptschaltfläche. -->
      <button type="button" class="button" class:secondary={run.error} disabled={!arming.armed} onclick={togglePause}>
        {audio.snap.state === 'playing' ? 'Pause' : 'Weiter'}
      </button>
      <button type="button" class="button secondary" disabled={!arming.armed} onclick={end}>Beenden</button>
    </div>

    {@render footer?.()}
  {:else if done}
    <SessionDone kind={done.kind} seconds={done.seconds} counted={done.counted} sessionId={done.sessionId} onDone={clearDone} />
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
     mit eigenem ruhigen Himmel der Tageszeit. */
  .player {
    position: fixed;
    inset: 0;
    z-index: 15;
    display: flex;
    flex-direction: column;
    align-items: center;
    --shell-gap: 24px; /* Abstand der Spalte; der Untertitel rückt davon abhängig an den Titel heran */
    gap: var(--shell-gap);
    padding: calc(env(safe-area-inset-top, 0px) + 48px) var(--gutter) calc(env(safe-area-inset-bottom, 0px) + 40px);
    background:
      radial-gradient(80% 45% at 50% 42%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 70%),
      linear-gradient(to bottom, var(--sky-top) 0%, var(--sky-mid) 58%, var(--sky-bottom) 100%);
    overflow-x: hidden; /* was über den Rand ragt, verschiebt nichts */
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  /* Ohne color-mix() entfiele mit dem Schein der ganze Hintergrund (var() darin: ungültig erst beim
     Berechnen, eine frühere Angabe greift dann nicht mehr). Der Himmel bleibt, nur ohne Schein. */
  @supports not (color: color-mix(in srgb, red, red)) {
    .player {
      background: linear-gradient(to bottom, var(--sky-top) 0%, var(--sky-mid) 58%, var(--sky-bottom) 100%);
    }
  }

  .title {
    padding: 0 8px;
    font-size: 1.375rem;
    text-align: center;
  }

  /* Rückt an den Titel heran: Der Abstand der Spalte (--shell-gap) schrumpft hier auf 8px. */
  .subtitle {
    max-width: 32ch;
    margin-top: calc(8px - var(--shell-gap));
    padding: 0 8px;
    color: var(--text-muted);
    font-size: 0.95rem;
    line-height: 1.45;
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
