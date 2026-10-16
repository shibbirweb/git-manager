<!-- One parity case side by side: the app's markup with the app's own CSS (scoped to #reference) on the left, the
     library component on the right. scripts/parity.ts reads both columns' computed styles. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { parityCases } from "./cases";
  import { scopeCss, styleOf } from "./extract";

  const appSources = import.meta.glob<string>("../../../../src/lib/**/*.svelte", { query: "?raw", import: "default" });

  const params = new URLSearchParams(location.search);
  const caseId = params.get("case") ?? parityCases[0].id;
  const parityCase = parityCases.find((entry) => entry.id === caseId) ?? null;
  let css = $state("");
  let ready = $state(false);

  document.documentElement.setAttribute("data-theme", params.get("theme") === "dark" ? "dark" : "light");

  onMount(async () => {
    const styles: string[] = [];
    for (const source of parityCase?.sources ?? []) {
      const load = appSources[`../../../../${source}`];
      if (!load) {
        throw new Error(`No app source ${source}`);
      }
      styles.push(scopeCss(styleOf(await load()), "#reference"));
    }
    css = styles.join("\n");
    ready = true;
  });
</script>

<svelte:head>
  {@html `<style>${css}</style>`}
</svelte:head>

<main class="parity" data-ready={ready || undefined}>
  {#if parityCase}
    <section id="reference" aria-label="App">{@html parityCase.html}</section>
    <section id="library" aria-label="Library"></section>
  {:else}
    <p>No case {caseId}</p>
  {/if}
</main>

<style>
  .parity {
    display: grid;
    grid-template-columns: 560px 560px;
    gap: 40px;
    align-items: start;
    padding: 24px;
    background: var(--panel);
    height: 100vh;
  }

  section {
    padding: 16px;
    background: var(--panel);
  }
</style>
