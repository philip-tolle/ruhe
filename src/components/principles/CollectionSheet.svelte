<script lang="ts">
  import { tick } from 'svelte'
  import Sheet from '../Sheet.svelte'
  import ItemEditor from './ItemEditor.svelte'
  import PasteSheet from './PasteSheet.svelte'
  import type { CollectionItem } from '../../lib/principles/collection'
  import { KIND_MAX, type CollectionKind } from '../../lib/principles/words'
  import { stats } from '../../lib/stats/store.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'

  // Blatt „Deine Sammlung“ (Spec M12 §2.3, §2.10): drei Abschnitte in fester Reihenfolge, je mit h3, Knopf zum Anlegen (an der
  // Grenze ein Satz) und den Zeilen aller Einträge der Art in Listenfolge, auch über der Grenze (nach einem Import). Der Editor
  // und „Notizen einfügen“ (Spec M12 §2.5) sind eigene Blätter als Geschwister dahinter; schließt eines, geht der Fokus an die
  // auslösende Zeile bzw. den Knopf, gibt es sie nicht mehr, an die h3 des Abschnitts.
  let { onClose }: { onClose: () => void } = $props()

  const id = $props.id()

  interface Section {
    kind: CollectionKind
    title: string
    add: string
    limit: string
    empty: string
  }

  const SECTIONS: readonly Section[] = [
    {
      kind: 'prinzip',
      title: 'Prinzipien',
      add: 'Neues Prinzip',
      limit: 'Höchstens 12 Prinzipien.',
      empty: 'Kurze Leitsätze, die dir Richtung geben, gern mit Wenn-dann. Sonntags kannst du eines als Prinzip der Woche wählen.',
    },
    {
      kind: 'feld',
      title: 'Wachstumsfelder',
      add: 'Neues Wachstumsfeld',
      limit: 'Höchstens 3 Wachstumsfelder.',
      empty: 'Etwas, woran du bewusst arbeitest, oder etwas, das du lernen willst. Abends kannst du deinen Vorsatz für morgen einem Feld zuordnen.',
    },
    {
      kind: 'erkenntnis',
      title: 'Erkenntnisse',
      add: 'Neue Erkenntnis',
      limit: 'Höchstens 300 Erkenntnisse.',
      empty: 'Was du aus Büchern und Erfahrungen mitnimmst, am besten in deinen Worten. Jeden Tag steht eine davon auf der Karte.',
    },
  ]

  /** Der offene Editor: Art und Eintrag (`null` = neu). */
  let editing = $state<{ kind: CollectionKind; item: CollectionItem | null } | null>(null)
  /** „Notizen einfügen“ ist offen. */
  let pasting = $state(false)
  /** Die Statuszeile der Erkenntnisse; leert sich, sobald eine Ebene über der Sammlung öffnet. */
  let status = $state('')
  /** Wohin der Fokus geht, wenn die Ebene darüber schließt. */
  let returnTo: { el: HTMLElement; kind: CollectionKind } | null = null

  // Knöpfe, Zeilen und das Danebentippen sind kurz nach dem Öffnen gesperrt und neu, wenn Editor oder Einfügen öffnen oder
  // schließen (Spec M12 §2.10). Die Sperre gilt nur für Tipps; Knöpfe und Zeilen bleiben fokussierbar.
  const top = () => editing === null && !pasting
  const arming = tapArming(top)

  const items = $derived(stats.data.collection ?? [])

  function ofKind(kind: CollectionKind): CollectionItem[] {
    return items.filter((item) => item.kind === kind)
  }

  /** Die leise Zeile einer Zeile, zugleich ihre Beschreibung. */
  function subtitle(item: CollectionItem): string | undefined {
    if (item.kind === 'prinzip') return item.ifThen ?? item.note
    if (item.kind === 'feld') return item.step ? `Nächster kleiner Schritt: ${item.step}` : undefined
    return item.source ? `Quelle: ${item.source}` : undefined
  }

  // Nur, wenn die Sammlung oben liegt: Bei offenem Editor oder Einfügen bleiben Zeilen und Knöpfe darunter per Tastatur
  // erreichbar (Blätter fangen den Fokus nicht). Ein zweiter Editor hängte den offenen still auf einen anderen Eintrag um,
  // und „Speichern“ oder „Löschen“ träfe dann den falschen.
  function openEditor(kind: CollectionKind, item: CollectionItem | null, el: HTMLElement) {
    if (!arming.armed || !top()) return
    status = ''
    returnTo = { el, kind }
    editing = { kind, item }
  }

  function closeEditor() {
    editing = null
    void restoreFocus()
  }

  function openPaste(el: HTMLElement) {
    if (!arming.armed || !top()) return
    status = ''
    returnTo = { el, kind: 'erkenntnis' }
    pasting = true
  }

  /** `added`: übernommene Erkenntnisse, 0 beim Abbrechen; dann bleibt die Statuszeile leer. */
  function closePaste(added: number) {
    pasting = false
    if (added > 0) status = added === 1 ? '1 Erkenntnis übernommen.' : `${added} Erkenntnisse übernommen.`
    void restoreFocus()
  }

  /**
   * Nach `tick()` an das gemerkte Ziel, wenn es noch im Dokument steht, sonst an die h3 seines Abschnitts; nie an `body`.
   * Mit `.then` statt `await`: Im Entwicklungs-Build umhüllt Svelte jedes `await` in Komponenten (Warnung bei verlorener
   * Reaktivität) und braucht dafür einen Mikrotask mehr; so steht der Fokus nach einem `tick()` fest, wie im fertigen Build.
   */
  function restoreFocus(): Promise<void> {
    return tick().then(() => {
      const target = returnTo
      returnTo = null
      if (!target) return
      if (target.el.isConnected) target.el.focus()
      else document.getElementById(`${id}-${target.kind}`)?.focus()
    })
  }
</script>

<Sheet title="Deine Sammlung" rearm={top} {onClose}>
  <p class="intro">Alles hier bleibt auf diesem Gerät und in deinem Backup.</p>

  {#if stats.saveFailed}
    <p class="notice" role="alert">
      Speichern ist gerade nicht möglich – deine Daten gehen beim Schließen der App verloren. Exportiere ein Backup.
    </p>
  {/if}

  {#each SECTIONS as section (section.kind)}
    {@const list = ofKind(section.kind)}
    <section class="part" aria-labelledby="{id}-{section.kind}">
      <h3 id="{id}-{section.kind}" tabindex="-1">{section.title}</h3>

      {#if list.length === 0}
        <p class="empty">{section.empty}</p>
      {/if}

      {#if list.length < KIND_MAX[section.kind]}
        <div class="actions">
          <button type="button" class="button-line" onclick={(event) => openEditor(section.kind, null, event.currentTarget)}>{section.add}</button>
          {#if section.kind === 'erkenntnis'}
            <button type="button" class="button-line" onclick={(event) => openPaste(event.currentTarget)}>Notizen einfügen</button>
          {/if}
        </div>
      {:else}
        <p class="limit">{section.limit}</p>
      {/if}

      {#if section.kind === 'erkenntnis'}
        <p class="status" role="status">{status}</p>
      {/if}

      {#if list.length > 0}
        <ul class="rows" role="list">
          {#each list as item (item.id)}
            {@const sub = subtitle(item)}
            <li>
              <button
                type="button"
                class="row"
                aria-label="{item.text} bearbeiten"
                aria-describedby={sub ? `${id}-row-${item.id}` : undefined}
                onclick={(event) => openEditor(item.kind, item, event.currentTarget)}
              >
                <span class="row-text">
                  <span class="row-title" class:clamp={item.kind === 'erkenntnis'}>{item.text}</span>
                  {#if sub}
                    <span class="row-subtitle" id="{id}-row-{item.id}">{sub}</span>
                  {/if}
                </span>
                <svg class="pen" aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20">
                  <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
                </svg>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/each}
</Sheet>

<!-- Eigene Blätter hinter dem der Sammlung: Das spätere im DOM liegt oben, seine Abdunklung über der ersten. -->
{#if editing}
  <ItemEditor kind={editing.kind} item={editing.item} onClose={closeEditor} />
{/if}

{#if pasting}
  <PasteSheet onClose={closePaste} />
{/if}

<style>
  .intro,
  .empty,
  .limit {
    color: var(--text-muted);
    overflow-wrap: anywhere;
  }

  .notice {
    color: var(--text);
    overflow-wrap: anywhere;
  }

  .part {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  /* schmal wie der Text, damit der Fokusring die Überschrift umschließt statt die ganze Zeile */
  h3 {
    align-self: flex-start;
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 1.125rem;
    font-weight: 400;
    line-height: 1.3;
  }

  /* Zwei Knöpfe teilen sich die Zeile und rutschen untereinander, wenn es eng wird (wie im Editor eigener Muster). */
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .actions > * {
    flex: 1 1 9rem;
  }

  /* Die Meldung bleibt im Dokument (sonst liest Hilfstechnik sie nicht vor); leer nimmt sie keinen Platz. */
  .status {
    color: var(--text-muted);
  }

  .status:empty {
    margin-top: -12px;
  }

  /* Zeilen ohne eigene Fläche, über jeder eine feine Goldlinie (wie die eigenen Muster unter „Atmen“). */
  .rows {
    width: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .rows li {
    border-top: 1px solid rgb(233 196 142 / 0.28);
  }

  .rows li:first-child {
    border-top: 0;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: calc(100% + 16px);
    min-width: 0;
    min-height: 56px;
    margin-left: -8px;
    padding: 10px 8px;
    border: 0;
    border-radius: 18px;
    background: none;
    color: var(--text);
    text-align: left;
  }

  .row:active {
    background: var(--surface);
  }

  .row-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .row-title {
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 1.0625rem;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  /* Eine Erkenntnis zeigt höchstens drei Zeilen; der ganze Text steht im Namen des Knopfs und im Editor. */
  .row-title.clamp {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }

  .row-subtitle {
    color: var(--text-muted);
    font-size: 0.9375rem;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .pen {
    flex: none;
    fill: none;
    stroke: var(--text-muted);
    stroke-width: 1.6;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
</style>
