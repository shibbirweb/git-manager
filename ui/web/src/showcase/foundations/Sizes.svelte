<!-- The size, radius, spacing and motion scales and each component's measurements, from tokens.json,
     components.json and components-2.json. Type is on the Typography page, grid and breakpoints on the Layout page. -->
<script lang="ts">
  import { componentsSource as components } from "../../../../design-tokens/build/model";
  import tokens from "../../../../design-tokens/tokens.json";

  const SCALES = ["size", "radius", "space", "motion"] as const;
  const scales = SCALES.map((scale) => ({ scale, values: Object.entries(tokens[scale] as Record<string, number>) }));
  const parts = Object.entries(components).filter(([name]) => name !== "$comment") as [
    string,
    Record<string, number | string>,
  ][];

  function kebab(name: string): string {
    return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  }
</script>

<article class="selectable">
  <h1>Sizes</h1>
  <p class="intro">
    Scales from <code>ui/design-tokens/tokens.json</code> and component measurements from
    <code>components.json</code> and <code>components-2.json</code>. Change a value there and run
    <code>bun run ui:tokens</code>: every platform's files follow.
  </p>
  {#each scales as { scale, values } (scale)}
    <h2>{scale}</h2>
    <div class="rows">
      {#each values as [name, value] (name)}
        <code>--{kebab(scale)}-{kebab(name)}</code>
        <span class="bar" style:width="{Math.min(scale === 'motion' ? value / 2 : value, 240)}px"></span>
        <code class="value">{value}{scale === "motion" ? " ms" : " px"}</code>
      {/each}
    </div>
  {/each}
  <h2>Components</h2>
  <div class="components">
    {#each parts as [component, values] (component)}
      <div class="component">
        <strong>{component}</strong>
        {#each Object.entries(values) as [part, value] (part)}
          <code>--{kebab(component)}-{kebab(part)}: {value}</code>
        {/each}
      </div>
    {/each}
  </div>
</article>

<style>
  article {
    max-width: 980px;
    padding: 28px 36px 60px;
  }

  h1 {
    margin: 0 0 6px;
    font-size: 22px;
  }

  h2 {
    margin: 22px 0 8px;
    font-size: 14px;
  }

  .intro {
    margin: 0;
    color: var(--text-dim);
    line-height: 1.5;
  }

  .rows {
    display: grid;
    grid-template-columns: 260px 250px auto;
    align-items: center;
    gap: 6px 12px;
  }

  .bar {
    height: 8px;
    border-radius: 4px;
    background: var(--accent);
  }

  code {
    font-family: var(--font-mono);
    font-size: 11.5px;
  }

  .value {
    color: var(--text-dim);
  }

  .components {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
  }

  .component {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
  }
</style>
