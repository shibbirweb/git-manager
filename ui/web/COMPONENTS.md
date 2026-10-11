# Git Manager UI components

Generated from `ui/web/src/lib/docs/` by `bun run ui:docs`; do not edit by hand. Every component takes its colors from
the theme tokens and its sizes from `ui/design-tokens/`, and none takes a class or style: everything is a prop. Lay out
screens with Stack and write words with Text. Import a component from `$ui/components/<Name>.svelte`; each one has its
own page in `docs/components/`.

## Actions

- [Button](docs/components/Button.md): A text button: Default, Primary for the main action, Danger, or Danger primary
  for a destructive confirm.
- [IconButton](docs/components/IconButton.md): A borderless icon button, optionally with text after the icon; `label` is
  its name and tooltip.
- [Segmented](docs/components/Segmented.md): A row of mutually exclusive choices (a toggle group), like Light / Dark /
  System. Arrow keys move.
- [Icon](docs/components/Icon.md): A stroke icon on a 24px grid in the current text color. The preview lists every icon
  name.

## Forms

- [Input](docs/components/Input.md): A single-line text field. `invalid` draws a red border; Field shows the message
  under it.
- [TextArea](docs/components/TextArea.md): A multi-line text field, like the commit message box.
- [Select](docs/components/Select.md): A native drop-down list, styled like Input.
- [Checkbox](docs/components/Checkbox.md): A native checkbox with its label; clicking the text toggles it too.
- [RadioGroup](docs/components/RadioGroup.md): Native radio buttons for one choice among a few, each with an optional
  description.
- [Switch](docs/components/Switch.md): An on/off switch for a setting that applies at once.
- [Slider](docs/components/Slider.md): A range slider with its value on the right, like Settings' font size.
- [Field](docs/components/Field.md): A labelled form field: the label, the control, then a hint or an error under it.
- [SettingRow](docs/components/SettingRow.md): A Settings row: title and hint on the left, the control on the right, or
  under them when stacked.
- [SearchField](docs/components/SearchField.md): A filter box with a magnifier and a clear button, like Settings'
  search. Esc clears, then blurs.

## Feedback

- [Spinner](docs/components/Spinner.md): A small spinning ring for work in progress.
- [Badge](docs/components/Badge.md): A count in a small pill, like the changes count on the activity bar; "99+" above
  `max`.
- [Tag](docs/components/Tag.md): A small label beside a name, like "primary" or "folder" in the AI panel.
- [Kbd](docs/components/Kbd.md): A keyboard shortcut drawn as a key cap.
- [ProgressBar](docs/components/ProgressBar.md): A thin bar for a share of a whole, like each process's memory in the
  status bar details.
- [Notice](docs/components/Notice.md): A tinted banner with an icon, a message and an optional action on the right.
- [EmptyState](docs/components/EmptyState.md): The centered message of an empty panel or tab, with an optional icon,
  hint and action.

## Overlays

- [Dialog](docs/components/Dialog.md): A modal dialog over a dimmed window: a title, the content and the actions on the
  right.
- [ConfirmDialog](docs/components/ConfirmDialog.md): Asks before an action: a title, a message and Cancel / OK; `danger`
  makes the confirm button red.
- [Popover](docs/components/Popover.md): A panel anchored to its trigger, like the AI usage panel; Esc or an outside
  click closes it.
- [Menu](docs/components/Menu.md): A context or drop-down menu at a point, with hints, separators and submenus; keyboard
  friendly.
- [MenuButton](docs/components/MenuButton.md): A button that opens a Menu under itself, like a "..." button.
- [ToastHost](docs/components/ToastHost.md): Draws toasts in the bottom right corner: a colored edge for the kind,
  title, detail and buttons.

## Navigation

- [TabStrip](docs/components/TabStrip.md): The editor's tab strip: icon, name, hint and a close button; a dot for
  unsaved edits, italic previews.
- [Tabs](docs/components/Tabs.md): Panel tabs in small capitals with an accent underline, like Terminal / Run / Git
  Console.
- [Tree](docs/components/Tree.md): A file-tree list: folders open and close, rows indent by depth, and only rows in view
  are drawn.
- [VirtualList](docs/components/VirtualList.md): A long list that draws only the rows in view, for thousands of rows of
  one fixed height.
- [Collapsible](docs/components/Collapsible.md): A section whose header opens and closes it: chevron, bold title, count
  and hover actions.
- [ListRow](docs/components/ListRow.md): A row of a pick or command list: a label and a dim description; the highlighted
  row is accent-filled.
- [PickList](docs/components/PickList.md): A filterable list to pick one item: words filter, arrows move, Enter picks,
  Esc cancels.
- [Breadcrumbs](docs/components/Breadcrumbs.md): A path as crumbs separated by chevrons, like the Navigation Bar; the
  file is bold.

## Layout

- [Stack](docs/components/Stack.md): Lays out children in a row or a column with a gap from the spacing tokens.
- [Text](docs/components/Text.md): Text in a named text style from the design tokens, so words never need a class or
  color.
- [Grid](docs/components/Grid.md): A grid of equal columns: a fixed count, or as many as fit at a minimum width.
- [Card](docs/components/Card.md): A bordered box that groups rows, like a worktree card in the AI panel.
- [Divider](docs/components/Divider.md): A 1px line between groups: horizontal by default, vertical in toolbars.
- [SplitPane](docs/components/SplitPane.md): Two panes side by side or stacked, with a ResizeHandle between; `size` is
  the first pane's px.
- [ResizeHandle](docs/components/ResizeHandle.md): A drag handle on a panel's edge: a line that becomes an accent bar on
  hover; keys and double-click.
- [StatusBar](docs/components/StatusBar.md): The bottom status bar: StatusItems on the left (repository, branch) and on
  the right.
- [StatusItem](docs/components/StatusItem.md): One status bar item: an icon and short text; a button when it has
  `onclick`.
- [ActivityBar](docs/components/ActivityBar.md): The vertical icon bar beside a side panel; the open panel is tinted
  with an accent line.

## Editor

- [SearchToggles](docs/components/SearchToggles.md): Match Case, Words and Regex toggles inside a search field.
- [FindBar](docs/components/FindBar.md): The editor's find and replace bar: find field with toggles, match counter,
  previous, next and close.
- [CodeView](docs/components/CodeView.md): Read-only, highlighted code with line numbers and a Copy button, in
  CodeMirror like the editors.
