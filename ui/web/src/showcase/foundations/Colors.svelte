<!-- Every color token with its light and dark value, from ui/design-tokens/colors.json. -->
<script lang="ts">
  import colors from "../../../../design-tokens/colors.json";

  const entries = Object.entries(colors).filter(([name]) => name !== "$comment") as [
    string,
    { light: string; dark: string },
  ][];
</script>

<article class="selectable">
  <h1>Colors</h1>
  <p class="intro">
    The built-in Light and Dark themes, from <code>ui/design-tokens/colors.json</code>. Components use them as
    <code>var(--name)</code>; color themes replace them at run time. Native apps get the same names from the generated
    Swift, XAML and GTK files.
  </p>
  <div class="grid">
    {#each entries as [name, value] (name)}
      <div class="token">
        <div class="swatches">
          <span class="swatch" style:background={value.light} title="Light {value.light}"></span>
          <span class="swatch" style:background={value.dark} title="Dark {value.dark}"></span>
        </div>
        <code class="name">--{name}</code>
        <code class="values">{value.light} / {value.dark}</code>
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

  .intro {
    margin: 0 0 20px;
    color: var(--text-dim);
    line-height: 1.5;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 10px;
  }

  .token {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .swatches {
    display: flex;
    height: 28px;
    border: 1px solid var(--border-strong);
    border-radius: 5px;
    overflow: hidden;
  }

  .swatch {
    flex: 1;
  }

  code {
    font-family: var(--font-mono);
    font-size: 11.5px;
  }

  .values {
    color: var(--text-dim);
  }
</style>
