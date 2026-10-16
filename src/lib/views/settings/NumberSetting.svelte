<!-- A number field for a setting: what is typed stays a draft until Enter or leaving the field applies it. -->
<script lang="ts">
  import Input from "@git-manager/ui/components/Input.svelte";

  interface Props {
    value: number;
    min: number;
    max: number;
    step?: number;
    label: string;
    /** The typed number (null when empty or not a number); the owner clamps and saves it. */
    onapply: (typed: number | null) => void;
  }

  let { value, min, max, step = 1, label, onapply }: Props = $props();

  let draft = $state("");
  $effect(() => {
    draft = String(value);
  });

  function apply(): void {
    const typed = draft.trim() === "" ? null : Number(draft);
    onapply(typed !== null && Number.isFinite(typed) ? typed : null);
    draft = String(value);
  }
</script>

<Input
  type="number"
  mono
  width="number"
  value={draft}
  inputmode="numeric"
  {min}
  {max}
  {step}
  aria-label={label}
  oninput={(event) => (draft = event.currentTarget.value)}
  onchange={apply}
  onkeydown={(event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      apply();
    }
  }}
/>
