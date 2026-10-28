<script lang="ts">
  import Motiv from '../Motiv.svelte'
  import AreaChip from '../energy/AreaChip.svelte'
  import { areaMotiv } from '../../lib/content/motive'
  import { areaLine, startLabel } from '../../lib/energy/hack-view'
  import { hackById } from '../../lib/energy/hacks'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { morningUi, startExercise, swapExercise } from '../../lib/ui/morning-ui.svelte'

  // Schritt 2, „Aktivieren“ (Spec M10 §2.3): die Übung des Tages als Karte, „Starten“ spielt sie im Hack-Player, „Andere
  // Übung“ nimmt die nächste. Das „Weiter“ des Check-ins lag dort, wo jetzt „Starten“ steht: Ein Doppeltipp darauf
  // startete sonst gleich die Übung. Beide Knöpfe nehmen darum erst nach kurzer Zeit Tipps an (siehe `tapArming`).
  // Die Karte nennt auch den Hinweis der Übung: Wer von hier startet, sieht die Hack-Karte (mit dem Hinweis vor den
  // Schritten) nie.
  const id = $props.id()
  const arming = tapArming()

  const hack = $derived(hackById(morningUi.exercise))
</script>

<div class="step">
  <div class="content">
    <header class="head">
      <p class="kicker">Aktivieren</p>
      <h2 class="title" tabindex="-1" data-step-title>Wach werden</h2>
      <p class="lead">Erst der Körper, dann der Kopf.</p>
    </header>

    {#if hack}
      <section class="card exercise" aria-labelledby="{id}-name">
        <div class="top">
          <div class="meta">
            <AreaChip area={hack.area} label={areaLine(hack)} />
            <h3 id="{id}-name">{hack.title}</h3>
          </div>
          <Motiv id={areaMotiv(hack.area)} size={72} />
        </div>

        <p class="benefit">{hack.benefit}</p>

        <ol class="steps" role="list">
          {#each hack.steps as step, i (i)}
            <li>
              <span class="num" aria-hidden="true">{i + 1}</span>
              <span class="step-text">
                <span class="step-title">{step.title}</span>
                <span class="step-detail">{step.detail}</span>
              </span>
            </li>
          {/each}
        </ol>

        {#if hack.caution}
          <p class="caution"><strong>Hinweis</strong> {hack.caution}</p>
        {/if}
      </section>
    {/if}
  </div>

  <div class="foot">
    {#if hack}
      <button type="button" class="button" disabled={!arming.armed} onclick={() => startExercise(hack.id)}>{startLabel(hack)}</button>
    {/if}
    <button type="button" class="button-line" disabled={!arming.armed} onclick={swapExercise}>Andere Übung</button>
  </div>
</div>

<style>
  .exercise {
    width: 100%;
    gap: 14px;
    padding: 18px;
    border-radius: 22px;
  }

  /* Chip und Titel links, das Motiv des Bereichs rechts; lange Wörter brechen um, statt ins Motiv zu laufen. */
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    width: 100%;
  }

  .meta {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    min-width: 0;
  }

  .meta h3 {
    font-size: 1.375rem;
    line-height: 1.2;
    overflow-wrap: anywhere;
    hyphens: auto;
  }

  .benefit {
    font-size: 0.9375rem;
    line-height: 1.45;
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .steps li {
    display: flex;
    gap: 12px;
  }

  .num {
    flex: none;
    min-width: 1ch;
    font-weight: 700;
  }

  .step-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .step-title {
    font-weight: 700;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .step-detail {
    color: var(--text-muted);
    font-size: 0.9375rem;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .caution {
    color: var(--text-muted);
    font-size: 0.875rem;
    line-height: 1.45;
  }

  .caution strong {
    color: var(--text);
  }
</style>
