<script lang="ts">
  import { untrack } from 'svelte'
  import Motiv from '../components/Motiv.svelte'
  import { breathProgram } from '../lib/audio/program'
  import { durationLabel, suggestionFor, type Meditation } from '../lib/content/catalog'
  import { vorschlagMotiv, type MotivId } from '../lib/content/motive'
  import { absoluteAudioUrl, startable } from '../lib/meditation/guided-view'
  import { offline, refreshSaved } from '../lib/offline/status.svelte'
  import { GREETING } from '../lib/time/tageszeit'
  import { setLastUsed, stats } from '../lib/stats/store.svelte'
  import { streak } from '../lib/stats/summary'
  import { lastUsedCard, lastUsedStart, streakLine } from '../lib/ui/heute-view'
  import { startGuidedSession, startSession } from '../lib/ui/session-ui.svelte'
  import type { TabId } from '../lib/ui/tabs'
  import { tageszeitUi } from '../lib/ui/tageszeit.svelte'

  let { onNavigate }: { onNavigate: (tab: TabId) => void } = $props()

  // Begrüßung und Vorschlag folgen der Stimmung, auch bei offener App (Wechsel zur vollen Minute).
  const greeting = $derived(GREETING[tageszeitUi.current])
  // Der Vorschlag gilt für eine Tageszeit (Thema nach Uhrzeit, Titel nach Kalendertag): beim Öffnen
  // des Reiters bestimmt und bei jedem Wechsel der Tageszeit neu.
  const suggestion = $derived.by(() => {
    void tageszeitUi.current
    return suggestionFor(new Date())
  })

  const days = $derived(streak(stats.data.sessions, new Date()))
  // Ohne Gemerktes (oder mit einer unbekannten Meditation) steht hier „Ankommen im Atem“.
  const card = $derived(lastUsedCard(stats.data.lastUsed))
  const start = $derived(lastUsedStart(card.last))

  const urlOf = (m: Meditation) => absoluteAudioUrl(m, location.href)

  // Der Status kommt aus dem Cache; geprüft wird beim Öffnen des Reiters, für die höchstens zwei
  // Meditationen, die hier zu starten sind, und erneut, wenn eine davon wechselt (neuer Vorschlag
  // mit der Tageszeit). Nur diese beiden lösen die Prüfung aus, nicht der Status selbst.
  $effect(() => {
    const shown = start.kind === 'guided' ? [suggestion, start.meditation] : [suggestion]
    const urls = [...new Set(shown.map(urlOf))]
    untrack(() => void refreshSaved(urls))
  })

  // Alle Starts im Tipp selbst, damit der Audio-Start als Nutzergeste gilt.
  // „Erneut starten“ ändert nichts am Gemerkten: Es ist ja schon die letzte Sitzung.
  function breatheNow() {
    setLastUsed({ kind: 'breath', pattern: 'kohaerent', minutes: 3 })
    startSession(breathProgram('kohaerent', 3))
  }
</script>

<!-- Wie in der Liste der Meditationen: Offline startet nur, was gespeichert ist; sonst steht der Grund da. -->
{#snippet guidedStart(m: Meditation, label: string, where: string)}
  {@const available = startable(offline.saved[urlOf(m)], offline.online)}
  <div class="start">
    <button
      type="button"
      class="button"
      disabled={!available}
      aria-describedby={available ? undefined : `hint-${where}`}
      onclick={() => startGuidedSession(m)}
    >
      {label}
    </button>
    {#if !available}
      <p class="unavailable" id="hint-{where}">Nicht offline verfügbar</p>
    {/if}
  </div>
{/snippet}

<!-- Eine Zeile der Aktivitäten: die ganze Fläche ist der Knopf. Sein Name ist der sichtbare Text, das Motiv Schmuck. -->
{#snippet activity(motiv: MotivId, title: string, subtitle: string, action: () => void)}
  <li>
    <button type="button" class="row" onclick={action}>
      <Motiv id={motiv} size={56} />
      <span class="row-text">
        <span class="row-title">{title}</span>
        <span class="row-subtitle">{subtitle}</span>
      </span>
    </button>
  </li>
{/snippet}

<section class="screen">
  <header>
    <h1>{greeting}</h1>
    <p class="lead" class:streak={days > 0}>{streakLine(days)}</p>
  </header>

  <div class="card">
    <h2>Vorschlag des Tages</h2>
    <div class="suggestion">
      <div class="suggestion-head">
        <p class="name">{suggestion.title}</p>
        <Motiv id={vorschlagMotiv(tageszeitUi.current)} size={96} />
      </div>
      <p class="hint">{suggestion.description}</p>
      <p class="hint">{durationLabel(suggestion)}</p>
    </div>
    {@render guidedStart(suggestion, 'Jetzt starten', 'suggestion')}
  </div>

  <div class="card">
    <h2>Zuletzt genutzt</h2>
    <p class="hint">{card.summary}</p>
    {#if start.kind === 'guided'}
      {@render guidedStart(start.meditation, card.action, 'last-used')}
    {:else}
      <button type="button" class="button" onclick={() => startSession(start.spec)}>{card.action}</button>
    {/if}
  </div>

  <div class="card">
    <h2>Aktivitäten</h2>
    <ul class="rows">
      {@render activity('meditieren', 'Meditieren', 'Geführt oder mit Timer', () => onNavigate('meditieren'))}
      {@render activity('atmen', 'Atemübung', '3 Min kohärent atmen', breatheNow)}
      {@render activity('klaenge', 'Klänge', 'Zur Ruhe kommen', () => onNavigate('klaenge'))}
    </ul>
  </div>
</section>

<style>
  .hint {
    color: var(--text-muted);
  }

  /* Eine laufende Serie soll ins Auge fallen; ohne Serie bleibt es eine leise Einladung. */
  .streak {
    color: var(--accent);
    font-weight: 600;
  }

  .suggestion {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  /* Der Titel links, das Motiv der Tageszeit rechts davon; Beschreibung und Dauer laufen darunter über die
     ganze Breite. So bleibt die Karte auch auf einem schmalen Telefon (360 px) niedrig. Der Titel darf
     umbrechen, das Motiv behält seine Fläche. */
  .suggestion-head {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .suggestion-head .name {
    flex: 1;
    min-width: 0;
  }

  /* Der Titel der Meditation ist der Blickfang der Karte, aber keine Überschrift: unter „h2“ der Karte. */
  .name {
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 1.625rem;
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  .start {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .button:disabled {
    opacity: 0.55;
    box-shadow: none;
    cursor: default;
  }

  .unavailable {
    color: var(--text-muted);
    font-size: 0.875rem;
    font-weight: 600;
  }

  /* Aktivitäten: Zeilen ohne eigene Fläche, nur eine feine Linie dazwischen. */
  .rows {
    width: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .rows li + li {
    border-top: 1px solid var(--surface-border);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 16px;
    width: calc(100% + 16px);
    min-height: 72px;
    margin: 0 -8px;
    padding: 8px;
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
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .row-title {
    font-weight: 600;
    line-height: 1.3;
  }

  .row-subtitle {
    color: var(--text-muted);
    font-size: 0.9375rem;
    line-height: 1.4;
  }
</style>
