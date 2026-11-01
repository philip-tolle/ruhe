<script lang="ts">
  import ChoiceGroup from '../ChoiceGroup.svelte'
  import { stats } from '../../lib/stats/store.svelte'
  import { eveningUi } from '../../lib/ui/evening-ui.svelte'

  // Das Wachstumsfeld zum 1-%-Satz (Spec M12 §2.6): nur mit Feldern, je Feld ein Chip mit dem Namen in der Reihenfolge der
  // Sammlung. Kein Chip ist vorgewählt; ein Tipp wählt, ein zweiter nimmt zurück; Pfeiltasten wählen nur ein anderes Feld
  // (Tastenschutz in `ChoiceGroup`). Die sichtbare Beschriftung ist zugleich der Name der Radiogruppe und darum für
  // Hilfstechnik verborgen. Gespeichert wird das Feld nur zusammen mit einem Satz (`withEvening`).
  const options = $derived(
    (stats.data.collection ?? []).filter((item) => item.kind === 'feld').map((item): { value: string | null; label: string } => ({ value: item.id, label: item.text })),
  )

  function select(id: string | null) {
    eveningUi.draft.growthField = eveningUi.draft.growthField === id ? null : id
  }
</script>

{#if options.length > 0}
  <div class="fields">
    <span class="label" aria-hidden="true">Wachstumsfeld (freiwillig)</span>
    <ChoiceGroup label="Wachstumsfeld (freiwillig)" {options} value={eveningUi.draft.growthField} onSelect={select} />
  </div>
{/if}

<style>
  .fields {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  .label {
    color: var(--text-muted);
    font-size: 0.9375rem;
    font-weight: 600;
  }
</style>
