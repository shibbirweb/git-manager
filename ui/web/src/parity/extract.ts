// The app's real CSS for a parity case: the <style> of an app .svelte file, with every selector put under a scope
// (`#reference`) so it styles only the reference markup, weighing what Svelte's scoping class weighs. `:global(x)`
// becomes `x`; rules aimed at the page root (html, :root, body) are dropped so they cannot restyle the library.

export function styleOf(svelteSource: string): string {
  return /<style[^>]*>([\s\S]*?)<\/style>/.exec(svelteSource)?.[1] ?? "";
}

function unglobal(selector: string): string {
  return selector.replace(/:global\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g, "$1");
}

/** Splits a selector into compounds and combinators, outside brackets and parentheses. */
function compounds(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of selector) {
    if ("([".includes(char)) {
      depth++;
    } else if (")]".includes(char)) {
      depth--;
    }
    if (depth === 0 && /[\s>+~]/.test(char)) {
      if (current) {
        parts.push(current);
        current = "";
      }
      if (char !== " ") {
        parts.push(char);
      }
      continue;
    }
    current += char;
  }
  if (current) {
    parts.push(current);
  }
  return parts;
}

// Svelte adds its scoping class to every compound it owns, which weighs one class each; `:not(.gm-child)` adds
// exactly that weight, so rules compete with the app's global CSS as they do in the app. Like the scoping class, it
// skips elements that a child component draws (marked gm-child, such as Icon's svg), which scoped rules never reach.
const SCOPE_WEIGHT = ":not(.gm-child)";

function weighted(compound: string): string {
  if (compound.startsWith(":global(") || /^[>+~]$/.test(compound)) {
    return unglobal(compound);
  }
  const pseudo = compound.search(/::/);
  return pseudo < 0
    ? `${compound}${SCOPE_WEIGHT}`
    : `${compound.slice(0, pseudo)}${SCOPE_WEIGHT}${compound.slice(pseudo)}`;
}

function scopeSelector(selector: string, scope: string): string | null {
  const plain = unglobal(selector.trim());
  if (!plain || /^(html|:root|body)\b/.test(plain)) {
    return null;
  }
  // :where() keeps the scope itself weightless.
  return `:where(${scope}) ${compounds(selector.trim()).map(weighted).join(" ")}`;
}

/** Puts every rule of `css` under `scope`; @media blocks are scoped inside, @keyframes stay as they are. */
export function scopeCss(css: string, scope: string): string {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let output = "";
  let index = 0;
  while (index < withoutComments.length) {
    const open = withoutComments.indexOf("{", index);
    if (open < 0) {
      break;
    }
    const prelude = withoutComments.slice(index, open).trim();
    let depth = 1;
    let close = open + 1;
    while (close < withoutComments.length && depth > 0) {
      depth += withoutComments[close] === "{" ? 1 : withoutComments[close] === "}" ? -1 : 0;
      close++;
    }
    const body = withoutComments.slice(open + 1, close - 1);
    if (prelude.startsWith("@keyframes")) {
      output += `${prelude} {${body}}\n`;
    } else if (prelude.startsWith("@media") || prelude.startsWith("@container") || prelude.startsWith("@supports")) {
      output += `${prelude} {\n${scopeCss(body, scope)}}\n`;
    } else if (!prelude.startsWith("@")) {
      const selectors = prelude
        .split(",")
        .map((selector) => scopeSelector(selector, scope))
        .filter((selector) => selector !== null);
      if (selectors.length) {
        output += `${selectors.join(", ")} {${body}}\n`;
      }
    }
    index = close;
  }
  return output;
}
