<script lang="ts">
  import Motiv from '../Motiv.svelte'
  import { morningCard, morningCount, morningCountLine, todayEntry } from '../../lib/morning/logic'
  import { stats, toggleDomino } from '../../lib/stats/store.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { morningUi, openMorning } from '../../lib/ui/morning-ui.svelte'
  import { startSprint } from '../../lib/ui/session-ui.svelte'
  import { appNow } from '../../lib/ui/tageszeit.svelte'

  // Die Morgen-Karte auf „Heute“ (Spec M10 §2.1): „Guten Morgen“ von 4:00 bis 10:59, solange es heute keinen Eintrag gibt,
  // und „Dein Tag“ vom Eintrag bis Mitternacht. Welche, entscheidet `morningCard`. „Jetzt“ ist die Zeit der App (`appNow`):
  // Sie rechnet mit jeder vollen Minute und bei der Rückkehr in die App neu, die Karte verschwindet also um 11:00 und mit
  // Mitternacht auch bei einer App, die im Speicher blieb. Das Abhaken und der Sprint-Start laufen im Tipp selbst.
  const id = $props.id()

  const view = $derived.by(() => {
    const now = appNow()
    const entries = stats.data.mornings ?? []
    return { kind: morningCard(entries, now), entry: todayEntry(entries, now), count: morningCount(entries, now) }
  })

  // Nur die Art der Karte, als eigener Wert: `view` ist bei jeder Änderung der Daten und mit jeder vollen Minute ein neues
  // Objekt, `kind` ändert sich nur, wenn die Karte wechselt. Davon hängt die Sperre unten ab.
  const kind = $derived(view.kind)
  const focus = $derived(stats.data.settings.focus)

  // Der Abhak-Knopf, „Sprint starten“ und „Kurz“/„Lang“ nehmen Tipps erst kurz nach dem Erscheinen an (siehe `tapArming`). Sie
  // erscheinen an der Stelle, an der eben noch ein anderer Knopf lag: Mit „Fertig“ im Abschluss des Ablaufs oder mit „Beenden“
  // in der Rückfrage schließt der Ablauf, und ein schneller zweiter Tipp träfe sonst, was darunter liegt (bei „Kurz“ und
  // „Lang“ öffnete er den Ablauf gleich wieder). Die Sperre beginnt darum neu, wenn die Karte wechselt (der Eintrag ist da)
  // und wenn der Ablauf öffnet oder schließt (`morningUi.open`).
  const arming = tapArming(() => `${kind}|${morningUi.open}`)

  // Im Tipp selbst, damit der Audio-Start als Nutzergeste gilt. Der Big Domino ist das Vorhaben des Sprints.
  function sprint(domino: string) {
    startSprint(focus.minutes, domino, focus.sound)
  }
</script>

{#if view.kind === 'guten-morgen'}
  <section class="card morning" aria-labelledby="{id}-title">
    <div class="head">
      <div class="text">
        <h2 class="kicker" id="{id}-title">Morgen-Start</h2>
        <p class="title">Starte wach in den Tag</p>
        <p class="sentence">Einchecken, aktivieren, ausrichten.</p>
      </div>
      <Motiv id="vorschlag-morgen" size={80} />
    </div>

    <!-- „Kurz“ gefüllt, „Lang“ umrandet; der Ablauf öffnet sich im Tipp selbst. -->
    <div class="actions">
      <button type="button" class="button" disabled={!arming.armed} onclick={() => openMorning('kurz')}>Kurz · 5 Min</button>
      <button type="button" class="button-line" disabled={!arming.armed} onclick={() => openMorning('lang')}>Lang · 15 Min</button>
    </div>
  </section>
{:else if view.kind === 'dein-tag' && view.entry}
  {@const entry = view.entry}
  <section class="card morning" aria-labelledby="{id}-title">
    <div class="top">
      <h2 class="kicker" id="{id}-title">Dein Tag</h2>
      <p class="count">{morningCountLine(view.count)}</p>
    </div>

    {#if entry.intention || entry.domino || entry.gratitude}
      {#if entry.intention}
        <div class="intention">
          <p class="small">Heute will ich sein:</p>
          <p class="word">{entry.intention}</p>
        </div>
      {/if}

      {#if entry.domino}
        {@const domino = entry.domino}
        {@const done = entry.dominoDone !== undefined}
        <div class="domino">
          <p class="label">Big Domino</p>
          <div class="domino-row">
            <!-- Umschalter: Ein Tipp setzt den Haken, ein zweiter nimmt ihn zurück. Die Fläche ist 44 px groß, der Kreis darin 26. -->
            <button
              type="button"
              class="tick"
              aria-label="Big Domino erledigt"
              aria-pressed={done}
              disabled={!arming.armed}
              onclick={() => toggleDomino(entry.day)}
            >
              <span class="circle" aria-hidden="true">
                {#if done}
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" focusable="false">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                {/if}
              </span>
            </button>
            <p class="domino-text" class:done>{domino}</p>
          </div>
          {#if !done}
            <button type="button" class="button start" disabled={!arming.armed} onclick={() => sprint(domino)}>
              Sprint starten · {focus.minutes} Min
            </button>
          {/if}
        </div>
      {/if}

      {#if entry.gratitude}
        <p class="gratitude">Dankbar für: {entry.gratitude}</p>
      {/if}
    {:else}
      <p class="sentence">Morgen-Start erledigt.</p>
    {/if}
  </section>
{/if}

<style>
  /* Hervorgehoben wie der Jetzt-Reset: Goldrand und ein Hauch Akzent auf der Karte. Beide Karten teilen sich das Aussehen. */
  .morning {
    width: 100%;
    gap: 14px;
    border-color: var(--gold-line-strong);
    background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 12%, transparent), color-mix(in srgb, var(--accent) 4%, transparent));
  }

  /* Kleine Überschrift in Versalien wie „Vorschlag des Tages“ und „Jetzt-Reset“; die Karte bleibt bei ihrer h2. */
  .kicker {
    color: var(--accent);
    font-family: var(--font-body), system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    line-height: 1.3;
    text-transform: uppercase;
  }

  .sentence {
    color: var(--text-muted);
    font-size: 0.9375rem;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  /* ── Guten Morgen ─────────────────────────────────────────────────────────────────────────────────────────── */

  /* Links Überschrift, Titel und Satz, rechts das Motiv (80 px); der Text bricht notfalls um, das Motiv behält seine Fläche. */
  .head {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
  }

  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .title {
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 1.375rem;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  /* Zwei Knöpfe nebeneinander, solange sie passen („Lang · 15 Min“ bricht nie in zwei Zeilen); bei großer Schrift und auf
     schmalem Telefon rutscht der zweite darunter. */
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    width: 100%;
  }

  .actions .button,
  .actions .button-line {
    flex: 1 1 8rem;
    min-width: 0;
    min-height: 52px;
    padding: 0 12px;
    white-space: nowrap;
  }

  /* ── Dein Tag ─────────────────────────────────────────────────────────────────────────────────────────────── */

  /* Oben die Überschrift, rechts klein die Zählung; wird es eng, rutscht die Zählung darunter. */
  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 4px 12px;
    width: 100%;
  }

  .count {
    color: var(--text-muted);
    font-size: 0.8125rem;
    line-height: 1.4;
  }

  .intention {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
  }

  .small {
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  /* Die Intention ist der Blickfang. Ein einziges langes Wort bricht im Wort um, statt aus der Karte zu laufen. */
  .word {
    color: var(--accent);
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 2rem;
    font-weight: 600;
    line-height: 1.1;
    overflow-wrap: anywhere;
  }

  /* Der Big Domino auf einer eigenen, dunkleren Fläche in der Karte. */
  .domino {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    padding: 14px;
    border-radius: 16px;
    background: color-mix(in srgb, var(--sky-top) 45%, transparent);
  }

  .label {
    color: var(--text-muted);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    line-height: 1.3;
    text-transform: uppercase;
  }

  .domino-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  /* Berührfläche 44 × 44; der sichtbare Kreis ist kleiner. Den Fokusring liefert die globale `:focus-visible`-Regel. */
  .tick {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin: 0 -9px 0 -9px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--on-accent);
  }

  .circle {
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: 26px;
    height: 26px;
    border: 2px solid var(--accent);
    border-radius: 50%;
  }

  /* Erledigt: Kreis gefüllt mit Haken (Zustand zusätzlich in `aria-pressed`). */
  .tick[aria-pressed='true'] .circle {
    background: var(--accent);
  }

  .tick svg {
    stroke: var(--on-accent);
  }

  .domino-text {
    flex: 1;
    min-width: 0;
    font-size: 1.0625rem;
    font-weight: 700;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  /* Erledigt: durchgestrichen und gedämpft (die gedämpfte Textfarbe hält ihren Kontrast). */
  .domino-text.done {
    color: var(--text-muted);
    font-weight: 600;
    text-decoration: line-through;
  }

  /* Der Sprint-Start: kann bei großer Schrift in zwei Zeilen umbrechen, statt aus dem Feld zu laufen. */
  .start {
    max-width: 100%;
    min-height: 48px;
    padding: 8px 22px;
    line-height: 1.25;
    text-align: center;
  }

  .gratitude {
    color: var(--text-muted);
    font-size: 0.9375rem;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
</style>
