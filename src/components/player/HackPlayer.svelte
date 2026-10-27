<script lang="ts">
  import { untrack } from 'svelte'
  import AreaChip from '../energy/AreaChip.svelte'
  import HackIcon from '../energy/HackIcon.svelte'
  import HackWhy from '../energy/HackWhy.svelte'
  import HackEffect from './HackEffect.svelte'
  import PlayerShell from './PlayerShell.svelte'
  import ProgressDial from './ProgressDial.svelte'
  import TaktCurve from './TaktCurve.svelte'
  import { areaLine, roundLabel, stepLabel } from '../../lib/energy/hack-view'
  import { hackById, stepAt, taktAt } from '../../lib/energy/hacks'
  import { formatRemaining } from '../../lib/time/format'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { doneOf, runningProgram } from '../../lib/ui/player-state'
  import { programClock } from '../../lib/ui/program-clock.svelte'
  import { vibrate } from '../../lib/ui/vibrate'
  import { keepScreenOn } from '../../lib/ui/wake-lock'

  // Vollbild-Player des Brain Hacks (Spec M9 §3.5, Entwurf B) auf dem Rahmen der anderen Player. App.svelte zeigt ihn, solange
  // ein Hack läuft (Laufansicht) oder sein Ende offen ist (`HackEffect`, die Frage nach der Wirkung). Je nach Führungsart:
  // „takt“ die Atemkurve mit laufendem Punkt, die Anweisung groß und die Runde; „schritte“ der aktuelle Schritt groß mit
  // Zähler und Restzeit; „ring“ der Ring mit allen Schritten als Liste. Immer: Chip, Restzeit, Balken und „Warum es wirkt“.
  const run = $derived(runningProgram('hack'))
  const done = $derived(doneOf('hack'))
  const running = $derived(run !== null)
  // Ein Hack, den der Katalog nicht (mehr) kennt, zeigt nur den Rahmen mit Pause und Beenden statt zu werfen.
  const hack = $derived(run ? hackById(run.ref) : null)

  // Die Anzeige liest die Zeit pro Bild aus der Audio-Uhr: Auch nach dem Entsperren stimmt sie sofort wieder.
  const clock = programClock(() => running)
  const length = $derived(run?.length ?? 0)
  const remaining = $derived(Math.max(0, length - clock.elapsed))
  const progress = $derived(length > 0 ? Math.min(1, clock.elapsed / length) : 0)
  // `taktAt` hält seine Phasen je Hack vor, der Aufruf pro Bild kostet nichts.
  const moment = $derived(hack?.guide === 'takt' ? taktAt(hack, clock.elapsed) : null)
  const step = $derived(hack ? stepAt(hack, clock.elapsed) : null)
  const current = $derived(hack?.guide === 'schritte' && step ? hack.steps[step.index] : null)

  // Beim Schrittwechsel ein leises Vibrieren (60 ms, nur wenn an und der Bildschirm an ist, siehe `vibrate`): nicht beim
  // ersten Bild und nicht beim Neustart. Zwischen zwei Läufen („Noch einmal“) ist `stepIndex` `null`; Schritt 1 des neuen
  // Laufs gilt darum nicht als Wechsel vom letzten Schritt des alten.
  const stepIndex = $derived(hack?.guide === 'schritte' && step ? step.index : null)
  let shownStep: number | null = null

  $effect(() => {
    const next = stepIndex
    untrack(() => {
      if (shownStep !== null && next !== null && next !== shownStep) vibrate(60)
    })
    shownStep = next
  })

  // Der Bildschirm bleibt an, solange die Laufansicht steht (wie bei der Atemübung); danach und beim Abbau wird er frei.
  $effect(() => {
    if (!running) return
    return keepScreenOn()
  })

  // „Warum es wirkt“ klappt auf. Wie die Knöpfe des Rahmens nimmt der Knopf erst kurz nach dem Start Tipps an: Ein
  // Doppeltipp auf „Starten“ in der Hack-Karte träfe ihn sonst.
  const arming = tapArming(() => running)
  let whyOpen = $state(false)
  const whyId = $props.id()
</script>

<PlayerShell label="Brain Hack" {run} {done} confirmTitle="Hack beenden?" continueLabel="Weiter üben" {doneView} {footer}>
  {#if hack}
    <AreaChip area={hack.area} label={areaLine(hack)} />

    {#if moment}
      <!-- Takt: die Kurve eines Zyklus mit dem Punkt, darunter groß die Anweisung. Der Live-Bereich enthält nur sie. -->
      <div class="stage">
        <TaktCurve {hack} progress={moment.cycleProgress} level={moment.level} />
        <p class="say" aria-live="polite">{moment.say}</p>
      </div>
    {:else if current && step}
      <!-- Schritte: Symbol, Titel und Erklärung groß; der Live-Bereich sagt sie samt Zähler beim Wechsel an, die tickende
           Restzeit des Schritts steht außerhalb, sonst spräche Hilfstechnik jede Sekunde. -->
      <div class="stage">
        <div class="step" aria-live="polite" aria-atomic="true">
          <span class="badge"><HackIcon name={current.icon} size={34} /></span>
          <p class="step-title">{current.title}</p>
          <p class="step-detail">{current.detail}</p>
          <p class="step-count">{stepLabel(step.index, hack.steps.length)}</p>
        </div>
        <p class="step-left">{formatRemaining(step.remaining)}</p>
      </div>
    {:else}
      <!-- Ring: der Ring mit der Restzeit, darunter alle Schritte als ruhige Liste. -->
      <ProgressDial fit {progress} value={formatRemaining(remaining)} />
      <ol class="list" role="list">
        {#each hack.steps as s, i (i)}
          <li>
            <span class="badge small"><HackIcon name={s.icon} size={22} /></span>
            <span class="list-text">
              <span class="list-title">{s.title}</span>
              <span class="list-detail">{s.detail}</span>
            </span>
          </li>
        {/each}
      </ol>
    {/if}

    <!-- Restzeit groß und Balken; bei „ring“ steht die Restzeit schon im Ring. -->
    {#if hack.guide !== 'ring'}
      <div class="clock">
        <div class="clock-row">
          <p class="remaining" role="timer">{formatRemaining(remaining)}</p>
          {#if moment}
            {@const round = roundLabel(moment.round, moment.rounds)}
            {#if round}<p class="round">{round}</p>{/if}
          {/if}
        </div>
        <div class="bar" aria-hidden="true"><i style:transform="scaleX({progress})"></i></div>
      </div>
    {/if}

    <div class="why">
      <button type="button" class="why-toggle" aria-expanded={whyOpen} aria-controls={whyOpen ? whyId : undefined} disabled={!arming.armed} onclick={() => (whyOpen = !whyOpen)}>
        <span>Warum es wirkt</span>
        <svg class="chevron" class:open={whyOpen} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {#if whyOpen}
        <div class="why-body" id={whyId}>
          <HackWhy {hack} />
        </div>
      {/if}
    </div>
  {/if}
</PlayerShell>

{#snippet footer()}
  {#if hack}
    <p class="source">Quelle: {hack.source}</p>
  {/if}
{/snippet}

{#snippet doneView()}
  {#if done}
    <HackEffect {done} />
  {/if}
{/snippet}

<style>
  /* Die Bühne: eine Fläche wie die Karten, so breit wie die Knöpfe darunter. Sie misst ihre Breite, damit die Anweisung
     auch bei großer Systemschrift in eine Zeile passt (wie die Phase der Atemblüte). */
  .stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
    max-width: 400px;
    padding: 18px 12px 20px;
    border: 1px solid var(--surface-border);
    border-radius: 24px;
    background: var(--surface);
    container-type: inline-size;
  }

  .say {
    max-width: 100%;
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: min(1.9rem, 9.5cqw);
    line-height: 1.2;
    text-align: center;
    overflow-wrap: anywhere;
  }

  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    text-align: center;
  }

  .badge {
    display: grid;
    flex: none;
    place-items: center;
    width: 64px;
    height: 64px;
    margin-bottom: 4px;
    border-radius: 50%;
    background: var(--sky-mid);
    background: color-mix(in srgb, var(--accent) 14%, var(--sky-mid));
    color: var(--accent);
  }

  .badge.small {
    width: 40px;
    height: 40px;
    margin: 0;
  }

  .step-title {
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: min(1.75rem, 8.5cqw);
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .step-detail {
    color: var(--text-muted);
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .step-count {
    margin-top: 6px;
    color: var(--text-muted);
    font-size: 0.875rem;
    font-weight: 700;
  }

  .step-left {
    font-size: 1.5rem;
    font-weight: 300;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }

  /* Ring: die Schritte als ruhige Liste unter dem Ring. */
  .list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 400px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .list li {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .list-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.35;
  }

  .list-title {
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .list-detail {
    color: var(--text-muted);
    font-size: 0.9375rem;
    overflow-wrap: anywhere;
  }

  /* Restzeit groß links, rechts die Runde; darunter der Balken. */
  .clock {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 400px;
  }

  .clock-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  .remaining {
    font-size: 2.125rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }

  .round {
    color: var(--text-muted);
    font-size: 0.875rem;
    text-align: right;
  }

  .bar {
    height: 6px;
    border-radius: 3px;
    background: rgb(238 240 250 / 0.12);
    overflow: hidden;
  }

  .bar i {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 3px;
    background: var(--accent);
    transform-origin: left;
  }

  /* „Warum es wirkt“: eine Zeile als Knopf, aufgeklappt mit dem Wirkungsbild darunter. */
  .why {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 400px;
    border: 1px solid var(--surface-border);
    border-radius: 16px;
    background: var(--surface);
  }

  .why-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 52px;
    padding: 0 18px;
    border: 0;
    border-radius: 16px;
    background: none;
    color: var(--text);
    font-weight: 700;
    text-align: left;
  }

  .chevron {
    flex: none;
  }

  .why-body {
    padding: 0 18px 16px;
  }

  .source {
    max-width: 400px;
    color: var(--text-muted);
    font-size: 0.75rem;
    line-height: 1.4;
    text-align: center;
    overflow-wrap: anywhere;
  }

  @media (prefers-reduced-motion: no-preference) {
    .chevron {
      transition: transform 0.2s ease;
    }
  }

  .chevron.open {
    transform: rotate(180deg);
  }
</style>
