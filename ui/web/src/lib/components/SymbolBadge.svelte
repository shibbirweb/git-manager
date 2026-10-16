<!-- A one-letter badge for a code symbol's kind (C class, I interface, F function, K constant...), in the syntax
     color of its group: `tone` type, interface, function or constant. -->
<script lang="ts">
  interface Props {
    letter: string;
    tone: "type" | "interface" | "function" | "constant";
    title?: string;
  }

  let { letter, tone, title }: Props = $props();
</script>

<span class="badge {tone}" {title}>{letter}</span>

<style>
  .badge {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--symbol-badge-size);
    height: var(--symbol-badge-size);
    border-radius: var(--symbol-badge-radius);
    font-family: var(--font-family-mono);
    font-size: var(--font-size-micro);
    font-weight: var(--font-weight-bold);
    color: var(--panel);
  }

  .type {
    background: var(--tok-type);
  }

  .interface {
    background: var(--tok-keyword);
  }

  .function {
    background: var(--tok-function);
  }

  .constant {
    background: var(--tok-property);
  }
</style>
