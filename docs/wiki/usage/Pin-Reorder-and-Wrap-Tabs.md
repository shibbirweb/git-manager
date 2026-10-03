# Pin, Reorder and Wrap Tabs

Keep the files you always need at the front of the tab strip, put tabs in the order you like, and choose whether a long row of tabs scrolls or wraps. This page covers the tab strip above the editor. Opening, saving and closing files is in [Editor and Tabs](Editor-and-Tabs.md).

## Move a tab

Drag a tab left or right, like in JetBrains IDEs:

- Press on a tab and move the mouse a little. The tab lifts and follows the pointer, and the other tabs slide aside to show where it will land.
- Let go to drop it there. The tab you dragged becomes the tab on screen.
- Press **Escape** while dragging to put it back where it was.
- When the tabs scroll, drag near the left or right end of the strip to scroll it.

A tab moves inside its own group. With the [split editor](Editor-and-Tabs.md#tabs) on, use **Move to Right Group** or **Move to Left Group** in the tab's right-click menu to move it to the other group.

The **Diff** tab is always first and cannot be moved.

## Pin a tab

![Two pinned tabs at the front of the strip](../images/tabs-pinned.png)

*Two pinned tabs at the front, each with a pin button that unpins it.*

A pinned tab stays at the front of the strip and stays open when you clean up:

- Right-click a tab and choose **Pin Tab**, or use **Window > Pin Tab** for the tab on screen.
- Pinned tabs move to the start of the strip, after the Diff tab, in the order you pinned them.
- A pinned tab shows a pin where the close button would be. Click the pin to unpin it.
- **Close Others**, **Close to the Right** and **Close All** leave pinned tabs open. The **Tab limit** in Settings > Editor never closes them either.
- To close a pinned tab, middle-click it, choose **Close** in its menu, or press **Cmd+W** while it is on screen.

Dragging never pins or unpins a tab. A pinned tab moves only among the pinned tabs, and any other tab stops right after the last pinned one.

Pinning a preview tab (the one in italics) also keeps it open. Pinned tabs stay pinned after a restart when **Reopen tabs on start** is on, and **Reopen Closed Tab** (Shift+Cmd+T) brings a closed pinned tab back pinned.

## Wrap tabs

By default, tabs that do not fit stay in one row and you scroll through them with the mouse wheel. Turn on **Settings > Editor > Wrap tabs** to show them on more rows instead, like VS Code:

![Tabs wrapped onto two rows](../images/tabs-wrapped.png)

*With Wrap tabs on, tabs that do not fit go onto a second row.*

- Every tab stays visible, so you never have to scroll to find one.
- The strip grows one row at a time as you open tabs, and shrinks as you close them.
- Dragging works across rows: move the pointer to another row to drop the tab there.

Turn the switch off to go back to one scrolling row. The setting is saved as `wrapTabs` in `settings.json`.

## Related

- [Editor and Tabs](Editor-and-Tabs.md)
- [Settings](Settings.md)
- [How tabs are arranged (developer)](../developer/How-Tabs-Are-Arranged.md)
