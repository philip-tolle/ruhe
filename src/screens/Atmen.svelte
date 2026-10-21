<script lang="ts">
  import ChoiceGroup from '../components/ChoiceGroup.svelte'
  import { breathProgram } from '../lib/audio/program'
  import { BREATH_MINUTES, BREATH_PATTERNS, type BreathPatternId } from '../lib/breath/patterns'
  import { setLastUsed } from '../lib/stats/store.svelte'
  import { startSession } from '../lib/ui/session-ui.svelte'

  const DURATIONS = BREATH_MINUTES.map((value) => ({ value, label: `${value} Min` }))

  let minutes = $state(3)

  // Im Tipp selbst, damit der Audio-Start als Nutzergeste gilt.
  function start(pattern: BreathPatternId) {
    setLastUsed({ kind: 'breath', pattern, minutes })
    startSession(breathProgram(pattern, minutes))
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

  {#each BREATH_PATTERNS as pattern (pattern.id)}
    <div class="card">
      <h2>{pattern.title}</h2>
      <p class="hint">{pattern.description}</p>
      <button type="button" class="button" aria-label="{pattern.title} starten" onclick={() => start(pattern.id)}>
        Starten
      </button>
    </div>
  {/each}
</section>

<style>
  .field {
    /* Vier kurze Chips sollen auf Telefonbreite in eine Zeile passen. */
    --choice-min: 4.5rem;

    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .label,
  .hint {
    color: var(--text-muted);
  }

  .label {
    font-size: 0.9375rem;
    font-weight: 600;
  }
</style>
