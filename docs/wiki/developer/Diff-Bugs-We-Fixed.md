# Diff Bugs We Fixed

The bugs found in the [diff view](How-Diffs-Work.md), what caused each, and why we fixed it the way we did. The user side is in [Diffs](../usage/Diffs.md).

**Collapse unchanged folded nothing side by side.**
- **The issue:** with Collapse unchanged on, the side by side diff showed every line; the inline diff folded fine.
- **Why it happened:** `@codemirror/merge` creates both editors' states first and adds its chunk field afterwards with `StateEffect.appendConfig`. Our fold field worked its folds out when it was created, when `getChunks` still returned nothing, and nothing filled it later.
- **The fix and why we chose it:** the field builds its folds in the transaction where the chunks first appear. That keeps `splitFolds` a plain extension given to the MergeView, instead of reconfiguring both editors after they exist. `foldField.test.ts` builds a real MergeView and checks both sides fold the same runs.
