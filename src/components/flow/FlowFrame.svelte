<script lang="ts">
  import { onMount, tick, type Snippet } from 'svelte'
  import ConfirmDialog from '../ConfirmDialog.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { openLayer } from '../../lib/ui/layers.svelte'

  // Der Rahmen geführter Abläufe im Vollbild (Morgen-Start Spec M10 §2.3, Abend-Logbuch Spec M11 §2.3), gezeichnet wie ein
  // Player: Himmel der aktuellen Stimmung, oben die Kopfzeile („×“, Fortschritt, „Überspringen“), darunter der Schritt, den
  // der Ablauf hineinreicht. Hier stehen die Kopfzeile, die Rückfrage beim Beenden, die Ebene der Zurück-Geste, Escape und
  // der Fokus je Schritt; welche Schritte es gibt und was sie tun, weiß der Ablauf. Ein Schritt, der nicht in `steps` steht,
  // ist der Abschluss: ohne Fortschritt und „Überspringen“, und Zurück, Escape und „×“ schließen ohne Rückfrage.
  let {
    label,
    closeLabel,
    confirmTitle,
    steps,
    step,
    hidden = false,
    confirming = $bindable(false),
    onSkip,
    onClose,
    children,
  }: {
    /** Name des Dialogs, etwa „Abend-Logbuch“. */
    label: string
    /** Name des Knopfs „×“, etwa „Abend-Logbuch beenden“. */
    closeLabel: string
    /** Titel der Rückfrage, etwa „Abend-Logbuch beenden?“. */
    confirmTitle: string
    /** Die Eingabeschritte in der Reihenfolge (ohne Abschluss). */
    steps: readonly string[]
    step: string
    /** Verborgen und unerreichbar, aber eingehängt: Die Ebene bleibt im Stapel der Zurück-Geste (Morgen: während eines Players). */
    hidden?: boolean
    confirming?: boolean
    onSkip: () => void
    /** Schließt den Ablauf sofort (bestätigte Rückfrage oder im Abschluss). */
    onClose: () => void
    children: Snippet
  } = $props()

  const index = $derived(steps.indexOf(step))
  const finished = $derived(index === -1)

  // „Überspringen“ nimmt Tipps erst kurz nach dem Öffnen an: Ein Doppeltipp auf den Knopf, der den Ablauf öffnet, träfe
  // mit dem zweiten Tipp sonst diesen Knopf, der sich gerade in die Ecke gelegt hat (siehe `tapArming`). Die Schritte
  // sichern ihre eigenen Knöpfe.
  const arming = tapArming()

  let host = $state<HTMLElement>()

  // Die Zurück-Geste hat den Eintrag der Ebene schon verbraucht, wenn `onBack` läuft. Vor dem Abschluss öffnet er die Ebene
  // sofort wieder (sonst verließe das nächste Zurück die App mitten im Ablauf) und fragt nach, wie `PlayerShell`. Im Abschluss
  // schließt Zurück den Ablauf ohne Rückfrage.
  let closeLayer = () => {}

  function onBack() {
    if (finished) {
      onClose()
      return
    }
    closeLayer = openLayer(onBack)
    confirming = true
  }

  onMount(() => {
    closeLayer = openLayer(onBack)
    return () => closeLayer()
  })

  // „×“ und Escape: im Abschluss zu, sonst die Rückfrage (ohne eine zweite Ebene für die Geste: die des Dialogs).
  function requestClose() {
    if (finished) onClose()
    else confirming = true
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    requestClose()
  }

  // Bei jedem Schrittwechsel erhält die Überschrift des neuen Schritts den Fokus, ebenso beim ersten Einblenden und wenn der
  // Ablauf wieder sichtbar wird (der Knopf, der den Fokus hatte, war verborgen). Verborgen nimmt ein Element keinen Fokus
  // an, darum erst danach.
  function focusTitle() {
    host?.querySelector<HTMLElement>('[data-step-title]')?.focus()
  }

  $effect(() => {
    void step
    if (hidden) return
    void tick().then(focusTitle)
  })
</script>

<!-- Dialog über allem außer Sheet und Dialog (Reiterleiste 10 < Ablauf und Player 15 < Sheet 20 < Dialog 30). Davor im
     Dokument, damit ein Player (gleiche Ebene) immer darüber liegt. -->
<div
  class="flow"
  role="dialog"
  aria-modal="true"
  aria-label={label}
  tabindex="-1"
  {hidden}
  inert={hidden}
  onkeydown={onKeydown}
>
  <div class="top">
    <div class="bar">
      <button type="button" class="close" aria-label={closeLabel} onclick={requestClose}>
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {#if !finished}
        <div class="dots" role="img" aria-label="Schritt {index + 1} von {steps.length}">
          {#each steps as s, i (s)}
            <i class:done={i < index} class:now={i === index}></i>
          {/each}
        </div>
        <button type="button" class="skip" disabled={!arming.armed} onclick={onSkip}>Überspringen</button>
      {/if}
    </div>
  </div>

  <div class="host" bind:this={host}>
    {@render children()}
  </div>
</div>

<!-- Neben dem Ablauf statt darin: eigene Ebene über ihm (Dialog 30). -->
{#if confirming && !finished}
  <ConfirmDialog
    title={confirmTitle}
    confirmLabel="Beenden"
    cancelLabel="Weiter machen"
    onConfirm={onClose}
    onCancel={() => {
      confirming = false
      focusTitle()
    }}
  />
{/if}

<style>
  .flow {
    position: fixed;
    inset: 0;
    z-index: 15;
    display: flex;
    flex-direction: column;
    background:
      radial-gradient(80% 45% at 50% 42%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 70%),
      linear-gradient(to bottom, var(--sky-top) 0%, var(--sky-mid) 58%, var(--sky-bottom) 100%);
    overflow: hidden;
    /* Der Fokus auf der Fläche (Escape kommt dort an) braucht keinen Ring. */
    outline: none;
  }

  /* `display: flex` oben schlüge sonst das Attribut `hidden`. */
  .flow[hidden] {
    display: none;
  }

  /* Ohne color-mix() entfiele mit dem Schein der ganze Hintergrund (var() darin: ungültig erst beim Berechnen). Der Himmel
     bleibt, nur ohne Schein. */
  @supports not (color: color-mix(in srgb, red, red)) {
    .flow {
      background: linear-gradient(to bottom, var(--sky-top) 0%, var(--sky-mid) 58%, var(--sky-bottom) 100%);
    }
  }

  .top {
    flex: none;
    padding: calc(env(safe-area-inset-top, 0px) + 12px) var(--gutter) 0;
  }

  /* Links „×“, in der Mitte der Fortschritt (immer mittig, auch wenn rechts nichts steht), rechts „Überspringen“. */
  .bar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
    width: 100%;
    max-width: calc(480px - 2 * var(--gutter)); /* bündig mit dem Inhalt der Schritte (.host, abzüglich ihres Randes) */
    margin: 0 auto;
  }

  .close {
    display: grid;
    grid-column: 1;
    justify-self: start;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1px solid var(--surface-border);
    border-radius: 50%;
    background: transparent;
    color: var(--text);
  }

  .dots {
    display: flex;
    grid-column: 2;
    align-items: center;
    gap: 8px;
  }

  /* Die erledigten Schritte voll im Akzent, der aktuelle als kurzer Strich, die kommenden blass. */
  .dots i {
    width: 6px;
    height: 6px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--text) 30%, transparent);
  }

  .dots i.done,
  .dots i.now {
    background: var(--accent);
  }

  .dots i.now {
    width: 22px;
  }

  .skip {
    grid-column: 3;
    justify-self: end;
    min-height: 44px;
    padding: 0 6px;
    border: 0;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.9375rem;
    font-weight: 700;
  }

  .skip:disabled {
    cursor: default;
  }

  /* Der Schritt füllt den Rest: Inhalt blättert, die Knöpfe darunter stehen fest. */
  .host {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    width: 100%;
    max-width: 480px;
    min-height: 0;
    margin: 0 auto;
  }

  /*
    Was die Schritte teilen (jeder ist eine eigene Komponente mit dem Wurzelelement `.step`). Die Klassen gelten nur unter
    `.flow`, sie kollidieren mit nichts anderem in der App.
  */
  .flow :global(.step) {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
  }

  .flow :global(.content) {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 20px;
    min-height: 0;
    padding: 20px var(--gutter) 16px;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .flow :global(.head) {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* Kleine Überschrift in Versalien wie „Vorschlag des Tages“ auf „Heute“. */
  .flow :global(.kicker) {
    color: var(--accent);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    line-height: 1.3;
    text-transform: uppercase;
  }

  /* Der Titel erhält den Fokus; lange eigene Wörter in der Zeile darunter brechen um. */
  .flow :global(.title) {
    font-size: clamp(1.625rem, 7.5vw, 1.875rem);
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .flow :global(.lead) {
    color: var(--text-muted);
    font-size: 0.9375rem;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  /* Die Knöpfe unter dem Inhalt: fest am unteren Rand, der Inhalt blättert darüber. */
  .flow :global(.foot) {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: 10px;
    padding: 12px var(--gutter) calc(env(safe-area-inset-bottom, 0px) + 28px);
  }

  /* Eine lange Beschriftung („Fokus-Sprint starten · 50 Min“) bricht bei großer Schrift in zwei gleich lange Zeilen um. */
  .flow :global(.foot .button) {
    width: 100%;
    min-height: 56px;
    padding: 0 16px;
    text-wrap: balance;
  }

  .flow :global(.foot .button-line) {
    width: 100%;
    min-height: 48px;
  }

  .flow :global(.foot :disabled) {
    cursor: default;
  }

  /* Die Zeile über „Weiter“ (Intention, Stichworte): leise, bricht um. */
  .flow :global(.summary) {
    color: var(--text-muted);
    font-size: 0.9375rem;
    text-align: center;
    overflow-wrap: anywhere;
  }

  /* Eingabefelder: Beschriftung, Feld und Zähler (Dankbarkeit, Big Domino, Gelernt, 1 % besser). */
  .flow :global(.field) {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .flow :global(.field label) {
    color: var(--text-muted);
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .flow :global(.field textarea) {
    width: 100%;
    padding: 14px 16px;
    border: 1px solid var(--surface-border);
    border-radius: 16px;
    background-color: var(--surface);
    color: var(--text);
    font: inherit;
    font-weight: 600;
    line-height: 1.4;
    resize: none;
    overflow-wrap: anywhere;
  }

  .flow :global(.field .count) {
    align-self: flex-end;
    color: var(--text-muted);
    font-size: 0.8125rem;
  }

  @media (prefers-reduced-motion: no-preference) {
    .flow {
      animation: flow-in 0.5s ease-out both;
    }

    .flow :global(.step) {
      animation: step-in 0.35s ease-out backwards;
    }

    @keyframes flow-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes step-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  }
</style>
