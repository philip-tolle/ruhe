<script lang="ts">
  import { untrack } from 'svelte'
  import Motiv from '../components/Motiv.svelte'
  import OfflineMark from '../components/OfflineMark.svelte'
  import Waschung from '../components/Waschung.svelte'
  import { breathProgram } from '../lib/audio/program'
  import { durationLabel, suggestionFor, type Meditation } from '../lib/content/catalog'
  import { vorschlagMotiv, type MotivId } from '../lib/content/motive'
  import { tageszeitWaschung, zuletztWaschung } from '../lib/content/waschungen'
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

<!-- Wie in der Liste der Meditationen: Offline startet nur, was gespeichert ist; sonst steht der Grund da.
     `variant`: voller Akzent-Knopf (`primary`, Vorschlag) oder Umriss-Knopf (`line`, Zuletzt genutzt). `meta`: daneben
     leise die Länge und, wenn die Datei gespeichert ist, das Häkchen; beides bricht zusammen um, wenn die Zeile zu
     schmal wird. -->
{#snippet guidedStart(m: Meditation, label: string, where: string, { variant, meta = false }: { variant: 'primary' | 'line'; meta?: boolean })}
  {@const status = offline.saved[urlOf(m)]}
  {@const available = startable(status, offline.online)}
  <div class="start">
    <div class="start-row">
      <button
        type="button"
        class={variant === 'line' ? 'button-line' : 'button'}
        disabled={!available}
        aria-describedby={available ? undefined : `hint-${where}`}
        onclick={() => startGuidedSession(m)}
      >
        {label}
      </button>
      {#if meta}
        <span class="meta">
          <span>{durationLabel(m)}</span>
          {#if status === true}
            <OfflineMark />
          {/if}
        </span>
      {/if}
    </div>
    {#if !available}
      <p class="unavailable" id="hint-{where}">Nicht offline verfügbar</p>
    {/if}
  </div>
{/snippet}

<!-- Eine Zeile der Aktivitäten: die ganze Fläche ist der Knopf. Sein Name ist der sichtbare Text, Motiv und Pfeil Schmuck. -->
{#snippet activity(motiv: MotivId, title: string, subtitle: string, action: () => void)}
  <li>
    <button type="button" class="row" onclick={action}>
      <Motiv id={motiv} size={56} />
      <span class="row-text">
        <span class="row-title">{title}</span>
        <span class="row-subtitle">{subtitle}</span>
      </span>
      <svg class="chevron" aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  </li>
{/snippet}

<section class="screen">
  <header>
    <h1>{greeting}</h1>
    <p class="lead" class:streak={days > 0}>{streakLine(days)}</p>
  </header>

  <!-- Waschung in der Farbe der Tageszeit oben rechts, um das Motiv; Überschrift, Titel und Beschreibung liegen links
       davon bzw. darunter. Der volle Knopf ist der einzige auf dem Bildschirm. -->
  <div class="card vorschlag">
    <Waschung farbe={tageszeitWaschung(tageszeitUi.current)} />
    <div class="suggestion">
      <h2 class="kicker">Vorschlag des Tages</h2>
      <div class="suggestion-head">
        <p class="name">{suggestion.title}</p>
        <Motiv id={vorschlagMotiv(tageszeitUi.current)} size={96} />
      </div>
      <p class="hint">{suggestion.description}</p>
    </div>
    {@render guidedStart(suggestion, 'Jetzt starten', 'suggestion', { variant: 'primary', meta: true })}
  </div>

  <!-- Waschung nach dem Gemerkten (Thema, Übung oder Tageszeit) in einer schmalen Ecke oben rechts. -->
  <div class="card zuletzt">
    <Waschung farbe={zuletztWaschung(card.last, tageszeitUi.current)} />
    <h2>Zuletzt genutzt</h2>
    <p class="hint">{card.summary}</p>
    {#if start.kind === 'guided'}
      {@render guidedStart(start.meditation, card.action, 'last-used', { variant: 'line' })}
    {:else}
      <div class="start">
        <button type="button" class="button-line" onclick={() => startSession(start.spec)}>{card.action}</button>
      </div>
    {/if}
  </div>

  <div class="card activities">
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

  /*
    Vorschlag und Zuletzt genutzt tragen eine Waschung in der oberen rechten Ecke (Waschung.svelte): Die Karte ist ihr
    Bezugsrahmen und schneidet zu, der Inhalt liegt darüber, und keine Schrift steht in der Zone.
  */
  .vorschlag,
  .zuletzt {
    position: relative;
    overflow: hidden;
    isolation: isolate;
  }

  .vorschlag > :global(:not(.waschung)),
  .zuletzt > :global(:not(.waschung)) {
    position: relative;
    z-index: 1;
  }

  /*
    Vorschlag: Die Zone ist die Spalte des Motivs (96 px + Innenabstand 24 px) plus ein Streifen davor, in der Höhe von
    der Karte bis zum Ende der Titelzeile: Innenabstand 24, Überschrift (eine Zeile), 8, Motiv 96. Wird die Überschrift
    zweizeilig, endet die Zone eine Zeile über dem Motiv; die Beschreibung beginnt in jedem Fall darunter.
  */
  .vorschlag {
    --wash-w: 132px;
    --wash-h: calc(128px + 0.72rem * 1.3);
    container-type: inline-size;
  }

  .suggestion {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  /* Kleine Überschrift in Versalien; die Karte bleibt bei ihrer h2. Sie hält Abstand zur Zone (nur bei schmaler Karte
     bricht sie um). */
  .kicker {
    margin: 0 calc(var(--wash-w) - 24px) 2px 0;
    color: var(--text-muted);
    font-family: var(--font-body), system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    line-height: 1.3;
    text-transform: uppercase;
  }

  /* Der Titel links, das Motiv der Tageszeit rechts davon; Beschreibung und Start laufen darunter über die ganze
     Breite. So bleibt die Karte auch auf einem schmalen Telefon (360 px) niedrig. Der Abstand ist so bemessen, dass
     der Titel genau am linken Rand der Zone endet; lange Wörter brechen um, statt ins Motiv zu laufen. */
  .suggestion-head {
    display: flex;
    align-items: center;
    gap: calc(var(--wash-w) - 24px - 96px);
  }

  .suggestion-head .name {
    flex: 1;
    min-width: 0;
    hyphens: auto;
    overflow-wrap: anywhere;
  }

  /*
    Der Titel der Meditation ist der Blickfang der Karte, aber keine Überschrift: unter „h2“ der Karte. Auf schmaler
    Karte darf er nicht über die Spalte neben dem Motiv hinauswachsen, sonst bräche der längste Titel („Energie in der
    Mittagspause“) bei größerer Systemschrift mitten im Wort. Die Obergrenze richtet sich nach der Spalte: Breite der
    Karte (100cqw) ohne Motiv und Abstand (Zonenbreite − Innenabstand), geteilt durch 6,4 – so breit ist „Mittagspause“
    in em, mit etwas Luft. Auf 360 px bleibt der Titel bei 100 % bei den vollen 1.625rem (Obergrenze 26,6 px); mit
    größerer Systemschrift wächst er nicht über die Spalte hinaus. Ohne Container-Einheiten gilt die erste Zeile.
  */
  .name {
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 1.625rem;
    font-size: min(1.625rem, calc((100cqw - var(--wash-w) + 24px) / 6.4));
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  /*
    Zuletzt genutzt: eine schmale Ecke, etwa so hoch wie die Überschrift. Sie endet 14 px unter ihr, also über der
    Zusammenfassung (Abstand der Karte 18 px); die Überschrift hält Abstand zur Zone.
  */
  .zuletzt {
    --wash-w: 128px;
    --wash-h: calc(38px + 1.1875rem * 1.2);
  }

  .zuletzt h2 {
    margin-right: calc(var(--wash-w) - 24px);
  }

  /* Der Start: Knopf, daneben leise Länge und Häkchen; der Hinweis „Nicht offline verfügbar“ steht darunter. */
  .start {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .start-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
  }

  .meta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--text-muted);
    font-size: 0.78rem;
    letter-spacing: 0.02em;
  }

  .button:disabled,
  .button-line:disabled {
    opacity: 0.55;
    box-shadow: none;
    cursor: default;
  }

  .unavailable {
    color: var(--text-muted);
    font-size: 0.8125rem;
    font-weight: 600;
  }

  /* Aktivitäten: Zeilen ohne eigene Fläche, über jeder eine feine Goldlinie. */
  .rows {
    width: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .rows li {
    border-top: 1px solid rgb(233 196 142 / 0.28);
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
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .row-title {
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 1.125rem;
    font-weight: 400;
    line-height: 1.3;
  }

  .row-subtitle {
    color: var(--text-muted);
    font-size: 0.9375rem;
    line-height: 1.4;
  }

  /* Feiner Pfeil: führt die Zeile zu einem anderen Reiter bzw. in den Player. */
  .chevron {
    flex: none;
    stroke: var(--gold-line-strong);
  }
</style>
