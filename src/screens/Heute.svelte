<script lang="ts">
  import { onMount } from 'svelte'
  import { breathProgram } from '../lib/audio/program'
  import { durationLabel, suggestionFor, type Meditation } from '../lib/content/catalog'
  import { absoluteAudioUrl, startable } from '../lib/meditation/guided-view'
  import { offline, refreshSaved } from '../lib/offline/status.svelte'
  import { greetingFor } from '../lib/time/greeting'
  import { setLastUsed, stats } from '../lib/stats/store.svelte'
  import { streak } from '../lib/stats/summary'
  import { lastUsedCard, lastUsedStart, streakLine } from '../lib/ui/heute-view'
  import { startGuidedSession, startSession } from '../lib/ui/session-ui.svelte'
  import type { TabId } from '../lib/ui/tabs'

  let { onNavigate }: { onNavigate: (tab: TabId) => void } = $props()

  const now = new Date()
  const greeting = greetingFor(now)
  // Der Vorschlag bleibt den ganzen Tag derselbe; beim Öffnen des Reiters wird er einmal bestimmt.
  const suggestion = suggestionFor(now)

  const days = $derived(streak(stats.data.sessions, new Date()))
  // Ohne Gemerktes (oder mit einer unbekannten Meditation) steht hier „Ankommen im Atem“.
  const card = $derived(lastUsedCard(stats.data.lastUsed))
  const start = $derived(lastUsedStart(card.last))

  const urlOf = (m: Meditation) => absoluteAudioUrl(m, location.href)

  // Der Status kommt aus dem Cache; geprüft wird beim Öffnen des Reiters, für die höchstens zwei
  // Meditationen, die hier zu starten sind.
  onMount(() => {
    const shown = start.kind === 'guided' ? [suggestion, start.meditation] : [suggestion]
    void refreshSaved([...new Set(shown.map(urlOf))])
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

<section class="screen">
  <header>
    <h1>{greeting}</h1>
    <p class="lead" class:streak={days > 0}>{streakLine(days)}</p>
  </header>

  <div class="card">
    <h2>Vorschlag des Tages</h2>
    <div class="suggestion">
      <p class="name">{suggestion.title}</p>
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
    <h2>3 Min durchatmen</h2>
    <p class="hint">Kohärentes Atmen</p>
    <button type="button" class="button" onclick={breatheNow}>Jetzt durchatmen</button>
  </div>

  <div class="card">
    <h2>Zur Ruhe kommen</h2>
    <p class="hint">Ein sanfter Klang hilft beim Ankommen.</p>
    <button type="button" class="button" onclick={() => onNavigate('klaenge')}>Zu den Klängen</button>
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
</style>
