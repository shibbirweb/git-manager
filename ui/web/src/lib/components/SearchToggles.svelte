<!-- Match Case, Words and Regex toggles inside a search field (editor find bar, Find in Files). Pass tooltips with
     their keys from localKeys(...) in `titles`; never type keys by hand. -->
<script lang="ts">
  export interface SearchOptions {
    matchCase: boolean;
    wholeWords: boolean;
    regex: boolean;
  }

  interface Props {
    options: SearchOptions;
    compact?: boolean;
    titles?: Partial<Record<keyof SearchOptions, string>>;
    onchange?: (options: SearchOptions) => void;
  }

  let { options = $bindable(), compact = false, titles = {}, onchange }: Props = $props();

  const TOGGLES: { option: keyof SearchOptions; label: string; title: string }[] = [
    { option: "matchCase", label: "Cc", title: "Match Case" },
    { option: "wholeWords", label: "W", title: "Words" },
    { option: "regex", label: ".*", title: "Regex" },
  ];

  function toggle(option: keyof SearchOptions): void {
    options = { ...options, [option]: !options[option] };
    onchange?.(options);
  }
</script>

<div class="toggles" class:compact>
  {#each TOGGLES as entry (entry.option)}
    <button
      type="button"
      class="toggle"
      class:on={options[entry.option]}
      aria-pressed={options[entry.option]}
      aria-label={entry.title}
      title={titles[entry.option] ?? entry.title}
      onmousedown={(event) => event.preventDefault()}
      onclick={() => toggle(entry.option)}>{entry.label}</button
    >
  {/each}
</div>

<style>
  .toggles {
    flex: none;
    display: flex;
    gap: var(--space-1);
  }

  .toggle {
    min-width: var(--search-toggles-width);
    height: var(--search-toggles-height);
    padding: 0 var(--search-toggles-padding-x);
    border: 1px solid transparent;
    border-radius: var(--search-toggles-radius);
    background: transparent;
    color: var(--text-dim);
    font-family: var(--font-mono);
    font-size: var(--font-size-compact);
    cursor: pointer;
  }

  .compact .toggle {
    min-width: var(--search-toggles-compact-width);
    height: var(--search-toggles-compact-height);
    padding: 0 var(--search-toggles-compact-padding-x);
    border-radius: var(--search-toggles-compact-radius);
    font-size: var(--font-size-mini);
    line-height: var(--search-toggles-line-height);
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
