<!-- One parity case side by side: the app's markup with the app's own CSS (scoped to #reference) on the left, the
     library component on the right. scripts/parity.ts reads both columns' computed styles. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { parityCases } from "./cases";
  import { scopeCss, styleOf } from "./extract";
  import Bars from "./library/Bars.svelte";
  import Agents from "./library/Agents.svelte";
  import Atoms from "./library/Atoms.svelte";
  import Basic from "./library/Basic.svelte";
  import Blocks from "./library/Blocks.svelte";
  import Builders from "./library/Builders.svelte";
  import Chrome from "./library/Chrome.svelte";
  import Controls from "./library/Controls.svelte";
  import Dialogs from "./library/Dialogs.svelte";
  import Feedback from "./library/Feedback.svelte";
  import Finish from "./library/Finish.svelte";
  import History from "./library/History.svelte";
  import Larger from "./library/Larger.svelte";
  import Lists from "./library/Lists.svelte";
  import Marks from "./library/Marks.svelte";
  import Overlays from "./library/Overlays.svelte";
  import Panels from "./library/Panels.svelte";
  import Pickers from "./library/Pickers.svelte";
  import Pieces from "./library/Pieces.svelte";
  import Rows from "./library/Rows.svelte";
  import Search from "./library/Search.svelte";
  import Shell from "./library/Shell.svelte";
  import States from "./library/States.svelte";
  import Status from "./library/Status.svelte";
  import Surfaces from "./library/Surfaces.svelte";
  import Tabs from "./library/Tabs.svelte";

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
    <section id="library" aria-label="Library">
      <Basic id={parityCase.id} />
      <Feedback id={parityCase.id} />
      <Overlays id={parityCase.id} />
      <Shell id={parityCase.id} />
      <Blocks id={parityCase.id} />
      <Larger id={parityCase.id} />
      <Surfaces id={parityCase.id} />
      <Rows id={parityCase.id} />
      <Builders id={parityCase.id} />
      <Bars id={parityCase.id} />
      <Marks id={parityCase.id} />
      <Pieces id={parityCase.id} />
      <Controls id={parityCase.id} />
      <Panels id={parityCase.id} />
      <Lists id={parityCase.id} />
      <Pickers id={parityCase.id} />
      <Chrome id={parityCase.id} />
      <Tabs id={parityCase.id} />
      <States id={parityCase.id} />
      <Atoms id={parityCase.id} />
      <Status id={parityCase.id} />
      <History id={parityCase.id} />
      <Search id={parityCase.id} />
      <Dialogs id={parityCase.id} />
      <Agents id={parityCase.id} />
      <Finish id={parityCase.id} />
    </section>
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
