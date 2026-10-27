<script module lang="ts">
  import type { EnergyArea } from '../../lib/energy/areas'

  // Der Filter gilt für die Sitzung (Spec M9 §3.2): Er überlebt den Wechsel der Reiter, in denen diese Komponente
  // abgebaut wird, aber nicht ein Neuladen. Darum Zustand des Moduls und nicht der Komponente.
  let filter = $state<'alle' | EnergyArea>('alle')
</script>

<script lang="ts">
  import ChoiceGroup from '../ChoiceGroup.svelte'
  import Motiv from '../Motiv.svelte'
  import { areaMotiv } from '../../lib/content/motive'
  import { AREAS, AREA_INFO } from '../../lib/energy/areas'
  import { areaLine } from '../../lib/energy/hack-view'
  import { HACKS } from '../../lib/energy/hacks'
  import { whatWorks } from '../../lib/energy/insights'
  import { stats } from '../../lib/stats/store.svelte'
  import { openHackCard } from '../../lib/ui/energy-ui.svelte'

  // Bibliothek „Brain Hacks“ (Spec M9 §3.2): alle Hacks als Kacheln in zwei Spalten, nach Bereich filterbar. Sie kennt
  // keine Zeitfenster: Auch die Power-Pause um zehn Uhr ist startbar, nur der Jetzt-Reset schlägt sie dann nicht vor.
  // Eine Kachel öffnet die Hack-Karte.
  const FILTERS: { value: 'alle' | EnergyArea; label: string }[] = [
    { value: 'alle', label: 'Alle' },
    ...AREAS.map((area) => ({ value: area, label: AREA_INFO[area].title })),
  ]

  const shown = $derived(filter === 'alle' ? HACKS : HACKS.filter((h) => h.area === filter))
  const works = $derived(new Set(whatWorks(stats.data.hackRuns ?? []).map(({ hack }) => hack.id)))
</script>

<section class="library" aria-labelledby="library-title">
  <div>
    <h2 id="library-title">Brain Hacks</h2>
    <span class="rule" aria-hidden="true"></span>
  </div>

  <!-- Fünf kurze Chips sollen auf Telefonbreite (auch 360 px) in eine Zeile passen; sie wachsen nicht, bei großer Schrift
       brechen sie um, und ein einzelner Chip in der letzten Zeile bleibt so klein wie die anderen. -->
  <div class="filter">
    <ChoiceGroup label="Bereich" options={FILTERS} value={filter} onSelect={(value) => (filter = value)} />
  </div>

  <!-- Die ganze Kachel ist der Knopf; sein Name ist der sichtbare Text, das Motiv ist Schmuck. -->
  <ul class="tiles" role="list">
    {#each shown as hack (hack.id)}
      <li>
        <button type="button" class="card tile" style:--area-text="var(--area-{hack.area}-text)" onclick={() => openHackCard(hack.id)}>
          <Motiv id={areaMotiv(hack.area)} size={40} />
          <span class="title">{hack.title}</span>
          <span class="meta">{areaLine(hack)}</span>
          {#if works.has(hack.id)}
            <span class="works">wirkt bei dir</span>
          {/if}
        </button>
      </li>
    {/each}
  </ul>
</section>

<style>
  .library {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .filter {
    font-size: 0.9375rem;
    --choice-min: 2.75rem;
    --choice-flex: 0 0 auto;
    --choice-padding: 8px;
  }

  /* Zwei Spalten gleicher Breite; die beiden Kacheln einer Zeile sind gleich hoch. `minmax(0, 1fr)`: Ein langes Wort
     weitet die Spalte nicht über den Bildschirm hinaus. */
  .tiles {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tiles li {
    display: flex;
  }

  /* Die Kachel im Aussehen der Karte, kompakt: oben das kleine Motiv, darunter Titel und Zeile. */
  .tile {
    flex: 1;
    align-items: flex-start;
    gap: 4px;
    min-width: 0;
    min-height: 96px;
    padding: 14px;
    border-radius: 20px;
    box-shadow: 0 10px 28px rgb(5 8 24 / 0.28);
    color: var(--text);
    text-align: left;
  }

  .tile:active {
    transform: scale(0.98);
  }

  .title {
    margin-top: 4px;
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 1.0625rem;
    line-height: 1.2;
    letter-spacing: -0.01em;
    overflow-wrap: anywhere;
    hyphens: auto;
  }

  .meta,
  .works {
    color: var(--area-text);
    font-size: 0.8125rem;
    font-weight: 700;
    line-height: 1.35;
  }

  .works {
    color: var(--accent);
  }

  @media (prefers-reduced-motion: no-preference) {
    .tile {
      transition: transform 0.15s ease;
    }
  }
</style>
