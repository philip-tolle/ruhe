<script lang="ts">
  import { untrack } from 'svelte'
  import { durationLabel, meditationById } from '../../lib/content/catalog'
  import { hackById } from '../../lib/energy/hacks'
  import { absoluteAudioUrl, startable } from '../../lib/meditation/guided-view'
  import { offline, refreshSaved } from '../../lib/offline/status.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { startExercise, startMorningMeditation } from '../../lib/ui/morning-ui.svelte'
  import { appNow } from '../../lib/ui/tageszeit.svelte'

  // Schritt 3 des langen Ablaufs, „Vertiefen“ (Spec M10 §2.3): zwei Wahlknöpfe, die eine Meditation bzw. eine Übung im
  // Player starten (im Tipp selbst, wegen der Autoplay-Regel). Die Meditation spielt offline nur, wenn die Datei
  // gespeichert ist (wie auf „Heute“): Sonst ist der Knopf gesperrt und sagt warum. „Tageslicht tanken“ geht immer;
  // vor 7:00 ist es draußen oft noch dunkel, das sagt ein Hinweis (die Wahl bleibt). Wer keins von beiden will,
  // überspringt den Schritt.
  const id = $props.id()
  const arming = tapArming()

  const meditation = meditationById('guten-morgen')
  const daylight = hackById('tageslicht')
  const url = meditation ? absoluteAudioUrl(meditation, location.href) : null

  // Der Status kommt aus dem Cache; geprüft wird einmal beim Einblenden.
  $effect(() => {
    if (url) untrack(() => void refreshSaved([url]))
  })

  const available = $derived(meditation !== null && (url === null || startable(offline.saved[url], offline.online)))
  // „Jetzt“ ist die Zeit der App (`appNow`), nicht die des Aufbaus.
  const early = $derived(appNow().getHours() < 7)
</script>

<div class="step">
  <div class="content">
    <header class="head">
      <p class="kicker">Vertiefen</p>
      <h2 class="title" tabindex="-1" data-step-title>Noch fünf Minuten für dich</h2>
    </header>

    <div class="options">
      <div class="option">
        <button
          type="button"
          class="choice"
          class:unavailable={!available}
          disabled={!available || !arming.armed}
          aria-describedby={available ? undefined : `${id}-offline`}
          onclick={startMorningMeditation}
        >
          <span class="name">Guten Morgen</span>
          <span class="sub">Meditation{meditation ? ` · ${durationLabel(meditation)}` : ''}</span>
        </button>
        {#if !available}
          <p class="hint" id="{id}-offline">Nicht offline verfügbar</p>
        {/if}
      </div>

      {#if daylight}
        <div class="option">
          <button
            type="button"
            class="choice"
            disabled={!arming.armed}
            aria-describedby={early ? `${id}-early` : undefined}
            onclick={() => startExercise(daylight.id)}
          >
            <span class="name">Tageslicht tanken</span>
            <span class="sub">Draußen · {daylight.minutes} Min</span>
          </button>
          {#if early}
            <p class="hint" id="{id}-early">Am besten, sobald es hell ist.</p>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .options {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .option {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Eine ganze Fläche je Wahl, Name groß und die Art darunter; leicht im Akzent getönt und deckend wie die Chips. */
  .choice {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    width: 100%;
    min-height: 72px;
    padding: 14px 20px;
    border: 1px solid var(--gold-line);
    border-radius: 22px;
    background: var(--sky-mid);
    background: color-mix(in srgb, var(--accent) 8%, var(--sky-mid));
    color: var(--text);
    text-align: left;
  }

  .choice:disabled {
    cursor: default;
  }

  /* Gedämpft nur, wenn die Meditation nicht spielen kann, nicht während der kurzen Sperre nach dem Einblenden. */
  .unavailable {
    opacity: 0.6;
  }

  .name {
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 1.25rem;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .sub {
    color: var(--text-muted);
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .hint {
    padding: 0 6px;
    color: var(--text-muted);
    font-size: 0.875rem;
    line-height: 1.4;
  }
</style>
