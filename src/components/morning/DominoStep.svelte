<script lang="ts">
  import { clipChars } from '../../lib/stats/schema'
  import { openDomino } from '../../lib/morning/logic'
  import { DOMINO_MAX } from '../../lib/morning/words'
  import { stats } from '../../lib/stats/store.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { morningUi, nextStep } from '../../lib/ui/morning-ui.svelte'
  import { appNow } from '../../lib/ui/tageszeit.svelte'

  // „Big Domino“ (Spec M10 §2.3): die eine Sache des Tages, höchstens 80 Zeichen, mit Zähler. Liegt von den letzten drei
  // Tagen ein offener Big Domino vor, bietet der Kasten „Von gestern offen“ ihn zum Übernehmen an, solange das Feld leer
  // ist. Gezählt und gekürzt wird nach Unicode-Zeichen (siehe `clipChars`); ein Zeilenumbruch wird zum Leerzeichen, und
  // „Return“ schließt nur die Tastatur. Dies ist der letzte Eingabeschritt: Mit „Weiter“ wird der Eintrag gespeichert,
  // und der Abschluss legt „Fertig“ an die Stelle dieses Knopfs (siehe `tapArming`).
  const id = $props.id()
  const arming = tapArming()

  let area = $state<HTMLTextAreaElement>()

  const open = $derived(openDomino(stats.data.mornings ?? [], appNow()))
  const count = $derived(Array.from(morningUi.draft.domino).length)

  function onInput(event: Event & { currentTarget: HTMLTextAreaElement }) {
    const clipped = clipChars(event.currentTarget.value.replace(/\s*[\r\n]+\s*/g, ' '), DOMINO_MAX)
    if (clipped !== event.currentTarget.value) event.currentTarget.value = clipped
    morningUi.draft.domino = clipped
  }

  function onKeydown(event: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) {
    if (event.key !== 'Enter' || event.isComposing) return
    event.preventDefault()
    event.currentTarget.blur()
  }

  // Der Kasten verschwindet mit der Übernahme und nimmt den Fokus des Knopfs mit: Er geht ins Feld.
  function adopt() {
    if (open === null) return
    morningUi.draft.domino = clipChars(open, DOMINO_MAX)
    area?.focus()
  }
</script>

<div class="step">
  <div class="content">
    <header class="head">
      <p class="kicker">Big Domino</p>
      <h2 class="title" tabindex="-1" data-step-title>Was ist heute dein Big Domino?</h2>
      <p class="lead">Die eine Sache, die vieles andere leichter macht.</p>
    </header>

    <p class="hint">Frag dich: Welche eine Sache macht heute vieles andere leichter oder unnötig?</p>

    {#if open !== null && morningUi.draft.domino === ''}
      <section class="yesterday" aria-labelledby="{id}-yesterday">
        <h3 id="{id}-yesterday">Von gestern offen</h3>
        <p class="yesterday-text">{open}</p>
        <button type="button" class="button-line" onclick={adopt}>Übernehmen</button>
      </section>
    {/if}

    <div class="field">
      <label for="{id}-domino">Dein Big Domino</label>
      <textarea
        id="{id}-domino"
        rows="3"
        autocomplete="off"
        autocapitalize="sentences"
        enterkeyhint="done"
        placeholder="z. B. Konzept für Modul 3 skizzieren"
        aria-describedby="{id}-count"
        bind:this={area}
        value={morningUi.draft.domino}
        oninput={onInput}
        onkeydown={onKeydown}
      ></textarea>
      <p class="count" id="{id}-count">{count} / {DOMINO_MAX}</p>
    </div>
  </div>

  <div class="foot">
    <button type="button" class="button" disabled={!arming.armed} onclick={nextStep}>Weiter</button>
  </div>
</div>

<style>
  .hint {
    color: var(--text-muted);
    font-size: 0.875rem;
    line-height: 1.45;
  }

  /* Der Kasten: eine Fläche mit feiner Kante, der Text des gestrigen Big Dominos darin, lange Wörter brechen um. */
  .yesterday {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 14px 16px;
    border: 1px solid var(--surface-border);
    border-radius: 18px;
    background: var(--surface);
  }

  .yesterday h3 {
    color: var(--text-muted);
    font-family: var(--font-body), system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 0.8125rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .yesterday-text {
    font-weight: 700;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
</style>
