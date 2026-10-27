<script lang="ts">
  import type { EnergyArea } from '../../lib/energy/areas'

  // Der Chip „Geist · 3 Min“ auf Hack-Karte und im Player (Spec M9 §3.4, §3.5): ein Punkt in der Bereichsfarbe und die
  // Zeile in ihrer Textfarbe (`--area-*-text`, auf 4,5:1 abgestimmt), auf einer deckenden Fläche aus Bereichsfarbe und
  // Himmel der Stimmung, damit der Kontrast nicht vom Untergrund abhängt. Der Name des Bereichs steht immer im Text.
  let { area, label }: { area: EnergyArea; label: string } = $props()
</script>

<span class="chip" style:--area="var(--area-{area})" style:--area-text="var(--area-{area}-text)">
  <i aria-hidden="true"></i>{label}
</span>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    padding: 0 14px;
    border-radius: 999px;
    /* Ohne color-mix() bleibt die Fläche der Himmel der Stimmung, deckend; die Schrift trägt sich selbst. */
    background: var(--sky-mid);
    background: color-mix(in srgb, var(--area) 14%, var(--sky-mid));
    color: var(--area-text);
    font-size: 0.875rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .chip i {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--area);
  }
</style>
