// The label of a fold in a diff, like JetBrains IDEs: the declarations around the code after the fold, such as
// "\App\Http\Controllers\Api > DistrictController > store()", read from the first line of each enclosing block.
// Blocks that declare nothing (if, for, a bare object) are left out.

/** Longest name kept from one block; a longer one is cut with an ellipsis. */
const MAX_NAME = 60;

const CONTROL = new Set([
  "if",
  "else",
  "for",
  "foreach",
  "while",
  "do",
  "switch",
  "case",
  "catch",
  "try",
  "return",
  "match",
  "with",
]);

const PATTERNS: { pattern: RegExp; call: boolean }[] = [
  // Types and modules: class Foo, interface Bar, impl Baz for Qux, enum, trait, struct, namespace { }.
  {
    pattern:
      /\b(?:class|interface|trait|enum|struct|impl|module|namespace|object|record|protocol|extension|union)\s+([\w$\\.:]+)/,
    call: false,
  },
  // Functions: function foo(, fn foo, def foo, func (r T) foo, fun foo.
  { pattern: /\bfunction\s*\*?\s*&?\s*([\w$]+)\s*[(<]/, call: true },
  { pattern: /\b(?:fn|def|fun)\s+([\w$]+)/, call: true },
  { pattern: /\bfunc\s+(?:\([^)]*\)\s*)?([\w$]+)/, call: true },
  // A function assigned to a name: const foo = (...) => or foo: function.
  { pattern: /\b(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?(?:function\b|\(|[\w$]+\s*=>)/, call: true },
  // Methods: modifiers, a name and its parameters, as in `public async save(` or `get count(`.
  {
    pattern:
      /^\s*(?:(?:public|private|protected|static|async|override|readonly|abstract|final|export|default|get|set|virtual|internal)\s+)*([\w$]+)\s*(?:<[^>]*>)?\s*\(/,
    call: true,
  },
];

/** The name a block's first line declares, or null for a block that declares nothing. */
export function scopeName(text: string): string | null {
  const heading = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(text);
  if (heading) {
    return shorten(heading[1]);
  }
  for (const { pattern, call } of PATTERNS) {
    const match = pattern.exec(text);
    if (match && !CONTROL.has(match[1])) {
      return shorten(call ? `${match[1]}()` : match[1]);
    }
  }
  return null;
}

function shorten(name: string): string {
  return name.length > MAX_NAME ? `${name.slice(0, MAX_NAME - 1)}…` : name;
}

/** A file-wide namespace or package statement, such as PHP's `namespace App\Http;` (shown as `\App\Http`). */
export function fileNamespace(text: string): string | null {
  const match = /^\s*(?:namespace|package)\s+([\w.\\]+)\s*;\s*$/.exec(text);
  if (!match) {
    return null;
  }
  return match[1].includes("\\") && !match[1].startsWith("\\") ? `\\${match[1]}` : match[1];
}

/** "namespace > class > method()" from the enclosing blocks' first lines, outermost first. */
export function foldLabel(headers: readonly string[], namespace: string | null): string | null {
  const names = headers.map(scopeName).filter((name): name is string => name !== null);
  if (namespace && names.length > 0) {
    names.unshift(namespace);
  }
  return names.length > 0 ? names.join(" > ") : null;
}
