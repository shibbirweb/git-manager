<!-- Match Case, Words and Regex toggles shown inside a search field (editor find bar, Find in Files). -->
<script lang="ts">
  interface ToggleOptions {
    matchCase: boolean;
    wholeWords: boolean;
    regex: boolean;
  }

  let {
    options,
    onToggle,
    compact = false,
  }: { options: ToggleOptions; onToggle: (option: keyof ToggleOptions) => void; compact?: boolean } = $props();

  const toggles: { option: keyof ToggleOptions; label: string; title: string }[] = [
    { option: "matchCase", label: "Cc", title: "Match Case (Option+C)" },
    { option: "wholeWords", label: "W", title: "Words (Option+W)" },
    { option: "regex", label: ".*", title: "Regex (Option+X)" },
  ];
</script>

<div class="toggles" class:compact>
  {#each toggles as toggle (toggle.option)}
    <button
      type="button"
      class="toggle"
      class:on={options[toggle.option]}
      aria-pressed={options[toggle.option]}
      title={toggle.title}
      onmousedown={(event) => event.preventDefault()}
      onclick={() => onToggle(toggle.option)}>{toggle.label}</button
    >
  {/each}
</div>

<style>
  .toggles {
    flex: none;
    display: flex;
    gap: 2px;
  }

  .toggle {
    min-width: 26px;
    height: 24px;
    padding: 0 5px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: var(--text-dim);
    font-family: var(--font-mono);
    font-size: 11.5px;
    cursor: pointer;
  }

  .compact .toggle {
    min-width: 20px;
    height: 18px;
    padding: 0 3px;
    border-radius: 3px;
    font-size: 10.5px;
    line-height: 16px;
  }

  .toggle:hover {
    background: var(--hover);
    color: var(--text);
  }

  .toggle.on {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--selected);
  }
</style>
