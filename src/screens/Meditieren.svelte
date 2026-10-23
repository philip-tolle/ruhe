<script lang="ts">
  import { onMount } from 'svelte'
  import Motiv from '../components/Motiv.svelte'
  import OfflineMark from '../components/OfflineMark.svelte'
  import Waschung from '../components/Waschung.svelte'
  import TimerSetup from '../components/timer/TimerSetup.svelte'
  import { byCategory, durationLabel, type Meditation } from '../lib/content/catalog'
  import { themaMotiv } from '../lib/content/motive'
  import { tageszeitWaschung, themaWaschung, waschLage } from '../lib/content/waschungen'
  import { absoluteAudioUrl, entryLabel, startable } from '../lib/meditation/guided-view'
  import { savedTimer, timerSummary } from '../lib/meditation/timer-view'
  import { offline, refreshSaved } from '../lib/offline/status.svelte'
  import { stats } from '../lib/stats/store.svelte'
  import { startGuidedSession } from '../lib/ui/session-ui.svelte'
  import { tageszeitUi } from '../lib/ui/tageszeit.svelte'

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

  <!-- Motiv · Text · Linienknopf; die Waschung in der Farbe der Tageszeit liegt hinter der Knopfspalte. -->
  <div class="card timer">
    <Waschung farbe={tageszeitWaschung(tageszeitUi.current)} />
    <Motiv id="timer" size={56} />
    <div class="timer-text">
      <h2>Meditations-Timer</h2>
      <p class="hint">{summary}</p>
    </div>
    <!-- Sichtbar „Einstellen“, vorgelesen „Timer einstellen“: Das sichtbare Wort steckt im Namen. -->
    <button type="button" class="button-line" aria-label="Timer einstellen" onclick={() => (setupOpen = true)}>Einstellen</button>
  </div>

  <section class="guided" aria-labelledby="guided-title">
    <div>
      <h2 id="guided-title">Geführte Meditationen</h2>
      <span class="rule" aria-hidden="true"></span>
    </div>

    {#each groups as group (group.category)}
      <section class="group" aria-labelledby="theme-{group.category}">
        <div class="group-head">
          <Motiv id={themaMotiv(group.category)} size={64} />
          <h3 id="theme-{group.category}">{group.title}</h3>
          <span class="rule-fade" aria-hidden="true"></span>
        </div>
        <ul>
          {#each group.items as { m, url }, i (m.id)}
            <!-- Drei Zustände: noch ungeprüft (undefined) ist weder „offline gespeichert“ noch gesperrt. -->
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
                <Waschung farbe={themaWaschung(group.category)} lage={waschLage(i)} />
                <span class="text">
                  <span class="title">{m.title}</span>
                  <span class="meta">
                    <span>{durationLabel(m)}</span>
                    {#if saved}
                      <OfflineMark />
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
                  <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
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
  /*
    Timer-Karte: Motiv · Text · Umriss-Knopf in einer Zeile. Die Waschung füllt die Knopfspalte bis in die obere
    rechte Ecke (Knopf, Abstand davor, Innenabstand rechts); der Text endet genau davor. Der Knopf ist deckend und
    darf in der Zone stehen. Ist die Karte schmal (kleines Handy oder große Systemschrift), rutscht der Knopf unter
    den Text (unten, Abfrage in rem: wächst mit der Schrift).
  */
  .timer {
    --timer-button: 6.75rem;
    --wash-w: calc(var(--timer-button) + 14px + 20px);
    --wash-narrow: 64px;
    container-type: inline-size;
    position: relative;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 14px;
    padding: 22px 20px;
    overflow: hidden;
    isolation: isolate;
  }

  /* Inhalt über der Waschung */
  .timer :global(.motiv),
  .timer-text,
  .timer .button-line {
    position: relative;
    z-index: 1;
  }

  .timer-text {
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .timer h2 {
    font-size: 1.1875rem;
    line-height: 1.2;
  }

  .hint {
    color: var(--text-muted);
    font-size: 0.875rem;
    line-height: 1.45;
  }

  .timer .button-line {
    flex: none;
    min-width: var(--timer-button);
    padding: 0 18px;
    font-size: 0.9375rem;
  }

  /* Schmal: Der Text füllt die erste Zeile neben dem Motiv (56 + 14 px, 1 px Spielraum), der Knopf bricht um und
     steht unter dem Text. Die Waschung bleibt oben rechts in einer schmalen Ecke; der Text hält Abstand zu ihr. */
  @container (max-width: 19.5rem) {
    .timer-text {
      flex-basis: calc(100% - 71px);
      padding-right: calc(var(--wash-narrow) - 20px);
    }

    .timer .button-line {
      margin-left: 70px;
    }

    .timer :global(.waschung) {
      --wash-w: var(--wash-narrow);
    }
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

  .group-head {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  h3 {
    min-width: 0;
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

  /*
    Jede Meditation als eigene Karte. Die Waschung (Farbe des Themas) füllt die Spalte des Play-Kreises:
    104 px breit, volle Höhe. Der Text endet links davon: 104 px = Innenabstand rechts 14 + Kreis 40 + Abstand 14
    + Rand der Textspalte 36.
  */
  .entry {
    --wash-w: 104px;
    --wash-h: 100%;
    position: relative;
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-height: 76px;
    padding: 14px 14px 14px 20px;
    border: 1px solid rgb(233 196 142 / 0.22);
    border-radius: 22px;
    background: linear-gradient(160deg, rgb(238 240 250 / 0.09), rgb(238 240 250 / 0.03));
    color: var(--text);
    text-align: left;
    overflow: hidden;
    isolation: isolate;
  }

  .text {
    position: relative;
    z-index: 1;
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    margin-right: calc(var(--wash-w) - 14px - 40px - 14px);
  }

  .title {
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 1.1875rem;
    font-weight: 400;
    line-height: 1.2;
  }

  /* Länge und Häkchen leise; das Häkchen nimmt die Farbe des Textes (currentColor). */
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    color: var(--text-muted);
    font-size: 0.78rem;
    letter-spacing: 0.02em;
  }

  .chip {
    padding: 0 10px;
    border: 1px solid var(--surface-border);
    border-radius: 999px;
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.6;
  }

  /* Deckende Scheibe im Akzent der Stimmung mit feinem Ring: Sonne und Mond stehen oben rechts genau in dieser
     Spalte und scheinen beim Scrollen nicht durch; ebenso wenig die Waschung dahinter. */
  .play {
    position: relative;
    z-index: 1;
    display: grid;
    flex: none;
    place-items: center;
    width: 40px;
    height: 40px;
    /* Zuerst der volle Akzent als Rückfall: Ohne color-mix() verwirft der Browser die nächste Zeile. */
    border: 1px solid var(--accent);
    border-color: color-mix(in srgb, var(--accent) 50%, transparent);
    border-radius: 50%;
    background: color-mix(in srgb, var(--accent) 14%, var(--sky-mid));
    color: var(--accent);
  }

  .play svg {
    margin-left: 2px;
  }

  /* Ohne color-mix() bliebe die Scheibe durchsichtig: dann der Himmel der Stimmung, deckend. */
  @supports not (color: color-mix(in srgb, red, red)) {
    .play {
      background: var(--sky-mid);
    }
  }

  /* Ausgegraut: Titel, Angaben, Kreis und Waschung treten zurück, der Hinweis bleibt gut lesbar. */
  .entry:disabled {
    --wash-opacity: 0.2;
    cursor: default;
  }

  .entry:disabled .title,
  .entry:disabled .meta,
  .entry:disabled .play {
    opacity: 0.55;
  }

  .entry:disabled .play {
    border-color: var(--surface-border);
    background: var(--surface);
    color: var(--text-muted);
  }

  .unavailable {
    color: var(--text-muted);
    font-size: 0.8125rem;
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
