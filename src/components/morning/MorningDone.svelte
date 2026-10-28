<script lang="ts">
  import Motiv from '../Motiv.svelte'
  import { todayEntry } from '../../lib/morning/logic'
  import { stats } from '../../lib/stats/store.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { closeMorning } from '../../lib/ui/morning-ui.svelte'
  import { startSprint } from '../../lib/ui/session-ui.svelte'
  import { appNow } from '../../lib/ui/tageszeit.svelte'

  // Der Abschluss (Spec M10 §2.3): Der Eintrag ist gespeichert (beim Erreichen des Abschlusses, `nextStep`), die Karte zeigt
  // nur die Angaben, die gesetzt sind. Mit Big Domino startet „Fokus-Sprint starten“ den Sprint mit den Einstellungen aus
  // `settings.focus` und dem Big Domino als Vorhaben; der Ablauf schließt vorher, im Tipp selbst (Autoplay-Regel). „Fertig“
  // schließt. Beide Knöpfe liegen an der Stelle des „Weiter“ des letzten Schritts (siehe `tapArming`).
  const arming = tapArming()

  const entry = $derived(todayEntry(stats.data.mornings ?? [], appNow()))
  const focus = $derived(stats.data.settings.focus)
  const domino = $derived(entry?.domino ?? null)

  function sprint() {
    if (domino === null) return
    closeMorning()
    startSprint(focus.minutes, domino, focus.sound)
  }
</script>

<div class="step">
  <div class="content">
    <header class="head centered">
      <Motiv id="vorschlag-morgen" size={96} />
      <p class="kicker">Geschafft</p>
      <h2 class="title" tabindex="-1" data-step-title>Dein Tag</h2>
    </header>

    <div class="card entry">
      {#if entry && (entry.intention || entry.domino || entry.gratitude || entry.value)}
        <dl>
          {#if entry.intention}
            <div class="item">
              <dt>Heute will ich sein:</dt>
              <dd class="word">{entry.intention}</dd>
            </div>
          {/if}
          {#if entry.domino}
            <div class="item">
              <dt class="label">Big Domino</dt>
              <dd class="domino">{entry.domino}</dd>
            </div>
          {/if}
          {#if entry.gratitude}
            <div class="item">
              <dt class="label">Dankbar für</dt>
              <dd>{entry.gratitude}</dd>
            </div>
          {/if}
          {#if entry.value}
            <div class="item">
              <dt class="label">Wert des Tages</dt>
              <dd>{entry.value}</dd>
            </div>
          {/if}
        </dl>
      {:else}
        <p>Morgen-Start erledigt.</p>
      {/if}
    </div>
  </div>

  <div class="foot">
    {#if domino !== null}
      <button type="button" class="button" disabled={!arming.armed} onclick={sprint}>Fokus-Sprint starten · {focus.minutes} Min</button>
    {/if}
    <button type="button" class="button-line" disabled={!arming.armed} onclick={closeMorning}>Fertig</button>
  </div>
</div>

<style>
  .centered {
    align-items: center;
    text-align: center;
  }

  /* Die Karte trägt den stärkeren Goldrand: Sie ist das Ergebnis. */
  .entry {
    width: 100%;
    gap: 14px;
    padding: 18px;
    border-color: var(--gold-line-strong);
    border-radius: 22px;
  }

  dl {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    margin: 0;
  }

  .item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  dt {
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  dt.label {
    font-size: 0.8125rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  dd {
    margin: 0;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .word {
    color: var(--accent);
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 1.875rem;
    line-height: 1.15;
  }

  .domino {
    font-size: 1.0625rem;
    font-weight: 700;
    line-height: 1.3;
  }
</style>
