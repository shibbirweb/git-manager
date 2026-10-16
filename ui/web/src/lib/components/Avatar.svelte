<!-- A person's or project's initials: a round accent `circle` (a signed-in account) or a rounded `tile` in one of
     the palette colors (projects on the Welcome page, the same name always gets the same color). -->
<script lang="ts">
  interface Props {
    text: string;
    shape?: "circle" | "tile";
    color?: "accent" | "blue" | "green" | "magenta" | "cyan" | "red";
    label?: string;
  }

  let { text, shape = "circle", color = "accent", label }: Props = $props();
</script>

<span class="avatar {shape} {color}" role={label ? "img" : undefined} aria-label={label}>{text}</span>

<style>
  .avatar {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-text);
    font-weight: var(--font-weight-semibold);
    user-select: none;
  }

  .circle {
    width: var(--avatar-size);
    height: var(--avatar-size);
    border-radius: 50%;
    font-size: var(--font-size-small);
  }

  .tile {
    width: var(--avatar-tile-size);
    height: var(--avatar-tile-size);
    border-radius: var(--avatar-tile-radius);
    font-size: var(--font-size-ui);
    font-weight: var(--font-weight-bold);
    letter-spacing: var(--letter-spacing-slight);
  }

  .accent {
    background: var(--accent);
  }

  /* Palette tiles have their own letter color: the theme's accent text is picked for the accent and could be black
     on a deep tile. Each theme picks white or black for the five tile colors (themes/catalog.ts). */
  .tile:not(.accent) {
    color: var(--avatar-text);
  }

  /* Palette colors shade a terminal color from bright to deep, so the palette follows the color theme; the deep
     color under the gradient is what contrast checks read. */
  .blue {
    background-color: color-mix(in srgb, var(--term-blue) 72%, var(--term-black));
    background-image: linear-gradient(
      135deg,
      color-mix(in srgb, var(--term-bright-blue) 88%, var(--term-black)),
      color-mix(in srgb, var(--term-blue) 72%, var(--term-black))
    );
  }

  .green {
    background-color: color-mix(in srgb, var(--term-green) 72%, var(--term-black));
    background-image: linear-gradient(
      135deg,
      color-mix(in srgb, var(--term-bright-green) 88%, var(--term-black)),
      color-mix(in srgb, var(--term-green) 72%, var(--term-black))
    );
  }

  .magenta {
    background-color: color-mix(in srgb, var(--term-magenta) 72%, var(--term-black));
    background-image: linear-gradient(
      135deg,
      color-mix(in srgb, var(--term-bright-magenta) 88%, var(--term-black)),
      color-mix(in srgb, var(--term-magenta) 72%, var(--term-black))
    );
  }

  .cyan {
    background-color: color-mix(in srgb, var(--term-cyan) 72%, var(--term-black));
    background-image: linear-gradient(
      135deg,
      color-mix(in srgb, var(--term-bright-cyan) 88%, var(--term-black)),
      color-mix(in srgb, var(--term-cyan) 72%, var(--term-black))
    );
  }

  .red {
    background-color: color-mix(in srgb, var(--term-red) 72%, var(--term-black));
    background-image: linear-gradient(
      135deg,
      color-mix(in srgb, var(--term-bright-red) 88%, var(--term-black)),
      color-mix(in srgb, var(--term-red) 72%, var(--term-black))
    );
  }
</style>
