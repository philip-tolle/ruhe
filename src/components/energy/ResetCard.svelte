<script lang="ts">
  import Motiv from '../Motiv.svelte'
  import { areaMotiv } from '../../lib/content/motive'
  import { AREAS, AREA_INFO, type EnergyArea } from '../../lib/energy/areas'
  import { areaLine, resetPick } from '../../lib/energy/hack-view'
  import { freshCheckin, weakestArea, whatWorks } from '../../lib/energy/insights'
  import { resetSequence } from '../../lib/energy/reset'
  import { stats } from '../../lib/stats/store.svelte'
  import { energyUi, openHackCard } from '../../lib/ui/energy-ui.svelte'

  // Jetzt-Reset (Spec M9 §3.2, §6.7): ein Vorschlag, was dem schwächsten Bereich jetzt hilft. Mit frischem Check-in ist
  // das der niedrigste Bereich („Dein Geist ist gerade am niedrigsten.“); sonst wählt die Person den Bereich. „Anderer“
  // geht in der Folge weiter, auch in den nächsten Bereich; der Satz oben bleibt dabei, denn er nennt, was am niedrigsten
  // ist, nicht, woher der Vorschlag kommt. „Starten“ öffnet die Hack-Karte; gestartet wird erst dort.
  //
  // „Jetzt“ ist wie auf „Heute“ und „Ich“ die Zeit beim Berechnen: neu bei jeder Änderung der Daten und beim Öffnen des
  // Reiters (Zeitfenster der Hacks, Frische des Check-ins), keine tickende Uhr.
  const view = $derived.by(() => {
    const now = new Date()
    const levels = freshCheckin(stats.data.energyCheckins ?? [], now)?.levels ?? null
    const start = energyUi.resetStart
    // Ohne Grundlage (weder Check-in noch gewählter Bereich) gibt es noch nichts vorzuschlagen.
    const sequence = levels || start ? resetSequence(levels, start ?? 'koerper', stats.data.hackRuns ?? [], now) : []
    return { levels, start, sequence }
  })

  // Die Folge kann leer sein; dann zeigt die Karte nur den Satz bzw. die Bereichswahl.
  const pick = $derived(resetPick(view.sequence, energyUi.resetSkip))
  const works = $derived(new Set(whatWorks(stats.data.hackRuns ?? []).map(({ hack }) => hack.id)))

  // Eine neue Wahl ist eine neue Grundlage: Die Vorschläge fangen von vorn an. (Ein neuer Check-in tut dasselbe im Blatt.)
  function choose(area: EnergyArea) {
    energyUi.resetStart = area
    energyUi.resetSkip = 0
  }
</script>

<section class="card reset" aria-labelledby="reset-title">
  <h2 class="kicker" id="reset-title">Jetzt-Reset</h2>

  {#if view.levels}
    <p class="ask">Dein {AREA_INFO[weakestArea(view.levels)].title} ist gerade am niedrigsten.</p>
  {:else}
    <p class="ask" id="reset-ask">Was braucht gerade Energie?</p>
    <div class="areas" role="group" aria-labelledby="reset-ask">
      {#each AREAS as area (area)}
        <button
          type="button"
          class="area"
          aria-pressed={view.start === area}
          style:--area="var(--area-{area})"
          style:--area-text="var(--area-{area}-text)"
          onclick={() => choose(area)}
        >
          {AREA_INFO[area].title}
        </button>
      {/each}
    </div>
  {/if}

  {#if pick}
    {@const { hack } = pick}
    <!-- Wechselt der Vorschlag mit „Anderer“, sagt Hilfstechnik ihn an (der Fokus bleibt auf dem Knopf). -->
    <div class="pick" aria-live="polite" style:--area-text="var(--area-{hack.area}-text)">
      <Motiv id={areaMotiv(hack.area)} size={72} />
      <div class="pick-text">
        <p class="name">{hack.title}</p>
        <p class="meta">
          <span class="line">{areaLine(hack)}</span>
          {#if works.has(hack.id)}<span class="works">wirkt bei dir</span>{/if}
        </p>
      </div>
    </div>

    <div class="actions">
      <button type="button" class="button start" onclick={() => openHackCard(hack.id)}>Starten</button>
      {#if view.sequence.length > 1}
        <button type="button" class="button-line other" onclick={() => (energyUi.resetSkip += 1)}>Anderer</button>
      {/if}
    </div>
  {/if}
</section>

<style>
  /* Hervorgehoben: Goldrand und ein Hauch Akzent auf der Karte. Die Fläche bleibt so hell wie die der anderen Karten
     oder dunkler, damit die Bereichsfarben als Schrift ihren Kontrast behalten. */
  .reset {
    width: 100%;
    gap: 14px;
    border-color: var(--gold-line-strong);
    background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 12%, transparent), color-mix(in srgb, var(--accent) 4%, transparent));
  }

  /* Kleine Überschrift in Versalien wie „Vorschlag des Tages“ auf „Heute“; die Karte bleibt bei ihrer h2. */
  .kicker {
    color: var(--accent);
    font-family: var(--font-body), system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    line-height: 1.3;
    text-transform: uppercase;
  }

  .ask {
    color: var(--text-muted);
    font-size: 0.9375rem;
    line-height: 1.4;
  }

  /* Vier Bereiche zum Wählen: nebeneinander, solange sie passen, sonst in zwei Reihen. */
  .areas {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(4.75rem, 1fr));
    gap: 8px;
    width: 100%;
  }

  .area {
    min-height: 48px;
    padding: 0 8px;
    border: 1px solid var(--area);
    border-radius: 999px;
    background: var(--sky-mid);
    color: var(--area-text);
    font-weight: 700;
  }

  /* Gewählt: Fläche in der Bereichsfarbe und stärkerer Rand; der Zustand steht zusätzlich in `aria-pressed`. */
  .area[aria-pressed='true'] {
    border-width: 2px;
    background: color-mix(in srgb, var(--area) 18%, var(--sky-mid));
  }

  .pick {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
  }

  .pick-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .name {
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 1.375rem;
    line-height: 1.2;
    overflow-wrap: anywhere;
    hyphens: auto;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.4em;
    color: var(--area-text);
    font-size: 0.875rem;
    font-weight: 700;
    line-height: 1.4;
  }

  .works::before {
    content: '· ';
  }

  .actions {
    display: flex;
    gap: 10px;
    width: 100%;
  }

  .start {
    flex: 2 1 0;
    min-width: 0;
  }

  .other {
    flex: 1.4 1 0;
    min-width: 0;
  }
</style>
