<script lang="ts">
  import ChoiceGroup from '../components/ChoiceGroup.svelte'
  import Motiv from '../components/Motiv.svelte'
  import Waschung from '../components/Waschung.svelte'
  import { breathProgram } from '../lib/audio/program'
  import { BREATH_MINUTES, BREATH_PATTERNS, type BreathPatternId } from '../lib/breath/patterns'
  import { rhythmLabel, tileTitle } from '../lib/breath/view'
  import { breathMotiv } from '../lib/content/motive'
  import { atemWaschung, waschLage } from '../lib/content/waschungen'
  import { setLastUsed, stats } from '../lib/stats/store.svelte'
  import { startSession } from '../lib/ui/session-ui.svelte'

  const DURATIONS = BREATH_MINUTES.map((value) => ({ value, label: `${value} Min` }))

  let minutes = $state(3)

  // Im Tipp selbst, damit der Audio-Start als Nutzergeste gilt.
  function start(pattern: BreathPatternId) {
    setLastUsed({ kind: 'breath', pattern, minutes })
    startSession(breathProgram(pattern, minutes, { sound: stats.data.settings.breathSound }))
  }
</script>

<section class="screen">
  <header>
    <h1>Atmen</h1>
  </header>

  <div class="field">
    <span class="label" aria-hidden="true">Dauer</span>
    <ChoiceGroup label="Dauer" options={DURATIONS} value={minutes} onSelect={(value) => (minutes = value)} />
  </div>

  <!-- Die ganze Kachel ist der Knopf. Sein Name ist „{Titel} starten“, die Beschreibung steht daneben (unsichtbar)
       und wird von der Hilfstechnik zum Knopf vorgelesen; das Motiv ist Schmuck. Heißt der Titel schon wie der
       Rhythmus (4-7-8), steht der Rhythmus nicht noch einmal da. Die Waschung der Übung (Lage reihum) liegt als Zone
       neben dem Motiv, über dem Titel; sie ist ebenfalls Schmuck. -->
  <ul class="tiles" role="list">
    {#each BREATH_PATTERNS as pattern, i (pattern.id)}
      {@const rhythm = rhythmLabel(pattern)}
      <li>
        <button
          type="button"
          class="card tile"
          aria-label="{pattern.title} starten"
          aria-describedby="beschreibung-{pattern.id}"
          onclick={() => start(pattern.id)}
        >
          <Waschung farbe={atemWaschung(pattern.id)} lage={waschLage(i)} />
          <Motiv id={breathMotiv(pattern.id)} size={80} />
          <span class="title">{tileTitle(pattern.title)}</span>
          {#if rhythm !== pattern.title}
            <span class="rhythm">{rhythm}</span>
          {/if}
          <span class="effect">{pattern.effect}</span>
        </button>
        <span class="visually-hidden" id="beschreibung-{pattern.id}">{pattern.description}</span>
      </li>
    {/each}
  </ul>
</section>

<style>
  .field {
    /* Vier kurze Chips sollen auf Telefonbreite (auch 360 px) in eine Zeile passen: gleich breit, schmaler
       Innenabstand. Die Mindestbreite wächst mit der Schrift, bei großer Schrift brechen sie um. */
    --choice-min: 4.5rem;
    --choice-flex: 1 1 0;
    --choice-padding: 8px;

    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .label {
    color: var(--text-muted);
    font-size: 0.9375rem;
    font-weight: 600;
  }

  /* Zwei Spalten gleicher Breite; die beiden Kacheln einer Zeile sind gleich hoch (Gitterzellen strecken sich).
     `minmax(0, 1fr)`: Ein langes Wort weitet die Spalte nicht über den Bildschirm hinaus. */
  .tiles {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tiles li {
    position: relative;
    display: flex;
  }

  /* Die Kachel im Aussehen der Karte (`.card`), kompakter. Das Motiv steht oben am Anfang im Fluss und
     nicht in der Ecke: So stößt es nie an einen langen Titel. Die Waschung füllt die Ecke rechts daneben, bis zur
     Unterkante des Motivs (Innenabstand 16 + Motiv 80 = 96 px); der Titel beginnt darunter, bei jeder Schriftgröße. */
  .tile {
    --wash-w: calc(100% - 96px);
    --wash-h: 96px;
    position: relative;
    overflow: hidden;
    isolation: isolate;
    flex: 1;
    min-width: 0;
    gap: 4px;
    padding: 16px;
    border-radius: 24px;
    box-shadow: 0 10px 28px rgb(5 8 24 / 0.28);
    color: var(--text);
    text-align: left;
  }

  /* Inhalt über der Waschung */
  .tile > :global(:not(.waschung)) {
    position: relative;
    z-index: 1;
  }

  .tile:active {
    transform: scale(0.98);
  }

  .title {
    margin-top: 6px;
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 1.15rem;
    line-height: 1.2;
    letter-spacing: -0.01em;
    /* Umbruch nur an Leerzeichen, Bindestrichen und den weichen Trennstellen aus `tileTitle` (mit Trennstrich). */
    overflow-wrap: normal;
    hyphens: manual;
  }

  .rhythm {
    color: var(--text-muted);
    font-size: 0.9375rem;
    font-variant-numeric: tabular-nums;
    line-height: 1.4;
  }

  .effect {
    color: var(--accent);
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  @media (prefers-reduced-motion: no-preference) {
    .tile {
      transition: transform 0.15s ease;
    }
  }
</style>
