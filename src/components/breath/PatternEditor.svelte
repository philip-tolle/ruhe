<script lang="ts">
  // Editor eines eigenen Atemmusters (Spec M8 §4) als Blatt. Er arbeitet auf einer Kopie: Erst „Speichern“ ändert den
  // gespeicherten Stand; Zurück-Geste, Tippen daneben und Escape schließen ohne Speichern.
  import ConfirmDialog from '../ConfirmDialog.svelte'
  import Sheet from '../Sheet.svelte'
  import Stepper from '../Stepper.svelte'
  import {
    customTitle,
    cyclePreview,
    DEFAULT_PATTERN_NAME,
    defaultCustomPattern,
    MAX_NAME_LENGTH,
    newCustomPatternId,
    PHASE_FIELD_LABEL,
    PHASE_FIELDS,
    PHASE_LIMITS,
    secondsLabel,
    stepSeconds,
    type CustomBreathPattern,
    type PhaseField,
  } from '../../lib/breath/custom'
  import { deleteBreathPattern, saveBreathPattern } from '../../lib/stats/store.svelte'

  /** `pattern`: das zu bearbeitende Muster, `null` für ein neues. */
  let { pattern, onClose }: { pattern: CustomBreathPattern | null; onClose: () => void } = $props()

  // Die Kopie entsteht einmal beim Öffnen; spätere Änderungen von außen gelten erst beim nächsten Öffnen.
  // svelte-ignore state_referenced_locally
  let draft = $state<CustomBreathPattern>(pattern ? { ...pattern } : defaultCustomPattern(newCustomPatternId()))
  let confirming = $state(false)
  const nameId = $props.id()

  function step(field: PhaseField, direction: 1 | -1) {
    draft[field] = stepSeconds(field, draft[field], direction)
  }

  function save() {
    saveBreathPattern({ ...draft, name: draft.name.trim().slice(0, MAX_NAME_LENGTH) })
    onClose()
  }

  function remove() {
    deleteBreathPattern(draft.id)
    onClose()
  }
</script>

<Sheet title={pattern ? 'Muster bearbeiten' : 'Neues Muster'} {onClose}>
  <div class="name">
    <label for={nameId}>Name</label>
    <input
      id={nameId}
      type="text"
      maxlength={MAX_NAME_LENGTH}
      placeholder={DEFAULT_PATTERN_NAME}
      autocomplete="off"
      enterkeyhint="done"
      bind:value={draft.name}
    />
  </div>

  <div class="phases">
    {#each PHASE_FIELDS as field (field)}
      <Stepper
        label={PHASE_FIELD_LABEL[field]}
        valueText={secondsLabel(draft[field])}
        canDecrease={draft[field] > PHASE_LIMITS[field].min}
        canIncrease={draft[field] < PHASE_LIMITS[field].max}
        onDecrease={() => step(field, -1)}
        onIncrease={() => step(field, 1)}
      />
    {/each}
  </div>

  <p class="preview">{cyclePreview(draft)}</p>

  <div class="actions">
    <button type="button" class="button" onclick={save}>Speichern</button>
    {#if pattern}
      <button type="button" class="button-line" onclick={() => (confirming = true)}>Löschen</button>
    {/if}
  </div>
</Sheet>

{#if confirming && pattern}
  <ConfirmDialog
    title="Muster löschen?"
    text="„{customTitle(pattern)}“ verschwindet aus der Liste. Deine bisherigen Sitzungen bleiben in der Statistik."
    confirmLabel="Löschen"
    cancelLabel="Behalten"
    onConfirm={remove}
    onCancel={() => (confirming = false)}
  />
{/if}

<style>
  .name {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  label {
    color: var(--text-muted);
    font-size: 0.9375rem;
    font-weight: 600;
  }

  input {
    width: 100%;
    min-height: 52px;
    padding: 0 16px;
    border: 1px solid var(--surface-border);
    border-radius: 16px;
    background-color: var(--surface);
    color: var(--text);
    font: inherit;
  }

  input::placeholder {
    color: var(--text-muted);
  }

  .phases {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .preview {
    color: var(--text-muted);
    font-size: 0.9375rem;
  }

  /* Speichern und Löschen teilen sich die Zeile und rutschen untereinander, wenn es eng wird. */
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .actions > * {
    flex: 1 1 9rem;
  }
</style>
