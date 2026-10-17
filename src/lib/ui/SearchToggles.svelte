<!-- Match Case, Words and Regex toggles shown inside a search field (editor find bar, Find in Files), on the UI
     library's SearchToggles; callers toggle one option at a time. -->
<script lang="ts">
  import LibrarySearchToggles from "@nibtree/ui/components/SearchToggles.svelte";
  import { localKeys } from "$lib/commands/commandRuntime";

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

  const titles = $derived({
    matchCase: `Match Case (${localKeys("Alt+C")})`,
    wholeWords: `Words (${localKeys("Alt+W")})`,
    regex: `Regex (${localKeys("Alt+X")})`,
  });

  function changed(next: ToggleOptions): void {
    const option = (Object.keys(next) as (keyof ToggleOptions)[]).find((key) => next[key] !== options[key]);
    if (option) {
      onToggle(option);
    }
  }
</script>

<LibrarySearchToggles options={{ ...options }} {compact} {titles} onchange={changed} />
