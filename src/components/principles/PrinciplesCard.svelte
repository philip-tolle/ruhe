<script lang="ts">
  import { tick } from 'svelte'
  import Motiv from '../Motiv.svelte'
  import { insightOfDay } from '../../lib/principles/logic'
  import { stats } from '../../lib/stats/store.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { appNow } from '../../lib/ui/tageszeit.svelte'

  // Karte „Deine Prinzipien“ (Spec M12 §2.2): die Erkenntnis des Tages oder ein Satz, dazu „Sammlung öffnen“. Kein Goldrand,
  // nichts zum Abhaken, kein Prinzip der Woche. Die Erkenntnis wechselt um Mitternacht ohne Neuladen (`appNow` in `$derived`).
  let { open, onOpen }: { open: boolean; onOpen: () => void } = $props()

  const id = $props.id()

  // Schließt der erste Tipp eines Doppeltipps die Sammlung (Tipp daneben über dem Knopf), öffnet der zweite sie nicht gleich
  // wieder: Die Sperre beginnt mit jedem Wechsel von `open` neu. Sie sperrt nur Tipps, der Knopf bleibt fokussierbar.
  const arming = tapArming(() => open)

  const collection = $derived(stats.data.collection ?? [])
  const insight = $derived(insightOfDay(collection, appNow()))

  let openButton = $state<HTMLButtonElement>()

  // Schließt die Sammlung, geht der Fokus an „Sammlung öffnen“ (Spec M12 §2.10), nach `tick()`, wenn das Blatt abgebaut ist;
  // beim Einhängen nicht.
  let wasOpen = false
  $effect(() => {
    const isOpen = open
    if (wasOpen && !isOpen) void tick().then(() => openButton?.focus())
    wasOpen = isOpen
  })

  function openCollection() {
    if (arming.armed) onOpen()
  }
</script>

<section class="card principles" aria-labelledby="{id}-title">
  <div class="head">
    <Motiv id="energie-sinn" size={56} />
    <h2 id="{id}-title">Deine Prinzipien</h2>
  </div>

  {#if insight}
    <div class="insight">
      <h3>Erkenntnis des Tages</h3>
      <p class="text">{insight.text}</p>
      {#if insight.source}
        <p class="source">Quelle: {insight.source}</p>
      {/if}
    </div>
  {:else if collection.length === 0}
    <p class="lead">Halte fest, was dich leitet, was du aus Büchern mitnimmst und woran du wachsen willst.</p>
  {:else}
    <p class="lead">Hier steht jeden Tag eine deiner Erkenntnisse, sobald du welche festhältst.</p>
  {/if}

  <button type="button" class="button-line open" bind:this={openButton} onclick={openCollection}>Sammlung öffnen</button>
</section>

<style>
  .principles {
    width: 100%;
  }

  /* Das Motiv links neben dem Titel; der Titel bricht notfalls um, das Motiv behält seine Fläche. */
  .head {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }

  .head h2 {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .insight {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    width: 100%;
  }

  h3 {
    color: var(--text-muted);
    font-family: var(--font-body), system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    line-height: 1.3;
    text-transform: uppercase;
  }

  /* Der volle Text, auch ein langes Wort ohne Leerzeichen bricht um. */
  .text,
  .lead {
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .text {
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 1.0625rem;
  }

  .lead,
  .source {
    color: var(--text-muted);
  }

  .source {
    font-size: 0.9375rem;
    overflow-wrap: anywhere;
  }

  .open {
    width: 100%;
  }
</style>
