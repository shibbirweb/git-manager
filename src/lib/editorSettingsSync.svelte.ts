// Settings that open editors and other parts follow live, without a rebuild: the cursor, the font, whitespace,
// word wrap, syntax highlighting, indentation, editor features, file icons, custom keys, Unload hidden tabs and Do
// Not Disturb. Called once from App.svelte while it initializes, so the effects live as long as the window.
import { untrack } from "svelte";
import { runCommand, windowKeys } from "$lib/commands/commandRuntime";
import { editorKeyPlan } from "$lib/commands/editorKeyPlan";
import { setCommandKeys } from "$lib/editor/commandKeys";
import { cursorOptions, remeasureEditors, setEditorCursor } from "$lib/editor/cursor";
import { featureOptions } from "$lib/editor/featurePlan";
import { setEditorFeatures } from "$lib/editor/features";
import { setIndentation } from "$lib/editor/indentation";
import { setSyntaxHighlighting } from "$lib/editor/languages";
import { setRenderWhitespace } from "$lib/editor/whitespace";
import { setWordWrap } from "$lib/editor/wordWrap";
import { setFileIcons } from "$lib/fileIcons/fileIcons.svelte";
import { notifications } from "$lib/notifications/notifications.svelte";
import { repoStore } from "$lib/stores/repo.svelte";
import { settings } from "$lib/stores/settings.svelte";
import { TAB_SLEEP_CHECK_MS } from "$lib/stores/tabSleep";

export function followEditorSettings(): void {
  // Do Not Disturb keeps non-error toasts in the bell's list only.
  $effect(() => {
    notifications.doNotDisturb = settings.notificationsDoNotDisturb;
  });

  // Open editors follow the Render whitespace setting without being rebuilt.
  $effect(() => {
    setRenderWhitespace(settings.renderWhitespace);
  });

  // And the cursor settings.
  $effect(() => {
    setEditorCursor(cursorOptions(settings));
  });

  // And the editor font: without a new measure, the selection, guides and inline blame stay where the old lines were.
  $effect(() => {
    void [
      settings.editorFontSize,
      settings.editorLineHeight,
      settings.editorFontFamily,
      settings.editorFontWeight,
      settings.fontLigatures,
    ];
    remeasureEditors();
  });

  // And Unload hidden tabs: file tabs out of sight for a while give their editors back.
  $effect(() => {
    if (!settings.unloadHiddenTabs) {
      return;
    }
    const delayMs = settings.unloadHiddenTabsMinutes * 60_000;
    const timer = setInterval(() => repoStore.sleepHiddenTabs(delayMs), TAB_SLEEP_CHECK_MS);
    return () => clearInterval(timer);
  });

  // And syntax highlighting: off, editors drop their grammar and syntax tree.
  $effect(() => {
    setSyntaxHighlighting(settings.syntaxHighlighting);
  });

  // And word wrap (View > Word Wrap, Option+Z).
  $effect(() => {
    setWordWrap(settings.wordWrap);
  });

  // And the file type icons: an icon set loads only while it is chosen.
  $effect(() => {
    void setFileIcons(settings.fileIcons, settings.colorMode === "light");
  });

  // And the indentation: each open editor reads its file again with the new settings.
  $effect(() => {
    setIndentation({ detect: settings.detectIndentation, tabSize: settings.tabSize });
  });

  // And the editor features (auto-close, completion, folding, guides...); a feature turned off leaves the editors.
  $effect(() => {
    setEditorFeatures(featureOptions(settings));
  });

  // And the custom keyboard shortcuts; a window command with a custom key also runs from an editor.
  $effect(() => {
    const keys = windowKeys();
    untrack(() => setCommandKeys(editorKeyPlan(keys.specs, keys.overrides, keys.platform), runCommand));
  });
}
