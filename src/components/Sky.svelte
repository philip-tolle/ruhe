<script lang="ts">
  import { createRng } from '../lib/random'

  // Feste Sterne: gleiche Positionen bei jedem Start (Seed 7).
  const round = (value: number, digits = 2) => Number(value.toFixed(digits))
  const rng = createRng(7)
  const stars = Array.from({ length: 40 }, () => ({
    x: round(rng() * 100),
    y: round(rng() * 64),
    size: round(1 + rng() * 1.6),
    opacity: round(0.4 + rng() * 0.5),
    delay: round(rng() * 8),
    duration: round(3 + rng() * 4),
    warm: rng() > 0.82,
  }))
</script>

<div class="sky" aria-hidden="true">
  <div class="glow"></div>

  {#each stars as star}
    <span
      class="star"
      class:warm={star.warm}
      style="left: {star.x}%; top: {star.y}%; width: {star.size}px; height: {star.size}px; --o: {star.opacity}; animation-delay: -{star.delay}s; animation-duration: {star.duration}s;"
    ></span>
  {/each}

  <div class="moon"></div>

  <svg class="land" viewBox="0 0 800 400" preserveAspectRatio="xMidYMax slice" focusable="false">
    <defs>
      <linearGradient id="lake-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2d2757" />
        <stop offset="1" stop-color="#0d1129" />
      </linearGradient>
      <linearGradient id="far-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3a3163" />
        <stop offset="1" stop-color="#2a2552" />
      </linearGradient>
      <linearGradient id="glint-fill" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#f2c98a" stop-opacity="0" />
        <stop offset="0.5" stop-color="#f2c98a" stop-opacity="0.4" />
        <stop offset="1" stop-color="#f2c98a" stop-opacity="0" />
      </linearGradient>
      <clipPath id="lake-clip">
        <rect x="0" y="264" width="800" height="136" />
      </clipPath>
      <path
        id="far-range"
        d="M0 264 V204 C46 198 84 168 134 164 C186 160 212 192 262 198 C318 205 350 134 410 118 C456 106 482 146 524 166 C580 192 616 156 672 146 C726 136 764 178 800 184 V264 Z"
      />
      <path
        id="near-range"
        d="M0 264 V226 C58 220 108 198 170 202 C236 206 268 244 336 242 C406 240 438 200 508 194 C578 188 618 226 688 224 C740 222 772 208 800 204 V264 Z"
      />
    </defs>

    <use href="#far-range" fill="url(#far-fill)" />
    <use href="#near-range" fill="#171a3d" />

    <rect x="0" y="264" width="800" height="136" fill="url(#lake-fill)" />

    <g clip-path="url(#lake-clip)">
      <g transform="matrix(1 0 0 -1 0 528)" opacity="0.3">
        <use href="#far-range" fill="url(#far-fill)" />
        <use href="#near-range" fill="#171a3d" />
      </g>
      <g class="shimmer" fill="url(#glint-fill)">
        <rect x="352" y="276" width="96" height="3" rx="1.5" opacity="0.3" />
        <rect x="330" y="290" width="140" height="3" rx="1.5" opacity="0.26" />
        <rect x="362" y="304" width="76" height="3" rx="1.5" opacity="0.28" />
        <rect x="310" y="320" width="180" height="3" rx="1.5" opacity="0.18" />
        <rect x="346" y="338" width="108" height="3" rx="1.5" opacity="0.2" />
      </g>
    </g>
  </svg>
</div>

<style>
  .sky {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
    background: linear-gradient(
      to bottom,
      var(--sky-top) 0%,
      var(--sky-mid) 52%,
      var(--sky-bottom) 90%
    );
  }

  /* Warmer Schimmer am Horizont */
  .glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      90% 28% at 50% 80%,
      rgb(242 201 138 / 0.16),
      transparent 70%
    );
  }

  .star {
    position: absolute;
    border-radius: 50%;
    background: var(--text);
    opacity: var(--o);
  }

  .star.warm {
    background: var(--accent);
  }

  .moon {
    position: absolute;
    top: 7%;
    right: 10%;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: radial-gradient(circle at 36% 34%, #fff4dc, var(--accent) 72%);
    box-shadow:
      0 0 24px 6px rgb(242 201 138 / 0.28),
      0 0 90px 30px rgb(242 201 138 / 0.12);
  }

  .land {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: min(52vh, 460px);
    /* weicher Auslauf nach oben, falls der Ausschnitt die Gipfel kappt */
    -webkit-mask-image: linear-gradient(to top, #000 88%, transparent);
    mask-image: linear-gradient(to top, #000 88%, transparent);
  }

  @media (prefers-reduced-motion: no-preference) {
    .star {
      animation-name: twinkle;
      animation-timing-function: ease-in-out;
      animation-iteration-count: infinite;
      animation-direction: alternate;
    }

    .shimmer {
      animation: shimmer 7s ease-in-out infinite alternate;
    }

    @keyframes twinkle {
      from {
        opacity: var(--o);
      }
      to {
        opacity: calc(var(--o) * 0.25);
      }
    }

    @keyframes shimmer {
      from {
        opacity: 1;
      }
      to {
        opacity: 0.45;
      }
    }
  }
</style>
