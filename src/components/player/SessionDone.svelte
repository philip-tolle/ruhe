<script lang="ts">
  import { onMount } from 'svelte'
  import type { SessionKind } from '../../lib/stats/schema'

  let {
    kind,
    seconds,
    counted,
    onDone,
  }: { kind: SessionKind; seconds: number; counted: boolean; onDone: () => void } = $props()

  interface Texts {
    heading: string
    minutes: (n: number) => string
  }

  const TIMER: Texts = {
    heading: 'Schön, dass du dir die Zeit genommen hast.',
    minutes: (n) => `${n} Min meditiert`,
  }

  const BREATH: Texts = {
    heading: 'Gut gemacht.',
    minutes: (n) => `${n} Min geatmet`,
  }

  // Texte je Art der Sitzung; eine geführte Meditation ist Meditieren wie der Timer.
  const TEXTS: Record<SessionKind, Texts> = { timer: TIMER, guided: TIMER, breath: BREATH }

  const texts = $derived(TEXTS[kind])
  const detail = $derived(
    counted ? texts.minutes(Math.floor(seconds / 60)) : 'Unter einer Minute – das zählt noch nicht für die Statistik.',
  )

  let heading = $state<HTMLElement>()

  // Die Laufansicht mit dem fokussierten Knopf ist weg: Der Fokus kommt auf die Überschrift.
  onMount(() => heading?.focus())
</script>

<div class="done">
  <div class="glow" aria-hidden="true"></div>
  <h2 tabindex="-1" bind:this={heading}>{texts.heading}</h2>
  <p class="detail" class:counted>{detail}</p>
  <button type="button" class="button" onclick={() => onDone()}>Fertig</button>
</div>

<style>
  .done {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    width: 100%;
    max-width: 420px;
    text-align: center;
  }

  /* Ein ruhiges Licht wie der Mond über dem See: Zeichen für „geschafft“, ohne Jubel. */
  .glow {
    position: relative;
    width: 88px;
    height: 88px;
    margin-bottom: 12px;
    border-radius: 50%;
    background: radial-gradient(circle at 38% 36%, #fff4dc, var(--accent) 70%);
    box-shadow: 0 0 36px 8px rgb(242 201 138 / 0.25);
  }

  /* weiter Lichthof als Verlauf; ein so großer Schatten zeigte an seinem Rand eine Kante */
  .glow::before {
    content: '';
    position: absolute;
    inset: -120px;
    z-index: -1;
    border-radius: 50%;
    background: radial-gradient(closest-side, rgb(242 201 138 / 0.14), transparent);
  }

  h2 {
    font-size: clamp(1.625rem, 7vw, 2rem);
  }

  .detail {
    color: var(--text-muted);
  }

  .detail.counted {
    color: var(--accent);
    font-size: 1.25rem;
    font-weight: 700;
  }

  .button {
    min-width: 12rem;
    margin-top: 16px;
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
