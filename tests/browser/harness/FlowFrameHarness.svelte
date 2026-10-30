<script lang="ts">
  // Prüfstand für `FlowFrame` (tests/browser/flow-frame.test.ts): hält Schritt und Rückfrage als Zustand, wie es ein Ablauf
  // tut, und reicht einen einfachen Schritt mit Überschrift hinein.
  import FlowFrame from '../../../src/components/flow/FlowFrame.svelte'

  let { onSkip, onClose, initial = 'a' }: { onSkip: () => void; onClose: () => void; initial?: string } = $props()

  // svelte-ignore state_referenced_locally
  let step = $state(initial)
  let confirming = $state(false)

  export function go(next: string): void {
    step = next
  }

  export function isConfirming(): boolean {
    return confirming
  }
</script>

<FlowFrame
  label="Test-Ablauf"
  closeLabel="Test-Ablauf beenden"
  confirmTitle="Test-Ablauf beenden?"
  steps={['a', 'b', 'c']}
  {step}
  bind:confirming
  {onSkip}
  {onClose}
>
  <div class="step">
    <div class="content">
      <h2 class="title" tabindex="-1" data-step-title>Schritt {step}</h2>
    </div>
  </div>
</FlowFrame>
