<!-- Every text style rendered with Text, its values from typography.json, and the font families. -->
<script lang="ts">
  import Text from "$ui/components/Text.svelte";
  import { textStyles, type TextStyleName } from "$ui/styles/tokens";
  import typography from "../../../../design-tokens/typography.json";

  const styles = Object.keys(textStyles) as TextStyleName[];
  const raw = typography.textStyle as Record<string, Record<string, string | boolean>>;
  const families = Object.entries(typography.font);

  function describe(name: string): string {
    const style = raw[name] ?? {};
    return Object.entries(style)
      .map(([key, value]) => `${key} ${String(value).replace(/[{}]/g, "")}`)
      .join(", ");
  }
</script>

<article class="selectable">
  <h1>Typography</h1>
  <p class="intro">
    Text styles from <code>ui/design-tokens/typography.json</code>. Use them with
    <code>&lt;Text variant="hint"&gt;</code>; native apps get the same styles as <code>GMTextStyles</code> (Swift),
    <code>GmText*</code> resources (XAML) and <code>--text-*</code> variables (GTK).
  </p>
  <div class="styles">
    {#each styles as name (name)}
      <div class="style">
        <div class="sample"><Text variant={name}>The quick brown fox, {name}</Text></div>
        <code>{name}</code>
        <code class="dim">{describe(name)}</code>
      </div>
    {/each}
  </div>
  <h2>Families</h2>
  {#each families as [name, list] (name)}
    <div class="family">
      <code>{name}</code>
      <code class="dim">{list.join(", ")}</code>
    </div>
  {/each}
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
    margin: 24px 0 8px;
    font-size: 14px;
  }

  .intro {
    margin: 0 0 18px;
    color: var(--text-dim);
    line-height: 1.5;
  }

  .styles {
    display: flex;
    flex-direction: column;
  }

  .style,
  .family {
    display: grid;
    grid-template-columns: 360px 120px 1fr;
    align-items: baseline;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }

  .family {
    grid-template-columns: 120px 1fr;
  }

  code {
    font-family: var(--font-mono);
    font-size: 11.5px;
  }

  .dim {
    color: var(--text-dim);
  }
</style>
