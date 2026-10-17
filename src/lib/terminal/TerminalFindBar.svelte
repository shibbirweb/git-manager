<!--
  Find in the terminal, a small bar over its top right corner (the UI library's FloatingFindBar): the query with
  Match Case, Words and Regex, the match count, previous and next. TerminalView owns the search; this only shows it
  and maps the terminal's own keys (Enter searches up, like xterm's scrollback).
-->
<script lang="ts">
  import FloatingFindBar from "@nibtree/ui/components/FloatingFindBar.svelte";
  import type { SearchOptions } from "@nibtree/ui/components/SearchToggles.svelte";
  import { localKeys } from "$lib/commands/commandRuntime";
  import { findBarKey, type TerminalFindOptions } from "./find";

  interface Props {
    query: string;
    options: TerminalFindOptions;
    counter: string;
    /** The counter shows a problem (an invalid regex or no results). */
    problem: boolean;
    onQuery: (query: string) => void;
    onToggle: (option: keyof TerminalFindOptions) => void;
    onPrevious: () => void;
    onNext: () => void;
    onClose: () => void;
  }

  let { query, options, counter, problem, onQuery, onToggle, onPrevious, onNext, onClose }: Props = $props();

  let input = $state<HTMLInputElement | null>(null);

  const titles = $derived({
    previous: `Previous Match (${localKeys("Enter")})`,
    next: `Next Match (${localKeys("Shift+Enter")})`,
    close: `Close (${localKeys("Escape")})`,
  });
  const toggleTitles = $derived({
    matchCase: `Match Case (${localKeys("Alt+C")})`,
    wholeWords: `Words (${localKeys("Alt+W")})`,
    regex: `Regex (${localKeys("Alt+X")})`,
  });

  export function focus(): void {
    requestAnimationFrame(() => {
      input?.focus();
      input?.select();
    });
  }

  // The library reports the query and the toggles together; the terminal takes one change at a time.
  function search(next: string, nextOptions: SearchOptions): void {
    const option = (Object.keys(nextOptions) as (keyof SearchOptions)[]).find(
      (key) => nextOptions[key] !== options[key],
    );
    if (option) {
      onToggle(option);
    } else {
      onQuery(next);
    }
  }

  // Keys stay in the bar, so the terminal never types them.
  function onKeydown(event: KeyboardEvent): void {
    const action = findBarKey(event);
    if (!action) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (action === "close") {
      onClose();
    } else if (action === "previous") {
      onPrevious();
    } else if (action === "next") {
      onNext();
    } else if (action === "toggleCase") {
      onToggle("matchCase");
    } else if (action === "toggleWords") {
      onToggle("wholeWords");
    } else {
      onToggle("regex");
    }
  }
</script>

<FloatingFindBar
  bind:element={input}
  {query}
  options={{ ...options }}
  {counter}
  {problem}
  label="Find in terminal"
  {titles}
  {toggleTitles}
  onsearch={search}
  onkeydown={onKeydown}
  onprevious={onPrevious}
  onnext={onNext}
  onclose={onClose}
/>
