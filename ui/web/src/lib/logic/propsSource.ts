// Reads a component's props from its source (`let { ... }: Props = $props();`), so docs.test.ts can hold every doc
// to the real props: names, defaults, bindable and the `...rest` pass-through.

export interface SourceProp {
  name: string;
  hasDefault: boolean;
  bindable: boolean;
}

/** Splits on commas outside brackets, quotes and template strings. */
export function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";
  for (const char of text) {
    if (quote) {
      current += char;
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if ("([{<".includes(char)) {
      depth++;
    } else if (")]}>".includes(char) && depth > 0) {
      depth--;
    } else if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** The destructured props, or null when the component has no `$props()` destructuring. */
export function sourceProps(source: string): SourceProp[] | null {
  const match = /let\s*\{([\s\S]*?)\}\s*:\s*Props\s*=\s*\$props\(\);/.exec(source);
  if (!match) {
    return null;
  }
  return splitTopLevel(match[1]).map((part) => {
    if (part.startsWith("...")) {
      return { name: "...rest", hasDefault: false, bindable: false };
    }
    const name = /^[A-Za-z_$][\w$]*/.exec(part)?.[0] ?? part;
    // `lineNumbers: numbered = true` renames the prop inside the component; the default follows the new name.
    const rest = part.slice(name.length).trim().replace(/^:\s*[A-Za-z_$][\w$]*\s*/, "");
    // `value = $bindable()` binds but has no default: the prop stays required.
    const hasDefault = rest.startsWith("=") && !/^=\s*\$bindable\(\s*\)$/.test(rest);
    return { name, hasDefault, bindable: rest.includes("$bindable(") };
  });
}

/** The attributes a `...rest` component forwards: true when its Props omit "class" and "style". */
export function restOmitsClassAndStyle(source: string): boolean {
  const extendsClause = /interface Props extends ([^{]+)\{/.exec(source)?.[1] ?? "";
  return /Omit<[^>]*"class"[^>]*"style"/.test(extendsClause) || /Omit<[^>]*"style"[^>]*"class"/.test(extendsClause);
}

/** Hard-coded colors in a component's <style>: hex, rgb() and hsl() values. */
export function hardCodedColors(source: string): string[] {
  const style = /<style>([\s\S]*?)<\/style>/.exec(source)?.[1] ?? "";
  return style.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g) ?? [];
}
