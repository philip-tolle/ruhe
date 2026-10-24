<script lang="ts">
  import ChoiceGroup from '../components/ChoiceGroup.svelte'
  import Motiv from '../components/Motiv.svelte'
  import SoundSelect from '../components/SoundSelect.svelte'
  import Waschung from '../components/Waschung.svelte'
  import PatternEditor from '../components/breath/PatternEditor.svelte'
  import { breathProgram } from '../lib/audio/program'
  import { customToPattern, MAX_CUSTOM_PATTERNS, type CustomBreathPattern } from '../lib/breath/custom'
  import { BREATH_MINUTES, BREATH_PATTERNS, type BreathPattern } from '../lib/breath/patterns'
  import { rhythmLabel, tileTitle } from '../lib/breath/view'
  import { breathMotiv } from '../lib/content/motive'
  import { atemWaschung, waschLage } from '../lib/content/waschungen'
  import { setLastUsed, stats, updateSettings } from '../lib/stats/store.svelte'
  import { startSession } from '../lib/ui/session-ui.svelte'

  const DURATIONS = BREATH_MINUTES.map((value) => ({ value, label: `${value} Min` }))

  let minutes = $state(3)
  const settings = $derived(stats.data.settings)
  const own = $derived((stats.data.breathPatterns ?? []).map((custom) => ({ custom, pattern: customToPattern(custom) })))

  // Der Editor: `null` geschlossen, `{ pattern: null }` für ein neues Muster.
  let editing = $state<{ pattern: CustomBreathPattern | null } | null>(null)

  // Im Tipp selbst, damit der Audio-Start als Nutzergeste gilt.
  function start(pattern: BreathPattern) {
    setLastUsed({ kind: 'breath', pattern: pattern.id, minutes })
    startSession(breathProgram(pattern, minutes, { sound: settings.breathSound, background: settings.breathBackground }))
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

  <!-- Gilt für alle Übungen und bleibt gemerkt, auch für die Atemübung auf „Heute“. -->
  <div class="field">
    <span class="label" aria-hidden="true">Hintergrundklang</span>
    <SoundSelect
      label="Hintergrundklang"
      bind:value={() => settings.breathBackground, (breathBackground) => updateSettings({ breathBackground })}
    />
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
          onclick={() => start(pattern)}
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

  <!-- Eigene Muster (Spec M8 §3): je Muster eine Zeile. Die Zeile ist der Startknopf, ihre Beschreibung steht darin und
       wird zum Knopf vorgelesen; der Stift daneben öffnet den Editor. -->
  <section class="own" aria-labelledby="own-title">
    <div>
      <h2 id="own-title">Eigene Muster</h2>
      <span class="rule" aria-hidden="true"></span>
    </div>

    <div class="card own-card">
      {#if own.length === 0}
        <p class="hint">Stell dir deinen eigenen Rhythmus zusammen.</p>
      {:else}
        <ul class="rows" role="list">
          {#each own as { custom, pattern } (custom.id)}
            <li>
              <button
                type="button"
                class="row"
                aria-label="{pattern.title} starten"
                aria-describedby="eigen-{custom.id}"
                onclick={() => start(pattern)}
              >
                <span class="row-title">{pattern.title}</span>
                <span class="row-subtitle" id="eigen-{custom.id}">{pattern.description}</span>
              </button>
              <button type="button" class="edit" aria-label="{pattern.title} bearbeiten" onclick={() => (editing = { pattern: custom })}>
                <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20">
                  <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
                </svg>
              </button>
            </li>
          {/each}
        </ul>
      {/if}

      {#if own.length < MAX_CUSTOM_PATTERNS}
        <button type="button" class="button-line" onclick={() => (editing = { pattern: null })}>Neues Muster</button>
      {:else}
        <p class="hint">Höchstens {MAX_CUSTOM_PATTERNS} eigene Muster.</p>
      {/if}
    </div>
  </section>
</section>

<!-- Außerhalb von .screen, dessen Einblend-Animation sonst den Bezugsrahmen für `fixed` stellte. -->
{#if editing}
  <PatternEditor pattern={editing.pattern} onClose={() => (editing = null)} />
{/if}

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

  .own {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .own-card {
    gap: 16px;
  }

  .hint {
    color: var(--text-muted);
  }

  /* Zeilen ohne eigene Fläche, über jeder eine feine Goldlinie (wie die Aktivitäten auf „Heute“). */
  .rows {
    width: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .rows li {
    display: flex;
    align-items: center;
    gap: 8px;
    border-top: 1px solid rgb(233 196 142 / 0.28);
  }

  .rows li:first-child {
    border-top: 0;
  }

  .row {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    min-height: 72px;
    margin-left: -8px;
    padding: 10px 8px;
    border: 0;
    border-radius: 18px;
    background: none;
    color: var(--text);
    text-align: left;
    justify-content: center;
  }

  .row:active {
    background: var(--surface);
  }

  .row-title {
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 1.125rem;
    line-height: 1.3;
    overflow-wrap: anywhere;
    hyphens: auto;
  }

  .row-subtitle {
    color: var(--text-muted);
    font-size: 0.9375rem;
    line-height: 1.4;
  }

  .edit {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    padding: 0;
    border: 1px solid var(--surface-border);
    border-radius: 50%;
    background: var(--surface);
    color: var(--text);
  }

  .edit svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  @media (prefers-reduced-motion: no-preference) {
    .tile {
      transition: transform 0.15s ease;
    }
  }
</style>
