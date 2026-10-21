<script lang="ts">
  import { onMount } from 'svelte'
  import TimerSetup from '../components/timer/TimerSetup.svelte'
  import { byCategory, durationLabel, type Meditation } from '../lib/content/catalog'
  import { absoluteAudioUrl, entryLabel, startable } from '../lib/meditation/guided-view'
  import { savedTimer, timerSummary } from '../lib/meditation/timer-view'
  import { offline, refreshSaved } from '../lib/offline/status.svelte'
  import { stats } from '../lib/stats/store.svelte'
  import { startGuidedSession } from '../lib/ui/session-ui.svelte'

  let setupOpen = $state(false)

  const summary = $derived(timerSummary(savedTimer(stats.data.settings)))

  // Je Thema die Einträge mit ihrer Adresse, unter der auch der Offline-Status steht.
  const groups = byCategory().map((group) => ({
    ...group,
    items: group.items.map((m) => ({ m, url: absoluteAudioUrl(m, location.href) })),
  }))

  // Der Status kommt aus dem Cache; geprüft wird beim Öffnen des Reiters, nicht bei jedem Zeichnen.
  onMount(() => {
    void refreshSaved(groups.flatMap((group) => group.items.map((item) => item.url)))
  })

  // Der Name des Knopfs (`entryLabel`) ersetzt seinen Inhalt; „Vorabversion“ und „Nicht offline
  // verfügbar“ kommen als Beschreibung dazu.
  function describedBy(m: Meditation, available: boolean): string | undefined {
    const ids = [m.placeholder ? `chip-${m.id}` : null, available ? null : `hint-${m.id}`].filter((id) => id !== null)
    return ids.length > 0 ? ids.join(' ') : undefined
  }
</script>

<section class="screen">
  <header>
    <h1>Meditieren</h1>
  </header>

  <div class="card">
    <h2>Meditations-Timer</h2>
    <p class="hint">{summary}</p>
    <button type="button" class="button" onclick={() => (setupOpen = true)}>Timer einstellen</button>
  </div>

  <section class="guided" aria-labelledby="guided-title">
    <h2 id="guided-title">Geführte Meditationen</h2>

    {#each groups as group (group.category)}
      <section class="group" aria-labelledby="theme-{group.category}">
        <h3 id="theme-{group.category}">{group.title}</h3>
        <ul>
          {#each group.items as { m, url } (m.id)}
            <!-- Drei Zustände: noch ungeprüft (undefined) ist weder „✓ offline“ noch gesperrt. -->
            {@const status = offline.saved[url]}
            {@const saved = status === true}
            {@const available = startable(status, offline.online)}
            <li>
              <!-- Im Tipp selbst starten, damit der Audio-Start als Nutzergeste gilt. -->
              <button
                type="button"
                class="entry"
                disabled={!available}
                aria-label={entryLabel(m, saved)}
                aria-describedby={describedBy(m, available)}
                onclick={() => startGuidedSession(m)}
              >
                <span class="text">
                  <span class="title">{m.title}</span>
                  <span class="meta">
                    <span>{durationLabel(m)}</span>
                    {#if saved}
                      <span class="saved">✓ offline</span>
                    {/if}
                    {#if m.placeholder}
                      <span class="chip" id="chip-{m.id}">Vorabversion</span>
                    {/if}
                  </span>
                  {#if !available}
                    <span class="unavailable" id="hint-{m.id}">Nicht offline verfügbar</span>
                  {/if}
                </span>
                <span class="play" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20" focusable="false">
                    <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" />
                  </svg>
                </span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </section>
</section>

<!-- Außerhalb von .screen, dessen Einblend-Animation sonst den Bezugsrahmen für `fixed` stellte. -->
{#if setupOpen}
  <TimerSetup onClose={() => (setupOpen = false)} />
{/if}

<style>
  .hint {
    color: var(--text-muted);
  }

  .guided {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  h3 {
    color: var(--text-muted);
    font-size: 1.125rem;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .entry {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    min-height: 72px;
    padding: 14px 16px 14px 20px;
    border: 1px solid var(--surface-border);
    border-radius: 22px;
    background: linear-gradient(160deg, rgb(238 240 250 / 0.09), rgb(238 240 250 / 0.03));
    color: var(--text);
    text-align: left;
  }

  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .title {
    font-weight: 700;
    line-height: 1.3;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    color: var(--text-muted);
    font-size: 0.9375rem;
  }

  .saved {
    color: var(--accent);
    font-weight: 700;
  }

  .chip {
    padding: 0 10px;
    border: 1px solid var(--surface-border);
    border-radius: 999px;
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.6;
  }

  .play {
    display: grid;
    flex: none;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgb(242 201 138 / 0.14);
    color: var(--accent);
  }

  /* Ausgegraut: Titel und Angaben treten zurück, der Hinweis bleibt gut lesbar. */
  .entry:disabled {
    cursor: default;
  }

  .entry:disabled .title,
  .entry:disabled .meta,
  .entry:disabled .play {
    opacity: 0.45;
  }

  .entry:disabled .play {
    background: var(--surface);
    color: var(--text-muted);
  }

  .unavailable {
    color: var(--text-muted);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .entry:not(:disabled):active {
    transform: scale(0.99);
  }

  @media (prefers-reduced-motion: no-preference) {
    .entry {
      transition:
        transform 0.15s ease,
        border-color 0.3s ease;
    }
  }
</style>
