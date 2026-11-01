<script lang="ts">
  import { tick } from 'svelte'
  import ConfirmDialog from '../ConfirmDialog.svelte'
  import Sheet from '../Sheet.svelte'
  import { limitedInput } from '../../lib/morning/limited-input'
  import type { CollectionItem } from '../../lib/principles/collection'
  import { nextWeekPrinciple, sameText, weekAnchor } from '../../lib/principles/logic'
  import {
    FIELD_NAME_MAX,
    IF_THEN_MAX,
    INSIGHT_MAX,
    LEITSATZ_MAX,
    NOTE_MAX,
    SOURCE_MAX,
    STEP_MAX,
    type CollectionKind,
  } from '../../lib/principles/words'
  import { deleteCollectionItem, saveCollectionItem, stats } from '../../lib/stats/store.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { appNow } from '../../lib/ui/tageszeit.svelte'

  // Editor eines Eintrags der Sammlung (Spec M12 §2.4) als Blatt, für alle drei Arten. Er arbeitet auf einer Kopie (wie der
  // Editor eigener Atemmuster): Nur „Speichern“ schreibt, mit einem `commit`; Zurück-Geste, Escape und Danebentippen verwerfen
  // ohne Rückfrage. Pflicht ist je Art genau ein Feld; alle Felder laufen über `limitedInput` (Code-Punkte, nie `maxlength`).
  /** `item`: der zu bearbeitende Eintrag, `null` für einen neuen. */
  let { kind, item, onClose }: { kind: CollectionKind; item: CollectionItem | null; onClose: () => void } = $props()

  type FieldKey = 'text' | 'note' | 'ifThen' | 'source' | 'step'

  interface Field {
    key: FieldKey
    label: string
    placeholder: string
    max: number
    multiline: boolean
  }

  interface Form {
    add: string
    edit: string
    line: string
    confirmTitle: string
    fields: readonly Field[]
  }

  const FORMS: Readonly<Record<CollectionKind, Form>> = {
    prinzip: {
      add: 'Neues Prinzip',
      edit: 'Prinzip bearbeiten',
      line: 'Kurz und als Richtung, nicht als strenge Regel.',
      confirmTitle: 'Prinzip löschen?',
      fields: [
        { key: 'text', label: 'Leitsatz', placeholder: 'z. B. Mehrweg statt Einweg', max: LEITSATZ_MAX, multiline: false },
        { key: 'note', label: 'Was heißt das für dich? (freiwillig)', placeholder: 'z. B. Dann fällt weniger Müll an.', max: NOTE_MAX, multiline: true },
        { key: 'ifThen', label: 'Wenn-dann (freiwillig)', placeholder: 'z. B. Wenn ich einkaufen gehe, dann nehme ich eine Stofftasche mit.', max: IF_THEN_MAX, multiline: true },
      ],
    },
    erkenntnis: {
      add: 'Neue Erkenntnis',
      edit: 'Erkenntnis bearbeiten',
      line: 'Am besten in deinen eigenen Worten, so bleibt sie leichter hängen.',
      confirmTitle: 'Erkenntnis löschen?',
      fields: [
        { key: 'text', label: 'Erkenntnis', placeholder: 'z. B. Wer im Schach früh die Mitte besetzt, hat mehr Möglichkeiten.', max: INSIGHT_MAX, multiline: true },
        { key: 'source', label: 'Quelle (freiwillig)', placeholder: 'z. B. Buchtitel, Autorin', max: SOURCE_MAX, multiline: false },
      ],
    },
    feld: {
      add: 'Neues Wachstumsfeld',
      edit: 'Wachstumsfeld bearbeiten',
      line: 'Etwas, woran du bewusst arbeitest, oder etwas, das du lernen willst.',
      confirmTitle: 'Wachstumsfeld löschen?',
      fields: [
        { key: 'text', label: 'Name', placeholder: 'z. B. Schach lernen', max: FIELD_NAME_MAX, multiline: false },
        { key: 'step', label: 'Nächster kleiner Schritt (freiwillig)', placeholder: 'z. B. Jeden Abend eine Eröffnung nachspielen.', max: STEP_MAX, multiline: true },
      ],
    },
  }

  const id = $props.id()
  // Art und Eintrag stehen beim Öffnen fest; ein anderer Eintrag öffnet einen neuen Editor.
  // svelte-ignore state_referenced_locally
  const form = FORMS[kind]

  // Die Kopie entsteht einmal beim Öffnen; spätere Änderungen von außen gelten erst beim nächsten Öffnen.
  // svelte-ignore state_referenced_locally
  let draft = $state<Record<FieldKey, string>>({
    text: item?.text ?? '',
    note: item?.note ?? '',
    ifThen: item?.ifThen ?? '',
    source: item?.source ?? '',
    step: item?.step ?? '',
  })
  let confirming = $state(false)
  let removeButton = $state<HTMLButtonElement>()

  // Eine Sperre für „Speichern“, „Löschen“ und das „Löschen“ der Rückfrage (Spec M12 §2.10): Sie beginnt beim Öffnen und
  // beim Öffnen und Schließen der Rückfrage. Sie sperrt nur Tipps, die Knöpfe bleiben fokussierbar.
  const arming = tapArming(() => confirming)

  /** Ein geänderter Text, der schon bei einem anderen Eintrag derselben Art steht; ein unveränderter sperrt nie. */
  const duplicate = $derived(sameText(stats.data.collection ?? [], kind, draft.text, item?.text ?? ''))
  const blocked = $derived(draft.text.trim() === '' || duplicate)

  // Der Zusatz der Rückfrage für ein Prinzip (Spec M12 §4.7): geltendes Prinzip der Woche oder Wahl für die neue Woche.
  const addition = $derived.by(() => {
    if (kind !== 'prinzip' || !item) return ''
    const now = appNow()
    const anchor = weekAnchor(stats.data.evenings ?? [], stats.data.collection ?? [], now)
    const next = nextWeekPrinciple(stats.data.evenings ?? [], now)
    if (anchor?.kind === 'prinzip' && anchor.item.id === item.id)
      return next !== null && next !== item.id ? ' Es ist gerade dein Prinzip der Woche.' : ' Es ist gerade dein Prinzip der Woche. Bis du sonntags ein neues wählst, steht keines da.'
    return next === item.id ? ' Es ist dein Prinzip für die neue Woche. Ab Montag steht dann keines da.' : ''
  })

  /** Der Text der Rückfrage nennt den gespeicherten Text, nicht den Entwurf. */
  function confirmText(saved: CollectionItem): string {
    if (saved.kind === 'erkenntnis') return 'Sie verschwindet aus deiner Sammlung.'
    if (saved.kind === 'feld') return `„${saved.text}“ verschwindet aus deiner Sammlung. Deine Sätze im Logbuch bleiben, nur die Zuordnung entfällt.`
    return `„${saved.text}“ verschwindet aus deiner Sammlung.${addition}`
  }

  const count = (key: FieldKey) => Array.from(draft[key]).length

  function describedBy(field: Field): string {
    return field.key === 'text' && duplicate ? `${id}-${field.key}-count ${id}-duplicate` : `${id}-${field.key}-count`
  }

  // „Return“ in einem Feld schließt die Tastatur und gibt den Fokus an das Blatt, damit Escape weiter dort ankommt.
  function focusDialog() {
    document.activeElement?.closest<HTMLElement>('[role="dialog"]')?.focus()
  }

  function save() {
    if (!arming.armed || blocked) return
    saveCollectionItem({ ...(item ? { id: item.id } : {}), kind, ...draft })
    onClose()
  }

  function askRemove() {
    if (arming.armed) confirming = true
  }

  function remove() {
    if (!arming.armed || !item) return
    deleteCollectionItem(item.id)
    onClose()
  }

  // Die Rückfrage schließt ohne Löschen: Fokus an „Löschen“ im Editor, nach `tick()` (mit `.then`, siehe `CollectionSheet`).
  function keep() {
    confirming = false
    void tick().then(() => removeButton?.focus())
  }
</script>

<Sheet title={item ? form.edit : form.add} rearm={() => confirming} {onClose}>
  <p class="line">{form.line}</p>

  {#each form.fields as field (field.key)}
    <div class="field">
      <label for="{id}-{field.key}">{field.label}</label>
      {#if field.multiline}
        <textarea
          id="{id}-{field.key}"
          rows="3"
          autocomplete="off"
          autocapitalize="sentences"
          enterkeyhint="done"
          placeholder={field.placeholder}
          aria-describedby={describedBy(field)}
          value={draft[field.key]}
          use:limitedInput={{ max: field.max, onChange: (value) => (draft[field.key] = value), onEnter: focusDialog }}
        ></textarea>
      {:else}
        <input
          id="{id}-{field.key}"
          type="text"
          autocomplete="off"
          autocapitalize="sentences"
          enterkeyhint="done"
          placeholder={field.placeholder}
          aria-describedby={describedBy(field)}
          value={draft[field.key]}
          use:limitedInput={{ max: field.max, onChange: (value) => (draft[field.key] = value), onEnter: focusDialog }}
        />
      {/if}
      <p class="count" id="{id}-{field.key}-count">{count(field.key)} / {field.max}</p>
      {#if field.key === 'text' && duplicate}
        <p class="duplicate" id="{id}-duplicate">Das steht schon in deiner Sammlung.</p>
      {/if}
    </div>
  {/each}

  <!-- Speichern und Löschen teilen sich die Zeile und rutschen untereinander, wenn es eng wird. Diese Lage braucht der Schutz
       vor Doppeltipps: „Behalten“ der Rückfrage liegt dann über „Speichern“, ihr „Löschen“ über dem des Editors. -->
  <div class="actions">
    <button type="button" class="button" disabled={blocked} aria-describedby={duplicate ? `${id}-duplicate` : undefined} onclick={save}>Speichern</button>
    {#if item}
      <button type="button" class="button-line" bind:this={removeButton} onclick={askRemove}>Löschen</button>
    {/if}
  </div>
</Sheet>

{#if confirming && item}
  <ConfirmDialog title={form.confirmTitle} text={confirmText(item)} confirmLabel="Löschen" cancelLabel="Behalten" onConfirm={remove} onCancel={keep} />
{/if}

<style>
  .line {
    color: var(--text-muted);
    overflow-wrap: anywhere;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  label {
    color: var(--text-muted);
    font-size: 0.9375rem;
    font-weight: 600;
  }

  input,
  textarea {
    width: 100%;
    min-height: 52px;
    padding: 0 16px;
    border: 1px solid var(--surface-border);
    border-radius: 16px;
    background-color: var(--surface);
    color: var(--text);
    font: inherit;
    overflow-wrap: anywhere;
  }

  textarea {
    padding: 14px 16px;
    line-height: 1.45;
    resize: vertical;
  }

  input::placeholder,
  textarea::placeholder {
    color: var(--text-muted);
  }

  .count {
    align-self: flex-end;
    color: var(--text-muted);
    font-size: 0.8125rem;
  }

  .duplicate {
    color: var(--text);
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .actions > * {
    flex: 1 1 9rem;
  }
</style>
