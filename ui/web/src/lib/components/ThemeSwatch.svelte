<!-- A color theme's preview chip: a word of code on the theme's background and three bars for its keyword, string
     and accent colors, like Settings' theme list. The colors are the theme's, so they come in as data. -->
<script lang="ts">
  export interface ThemeColors {
    background: string;
    foreground: string;
    border: string;
    keyword: string;
    string: string;
    accent: string;
    selection: string;
  }

  interface Props {
    colors: ThemeColors;
    label: string;
  }

  let { colors, label }: Props = $props();
</script>

<span
  class="swatch"
  role="img"
  aria-label={label}
  style:--sw-bg={colors.background}
  style:--sw-fg={colors.foreground}
  style:--sw-border={colors.border}
  style:--sw-keyword={colors.keyword}
  style:--sw-string={colors.string}
  style:--sw-accent={colors.accent}
  style:--sw-selection={colors.selection}
>
  <span class="sample"><span class="kw">fn</span> <span class="sel">Aa</span></span>
  <span class="bars">
    <span class="bar keyword"></span>
    <span class="bar string"></span>
    <span class="bar accent"></span>
  </span>
</span>

<style>
  .swatch {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--theme-swatch-gap);
    width: var(--theme-swatch-width);
    height: var(--theme-swatch-height);
    padding: 0 var(--theme-swatch-padding-x);
    border: 1px solid var(--sw-border, var(--border-strong));
    border-radius: var(--theme-swatch-radius);
    background: var(--sw-bg, var(--panel-alt));
    font-family: var(--font-mono);
    font-size: var(--font-size-tiny);
    line-height: 1;
  }

  .sample {
    color: var(--sw-fg);
    white-space: nowrap;
  }

  .kw {
    color: var(--sw-keyword);
  }

  .sel {
    padding: 0 1px;
    background: var(--sw-selection);
  }

  .bars {
    display: flex;
    gap: var(--space-1);
  }

  .bar {
    width: var(--theme-swatch-bar);
    height: var(--theme-swatch-bar-height);
    border-radius: var(--radius-tiny);
  }

  .keyword {
    background: var(--sw-keyword);
  }

  .string {
    background: var(--sw-string);
  }

  .accent {
    background: var(--sw-accent);
  }
</style>
