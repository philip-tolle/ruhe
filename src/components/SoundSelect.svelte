<script lang="ts">
  // Auswahl des Hintergrundklangs („Keiner“ oder einer der acht Klänge). Der Timer-Sheet, der
  // Reiter „Ich“ und der Player geführter Meditationen teilen sich Liste und Aussehen.
  import { SOUNDS, type BackgroundId } from '../lib/sounds/catalog'

  let {
    label,
    value = $bindable(),
    disabled = false,
  }: { label: string; value: BackgroundId | null; disabled?: boolean } = $props()
</script>

<select aria-label={label} bind:value {disabled}>
  <option value={null}>Keiner</option>
  {#each SOUNDS as item (item.id)}
    <option value={item.id}>{item.title}</option>
  {/each}
</select>

<style>
  /* Eigener Pfeil statt des Systempfeils, damit die Auswahl zu den übrigen Feldern passt. */
  select {
    width: 100%;
    min-height: 52px;
    padding: 0 48px 0 16px;
    border: 1px solid var(--surface-border);
    border-radius: 16px;
    background-color: var(--surface);
    color: var(--text);
    font: inherit;
    font-weight: 600;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a9afcb' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-position: right 16px center;
    background-repeat: no-repeat;
    background-size: 20px;
  }
</style>
