<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import Motiv from '../Motiv.svelte'
  import { areaMotiv } from '../../lib/content/motive'
  import { areaLine } from '../../lib/energy/hack-view'
  import { pauseSuggestion } from '../../lib/energy/reset'
  import { FOCUS_MINUTES } from '../../lib/stats/schema'
  import { stats } from '../../lib/stats/store.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { openCheckIn } from '../../lib/ui/energy-ui.svelte'
  import { clearDone, startHack, type SessionDoneInfo } from '../../lib/ui/session-ui.svelte'

  // Das Ende eines Fokus-Sprints (Spec M9 §3.6, §6.7), statt `SessionDone` im Rahmen des Players: „Sprint geschafft“ mit
  // der tatsächlichen Zeit, ein Pausen-Vorschlag mit „Starten“ (ein Brain Hack), „Check-in“ und „Fertig“. Kürzer als 5
  // Minuten zeigt der Player gar kein Ende (er schließt), also steht hier immer ein gezählter Sprint.
  let { done }: { done: SessionDoneInfo } = $props()

  const id = $props.id()

  // Die gewählte Länge steht in der Kennung des Programms („focus-25“); sie bestimmt den Vorschlag ohne Check-in. Eine
  // andere Kennung gibt es nicht (sie käme nie als gezählter Sprint an); der Rückfall ist die Standardlänge 50.
  const planned = untrack(() => FOCUS_MINUTES.find((m) => done.ref === `focus-${m}`) ?? FOCUS_MINUTES[1])

  // Einmal beim Einblenden bestimmt, mit der Zeit dieses Moments: Käme mitten im Ansehen ein anderer Hack dran (ein
  // Check-in, der gerade frisch wird, oder ein Zeitfenster, das sich schließt), spränge der Vorschlag unter dem Finger.
  const pause = untrack(() => pauseSuggestion(planned, stats.data.energyCheckins ?? [], stats.data.hackRuns ?? [], new Date()))

  const minutes = $derived(Math.floor(done.seconds / 60))

  // Ein Doppeltipp auf „Beenden“ soll das Ende nicht gleich wieder schließen oder die Pause starten: Die Knöpfe nehmen
  // Tipps erst kurz nach dem Erscheinen an (siehe `tapArming`).
  const arming = tapArming()

  let heading = $state<HTMLElement>()

  // Die Laufansicht mit dem fokussierten Knopf ist weg: Der Fokus kommt auf die Überschrift.
  onMount(() => heading?.focus())

  // „Check-in“ und „Starten“ räumen das Ende zuerst ab: Der Player verschwindet, und das Blatt öffnet über dem Reiter statt
  // über einem Player; der Hack-Player löst den Sprint-Player ab. Beides im Tipp selbst (der Audio-Start braucht ihn).
  function checkIn() {
    clearDone()
    openCheckIn()
  }

  function startPause() {
    clearDone()
    startHack(pause.id)
  }
</script>

<div class="done">
  <div class="glow" aria-hidden="true"></div>
  <h2 tabindex="-1" bind:this={heading}>Sprint geschafft</h2>
  <p class="detail">{minutes} Min Fokus</p>

  <section class="card pause" aria-labelledby="{id}-pause" style:--area-text="var(--area-{pause.area}-text)">
    <h3 id="{id}-pause" class="kicker">Pausen-Vorschlag</h3>
    <div class="pick">
      <Motiv id={areaMotiv(pause.area)} size={56} />
      <div class="pick-text">
        <p class="name">{pause.title}</p>
        <p class="meta">{areaLine(pause)}</p>
      </div>
    </div>
    <button type="button" class="button-line start" disabled={!arming.armed} onclick={startPause}>Starten</button>
  </section>

  <div class="actions">
    <button type="button" class="button secondary" disabled={!arming.armed} onclick={checkIn}>Check-in</button>
    <button type="button" class="button" disabled={!arming.armed} onclick={clearDone}>Fertig</button>
  </div>
</div>

<style>
  .done {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    width: 100%;
    max-width: 420px;
    text-align: center;
  }

  /* Ein ruhiges Licht wie bei den anderen Abschlüssen (SessionDone): Zeichen für „geschafft“, ohne Jubel. */
  .glow {
    position: relative;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: radial-gradient(circle at 38% 36%, #fff4dc, var(--accent) 70%);
    box-shadow: 0 0 36px 8px color-mix(in srgb, var(--accent) 25%, transparent);
  }

  .glow::before {
    content: '';
    position: absolute;
    inset: -120px;
    z-index: -1;
    border-radius: 50%;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--accent) 14%, transparent), transparent);
  }

  h2 {
    font-size: clamp(1.625rem, 7vw, 2rem);
  }

  .detail {
    color: var(--accent);
    font-size: 1.25rem;
    font-weight: 700;
  }

  /* Die Pause als kleine Karte; ihr Bereichston steht als Schrift in `--area-text` (auf 4,5:1 abgestimmt). */
  .pause {
    width: 100%;
    gap: 12px;
    padding: 16px 18px;
    border-radius: 24px;
    text-align: left;
  }

  /* Kleine Überschrift in Versalien wie „Jetzt-Reset“ auf der Karte; die Größe setzt sie selbst. */
  .kicker {
    color: var(--accent);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    line-height: 1.3;
    text-transform: uppercase;
  }

  .pick {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
  }

  .pick-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .name {
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 1.25rem;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .meta {
    color: var(--area-text);
    font-size: 0.875rem;
    font-weight: 700;
    line-height: 1.4;
  }

  .start {
    width: 100%;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    max-width: 400px;
  }

  .actions .button {
    min-height: 56px;
  }

  @media (prefers-reduced-motion: no-preference) {
    .done {
      animation: done-in 0.6s ease-out both;
    }

    @keyframes done-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  }
</style>
