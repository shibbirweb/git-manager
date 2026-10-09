// The editing cases cm-editing.ts runs through CodeMirror: hand-written ones for each command, then seeded random
// sequences of typing, deleting, multiple cursors, undo and redo on small documents.

export interface EditCase {
  name: string;
  /** "ts" (TypeScript, the syntax tree drives indentation) or "plain". */
  lang: string;
  /** Spaces per indent unit; 0 indents with tabs. */
  indent: number;
  doc: string;
  sel: number[][];
  main?: number;
  steps: string[];
}

const ts = (name: string, doc: string, sel: number[][], steps: string[], main = 0): EditCase => ({
  name,
  lang: "ts",
  indent: 2,
  doc,
  sel,
  main,
  steps,
});

const plain = (name: string, doc: string, sel: number[][], steps: string[], indent = 4): EditCase => ({
  name,
  lang: "plain",
  indent,
  doc,
  sel,
  steps,
});

const fn = "function f() {\n  const a = 1;\n  return a;\n}\n";
const obj = "const products = [\n  { id: \"mug\", price: 12 },\n  { id: \"tee\", price: 24 },\n];\n";

const handWritten: EditCase[] = [
  ts("enter after brace", "function f() {", [[14, 14]], ["insertNewlineAndIndent"]),
  ts("enter between braces", "function f() {}", [[14, 14]], ["insertNewlineAndIndent"]),
  ts("enter between brackets", "const a = [];", [[11, 11]], ["insertNewlineAndIndent"]),
  ts("enter in block", fn, [[28, 28]], ["insertNewlineAndIndent"]),
  ts("enter after statement top", "foo();\n", [[6, 6]], ["insertNewlineAndIndent"]),
  ts("enter continued", "  const x =", [[11, 11]], ["insertNewlineAndIndent"]),
  ts("enter aligned args", "foo(a,", [[6, 6]], ["insertNewlineAndIndent"]),
  ts("enter before close", "if (x) {\n  y();}", [[15, 15]], ["insertNewlineAndIndent"]),
  ts("enter in object", obj, [[44, 44]], ["insertNewlineAndIndent"]),
  ts("enter after if", "if (x)", [[6, 6]], ["insertNewlineAndIndent"]),
  ts("enter whitespace line", "{\n    \n}", [[6, 6]], ["insertNewlineAndIndent"]),
  ts("enter mid indent", "{\n  foo();\n}", [[3, 3]], ["insertNewlineAndIndent"]),
  ts("enter trailing spaces", "{\n  a;   b\n}", [[6, 6]], ["insertNewlineAndIndent"]),
  ts("blank line", fn, [[20, 20]], ["insertBlankLine"]),
  ts("type brace closes", "", [[0, 0]], ["type:\"{\""]),
  ts("type paren before word", "abc", [[0, 0]], ["type:\"(\""]),
  ts("type paren before close", "f()", [[2, 2]], ["type:\"[\""]),
  ts("type close over inserted", "", [[0, 0]], ["type:\"(\"", "type:\"x\"", "type:\")\""]),
  ts("type close not inserted", "()", [[1, 1]], ["type:\")\""]),
  ts("type quote", "x = ", [[4, 4]], ["type:\"\\\"\"", "type:\"a\"", "type:\"\\\"\""]),
  ts("type quote after word", "abc", [[3, 3]], ["type:\"'\""]),
  ts("wrap selection in brackets", "abc", [[0, 3]], ["type:\"(\""]),
  ts("backspace pair", "", [[0, 0]], ["type:\"[\"", "deleteBracketPair"]),
  ts("reindent close brace", "if (x) {\n  y();\n  ", [[19, 19]], ["type:\"}\""]),
  ts("enter then close", "function f() {", [[14, 14]], ["insertNewlineAndIndent", "type:\"x\"",
    "insertNewlineAndIndent", "type:\"}\""]),
  ts("backspace indent unit", "{\n    x\n}", [[6, 6]], ["deleteCharBackward"]),
  ts("backspace odd indent", "{\n   x\n}", [[5, 5]], ["deleteCharBackward"]),
  ts("backspace line start", "ab\ncd", [[3, 3]], ["deleteCharBackward"]),
  ts("delete forward end", "ab\ncd", [[2, 2]], ["deleteCharForward"]),
  ts("delete selection", "hello world", [[2, 7]], ["deleteCharBackward"]),
  ts("delete group back", "foo.barBaz  qux", [[15, 15]], ["deleteGroupBackward", "deleteGroupBackward",
    "deleteGroupBackward"]),
  ts("delete group forward", "  foo(bar) x", [[0, 0]], ["deleteGroupForward", "deleteGroupForward"]),
  ts("delete group space", "a b", [[2, 2]], ["deleteGroupBackward"]),
  ts("indent more", fn, [[17, 30]], ["indentMore"]),
  ts("indent less", fn, [[17, 30]], ["indentLess", "indentLess"]),
  plain("indent less tabs", "\t\tx\n\ty", [[0, 6]], ["indentLess"], 0),
  plain("indent more tabs", "x\ny", [[0, 3]], ["indentMore"], 0),
  ts("move line down", fn, [[17, 20]], ["moveLineDown"]),
  ts("move line up", fn, [[30, 30]], ["moveLineUp", "moveLineUp"]),
  ts("move last line down", "a\nb", [[2, 2]], ["moveLineDown"]),
  ts("copy line down", fn, [[18, 18]], ["copyLineDown"]),
  ts("copy line up", fn, [[18, 18]], ["copyLineUp"]),
  ts("line comment", fn, [[18, 18]], ["toggleComment"]),
  ts("line comment twice", fn, [[18, 18]], ["toggleComment", "toggleComment"]),
  ts("line comment block", fn, [[0, 40]], ["toggleComment"]),
  ts("line comment mixed", "  a\n  // b\n", [[0, 9]], ["toggleComment"]),
  ts("uncomment all", "// a\n  // b\n", [[0, 11]], ["toggleComment"]),
  ts("block comment", "let a = b + c;", [[8, 13]], ["toggleBlockComment"]),
  ts("block uncomment", "let a = /* b + c */;", [[11, 16]], ["toggleBlockComment"]),
  ts("select line", fn, [[18, 18]], ["selectLine"]),
  ts("select all", fn, [[3, 3]], ["selectAll"]),
  ts("simplify", fn, [[3, 5], [18, 20]], ["simplifySelection", "simplifySelection"], 1),
  ts("split line", "abcd", [[2, 2]], ["splitLine"]),
  ts("next occurrence", "a foo b foo c foo", [[3, 3]], ["selectNextOccurrence", "selectNextOccurrence",
    "selectNextOccurrence", "selectNextOccurrence"]),
  ts("next occurrence partial", "food foo xfoo", [[0, 3]], ["selectNextOccurrence", "selectNextOccurrence"]),
  ts("next occurrence word only", "foo food foo", [[1, 1]], ["selectNextOccurrence", "selectNextOccurrence"]),
  ts("next occurrence wraps", "x foo y foo", [[8, 11]], ["selectNextOccurrence"]),
  ts("select all occurrences", "a foo foo2 foo", [[3, 3]], ["selectAllOccurrences"]),
  ts("multi cursor type", "ab\ncd\nef", [[1, 1], [4, 4], [7, 7]], ["type:\"X\"", "type:\"Y\"", "deleteCharBackward"]),
  ts("multi cursor enter", "{a}\n{b}", [[2, 2], [6, 6]], ["insertNewlineAndIndent"]),
  ts("multi cursor brackets", "a\nb", [[1, 1], [3, 3]], ["type:\"(\""]),
  ts("duplicate line", fn, [[18, 18]], ["duplicate"]),
  ts("duplicate selection", "abc def", [[0, 3]], ["duplicate"]),
  ts("join lines", "a  \n   b\nc", [[1, 1]], ["joinLines"]),
  ts("join selection", "a\nb\n\nc", [[0, 6]], ["joinLines"]),
  ts("toggle case", "fooBar baz", [[2, 2]], ["toggleCase", "toggleCase"]),
  ts("sort lines", "c\na\nb", [[0, 5]], ["sortLines"]),
  ts("undo typing group", "", [[0, 0]], ["type:\"a\"", "type:\"b\"", "type:\"c\"", "undo"]),
  ts("undo after pause", "", [[0, 0]], ["type:\"a\"", "wait:600", "type:\"b\"", "undo"]),
  ts("undo after move", "xy", [[0, 0]], ["type:\"a\"", "sel:2,2", "type:\"b\"", "undo", "undo"]),
  ts("redo", "xy", [[1, 1]], ["type:\"a\"", "undo", "redo"]),
  ts("undo selection", "abc", [[0, 0]], ["sel:1,1", "sel:2,2", "undoSelection", "undoSelection", "redoSelection"]),
  ts("undo enter", "f() {", [[5, 5]], ["insertNewlineAndIndent", "type:\"x\"", "undo", "undo"]),
  ts("undo delete group", "abc def", [[7, 7]], ["deleteCharBackward", "deleteCharBackward", "undo"]),
  ts("redo cleared", "", [[0, 0]], ["type:\"a\"", "undo", "type:\"b\"", "redo"]),
  ts("paste", "ab", [[1, 1]], ["paste:\"x\\ny\"", "undo"]),
  ts("undo comment", fn, [[18, 18]], ["toggleComment", "duplicate", "undo", "undo", "redo"]),
];

/** A small deterministic generator (mulberry32). */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const docs = [fn, obj, "a b c\n  d e\n", "if (x) {\n  y(1, 2);\n}\n", "x"];
const typed = ["a", "b", " ", "(", ")", "[", "]", "{", "}", "\"", "'", "z"];
const commandSteps = ["deleteCharBackward", "deleteCharForward", "deleteGroupBackward", "insertNewlineAndIndent",
  "indentMore", "indentLess", "undo", "redo", "undo", "toggleComment", "moveLineDown", "copyLineUp",
  "selectNextOccurrence", "deleteBracketPair", "duplicate", "selectLine", "wait:700"];

function randomCase(index: number): EditCase {
  const next = random(index * 7919 + 13);
  const pick = <T>(items: T[]): T => items[Math.floor(next() * items.length)];
  const doc = pick(docs);
  let length = doc.length;
  const cursor = () => Math.floor(next() * (length + 1));
  const first = cursor();
  const sel = next() < 0.3 ? [[first, first], [Math.min(length, first + 3), Math.min(length, first + 3)]]
    : [[first, next() < 0.3 ? cursor() : first]];
  const steps: string[] = [];
  for (let step = 0; step < 8; step++) {
    const roll = next();
    if (roll < 0.45) {
      steps.push(`type:${JSON.stringify(pick(typed))}`);
      length += 1;
    } else {
      steps.push(pick(commandSteps));
    }
  }
  return { ...plain(`random ${index}`, doc, sel, steps), indent: index % 3 === 0 ? 0 : 2 + (index % 2) * 2 };
}

/** Enter at a token boundary of real code, then a letter: splitting lines as a person does in a file. */
const cart = [
  "export class Cart {",
  "  private lines: CartLine[] = [];",
  "",
  "  add(product: Product, quantity = 1): void {",
  "    const line = this.lines.find((entry) => entry.product.id === product.id);",
  "    if (line) {",
  "      line.quantity += quantity;",
  "      return;",
  "    }",
  "    this.lines.push({ product, quantity });",
  "  }",
  "",
  "  get count(): number {",
  "    return this.lines.reduce((sum, line) => sum + line.quantity, 0);",
  "  }",
  "}",
  "",
].join("\n");
const realDocs = [fn, obj, cart];

function writingCase(index: number): EditCase {
  const next = random(index * 104_729 + 7);
  const doc = realDocs[index % realDocs.length];
  let at = 0;
  for (let tries = 0; tries < 50; tries++) {
    at = Math.floor(next() * (doc.length + 1));
    const line = doc.slice(doc.lastIndexOf("\n", at - 1) + 1, at);
    const quotes = (line.match(/"/g) ?? []).length;
    if (quotes % 2 === 0 && (at === 0 || /[\s(){}\[\];,.:=]/.test(doc[at - 1]))) {
      break;
    }
  }
  return ts(`writing ${index}`, doc, [[at, at]], ["insertNewlineAndIndent", "type:\"x\""]);
}

export const cases: EditCase[] = [
  ...handWritten,
  ...Array.from({ length: 120 }, (_, index) => randomCase(index)),
  ...Array.from({ length: 100 }, (_, index) => writingCase(index)),
];
