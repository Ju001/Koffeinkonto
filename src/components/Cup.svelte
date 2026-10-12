<script lang="ts">
  let { onclick, disabled = false }: { onclick: () => void; disabled?: boolean } = $props();

  function press() {
    navigator.vibrate?.(15);
    onclick();
  }
</script>

<button class="cup" type="button" aria-label="Drink a coffee" {disabled} onclick={press}>
  <svg viewBox="0 -14 170 164" aria-hidden="true" focusable="false">
    <ellipse cx="85" cy="128" rx="74" ry="14" fill="var(--surface-edge)" />
    <ellipse cx="85" cy="122" rx="66" ry="11" fill="var(--surface)" />
    <path d="M34 50h92v34a46 38 0 0 1-92 0z" fill="#1f5e4b" />
    <path
      d="M126 58h12a16 16 0 0 1 0 32h-16"
      fill="none"
      stroke="#1f5e4b"
      stroke-width="9"
      stroke-linecap="round"
    />
    <ellipse cx="80" cy="50" rx="46" ry="9" fill="var(--crema)" />
    <g class="steam">
      <path d="M60 36c-9-8 9-13 0-22s9-12 0-20" />
      <path d="M82 36c-9-8 9-13 0-22s9-12 0-20" />
      <path d="M104 36c-9-8 9-13 0-22s9-12 0-20" />
    </g>
  </svg>
</button>

<style>
  .cup {
    width: min(70vw, 240px);
    min-width: 160px;
    padding: 0;
    border: 0;
    background: none;
    -webkit-tap-highlight-color: transparent;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    transform-origin: 50% 90%;
    transition: transform 0.12s ease-out;
  }

  .cup:active:not(:disabled) svg {
    transform: scale(0.94) translateY(3px);
  }

  @media (prefers-reduced-motion: reduce) {
    .cup:active:not(:disabled) svg {
      transform: none;
    }
  }

  .steam path {
    fill: none;
    stroke: var(--steam);
    stroke-width: 5;
    stroke-linecap: round;
    transform-box: fill-box;
    transform-origin: 50% 100%;
    animation: wave 2.4s ease-in-out infinite alternate;
  }

  .steam path:nth-child(2) {
    animation-duration: 2.9s;
    animation-delay: -1.1s;
  }

  .steam path:nth-child(3) {
    animation-duration: 2.1s;
    animation-delay: -0.6s;
  }

  @keyframes wave {
    from {
      transform: translateX(-3px) scaleY(0.92) skewX(-8deg);
    }
    to {
      transform: translateX(3px) scaleY(1.08) skewX(8deg);
    }
  }
</style>
