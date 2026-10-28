<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import LevelDots from '../energy/LevelDots.svelte'
  import { AREA_INFO, type EnergyLevel } from '../../lib/energy/areas'
  import { hackById } from '../../lib/energy/hacks'
  import { setHackEffect, stats } from '../../lib/stats/store.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { morningContinueAfterHack, morningUi } from '../../lib/ui/morning-ui.svelte'
  import { clearDone, startHack, type SessionDoneInfo } from '../../lib/ui/session-ui.svelte'
  import { vibrate } from '../../lib/ui/vibrate'

  // Das Ende eines Brain Hacks (Spec M9 §3.5, §6.2), statt `SessionDone` im Rahmen des Players: „Geschafft“ und die Frage
  // nach der Wirkung. Kam der Vorher-Wert schon aus einem Check-in (höchstens 2 Stunden vor dem Start), fragt eine Reihe
  // „{Bereich} jetzt?“, sonst zwei, „vorher“ und „jetzt“. Beides ist freiwillig; ein Tipp speichert sofort, derselbe
  // Punkt noch einmal nimmt zurück, „Fertig“ schließt nur. Die Werte stehen am gespeicherten Lauf; die Ansicht liest sie von dort.
  // Wartet der Morgen-Start auf diesen Hack (Spec M10 §2.3), steht statt „Fertig“ und „Noch einmal“ ein „Weiter“: Es schließt
  // das Ende und führt den Ablauf zum nächsten Schritt.
  let { done }: { done: SessionDoneInfo } = $props()

  type Which = 'before' | 'after'

  const run = $derived(stats.data.hackRuns?.find((r) => r.id === done.sessionId))
  const area = $derived(run?.area ?? hackById(done.ref)?.area ?? null)
  // Einmal beim Einblenden entschieden: Tippt jemand in der Zeile „vorher“, trägt der Lauf danach einen Vorher-Wert,
  // und aus zwei Zeilen würde mitten im Tippen eine.
  const single = untrack(() => run?.before !== undefined)
  // Nicht eingefroren wie `single`: Der Ablauf setzt das Warten zurück, wenn „Weiter“ getippt ist (dann verschwindet die Ansicht ohnehin).
  const inMorning = $derived(morningUi.awaiting === 'hack')

  // Der letzte Tipp auf „Beenden“ (Doppeltipp) träfe sonst einen Punkt, der sich gerade dorthin legt (siehe `tapArming`).
  const arming = tapArming()

  function choose(which: Which, level: EnergyLevel) {
    if (run) setHackEffect(run.id, which, run[which] === level ? null : level)
  }

  let title = $state<HTMLElement>()

  // Die Laufansicht mit dem fokussierten Knopf ist weg: Der Fokus kommt auf die Überschrift. Ende des Hacks:
  // Vibrieren, wenn es an ist (Spec §3.5), zusammen mit der Klangschale.
  onMount(() => {
    title?.focus()
    vibrate(200)
  })
</script>

{#snippet row(which: Which, caption: string, label: string)}
  {#if area}
    <div class="row">
      <p class="head">{caption}</p>
      <LevelDots {area} value={run?.[which] ?? null} {label} disabled={!arming.armed} onPick={(level) => choose(which, level)} />
    </div>
  {/if}
{/snippet}

<div class="done">
  <div class="glow" aria-hidden="true"></div>
  <h2 tabindex="-1" bind:this={title}>Geschafft</h2>

  {#if area}
    {@const name = AREA_INFO[area].title}
    <div class="card effect">
      {#if single}
        {@render row('after', `${name} jetzt?`, `${name} jetzt`)}
      {:else}
        {@render row('before', 'vorher', `${name} vorher`)}
        {@render row('after', 'jetzt', `${name} jetzt`)}
      {/if}
    </div>
  {/if}

  <div class="actions">
    {#if inMorning}
      <button type="button" class="button" disabled={!arming.armed} onclick={morningContinueAfterHack}>Weiter</button>
    {:else}
      <button type="button" class="button" disabled={!arming.armed} onclick={clearDone}>Fertig</button>
      <button type="button" class="button secondary" disabled={!arming.armed} onclick={() => startHack(done.ref)}>Noch einmal</button>
    {/if}
  </div>
  {#if area}
    <p class="skip">Ohne Antwort einfach „{inMorning ? 'Weiter' : 'Fertig'}“.</p>
  {/if}
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

  /* Jede Reihe über einer feinen Goldlinie, die erste ohne; wie im Check-in-Blatt. */
  .effect {
    width: 100%;
    gap: 0;
    padding: 6px 16px 10px;
    border-radius: 24px;
    text-align: left;
  }

  .row {
    width: 100%;
    padding-top: 10px;
    border-top: 1px solid var(--gold-line);
  }

  .row:first-child {
    border-top: 0;
  }

  .head {
    margin: 0 0 4px;
    font-size: 0.9375rem;
    font-weight: 700;
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

  /* Rückt an die Knöpfe heran: leise, nur ein Hinweis, dass die Frage freiwillig ist. */
  .skip {
    margin-top: -10px;
    color: var(--text-muted);
    font-size: 0.8125rem;
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
