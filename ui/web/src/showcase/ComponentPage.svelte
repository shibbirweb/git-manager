<!-- One component's page, for people and AI agents alike: what it is, a live preview, its props, rules and the
     app markup it replaces, then its code: the example, the component, its logic and the Markdown doc. -->
<script lang="ts">
  import Segmented from "$ui/components/Segmented.svelte";
  import { componentMarkdown } from "$ui/docs/markdown";
  import CodeView from "$ui/components/CodeView.svelte";
  import type { Entry } from "./registry";

  let { entry }: { entry: Entry } = $props();

  type Tab = "example" | "svelte" | "logic" | "markdown";

  const doc = $derived(entry.doc);
  const tabs = $derived(
    [
      entry.example ? { value: "example" as Tab, label: "Example" } : null,
      { value: "svelte" as Tab, label: "Svelte" },
      entry.logic.length ? { value: "logic" as Tab, label: "TypeScript" } : null,
      doc ? { value: "markdown" as Tab, label: "Markdown (for AI)" } : null,
    ].filter((tab) => tab !== null),
  );
  let tab = $state<Tab>("example");
  const shownTab = $derived(tabs.some((candidate) => candidate.value === tab) ? tab : tabs[0].value);
  const Story = $derived(entry.story);
</script>

<article class="selectable">
  <header>
    <div class="eyebrow">{doc?.group ?? "Not documented yet"}</div>
    <h1>{entry.name}</h1>
    {#if doc}
      <p class="summary">{doc.summary}</p>
      <code class="import">import {entry.name} from "$ui/components/{entry.name}.svelte";</code>
    {/if}
  </header>

  <section class="preview" aria-label="Preview">
    {#if Story}
      <Story />
    {:else}
      <p class="dim">No story yet.</p>
    {/if}
  </section>

  {#if doc}
    <section>
      <h2>When to use</h2>
      <p>{doc.usage}</p>
    </section>
    <section>
      <h2>Props</h2>
      <table>
        <thead><tr><th>Prop</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          {#each doc.props as prop (prop.name)}
            <tr>
              <td>
                <code>{prop.name}</code>
                {#if prop.required}<span class="note">required</span>{/if}
                {#if prop.bindable}<span class="note">bindable</span>{/if}
              </td>
              <td><code>{prop.type}</code></td>
              <td
                >{#if prop.default !== undefined}<code>{prop.default}</code>{/if}</td
              >
              <td>{prop.description}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
    {#if doc.rules?.length}
      <section>
        <h2>Rules</h2>
        <ul>
          {#each doc.rules as rule (rule)}<li>{rule}</li>{/each}
        </ul>
      </section>
    {/if}
    {#if doc.replaces.length}
      <section>
        <h2>Replaces in the app</h2>
        <ul>
          {#each doc.replaces as markup (markup)}<li><code>{markup}</code></li>{/each}
        </ul>
      </section>
    {/if}
  {/if}

  <section>
    <div class="code-head">
      <h2>Code</h2>
      <Segmented label="Code view" bind:value={tab} options={tabs} />
    </div>
    {#if shownTab === "example" && entry.example}
      <CodeView source={entry.example.source} language="svelte" />
    {:else if shownTab === "svelte"}
      <CodeView source={entry.svelte.source} language="svelte" />
    {:else if shownTab === "logic"}
      {#each entry.logic as file (file.file)}
        <div class="file-name">{file.file}</div>
        <CodeView source={file.source} language="ts" />
      {/each}
    {:else if shownTab === "markdown" && doc}
      <CodeView source={componentMarkdown(doc)} language="md" />
    {/if}
  </section>
</article>

<style>
  article {
    max-width: 920px;
    padding: 28px 36px 60px;
  }

  .eyebrow {
    color: var(--text-faint);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  h1 {
    margin: 4px 0 6px;
    font-size: 22px;
  }

  h2 {
    margin: 0 0 8px;
    font-size: 14px;
  }

  section {
    margin-top: 24px;
  }

  p {
    margin: 0;
    line-height: 1.5;
  }

  .summary {
    color: var(--text-dim);
  }

  .import {
    display: inline-block;
    margin-top: 10px;
    padding: 4px 8px;
    border-radius: 4px;
    background: var(--panel-alt);
    font-size: 12px;
  }

  code {
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .preview {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
    padding: 24px;
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    background: var(--bg);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
  }

  th,
  td {
    padding: 6px 8px;
    border-bottom: 1px solid var(--border);
    text-align: left;
    vertical-align: top;
  }

  th {
    color: var(--text-dim);
    font-weight: 600;
  }

  .note {
    margin-left: 4px;
    color: var(--accent);
    font-size: 11px;
  }

  ul {
    margin: 0;
    padding-left: 18px;
    line-height: 1.6;
  }

  .code-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .code-head h2 {
    margin: 0;
  }

  .file-name {
    margin: 10px 0 4px;
    color: var(--text-dim);
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .dim {
    color: var(--text-dim);
  }
</style>
