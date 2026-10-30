<script lang="ts">
  import { TABS, type TabId } from '../lib/ui/tabs'

  let { tab, onNavigate, armed }: { tab: TabId; onNavigate: (tab: TabId) => void; armed: boolean } = $props()
</script>

{#snippet icon(id: TabId)}
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {#if id === 'heute'}
      <!-- Sonne über dem Horizont -->
      <path d="M7.5 15.5a4.5 4.5 0 0 1 9 0" />
      <path d="M3 19.5h18" />
      <path d="M12 6V4M5.6 9.1 4.2 7.7M18.4 9.1l1.4-1.4M3.2 15.5H2M22 15.5h-1.2" />
    {:else if id === 'energie'}
      <!-- Blitz -->
      <path d="M13.4 3 6 13.6h5.3L10.3 21 18 10.4h-5.3L13.4 3Z" />
    {:else if id === 'meditieren'}
      <!-- Lotus -->
      <path d="M12 4.5c2.3 2.4 3.2 5.2 3.2 8 0 1.9-1.3 3.7-3.2 4.8-1.9-1.1-3.2-2.9-3.2-4.8 0-2.8.9-5.6 3.2-8Z" />
      <path d="M8.8 10.2C6.2 10.4 4.2 12 3.5 14.3c.6 2.3 2.6 3.9 5.5 4.2" />
      <path d="M15.2 10.2c2.6.2 4.6 1.8 5.3 4.1-.6 2.3-2.6 3.9-5.5 4.2" />
      <path d="M8.5 19.5h7" />
    {:else if id === 'atmen'}
      <!-- Atem / Wind -->
      <path d="M3 9h10.5a2.7 2.7 0 1 0-2.7-2.7" />
      <path d="M3 13h14.5a2.9 2.9 0 1 1-2.9 2.9" />
      <path d="M3 17h5.5" />
    {:else if id === 'klaenge'}
      <!-- Klangwellen -->
      <path d="M4 10v4M8 7.5v9M12 4.5v15M16 7.5v9M20 10v4" />
    {:else}
      <!-- Person -->
      <circle cx="12" cy="8.2" r="3.6" />
      <path d="M5 20c.3-3.7 3.1-6 7-6s6.7 2.3 7 6" />
    {/if}
  </svg>
{/snippet}

<nav aria-label="Hauptnavigation">
  {#each TABS as item (item.id)}
    {@const active = item.id === tab}
    <button
      type="button"
      class:active
      aria-current={active ? 'page' : undefined}
      disabled={!armed}
      onclick={() => onNavigate(item.id)}
    >
      <span class="icon">{@render icon(item.id)}</span>
      <span class="label">{item.label}</span>
    </button>
  {/each}
</nav>

<style>
  nav {
    position: fixed;
    inset: auto 0 0;
    z-index: 10;
    display: flex;
    height: var(--tabbar-offset);
    /* Buttons liegen in der Inhaltsspalte, der Balken selbst reicht über die volle Breite */
    padding: 0 max(8px, calc((100% - var(--column-width)) / 2)) env(safe-area-inset-bottom, 0px);
    background: rgb(11 16 38 / 0.82);
    border-top: 1px solid var(--surface-border);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
  }

  button {
    flex: 1 1 0;
    min-width: 0;
    min-height: 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 6px 0;
    border: 0;
    background: none;
    color: var(--text-muted);
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .icon {
    display: grid;
    place-items: center;
    width: 56px;
    height: 30px;
    border-radius: 15px;
  }

  button.active {
    color: var(--accent);
  }

  /* Der aktive Reiter leuchtet im Akzent der Stimmung (Spec M4 §4). */
  button.active .icon {
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    box-shadow: 0 0 22px color-mix(in srgb, var(--accent) 18%, transparent);
  }

  /* Sechs Reiter teilen sich die Leiste: „Meditieren“ braucht rund 4,9 × die Schriftgröße, ein Reiter ist auf einem
     412 px breiten Handy 66 px, auf einem 360 px breiten gut 57 px breit. Wächst die Schrift mit der Einstellung der
     Person (130 %), stieße „Meditieren“ an „Energie“. Darum ist die Größe der Beschriftung an die Breite ihres
     Reiters gebunden (1 cqi = 1 % seiner Breite): Bei normaler Schrift bleibt es bei 12 px, sie wächst nur so weit,
     wie sie in den Reiter passt. Unter 380 px Breite sind es 11 px (Spec M9 §3.1), wiederum höchstens so viel,
     wie passt. */
  button {
    container-type: inline-size;
  }

  .label {
    font-size: min(0.75rem, 19.5cqi);
  }

  @media (max-width: 379.98px) {
    .label {
      font-size: min(0.6875rem, 19.5cqi);
      letter-spacing: 0;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    button,
    .icon {
      transition:
        color 0.25s ease,
        background-color 0.25s ease,
        box-shadow 0.25s ease;
    }
  }
</style>
