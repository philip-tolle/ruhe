<script lang="ts">
  import { applyUpdate } from '../lib/pwa/update.svelte'
</script>

<!-- Ruhiger Hinweis über der Reiterleiste. App.svelte zeigt ihn nur im Leerlauf, also nie neben dem Mini-Player. -->
<div class="toast" role="status">
  <button type="button" onclick={() => void applyUpdate()}>Neue Version – tippen zum Aktualisieren</button>
</div>

<style>
  /* Die äußere Fläche reicht über die Breite, nimmt aber keine Berührungen an; nur der Hinweis selbst. */
  .toast {
    position: fixed;
    inset: auto 0 calc(var(--tabbar-offset) + var(--miniplayer-gap));
    z-index: 9;
    display: flex;
    justify-content: center;
    padding: 0 var(--gutter);
    pointer-events: none;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    max-width: min(100%, var(--column-width));
    padding: 8px 20px;
    border: 1px solid rgb(242 201 138 / 0.28);
    border-radius: 999px;
    background: rgb(27 35 80 / 0.92);
    color: var(--text);
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1.3;
    text-align: center;
    box-shadow:
      0 10px 32px rgb(5 8 24 / 0.5),
      0 0 28px rgb(242 201 138 / 0.1);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    pointer-events: auto;
  }

  /* kleiner Lichtpunkt als Zeichen für „etwas Neues“ */
  button::before {
    content: '';
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 10px rgb(242 201 138 / 0.7);
  }

  @media (prefers-reduced-motion: no-preference) {
    .toast {
      animation: toast-in 0.4s ease-out both;
    }

    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  }
</style>
