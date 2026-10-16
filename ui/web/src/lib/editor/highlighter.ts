// The syntax classes of every highlighted view: the editor, the minimap, sticky scroll and the
// Markdown preview. classHighlighter files HTML tag and attribute names under typeName and
// propertyName only, so the themes' tag and attribute colors never showed; the second
// highlighter adds tok-tagName and tok-attributeName (app.css lists those rules last, so they win).

import { classHighlighter, tagHighlighter, tags, type Highlighter } from "@lezer/highlight";

export const markupHighlighter = tagHighlighter([
  { tag: tags.tagName, class: "tok-tagName" },
  { tag: tags.attributeName, class: "tok-attributeName" },
]);

export const codeHighlighters: readonly Highlighter[] = [classHighlighter, markupHighlighter];
