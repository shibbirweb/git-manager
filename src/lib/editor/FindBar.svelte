<!-- The editor find and replace bar on the UI library's FindBar, mounted as a CodeMirror panel by
     findPanel.svelte.ts, which owns the state, the keys and the actions. -->
<script lang="ts">
  import LibraryFindBar from "@nibtree/ui/components/FindBar.svelte";
  import type { SearchOptions } from "@nibtree/ui/components/SearchToggles.svelte";
  import { localKeys, withCommandKeys } from "$lib/commands/commandRuntime";
  import type { FindBarActions, FindBarState, FindField } from "./findPanel.svelte";

  let { bar, actions }: { bar: FindBarState; actions: FindBarActions } = $props();

  let library = $state<ReturnType<typeof LibraryFindBar> | null>(null);

  const counter = $derived(bar.notice ?? bar.counter.text);
  const problem = $derived(bar.notice === null && bar.counter.problem ? (bar.error ?? counter) : null);
  const titles = $derived({
    previous: `Previous Occurrence (${localKeys("Shift+Enter")})`,
    next: `Next Occurrence (${localKeys("Enter")})`,
    selectAll: withCommandKeys("Select All Occurrences", "edit.selectAllOccurrences"),
    replace: `Replace (${localKeys("Enter")})`,
    replaceAll: `Replace All (${localKeys("CmdOrCtrl+Shift+Enter")})`,
    close: `Close (${localKeys("Escape")})`,
  });
  const toggleTitles = $derived({
    matchCase: `Match Case (${localKeys("Alt+C")})`,
    wholeWords: `Words (${localKeys("Alt+W")})`,
    regex: `Regex (${localKeys("Alt+X")})`,
  });

  export function focus(field: FindField, select: boolean): void {
    library?.focus(field, select);
  }

  // The library reports the query and the toggles together; the panel takes one change at a time.
  function search(query: string, options: SearchOptions): void {
    const option = (Object.keys(options) as (keyof SearchOptions)[]).find((key) => options[key] !== bar.options[key]);
    if (option) {
      actions.toggle(option);
    } else {
      actions.setSearch(query);
    }
  }
</script>

<LibraryFindBar
  bind:this={library}
  query={bar.search}
  replacement={bar.replace}
  options={{ ...bar.options }}
  showReplace={bar.replaceOpen}
  editable={!bar.readOnly}
  {counter}
  active={bar.search !== "" && bar.error === null}
  {problem}
  {titles}
  {toggleTitles}
  onsearch={search}
  onreplaceinput={(text) => actions.setReplace(text)}
  ontogglereplace={() => actions.toggleReplace()}
  onkeydown={(event, field) => actions.keydown(event, field)}
  onnext={() => actions.next()}
  onprevious={() => actions.previous()}
  onreplace={() => actions.replaceOne()}
  onreplaceall={() => actions.replaceAll()}
  onselectall={() => actions.selectAll()}
  onexclude={() => actions.exclude()}
  onclose={() => actions.close()}
/>
