<script lang="ts">
  import { greetingFor } from '../lib/time/greeting'
  import type { TabId } from '../lib/ui/tabs'

  let { onNavigate }: { onNavigate: (tab: TabId) => void } = $props()

  const greeting = greetingFor(new Date())
</script>

<section class="screen">
  <header>
    <h1>{greeting}</h1>
    <p class="lead">Schön, dass du da bist.</p>
  </header>

  <div class="card">
    <h2>Zur Ruhe kommen</h2>
    <p class="hint">Ein sanfter Klang hilft beim Ankommen.</p>
    <button type="button" class="button" onclick={() => onNavigate('klaenge')}>Zu den Klängen</button>
  </div>
</section>

<style>
  .hint {
    color: var(--text-muted);
  }
</style>
